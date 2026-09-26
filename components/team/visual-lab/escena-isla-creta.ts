/**
 * FP Visual Lab — escena 3D de Isla Creta.
 *
 * Port del `viewer.js` de la entrega (revisión 03) al contrato de las otras
 * escenas: clase imperativa a la que la UI le habla, sin React. La geometría
 * no se construye aquí: se carga el GLB completo (`isla-creta.glb`, 16 MB) y
 * se le añade lo que el archivo no puede llevar: cielo procedural con nubes,
 * agua con reflexión planar, volúmenes transparentes de las parcelas, grano
 * de superficie, selección y capas.
 *
 * Lo que no hay que tocar (ver LEEME.md de la entrega):
 *  - los modelos comparten origen y metros: NO se centra ni se normaliza;
 *  - `extras.unitId` (respaldo `extras.id`) identifica cada parcela;
 *  - Entorno y Vegetación se combinan: un árbol de contexto solo se ve si
 *    ambas capas están activas;
 *  - el GLB lleva un agua estática de respaldo (`IC • agua`) que se oculta
 *    al crear la reflectante, para no tener dos planos superpuestos.
 *
 * Calidad por dispositivo: en móvil bajan el shadow map, la textura de
 * reflexión, el pixel ratio y el antialias; los límites parcelarios no cambian.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import type { Parcela, Volumen, VistaId, CapaId, DemoEstado } from '@/lib/visual-lab/isla-creta'
import { DEMO } from '@/lib/visual-lab/isla-creta'

export interface QA {
  vinculadas: number
  esperadas: number
  raycast: number
  faltan: string[]
  volumenes: number
  ms: number
}

export interface EscenaOpts {
  canvas: HTMLCanvasElement
  wrap: HTMLElement
  labelEl: HTMLElement | null
  compassEl: HTMLElement | null
  units: Parcela[]
  volumenes: Volumen[]
  glbUrl: string
  onHover: (id: string | null) => void
  onPick: (id: string | null) => void
  onProgress: (frac: number) => void
  onReady: (qa: QA) => void
  onError: (msg: string) => void
}

const SEL = '#b5b47d'
const SEL_EM = '#25240b'

/** Extensión visual de cada encuadre: caja que la cámara debe abarcar. */
const EXTENT: Record<VistaId, [[number, number, number], [number, number, number]]> = {
  phase: [[-280, -5, -105], [625, 62, 390]],
  whole: [[-800, -5, -650], [950, 62, 530]],
  top: [[-800, -5, -650], [950, 62, 530]],
}

export class Escena {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private hemi: THREE.HemisphereLight
  private sun: THREE.DirectionalLight
  private sky: Sky
  private water: Water
  private envTex: THREE.Texture | null = null
  private normals: THREE.DataTexture
  private wrap: HTMLElement
  private canvas: HTMLCanvasElement
  private labelEl: HTMLElement | null
  private compassEl: HTMLElement | null
  private units: Parcela[]
  private byId: Record<string, Parcela> = {}
  private volumenes: Volumen[]
  private volById: Record<string, Volumen> = {}
  private opts: EscenaOpts

  private root: THREE.Group | null = null
  private objects = new Map<string, THREE.Mesh>()
  private baseColors = new Map<string, THREE.Color>()
  private allBounds = new THREE.Group()
  private selBounds = new THREE.Group()

  private ray = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private v3 = new THREE.Vector3()
  private ptr: { x: number; y: number } | null = null
  private down: { x: number; y: number } | null = null
  private needHover = false
  private hoverId: string | null = null
  private selId: string | null = null
  private demo = false
  private capas: Record<CapaId, boolean> = { entorno: true, vegetacion: true, arquitectura: true, volumenes: false }
  private noche = false

  private rafId = 0
  private ro: ResizeObserver | null = null
  private frame = 0
  private last = 0
  private reflectionDirty = true
  private reflectEvery: number
  private pausada = false
  private muerta = false
  private cargado = false
  private loader: GLTFLoader | null = null
  private tween: { p0: THREE.Vector3; p1: THREE.Vector3; t0v: THREE.Vector3; t1v: THREE.Vector3; t0: number; dur: number } | null = null
  readonly movil: boolean

  // órbita lenta alrededor de la parcela seleccionada: arranca al terminar el
  // vuelo y se pausa en cuanto alguien toca la cámara, para volver tras un rato quieto
  private orbitar = false
  private tocado = 0
  /** Desplazamiento horizontal del centro óptico (px): deja la parcela en el hueco libre junto a la ficha */
  private shift = 0
  private shiftT = 0

  constructor(opts: EscenaOpts) {
    this.opts = opts
    this.wrap = opts.wrap
    this.canvas = opts.canvas
    this.labelEl = opts.labelEl
    this.compassEl = opts.compassEl
    this.units = opts.units
    this.volumenes = opts.volumenes
    this.units.forEach((u) => { this.byId[u.unitId] = u })
    this.volumenes.forEach((v) => { this.volById[v.id] = v })

    const W = this.wrap.clientWidth || 1200
    const H = this.wrap.clientHeight || 700
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    this.movil = W < 700 || (coarse && W < 1024)
    this.reflectEvery = this.movil ? 12 : 8

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: !this.movil, alpha: false, powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 1.6))
    renderer.setSize(W, H, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    this.renderer = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#b6b9ae')
    this.scene = scene

    // en vertical el trazado es apaisado: se abre el FOV para que no salga diminuto
    const camera = new THREE.PerspectiveCamera(W / H < 1 ? 50 : 42, W / H, 5, 14000)
    this.camera = camera

    const controls = new OrbitControls(camera, this.canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.minDistance = 32
    controls.maxDistance = 3600
    controls.maxPolarAngle = Math.PI * 0.46
    controls.minPolarAngle = 0.02
    controls.screenSpacePanning = true
    // en órbita la cámara cambia cada fotograma: la reflexión va a su ritmo (cada 3)
    controls.addEventListener('change', () => { if (!controls.autoRotate) this.reflectionDirty = true })
    controls.addEventListener('start', () => { this.tween = null; this.tocado = performance.now(); controls.autoRotate = false })
    controls.addEventListener('end', () => { this.tocado = performance.now() })
    controls.autoRotateSpeed = 0.55
    this.controls = controls

    const hemi = new THREE.HemisphereLight('#dae7ee', '#736345', 0.8)
    scene.add(hemi)
    this.hemi = hemi
    const sun = new THREE.DirectionalLight('#ffebc5', 2.6)
    sun.position.set(-360, 670, 350)
    sun.castShadow = true
    const sm = this.movil ? 2048 : 4096
    sun.shadow.mapSize.set(sm, sm)
    Object.assign(sun.shadow.camera, { left: -830, right: 830, top: 650, bottom: -650, near: 50, far: 1900 })
    sun.shadow.bias = -0.00022
    sun.shadow.normalBias = 0.16
    sun.shadow.radius = 2
    scene.add(sun)
    scene.add(sun.target)
    this.sun = sun

    // ── cielo procedural con una capa de nubes: es lo que el agua refleja
    const sky = new Sky()
    sky.scale.setScalar(11000)
    scene.add(sky)
    const skyU = sky.material.uniforms
    skyU.turbidity.value = 7
    skyU.rayleigh.value = 1.5
    skyU.mieCoefficient.value = 0.007
    skyU.mieDirectionalG.value = 0.82
    const sunDirection = new THREE.Vector3(-0.47, 0.5, 0.72).normalize()
    skyU.sunPosition.value.copy(sunDirection)
    sky.material.fragmentShader = sky.material.fragmentShader
      .replace('void main() {', `float icHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float icNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(icHash(i),icHash(i+vec3(1,0,0)),f.x),mix(icHash(i+vec3(0,1,0)),icHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(icHash(i+vec3(0,0,1)),icHash(i+vec3(1,0,1)),f.x),mix(icHash(i+vec3(0,1,1)),icHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float icCloud(vec3 p){float n=0.0,a=.55;for(int i=0;i<5;i++){n+=icNoise(p)*a;p=p*2.03+vec3(2.1,5.4,3.7);a*=.5;}return n;}
void main() {`)
      .replace('gl_FragColor = vec4( retColor, 1.0 );', `float cloud=icCloud(direction*4.8+vec3(1.4,2.8,4.3));float coverage=smoothstep(.46,.66,cloud)*smoothstep(.05,.26,direction.y);retColor=mix(retColor,vec3(1.6,1.58,1.49),coverage*.9);gl_FragColor=vec4(retColor,1.0);`)
    sky.material.needsUpdate = true
    this.sky = sky

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new THREE.Scene()
    envScene.add(sky.clone())
    this.envTex = pmrem.fromScene(envScene, 0.015, 1, 12000).texture
    scene.environment = this.envTex
    scene.environmentIntensity = 0.65
    pmrem.dispose()

    // ── normales de oleaje analíticas: sin textura descargada
    this.normals = this.normalesAgua()
    const tw = this.movil ? 384 : 768
    const water = new Water(new THREE.PlaneGeometry(12500, 12500), {
      textureWidth: tw, textureHeight: tw, waterNormals: this.normals, sunDirection,
      sunColor: 0xffeed3, waterColor: 0x52635c, distortionScale: 1.9, alpha: 1,
    })
    water.rotation.x = -Math.PI / 2
    water.position.y = -1.12
    scene.add(water)
    this.water = water
    // la reflexión planar es un render extra: solo cuando la cámara se mueve o cada N fotogramas
    const reflect = water.onBeforeRender
    const self = this
    water.onBeforeRender = function (r, s, c, g, m, gr) {
      if (self.reflectionDirty || self.frame % self.reflectEvery === 0) {
        reflect.call(this, r, s, c, g, m, gr)
        self.reflectionDirty = false
      }
    }

    scene.add(this.allBounds, this.selBounds)
    this.allBounds.visible = false
    this.volumenes.forEach((v) => this.allBounds.add(this.volumen(v)))

    this.canvas.style.cursor = 'grab'
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerdown', this.onDown)
    this.canvas.addEventListener('pointerup', this.onUp)
    this.canvas.addEventListener('pointerleave', this.onLeave)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.wrap)

    this.setVista('phase', 0)
    this.last = performance.now()
    this.raf()
    this.cargar()
  }

  /* ── Carga ─────────────────────────────────────────────────────────── */

  private cargar() {
    const t0 = performance.now()
    const loader = new GLTFLoader()
    this.loader = loader
    this.opts.onProgress(0)
    loader.load(
      this.opts.glbUrl,
      (gltf) => {
        if (this.muerta) return
        try {
          this.montar(gltf.scene)
          this.cargado = true
          this.opts.onReady(this.qa(t0))
        } catch (e) {
          this.opts.onError(e instanceof Error ? e.message : String(e))
        }
      },
      (xhr) => {
        if (this.muerta) return
        if (xhr.lengthComputable && xhr.total > 0) this.opts.onProgress(Math.min(1, xhr.loaded / xhr.total))
        else this.opts.onProgress(Math.min(0.95, xhr.loaded / 16.3e6))
      },
      (err) => {
        if (this.muerta) return
        const m = err instanceof Error ? err.message : 'No se pudo descargar la maqueta'
        this.opts.onError(m)
      },
    )
  }

  private montar(root: THREE.Group) {
    this.root = root
    this.scene.add(root)
    const materials = new Set<THREE.Material>()
    root.traverse((o) => {
      // categoría y bandera de vegetación se heredan del grupo de instancias
      if (!o.userData.category && o.parent?.userData.category) o.userData.category = o.parent.userData.category
      if (o.parent?.userData.vegetation) o.userData.vegetation = true
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      // el agua estática del GLB cede el sitio a la reflectante
      if (mats.some((m) => m.name === 'IC • agua')) { mesh.visible = false; return }
      mesh.receiveShadow = true
      mesh.geometry.computeBoundingBox()
      const bb = mesh.geometry.boundingBox!
      const plana = !(mesh as THREE.InstancedMesh).isInstancedMesh && bb.max.y - bb.min.y < 0.3
      const unitId = (mesh.userData.unitId ?? mesh.userData.id) as string | undefined
      mesh.castShadow = !plana && !unitId && !mesh.name.includes('agua')
      for (const m of mats) if (!materials.has(m)) { this.grano(m); materials.add(m) }
      if (unitId && this.byId[unitId]) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone()
        this.grano(m)
        mesh.material = m
        mesh.userData.unitId = unitId
        this.objects.set(unitId, mesh)
        this.baseColors.set(unitId, m.color.clone())
      }
    })
    this.scene.updateMatrixWorld(true)
    this.camera.updateMatrixWorld(true)
    this.aplicarCapas()
    this.recolor()
    this.renderer.shadowMap.needsUpdate = true
    this.reflectionDirty = true
    // las sombras son estáticas: se hornean una vez y solo se repintan al cambiar capas
    this.renderer.shadowMap.autoUpdate = false
  }

  private qa(t0: number): QA {
    const faltan = this.units.filter((u) => !this.objects.has(u.unitId)).map((u) => u.unitId)
    let checks = 0
    const dir = new THREE.Vector3(0, -1, 0)
    for (const u of this.units) {
      const o = this.objects.get(u.unitId)
      if (!o) continue
      this.ray.set(new THREE.Vector3(u.centroidGltf[0], 120, u.centroidGltf[2]), dir)
      if (this.ray.intersectObject(o, false).length) checks++
    }
    return {
      vinculadas: this.objects.size, esperadas: this.units.length, raycast: checks,
      faltan, volumenes: this.volumenes.length, ms: Math.round(performance.now() - t0),
    }
  }

  /** Grano sutil en praderas y viario, solo de cerca. Igual que el visor de referencia. */
  private grano(material: THREE.Material) {
    const name = material.name
    const grass = /parcelas|pradera|etapa futura|multifamiliar|cubresuelos/.test(name)
    const road = /asfalto|caliza/.test(name)
    if (!grass && !road) return
    material.onBeforeCompile = (s) => {
      s.vertexShader = 'varying vec3 icWorld;\n' + s.vertexShader
      s.vertexShader = s.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nicWorld=(modelMatrix*vec4(transformed,1.0)).xyz;')
      s.fragmentShader = 'varying vec3 icWorld;\n' + s.fragmentShader
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
float icGrain=fract(sin(dot(floor(icWorld.xz*${grass ? '4.0' : '35.0'}),vec2(12.9898,78.233)))*43758.5453);
float icNear=1.0-smoothstep(.04,.20,max(fwidth(icWorld.x),fwidth(icWorld.z)));diffuseColor.rgb*= ${grass ? '(.97+.018*sin(icWorld.x*.047+icWorld.z*.063)+icNear*(icGrain-.5)*.10)' : '(.97+icNear*(icGrain-.5)*.12)'};`)
    }
    material.customProgramCacheKey = () => (grass ? 'IC-grass-v2' : 'IC-road-v2')
  }

  private normalesAgua(): THREE.DataTexture {
    const N = 256
    const bytes = new Uint8Array(N * N * 4)
    let seed = 79571
    const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296 }
    const grids = [8, 16, 32, 64].map((size) => ({ size, values: Float32Array.from({ length: size * size }, random) }))
    const noise2 = (x: number, y: number, g: { size: number; values: Float32Array }) => {
      const xx = ((x % N) + N) % N / N * g.size, yy = ((y % N) + N) % N / N * g.size
      const ix = Math.floor(xx), iy = Math.floor(yy)
      let u = xx - ix, v = yy - iy
      u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v)
      const at = (a: number, b: number) => g.values[(b % g.size) * g.size + a % g.size]
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u), THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u), v)
    }
    const pesos = [0.5, 0.27, 0.14, 0.07]
    const height = (x: number, y: number) => grids.reduce((a, g, i) => a + noise2(x, y, g) * pesos[i], 0)
    const v = new THREE.Vector3()
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * 2, dy = (height(x, y + 1) - height(x, y - 1)) * 2
      v.set(-dx, -dy, 1).normalize()
      const i = (y * N + x) * 4
      bytes[i] = (v.x * 0.5 + 0.5) * 255; bytes[i + 1] = (v.y * 0.5 + 0.5) * 255; bytes[i + 2] = (v.z * 0.5 + 0.5) * 255; bytes[i + 3] = 255
    }
    const tex = new THREE.DataTexture(bytes, N, N, THREE.RGBAFormat)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
    return tex
  }

  /** Volumen transparente de una parcela desde su perímetro CAD (x, -y → x, z). */
  private volumen(p: Volumen, highlight = false): THREE.Group {
    const g = new THREE.Group()
    const pts = p.polygon.slice(0, -1)
    const h = p.height, z0 = 2.1
    const pos: number[] = [], edges: number[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      pos.push(a[0], z0, -a[1], b[0], z0, -b[1], b[0], h + z0, -b[1], a[0], z0, -a[1], b[0], h + z0, -b[1], a[0], h + z0, -a[1])
      edges.push(a[0], h + z0, -a[1], b[0], h + z0, -b[1], a[0], z0, -a[1], b[0], z0, -b[1])
      const prev = pts[(i + pts.length - 1) % pts.length]
      if (i === 0 || Math.hypot(a[0] - prev[0], a[1] - prev[1]) > 1.5) edges.push(a[0], z0, -a[1], a[0], h + z0, -a[1])
    }
    const cap = THREE.ShapeUtils.triangulateShape(pts.map((a) => new THREE.Vector2(a[0], -a[1])), [])
    for (const tri of cap) for (const i of tri) pos.push(pts[i][0], h + z0, -pts[i][1])
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      color: highlight ? '#efd195' : '#9bbcad', transparent: true, opacity: highlight ? 0.2 : 0.055, depthWrite: false, side: THREE.DoubleSide,
    }))
    mesh.renderOrder = 3
    g.add(mesh)
    const eg = new THREE.BufferGeometry()
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3))
    const ln = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
      color: highlight ? '#eac16d' : '#d1dfb0', transparent: true, opacity: highlight ? 0.95 : 0.58, depthWrite: false,
    }))
    ln.renderOrder = 4
    g.add(ln)
    g.userData.unitId = p.id
    return g
  }

  private vaciar(g: THREE.Group) {
    for (const o of [...g.children]) {
      o.traverse((n) => {
        const m = n as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose()
      })
      g.remove(o)
    }
  }

  /* ── Color, capas, selección ──────────────────────────────────────── */

  private recolor() {
    this.objects.forEach((o, id) => {
      const u = this.byId[id]
      const m = o.material as THREE.MeshStandardMaterial
      m.color.copy(this.baseColors.get(id)!)
      if (this.demo && u) m.color.set(DEMO[u.demoStatus as DemoEstado].color)
      if (id === this.selId) m.color.set(SEL)
      m.emissive.set(id === this.selId ? SEL_EM : '#000000')
      m.emissiveIntensity = 0.1
    })
    this.reflectionDirty = true
  }

  private aplicarCapas() {
    if (!this.root) return
    const { entorno, vegetacion, arquitectura } = this.capas
    this.root.traverse((o) => {
      const ctx = o.userData.category === 'context'
      const veg = !!o.userData.vegetation
      const arq = (o as THREE.Mesh).isMesh && o.userData.category === 'architecture'
      if (veg || ctx) o.visible = (!veg || vegetacion) && (!ctx || entorno)
      else if (arq) o.visible = arquitectura
    })
    // el agua de respaldo del GLB sigue oculta pase lo que pase
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      if (mats.some((x) => x.name === 'IC • agua')) m.visible = false
    })
    this.allBounds.visible = this.capas.volumenes
    this.renderer.shadowMap.needsUpdate = true
    this.reflectionDirty = true
  }

  /* ── API pública ──────────────────────────────────────────────────── */

  setDemo(v: boolean) { this.demo = v; this.recolor() }

  setCapa(id: CapaId, v: boolean) { this.capas[id] = v; this.aplicarCapas() }

  setNoche(v: boolean) {
    this.noche = v
    this.hemi.intensity = v ? 0.52 : 0.8
    this.sun.intensity = v ? 1.8 : 2.6
    this.sun.color.set(v ? '#ffc887' : '#ffebc5')
    this.renderer.toneMappingExposure = v ? 0.87 : 1
    this.sky.material.uniforms.sunPosition.value.y = v ? 0.13 : 0.5
    this.water.material.uniforms.sunColor.value.set(v ? '#ffd29e' : '#ffeed3')
    this.renderer.shadowMap.needsUpdate = true
    this.reflectionDirty = true
  }

  setSel(id: string | null) {
    this.selId = id && this.byId[id] ? id : null
    if (!this.selId) {
      this.orbitar = false
      this.controls.autoRotate = false
      this.shiftT = 0
    }
    this.recolor()
    this.vaciar(this.selBounds)
    if (this.selId && this.volById[this.selId]) this.selBounds.add(this.volumen(this.volById[this.selId], true))
  }

  /**
   * Vuela a una parcela y la centra. Conserva el rumbo de la cámara pero fija
   * una inclinación de maqueta (~57° desde la vertical) y una distancia según
   * el tamaño real del lote, para que quepa entero con algo de contexto. Al
   * llegar arranca la órbita lenta.
   */
  acercar(id: string, dur = 1300) {
    const u = this.byId[id]
    if (!u) return
    const target = new THREE.Vector3(u.centroidGltf[0], u.type === 'unifamiliar' ? 4 : 20, u.centroidGltf[2])
    const vol = this.volById[id]
    let r = u.type === 'unifamiliar' ? 18 : 60
    if (vol) {
      const xs = vol.polygon.map((p) => p[0]), ys = vol.polygon.map((p) => p[1])
      r = Math.max(r, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2)
    }
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const dist = THREE.MathUtils.clamp((r * 2.6) / tan / Math.min(1, this.camera.aspect), 70, 900) * (this.movil ? 1.15 : 1)
    const cur = this.camera.position.clone().sub(this.controls.target)
    const az = Math.atan2(cur.x, cur.z), pol = 1.0
    const offset = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(dist)
    this.controls.autoRotate = false
    this.orbitar = true
    this.tocado = 0
    this.shiftT = this.hueco()
    this.volar(target.clone().add(offset), target, dur)
  }

  /**
   * Cuánto hay que correr el centro óptico para que la parcela quede en medio
   * del hueco libre: en escritorio la ficha tapa 428 px a la derecha y el panel
   * de lectura 314 px a la izquierda. En móvil la ficha ocupa toda la pantalla.
   */
  private hueco(): number {
    return this.wrap.clientWidth >= 1024 ? (428 - 314) / 2 : 0
  }

  private aplicarShift() {
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight
    if (!W || !H) return
    if (Math.abs(this.shift) < 0.5) this.camera.clearViewOffset()
    else this.camera.setViewOffset(W, H, this.shift, 0, W, H)
  }

  setVista(kind: VistaId, dur = 1100) {
    const target = new THREE.Vector3(...(kind === 'phase' ? [145, 7, 155] : [35, 5, 0]) as [number, number, number])
    const dir = new THREE.Vector3(...(kind === 'top' ? [0, 1, 0.0001] : kind === 'whole' ? [0.25, 0.95, 1] : [0.78, 0.73, 1]) as [number, number, number]).normalize()
    const extent = EXTENT[kind]
    // se encuadra la caja del conjunto: la distancia depende del aspecto del visor
    const cam = this.camera.clone()
    cam.position.copy(target).addScaledVector(dir, 1500)
    cam.lookAt(target)
    cam.updateMatrixWorld()
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    let distance = 500
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    for (const x of [extent[0][0], extent[1][0]]) for (const y of [extent[0][1], extent[1][1]]) for (const z of [extent[0][2], extent[1][2]]) {
      const v = new THREE.Vector3(x, y, z).sub(target)
      distance = Math.max(distance, Math.abs(v.dot(up)) / tan + v.dot(dir), Math.abs(v.dot(right)) / (tan * this.camera.aspect) + v.dot(dir))
    }
    const pos = target.clone().addScaledVector(dir, distance * (kind === 'phase' ? 0.91 : 1.07))
    this.volar(pos, target, dur)
  }

  private volar(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    if (dur <= 0) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
      this.reflectionDirty = true
      return
    }
    this.tween = { p0: this.camera.position.clone(), p1: pos, t0v: this.controls.target.clone(), t1v: target, t0: performance.now(), dur }
  }

  pausar(v: boolean) {
    this.pausada = v
    if (!v) { this.last = performance.now(); this.reflectionDirty = true }
    if (v && this.labelEl) this.labelEl.style.opacity = '0'
  }

  resize() {
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight
    if (!W || !H) return
    this.camera.aspect = W / H
    this.camera.fov = W / H < 1 ? 50 : 42
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(W, H, false)
    this.aplicarShift()
    this.reflectionDirty = true
  }

  dispose() {
    this.muerta = true
    cancelAnimationFrame(this.rafId)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointerleave', this.onLeave)
    this.ro?.disconnect()
    this.controls.dispose()
    this.vaciar(this.selBounds)
    this.vaciar(this.allBounds)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
      for (const x of mats) {
        const std = x as THREE.MeshStandardMaterial
        std.map?.dispose(); std.normalMap?.dispose(); std.roughnessMap?.dispose(); std.metalnessMap?.dispose(); std.emissiveMap?.dispose()
        x.dispose()
      }
    })
    const wm = this.water.material as THREE.ShaderMaterial
    ;(wm.uniforms.mirrorSampler?.value as THREE.Texture | undefined)?.dispose()
    this.normals.dispose()
    this.envTex?.dispose()
    this.scene.environment = null
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  /* ── Interacción ──────────────────────────────────────────────────── */

  private pick(): string | null {
    if (!this.ptr || !this.cargado) return null
    const r = this.wrap.getBoundingClientRect()
    this.ndc.set(((this.ptr.x - r.left) / r.width) * 2 - 1, -((this.ptr.y - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const hits = this.ray.intersectObjects(Array.from(this.objects.values()), false)
    return hits.length ? (hits[0].object.userData.unitId as string) : null
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    this.ptr = { x: e.clientX, y: e.clientY }
    this.needHover = true
  }

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY } }

  private onUp = (e: PointerEvent) => {
    const d = this.down
    this.down = null
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
    this.ptr = { x: e.clientX, y: e.clientY }
    const id = this.pick()
    if (id) {
      this.opts.onPick(id)
      this.acercar(id)
    }
  }

  private onLeave = () => {
    this.ptr = null
    if (this.hoverId) { this.hoverId = null; this.opts.onHover(null) }
    if (this.labelEl) this.labelEl.style.opacity = '0'
  }

  /* ── Bucle ────────────────────────────────────────────────────────── */

  private raf = () => {
    if (this.muerta) return
    this.rafId = requestAnimationFrame(this.raf)
    if (this.pausada) return
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    this.frame++

    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      this.camera.position.lerpVectors(this.tween.p0, this.tween.p1, e)
      this.controls.target.lerpVectors(this.tween.t0v, this.tween.t1v, e)
      this.reflectionDirty = true
      if (k >= 1) this.tween = null
    }

    // el centro óptico se desliza hacia el hueco libre, sin salto
    if (Math.abs(this.shiftT - this.shift) > 0.3) {
      this.shift += (this.shiftT - this.shift) * Math.min(1, dt * 5)
      if (Math.abs(this.shiftT - this.shift) <= 0.3) this.shift = this.shiftT
      this.aplicarShift()
      this.reflectionDirty = true
    }

    // órbita: tras el vuelo, o tras 4 s sin tocar la cámara
    const quieto = !this.tween && now - this.tocado > (this.tocado ? 4000 : 0)
    this.controls.autoRotate = this.orbitar && !!this.selId && quieto
    if (this.controls.autoRotate && this.frame % 3 === 0) this.reflectionDirty = true
    this.controls.update(dt)
    this.water.material.uniforms.time.value += dt * 0.38

    if (this.needHover && this.cargado) {
      this.needHover = false
      const id = this.pick()
      this.canvas.style.cursor = id ? 'pointer' : 'grab'
      if (id !== this.hoverId) { this.hoverId = id; this.opts.onHover(id) }
    }
    if (this.labelEl) {
      const u = this.hoverId ? this.byId[this.hoverId] : null
      if (u) {
        this.v3.set(u.centroidGltf[0], u.centroidGltf[1] + (u.type === 'unifamiliar' ? 4 : 30), u.centroidGltf[2]).project(this.camera)
        const r = this.wrap.getBoundingClientRect()
        this.labelEl.style.transform = `translate(${(this.v3.x * 0.5 + 0.5) * r.width}px,${(-this.v3.y * 0.5 + 0.5) * r.height}px)`
        this.labelEl.style.opacity = '1'
      } else {
        this.labelEl.style.opacity = '0'
      }
    }

    this.renderer.render(this.scene, this.camera)

    if (this.compassEl && this.frame % 2 === 0) {
      const north = this.controls.target.clone().add(new THREE.Vector3(0, 0, -100)).project(this.camera)
      const center = this.controls.target.clone().project(this.camera)
      const ang = Math.atan2((north.x - center.x) * this.wrap.clientWidth, (north.y - center.y) * this.wrap.clientHeight) * 180 / Math.PI
      this.compassEl.style.transform = `rotate(${ang}deg)`
    }
  }
}

/**
 * FP Visual Lab — escena 3D de Jorge Juan 40.
 *
 * Mismo contrato que las otras escenas (clase imperativa a la que la UI le habla,
 * sin React) y misma idea que Isla Creta: la geometría NO se construye aquí, viene
 * del GLB de Blender. Lo que añade la escena:
 *  - luz de maqueta (cielo + sol con sombra horneada una vez por cambio de capas);
 *  - selección por los volúmenes `VOL_*` (invisibles salvo al pasar o seleccionar);
 *  - despiece: al elegir una vivienda, las plantas de encima y la cubierta suben y, al
 *    llegar arriba, desaparecen; queda la planta entera a la vista con su interior en clay,
 *    la gemela maciza, luz uniforme sin sombras de sol y la cámara casi cenital.
 *
 * Los interiores van siempre ocultos fuera de la planta abierta: son la mitad de los
 * triángulos del edificio y desde fuera no se ven.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  type Vivienda, type VistaId, type CapaId, type ModoId,
  BY_ID, zPlanta, alturaPlanta, ANCHO_MEDIO, FONDO, PLANTAS,
} from '@/lib/visual-lab/jorge-juan'

export interface QA { viviendas: number; esperadas: number; ms: number; triangulos: number }

export interface EscenaOpts {
  canvas: HTMLCanvasElement
  wrap: HTMLElement
  labelEl: HTMLElement | null
  compassEl: HTMLElement | null
  glbUrl: string
  onHover: (id: string | null) => void
  onPick: (id: string | null) => void
  onProgress: (frac: number) => void
  onReady: (qa: QA) => void
  onError: (msg: string) => void
}

const ACENTO = '#D85A30'
/** Fondo y niebla: el papel crema de una maqueta de estudio */
const FONDO_ALTO = '#F4F2ED'
const FONDO_BAJO = '#DCD7CD'
const NIEBLA = '#E6E2DA'
/** Entorno «fantasma»: volúmenes translúcidos con arista fina */
const FANTASMA = { opacidad: 0.09, arista: '#6F6A60', aristaOpacidad: 0.5 }
/**
 * Paleta del visor (manda sobre los colores del GLB, que son los de Blender): suelo de
 * madera clara bajo un clay blanco y muebles un tono más oscuros, para que la
 * distribución se lea de un vistazo; calzada oscura para asentar la maqueta.
 */
const PALETA: Record<string, string> = {
  JJ_forjado: '#D8C9AF',
  JJ_clay: '#F4F2ED',
  JJ_clay_mueble: '#B9B1A4',
  CTX_calzada: '#8F8B84',
  CTX_acera: '#E3DFD7',
  CTX_granito: '#CFCBC4',
}
/** Recorrido de las plantas que suben al despiezar (m); al llegar desaparecen */
const LEVANTE = 30
/** Separación extra entre las plantas levantadas, para que se lean como piezas (m) */
const SEPARACION = 0.6

/**
 * Encuadres en coordenadas del GLB (Y arriba; la calle queda en Z negativa).
 * Jorge Juan solo tiene 15,2 m entre fachadas: una cámara baja «enfrente» cae dentro
 * del edificio de la otra acera y el vecino de la esquina tapa la fachada desde el
 * cruce. La de fachada (POV maestro de la placa) mira desde el noroeste por encima
 * de los tejados de enfrente; la aérea, desde el patio de manzana.
 */
const VISTAS: Record<VistaId, { pos: [number, number, number]; target: [number, number, number] }> = {
  calle: { pos: [-30, 56, -42], target: [1, 8, 13] },
  aerea: { pos: [45, 62, 75], target: [0, 8, 16] },
  cenital: { pos: [0, 120, 15.95], target: [0, 0, 16] },
}
export const POV_FIRMA = VISTAS.calle

interface Nodo { obj: THREE.Object3D; planta: number; mano: string; y0: number; off: number; offT: number }

export class Escena {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private sun: THREE.DirectionalLight
  private envTex: THREE.Texture | null = null
  private wrap: HTMLElement
  private canvas: HTMLCanvasElement
  private labelEl: HTMLElement | null
  private compassEl: HTMLElement | null
  private opts: EscenaOpts

  private root: THREE.Group | null = null
  private exteriores: Nodo[] = []
  private interiores: Nodo[] = []
  private cubiertas: Nodo[] = []
  private matsEntorno: THREE.MeshStandardMaterial[] = []
  private aristasEntorno: THREE.LineBasicMaterial[] = []
  private hemi: THREE.HemisphereLight
  private composer: EffectComposer | null = null
  private gtao: GTAOPass | null = null
  private velo = 1
  private veloT = 1
  private entorno: THREE.Object3D[] = []
  private calle: THREE.Object3D[] = []
  private volumenes = new Map<string, THREE.Mesh>()
  private matVol: Record<'oculto' | 'capa' | 'hover' | 'sel', THREE.MeshBasicMaterial> & { macizo: THREE.MeshStandardMaterial }
  private aristas = new Map<string, THREE.LineSegments>()

  private ray = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private v3 = new THREE.Vector3()
  private ptr: { x: number; y: number } | null = null
  private down: { x: number; y: number } | null = null
  private needHover = false
  private hoverId: string | null = null
  private selId: string | null = null
  private modo: ModoId = 'edificio'
  private capas: Record<CapaId, boolean> = { entorno: true, calle: true, volumenes: false }

  private rafId = 0
  private ro: ResizeObserver | null = null
  private frame = 0
  private last = 0
  private pausada = false
  private muerta = false
  private cargado = false
  private tween: { p0: THREE.Vector3; p1: THREE.Vector3; t0v: THREE.Vector3; t1v: THREE.Vector3; t0: number; dur: number } | null = null
  readonly movil: boolean
  /** Desplazamiento del centro óptico (px) para dejar la vivienda en el hueco libre junto a la ficha */
  private shift = 0
  private shiftT = 0

  constructor(opts: EscenaOpts) {
    this.opts = opts
    this.wrap = opts.wrap
    this.canvas = opts.canvas
    this.labelEl = opts.labelEl
    this.compassEl = opts.compassEl

    const W = this.wrap.clientWidth || 1200
    const H = this.wrap.clientHeight || 700
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    this.movil = W < 700 || (coarse && W < 1024)

    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.movil, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 1.75))
    renderer.setSize(W, H, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // las sombras son estáticas: se recalculan solo cuando cambia lo que se ve
    renderer.shadowMap.autoUpdate = false
    // AgX conserva los blancos de la fachada sin quemarlos (ACES los vuelve grises)
    renderer.toneMapping = THREE.AgXToneMapping
    renderer.toneMappingExposure = 1.02
    this.renderer = renderer

    const scene = new THREE.Scene()
    scene.background = this.degradado()
    scene.fog = new THREE.Fog(NIEBLA, 150, 340)
    this.scene = scene

    const camera = new THREE.PerspectiveCamera(W / H < 1 ? 48 : 36, W / H, 0.5, 1500)
    this.camera = camera

    const controls = new OrbitControls(camera, this.canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.minDistance = 8
    controls.maxDistance = 260
    controls.maxPolarAngle = Math.PI * 0.49
    controls.screenSpacePanning = true
    controls.addEventListener('start', () => { this.tween = null })
    this.controls = controls

    // cielo neutro de estudio para los reflejos; la luz que dibuja es el sol
    const pmrem = new THREE.PMREMGenerator(renderer)
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = this.envTex
    scene.environmentIntensity = 0.35
    pmrem.dispose()

    this.hemi = new THREE.HemisphereLight('#f6f3ec', '#9a9182', 0.62)
    scene.add(this.hemi)
    const sun = new THREE.DirectionalLight('#ffe9cf', 3.1)
    // tarde de verano: el sol baja por el noroeste y raspa la fachada a Jorge Juan, que
    // mira al norte; con el sol del sur la fachada quedaba siempre en sombra y plana
    sun.position.set(-85, 62, -70)
    sun.target.position.set(0, 4, 12)
    sun.castShadow = true
    const sm = this.movil ? 2048 : 4096
    sun.shadow.mapSize.set(sm, sm)
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 30, far: 260 })
    sun.shadow.bias = -0.00025
    sun.shadow.normalBias = 0.03
    sun.shadow.radius = 3
    scene.add(sun, sun.target)
    this.sun = sun

    // oclusión ambiental (GTAO) en escritorio: es lo que da peso a cornisas, balcones y al
    // clay del interior. En móvil se queda el render directo.
    if (!this.movil) {
      const composer = new EffectComposer(renderer)
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(W, H)
      composer.addPass(new RenderPass(scene, camera))
      const gtao = new GTAOPass(scene, camera, W, H)
      gtao.updateGtaoMaterial({ radius: 2.4, distanceExponent: 1.6, thickness: 1.6, scale: 1.2, samples: 16 })
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 })
      gtao.blendIntensity = 1
      composer.addPass(gtao)
      composer.addPass(new OutputPass())
      this.composer = composer
      this.gtao = gtao
    }

    const vol = (color: string, opacity: number) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    })
    this.matVol = {
      // invisible pero seleccionable: el raycaster no mira la opacidad
      oculto: Object.assign(vol('#000000', 0), { colorWrite: false }),
      capa: vol('#5E8A7A', 0.22),
      hover: vol(ACENTO, 0.22),
      sel: vol(ACENTO, 0.34),
      // la vivienda gemela durante el despiece: un bloque de clay liso
      macizo: new THREE.MeshStandardMaterial({ color: '#D9D3C8', roughness: 0.95 }),
    }

    this.canvas.style.cursor = 'grab'
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerdown', this.onDown)
    this.canvas.addEventListener('pointerup', this.onUp)
    this.canvas.addEventListener('pointerleave', this.onLeave)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.wrap)

    this.setVista('calle', 0)
    this.last = performance.now()
    this.raf()
    this.cargar()
  }

  /**
   * Aristas horizontales de los volúmenes del entorno (cornisas y arranques). Las
   * verticales se quitan: con 600 piezas de Catastro dibujaban una cortina de líneas.
   */
  private contornos(g: THREE.BufferGeometry): THREE.BufferGeometry {
    const e = new THREE.EdgesGeometry(g, 25)
    const a = e.getAttribute('position')
    const out: number[] = []
    for (let i = 0; i < a.count; i += 2) {
      const y0 = a.getY(i), y1 = a.getY(i + 1)
      if (Math.abs(y0 - y1) < 0.05 && y0 > 0.5) out.push(a.getX(i), y0, a.getZ(i), a.getX(i + 1), y1, a.getZ(i + 1))
    }
    e.dispose()
    const r = new THREE.BufferGeometry()
    r.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
    return r
  }

  /** Fondo en degradado vertical (textura de pantalla, no un cielo 3D). */
  private degradado(): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = 2; c.height = 256
    const g = c.getContext('2d')!
    const lg = g.createLinearGradient(0, 0, 0, 256)
    lg.addColorStop(0, FONDO_ALTO)
    lg.addColorStop(1, FONDO_BAJO)
    g.fillStyle = lg
    g.fillRect(0, 0, 2, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  /* ── Carga ─────────────────────────────────────────────────────────── */

  private cargar() {
    const t0 = performance.now()
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)
    this.opts.onProgress(0)
    loader.load(
      this.opts.glbUrl,
      (gltf) => {
        draco.dispose()
        if (this.muerta) return
        try {
          this.montar(gltf.scene)
          this.cargado = true
          let tris = 0
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh
            if (m.isMesh && m.visible && m.geometry.index) tris += m.geometry.index.count / 3
          })
          this.opts.onReady({ viviendas: this.volumenes.size, esperadas: 14, ms: Math.round(performance.now() - t0), triangulos: Math.round(tris) })
        } catch (e) {
          this.opts.onError(e instanceof Error ? e.message : String(e))
        }
      },
      (xhr) => {
        if (this.muerta) return
        if (xhr.lengthComputable && xhr.total > 0) this.opts.onProgress(Math.min(1, xhr.loaded / xhr.total))
      },
      (err) => {
        draco.dispose()
        if (this.muerta) return
        this.opts.onError(err instanceof Error ? err.message : 'No se pudo descargar la maqueta')
      },
    )
  }

  private montar(root: THREE.Group) {
    this.root = root
    this.scene.add(root)
    // los nodos de primer nivel traen las extras de Blender; las mallas cuelgan de ellos
    for (const o of root.children) {
      const x = o.userData as { capa?: string; planta?: number; mano?: string; unitId?: string }
      const n = o.name
      const nodo = (): Nodo => ({ obj: o, planta: x.planta ?? 0, mano: x.mano ?? '', y0: o.position.y, off: 0, offT: 0 })
      if (x.capa === 'exterior') this.exteriores.push(nodo())
      else if (x.capa === 'interior') this.interiores.push(nodo())
      else if (x.capa === 'cubierta') this.cubiertas.push({ ...nodo(), planta: PLANTAS + 1 })
      else if (x.capa === 'volumen' && x.unitId) {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.material = this.matVol.oculto
          m.renderOrder = 4
          this.volumenes.set(x.unitId, m)
          const e = new THREE.LineSegments(
            new THREE.EdgesGeometry(m.geometry, 30),
            new THREE.LineBasicMaterial({ color: ACENTO, transparent: true, opacity: 0.9, depthTest: false }),
          )
          e.renderOrder = 5
          e.visible = false
          m.add(e)
          this.aristas.set(x.unitId, e)
        }
      } else if (n.startsWith('CTX')) this.entorno.push(o)
      else if (n.startsWith('CALLE') || n.startsWith('ARBOL')) this.calle.push(o)
    }
    // entorno fantasma: volúmenes de cristal esmerilado con la arista dibujada
    for (const o of this.entorno) o.traverse((c) => {
      const m = c as THREE.Mesh
      if (!m.isMesh) return
      if (m.name.startsWith('CTX_edificios')) {
        const mat = new THREE.MeshStandardMaterial({
          color: '#FFFFFF', roughness: 0.9, transparent: true, opacity: FANTASMA.opacidad, depthWrite: false,
        })
        m.material = mat
        m.renderOrder = 2
        this.matsEntorno.push(mat)
        const am = new THREE.LineBasicMaterial({ color: FANTASMA.arista, transparent: true, opacity: FANTASMA.aristaOpacidad, depthWrite: false })
        const e = new THREE.LineSegments(this.contornos(m.geometry), am)
        e.renderOrder = 3
        m.add(e)
        this.aristasEntorno.push(am)
        m.userData.fantasma = true
      }
    })
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || this.esVolumen(m)) return
      const suelo = m.name.startsWith('CTX_calzada') || m.name.startsWith('CTX_aceras')
      m.castShadow = !suelo && !m.userData.fantasma
      m.receiveShadow = true
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const s = mat as THREE.MeshStandardMaterial
        if (PALETA[s.name]) s.color.set(PALETA[s.name])
        if (s.name === 'JJ_vidrio') { s.roughness = 0.08; s.metalness = 0.35; s.envMapIntensity = 1.4 }
      }
    })
    this.aplicar()
  }

  private esVolumen(o: THREE.Object3D) {
    return (o.userData as { capa?: string }).capa === 'volumen'
  }

  /* ── Estado visible ────────────────────────────────────────────────── */

  /** Planta a partir de la cual se levanta el edificio (null = entero). */
  private corte(): number | null {
    if (this.modo !== 'planta' || !this.selId) return null
    return BY_ID[this.selId]?.planta ?? null
  }

  private aplicar() {
    if (!this.root) return
    const c = this.corte()
    // despiece: lo que está por encima de la planta elegida sube en bloque
    const lev = (p: number) => (c != null && p > c ? LEVANTE + (p - c - 1) * SEPARACION : 0)
    for (const n of this.exteriores) n.offT = lev(n.planta)
    for (const n of this.cubiertas) n.offT = lev(n.planta)
    const mano = this.selId ? BY_ID[this.selId]?.mano : null
    // lo que baja vuelve a verse desde arriba; lo que sube se esconde al llegar (bucle)
    for (const n of this.exteriores.concat(this.cubiertas)) if (n.offT === 0) n.obj.visible = true
    // planta abierta: luz de estudio uniforme; las sombras del sol solo metían manchas
    const abierta = c != null
    this.sun.castShadow = !abierta
    this.sun.intensity = abierta ? 1.6 : 3.1
    this.hemi.intensity = abierta ? 1.35 : 0.62
    // solo el interior de la vivienda elegida: la gemela de la misma planta va maciza
    for (const n of this.interiores) n.obj.visible = c != null && n.planta === c && n.mano === mano
    this.veloT = c != null ? 0.35 : 1
    for (const o of this.entorno) o.visible = this.capas.entorno
    for (const o of this.calle) o.visible = this.capas.calle
    this.volumenes.forEach((m, id) => {
      const v = BY_ID[id]
      const encima = c != null && v.planta > c
      m.visible = !encima
      // con la planta abierta, el volumen de la seleccionada no tapa su interior y el de
      // su gemela se pinta macizo, para que su distribución no meta ruido
      const abierta = c != null && id === this.selId
      const gemela = c != null && v.planta === c && v.mano !== mano
      m.castShadow = gemela
      m.receiveShadow = gemela
      m.material = gemela ? this.matVol.macizo : id === this.selId
        ? (abierta ? this.matVol.oculto : this.matVol.sel)
        : id === this.hoverId ? this.matVol.hover
          : this.capas.volumenes ? this.matVol.capa : this.matVol.oculto
      const e = this.aristas.get(id)
      if (e) e.visible = !encima && !abierta && !gemela && (id === this.selId || id === this.hoverId)
    })
    this.renderer.shadowMap.needsUpdate = true
  }

  /* ── API pública ──────────────────────────────────────────────────── */

  setCapa(id: CapaId, v: boolean) { this.capas[id] = v; this.aplicar() }

  setModo(m: ModoId) {
    this.modo = m
    this.aplicar()
    if (this.selId) this.acercar(this.selId)
  }

  setSel(id: string | null) {
    this.selId = id && BY_ID[id] ? id : null
    this.shiftT = this.selId ? this.hueco() : 0
    this.aplicar()
  }

  /**
   * Vuela a una vivienda. Con el edificio entero la mira desde la calle a su
   * altura; con la planta abierta, desde arriba y en diagonal para leer la
   * distribución entera.
   */
  acercar(id: string, dur = 1200) {
    const v: Vivienda | undefined = BY_ID[id]
    if (!v) return
    const sx = v.mano === 'IZ' ? 1 : -1
    const z0 = zPlanta(v.planta), h = alturaPlanta(v.planta)
    const cx = sx * ANCHO_MEDIO / 2
    const ancho = this.camera.aspect < 1 ? 1.5 : 1
    if (this.modo === 'planta') {
      // casi cenital sobre la media planta, con la calle abajo en pantalla. La distancia
      // se calcula para que quepan los 31,8 m de fondo y los 11,6 de ancho con margen
      const tv = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
      const th = tv * this.camera.aspect
      const libre = this.wrap.clientWidth >= 1024 ? 0.62 : 1        // la ficha tapa la derecha
      const d = Math.max((FONDO / 2 + 2.5) / tv, (ANCHO_MEDIO / 2 + 2) / (th * libre)) * 1.04
      const inc = 0.32                                                // inclinación desde la vertical (rad)
      const target = new THREE.Vector3(cx, z0, FONDO * 0.5)
      const pos = new THREE.Vector3(cx, z0 + d * Math.cos(inc), FONDO * 0.5 - d * Math.sin(inc))
      this.volar(pos, target, dur)
    } else {
      // dentro de la calle y en enfilada: de frente se metería en el edificio de enfrente
      const target = new THREE.Vector3(cx, z0 + h / 2, 0.5)
      const pos = new THREE.Vector3(cx + sx * 22 * ancho, Math.max(z0 + h / 2 + 3, 11), -9.5)
      this.volar(pos, target, dur)
    }
  }

  setVista(kind: VistaId, dur = 1100) {
    const v = VISTAS[kind]
    const k = this.camera.aspect < 1 ? 1.45 : 1
    const target = new THREE.Vector3(...v.target)
    const pos = new THREE.Vector3(...v.pos).sub(target).multiplyScalar(k).add(target)
    this.volar(pos, target, dur)
  }

  /** En escritorio la ficha tapa ~428 px a la derecha y el panel izquierdo ~314 px. */
  private hueco(): number {
    return this.wrap.clientWidth >= 1024 ? (428 - 314) / 2 : 0
  }

  private aplicarShift() {
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight
    if (!W || !H) return
    if (Math.abs(this.shift) < 0.5) this.camera.clearViewOffset()
    else this.camera.setViewOffset(W, H, this.shift, 0, W, H)
  }

  private volar(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    if (dur <= 0) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
      return
    }
    this.tween = { p0: this.camera.position.clone(), p1: pos, t0v: this.controls.target.clone(), t1v: target, t0: performance.now(), dur }
  }

  pausar(v: boolean) {
    this.pausada = v
    if (!v) this.last = performance.now()
    if (v && this.labelEl) this.labelEl.style.opacity = '0'
  }

  resize() {
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight
    if (!W || !H) return
    this.camera.aspect = W / H
    this.camera.fov = W / H < 1 ? 48 : 36
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(W, H, false)
    this.composer?.setSize(W, H)
    this.aplicarShift()
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
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
      mats.forEach((x) => x.dispose())
    })
    Object.values(this.matVol).forEach((m) => m.dispose())
    this.composer?.dispose()
    ;(this.scene.background as THREE.Texture | null)?.dispose?.()
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
    const objetivos = Array.from(this.volumenes.values()).filter((m) => m.visible)
    const hits = this.ray.intersectObjects(objetivos, false)
    return hits.length ? ((hits[0].object.userData as { unitId?: string }).unitId ?? null) : null
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
    if (id) this.opts.onPick(id)
  }

  private onLeave = () => {
    this.ptr = null
    if (this.hoverId) { this.hoverId = null; this.opts.onHover(null); this.aplicar() }
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
      if (k >= 1) this.tween = null
    }
    if (Math.abs(this.shiftT - this.shift) > 0.3) {
      this.shift += (this.shiftT - this.shift) * Math.min(1, dt * 5)
      if (Math.abs(this.shiftT - this.shift) <= 0.3) this.shift = this.shiftT
      this.aplicarShift()
    }
    this.controls.update(dt)

    // despiece animado (las sombras se recalculan mientras algo se mueve)
    let mueve = false
    const k = Math.min(1, dt * 3.2)
    for (const n of this.exteriores.concat(this.cubiertas)) {
      if (Math.abs(n.offT - n.off) < 0.01) continue
      n.off += (n.offT - n.off) * k
      if (Math.abs(n.offT - n.off) < 0.01) n.off = n.offT
      n.obj.position.y = n.y0 + n.off
      // sube y se va: a partir de 3/4 del recorrido desaparece
      if (n.offT > 0 && n.off > n.offT * 0.75) n.obj.visible = false
      mueve = true
    }
    if (Math.abs(this.veloT - this.velo) > 0.005) {
      this.velo += (this.veloT - this.velo) * k
      for (const m of this.matsEntorno) m.opacity = FANTASMA.opacidad * this.velo
      for (const m of this.aristasEntorno) m.opacity = FANTASMA.aristaOpacidad * this.velo
      mueve = true
    }
    if (mueve) this.renderer.shadowMap.needsUpdate = true

    if (this.needHover && this.cargado) {
      this.needHover = false
      const id = this.pick()
      this.canvas.style.cursor = id ? 'pointer' : 'grab'
      if (id !== this.hoverId) { this.hoverId = id; this.opts.onHover(id); this.aplicar() }
    }
    if (this.labelEl) {
      const v = this.hoverId ? BY_ID[this.hoverId] : null
      if (v) {
        const sx = v.mano === 'IZ' ? 1 : -1
        this.v3.set(sx * ANCHO_MEDIO / 2, zPlanta(v.planta) + alturaPlanta(v.planta), 0).project(this.camera)
        const r = this.wrap.getBoundingClientRect()
        this.labelEl.style.transform = `translate(${(this.v3.x * 0.5 + 0.5) * r.width}px,${(-this.v3.y * 0.5 + 0.5) * r.height}px)`
        this.labelEl.style.opacity = '1'
      } else {
        this.labelEl.style.opacity = '0'
      }
    }

    if (this.composer) this.composer.render(dt)
    else this.renderer.render(this.scene, this.camera)

    if (this.compassEl && this.frame % 2 === 0) {
      const north = this.controls.target.clone().add(new THREE.Vector3(0, 0, -100)).project(this.camera)
      const center = this.controls.target.clone().project(this.camera)
      const ang = Math.atan2((north.x - center.x) * this.wrap.clientWidth, (north.y - center.y) * this.wrap.clientHeight) * 180 / Math.PI
      this.compassEl.style.transform = `rotate(${ang}deg)`
    }
  }
}


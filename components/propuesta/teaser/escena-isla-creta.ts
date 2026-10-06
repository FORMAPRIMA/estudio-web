// Maqueta 3D del teaser de Isla Creta (formaprima.es/propuesta/<slug>).
//
// Es el visor web08 de ~/Documents/Playground/isla_creta/web_live08/viewer.js
// (agua reflectante, cielo con nubes, bosque con imágenes del atlas) en "modo
// muestra": solo la manzana 1 responde, sin precios, estados, buscador ni capas.
// Los datos de la muestra (lotes.json) solo traen esa manzana: lo que no está
// activado tampoco viaja al navegador.
//
// Recursos en public/propuesta/<slug>/maqueta/, protegidos por el PIN en el
// middleware. El GLB va comprimido con meshopt (13,8 → 2,9 MB).

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/** 'lotes' = de cerca, sobre el lote guía: el encuadre de la demostración. */
export type Vista = 'isla' | 'manzana' | 'club' | 'lotes'

export interface Lote { id: string; label: string; area: number; tipo: string; c: [number, number, number] }

export interface OpcionesEscena {
  contenedor: HTMLElement
  /** Carpeta de los recursos, sin barra final. */
  base: string
  /** Móvil o equipo modesto: menos resolución, reflejos y sombras. */
  ligera: boolean
  onProgreso: (fraccion: number) => void
  onLote: (lote: Lote | null) => void
  /** Se tocó un lote que no está activado en la muestra. */
  onBloqueado: () => void
  onError: (mensaje: string) => void
  /** El visitante ha girado o acercado la maqueta (para la guía). */
  onGiro?: () => void
}

/** Posición en pantalla (px del contenedor) de un lote activo, para pintar sus marcadores. */
export interface PuntoLote { id: string; x: number; y: number; visible: boolean }

export interface EscenaTeaser {
  /** Mueve la cámara a un encuadre (con transición). */
  vista: (v: Vista) => void
  /** true = el visitante puede girar, acercarse y tocar lotes. */
  explorar: (activo: boolean) => void
  /** Se pinta solo mientras se ve: la página la pausa al salir del encuadre. */
  pausar: (pausada: boolean) => void
  deseleccionar: () => void
  /** Selecciona un lote activo desde fuera (un marcador HTML). */
  seleccionarLote: (id: string) => void
  /** Proyección de los lotes activos en este fotograma. */
  puntos: () => PuntoLote[]
  /** El lote que señala la guía: el más céntrico de la manzana activa. */
  loteGuia: string
  /** Lotes activos de la muestra y total de la isla. */
  activos: number
  total: number
  destruir: () => void
}

type Planta = [number, number, number, number, number, number, number, number] // x y z radio alto giro tipo contexto

const ORO = new THREE.Color('#e2b45a')
// Versión de los recursos: subirla al cambiar cualquier archivo de maqueta/
// (el navegador los guarda un día). v2: suelos separados en altura contra el
// z-fighting. v3: las 4 casas tipo instanciadas en los 171 lotes. v4: sin árboles
// dentro de las casas. v5: casas horneadas (textura + oclusión) desde Blender.
const V = 'v=5'

// Superficies del terreno que en el modelo son coplanares (o casi): el entorno
// entero está a la cota 1,55 y la pradera cruza la etapa futura. Sin un orden,
// se pelean por qué se pinta ("z-fighting"). Cuanto más alto el número, más
// arriba se dibuja (polygonOffset).
const CAPAS_SUELO: [string, number][] = [
  ['tierra norte', 0], ['orilla sedimentaria', 0], ['canto de terreno', 0], ['matorral', 0],
  ['ribera natural', 1], ['pradera', 1],
  ['barrio tierra', 2], ['campo', 2], ['etapa futura', 2],
  ['caminos contexto', 3], ['piedra caliza', 3], ['asfalto', 3],
  ['parqueos', 4], ['servicio', 4], ['canchas', 4], ['sendero', 4],
  ['pintura vial', 5], ['bordillo', 5], ['cubresuelos', 5], ['lineas deportivas', 5],
]
// Materiales de las casas tipo ("V2 …", exportados de Blender como color plano).
// En Blender llevan textura procedimental y luz de Cycles; aquí, con el sol y el
// cielo del visor, la piedra clara se quemaba a blanco y el zinc reflejaba el
// cielo. Se ajustan valores y se añade un grano sutil calculado en la GPU (sin
// texturas que descargar): sillar en la piedra, veta en la teca, ruido en el follaje.
type Grano = 'piedra' | 'madera' | 'hoja' | null
const NOISE_GLSL = `varying vec3 vIcPos;
float icH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float icN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(icH(i),icH(i+vec3(1,0,0)),f.x),mix(icH(i+vec3(0,1,0)),icH(i+vec3(1,1,0)),f.x),f.y),mix(mix(icH(i+vec3(0,0,1)),icH(i+vec3(1,0,1)),f.x),mix(icH(i+vec3(0,1,1)),icH(i+vec3(1,1,1)),f.x),f.y),f.z);}`
function afinarMaterialCasa(mat: THREE.MeshStandardMaterial) {
  const n = mat.name
  let grano: Grano = null
  // Colores fijados a ojo contra el render de referencia (V2_fachada.png), ya con
  // la luz del visor: la exportación en lineal salía casi blanca aquí.
  // Casas horneadas en Blender (textura procedimental × oclusión en una imagen):
  // solo hay que dejarlas mates para que el cielo no las lave.
  if (n.startsWith('Horneado')) { mat.roughness = 0.86; mat.metalness = 0; mat.envMapIntensity = 0.32; return }
  if (/Vidrio/.test(n)) { mat.color.set('#1b302d'); mat.metalness = 0.1; mat.roughness = 0.06; mat.envMapIntensity = 1.6 }
  else if (/agua/i.test(n)) { mat.color.set('#2f6f6a'); mat.roughness = 0.05; mat.envMapIntensity = 1.3 }
  else if (/zinc/i.test(n)) { mat.color.set('#7f817c'); mat.metalness = 0.1; mat.roughness = 0.6; mat.envMapIntensity = 0.4 }
  else if (/apomazada|Mortero/.test(n)) { mat.color.set(/Mortero/.test(n) ? '#aaa293' : '#a59d8c'); mat.roughness = 0.88; mat.envMapIntensity = 0.35; grano = 'piedra' }
  else if (/Caliza|Sillar/.test(n)) { mat.color.set('#a99a80').offsetHSL(0, 0, (Number(n.slice(-1)) || 0) * 0.012); mat.roughness = 0.9; mat.envMapIntensity = 0.35; grano = 'piedra' }
  else if (/Teca/.test(n)) { mat.color.set(/clara/.test(n) ? '#8c5a32' : '#6e4223'); mat.roughness = 0.68; mat.envMapIntensity = 0.4; grano = 'madera' }
  else if (/Follaje/.test(n)) { mat.roughness = 0.92; mat.envMapIntensity = 0.3; grano = 'hoja' }
  else { mat.envMapIntensity = 0.5 }
  if (!grano) return
  const g = grano
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vIcPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 icp=vec4(transformed,1.0);
#ifdef USE_INSTANCING
icp=instanceMatrix*icp;
#endif
vIcPos=(modelMatrix*icp).xyz;`)
    const mezcla = g === 'piedra'
      ? 'float k=icN(vIcPos*vec3(1.4,3.4,1.4))*.7+icN(vIcPos*9.0)*.3;diffuseColor.rgb*=.86+.24*k;'
      : g === 'madera'
        ? 'float k=icN(vIcPos*vec3(.9,11.0,.9))*.75+icN(vIcPos*vec3(3.0,40.0,3.0))*.25;diffuseColor.rgb*=.78+.36*k;'
        : 'float k=icN(vIcPos*2.2);diffuseColor.rgb*=.72+.5*k;'
    sh.fragmentShader = NOISE_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + mezcla)
  }
  mat.customProgramCacheKey = () => 'IC-casa-' + g
  mat.needsUpdate = true
}

function capaDe(o: THREE.Object3D): number | null {
  const cat = o.userData.category ?? o.parent?.userData.category
  if (cat !== 'site' && cat !== 'context') return null
  // GLTFLoader cambia los espacios del nombre por guiones bajos.
  const nombre = (o.name || o.parent?.name || '').replace(/_/g, ' ')
  for (const [k, n] of CAPAS_SUELO) if (nombre.includes(k)) return n
  return null
}
const CLUB = new THREE.Vector3(71, 5, 161)

export async function crearEscena(o: OpcionesEscena): Promise<EscenaTeaser> {
  const { contenedor, base, ligera } = o
  const perfil = ligera ? { dpr: 1, reflejo: 12, sombra: 1024, agua: 256 } : { dpr: 1.5, reflejo: 5, sombra: 2048, agua: 512 }
  const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // ── Render, cielo y luz (como web08) ──────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: !ligera, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, perfil.dpr))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.setAttribute('aria-label', 'Maqueta 3D de Isla Creta')
  contenedor.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#b6b9ae')
  const camera = new THREE.PerspectiveCamera(42, 1, 2, 14000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.09
  controls.minDistance = 55
  controls.maxDistance = 2600
  controls.maxPolarAngle = Math.PI * 0.43
  controls.minPolarAngle = 0.12
  controls.screenSpacePanning = false
  controls.enabled = false

  scene.add(new THREE.HemisphereLight('#e4edf1', '#797357', 1.1))
  const sun = new THREE.DirectionalLight('#fff0d8', 2.1)
  sun.position.set(-360, 670, 350)
  sun.castShadow = true
  sun.shadow.mapSize.set(perfil.sombra, perfil.sombra)
  Object.assign(sun.shadow.camera, { left: -850, right: 850, top: 700, bottom: -700, near: 50, far: 1900 })
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 0.2
  scene.add(sun, sun.target)

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
  // Capa de nubes procedural: el río refleja un cielo reconocible.
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('void main() {', `float icHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float icNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(icHash(i),icHash(i+vec3(1,0,0)),f.x),mix(icHash(i+vec3(0,1,0)),icHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(icHash(i+vec3(0,0,1)),icHash(i+vec3(1,0,1)),f.x),mix(icHash(i+vec3(0,1,1)),icHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float icCloud(vec3 p){float n=0.0,a=.55;for(int i=0;i<5;i++){n+=icNoise(p)*a;p=p*2.03+vec3(2.1,5.4,3.7);a*=.5;}return n;}
void main() {`)
    .replace('gl_FragColor = vec4( retColor, 1.0 );', `float cloud=icCloud(direction*4.8+vec3(1.4,2.8,4.3));float coverage=smoothstep(.46,.66,cloud)*smoothstep(.05,.26,direction.y);retColor=mix(retColor,vec3(1.6,1.58,1.49),coverage*.9);gl_FragColor=vec4(retColor,1.0);`)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  envScene.add(sky.clone())
  const envRT = pmrem.fromScene(envScene, 0.015, 1, 12000)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.65
  pmrem.dispose()

  // Normales de ondas generadas aquí: sin textura descargada.
  const N = 256, normalBytes = new Uint8Array(N * N * 4)
  let seed = 79571
  const rnd = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296 }
  const grids = [8, 16, 32, 64].map((size) => ({ size, values: Float32Array.from({ length: size * size }, rnd) }))
  const noise2 = (x: number, y: number, g: { size: number; values: Float32Array }) => {
    const xx = (((x % N) + N) % N) / N * g.size, yy = (((y % N) + N) % N) / N * g.size, ix = Math.floor(xx), iy = Math.floor(yy)
    let u = xx - ix, v = yy - iy
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v)
    const at = (a: number, b: number) => g.values[(b % g.size) * g.size + (a % g.size)]
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u), THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u), v)
  }
  const height = (x: number, y: number) => grids.reduce((a, g, i) => a + noise2(x, y, g) * [0.5, 0.27, 0.14, 0.07][i], 0)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (height(x + 1, y) - height(x - 1, y)) * 2, dy = (height(x, y + 1) - height(x, y - 1)) * 2
    const v = new THREE.Vector3(-dx, -dy, 1).normalize(), i = (y * N + x) * 4
    normalBytes[i] = (v.x * 0.5 + 0.5) * 255; normalBytes[i + 1] = (v.y * 0.5 + 0.5) * 255; normalBytes[i + 2] = (v.z * 0.5 + 0.5) * 255; normalBytes[i + 3] = 255
  }
  const normals = new THREE.DataTexture(normalBytes, N, N, THREE.RGBAFormat)
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  normals.minFilter = THREE.LinearMipmapLinearFilter
  normals.magFilter = THREE.LinearFilter
  normals.generateMipmaps = true
  normals.needsUpdate = true

  const water = new Water(new THREE.PlaneGeometry(12500, 12500), {
    textureWidth: perfil.agua, textureHeight: perfil.agua, waterNormals: normals, sunDirection,
    sunColor: 0xffeed3, waterColor: 0x52635c, distortionScale: 1.9, alpha: 1,
  })
  water.rotation.x = -Math.PI / 2
  water.position.y = -1.12
  scene.add(water)
  let frame = 0, reflejoSucio = true
  const reflect = water.onBeforeRender
  water.onBeforeRender = function (this: Water, ...args: Parameters<typeof reflect>) {
    if ((reflejoSucio && frame % perfil.reflejo === 0) || frame % 60 === 0) { reflect.apply(this, args); reflejoSucio = false }
  }
  controls.addEventListener('change', () => { reflejoSucio = true })
  controls.addEventListener('start', () => o.onGiro?.())

  // ── Estado ────────────────────────────────────────────────────────────────
  const parcelas = new Map<string, THREE.Mesh>()
  const colorBase = new Map<string, THREE.Color>()
  const activos = new Map<string, Lote>()
  const volumenes = new Map<string, { polygon: [number, number][]; bottomZ: number; topZ: number }>()
  const foliage = new THREE.Group(), contacto = new THREE.Group(), seleccionVol = new THREE.Group(), activosVol = new THREE.Group()
  scene.add(foliage, contacto, seleccionVol, activosVol)
  activosVol.visible = false
  let root: THREE.Object3D | null = null
  let seleccion: string | null = null
  let explorando = false, pausada = false, destruida = false, vistaActual: Vista = 'isla'
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2()

  // Ámbito de la casa club: un anillo en el suelo, sin volumen: se señala, no se diseña.
  const anillo = new THREE.Group()
  // Por encima de todo (sin prueba de profundidad): los árboles no lo tapan.
  const aro = new THREE.Mesh(new THREE.RingGeometry(70, 74, 128), new THREE.MeshBasicMaterial({ color: ORO, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide }))
  const disco = new THREE.Mesh(new THREE.CircleGeometry(70, 128), new THREE.MeshBasicMaterial({ color: ORO, transparent: true, opacity: 0.1, depthWrite: false, depthTest: false, side: THREE.DoubleSide }))
  for (const m of [aro, disco]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 10; anillo.add(m) }
  anillo.position.set(CLUB.x, 4, CLUB.z)
  anillo.visible = false
  scene.add(anillo)

  // ── Encuadres ─────────────────────────────────────────────────────────────
  // La manzana activa se encuadra con su caja real (se calcula al cargar los lotes).
  const guia = new THREE.Vector3(356, 2, 227)
  let loteGuia = 'MZ1-1'
  const manzana = { centro: new THREE.Vector3(197, 6, 94), min: [-10, 0, -50] as [number, number, number], max: [400, 40, 240] as [number, number, number] }
  function encuadre(v: Vista): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const target = v === 'club' ? CLUB.clone() : v === 'manzana' ? manzana.centro.clone() : v === 'lotes' ? guia.clone() : new THREE.Vector3(35, 5, 0)
    const dir = new THREE.Vector3(...(v === 'isla' ? [0.25, 0.8, 1] : v === 'manzana' ? [0.78, 0.9, 1] : v === 'lotes' ? [0.7, 1.25, 0.9] : [0.9, 0.95, 0.7])).normalize()
    const vertical = camera.aspect < 0.9 // móvil en vertical: más lejos para que quepa a lo ancho
    const ext: [number, number, number][] = v === 'isla' ? [[-800, 0, -650], [950, 62, 530]] : v === 'manzana' ? [manzana.min, manzana.max] : v === 'lotes' ? [[guia.x - 85, 0, guia.z - 85], [guia.x + 85, 20, guia.z + 85]] : [[-20, 0, 80], [160, 30, 240]]
    const pos = target.clone().addScaledVector(dir, 1500)
    const cam = camera.clone()
    cam.position.copy(pos); cam.lookAt(target); cam.updateMatrixWorld()
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    let d = 150
    for (const x of [ext[0][0], ext[1][0]]) for (const y of [ext[0][1], ext[1][1]]) for (const z of [ext[0][2], ext[1][2]]) {
      const q = new THREE.Vector3(x, y, z).sub(target)
      d = Math.max(d, Math.abs(q.dot(up)) / tan + q.dot(dir), Math.abs(q.dot(right)) / (tan * camera.aspect) + q.dot(dir))
    }
    const factor = v === 'isla' ? (vertical ? 0.62 : 0.86) : v === 'manzana' ? (vertical ? 1.12 : 1.15) : v === 'lotes' ? (vertical ? 0.95 : 1) : (vertical ? 1.2 : 1.5)
    const dist = d * factor
    // El texto ocupa la izquierda (escritorio) o la parte de arriba (móvil):
    // se mira a un punto desplazado para que el sujeto quede en la zona libre.
    const desvio = new THREE.Vector3()
    if (v === 'lotes') {
      // Explorando, la guía ocupa la parte de abajo: el lote, en la de arriba.
      desvio.addScaledVector(up, -dist * tan * (vertical ? 0.28 : 0.12))
    } else if (vertical) {
      desvio.addScaledVector(up, dist * tan * (v === 'isla' ? 0.42 : 0.3))
    } else if (v !== 'isla' && camera.aspect > 1.2) {
      desvio.addScaledVector(right, -dist * tan * camera.aspect * 0.32)
    }
    target.add(desvio)
    return { pos: target.clone().addScaledVector(dir, dist), target }
  }

  let viaje: { desde: THREE.Vector3; hasta: THREE.Vector3; tDesde: THREE.Vector3; tHasta: THREE.Vector3; t0: number; dur: number } | null = null
  function irA(v: Vista, instantaneo = false) {
    vistaActual = v
    const e = encuadre(v)
    anillo.visible = v === 'club'
    activosVol.visible = v === 'manzana' || v === 'lotes' || explorando
    if (instantaneo || quieto) {
      camera.position.copy(e.pos); controls.target.copy(e.target); controls.update(); viaje = null; reflejoSucio = true; return
    }
    viaje = { desde: camera.position.clone(), hasta: e.pos, tDesde: controls.target.clone(), tHasta: e.target, t0: performance.now(), dur: 2200 }
  }

  // ── Vegetación (atlas de 24 vistas por tipo, como web08) ──────────────────
  function plantas(items: Planta[], textura: THREE.Texture, esContexto: boolean, esArbusto: boolean) {
    if (!items.length) return
    const geometry = new THREE.PlaneGeometry(1, 1)
    const a = new Float32Array(items.length * 4)
    items.forEach((p, i) => a.set([p[3], p[4], p[6], p[5]], i * 4))
    geometry.setAttribute('plant', new THREE.InstancedBufferAttribute(a, 4))
    const mat = new THREE.MeshBasicMaterial({ map: textura, alphaTest: 0.27, side: THREE.DoubleSide, toneMapped: false, depthWrite: true })
    mat.onBeforeCompile = (s) => {
      s.vertexShader = 'attribute vec4 plant;\n' + s.vertexShader
      s.vertexShader = s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
vec3 pc=instanceMatrix[3].xyz;vec3 delta=cameraPosition-pc;
float az=atan(delta.x,delta.z);float yy=mod(floor((plant.w-az)/6.2831853*8.0+.5)+80.0,8.0);
float elev=degrees(atan(max(delta.y,0.0),length(delta.xz)));
float pp=elev<32.5?0.0:(elev<60.0?1.0:2.0);
float row=plant.z*3.0+pp;vMapUv=(vec2(yy,11.0-row)+vec2(.004)+uv*.992)/vec2(8.0,12.0);`)
      s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `vec2 dimensions=plant.z>2.5?vec2(18.0/7.0*plant.x,18.0/7.0*plant.y):vec2(18.0/5.0*plant.x,18.0/12.0*plant.y);
vec4 mvPosition=viewMatrix*vec4(instanceMatrix[3].xyz,1.0);mvPosition.xy+=position.xy*dimensions;gl_Position=projectionMatrix*mvPosition;`)
    }
    mat.customProgramCacheKey = () => 'IC08-atlas-v1'
    const mesh = new THREE.InstancedMesh(geometry, mat, items.length), m = new THREE.Matrix4()
    items.forEach((p, i) => { m.makeTranslation(p[0], p[1] + p[4] * 0.5, p[2]); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.userData = { context: esContexto, shrub: esArbusto }
    foliage.add(mesh)
  }

  function sombras(items: Planta[]) {
    const S = 64, bytes = new Uint8Array(S * S * 4)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot((x + 0.5 - S / 2) / (S / 2), (y + 0.5 - S / 2) / (S / 2)), i = (y * S + x) * 4
      bytes[i + 3] = Math.max(0, 1 - d) ** 1.5 * 72
    }
    const tex = new THREE.DataTexture(bytes, S, S)
    tex.needsUpdate = true
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    const geom = new THREE.PlaneGeometry(1, 1)
    geom.rotateX(-Math.PI / 2)
    const mesh = new THREE.InstancedMesh(geom, mat, items.length), m = new THREE.Matrix4(), q = new THREE.Quaternion()
    items.forEach((p, i) => { m.compose(new THREE.Vector3(p[0] + 0.5, Math.max(2.03, p[1] + 0.02), p[2]), q, new THREE.Vector3(p[3] * 2.1, 1, p[3] * 2.1)); mesh.setMatrixAt(i, m) })
    mesh.frustumCulled = false
    contacto.add(mesh)
  }

  function volumen(p: { polygon: [number, number][]; bottomZ: number; topZ: number }, suave = false) {
    const pos: number[] = [], edges: number[] = [], pts = p.polygon, b = p.bottomZ, t = suave ? p.bottomZ + 9 : p.topZ
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length]
      pos.push(a[0], b, -a[1], c[0], b, -c[1], c[0], t, -c[1], a[0], b, -a[1], c[0], t, -c[1], a[0], t, -a[1])
      edges.push(a[0], t, -a[1], c[0], t, -c[1], a[0], b, -a[1], a[0], t, -a[1])
    }
    for (const tri of THREE.ShapeUtils.triangulateShape(pts.map((a) => new THREE.Vector2(a[0], -a[1])), [])) for (const i of tri) pos.push(pts[i][0], t, -pts[i][1])
    const g = new THREE.Group()
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3))
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: '#f2cc7c', transparent: true, opacity: suave ? 0.22 : 0.16, depthWrite: false, side: THREE.DoubleSide }))
    mesh.renderOrder = 4
    const lines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: '#f8db90', transparent: true, opacity: suave ? 0.75 : 0.92, depthWrite: false }))
    lines.renderOrder = 5
    g.add(mesh, lines)
    return g
  }

  function vaciar(g: THREE.Group) {
    for (const c of [...g.children]) {
      c.traverse((n) => { const x = n as THREE.Mesh; x.geometry?.dispose(); (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m?.dispose()) })
      g.remove(c)
    }
  }

  // Colores: manzana 1 cálida (invita a tocar), resto apagado (aún no activado).
  const gris = new THREE.Color('#8f948a')
  function pintar(t = 0) {
    const pulso = vistaActual !== 'club' ? 0.62 + 0.18 * Math.sin(t / 420) : 0.35
    parcelas.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial
      const base = colorBase.get(id)!
      if (id === seleccion) mat.color.copy(ORO)
      else if (activos.has(id)) mat.color.copy(base).lerp(ORO, pulso)
      else mat.color.copy(base).lerp(gris, 0.55)
    })
  }

  function seleccionar(id: string | null) {
    seleccion = id
    vaciar(seleccionVol)
    const v = id ? volumenes.get(id) : undefined
    if (v) seleccionVol.add(volumen(v))
    o.onLote(id ? activos.get(id) ?? null : null)
    reflejoSucio = true
  }

  // ── Interacción (solo explorando) ────────────────────────────────────────
  const el = renderer.domElement
  function golpe(e: PointerEvent) {
    const r = el.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(pointer, camera)
    return ray.intersectObjects(Array.from(parcelas.values()), false)[0]
  }
  let abajo: [number, number] | null = null, ultimoHover = 0
  const onDown = (e: PointerEvent) => { abajo = [e.clientX, e.clientY] }
  const onUp = (e: PointerEvent) => {
    if (explorando && abajo && Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) < 6) {
      const h = golpe(e)
      const id = h?.object.userData.unitId as string | undefined
      if (id && activos.has(id)) seleccionar(id)
      else if (id) o.onBloqueado()
    }
    abajo = null
  }
  const onMove = (e: PointerEvent) => {
    if (!explorando || abajo || e.pointerType !== 'mouse' || performance.now() - ultimoHover < 70) return
    ultimoHover = performance.now()
    const id = golpe(e)?.object.userData.unitId as string | undefined
    el.style.cursor = id ? (activos.has(id) ? 'pointer' : 'not-allowed') : 'grab'
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove)
  const onLost = (e: Event) => { e.preventDefault(); o.onError('El navegador ha pausado el 3D para ahorrar memoria.') }
  el.addEventListener('webglcontextlost', onLost)

  function resize() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    reflejoSucio = true
  }
  const ro = new ResizeObserver(() => { resize(); if (!explorando && !viaje) irA(vistaActual, true) })
  ro.observe(contenedor)
  resize()
  irA('isla', true)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const prog = { glb: 0, resto: 0 }
  const avisar = () => o.onProgreso(Math.min(1, prog.glb * 0.75 + prog.resto * 0.25))
  const json = async <T>(f: string): Promise<T> => {
    const r = await fetch(`${base}/${f}?${V}`, { credentials: 'same-origin' })
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'La sesión ha caducado. Vuelva a abrir el enlace.' : `No se pudo cargar ${f}`)
    return r.json() as Promise<T>
  }
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  let pendientes = 4
  const hecho = <T>(p: Promise<T>) => p.then((v) => { pendientes--; prog.resto = (4 - pendientes) / 4; avisar(); return v })

  let total = 173
  try {
    const [lotes, vols, veg, atlas, gltf] = await Promise.all([
      hecho(json<{ activos: Lote[]; total: number }>('lotes.json')),
      hecho(json<{ parcelId: string; polygon: [number, number][]; bottomZ: number; topZ: number }[]>('volumes.json')),
      hecho(json<{ trees: Planta[]; shrubs: Planta[] }>('vegetation.json')),
      hecho(new THREE.TextureLoader().loadAsync(`${base}/trees-atlas.webp?${V}`)),
      loader.loadAsync(`${base}/site.glb?${V}`, (e) => { if (e.total) { prog.glb = e.loaded / e.total; avisar() } }),
    ])
    if (destruida) { gltf.scene.traverse((n) => { const x = n as THREE.Mesh; x.geometry?.dispose() }); atlas.dispose(); throw new Error('cancelada') }
    lotes.activos.forEach((l) => activos.set(l.id, l))
    vols.forEach((v) => { volumenes.set(v.parcelId, v); activosVol.add(volumen(v, true)) })
    if (lotes.activos.length) {
      const xs = lotes.activos.map((l) => l.c[0]), zs = lotes.activos.map((l) => l.c[2])
      manzana.min = [Math.min(...xs) - 25, 0, Math.min(...zs) - 25]
      manzana.max = [Math.max(...xs) + 25, 30, Math.max(...zs) + 25]
      manzana.centro.set((manzana.min[0] + manzana.max[0]) / 2, 6, (manzana.min[2] + manzana.max[2]) / 2)
      // Lote guía: el que tiene más vecinos activos cerca (la zona más "llena").
      let mejor = lotes.activos[0], n = -1
      for (const l of lotes.activos) {
        const k = lotes.activos.filter((o) => Math.hypot(o.c[0] - l.c[0], o.c[2] - l.c[2]) < 90).length
        if (k > n) { n = k; mejor = l }
      }
      loteGuia = mejor.id
      guia.set(mejor.c[0], 2, mejor.c[2])
    }
    atlas.colorSpace = THREE.SRGBColorSpace
    atlas.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4)
    for (const ctx of [0, 1]) {
      plantas(veg.trees.filter((p) => p[7] === ctx), atlas, !!ctx, false)
      if (!ligera) plantas(veg.shrubs.filter((p) => p[7] === ctx), atlas, !!ctx, true)
    }
    sombras(veg.trees.filter((p) => !p[7]))
    root = gltf.scene
    scene.add(root)
    const casasAfinadas = new Set<THREE.Material>()
    root.traverse((n) => {
      const m = n as THREE.Mesh
      if (!m.isMesh) return
      m.receiveShadow = true
      m.castShadow = m.userData.category === 'architecture' || m.parent?.userData.category === 'architecture'
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if ((mat.name.startsWith('V2 ') || mat.name.startsWith('Horneado')) && !casasAfinadas.has(mat)) { casasAfinadas.add(mat); afinarMaterialCasa(mat as THREE.MeshStandardMaterial) }
      }
      const capa = capaDe(m)
      // Las capas de arriba se adelantan un poco (offset negativo); las de abajo
      // no se tocan: empujarlas hacia atrás las mandaba detrás del río.
      if (capa) {
        const mat = (m.material as THREE.Material).clone()
        mat.polygonOffset = true
        mat.polygonOffsetFactor = -capa * 0.5
        mat.polygonOffsetUnits = -capa * 2
        m.material = mat
      }
      if (m.userData.unitId) {
        m.material = (m.material as THREE.Material).clone()
        parcelas.set(m.userData.unitId, m)
        colorBase.set(m.userData.unitId, (m.material as THREE.MeshStandardMaterial).color.clone())
      }
    })
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    pintar()
    prog.glb = 1; prog.resto = 1; avisar()
    total = lotes.total
  } catch (e) {
    if ((e as Error).message !== 'cancelada') o.onError((e as Error).message || 'No se ha podido cargar la maqueta.')
    throw e
  }

  // ── Bucle: 30 fps en reposo, 60 al moverse; parado fuera de pantalla ────
  let raf = 0, ultimo = performance.now(), ultimoDibujo = 0, ultimaInteraccion = 0, oculta = document.hidden
  controls.addEventListener('change', () => { ultimaInteraccion = performance.now() })
  const onVis = () => { oculta = document.hidden; ultimo = performance.now() }
  document.addEventListener('visibilitychange', onVis)
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

  function loop(now: number) {
    raf = requestAnimationFrame(loop)
    if (oculta || pausada) return
    const moviendo = !!viaje || now - ultimaInteraccion < 200
    const fps = ligera ? 30 : moviendo ? 60 : 30
    if (ultimoDibujo && now - ultimoDibujo < 1000 / fps - 1.3) return
    const dt = Math.min((now - ultimo) / 1000, 0.1)
    ultimo = now
    ultimoDibujo = now
    if (viaje) {
      const k = Math.min(1, (now - viaje.t0) / viaje.dur), e = ease(k)
      camera.position.lerpVectors(viaje.desde, viaje.hasta, e)
      controls.target.lerpVectors(viaje.tDesde, viaje.tHasta, e)
      camera.lookAt(controls.target)
      reflejoSucio = true
      if (k >= 1) { viaje = null; controls.update() }
    } else if (!explorando && !quieto) {
      // Deriva lenta alrededor del encuadre: la maqueta respira mientras se lee.
      const off = camera.position.clone().sub(controls.target)
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.018)
      camera.position.copy(controls.target).add(off)
      camera.lookAt(controls.target)
      reflejoSucio = true
    } else controls.update()
    frame++
    water.material.uniforms.time.value += dt * 0.26
    if (anillo.visible) (aro.material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.3 * Math.sin(now / 380)
    pintar(now)
    // Plano cercano según la distancia: con 2 m fijos y la cámara a 1,5 km, el
    // búfer de profundidad no distingue superficies separadas unos centímetros.
    const cerca = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.04, 1, 40)
    if (Math.abs(cerca - camera.near) / camera.near > 0.05) { camera.near = cerca; camera.updateProjectionMatrix() }
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)

  return {
    activos: activos.size,
    total,
    vista: (v) => irA(v),
    explorar: (activo) => {
      explorando = activo
      activosVol.visible = activo || vistaActual === 'manzana'
      controls.enabled = activo
      viaje = null
      el.style.cursor = activo ? 'grab' : ''
      el.style.touchAction = activo ? 'none' : 'pan-y'
      if (!activo) { seleccionar(null); irA(vistaActual) }
      else irA('lotes')
    },
    pausar: (p) => { pausada = p; ultimo = performance.now() },
    deseleccionar: () => seleccionar(null),
    seleccionarLote: (id) => { if (activos.has(id)) seleccionar(id) },
    loteGuia,
    puntos: () => {
      const w = contenedor.clientWidth, h = contenedor.clientHeight, v = new THREE.Vector3(), out: PuntoLote[] = []
      activos.forEach((l) => {
        v.set(l.c[0], 3, l.c[2]).project(camera)
        out.push({ id: l.id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 })
      })
      return out
    },
    destruir: () => {
      destruida = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('webglcontextlost', onLost)
      controls.dispose()
      const texturas = new Set<THREE.Texture>()
      scene.traverse((n) => {
        const m = n as THREE.Mesh
        m.geometry?.dispose()
        for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) texturas.add(v)
          mat.dispose()
        }
      })
      texturas.forEach((t) => t.dispose())
      normals.dispose()
      envRT.dispose()
      water.material.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      el.remove()
    },
  }
}

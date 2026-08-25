/**
 * FP Visual Lab — escena 3D del Parque Comercial La Dehesa.
 *
 * Explanada, aparcamiento con coches, volúmenes comerciales por módulo,
 * marquesinas, plaza ajardinada y contexto de polígono. Mismo contrato que
 * `escena-valdeserra.ts`: clase imperativa a la que la UI le habla.
 *
 * Frente al artefacto original: coches y arbolado en `InstancedMesh`, malla y
 * shadow map reducidos en móvil, FOV abierto en vertical y `pausar()` cuando la
 * consola tapa el visor.
 */

import * as THREE from 'three'
import {
  type Local, type ModoId,
  ESTADOS, RUBROS, MODULOS, hash,
} from '@/lib/visual-lab/dehesa'

export interface POV { az: number; pol: number; rad: number; tx: number; ty: number; tz: number }

export const POV_FIRMA: POV = { az: 0.72, pol: 1.26, rad: 300, tx: 4, ty: 16, tz: 0 }
export const POV_DERIVA: POV = { az: 0.83, pol: 1.22, rad: 282, tx: 4, ty: 16, tz: 0 }

const POV_MODO: Partial<Record<ModoId, Partial<POV>>> = {
  conjunto: { az: 0.72, pol: 0.62, rad: 540, tx: -14, ty: 4, tz: 10 },
  flujo: { az: 0.5, pol: 0.26, rad: 500, tx: -14, ty: 2, tz: 6 },
  mix: { az: 0.9, pol: 0.92, rad: 430, tx: -14, ty: 8, tz: 4 },
}

interface Vis {
  fillM: THREE.MeshStandardMaterial
  edgeM: THREE.LineBasicMaterial
  bodyM: THREE.MeshStandardMaterial
  parM: THREE.MeshStandardMaterial
  bodyBase: THREE.Color
  parBase: THREE.Color
  modoColor: THREE.Color
  oFill: number
  oEdge: number
  oEm: number
  oTint: number
}

export interface EscenaOpts {
  canvas: HTMLCanvasElement
  wrap: HTMLElement
  labelEl: HTMLElement | null
  units: Local[]
  onHover: (id: string | null) => void
  onPick: (id: string | null) => void
}

interface Arbol { x: number; z: number; s: number }
interface Coche { x: number; z: number; rot: number; mat: number }

export class Escena {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private sun: THREE.DirectionalLight
  private wrap: HTMLElement
  private canvas: HTMLCanvasElement
  private labelEl: HTMLElement | null
  private units: Local[]
  private byId: Record<string, Local> = {}
  private vis: Record<string, Vis> = {}
  private onHover: (id: string | null) => void
  private onPick: (id: string | null) => void

  private unitMeshes: THREE.Mesh[] = []
  private arboles: Arbol[] = []
  private coches: Coche[] = []
  /** Nº de plazas dibujadas: se cuenta al construir, no se escribe a mano */
  plazas = 0

  private cam: POV = { ...POV_FIRMA }
  private camT: POV = { ...POV_FIRMA }
  private tween: { from: POV; to: POV; t0: number; dur: number } | null = null
  private rafId = 0
  private ro: ResizeObserver | null = null
  private pointers = new Map<number, { x: number; y: number }>()
  private pinch: number | null = null
  private drag: { x: number; y: number; moved: number; t: number } | null = null
  private ptr: { x: number; y: number } | null = null
  private needHover = false
  private ndc = new THREE.Vector2()
  private ray = new THREE.Raycaster()
  private v3 = new THREE.Vector3()
  private movil: boolean
  private geoCache: Record<string, THREE.ExtrudeGeometry> = {}

  private modo: ModoId = 'disponibilidad'
  private sol = 790
  private selId: string | null = null
  private hoverId: string | null = null
  private filtro: (u: Local) => boolean = () => true
  private pausada = false
  private muerta = false

  constructor(opts: EscenaOpts) {
    this.wrap = opts.wrap
    this.canvas = opts.canvas
    this.labelEl = opts.labelEl
    this.units = opts.units
    this.onHover = opts.onHover
    this.onPick = opts.onPick
    this.units.forEach((u) => { this.byId[u.id] = u })

    const W = this.wrap.clientWidth || 1200
    const H = this.wrap.clientHeight || 700
    this.movil = W < 700

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xF2F2F0, 520, 1600)
    const camera = new THREE.PerspectiveCamera(W / H < 1 ? 48 : 34, W / H, 0.5, 3000)
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.movil, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 1.75))
    renderer.setSize(W, H, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xDEDED8, 0.74))
    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.0)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.movil ? 1024 : 2048, this.movil ? 1024 : 2048)
    const sc = sun.shadow.camera
    sc.left = -290; sc.right = 290; sc.top = 290; sc.bottom = -290; sc.near = 1; sc.far = 1200
    sun.shadow.bias = -0.0008
    scene.add(sun)
    this.sun = sun
    const fill = new THREE.DirectionalLight(0xCACACA, 0.26)
    fill.position.set(-120, 70, 100)
    scene.add(fill)

    this.construir()

    this.canvas.style.cursor = 'grab'
    this.canvas.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.wrap)

    this.applyModo('disponibilidad')
    this.raf()
  }

  /* ── Construcción ─────────────────────────────────────────────────── */

  private M(c: number, r = 0.88, m = 0) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m })
  }

  private box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, sh = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    if (sh) { m.castShadow = true; m.receiveShadow = true }
    return m
  }

  private puntos(w: number, d: number, r: number, seg: number) {
    const pts: THREE.Vector2[] = []
    const x = Math.max(0.01, w / 2 - r), z = Math.max(0.01, d / 2 - r)
    ;([[x, z, 0], [-x, z, Math.PI / 2], [-x, -z, Math.PI], [x, -z, -Math.PI / 2]] as const).forEach((c) => {
      for (let i = 0; i <= seg; i++) {
        const a = c[2] + (i / seg) * Math.PI / 2
        pts.push(new THREE.Vector2(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r))
      }
    })
    return pts
  }

  /** Placa de esquinas redondeadas, cacheada por dimensiones. */
  private placa(w: number, d: number, r: number, h: number, mat: THREE.Material, y: number, cx: number, cz: number, sh = true) {
    const key = 'p' + [w, d, r, h].map((v) => v.toFixed(2)).join('_')
    if (!this.geoCache[key]) {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(this.puntos(w, d, r, 4)), { depth: h, bevelEnabled: false, curveSegments: 4 })
      g.rotateX(-Math.PI / 2); g.translate(0, h, 0)
      this.geoCache[key] = g
    }
    const m = new THREE.Mesh(this.geoCache[key], mat)
    m.position.set(cx, y, cz)
    if (sh) { m.castShadow = true; m.receiveShadow = true } else m.receiveShadow = true
    return m
  }

  private construir() {
    const S = this.scene
    const matGnd = this.M(0xEFEFEC, 1), matAsf = this.M(0x9E9E9A, 0.95), matPav = this.M(0xE4E2DC, 0.95),
      matPav2 = this.M(0xD8D6CF, 0.95), matLinea = this.M(0xF2F2F0, 0.9), matSlab = this.M(0xB8B8B2, 0.9),
      matPar = this.M(0xA6A6A0, 0.9), matVeg = this.M(0x6E7A68, 0.95), matTronco = this.M(0x8C8176, 0.9),
      matCesped = this.M(0xBFC6B6, 0.98), matMarq = this.M(0xCECEC8, 0.85),
      matHVAC = this.M(0x8E8E88, 0.6, 0.2), matTotem = this.M(0x3A3A36, 0.7)
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x9CA6AA, roughness: 0.24, metalness: 0.34, transparent: true, opacity: 0.6 })

    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(1900, 1900), matGnd)
    gnd.rotation.x = -Math.PI / 2
    gnd.receiveShadow = true
    S.add(gnd)

    // ── explanada y pavimentos
    S.add(this.placa(300, 230, 16, 0.16, matAsf, 0, -20, 26, false))
    S.add(this.placa(262, 152, 12, 0.28, matPav, 0.16, -22, -14, false))
    S.add(this.placa(74, 26, 6, 0.34, matPav2, 0.28, -0.5, 25, false))
    ;([[-150, 26, 8, 226], [122, 26, 8, 226], [-20, 146, 292, 8]] as const).forEach((v) => {
      S.add(this.box(matCesped, v[2], 0.3, v[3], v[0], 0.15, v[1], false))
    })

    // ── aparcamiento: hileras al sur y campo al este
    const hilera = (x0: number, x1: number, z: number, dir: 1 | -1) => {
      S.add(this.box(matLinea, x1 - x0, 0.02, 0.22, (x0 + x1) / 2, 0.19, z + dir * 5.1, false))
      for (let x = x0; x < x1 - 2.4; x += 2.6) {
        this.plazas++
        S.add(this.box(matLinea, 0.18, 0.02, 5, x, 0.19, z + dir * 2.6, false))
        if (hash('c' + x.toFixed(1) + z) < 0.46) {
          this.coches.push({ x: x + 1.3, z: z + dir * 2.6, rot: 0, mat: Math.floor(hash('k' + x.toFixed(1) + z) * 4) })
        }
      }
    }
    ;[56, 74, 92, 110].forEach((z) => { hilera(-120, 62, z, 1); hilera(-120, 62, z + 10.2, -1) })

    const hileraV = (z0: number, z1: number, x: number, dir: 1 | -1) => {
      S.add(this.box(matLinea, 0.22, 0.02, z1 - z0, x + dir * 5.1, 0.19, (z0 + z1) / 2, false))
      for (let z = z0; z < z1 - 2.4; z += 2.6) {
        this.plazas++
        S.add(this.box(matLinea, 5, 0.02, 0.18, x + dir * 2.6, 0.19, z, false))
        if (hash('v' + z.toFixed(1) + x) < 0.4) {
          this.coches.push({ x: x + dir * 2.6, z: z + 1.3, rot: Math.PI / 2, mat: Math.floor(hash('w' + z.toFixed(1) + x) * 4) })
        }
      }
    }
    ;[86, 104].forEach((x) => { hileraV(-40, 42, x, 1); hileraV(-40, 42, x + 10.2, -1) })

    // isletas ajardinadas entre hileras
    const plantar = (x: number, z: number, s: number) => this.arboles.push({ x, z, s })
    ;[56, 74, 92, 110].forEach((z, i) => {
      for (let x = -114; x < 60; x += 26) {
        S.add(this.box(matCesped, 4.6, 0.34, 10.4, x, 0.2, z + 5.1, false))
        if ((i + Math.round(x)) % 2 === 0) plantar(x, z + 5.1, 0.85 + hash('t' + x + z) * 0.4)
      }
    })
    for (let z = -34; z < 42; z += 22) {
      S.add(this.box(matCesped, 10.4, 0.34, 4.6, 96.2, 0.2, z, false))
      plantar(96.2, z, 0.9)
    }

    // ── volúmenes comerciales
    this.units.forEach((u) => {
      const h = u.alto
      const bodyM = matSlab.clone(), parM = matPar.clone()
      S.add(this.placa(u.w - 0.3, u.d - 0.3, Math.min(2.2, u.w * 0.12, u.d * 0.12), h, bodyM, 0, u.x, u.z))
      S.add(this.placa(u.w + 0.5, u.d + 0.5, Math.min(2.6, u.w * 0.13, u.d * 0.13), 1.1, parM, h, u.x, u.z))

      // escaparate en la línea de fachada del módulo
      const M0 = MODULOS[u.mod]
      const hg = Math.min(4.4, h - 1.4)
      if (u.tipo !== 'ISLA') {
        if (u.eje === 'x') S.add(this.box(matGlass, u.w - 1.4, hg, 0.3, u.x, hg / 2 + 0.2, u.z - M0.hacia * (u.d / 2 - 0.2), false))
        else S.add(this.box(matGlass, 0.3, hg, u.d - 1.4, u.x - M0.hacia * (u.w / 2 - 0.2), hg / 2 + 0.2, u.z, false))
      } else {
        S.add(this.box(matGlass, u.w - 1.2, 2.6, u.d - 1.2, u.x, 1.5, u.z, false))
      }

      // climatización en cubierta, que es lo que da escala a una mediana
      if (u.gla > 240) {
        const n = Math.min(4, Math.round(u.gla / 380))
        for (let i = 0; i < n; i++) {
          const ox = (hash('h' + u.id + i) - 0.5) * (u.w - 6)
          const oz = (hash('j' + u.id + i) - 0.5) * (u.d - 6)
          S.add(this.box(matHVAC, 3.2, 1.5, 2.2, u.x + ox, h + 1.85, u.z + oz))
        }
      }

      // caja de datos: es lo seleccionable, y lo que lleva el código de color
      const fillM = new THREE.MeshStandardMaterial({
        color: 0x3D8B5F, emissive: 0x3D8B5F, emissiveIntensity: 0.24,
        roughness: 0.4, transparent: true, opacity: 0.14, depthWrite: false,
      })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(u.w + 0.5, h + 1.9, u.d + 0.5), fillM)
      mesh.position.set(u.x, (h + 1.9) / 2 - 0.4, u.z)
      mesh.userData.id = u.id
      S.add(mesh)
      this.unitMeshes.push(mesh)

      const edgeM = new THREE.LineBasicMaterial({ color: 0x3D8B5F, transparent: true, opacity: 0.62 })
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeM)
      edges.position.copy(mesh.position)
      S.add(edges)

      this.vis[u.id] = {
        fillM, edgeM, bodyM, parM,
        bodyBase: new THREE.Color(0xB8B8B2), parBase: new THREE.Color(0xA6A6A0),
        modoColor: new THREE.Color(ESTADOS[u.estado].color),
        oFill: 0.14, oEdge: 0.62, oEm: 0.22, oTint: 0,
      }
    })

    // ── marquesina continua sobre las galerías
    const marq = (eje: 'x' | 'z', frente: number, hacia: 1 | -1, a: number, b: number, y: number) => {
      if (eje === 'x') {
        S.add(this.box(matMarq, b - a, 0.42, 4.2, (a + b) / 2, y, frente - hacia * 2.1))
        for (let x = a + 4; x < b - 2; x += 9) S.add(this.box(matSlab, 0.34, y, 0.34, x, y / 2, frente - hacia * 3.9))
      } else {
        S.add(this.box(matMarq, 4.2, 0.42, b - a, frente - hacia * 2.1, y, (a + b) / 2))
        for (let z = a + 4; z < b - 2; z += 9) S.add(this.box(matSlab, 0.34, y, 0.34, frente - hacia * 3.9, y / 2, z))
      }
    }
    marq('x', -58, -1, -54, 36.7, 5.2)
    marq('z', 46, 1, -54, 65.1, 5.2)
    marq('z', -106, -1, -20, 51.3, 5.2)
    marq('x', 30, 1, -30, 29.3, 4.4)

    // pérgola de la terraza gastronómica
    for (let x = -28; x < 29; x += 3.2) S.add(this.box(matSlab, 0.24, 0.24, 9.6, x, 4.1, 24.6, false))
    ;[-29, 29].forEach((x) => {
      for (let z = 20.4; z <= 29; z += 8.6) S.add(this.box(matSlab, 0.36, 4.2, 0.36, x, 2.1, z))
    })

    // ── plaza ajardinada
    const matArbusto = this.M(0x6A7A62, 0.96), matArbusto2 = this.M(0x7E8C70, 0.96),
      matGravilla = this.M(0xD2CCBC, 0.98), matPasto = this.M(0x8CA07C, 0.98), matPasto2 = this.M(0x9CAE8A, 0.98),
      matAguaP = new THREE.MeshStandardMaterial({ color: 0x8FA8AE, roughness: 0.1, metalness: 0.28 }),
      matBanco = this.M(0x9C9288, 0.9), matMacetero = this.M(0xC6C0B2, 0.92)
    const esfG = new THREE.SphereGeometry(1, 9, 7)
    const arbusto = (x: number, z: number, s: number, alt: boolean) => {
      const m = new THREE.Mesh(esfG, alt ? matArbusto2 : matArbusto)
      m.scale.set(s, s * 0.78, s * (0.85 + hash('ab' + x + z) * 0.3))
      m.position.set(x, 0.42 + s * 0.55, z)
      m.castShadow = true; m.receiveShadow = true
      S.add(m)
    }
    const parterre = (cx: number, cz: number, w: number, d: number, r: number, densidad: number, alt = false) => {
      S.add(this.placa(w + 1.3, d + 1.3, r + 0.6, 0.5, matMacetero, 0.28, cx, cz, false))
      S.add(this.placa(w, d, r, 0.72, alt ? matPasto2 : matPasto, 0.28, cx, cz, false))
      for (let i = 0; i < densidad; i++) {
        const ax = cx + (hash('px' + cx + cz + i) - 0.5) * (w - 4.2)
        const az = cz + (hash('pz' + cx + cz + i) - 0.5) * (d - 4.2)
        const r2 = hash('pr' + cx + cz + i)
        if (r2 < 0.3) plantar(ax, az, 0.95 + r2 * 0.7)
        else arbusto(ax, az, 1.7 + r2 * 2.1, r2 > 0.62)
      }
    }
    parterre(-56, -24, 44, 24, 11, 30)
    parterre(-12, -34, 34, 20, 9, 22, true)
    parterre(-26, 4, 48, 17, 8, 26)
    parterre(14, -20, 20, 30, 8, 20, true)
    parterre(-92, -8, 22, 32, 9, 22)
    parterre(-96, -40, 26, 15, 7, 14, true)

    S.add(this.placa(38, 15, 7, 0.4, matGravilla, 0.28, -36, -8, false))
    S.add(this.placa(26, 8, 4, 0.46, matAguaP, 0.34, -36, -8, false))
    for (let i = 0; i < 6; i++) S.add(this.box(matBanco, 4.4, 0.5, 1.6, -54 + i * 7.2, 0.62, -11))
    for (let i = 0; i < 4; i++) S.add(this.box(matBanco, 1.6, 0.5, 4.4, -76, 0.62, -26 + i * 8.4))
    for (let i = 0; i < 7; i++) {
      const mx = -74 + i * 13
      S.add(this.box(matMacetero, 4, 1.3, 4, mx, 0.8, -46))
      arbusto(mx, -46, 2.9, i % 2 === 0)
    }
    for (let i = 0; i < 8; i++) plantar(-26 + i * 7.6, 17.5, 0.95 + hash('gz' + i) * 0.35)
    S.add(this.placa(96, 6.5, 3, 0.6, matPasto, 0.28, -8, -40, false))
    S.add(this.placa(6.5, 62, 3, 0.6, matPasto, 0.28, 30, -14, false))
    for (let i = 0; i < 14; i++) arbusto(-52 + i * 7, -40, 1.5 + hash('fa' + i) * 0.9, i % 3 === 0)
    for (let i = 0; i < 9; i++) arbusto(30, -42 + i * 7, 1.5 + hash('fb' + i) * 0.9, i % 3 === 1)

    // ── contexto: polígono al norte, residencial al oeste, medianas al sur
    const matCtx = [this.M(0xC8C6C0, 0.92), this.M(0xBFBDB6, 0.92), this.M(0xD0CEC7, 0.92), this.M(0xB6B4AE, 0.92)]
    const matCtxT = this.M(0xA8A6A0, 0.9)
    const ctx = (x: number, z: number, w: number, d: number, h: number, rot: number) => {
      const g = new THREE.Group()
      g.add(this.box(matCtx[Math.floor(hash('cm' + x + z) * 4)], w, h, d, 0, h / 2, 0))
      g.add(this.box(matCtxT, w + 1.2, 0.5, d + 1.2, 0, h + 0.25, 0))
      const nb = Math.max(1, Math.round(h / 3.2))
      for (let k = 0; k < nb; k++) {
        g.add(this.box(matGlass, w - 1.6, 1.5, 0.2, 0, 1.9 + k * 3.2, d / 2 + 0.05, false))
        g.add(this.box(matGlass, 0.2, 1.5, d - 1.6, w / 2 + 0.05, 1.9 + k * 3.2, 0, false))
      }
      g.rotation.y = rot
      g.position.set(x, 0, z)
      S.add(g)
    }
    for (let i = 0; i < 5; i++) ctx(-150 + i * 62, 214 + (i % 2) * 26, 46 + hash('n' + i) * 16, 30, 8.5 + hash('nh' + i) * 3, 0.02)
    for (let i = 0; i < 4; i++) ctx(-228 - (i % 2) * 34, -104 + i * 66, 26, 42, 15 + hash('r' + i) * 8, 0.06)
    for (let i = 0; i < 3; i++) ctx(-268, 60 + i * 58, 24, 36, 18 + hash('rb' + i) * 7, 0.06)
    for (let i = 0; i < 4; i++) ctx(-120 + i * 78, -186 - (i % 2) * 24, 52, 34, 9 + hash('s' + i) * 3, -0.03)
    for (let i = 0; i < 4; i++) ctx(196 + (i % 2) * 30, -110 + i * 72, 34, 44, 11 + hash('e' + i) * 6, 0.04)
    for (let i = 0; i < 34; i++) {
      const a = hash('cb' + i) * Math.PI * 2, rr = 200 + hash('cc' + i) * 120
      plantar(-20 + Math.cos(a) * rr, 20 + Math.sin(a) * rr * 0.86, 1 + hash('cd' + i) * 0.7)
    }

    // ── tótems de acceso
    S.add(this.box(matTotem, 3.4, 15, 1.1, -122, 7.5, 104))
    S.add(this.box(matSlab, 5, 0.6, 2.4, -122, 0.4, 104))
    S.add(this.box(matTotem, 3.4, 12, 1.1, 116, 6.2, 96))
    S.add(this.box(matSlab, 5, 0.6, 2.4, 116, 0.4, 96))

    this.instanciar(matTronco, matVeg)
  }

  /**
   * Arbolado y coches instanciados. Son ~200 árboles y ~130 coches: como
   * mallas sueltas son 660 draw calls y el móvil se arrastra; así son 6.
   */
  private instanciar(matTronco: THREE.Material, matVeg: THREE.Material) {
    const m4 = new THREE.Matrix4()
    const tronG = new THREE.CylinderGeometry(0.25, 0.25, 1, 6)
    const copaG = new THREE.ConeGeometry(1, 1, 7)

    const troncos = new THREE.InstancedMesh(tronG, matTronco, Math.max(1, this.arboles.length))
    const copas = new THREE.InstancedMesh(copaG, matVeg, Math.max(1, this.arboles.length))
    troncos.castShadow = true
    copas.castShadow = true; copas.receiveShadow = true
    this.arboles.forEach((a, i) => {
      m4.makeScale(1, 2.4 * a.s, 1)
      m4.setPosition(a.x, 0.2 + 1.2 * a.s, a.z)
      troncos.setMatrixAt(i, m4)
      m4.makeScale(2.1 * a.s, 5.4 * a.s, 2.1 * a.s)
      m4.setPosition(a.x, 0.2 + 2.4 * a.s + 2.7 * a.s, a.z)
      copas.setMatrixAt(i, m4)
    })
    this.scene.add(troncos, copas)

    const cuerpoG = new THREE.BoxGeometry(4.3, 0.95, 1.85)
    const techoG = new THREE.BoxGeometry(2.2, 0.62, 1.6)
    const mats = [
      this.M(0xB4B4AE, 0.45, 0.3), this.M(0x8E8E88, 0.45, 0.3),
      this.M(0xA0A6A4, 0.45, 0.3), this.M(0x76767A, 0.45, 0.3),
    ]
    mats.forEach((mat, k) => {
      const lote = this.coches.filter((c) => c.mat === k)
      if (!lote.length) return
      const cuerpo = new THREE.InstancedMesh(cuerpoG, mat, lote.length)
      const techo = new THREE.InstancedMesh(techoG, mat, lote.length)
      cuerpo.castShadow = true; techo.castShadow = true
      lote.forEach((c, i) => {
        m4.makeRotationY(c.rot); m4.setPosition(c.x, 0.66, c.z)
        cuerpo.setMatrixAt(i, m4)
        m4.makeRotationY(c.rot); m4.setPosition(c.x, 1.42, c.z)
        techo.setMatrixAt(i, m4)
      })
      this.scene.add(cuerpo, techo)
    })
  }

  /* ── Color por modo ───────────────────────────────────────────────── */

  private lerpC(a: string, b: string, t: number) {
    return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)))
  }

  private vivo(c: THREE.Color) {
    const h = { h: 0, s: 0, l: 0 }
    c.getHSL(h)
    c.setHSL(h.h, Math.min(1, h.s * 1.6 + 0.12), Math.min(0.68, h.l * 1.14 + 0.06))
    return c
  }

  private applyModo(modo: ModoId) {
    this.modo = modo
    const rr = this.units.map((u) => u.renta)
    const rmin = Math.min.apply(null, rr), rmax = Math.max.apply(null, rr)
    this.units.forEach((u) => {
      let c: THREE.Color
      if (modo === 'mix') c = new THREE.Color(RUBROS[u.rubro].color)
      else if (modo === 'renta') c = this.lerpC('#CFCDC6', '#D85A30', (u.renta - rmin) / Math.max(1, rmax - rmin))
      else if (modo === 'flujo') c = this.lerpC('#CFCDC6', '#1A1A1A', u.flujo)
      else c = new THREE.Color(ESTADOS[u.estado].color)
      c = this.vivo(c)
      const v = this.vis[u.id]
      v.fillM.color.copy(c)
      v.fillM.emissive.copy(c)
      v.edgeM.color.copy(c)
      v.modoColor = c
    })
  }

  /* ── API pública ──────────────────────────────────────────────────── */

  private acerca(p: Partial<POV>): Partial<POV> {
    if (!this.movil || p.rad == null) return p
    return { ...p, rad: p.rad * 0.74 }
  }

  setModo(modo: ModoId) {
    this.applyModo(modo)
    const pov = POV_MODO[modo]
    if (pov) this.flyTo(this.acerca(pov))
    else this.flyTo(this.acerca(POV_DERIVA))
  }

  setSol(v: number) { this.sol = v }
  setFiltro(fn: (u: Local) => boolean) { this.filtro = fn }
  refrescar() { this.applyModo(this.modo) }

  setSel(id: string | null) {
    this.selId = id
    if (!id) return
    const u = this.byId[id]
    if (!u) return
    const dx = u.x + 20, dz = u.z + 20, L = Math.hypot(dx, dz) || 1
    this.flyTo({
      az: Math.atan2(dx / L, dz / L), pol: 0.98,
      rad: this.movil ? 180 : 138,
      tx: u.x * 0.7, ty: 8, tz: u.z * 0.7,
    }, 1100)
  }

  vistaFirma() { this.flyTo(this.acerca(POV_FIRMA), 1100) }

  posarEnFirma() {
    const inicio = { ...POV_FIRMA, ...this.acerca(POV_FIRMA) }
    Object.assign(this.cam, inicio)
    Object.assign(this.camT, inicio)
    this.tween = null
    this.applyCam()
  }

  derivar(dur = 2200) { this.flyTo(this.acerca(POV_DERIVA), dur) }

  pausar(v: boolean) {
    this.pausada = v
    if (!v && this.labelEl) this.labelEl.style.opacity = '0'
  }

  flyTo(to: Partial<POV>, dur = 1150) {
    const from: POV = { ...this.cam }
    const target: POV = { ...this.cam, ...to }
    let d = target.az - from.az
    while (d > Math.PI) { target.az -= Math.PI * 2; d = target.az - from.az }
    while (d < -Math.PI) { target.az += Math.PI * 2; d = target.az - from.az }
    this.tween = { from, to: target, t0: performance.now(), dur }
    this.camT = { ...target }
  }

  resize() {
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight
    if (!W || !H) return
    this.camera.aspect = W / H
    this.camera.fov = W / H < 1 ? 48 : 34
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(W, H, false)
  }

  dispose() {
    this.muerta = true
    cancelAnimationFrame(this.rafId)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.ro?.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.dispose()
  }

  /* ── Interacción ──────────────────────────────────────────────────── */

  private onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() }
    if (this.pointers.size === 2) {
      const p = Array.from(this.pointers.values())
      this.pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
    }
    this.canvas.style.cursor = 'grabbing'
  }

  private onMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2 && this.pinch) {
      const p = Array.from(this.pointers.values())
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
      this.camT.rad = Math.max(70, Math.min(620, this.camT.rad * (this.pinch / Math.max(1, d))))
      this.pinch = d
      this.tween = null
      return
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y
      this.drag.moved += Math.abs(dx) + Math.abs(dy)
      this.drag.x = e.clientX; this.drag.y = e.clientY
      this.camT.az -= dx * 0.0052
      this.camT.pol = Math.max(0.20, Math.min(1.40, this.camT.pol - dy * 0.0042))
      this.tween = null
      return
    }
    if (e.pointerType === 'touch') return
    this.ptr = { x: e.clientX, y: e.clientY }
    this.needHover = true
  }

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinch = null
    this.canvas.style.cursor = 'grab'
    if (this.drag && this.drag.moved < 9 && performance.now() - this.drag.t < 460) {
      this.ptr = { x: e.clientX, y: e.clientY }
      this.onPick(this.pick())
    }
    this.drag = null
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.camT.rad = Math.max(70, Math.min(620, this.camT.rad * (1 + e.deltaY * 0.0012)))
    this.tween = null
  }

  private pick(): string | null {
    if (!this.ptr) return null
    const r = this.wrap.getBoundingClientRect()
    this.ndc.set(((this.ptr.x - r.left) / r.width) * 2 - 1, -((this.ptr.y - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const vis = this.unitMeshes.filter((m) => this.vis[m.userData.id as string].oFill > 0.05)
    const hits = this.ray.intersectObjects(vis, false)
    return hits.length ? (hits[0].object.userData.id as string) : null
  }

  /* ── Bucle ────────────────────────────────────────────────────────── */

  private ease(t: number) { return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2 }

  private applyCam() {
    const c = this.cam, sp = Math.sin(c.pol), cp = Math.cos(c.pol)
    this.camera.position.set(c.tx + c.rad * sp * Math.sin(c.az), c.ty + c.rad * cp, c.tz + c.rad * sp * Math.cos(c.az))
    this.camera.lookAt(c.tx, c.ty, c.tz)
  }

  private raf = () => {
    if (this.muerta) return
    this.rafId = requestAnimationFrame(this.raf)
    if (this.pausada) return

    const now = performance.now()
    const K: (keyof POV)[] = ['az', 'pol', 'rad', 'tx', 'ty', 'tz']
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur), e = this.ease(k)
      K.forEach((p) => { this.cam[p] = this.tween!.from[p] + (this.tween!.to[p] - this.tween!.from[p]) * e })
      if (k >= 1) this.tween = null
    } else {
      K.forEach((p) => { this.cam[p] += (this.camT[p] - this.cam[p]) * 0.095 })
    }
    this.applyCam()

    const conj = this.modo === 'conjunto'
    const pulso = 0.5 + 0.5 * Math.sin(now * 0.0032)
    this.units.forEach((u) => {
      const v = this.vis[u.id]
      let f = conj ? 0.02 : 0.14, ed = conj ? 0.16 : 0.62, tint = conj ? 0 : 0.78, em = 0.22
      const ok = this.filtro(u)
      if (!ok) { f = 0.008; ed = 0.05; tint = 0; em = 0 }
      else if (u.id === this.selId) { f = 0.5; ed = 1; tint = 1; em = 0.8 + pulso * 0.5 }
      else if (this.selId) { f *= 0.4; ed *= 0.3; tint *= 0.4; em = 0.08 }
      if (ok && u.id === this.hoverId && u.id !== this.selId) { f = 0.46; ed = 1; tint = 1; em = 0.95 }
      v.oFill += (f - v.oFill) * 0.16
      v.oEdge += (ed - v.oEdge) * 0.16
      v.oTint += (tint - v.oTint) * 0.14
      v.oEm += (em - v.oEm) * 0.18
      v.fillM.opacity = v.oFill
      v.edgeM.opacity = v.oEdge
      v.fillM.emissiveIntensity = v.oEm
      // el propio volumen del local se tiñe: sin esto el código de color
      // se queda en la caja translúcida y no se lee en vista de conjunto
      v.bodyM.color.copy(v.bodyBase).lerp(v.modoColor, v.oTint * 0.5)
      v.parM.color.copy(v.parBase).lerp(v.modoColor, Math.min(1, v.oTint * 1.25))
    })

    const a = (this.sol / 1000) * Math.PI * 1.06 - Math.PI * 0.03
    const el = Math.max(0.12, Math.sin(a))
    this.sun.position.set(Math.cos(a) * 260, 60 + el * 300, 120 + Math.cos(a) * 70)
    this.sun.intensity = 0.55 + el * 0.8

    if (this.needHover && !this.drag) {
      this.needHover = false
      const id = this.pick()
      if (id !== this.hoverId) { this.hoverId = id; this.onHover(id) }
    }

    if (this.labelEl) {
      const u = this.hoverId ? this.byId[this.hoverId] : null
      if (u) {
        this.v3.set(u.x, u.alto + 2.4, u.z).project(this.camera)
        const r = this.wrap.getBoundingClientRect()
        this.labelEl.style.transform = `translate(${(this.v3.x * 0.5 + 0.5) * r.width}px,${(-this.v3.y * 0.5 + 0.5) * r.height}px)`
        this.labelEl.style.opacity = '1'
      } else {
        this.labelEl.style.opacity = '0'
      }
    }

    this.renderer.render(this.scene, this.camera)
  }
}

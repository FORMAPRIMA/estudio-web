/**
 * FP Visual Lab — escena 3D de Méndez Álvaro 32.
 *
 * Torre de 24 plantas con forjados continuos y esquinas curvas, plinto
 * comercial, ala baja, townhouses, manzana urbana de contexto, arbolado y
 * viario. Mismo contrato que las otras dos escenas.
 *
 * Lo que la distingue: el modo `plantas` **despieza el edificio** — cada
 * forjado sube proporcionalmente a su altura y el conjunto se abre como un
 * diagrama de apilamiento sin dejar de ser el mismo edificio.
 */

import * as THREE from 'three'
import {
  type Vivienda, type ModoId,
  ESTADOS, plateFor, FH, Y0, PLANTAS_MAX,
} from '@/lib/visual-lab/mendez'

export interface POV { az: number; pol: number; rad: number; tx: number; ty: number; tz: number }

export const POV_FIRMA: POV = { az: 0.86, pol: 1.11, rad: 185, tx: 0, ty: 43, tz: 6 }
export const POV_DERIVA: POV = { az: 0.97, pol: 1.07, rad: 172, tx: 0, ty: 41, tz: 6 }

const POV_MODO: Partial<Record<ModoId, Partial<POV>>> = {
  conjunto: { az: 0.95, pol: 1.06, rad: 226, tx: 0, ty: 36, tz: 8 },
  disponibilidad: { az: 0.78, pol: 1.14, rad: 194, tx: 0, ty: 34, tz: 5 },
  plantas: { az: 1.34, pol: 1.28, rad: 258, tx: 0, ty: 52, tz: 0 },
  asoleamiento: { az: 2.15, pol: 1.0, rad: 208, tx: 0, ty: 40, tz: 0 },
}

interface Vis {
  fillM: THREE.MeshStandardMaterial
  edgeM: THREE.LineBasicMaterial
  oFill: number
  oEdge: number
  oEm: number
}

export interface EscenaOpts {
  canvas: HTMLCanvasElement
  wrap: HTMLElement
  labelEl: HTMLElement | null
  units: Vivienda[]
  onHover: (id: string | null) => void
  onPick: (id: string | null) => void
}

export class Escena {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private sun: THREE.DirectionalLight
  private wrap: HTMLElement
  private canvas: HTMLCanvasElement
  private labelEl: HTMLElement | null
  private units: Vivienda[]
  private byId: Record<string, Vivienda> = {}
  private vis: Record<string, Vis> = {}
  private onHover: (id: string | null) => void
  private onPick: (id: string | null) => void

  private unitMeshes: THREE.Mesh[] = []
  private floors: Record<number, THREE.Group> = {}
  private floorOff: Record<number, number> = {}
  private roof: THREE.Group | null = null
  private geoCache: Record<string, THREE.ExtrudeGeometry> = {}

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

  private modo: ModoId = 'disponibilidad'
  private sol = 790
  private selId: string | null = null
  private hoverId: string | null = null
  private filtro: (u: Vivienda) => boolean = () => true
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
    scene.fog = new THREE.Fog(0xF2F2F0, 220, 660)
    // una torre en vertical necesita menos apertura que un trazado horizontal:
    // el edificio ya llena el alto del fotograma
    const camera = new THREE.PerspectiveCamera(W / H < 1 ? 42 : 36, W / H, 0.5, 2000)
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.movil, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 1.75))
    renderer.setSize(W, H, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xDEDED8, 0.72))
    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.02)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.movil ? 1024 : 2048, this.movil ? 1024 : 2048)
    const sc = sun.shadow.camera
    sc.left = -110; sc.right = 110; sc.top = 130; sc.bottom = -60; sc.near = 1; sc.far = 420
    sun.shadow.bias = -0.0006
    scene.add(sun)
    this.sun = sun
    const fill = new THREE.DirectionalLight(0xCACACA, 0.28)
    fill.position.set(-70, 40, -60)
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

  /* ── Primitivas ───────────────────────────────────────────────────── */

  private M(c: number, r = 0.85, m = 0) {
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

  private placa(w: number, d: number, r: number, h: number, mat: THREE.Material, y: number, cx = 0, cz = 0) {
    const key = 'p' + [w, d, r, h].map((v) => v.toFixed(2)).join('_')
    if (!this.geoCache[key]) {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(this.puntos(w, d, r, 4)), { depth: h, bevelEnabled: false, curveSegments: 4 })
      g.rotateX(-Math.PI / 2); g.translate(0, h, 0)
      this.geoCache[key] = g
    }
    const m = new THREE.Mesh(this.geoCache[key], mat)
    m.position.set(cx, y, cz)
    m.castShadow = true; m.receiveShadow = true
    return m
  }

  /** Banda acristalada continua: la placa menos su hueco interior. */
  private anillo(w: number, d: number, r: number, h: number, mat: THREE.Material, y: number, cx = 0, cz = 0) {
    const key = 'a' + [w, d, r, h].map((v) => v.toFixed(2)).join('_')
    if (!this.geoCache[key]) {
      const sh = new THREE.Shape(this.puntos(w, d, r, 4))
      sh.holes.push(new THREE.Path(this.puntos(w - 0.26, d - 0.26, r - 0.13, 4).reverse()))
      const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 4 })
      g.rotateX(-Math.PI / 2); g.translate(0, h, 0)
      this.geoCache[key] = g
    }
    const m = new THREE.Mesh(this.geoCache[key], mat)
    m.position.set(cx, y, cz)
    return m
  }

  /* ── Construcción ─────────────────────────────────────────────────── */

  private construir() {
    const S = this.scene
    const matSlab = this.M(0xB6B6B0, 0.9), matCore = this.M(0x5E5E60, 0.9), matPod = this.M(0xA8A8A2, 0.88),
      matGnd = this.M(0xF2F2F0, 1), matPlaza = this.M(0xE6E5E1, 0.96), matCtx = this.M(0xCECEC8, 0.96),
      matVeg = this.M(0x6E7A68, 0.95), matTronco = this.M(0x8C8176, 0.9),
      matAsfalto = this.M(0x9A9A96, 0.95), matLinea = this.M(0xF2F2F0, 0.9), matBordillo = this.M(0xC6C6C0, 0.9),
      matPalma = this.M(0x7A8A6E, 0.92)
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x9CA6AA, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.62 })
    const matAgua = new THREE.MeshStandardMaterial({ color: 0x82A2AA, roughness: 0.15, metalness: 0.2 })
    const matCuerpo = new THREE.MeshStandardMaterial({ color: 0xB6BAB8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.13, depthWrite: false })

    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), matGnd)
    gnd.rotation.x = -Math.PI / 2
    gnd.receiveShadow = true
    S.add(gnd)

    // ── viario de la manzana
    const via = (w: number, d: number, x: number, z: number) => {
      const m = this.box(matAsfalto, w, 0.12, d, x, 0.06, z, false)
      m.receiveShadow = true
      S.add(m)
    }
    const bordillo = (w: number, d: number, x: number, z: number) => S.add(this.box(matBordillo, w, 0.34, d, x, 0.17, z, false))
    via(150, 10, 0, -50); via(150, 10, 0, 50); via(10, 110, -70, 0); via(10, 110, 70, 0)
    via(10, 60, 0, -80); via(60, 10, 100, 0)
    bordillo(132, 0.5, 0, -44.6); bordillo(132, 0.5, 0, 44.6)
    bordillo(0.5, 100, -64.6, 0); bordillo(0.5, 100, 64.6, 0)
    for (let i = -6; i <= 6; i++) {
      S.add(this.box(matLinea, 3.4, 0.14, 0.3, i * 11, 0.13, -50, false))
      S.add(this.box(matLinea, 3.4, 0.14, 0.3, i * 11, 0.13, 50, false))
      S.add(this.box(matLinea, 0.3, 0.14, 3.4, -70, 0.13, i * 8, false))
      S.add(this.box(matLinea, 0.3, 0.14, 3.4, 70, 0.13, i * 8, false))
    }
    for (let i = 0; i < 6; i++) S.add(this.box(matLinea, 0.6, 0.14, 8.4, -6 + i * 2.4, 0.13, -45.5, false))

    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 0.5, 56), matPlaza)
    plaza.position.y = 0.25
    plaza.receiveShadow = true
    S.add(plaza)
    S.add(this.box(matPlaza, 124, 0.4, 96, 0, 0.2, 4, false))

    // ── plinto comercial de dos niveles con lamas
    const gPl = new THREE.Group(); S.add(gPl)
    gPl.add(this.placa(58, 48, 12, 7.2, matPod, 0, 0, 6))
    gPl.add(this.placa(61, 51, 13, 0.5, matSlab, 7.2, 0, 6))
    gPl.add(this.placa(56, 46, 11.4, 6.7, matCuerpo, 0.2, 0, 6))
    this.puntos(59.5, 49.5, 12.5, 4).forEach((p, i) => {
      if (i % 2 === 0) gPl.add(this.box(matSlab, 0.32, 7, 0.32, p.x, 3.6, p.y + 6, false))
    })

    // ── ala baja de cuatro niveles, misma gramática de bandas
    const gAla = new THREE.Group(); S.add(gAla)
    for (let k = 0; k < 4; k++) {
      const y = 7.7 + k * FH
      gAla.add(this.placa(40, 15.5, 7, 0.3, matSlab, y, 0, 27))
      gAla.add(this.anillo(39.6, 15.1, 6.9, 0.95, matGlass, y + 0.32, 0, 27))
      gAla.add(this.placa(36.2, 11.8, 5.2, FH - 0.4, matCuerpo, y + 0.3, 0, 27))
    }
    const yAla = 7.7 + 4 * FH
    gAla.add(this.placa(40, 15.5, 7, 0.34, matSlab, yAla, 0, 27))
    for (let i = 0; i < 7; i++) {
      gAla.add(this.box(matVeg, 3.2, 0.8, 3.2, -14 + i * 4.7, yAla + 0.5, 27 + ((i % 2) ? 3.4 : -3.4), false))
    }
    gAla.add(this.anillo(39.6, 15.1, 6.9, 0.95, matGlass, yAla + 0.34, 0, 27))

    // ── townhouses con patio
    const gTH = new THREE.Group(); S.add(gTH); this.floors[0] = gTH
    ;[-17.5, -10.5, -3.5, 3.5, 10.5, 17.5].forEach((x, i) => {
      gTH.add(this.placa(6.6, 9, 1.6, 6.4, matSlab, 0, x, 39.5))
      gTH.add(this.placa(7.4, 9.8, 2, 0.3, matSlab, 6.4, x, 39.5))
      gTH.add(this.box(matGlass, 5.4, 2.4, 0.2, x, 2.1, 35.1))
      gTH.add(this.box(matGlass, 5.4, 2.4, 0.2, x, 5.3, 35.1))
      gTH.add(this.box(matPlaza, 6.8, 0.24, 5, x, 0.32, 31.8, false))
      if (i < 5) gTH.add(this.box(matBordillo, 0.24, 1.1, 5, x + 3.5, 0.75, 31.8, false))
    })

    // ── contexto urbano: no compite con el proyecto, le da escala
    ;([[-80, -22, 24, 16, 26], [-80, 16, 22, 22, 24], [-58, -66, 26, 13, 24], [-20, -70, 22, 19, 22],
      [22, -70, 26, 15, 26], [60, -60, 24, 24, 22], [86, -18, 22, 17, 28], [86, 20, 24, 28, 24],
      [58, 62, 26, 14, 24], [18, 66, 24, 20, 22], [-26, 66, 26, 16, 26], [-64, 60, 22, 22, 24],
      [-108, -6, 20, 12, 30], [110, -2, 20, 20, 30], [0, -104, 30, 18, 22], [-40, 100, 26, 13, 24],
      [40, 98, 24, 26, 22], [-112, 46, 20, 15, 22]] as const).forEach((c, i) => {
      S.add(this.box(matCtx, c[2], c[3], c[4], c[0], c[3] / 2, c[1]))
      if (i % 3 === 0) S.add(this.box(matCtx, c[2] * 0.62, c[3] * 0.42, c[4] * 0.62, c[0], c[3] + c[3] * 0.21, c[1]))
      if (i % 4 === 1) S.add(this.box(matPod, c[2] * 1.04, 0.4, c[4] * 1.04, c[0], 3.4, c[1], false))
    })

    this.arbolado(matTronco, matVeg, matPalma)
    this.coches()

    // ── la torre: 24 forjados, cada uno en su propio grupo para poder despiezar
    const tower = new THREE.Group(); S.add(tower)
    for (let p = 1; p <= PLANTAS_MAX; p++) {
      const g = new THREE.Group(); tower.add(g); this.floors[p] = g
      this.floorOff[p] = 0
      const y = Y0 + (p - 1) * FH
      const [W, D, r] = plateFor(p)
      g.add(this.placa(W, D, r, 0.32, matSlab, y))
      g.add(this.anillo(W - 0.4, D - 0.4, r - 0.2, 1.02, matGlass, y + 0.32))
      if (p !== 5) g.add(this.placa(W - 3.8, D - 3.8, Math.max(1.4, r - 1.9), FH - 0.4, matCuerpo, y + 0.32))
      const nucW = p <= 13 ? 18 : (p <= 20 ? 15 : (p === 21 ? 12 : 9.5))
      g.add(this.box(matCore, nucW, FH, p <= 20 ? 7.2 : 6.2, 0, y + FH / 2, 0))
      // planta 5: amenidades (piscina y solárium), por eso no tiene viviendas
      if (p === 5) {
        g.add(this.box(matAgua, 13, 0.5, 6.5, -13, y + 0.4, 10, false))
        g.add(this.placa(15, 10, 4, FH - 0.4, matGlass, y + 0.32, 13, -8))
        for (let i = -2; i <= 2; i++) g.add(this.box(matSlab, 0.35, 0.35, 11, i * 4.6 - 13, y + 3.2, 10, false))
      }
      // las plantas de retranqueo ganan jardinera sobre la planta inferior
      if (p === 14 || p === 21 || p === 22) {
        const ant = plateFor(p - 1)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          g.add(this.box(matVeg, 2.6, 0.85, 2.6, Math.cos(a) * (ant[0] / 2 - 2.6), y + 0.62, Math.sin(a) * (ant[1] / 2 - 2.6), false))
        }
      }
    }

    const yTop = Y0 + 23 * FH
    const roof = new THREE.Group(); tower.add(roof); this.roof = roof
    roof.add(this.placa(17.4, 14.4, 5.4, 0.34, matSlab, yTop))
    roof.add(this.placa(11.6, 9.6, 3.4, 3.2, matGlass, yTop + 0.34, 1.5, 0))
    roof.add(this.box(matAgua, 7, 0.4, 3.6, -4.6, yTop + 0.55, 3.4, false))
    roof.add(this.anillo(17, 14, 5.2, 1.02, matGlass, yTop + 0.34))
    for (let i = 0; i < 6; i++) roof.add(this.box(matSlab, 0.28, 0.28, 8.4, -6.2 + i * 2.5, yTop + 3.9, 2.4, false))
    roof.add(this.placa(13, 10.6, 4, 0.3, matSlab, yTop + 3.9, 0, 0))
    for (let i = 0; i < 5; i++) roof.add(this.box(matVeg, 2.4, 0.8, 2.4, -5 + i * 2.6, yTop + 0.6, -4.6, false))

    // ── volúmenes de vivienda: cuelgan del grupo de su planta
    this.units.forEach((u) => {
      const col = this.vivo(new THREE.Color(ESTADOS[u.estado].color))
      const fillM = new THREE.MeshStandardMaterial({
        color: col.clone(), emissive: col.clone(), emissiveIntensity: 0.3,
        roughness: 0.4, transparent: true, opacity: 0.3, depthWrite: false,
      })
      let geo: THREE.BufferGeometry
      let px = u.x, py = u.wy + u.alto / 2 - 1.4, pz = u.z
      if (u.poly) {
        const sh = new THREE.Shape()
        u.poly.forEach((q, i) => { if (i === 0) sh.moveTo(q[0], -q[1]); else sh.lineTo(q[0], -q[1]) })
        sh.closePath()
        const g = new THREE.ExtrudeGeometry(sh, { depth: u.alto, bevelEnabled: false, curveSegments: 1 })
        g.rotateX(-Math.PI / 2)
        geo = g
        px = 0; pz = 0; py = u.wy - 1.4
      } else {
        geo = new THREE.BoxGeometry(u.w, u.alto, u.d)
      }
      const mesh = new THREE.Mesh(geo, fillM)
      mesh.position.set(px, py, pz)
      mesh.userData.id = u.id
      const edgeM = new THREE.LineBasicMaterial({ color: col.clone(), transparent: true, opacity: 0.75 })
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 16), edgeM)
      edge.position.copy(mesh.position)
      const g = this.floors[u.planta] ?? this.floors[1]
      g.add(mesh, edge)
      this.unitMeshes.push(mesh)
      this.vis[u.id] = { fillM, edgeM, oFill: 0.3, oEdge: 0.75, oEm: 0.26 }
    })
  }

  /** Arbolado instanciado por especie: 3 tipos, 6 draw calls en vez de ~90. */
  private arbolado(matTronco: THREE.Material, matVeg: THREE.Material, matPalma: THREE.Material) {
    const m4 = new THREE.Matrix4()
    const coniferas: [number, number, number][] = []
    const frondosos: [number, number, number][] = []
    const palmeras: [number, number, number][] = []

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      coniferas.push([Math.cos(a) * 35, Math.sin(a) * 33 - 4, 0.9 + (i % 3) * 0.12])
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3
      frondosos.push([Math.cos(a) * 46, Math.sin(a) * 40, 0.85 + (i % 4) * 0.14])
    }
    ;([[-26, 34], [-13, 34], [0, 34], [13, 34], [26, 34], [-34, -30], [34, -30], [0, -34]] as const)
      .forEach((p, i) => palmeras.push([p[0], p[1], 0.9 + (i % 3) * 0.1]))

    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n))
      m.castShadow = true
      this.scene.add(m)
      return m
    }

    const trC = inst(new THREE.CylinderGeometry(0.26, 0.32, 1, 6), matTronco, coniferas.length)
    const foC = inst(new THREE.ConeGeometry(1, 1, 7), matVeg, coniferas.length)
    coniferas.forEach(([x, z, s], i) => {
      m4.makeScale(1, 2 * s, 1); m4.setPosition(x, s, z); trC.setMatrixAt(i, m4)
      m4.makeScale(1.8 * s, 4.4 * s, 1.8 * s); m4.setPosition(x, 2 * s + 1.9 * s, z); foC.setMatrixAt(i, m4)
    })

    const trF = inst(new THREE.CylinderGeometry(0.3, 0.4, 1, 6), matTronco, frondosos.length)
    const foF = inst(new THREE.IcosahedronGeometry(1, 0), matVeg, frondosos.length)
    frondosos.forEach(([x, z, s], i) => {
      m4.makeScale(1, 2.6 * s, 1); m4.setPosition(x, 1.3 * s, z); trF.setMatrixAt(i, m4)
      m4.makeRotationY(x); m4.scale(new THREE.Vector3(2.1 * s, 2.1 * s, 2.1 * s))
      m4.setPosition(x, 2.6 * s + 1.7 * s, z); foF.setMatrixAt(i, m4)
    })

    const trP = inst(new THREE.CylinderGeometry(0.2, 0.32, 1, 6), matTronco, palmeras.length)
    const hoP = inst(new THREE.BoxGeometry(1, 0.1, 1), matPalma, palmeras.length * 7)
    let hi = 0
    palmeras.forEach(([x, z, s], i) => {
      const h = 7 * s
      m4.makeRotationZ(0.05); m4.scale(new THREE.Vector3(1, h, 1)); m4.setPosition(x, h / 2, z)
      trP.setMatrixAt(i, m4)
      for (let k = 0; k < 7; k++) {
        m4.makeRotationY(k * 0.9)
        m4.multiply(new THREE.Matrix4().makeRotationZ(-0.34))
        m4.scale(new THREE.Vector3(3.4 * s, 1, 0.9 * s))
        m4.setPosition(x + Math.cos(k * 0.9) * 1.5 * s, h + 0.2, z + Math.sin(k * 0.9) * 1.5 * s)
        hoP.setMatrixAt(hi++, m4)
      }
    })
  }

  private coches() {
    const mats = [this.M(0xB4B4AE, 0.5, 0.3), this.M(0x8E8E88, 0.5, 0.3)]
    const lista: [number, number, number, number][] = [
      [-28, -47.5, 0, 0], [-8, -47.5, 0, 1], [24, -52.5, Math.PI, 0],
      [-67.5, 14, Math.PI / 2, 1], [72.5, -10, -Math.PI / 2, 0], [6, 52.5, Math.PI, 1],
    ]
    lista.forEach(([x, z, rot, mi]) => {
      const g = new THREE.Group()
      g.add(this.box(mats[mi], 4.4, 1.1, 1.85, 0, 0.68, 0))
      g.add(this.box(mats[mi], 2.3, 0.72, 1.7, -0.2, 1.5, 0))
      g.position.set(x, 0, z)
      g.rotation.y = rot
      this.scene.add(g)
    })
  }

  /* ── Color por modo ───────────────────────────────────────────────── */

  private vivo(c: THREE.Color) {
    const h = { h: 0, s: 0, l: 0 }
    c.getHSL(h)
    c.setHSL(h.h, Math.min(1, h.s * 1.6 + 0.12), Math.min(0.68, h.l * 1.14 + 0.06))
    return c
  }

  private applyModo(modo: ModoId) {
    this.modo = modo
    this.units.forEach((u) => {
      const c = this.vivo(new THREE.Color(ESTADOS[u.estado].color))
      const v = this.vis[u.id]
      v.fillM.color.copy(c)
      v.fillM.emissive.copy(c)
      v.edgeM.color.copy(c)
    })
  }

  /* ── API pública ──────────────────────────────────────────────────── */

  private acerca(p: Partial<POV>): Partial<POV> {
    if (!this.movil || p.rad == null) return p
    return { ...p, rad: p.rad * 0.82 }
  }

  /** La vivienda disponible más alta: la que mejor vende el edificio. */
  private destacada(): Vivienda {
    const d = this.units.filter((u) => u.estado === 'disponible')
    return d.sort((a, b) => b.planta - a.planta)[0] ?? this.units[0]
  }

  setModo(modo: ModoId) {
    this.applyModo(modo)
    if (modo === 'vista') {
      // se sitúa la cámara EN la vivienda mirando hacia fuera: es la promesa
      // que se le vende al comprador de una planta alta
      const u = this.selId ? this.byId[this.selId] : this.destacada()
      const dx = u.x * 0.5, dz = u.z * 1.8, L = Math.hypot(dx, dz) || 1
      const ux = dx / L, uz = dz / L, R = 95
      this.selId = u.id
      this.flyTo({
        az: Math.atan2(ux, uz), pol: 1.41, rad: R,
        tx: u.x - ux * R, ty: u.wy - R * Math.cos(1.41), tz: u.z - uz * R,
      }, 1400)
      return u.id
    }
    const pov = POV_MODO[modo]
    if (pov) this.flyTo(this.acerca(pov))
    return null
  }

  setSol(v: number) { this.sol = v }
  setFiltro(fn: (u: Vivienda) => boolean) { this.filtro = fn }
  refrescar() { this.applyModo(this.modo) }

  setSel(id: string | null) {
    this.selId = id
    if (!id || this.modo === 'vista') return
    const u = this.byId[id]
    if (!u) return
    const dx = u.x * 0.55, dz = u.z * 1.6, L = Math.hypot(dx, dz) || 1
    this.flyTo({
      az: Math.atan2(dx / L, dz / L), pol: 1.26,
      rad: this.movil ? 96 : 74,
      tx: 0, ty: u.wy + 1, tz: 0,
    }, 1150)
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
    this.camera.fov = W / H < 1 ? 42 : 36
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
      this.camT.rad = Math.max(52, Math.min(340, this.camT.rad * (this.pinch / Math.max(1, d))))
      this.pinch = d
      this.tween = null
      return
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y
      this.drag.moved += Math.abs(dx) + Math.abs(dy)
      this.drag.x = e.clientX; this.drag.y = e.clientY
      this.camT.az -= dx * 0.0052
      this.camT.pol = Math.max(0.34, Math.min(1.42, this.camT.pol - dy * 0.0042))
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
    this.camT.rad = Math.max(52, Math.min(340, this.camT.rad * (1 + e.deltaY * 0.0012)))
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

    // despiece: cada forjado sube 1,35 m por planta, con inercia creciente
    const expl = this.modo === 'plantas' ? 1 : 0
    for (let p = 1; p <= PLANTAS_MAX; p++) {
      const t = expl * (p - 1) * 1.35
      this.floorOff[p] += (t - this.floorOff[p]) * (0.052 + p * 0.0011)
      this.floors[p].position.y = this.floorOff[p]
    }
    if (this.roof) this.roof.position.y = this.floorOff[PLANTAS_MAX] + expl * 1.35

    const conj = this.modo === 'conjunto'
    const baseFill = conj ? 0.06 : 0.34, baseEdge = conj ? 0.24 : 1
    const pulso = 0.5 + 0.5 * Math.sin(now * 0.0032)
    this.units.forEach((u) => {
      const v = this.vis[u.id]
      let f = baseFill, ed = baseEdge, em = 0.26
      if (!this.filtro(u)) { f = 0.012; ed = 0.08; em = 0 }
      else if (u.id === this.selId) { f = 0.7; ed = 1; em = 0.82 + pulso * 0.5 }
      else if (this.selId) { f *= 0.3; ed *= 0.28; em = 0.08 }
      if (u.id === this.hoverId && u.id !== this.selId) { f = 0.62; ed = 1; em = 0.95 }
      v.oFill += (f - v.oFill) * 0.16
      v.oEdge += (ed - v.oEdge) * 0.16
      v.oEm += (em - v.oEm) * 0.18
      v.fillM.opacity = v.oFill
      v.edgeM.opacity = v.oEdge
      v.fillM.emissiveIntensity = v.oEm
    })

    const a = (this.sol / 1000) * Math.PI * 1.06 - Math.PI * 0.03
    const el = Math.max(0.12, Math.sin(a))
    this.sun.position.set(Math.cos(a) * 150, 30 + el * 165, 55 + Math.cos(a) * 40)
    this.sun.intensity = 0.55 + el * 0.85

    if (this.needHover && !this.drag) {
      this.needHover = false
      const id = this.pick()
      if (id !== this.hoverId) { this.hoverId = id; this.onHover(id) }
    }

    if (this.labelEl) {
      const u = this.hoverId ? this.byId[this.hoverId] : null
      if (u) {
        this.v3.set(u.x, u.wy + (this.floorOff[u.planta] ?? 0) + u.alto - 0.6, u.z).project(this.camera)
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

/**
 * FP Visual Lab — escena 3D de Valdeserra.
 *
 * Clase imperativa sin React: construye el terreno, el viario, los volúmenes de
 * parcela, las amenidades y el arbolado, y expone métodos para que la UI le
 * hable (modo de lectura, exageración del relieve, hora solar, filtro, cámara).
 *
 * Diferencias frente al artefacto original de Claude Design:
 *  - el arbolado va en `InstancedMesh` (4 draw calls en vez de ~250), para que
 *    el visor sea usable en un iPhone;
 *  - el FOV se abre en pantallas verticales, que si no recortan el trazado;
 *  - la malla del terreno y el shadow map bajan de resolución en móvil.
 */

import * as THREE from 'three'
import {
  type Parcela, type ModoId, type EstadoId,
  ESTADOS, TIPOS, ETAPAS, VIAS, h0, vaguada, grad, off, hash,
} from '@/lib/visual-lab/domain'

export interface POV { az: number; pol: number; rad: number; tx: number; ty: number; tz: number }

/** POV maestro del render de firma (ver `renders/POV-manifest.md` del proyecto de diseño). */
export const POV_FIRMA: POV = { az: 0.48, pol: 1.32, rad: 700, tx: -10, ty: 26, tz: 0 }
/** Deriva de entrada: adonde va la cámara después de la vista de firma. */
export const POV_DERIVA: POV = { az: 0.58, pol: 1.28, rad: 655, tx: -10, ty: 26, tz: 0 }

const POV_MODO: Partial<Record<ModoId, Partial<POV>>> = {
  conjunto: { az: 0.48, pol: 0.58, rad: 1150, tx: -20, ty: 8, tz: -4 },
  topografia: { az: 1.98, pol: 1.02, rad: 660, tx: -20, ty: 22, tz: -24 },
  etapas: { az: 0.30, pol: 0.16, rad: 1040, tx: -20, ty: 4, tz: -4 },
  caracter: { az: 0.48, pol: 0.74, rad: 900, tx: -20, ty: 8, tz: -4 },
}

interface VisUnidad {
  fillM: THREE.MeshStandardMaterial
  edgeM: THREE.LineBasicMaterial
  oFill: number
  oEdge: number
  oEm: number
  padY: number
}

interface Follow { o: THREE.Object3D; h: number; off: number }
interface Cinta { g: THREE.BufferGeometry; base: number[]; off: number }
interface Arbol { x: number; z: number; s: number; tipo: 'enc' | 'con'; h: number }

export interface EscenaOpts {
  canvas: HTMLCanvasElement
  wrap: HTMLElement
  labelEl: HTMLElement | null
  units: Parcela[]
  onHover: (id: string | null) => void
  onPick: (id: string | null) => void
}

const sq = (v: number) => v * v

export class Escena {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private sun: THREE.DirectionalLight
  private wrap: HTMLElement
  private canvas: HTMLCanvasElement
  private labelEl: HTMLElement | null
  private units: Parcela[]
  private byId: Record<string, Parcela> = {}
  private vis: Record<string, VisUnidad> = {}
  private onHover: (id: string | null) => void
  private onPick: (id: string | null) => void

  private terrGeo!: THREE.PlaneGeometry
  private terrBase: number[] = []
  private attrPaisaje!: THREE.Float32BufferAttribute
  private attrHipso!: THREE.Float32BufferAttribute
  private cintas: Cinta[] = []
  private follow: Follow[] = []
  private unitMeshes: THREE.Mesh[] = []
  private arboles: Arbol[] = []
  private instancias: { mesh: THREE.InstancedMesh; tipo: 'enc' | 'con'; parte: 'tronco' | 'copa' }[] = []

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

  // estado que la UI empuja
  private modo: ModoId = 'disponibilidad'
  private exag = 1.5
  private sol = 790 // tarde baja: la luz del render de firma
  private selId: string | null = null
  private hoverId: string | null = null
  private filtro: (u: Parcela) => boolean = () => true
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
    scene.fog = new THREE.Fog(0xF2F2F0, 780, 2300)
    // en vertical el trazado no cabe con 32°: se abre el campo en vez de alejar
    // la cámara, que aplanaría el relieve
    const camera = new THREE.PerspectiveCamera(W / H < 1 ? 46 : 32, W / H, 1, 5000)
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.movil, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.movil ? 1.5 : 1.6))
    renderer.setSize(W, H, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xD6D8CE, 0.76))
    const sun = new THREE.DirectionalLight(0xFFF8EE, 1.0)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.movil ? 1024 : 2048, this.movil ? 1024 : 2048)
    const sc = sun.shadow.camera
    sc.left = -340; sc.right = 340; sc.top = 340; sc.bottom = -340; sc.near = 1; sc.far = 1600
    sun.shadow.bias = -0.0013
    scene.add(sun)
    this.sun = sun
    const fill = new THREE.DirectionalLight(0xC8C8C4, 0.22)
    fill.position.set(-240, 130, 220)
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

    this.aplicaExag()
    this.applyModo('disponibilidad')
    this.raf()
  }

  /* ── Construcción ─────────────────────────────────────────────────── */

  private construir() {
    const M = (c: number, r = 0.94, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m })
    const matAsf = M(0x9A9A96), matAcera = M(0xD8D5CB), matPiedra = M(0xC2BAA8, 0.92)
    const matCasa = M(0xDEDBD2, 0.9), matTecho = M(0xB6B2A6, 0.9), matClub = M(0xCFCABC, 0.88)
    const matAgua = new THREE.MeshStandardMaterial({ color: 0x7E9AA2, roughness: 0.1, metalness: 0.3 })
    const matCopa = M(0x64705E, 0.96), matCopa2 = M(0x76846C, 0.96), matTronco = M(0x8A7F72, 0.9)
    const matPadel = M(0x62806F, 0.95), matSeto = M(0x7C8A70, 0.97)
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x93A0A6, roughness: 0.18, metalness: 0.36, transparent: true, opacity: 0.58 })
    matAsf.side = THREE.DoubleSide
    matAcera.side = THREE.DoubleSide
    void matCasa

    const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, sh = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      if (sh) { m.castShadow = true; m.receiveShadow = true }
      return m
    }

    // ── terreno con dos lecturas de color: paisaje e hipsométrica
    const seg = this.movil ? [140, 132] : [200, 188]
    const tg = new THREE.PlaneGeometry(1600, 1500, seg[0], seg[1])
    tg.rotateX(-Math.PI / 2)
    const pos = tg.attributes.position
    const tb: number[] = [], cl: number[] = [], ch: number[] = []
    for (let i = 0; i < pos.count; i++) tb.push(h0(pos.getX(i), pos.getZ(i)))
    const base = new THREE.Color(0xC8CCBC), verde = new THREE.Color(0x93A183), roca = new THREE.Color(0xC4BFB0)
    const cLo = new THREE.Color(0xDCDED2), cHi = new THREE.Color(0x8A6220)
    const tmp = new THREE.Color(), tmp2 = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const vg = Math.exp(-sq(vaguada(x, z)) / 2200)
      const alto = Math.max(0, Math.min(1, (tb[i] - 12) / 14))
      tmp.copy(base).lerp(verde, Math.min(1, vg * 1.15)).lerp(roca, alto * 0.7)
      const sh = Math.min(0.28, grad(x, z) * 1.5)
      tmp.multiplyScalar(1 - sh)
      cl.push(tmp.r, tmp.g, tmp.b)
      const t = Math.round(Math.max(0, Math.min(1, (tb[i] + 30) / 58)) * 11) / 11
      tmp2.copy(cLo).lerp(cHi, t)
      ch.push(tmp2.r, tmp2.g, tmp2.b)
    }
    this.attrPaisaje = new THREE.Float32BufferAttribute(cl, 3)
    this.attrHipso = new THREE.Float32BufferAttribute(ch, 3)
    tg.setAttribute('color', this.attrPaisaje)
    const matTerr = M(0xFFFFFF, 0.98)
    matTerr.vertexColors = true
    this.terrGeo = tg
    this.terrBase = tb
    const terreno = new THREE.Mesh(tg, matTerr)
    terreno.receiveShadow = true
    this.scene.add(terreno)

    // ── viario: avenida con mediana + cornisas + rinconadas
    const AV = VIAS.AV
    this.cinta(AV.pts, 15.5, 0.34, matAcera)
    this.cinta(off(AV.pts, 6.2), 4.4, 0.42, matAsf)
    this.cinta(off(AV.pts, -6.2), 4.4, 0.42, matAsf)
    ;(['C1', 'C2', 'C3', 'P1', 'P2'] as const).forEach((id) => {
      const v = VIAS[id]
      this.cinta(v.pts, v.w + 2.6, 0.34, matAcera)
      this.cinta(v.pts, v.w, 0.42, matAsf)
      if (!v.tip) return
      const t = v.tip
      const ap = (e: number, r: number): [number, number][] => [[t[0] - e, t[1] - r], [t[0] + e, t[1] - r], [t[0] + e, t[1] + r], [t[0] - e, t[1] + r]]
      const bordillo = new THREE.Mesh(this.prisma(ap(13.4, 11.4), 0.34), matAcera)
      this.scene.add(bordillo)
      this.follow.push({ o: bordillo, h: h0(t[0], t[1]), off: 0.34 })
      const giro = new THREE.Mesh(this.prisma(ap(10.6, 8.6), 0.42), matAsf)
      this.scene.add(giro)
      this.follow.push({ o: giro, h: h0(t[0], t[1]), off: 0.44 })
    })

    // ── parcelas
    // el volumen baja muy por debajo de la rasante: la caja corta el terreno
    // natural y sólo asoma lo que la ladera deja ver
    const PROF = 44
    this.units.forEach((u) => {
      let topY = -1e9
      u.poly.forEach((p) => { const h = h0(p[0], p[1]); if (h > topY) topY = h })
      topY += 0.5
      const fillM = new THREE.MeshStandardMaterial({
        color: 0x3D8B5F, emissive: 0x3D8B5F, emissiveIntensity: 0.28,
        roughness: 0.38, transparent: true, opacity: 0.44, depthWrite: false,
      })
      const geo = this.prismaBajo(u.poly, PROF)
      const vol = new THREE.Mesh(geo, fillM)
      vol.userData.id = u.id
      this.scene.add(vol)
      this.unitMeshes.push(vol)
      this.follow.push({ o: vol, h: topY, off: 1.1 - PROF })

      const edgeM = new THREE.LineBasicMaterial({ color: 0x3D8B5F, transparent: true, opacity: 0.8 })
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeM)
      this.scene.add(edges)
      this.follow.push({ o: edges, h: topY, off: 1.1 - PROF })

      this.vis[u.id] = { fillM, edgeM, oFill: 0.4, oEdge: 0.78, oEm: 0.26, padY: topY }
    })

    // ── conjunto de amenidades en la cabecera de la avenida
    const cx = -110, cz = -186
    const club = new THREE.Group()
    club.add(box(matAcera, 74, 0.4, 34, 0, 0.2, 30, false))
    club.add(box(matSeto, 22, 1.1, 8, 0, 0.75, 30))
    club.add(box(matClub, 52, 4.8, 15, 0, 2.4, 0))
    club.add(box(matTecho, 58, 0.55, 19, 0, 5.1, 0))
    for (let i = 0; i < 11; i++) club.add(box(matClub, 0.55, 4.6, 0.55, -26 + i * 5.2, 2.3, 8.6))
    club.add(box(matGlass, 48, 3.4, 0.3, 0, 2, 7.2, false))
    club.add(box(matClub, 20, 4.2, 13, -40, 2.1, -16))
    club.add(box(matTecho, 24, 0.5, 17, -40, 4.45, -16))
    club.add(box(matGlass, 0.3, 3, 12, -29.7, 1.9, -16, false))
    club.add(box(matPiedra, 44, 0.5, 24, 8, 0.25, -18, false))
    club.add(box(matAgua, 30, 0.5, 10, 8, 0.42, -18, false))
    ;[[38, 10], [38, -14]].forEach((p) => {
      club.add(box(matPadel, 10, 0.3, 20, p[0], 0.16, p[1], false))
      club.add(box(matAcera, 10.8, 0.34, 0.3, p[0], 0.32, p[1] - 10, false))
      club.add(box(matAcera, 10.8, 0.34, 0.3, p[0], 0.32, p[1] + 10, false))
    })
    club.add(box(matPadel, 23, 0.3, 11, -6, 0.16, -44, false))
    club.position.set(cx, 0, cz)
    this.scene.add(club)
    this.follow.push({ o: club, h: h0(cx, cz), off: 0.5 })

    // ── control de acceso
    const acc = new THREE.Group()
    acc.add(box(matPiedra, 30, 1.4, 1.2, -17, 0.7, 0))
    acc.add(box(matPiedra, 22, 1.4, 1.2, 19, 0.7, 6))
    acc.add(box(matClub, 8, 3.4, 6, -12, 1.7, 10))
    acc.add(box(matTecho, 30, 0.5, 9, 0, 3.65, 10))
    acc.add(box(matAgua, 16, 0.4, 4.4, 14, 0.3, -6, false))
    acc.add(box(matPiedra, 18, 0.6, 6, 14, 0.2, -6, false))
    acc.position.set(148, 0, 198)
    this.scene.add(acc)
    this.follow.push({ o: acc, h: h0(148, 198), off: 0.4 })

    // ── mirador en la isla de la rinconada alta
    const mir = new THREE.Group()
    mir.add(box(matPiedra, 22, 0.5, 16, 0, 0.25, 0, false))
    mir.add(box(matPiedra, 22, 1.1, 1, 0, 0.75, -8))
    for (let i = 0; i < 3; i++) mir.add(box(matClub, 3.4, 0.45, 0.7, -7 + i * 7, 0.7, -5.4))
    mir.rotation.y = -0.5
    mir.position.set(-206, 0, -122)
    this.scene.add(mir)
    this.follow.push({ o: mir, h: h0(-206, -122), off: 0.4 })

    // ── arbolado (instanciado)
    const plantar = (x: number, z: number, s: number, tipo: 'enc' | 'con') => {
      this.arboles.push({ x, z, s, tipo, h: h0(x, z) })
    }
    // alineación procesional en la avenida
    AV.pts.forEach((p, i) => {
      if (i % 4 !== 0) return
      ;[1, -1].forEach((l) => {
        const o = off(AV.pts, l * 13)[i]
        plantar(o[0], o[1], 0.9 + hash('av' + i + l) * 0.25, 'con')
      })
      if (i % 8 === 0) { const m = off(AV.pts, 0)[i]; plantar(m[0], m[1], 0.7, 'enc') }
    })
    // encinar en la vaguada preservada
    for (let i = 0; i < 60; i++) {
      const a = -170 + hash('vgA' + i) * 400
      const o = (hash('vgB' + i) - 0.5) * 76
      const x = 42 + 0.55 * a + 0.83 * o, z = 161 + 0.83 * a - 0.55 * o
      if (Math.abs(x) > 220 || z > 210 || z < -215) continue
      plantar(x, z, 0.8 + hash('vgC' + i) * 0.7, 'enc')
    }
    // masa perimetral
    for (let i = 0; i < 40; i++) {
      const a = hash('pm' + i) * Math.PI * 2, r = 250 + hash('pn' + i) * 90
      plantar(Math.cos(a) * r - 10, Math.sin(a) * r * 0.92 - 10, 1 + hash('po' + i) * 0.6, hash('pp' + i) < 0.5 ? 'enc' : 'con')
    }
    // bosquete del club
    for (let i = 0; i < 12; i++) plantar(cx - 66 + (i % 4) * 9, cz + 6 + Math.floor(i / 4) * 10, 0.85, 'enc')

    const copaG = new THREE.ConeGeometry(1, 1, 7)
    const esfG = new THREE.SphereGeometry(1, 8, 6)
    const tronG = new THREE.CylinderGeometry(0.24, 0.34, 1, 5)
    const nEnc = this.arboles.filter((a) => a.tipo === 'enc').length
    const nCon = this.arboles.length - nEnc
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, tipo: 'enc' | 'con', parte: 'tronco' | 'copa') => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n))
      m.castShadow = true
      m.receiveShadow = parte === 'copa'
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.scene.add(m)
      this.instancias.push({ mesh: m, tipo, parte })
      return m
    }
    inst(tronG, matTronco, nEnc, 'enc', 'tronco')
    inst(esfG, matCopa2, nEnc, 'enc', 'copa')
    inst(tronG, matTronco, nCon, 'con', 'tronco')
    inst(copaG, matCopa, nCon, 'con', 'copa')
  }

  private shapeDe(poly: [number, number][]) {
    const s = new THREE.Shape()
    poly.forEach((p, i) => { if (i === 0) s.moveTo(p[0], -p[1]); else s.lineTo(p[0], -p[1]) })
    s.closePath()
    return s
  }

  private prisma(poly: [number, number][], h: number) {
    const g = new THREE.ExtrudeGeometry(this.shapeDe(poly), { depth: h, bevelEnabled: false, curveSegments: 1 })
    g.rotateX(-Math.PI / 2); g.translate(0, h, 0)
    return g
  }

  private prismaBajo(poly: [number, number][], h: number) {
    const g = new THREE.ExtrudeGeometry(this.shapeDe(poly), { depth: h, bevelEnabled: false, curveSegments: 1 })
    g.rotateX(-Math.PI / 2)
    return g
  }

  /** Superficie de calzada/acera que se pega al terreno vértice a vértice. */
  private cinta(pts: [number, number][], hw: number, yOff: number, mat: THREE.Material) {
    const L = off(pts, hw), R = off(pts, -hw)
    const n = pts.length, v: number[] = [], idx: number[] = [], base: number[] = []
    for (let i = 0; i < n; i++) {
      v.push(L[i][0], 0, L[i][1]); base.push(h0(L[i][0], L[i][1]))
      v.push(R[i][0], 0, R[i][1]); base.push(h0(R[i][0], R[i][1]))
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = (i + 1) * 2
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    g.setIndex(idx)
    const m = new THREE.Mesh(g, mat)
    m.receiveShadow = true
    this.scene.add(m)
    const c: Cinta = { g, base, off: yOff }
    this.cintas.push(c)
    this.actualizaCinta(c)
    return m
  }

  private actualizaCinta(c: Cinta) {
    const p = c.g.attributes.position as THREE.BufferAttribute
    const k = this.exag
    for (let i = 0; i < c.base.length; i++) p.setY(i, c.base[i] * k + c.off)
    p.needsUpdate = true
    c.g.computeVertexNormals()
  }

  private aplicaExag() {
    const k = this.exag
    const p = this.terrGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setY(i, this.terrBase[i] * k)
    p.needsUpdate = true
    this.terrGeo.computeVertexNormals()
    this.follow.forEach((f) => { f.o.position.y = f.h * k + f.off })
    this.cintas.forEach((c) => this.actualizaCinta(c))
    this.colocaArboles()
  }

  private colocaArboles() {
    const k = this.exag
    const m4 = new THREE.Matrix4()
    this.instancias.forEach(({ mesh, tipo, parte }) => {
      let i = 0
      this.arboles.forEach((a) => {
        if (a.tipo !== tipo) return
        const y = a.h * k
        if (parte === 'tronco') {
          m4.makeScale(1, 2.8 * a.s, 1)
          m4.setPosition(a.x, y + 1.4 * a.s, a.z)
        } else if (tipo === 'enc') {
          m4.makeScale(3.4 * a.s, 2.6 * a.s, 3.4 * a.s)
          m4.setPosition(a.x, y + 2.8 * a.s + 2.2 * a.s, a.z)
        } else {
          m4.makeScale(2.1 * a.s, 6.4 * a.s, 2.1 * a.s)
          m4.setPosition(a.x, y + 2.8 * a.s + 3.2 * a.s, a.z)
        }
        mesh.setMatrixAt(i++, m4)
      })
      mesh.count = i
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }

  /* ── Color por modo de lectura ────────────────────────────────────── */

  private lerpC(a: string, b: string, t: number) {
    return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)))
  }

  /** Sube saturación y luminosidad: el código de color tiene que cantar en 3D. */
  private vivo(c: THREE.Color) {
    const h = { h: 0, s: 0, l: 0 }
    c.getHSL(h)
    c.setHSL(h.h, Math.min(1, h.s * 1.6 + 0.12), Math.min(0.68, h.l * 1.14 + 0.06))
    return c
  }

  private applyModo(modo: ModoId) {
    this.modo = modo
    this.terrGeo.setAttribute('color', modo === 'topografia' ? this.attrHipso : this.attrPaisaje)
    this.terrGeo.attributes.color.needsUpdate = true

    const ps = this.units.map((u) => u.pm2)
    const pmin = Math.min.apply(null, ps), pmax = Math.max.apply(null, ps)
    this.units.forEach((u) => {
      let c: THREE.Color
      if (modo === 'etapas') c = new THREE.Color(ETAPAS[u.etapa].color)
      else if (modo === 'caracter') c = new THREE.Color(TIPOS[u.tipo].color)
      else if (modo === 'topografia') c = this.lerpC('#DCDED2', '#8A6220', u.rel)
      else if (modo === 'precio') c = this.lerpC('#D2CFC6', '#D85A30', (u.pm2 - pmin) / Math.max(1, pmax - pmin))
      else c = new THREE.Color(ESTADOS[u.estado].color)
      c = this.vivo(c)
      const v = this.vis[u.id]
      v.fillM.color.copy(c)
      v.fillM.emissive.copy(c)
      v.edgeM.color.copy(c)
    })
  }

  /* ── API pública ──────────────────────────────────────────────────── */

  /**
   * En vertical el encuadre horizontal manda: con el mismo radio el trazado
   * queda diminuto y con medio fotograma de cielo. Se acerca la cámara.
   */
  private acerca(p: Partial<POV>): Partial<POV> {
    if (!this.movil || p.rad == null) return p
    return { ...p, rad: p.rad * 0.74 }
  }

  setModo(modo: ModoId) {
    this.applyModo(modo)
    const pov = POV_MODO[modo]
    if (pov) this.flyTo(this.acerca(pov))
  }

  /** `v` es la exageración en décimas (10 = 1,0×), como el slider de la UI. */
  setExag(v: number) {
    this.exag = v / 10
    this.aplicaExag()
  }

  setSol(v: number) { this.sol = v }

  setFiltro(fn: (u: Parcela) => boolean) { this.filtro = fn }

  setSel(id: string | null) {
    this.selId = id
    if (!id) return
    const u = this.byId[id]
    if (!u) return
    const L = Math.hypot(u.x, u.z) || 1
    this.flyTo({
      az: Math.atan2(u.x / L, u.z / L), pol: 0.92,
      rad: this.movil ? 200 : 150,
      tx: u.x, ty: this.vis[id].padY * this.exag + 6, tz: u.z,
    }, 1200)
  }

  /** Repinta materiales tras un cambio de estado o de lista de precios. */
  refrescar() { this.applyModo(this.modo) }

  /** Vuelve al encuadre exacto del render de firma. */
  vistaFirma() { this.flyTo(this.acerca(POV_FIRMA), 1100) }

  /** Planta la cámara en el POV del render, sin animación: la placa lo tapa. */
  posarEnFirma() {
    const inicio = { ...POV_FIRMA, ...this.acerca(POV_FIRMA) }
    Object.assign(this.cam, inicio)
    Object.assign(this.camT, inicio)
    this.tween = null
    this.applyCam()
  }

  /** Deriva lenta desde el POV de firma, que es lo que descubre la maqueta. */
  derivar(dur = 2200) { this.flyTo(this.acerca(POV_DERIVA), dur) }

  /** La consola tapa el visor: se para el bucle para no gastar batería. */
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
    this.camera.fov = W / H < 1 ? 46 : 32
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
      this.camT.rad = Math.max(90, Math.min(1300, this.camT.rad * (this.pinch / Math.max(1, d))))
      this.pinch = d
      this.tween = null
      return
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y
      this.drag.moved += Math.abs(dx) + Math.abs(dy)
      this.drag.x = e.clientX; this.drag.y = e.clientY
      this.camT.az -= dx * 0.0052
      this.camT.pol = Math.max(0.14, Math.min(1.40, this.camT.pol - dy * 0.0042))
      this.tween = null
      return
    }
    // el hover con dedo no existe: en táctil sólo cuenta el tap
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
    this.camT.rad = Math.max(90, Math.min(1300, this.camT.rad * (1 + e.deltaY * 0.0012)))
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
      let f = conj ? 0.05 : 0.4, ed = conj ? 0.16 : 0.78, em = 0.26
      const ok = this.filtro(u)
      if (!ok) { f = 0.02; ed = 0.06; em = 0 }
      else if (u.id === this.selId) { f = 0.78; ed = 1; em = 0.8 + pulso * 0.5 }
      else if (this.selId) { f *= 0.36; ed *= 0.3; em = 0.08 }
      if (ok && u.id === this.hoverId && u.id !== this.selId) { f = 0.74; ed = 1; em = 0.95 }
      v.oFill += (f - v.oFill) * 0.16
      v.oEdge += (ed - v.oEdge) * 0.16
      v.oEm += (em - v.oEm) * 0.18
      v.fillM.opacity = v.oFill
      v.edgeM.opacity = v.oEdge
      v.fillM.emissiveIntensity = v.oEm
    })

    const a = (this.sol / 1000) * Math.PI * 1.06 - Math.PI * 0.03
    const el = Math.max(0.1, Math.sin(a))
    this.sun.position.set(Math.cos(a) * 460, 90 + el * 520, 240 + Math.cos(a) * 120)
    this.sun.intensity = 0.5 + el * 0.85

    if (this.needHover && !this.drag) {
      this.needHover = false
      const id = this.pick()
      if (id !== this.hoverId) { this.hoverId = id; this.onHover(id) }
    }

    if (this.labelEl) {
      const u = this.hoverId ? this.byId[this.hoverId] : null
      if (u) {
        this.v3.set(u.x, this.vis[u.id].padY * this.exag + 7, u.z).project(this.camera)
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

/** Estado comercial → color, para pintar chips fuera del canvas. */
export const colorEstado = (e: EstadoId) => ESTADOS[e].color

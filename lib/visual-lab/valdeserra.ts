/**
 * FP Visual Lab — Showroom de suelo (Valdeserra, Colmenar Viejo)
 *
 * Modelo puro: geometría del trazado, generación de parcelas sobre la ladera,
 * motor de precio y formateadores. Sin React y sin three.js a propósito — la
 * escena 3D (`components/team/visual-lab/escena.ts`) y las pantallas consumen
 * esto, no al revés.
 *
 * Port del artefacto `FP Urbanizacion.dc.html` (Claude Design). La lógica de
 * negocio se conserva tal cual; lo que cambia es la paleta, que aquí es la de
 * la plataforma interna de Forma Prima.
 */

export type Pt = [number, number]

export type TipoId = 'MIRADOR' | 'CORNISA' | 'LINDE' | 'PLAZUELA' | 'ENCINAR'
export type EstadoId = 'disponible' | 'opcion' | 'reservado' | 'vendido' | 'muestra'
export type ViaId = 'AV' | 'C1' | 'C2' | 'C3' | 'P1' | 'P2'
export type EtapaId = 1 | 2 | 3
export type ModoId = 'disponibilidad' | 'caracter' | 'etapas' | 'topografia' | 'precio' | 'conjunto'

import { C, hash, eur, mm, num, dec } from './ui'
export { C, hash, eur, mm, num, dec }

export const TIPOS: Record<TipoId, { label: string; color: string }> = {
  MIRADOR: { label: 'Mirador', color: C.plum },
  CORNISA: { label: 'Cornisa', color: C.gold },
  LINDE: { label: 'Linde verde', color: C.green },
  PLAZUELA: { label: 'Rinconada', color: C.blue },
  ENCINAR: { label: 'Encinar', color: C.grey },
}

export const ESTADOS: Record<EstadoId, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: C.green },
  opcion: { label: 'En opción', color: C.blue },
  reservado: { label: 'Reservada', color: C.accent },
  vendido: { label: 'Vendida', color: C.grey },
  muestra: { label: 'Villa muestra', color: C.plum },
}

export const ETAPAS: Record<EtapaId, { label: string; color: string; f: number; estado: string }> = {
  1: { label: 'Fase I', color: '#8A8A84', f: 0.92, estado: 'Urbanizada' },
  2: { label: 'Fase II', color: C.accent, f: 1.0, estado: 'En obra' },
  3: { label: 'Fase III', color: C.plum, f: 1.14, estado: 'Proyecto' },
}

/** Palancas del motor de precio. `base` en €/m² de suelo, el resto en %. */
export interface Palancas {
  base: number
  vista: number
  mirador: number
  cornisa: number
  linde: number
  plazuela: number
  pend: number
}

export const PALANCAS_BASE: Palancas = {
  base: 780, vista: 24, mirador: 26, cornisa: 16, linde: 12, plazuela: 10, pend: 8,
}

export interface Parcela {
  id: string
  etapa: EtapaId
  tipo: TipoId
  via: ViaId
  poly: Pt[]
  /** centroide en coordenadas de escena */
  x: number
  z: number
  sup: number
  frente: number
  fondo: number
  /** cota relativa a la parcela más baja, en metros */
  cota: number
  /** posición relativa en el desnivel, 0..1 */
  rel: number
  pend: number
  rot: number
  orient: string
  plat: number
  pm2: number
  precio: number
  precioLista: number
  estado: EstadoId
}

export interface Via {
  label: string
  tipo: string
  w: number
  med?: boolean
  tip?: Pt
  pts: Pt[]
}

/* ── Utilidades numéricas ─────────────────────────────────────────────── */

const sq = (v: number) => v * v

/** Ladera continua NO→SE con hombro y una vaguada preservada. */
export function h0(x: number, z: number): number {
  const s = 0.55 * x + 0.83 * z
  let h = -0.108 * s
  h += 5.5 * Math.exp(-(sq(x + 30) / 26000 + sq(z + 30) / 32000))
  const perp = 0.83 * (x - 42) - 0.55 * (z - 161)
  h -= 5.2 * Math.exp(-sq(perp) / 1100)
  h += 1.3 * Math.sin(x * 0.021) * Math.cos(z * 0.017)
  return h
}

/** Distancia a la línea de máxima pendiente donde se preserva el encinar. */
export function vaguada(x: number, z: number): number {
  return Math.abs(0.83 * (x - 42) - 0.55 * (z - 161))
}

export function grad(x: number, z: number): number {
  const d = 4
  const gx = (h0(x + d, z) - h0(x - d, z)) / (2 * d)
  const gz = (h0(x, z + d) - h0(x, z - d)) / (2 * d)
  return Math.hypot(gx, gz)
}

/** Catmull-Rom: convierte los puntos de control del viario en una curva suave. */
export function cr(pts: Pt[], n: number): Pt[] {
  const out: Pt[] = []
  const m = pts.length
  const P = (i: number) => pts[Math.max(0, Math.min(m - 1, i))]
  for (let s = 0; s < m - 1; s++) {
    const a = P(s - 1), b = P(s), c = P(s + 1), d = P(s + 2)
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t
      out.push([
        0.5 * (2 * b[0] + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3),
        0.5 * (2 * b[1] + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3),
      ])
    }
  }
  out.push(pts[m - 1])
  return out
}

/** Paralela a una polilínea a distancia `d` (signo = lado). */
export function off(pts: Pt[], d: number): Pt[] {
  const n = pts.length, out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]
    let tx = b[0] - a[0], tz = b[1] - a[1]
    const L = Math.hypot(tx, tz) || 1
    tx /= L; tz /= L
    out.push([pts[i][0] - tz * d, pts[i][1] + tx * d])
  }
  return out
}

export function area(p: Pt[]): number {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]
    a += p[i][0] * q[1] - q[0] * p[i][1]
  }
  return Math.abs(a) / 2
}

export function cent(p: Pt[]): Pt {
  let x = 0, z = 0
  p.forEach((q) => { x += q[0]; z += q[1] })
  return [x / p.length, z / p.length]
}

function compas(a: number): string {
  const d = ((a * 180 / Math.PI) + 360) % 360
  const n = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste']
  return n[Math.round(d / 45) % 8]
}

/* ── Trazado ──────────────────────────────────────────────────────────── */

export const VIAS: Record<ViaId, Via> = {
  AV: {
    label: 'Avenida de Valdeserra', tipo: 'eje', w: 5.2, med: true,
    pts: cr([[150, 200], [136, 176], [118, 150], [104, 126], [80, 84], [56, 44], [38, 14], [10, -30], [-14, -68], [-38, -108], [-72, -146], [-104, -178]], 7),
  },
  C1: {
    label: 'Cornisa Baja', tipo: 'cornisa', w: 3.4,
    pts: cr([[-38, 193], [12, 176], [62, 152], [110, 124], [150, 90], [164, 68]], 9),
  },
  C2: {
    label: 'Cornisa Media', tipo: 'cornisa', w: 3.4,
    pts: cr([[-116, 84], [-66, 66], [-14, 42], [38, 14], [86, -20], [112, -44]], 9),
  },
  C3: {
    label: 'Cornisa Alta', tipo: 'cornisa', w: 3.4,
    pts: cr([[-152, -38], [-116, -56], [-78, -80], [-38, -108], [-2, -134], [18, -150]], 9),
  },
  P1: {
    label: 'Rinconada del Encinar', tipo: 'rinconada', w: 3.0, tip: [150, -108],
    pts: cr([[112, -44], [138, -60], [156, -84], [150, -108]], 9),
  },
  P2: {
    label: 'Rinconada del Mirador', tipo: 'rinconada', w: 3.0, tip: [-190, -106],
    pts: cr([[-152, -38], [-176, -56], [-192, -82], [-190, -106]], 9),
  },
}

type Clase = 'valle' | 'monte' | 'alta' | 'plaza'

interface Banda {
  via: ViaId; lado: 1 | -1; off: number; fondo: number
  t0: number; t1: number; n: number; etapa: EtapaId; clase: Clase
  linde?: 'ini' | 'fin'
}

/** Rangos de estación disjuntos, con huecos en la vaguada y en el cruce de la avenida. */
const BANDAS: Banda[] = [
  { via: 'C1', lado: 1, off: 8, fondo: 44, t0: 0.05, t1: 0.26, n: 2, etapa: 1, clase: 'valle', linde: 'fin' },
  { via: 'C1', lado: 1, off: 8, fondo: 44, t0: 0.38, t1: 0.54, n: 2, etapa: 1, clase: 'valle', linde: 'ini' },
  { via: 'C1', lado: 1, off: 8, fondo: 44, t0: 0.68, t1: 0.94, n: 2, etapa: 1, clase: 'valle' },
  { via: 'C1', lado: -1, off: 8, fondo: 32, t0: 0.06, t1: 0.26, n: 2, etapa: 1, clase: 'monte', linde: 'fin' },
  { via: 'C1', lado: -1, off: 8, fondo: 32, t0: 0.38, t1: 0.54, n: 2, etapa: 1, clase: 'monte', linde: 'ini' },
  { via: 'C1', lado: -1, off: 8, fondo: 32, t0: 0.68, t1: 0.92, n: 2, etapa: 1, clase: 'monte' },
  { via: 'C2', lado: 1, off: 8, fondo: 48, t0: 0.05, t1: 0.26, n: 2, etapa: 2, clase: 'valle', linde: 'fin' },
  { via: 'C2', lado: 1, off: 8, fondo: 48, t0: 0.38, t1: 0.54, n: 2, etapa: 2, clase: 'valle', linde: 'ini' },
  { via: 'C2', lado: 1, off: 8, fondo: 48, t0: 0.68, t1: 0.94, n: 2, etapa: 2, clase: 'valle' },
  { via: 'C2', lado: -1, off: 8, fondo: 32, t0: 0.08, t1: 0.26, n: 2, etapa: 2, clase: 'monte', linde: 'fin' },
  { via: 'C2', lado: -1, off: 8, fondo: 32, t0: 0.38, t1: 0.54, n: 2, etapa: 2, clase: 'monte', linde: 'ini' },
  { via: 'C3', lado: 1, off: 8, fondo: 50, t0: 0.05, t1: 0.26, n: 2, etapa: 3, clase: 'alta', linde: 'fin' },
  { via: 'C3', lado: 1, off: 8, fondo: 50, t0: 0.38, t1: 0.54, n: 2, etapa: 3, clase: 'alta', linde: 'ini' },
  { via: 'C3', lado: 1, off: 8, fondo: 50, t0: 0.68, t1: 0.92, n: 2, etapa: 3, clase: 'alta' },
  { via: 'C3', lado: -1, off: 8, fondo: 28, t0: 0.08, t1: 0.26, n: 2, etapa: 3, clase: 'monte', linde: 'fin' },
  { via: 'C3', lado: -1, off: 8, fondo: 28, t0: 0.40, t1: 0.54, n: 1, etapa: 3, clase: 'monte' },
  { via: 'P1', lado: 1, off: 9, fondo: 36, t0: 0.08, t1: 0.94, n: 4, etapa: 2, clase: 'plaza' },
  { via: 'P2', lado: -1, off: 9, fondo: 36, t0: 0.08, t1: 0.94, n: 4, etapa: 3, clase: 'alta' },
]

interface PolyBanda { poly: Pt[]; f0: Pt; f1: Pt; idx: number; ult: boolean }

function banda(b: Banda, key: string): PolyBanda[] {
  const via = VIAS[b.via]
  const front = off(via.pts, b.lado * b.off)
  const back = off(via.pts, b.lado * (b.off + b.fondo))
  const L = front.length, total = L - 1, out: PolyBanda[] = []
  const paso = (b.t1 - b.t0) * total / b.n
  const est = (k: number) => {
    let t = (b.t0 + (b.t1 - b.t0) * (k / b.n)) * total
    if (k > 0 && k < b.n) t += (hash(key + 'j' + k) - 0.5) * paso * 0.40
    return t
  }
  const sample = (arr: Pt[], t: number): Pt => {
    const i = Math.min(L - 2, Math.max(0, Math.floor(t))), f = t - i
    const p = arr[i], q = arr[i + 1]
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]
  }
  for (let k = 0; k < b.n; k++) {
    const a = est(k), c = est(k + 1)
    const fs: Pt[] = [], bs: Pt[] = []
    for (let s = 0; s <= 3; s++) {
      const t = a + (c - a) * (s / 3)
      fs.push(sample(front, t)); bs.push(sample(back, t))
    }
    out.push({ poly: fs.concat(bs.slice().reverse()), f0: fs[0], f1: fs[3], idx: k, ult: k === b.n - 1 })
  }
  return out
}

/* ── Motor de precio ──────────────────────────────────────────────────── */

function primaDe(tipo: TipoId, P: Palancas): number {
  if (tipo === 'MIRADOR') return P.mirador / 100
  if (tipo === 'CORNISA') return P.cornisa / 100
  if (tipo === 'LINDE') return P.linde / 100
  if (tipo === 'PLAZUELA') return P.plazuela / 100
  return 0
}

/** €/m² de suelo de una parcela con un juego de palancas dado. */
export function pm2Con(u: Pick<Parcela, 'sup' | 'etapa' | 'rel' | 'tipo' | 'pend'>, P: Palancas): number {
  const tam = Math.pow(1300 / Math.max(500, u.sup), 0.10)
  return Math.round(
    P.base * ETAPAS[u.etapa].f * (1 + (P.vista / 100) * u.rel)
    * (1 + primaDe(u.tipo, P))
    * (1 - (P.pend / 100) * Math.min(1, u.pend / 30)) * tam / 5,
  ) * 5
}

export function precioDe(sup: number, pm2: number): number {
  return Math.round(sup * pm2 / 5000) * 5000
}

/** Estado comercial de partida — determinista por id, con más colocación en Fase I. */
export function estadoDe(u: Pick<Parcela, 'id' | 'etapa'>): EstadoId {
  if (u.id === 'I-03') return 'muestra'
  const r = hash('vs5' + u.id)
  const p = u.etapa === 1 ? 0.66 : u.etapa === 2 ? 0.34 : 0.15
  if (r < p * 0.56) return 'vendido'
  if (r < p * 0.80) return 'reservado'
  if (r < p) return 'opcion'
  return 'disponible'
}

export const colocado = (u: Parcela) => u.estado === 'vendido' || u.estado === 'reservado'

/* ── Generación del conjunto ──────────────────────────────────────────── */

export interface Conjunto {
  units: Parcela[]
  byId: Record<string, Parcela>
  desnivel: number
  suelo: number
  sMin: number
  sMax: number
  pMin: number
  pMax: number
}

export function buildConjunto(P: Palancas = PALANCAS_BASE): Conjunto {
  const bruto: { b: Banda; p: PolyBanda; via: ViaId; etapa: EtapaId; clase: Clase }[] = []
  BANDAS.forEach((b, bi) => {
    banda(b, 'vs' + bi).forEach((p) => {
      bruto.push({ b, p, via: b.via, etapa: b.etapa, clase: b.clase })
    })
  })
  const cotas = bruto.map((r) => { const c = cent(r.p.poly); return h0(c[0], c[1]) })
  const cMin = Math.min.apply(null, cotas), cMax = Math.max.apply(null, cotas)
  const desnivel = Math.round(cMax - cMin)

  const cont: Record<EtapaId, number> = { 1: 0, 2: 0, 3: 0 }
  const pref: Record<EtapaId, string> = { 1: 'I', 2: 'II', 3: 'III' }
  const units: Parcela[] = []

  bruto.forEach((r, i) => {
    const poly = r.p.poly, c = cent(poly), sup = Math.round(area(poly))
    if (sup < 640 || sup > 3200) return
    const cota = cotas[i], rel = (cota - cMin) / Math.max(0.1, cMax - cMin)
    const pend = Math.max(4, Math.min(34, Math.round(grad(c[0], c[1]) * 100)))
    const frente = Math.hypot(r.p.f1[0] - r.p.f0[0], r.p.f1[1] - r.p.f0[1])
    const nx = -(r.p.f1[1] - r.p.f0[1]), nz = r.p.f1[0] - r.p.f0[0], nl = Math.hypot(nx, nz) || 1
    const rot = Math.atan2(c[0] - (r.p.f0[0] + r.p.f1[0]) / 2, c[1] - (r.p.f0[1] + r.p.f1[1]) / 2)
    const bordeVerde = (r.b.linde === 'fin' && r.p.ult) || (r.b.linde === 'ini' && r.p.idx === 0)

    let tipo: TipoId
    if (r.clase === 'alta') tipo = 'MIRADOR'
    else if (r.clase === 'valle') tipo = 'CORNISA'
    else if (r.clase === 'plaza') tipo = 'PLAZUELA'
    else if (bordeVerde) tipo = 'LINDE'
    else tipo = 'ENCINAR'

    const et = r.etapa
    cont[et]++

    const u: Parcela = {
      id: pref[et] + '-' + String(cont[et]).padStart(2, '0'),
      etapa: et, tipo, via: r.via, poly,
      x: c[0], z: c[1], sup,
      frente: Math.round(frente * 10) / 10,
      fondo: Math.round((sup / Math.max(1, frente)) * 10) / 10,
      cota: Math.round((cota - cMin) * 10) / 10,
      rel, pend, rot,
      orient: compas(Math.atan2(nx / nl, nz / nl)),
      plat: Math.round(cota / 1.5) * 1.5,
      pm2: 0, precio: 0, precioLista: 0, estado: 'disponible',
    }
    u.pm2 = pm2Con(u, P)
    u.precio = precioDe(u.sup, u.pm2)
    u.precioLista = u.precio
    u.estado = estadoDe(u)
    units.push(u)
  })

  const byId: Record<string, Parcela> = {}
  units.forEach((u) => { byId[u.id] = u })

  const sups = units.map((u) => u.sup), pre = units.map((u) => u.precio)
  return {
    units, byId, desnivel,
    suelo: units.reduce((a, u) => a + u.sup, 0),
    sMin: Math.floor(Math.min.apply(null, sups) / 25) * 25,
    sMax: Math.ceil(Math.max.apply(null, sups) / 25) * 25,
    pMin: Math.floor(Math.min.apply(null, pre) / 25000) * 25000,
    pMax: Math.ceil(Math.max.apply(null, pre) / 25000) * 25000,
  }
}

/* ── Cotización ───────────────────────────────────────────────────────── */

export interface CotConfig { entrada: number; meses: number; obra: number; cuota: number }
export const COT_BASE: CotConfig = { entrada: 25, meses: 24, obra: 10, cuota: 285 }

export interface Cotizacion {
  cfg: CotConfig
  entrada: number
  apartado: number
  escritura: number
  financiado: number
  mens: number
  iva: number
  notaria: number
  cuota: number
}

export const SENAL_RESERVA = 20000

export function cotizar(u: Parcela, cfg?: Partial<CotConfig>): Cotizacion {
  const c: CotConfig = { ...COT_BASE, ...(cfg || {}) }
  const entrada = u.precio * c.entrada / 100
  const escritura = u.precio * c.obra / 100
  const financiado = u.precio - entrada - escritura
  return {
    cfg: c, entrada, apartado: SENAL_RESERVA, escritura, financiado,
    mens: financiado / c.meses,
    iva: u.precio * 0.21,
    notaria: u.precio * 0.014,
    cuota: c.cuota,
  }
}

/** Siguiente estado del ciclo comercial al pulsar la acción de la ficha. */
export function siguienteEstado(e: EstadoId): EstadoId {
  return e === 'disponible' ? 'opcion' : e === 'opcion' ? 'reservado' : e === 'reservado' ? 'vendido' : 'disponible'
}

export function accionDe(e: EstadoId): string {
  return e === 'disponible' ? 'Poner en opción'
    : e === 'opcion' ? 'Convertir a reserva'
      : e === 'reservado' ? 'Registrar venta' : 'Liberar parcela'
}

/* ── Persistencia local ───────────────────────────────────────────────── */

export const LS_KEY = 'fp.visual-lab.valdeserra.v1'

export interface CotEmitida {
  folio: string
  lote: string
  tipo: string
  sup: string
  precio: string
  mens: string
  fecha: string
}

export interface LogEntry { t: string; txt: string }

export interface EstadoGuardado {
  ov?: Record<string, { precio: number; estado: EstadoId }>
  cots?: CotEmitida[]
  log?: LogEntry[]
}

export function cargarLocal(): EstadoGuardado {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '') || {} } catch { return {} }
}

export function guardarLocal(units: Parcela[], cots: CotEmitida[], log: LogEntry[]) {
  if (typeof window === 'undefined') return
  const ov: NonNullable<EstadoGuardado['ov']> = {}
  units.forEach((u) => {
    if (u.precio !== u.precioLista || u.estado !== estadoDe(u)) ov[u.id] = { precio: u.precio, estado: u.estado }
  })
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ov, cots, log })) } catch { /* cuota llena */ }
}

/* ── Vistas de la ficha ───────────────────────────────────────────────── */

export type FichaTab = 'aereo' | 'plano' | 'vista' | 'villa'

export const FICHA_TABS: { id: FichaTab; label: string }[] = [
  { id: 'aereo', label: 'Aéreo' },
  { id: 'plano', label: 'Plano' },
  { id: 'vista', label: 'Vista' },
  { id: 'villa', label: 'Villa tipo' },
]

export const FICHA_HINT: Record<FichaTab, string> = {
  aereo: 'Ortofoto de la parcela y su cornisa',
  plano: 'Plano topográfico con curvas de nivel',
  vista: 'Fotografía de la vista desde la plataforma',
  villa: 'Villa tipo implantada en la parcela',
}

export const FICHA_CAPTION: Record<FichaTab, string> = {
  aereo: 'Ortofoto · vuelo de obra · fase en curso',
  plano: 'Levantamiento topográfico · curvas cada 0,50 m',
  vista: 'Vista real desde la cota de plataforma',
  villa: 'Anteproyecto orientativo · sujeto a comité de estética',
}

export const MODOS: { id: ModoId; label: string }[] = [
  { id: 'disponibilidad', label: 'Disponibilidad' },
  { id: 'caracter', label: 'Carácter' },
  { id: 'etapas', label: 'Fases' },
  { id: 'topografia', label: 'Topografía' },
  { id: 'precio', label: 'Precio €/m²' },
  { id: 'conjunto', label: 'Conjunto' },
]

/** Parámetros urbanísticos de la ordenanza — iguales para todas las parcelas. */
export function parametrosUrb(u: Parcela) {
  return [
    { k: 'Edificabilidad', v: num(u.sup * 0.32) + ' m²c · 0,32 m²/m²' },
    { k: 'Ocupación máxima', v: '25% · ' + num(u.sup * 0.25) + ' m²' },
    { k: 'Altura máxima', v: 'PB + 1 · 7,00 m' },
    { k: 'Retranqueo frontal', v: '8,00 m' },
    { k: 'Retranqueos laterales', v: '5,00 m' },
    { k: 'Comité de estética', v: 'Proyecto sujeto a aprobación' },
  ]
}

export function planPago(u: Parcela) {
  return [
    { k: 'Señal de reserva', v: eur(SENAL_RESERVA) },
    { k: 'Entrada 25%', v: eur(u.precio * 0.25) },
    { k: '24 mensualidades sin intereses', v: eur(u.precio * 0.65 / 24) },
    { k: 'Pago a escritura 10%', v: eur(u.precio * 0.1) },
    { k: 'Cuota de comunidad y club', v: eur(285) + ' / mes' },
  ]
}

export function datosParcela(u: Parcela) {
  return [
    { k: 'Superficie', v: num(u.sup) + ' m²' },
    { k: 'Frente', v: dec(u.frente) + ' m' },
    { k: 'Fondo medio', v: dec(u.fondo) + ' m' },
    { k: 'Cota', v: '+' + dec(u.cota) + ' m' },
    { k: 'Pendiente', v: u.pend + '%' },
    { k: 'Orientación', v: u.orient },
    { k: 'Vista', v: u.tipo === 'MIRADOR' ? 'Sierra abierta' : u.tipo === 'CORNISA' ? 'Valle sobre cornisa' : 'Encinar' },
    { k: 'Acometidas', v: ETAPAS[u.etapa].estado === 'Proyecto' ? 'En proyecto' : 'En parcela' },
    { k: 'Desmonte', v: u.pend > 18 ? 'Medio' : 'Ligero' },
  ]
}

/**
 * FP Visual Lab — Méndez Álvaro 32 (Madrid, Arganzuela)
 *
 * Modelo puro de la torre: 118 viviendas repartidas en la corona de cada
 * planta, motor de precio por altura/vista/orientación y cotización con
 * hipoteca. Sin React ni three.js.
 *
 * Port de `FP Visual Lab Showroom.dc.html` (Claude Design).
 *
 * La geometría no es un catálogo de cajas: la placa de cada planta se
 * retranquea, se le descuenta el anillo de circulación y el perímetro restante
 * se reparte entre las viviendas por peso de tipología. Las que llegan a una
 * esquina heredan su curvatura, que es lo que hace que la torre se lea redonda.
 */

import { C, hash, eur, mm, num, dec } from './ui'
export { C, hash, eur, mm, num, dec }

export type Pt = [number, number]
export type TipoId = 'A' | 'B' | 'C' | 'D' | 'PH' | 'TH'
export type EstadoId = 'disponible' | 'negociacion' | 'reservada' | 'vendida' | 'piloto'
export type VistaId = 'Parque' | 'Ciudad' | 'Sierra'
export type ModoId = 'conjunto' | 'disponibilidad' | 'plantas' | 'vista' | 'asoleamiento'

export const TIPOS: Record<TipoId, { label: string; dorm: number; banos: number; util: number; ter: number }> = {
  A: { label: 'Tipo A', dorm: 1, banos: 1, util: 62, ter: 8 },
  B: { label: 'Tipo B', dorm: 2, banos: 2, util: 88, ter: 12 },
  C: { label: 'Tipo C', dorm: 3, banos: 2, util: 124, ter: 18 },
  D: { label: 'Tipo D', dorm: 4, banos: 3, util: 178, ter: 42 },
  PH: { label: 'Ático dúplex', dorm: 5, banos: 4, util: 320, ter: 96 },
  TH: { label: 'Townhouse', dorm: 3, banos: 3, util: 165, ter: 45 },
}

export const ESTADOS: Record<EstadoId, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: C.green },
  negociacion: { label: 'En negociación', color: C.blue },
  reservada: { label: 'Reservada', color: C.gold },
  vendida: { label: 'Vendida', color: C.grey },
  piloto: { label: 'Piso piloto', color: C.plum },
}

export interface Palancas {
  /** €/m² útil de partida */
  base: number
  /** Prima acumulativa por planta, en tanto por uno */
  planta: number
  /** Multiplicador del ático */
  atico: number
  vista: Record<VistaId, number>
  orient: Record<string, number>
}

export const PALANCAS_BASE: Palancas = {
  base: 5600,
  planta: 0.009,
  atico: 1.16,
  vista: { Parque: 0.05, Ciudad: 0.11, Sierra: 0.19 },
  orient: { Sur: 0.06, Sureste: 0.05, Suroeste: 0.045, Este: 0.02, Oeste: 0.03, Norte: -0.03, Noreste: -0.02, Noroeste: -0.015 },
}

/** Altura de planta y cota de la primera. Fijan toda la vertical de la torre. */
export const FH = 3.25
export const Y0 = 3.2

export interface Vivienda {
  id: string
  planta: number
  tipo: TipoId
  orient: string
  vista: VistaId
  util: number
  ter: number
  dorm: number
  banos: number
  garaje: number
  x: number
  z: number
  w: number
  d: number
  alto: number
  /** Cota del suelo de la vivienda */
  wy: number
  poly?: Pt[]
  precio: number
  precioLista: number
  estado: EstadoId
}

/* ── Geometría de la corona ───────────────────────────────────────────── */

function ringPts(w: number, d: number, r: number, seg: number): Pt[] {
  const pts: Pt[] = []
  const x = Math.max(0.01, w / 2 - r), z = Math.max(0.01, d / 2 - r)
  ;([[x, z, 0], [-x, z, Math.PI / 2], [-x, -z, Math.PI], [x, -z, -Math.PI / 2]] as const).forEach((c) => {
    for (let i = 0; i <= seg; i++) {
      const a = c[2] + (i / seg) * Math.PI / 2
      pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r])
    }
  })
  return pts
}

/** Re-muestrea un anillo cerrado a `n` puntos equiespaciados en longitud. */
function reSample(pts: Pt[], n: number): Pt[] {
  const m = pts.length, seg: number[] = [], acc: number[] = []
  let L = 0
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % m]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    seg.push(l); L += l; acc.push(L)
  }
  const out: Pt[] = []
  for (let k = 0; k < n; k++) {
    const tt = (k / n) * L
    let i = 0
    while (i < m - 1 && acc[i] < tt) i++
    const prev = i === 0 ? 0 : acc[i - 1]
    const f = seg[i] > 0.0001 ? (tt - prev) / seg[i] : 0
    const a = pts[i], b = pts[(i + 1) % m]
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  return out
}

/** Dimensiones [ancho, fondo, radio de esquina] de la placa de cada planta. */
export function plateFor(p: number): [number, number, number] {
  if (p === 5) return [44, 33, 9]
  if (p <= 13) return [38.2, 26.2, 6.6]
  if (p <= 20) return [32.4, 26.2, 6.6]
  if (p === 21) return [26.6, 23.2, 6.2]
  if (p <= 23) return [22.4, 19.4, 5.8]
  return [17.4, 14.4, 5.4]
}

/** Peso relativo de cada tipología al repartir el perímetro de la corona. */
const PESO: Record<string, number> = { A: 10.4, B: 11.4, C: 13.4, D: 21.4, PH: 20 }

interface Celda { tipo: TipoId; poly: Pt[]; x: number; z: number; frente: number; fondo: number }

function corona(p: number, tipos: TipoId[], prof: number): Celda[] {
  const pl = plateFor(p), fach = 1.15, N = 128
  const ow = pl[0] - fach * 2, od = pl[1] - fach * 2, orr = Math.max(1, pl[2] - fach)
  const iw = Math.max(4, ow - prof * 2), id = Math.max(4, od - prof * 2)
  const ext = reSample(ringPts(ow, od, orr, 8), N)
  const inn = reSample(ringPts(iw, id, Math.max(0.8, orr - prof), 8), N)

  let tot = 0
  tipos.forEach((k) => { tot += PESO[k] })

  const res: Celda[] = []
  let cur = 0, acum = 0
  tipos.forEach((k, j) => {
    acum += PESO[k] / tot
    const i1 = j === tipos.length - 1 ? N : Math.max(cur + 2, Math.round(acum * N))
    const poly: Pt[] = []
    let frente = 0
    for (let i = cur; i <= i1; i++) {
      poly.push(ext[i % N])
      if (i > cur) frente += Math.hypot(ext[i % N][0] - ext[(i - 1) % N][0], ext[i % N][1] - ext[(i - 1) % N][1])
    }
    for (let i = i1; i >= cur; i--) poly.push(inn[i % N])
    let cx = 0, cz = 0
    poly.forEach((q) => { cx += q[0]; cz += q[1] })
    res.push({ tipo: k, poly, x: cx / poly.length, z: cz / poly.length, frente, fondo: prof })
    cur = i1
  })
  return res
}

function compas(x: number, z: number): string {
  const d = ((Math.atan2(x, -z) * 180 / Math.PI) + 360) % 360
  const n = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste']
  return n[Math.round(d / 45) % 8]
}

/* ── Precio y estado ──────────────────────────────────────────────────── */

export function pm2De(u: Pick<Vivienda, 'planta' | 'vista' | 'orient' | 'tipo'>, P: Palancas): number {
  const mult = u.tipo === 'PH' ? 1.24 : u.tipo === 'D' ? 1.12 : u.tipo === 'TH' ? 1.08 : 1
  return P.base * (1 + P.planta * u.planta) * (1 + P.vista[u.vista]) * (1 + (P.orient[u.orient] ?? 0)) * mult
}

export function precioDe(u: Vivienda, P: Palancas): number {
  return Math.round((u.util + u.ter * 0.5) * pm2De(u, P) / 1000) * 1000
}

export function estadoDe(id: string, planta: number): EstadoId {
  if (id === '10B') return 'piloto'
  const r = hash('fpvl1' + id)
  const pv = Math.max(0.12, 0.66 - planta * 0.019)
  if (r < pv * 0.70) return 'vendida'
  if (r < pv * 0.87) return 'reservada'
  if (r < pv) return 'negociacion'
  return 'disponible'
}

export const colocada = (u: Vivienda) => u.estado === 'vendida' || u.estado === 'reservada'

export function plantaLabel(p: number, corto = false): string {
  if (p === 0) return corto ? 'TH' : 'Baja'
  return corto ? 'P' + String(p).padStart(2, '0') : String(p)
}

/* ── Construcción del edificio ────────────────────────────────────────── */

interface Banda { p0: number; p1: number; t: TipoId[]; prof: number }

const BANDAS: Banda[] = [
  { p0: 1, p1: 4, t: ['A', 'B', 'A', 'A', 'B', 'A'], prof: 8.2 },
  { p0: 6, p1: 13, t: ['A', 'B', 'A', 'B', 'B', 'B'], prof: 8.2 },
  { p0: 14, p1: 20, t: ['A', 'B', 'A', 'C', 'C'], prof: 8.6 },
  { p0: 21, p1: 21, t: ['C', 'C', 'D'], prof: 7.8 },
]

/** Planta 5 son amenidades y la 22 los dos áticos: por eso no están en BANDAS. */
export const PLANTAS_MAX = 24

export interface ConjuntoTorre {
  units: Vivienda[]
  byId: Record<string, Vivienda>
  pMin: number
  pMax: number
}

export function buildConjunto(P: Palancas = PALANCAS_BASE): ConjuntoTorre {
  const units: Vivienda[] = []
  const letras = 'ABCDEF'

  const mk = (id: string, planta: number, tipo: TipoId, x: number, z: number, w: number, d: number, orient: string, alto: number, wy: number): Vivienda => {
    const t = TIPOS[tipo]
    const vista: VistaId = planta <= 6 ? 'Parque' : planta <= 15 ? 'Ciudad' : 'Sierra'
    const u: Vivienda = {
      id, planta, tipo, orient, vista,
      util: t.util, ter: t.ter, dorm: t.dorm, banos: t.banos,
      garaje: tipo === 'PH' ? 3 : (tipo === 'TH' || tipo === 'D' ? 2 : 1),
      x, z, w, d, alto, wy,
      precio: 0, precioLista: 0, estado: 'disponible',
    }
    u.precio = precioDe(u, P)
    u.precioLista = u.precio
    u.estado = estadoDe(id, planta)
    return u
  }

  // townhouses al sur del plinto
  ;[-17.5, -10.5, -3.5, 3.5, 10.5, 17.5].forEach((x, i) => {
    units.push(mk('TH' + (i + 1), 0, 'TH', x, 39.5, 6.6, 9, i < 3 ? 'Suroeste' : 'Sureste', 6.4, 3.4))
  })

  BANDAS.forEach((b) => {
    for (let p = b.p0; p <= b.p1; p++) {
      corona(p, b.t, b.prof).forEach((c, i) => {
        const u = mk(p + letras[i], p, c.tipo, c.x, c.z, c.frente, c.fondo, compas(c.x, c.z), 2.95, Y0 + (p - 1) * FH + 1.55)
        u.poly = c.poly
        units.push(u)
      })
    }
  })

  corona(22, ['PH', 'PH'], 7).forEach((c, i) => {
    const u = mk('PH' + (i + 1), 22, 'PH', c.x, c.z, c.frente, c.fondo, compas(c.x, c.z), FH * 2 - 0.5, Y0 + 21 * FH + 1.55)
    u.poly = c.poly
    units.push(u)
  })

  const byId: Record<string, Vivienda> = {}
  units.forEach((u) => { byId[u.id] = u })
  const precios = units.map((u) => u.precio)

  return {
    units, byId,
    pMin: Math.floor(Math.min.apply(null, precios) / 10000) * 10000,
    pMax: Math.ceil(Math.max.apply(null, precios) / 10000) * 10000,
  }
}

/* ── Cotización ───────────────────────────────────────────────────────── */

export interface CotConfig { entrada: number; obra: number; meses: number; anos: number; tipo: number }
export const COT_BASE: CotConfig = { entrada: 20, obra: 10, meses: 18, anos: 25, tipo: 3.2 }
export const RESERVA = 6000

export interface Cotizacion {
  cfg: CotConfig
  precio: number
  iva: number
  ajd: number
  gastos: number
  total: number
  reserva: number
  contrato: number
  durante: number
  mensualObra: number
  entrega: number
  cuota: number
}

export function cotizar(u: Vivienda, cfg?: Partial<CotConfig>): Cotizacion {
  const c: CotConfig = { ...COT_BASE, ...(cfg || {}) }
  const precio = u.precio
  const iva = precio * 0.10, ajd = precio * 0.015, gastos = precio * 0.012
  const contrato = precio * (c.entrada / 100) - RESERVA
  const durante = precio * (c.obra / 100)
  const entrega = precio * (1 - (c.entrada + c.obra) / 100)
  // cuota francesa sobre el capital que queda a la entrega
  const i = c.tipo / 100 / 12, n = c.anos * 12
  const cuota = i > 0 ? entrega * i / (1 - Math.pow(1 + i, -n)) : entrega / n
  return {
    cfg: c, precio, iva, ajd, gastos, total: precio + iva + ajd + gastos,
    reserva: RESERVA, contrato, durante, mensualObra: durante / c.meses, entrega, cuota,
  }
}

export function siguienteEstado(e: EstadoId): EstadoId {
  return e === 'disponible' ? 'negociacion'
    : e === 'negociacion' ? 'reservada'
      : e === 'reservada' ? 'vendida' : 'disponible'
}

export function accionDe(e: EstadoId): string {
  return e === 'disponible' ? 'Marcar en negociación'
    : e === 'negociacion' ? 'Reservar vivienda'
      : e === 'reservada' ? 'Registrar venta' : 'Liberar vivienda'
}

/* ── Persistencia local ───────────────────────────────────────────────── */

export const LS_KEY = 'fp.visual-lab.mendez.v1'

export interface CotEmitida {
  folio: string; id: string; cliente: string
  precio: string; total: string; fecha: string
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

export function guardarLocal(units: Vivienda[], cots: CotEmitida[], log: LogEntry[]) {
  if (typeof window === 'undefined') return
  const ov: NonNullable<EstadoGuardado['ov']> = {}
  units.forEach((u) => {
    if (u.precio !== u.precioLista || u.estado !== estadoDe(u.id, u.planta)) {
      ov[u.id] = { precio: u.precio, estado: u.estado }
    }
  })
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ov, cots, log })) } catch { /* cuota llena */ }
}

/* ── Vistas de la ficha ───────────────────────────────────────────────── */

export type FichaTab = 'plano' | 'render' | 'tour' | 'video'

export const FICHA_TABS: { id: FichaTab; label: string }[] = [
  { id: 'plano', label: 'Plano' },
  { id: 'render', label: 'Render' },
  { id: 'tour', label: 'Recorrido' },
  { id: 'video', label: 'Vídeo' },
]

export const FICHA_HINT: Record<FichaTab, string> = {
  plano: 'Plano de distribución de la tipología',
  render: 'Render de salón de la tipología',
  tour: 'Panorama 360° del recorrido virtual',
  video: 'Frame del vídeo comercial',
}

export function fichaCaption(tab: FichaTab, tipo: TipoId): string {
  const t = TIPOS[tipo].label
  return tab === 'plano' ? `Plano de distribución · ${t}`
    : tab === 'render' ? `Render de salón · ${t}`
      : tab === 'tour' ? `Recorrido virtual 360° · ${t}`
        : 'Vídeo comercial · Méndez Álvaro 32'
}

export const MODOS: { id: ModoId; label: string }[] = [
  { id: 'conjunto', label: 'Conjunto' },
  { id: 'disponibilidad', label: 'Disponibilidad' },
  { id: 'plantas', label: 'Plantas' },
  { id: 'vista', label: 'Vista' },
  { id: 'asoleamiento', label: 'Asoleamiento' },
]

export function datosVivienda(u: Vivienda) {
  return [
    { k: 'Sup. útil', v: u.util + ' m²' },
    { k: 'Terraza', v: u.ter + ' m²' },
    { k: 'Dormitorios', v: String(u.dorm) },
    { k: 'Baños', v: String(u.banos) },
    { k: 'Orientación', v: u.orient },
    { k: 'Vista', v: u.vista },
    { k: 'Garaje', v: u.garaje + ' plaza' + (u.garaje > 1 ? 's' : '') },
    { k: 'Trastero', v: 'Incluido' },
    { k: 'Planta', v: plantaLabel(u.planta) },
  ]
}

export function planPago(u: Vivienda) {
  const q = cotizar(u)
  return [
    { k: 'Reserva', v: eur(q.reserva) },
    { k: 'A la firma del contrato (20%)', v: eur(q.contrato) },
    { k: 'Durante obra (10%, 18 meses)', v: eur(q.mensualObra) + '/mes' },
    { k: 'A la entrega (70%)', v: eur(q.entrega) },
    { k: 'Cuota hipoteca est. (25a, 3,2%)', v: eur(q.cuota) + '/mes' },
  ]
}

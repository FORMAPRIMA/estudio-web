/**
 * FP Visual Lab — Parque Comercial La Dehesa (Alcalá de Henares)
 *
 * Modelo puro del activo de renta: implantación de los 35 locales sobre los
 * módulos del parque, flujo peatonal por gravedad comercial, motor de renta y
 * valoración por yield. Sin React ni three.js.
 *
 * Port de `FP Plaza Comercial.dc.html` (Claude Design). La lógica se conserva;
 * la paleta pasa a ser la de la plataforma interna.
 *
 * Un activo de renta no se vende, se alquila: aquí no hay precio de venta sino
 * renta €/m²/mes, y el número que importa al final no es el GDV sino el NOI
 * capitalizado a un yield de salida.
 */

import { C, hash, eur, mm, num, dec } from './ui'
export { C, hash, eur, mm, num, dec }

export type RubroId = 'SUP' | 'MOD' | 'HOG' | 'DEP' | 'GAS' | 'SAL' | 'SER' | 'OCI'
export type FormatoId = 'ANCLA' | 'SUBANCLA' | 'MEDIANA' | 'LINEA' | 'GASTRO' | 'ISLA'
export type EstadoId = 'disponible' | 'intencion' | 'negociacion' | 'firmado' | 'entregado'
export type ModuloId = 'A' | 'B' | 'C' | 'D' | 'E' | 'K'
export type ModoId = 'disponibilidad' | 'mix' | 'renta' | 'flujo' | 'conjunto'

export const RUBROS: Record<RubroId, { label: string; color: string }> = {
  SUP: { label: 'Supermercado', color: '#6E7A68' },
  MOD: { label: 'Moda y calzado', color: C.plum },
  HOG: { label: 'Hogar y bricolaje', color: C.gold },
  DEP: { label: 'Deporte', color: C.blue },
  GAS: { label: 'Gastronomía', color: C.accent },
  SAL: { label: 'Salud y belleza', color: C.green },
  SER: { label: 'Servicios', color: C.grey },
  OCI: { label: 'Ocio y electrónica', color: '#5E5E60' },
}

/** `base` en €/m²/mes; `plazo` en años y `carencia` de obra en meses. */
export const FORMATOS: Record<FormatoId, { label: string; base: number; plazo: number; carencia: number }> = {
  ANCLA: { label: 'Ancla', base: 8.5, plazo: 15, carencia: 6 },
  SUBANCLA: { label: 'Subancla', base: 11.5, plazo: 10, carencia: 4 },
  MEDIANA: { label: 'Mediana', base: 13.0, plazo: 10, carencia: 4 },
  LINEA: { label: 'Línea', base: 22.0, plazo: 5, carencia: 3 },
  GASTRO: { label: 'Gastro', base: 28.0, plazo: 7, carencia: 4 },
  ISLA: { label: 'Isla', base: 62.0, plazo: 2, carencia: 1 },
}

export const ESTADOS: Record<EstadoId, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: C.green },
  intencion: { label: 'Carta de intención', color: C.blue },
  negociacion: { label: 'En negociación', color: C.gold },
  firmado: { label: 'Contrato firmado', color: C.plum },
  entregado: { label: 'Entregado a inquilino', color: C.grey },
}

interface Modulo {
  label: string
  eje: 'x' | 'z'
  /** Coordenada de la línea de fachada del módulo */
  frente: number
  /** Hacia qué lado crece el fondo del local desde la fachada */
  hacia: 1 | -1
  /** Coordenada donde empieza a repartirse el frente */
  ini: number
  fondo: number
  alto: number
}

export const MODULOS: Record<ModuloId, Modulo> = {
  A: { label: 'Galería Norte', eje: 'x', frente: -58, hacia: -1, ini: -54, fondo: 30, alto: 7.2 },
  B: { label: 'Ancla esquina', eje: 'x', frente: -58, hacia: -1, ini: 38, fondo: 38, alto: 12.5 },
  C: { label: 'Galería Este', eje: 'z', frente: 46, hacia: 1, ini: -54, fondo: 28, alto: 7.6 },
  D: { label: 'Medianas Oeste', eje: 'z', frente: -106, hacia: -1, ini: -20, fondo: 24, alto: 8.4 },
  E: { label: 'Eje gastronómico', eje: 'x', frente: 30, hacia: 1, ini: -30, fondo: 14, alto: 5.8 },
  K: { label: 'Islas en plaza', eje: 'x', frente: 0, hacia: 1, ini: 0, fondo: 7, alto: 3.8 },
}

/** [id, módulo, formato, rubro, GLA, fondo?, alto?] */
type Fila = [string, ModuloId, FormatoId, RubroId, number, number?, number?]

const LOCALES: Fila[] = [
  ['A-01', 'A', 'ANCLA', 'SUP', 3200, 48, 11.5],
  ['A-02', 'A', 'LINEA', 'MOD', 340], ['A-03', 'A', 'LINEA', 'MOD', 285],
  ['A-04', 'A', 'LINEA', 'MOD', 220], ['A-05', 'A', 'LINEA', 'HOG', 470],
  ['A-06', 'A', 'LINEA', 'OCI', 300], ['A-07', 'A', 'LINEA', 'MOD', 265],
  ['A-08', 'A', 'LINEA', 'OCI', 355], ['A-09', 'A', 'LINEA', 'SER', 180],
  ['A-10', 'A', 'LINEA', 'SAL', 165], ['A-11', 'A', 'LINEA', 'SER', 140],
  ['B-01', 'B', 'ANCLA', 'DEP', 2200, 38, 12.5],
  ['C-01', 'C', 'SUBANCLA', 'DEP', 780], ['C-02', 'C', 'SUBANCLA', 'HOG', 640],
  ['C-03', 'C', 'LINEA', 'MOD', 320], ['C-04', 'C', 'LINEA', 'SER', 245],
  ['C-05', 'C', 'LINEA', 'SAL', 190], ['C-06', 'C', 'LINEA', 'MOD', 300],
  ['C-07', 'C', 'LINEA', 'SAL', 175], ['C-08', 'C', 'LINEA', 'SER', 155],
  ['C-09', 'C', 'MEDIANA', 'OCI', 530],
  ['D-01', 'D', 'MEDIANA', 'HOG', 720], ['D-02', 'D', 'MEDIANA', 'HOG', 560],
  ['D-03', 'D', 'MEDIANA', 'DEP', 430],
  ['E-01', 'E', 'GASTRO', 'GAS', 210], ['E-02', 'E', 'GASTRO', 'GAS', 175],
  ['E-03', 'E', 'GASTRO', 'GAS', 130], ['E-04', 'E', 'GASTRO', 'GAS', 120],
  ['E-05', 'E', 'GASTRO', 'GAS', 110], ['E-06', 'E', 'GASTRO', 'GAS', 85],
  ['K-01', 'K', 'ISLA', 'SER', 49], ['K-02', 'K', 'ISLA', 'GAS', 49],
  ['K-03', 'K', 'ISLA', 'SAL', 49], ['K-04', 'K', 'ISLA', 'SER', 49],
  ['K-05', 'K', 'ISLA', 'GAS', 49],
]

const ISLAS: [number, number][] = [[-88, -30], [-52, -8], [-18, -34], [12, -10], [-62, 24]]

/** Locales con estado real conocido: no se sortean, están firmados o en curso. */
const FIJO: Record<string, EstadoId> = {
  'A-01': 'firmado', 'B-01': 'negociacion', 'C-01': 'intencion',
  'C-02': 'firmado', 'D-01': 'firmado', 'E-01': 'intencion', 'A-05': 'entregado',
}

const INQUILINOS: Record<string, string> = {
  'A-01': 'Alimentación · firmado 15 años',
  'B-01': 'Cadena deportiva · comité 02 sep',
  'C-01': 'Operador de deporte · LOI',
  'C-02': 'Menaje y decoración · firmado',
  'D-01': 'Bricolaje · firmado 12 años',
  'E-01': 'Grupo de restauración · LOI',
  'A-05': 'Electrodomésticos · llaves entregadas',
}

export interface Local {
  id: string
  mod: ModuloId
  tipo: FormatoId
  rubro: RubroId
  gla: number
  alto: number
  x: number
  z: number
  w: number
  d: number
  eje: 'x' | 'z'
  frenteLin: number
  fondo: number
  niveles: number
  libre: number
  inquilino: string
  /** Flujo peatonal 0..1 por modelo de gravedad respecto a anclas y plaza */
  flujo: number
  renta: number
  rentaLista: number
  estado: EstadoId
}

/**
 * Flujo peatonal por gravedad comercial: cuanto más cerca de un ancla y de la
 * plaza central, más gente pasa por delante. Es lo que sostiene la renta.
 */
function flujoDe(x: number, z: number): number {
  const anclas: [number, number][] = [[-87, -82], [58, -77], [-118, 16]]
  let mejor = 999
  anclas.forEach((a) => { const d = Math.hypot(x - a[0], z - a[1]); if (d < mejor) mejor = d })
  const dPlaza = Math.hypot(x + 20, z + 10)
  const f = 1 - Math.min(1, (mejor / 190) * 0.62 + (dPlaza / 300) * 0.38)
  return Math.max(0.06, Math.min(1, f))
}

export interface PalancasRenta { base: Record<FormatoId, number> }

/** €/m²/mes de un local: base del formato, prima por flujo, y castigo al tamaño. */
export function rentaDe(u: Pick<Local, 'tipo' | 'gla' | 'flujo' | 'frenteLin' | 'fondo'>, base?: number): number {
  const b = base ?? FORMATOS[u.tipo].base
  const tam = Math.pow(400 / Math.max(45, u.gla), 0.17)
  const vis = 1 + 0.10 * Math.min(1, u.frenteLin / (u.fondo * 1.2))
  return Math.round(b * (1 + 0.30 * u.flujo) * tam * vis * 10) / 10
}

export function estadoDe(u: Pick<Local, 'id' | 'flujo' | 'tipo'>): EstadoId {
  const r = hash('ld2' + u.id)
  const p = 0.30 + u.flujo * 0.40 + (u.tipo === 'ISLA' ? -0.18 : 0)
  if (r < p * 0.30) return 'entregado'
  if (r < p * 0.72) return 'firmado'
  if (r < p * 0.88) return 'negociacion'
  if (r < p) return 'intencion'
  return 'disponible'
}

export const contratado = (u: Local) => u.estado === 'firmado' || u.estado === 'entregado'

export interface ConjuntoDehesa {
  units: Local[]
  byId: Record<string, Local>
  glaTotal: number
  rMin: number
  rMax: number
}

export function buildConjunto(): ConjuntoDehesa {
  const units: Local[] = []
  const cursor: Record<string, number> = {}
  ;(Object.keys(MODULOS) as ModuloId[]).forEach((m) => { cursor[m] = MODULOS[m].ini })
  let isla = 0

  LOCALES.forEach(([id, mod, tipo, rubro, gla, fondoOv, altoOv]) => {
    const M = MODULOS[mod]
    const fondo = fondoOv ?? M.fondo
    const alto = altoOv ?? M.alto
    let x: number, z: number, w: number, d: number

    if (tipo === 'ISLA') {
      const p = ISLAS[isla++]
      x = p[0]; z = p[1]; w = 7; d = 7
    } else if (M.eje === 'x') {
      // el módulo reparte su frente: cada local ocupa GLA/fondo de fachada
      w = gla / fondo; d = fondo
      x = cursor[mod] + w / 2; z = M.frente + M.hacia * d / 2
      cursor[mod] += w
    } else {
      d = gla / fondo; w = fondo
      z = cursor[mod] + d / 2; x = M.frente + M.hacia * w / 2
      cursor[mod] += d
    }

    const flujo = flujoDe(x, z)
    const frenteLin = M.eje === 'x' ? w : d
    const u: Local = {
      id, mod, tipo, rubro, gla, alto, x, z, w, d, eje: M.eje,
      frenteLin, fondo,
      niveles: tipo === 'ANCLA' && id === 'B-01' ? 2 : 1,
      libre: tipo === 'ANCLA' ? 6.5 : tipo === 'ISLA' ? 3.2 : 4.6,
      inquilino: INQUILINOS[id] ?? '—',
      flujo,
      renta: 0, rentaLista: 0, estado: 'disponible',
    }
    u.renta = rentaDe(u)
    u.rentaLista = u.renta
    u.estado = FIJO[id] ?? estadoDe(u)
    units.push(u)
  })

  const byId: Record<string, Local> = {}
  units.forEach((u) => { byId[u.id] = u })
  const rr = units.map((u) => u.renta)

  return {
    units, byId,
    glaTotal: units.reduce((a, u) => a + u.gla, 0),
    rMin: Math.floor(Math.min.apply(null, rr)),
    rMax: Math.ceil(Math.max.apply(null, rr)),
  }
}

/* ── Propuesta de arrendamiento ───────────────────────────────────────── */

export interface PropConfig { plazo: number; carencia: number; escalado: number; aport: number }

export interface Propuesta {
  cfg: PropConfig
  /** Renta mínima garantizada mensual */
  mes: number
  gc: number
  mkt: number
  total: number
  anual: number
  /** Renta media efectiva del contrato: carencia y escalado repartidos */
  efectiva: number
  aportacion: number
}

export function propuestaBase(u: Local): PropConfig {
  return { plazo: FORMATOS[u.tipo].plazo, carencia: FORMATOS[u.tipo].carencia, escalado: 2.5, aport: 120 }
}

export function propuesta(u: Local, cfg?: Partial<PropConfig>): Propuesta {
  const c: PropConfig = { ...propuestaBase(u), ...(cfg || {}) }
  const mes = u.renta * u.gla
  const gc = u.gla * 3.4
  const mkt = u.gla * 0.8
  const meses = c.plazo * 12
  let acum = 0
  for (let m = 0; m < meses; m++) {
    if (m < c.carencia) continue
    acum += mes * Math.pow(1 + c.escalado / 100, Math.floor(m / 12))
  }
  return {
    cfg: c, mes, gc, mkt, total: mes + gc + mkt,
    anual: mes * 12,
    efectiva: acum / meses,
    aportacion: c.aport * u.gla,
  }
}

export function siguienteEstado(e: EstadoId): EstadoId {
  return e === 'disponible' ? 'negociacion'
    : e === 'negociacion' ? 'intencion'
      : e === 'intencion' ? 'firmado' : 'disponible'
}

export function accionDe(e: EstadoId): string {
  return e === 'disponible' ? 'Marcar en negociación'
    : e === 'negociacion' ? 'Registrar carta de intención'
      : e === 'intencion' ? 'Registrar firma' : 'Liberar local'
}

/* ── Valoración ───────────────────────────────────────────────────────── */

export interface Valoracion {
  rentaCon: number
  potencial: number
  noi: number
  noiEstab: number
  valor: number
  valorEstab: number
}

/** `opex` en % de la renta; `yld` en centésimas de punto (625 = 6,25%). */
export function valorar(units: Local[], opexPct: number, yldBps: number): Valoracion {
  const opex = opexPct / 100
  const yld = yldBps / 10000
  const rentaCon = units.filter(contratado).reduce((a, u) => a + u.renta * u.gla * 12, 0)
  const potencial = units.reduce((a, u) => a + u.renta * u.gla * 12, 0)
  const noi = rentaCon * (1 - opex)
  const noiEstab = potencial * (1 - opex)
  return { rentaCon, potencial, noi, noiEstab, valor: noi / yld, valorEstab: noiEstab / yld }
}

/* ── Persistencia local ───────────────────────────────────────────────── */

export const LS_KEY = 'fp.visual-lab.dehesa.v1'

export interface PropEmitida {
  folio: string; local: string; rubro: string; gla: string
  mes: string; plazo: string; fecha: string
}
export interface LogEntry { t: string; txt: string }

export interface EstadoGuardado {
  ov?: Record<string, { renta: number; estado: EstadoId }>
  props?: PropEmitida[]
  log?: LogEntry[]
}

export function cargarLocal(): EstadoGuardado {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '') || {} } catch { return {} }
}

export function guardarLocal(units: Local[], props: PropEmitida[], log: LogEntry[]) {
  if (typeof window === 'undefined') return
  const ov: NonNullable<EstadoGuardado['ov']> = {}
  units.forEach((u) => {
    if (u.renta !== u.rentaLista || u.estado !== (FIJO[u.id] ?? estadoDe(u))) {
      ov[u.id] = { renta: u.renta, estado: u.estado }
    }
  })
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ov, props, log })) } catch { /* cuota llena */ }
}

/* ── Vistas de la ficha ───────────────────────────────────────────────── */

export type FichaTab = 'render' | 'planta' | 'fachada' | 'flujo'

export const FICHA_TABS: { id: FichaTab; label: string }[] = [
  { id: 'render', label: 'Render' },
  { id: 'planta', label: 'Planta' },
  { id: 'fachada', label: 'Escaparate' },
  { id: 'flujo', label: 'Flujo' },
]

export const FICHA_HINT: Record<FichaTab, string> = {
  render: 'Render del local en galería',
  planta: 'Planta comercial acotada',
  fachada: 'Alzado de escaparate y rótulo',
  flujo: 'Mapa de flujo peatonal del módulo',
}

export const FICHA_CAPTION: Record<FichaTab, string> = {
  render: 'Render · entrega en obra gris · rotulación a cargo del inquilino',
  planta: 'Planta · cotas en metros · altura libre hasta falso techo',
  fachada: 'Alzado · banda de rótulo normalizada 1,20 m',
  flujo: 'Aforo medio día laborable · modelo de gravedad comercial',
}

export const MODOS: { id: ModoId; label: string }[] = [
  { id: 'disponibilidad', label: 'Disponibilidad' },
  { id: 'mix', label: 'Mix comercial' },
  { id: 'renta', label: 'Renta €/m²' },
  { id: 'flujo', label: 'Flujo peatonal' },
  { id: 'conjunto', label: 'Conjunto' },
]

export function datosLocal(u: Local) {
  return [
    { k: 'GLA', v: num(u.gla) + ' m²' },
    { k: 'Frente', v: dec(u.frenteLin) + ' m' },
    { k: 'Fondo', v: dec(u.fondo) + ' m' },
    { k: 'Altura libre', v: dec(u.libre) + ' m' },
    { k: 'Niveles', v: String(u.niveles) },
    { k: 'Flujo', v: Math.round(u.flujo * 100) + ' / 100' },
  ]
}

export function condiciones(u: Local) {
  return [
    { k: 'Formato', v: `${FORMATOS[u.tipo].label} · ${MODULOS[u.mod].label}` },
    { k: 'Plazo obligatorio', v: FORMATOS[u.tipo].plazo + ' años' },
    { k: 'Carencia de obra', v: FORMATOS[u.tipo].carencia + ' meses' },
    { k: 'Escalado anual', v: 'IPC + 0,5% · mínimo 2,5%' },
    { k: 'Gastos comunes', v: eur(u.gla * 3.4) + ' / mes' },
    { k: 'Fondo de marketing', v: eur(u.gla * 0.8) + ' / mes' },
    { k: 'Entrega', v: u.tipo === 'ANCLA' ? 'Obra gris con acometidas' : 'Obra gris + falso techo' },
  ]
}

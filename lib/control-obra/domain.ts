// Control económico de obra — tipos y helpers de cálculo.
// App interna /team/apps/control-obra (solo fp_partner).

export type EstadoPartida = 'igual' | 'modificada' | 'nueva' | 'eliminada'

export interface Obra {
  id: string
  slug: string
  nombre: string
  direccion: string | null
  baseline_fecha: string | null
  margin_default: number
}

export interface Partida {
  id: string
  capitulo_num: number
  capitulo_nombre: string
  subcapitulo_codigo: string
  subcapitulo_nombre: string
  codigo: string
  descripcion: string
  detalle: string | null
  unidad: string | null
  base_qty: number | null
  base_puc: number | null
  base_pucl: number | null
  qty: number | null
  puc: number | null
  margin: number
  pucl: number | null
  pucl_auto: boolean
  estado: EstadoPartida
  trasladar_cliente: boolean
  proveedor_id: string | null
  motivo_interno: string | null
  nota_cliente: string | null
  orden: number
  modified_at: string | null
}

export interface Proveedor {
  id: string
  nombre: string
  notas: string | null
  presupuesto_manual: number | null
  proveedor_global_id: string | null
  orden: number
}

export interface Pago {
  id: string
  proveedor_id: string
  monto: number
  fecha: string | null
  fecha_texto: string | null
  nota: string | null
  orden: number
}

export interface Deposito {
  id: string
  label: string | null
  monto: number
  iva: number
  total: number
  fecha: string | null
  fecha_texto: string | null
  orden: number
}

export interface LogEntry {
  id: string
  partida_codigo: string | null
  partida_desc: string | null
  tipo: string
  resumen: string
  motivo: string | null
  created_at: string
}

export interface ObraData {
  obra: Obra
  partidas: Partida[]
  proveedores: Proveedor[]
  pagos: Pago[]
  depositos: Deposito[]
  log: LogEntry[]
}

// ── Helpers de cálculo ──────────────────────────────────────────────

/** Redondeo al céntimo hacia arriba (igual que el Excel original). */
export function ceilCent(x: number): number {
  return Math.ceil((x - 1e-9) * 100) / 100
}

/** Precio unitario cliente automático a partir del coste y el margen. */
export function autoPucl(puc: number | null, margin: number): number {
  return ceilCent((puc ?? 0) * (margin || 1))
}

/** Importe actual de una partida (0 si está eliminada). */
export function importeCoste(p: Partida): number {
  if (p.estado === 'eliminada') return 0
  return (p.qty ?? 0) * (p.puc ?? 0)
}
export function importeCliente(p: Partida): number {
  if (p.estado === 'eliminada') return 0
  return (p.qty ?? 0) * (p.pucl ?? 0)
}
/** Importe baseline (0 si es partida nueva, que no existía en el congelado). */
export function baseImporteCoste(p: Partida): number {
  if (p.estado === 'nueva') return 0
  return (p.base_qty ?? 0) * (p.base_puc ?? 0)
}
export function baseImporteCliente(p: Partida): number {
  if (p.estado === 'nueva') return 0
  return (p.base_qty ?? 0) * (p.base_pucl ?? 0)
}

export type Vista = 'coste' | 'cliente'
export const importeActual = (p: Partida, v: Vista) => (v === 'coste' ? importeCoste(p) : importeCliente(p))
export const importeBase = (p: Partida, v: Vista) => (v === 'coste' ? baseImporteCoste(p) : baseImporteCliente(p))

/** Presupuesto asignado a un proveedor = suma del coste actual de sus partidas. */
export function presupuestoProveedor(prov: Proveedor, partidas: Partida[]): number {
  if (prov.presupuesto_manual != null) return prov.presupuesto_manual
  return partidas.filter((p) => p.proveedor_id === prov.id).reduce((s, p) => s + importeCoste(p), 0)
}

export function pagadoProveedor(provId: string, pagos: Pago[]): number {
  return pagos.filter((p) => p.proveedor_id === provId).reduce((s, p) => s + (p.monto ?? 0), 0)
}

export const totalDepositos = (deps: Deposito[]) => deps.reduce((s, d) => s + (d.total ?? 0), 0)
export const totalPagos = (pagos: Pago[]) => pagos.reduce((s, p) => s + (p.monto ?? 0), 0)
/** Balance de tesorería = caja recibida del cliente (con IVA) − pagado a proveedores (sin IVA). */
export const balanceTesoreria = (deps: Deposito[], pagos: Pago[]) => totalDepositos(deps) - totalPagos(pagos)

// ── Formato ─────────────────────────────────────────────────────────
const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtEUR = (x: number, dec = false) => (dec ? eur2 : eur0).format(x || 0)
export const fmtNum = (x: number | null | undefined) =>
  x == null ? '' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(x)
export const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

export function fmtFecha(f: string | null, texto: string | null = null): string {
  if (f) {
    const d = new Date(f)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return texto || '—'
}

// ── Presentación cliente (pantalla + PDF, misma fuente) ─────────────
export interface CambioCliente {
  descripcion: string
  estado: EstadoPartida
  ant: number
  nue: number
  dif: number
  pct: number | null // null = no aplica (nueva); -1 = retirada (−100%)
  nota: string | null
}
export interface SubCliente { codigo: string; nombre: string; items: CambioCliente[] }
export interface CapCliente { num: number; nombre: string; dif: number; subs: SubCliente[] }

/** Importe que el cliente ve como "nuevo" (respeta si el cambio se traslada o no). */
export function clienteNuevoImporte(p: Partida): number {
  if (p.trasladar_cliente === false) return baseImporteCliente(p) // no se traslada → sigue como el inicial
  return p.estado === 'eliminada' ? 0 : importeCliente(p)
}
/** Totales de cara al cliente (el "actual" respeta trasladar_cliente). */
export function clienteTotales(partidas: Partida[]) {
  return {
    base: partidas.reduce((s, p) => s + baseImporteCliente(p), 0),
    actual: partidas.reduce((s, p) => s + clienteNuevoImporte(p), 0),
  }
}

export function buildCambiosCliente(partidas: Partida[]): CapCliente[] {
  const m = new Map<number, { nombre: string; subs: Map<string, { nombre: string; items: CambioCliente[] }> }>()
  for (const p of partidas) {
    if (p.estado === 'igual' || p.trasladar_cliente === false) continue // no se muestran los cambios no trasladados
    const ant = baseImporteCliente(p)
    const nue = p.estado === 'eliminada' ? 0 : importeCliente(p)
    const dif = nue - ant
    const cambio: CambioCliente = {
      descripcion: p.descripcion, estado: p.estado, ant, nue, dif,
      pct: p.estado === 'eliminada' ? -1 : p.estado === 'nueva' ? null : ant > 0 ? dif / ant : null,
      nota: p.nota_cliente,
    }
    if (!m.has(p.capitulo_num)) m.set(p.capitulo_num, { nombre: p.capitulo_nombre, subs: new Map() })
    const c = m.get(p.capitulo_num)!
    if (!c.subs.has(p.subcapitulo_codigo)) c.subs.set(p.subcapitulo_codigo, { nombre: p.subcapitulo_nombre, items: [] })
    c.subs.get(p.subcapitulo_codigo)!.items.push(cambio)
  }
  return Array.from(m.entries()).sort((a, b) => a[0] - b[0]).map(([num, c]) => ({
    num, nombre: c.nombre,
    dif: Array.from(c.subs.values()).flatMap((s) => s.items).reduce((s, i) => s + i.dif, 0),
    subs: Array.from(c.subs.entries()).map(([codigo, s]) => ({ codigo, nombre: s.nombre, items: s.items })),
  }))
}

export const tagCambio = (e: EstadoPartida) => (e === 'nueva' ? 'Añadido' : e === 'eliminada' ? 'No se ejecuta' : 'Modificado')

export const ESTADO_COLOR: Record<EstadoPartida, { bg: string; label: string; dot: string }> = {
  igual:      { bg: 'transparent', label: 'Sin cambios', dot: '#C9C6BE' },
  modificada: { bg: '#FBF3E1',     label: 'Modificada',  dot: '#E0A82E' },
  nueva:      { bg: '#EAF2FB',     label: 'Nueva',       dot: '#3B7DD8' },
  eliminada:  { bg: '#FCECEC',     label: 'Eliminada',   dot: '#D14343' },
}

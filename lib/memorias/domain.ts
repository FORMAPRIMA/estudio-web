// Memorias de Calidades — tipos, catálogos y helpers de cálculo.
// Compartido entre el warehouse, la memoria de anteproyecto y la de ejecución.

// ── Niveles de calidad ────────────────────────────────────────────────────────

export type NivelCalidad = 'functional' | 'select' | 'master_piece'

export const NIVELES: { value: NivelCalidad; label: string; color: string; bg: string }[] = [
  { value: 'functional',   label: 'Functional',  color: '#1D9E75', bg: '#E8F7F2' },
  { value: 'select',       label: 'Select',      color: '#378ADD', bg: '#EBF5FF' },
  { value: 'master_piece', label: 'Masterpiece', color: '#D85A30', bg: '#FFF3EF' },
]

export function nivelMeta(nivel: string | null | undefined) {
  return NIVELES.find(n => n.value === nivel) ?? { value: nivel as NivelCalidad, label: '—', color: '#AAA', bg: '#F5F4F0' }
}

/** "Select" · "Select / Masterpiece" · "Los tres niveles". */
export function nivelesLabel(niveles: NivelCalidad[] | null | undefined): string {
  if (!niveles || niveles.length === 0) return '—'
  if (niveles.length === NIVELES.length) return 'Los tres niveles'
  return NIVELES.filter(n => niveles.includes(n.value)).map(n => n.label).join(' / ')
}

// ── Estado de compra (memoria de ejecución) ───────────────────────────────────

export type EstadoCompra = 'pendiente' | 'pedido' | 'en_transito' | 'recibido' | 'instalado'

export const ESTADOS_COMPRA: { value: EstadoCompra; label: string; color: string; bg: string }[] = [
  { value: 'pendiente',   label: 'Pendiente',   color: '#888',    bg: '#F5F4F0' },
  { value: 'pedido',      label: 'Pedido',      color: '#378ADD', bg: '#EBF5FF' },
  { value: 'en_transito', label: 'En tránsito', color: '#D97706', bg: '#FFF8EB' },
  { value: 'recibido',    label: 'Recibido',    color: '#059669', bg: '#ECFDF5' },
  { value: 'instalado',   label: 'Instalado',   color: '#1D9E75', bg: '#E8F7F2' },
]

export function estadoCompraMeta(estado: string | null | undefined) {
  return ESTADOS_COMPRA.find(e => e.value === estado) ?? ESTADOS_COMPRA[0]
}

// ── Estructura presupuestaria ─────────────────────────────────────────────────

export interface Capitulo {
  id: string
  numero: number
  nombre: string
  orden: number
  activo: boolean
}

export interface Subcapitulo {
  id: string
  capitulo_id: string
  codigo: string
  nombre: string
  orden: number
  activo: boolean
}

/** Capítulo con sus subcapítulos anidados, listo para árboles y selects. */
export interface CapituloConSubs extends Capitulo {
  subcapitulos: Subcapitulo[]
}

export function agruparEstructura(capitulos: Capitulo[], subcapitulos: Subcapitulo[]): CapituloConSubs[] {
  return [...capitulos]
    .sort((a, b) => a.orden - b.orden || a.numero - b.numero)
    .map(c => ({
      ...c,
      subcapitulos: subcapitulos
        .filter(s => s.capitulo_id === c.id)
        .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo)),
    }))
}

// ── Warehouse ─────────────────────────────────────────────────────────────────

export interface WarehouseItem {
  id: string
  subcapitulo_id: string
  nombre: string
  /** Un mismo producto puede valer para varios niveles (1 a 3). */
  niveles_calidad: NivelCalidad[]
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  imagen_principal_url: string | null
  imagen_lifestyle_url: string | null
  imagenes_adicionales: string[]
  ficha_tecnica_url: string | null
  url_producto: string | null
  /** Base sin IVA. */
  precio_pvp: number | null
  /** Con IVA. Se deriva de `precio_pvp` e `iva_pct`, pero se puede sobrescribir. */
  precio_pvp_con_iva: number | null
  iva_pct: number
  /** Coste para nosotros, siempre sin IVA. */
  precio_coste: number | null
  moneda: string
  proveedor_preferente_id: string | null
  acabados: string[]
  dimensiones: Record<string, unknown>
  data: Record<string, unknown>
  tags: string[]
  activo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WarehouseItemInput {
  subcapitulo_id: string
  nombre: string
  niveles_calidad: NivelCalidad[]
  marca?: string | null
  modelo?: string | null
  referencia?: string | null
  descripcion?: string | null
  imagen_principal_url?: string | null
  imagen_lifestyle_url?: string | null
  imagenes_adicionales?: string[]
  ficha_tecnica_url?: string | null
  url_producto?: string | null
  precio_pvp?: number | null
  precio_pvp_con_iva?: number | null
  iva_pct?: number
  precio_coste?: number | null
  moneda?: string
  proveedor_preferente_id?: string | null
  acabados?: string[]
  dimensiones?: Record<string, unknown>
  data?: Record<string, unknown>
  tags?: string[]
  activo?: boolean
}

/**
 * Normaliza una fila del warehouse. Cubre la ventana entre el deploy y la
 * ejecución de `memorias_calidad_v3_niveles_iva.sql`: si la fila viene del
 * esquema antiguo (nivel único, sin IVA) se traduce al nuevo en lugar de
 * dejar la pantalla en blanco.
 */
export function normalizarWarehouseItem(row: Record<string, unknown>): WarehouseItem {
  const niveles = Array.isArray(row.niveles_calidad) && row.niveles_calidad.length > 0
    ? (row.niveles_calidad as NivelCalidad[])
    : row.nivel_calidad
      ? [row.nivel_calidad as NivelCalidad]
      : ['select' as NivelCalidad]
  const ivaPct = typeof row.iva_pct === 'number' ? row.iva_pct : IVA_DEFAULT
  const pvp = (row.precio_pvp as number | null) ?? null
  return {
    ...(row as unknown as WarehouseItem),
    niveles_calidad: niveles,
    iva_pct: ivaPct,
    precio_pvp: pvp,
    precio_pvp_con_iva: (row.precio_pvp_con_iva as number | null) ?? conIva(pvp, ivaPct),
  }
}

/** Igual que la anterior, para los items de una estancia. */
export function normalizarEstanciaItem(row: Record<string, unknown>): EstanciaItem {
  const niveles = Array.isArray(row.niveles_calidad)
    ? (row.niveles_calidad as NivelCalidad[])
    : row.nivel_calidad
      ? [row.nivel_calidad as NivelCalidad]
      : []
  const ivaPct = typeof row.iva_pct === 'number' ? row.iva_pct : IVA_DEFAULT
  const pvp = (row.precio_pvp as number | null) ?? null
  return {
    ...(row as unknown as EstanciaItem),
    niveles_calidad: niveles,
    iva_pct: ivaPct,
    precio_pvp: pvp,
    precio_pvp_con_iva: (row.precio_pvp_con_iva as number | null) ?? conIva(pvp, ivaPct),
  }
}

/** Fila de `warehouse_favoritos`: un único producto por subcapítulo × nivel. */
export interface Favorito {
  subcapitulo_id: string
  nivel_calidad: NivelCalidad
  item_id: string
}

/** Índice `subcapituloId|nivel` → itemId, para pintar estrellas sin recorrer listas. */
export function indexarFavoritos(favoritos: Favorito[]): Map<string, string> {
  return new Map(favoritos.map(f => [`${f.subcapitulo_id}|${f.nivel_calidad}`, f.item_id]))
}

/** Niveles en los que este item es el Favorito FP de su subcapítulo. */
export function nivelesFavoritos(item: WarehouseItem, favoritos: Favorito[]): NivelCalidad[] {
  return favoritos.filter(f => f.item_id === item.id).map(f => f.nivel_calidad)
}

// ── Memoria de ejecución: estancias ───────────────────────────────────────────

export interface Estancia {
  id: string
  proyecto_id: string
  nombre: string
  orden: number
}

export interface EstanciaItem {
  id: string
  estancia_id: string
  warehouse_item_id: string | null
  subcapitulo_id: string
  nombre: string
  niveles_calidad: NivelCalidad[]
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  imagen_principal_url: string | null
  imagen_lifestyle_url: string | null
  ficha_tecnica_url: string | null
  url_producto: string | null
  acabados: string[]
  acabado_seleccionado: string | null
  cantidad: number
  proveedor_id: string | null
  precio_pvp: number | null
  precio_pvp_con_iva: number | null
  iva_pct: number
  precio_coste: number | null
  moneda: string
  notas: string | null
  estado_compra: EstadoCompra
  orden: number
}

export interface Proveedor {
  id: string
  nombre: string
}

export interface ProyectoMemoria {
  id: string
  nombre: string
  codigo: string | null
  direccion: string | null
  nivel_calidad: NivelCalidad | null
  status: string
}

// ── Cálculo económico ─────────────────────────────────────────────────────────

/** Margen por defecto para derivar PVP desde coste (el mismo que control de obra). */
export const MARGEN_DEFAULT = 1.16

/** IVA general. Las reformas de vivienda pueden ir al 10%: el campo es editable. */
export const IVA_DEFAULT = 21

/** Redondeo al céntimo (normal, no hacia arriba) para pasar de base a total. */
export function redondeaCent(x: number): number {
  return Math.round(x * 100) / 100
}

/** Base sin IVA → total con IVA. */
export function conIva(base: number | null, ivaPct: number = IVA_DEFAULT): number | null {
  if (base == null) return null
  return redondeaCent(base * (1 + ivaPct / 100))
}

/** Total con IVA → base sin IVA. */
export function sinIva(total: number | null, ivaPct: number = IVA_DEFAULT): number | null {
  if (total == null) return null
  return redondeaCent(total / (1 + ivaPct / 100))
}

/** Redondeo al céntimo hacia arriba (igual que control de obra). */
export function ceilCent(x: number): number {
  return Math.ceil((x - 1e-9) * 100) / 100
}

/** PVP sugerido a partir del coste. */
export function autoPvp(coste: number | null, margen: number = MARGEN_DEFAULT): number | null {
  if (coste == null) return null
  return ceilCent(coste * margen)
}

export function importePvp(item: Pick<EstanciaItem, 'precio_pvp' | 'cantidad'>): number {
  return ceilCent((item.precio_pvp ?? 0) * (item.cantidad ?? 0))
}

export function importeCoste(item: Pick<EstanciaItem, 'precio_coste' | 'cantidad'>): number {
  return ceilCent((item.precio_coste ?? 0) * (item.cantidad ?? 0))
}

export interface Totales {
  pvp: number
  coste: number
  margen: number
  margenPct: number | null
  unidades: number
}

export function totales(items: EstanciaItem[]): Totales {
  const pvp = items.reduce((acc, i) => acc + importePvp(i), 0)
  const coste = items.reduce((acc, i) => acc + importeCoste(i), 0)
  const margen = ceilCent(pvp - coste)
  return {
    pvp: ceilCent(pvp),
    coste: ceilCent(coste),
    margen,
    margenPct: pvp > 0 ? (margen / pvp) * 100 : null,
    unidades: items.reduce((acc, i) => acc + (i.cantidad ?? 0), 0),
  }
}

// ── Formato ───────────────────────────────────────────────────────────────────

export function formatEur(n: number | null | undefined, decimales = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + ' €'
}

export function formatCantidad(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Vista (tarjetas / listado) ────────────────────────────────────────────────

export type VistaModo = 'cards' | 'lista'
export const VISTA_STORAGE_KEY = 'fp_memorias_vista'

// ── Modo cliente ──────────────────────────────────────────────────────────────
//
// Para revisiones con el cliente delante: oculta coste, margen y cualquier rastro
// del descuento profesional, y deja solo el precio (sin IVA y con IVA).
// Se recuerda en sessionStorage, no en localStorage: sobrevive a un refresco a
// mitad de reunión, pero no se queda encendido para el día siguiente.

export const MODO_CLIENTE_STORAGE_KEY = 'fp_memorias_modo_cliente'

/** Cómo se llama el precio del cliente según quién esté mirando. */
export function etiquetaPrecio(modoCliente: boolean): string {
  return modoCliente ? 'Precio' : 'PVP'
}

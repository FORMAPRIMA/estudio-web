// Presupuestos paramétricos — tipos y reglas puras (sin servidor ni React).
//
// Una obra de referencia es un presupuesto REAL de constructor. Sus importes son
// coste puro: si el documento trae márgenes o referral fees prorrateados, se
// descuentan al entrar (`descuento_margen_pct`). Los márgenes del estudio se
// añaden al final del flujo de estimación, nunca aquí.

import type { NivelCalidad } from '@/lib/memorias/domain'

export type { NivelCalidad }

// ── Acceso ───────────────────────────────────────────────────────────────────

export function canAccessPresupuestosParametricos(rol: string | null | undefined): boolean {
  return rol === 'fp_partner' || rol === 'fp_manager'
}

// ── Tipos de BD ──────────────────────────────────────────────────────────────

export type EstadoObra = 'borrador' | 'en_revision' | 'publicada' | 'archivada'
export type TipoReforma = 'integral' | 'parcial'

export const ESTADOS_OBRA: { value: EstadoObra; label: string; color: string; bg: string }[] = [
  { value: 'borrador',    label: 'Borrador',    color: '#1A1A1A80', bg: '#F0EEE8' },
  { value: 'en_revision', label: 'En revisión', color: '#B7791F', bg: '#FDF6E7' },
  { value: 'publicada',   label: 'Publicada',   color: '#1D9E75', bg: '#E8F7F2' },
  { value: 'archivada',   label: 'Archivada',   color: '#1A1A1A60', bg: '#F5F4F0' },
]

export function estadoMeta(estado: string) {
  return ESTADOS_OBRA.find(e => e.value === estado) ?? ESTADOS_OBRA[0]
}

export type ObraReferencia = {
  id: string
  nombre: string
  direccion: string | null
  proyecto_id: string | null
  constructor: string | null
  fecha_presupuesto: string          // 'YYYY-MM-DD'
  tipo_reforma: TipoReforma
  estado: EstadoObra
  importe_documento: number | null
  descuento_margen_pct: number
  pdf_path: string | null
  notas: string | null
  created_by: string | null
  publicada_at: string | null
  created_at: string
  updated_at: string
}

export type ObraMedicion = {
  obra_id: string
  variable: string
  valor_num: number | null
  valor_texto: string | null
  fuente: 'manual' | 'ia' | 'derivada'
  nota: string | null
}

export type ObraCapitulo = {
  obra_id: string
  capitulo_id: string
  nivel_calidad: NivelCalidad | null
  nivel_propuesto_ia: NivelCalidad | null
  justificacion_ia: string | null
  incluido: boolean
  motivo_exclusion: string | null
}

export type ObraPartida = {
  id: string
  obra_id: string
  capitulo_id: string | null
  subcapitulo_id: string | null
  codigo_origen: string | null
  capitulo_origen: string | null
  descripcion: string
  unidad: string | null
  medicion: number | null
  precio_unitario: number | null
  importe: number
  clasificacion: 'manual' | 'ia' | 'ia_revisada'
  confianza_ia: number | null
  orden: number
}

export type IndicePunto = { serie: string; periodo: string; valor: number; provisional: boolean }

export type Capitulo = { id: string; numero: number; nombre: string; orden: number }
export type Subcapitulo = { id: string; capitulo_id: string; codigo: string; nombre: string; orden: number }

// ── Vigencia, ajuste INE y peso de cada obra ─────────────────────────────────
//
// Regla acordada con José (20 oct 2026):
// - Un presupuesto de hasta VIGENCIA_MESES se usa tal cual.
// - Más antiguo: sus precios se llevan a euros de hoy con el índice de costes de
//   construcción del INE y la obra queda rotulada «ajustado con índice INE».
// - Cuanto más antigua, menos pesa en los ratios (semivida), y si además está
//   ajustada pesa todavía menos: una obra recién terminada siempre manda.

export const VIGENCIA_MESES = 12
export const SEMIVIDA_MESES = 24          // a los 24 meses una obra pesa la mitad
export const FACTOR_PESO_AJUSTADA = 0.6   // castigo extra por venir de un índice, no de precios reales
// El ICCE nacional es del Ministerio y no está en la API del INE. Se compone con dos
// series del INE: mano de obra de la construcción (45 %) y materiales (55 %, media
// de los materiales de edificación). Lo carga scripts/presupuestos-parametricos/indice-ine.mts.
export const SERIE_INDICE = 'ine_construccion'

export function mesesEntre(desde: string | Date, hasta: string | Date): number {
  const a = typeof desde === 'string' ? new Date(desde) : desde
  const b = typeof hasta === 'string' ? new Date(hasta) : hasta
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export function necesitaAjusteINE(fechaPresupuesto: string, hoy: Date = new Date()): boolean {
  return mesesEntre(fechaPresupuesto, hoy) > VIGENCIA_MESES
}

/** Peso de una obra en los ratios: 1 recién firmada, ~0,5 a los 2 años; ×0,6 si está ajustada. */
export function pesoObra(fechaPresupuesto: string, hoy: Date = new Date()): number {
  const edad = Math.max(0, mesesEntre(fechaPresupuesto, hoy))
  const decaimiento = Math.pow(0.5, edad / SEMIVIDA_MESES)
  return necesitaAjusteINE(fechaPresupuesto, hoy) ? decaimiento * FACTOR_PESO_AJUSTADA : decaimiento
}

/** Primer día del mes, en 'YYYY-MM-01'. */
export function periodoDe(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export type AjusteINE = {
  ajustada: boolean
  factor: number                 // 1 si no se ajusta
  periodoOrigen: string | null
  periodoDestino: string | null
  /** El índice no cubre la fecha de la obra: se usa sin ajustar y se avisa. */
  sinIndice: boolean
}

/**
 * Factor para llevar un presupuesto a euros de hoy. Usa el último mes publicado
 * de la serie y el mes del presupuesto (o el publicado más cercano anterior).
 */
export function ajusteINE(fechaPresupuesto: string, serie: IndicePunto[], hoy: Date = new Date()): AjusteINE {
  if (!necesitaAjusteINE(fechaPresupuesto, hoy)) {
    return { ajustada: false, factor: 1, periodoOrigen: null, periodoDestino: null, sinIndice: false }
  }
  const ordenada = [...serie].sort((a, b) => a.periodo.localeCompare(b.periodo))
  const destino = ordenada[ordenada.length - 1]
  const objetivo = periodoDe(fechaPresupuesto)
  const origen = [...ordenada].reverse().find(p => p.periodo <= objetivo)
  if (!destino || !origen || origen.valor <= 0) {
    return { ajustada: false, factor: 1, periodoOrigen: null, periodoDestino: null, sinIndice: true }
  }
  return {
    ajustada: true,
    factor: destino.valor / origen.valor,
    periodoOrigen: origen.periodo,
    periodoDestino: destino.periodo,
    sinIndice: false,
  }
}

/** Importe de coste puro: quita el margen/fee que venía prorrateado en el documento. */
export function importeCoste(importeDocumento: number, descuentoMargenPct: number): number {
  return importeDocumento / (1 + (descuentoMargenPct || 0))
}

// ── Formato ──────────────────────────────────────────────────────────────────

const fmtEur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions)
export const eur = (n: number | null | undefined) => (n == null ? '—' : fmtEur.format(n))

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
}

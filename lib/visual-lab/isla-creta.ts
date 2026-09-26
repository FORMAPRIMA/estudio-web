/**
 * FP Visual Lab — Isla Creta (Samborondón, Ecuador)
 *
 * A diferencia de los tres showrooms de demostración, aquí la maqueta NO se
 * genera en código: es un GLB modelado en Blender (revisión 03, 25/09/2026)
 * y el inventario son las 173 parcelas del CAD de julio de 2026, tal cual
 * llegaron en `parcelas.json`. Este módulo solo tipa esos datos, los carga y
 * les pone formato. Sin React ni three.js.
 *
 * Los recursos viven en `public/protegido/visual-lab/isla-creta/` y el
 * middleware exige sesión FP para servirlos: la maqueta es de un cliente real.
 *
 * Los precios son de DEMOSTRACIÓN (USD) y el estado real de todas las
 * unidades es `sin_confirmar`. `demoStatus` es una simulación reproducible que
 * no representa ventas del promotor. Nada de aquí se suma a la cartera en €.
 */

import { C, num } from './ui'
export { C, num }

export const ASSETS = '/protegido/visual-lab/isla-creta'
export const GLB_URL = `${ASSETS}/isla-creta.glb`
export const REVISION = '03'
export const FECHA_REVISION = '25/09/2026'

export type TipoId = 'unifamiliar' | 'multifamiliar'
export type DemoEstado = 'disponible' | 'reservado' | 'vendido'
export type ModoId = 'conjunto' | 'simulado'
export type VistaId = 'phase' | 'whole' | 'top'
export type CapaId = 'entorno' | 'vegetacion' | 'arquitectura' | 'volumenes'

export const TIPOS: Record<TipoId, { label: string; corto: string; color: string }> = {
  unifamiliar: { label: 'Parcela unifamiliar', corto: 'Unifamiliar', color: '#9bbcad' },
  multifamiliar: { label: 'Solar multifamiliar', corto: 'Multifamiliar', color: '#c8b98a' },
}

/** Colores de la simulación: los del visor de referencia (revisión 03). */
export const DEMO: Record<DemoEstado, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: '#78a673' },
  reservado: { label: 'Reservado', color: '#b69b57' },
  vendido: { label: 'Vendido', color: '#a27165' },
}

export const MODOS: { id: ModoId; label: string }[] = [
  { id: 'conjunto', label: 'Conjunto' },
  { id: 'simulado', label: 'Estados simulados' },
]

export const VISTAS: { id: VistaId; label: string }[] = [
  { id: 'phase', label: 'Etapa 1' },
  { id: 'whole', label: 'Isla y entorno' },
  { id: 'top', label: 'Planta' },
]

export const CAPAS: { id: CapaId; label: string; nota: string }[] = [
  { id: 'entorno', label: 'Entorno', nota: 'Ribera norte, campos y construcciones aproximadas' },
  { id: 'vegetacion', label: 'Vegetación', nota: '2.057 árboles ilustrativos' },
  { id: 'arquitectura', label: 'Viviendas y torres', nota: '171 viviendas en 8 tipologías y 2 torres conceptuales' },
  { id: 'volumenes', label: 'Volúmenes de lotes', nota: 'Límites transparentes sobre el perímetro CAD' },
]

export interface FactorPrecio { key: string; factor: number; distanceM?: number }

export interface Parcela {
  unitId: string
  label: string
  block: number | null
  number: number | null
  type: TipoId
  areaM2: number
  areaGeometryM2: number
  status: 'sin_confirmar'
  demoStatus: DemoEstado
  currency: 'USD'
  priceUsd: number
  effectiveUsdM2: number
  baseUsdM2: number
  priceFactors: FactorPrecio[]
  priceIsPlaceholder: boolean
  pricingVersion: string
  centroidGltf: [number, number, number]
  sourcePlan: string
  sourceArea: string
  geometryId: string
}

export interface Inventario {
  schemaVersion: number
  projectId: string
  projectName: string
  dataMode: string
  unitCount: number
  currency: 'USD'
  priceNotice: string
  units: Parcela[]
}

export interface Volumen { id: string; height: number; polygon: [number, number][] }

export interface ReglasPrecio {
  version: string
  currency: 'USD'
  isPlaceholder: boolean
  notice: string
  baseUnifamiliarUsdM2: number
  baseMultifamiliarUsdM2: number
  roundingUsd: number
  method: string
  caveats: string[]
}

export interface Conjunto {
  units: Parcela[]
  byId: Record<string, Parcela>
  volumenes: Volumen[]
  reglas: ReglasPrecio
  aviso: string
  sueloM2: number
  valorUsd: number
  manzanas: number[]
}

/** Trae inventario, volúmenes y reglas. Si falta cualquiera, la página no puede funcionar. */
export async function cargarConjunto(): Promise<Conjunto> {
  const [inv, volumenes, reglas] = await Promise.all([
    fetchJson<Inventario>(`${ASSETS}/parcelas.json`),
    fetchJson<Volumen[]>(`${ASSETS}/parcelas-volumenes.json`),
    fetchJson<ReglasPrecio>(`${ASSETS}/precios-provisionales.json`),
  ])
  if (inv.units.length !== inv.unitCount) {
    throw new Error(`El inventario declara ${inv.unitCount} unidades y trae ${inv.units.length}`)
  }
  const byId: Record<string, Parcela> = {}
  inv.units.forEach((u) => { byId[u.unitId] = u })
  const manzanas = Array.from(new Set(inv.units.map((u) => u.block).filter((b): b is number => b != null))).sort((a, b) => a - b)
  return {
    units: inv.units, byId, volumenes, reglas,
    aviso: inv.priceNotice,
    sueloM2: inv.units.reduce((a, u) => a + u.areaM2, 0),
    valorUsd: inv.units.reduce((a, u) => a + u.priceUsd, 0),
    manzanas,
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`${url.split('/').pop()} · HTTP ${r.status}`)
  return r.json() as Promise<T>
}

/* ── Formato ─────────────────────────────────────────────────────────── */

/** "463.000 USD": el símbolo $ a secas se confunde con otras monedas de la región. */
export const usd = (n: number) =>
  new Intl.NumberFormat('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions).format(Math.round(n)) + ' USD'

export const mUsd = (n: number, d = 1) => (n / 1e6).toFixed(d).replace('.', ',') + ' M USD'

export const m2 = (n: number) =>
  new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 } as Intl.NumberFormatOptions).format(n) + ' m²'

export const m2dec = (n: number) =>
  new Intl.NumberFormat('es-ES', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 } as Intl.NumberFormatOptions).format(n) + ' m²'

export const FACTOR_LABEL: Record<string, string> = {
  proximidad_borde_isla: 'Proximidad al borde de la isla',
  proximidad_zona_verde: 'Proximidad a zona verde',
  superficie_mayor_1200: 'Superficie superior a 1.200 m²',
  superficie_900_1200: 'Superficie entre 900 y 1.200 m²',
  superficie_menor_600: 'Superficie menor de 600 m²',
}

export function factorLabel(f: FactorPrecio): string {
  const base = FACTOR_LABEL[f.key] ?? f.key.replace(/_/g, ' ')
  return f.distanceM != null ? `${base} · ${f.distanceM.toFixed(1)} m` : base
}

export const factorPct = (f: number) => (f >= 1 ? '+' : '−') + Math.round(Math.abs(f - 1) * 100) + '%'

export function datosParcela(u: Parcela): { k: string; v: string }[] {
  return [
    { k: 'Superficie de plano', v: m2dec(u.areaM2) },
    { k: u.block != null ? 'Manzana' : 'Uso', v: u.block != null ? `MZ ${u.block}` : 'Multifamiliar' },
    { k: 'Tipo', v: TIPOS[u.type].corto },
    { k: 'Plano de origen', v: u.sourcePlan },
    { k: 'Base', v: `${u.baseUsdM2} USD/m²` },
    { k: 'Disponibilidad', v: 'Por confirmar' },
  ]
}

/** El nombre de la manzana tal y como se dice: "Manzana 4", o el uso si no la tiene. */
export function manzanaLabel(u: Parcela): string {
  return u.block != null ? `Manzana ${u.block}` : 'Solar multifamiliar'
}

export function buscar(units: Parcela[], q: string, max = 12): Parcela[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return units.filter((u) => (u.unitId + ' ' + u.label).toLowerCase().includes(s)).slice(0, max)
}

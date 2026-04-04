/**
 * Shared finanzas constants and helpers.
 */

export const SECCION_ORDER = [
  'Anteproyecto',
  'Proyecto de ejecución',
  'Obra',
  'Margen prorrateado de obra',
  'Interiorismo',
  'Margen de mobiliario',
  'Post venta',
] as const

export type Seccion = (typeof SECCION_ORDER)[number]

/** Secciones que NUNCA deben ser visibles para el cliente */
export const SECCIONES_PRIVADAS: string[] = [
  'Margen prorrateado de obra',
  'Margen de mobiliario',
]

const IVA = 0.21

/**
 * Computes the current repercusión de costos fijos por hora facturable.
 * Used as a fallback when no historical fixed-cost record covers a given date.
 */
export function calcRepercusion(
  costosFijos: { monto: number }[],
  members:     { horas_mensuales: number | null }[],
  minoracion:  number   // percentage, e.g. 15 for 15 %
): number {
  const totalFijos = costosFijos.reduce((s, c) => s + c.monto * (1 + IVA), 0)
  const hrsFact    = members.reduce((s, m) => s + (m.horas_mensuales ?? 0), 0)
  const hrsEfect   = hrsFact * (1 - minoracion / 100)
  return hrsEfect > 0 ? totalFijos / hrsEfect : 0
}

// Resolución de períodos (mes o trimestre) para las consultas de gastos.
// Compartido entre las páginas server, los endpoints de export y buildGastosZip
// para que el filtrado por fecha sea idéntico en todos los sitios.

export interface PeriodMonth   { year: number; month: number }
export interface PeriodQuarter { year: number; quarter: number }
export type Period = PeriodMonth | PeriodQuarter

export function isQuarter(p: Period): p is PeriodQuarter {
  return 'quarter' in p
}

/** Trimestre (1-4) al que pertenece un mes (1-12). */
export function quarterOf(month: number): number {
  return Math.floor((month - 1) / 3) + 1
}

/** Meses (1-12) que componen un trimestre. */
export function quarterMonths(quarter: number): [number, number, number] {
  const s = (quarter - 1) * 3 + 1
  return [s, s + 1, s + 2]
}

/** Rango de fechas inclusivo [from, to] en formato YYYY-MM-DD. */
export function periodRange(p: Period): { from: string; to: string } {
  const startMonth = isQuarter(p) ? (p.quarter - 1) * 3 + 1 : p.month
  const endMonth   = isQuarter(p) ? startMonth + 2 : p.month
  const from    = `${p.year}-${String(startMonth).padStart(2, '0')}-01`
  const lastDay = new Date(p.year, endMonth, 0).getDate()
  const to      = `${p.year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

/**
 * Filtro PostgREST `.or(...)`: casa por fecha_ticket dentro del período y, para
 * los gastos sin fecha de ticket, cae a created_at.
 */
export function periodFilter(p: Period): string {
  const { from, to } = periodRange(p)
  return `and(fecha_ticket.gte.${from},fecha_ticket.lte.${to}),and(fecha_ticket.is.null,created_at.gte.${from}T00:00:00,created_at.lte.${to}T23:59:59)`
}

/**
 * Historical salary lookup helper.
 *
 * Salary changes are tracked in `salarios_historia` with valid_from / valid_to ranges.
 * This ensures that time entries are always costed at the rate that was active
 * on the date the work was logged — past project margins never change when
 * someone gets a raise.
 */

export interface SalaryRecord {
  user_id:         string
  salario_mensual: number
  horas_mensuales: number
  valid_from:      string       // YYYY-MM-DD
  valid_to:        string | null // YYYY-MM-DD or null = still active
}

/**
 * Returns the salary/hours that were active for a given user on a given date.
 * Falls back to null if no matching record exists (caller should use current profile as fallback).
 */
export function salaryAt(
  history: SalaryRecord[],
  userId: string,
  fecha: string   // YYYY-MM-DD
): { salario_mensual: number; horas_mensuales: number } | null {
  return (
    history.find(
      r =>
        r.user_id === userId &&
        r.valid_from <= fecha &&
        (r.valid_to === null || r.valid_to >= fecha)
    ) ?? null
  )
}

/**
 * Returns the sum of horas_mensuales for all team members active on a given date.
 * Used to compute the historically-correct repercusión de costos fijos.
 */
export function hrsFacturablesAt(
  history: SalaryRecord[],
  fecha: string
): number {
  const userIds = Array.from(new Set(history.map(r => r.user_id)))
  return userIds.reduce((sum, userId) => {
    const record = history.find(
      r =>
        r.user_id === userId &&
        r.valid_from <= fecha &&
        (r.valid_to === null || r.valid_to >= fecha)
    )
    return sum + (record?.horas_mensuales ?? 0)
  }, 0)
}

/**
 * Returns the cost per hour for a time entry, using the historically-correct
 * salary for that date.  Falls back to `currentCostPerHour` when no history
 * record covers the date (e.g. entries predating the history table).
 */
export function historicalCostPerHour(
  history: SalaryRecord[],
  userId: string,
  fecha: string,
  currentCostPerHour: number,
  repercusion: number
): number {
  const record = salaryAt(history, userId, fecha)
  if (!record) return currentCostPerHour
  return record.salario_mensual / record.horas_mensuales + repercusion
}

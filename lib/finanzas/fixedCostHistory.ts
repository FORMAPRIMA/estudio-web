/**
 * Historical fixed-cost lookup helper.
 *
 * Fixed cost changes (rent increases, new subscriptions, etc.) are tracked in
 * `costos_fijos_historia` with valid_from / valid_to date ranges — the same
 * pattern used for salary history.  This ensures that the repercusión applied
 * to a time entry always reflects the fixed costs that were active on the date
 * the work was logged, so past project margins never change when costs change.
 */

import type { SalaryRecord } from './salaryHistory'
import { hrsFacturablesAt } from './salaryHistory'

const IVA = 0.21

export interface FixedCostRecord {
  concepto:   string
  monto:      number
  valid_from: string       // YYYY-MM-DD
  valid_to:   string | null // YYYY-MM-DD or null = still active
}

/**
 * Returns the sum of all fixed-cost montos (before IVA) active on a given date.
 */
export function totalFixedCostsAt(
  history: FixedCostRecord[],
  fecha: string
): number {
  return history
    .filter(r => r.valid_from <= fecha && (r.valid_to === null || r.valid_to >= fecha))
    .reduce((sum, r) => sum + r.monto, 0)
}

/**
 * Returns the historically-correct repercusión de costos fijos (€/hour) for a
 * given date, using both fixed-cost history and salary history to reconstruct
 * the exact formula that was in effect that day.
 *
 * Falls back to `fallbackRepercusion` when no salary history covers the date
 * (e.g. entries predating the history tables).
 */
export function repercusionAt(
  fixedHistory:      FixedCostRecord[],
  salaryHistory:     SalaryRecord[],
  fecha:             string,
  minoracion:        number,   // percentage, e.g. 15 for 15 %
  fallbackRepercusion: number
): number {
  const hrsFacturables = hrsFacturablesAt(salaryHistory, fecha)
  if (hrsFacturables === 0) return fallbackRepercusion

  const totalFijos = totalFixedCostsAt(fixedHistory, fecha) * (1 + IVA)
  const hrsEfect   = hrsFacturables * (1 - minoracion / 100)
  return hrsEfect > 0 ? totalFijos / hrsEfect : 0
}

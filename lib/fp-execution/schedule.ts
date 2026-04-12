// ── Parametric Schedule Calculator ───────────────────────────────────────────
// Pure function — no side effects. Used server-side (page.tsx) and client-side
// (schedule preview panel). Returns start dates for each phase.
//
// Algorithm:
//   1. Distribute unit durations proportionally within total project days.
//   2. Distribute phase durations proportionally within their unit's days.
//   3. Apply milestone constraints: if a phase "requires" milestone M,
//      its start date = max(parametric_start, end of last phase that "achieves" M).
//   Iterates twice to resolve cross-unit dependencies.

export interface SchedulePhase {
  id: string
  unit_id: string
  nombre: string
  orden: number
  duracion_pct: number               // % of unit's total time
  achieves: string[]                 // milestone ids this phase achieves
  requires: string[]                 // milestone ids this phase requires
}

export interface ScheduleMilestone {
  id: string
  nombre: string
  orden: number
}

export interface ScheduleUnit {
  id: string                         // template_unit_id
  nombre: string
  orden: number
  duracion_pct: number               // % of total project time
  phases: SchedulePhase[]
}

export interface PhaseScheduleEntry {
  startDate: Date
  endDate: Date
  durationDays: number
}

export type PhaseScheduleMap = Record<string, PhaseScheduleEntry> // keyed by phase.id

export function computeParametricSchedule(
  units: ScheduleUnit[],
  fechaInicio: Date,
  duracionSemanas: number,
): PhaseScheduleMap {
  const result: PhaseScheduleMap = {}
  if (duracionSemanas <= 0 || units.length === 0) return result

  const totalDays = duracionSemanas * 7
  const sorted = [...units].sort((a, b) => a.orden - b.orden)

  // ── Pass 1: parametric dates (ignore milestone constraints) ───────────────

  let unitOffsetDays = 0

  for (const unit of sorted) {
    const unitDays = (unit.duracion_pct / 100) * totalDays
    const unitStart = addDays(fechaInicio, unitOffsetDays)

    const sortedPhases = [...unit.phases].sort((a, b) => a.orden - b.orden)
    let phaseOffsetDays = 0

    for (const phase of sortedPhases) {
      const phaseDays = Math.max(1, (phase.duracion_pct / 100) * unitDays)
      const start = addDays(unitStart, phaseOffsetDays)
      const end   = addDays(start, phaseDays)

      result[phase.id] = { startDate: start, endDate: end, durationDays: phaseDays }
      phaseOffsetDays += phaseDays
    }

    unitOffsetDays += unitDays
  }

  // ── Pass 2: apply milestone constraints ───────────────────────────────────
  // Build milestone → achieved-by-phase map from pass 1 results.

  const milestoneEndDate: Record<string, Date> = {}

  for (const unit of sorted) {
    for (const phase of unit.phases) {
      const entry = result[phase.id]
      if (!entry) continue
      for (const mid of phase.achieves) {
        const prev = milestoneEndDate[mid]
        if (!prev || entry.endDate > prev) milestoneEndDate[mid] = entry.endDate
      }
    }
  }

  // Push start dates forward if milestone constraint fires.
  for (const unit of sorted) {
    const sortedPhases = [...unit.phases].sort((a, b) => a.orden - b.orden)
    let runningEnd: Date | null = null

    for (const phase of sortedPhases) {
      const entry = result[phase.id]
      if (!entry) continue

      // Constraint 1: milestone requires
      let minStart = entry.startDate
      for (const mid of phase.requires) {
        const mDate = milestoneEndDate[mid]
        if (mDate && mDate > minStart) minStart = mDate
      }

      // Constraint 2: within-unit sequential (can't start before previous phase ends)
      if (runningEnd && runningEnd > minStart) minStart = runningEnd

      if (minStart > entry.startDate) {
        const newEnd = addDays(minStart, entry.durationDays)
        result[phase.id] = { startDate: minStart, endDate: newEnd, durationDays: entry.durationDays }
        // Update milestone map for phases that come after
        for (const mid of phase.achieves) {
          const prev = milestoneEndDate[mid]
          if (!prev || newEnd > prev) milestoneEndDate[mid] = newEnd
        }
        runningEnd = newEnd
      } else {
        runningEnd = entry.endDate
      }
    }
  }

  return result
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + Math.round(days))
  return d
}

export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

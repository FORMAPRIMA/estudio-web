// ── CPM Schedule Calculator (días LABORABLES + interpolación por m²) ──────────
// Pure function — no side effects. Used server-side (page.tsx) and client-side
// (schedule preview panel). Returns start/end dates for each phase + totalDays.
//
// IMPORTANTE: todas las duraciones son DÍAS LABORABLES (Lun-Vie, sin festivos).
// Las fechas calculadas (startDate / endDate) saltan automáticamente fines de
// semana y festivos nacionales + Madrid. Ver businessDays.ts.
//
// Algorithm:
//   1. Chapter duration in días laborables is derived from min/max anchors:
//        - min = días laborables para un proyecto de 80 m²
//        - max = días laborables para un proyecto de 300 m²
//      Linear interpolation by project m². Clamped at both anchors.
//      Per-project override (chapterDaysOverrides) takes precedence.
//   2. Phase durations: (phase.duracion_pct / 100) × chapterDays — pcts son
//      pesos relativos dentro del capítulo.
//   3. Predecessor graph:
//        - Within a chapter: phases are sequential by orden.
//        - Across chapters: if phase P requires milestone M, P depends on every
//          phase that achieves M.
//   4. Forward pass (iterative): each phase's earliestStart = max(predecessor
//      end dates). Phases with no predecessors start at day 0.
//   5. Total project duration = latest endDate (en días laborables).
//      Las fechas reales se calculan saltando fines de semana y festivos.

import { addBusinessDays, snapToNextBusinessDay } from './businessDays'

export const M2_MIN = 80
export const M2_MAX = 300

export interface SchedulePhase {
  id: string
  chapter_id: string
  nombre: string
  orden: number
  duracion_pct: number               // % of chapter's days
  achieves: string[]                 // milestone ids this phase achieves
  requires: string[]                 // milestone ids this phase requires
}

export interface ScheduleMilestone {
  id: string
  nombre: string
  orden: number
}

export interface ScheduleChapter {
  id: string                         // template_chapter_id
  nombre: string
  orden: number
  duracion_dias_min: number | null   // días estimados para proyecto de 80 m²
  duracion_dias_max: number | null   // días estimados para proyecto de 300 m²
  phases: SchedulePhase[]
}

export interface PhaseScheduleEntry {
  startDate: Date
  endDate: Date
  durationDays: number
}

export type PhaseScheduleMap = Record<string, PhaseScheduleEntry> // keyed by phase.id

export interface ScheduleResult {
  phases: PhaseScheduleMap
  totalDays: number                  // duración total computada (días)
  chapterDays: Record<string, number> // chapter_id → días computados (con override aplicado si existe)
}

/**
 * Días estimados para un capítulo en un proyecto dado.
 * - Si hay override, lo usa tal cual.
 * - Si no hay min/max, devuelve 0 (capítulo sin configurar).
 * - Si no hay m², usa el midpoint (promedio min/max).
 * - Si hay m², interpola linealmente con clamp en los bordes.
 */
/**
 * Días estimados para un capítulo en un proyecto dado.
 * - Si hay override, lo usa tal cual (el factor NO se aplica al override).
 * - Si no hay override y hay rango min/max, interpola por m² y luego multiplica por el factor.
 * - factor: multiplicador global del proyecto (default 1.0). Solo afecta a capítulos sin override.
 */
export function computeChapterDays(
  ch: { duracion_dias_min: number | null; duracion_dias_max: number | null },
  m2: number | null,
  override: number | null,
  factor: number = 1.0,
): number {
  if (override != null) return override
  const min = ch.duracion_dias_min
  const max = ch.duracion_dias_max
  if (min == null || max == null) return 0

  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1.0
  if (m2 == null) return ((min + max) / 2) * safeFactor

  const clamped = Math.max(M2_MIN, Math.min(M2_MAX, m2))
  const t = (clamped - M2_MIN) / (M2_MAX - M2_MIN)
  return (min + t * (max - min)) * safeFactor
}

export function computeParametricSchedule(
  chapters: ScheduleChapter[],
  fechaInicio: Date,
  m2: number | null,
  chapterDaysOverrides: Record<string, number | null> = {},
  factor: number = 1.0,
): ScheduleResult {
  const result: PhaseScheduleMap = {}
  const chapterDays: Record<string, number> = {}
  if (chapters.length === 0) return { phases: result, totalDays: 0, chapterDays }

  const sorted = [...chapters].sort((a, b) => a.orden - b.orden)

  // ── Step 1: Compute chapter days (interpolation + override + factor global)
  const phaseDuration: Record<string, number> = {}
  for (const ch of sorted) {
    const chDays = computeChapterDays(ch, m2, chapterDaysOverrides[ch.id] ?? null, factor)
    chapterDays[ch.id] = chDays
    for (const ph of ch.phases) {
      phaseDuration[ph.id] = ((ph.duracion_pct || 0) / 100) * chDays
    }
  }

  // ── Step 2: Build milestone → achievers map ───────────────────────────────────
  const milestoneAchievers: Record<string, string[]> = {}
  for (const ch of sorted) {
    for (const ph of ch.phases) {
      for (const mid of ph.achieves) {
        milestoneAchievers[mid] = [...(milestoneAchievers[mid] ?? []), ph.id]
      }
    }
  }

  // ── Step 3: Build predecessor sets ───────────────────────────────────────────
  const allPhases: SchedulePhase[] = sorted.flatMap(ch =>
    [...ch.phases].sort((a, b) => a.orden - b.orden)
  )
  const allPhaseIds = new Set(allPhases.map(p => p.id))
  const predecessors: Record<string, Set<string>> = {}
  for (const ph of allPhases) predecessors[ph.id] = new Set()

  // Within-chapter: each phase depends on the previous phase (by orden)
  for (const ch of sorted) {
    const phases = [...ch.phases].sort((a, b) => a.orden - b.orden)
    for (let i = 1; i < phases.length; i++) {
      predecessors[phases[i].id].add(phases[i - 1].id)
    }
  }

  // Cross-chapter: via milestone requires
  for (const ph of allPhases) {
    for (const mid of ph.requires) {
      for (const achieverId of (milestoneAchievers[mid] ?? [])) {
        if (achieverId !== ph.id && allPhaseIds.has(achieverId)) {
          predecessors[ph.id].add(achieverId)
        }
      }
    }
  }

  // ── Step 4: Forward pass (iterative until convergence) ────────────────────────
  const earliestStart: Record<string, number> = {}
  for (const ph of allPhases) earliestStart[ph.id] = 0

  let changed = true
  let guard = 0
  const maxIterations = allPhases.length + 10
  while (changed && guard++ < maxIterations) {
    changed = false
    for (const ph of allPhases) {
      let minStart = 0
      for (const predId of Array.from(predecessors[ph.id])) {
        const predEnd = (earliestStart[predId] ?? 0) + (phaseDuration[predId] ?? 0)
        if (predEnd > minStart) minStart = predEnd
      }
      if (minStart > (earliestStart[ph.id] ?? 0)) {
        earliestStart[ph.id] = minStart
        changed = true
      }
    }
  }

  // ── Step 5: Build result + compute totalDays (business days) ─────────────────
  // Las fechas se calculan en calendario real saltando finde y festivos.
  // Si fechaInicio cae en finde/festivo, se "snapea" al siguiente día laborable.
  const startAnchor = snapToNextBusinessDay(fechaInicio)
  let totalDays = 0
  for (const ph of allPhases) {
    const start = earliestStart[ph.id] ?? 0
    const dur   = phaseDuration[ph.id] ?? 0
    const end   = start + dur
    if (end > totalDays) totalDays = end
    result[ph.id] = {
      startDate:    addBusinessDays(startAnchor, start),
      endDate:      addBusinessDays(startAnchor, end),
      durationDays: dur,
    }
  }

  return { phases: result, totalDays, chapterDays }
}

export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

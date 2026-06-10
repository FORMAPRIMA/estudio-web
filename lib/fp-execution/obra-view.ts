// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Obra view helpers
//
// Lógica de derivación canónica para presentar el cronograma vivo de obra.
// Cualquier vista (Gantt, lista cronológica, futuras) consume estos helpers
// para garantizar que muestran exactamente los mismos valores ante los mismos
// datos. Único punto de cambio para reglas de fallback actual/planned, colores
// de status, formateo de fechas y resolución de hitos.
// ══════════════════════════════════════════════════════════════════════════════

import type { ObraPhase, ObraMilestone, ObraPhaseStatus } from './obra'

// ── Colores por status ────────────────────────────────────────────────────────
export const STATUS_STYLE: Record<ObraPhaseStatus, { fill: string; border: string; label: string }> = {
  pendiente:  { fill: '#E8E6E0', border: '#C9C5BD', label: 'Pendiente'  },
  en_curso:   { fill: '#378ADD', border: '#1B6BC3', label: 'En curso'   },
  completada: { fill: '#059669', border: '#047857', label: 'Completada' },
  bloqueada:  { fill: '#DC2626', border: '#991B1B', label: 'Bloqueada'  },
}

// ── Fechas ────────────────────────────────────────────────────────────────────
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export function getTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

// ── Resolución de fechas de una fase ──────────────────────────────────────────
export interface ResolvedPhaseDates {
  start:    Date | null
  end:      Date | null
  isActual: boolean        // true si alguna fecha viene de actual_*
  duration: number | null  // actual_duration_dias ?? planned_duration_dias
}

/**
 * Regla canónica: actual_* sobreescribe planned_*. Cualquier vista que muestre
 * fechas de una fase DEBE pasar por aquí. No duplicar la lógica.
 */
export function resolvePhaseDates(ph: ObraPhase): ResolvedPhaseDates {
  const aStart = parseISODate(ph.actual_start_date)
  const aEnd   = parseISODate(ph.actual_end_date)
  const pStart = parseISODate(ph.planned_start_date)
  const pEnd   = parseISODate(ph.planned_end_date)
  return {
    start:    aStart ?? pStart,
    end:      aEnd   ?? pEnd,
    isActual: !!(aStart || aEnd),
    duration: ph.actual_duration_dias ?? ph.planned_duration_dias ?? null,
  }
}

// ── Orden cronológico ─────────────────────────────────────────────────────────
/**
 * Orden cronológico canónico. Criterio: fecha efectiva de inicio (actual ??
 * planned) ascendente, empate por orden. Fases sin fecha al final (también por
 * orden) para que no rompan la lista cuando aún no están programadas.
 */
export function sortPhasesChronological(phases: ObraPhase[]): ObraPhase[] {
  return [...phases].sort((a, b) => {
    const da = resolvePhaseDates(a).start
    const db = resolvePhaseDates(b).start
    if (da && db) {
      const diff = da.getTime() - db.getTime()
      if (diff !== 0) return diff
      return a.orden - b.orden
    }
    if (da) return -1
    if (db) return 1
    return a.orden - b.orden
  })
}

// ── Retraso ───────────────────────────────────────────────────────────────────
export interface PhaseDelay {
  days:   number
  reason: 'overrun' | 'unstarted'
}

/**
 * Días de retraso de una fase respecto a su plan. Regla:
 *   - 'unstarted': pendiente y planned_start_date pasó.
 *   - 'overrun':   en curso y planned_end_date pasó.
 *   - completada y bloqueada: null (la primera ya está; la segunda tiene su
 *     propio canal visual).
 * today se recibe como parámetro para que llamadas en paralelo (Gantt + lista)
 * usen el mismo instante de referencia.
 */
export function getPhaseDelay(ph: ObraPhase, todayUTC: Date): PhaseDelay | null {
  if (ph.status === 'completada' || ph.status === 'bloqueada') return null
  const today = todayUTC.getTime()
  if (ph.status === 'pendiente') {
    const ps = parseISODate(ph.planned_start_date)
    if (ps && ps.getTime() < today) {
      return { days: Math.floor((today - ps.getTime()) / 86400000), reason: 'unstarted' }
    }
  }
  if (ph.status === 'en_curso') {
    const pe = parseISODate(ph.planned_end_date)
    if (pe && pe.getTime() < today) {
      return { days: Math.floor((today - pe.getTime()) / 86400000), reason: 'overrun' }
    }
  }
  return null
}

// ── Resolución de hitos ───────────────────────────────────────────────────────
export interface ResolvedMilestone {
  id:           string
  nombre:       string
  achieved:     boolean      // !!actual_date
  date:         Date | null  // actual si achieved, planned si no
  es_hito_pago: boolean
}

export function resolveMilestone(id: string, milestones: ObraMilestone[]): ResolvedMilestone | null {
  const m = milestones.find(x => x.id === id)
  if (!m) return null
  const achieved = !!m.actual_date
  const date = achieved
    ? parseISODate(m.actual_date)
    : parseISODate(m.planned_date)
  return {
    id: m.id,
    nombre: m.nombre,
    achieved,
    date,
    es_hito_pago: m.es_hito_pago,
  }
}

/** Hitos que deben estar logrados para que la fase pueda empezar (requires). */
export function resolveTriggers(ph: ObraPhase, milestones: ObraMilestone[]): ResolvedMilestone[] {
  return ph.requires
    .map(id => resolveMilestone(id, milestones))
    .filter((m): m is ResolvedMilestone => m !== null)
}

/** Hitos que la fase logra al completarse (achieves). */
export function resolveAchievements(ph: ObraPhase, milestones: ObraMilestone[]): ResolvedMilestone[] {
  return ph.achieves
    .map(id => resolveMilestone(id, milestones))
    .filter((m): m is ResolvedMilestone => m !== null)
}

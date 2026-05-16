// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Server-side schedule loader for contract generation.
//
// Loads the same inputs the project page builds (scheduleChapters, m2,
// duración factor, chapter day overrides) plus the effective obra start date,
// so the Orden de Ejecución PDF can render real start/end dates per chapter
// instead of just durations.
//
// The effective start date is: obra_start_date_override ?? fecha_inicio_obra.
//
// This helper is server-only — do not import from client components.
// ══════════════════════════════════════════════════════════════════════════════

import type { createAdminClient } from '@/lib/supabase/admin'
import type { FpeOverviewPartner } from '@/app/actions/fpe-tenders'
import {
  computeAwardedSchedule,
  type ScheduleChapter,
  type AwardedPhaseDuration,
  type ProjectUnitChapterMap,
} from '@/lib/fp-execution/schedule'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export interface ProjectScheduleInputs {
  scheduleChapters:     ScheduleChapter[]
  fechaInicio:          string | null   // effective: override ?? parametric
  m2:                   number | null
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor:       number
}

/**
 * Loads everything needed to run computeAwardedSchedule for a project.
 * Mirrors the loading logic of app/team/fp-execution/projects/[id]/page.tsx
 * but lives in lib so it can be called from API routes + server actions.
 */
export async function loadProjectScheduleInputs(
  admin: SupabaseAdmin,
  project_id: string,
): Promise<ProjectScheduleInputs | null> {
  // ── Project (start date + m2 + factor) ────────────────────────────────────
  const { data: project } = await admin
    .from('fpe_projects')
    .select(`
      id, fecha_inicio_obra, obra_start_date_override,
      m2_construccion, duracion_factor,
      project_units:fpe_project_units(template_unit_id)
    `)
    .eq('id', project_id)
    .single()

  if (!project) return null

  type ProjectRow = {
    fecha_inicio_obra:        string | null
    obra_start_date_override: string | null
    m2_construccion:          number | null
    duracion_factor:          number | null
    project_units:            { template_unit_id: string }[]
  }
  const p = project as unknown as ProjectRow

  const fechaInicio    = p.obra_start_date_override ?? p.fecha_inicio_obra ?? null
  const m2             = p.m2_construccion ?? null
  const duracionFactor = p.duracion_factor ?? 1.0
  const scopedTemplateUnitIds = (p.project_units ?? []).map(pu => pu.template_unit_id)

  // ── Active template chapters (with their units to derive scope) ───────────
  const { data: chapters } = await admin
    .from('fpe_template_chapters')
    .select(`
      id, nombre, orden, duracion_pct, duracion_dias_min, duracion_dias_max,
      units:fpe_template_units(id, activo)
    `)
    .eq('activo', true)
    .order('orden', { ascending: true })

  type ChapterRow = {
    id: string; nombre: string; orden: number
    duracion_dias_min: number | null
    duracion_dias_max: number | null
    units: { id: string; activo: boolean }[]
  }
  const allChapters = (chapters ?? []) as unknown as ChapterRow[]

  // Scoped chapters: those with at least one unit in scope
  const scopedChapterIds = Array.from(new Set(
    allChapters
      .filter(ch => ch.units.some(u => scopedTemplateUnitIds.includes(u.id)))
      .map(ch => ch.id)
  ))

  if (scopedChapterIds.length === 0) {
    return { scheduleChapters: [], fechaInicio, m2, chapterDaysOverrides: {}, duracionFactor }
  }

  // ── Phases (chapter-level) + milestone links + chapter settings ───────────
  const [{ data: phasesRaw }, { data: phaseLinksRaw }, { data: chapterSettings }] = await Promise.all([
    admin
      .from('fpe_template_phases')
      .select('id, chapter_id, nombre, orden, duracion_pct')
      .in('chapter_id', scopedChapterIds)
      .order('orden', { ascending: true }),
    admin
      .from('fpe_template_phase_milestone_links')
      .select('phase_id, milestone_id, link_type'),
    admin
      .from('fpe_project_chapter_settings')
      .select('chapter_id, duracion_dias_override')
      .eq('project_id', project_id),
  ])

  type PhaseRow = { id: string; chapter_id: string | null; nombre: string; orden: number; duracion_pct: number | null }
  type LinkRow  = { phase_id: string; milestone_id: string; link_type: 'achieves' | 'requires' }
  type CSRow    = { chapter_id: string; duracion_dias_override: number | null }

  const achievesMap: Record<string, string[]> = {}
  const requiresMap: Record<string, string[]> = {}
  for (const link of (phaseLinksRaw ?? []) as LinkRow[]) {
    if (link.link_type === 'achieves') achievesMap[link.phase_id] = [...(achievesMap[link.phase_id] ?? []), link.milestone_id]
    else                                requiresMap[link.phase_id] = [...(requiresMap[link.phase_id] ?? []), link.milestone_id]
  }

  const chapterDaysOverrides: Record<string, number | null> = {}
  for (const cs of (chapterSettings ?? []) as CSRow[]) {
    chapterDaysOverrides[cs.chapter_id] = cs.duracion_dias_override ?? null
  }

  const phasesByChapter: Record<string, PhaseRow[]> = {}
  for (const ph of (phasesRaw ?? []) as PhaseRow[]) {
    if (!ph.chapter_id) continue
    phasesByChapter[ph.chapter_id] = [...(phasesByChapter[ph.chapter_id] ?? []), ph]
  }

  const scheduleChapters: ScheduleChapter[] = allChapters
    .filter(ch => scopedChapterIds.includes(ch.id))
    .map(ch => ({
      id:                ch.id,
      nombre:            ch.nombre,
      orden:             ch.orden,
      duracion_dias_min: ch.duracion_dias_min,
      duracion_dias_max: ch.duracion_dias_max,
      phases: (phasesByChapter[ch.id] ?? []).map(ph => ({
        id:           ph.id,
        chapter_id:   ph.chapter_id ?? ch.id,
        nombre:       ph.nombre,
        orden:        ph.orden,
        duracion_pct: ph.duracion_pct ?? 0,
        achieves:     achievesMap[ph.id] ?? [],
        requires:     requiresMap[ph.id] ?? [],
      })),
    }))

  return { scheduleChapters, fechaInicio, m2, chapterDaysOverrides, duracionFactor }
}

// ══════════════════════════════════════════════════════════════════════════════
// Per-phase schedule dates for a single partner.
// Drives Anexo III (Cronograma y Plazos) of the Orden de Ejecución PDF:
// one row per execution phase the partner has been awarded, with the
// duration the partner offered and the calendar dates computed from the
// Dream Team Gantt.
// ══════════════════════════════════════════════════════════════════════════════

export interface PhaseScheduleDates {
  template_phase_id: string
  fecha_inicio:      string    // ISO YYYY-MM-DD
  fecha_fin:         string    // ISO YYYY-MM-DD
  duracion_dias:     number    // business days from the schedule engine
}

/**
 * Runs computeAwardedSchedule for a single partner's package and returns the
 * calendar dates of every phase the partner executes (one entry per phase).
 *
 * Returns null when there is no effective start date (Dream Team Gantt
 * unavailable → PDF falls back to durations only, no dates).
 */
export function computePartnerPhaseDates(args: {
  inputs:   ProjectScheduleInputs
  pkg:      FpeOverviewPartner
}): PhaseScheduleDates[] | null {
  const { inputs, pkg } = args
  if (!inputs.fechaInicio || inputs.scheduleChapters.length === 0) return null

  const awardedDurations: AwardedPhaseDuration[] = []
  const unitChapters:     ProjectUnitChapterMap[] = []

  for (const ch of pkg.chapters) {
    if (!ch.chapter_id) continue
    for (const u of ch.units) {
      unitChapters.push({ project_unit_id: u.project_unit_id, chapter_id: ch.chapter_id })
      for (const pd of pkg.phase_durations) {
        if (pd.chapter_id !== ch.chapter_id) continue
        awardedDurations.push({
          template_phase_id: pd.template_phase_id,
          project_unit_id:   u.project_unit_id,
          partner_id:        pkg.partner_id,
          duracion_dias:     pd.duracion_dias,
        })
      }
    }
  }

  const startDate = new Date(inputs.fechaInicio)
  if (Number.isNaN(startDate.getTime())) return null

  const result = computeAwardedSchedule(
    inputs.scheduleChapters,
    startDate,
    inputs.m2,
    inputs.chapterDaysOverrides,
    inputs.duracionFactor,
    awardedDurations,
    unitChapters,
  )

  const partnerChapterIds = new Set(pkg.chapters.map(c => c.chapter_id).filter((id): id is string => !!id))
  const out: PhaseScheduleDates[] = []

  for (const ch of inputs.scheduleChapters) {
    if (!partnerChapterIds.has(ch.id)) continue
    for (const ph of ch.phases) {
      const entry = result.phases[ph.id]
      if (!entry) continue
      const partners = result.phasePartners[ph.id] ?? []
      if (!partners.includes(pkg.partner_id)) continue
      out.push({
        template_phase_id: ph.id,
        fecha_inicio:      entry.startDate.toISOString().slice(0, 10),
        fecha_fin:         entry.endDate.toISOString().slice(0, 10),
        duracion_dias:     Math.max(0, Math.round(entry.durationDays)),
      })
    }
  }
  return out
}

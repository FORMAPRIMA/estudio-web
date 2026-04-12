import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TemplatePage from '@/components/team/fp-execution/TemplatePage'

export default async function FpeTemplatePage() {
  const supabase  = await createClient()
  const admin     = createAdminClient()

  const [
    { data: chapters },
    { data: milestones },
    { data: phaseLinks },
    { data: disciplines },
  ] = await Promise.all([
    supabase
      .from('fpe_template_chapters')
      .select(`
        id, nombre, descripcion, orden, activo, duracion_pct, principal_discipline_id,
        phases:fpe_template_phases (
          id, chapter_id, nombre, descripcion, lead_time_days, duracion_pct, orden
        ),
        units:fpe_template_units (
          id, chapter_id, nombre, descripcion, orden, activo, principal_discipline_id,
          line_items:fpe_template_line_items (
            id, unit_id, nombre, descripcion, unidad_medida, orden, activo, discipline_id
          )
        )
      `)
      .order('orden', { ascending: true })
      .order('orden', { referencedTable: 'fpe_template_phases', ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units', ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units.fpe_template_line_items', ascending: true }),

    supabase
      .from('fpe_template_milestones')
      .select('id, nombre, descripcion, orden')
      .order('orden', { ascending: true }),

    // Phase-milestone links: fetch all at once, index client-side
    admin
      .from('fpe_template_phase_milestone_links')
      .select('phase_id, milestone_id, link_type'),

    // Disciplines
    supabase
      .from('fpe_disciplines')
      .select('id, nombre, descripcion, color, orden, activo')
      .order('orden', { ascending: true }),
  ])

  // Build per-phase link maps
  const achievesMap: Record<string, string[]> = {}
  const requiresMap: Record<string, string[]> = {}
  for (const link of phaseLinks ?? []) {
    if (link.link_type === 'achieves') {
      achievesMap[link.phase_id] = [...(achievesMap[link.phase_id] ?? []), link.milestone_id]
    } else {
      requiresMap[link.phase_id] = [...(requiresMap[link.phase_id] ?? []), link.milestone_id]
    }
  }

  // Attach achieves/requires to each chapter-level phase
  const chaptersWithLinks = (chapters ?? []).map(ch => ({
    ...ch,
    phases: ch.phases.map(ph => ({
      ...ph,
      achieves: achievesMap[ph.id] ?? [],
      requires: requiresMap[ph.id] ?? [],
    })),
  }))

  return (
    <TemplatePage
      initialChapters={chaptersWithLinks as Parameters<typeof TemplatePage>[0]['initialChapters']}
      initialMilestones={milestones ?? []}
      initialDisciplines={(disciplines ?? []) as Parameters<typeof TemplatePage>[0]['initialDisciplines']}
    />
  )
}

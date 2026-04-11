import { createClient } from '@/lib/supabase/server'
import TemplatePage from '@/components/team/fp-execution/TemplatePage'

export default async function FpeTemplatePage() {
  const supabase = await createClient()

  // Fetch full template tree
  const { data: chapters } = await supabase
    .from('fpe_template_chapters')
    .select(`
      id, nombre, descripcion, orden, activo,
      units:fpe_template_units (
        id, chapter_id, nombre, descripcion, orden, activo,
        line_items:fpe_template_line_items (
          id, unit_id, nombre, descripcion, unidad_medida, orden, activo
        ),
        phases:fpe_template_phases (
          id, unit_id, nombre, descripcion, lead_time_days, orden
        )
      )
    `)
    .order('orden', { ascending: true })
    .order('orden', { referencedTable: 'fpe_template_units', ascending: true })
    .order('orden', { referencedTable: 'fpe_template_units.fpe_template_line_items', ascending: true })
    .order('orden', { referencedTable: 'fpe_template_units.fpe_template_phases', ascending: true })

  return <TemplatePage initialChapters={chapters ?? []} />
}

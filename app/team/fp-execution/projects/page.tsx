import { createClient } from '@/lib/supabase/server'
import ProjectsPage from '@/components/team/fp-execution/ProjectsPage'

export default async function FpeProjectsPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: linkedProyectos }] = await Promise.all([
    supabase
      .from('fpe_projects')
      .select(`
        id, nombre, descripcion, direccion, ciudad,
        linked_proyecto_id, status, readiness_score, created_at
      `)
      .order('created_at', { ascending: false }),

    // For the linked project dropdown
    supabase
      .from('proyectos')
      .select('id, nombre, codigo')
      .order('nombre', { ascending: true }),
  ])

  return (
    <ProjectsPage
      initialProjects={projects ?? []}
      linkedProyectos={linkedProyectos ?? []}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import ExecutionProjectsPage from '@/components/team/fp-execution/ExecutionProjectsPage'
import type { ExistingProject, Partner } from '@/components/team/fp-execution/ExecutionProjectsPage'

export default async function Page() {
  const supabase = await createClient()

  let existingProjects: ExistingProject[] = []
  let executionPartners: Partner[] = []

  try {
    const { data } = await supabase
      .from('proyectos')
      .select('id, nombre, cliente, direccion, ciudad')
      .order('created_at', { ascending: false })
    if (data) existingProjects = data
  } catch {}

  try {
    const { data } = await supabase
      .from('execution_partners')
      .select('id, nombre')
      .order('nombre')
    if (data) executionPartners = data
  } catch {}

  return (
    <ExecutionProjectsPage
      existingProjects={existingProjects}
      executionPartners={executionPartners}
    />
  )
}

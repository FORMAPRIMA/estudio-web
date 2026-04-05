import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExecutionProjectsPage from '@/components/team/fp-execution/ExecutionProjectsPage'
import type { ExistingProject, Partner } from '@/components/team/fp-execution/ExecutionProjectsPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  let existingProjects: ExistingProject[] = []
  let executionPartners: Partner[] = []

  // Use admin client so the clientes join is not blocked by RLS
  try {
    const { data } = await admin
      .from('proyectos')
      .select('id, nombre, direccion, clientes!cliente_id(nombre), proyecto_clientes(rol, clientes!cliente_id(nombre))')
      .order('created_at', { ascending: false })

    if (data) {
      existingProjects = data.map((p: any) => {
        const clienteDirecto = (p.clientes as any)?.nombre ?? ''
        const junction: any[] = Array.isArray(p.proyecto_clientes) ? p.proyecto_clientes : []
        const titular = junction.find((j: any) => j.rol === 'titular') ?? junction[0]
        const clienteJunction = (titular?.clientes as any)?.nombre ?? ''
        return {
          id: p.id,
          nombre: p.nombre,
          cliente: clienteDirecto || clienteJunction,
          direccion: p.direccion ?? '',
        }
      })
    }
  } catch (e) {
    console.error('Error loading proyectos:', e)
  }

  try {
    const { data } = await admin
      .from('execution_partners')
      .select('id, nombre, especialidades')
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

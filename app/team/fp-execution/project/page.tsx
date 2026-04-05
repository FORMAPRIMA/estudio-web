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
      .select('id, nombre, direccion, cliente_directo:clientes!cliente_id(nombre), proyecto_clientes(rol, cliente:clientes!cliente_id(nombre))')
      .order('created_at', { ascending: false })

    if (data) {
      existingProjects = data.map((p: any) => {
        const clienteDirecto = p.cliente_directo?.nombre ?? ''
        const junction: any[] = Array.isArray(p.proyecto_clientes) ? p.proyecto_clientes : []
        const titular = junction.find((j: any) => j.rol === 'titular') ?? junction[0]
        const clienteJunction = titular?.cliente?.nombre ?? ''
        return {
          id: p.id,
          nombre: p.nombre,
          cliente: clienteDirecto || clienteJunction,
          direccion: p.direccion ?? '',
        }
      })
    }
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

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProyectoDetalle from '@/components/team/proyectos/ProyectoDetalle'
import type { ProyectoInterno, Task, CatalogoFase, UserProfile } from '@/lib/types'
import type { Titular, ClienteOption } from '@/components/team/proyectos/TitularesSection'

export const dynamic = 'force-dynamic'

export default async function ProyectoDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: proyectoRaw } = await supabase
    .from('proyectos')
    .select(`
      id, nombre, codigo, direccion, imagen_url, superficie_diseno,
      superficie_catastral, superficie_util, cliente_id, constructor_id, status,
      created_by, created_at,
      clientes!cliente_id(id, nombre),
      proyecto_fases(
        id, fase_id, responsables, status, horas_objetivo, fase_status,
        catalogo_fases(id, numero, label, seccion, orden, ratio)
      )
    `)
    .eq('id', params.id)
    .single()

  if (!proyectoRaw) notFound()

  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select(`
      id, codigo, titulo, descripcion, proyecto_id, fase_id,
      responsable_ids, status, orden_urgencia, prioridad, created_at, fecha_limite,
      catalogo_fases(id, numero, label, seccion, orden)
    `)
    .eq('proyecto_id', params.id)
    .order('orden_urgencia')

  const { data: catalogoFases } = await supabase
    .from('catalogo_fases')
    .select('id, numero, label, seccion, orden, ratio')
    .order('orden')

  const admin = createAdminClient()

  const { data: teamMembers } = await admin
    .from('profiles')
    .select('id, nombre, rol, email, avatar_url')
    .neq('rol', 'cliente')
    .order('nombre')
  const [{ data: clientes }, { data: titularesRaw }, { data: proveedoresRaw }] = await Promise.all([
    admin
      .from('clientes')
      .select('id, nombre, apellidos, empresa')
      .order('nombre'),
    supabase
      .from('proyecto_clientes')
      .select('cliente_id, rol, clientes(nombre, apellidos, empresa)')
      .eq('proyecto_id', params.id),
    admin
      .from('proveedores')
      .select('id, nombre')
      .order('nombre'),
  ])

  const titulares: Titular[] = (titularesRaw ?? []).map((t: any) => ({
    cliente_id: t.cliente_id,
    rol:        t.rol,
    clientes:   t.clientes ?? { nombre: 'Cliente', apellidos: null, empresa: null },
  }))

  const proveedores = (proveedoresRaw ?? []).map(p => ({ id: p.id as string, nombre: p.nombre as string }))

  return (
    <ProyectoDetalle
      proyecto={proyectoRaw as unknown as ProyectoInterno}
      tasks={(tasksRaw ?? []) as unknown as Task[]}
      catalogoFases={(catalogoFases ?? []) as CatalogoFase[]}
      teamMembers={(teamMembers ?? []) as UserProfile[]}
      clientes={(clientes ?? []) as ClienteOption[]}
      titulares={titulares}
      proveedores={proveedores}
      currentUserRole={profile.rol}
    />
  )
}

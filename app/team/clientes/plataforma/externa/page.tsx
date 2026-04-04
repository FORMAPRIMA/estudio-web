import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PlataformaExternaPage from '@/components/team/clientes/PlataformaExternaPage'

export const metadata = { title: 'Vista del cliente · Plataforma obras' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_team'].includes(profile.rol))
    redirect('/team/dashboard')

  const admin = createAdminClient()

  const [{ data: proyectos }, { data: actualizaciones }] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, imagen_url, status, clientes!cliente_id(id, nombre)')
      .in('status', ['activo', 'on_hold'])
      .order('nombre'),
    admin
      .from('proyecto_actualizaciones')
      .select('id, proyecto_id, tipo, titulo, contenido, fecha, visible_cliente')
      .eq('visible_cliente', true)
      .order('fecha', { ascending: false }),
  ])

  return (
    <PlataformaExternaPage
      proyectos={proyectos ?? []}
      actualizaciones={actualizaciones ?? []}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PlataformaInternaPage from '@/components/team/clientes/PlataformaInternaPage'

export const metadata = { title: 'Plataforma interna de obras' }

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

  const { data: proyectos } = await admin
    .from('proyectos')
    .select(`
      id, nombre, codigo, imagen_url, status,
      clientes!cliente_id(id, nombre),
      proyecto_actualizaciones(id, visible_cliente, fecha)
    `)
    .in('status', ['activo', 'on_hold'])
    .order('nombre')

  return <PlataformaInternaPage proyectos={proyectos ?? []} />
}

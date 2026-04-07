import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LeadsPage from '@/components/team/captacion/LeadsPage'

export const metadata = { title: 'Leads · Captación' }
export const dynamic  = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()
  const [{ data: leads }, { data: tokens }] = await Promise.all([
    admin
      .from('leads')
      .select('id, nombre, apellidos, empresa, email, telefono, ciudad, origen, estado_lead, interes, presupuesto_estimado, notas, nif_cif, documento_identidad, email_cc, telefono_alt, direccion, codigo_postal, pais, direccion_facturacion, notas_facturacion, tipo_facturacion, fecha_nacimiento')
      .order('nombre', { ascending: true }),
    admin
      .from('bienvenida_tokens')
      .select('id, token, nombre_cliente, nota_interna, used, created_at, primer_acceso, num_accesos')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  return <LeadsPage leads={leads ?? []} tokens={tokens ?? []} />
}

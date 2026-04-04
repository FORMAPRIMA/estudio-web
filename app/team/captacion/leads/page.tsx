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
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()
  const { data: leads } = await admin
    .from('leads')
    .select('id, nombre, apellidos, empresa, email, telefono, ciudad, origen, estado_lead, interes, presupuesto_estimado, notas, nif_cif, documento_identidad, email_cc, telefono_alt, direccion, codigo_postal, pais, direccion_facturacion, notas_facturacion, tipo_facturacion, fecha_nacimiento')
    .order('nombre', { ascending: true })

  return <LeadsPage leads={leads ?? []} />
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LeadsPage from '@/components/team/captacion/LeadsPage'
import ContactosIncompletos from '@/components/team/captacion/ContactosIncompletos'
import { getContactosIncompletos } from '@/app/actions/contacto'

export const metadata = { title: 'Leads · Captación' }
export const dynamic  = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()
  const [{ data: leads }, { data: espacios }, { data: propuestas }, { data: contratos }, { data: clientes }] = await Promise.all([
    admin
      .from('leads')
      .select('id, nombre, apellidos, empresa, email, telefono, ciudad, origen, estado_lead, interes, presupuesto_estimado, notas, nif_cif, documento_identidad, email_cc, telefono_alt, direccion, codigo_postal, pais, direccion_facturacion, notas_facturacion, tipo_facturacion, fecha_nacimiento')
      .order('nombre', { ascending: true }),
    admin
      .from('espacios')
      .select('id, token, nombre, email, idioma, etapa, nota_interna, created_at, lead_id, cliente_id, primer_acceso, num_accesos, accesos, eventos')
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('propuestas')
      .select('id, numero, status, titulo, lead_id, cliente_id, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('contratos')
      .select('id, numero, status, lead_id, cliente_id, propuesta_id, cliente_nombre, fecha_envio, fecha_firma, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('clientes')
      .select('id, nombre, apellidos, empresa, email')
      .order('nombre', { ascending: true }),
  ])

  const parciales = await getContactosIncompletos()

  return (
    <>
      <div style={{ padding: '20px 24px 0' }}>
        <ContactosIncompletos parciales={parciales} />
      </div>
      <LeadsPage
      leads={leads ?? []}
      espacios={espacios ?? []}
      propuestas={propuestas ?? []}
      contratos={contratos ?? []}
      clientes={clientes ?? []}
      />
    </>
  )
}

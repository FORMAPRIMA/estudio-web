import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ContratosPage from '@/components/team/captacion/ContratosPage'

export const metadata = { title: 'Contratos · Captación' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()
  const [{ data: contratos }, { data: leads }, { data: clientes }, { data: propuestas }] = await Promise.all([
    admin
      .from('contratos')
      .select('id, numero, status, cliente_nombre, cliente_empresa, proyecto_nombre, proyecto_direccion, fecha_envio, fecha_firma, honorarios, lead_id, proyecto_id, created_at')
      .order('created_at', { ascending: false }),
    admin.from('leads').select('id, nombre, apellidos, empresa').order('nombre'),
    admin.from('clientes').select('id, nombre, apellidos, empresa').order('nombre'),
    admin
      .from('propuestas')
      .select('id, numero, titulo, status, lead_id')
      .neq('numero', 'BORRADOR')
      .order('numero', { ascending: false }),
  ])

  const contactos = [
    ...(leads ?? []).map(l => ({ ...l, source: 'lead' as const })),
    ...(clientes ?? []).map(c => ({ ...c, source: 'cliente' as const })),
  ]

  return <ContratosPage contratos={contratos ?? []} contactos={contactos} propuestas={propuestas ?? []} />
}

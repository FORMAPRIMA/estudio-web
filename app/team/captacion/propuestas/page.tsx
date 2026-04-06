import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PropuestasPage from '@/components/team/captacion/PropuestasPage'

export const metadata = { title: 'Propuestas · Captación' }
export const dynamic  = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()
  const [{ data: propuestas }, { data: leads }, { data: clientes }] = await Promise.all([
    admin
      .from('propuestas')
      .select('id, numero, status, titulo, fecha_propuesta, lead_id, cliente_id, leads(nombre, apellidos, empresa), clientes!cliente_id(nombre, apellidos, empresa)')
      .order('created_at', { ascending: false }),
    admin.from('leads').select('id, nombre, apellidos, empresa').order('nombre'),
    admin.from('clientes').select('id, nombre, apellidos, empresa').order('nombre'),
  ])

  const contactos = [
    ...(leads ?? []).map(l => ({ ...l, source: 'lead' as const })),
    ...(clientes ?? []).map(c => ({ ...c, source: 'cliente' as const })),
  ]

  return (
    <PropuestasPage
      propuestas={(propuestas ?? []) as unknown as Parameters<typeof PropuestasPage>[0]['propuestas']}
      contactos={contactos}
    />
  )
}

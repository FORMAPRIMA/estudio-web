import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'
import InfoEmpresaPage from '@/components/team/finanzas/InfoEmpresaPage'

export const metadata = { title: 'Información empresa · Facturación' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const config = await getEstudioConfig()

  return <InfoEmpresaPage config={config} />
}

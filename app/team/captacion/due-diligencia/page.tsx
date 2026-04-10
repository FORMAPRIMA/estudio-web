import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DueDiligenciaPage from '@/components/team/captacion/DueDiligenciaPage'

export const metadata = { title: 'Due Diligence Técnica · Captación' }
export const dynamic  = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  return <DueDiligenciaPage />
}

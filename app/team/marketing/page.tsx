import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketingPage } from '@/components/team/MarketingPage'
import { getAccesoRetribucion } from '@/lib/retribucion-data'

export const metadata = { title: 'Marketing' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) {
    redirect('/team/dashboard')
  }

  return <MarketingPage showRetribucion={!!(await getAccesoRetribucion())} />
}

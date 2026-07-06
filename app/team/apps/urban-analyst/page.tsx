import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import UrbanAnalystPage from '@/components/team/urban-analyst/UrbanAnalystPage'
import type { UrbanAsset, NormaZonal } from '@/lib/urban-analyst/types'

export const metadata = { title: 'Urban Analyst' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner','fp_manager'].indexOf(profile.rol) === -1) redirect('/team/apps')

  const admin = createAdminClient()
  const [{ data: assets }, { data: normas }] = await Promise.all([
    admin.from('urban_assets').select('*').order('created_at', { ascending: false }),
    admin.from('urban_normas_zonales').select('*').order('codigo'),
  ])

  return (
    <UrbanAnalystPage
      initialAssets={(assets || []) as UrbanAsset[]}
      normasZonales={(normas || []) as NormaZonal[]}
    />
  )
}

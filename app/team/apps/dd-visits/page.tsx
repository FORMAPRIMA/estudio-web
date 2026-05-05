import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import DdDashboard from '@/components/team/dd-visits/DdDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'DD Técnica' }

export default async function DdVisitsDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const admin = createAdminClient()

  const [{ data: assets }, { data: visits }, { data: cards }] = await Promise.all([
    admin.from('dd_assets').select('*').order('created_at', { ascending: false }),
    admin.from('dd_visits').select('id, asset_id, fecha, status'),
    admin.from('dd_cards').select('id, asset_id, estado, riesgo, activo').eq('activo', true),
  ])

  const isAdmin = ['fp_partner', 'fp_manager'].includes(profile.rol)

  return (
    <DdDashboard
      assets={assets ?? []}
      visits={visits ?? []}
      cards={cards ?? []}
      isAdmin={isAdmin}
    />
  )
}

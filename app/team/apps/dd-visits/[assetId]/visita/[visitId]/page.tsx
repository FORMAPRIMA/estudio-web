import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import DdVisitPage from '@/components/team/dd-visits/DdVisitPage'

export const dynamic = 'force-dynamic'

export default async function VisitPage({ params }: { params: { assetId: string; visitId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const admin = createAdminClient()
  const { assetId, visitId } = params

  const [{ data: asset }, { data: visit }, { data: cards }, { data: roles }, { data: team }] = await Promise.all([
    admin.from('dd_assets').select('*').eq('id', assetId).single(),
    admin.from('dd_visits').select('*').eq('id', visitId).single(),
    admin.from('dd_cards').select('*').eq('visit_id', visitId).eq('activo', true).order('orden'),
    admin.from('dd_roles').select('*').eq('activo', true).order('orden'),
    admin.from('dd_visit_team').select('*').eq('visit_id', visitId),
  ])

  if (!asset || !visit) notFound()

  const isAdmin = ['fp_partner', 'fp_manager'].includes(profile.rol)

  return (
    <DdVisitPage
      asset={asset}
      visit={visit}
      cards={cards ?? []}
      roles={roles ?? []}
      team={team ?? []}
      isAdmin={isAdmin}
    />
  )
}

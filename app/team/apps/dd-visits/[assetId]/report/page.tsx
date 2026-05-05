import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FpRole } from '@/lib/types'
import DdReportBuilder from '@/components/team/dd-visits/DdReportBuilder'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Report Builder' }

export default async function ReportPage({ params }: { params: { assetId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol as FpRole)) redirect('/team/apps/dd-visits')

  const admin = createAdminClient()
  const { assetId } = params

  const [{ data: asset }, { data: visits }, { data: cards }, { data: roles }, { data: media }] = await Promise.all([
    admin.from('dd_assets').select('*').eq('id', assetId).single(),
    admin.from('dd_visits').select('*').eq('asset_id', assetId).order('fecha'),
    admin.from('dd_cards').select('*').eq('asset_id', assetId).eq('activo', true).order('orden'),
    admin.from('dd_roles').select('*').eq('activo', true).order('orden'),
    admin.from('dd_card_media').select('*').eq('asset_id', assetId).order('created_at'),
  ])

  if (!asset) notFound()

  return (
    <DdReportBuilder
      asset={asset}
      visits={visits ?? []}
      cards={cards ?? []}
      roles={roles ?? []}
      media={media ?? []}
    />
  )
}

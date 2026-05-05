import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import DdAssetPage from '@/components/team/dd-visits/DdAssetPage'

export const dynamic = 'force-dynamic'

export default async function AssetPage({ params }: { params: { assetId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const admin = createAdminClient()
  const { assetId } = params

  const [{ data: asset }, { data: visits }, { data: roles }, { data: docs }, { data: cards }] = await Promise.all([
    admin.from('dd_assets').select('*').eq('id', assetId).single(),
    admin.from('dd_visits').select('*').eq('asset_id', assetId).order('fecha'),
    admin.from('dd_roles').select('*').eq('activo', true).order('orden'),
    admin.from('dd_asset_docs').select('*').eq('asset_id', assetId).order('orden'),
    admin.from('dd_cards').select('id, visit_id, estado, activo').eq('asset_id', assetId).eq('activo', true),
  ])

  if (!asset) notFound()

  const isAdmin = ['fp_partner', 'fp_manager'].includes(profile.rol)

  return (
    <DdAssetPage
      asset={asset}
      visits={visits ?? []}
      roles={roles ?? []}
      docs={docs ?? []}
      cards={cards ?? []}
      isAdmin={isAdmin}
    />
  )
}

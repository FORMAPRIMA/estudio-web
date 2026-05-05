import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import DdMyReview from '@/components/team/dd-visits/DdMyReview'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi Revisión' }

export default async function MyReviewPage({ params }: { params: { assetId: string; visitId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const admin = createAdminClient()
  const { assetId, visitId } = params

  const [{ data: asset }, { data: visit }, { data: cards }, { data: roles }, { data: mediaRaw }] = await Promise.all([
    admin.from('dd_assets').select('id, nombre').eq('id', assetId).single(),
    admin.from('dd_visits').select('id, asset_id, fecha, status').eq('id', visitId).single(),
    admin.from('dd_cards').select('*').eq('visit_id', visitId).eq('activo', true).order('orden'),
    admin.from('dd_roles').select('*').eq('activo', true).order('orden'),
    admin.from('dd_card_media').select('id, card_id, tipo').eq('visit_id', visitId),
  ])

  if (!asset || !visit) notFound()

  // Inyectar conteo de media en cada card
  const cardsWithMedia = (cards ?? []).map(c => ({
    ...c,
    media: (mediaRaw ?? []).filter((m: any) => m.card_id === c.id),
  }))

  return (
    <DdMyReview
      asset={asset as any}
      visit={visit as any}
      cards={cardsWithMedia}
      roles={roles ?? []}
    />
  )
}

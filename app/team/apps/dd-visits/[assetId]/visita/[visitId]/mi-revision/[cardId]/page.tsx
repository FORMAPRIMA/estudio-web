import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import DdCardView from '@/components/team/dd-visits/DdCardView'

export const dynamic = 'force-dynamic'

export default async function CardPage({
  params,
}: {
  params: { assetId: string; visitId: string; cardId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const admin = createAdminClient()
  const { assetId, visitId, cardId } = params

  const [{ data: asset }, { data: visit }, { data: card }, { data: media }, { data: allCards }] = await Promise.all([
    admin.from('dd_assets').select('id, nombre').eq('id', assetId).single(),
    admin.from('dd_visits').select('id, asset_id, fecha, status').eq('id', visitId).single(),
    admin.from('dd_cards').select('*').eq('id', cardId).single(),
    admin.from('dd_card_media').select('*').eq('card_id', cardId).order('created_at'),
    admin.from('dd_cards').select('id, orden').eq('visit_id', visitId).eq('activo', true).order('orden'),
  ])

  if (!asset || !visit || !card) notFound()

  const { data: rol } = await admin.from('dd_roles').select('*').eq('id', card.rol_id).single()

  const activeCards = allCards ?? []
  const cardIndex = activeCards.findIndex((c: any) => c.id === cardId)
  const prevCardId = cardIndex > 0 ? activeCards[cardIndex - 1].id : null
  const nextCardId = cardIndex < activeCards.length - 1 ? activeCards[cardIndex + 1].id : null

  return (
    <DdCardView
      asset={asset as any}
      visit={visit as any}
      card={card}
      rol={rol ?? { id: card.rol_id, nombre: 'Técnico', descripcion: null, color: '#888', orden: 0, activo: true }}
      media={media ?? []}
      cardIndex={cardIndex + 1}
      totalCards={activeCards.length}
      prevCardId={prevCardId}
      nextCardId={nextCardId}
    />
  )
}

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUrbanAssetFull } from '@/app/actions/urban-analyst'
import UrbanAssetDetalle from '@/components/team/urban-analyst/UrbanAssetDetalle'

export const metadata = { title: 'Urban Analyst — Activo' }
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/apps')

  const full = await getUrbanAssetFull(params.id)
  if (!full) notFound()

  return <UrbanAssetDetalle initial={full} />
}

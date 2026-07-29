import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { loadProyectoData } from '@/lib/repasos/data'
import { getProyectoTokens } from '@/app/actions/repasos'
import RepasoProyectoView from '@/components/team/repasos/RepasoProyectoView'

export const metadata = { title: 'Repasos de obra' }
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const data = await loadProyectoData(params.id)
  if (!data) notFound()

  const tokens = await getProyectoTokens(params.id)

  return (
    <RepasoProyectoView
      proyecto={data.proyecto}
      planos={data.planos}
      repasos={data.repasos}
      tokens={tokens}
      modo="interno"
    />
  )
}

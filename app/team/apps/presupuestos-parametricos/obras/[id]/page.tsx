import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getObraDetalle } from '@/app/actions/presupuestos-parametricos'
import { canAccessPresupuestosParametricos } from '@/lib/presupuestos-parametricos/domain'
import ObraDetallePage from '@/components/team/presupuestos-parametricos/ObraDetallePage'

export const metadata = { title: 'Obra de referencia · Presupuestos paramétricos' }
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !canAccessPresupuestosParametricos(profile.rol)) redirect('/team/apps')

  const d = await getObraDetalle(params.id)
  if (!d) notFound()
  return <ObraDetallePage d={d} />
}

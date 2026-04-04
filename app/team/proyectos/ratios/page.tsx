import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RatiosTable from '@/components/team/proyectos/RatiosTable'
import type { CatalogoFase } from '@/lib/types'

export const metadata = { title: 'Ratios objetivo' }
export const dynamic = 'force-dynamic'

export default async function RatiosPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'fp_partner') {
    redirect('/team/proyectos')
  }

  const { data: fases } = await supabase
    .from('catalogo_fases')
    .select('id, numero, label, seccion, orden, ratio')
    .order('orden')

  return (
    <RatiosTable fases={(fases ?? []) as CatalogoFase[]} />
  )
}

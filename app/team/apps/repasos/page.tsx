import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { getRepasoProyectos } from '@/app/actions/repasos'
import RepasosIndex from '@/components/team/repasos/RepasosIndex'

export const metadata = { title: 'Repasos de obra' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const proyectos = await getRepasoProyectos()
  return <RepasosIndex proyectos={proyectos} />
}

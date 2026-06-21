import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { getModelos3D } from '@/app/actions/showroom-3d'
import Showroom3DPage from '@/components/team/showroom-3d/Showroom3DPage'

export const metadata = { title: 'Showroom 3D' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const modelos = await getModelos3D()
  return <Showroom3DPage modelos={modelos} />
}

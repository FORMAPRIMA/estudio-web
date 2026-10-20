import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessPresupuestosParametricos } from '@/lib/presupuestos-parametricos/domain'
import MaquetaPage from '@/components/team/presupuestos-parametricos/maqueta/MaquetaPage'

export const metadata = { title: 'Maqueta del estado actual' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !canAccessPresupuestosParametricos(profile.rol)) redirect('/team/apps')
  return <MaquetaPage />
}

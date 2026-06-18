import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import GestorAccesosPage from '@/components/team/finanzas/GestorAccesosPage'

export const metadata = { title: 'Portal del gestor · Finanzas' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()
  const { data: tokens } = await admin
    .from('gestor_tokens')
    .select('*')
    .order('created_at', { ascending: false })

  return <GestorAccesosPage initialTokens={(tokens ?? []) as any} />
}

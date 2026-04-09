import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MejorasPage from '@/components/team/mejoras/MejorasPage'

export const dynamic = 'force-dynamic'

export default async function MejorasPageRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol, nombre').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const admin = createAdminClient()
  const { data: mejoras } = await admin
    .from('mejoras')
    .select('id, tipo, titulo, descripcion, status, autor_id, created_at, autor:profiles!autor_id(nombre, rol)')
    .order('created_at', { ascending: false })

  return (
    <MejorasPage
      mejoras={(mejoras ?? []) as any}
      currentUserId={user.id}
      currentUserRole={profile.rol}
    />
  )
}

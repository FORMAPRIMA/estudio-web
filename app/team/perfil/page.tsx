import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PerfilPage from '@/components/team/perfil/PerfilPage'

export const dynamic = 'force-dynamic'

export default async function Perfil() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol, email')
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/login')

  // avatar_url fetched client-side to avoid breaking if column doesn't exist yet
  return (
    <PerfilPage
      nombre={profile.nombre ?? ''}
      email={profile.email ?? session.user.email ?? ''}
      rol={profile.rol}
    />
  )
}

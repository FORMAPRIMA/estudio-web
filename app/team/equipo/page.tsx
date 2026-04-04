import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import EquipoPage from '@/components/team/equipo/EquipoPage'
import type { TeamMemberFull } from '@/components/team/equipo/EquipoPage'

export const metadata = { title: 'Equipo' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  // Use admin client to bypass RLS and fetch all team profiles
  const admin = createAdminClient()
  const { data: members } = await admin
    .from('profiles')
    .select('id, nombre, apellido, email, rol, avatar_url, telefono, direccion, fecha_nacimiento, fecha_contratacion, notas, blocked')
    .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])
    .order('nombre')

  return (
    <EquipoPage
      initialMembers={(members ?? []) as TeamMemberFull[]}
      currentUserId={session.user.id}
    />
  )
}

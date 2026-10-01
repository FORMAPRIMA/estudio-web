import { createClient } from '@/lib/supabase/server'
import { esDelEquipo } from '@/lib/auth/equipo'

/** Usuario del equipo con sesión, o null. El panel del Open House es solo para el estudio. */
export async function usuarioEquipo(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (await esDelEquipo(supabase, user.id)) ? { id: user.id } : null
}

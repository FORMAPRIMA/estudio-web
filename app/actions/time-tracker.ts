'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteTimeEntry(
  uid: string,
  fecha: string,
  h: number
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }
  // Security: users can only delete their own entries
  if (user.id !== uid) return { error: 'Sin permisos.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('time_entries')
    .delete()
    .eq('user_id', uid)
    .eq('fecha', fecha)
    .eq('hora_inicio', h)

  if (error) return { error: error.message }
  return { success: true }
}

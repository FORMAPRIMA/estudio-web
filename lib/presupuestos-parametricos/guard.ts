import { createClient } from '@/lib/supabase/server'
import { canAccessPresupuestosParametricos } from './domain'

/** Para API routes: null si la sesión puede usar la app. */
export async function errorDeAcceso(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Sin sesión activa.'
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  return profile && canAccessPresupuestosParametricos(profile.rol) ? null : 'Sin permisos.'
}

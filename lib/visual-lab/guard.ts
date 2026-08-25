import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'

/**
 * FP Visual Lab es visible para todos los roles FP: es la pieza que se le
 * enseña a un promotor, y cualquiera del equipo puede tener que abrirla.
 */
export async function requireFP(): Promise<FpRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  return profile.rol as FpRole
}

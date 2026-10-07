import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'

/** Páginas del recorrido para el equipo: sin sesión FP, al login (y de vuelta aquí). */
export async function requireEquipoPagina(volverA: string): Promise<{ id: string; nombre: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(volverA)}`)
  const { data: profile } = await supabase.from('profiles').select('rol, nombre').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')
  return { id: user.id, nombre: (profile.nombre as string) ?? 'Equipo FP' }
}

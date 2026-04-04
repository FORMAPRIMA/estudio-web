'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateFaseRatio(faseId: string, ratio: number) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.rol !== 'fp_partner') {
    return { error: 'Solo el partner puede editar los ratios.' }
  }

  const { error } = await supabase
    .from('catalogo_fases')
    .update({ ratio })
    .eq('id', faseId)

  if (error) return { error: error.message }

  revalidatePath('/team/proyectos/ratios')
  return { success: true }
}

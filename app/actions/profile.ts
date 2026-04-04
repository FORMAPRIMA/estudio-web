'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadAvatar(
  bytes: Uint8Array,
  fileName: string,
  contentType: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sin sesión activa.' }

  const ext = fileName.split('.').pop() ?? 'jpg'
  const path = `${session.user.id}/avatar.${ext}`
  const buffer = Buffer.from(bytes)

  const { data, error } = await supabase.storage
    .from('avatares')
    .upload(path, buffer, { upsert: true, contentType })

  if (error || !data) return { error: error?.message ?? 'Error al subir imagen.' }

  const { data: { publicUrl } } = supabase.storage
    .from('avatares')
    .getPublicUrl(data.path)

  const url = `${publicUrl}?t=${Date.now()}`

  const { error: e2 } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', session.user.id)

  if (e2) return { error: e2.message }

  revalidatePath('/team', 'layout')
  return { url }
}

export async function updateProfile(
  nombre: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sin sesión activa.' }

  const { error } = await supabase
    .from('profiles')
    .update({ nombre: nombre.trim() })
    .eq('id', session.user.id)

  if (error) return { error: error.message }

  revalidatePath('/team', 'layout')
  return { success: true }
}

export async function updatePassword(
  newPassword: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

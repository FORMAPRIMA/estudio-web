'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}

export async function createTeamMember(input: {
  email: string
  password: string
  nombre: string
  apellido: string
  rol: 'fp_team' | 'fp_manager' | 'fp_partner'
}): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    })

    if (authError) return { error: authError.message }
    if (!authData.user) return { error: 'No se pudo crear el usuario.' }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: authData.user.id,
      email: input.email,
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim() || null,
      rol: input.rol,
    }, { onConflict: 'id' })

    if (profileError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return { error: profileError.message }
    }

    revalidatePath('/team/equipo')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function blockTeamMember(userId: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    if (error) return { error: error.message }
    await admin.from('profiles').update({ blocked: true }).eq('id', userId)
    revalidatePath('/team/equipo')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function unblockTeamMember(userId: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (error) return { error: error.message }
    await admin.from('profiles').update({ blocked: false }).eq('id', userId)
    revalidatePath('/team/equipo')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateTeamMemberProfile(
  userId: string,
  data: {
    nombre?: string
    apellido?: string
    rol?: string
    telefono?: string | null
    direccion?: string | null
    fecha_nacimiento?: string | null
    fecha_contratacion?: string | null
    notas?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update(data).eq('id', userId)
    if (error) return { error: error.message }
    revalidatePath('/team/equipo')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateTeamMemberEmail(
  userId: string,
  newEmail: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: newEmail })
    if (authError) return { error: authError.message }
    const { error: dbError } = await admin.from('profiles').update({ email: newEmail }).eq('id', userId)
    if (dbError) return { error: dbError.message }
    revalidatePath('/team/equipo')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function uploadTeamMemberAvatar(
  userId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    if (!file) return { error: 'No se recibió el archivo.' }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/avatar.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { data, error } = await admin.storage
      .from('avatares')
      .upload(path, buffer, { upsert: true, contentType: file.type })

    if (error || !data) return { error: error?.message ?? 'Error al subir imagen.' }

    const { data: { publicUrl } } = admin.storage
      .from('avatares')
      .getPublicUrl(data.path)

    const url = `${publicUrl}?t=${Date.now()}`

    const { error: dbError } = await admin
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId)

    if (dbError) return { error: dbError.message }

    revalidatePath('/team/equipo')
    revalidatePath('/team', 'layout')
    return { url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function resetTeamMemberPassword(
  userId: string,
  newPassword: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

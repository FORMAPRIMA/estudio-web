'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Modelo3D } from '@/lib/showroom'

const PATH = '/team/apps/showroom-3d'

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('id, rol, nombre').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'].includes(profile.rol)) {
    throw new Error('Sin permisos.')
  }
  return { userId: user.id, rol: profile.rol, nombre: (profile as any).nombre as string | null }
}

export async function createModelo3D(data: {
  nombre: string
  proyecto?: string
  descripcion?: string
  glb_url: string
  poster_url?: string
  file_size?: number
}): Promise<{ success: true; id: string } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    if (!data.nombre?.trim()) return { error: 'El nombre es obligatorio.' }
    if (!data.glb_url?.trim()) return { error: 'Falta el archivo del modelo.' }

    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('modelos_3d')
      .insert({
        user_id:     userId,
        nombre:      data.nombre.trim(),
        proyecto:    data.proyecto?.trim() || null,
        descripcion: data.descripcion?.trim() || null,
        glb_url:     data.glb_url.trim(),
        poster_url:  data.poster_url?.trim() || null,
        file_size:   data.file_size ?? null,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true, id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateModelo3D(
  id: string,
  data: {
    nombre?: string
    proyecto?: string | null
    descripcion?: string | null
    poster_url?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    const admin = createAdminClient()

    const { data: existing } = await admin.from('modelos_3d').select('user_id').eq('id', id).single()
    if (!existing || existing.user_id !== userId) return { error: 'Sin permisos para editar esta maqueta.' }

    const patch: Record<string, unknown> = {}
    if (data.nombre !== undefined)      patch.nombre = data.nombre?.trim() || null
    if (data.proyecto !== undefined)    patch.proyecto = data.proyecto?.trim() || null
    if (data.descripcion !== undefined) patch.descripcion = data.descripcion?.trim() || null
    if (data.poster_url !== undefined)  patch.poster_url = data.poster_url

    const { error } = await admin.from('modelos_3d').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteModelo3D(id: string): Promise<{ success: true } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    const admin = createAdminClient()

    const { data: existing } = await admin.from('modelos_3d').select('user_id').eq('id', id).single()
    if (!existing || existing.user_id !== userId) return { error: 'Sin permisos para eliminar esta maqueta.' }

    const { error } = await admin.from('modelos_3d').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function getModelos3D(): Promise<Modelo3D[]> {
  await requireAnyFP()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('modelos_3d')
    .select('id, user_id, nombre, proyecto, descripcion, glb_url, poster_url, file_size, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    // La tabla puede no existir aún — devolver vacío en vez de romper la página.
    console.error('[showroom-3d] getModelos:', error.message)
    return []
  }

  // Nombre del autor (denormalizado en lectura)
  const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id)))
  const nombres: Record<string, string | null> = {}
  if (userIds.length) {
    const { data: profs } = await admin.from('profiles').select('id, nombre').in('id', userIds)
    for (const p of profs ?? []) nombres[(p as any).id] = (p as any).nombre
  }

  return (data ?? []).map((r: any) => ({
    id:           r.id,
    user_id:      r.user_id,
    nombre:       r.nombre,
    proyecto:     r.proyecto,
    descripcion:  r.descripcion,
    glb_url:      r.glb_url,
    poster_url:   r.poster_url,
    file_size:    r.file_size,
    created_at:   r.created_at,
    autor_nombre: nombres[r.user_id] ?? null,
  }))
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { WebFpTool } from '@/lib/web-fp-tools'

const PATH = '/team/marketing/web-publica'

async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, nombre, tagline_es, tagline_en, descripcion_es, descripcion_en, imagen_url, cta_label_es, cta_label_en, cta_url, orden, activo, created_at'

function mapRow(r: any): WebFpTool {
  return {
    id: r.id, nombre: r.nombre,
    tagline_es: r.tagline_es ?? null, tagline_en: r.tagline_en ?? null,
    descripcion_es: r.descripcion_es ?? null, descripcion_en: r.descripcion_en ?? null,
    imagen_url: r.imagen_url ?? null,
    cta_label_es: r.cta_label_es ?? null, cta_label_en: r.cta_label_en ?? null, cta_url: r.cta_url ?? null,
    orden: r.orden ?? 0, activo: r.activo ?? true, created_at: r.created_at,
  }
}

export async function getFpToolsPublic(): Promise<WebFpTool[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tools').select(SELECT)
    .eq('activo', true).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-fp-tools] getPublic:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function getFpToolsAdmin(): Promise<WebFpTool[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tools').select(SELECT)
    .order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-fp-tools] getAdmin:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function createFpTool(): Promise<{ success: true; id: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: last } = await admin.from('web_fp_tools').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()
    const orden = (last?.orden ?? -1) + 1
    const { data: row, error } = await admin.from('web_fp_tools').insert({ nombre: 'Nueva capacidad', orden }).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/fp-tools')
    return { success: true, id: row.id }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updateFpTool(id: string, data: Partial<Omit<WebFpTool, 'id' | 'orden' | 'created_at'>>): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    const fields = ['nombre', 'tagline_es', 'tagline_en', 'descripcion_es', 'descripcion_en', 'imagen_url', 'cta_label_es', 'cta_label_en', 'cta_url', 'activo'] as const
    for (const f of fields) if (data[f] !== undefined) patch[f] = data[f]
    const { error } = await admin.from('web_fp_tools').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/fp-tools')
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deleteFpTool(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { error } = await admin.from('web_fp_tools').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/fp-tools')
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function reorderFpTools(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('web_fp_tools').update({ orden: i }).eq('id', id)))
    revalidatePath(PATH); revalidatePath('/fp-tools')
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

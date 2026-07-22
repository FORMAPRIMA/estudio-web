'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { slugifyPropiedad, type WebPropiedad } from '@/lib/web-propiedades'

const PATH = '/team/marketing/web-publica'

async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, slug, nombre, ubicacion, precio, descripcion_es, descripcion_en, hero_url, galeria, disponible, orden, activo, created_at'

function mapRow(r: any): WebPropiedad {
  return {
    id: r.id, slug: r.slug ?? null, nombre: r.nombre,
    ubicacion: r.ubicacion ?? null, precio: r.precio ?? null,
    descripcion_es: r.descripcion_es ?? null, descripcion_en: r.descripcion_en ?? null,
    hero_url: r.hero_url ?? null, galeria: r.galeria ?? [],
    disponible: r.disponible ?? true, orden: r.orden ?? 0, activo: r.activo ?? true, created_at: r.created_at,
  }
}

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, base: string, exceptId?: string): Promise<string> {
  const slug = slugifyPropiedad(base)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const { data } = await admin.from('web_propiedades').select('id').eq('slug', candidate).maybeSingle()
    if (!data || data.id === exceptId) return candidate
  }
  return `${slug}-${Date.now()}`
}

export async function getPropiedadesPublic(): Promise<WebPropiedad[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_propiedades').select(SELECT)
    .eq('activo', true).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-propiedades] getPublic:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function getPropiedadesAdmin(): Promise<WebPropiedad[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_propiedades').select(SELECT)
    .order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-propiedades] getAdmin:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function getPropiedadBySlug(slug: string): Promise<WebPropiedad | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_propiedades').select(SELECT).eq('slug', slug).eq('activo', true).maybeSingle()
  if (error || !data) return null
  return mapRow(data)
}

export async function createPropiedad(): Promise<{ success: true; id: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: last } = await admin.from('web_propiedades').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()
    const orden = (last?.orden ?? -1) + 1
    const slug = await uniqueSlug(admin, 'nueva-propiedad')
    const { data: row, error } = await admin.from('web_propiedades').insert({ nombre: 'Nueva propiedad', slug, orden }).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/real-estate')
    return { success: true, id: row.id }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updatePropiedad(id: string, data: Partial<Omit<WebPropiedad, 'id' | 'slug' | 'orden' | 'created_at'>> & { regenerarSlug?: boolean }): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    const fields = ['nombre', 'ubicacion', 'precio', 'descripcion_es', 'descripcion_en', 'hero_url', 'galeria', 'disponible', 'activo'] as const
    for (const f of fields) if (data[f] !== undefined) patch[f] = data[f]
    if (data.regenerarSlug && data.nombre?.trim()) patch.slug = await uniqueSlug(admin, data.nombre, id)
    const { error } = await admin.from('web_propiedades').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/real-estate')
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deletePropiedad(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { error } = await admin.from('web_propiedades').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/real-estate')
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function reorderPropiedades(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('web_propiedades').update({ orden: i }).eq('id', id)))
    revalidatePath(PATH); revalidatePath('/real-estate')
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

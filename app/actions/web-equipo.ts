'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { slugify, type WebEquipo } from '@/lib/web-equipo'

const PATH = '/team/marketing/web-publica'

async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, nombre, slug, rol_es, rol_en, foto_url, foto_detalle_url, cv_corto_es, cv_corto_en, cv_largo_es, cv_largo_en, orden, activo, created_at'

function mapRow(r: any): WebEquipo {
  return {
    id: r.id, nombre: r.nombre, slug: r.slug,
    rol_es: r.rol_es ?? null, rol_en: r.rol_en ?? null,
    foto_url: r.foto_url ?? null, foto_detalle_url: r.foto_detalle_url ?? null,
    cv_corto_es: r.cv_corto_es ?? null, cv_corto_en: r.cv_corto_en ?? null,
    cv_largo_es: r.cv_largo_es ?? null, cv_largo_en: r.cv_largo_en ?? null,
    orden: r.orden ?? 0, activo: r.activo ?? true, created_at: r.created_at,
  }
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function getEquipoPublic(): Promise<WebEquipo[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_equipo').select(SELECT)
    .eq('activo', true).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-equipo] getPublic:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

/**
 * Equipo para resolver los créditos de un proyecto: TODOS, activos y no activos.
 *
 * `getEquipoPublic` filtra por `activo` porque alimenta la parrilla de Estudio,
 * donde solo debe salir quien está hoy. Los créditos son otra cosa: acreditan
 * quién hizo una obra, y alguien que ya no está en el estudio siguió haciéndola.
 * Se le da de baja con `activo = false` —desaparece de la parrilla— y aquí se
 * sigue pudiendo resolver su nombre y su ficha.
 */
export async function getEquipoParaCreditos(): Promise<WebEquipo[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_equipo').select(SELECT)
    .order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-equipo] getParaCreditos:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function getEquipoAdmin(): Promise<WebEquipo[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_equipo').select(SELECT)
    .order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-equipo] getAdmin:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function getMiembroBySlug(slug: string): Promise<WebEquipo | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_equipo').select(SELECT).eq('slug', slug).eq('activo', true).maybeSingle()
  if (error || !data) return null
  return mapRow(data)
}

// ── Slug único ────────────────────────────────────────────────────────────────

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, base: string, exceptId?: string): Promise<string> {
  let slug = slugify(base)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const { data } = await admin.from('web_equipo').select('id').eq('slug', candidate).maybeSingle()
    if (!data || data.id === exceptId) return candidate
  }
  return `${slug}-${Date.now()}`
}

// ── Mutaciones ─────────────────────────────────────────────────────────────

export async function createWebEquipo(): Promise<{ success: true; id: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: last } = await admin.from('web_equipo').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()
    const orden = (last?.orden ?? -1) + 1
    const slug = await uniqueSlug(admin, 'nuevo-miembro')
    const { data: row, error } = await admin.from('web_equipo')
      .insert({ nombre: 'Nuevo miembro', slug, orden }).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/estudio')
    return { success: true, id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateWebEquipo(id: string, data: Partial<Omit<WebEquipo, 'id' | 'slug' | 'created_at' | 'orden'>> & { regenerarSlug?: boolean }): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    const fields = ['nombre', 'rol_es', 'rol_en', 'foto_url', 'foto_detalle_url', 'cv_corto_es', 'cv_corto_en', 'cv_largo_es', 'cv_largo_en', 'activo'] as const
    for (const f of fields) if (data[f] !== undefined) patch[f] = data[f]
    // Regenerar slug desde el nombre si se pide explícitamente.
    if (data.regenerarSlug && data.nombre) patch.slug = await uniqueSlug(admin, data.nombre, id)

    const { error } = await admin.from('web_equipo').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/estudio')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteWebEquipo(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { error } = await admin.from('web_equipo').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH); revalidatePath('/estudio')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function reorderWebEquipo(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('web_equipo').update({ orden: i }).eq('id', id)))
    revalidatePath(PATH); revalidatePath('/estudio')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

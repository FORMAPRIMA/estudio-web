'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { slugifyTool, type WebFpTool, type WebFpToolBloque, type WebFpToolDetalle, type BloqueTipo } from '@/lib/web-fp-tools'

const PATH = '/team/marketing/web-publica'

/** Revalida la portada de capacidades y, si se sabe, la subpágina tocada. */
function refrescar(slug?: string | null) {
  revalidatePath(PATH)
  revalidatePath('/fp-tools')
  if (slug) revalidatePath(`/fp-tools/${slug}`)
}

async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, slug, nombre, tagline_es, tagline_en, descripcion_es, descripcion_en, imagen_url, video_url, video_poster_url, cta_label_es, cta_label_en, cta_url, orden, activo, created_at'
const SELECT_BLOQUE = 'id, tool_id, tipo, titulo_es, titulo_en, cuerpo_es, cuerpo_en, imagen_url, pie_es, pie_en, invertido, orden, created_at'

function mapRow(r: any): WebFpTool {
  return {
    id: r.id, slug: r.slug ?? '', nombre: r.nombre,
    tagline_es: r.tagline_es ?? null, tagline_en: r.tagline_en ?? null,
    descripcion_es: r.descripcion_es ?? null, descripcion_en: r.descripcion_en ?? null,
    imagen_url: r.imagen_url ?? null,
    video_url: r.video_url ?? null, video_poster_url: r.video_poster_url ?? null,
    cta_label_es: r.cta_label_es ?? null, cta_label_en: r.cta_label_en ?? null, cta_url: r.cta_url ?? null,
    orden: r.orden ?? 0, activo: r.activo ?? true, created_at: r.created_at,
  }
}

function mapBloque(r: any): WebFpToolBloque {
  return {
    id: r.id, tool_id: r.tool_id, tipo: (r.tipo ?? 'texto') as BloqueTipo,
    titulo_es: r.titulo_es ?? null, titulo_en: r.titulo_en ?? null,
    cuerpo_es: r.cuerpo_es ?? null, cuerpo_en: r.cuerpo_en ?? null,
    imagen_url: r.imagen_url ?? null,
    pie_es: r.pie_es ?? null, pie_en: r.pie_en ?? null,
    invertido: r.invertido ?? false, orden: r.orden ?? 0, created_at: r.created_at,
  }
}

/**
 * Un slug libre a partir del nombre.
 *
 * Se comprueba contra la tabla en vez de confiar en el índice único: chocar es
 * normal —«Visual Lab» y «Visual Lab 2»— y que al equipo le salte un error de
 * base de datos por renombrar una capacidad sería absurdo. `excluir` es la propia
 * fila cuando se está renombrando, que si no chocaría consigo misma.
 */
async function slugLibre(admin: ReturnType<typeof createAdminClient>, nombre: string, excluir?: string): Promise<string> {
  const base = slugifyTool(nombre)
  const { data } = await admin.from('web_fp_tools').select('id, slug').like('slug', `${base}%`)
  const tomados = new Set((data ?? []).filter((r: any) => r.id !== excluir).map((r: any) => r.slug))
  if (!tomados.has(base)) return base
  for (let i = 2; i < 200; i++) if (!tomados.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

// ── Lectura pública ─────────────────────────────────────────────────────────

export async function getFpToolsPublic(): Promise<WebFpTool[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tools').select(SELECT)
    .eq('activo', true).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-fp-tools] getPublic:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

/**
 * La subpágina de una capacidad. Devuelve null si no existe o está oculta: una
 * tool despublicada tiene que dar 404, no una página a medias.
 */
export async function getFpToolBySlug(slug: string): Promise<WebFpToolDetalle | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tools').select(SELECT)
    .eq('slug', slug).eq('activo', true).maybeSingle()
  if (error) { console.error('[web-fp-tools] getBySlug:', error.message); return null }
  if (!data) return null

  const { data: bloques, error: errB } = await admin.from('web_fp_tool_bloques').select(SELECT_BLOQUE)
    .eq('tool_id', (data as any).id).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (errB) console.error('[web-fp-tools] bloques:', errB.message)

  return { ...mapRow(data), bloques: (bloques ?? []).map(mapBloque) }
}

/** Las capacidades vecinas, para poder seguir a la siguiente sin volver atrás. */
export async function getFpToolsIndice(): Promise<{ slug: string; nombre: string }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tools').select('slug, nombre')
    .eq('activo', true).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-fp-tools] indice:', error.message); return [] }
  return (data ?? []).map((r: any) => ({ slug: r.slug ?? '', nombre: r.nombre })).filter((r) => r.slug)
}

// ── Administración ──────────────────────────────────────────────────────────

export async function getFpToolsAdmin(): Promise<WebFpTool[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tools').select(SELECT)
    .order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-fp-tools] getAdmin:', error.message); return [] }
  return (data ?? []).map(mapRow)
}

export async function getFpToolBloquesAdmin(toolId: string): Promise<WebFpToolBloque[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_fp_tool_bloques').select(SELECT_BLOQUE)
    .eq('tool_id', toolId).order('orden', { ascending: true }).order('created_at', { ascending: true })
  if (error) { console.error('[web-fp-tools] bloquesAdmin:', error.message); return [] }
  return (data ?? []).map(mapBloque)
}

export async function createFpTool(): Promise<{ success: true; id: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: last } = await admin.from('web_fp_tools').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()
    const orden = (last?.orden ?? -1) + 1
    const nombre = 'Nueva capacidad'
    const slug = await slugLibre(admin, nombre)
    const { data: row, error } = await admin.from('web_fp_tools').insert({ nombre, slug, orden }).select('id').single()
    if (error) return { error: error.message }
    refrescar(slug)
    return { success: true, id: row.id }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updateFpTool(id: string, data: Partial<Omit<WebFpTool, 'id' | 'slug' | 'orden' | 'created_at'>>): Promise<{ success: true; slug?: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    const fields = ['nombre', 'tagline_es', 'tagline_en', 'descripcion_es', 'descripcion_en', 'imagen_url', 'video_url', 'video_poster_url', 'cta_label_es', 'cta_label_en', 'cta_url', 'activo'] as const
    for (const f of fields) if (data[f] !== undefined) patch[f] = data[f]

    // El slug sigue al nombre, pero solo mientras nadie haya compartido la URL —
    // y eso no lo sabemos. Así que solo se regenera si la fila aún no tenía uno:
    // cambiar el nombre de una capacidad publicada no puede romper su enlace.
    const { data: actual } = await admin.from('web_fp_tools').select('slug').eq('id', id).maybeSingle()
    let slug = (actual as any)?.slug as string | undefined
    if (!slug && typeof patch.nombre === 'string') {
      slug = await slugLibre(admin, patch.nombre, id)
      patch.slug = slug
    }

    const { error } = await admin.from('web_fp_tools').update(patch).eq('id', id)
    if (error) return { error: error.message }
    refrescar(slug)
    return { success: true, slug }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

/** Rehace el slug a partir del nombre actual. Gesto explícito y aparte: rompe la
 *  URL anterior, así que lo pide quien sabe lo que hace. */
export async function renombrarSlugFpTool(id: string): Promise<{ success: true; slug: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: row } = await admin.from('web_fp_tools').select('nombre').eq('id', id).maybeSingle()
    if (!row) return { error: 'No existe la capacidad.' }
    const slug = await slugLibre(admin, (row as any).nombre, id)
    const { error } = await admin.from('web_fp_tools').update({ slug }).eq('id', id)
    if (error) return { error: error.message }
    refrescar(slug)
    return { success: true, slug }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deleteFpTool(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    // Los bloques caen solos: la clave ajena lleva `on delete cascade`.
    const { error } = await admin.from('web_fp_tools').delete().eq('id', id)
    if (error) return { error: error.message }
    refrescar()
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function reorderFpTools(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('web_fp_tools').update({ orden: i }).eq('id', id)))
    refrescar()
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

// ── Bloques de la subpágina ─────────────────────────────────────────────────

export async function createFpToolBloque(toolId: string, tipo: BloqueTipo): Promise<{ success: true; id: string } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: last } = await admin.from('web_fp_tool_bloques').select('orden')
      .eq('tool_id', toolId).order('orden', { ascending: false }).limit(1).maybeSingle()
    const orden = (last?.orden ?? -1) + 1
    const { data: row, error } = await admin.from('web_fp_tool_bloques')
      .insert({ tool_id: toolId, tipo, orden }).select('id').single()
    if (error) return { error: error.message }
    refrescar()
    return { success: true, id: row.id }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updateFpToolBloque(id: string, data: Partial<Omit<WebFpToolBloque, 'id' | 'tool_id' | 'orden' | 'created_at'>>): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    const fields = ['tipo', 'titulo_es', 'titulo_en', 'cuerpo_es', 'cuerpo_en', 'imagen_url', 'pie_es', 'pie_en', 'invertido'] as const
    for (const f of fields) if (data[f] !== undefined) patch[f] = data[f]
    const { error } = await admin.from('web_fp_tool_bloques').update(patch).eq('id', id)
    if (error) return { error: error.message }
    refrescar()
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deleteFpToolBloque(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { error } = await admin.from('web_fp_tool_bloques').delete().eq('id', id)
    if (error) return { error: error.message }
    refrescar()
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function reorderFpToolBloques(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('web_fp_tool_bloques').update({ orden: i }).eq('id', id)))
    refrescar()
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

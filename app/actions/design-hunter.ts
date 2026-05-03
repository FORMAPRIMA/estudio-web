'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { DesignHunterEntry, DesignHunterViaje } from '@/lib/design-hunter'

const PATH = '/team/apps/design-hunter'

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('id, rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'].includes(profile.rol)) {
    throw new Error('Sin permisos.')
  }
  return { userId: user.id, rol: profile.rol }
}

// ── Entries ──────────────────────────────────────────────────────────────────

export async function createDesignHunterEntry(data: {
  titulo: string
  descripcion?: string
  foto_url?: string
  media_urls?: string[]
  categoria?: string
  tags?: string[]
  viaje_id?: string
  visible_equipo?: boolean
}): Promise<{ success: true; id: string } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    if (!data.titulo?.trim()) return { error: 'El título es obligatorio.' }

    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('design_hunter_entries')
      .insert({
        user_id:        userId,
        titulo:         data.titulo.trim(),
        descripcion:    data.descripcion?.trim() || null,
        foto_url:       data.foto_url?.trim() || null,
        media_urls:     data.media_urls ?? [],
        categoria:      data.categoria || null,
        tags:           data.tags ?? [],
        viaje_id:       data.viaje_id || null,
        visible_equipo: data.visible_equipo ?? true,
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

export async function updateDesignHunterEntry(
  id: string,
  data: {
    titulo?: string
    descripcion?: string | null
    foto_url?: string | null
    media_urls?: string[]
    categoria?: string | null
    tags?: string[]
    visible_equipo?: boolean
    viaje_id?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    const admin = createAdminClient()

    // Only the author can edit
    const { data: existing } = await admin
      .from('design_hunter_entries')
      .select('user_id')
      .eq('id', id)
      .single()
    if (!existing || existing.user_id !== userId) return { error: 'Sin permisos para editar esta entrada.' }

    const { error } = await admin
      .from('design_hunter_entries')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteDesignHunterEntry(id: string): Promise<{ success: true } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('design_hunter_entries')
      .select('user_id')
      .eq('id', id)
      .single()
    if (!existing || existing.user_id !== userId) return { error: 'Sin permisos para eliminar esta entrada.' }

    const { error } = await admin.from('design_hunter_entries').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function getDesignHunterEntries(filtros?: {
  viaje_id?: string
  categoria?: string
  tags?: string[]
  solo_mias?: boolean
}): Promise<DesignHunterEntry[]> {
  const { userId } = await requireAnyFP()
  const admin = createAdminClient()

  let query = admin
    .from('design_hunter_entries')
    .select(`
      id, user_id, viaje_id, titulo, descripcion, foto_url, media_urls,
      categoria, tags, visible_equipo, created_at,
      viaje:design_hunter_viajes!viaje_id(nombre)
    `)
    .order('created_at', { ascending: false })

  // Only own entries or team-visible entries
  query = query.or(`user_id.eq.${userId},visible_equipo.eq.true`)

  if (filtros?.viaje_id)   query = query.eq('viaje_id', filtros.viaje_id)
  if (filtros?.categoria)  query = query.eq('categoria', filtros.categoria)
  if (filtros?.solo_mias)  query = query.eq('user_id', userId)
  if (filtros?.tags?.length) {
    query = query.overlaps('tags', filtros.tags)
  }

  const { data, error } = await query
  if (error) {
    // Tables may not exist yet — return empty rather than crashing the page
    console.error('[design-hunter] getEntries:', error.message)
    return []
  }

  return (data ?? []).map((r: any) => ({
    id:             r.id,
    user_id:        r.user_id,
    viaje_id:       r.viaje_id,
    titulo:         r.titulo,
    descripcion:    r.descripcion,
    foto_url:       r.foto_url,
    media_urls:     r.media_urls ?? [],
    categoria:      r.categoria,
    tags:           r.tags ?? [],
    visible_equipo: r.visible_equipo,
    created_at:     r.created_at,
    autor_nombre:   null,
    viaje_nombre:   r.viaje?.nombre ?? null,
  }))
}

// ── Viajes ────────────────────────────────────────────────────────────────────

export async function getDesignHunterViajes(): Promise<DesignHunterViaje[]> {
  const { userId } = await requireAnyFP()
  const admin = createAdminClient()

  // Fetch all viajes created by this user, then also viajes referenced by visible entries
  const [{ data: propios }, { data: ajenosRefs }] = await Promise.all([
    admin
      .from('design_hunter_viajes')
      .select('id, created_by, nombre, fecha_inicio, fecha_fin, ubicacion, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }),
    admin
      .from('design_hunter_entries')
      .select('viaje_id')
      .eq('visible_equipo', true)
      .not('viaje_id', 'is', null),
  ])

  if (!propios && !ajenosRefs) return []

  const ajenosIds = Array.from(new Set((ajenosRefs ?? []).map((r: any) => r.viaje_id as string).filter(Boolean)))
  const propiosIds = new Set((propios ?? []).map(v => v.id))
  const extraIds = ajenosIds.filter(id => !propiosIds.has(id))

  let extras: DesignHunterViaje[] = []
  if (extraIds.length > 0) {
    const { data: extraViajes } = await admin
      .from('design_hunter_viajes')
      .select('id, created_by, nombre, fecha_inicio, fecha_fin, ubicacion, created_at')
      .in('id', extraIds)
    extras = extraViajes ?? []
  }

  const all = [...(propios ?? []), ...extras]
  // Deduplicate
  const seen = new Set<string>()
  return all.filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true })
}

export async function createDesignHunterViaje(data: {
  nombre: string
  fecha_inicio?: string
  fecha_fin?: string
  ubicacion?: string
}): Promise<{ success: true; id: string } | { error: string }> {
  try {
    const { userId } = await requireAnyFP()
    if (!data.nombre?.trim()) return { error: 'El nombre del viaje es obligatorio.' }

    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('design_hunter_viajes')
      .insert({
        created_by:   userId,
        nombre:       data.nombre.trim(),
        fecha_inicio: data.fecha_inicio || null,
        fecha_fin:    data.fecha_fin || null,
        ubicacion:    data.ubicacion?.trim() || null,
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

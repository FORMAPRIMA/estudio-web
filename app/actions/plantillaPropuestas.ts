'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { SERVICIOS_CONFIG, SERVICIO_IDS, getServicioPlantilla } from '@/lib/propuestas/config'
import type { ServicioId, ServicioPlantillaData, ServicioEntry } from '@/lib/propuestas/config'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'

const PATH = '/team/captacion/plantilla-propuestas'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}

/**
 * Returns all services in display order:
 *   1. The 5 base services (SERVICIOS_CONFIG order), merged with any DB overrides.
 *   2. Custom services (is_custom = true), ordered by their `orden` column.
 */
export async function getPlantillaServicios(): Promise<ServicioEntry[]> {
  noStore()
  const admin = createAdminClient()
  const { data, error: selectErr } = await admin
    .from('propuestas_servicios_plantilla')
    .select('id, label, texto, entregables, semanas_default, pago')

  const rows = data ?? []

  // Build a lookup for DB rows keyed by id
  const dbMap: Record<string, typeof rows[number]> = {}
  for (const row of rows) dbMap[row.id] = row

  const baseIds = new Set<string>(SERVICIO_IDS)

  // 1. Base services in SERVICIOS_CONFIG order
  const entries: ServicioEntry[] = SERVICIO_IDS.map(sid => {
    const cfg    = SERVICIOS_CONFIG[sid]
    const db     = dbMap[sid]
    const merged = getServicioPlantilla(sid, db ? { [sid]: db as ServicioPlantillaData } : {})
    return {
      id:        sid,
      isCustom:  false,
      tipo:      cfg.tipo,
      pem_split: cfg.pem_split,
      ...merged,
    }
  })

  // 2. Custom services — rows whose id is not a base service id
  const customRows = rows.filter(r => !baseIds.has(r.id))
  for (const row of customRows) {
    entries.push({
      id:              row.id,
      isCustom:        true,
      tipo:            'manual',
      pem_split:       0,
      label:           row.label,
      texto:           row.texto ?? '',
      entregables:     row.entregables ?? [],
      semanas_default: row.semanas_default ?? '',
      pago:            row.pago ?? [],
    })
  }

  return entries
}

/**
 * Upsert a single service's plantilla data (base or custom).
 */
export async function savePlantillaServicio(
  id: string,
  data: ServicioPlantillaData
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Try UPDATE first; if no row exists yet, INSERT with required columns
    const { data: updated, error: updateErr } = await admin
      .from('propuestas_servicios_plantilla')
      .update({ label: data.label, texto: data.texto, entregables: data.entregables, semanas_default: data.semanas_default, pago: data.pago })
      .eq('id', id)
      .select('id')
    if (updateErr) return { error: updateErr.message }

    if (!updated || updated.length === 0) {
      // First save for this base service — row doesn't exist yet
      const { error: insertErr } = await admin
        .from('propuestas_servicios_plantilla')
        .insert({ id, ...data })
      console.log('[savePlantillaServicio] insert result — err:', insertErr?.message ?? null)
      if (insertErr) return { error: insertErr.message }
    }

    revalidatePath(PATH)
    revalidatePath('/team/captacion/propuestas', 'layout')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/**
 * Create a brand-new custom service.
 */
export async function createServicio(
  label: string
): Promise<{ id: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Generate a slug-style id from the label
    const base = label
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'servicio'

    // Ensure uniqueness by appending a suffix if needed
    const { data: existing } = await admin
      .from('propuestas_servicios_plantilla')
      .select('id')
      .ilike('id', `${base}%`)
    const suffix = (existing?.length ?? 0) > 0 ? `_${(existing?.length ?? 0) + 1}` : ''
    const id = `${base}${suffix}`

    const { error } = await admin
      .from('propuestas_servicios_plantilla')
      .insert({
        id,
        label,
        texto:           '',
        entregables:     [],
        semanas_default: '',
        pago:            [],
      })

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/**
 * Delete a custom service (only custom ones can be deleted).
 */
export async function deleteServicio(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    // Safety: only delete rows whose id is not a base service
    if ((SERVICIO_IDS as string[]).includes(id)) return { error: 'No se puede eliminar un servicio base.' }
    const { error } = await admin
      .from('propuestas_servicios_plantilla')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

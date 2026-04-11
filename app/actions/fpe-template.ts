'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/fp-execution/template'

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    throw new Error('Sin permisos.')
}

// ── Chapters ──────────────────────────────────────────────────────────────────

export async function createChapter(data: {
  nombre: string
  descripcion?: string | null
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_chapters')
      .insert({ nombre: data.nombre, descripcion: data.descripcion ?? null, orden: data.orden ?? 0 })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateChapter(
  id: string,
  data: { nombre?: string; descripcion?: string | null; orden?: number; activo?: boolean }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_chapters')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteChapter(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_template_chapters').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Units ─────────────────────────────────────────────────────────────────────

export async function createUnit(data: {
  chapter_id: string
  nombre: string
  descripcion?: string | null
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_units')
      .insert({
        chapter_id: data.chapter_id,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        orden: data.orden ?? 0,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateUnit(
  id: string,
  data: { nombre?: string; descripcion?: string | null; orden?: number; activo?: boolean }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_units')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteUnit(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_template_units').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Line Items ────────────────────────────────────────────────────────────────

export async function createLineItem(data: {
  unit_id: string
  nombre: string
  descripcion?: string | null
  unidad_medida?: string
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_line_items')
      .insert({
        unit_id: data.unit_id,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        unidad_medida: data.unidad_medida ?? 'ud',
        orden: data.orden ?? 0,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateLineItem(
  id: string,
  data: { nombre?: string; descripcion?: string | null; unidad_medida?: string; orden?: number; activo?: boolean }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_line_items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteLineItem(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_template_line_items').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Phases ────────────────────────────────────────────────────────────────────

export async function createPhase(data: {
  unit_id: string
  nombre: string
  descripcion?: string | null
  lead_time_days?: number
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_phases')
      .insert({
        unit_id: data.unit_id,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        lead_time_days: data.lead_time_days ?? 7,
        orden: data.orden ?? 0,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePhase(
  id: string,
  data: { nombre?: string; descripcion?: string | null; lead_time_days?: number; orden?: number }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_phases')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deletePhase(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_template_phases').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

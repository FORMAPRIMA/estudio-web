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
  duracion_pct?: number
  principal_discipline_id?: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_chapters')
      .insert({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        orden: data.orden ?? 0,
        duracion_pct: data.duracion_pct ?? 0,
        principal_discipline_id: data.principal_discipline_id ?? null,
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

export async function updateChapter(
  id: string,
  data: { nombre?: string; descripcion?: string | null; orden?: number; activo?: boolean; duracion_pct?: number; principal_discipline_id?: string | null; label_cliente?: string | null; descripcion_cliente?: string | null; imagen_portada_url?: string | null }
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
  principal_discipline_id?: string | null
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
        principal_discipline_id: data.principal_discipline_id ?? null,
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
  data: { nombre?: string; descripcion?: string | null; orden?: number; activo?: boolean; principal_discipline_id?: string | null; label_cliente?: string | null; descripcion_cliente?: string | null; imagen_portada_url?: string | null }
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
  discipline_id?: string | null
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
        discipline_id: data.discipline_id ?? null,
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
  data: { nombre?: string; descripcion?: string | null; unidad_medida?: string; orden?: number; activo?: boolean; discipline_id?: string | null }
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
  chapter_id: string
  nombre: string
  descripcion?: string | null
  lead_time_days?: number
  duracion_pct?: number
  orden?: number
  requiere_duracion?: boolean
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_phases')
      .insert({
        chapter_id: data.chapter_id,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        lead_time_days: data.lead_time_days ?? 7,
        duracion_pct: data.duracion_pct ?? 0,
        orden: data.orden ?? 0,
        requiere_duracion: data.requiere_duracion ?? true,
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
  data: { nombre?: string; descripcion?: string | null; lead_time_days?: number; duracion_pct?: number; orden?: number; requiere_duracion?: boolean }
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

// ── Milestones ────────────────────────────────────────────────────────────────

export async function createMilestone(data: {
  nombre: string
  descripcion?: string | null
  orden?: number
  es_hito_pago?: boolean
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_template_milestones')
      .insert({ nombre: data.nombre, descripcion: data.descripcion ?? null, orden: data.orden ?? 0, es_hito_pago: data.es_hito_pago ?? false })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateMilestone(
  id: string,
  data: { nombre?: string; descripcion?: string | null; orden?: number; es_hito_pago?: boolean }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_milestones')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteMilestone(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_template_milestones').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function mergeMilestones(
  keepId: string,
  deleteId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const { data: deleteLinks, error: e1 } = await admin
      .from('fpe_template_phase_milestone_links')
      .select('phase_id, link_type')
      .eq('milestone_id', deleteId)
    if (e1) return { error: e1.message }

    const { data: keepLinks, error: e2 } = await admin
      .from('fpe_template_phase_milestone_links')
      .select('phase_id, link_type')
      .eq('milestone_id', keepId)
    if (e2) return { error: e2.message }

    const existing = new Set((keepLinks ?? []).map(l => `${l.phase_id}:${l.link_type}`))
    const toInsert = (deleteLinks ?? [])
      .filter(l => !existing.has(`${l.phase_id}:${l.link_type}`))
      .map(l => ({ phase_id: l.phase_id, milestone_id: keepId, link_type: l.link_type }))

    if (toInsert.length > 0) {
      const { error: e3 } = await admin.from('fpe_template_phase_milestone_links').insert(toInsert)
      if (e3) return { error: e3.message }
    }

    const { error: e4 } = await admin.from('fpe_template_milestones').delete().eq('id', deleteId)
    if (e4) return { error: e4.message }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Disciplines ───────────────────────────────────────────────────────────────

export async function createDiscipline(data: {
  nombre: string
  descripcion?: string | null
  color?: string
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_disciplines')
      .insert({ nombre: data.nombre, descripcion: data.descripcion ?? null, color: data.color ?? '#378ADD', orden: data.orden ?? 0 })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateDiscipline(
  id: string,
  data: { nombre?: string; descripcion?: string | null; color?: string; orden?: number; activo?: boolean }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_disciplines')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteDiscipline(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_disciplines').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Reorder / Move ────────────────────────────────────────────────────────────

export async function reorderChapters(orderedIds: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    await Promise.all(
      orderedIds.map((id, idx) =>
        admin.from('fpe_template_chapters').update({ orden: idx, updated_at: new Date().toISOString() }).eq('id', id)
      )
    )
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function reorderUnits(orderedIds: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    await Promise.all(
      orderedIds.map((id, idx) =>
        admin.from('fpe_template_units').update({ orden: idx, updated_at: new Date().toISOString() }).eq('id', id)
      )
    )
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function moveUnit(
  unitId: string,
  targetChapterId: string,
  newOrder: number,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_units')
      .update({ chapter_id: targetChapterId, orden: newOrder, updated_at: new Date().toISOString() })
      .eq('id', unitId)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function reorderLineItems(orderedIds: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    await Promise.all(
      orderedIds.map((id, idx) =>
        admin.from('fpe_template_line_items').update({ orden: idx, updated_at: new Date().toISOString() }).eq('id', id)
      )
    )
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function moveLineItem(
  lineItemId: string,
  targetUnitId: string,
  newOrder: number,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_template_line_items')
      .update({ unit_id: targetUnitId, orden: newOrder, updated_at: new Date().toISOString() })
      .eq('id', lineItemId)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Phase ↔ Line Item links ───────────────────────────────────────────────────
// Replaces all phase links for a line item in one shot.

export async function setLineItemPhases(
  line_item_id: string,
  phase_ids: string[],
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error: delErr } = await admin
      .from('fpe_template_phase_line_items')
      .delete()
      .eq('line_item_id', line_item_id)
    if (delErr) return { error: delErr.message }
    if (phase_ids.length > 0) {
      const { error: insErr } = await admin
        .from('fpe_template_phase_line_items')
        .insert(phase_ids.map(phase_id => ({ phase_id, line_item_id })))
      if (insErr) return { error: insErr.message }
    }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Phase milestone links ─────────────────────────────────────────────────────
// Replaces all links of a given type for a phase in one shot.

export async function setPhaseMilestoneLinks(
  phase_id: string,
  achieves: string[],
  requires: string[],
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Delete existing links for this phase
    const { error: delErr } = await admin
      .from('fpe_template_phase_milestone_links')
      .delete()
      .eq('phase_id', phase_id)
    if (delErr) return { error: delErr.message }

    // Insert new links
    const rows = [
      ...achieves.map(milestone_id => ({ phase_id, milestone_id, link_type: 'achieves' as const })),
      ...requires.map(milestone_id => ({ phase_id, milestone_id, link_type: 'requires' as const })),
    ]
    if (rows.length > 0) {
      const { error: insErr } = await admin
        .from('fpe_template_phase_milestone_links')
        .insert(rows)
      if (insErr) return { error: insErr.message }
    }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

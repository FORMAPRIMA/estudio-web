'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeAndSaveReadiness } from '@/app/actions/fpe-documents'

const LIST_PATH  = '/team/fp-execution/projects'

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
  return user
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(data: {
  nombre: string
  descripcion?: string | null
  direccion?: string | null
  ciudad?: string | null
  linked_proyecto_id?: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_projects')
      .insert({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        direccion: data.direccion ?? null,
        ciudad: data.ciudad ?? null,
        linked_proyecto_id: data.linked_proyecto_id ?? null,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(LIST_PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateProject(
  id: string,
  data: {
    nombre?: string
    descripcion?: string | null
    direccion?: string | null
    ciudad?: string | null
    linked_proyecto_id?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(LIST_PATH)
    revalidatePath(`${LIST_PATH}/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteProject(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_projects').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(LIST_PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Scope ─────────────────────────────────────────────────────────────────────
// Merge-based: syncs project_units without touching line_items or partner assignments.
// Only adds/removes UEs; existing records are preserved to avoid data loss.

export async function saveProjectScope(
  project_id: string,
  units: { template_unit_id: string; notas?: string | null }[]
): Promise<{ success: true; unitMap: Record<string, string> } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Fetch existing project units
    const { data: existing } = await admin
      .from('fpe_project_units')
      .select('id, template_unit_id')
      .eq('project_id', project_id)

    const existingMap: Record<string, string> = {}
    for (const pu of existing ?? []) existingMap[pu.template_unit_id] = pu.id

    const newIds    = new Set(units.map(u => u.template_unit_id))
    const existIds  = new Set(Object.keys(existingMap))

    // Delete deselected units (CASCADE removes line_items + unit_partners)
    const toDelete = Array.from(existIds).filter(tid => !newIds.has(tid))
    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map(tid => existingMap[tid])
      const { error: delErr } = await admin
        .from('fpe_project_units')
        .delete()
        .in('id', idsToDelete)
      if (delErr) return { error: delErr.message }
      for (const tid of toDelete) delete existingMap[tid]
    }

    // Insert newly selected units
    const toInsert = units.filter(u => !existIds.has(u.template_unit_id))
    for (let i = 0; i < toInsert.length; i++) {
      const u = toInsert[i]
      const { data: pu, error: puErr } = await admin
        .from('fpe_project_units')
        .insert({ project_id, template_unit_id: u.template_unit_id, notas: u.notas ?? null, orden: i })
        .select('id')
        .single()
      if (puErr) return { error: puErr.message }
      existingMap[u.template_unit_id] = pu.id
    }

    // Update notas on already-existing units
    const toUpdate = units.filter(u => existIds.has(u.template_unit_id))
    for (const u of toUpdate) {
      await admin
        .from('fpe_project_units')
        .update({ notas: u.notas ?? null })
        .eq('id', existingMap[u.template_unit_id])
    }

    await computeAndSaveReadiness(admin, project_id)
    revalidatePath(LIST_PATH)
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true, unitMap: existingMap }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Unit quantities ───────────────────────────────────────────────────────────
// Replaces all line items for a single project_unit (from the Docs tab).

export async function saveUnitQuantities(
  project_id: string,
  project_unit_id: string,
  line_items: { template_line_item_id: string; cantidad: number; notas?: string | null }[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    await admin.from('fpe_project_line_items').delete().eq('project_unit_id', project_unit_id)

    if (line_items.length > 0) {
      const { error } = await admin.from('fpe_project_line_items').insert(
        line_items.map(li => ({
          project_unit_id,
          template_line_item_id: li.template_line_item_id,
          cantidad: li.cantidad,
          notas: li.notas ?? null,
        }))
      )
      if (error) return { error: error.message }
    }

    await computeAndSaveReadiness(admin, project_id)
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Unit partners ─────────────────────────────────────────────────────────────
// Replaces partner assignments for a single project_unit (from the Docs tab).

export async function saveUnitPartners(
  project_id: string,
  project_unit_id: string,
  partner_ids: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    await admin.from('fpe_project_unit_partners').delete().eq('project_unit_id', project_unit_id)

    if (partner_ids.length > 0) {
      const { error } = await admin.from('fpe_project_unit_partners').insert(
        partner_ids.map(partner_id => ({ project_unit_id, partner_id }))
      )
      if (error) return { error: error.message }
    }

    await computeAndSaveReadiness(admin, project_id)
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Contract a project ────────────────────────────────────────────────────────

export async function saveProjectSchedule(
  projectId: string,
  data: { fecha_inicio_obra: string | null; duracion_obra_semanas: number }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({
        fecha_inicio_obra: data.fecha_inicio_obra || null,
        duracion_obra_semanas: data.duracion_obra_semanas,
      })
      .eq('id', projectId)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${projectId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function saveFpeProjectTourUrl(
  projectId: string,
  url: string | null,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({ tour_virtual_url: url || null })
      .eq('id', projectId)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${projectId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function contractProject(
  project_id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({ status: 'contracted' })
      .eq('id', project_id)
    if (error) return { error: error.message }
    revalidatePath(LIST_PATH)
    revalidatePath(`${LIST_PATH}/${project_id}`)
    revalidatePath('/team/fp-execution/control-room')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

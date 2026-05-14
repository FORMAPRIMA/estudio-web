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
  m2_construccion?: number | null
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
        m2_construccion: data.m2_construccion ?? null,
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
    m2_construccion?: number | null
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
// Replaces partner assignments for a single project_unit.
// Strict post-launch rules: cannot remove a partner that has a sent/viewed/bid_submitted
// invitation in an active tender — must revoke the invitation first.

export async function saveUnitPartners(
  project_id: string,
  project_unit_id: string,
  partner_ids: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // ── Strict-edit guard ────────────────────────────────────────────────────
    // Compare existing vs incoming. If removing a partner whose invitation is
    // already past 'pending' on an active tender, reject the change.
    const { data: existing } = await admin
      .from('fpe_project_unit_partners')
      .select('partner_id')
      .eq('project_unit_id', project_unit_id)

    const existingArr = (existing ?? []).map(r => r.partner_id)
    const incomingSet = new Set(partner_ids)
    const removing    = existingArr.filter(pid => !incomingSet.has(pid))

    if (removing.length > 0) {
      const { data: activeTender } = await admin
        .from('fpe_tenders')
        .select('id, status')
        .eq('project_id', project_id)
        .not('status', 'in', '("cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeTender && activeTender.status === 'launched') {
        const { data: blockingInvs } = await admin
          .from('fpe_tender_invitations')
          .select('partner_id, status, partner:fpe_partners(nombre)')
          .eq('tender_id', activeTender.id)
          .in('partner_id', removing)
          .in('status', ['sent', 'viewed', 'bid_submitted'])

        if (blockingInvs && blockingInvs.length > 0) {
          type BlockingInv = { partner_id: string; status: string; partner: { nombre: string } | null }
          const names = (blockingInvs as unknown as BlockingInv[])
            .map(b => b.partner?.nombre ?? b.partner_id)
            .join(', ')
          return { error: `No se puede quitar partners con invitación activa (${names}). Revoca primero la invitación.` }
        }
      }
    }

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
  data: { fecha_inicio_obra: string | null; duracion_obra_semanas?: number | null }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const payload: Record<string, unknown> = {
      fecha_inicio_obra: data.fecha_inicio_obra || null,
    }
    if (data.duracion_obra_semanas !== undefined) {
      payload.duracion_obra_semanas = data.duracion_obra_semanas
    }
    const { error } = await admin
      .from('fpe_projects')
      .update(payload)
      .eq('id', projectId)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${projectId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function saveChapterDaysOverride(
  project_id: string,
  chapter_id: string,
  duracion_dias_override: number | null,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_project_chapter_settings')
      .upsert(
        { project_id, chapter_id, duracion_dias_override, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,chapter_id' },
      )
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Factor global de duración (multiplicador 0.5–2.0 razonable, default 1.0).
// Solo afecta a capítulos sin override manual.
export async function saveDuracionFactor(
  projectId: string,
  factor: number,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    if (!Number.isFinite(factor) || factor <= 0) {
      return { error: 'El factor debe ser un número positivo.' }
    }
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({ duracion_factor: factor })
      .eq('id', projectId)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${projectId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Resets all schedule parameters for a project: clears fecha_inicio_obra and
// duracion_obra_semanas on fpe_projects, and nulls duracion_dias_override on every
// fpe_project_chapter_settings row (keeping principal_discipline_id intact).
export async function resetProjectSchedule(
  projectId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const { error: projErr } = await admin
      .from('fpe_projects')
      .update({ fecha_inicio_obra: null, duracion_obra_semanas: null })
      .eq('id', projectId)
    if (projErr) return { error: projErr.message }

    const { error: settingsErr } = await admin
      .from('fpe_project_chapter_settings')
      .update({ duracion_dias_override: null, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
    if (settingsErr) return { error: settingsErr.message }

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

// ── Chapter principal discipline ──────────────────────────────────────────────
// Upserts the principal discipline for a chapter in the context of a project.
// Used by the Scope tab to record (or override) which discipline is responsible
// for proposing phase durations for each chapter.

export async function saveChapterPrincipalDiscipline(
  project_id: string,
  chapter_id: string,
  principal_discipline_id: string | null,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_project_chapter_settings')
      .upsert(
        { project_id, chapter_id, principal_discipline_id, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,chapter_id' },
      )
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${project_id}`)
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

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
// Replaces the entire scope for a project (delete-all + re-insert).
// Safe for Phase 2 (no tenders yet). Phase 4+ will need a diff-based approach.

export async function saveProjectScope(
  project_id: string,
  units: {
    template_unit_id: string
    notas?: string | null
    line_items: {
      template_line_item_id: string
      cantidad: number
      notas?: string | null
    }[]
  }[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Delete existing scope (CASCADE removes line items)
    const { error: delErr } = await admin
      .from('fpe_project_units')
      .delete()
      .eq('project_id', project_id)
    if (delErr) return { error: delErr.message }

    // Insert each unit and its line items
    for (let i = 0; i < units.length; i++) {
      const u = units[i]
      const { data: pu, error: puErr } = await admin
        .from('fpe_project_units')
        .insert({
          project_id,
          template_unit_id: u.template_unit_id,
          notas: u.notas ?? null,
          orden: i,
        })
        .select('id')
        .single()
      if (puErr) return { error: puErr.message }

      if (u.line_items.length > 0) {
        const { error: liErr } = await admin
          .from('fpe_project_line_items')
          .insert(
            u.line_items.map((li, j) => ({
              project_unit_id: pu.id,
              template_line_item_id: li.template_line_item_id,
              cantidad: li.cantidad,
              notas: li.notas ?? null,
            }))
          )
        if (liErr) return { error: liErr.message }
      }
    }

    // Compute full readiness score (includes docs + partners check)
    await computeAndSaveReadiness(admin, project_id)

    revalidatePath(LIST_PATH)
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Contract a project ────────────────────────────────────────────────────────

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

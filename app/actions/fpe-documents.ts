'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'fpe-documents'

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    throw new Error('Sin permisos.')
}

// ── Get signed URL for viewing a private document ─────────────────────────────

export async function getDocumentSignedUrl(
  storage_path: string
): Promise<{ url: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storage_path, 60 * 60) // 1 hour
    if (error) return { error: error.message }
    return { url: data.signedUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Delete a document ─────────────────────────────────────────────────────────

export async function deleteDocument(
  id: string,
  storage_path: string,
  project_id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Delete from storage first
    const { error: storErr } = await admin.storage.from(BUCKET).remove([storage_path])
    if (storErr) return { error: storErr.message }

    // Delete DB record
    const { error: dbErr } = await admin.from('fpe_documents').delete().eq('id', id)
    if (dbErr) return { error: dbErr.message }

    // Recompute readiness
    await computeAndSaveReadiness(admin, project_id)

    revalidatePath(`/team/fp-execution/projects/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Compute and persist readiness score ───────────────────────────────────────
// Can also be called from other server actions after scope/doc changes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeAndSaveReadiness(admin: any, project_id: string) {
  const [
    { count: unitCount },
    { data: lineItems },
    { count: docCount },
    { data: units },
    { data: caps },
  ] = await Promise.all([
    admin.from('fpe_project_units').select('id', { count: 'exact', head: true }).eq('project_id', project_id),
    admin.from('fpe_project_line_items').select('project_unit_id, cantidad').in(
      'project_unit_id',
      (await admin.from('fpe_project_units').select('id').eq('project_id', project_id)).data?.map((r: { id: string }) => r.id) ?? []
    ),
    admin.from('fpe_documents').select('id', { count: 'exact', head: true }).eq('project_id', project_id),
    admin.from('fpe_project_units').select('id, template_unit_id').eq('project_id', project_id),
    admin.from('fpe_partner_capabilities').select('unit_id'),
  ])

  const hasScope      = (unitCount ?? 0) > 0
  const allHaveQty    = hasScope && (lineItems ?? []).length > 0 && (lineItems ?? []).every((li: { cantidad: number }) => li.cantidad > 0)
  const hasDocs       = (docCount ?? 0) > 0
  const unitIds       = (units ?? []).map((u: { template_unit_id: string }) => u.template_unit_id)
  const capUnitIds    = new Set((caps ?? []).map((c: { unit_id: string }) => c.unit_id))
  const partnersReady = hasScope && unitIds.every((uid: string) => capUnitIds.has(uid))

  let score = 0
  if (hasScope)      score += 20
  if (allHaveQty)    score += 20
  if (hasDocs)       score += 30
  if (partnersReady) score += 30

  const status = !hasScope ? 'borrador'
    : score >= 70        ? 'scope_ready'
    : 'scope_ready'

  await admin
    .from('fpe_projects')
    .update({ readiness_score: score, status, updated_at: new Date().toISOString() })
    .eq('id', project_id)

  return { score, hasScope, allHaveQty, hasDocs, partnersReady }
}

// ── Readiness check (readable for UI) ────────────────────────────────────────

export async function getReadinessChecks(
  project_id: string
): Promise<{ checks: ReadinessCheck[]; score: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { score, hasScope, allHaveQty, hasDocs, partnersReady } =
      await computeAndSaveReadiness(admin, project_id)

    const checks: ReadinessCheck[] = [
      { key: 'scope',    label: 'Scope definido',            passed: hasScope,      pts: 20, blocking: true  },
      { key: 'qty',      label: 'Cantidades completadas',    passed: allHaveQty,    pts: 20, blocking: true  },
      { key: 'docs',     label: 'Documentación subida',      passed: hasDocs,       pts: 30, blocking: true  },
      { key: 'partners', label: 'Partners disponibles',      passed: partnersReady, pts: 30, blocking: false },
    ]

    return { checks, score }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export interface ReadinessCheck {
  key: string
  label: string
  passed: boolean
  pts: number
  blocking: boolean
}

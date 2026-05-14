'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildPaymentPlanSeed, type DisciplineWeight } from '@/lib/fp-execution/paymentPlan'
import type { FpeDisciplinePaymentMilestone, FpeInvitationPaymentPlanItem, PaymentPlanSeedStrategy } from '@/lib/fp-execution/domain'

const PATH = '/team/fp-execution/template'
const PROJECTS_PATH = '/team/fp-execution/projects'

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) throw new Error('Sin permisos.')
}

export async function createDisciplinePaymentMilestone(data: {
  discipline_id: string
  milestone_id?: string | null
  trigger_type?: string
  nombre: string
  pct: number
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_discipline_payment_milestones')
      .insert({
        discipline_id: data.discipline_id,
        milestone_id:  data.milestone_id ?? null,
        trigger_type:  data.trigger_type ?? 'milestone_achieved',
        nombre:        data.nombre,
        pct:           data.pct,
        orden:         data.orden ?? 0,
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

export async function updateDisciplinePaymentMilestone(
  id: string,
  data: { milestone_id?: string | null; trigger_type?: string; nombre?: string; pct?: number; orden?: number }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_discipline_payment_milestones')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteDisciplinePaymentMilestone(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_discipline_payment_milestones').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// generateContractPaymentSchedule
// Prioridad de fuente:
//   1) Si existe plan de invitación (fpe_invitation_payment_plan) asociado al contrato → copiar de ahí.
//   2) Fallback: hitos de la disciplina gobernante (modelo legacy).
// Mantener el segundo modo evita romper contratos generados antes del cambio.
export async function generateContractPaymentSchedule(
  contract_id: string,
  governing_discipline_id: string,
  bid_total: number,
  invitation_id?: string | null,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    if (invitation_id) {
      const { data: planRows } = await admin
        .from('fpe_invitation_payment_plan')
        .select('id, nombre, pct, trigger_type, milestone_id, orden')
        .eq('invitation_id', invitation_id)
        .order('orden', { ascending: true })

      if (planRows && planRows.length > 0) {
        const rows = planRows.map((p, i) => ({
          contract_id,
          discipline_payment_milestone_id: null,
          nombre:       p.nombre,
          pct:          p.pct,
          monto:        Math.round(bid_total * (Number(p.pct) / 100) * 100) / 100,
          milestone_id: p.milestone_id ?? null,
          status:       'pendiente',
          orden:        i,
        }))
        const { error: insErr } = await admin.from('fpe_contract_payment_schedule').insert(rows)
        if (insErr) return { error: insErr.message }
        revalidatePath(PROJECTS_PATH)
        return { success: true }
      }
    }

    // Fallback legacy
    const { data: pmRows, error: pmErr } = await admin
      .from('fpe_discipline_payment_milestones')
      .select('id, nombre, pct, trigger_type, milestone_id, orden')
      .eq('discipline_id', governing_discipline_id)
      .order('orden', { ascending: true })

    if (pmErr) return { error: pmErr.message }
    if (!pmRows || pmRows.length === 0) return { error: 'No hay hitos de pago configurados para esta disciplina.' }

    const rows = pmRows.map((pm, i) => ({
      contract_id,
      discipline_payment_milestone_id: pm.id,
      nombre:      pm.nombre,
      pct:         pm.pct,
      monto:       Math.round(bid_total * (Number(pm.pct) / 100) * 100) / 100,
      milestone_id: pm.milestone_id ?? null,
      status:      'pendiente',
      orden:       i,
    }))

    const { error: insErr } = await admin.from('fpe_contract_payment_schedule').insert(rows)
    if (insErr) return { error: insErr.message }

    revalidatePath(PROJECTS_PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Plan de pago por invitación ───────────────────────────────────────────────

export interface InvitationPaymentPlanPayload {
  plan: FpeInvitationPaymentPlanItem[]
  disciplines: { id: string; nombre: string; color: string; weight: number }[]
  reference: { discipline_id: string; nombre: string; color: string; milestones: FpeDisciplinePaymentMilestone[] }[]
}

// Para una invitación, calcula:
// - El plan actual (filas en fpe_invitation_payment_plan).
// - Peso por disciplina del partner = nº UEs del proyecto donde
//   (partner está asignado) AND (principal_discipline_id de la UE = disciplina).
// - Hitos de referencia por disciplina (fpe_discipline_payment_milestones).
export async function getInvitationPaymentPlan(
  invitation_id: string,
): Promise<InvitationPaymentPlanPayload | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const { data: inv, error: invErr } = await admin
      .from('fpe_tender_invitations')
      .select('id, partner_id, discipline_ids, tender:fpe_tenders(project_id)')
      .eq('id', invitation_id)
      .single()

    if (invErr || !inv) return { error: invErr?.message ?? 'Invitación no encontrada.' }
    type InvShape = { id: string; partner_id: string; discipline_ids: string[] | null; tender: { project_id: string } | null }
    const invRow = inv as unknown as InvShape
    const projectId = invRow.tender?.project_id
    if (!projectId) return { error: 'No se pudo derivar el proyecto de la invitación.' }

    const disciplineIds = (invRow.discipline_ids ?? []).filter(Boolean)

    // Peso por disciplina = nº UEs del proyecto donde el partner está asignado
    // y la disciplina principal coincide.
    const { data: unitsRaw } = await admin
      .from('fpe_project_units')
      .select(`
        id,
        template_unit:fpe_template_units ( principal_discipline_id ),
        partners:fpe_project_unit_partners ( partner_id )
      `)
      .eq('project_id', projectId)

    type UnitRow = {
      id: string
      template_unit: { principal_discipline_id: string | null } | null
      partners: { partner_id: string }[] | null
    }
    const units = (unitsRaw ?? []) as unknown as UnitRow[]

    const weightByDiscipline: Record<string, number> = {}
    for (const u of units) {
      const principal = u.template_unit?.principal_discipline_id
      if (!principal) continue
      const has = (u.partners ?? []).some(p => p.partner_id === invRow.partner_id)
      if (!has) continue
      weightByDiscipline[principal] = (weightByDiscipline[principal] ?? 0) + 1
    }

    // Asegura que las disciplinas declaradas en la invitación aparezcan aunque
    // su peso sea 0 (por si la asignación de partners cambió después de invitar).
    for (const did of disciplineIds) {
      if (!(did in weightByDiscipline)) weightByDiscipline[did] = 0
    }

    const relevantDisciplineIds = Array.from(new Set([...disciplineIds, ...Object.keys(weightByDiscipline)])).filter(Boolean)

    const { data: discs } = await admin
      .from('fpe_disciplines')
      .select('id, nombre, color')
      .in('id', relevantDisciplineIds.length > 0 ? relevantDisciplineIds : ['00000000-0000-0000-0000-000000000000'])

    type DiscRow = { id: string; nombre: string; color: string | null }
    const discsArr = (discs ?? []) as DiscRow[]

    const { data: pmRows } = await admin
      .from('fpe_discipline_payment_milestones')
      .select('id, discipline_id, milestone_id, trigger_type, nombre, pct, orden, created_at, updated_at')
      .in('discipline_id', relevantDisciplineIds.length > 0 ? relevantDisciplineIds : ['00000000-0000-0000-0000-000000000000'])
      .order('orden', { ascending: true })

    const milestonesByDiscipline: Record<string, FpeDisciplinePaymentMilestone[]> = {}
    for (const m of (pmRows ?? []) as FpeDisciplinePaymentMilestone[]) {
      if (!milestonesByDiscipline[m.discipline_id]) milestonesByDiscipline[m.discipline_id] = []
      milestonesByDiscipline[m.discipline_id].push(m)
    }

    const disciplines = discsArr.map(d => ({
      id:     d.id,
      nombre: d.nombre,
      color:  d.color ?? '#888',
      weight: weightByDiscipline[d.id] ?? 0,
    })).sort((a, b) => b.weight - a.weight || a.nombre.localeCompare(b.nombre))

    const reference = disciplines.map(d => ({
      discipline_id: d.id,
      nombre:        d.nombre,
      color:         d.color,
      milestones:    milestonesByDiscipline[d.id] ?? [],
    }))

    const { data: planRows } = await admin
      .from('fpe_invitation_payment_plan')
      .select('id, invitation_id, nombre, pct, trigger_type, milestone_id, source_discipline_id, orden, notas, created_at, updated_at')
      .eq('invitation_id', invitation_id)
      .order('orden', { ascending: true })

    return {
      plan:        (planRows ?? []) as FpeInvitationPaymentPlanItem[],
      disciplines,
      reference,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Recalcula el plan desde cero usando una estrategia. Reemplaza por completo
// el plan actual de la invitación.
export async function regenerateInvitationPaymentPlan(
  invitation_id: string,
  strategy: PaymentPlanSeedStrategy,
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const payload = await getInvitationPaymentPlan(invitation_id)
    if ('error' in payload) return { error: payload.error }

    const weights: DisciplineWeight[] = payload.reference.map(r => ({
      discipline_id: r.discipline_id,
      weight:        Math.max(payload.disciplines.find(d => d.id === r.discipline_id)?.weight ?? 0, 0),
      milestones:    r.milestones,
    })).filter(w => w.milestones.length > 0)

    // Si todas las disciplinas implicadas tienen weight=0 (caso raro), forzamos
    // pesos iguales para no perder señal.
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0)
    const normalizedWeights = totalWeight > 0 ? weights : weights.map(w => ({ ...w, weight: 1 }))

    const items = buildPaymentPlanSeed(strategy, normalizedWeights)

    await admin.from('fpe_invitation_payment_plan').delete().eq('invitation_id', invitation_id)

    if (items.length > 0) {
      const rows = items.map(it => ({
        invitation_id,
        nombre:               it.nombre,
        pct:                  it.pct,
        trigger_type:         it.trigger_type,
        milestone_id:         it.milestone_id,
        source_discipline_id: it.source_discipline_id,
        orden:                it.orden,
      }))
      const { error: insErr } = await admin.from('fpe_invitation_payment_plan').insert(rows)
      if (insErr) return { error: insErr.message }
    }

    revalidatePath(PROJECTS_PATH)
    return { success: true, count: items.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Reemplazo manual del plan completo (al guardar el modal).
export async function updateInvitationPaymentPlan(
  invitation_id: string,
  items: {
    nombre: string
    pct: number
    trigger_type: 'contract_signed' | 'milestone_achieved' | 'delivery'
    milestone_id?: string | null
    source_discipline_id?: string | null
    notas?: string | null
  }[],
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const sum = items.reduce((s, it) => s + Number(it.pct), 0)
    if (Math.abs(sum - 100) > 0.01) {
      return { error: `La suma de porcentajes debe ser 100% (actual: ${sum.toFixed(2)}%).` }
    }

    await admin.from('fpe_invitation_payment_plan').delete().eq('invitation_id', invitation_id)

    if (items.length > 0) {
      const rows = items.map((it, i) => ({
        invitation_id,
        nombre:               it.nombre,
        pct:                  it.pct,
        trigger_type:         it.trigger_type,
        milestone_id:         it.milestone_id ?? null,
        source_discipline_id: it.source_discipline_id ?? null,
        notas:                it.notas ?? null,
        orden:                i,
      }))
      const { error: insErr } = await admin.from('fpe_invitation_payment_plan').insert(rows)
      if (insErr) return { error: insErr.message }
    }

    revalidatePath(PROJECTS_PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Lectura pública (sin auth) usada desde el portal del partner: dado el token,
// devuelve el plan en read-only.
export async function getInvitationPaymentPlanByToken(
  token: string,
): Promise<{ plan: FpeInvitationPaymentPlanItem[] } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data: inv } = await admin
      .from('fpe_tender_invitations')
      .select('id')
      .eq('token', token)
      .maybeSingle()
    if (!inv) return { error: 'Invitación no encontrada.' }

    const { data: planRows } = await admin
      .from('fpe_invitation_payment_plan')
      .select('id, invitation_id, nombre, pct, trigger_type, milestone_id, source_discipline_id, orden, notas, created_at, updated_at')
      .eq('invitation_id', (inv as { id: string }).id)
      .order('orden', { ascending: true })

    return { plan: (planRows ?? []) as FpeInvitationPaymentPlanItem[] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePaymentScheduleStatus(
  id: string,
  status: 'pendiente' | 'facturado' | 'cobrado',
  fecha_pago?: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_contract_payment_schedule')
      .update({ status, fecha_pago: fecha_pago ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/team/fp-execution/projects')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

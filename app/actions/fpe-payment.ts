'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/fp-execution/template'

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

export async function generateContractPaymentSchedule(
  contract_id: string,
  governing_discipline_id: string,
  bid_total: number
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

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
      monto:       Math.round(bid_total * (pm.pct / 100) * 100) / 100,
      milestone_id: pm.milestone_id ?? null,
      status:      'pendiente',
      orden:       i,
    }))

    const { error: insErr } = await admin.from('fpe_contract_payment_schedule').insert(rows)
    if (insErr) return { error: insErr.message }

    revalidatePath('/team/fp-execution/projects')
    return { success: true }
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

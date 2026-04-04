'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}

const COSTES_PATHS = [
  '/team/finanzas/operativas/costes',
  '/team/finanzas/macro/costes',
]
function revalidateCostes() { COSTES_PATHS.forEach(p => revalidatePath(p)) }

// ── Costos de equipo ──────────────────────────────────────────────────────────

export async function updateMemberCosts(
  userId: string,
  data: {
    seniority?:       string | null
    salario_mensual?: number | null
    horas_mensuales?: number | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // 1. Update the profile (source of truth for current display)
    const { error } = await admin.from('profiles').update(data).eq('id', userId)
    if (error) return { error: error.message }

    // 2. If salary or hours changed, snapshot into salary history
    //    so past project costs are never affected by future changes
    if (data.salario_mensual !== undefined || data.horas_mensuales !== undefined) {
      const today     = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

      // Read back the full updated profile so we always store both values together
      const { data: profile } = await admin
        .from('profiles')
        .select('salario_mensual, horas_mensuales')
        .eq('id', userId)
        .single()

      if (profile?.salario_mensual && profile?.horas_mensuales) {
        // If a record was already created today (multiple edits same day), just update it
        const { data: todayRecord } = await admin
          .from('salarios_historia')
          .select('id')
          .eq('user_id', userId)
          .eq('valid_from', today)
          .maybeSingle()

        if (todayRecord) {
          await admin
            .from('salarios_historia')
            .update({ salario_mensual: profile.salario_mensual, horas_mensuales: profile.horas_mensuales })
            .eq('id', todayRecord.id)
        } else {
          // Close the currently-open record
          await admin
            .from('salarios_historia')
            .update({ valid_to: yesterday })
            .eq('user_id', userId)
            .is('valid_to', null)
          // Open a new record from today onwards
          await admin
            .from('salarios_historia')
            .insert({
              user_id:         userId,
              salario_mensual: profile.salario_mensual,
              horas_mensuales: profile.horas_mensuales,
              valid_from:      today,
              valid_to:        null,
            })
        }
      }
    }

    revalidateCostes()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Costos fijos ──────────────────────────────────────────────────────────────

export async function addCostoFijo(): Promise<{ id: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data: last } = await admin
      .from('costos_fijos').select('orden').order('orden', { ascending: false }).limit(1)
    const orden = (last?.[0]?.orden ?? 0) + 1
    const { data, error } = await admin
      .from('costos_fijos')
      .insert({ concepto: 'Nuevo concepto', monto: 0, orden })
      .select('id')
      .single()
    if (error) return { error: error.message }

    // Open a history record starting today (monto 0 has no cost impact)
    const today = new Date().toISOString().split('T')[0]
    await admin.from('costos_fijos_historia').insert({
      costo_fijo_id: data.id,
      concepto:      'Nuevo concepto',
      monto:         0,
      valid_from:    today,
      valid_to:      null,
    })

    revalidateCostes()
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateCostoFijo(
  id: string,
  data: { concepto?: string; monto?: number }
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('costos_fijos').update(data).eq('id', id)
    if (error) return { error: error.message }

    // If monto changed, snapshot into history so past costs are never affected
    if (data.monto !== undefined) {
      const today     = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

      // Read back current state (concepto may have been updated simultaneously)
      const { data: current } = await admin
        .from('costos_fijos')
        .select('concepto, monto')
        .eq('id', id)
        .single()

      if (current) {
        // If already edited today, just overwrite that record instead of creating a gap
        const { data: todayRecord } = await admin
          .from('costos_fijos_historia')
          .select('id')
          .eq('costo_fijo_id', id)
          .eq('valid_from', today)
          .maybeSingle()

        if (todayRecord) {
          await admin
            .from('costos_fijos_historia')
            .update({ concepto: current.concepto, monto: current.monto })
            .eq('id', todayRecord.id)
        } else {
          // Close the currently-open record
          await admin
            .from('costos_fijos_historia')
            .update({ valid_to: yesterday })
            .eq('costo_fijo_id', id)
            .is('valid_to', null)
          // Open a new record from today onwards
          await admin
            .from('costos_fijos_historia')
            .insert({
              costo_fijo_id: id,
              concepto:      current.concepto,
              monto:         current.monto,
              valid_from:    today,
              valid_to:      null,
            })
        }
      }
    }

    revalidateCostes()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteCostoFijo(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Close the history record first so past entries keep their cost
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
    await admin
      .from('costos_fijos_historia')
      .update({ valid_to: yesterday })
      .eq('costo_fijo_id', id)
      .is('valid_to', null)

    const { error } = await admin.from('costos_fijos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidateCostes()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateFinanzasConfig(key: string, value: number): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('finanzas_config')
      .upsert({ key, value }, { onConflict: 'key' })
    if (error) return { error: error.message }
    revalidateCostes()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Costos variables ──────────────────────────────────────────────────────────

export async function addCostoVariable(data: {
  año: number; mes: number; categoria: string; concepto: string; monto: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('costos_variables')
      .insert(data)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidateCostes()
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateCostoVariable(
  id: string,
  data: Partial<{ categoria: string; concepto: string; monto: number; notas: string | null }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('costos_variables').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidateCostes()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteCostoVariable(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('costos_variables').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidateCostes()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Costos variables de proyecto ──────────────────────────────────────────────

export async function addCostoVariableProyecto(data: {
  proyecto_id: string
  proyecto_nombre: string
  concepto: string
  categoria: string
  monto: number
  año: number
  mes: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('costos_variables')
      .insert(data)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidateCostes()
    revalidatePath(`/team/finanzas/operativas/proyectos/${data.proyecto_id}`)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteCostoVariableProyecto(
  id: string,
  proyectoId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('costos_variables').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidateCostes()
    revalidatePath(`/team/finanzas/operativas/proyectos/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { normalizeInputs, type Escenario, type ModeloInputs } from '@/lib/modelo-cafe/domain'
import { CAPEX_DEFAULT, normalizeCapexItems, type CapexItem } from '@/lib/modelo-cafe/capex'

const PATH = '/team/apps/modelo-cafe'
const TABLA = 'modelo_cafe_escenarios'
const TABLA_CAPEX = 'modelo_cafe_capex'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return { userId: user.id }
}

type EscenarioRow = Omit<Escenario, 'inputs'> & { inputs: unknown }

function toEscenario(row: EscenarioRow): Escenario {
  return { ...row, inputs: normalizeInputs(row.inputs) }
}

export async function getEscenarios(): Promise<Escenario[]> {
  await requirePartner()
  const admin = createAdminClient()
  const { data } = await admin
    .from(TABLA)
    .select('*')
    .order('es_base', { ascending: false })
    .order('created_at', { ascending: true })
  return ((data ?? []) as EscenarioRow[]).map(toEscenario)
}

type EscenarioResult = { escenario: Escenario } | { error: string }

export async function createEscenario(
  nombre: string,
  inputs: ModeloInputs,
  notas?: string | null
): Promise<EscenarioResult> {
  const { userId } = await requirePartner()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from(TABLA)
    .insert({
      nombre: nombre.trim() || 'Escenario sin nombre',
      notas: notas?.trim() || null,
      inputs: normalizeInputs(inputs),
      created_by: userId,
    })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'No se pudo crear el escenario.' }
  revalidatePath(PATH)
  return { escenario: toEscenario(data as EscenarioRow) }
}

export async function updateEscenario(
  id: string,
  patch: { nombre?: string; notas?: string | null; inputs?: ModeloInputs }
): Promise<EscenarioResult> {
  await requirePartner()
  const admin = createAdminClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.nombre !== undefined) update.nombre = patch.nombre.trim() || 'Escenario sin nombre'
  if (patch.notas !== undefined) update.notas = patch.notas?.trim() || null
  if (patch.inputs !== undefined) update.inputs = normalizeInputs(patch.inputs)
  const { data, error } = await admin
    .from(TABLA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'No se pudo guardar el escenario.' }
  revalidatePath(PATH)
  return { escenario: toEscenario(data as EscenarioRow) }
}

export async function deleteEscenario(id: string): Promise<{ success: true } | { error: string }> {
  await requirePartner()
  const admin = createAdminClient()
  const { data: existing } = await admin.from(TABLA).select('es_base').eq('id', id).single()
  if (!existing) return { error: 'El escenario no existe.' }
  if (existing.es_base) return { error: 'El escenario base no se puede eliminar.' }
  const { error } = await admin.from(TABLA).delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ── CAPEX de equipamiento (compartido, una sola fila 'default') ─────

/** Lee el CAPEX guardado; si la tabla/fila no existe aún, devuelve la lista por defecto. */
export async function getCapex(): Promise<CapexItem[]> {
  await requirePartner()
  const admin = createAdminClient()
  try {
    const { data, error } = await admin
      .from(TABLA_CAPEX)
      .select('items')
      .eq('clave', 'default')
      .maybeSingle()
    if (error || !data) return CAPEX_DEFAULT
    const items = normalizeCapexItems((data as { items: unknown }).items)
    return items.length ? items : CAPEX_DEFAULT
  } catch {
    return CAPEX_DEFAULT
  }
}

export async function saveCapex(
  items: CapexItem[]
): Promise<{ success: true } | { error: string }> {
  const { userId } = await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin
    .from(TABLA_CAPEX)
    .upsert(
      { clave: 'default', items: normalizeCapexItems(items), updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'clave' }
    )
  if (error) {
    return { error: error.message.includes('does not exist') || error.message.includes('schema cache')
      ? 'Falta ejecutar la migración modelo_cafe_capex.sql en Supabase.'
      : error.message }
  }
  revalidatePath(PATH)
  return { success: true }
}

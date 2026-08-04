'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CATEGORIAS_FALLBACK,
  PREFIJOS_RESERVADOS,
  codigoDesdeLabel,
  type CategoriaInterna,
  type TipoCategoriaInterna,
} from '@/lib/time-tracker/categorias'

const TABLA = 'tt_categorias_internas'
const SELECT = 'id, codigo, label, tipo, activo, orden, visible_para'

type Fail = { error: string }
type Ok   = { success: true }

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) throw new Error('Sin permisos.')
}

/**
 * Lista de categorías + cuántos registros de horas usa cada una.
 *
 * `disponible: false` = la migración `timetracker_categorias.sql` no está
 * ejecutada todavía: el Time Tracker sigue funcionando con `CATEGORIAS_FALLBACK`
 * y el editor se muestra en solo lectura.
 */
export async function getCategoriasInternas(): Promise<{
  categorias: CategoriaInterna[]
  uso:        Record<string, number>
  disponible: boolean
}> {
  const admin = createAdminClient()
  const { data, error } = await admin.from(TABLA).select(SELECT).order('orden')

  if (error || !data) {
    return { categorias: CATEGORIAS_FALLBACK, uso: {}, disponible: false }
  }

  const categorias = data as CategoriaInterna[]

  // Una consulta de conteo por categoría: son una docena, y así no traemos
  // decenas de miles de time_entries al servidor solo para contarlas.
  const conteos = await Promise.all(
    categorias.map(async (c) => {
      const { count } = await admin
        .from('time_entries')
        .select('id', { count: 'exact', head: true })
        .eq('categoria_interna', c.codigo)
      return [c.codigo, count ?? 0] as const
    })
  )

  return { categorias, uso: Object.fromEntries(conteos), disponible: true }
}

export async function createCategoriaInterna(input: {
  label: string
  tipo:  TipoCategoriaInterna
  visible_para?: string[] | null
}): Promise<Fail | (Ok & { categoria: CategoriaInterna })> {
  try {
    await requireManagerOrPartner()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const label  = input.label.trim()
  const codigo = codigoDesdeLabel(label)
  if (!label)  return { error: 'La categoría necesita un nombre.' }
  if (!codigo) return { error: 'El nombre debe tener al menos una letra o número.' }
  if (PREFIJOS_RESERVADOS.some((p) => codigo.startsWith(p))) {
    return { error: `"${codigo}" empieza por un prefijo reservado (${PREFIJOS_RESERVADOS.join(', ')}). Usa otro nombre.` }
  }

  const admin = createAdminClient()

  const { data: existente } = await admin.from(TABLA).select('label, activo').eq('codigo', codigo).maybeSingle()
  if (existente) {
    return existente.activo
      ? { error: `Ya existe la categoría "${existente.label}".` }
      : { error: `"${existente.label}" existe pero está archivada. Restáurala en lugar de crearla de nuevo.` }
  }

  const { data: ultima } = await admin.from(TABLA).select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await admin
    .from(TABLA)
    .insert({
      codigo,
      label,
      tipo: input.tipo,
      orden: (ultima?.orden ?? -1) + 1,
      visible_para: input.visible_para?.length ? input.visible_para : null,
    })
    .select(SELECT)
    .single()

  if (error) return { error: error.message }
  revalidatePath('/team/proyectos/plantilla')
  return { success: true, categoria: data as CategoriaInterna }
}

/**
 * El `codigo` no se puede editar a propósito: es la clave con la que están
 * guardados los registros históricos en `time_entries.categoria_interna`.
 */
export async function updateCategoriaInterna(
  id: string,
  patch: { label?: string; tipo?: TipoCategoriaInterna; activo?: boolean; visible_para?: string[] | null }
): Promise<Fail | Ok> {
  try {
    await requireManagerOrPartner()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const update: Record<string, unknown> = {}
  if (patch.label !== undefined) {
    const label = patch.label.trim()
    if (!label) return { error: 'La categoría necesita un nombre.' }
    update.label = label
  }
  if (patch.tipo   !== undefined) update.tipo   = patch.tipo
  if (patch.activo !== undefined) update.activo = patch.activo
  if (patch.visible_para !== undefined) {
    update.visible_para = patch.visible_para?.length ? patch.visible_para : null
  }
  if (Object.keys(update).length === 0) return { success: true }

  const admin = createAdminClient()
  const { error } = await admin.from(TABLA).update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/team/proyectos/plantilla')
  return { success: true }
}

/**
 * Borrado real. Solo si nadie ha registrado horas con ella: si hay histórico, la
 * respuesta correcta es archivarla (`updateCategoriaInterna(id, { activo: false })`),
 * porque borrarla dejaría registros con un código sin etiqueta.
 */
export async function deleteCategoriaInterna(id: string): Promise<Fail | Ok> {
  try {
    await requireManagerOrPartner()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()
  const { data: categoria } = await admin.from(TABLA).select('codigo, label').eq('id', id).single()
  if (!categoria) return { error: 'La categoría ya no existe.' }

  const { count } = await admin
    .from('time_entries')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_interna', categoria.codigo)

  if ((count ?? 0) > 0) {
    return { error: `"${categoria.label}" tiene ${count} registro(s) de horas. Archívala en lugar de eliminarla para no perder el histórico.` }
  }

  const { error } = await admin.from(TABLA).delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/team/proyectos/plantilla')
  return { success: true }
}

/** Reordena el desplegable: los ids llegan en el orden deseado. */
export async function reordenarCategoriasInternas(ids: string[]): Promise<Fail | Ok> {
  try {
    await requireManagerOrPartner()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin.from(TABLA).update({ orden: i }).eq('id', ids[i])
    if (error) return { error: error.message }
  }
  revalidatePath('/team/proyectos/plantilla')
  return { success: true }
}

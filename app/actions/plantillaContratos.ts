'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CLAUSULAS_DEFAULT, seedClausulas } from '@/lib/contratos/clausulas'
import type { ContratoClausula } from '@/lib/contratos/clausulas'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'

const PATH = '/team/captacion/plantilla-contratos'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}

type Row = ContratoClausula & { orden: number }

function rowFromClausula(c: ContratoClausula, orden: number): Row {
  return {
    key: c.key, orden, nivel: c.nivel,
    titulo_es: c.titulo_es, titulo_en: c.titulo_en,
    bloques_es: c.bloques_es, bloques_en: c.bloques_en,
    es_nucleo: c.es_nucleo ?? false, condicion: c.condicion ?? null,
  }
}

function clausulaFromRow(r: Record<string, unknown>): ContratoClausula {
  return {
    key: r.key as string,
    nivel: (r.nivel as ContratoClausula['nivel']) ?? 'clausula',
    titulo_es: (r.titulo_es as string) ?? '',
    titulo_en: (r.titulo_en as string) ?? '',
    bloques_es: (r.bloques_es as ContratoClausula['bloques_es']) ?? [],
    bloques_en: (r.bloques_en as ContratoClausula['bloques_en']) ?? [],
    es_nucleo: (r.es_nucleo as boolean) ?? false,
    condicion: (r.condicion as string | null) ?? null,
  }
}

/**
 * Plantilla de origen de las cláusulas. Si la tabla está vacía la siembra desde
 * el seed de fábrica. Si la tabla aún no existe (migración pendiente) devuelve el
 * seed en memoria sin romper.
 */
export async function getPlantillaClausulas(): Promise<ContratoClausula[]> {
  noStore()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contrato_clausulas_plantilla')
    .select('*')
    .order('orden', { ascending: true })

  if (error) {
    // Tabla inexistente o sin acceso → seed en memoria (no persiste).
    return seedClausulas()
  }
  if (!data || data.length === 0) {
    const rows = CLAUSULAS_DEFAULT.map((c, i) => rowFromClausula(c, i))
    await admin.from('contrato_clausulas_plantilla').insert(rows)
    return seedClausulas()
  }
  return data.map(clausulaFromRow)
}

/** Guarda toda la plantilla (upsert + borra las que ya no estén). Solo fp_partner. */
export async function savePlantillaClausulas(
  clausulas: ContratoClausula[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const rows = clausulas.map((c, i) => ({ ...rowFromClausula(c, i), updated_at: new Date().toISOString() }))

    const { error: upErr } = await admin
      .from('contrato_clausulas_plantilla')
      .upsert(rows, { onConflict: 'key' })
    if (upErr) return { error: upErr.message }

    // Borra las cláusulas que ya no estén en el conjunto enviado.
    const keys = clausulas.map(c => c.key)
    const { data: existing } = await admin.from('contrato_clausulas_plantilla').select('key')
    const toDelete = (existing ?? []).map(r => r.key as string).filter(k => !keys.includes(k))
    if (toDelete.length > 0) {
      await admin.from('contrato_clausulas_plantilla').delete().in('key', toDelete)
    }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Restaura la plantilla completa al seed de fábrica. Solo fp_partner. */
export async function restorePlantillaClausulasFabrica(): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    await admin.from('contrato_clausulas_plantilla').delete().neq('key', '')
    const rows = CLAUSULAS_DEFAULT.map((c, i) => rowFromClausula(c, i))
    const { error } = await admin.from('contrato_clausulas_plantilla').insert(rows)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

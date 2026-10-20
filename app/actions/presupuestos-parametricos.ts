'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  canAccessPresupuestosParametricos,
  SERIE_INDICE,
  type ObraReferencia,
  type IndicePunto,
  type Capitulo,
  type TipoReforma,
  type EstadoObra,
} from '@/lib/presupuestos-parametricos/domain'

const PATH = '/team/apps/presupuestos-parametricos'

async function requirePresupuestosAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !canAccessPresupuestosParametricos(profile.rol)) throw new Error('Sin permisos.')
  return { userId: user.id }
}

type Result = { success: true } | { error: string }

export type PanelData = {
  /** false si la migración presupuestos_parametricos.sql aún no está aplicada. */
  isMigrado: boolean
  obras: (ObraReferencia & { partidas: number; importe_partidas: number })[]
  capitulos: Capitulo[]
  indice: IndicePunto[]
}

export async function getPanelData(): Promise<PanelData> {
  await requirePresupuestosAccess()
  const admin = createAdminClient()

  const [obras, capitulos, indice] = await Promise.all([
    admin.from('pp_obras').select('*').order('fecha_presupuesto', { ascending: false }),
    admin.from('presupuesto_capitulos').select('id, numero, nombre, orden').eq('activo', true).order('orden'),
    admin.from('pp_indices').select('serie, periodo, valor, provisional').eq('serie', SERIE_INDICE).order('periodo'),
  ])

  if (obras.error) {
    return { isMigrado: false, obras: [], capitulos: (capitulos.data ?? []) as Capitulo[], indice: [] }
  }

  const lista = (obras.data ?? []) as ObraReferencia[]
  const ids = lista.map(o => o.id)
  const resumen = new Map<string, { partidas: number; importe: number }>()
  if (ids.length) {
    const { data: partidas } = await admin.from('pp_obra_partidas').select('obra_id, importe').in('obra_id', ids)
    for (const p of partidas ?? []) {
      const r = resumen.get(p.obra_id) ?? { partidas: 0, importe: 0 }
      r.partidas += 1
      r.importe += Number(p.importe) || 0
      resumen.set(p.obra_id, r)
    }
  }

  return {
    isMigrado: true,
    obras: lista.map(o => ({
      ...o,
      partidas: resumen.get(o.id)?.partidas ?? 0,
      importe_partidas: resumen.get(o.id)?.importe ?? 0,
    })),
    capitulos: (capitulos.data ?? []) as Capitulo[],
    indice: (indice.data ?? []) as IndicePunto[],
  }
}

export type ObraInput = {
  nombre: string
  direccion?: string | null
  constructor?: string | null
  fecha_presupuesto: string
  tipo_reforma: TipoReforma
  importe_documento?: number | null
  descuento_margen_pct?: number
  notas?: string | null
}

function limpiarObra(input: ObraInput) {
  const nombre = input.nombre?.trim()
  if (!nombre) throw new Error('La obra necesita un nombre.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_presupuesto ?? '')) throw new Error('Falta la fecha del presupuesto.')
  const pct = Number(input.descuento_margen_pct ?? 0)
  if (!Number.isFinite(pct) || pct < 0 || pct >= 1) throw new Error('El % de margen incluido debe estar entre 0 y 100.')
  return {
    nombre,
    direccion: input.direccion?.trim() || null,
    constructor: input.constructor?.trim() || null,
    fecha_presupuesto: input.fecha_presupuesto,
    tipo_reforma: input.tipo_reforma === 'parcial' ? 'parcial' : 'integral',
    importe_documento: input.importe_documento ?? null,
    descuento_margen_pct: pct,
    notas: input.notas?.trim() || null,
  }
}

export async function createObra(input: ObraInput): Promise<{ id: string } | { error: string }> {
  try {
    const { userId } = await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pp_obras')
      .insert({ ...limpiarObra(input), created_by: userId })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateObra(id: string, input: ObraInput): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { error } = await admin
      .from('pp_obras')
      .update({ ...limpiarObra(input), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateObraEstado(id: string, estado: EstadoObra): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { error } = await admin
      .from('pp_obras')
      .update({
        estado,
        publicada_at: estado === 'publicada' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteObra(id: string): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { data: obra } = await admin.from('pp_obras').select('pdf_path').eq('id', id).single()
    const { error } = await admin.from('pp_obras').delete().eq('id', id)
    if (error) return { error: error.message }
    if (obra?.pdf_path) await admin.storage.from('pp-presupuestos').remove([obra.pdf_path])
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

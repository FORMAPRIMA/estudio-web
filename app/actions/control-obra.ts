'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { ObraData, Partida, Proveedor, Pago, Deposito, LogEntry, Obra } from '@/lib/control-obra/domain'

const PATH = '/team/apps/control-obra'
const SLUG = 'claudio-coello-38'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return { userId: user.id }
}

type Result = { success: true } | { error: string }

export async function getObraData(): Promise<ObraData | null> {
  await requirePartner()
  const admin = createAdminClient()
  const { data: obra } = await admin.from('obra_control_obras').select('*').eq('slug', SLUG).single()
  if (!obra) return null
  const obraId = (obra as Obra).id

  const [partidas, proveedores, pagos, depositos, log] = await Promise.all([
    admin.from('obra_control_partidas').select('*').eq('obra_id', obraId).order('orden'),
    admin.from('obra_control_proveedores').select('*').eq('obra_id', obraId).order('orden'),
    admin.from('obra_control_pagos').select('*').eq('obra_id', obraId).order('orden'),
    admin.from('obra_control_depositos').select('*').eq('obra_id', obraId).order('orden'),
    admin.from('obra_control_log').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }).limit(500),
  ])

  return {
    obra: obra as Obra,
    partidas: (partidas.data ?? []) as Partida[],
    proveedores: (proveedores.data ?? []) as Proveedor[],
    pagos: (pagos.data ?? []) as Pago[],
    depositos: (depositos.data ?? []) as Deposito[],
    log: (log.data ?? []) as LogEntry[],
  }
}

async function logEvent(
  admin: ReturnType<typeof createAdminClient>,
  obraId: string,
  userId: string,
  e: { partida_codigo?: string | null; partida_desc?: string | null; tipo: string; resumen: string; motivo?: string | null }
) {
  await admin.from('obra_control_log').insert({
    obra_id: obraId,
    partida_codigo: e.partida_codigo ?? null,
    partida_desc: e.partida_desc ?? null,
    tipo: e.tipo,
    resumen: e.resumen,
    motivo: e.motivo ?? null,
    created_by: userId,
  })
}

// ── Partidas ────────────────────────────────────────────────────────

export async function updatePartida(
  id: string,
  patch: {
    descripcion?: string
    detalle?: string | null
    unidad?: string | null
    qty?: number | null
    puc?: number | null
    margin?: number
    pucl?: number | null
    pucl_auto?: boolean
    trasladar_cliente?: boolean
    proveedor_id?: string | null
    motivo_interno?: string | null
    nota_cliente?: string | null
  }
): Promise<Result> {
  try {
    const { userId } = await requirePartner()
    const admin = createAdminClient()
    const { data: prev } = await admin.from('obra_control_partidas').select('*').eq('id', id).single()
    if (!prev) return { error: 'Partida no encontrada.' }
    const p = prev as Partida

    const next: Record<string, unknown> = { ...patch, modified_at: new Date().toISOString() }

    // Normalizar campos de texto
    if (patch.descripcion !== undefined) {
      if (!patch.descripcion.trim()) return { error: 'La descripción no puede quedar vacía.' }
      next.descripcion = patch.descripcion.trim()
    }
    if (patch.detalle !== undefined) next.detalle = patch.detalle?.trim() || null
    if (patch.unidad !== undefined) next.unidad = patch.unidad?.trim() || null

    // Estado: nueva se conserva; si difiere del baseline → modificada; si vuelve al baseline → igual
    if (p.estado !== 'nueva' && p.estado !== 'eliminada') {
      const qty = patch.qty ?? p.qty
      const puc = patch.puc ?? p.puc
      const pucl = patch.pucl ?? p.pucl
      const changed = qty !== p.base_qty || puc !== p.base_puc || pucl !== p.base_pucl
      next.estado = changed ? 'modificada' : 'igual'
    }

    const { error } = await admin.from('obra_control_partidas').update(next).eq('id', id)
    if (error) return { error: error.message }

    await logEvent(admin, (p as any).obra_id, userId, {
      partida_codigo: p.codigo,
      partida_desc: p.descripcion,
      tipo: 'modificada',
      resumen: `Actualizada ${p.codigo}`,
      motivo: patch.motivo_interno ?? null,
    })
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function resetPartida(id: string): Promise<Result> {
  try {
    const { userId } = await requirePartner()
    const admin = createAdminClient()
    const { data: prev } = await admin.from('obra_control_partidas').select('*').eq('id', id).single()
    if (!prev) return { error: 'Partida no encontrada.' }
    const p = prev as any
    if (p.estado === 'nueva') return { error: 'Una partida nueva no tiene baseline al que volver.' }

    const { error } = await admin
      .from('obra_control_partidas')
      .update({
        qty: p.base_qty, puc: p.base_puc, pucl: p.base_pucl, margin: 1.16,
        pucl_auto: true, estado: 'igual', trasladar_cliente: true, motivo_interno: null, nota_cliente: null,
        modified_at: null,
      })
      .eq('id', id)
    if (error) return { error: error.message }
    await logEvent(admin, p.obra_id, userId, { partida_codigo: p.codigo, partida_desc: p.descripcion, tipo: 'restaurada', resumen: `Restaurada al baseline ${p.codigo}` })
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function setPartidaEliminada(id: string, eliminada: boolean): Promise<Result> {
  try {
    const { userId } = await requirePartner()
    const admin = createAdminClient()
    const { data: prev } = await admin.from('obra_control_partidas').select('*').eq('id', id).single()
    if (!prev) return { error: 'Partida no encontrada.' }
    const p = prev as any

    if (p.estado === 'nueva') {
      // Las partidas nuevas se borran de verdad
      const { error } = await admin.from('obra_control_partidas').delete().eq('id', id)
      if (error) return { error: error.message }
      await logEvent(admin, p.obra_id, userId, { partida_codigo: p.codigo, partida_desc: p.descripcion, tipo: 'eliminada', resumen: `Eliminada partida nueva ${p.codigo}` })
      revalidatePath(PATH)
      return { success: true }
    }

    const estado = eliminada ? 'eliminada' : 'igual'
    const { error } = await admin.from('obra_control_partidas').update({ estado, modified_at: new Date().toISOString() }).eq('id', id)
    if (error) return { error: error.message }
    await logEvent(admin, p.obra_id, userId, {
      partida_codigo: p.codigo, partida_desc: p.descripcion,
      tipo: eliminada ? 'eliminada' : 'restaurada',
      resumen: eliminada ? `No se ejecuta ${p.codigo}` : `Reactivada ${p.codigo}`,
    })
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function createPartida(data: {
  obra_id: string
  capitulo_num: number
  capitulo_nombre: string
  subcapitulo_codigo: string
  subcapitulo_nombre: string
  codigo: string
  descripcion: string
  detalle?: string | null
  unidad?: string | null
  qty: number
  puc: number
  margin: number
  pucl: number
  trasladar_cliente?: boolean
  proveedor_id?: string | null
  motivo_interno?: string | null
  nota_cliente?: string | null
}): Promise<Result> {
  try {
    const { userId } = await requirePartner()
    if (!data.descripcion?.trim()) return { error: 'La descripción es obligatoria.' }
    const admin = createAdminClient()
    const { data: maxRow } = await admin
      .from('obra_control_partidas').select('orden').eq('obra_id', data.obra_id).order('orden', { ascending: false }).limit(1).single()
    const orden = ((maxRow?.orden as number) ?? 0) + 1

    const { error } = await admin.from('obra_control_partidas').insert({
      obra_id: data.obra_id,
      capitulo_num: data.capitulo_num,
      capitulo_nombre: data.capitulo_nombre,
      subcapitulo_codigo: data.subcapitulo_codigo,
      subcapitulo_nombre: data.subcapitulo_nombre,
      codigo: data.codigo,
      descripcion: data.descripcion.trim(),
      detalle: data.detalle?.trim() || null,
      unidad: data.unidad?.trim() || null,
      base_qty: null, base_puc: null, base_pucl: null,
      qty: data.qty, puc: data.puc, margin: data.margin, pucl: data.pucl, pucl_auto: true,
      estado: 'nueva',
      trasladar_cliente: data.trasladar_cliente ?? true,
      proveedor_id: data.proveedor_id || null,
      motivo_interno: data.motivo_interno?.trim() || null,
      nota_cliente: data.nota_cliente?.trim() || null,
      orden,
      modified_at: new Date().toISOString(),
    })
    if (error) return { error: error.message }
    await logEvent(admin, data.obra_id, userId, { partida_codigo: data.codigo, partida_desc: data.descripcion, tipo: 'nueva', resumen: `Nueva partida ${data.codigo}`, motivo: data.motivo_interno })
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Proveedores ─────────────────────────────────────────────────────

export async function createProveedor(obraId: string, nombre: string): Promise<Result> {
  try {
    await requirePartner()
    if (!nombre.trim()) return { error: 'Nombre obligatorio.' }
    const admin = createAdminClient()
    const { error } = await admin.from('obra_control_proveedores').insert({ obra_id: obraId, nombre: nombre.trim() })
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updateProveedor(id: string, patch: { nombre?: string; notas?: string | null; presupuesto_manual?: number | null }): Promise<Result> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('obra_control_proveedores').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deleteProveedor(id: string): Promise<Result> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    // liberar partidas asignadas
    await admin.from('obra_control_partidas').update({ proveedor_id: null }).eq('proveedor_id', id)
    const { error } = await admin.from('obra_control_proveedores').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

// ── Pagos ───────────────────────────────────────────────────────────

export async function createPago(obraId: string, proveedorId: string, data: { monto: number; fecha?: string | null; nota?: string | null }): Promise<Result> {
  try {
    const { userId } = await requirePartner()
    const admin = createAdminClient()
    const { data: maxRow } = await admin.from('obra_control_pagos').select('orden').eq('proveedor_id', proveedorId).order('orden', { ascending: false }).limit(1).single()
    const orden = ((maxRow?.orden as number) ?? -1) + 1
    const { error } = await admin.from('obra_control_pagos').insert({
      obra_id: obraId, proveedor_id: proveedorId, monto: data.monto, fecha: data.fecha || null, nota: data.nota?.trim() || null, orden,
    })
    if (error) return { error: error.message }
    const { data: prov } = await admin.from('obra_control_proveedores').select('nombre').eq('id', proveedorId).single()
    await logEvent(admin, obraId, userId, { tipo: 'pago', resumen: `Pago a ${prov?.nombre ?? 'proveedor'}: ${data.monto} €` })
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updatePago(id: string, patch: { monto?: number; fecha?: string | null; nota?: string | null }): Promise<Result> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('obra_control_pagos').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deletePago(id: string): Promise<Result> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('obra_control_pagos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

// ── Depósitos ───────────────────────────────────────────────────────

export async function createDeposito(obraId: string, data: { label?: string | null; monto: number; iva: number; total: number; fecha?: string | null }): Promise<Result> {
  try {
    const { userId } = await requirePartner()
    const admin = createAdminClient()
    const { data: maxRow } = await admin.from('obra_control_depositos').select('orden').eq('obra_id', obraId).order('orden', { ascending: false }).limit(1).single()
    const orden = ((maxRow?.orden as number) ?? -1) + 1
    const { error } = await admin.from('obra_control_depositos').insert({
      obra_id: obraId, label: data.label?.trim() || null, monto: data.monto, iva: data.iva, total: data.total, fecha: data.fecha || null, orden,
    })
    if (error) return { error: error.message }
    await logEvent(admin, obraId, userId, { tipo: 'deposito', resumen: `Depósito del cliente: ${data.total} €` })
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function updateDeposito(id: string, patch: { label?: string | null; monto?: number; iva?: number; total?: number; fecha?: string | null }): Promise<Result> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('obra_control_depositos').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

export async function deleteDeposito(id: string): Promise<Result> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('obra_control_depositos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) { return { error: err instanceof Error ? err.message : 'Error inesperado.' } }
}

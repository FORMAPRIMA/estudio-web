'use server'

// Retribución variable de business development — mutaciones.
// El control de acceso vive en lib/retribucion-data.ts (requireAcceso).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAcceso, aProyecto, sanearCobros } from '@/lib/retribucion-data'
import { ORIGENES, validar, type OrigenId, type Proyecto, type ProyectoInput } from '@/lib/retribucion'

const PATH = '/team/marketing/retribucion'

// ── Escritura ───────────────────────────────────────────────────────────────

function aFila(p: ProyectoInput) {
  return {
    nombre: p.nombre.trim(),
    origen: p.origen,
    firma: p.firma,
    honorarios: Math.max(0, Number(p.honorarios) || 0),
    obra: Math.max(0, Number(p.obra) || 0),
    margen_pct: Math.max(0, Number(p.margenPct) || 0),
    descuento: !!p.descuento,
    cobros_honorarios: sanearCobros(p.cobrosHonorarios),
    cobros_obra: sanearCobros(p.cobrosObra),
    notas: p.notas?.trim() || null,
  }
}

function comprobar(p: ProyectoInput) {
  if (!ORIGENES.some((o) => o.id === (p.origen as OrigenId))) throw new Error('Origen no válido.')
  const errs = validar(p)
  if (errs.length) throw new Error(errs[0])
}

export async function createProyectoRetribucion(beneficiarioId: string, p: ProyectoInput): Promise<Proyecto> {
  const acceso = await requireAcceso(beneficiarioId)
  comprobar(p)
  const fila = aFila(p)
  // La penalización por descuento la deciden los socios
  if (!acceso.esPartner) fila.descuento = false
  const admin = createAdminClient()
  const { data, error } = await admin.from('retribucion_proyectos')
    .insert({ ...fila, beneficiario_id: beneficiarioId, created_by: acceso.userId, updated_by: acceso.userId })
    .select('*').single()
  if (error) throw new Error(error.message)
  revalidatePath(PATH)
  return aProyecto(data)
}

export async function updateProyectoRetribucion(id: string, p: ProyectoInput): Promise<Proyecto> {
  const admin = createAdminClient()
  const { data: actual } = await admin.from('retribucion_proyectos').select('beneficiario_id, descuento').eq('id', id).single()
  if (!actual) throw new Error('Proyecto no encontrado.')
  const acceso = await requireAcceso(actual.beneficiario_id)
  comprobar(p)
  const fila = aFila(p)
  if (!acceso.esPartner) fila.descuento = actual.descuento
  const { data, error } = await admin.from('retribucion_proyectos')
    .update({ ...fila, updated_by: acceso.userId, updated_at: new Date().toISOString() })
    .eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  revalidatePath(PATH)
  return aProyecto(data)
}

export async function deleteProyectoRetribucion(id: string): Promise<void> {
  const admin = createAdminClient()
  const { data: actual } = await admin.from('retribucion_proyectos').select('beneficiario_id').eq('id', id).single()
  if (!actual) return
  await requireAcceso(actual.beneficiario_id)
  const { error } = await admin.from('retribucion_proyectos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(PATH)
}

/** Salario fijo y SS del plan: solo socios. */
export async function updatePlanRetribucion(beneficiarioId: string, salarioBase: number, ssPct: number): Promise<void> {
  const acceso = await requireAcceso(beneficiarioId)
  if (!acceso.esPartner) throw new Error('Solo los socios pueden cambiar el salario del plan.')
  const admin = createAdminClient()
  const { error } = await admin.from('retribucion_planes').update({
    salario_base: Math.max(0, Number(salarioBase) || 0),
    ss_pct: Math.max(0, Number(ssPct) || 0),
    updated_by: acceso.userId,
    updated_at: new Date().toISOString(),
  }).eq('beneficiario_id', beneficiarioId)
  if (error) throw new Error(error.message)
  revalidatePath(PATH)
}

// Retribución variable — lecturas y control de acceso (solo servidor).
// NO es 'use server' a propósito: si lo fuera, cualquier cliente podría llamar
// a estas funciones directamente. Las mutaciones están en app/actions/retribucion.ts.
//
// Acceso: fp_partner (todos los planes) o el propio beneficiario de un plan
// (solo el suyo). Un fp_biz_dev sin plan no entra aunque tenga el rol.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Cobro, PlanBeneficiario, Proyecto } from '@/lib/retribucion'

export interface AccesoRetribucion {
  userId: string
  esPartner: boolean
  /** ids de beneficiario que este usuario puede ver */
  beneficiarios: string[]
}

/** null = sin acceso. No lanza: lo usan también el layout y las páginas. */
export async function getAccesoRetribucion(): Promise<AccesoRetribucion | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile) return null

  const admin = createAdminClient()
  if (profile.rol === 'fp_partner') {
    const { data } = await admin.from('retribucion_planes').select('beneficiario_id').eq('activo', true)
    return { userId: user.id, esPartner: true, beneficiarios: (data ?? []).map((r) => r.beneficiario_id) }
  }
  if (profile.rol !== 'fp_biz_dev') return null
  const { data } = await admin
    .from('retribucion_planes').select('beneficiario_id')
    .eq('beneficiario_id', user.id).eq('activo', true).maybeSingle()
  return data ? { userId: user.id, esPartner: false, beneficiarios: [user.id] } : null
}

export async function requireAcceso(beneficiarioId: string) {
  const acceso = await getAccesoRetribucion()
  if (!acceso) throw new Error('Sin permisos.')
  if (!acceso.beneficiarios.includes(beneficiarioId)) throw new Error('Sin permisos sobre este plan.')
  return acceso
}

// ── Lectura ─────────────────────────────────────────────────────────────────

export async function getPlanes(): Promise<PlanBeneficiario[]> {
  const acceso = await getAccesoRetribucion()
  if (!acceso?.beneficiarios.length) return []
  const admin = createAdminClient()
  const [{ data: planes }, { data: perfiles }] = await Promise.all([
    admin.from('retribucion_planes').select('beneficiario_id, salario_base, ss_pct').in('beneficiario_id', acceso.beneficiarios),
    admin.from('profiles').select('id, nombre, apellido').in('id', acceso.beneficiarios),
  ])
  return (planes ?? []).map((p) => {
    const perfil = (perfiles ?? []).find((x) => x.id === p.beneficiario_id)
    return {
      beneficiarioId: p.beneficiario_id,
      nombre: perfil ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() : 'Sin nombre',
      salarioBase: Number(p.salario_base) || 0,
      ssPct: Number(p.ss_pct) || 0,
    }
  })
}

export const sanearCobros = (v: unknown): Cobro[] =>
  Array.isArray(v)
    ? v.map((x) => ({ mes: String((x as Cobro)?.mes ?? ''), pct: Number((x as Cobro)?.pct) || 0 }))
    : []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const aProyecto = (r: any): Proyecto => ({
  id: r.id,
  beneficiarioId: r.beneficiario_id,
  nombre: r.nombre,
  origen: r.origen,
  firma: r.firma,
  honorarios: Number(r.honorarios) || 0,
  obra: Number(r.obra) || 0,
  margenPct: Number(r.margen_pct) || 0,
  descuento: !!r.descuento,
  cobrosHonorarios: sanearCobros(r.cobros_honorarios),
  cobrosObra: sanearCobros(r.cobros_obra),
  notas: r.notas ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export async function getProyectos(beneficiarioId: string): Promise<Proyecto[]> {
  await requireAcceso(beneficiarioId)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('retribucion_proyectos').select('*')
    .eq('beneficiario_id', beneficiarioId)
    .order('firma', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(aProyecto)
}

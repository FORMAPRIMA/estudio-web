'use server'

// Panel de Salas (salas.formaprima.es) — mutaciones. Lecturas y sesión en
// lib/salas/panel.ts. Cada acción vuelve a comprobar quién es y qué sala puede
// tocar; las de personas, además, que sea propietario. Todo queda auditado.

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  COOKIE_PANEL, auditar, codigoHmac, codigoNuevo, esHostSalas, maxAgeSesion, miembroActual, salaDe, salasDe, valorSesion,
  type Miembro,
} from '@/lib/salas/panel'
import { pinNuevo } from '@/lib/salas/servidor'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const intentos = new Map<string, { n: number; hasta: number }>()
function porIp(clave: string, max: number, ventanaMs: number): boolean {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || headers().get('x-real-ip') || 'desconocida'
  const k = `${clave}:${ip}`, ahora = Date.now(), r = intentos.get(k)
  if (!r || ahora > r.hasta) { intentos.set(k, { n: 1, hasta: ahora + ventanaMs }); return true }
  if (r.n >= max) return false
  r.n++
  return true
}

const limpio = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

async function requireMiembro(): Promise<Miembro> {
  const m = await miembroActual()
  if (!m) throw new Error('La sesión ha caducado. Vuelve a entrar.')
  return m
}

async function requirePropietario(): Promise<Miembro> {
  const m = await requireMiembro()
  if (m.rol !== 'propietario') throw new Error('Solo las personas con rol de propiedad pueden gestionar el equipo.')
  return m
}

async function leadConPermiso(m: Miembro, leadId: string) {
  const admin = createAdminClient()
  const { data: lead } = await admin.from('sala_leads').select('id, sala_id, nombre').eq('id', leadId).maybeSingle()
  if (!lead) throw new Error('Lead no encontrado.')
  const salas = await salasDe(m)
  const sala = salas.find((s) => s.id === lead.sala_id)
  if (!sala) throw new Error('Sin acceso a esta sala.')
  return { lead, sala }
}

const envolver = async <T extends object>(f: () => Promise<T>): Promise<R<T>> => {
  try { return { ok: true, ...(await f()) } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado.' } }
}

// ── Sesión ──────────────────────────────────────────────────────────────────

export async function entrarSalas(codigo: string): Promise<R> {
  if (!esHostSalas()) return { ok: false, error: 'No disponible.' }
  const c = String(codigo ?? '').replace(/\D/g, '')
  if (!porIp('entrar', 10, 15 * 60_000)) {
    await new Promise((r) => setTimeout(r, 900))
    return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' }
  }
  const admin = createAdminClient()
  const { data } = c.length === 8
    ? await admin.from('sala_miembros').select('id, activo').eq('codigo_hmac', codigoHmac(c)).maybeSingle()
    : { data: null }
  if (!data || !data.activo) {
    await new Promise((r) => setTimeout(r, 900))
    return { ok: false, error: 'Código incorrecto.' }
  }
  cookies().set(COOKIE_PANEL, valorSesion(data.id), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: maxAgeSesion,
  })
  await admin.from('sala_miembros').update({ ultimo_acceso: new Date().toISOString() }).eq('id', data.id)
  await auditar(data.id, 'entrar', null)
  return { ok: true }
}

export async function salirSalas(): Promise<void> {
  cookies().set(COOKIE_PANEL, '', { path: '/', maxAge: 0 })
}

// ── Leads ───────────────────────────────────────────────────────────────────

export interface LeadInput {
  nombre: string
  empresa?: string
  email?: string
  telefono?: string
  canal?: string
  notas?: string
  caducaEn?: string   // 'AAAA-MM-DD' o vacío
}

function filaLead(d: LeadInput) {
  const nombre = limpio(d.nombre, 120)
  if (!nombre) throw new Error('Ponle un nombre al lead.')
  const email = limpio(d.email, 160)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ese email no parece correcto.')
  const caduca = limpio(d.caducaEn, 10)
  if (caduca && !/^\d{4}-\d{2}-\d{2}$/.test(caduca)) throw new Error('Fecha de caducidad no válida.')
  return {
    nombre, email,
    empresa: limpio(d.empresa, 120), telefono: limpio(d.telefono, 40), canal: limpio(d.canal, 60), notas: limpio(d.notas, 2000),
    caduca_en: caduca ? new Date(`${caduca}T23:59:59+02:00`).toISOString() : null,
  }
}

export async function crearLeadSala(slug: string, d: LeadInput): Promise<R<{ id: string; pin: string }>> {
  return envolver(async () => {
    const m = await requireMiembro()
    const sala = await salaDe(m, slug)
    if (!sala) throw new Error('Sin acceso a esta sala.')
    const fila = filaLead(d)
    const pin = await pinNuevo(sala.id)
    const { data, error } = await createAdminClient().from('sala_leads')
      .insert({ ...fila, sala_id: sala.id, pin, creado_por: m.id }).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear.')
    await auditar(m.id, 'crear_lead', sala.id, fila.nombre)
    revalidatePath(`/salas/${slug}`)
    return { id: data.id as string, pin }
  })
}

export async function actualizarLeadSala(leadId: string, d: LeadInput): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { sala } = await leadConPermiso(m, leadId)
    const fila = filaLead(d)
    const { error } = await createAdminClient().from('sala_leads').update(fila).eq('id', leadId)
    if (error) throw new Error(error.message)
    await auditar(m.id, 'editar_lead', sala.id, fila.nombre)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

export async function estadoLeadSala(leadId: string, estado: 'activo' | 'revocado'): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { lead, sala } = await leadConPermiso(m, leadId)
    const { error } = await createAdminClient().from('sala_leads').update({ estado }).eq('id', leadId)
    if (error) throw new Error(error.message)
    await auditar(m.id, estado === 'revocado' ? 'revocar_lead' : 'reactivar_lead', sala.id, lead.nombre)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

/** PIN nuevo para el mismo lead (el anterior deja de valer al instante). */
export async function renovarPinSala(leadId: string): Promise<R<{ pin: string }>> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { lead, sala } = await leadConPermiso(m, leadId)
    const pin = await pinNuevo(sala.id)
    const { error } = await createAdminClient().from('sala_leads').update({ pin, estado: 'activo' }).eq('id', leadId)
    if (error) throw new Error(error.message)
    await auditar(m.id, 'renovar_pin', sala.id, lead.nombre)
    revalidatePath(`/salas/${sala.slug}`)
    return { pin }
  })
}

// ── Personas del panel (solo rol propietario) ─────────────────────────────────

export interface MiembroInput {
  nombre: string
  email?: string
  empresa?: string
  rol: 'propietario' | 'comercial'
  salas: string[]   // ids de sala (comerciales)
}

async function codigoLibre(): Promise<{ codigo: string; hmac: string }> {
  const admin = createAdminClient()
  for (let k = 0; k < 20; k++) {
    const codigo = codigoNuevo(), hmac = codigoHmac(codigo)
    const { count } = await admin.from('sala_miembros').select('id', { count: 'exact', head: true }).eq('codigo_hmac', hmac)
    if (!count) return { codigo, hmac }
  }
  throw new Error('No se pudo generar un código.')
}

// Solo se asignan salas no confidenciales, lo pida quien lo pida: la casilla
// deshabilitada del formulario no basta como cerrojo.
async function asignarSalas(miembroId: string, salas: string[]) {
  const admin = createAdminClient()
  await admin.from('sala_miembro_salas').delete().eq('miembro_id', miembroId)
  const pedidas = Array.from(new Set(salas)).slice(0, 100)
  const { data: abiertas, error: e0 } = pedidas.length
    ? await admin.from('sala_salas').select('id').in('id', pedidas).eq('confidencial', false)
    : { data: [], error: null }
  if (e0) throw new Error('Falta aplicar la migración salas_fase3_permisos.sql.')
  const ids = (abiertas ?? []).map((x) => x.id as string)
  if (ids.length) {
    const { error } = await admin.from('sala_miembro_salas').insert(ids.map((sala_id) => ({ miembro_id: miembroId, sala_id })))
    if (error) throw new Error(error.message)
  }
}

export async function crearMiembroSala(d: MiembroInput): Promise<R<{ id: string; codigo: string }>> {
  return envolver(async () => {
    const m = await requirePropietario()
    const nombre = limpio(d.nombre, 120)
    if (!nombre) throw new Error('Falta el nombre.')
    const rol = d.rol === 'propietario' ? 'propietario' : 'comercial'
    const { codigo, hmac } = await codigoLibre()
    const { data, error } = await createAdminClient().from('sala_miembros').insert({
      nombre, email: limpio(d.email, 160)?.toLowerCase() ?? null, empresa: limpio(d.empresa, 120), rol, codigo_hmac: hmac, creado_por: m.id,
    }).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear.')
    if (rol === 'comercial') await asignarSalas(data.id, d.salas ?? [])
    await auditar(m.id, 'crear_miembro', null, `${nombre} (${rol})`)
    revalidatePath('/salas/equipo')
    return { id: data.id as string, codigo }
  })
}

export async function actualizarMiembroSala(id: string, d: MiembroInput & { activo: boolean }): Promise<R> {
  return envolver(async () => {
    const m = await requirePropietario()
    if (id === m.id && (!d.activo || d.rol !== 'propietario')) throw new Error('No puedes retirar tu propio acceso completo.')
    const nombre = limpio(d.nombre, 120)
    if (!nombre) throw new Error('Falta el nombre.')
    const rol = d.rol === 'propietario' ? 'propietario' : 'comercial'
    const { error } = await createAdminClient().from('sala_miembros').update({
      nombre, email: limpio(d.email, 160)?.toLowerCase() ?? null, empresa: limpio(d.empresa, 120), rol, activo: !!d.activo,
    }).eq('id', id)
    if (error) throw new Error(error.message)
    await asignarSalas(id, rol === 'comercial' ? d.salas ?? [] : [])
    await auditar(m.id, d.activo ? 'editar_miembro' : 'desactivar_miembro', null, nombre)
    revalidatePath('/salas/equipo')
    return {}
  })
}

export async function regenerarCodigoSala(id: string): Promise<R<{ codigo: string }>> {
  return envolver(async () => {
    const m = await requirePropietario()
    const { codigo, hmac } = await codigoLibre()
    const { data, error } = await createAdminClient().from('sala_miembros').update({ codigo_hmac: hmac }).eq('id', id).select('nombre').single()
    if (error || !data) throw new Error(error?.message ?? 'No encontrado.')
    await auditar(m.id, 'regenerar_codigo', null, data.nombre)
    return { codigo }
  })
}

/**
 * Confidencial = ningún comercial puede verla por asignación (quien la creó la
 * sigue viendo). Al cerrarla se retiran las asignaciones que tuviera.
 */
export async function actualizarConfidencialSala(salaId: string, confidencial: boolean): Promise<R> {
  return envolver(async () => {
    const m = await requirePropietario()
    const admin = createAdminClient()
    const { data, error } = await admin.from('sala_salas').update({ confidencial: !!confidencial }).eq('id', salaId).select('id, nombre').single()
    if (error || !data) throw new Error(error?.message ?? 'Sala no encontrada.')
    if (confidencial) await admin.from('sala_miembro_salas').delete().eq('sala_id', salaId)
    await auditar(m.id, confidencial ? 'sala_confidencial' : 'sala_compartible', salaId)
    revalidatePath('/salas/equipo')
    revalidatePath('/salas')
    return {}
  })
}

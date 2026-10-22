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
import { LOGO_MAX_BYTES, borrarLogo, guardarLogo, tokenNuevo } from '@/lib/salas/prospeccion'
import { sendEmail, wrapEmail } from '@/lib/email'
import { cuerpoAviso } from '@/lib/salas/avisos'
import { bloquesResumen, enviarResumen } from '@/lib/salas/resumen'
import { FP_ROLES, type FpRole } from '@/lib/types'

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

// ── Prospección (/para/<token>) ─────────────────────────────────────────────

export interface ProspectoInput extends LeadInput {
  cargo?: string
  pais?: string
  idioma: 'es' | 'en'
  tratamiento: 'tu' | 'usted'
  mensaje?: string
}

function filaProspecto(d: ProspectoInput) {
  if (!limpio(d.empresa, 120)) throw new Error('Falta la empresa.')
  return {
    ...filaLead(d),
    cargo: limpio(d.cargo, 120), pais: limpio(d.pais, 60), mensaje: limpio(d.mensaje, 600),
    idioma: d.idioma === 'en' ? 'en' : 'es', tratamiento: d.tratamiento === 'usted' ? 'usted' : 'tu',
  }
}

async function salaProspeccion(m: Miembro, slug: string) {
  const sala = await salaDe(m, slug)
  if (!sala) throw new Error('Sin acceso a esta sala.')
  if (sala.tipo !== 'prospeccion') throw new Error('Esta sala no es de prospección.')
  return sala
}

export async function crearProspecto(slug: string, d: ProspectoInput): Promise<R<{ id: string; token: string }>> {
  return envolver(async () => {
    const m = await requireMiembro()
    const sala = await salaProspeccion(m, slug)
    const fila = filaProspecto(d)
    // el PIN no se usa en prospección (la llave es el enlace), pero la tabla lo exige
    const [pin, token] = await Promise.all([pinNuevo(sala.id), tokenNuevo(fila.empresa, fila.nombre)])
    const { data, error } = await createAdminClient().from('sala_leads')
      .insert({ ...fila, sala_id: sala.id, pin, token, creado_por: m.id }).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear.')
    await auditar(m.id, 'crear_lead', sala.id, `${fila.nombre} · ${fila.empresa}`)
    revalidatePath(`/salas/${slug}`)
    return { id: data.id as string, token }
  })
}

export async function actualizarProspecto(leadId: string, d: ProspectoInput): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { sala } = await leadConPermiso(m, leadId)
    const fila = filaProspecto(d)
    const { error } = await createAdminClient().from('sala_leads').update(fila).eq('id', leadId)
    if (error) throw new Error(error.message)
    await auditar(m.id, 'editar_lead', sala.id, fila.nombre)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

/** Sube el logo del lead (PNG, JPG, WebP o SVG): se recorta y se guarda en versión original y en blanco. */
export async function subirLogoProspecto(leadId: string, form: FormData): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { sala } = await leadConPermiso(m, leadId)
    const f = form.get('logo')
    if (!(f instanceof File) || !f.size) throw new Error('Elige un archivo.')
    if (f.size > LOGO_MAX_BYTES) throw new Error('El logo pesa demasiado (máximo 3 MB).')
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) throw new Error('Sube el logo en PNG, JPG, WebP o SVG.')
    const admin = createAdminClient()
    const { data: previo } = await admin.from('sala_leads').select('logo_path').eq('id', leadId).single()
    const carpeta = await guardarLogo(leadId, Buffer.from(await f.arrayBuffer()))
    const { error } = await admin.from('sala_leads').update({ logo_path: carpeta }).eq('id', leadId)
    if (error) throw new Error(error.message)
    if (previo?.logo_path) await borrarLogo(previo.logo_path)
    await auditar(m.id, 'logo_lead', sala.id)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

export async function quitarLogoProspecto(leadId: string): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { sala } = await leadConPermiso(m, leadId)
    const admin = createAdminClient()
    const { data: previo } = await admin.from('sala_leads').select('logo_path').eq('id', leadId).single()
    await admin.from('sala_leads').update({ logo_path: null }).eq('id', leadId)
    if (previo?.logo_path) await borrarLogo(previo.logo_path)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

export async function modoLogoProspecto(leadId: string, modo: 'blanco' | 'original'): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { sala } = await leadConPermiso(m, leadId)
    await createAdminClient().from('sala_leads').update({ logo_modo: modo === 'original' ? 'original' : 'blanco' }).eq('id', leadId)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

/** Seguimiento comercial: enviado (o no) y descartado (o recuperado). */
export async function marcarProspecto(leadId: string, campo: 'enviado' | 'descartado', valor: boolean): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { lead, sala } = await leadConPermiso(m, leadId)
    const col = campo === 'enviado' ? 'enviado_en' : 'descartado_en'
    const { error } = await createAdminClient().from('sala_leads').update({ [col]: valor ? new Date().toISOString() : null }).eq('id', leadId)
    if (error) throw new Error(error.message)
    await auditar(m.id, `${campo}_${valor ? 'si' : 'no'}`, sala.id, lead.nombre)
    revalidatePath(`/salas/${sala.slug}`)
    return {}
  })
}

// ── Agenda (reuniones del dossier de prospección) ───────────────────────────

/** Las franjas fijas de la persona del panel que firma sus enlaces. */
export async function guardarAgendaMiembro(a: { zona: string; franjas: string[]; minutos: number }): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const { agendaDe } = await import('@/lib/para/agenda')
    const agenda = agendaDe(a)
    if (!a.franjas?.length) throw new Error('Elige al menos una franja.')
    const { error } = await createAdminClient().from('sala_miembros').update({ agenda }).eq('id', m.id)
    if (error) throw new Error(error.message)
    await auditar(m.id, 'agenda', null, agenda.franjas.join(' '))
    revalidatePath('/salas/agenda')
    return {}
  })
}

export async function estadoReunionSala(id: string, estado: 'confirmada' | 'cancelada' | 'pedida'): Promise<R> {
  return envolver(async () => {
    const m = await requireMiembro()
    const admin = createAdminClient()
    const { data: r } = await admin.from('sala_reuniones').select('id, lead_id').eq('id', id).maybeSingle()
    if (!r) throw new Error('Reunión no encontrada.')
    const { sala, lead } = await leadConPermiso(m, r.lead_id)
    const { error } = await admin.from('sala_reuniones').update({ estado }).eq('id', id)
    if (error) throw new Error(error.message)
    await auditar(m.id, `reunion_${estado}`, sala.id, lead.nombre)
    revalidatePath(`/salas/${sala.slug}`)
    revalidatePath('/salas/agenda')
    return {}
  })
}

// ── Equipo de Forma Prima (solo rol propietario) ──────────────────────────────
// Las personas con cuenta en internal entran con ella (puente de /team/salas), que
// las reconoce por el email: darles acceso es crear su fila con ese email y avisarles.

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

async function perfilFP(perfilId: string) {
  const { data: p } = await createAdminClient().from('profiles').select('id, nombre, apellido, email, rol, blocked').eq('id', perfilId).maybeSingle()
  if (!p || p.blocked || !FP_ROLES.includes(p.rol as FpRole)) throw new Error('Esa persona no es del equipo.')
  const email = (p.email ?? '').trim().toLowerCase()
  if (!email) throw new Error('Su perfil de internal no tiene email.')
  return { nombre: [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || email, email, rol: p.rol as FpRole }
}

export async function invitarEquipoFP(perfilId: string, salas: string[]): Promise<R> {
  return envolver(async () => {
    const m = await requirePropietario()
    const p = await perfilFP(perfilId)
    const admin = createAdminClient()
    const { data: existe } = await admin.from('sala_miembros').select('id, activo, rol').eq('email', p.email).maybeSingle()
    if (existe?.activo) throw new Error('Ya tiene acceso.')
    let id: string
    if (existe) {
      const { error } = await admin.from('sala_miembros').update({ activo: true }).eq('id', existe.id)
      if (error) throw new Error(error.message)
      id = existe.id
    } else {
      // Entra con su cuenta de internal; el código existe porque la columna lo exige, pero no se le da.
      const { hmac } = await codigoLibre()
      const { data, error } = await admin.from('sala_miembros').insert({
        nombre: p.nombre, email: p.email, empresa: 'Forma Prima', rol: 'comercial', codigo_hmac: hmac, creado_por: m.id,
      }).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'No se pudo crear.')
      id = data.id
    }
    if (existe?.rol !== 'propietario') await asignarSalas(id, salas)
    const ve = await salasDe({ id, nombre: p.nombre, email: p.email, empresa: 'Forma Prima', rol: existe?.rol === 'propietario' ? 'propietario' : 'comercial' } as Miembro)
    await auditar(m.id, 'invitar_fp', null, p.nombre)

    const r = await sendEmail({
      to: p.email, replyTo: m.email ?? undefined,
      subject: 'Ya tienes acceso a Salas',
      html: wrapEmail(`
        <p style="margin:0 0 14px;font-size:16px;">Hola, ${escHtml(p.nombre.split(' ')[0])}:</p>
        <p style="margin:0 0 14px;font-size:15px;">${escHtml(m.nombre.split(' ')[0])} te ha dado acceso a <b>Salas</b>, el panel donde se preparan los dossiers para clientes y empresas y se ve quién los abre.</p>
        <p style="margin:0 0 6px;font-size:13px;color:#777;">Puedes ver:</p>
        <p style="margin:0 0 20px;font-size:14px;">${ve.length ? ve.map((s) => escHtml(s.nombre)).join('<br>') : 'Las salas que crees tú.'}</p>
        <p style="margin:0 0 20px;"><a href="https://internal.formaprima.es/team/salas" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;padding:12px 20px;font-size:14px;">Entrar con tu cuenta de Forma Prima</a></p>
        <p style="margin:0;font-size:13px;color:#777;">Es tu usuario y contraseña de siempre de internal${p.rol === 'fp_team' ? '' : '; también lo tienes en el menú, en Captación → Salas'}.</p>
      `),
    })
    revalidatePath('/salas/equipo')
    if (r.error) throw new Error('Acceso dado, pero el correo no ha salido. Avísale tú.')
    return {}
  })
}

/** Una persona del panel sin email que es del equipo: se le pone el de internal para que entre con su cuenta. */
export async function vincularEquipoFP(miembroId: string, perfilId: string): Promise<R> {
  return envolver(async () => {
    const m = await requirePropietario()
    const p = await perfilFP(perfilId)
    const admin = createAdminClient()
    const { count } = await admin.from('sala_miembros').select('id', { count: 'exact', head: true }).eq('email', p.email)
    if (count) throw new Error('Ese email ya está en otra persona del panel.')
    const { data, error } = await admin.from('sala_miembros').update({ email: p.email }).eq('id', miembroId).is('email', null).select('nombre').maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'No se pudo vincular.')
    await auditar(m.id, 'vincular_fp', null, `${data.nombre} · ${p.email}`)
    revalidatePath('/salas/equipo')
    return {}
  })
}

// ── Correos de prueba ─────────────────────────────────────────────────────────

/** Manda a quien lo pide un aviso de ejemplo y su resumen real de las últimas 24 h (aunque esté vacío). */
export async function enviarCorreosPrueba(): Promise<R<{ email: string; bloques: number }>> {
  return envolver(async () => {
    const m = await requirePropietario()
    if (!m.email) throw new Error('No tienes email en el panel: ponlo en Equipo → Editar.')
    const admin = createAdminClient()
    const salas = await salasDe(m)
    const { data: lead } = salas.length
      ? await admin.from('sala_leads').select('id, sala_id, nombre, empresa, telefono, email').in('sala_id', salas.map((s) => s.id)).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null }
    const sala = salas.find((s) => s.id === lead?.sala_id)
    const nombre = lead ? `${lead.nombre}${lead.empresa ? ` (${lead.empresa})` : ''}` : 'Lucía Martín (Promotora Ejemplo)'
    const titulo = `${nombre} ha abierto el dossier de ${sala?.nombre ?? 'tu sala'}`
    const a = await sendEmail({
      to: m.email,
      subject: `[Prueba] ${titulo}`,
      html: cuerpoAviso({
        titulo, ficha: lead && sala ? `https://salas.formaprima.es/${sala.slug}/lead/${lead.id}` : 'https://salas.formaprima.es',
        texto: 'Correo de prueba: así llega el aviso cuando un lead abre su dossier por primera vez (los datos son del último lead de tus salas, no ha pasado de verdad). Es la primera vez que entra. Dale un rato y pregúntale qué le ha parecido.',
        filas: [['Temperatura', 'Tibio · 35/100'], ['Visitas', '1'], ['Desde', 'Madrid, España · móvil'], ['Empresa', lead?.empresa], ['Teléfono', lead?.telefono], ['Email', lead?.email]],
      }),
    })
    if (a.error) throw new Error('El aviso de prueba no ha salido.')
    const bloques = await bloquesResumen(m)
    const r = await enviarResumen(m, bloques, true)
    if (r.error) throw new Error('El aviso ha salido, pero el resumen no.')
    await auditar(m.id, 'correos_prueba', null, m.email)
    return { email: m.email, bloques: bloques.length }
  })
}

'use server'

// Propuestas de honorarios publicadas como página (/propuesta/<slug>).
// El cliente no tiene cuenta: su llave es el PIN, que deja una cookie firmada.
// Cada paso relevante (abrirla, llegar al final, aceptarla) avisa al equipo.

import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, wrapEmail } from '@/lib/email'
import { TEAM_EMAIL, getPartnersCC } from '@/lib/email/destinatarios'
import { getPropuestaWeb, type PropuestaWeb } from '@/lib/propuestas/registro'
import { propuestaCookieName, propuestaCookieValue, propuestaAdminCookieName, propuestaAdminCookieValue, pinCorrecto } from '@/lib/propuestas/acceso'
import { leerVisitas, guardarVisitas, dispositivo, lugar, type Visita } from '@/lib/propuestas/visitas'
import { randomUUID } from 'crypto'
import { accesoDossier, getSala, leadPorPin, leadCookieName, leadCookieValue, leadDeCookie } from '@/lib/salas/servidor'

const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']

// ── Límites contra abuso ─────────────────────────────────────────────────────
// Estas acciones son públicas (cualquiera puede llamarlas). Dos barreras: una
// por IP en memoria (por instancia, frena lo obvio) y otra en la base de datos
// (vale entre instancias), cada una donde tiene sentido.
const intentos = new Map<string, { n: number; hasta: number }>()
function porIp(clave: string, max: number, ventanaMs: number): boolean {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || headers().get('x-real-ip') || 'desconocida'
  const k = `${clave}:${ip}`, ahora = Date.now(), r = intentos.get(k)
  if (!r || ahora > r.hasta) { intentos.set(k, { n: 1, hasta: ahora + ventanaMs }); return true }
  if (r.n >= max) return false
  r.n++
  return true
}
const haceMin = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

/** ¿Ya hay un aviso con este título en los últimos `min` minutos? */
async function avisoReciente(titulo: string, min: number): Promise<boolean> {
  try {
    const { count } = await createAdminClient().from('avisos').select('id', { count: 'exact', head: true }).eq('titulo', titulo).gte('created_at', haceMin(min))
    return (count ?? 0) > 0
  } catch {
    return false
  }
}
const URL_BASE = 'https://formaprima.es/propuesta'

async function autorizada(slug: string): Promise<PropuestaWeb | null> {
  const p = getPropuestaWeb(slug)
  if (!p) return null
  return (await accesoDossier(p, cookies())) ? p : null
}

/** ¿La está mirando alguien del estudio con sesión? Entonces no es el cliente. */
async function esEquipo(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    return !!data?.rol && FP_ROLES.includes(data.rol as string)
  } catch {
    return false
  }
}

async function crearAviso(titulo: string, contenido: string, nivel: 'informativo' | 'importante') {
  try {
    const { error } = await createAdminClient().from('avisos').insert({
      tipo: 'equipo',
      autor_id: null,
      titulo,
      contenido,
      nivel,
      fecha_activa: new Date().toISOString().slice(0, 10),
      visible_roles: ['fp_partner'],
    })
    if (error) console.error('[propuesta-web] crearAviso', error.message)
  } catch (e) {
    console.error('[propuesta-web] crearAviso', e)
  }
}

export async function desbloquearPropuestaWeb(slug: string, pin: string): Promise<{ ok: boolean }> {
  // 10 intentos cada 15 min por IP: un PIN de 4 cifras ya no se prueba entero.
  if (!porIp(`pin:${slug}`, 10, 15 * 60_000)) {
    await new Promise((r) => setTimeout(r, 900))
    return { ok: false }
  }
  const p = getPropuestaWeb(slug)
  const limpio = pin.trim()
  // Salas: un PIN de 6 cifras identifica a un lead concreto.
  const sala = p ? await getSala(slug) : null
  const lead = sala ? await leadPorPin(sala.id, limpio) : null
  const admin = !lead && !!p?.pinAdmin && pinCorrecto(limpio, p.pinAdmin)
  if (!p || !(lead || admin || (p.pin !== null && pinCorrecto(limpio, p.pin)))) {
    // Un PIN de 4 cifras se prueba entero en poco tiempo si se responde al instante.
    await new Promise((r) => setTimeout(r, 900))
    return { ok: false }
  }
  // En una sala la cookie tiene que llegar también a la baliza (/api/salas/t):
  // con path /propuesta/<slug>, una sala cerrada nunca abría sesión de medición.
  cookies().set(propuestaCookieName(slug), propuestaCookieValue(slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: sala ? '/' : `/propuesta/${slug}`,
    maxAge: 60 * 60 * 24 * 90,
  })
  // Quién es (sala): con otro PIN en el mismo navegador, deja de ser ese lead.
  if (sala) {
    cookies().set(leadCookieName(slug), lead ? leadCookieValue(slug, lead.id) : '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: lead ? 60 * 60 * 24 * 365 : 0,
    })
  }
  // PIN del estudio: marca el navegador para no avisar de sus visitas. Con el
  // PIN del cliente se quita (por si se probó antes en ese mismo navegador).
  cookies().set(propuestaAdminCookieName(slug), admin ? propuestaAdminCookieValue(slug) : '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/propuesta/${slug}`,
    maxAge: admin ? 60 * 60 * 24 * 365 : 0,
  })
  return { ok: true }
}

function esAdmin(slug: string): boolean {
  return cookies().get(propuestaAdminCookieName(slug))?.value === propuestaAdminCookieValue(slug)
}

type Evento = 'abierta' | 'final'

/** Avisa al equipo de que el cliente abrió la propuesta o llegó al final. Una vez cada 12 h. */
export async function registrarEventoPropuestaWeb(slug: string, evento: Evento): Promise<void> {
  const p = await autorizada(slug)
  if (!p || (evento !== 'abierta' && evento !== 'final')) return
  if (esAdmin(slug) || await esEquipo()) return

  // Correo por visita a quien lo pida en el registro (avisarA), con el historial.
  try {
    if (evento === 'abierta') await visitaNueva(p)
    else await visitaAlFinal(p)
  } catch (e) {
    console.error('[propuesta-web] visita', e)
  }

  const marca = `${propuestaCookieName(slug)}_${evento}`
  if (cookies().get(marca)) return
  cookies().set(marca, '1', { httpOnly: true, sameSite: 'lax', path: `/propuesta/${slug}`, maxAge: 60 * 60 * 12 })

  const dossier = p.audiencia === 'comprador'
  const titulo = evento === 'abierta'
    ? (dossier ? `Alguien ha abierto el dossier de ${p.proyecto}` : `${p.cliente} ha abierto su propuesta`)
    : (dossier ? `Alguien ha visto el dossier de ${p.proyecto} hasta el final` : `${p.cliente} ha visto la propuesta hasta el final`)
  // La cookie la puede borrar cualquiera: el mismo aviso, como mucho uno cada 30 min.
  if (!porIp(`ev:${slug}`, 6, 60 * 60_000) || await avisoReciente(titulo, 30)) return
  if (evento === 'abierta') {
    await crearAviso(
      titulo,
      `${dossier ? 'Dossier' : 'Propuesta de honorarios'} de ${p.proyecto}. ${URL_BASE}/${p.slug}`,
      'informativo',
    )
  } else {
    await crearAviso(
      titulo,
      dossier ? `Si deja sus datos, entrará como lead en Captación.` : `Propuesta de honorarios de ${p.proyecto}. Buen momento para llamarle.`,
      'informativo',
    )
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

// ── Visitas del cliente ──────────────────────────────────────────────────────
// Una visita = una sesión: la abre la primera carga y la mantiene viva una
// cookie de 30 min que se renueva mientras navega. Recargar o girar el móvil no
// cuenta como visita nueva; volver al día siguiente, sí.
const VISITA_MIN = 30
const visitaCookie = (slug: string) => `${propuestaCookieName(slug)}_v`
function marcarVisita(slug: string, id: string) {
  cookies().set(visitaCookie(slug), id, { httpOnly: true, sameSite: 'lax', path: `/propuesta/${slug}`, maxAge: VISITA_MIN * 60 })
}
const madrid = (iso: string) => new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const minutos = (v: Visita) => Math.max(1, Math.round((Date.parse(v.ultima) - Date.parse(v.inicio)) / 60_000))
const hasta = (v: Visita) => (v.final ? 'hasta el final' : v.total ? `hasta la ${v.max} de ${v.total}${v.etiqueta ? ` · ${v.etiqueta}` : ''}` : 'solo la portada')

function correoVisitas(p: PropuestaWeb, visitas: Visita[], actual: Visita, alFinal: boolean): { subject: string; html: string } {
  const n = visitas.findIndex((v) => v.id === actual.id) + 1
  const semana = visitas.filter((v) => Date.parse(v.inicio) > Date.now() - 7 * 864e5).length
  const dias = new Set(visitas.map((v) => v.inicio.slice(0, 10))).size
  const finales = visitas.filter((v) => v.final).length
  const interes = semana >= 3 || finales >= 2 ? 'Alto' : semana >= 2 || finales >= 1 ? 'Medio' : 'Primer contacto'
  const subject = alFinal
    ? `${p.cliente} ha visto ${p.proyecto} hasta el final · visita ${n}`
    : `${p.cliente} ${n > 1 ? 'ha vuelto a abrir' : 'ha abierto'} ${p.proyecto} · visita ${n}`
  const fila = (v: Visita, i: number) => `
      <tr style="border-top:1px solid #E8E6E0;${v.id === actual.id ? 'background:#F2F2F0;' : ''}">
        <td style="padding:8px 10px 8px 0;color:#888;">${i + 1}</td>
        <td style="padding:8px 10px;white-space:nowrap;">${esc(madrid(v.inicio))}</td>
        <td style="padding:8px 10px;">${esc(v.dispositivo)}${v.lugar ? `<br><span style="color:#888;">${esc(v.lugar)}</span>` : ''}</td>
        <td style="padding:8px 10px;">${esc(hasta(v))}<br><span style="color:#888;">${minutos(v)} min</span></td>
      </tr>`
  const ultimas = visitas.map((v, i) => ({ v, i })).slice(-12).reverse()
  const html = wrapEmail(`
    <p style="margin:0 0 6px;font-size:16px;"><strong>${esc(p.cliente)}</strong> ${alFinal ? 'acaba de llegar al final de' : n > 1 ? 'ha vuelto a entrar en' : 'ha entrado en'} la propuesta de <strong>${esc(p.proyecto)}</strong>.</p>
    <p style="margin:0 0 20px;color:#555;">${esc(madrid(actual.inicio))} · ${esc(actual.dispositivo)}${actual.lugar ? ` · ${esc(actual.lugar)}` : ''}</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr>
        <td style="padding:12px 14px;background:#0d0d0d;color:#fbfbfa;"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8fa596;">Interés</div><div style="font-size:20px;font-weight:300;margin-top:4px;">${interes}</div></td>
        <td style="padding:12px 14px;background:#F2F2F0;"><div style="font-size:11px;color:#888;">Visitas</div><div style="font-size:20px;margin-top:4px;">${visitas.length}</div></td>
        <td style="padding:12px 14px;background:#F2F2F0;"><div style="font-size:11px;color:#888;">Últimos 7 días</div><div style="font-size:20px;margin-top:4px;">${semana}</div></td>
        <td style="padding:12px 14px;background:#F2F2F0;"><div style="font-size:11px;color:#888;">Días distintos</div><div style="font-size:20px;margin-top:4px;">${dias}</div></td>
        <td style="padding:12px 14px;background:#F2F2F0;"><div style="font-size:11px;color:#888;">Hasta el final</div><div style="font-size:20px;margin-top:4px;">${finales}</div></td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="color:#888;font-size:11px;text-align:left;"><th style="padding:0 10px 6px 0;font-weight:400;">#</th><th style="padding:0 10px 6px;font-weight:400;">Cuándo</th><th style="padding:0 10px 6px;font-weight:400;">Desde</th><th style="padding:0 10px 6px;font-weight:400;">Qué vio</th></tr>
      ${ultimas.map(({ v, i }) => fila(v, i)).join('')}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#888;">«Qué vio» de la visita actual se completa en el siguiente correo. Tus entradas con el PIN del estudio no cuentan.</p>
    <p style="margin:8px 0 0;"><a href="${URL_BASE}/${p.slug}">${URL_BASE}/${p.slug}</a></p>
  `)
  return { subject, html }
}

async function enviarVisitas(p: PropuestaWeb, visitas: Visita[], actual: Visita, alFinal: boolean) {
  if (!p.avisarA?.length) return
  const { subject, html } = correoVisitas(p, visitas, actual, alFinal)
  const r = await sendEmail({ to: p.avisarA, subject, html })
  if (r.error) console.error('[propuesta-web] email visita', r.error)
}

async function visitaNueva(p: PropuestaWeb) {
  if (!p.avisarA?.length || cookies().get(visitaCookie(p.slug))) return
  // Quien borre cookies para abrir "visitas" sin fin: como mucho 8 correos por hora.
  if (!porIp(`visita:${p.slug}`, 8, 60 * 60_000)) return
  const h = headers()
  const ahora = new Date().toISOString()
  const v: Visita = { id: randomUUID(), inicio: ahora, ultima: ahora, dispositivo: dispositivo(h.get('user-agent') || ''), lugar: lugar(h), max: 1, total: 0, etiqueta: '', final: false }
  const visitas = [...(await leerVisitas(p.slug)), v]
  marcarVisita(p.slug, v.id)
  await guardarVisitas(p.slug, visitas)
  await enviarVisitas(p, visitas, v, false)
}

async function visitaAlFinal(p: PropuestaWeb) {
  const id = cookies().get(visitaCookie(p.slug))?.value
  if (!p.avisarA?.length || !id) return
  const visitas = await leerVisitas(p.slug)
  const v = visitas.find((x) => x.id === id)
  if (!v || v.final) return
  v.final = true
  v.ultima = new Date().toISOString()
  if (v.total) v.max = v.total
  marcarVisita(p.slug, id)
  await guardarVisitas(p.slug, visitas)
  await enviarVisitas(p, visitas, v, true)
}

/** Hasta dónde ha llegado el cliente en esta visita (y que sigue ahí). Sin correo. */
export async function progresoPropuestaWeb(slug: string, i: number, n: number, etiqueta: string): Promise<void> {
  const p = await autorizada(slug)
  if (!p?.avisarA?.length || esAdmin(slug)) return
  const id = cookies().get(visitaCookie(slug))?.value
  if (!id || !porIp(`progreso:${slug}`, 240, 60 * 60_000)) return
  const visitas = await leerVisitas(slug)
  const v = visitas.find((x) => x.id === id)
  if (!v) return
  const num = Math.max(1, Math.min(500, Math.floor(Number(i) || 0) + 1))
  const tot = Math.max(0, Math.min(500, Math.floor(Number(n) || 0)))
  if (num > v.max) { v.max = num; v.etiqueta = String(etiqueta || '').slice(0, 80) }
  if (tot) v.total = tot
  v.ultima = new Date().toISOString()
  marcarVisita(slug, id)
  await guardarVisitas(slug, visitas)
}

/** El cliente acepta la propuesta desde la última diapositiva. */
export async function aceptarPropuestaWeb(slug: string, comentario: string): Promise<{ ok: boolean; error?: string }> {
  const p = await autorizada(slug)
  if (!p) return { ok: false, error: 'La sesión ha caducado. Vuelve a abrir el enlace.' }
  // Aceptar es de las propuestas a un cliente concreto (con PIN); un dossier
  // público no se "acepta": deja un lead.
  if (p.audiencia !== 'cliente') return { ok: false, error: 'No disponible.' }
  if (!porIp(`acepta:${slug}`, 3, 60 * 60_000)) return { ok: false, error: 'Demasiados intentos. Inténtalo más tarde.' }

  const prueba = await esEquipo()
  const nota = comentario.trim().slice(0, 2000)
  const cuando = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

  await crearAviso(
    `${prueba ? '[Prueba] ' : ''}${p.cliente} ha ACEPTADO la propuesta de ${p.proyecto}`,
    nota ? `Comentario: «${nota}»` : 'Sin comentarios. Toca preparar la firma y el primer pago.',
    'importante',
  )

  const cc = await getPartnersCC().catch(() => [] as string[])
  const r = await sendEmail({
    to: TEAM_EMAIL,
    cc: cc.filter((e) => e !== TEAM_EMAIL),
    subject: `${prueba ? '[Prueba] ' : ''}✓ ${p.cliente} acepta la propuesta de ${p.proyecto}`,
    html: wrapEmail(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${esc(p.cliente)}</strong> ha aceptado la propuesta de honorarios de <strong>${esc(p.proyecto)}</strong>.</p>
      <p style="margin:0 0 16px;color:#555;">${esc(cuando)}${prueba ? ' · aceptación hecha con una sesión del equipo (prueba)' : ''}</p>
      ${nota ? `<p style="margin:0 0 16px;padding:12px 16px;background:#F2F2F0;border-left:2px solid #8fa596;">${esc(nota)}</p>` : ''}
      <p style="margin:0 0 8px;">Siguiente paso: enviar la propuesta a firma y el cobro del 50% del anteproyecto.</p>
      <p style="margin:0;"><a href="${URL_BASE}/${p.slug}">${URL_BASE}/${p.slug}</a></p>
    `),
  })
  if (r.error) console.error('[propuesta-web] email aceptación', r.error)

  return { ok: true }
}

export interface InteresInput {
  /** Trampa para bots: campo invisible que una persona deja vacío. */
  web?: string
  nombre: string
  email: string
  telefono: string
  distribucion: string
  nivel: string
  mensaje: string
  idioma: 'es' | 'en'
  privacidad: boolean
}

/**
 * Dossier para compradores ('comprador'): quien lo ve deja sus datos desde la
 * última diapositiva. Entra como lead en Captación, con lo que ha elegido, y
 * avisa al equipo.
 */
export async function registrarInteresPropuestaWeb(slug: string, d: InteresInput): Promise<{ ok: boolean; error?: string }> {
  const p = await autorizada(slug)
  const en = d.idioma === 'en'
  if (!p) return { ok: false, error: en ? 'Your session has expired. Please reopen the link.' : 'La sesión ha caducado. Vuelve a abrir el enlace.' }

  const nombre = d.nombre.trim().slice(0, 120)
  const email = d.email.trim().toLowerCase().slice(0, 160)
  const telefono = d.telefono.trim().slice(0, 40)
  if (!nombre) return { ok: false, error: en ? 'Please tell us your name.' : 'Dinos tu nombre.' }
  if (!email && !telefono) return { ok: false, error: en ? 'Leave an email or a phone number.' : 'Déjanos un email o un teléfono.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: en ? 'That email does not look right.' : 'Ese email no parece correcto.' }
  if (!d.privacidad) return { ok: false, error: en ? 'Please accept the privacy policy.' : 'Acepta la política de privacidad.' }

  // Bots: si rellenan el campo trampa, se les da las gracias y no pasa nada.
  if (d.web && d.web.trim()) return { ok: true }
  const demasiados = { ok: false, error: en ? 'Too many requests. Please try again later.' : 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.' }
  if (!porIp(`interes:${slug}`, 3, 60 * 60_000)) return demasiados
  const origen = `Dossier web · ${p.proyecto}`
  const adminL = createAdminClient()
  // Tope global: si en 10 minutos entran más de 8 leads de este dossier, es un ataque.
  const { count: recientes } = await adminL.from('leads').select('id', { count: 'exact', head: true }).eq('origen', origen).gte('created_at', haceMin(10))
  if ((recientes ?? 0) >= 8) return demasiados
  // La misma persona dos veces en 24 h: se le confirma, pero no se duplica el lead ni el correo.
  const filtro = [email && `email.eq.${email}`, telefono && `telefono.eq.${telefono.replace(/[,()]/g, '')}`].filter(Boolean).join(',')
  if (filtro) {
    const { count: repetido } = await adminL.from('leads').select('id', { count: 'exact', head: true }).eq('origen', origen).gte('created_at', haceMin(24 * 60)).or(filtro)
    if ((repetido ?? 0) > 0) return { ok: true }
  }

  const prueba = await esEquipo()
  const eleccion = [d.distribucion && `distribución ${d.distribucion}`, d.nivel && `nivel ${d.nivel}`].filter(Boolean).join(' · ')
  const interes = `${p.proyecto}${eleccion ? ` · ${eleccion}` : ''}`
  const mensaje = d.mensaje.trim().slice(0, 2000)

  const admin = createAdminClient()
  const salaLead = leadDeCookie(slug, cookies().get(leadCookieName(slug))?.value)
  const { data: nuevoLead, error } = await admin.from('leads').insert({
    nombre: prueba ? `[Prueba] ${nombre}` : nombre,
    email: email || null,
    telefono: telefono || null,
    mensaje: mensaje || null,
    origen: `Dossier web · ${p.proyecto}`,
    estado_lead: 'nuevo',
    interes,
    notas: `Desde el dossier ${URL_BASE}/${p.slug} (${new Date().toISOString()}). Idioma: ${en ? 'inglés' : 'español'}. Aceptó la política de privacidad; sin consentimiento de comunicaciones comerciales: solo contacto sobre su solicitud.${salaLead ? ' Entró con su PIN personal de Salas.' : ''}`,
  }).select('id').single()
  if (error) {
    console.error('[propuesta-web] lead', error.message)
    return { ok: false, error: en ? 'We could not send it. Please try again.' : 'No se ha podido enviar. Inténtalo de nuevo.' }
  }

  // Salas: el lead del PIN queda enlazado con su ficha de Captación.
  if (salaLead && nuevoLead?.id) {
    await admin.from('sala_leads').update({ lead_captacion_id: nuevoLead.id }).eq('id', salaLead).is('lead_captacion_id', null)
  }

  await crearAviso(
    `${prueba ? '[Prueba] ' : ''}Nuevo interesado en ${p.proyecto}: ${nombre}`,
    `${interes}. ${[email, telefono].filter(Boolean).join(' · ')}. Ya está en Captación › Leads.`,
    'importante',
  )

  const cc = await getPartnersCC().catch(() => [] as string[])
  const fila = (k: string, v: string) => v ? `<tr><td style="padding:4px 16px 4px 0;color:#777;">${k}</td><td style="padding:4px 0;">${esc(v)}</td></tr>` : ''
  const r = await sendEmail({
    to: TEAM_EMAIL,
    cc: cc.filter((e) => e !== TEAM_EMAIL),
    ...(email && { replyTo: email }),
    subject: `${prueba ? '[Prueba] ' : ''}Interesado en ${p.proyecto}: ${nombre}`,
    html: wrapEmail(`
      <p style="margin:0 0 16px;font-size:16px;">Alguien ha pedido información desde el dossier de <strong>${esc(p.proyecto)}</strong>.</p>
      <table style="font-size:14px;border-collapse:collapse;margin:0 0 16px;">
        ${fila('Nombre', nombre)}${fila('Email', email)}${fila('Teléfono', telefono)}${fila('Distribución', d.distribucion)}${fila('Nivel', d.nivel)}${fila('Idioma', en ? 'Inglés' : 'Español')}
      </table>
      ${mensaje ? `<p style="margin:0 0 16px;padding:12px 16px;background:#F2F2F0;border-left:2px solid #8c6a55;">${esc(mensaje)}</p>` : ''}
      <p style="margin:0;"><a href="https://internal.formaprima.es/team/captacion/leads">Ver en Captación › Leads</a></p>
    `),
  })
  if (r.error) console.error('[propuesta-web] email interés', r.error)
  return { ok: true }
}

export interface ReunionInput {
  /** Trampa para bots: campo invisible que una persona deja vacío. */
  web?: string
  /** Franja elegida, tal como se la enseñamos ("Martes 13 oct · 09:30 Guayaquil / 16:30 Madrid"). */
  franja: string
  nombre: string
  cargo: string
  email: string
  telefono: string
  privacidad: boolean
}

/**
 * Teaser ('teaser'): el final no pide aceptar nada, pide una reunión para
 * presentar la propuesta completa. Avisa al equipo (importante) y por correo a
 * quien siga la propuesta, con la franja que han elegido.
 */
export async function solicitarReunionPropuestaWeb(slug: string, d: ReunionInput): Promise<{ ok: boolean; error?: string }> {
  const p = await autorizada(slug)
  if (!p || p.tipo !== 'teaser') return { ok: false, error: 'La sesión ha caducado. Vuelva a abrir el enlace.' }

  const franja = d.franja.trim().slice(0, 120)
  const nombre = d.nombre.trim().slice(0, 120)
  const cargo = d.cargo.trim().slice(0, 120)
  const email = d.email.trim().toLowerCase().slice(0, 160)
  const telefono = d.telefono.trim().slice(0, 40)
  if (!franja) return { ok: false, error: 'Elija un día y una hora.' }
  if (!nombre) return { ok: false, error: 'Indíquenos su nombre.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Ese correo no parece correcto.' }
  if (!d.privacidad) return { ok: false, error: 'Acepte la política de privacidad.' }
  if (d.web && d.web.trim()) return { ok: true }
  if (!porIp(`reunion:${slug}`, 4, 60 * 60_000)) return { ok: false, error: 'Demasiadas solicitudes. Inténtelo más tarde.' }

  const prueba = esAdmin(slug) || await esEquipo()
  const quien = [nombre, cargo].filter(Boolean).join(' · ')
  const titulo = `${prueba ? '[Prueba] ' : ''}${p.cliente} pide reunión: ${franja}`
  if (await avisoReciente(titulo, 10)) return { ok: true }

  // Lead en Captación (como el «Me interesa» de los dossiers) y, si entró con su
  // PIN personal de Salas, enlazado a su ficha de la sala.
  const admin = createAdminClient()
  const salaLead = leadDeCookie(slug, cookies().get(leadCookieName(slug))?.value)
  const { data: nuevo, error: errLead } = await admin.from('leads').insert({
    nombre: prueba ? `[Prueba] ${nombre}` : nombre,
    email,
    telefono: telefono || null,
    mensaje: `Pide reunión: ${franja}`,
    origen: `Teaser web · ${p.proyecto}`,
    estado_lead: 'nuevo',
    interes: `${p.proyecto} · propuesta completa${cargo ? ` · ${cargo}` : ''}`,
    notas: `Desde ${URL_BASE}/${p.slug} (${new Date().toISOString()}). ${p.cliente}. Aceptó la política de privacidad; solo contacto sobre su solicitud.${salaLead ? ' Entró con su PIN personal de Salas.' : ''}`,
  }).select('id').single()
  if (errLead) console.error('[propuesta-web] lead reunión', errLead.message)
  if (salaLead && nuevo?.id) {
    await admin.from('sala_leads').update({ lead_captacion_id: nuevo.id }).eq('id', salaLead).is('lead_captacion_id', null)
  }

  await crearAviso(titulo, `${quien}. ${[email, telefono].filter(Boolean).join(' · ')}. Teaser de ${p.proyecto}. Confirmar con enlace de videollamada en menos de 24 h. Ya está en Captación › Leads.`, 'importante')

  const cc = await getPartnersCC().catch(() => [] as string[])
  const para = p.avisarA?.length ? p.avisarA : [TEAM_EMAIL]
  const fila = (k: string, v: string) => v ? `<tr><td style="padding:4px 16px 4px 0;color:#777;">${k}</td><td style="padding:4px 0;">${esc(v)}</td></tr>` : ''
  const r = await sendEmail({
    to: para,
    cc: [TEAM_EMAIL, ...cc].filter((e) => !para.includes(e)),
    replyTo: email,
    subject: `${prueba ? '[Prueba] ' : ''}Reunión ${p.proyecto} · ${franja}`,
    html: wrapEmail(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${esc(p.cliente)}</strong> pide una reunión para ver la propuesta completa de <strong>${esc(p.proyecto)}</strong>.</p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#F2F2F0;border-left:2px solid #8fa596;font-size:16px;">${esc(franja)}</p>
      <table style="font-size:14px;border-collapse:collapse;margin:0 0 16px;">
        ${fila('Nombre', nombre)}${fila('Cargo', cargo)}${fila('Correo', email)}${fila('Teléfono', telefono)}
      </table>
      <p style="margin:0 0 8px;">Les hemos dicho que recibirán la confirmación con el enlace de la videollamada en menos de 24 horas. Responder a este correo les escribe directamente.</p>
      <p style="margin:0;"><a href="${URL_BASE}/${p.slug}">${URL_BASE}/${p.slug}</a></p>
    `),
  })
  if (r.error) console.error('[propuesta-web] email reunión', r.error)

  // Cuenta como "hasta el final" en el historial de visitas.
  try { await visitaAlFinal(p) } catch (e) { console.error('[propuesta-web] visita reunión', e) }
  return { ok: true }
}

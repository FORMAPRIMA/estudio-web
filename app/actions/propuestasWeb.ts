'use server'

// Propuestas de honorarios publicadas como página (/propuesta/<slug>).
// El cliente no tiene cuenta: su llave es el PIN, que deja una cookie firmada.
// Cada paso relevante (abrirla, llegar al final, aceptarla) avisa al equipo.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, wrapEmail } from '@/lib/email'
import { TEAM_EMAIL, getPartnersCC } from '@/lib/email/destinatarios'
import { getPropuestaWeb, type PropuestaWeb } from '@/lib/propuestas/registro'
import { propuestaCookieName, propuestaCookieValue, pinCorrecto } from '@/lib/propuestas/acceso'

const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']
const URL_BASE = 'https://formaprima.es/propuesta'

function autorizada(slug: string): PropuestaWeb | null {
  const p = getPropuestaWeb(slug)
  if (!p) return null
  const ok = cookies().get(propuestaCookieName(slug))?.value === propuestaCookieValue(slug)
  return ok ? p : null
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
  const p = getPropuestaWeb(slug)
  if (!p || !pinCorrecto(pin.trim(), p.pin)) {
    // Un PIN de 4 cifras se prueba entero en poco tiempo si se responde al instante.
    await new Promise((r) => setTimeout(r, 900))
    return { ok: false }
  }
  cookies().set(propuestaCookieName(slug), propuestaCookieValue(slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/propuesta/${slug}`,
    maxAge: 60 * 60 * 24 * 90,
  })
  return { ok: true }
}

type Evento = 'abierta' | 'final'

/** Avisa al equipo de que el cliente abrió la propuesta o llegó al final. Una vez cada 12 h. */
export async function registrarEventoPropuestaWeb(slug: string, evento: Evento): Promise<void> {
  const p = autorizada(slug)
  if (!p || (evento !== 'abierta' && evento !== 'final')) return
  if (await esEquipo()) return

  const marca = `${propuestaCookieName(slug)}_${evento}`
  if (cookies().get(marca)) return
  cookies().set(marca, '1', { httpOnly: true, sameSite: 'lax', path: `/propuesta/${slug}`, maxAge: 60 * 60 * 12 })

  const dossier = p.audiencia === 'comprador'
  if (evento === 'abierta') {
    await crearAviso(
      dossier ? `Alguien ha abierto el dossier de ${p.proyecto}` : `${p.cliente} ha abierto su propuesta`,
      `${dossier ? 'Dossier' : 'Propuesta de honorarios'} de ${p.proyecto}. ${URL_BASE}/${p.slug}`,
      'informativo',
    )
  } else {
    await crearAviso(
      dossier ? `Alguien ha visto el dossier de ${p.proyecto} hasta el final` : `${p.cliente} ha visto la propuesta hasta el final`,
      dossier ? `Si deja sus datos, entrará como lead en Captación.` : `Propuesta de honorarios de ${p.proyecto}. Buen momento para llamarle.`,
      'informativo',
    )
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** El cliente acepta la propuesta desde la última diapositiva. */
export async function aceptarPropuestaWeb(slug: string, comentario: string): Promise<{ ok: boolean; error?: string }> {
  const p = autorizada(slug)
  if (!p) return { ok: false, error: 'La sesión ha caducado. Vuelve a abrir el enlace.' }

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
  const p = autorizada(slug)
  const en = d.idioma === 'en'
  if (!p) return { ok: false, error: en ? 'Your session has expired. Please reopen the link.' : 'La sesión ha caducado. Vuelve a abrir el enlace.' }

  const nombre = d.nombre.trim().slice(0, 120)
  const email = d.email.trim().toLowerCase().slice(0, 160)
  const telefono = d.telefono.trim().slice(0, 40)
  if (!nombre) return { ok: false, error: en ? 'Please tell us your name.' : 'Dinos tu nombre.' }
  if (!email && !telefono) return { ok: false, error: en ? 'Leave an email or a phone number.' : 'Déjanos un email o un teléfono.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: en ? 'That email does not look right.' : 'Ese email no parece correcto.' }
  if (!d.privacidad) return { ok: false, error: en ? 'Please accept the privacy policy.' : 'Acepta la política de privacidad.' }

  const prueba = await esEquipo()
  const eleccion = [d.distribucion && `distribución ${d.distribucion}`, d.nivel && `nivel ${d.nivel}`].filter(Boolean).join(' · ')
  const interes = `${p.proyecto}${eleccion ? ` · ${eleccion}` : ''}`
  const mensaje = d.mensaje.trim().slice(0, 2000)

  const admin = createAdminClient()
  const { error } = await admin.from('leads').insert({
    nombre: prueba ? `[Prueba] ${nombre}` : nombre,
    email: email || null,
    telefono: telefono || null,
    mensaje: mensaje || null,
    origen: `Dossier web · ${p.proyecto}`,
    estado_lead: 'nuevo',
    interes,
    notas: `Desde el dossier ${URL_BASE}/${p.slug} (${new Date().toISOString()}). Idioma: ${en ? 'inglés' : 'español'}. Aceptó la política de privacidad; sin consentimiento de comunicaciones comerciales: solo contacto sobre su solicitud.`,
  })
  if (error) {
    console.error('[propuesta-web] lead', error.message)
    return { ok: false, error: en ? 'We could not send it. Please try again.' : 'No se ha podido enviar. Inténtalo de nuevo.' }
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

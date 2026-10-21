'use server'

// Dossier de prospección (formaprima.es/para/<token>) — acciones públicas del
// visitante: reservar la llamada del cierre o proponer otra fecha. El enlace es la
// llave; el servidor vuelve a calcular los huecos ofrecidos, así que no se puede
// pedir uno que no se enseñó ni uno ya cogido.

import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { repartirDestinatarios } from '@/lib/email/destinatarios'
import { cookieEquipo, esFirmaEquipo, estadoAgenda, prospectoPorToken } from '@/lib/salas/prospeccion'
import { esHuecoValido, icsReunion } from '@/lib/para/agenda'

type R = { ok: true; inicio: string | null } | { ok: false; error: string }

const intentos = new Map<string, { n: number; hasta: number }>()
function porIp(): boolean {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || headers().get('x-real-ip') || 'desconocida'
  const ahora = Date.now(), r = intentos.get(ip)
  if (!r || ahora > r.hasta) { intentos.set(ip, { n: 1, hasta: ahora + 3600_000 }); return true }
  if (r.n >= 8) return false
  r.n++
  return true
}
const limpio = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export interface PeticionReunion {
  /** Instante ISO de un hueco ofrecido; null = «ninguna me va bien» (va en la nota). */
  inicio: string | null
  email?: string
  nota?: string
  zona?: string
}

export async function reservarReunionPara(token: string, d: PeticionReunion): Promise<R> {
  try {
    if (!porIp()) return { ok: false, error: 'Demasiados intentos. Inténtalo en un rato.' }
    const p = await prospectoPorToken(String(token))
    if (!p) return { ok: false, error: 'Este enlace ya no está disponible.' }
    if (esFirmaEquipo(p.token, cookies().get(cookieEquipo(p.token))?.value)) {
      return { ok: false, error: 'Vista del equipo: desde aquí no se reservan llamadas.' }
    }
    const email = limpio(d.email, 160)?.toLowerCase() ?? null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Ese correo no parece correcto.' }
    const nota = limpio(d.nota, 800)
    const zona = limpio(d.zona, 60)
    const est = await estadoAgenda(p)
    if (d.inicio) {
      if (!esHuecoValido(d.inicio, new Date(), est.agenda, est.ocupadas)) return { ok: false, error: 'Ese hueco ya no está libre. Elige otro.' }
    } else if (!nota) {
      return { ok: false, error: 'Cuéntanos qué días u horas te vienen mejor.' }
    }

    const admin = createAdminClient()
    const { data: lead } = await admin.from('sala_leads').select('nombre, empresa, email').eq('id', p.leadId).single()
    await admin.from('sala_reuniones').update({ estado: 'cancelada' }).eq('lead_id', p.leadId).neq('estado', 'cancelada')
    const inicio = d.inicio ? new Date(d.inicio) : null
    const { data: r, error } = await admin.from('sala_reuniones').insert({
      sala_id: p.salaId, lead_id: p.leadId, miembro_id: p.miembroId, inicio: inicio?.toISOString() ?? null, minutos: est.agenda.minutos,
      email: email ?? lead?.email ?? null, nota, zona_lead: zona, estado: inicio ? 'pedida' : 'propuesta',
    }).select('id').single()
    if (error || !r) return { ok: false, error: 'No se ha podido guardar. Inténtalo de nuevo.' }

    avisar({ p, reunionId: r.id, inicio, minutos: est.agenda.minutos, nota, email: email ?? lead?.email ?? null, zona, lead })
      .catch((e) => console.error('[para] avisos reunión', e))
    return { ok: true, inicio: inicio?.toISOString() ?? null }
  } catch (e) {
    console.error('[para] reservar', e)
    return { ok: false, error: 'No se ha podido guardar. Inténtalo de nuevo.' }
  }
}

async function avisar(o: {
  p: NonNullable<Awaited<ReturnType<typeof prospectoPorToken>>>; reunionId: string; inicio: Date | null; minutos: number
  nota: string | null; email: string | null; zona: string | null; lead: { nombre: string; empresa: string | null; email: string | null } | null
}) {
  const { p, inicio } = o
  const en = p.lead.idioma === 'en'
  const quien = p.lead.contacto
  const empresa = o.lead?.empresa || p.lead.empresa
  const fmt = (z: string, l: string) => inicio ? new Intl.DateTimeFormat(l, { timeZone: z, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(inicio) : ''
  const titulo = `${empresa} × Forma Prima`
  const ics = inicio ? icsReunion({
    uid: o.reunionId, inicio, minutos: o.minutos, titulo,
    descripcion: en ? `Call with ${quien.nombre} (Forma Prima). We will send the video call link.` : `Llamada con ${quien.nombre} (Forma Prima). Te enviamos el enlace de la videollamada.`,
    organizador: quien.email,
  }) : null
  const adjunto = ics ? [{ filename: 'forma-prima.ics', content: Buffer.from(ics) }] : undefined

  // Al lead: confirmación con la hora en su zona y el .ics.
  if (o.email && inicio) {
    const zonaLead = o.zona || 'Europe/Madrid'
    const cuando = fmt(zonaLead, en ? 'en-US' : 'es-ES')
    const r = await sendEmail({
      to: o.email, replyTo: quien.email,
      subject: en ? `Call with Forma Prima · ${cuando}` : `Llamada con Forma Prima · ${cuando}`,
      html: wrapEmail(en
        ? `<p style="margin:0 0 14px;font-size:15px;">Hi ${esc(p.lead.nombre)},</p>
           <p style="margin:0 0 14px;font-size:15px;">Your call with ${esc(quien.nombre)} is booked for <b>${esc(cuando)}</b> (your time, ${o.minutos} min).</p>
           <p style="margin:0 0 14px;font-size:14px;color:#555;">${esc(quien.nombre.split(' ')[0])} will write to you with the video call link. The invitation is attached.</p>
           <p style="margin:0;font-size:14px;">Talk soon,<br>Forma Prima</p>`
        : `<p style="margin:0 0 14px;font-size:15px;">Hola, ${esc(p.lead.nombre)}:</p>
           <p style="margin:0 0 14px;font-size:15px;">Queda reservada la llamada con ${esc(quien.nombre)} para el <b>${esc(cuando)}</b> (tu hora, ${o.minutos} min).</p>
           <p style="margin:0 0 14px;font-size:14px;color:#555;">${esc(quien.nombre.split(' ')[0])} te escribirá con el enlace de la videollamada. Te adjuntamos la invitación.</p>
           <p style="margin:0;font-size:14px;">Hasta pronto,<br>Forma Prima</p>`),
      attachments: adjunto,
    })
    if (r.error) console.error('[para] correo al lead', r.error)
  }

  // Al equipo: quien envió el enlace, con copia a propiedad.
  const admin = createAdminClient()
  const { data: propietarios } = await admin.from('sala_miembros').select('email').eq('rol', 'propietario').eq('activo', true)
  const dest = repartirDestinatarios({ to: [quien.email], cc: (propietarios ?? []).map((x) => x.email) })
  if (!dest.to.length) return
  const madrid = fmt('Europe/Madrid', 'es-ES')
  const html = wrapEmail(`
    <p style="margin:0 0 6px;font-size:16px;">${inicio ? `${esc(o.lead?.nombre ?? p.lead.nombre)} (${esc(empresa)}) ha reservado una llamada.` : `${esc(o.lead?.nombre ?? p.lead.nombre)} (${esc(empresa)}) quiere hablar, pero ninguna hora le va bien.`}</p>
    ${inicio ? `<p style="margin:0 0 12px;font-size:15px;"><b>${esc(madrid)}</b> · hora de Madrid · ${o.minutos} min${o.zona && o.zona !== 'Europe/Madrid' ? ` · para el lead: ${esc(fmt(o.zona, 'es-ES'))} (${esc(o.zona)})` : ''}</p>` : ''}
    ${o.nota ? `<p style="margin:0 0 12px;font-size:14px;color:#333;white-space:pre-wrap;">«${esc(o.nota)}»</p>` : ''}
    <p style="margin:0 0 12px;font-size:14px;color:#555;">${o.email ? `Invitación a: ${esc(o.email)}` : 'No ha dejado correo: escríbele al de su ficha.'}</p>
    <p style="margin:0;"><a href="https://salas.formaprima.es/${p.salaSlug}/lead/${p.leadId}">Ver su ficha en Salas</a> · envíale el enlace de la videollamada.</p>`)
  const r = await sendEmail({
    to: dest.to, cc: dest.cc.length ? dest.cc : undefined,
    subject: inicio ? `Llamada reservada · ${empresa} · ${madrid}` : `${empresa} quiere hablar · propone otra fecha`,
    html, attachments: adjunto,
  })
  if (r.error) console.error('[para] correo al equipo', r.error)
}

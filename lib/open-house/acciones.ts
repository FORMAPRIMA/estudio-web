// Acciones del Open House. Solo servidor (no es un fichero 'use server': las
// llaman las rutas de /cc38 y del panel, que ya han comprobado quién pide).

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { EVENTO, SLOT_IDS, slotPorId, enlace } from './evento'
import { leerTodo, type Grupo } from './datos'

export type AccionInvitado = 'reservar' | 'unirse' | 'cancelar' | 'declinar'

const MENSAJES: Record<string, string> = {
  invitacion: 'Esta invitación ya no es válida.',
  cerrado: 'Los cambios se cerraron el miércoles 7. Escríbenos a contacto@formaprima.es y lo vemos.',
  horario: 'Ese horario no existe.',
  asistentes: 'Revisa quién viene: al menos tú.',
  ocupado: 'Ese horario acaba de completarse. Elige otro, por favor.',
  sin_reserva: 'Tu grupo ya no tiene reserva.',
  no_incluido: 'No estás incluido en esta reserva.',
  accion: 'Acción no válida.',
}

export async function accionInvitado(
  token: string, accion: AccionInvitado, slot: string | null, att: string[] | null,
  opciones: { comoEquipo?: boolean } = {},
): Promise<{ ok: boolean; mensaje?: string }> {
  const admin = createAdminClient()
  // El equipo puede ajustar reservas después del cierre (desde "ver como invitado").
  const cierre = opciones.comoEquipo ? '2100-01-01T00:00:00Z' : EVENTO.cierreCambios
  const { data, error } = await admin.rpc('oh_accion', {
    p_token: token, p_accion: accion, p_slot: slot, p_att: att,
    p_cap: EVENTO.capacidad, p_slots: SLOT_IDS, p_cierre: cierre,
  })
  if (error) { console.error('[open-house] oh_accion', error.message); return { ok: false, mensaje: 'No se ha podido guardar. Inténtalo de nuevo.' } }
  const r = data as { ok: boolean; error?: string; grupo?: string; invitado?: string }
  if (!r.ok) return { ok: false, mensaje: MENSAJES[r.error ?? ''] ?? 'No se ha podido guardar.' }
  // Correos y avisos: no bloquean la respuesta.
  despuesDeAccion(accion, r.grupo!, r.invitado!).catch((e) => console.error('[open-house] después de acción', e))
  return { ok: true }
}

// ── Correos y avisos ────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const primero = (n: string) => n.split(' ')[0]
const unir = (a: string[]) => (a.length < 2 ? a[0] ?? '' : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`)

export function ics(g: Grupo, uid: string): string {
  const s = slotPorId(g.booking!.slot)!
  // Madrid en octubre: UTC+2.
  const utc = (t: string) => { const [h, m] = t.split(':').map(Number); return `${EVENTO.fecha.replace(/-/g, '')}T${String(h - 2).padStart(2, '0')}${String(m).padStart(2, '0')}00Z` }
  const nombres = g.booking!.att.map((id) => g.members.find((m) => m.id === id)?.name).filter(Boolean).join('\\, ')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forma Prima//Open House//ES', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}@formaprima.es`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${utc(s.t)}`, `DTEND:${utc(s.end)}`, `SUMMARY:${EVENTO.nombre} · Forma Prima`,
    'LOCATION:Calle de Claudio Coello 38\\, 2º derecha\\, Madrid', `DESCRIPTION:Visita guiada. Asistentes: ${nombres}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}

function correoReserva(g: Grupo, destino: { name: string; token: string }, recordatorio = false) {
  const s = slotPorId(g.booking!.slot)!
  const por = g.members.find((m) => m.id === g.booking!.by)
  const asistentes = g.booking!.att.map((id) => g.members.find((m) => m.id === id)?.name ?? '').filter(Boolean)
  const asunto = recordatorio
    ? `Mañana a las ${s.t} · Open House Claudio Coello 38`
    : `Tu visita · Open House Claudio Coello 38 · ${s.t}`
  const intro = recordatorio
    ? `Te esperamos mañana, jueves 8 de octubre, a las ${s.t}.`
    : por && por.token !== destino.token && por.name
      ? `${primero(por.name)} ha reservado vuestra visita para el jueves 8 de octubre, de ${s.t} a ${s.end}.`
      : `Tu visita queda confirmada para el jueves 8 de octubre, de ${s.t} a ${s.end}.`
  const html = wrapEmail(`
    <p style="margin:0 0 14px;font-size:15px;">Hola ${esc(primero(destino.name))},</p>
    <p style="margin:0 0 14px;font-size:15px;">${esc(intro)}</p>
    <p style="margin:0 0 14px;font-size:14px;color:#555;">${esc(EVENTO.direccion)}${g.exclusive ? ' · Visita privada' : ''}<br>Asistentes: ${esc(unir(asistentes))}</p>
    <p style="margin:0 0 14px;font-size:14px;color:#555;">Al llegar, indica tu nombre en portería y sube al 2º derecha.</p>
    <p style="margin:0 0 18px;"><a href="${enlace(destino.token)}" style="color:#161616;">Ver mi pase · cambiar horario</a></p>
    <p style="margin:0;font-size:14px;">Hasta pronto,<br>Forma Prima</p>`)
  return { asunto, html }
}

async function despuesDeAccion(accion: AccionInvitado, grupoId: string, invitadoId: string) {
  const todo = await leerTodo()
  const g = todo.groups.find((x) => x.id === grupoId)
  if (!g) return
  const quien = g.members.find((m) => m.id === invitadoId)
  const titulo = g.name || g.members[0]?.name || 'Invitación'

  // Correo de confirmación con el .ics: al reservar, a todos los asistentes con
  // email; al unirse, solo a quien se une.
  if ((accion === 'reservar' || accion === 'unirse') && g.booking) {
    const destinos = g.members.filter((m) => /@/.test(m.email) && g.booking!.att.includes(m.id) && (accion === 'reservar' || m.id === invitadoId))
    for (const m of destinos) {
      const { asunto, html } = correoReserva(g, m)
      const r = await sendEmail({
        to: m.email, subject: asunto, html,
        attachments: [{ filename: 'open-house-claudio-coello-38.ics', content: Buffer.from(ics(g, m.token)) }],
      })
      if (r.error) console.error('[open-house] correo', m.email, r.error)
    }
  }

  // Aviso al equipo.
  const s = g.booking ? slotPorId(g.booking.slot) : null
  const textos: Record<AccionInvitado, string> = {
    reservar: `${quien?.name ?? 'Un invitado'} ha reservado a las ${s?.t ?? '—'} (${g.booking?.att.length ?? 0} ${(g.booking?.att.length ?? 0) === 1 ? 'persona' : 'personas'})`,
    unirse: `${quien?.name ?? 'Un invitado'} se une a la visita de las ${s?.t ?? '—'}`,
    cancelar: `${quien?.name ?? 'Un invitado'} ha cancelado la visita`,
    declinar: `${quien?.name ?? 'Un invitado'} no podrá asistir`,
  }
  try {
    await createAdminClient().from('avisos').insert({
      tipo: 'equipo', autor_id: null, titulo: `Open House CC38 · ${textos[accion]}`,
      contenido: `${titulo}. Panel: /team/apps/open-house`, nivel: 'informativo',
      fecha_activa: new Date().toISOString().slice(0, 10), visible_roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'],
    })
  } catch { /* no bloquea */ }
}

/** Recordatorio la víspera (cron). Una vez por grupo. */
export async function enviarRecordatorios(): Promise<number> {
  const admin = createAdminClient()
  const todo = await leerTodo()
  const { data: enviados } = await admin.from('oh_grupos').select('id').not('recordatorio_at', 'is', null)
  const ya = new Set((enviados ?? []).map((x: { id: string }) => x.id))
  let n = 0
  for (const g of todo.groups) {
    if (!g.booking || ya.has(g.id)) continue
    for (const m of g.members.filter((x) => /@/.test(x.email) && g.booking!.att.includes(x.id))) {
      const { asunto, html } = correoReserva(g, m, true)
      const r = await sendEmail({ to: m.email, subject: asunto, html, attachments: [{ filename: 'open-house-claudio-coello-38.ics', content: Buffer.from(ics(g, m.token)) }] })
      if (!r.error) n++
    }
    await admin.from('oh_grupos').update({ recordatorio_at: new Date().toISOString() }).eq('id', g.id)
  }
  return n
}

// ── Panel del estudio ───────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9]{1,48}$/
const TOKEN_RE = /^[a-z]{0,4}-[a-z0-9]{8,24}$/

export async function accionPanel(op: string, cuerpo: Record<string, unknown>, userId: string): Promise<{ ok: boolean; mensaje?: string }> {
  const admin = createAdminClient()
  const gid = typeof cuerpo.gid === 'string' && ID_RE.test(cuerpo.gid) ? cuerpo.gid : null

  if (op === 'crear') {
    const g = cuerpo.grupo as { id?: unknown; name?: unknown; exclusive?: unknown; members?: unknown } | undefined
    const miembros = Array.isArray(g?.members) ? (g!.members as Array<Record<string, unknown>>) : []
    if (!g || typeof g.id !== 'string' || !ID_RE.test(g.id) || !miembros.length || miembros.length > 20) return { ok: false, mensaje: 'Invitación no válida.' }
    const filas = miembros.map((m, i) => ({
      id: String(m.id ?? ''), nombre: String(m.name ?? '').trim().slice(0, 120), saludo: m.salute === 'Estimada' ? 'Estimada' : 'Estimado',
      contacto: String(m.email ?? '').trim().slice(0, 160), token: String(m.token ?? ''), orden: i, grupo_id: g.id as string,
    }))
    if (filas.some((f) => !ID_RE.test(f.id) || !f.nombre || !TOKEN_RE.test(f.token))) return { ok: false, mensaje: 'Revisa los nombres de la invitación.' }
    const { error: e1 } = await admin.from('oh_grupos').insert({ id: g.id, evento: EVENTO.slug, nombre: String(g.name ?? '').trim().slice(0, 120), exclusiva: g.exclusive === true, creado_por: userId })
    if (e1) return { ok: false, mensaje: e1.message }
    const { error: e2 } = await admin.from('oh_invitados').insert(filas)
    if (e2) { await admin.from('oh_grupos').delete().eq('id', g.id); return { ok: false, mensaje: e2.message } }
    return { ok: true }
  }

  if (!gid) return { ok: false, mensaje: 'Grupo no válido.' }

  if (op === 'eliminar') {
    const { error } = await admin.from('oh_grupos').delete().eq('id', gid)
    return error ? { ok: false, mensaje: error.message } : { ok: true }
  }
  if (op === 'liberar') {
    const { error } = await admin.from('oh_grupos').update({ reserva_slot: null, reserva_asistentes: [], reserva_por: null, reserva_at: null, updated_at: new Date().toISOString() }).eq('id', gid)
    return error ? { ok: false, mensaje: error.message } : { ok: true }
  }
  if (op === 'exclusiva') {
    const valor = cuerpo.valor === true
    if (valor) {
      // No se puede hacer exclusivo un turno que ya comparten otros.
      const { data: g } = await admin.from('oh_grupos').select('reserva_slot').eq('id', gid).single()
      if (g?.reserva_slot) {
        const { count } = await admin.from('oh_grupos').select('id', { count: 'exact', head: true }).eq('evento', EVENTO.slug).eq('reserva_slot', g.reserva_slot).neq('id', gid)
        if ((count ?? 0) > 0) return { ok: false, mensaje: 'Ese turno ya tiene otros invitados. Libera o cambia el horario antes de marcarlo como exclusivo.' }
      }
    }
    const { error } = await admin.from('oh_grupos').update({ exclusiva: valor, updated_at: new Date().toISOString() }).eq('id', gid)
    return error ? { ok: false, mensaje: error.message } : { ok: true }
  }
  return { ok: false, mensaje: 'Acción no válida.' }
}

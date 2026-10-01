// Datos del Open House en la forma que usa el diseño de Claude Design
// ({ groups: [{ id, name, exclusive, booking, declined, members }] }), leídos y
// escritos en Supabase (oh_grupos / oh_invitados, solo service_role).
//
// Al invitado se le entrega SOLO su grupo (sin los enlaces de los demás: con
// ellos podría reservar en su nombre) y, del resto, únicamente qué turnos están
// ocupados y por cuántos: sin nombres, contactos ni enlaces.

import { createAdminClient } from '@/lib/supabase/admin'
import { EVENTO } from './evento'

export interface Miembro { id: string; name: string; email: string; token: string; openedAt: number | null; salute: string }
export interface Reserva { slot: string; att: string[]; by: string; at?: number }
export interface Grupo { id: string; name: string; exclusive: boolean; booking: Reserva | null; declined: string[]; members: Miembro[] }
export interface Datos { groups: Grupo[] }

type FilaGrupo = {
  id: string; nombre: string; exclusiva: boolean; reserva_slot: string | null; reserva_asistentes: string[]
  reserva_por: string | null; reserva_at: string | null; declinados: string[]; created_at: string
}
type FilaInvitado = { id: string; grupo_id: string; nombre: string; saludo: string; contacto: string; token: string; abierto_at: string | null; orden: number }

export async function leerTodo(): Promise<Datos> {
  const admin = createAdminClient()
  const [{ data: gs, error: e1 }, { data: is, error: e2 }] = await Promise.all([
    admin.from('oh_grupos').select('*').eq('evento', EVENTO.slug).order('created_at', { ascending: true }),
    admin.from('oh_invitados').select('*').order('orden', { ascending: true }),
  ])
  if (e1 || e2) throw new Error((e1 || e2)!.message)
  const porGrupo = new Map<string, FilaInvitado[]>()
  ;((is ?? []) as FilaInvitado[]).forEach((i) => { const l = porGrupo.get(i.grupo_id) ?? []; l.push(i); porGrupo.set(i.grupo_id, l) })
  return {
    groups: ((gs ?? []) as FilaGrupo[]).map((g) => ({
      id: g.id,
      name: g.nombre,
      exclusive: g.exclusiva,
      booking: g.reserva_slot ? { slot: g.reserva_slot, att: g.reserva_asistentes, by: g.reserva_por ?? '', at: g.reserva_at ? Date.parse(g.reserva_at) : undefined } : null,
      declined: g.declinados ?? [],
      members: (porGrupo.get(g.id) ?? []).map((i) => ({
        id: i.id, name: i.nombre, email: i.contacto, token: i.token,
        openedAt: i.abierto_at ? Date.parse(i.abierto_at) : null, salute: i.saludo,
      })),
    })).filter((g) => g.members.length > 0),
  }
}

/** Lo que ve un invitado: su grupo, y del resto solo la ocupación de cada turno. */
export function paraInvitado(todo: Datos, token: string): { datos: Datos; valido: boolean } {
  const propio = todo.groups.find((g) => g.members.some((m) => m.token === token))
  if (!propio) return { datos: { groups: [] }, valido: false }
  const suyo: Grupo = {
    ...propio,
    members: propio.members.map((m) => (m.token === token ? m : { ...m, token: '', email: '' })),
  }
  const otros: Grupo[] = todo.groups
    .filter((g) => g.id !== propio.id && g.booking)
    .map((g, i) => ({
      id: `x${i}`, name: '', exclusive: g.exclusive, declined: [], members: [],
      booking: { slot: g.booking!.slot, att: g.booking!.att.map((_, j) => `x${i}-${j}`), by: '' },
    }))
  return { datos: { groups: [suyo, ...otros] }, valido: true }
}

export async function marcarAbierto(token: string): Promise<void> {
  try {
    await createAdminClient().from('oh_invitados').update({ abierto_at: new Date().toISOString() }).eq('token', token).is('abierto_at', null)
  } catch { /* no bloquea */ }
}

export function tokenValido(t: unknown): t is string {
  return typeof t === 'string' && /^[a-z0-9-]{6,40}$/.test(t)
}

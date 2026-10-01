import { NextResponse } from 'next/server'
import { leerTodo, paraInvitado, tokenValido } from '@/lib/open-house/datos'
import { accionInvitado, type AccionInvitado } from '@/lib/open-house/acciones'

// Acciones del invitado: reservar, unirse, cancelar, no asistir. Valida el
// servidor (función oh_accion, con cerrojo) y devuelve el estado real.

export const dynamic = 'force-dynamic'

const ACCIONES: AccionInvitado[] = ['reservar', 'unirse', 'cancelar', 'declinar']
const intentos = new Map<string, { n: number; hasta: number }>()

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = params.token
  if (!tokenValido(token)) return NextResponse.json({ ok: false, mensaje: 'Invitación no válida.' }, { status: 404 })

  // 30 acciones por enlace cada 10 minutos: de sobra para una persona.
  const ahora = Date.now(), r = intentos.get(token)
  if (!r || ahora > r.hasta) intentos.set(token, { n: 1, hasta: ahora + 600_000 })
  else if (++r.n > 30) return NextResponse.json({ ok: false, mensaje: 'Demasiados cambios seguidos. Espera unos minutos.' }, { status: 429 })

  let cuerpo: { accion?: unknown; slot?: unknown; att?: unknown }
  try { cuerpo = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  const accion = cuerpo.accion as AccionInvitado
  if (!ACCIONES.includes(accion)) return NextResponse.json({ ok: false, mensaje: 'Acción no válida.' }, { status: 400 })
  const slot = typeof cuerpo.slot === 'string' ? cuerpo.slot.slice(0, 8) : null
  const att = Array.isArray(cuerpo.att) ? cuerpo.att.filter((x): x is string => typeof x === 'string').slice(0, 30) : null

  const res = await accionInvitado(token, accion, slot, att)
  const { datos } = paraInvitado(await leerTodo(), token)
  return NextResponse.json({ ...res, datos })
}

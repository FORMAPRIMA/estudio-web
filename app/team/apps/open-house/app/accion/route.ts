import { NextResponse } from 'next/server'
import { leerTodo, tokenValido } from '@/lib/open-house/datos'
import { accionInvitado, accionPanel, type AccionInvitado } from '@/lib/open-house/acciones'
import { usuarioEquipo } from '@/lib/open-house/equipo'

// Acciones del panel (crear, exclusiva, liberar, eliminar) y las de un invitado
// hechas por el equipo desde "Ver como invitado" (sin el cierre del miércoles).

export const dynamic = 'force-dynamic'

const DE_INVITADO: AccionInvitado[] = ['reservar', 'unirse', 'cancelar', 'declinar']

export async function POST(req: Request) {
  const yo = await usuarioEquipo()
  if (!yo) return NextResponse.json({ ok: false, mensaje: 'Sin permisos.' }, { status: 403 })
  let cuerpo: Record<string, unknown>
  try { cuerpo = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  const accion = String(cuerpo.accion ?? '')

  let res: { ok: boolean; mensaje?: string }
  if (DE_INVITADO.includes(accion as AccionInvitado)) {
    if (!tokenValido(cuerpo.token)) return NextResponse.json({ ok: false, mensaje: 'Invitación no válida.' }, { status: 400 })
    const slot = typeof cuerpo.slot === 'string' ? cuerpo.slot.slice(0, 8) : null
    const att = Array.isArray(cuerpo.att) ? (cuerpo.att as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 30) : null
    res = await accionInvitado(cuerpo.token, accion as AccionInvitado, slot, att, { comoEquipo: true })
  } else {
    res = await accionPanel(accion, cuerpo, yo.id)
  }
  return NextResponse.json({ ...res, datos: await leerTodo() })
}

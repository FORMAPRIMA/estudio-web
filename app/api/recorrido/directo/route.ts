import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerVisita, leerVisitasActivas } from '@/lib/recorrido/data'
import { nombrePila } from '@/lib/recorrido/domain'
import type { RcVisita } from '@/lib/recorrido/domain'
import { tokenValido } from '@/lib/open-house/datos'

// Directo del recorrido, público (lo usan los móviles de los invitados).
// GET            → visitas en curso (para unirse desde el QR genérico)
// GET ?visita=id → estado de una visita (respaldo del canal Realtime)
// POST           → presencia del invitado y detalles que ha mirado

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f-]{36}$/

function publica(v: RcVisita) {
  return {
    id: v.id, slot: v.slot, guia: nombrePila(v.guia_nombre ?? ''), modo: v.modo, paso: v.paso,
    detalle_id: v.detalle_id, at: Date.parse(v.updated_at), terminada: !!v.ended_at,
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('visita')
  const headers = { 'Cache-Control': 'no-store' }
  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ visita: null }, { status: 400, headers })
    const v = await leerVisita(id)
    return NextResponse.json({ visita: v ? publica(v) : null }, { headers })
  }
  const vs = await leerVisitasActivas()
  // Una visita abandonada (tablet sin cerrar) no debe aparecer horas después.
  const vivas = vs.filter((v) => Date.now() - Date.parse(v.updated_at) < 90 * 60 * 1000)
  return NextResponse.json({ visitas: vivas.map(publica) }, { headers })
}

export async function POST(req: Request) {
  let body: { token?: unknown; tipo?: unknown; detalle_id?: unknown; visita_id?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  const token = tokenValido(body.token) ? body.token : null
  if (!token) return NextResponse.json({ ok: false }, { status: 400 })
  const admin = createAdminClient()
  const { data: inv } = await admin.from('oh_invitados').select('id').eq('token', token).maybeSingle()
  if (!inv) return NextResponse.json({ ok: false }, { status: 404 })

  const ahora = new Date().toISOString()
  const visita = typeof body.visita_id === 'string' && UUID.test(body.visita_id) ? body.visita_id : null
  if (body.tipo === 'presencia') {
    const { data: ya } = await admin.from('rc_presencia').select('token').eq('token', token).maybeSingle()
    if (ya) await admin.from('rc_presencia').update({ ultima: ahora, ...(visita ? { visita_id: visita } : {}) }).eq('token', token)
    else await admin.from('rc_presencia').insert({ token, primera: ahora, ultima: ahora, visita_id: visita })
  } else if (body.tipo === 'vista' && typeof body.detalle_id === 'string' && UUID.test(body.detalle_id)) {
    await admin.from('rc_vistas').insert({ token, detalle_id: body.detalle_id })
  }
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { enviarAvisos } from '@/lib/recorrido/correo'

// Open House CC38 · 8 oct: cada 5 minutos entre las 16:00 y las 20:55 (Madrid),
// manda a cada invitado su enlace de visita guiada 30 minutos antes de su turno.
// ?simular=1 lista a quién le tocaría sin enviar nada.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const simular = new URL(req.url).searchParams.get('simular') === '1'
  const r = await enviarAvisos(Date.now(), simular)
  if (r.errores.length) console.error('[recorrido-aviso]', r.errores)
  return NextResponse.json({ ok: true, ...r })
}

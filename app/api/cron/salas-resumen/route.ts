import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { datosSala, type Miembro } from '@/lib/salas/panel'
import { bloquesResumen, enviarResumen } from '@/lib/salas/resumen'

// Vercel Cron — cada día a las 07:00 UTC (vercel.json).
// Resumen de Salas de las últimas 24 h para cada persona del panel con email:
// qué leads han entrado (con su temperatura), cuántas visitas anónimas y qué
// leads nuevos se han dado de alta. Si no ha pasado nada, no se envía.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: miembros } = await admin.from('sala_miembros').select('id, nombre, email, empresa, rol').eq('activo', true).not('email', 'is', null)
  const cache = new Map<string, Awaited<ReturnType<typeof datosSala>>>()
  let enviados = 0

  for (const m of (miembros ?? []) as Miembro[]) {
    const bloques = await bloquesResumen(m, cache)
    if (!bloques.length || !m.email) continue
    const r = await enviarResumen(m, bloques)
    if (r.error) console.error('[salas] resumen', m.email, r.error)
    else enviados++
  }
  return NextResponse.json({ ok: true, enviados })
}

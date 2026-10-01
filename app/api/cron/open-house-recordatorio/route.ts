import { NextResponse } from 'next/server'
import { enviarRecordatorios } from '@/lib/open-house/acciones'

// Recordatorio del Open House la víspera (7 oct, 10:00 Madrid = 08:00 UTC).
// Una vez por grupo (oh_grupos.recordatorio_at).

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const enviados = await enviarRecordatorios()
  return NextResponse.json({ ok: true, enviados })
}

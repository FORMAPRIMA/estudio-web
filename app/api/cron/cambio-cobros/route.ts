import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { actualizarContravalores } from '@/lib/facturas/cobrosMoneda'

// Vercel Cron — diario, después de que el BCE publique (~16:00 CET).
// Recalcula el contravalor en euros de los cobros por proyecto en dólares que
// aún no tienen factura emitida (ver lib/facturas/cobrosMoneda.ts).

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.nextUrl.searchParams.get('secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cambios = await actualizarContravalores(createAdminClient())
  return NextResponse.json({ actualizados: cambios.size })
}

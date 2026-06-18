import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateGestorToken } from '@/lib/gestor/auth'
import { buildGastosZip } from '@/lib/gastos/exportZip'

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin = createAdminClient()
  const tokenRow = await validateGestorToken(admin, params.token)
  if (!tokenRow) return NextResponse.json({ error: 'Acceso no válido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)

  const result = await buildGastosZip(admin, year, month)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  })
}

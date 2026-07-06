import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildGastosZip, type GastosZipSelector } from '@/lib/gastos/exportZip'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') return { error: 'Sin permisos', status: 403 as const }
  return { ok: true as const }
}

function zipResponse(result: { buffer: Buffer; filename: string }) {
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  })
}

// Período completo (mes o trimestre) → GET, se abre en pestaña nueva.
export async function GET(req: NextRequest) {
  const auth = await requirePartner()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const year        = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)
  const quarterParam = searchParams.get('quarter')

  const selector: GastosZipSelector = quarterParam
    ? { year, quarter: parseInt(quarterParam, 10) }
    : { year, month: parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10) }

  const result = await buildGastosZip(createAdminClient(), selector)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return zipResponse(result)
}

// Selección concreta de gastos → POST (los ids pueden ser muchos para la URL).
export async function POST(req: NextRequest) {
  const auth = await requirePartner()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'No hay gastos seleccionados.' }, { status: 400 })

  const result = await buildGastosZip(createAdminClient(), { ids })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return zipResponse(result)
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { buildFacturaPdfBuffer } from '@/lib/facturas/buildFacturaPdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()
    const result = await buildFacturaPdfBuffer(admin, params.id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${result.filename}"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[pdf/route]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}

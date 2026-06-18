import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateGestorToken } from '@/lib/gestor/auth'
import { buildFacturaPdfBuffer } from '@/lib/facturas/buildFacturaPdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string; id: string } }
) {
  try {
    const admin = createAdminClient()
    const tokenRow = await validateGestorToken(admin, params.token)
    if (!tokenRow) return NextResponse.json({ error: 'Acceso no válido' }, { status: 403 })

    // El gestor solo puede ver facturas reales (nunca borradores)
    const { data: f } = await admin
      .from('facturas_emitidas')
      .select('id, estado')
      .eq('id', params.id)
      .single()
    if (!f || f.estado === 'borrador') {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

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
    console.error('[gestor/factura]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}

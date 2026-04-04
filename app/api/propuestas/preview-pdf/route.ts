import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PropuestaPDF } from '@/components/pdfs/PropuestaPDF'
import type { PropuestaPDFData } from '@/components/pdfs/PropuestaPDF'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const data = await req.json() as PropuestaPDFData

    const buffer = await renderToBuffer(createElement(PropuestaPDF, { data }) as any)

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Propuesta-${data.numero}.pdf"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[propuestas/preview-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}

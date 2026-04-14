import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DueDiligenciaPDF } from '@/components/pdfs/DueDiligenciaPDF'
import type { DueDiligenciaPDFData } from '@/components/pdfs/DueDiligenciaPDF'
import { getDefaultTextSections } from '@/lib/pdfs/dueDiligenciaDefaults'
import type { DueDiligenciaTextSections } from '@/lib/pdfs/dueDiligenciaDefaults'

interface PreviewPayload extends DueDiligenciaPDFData {
  textSections?: DueDiligenciaTextSections
}

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

    const body = await req.json() as PreviewPayload
    const { textSections: rawSections, ...pdfData } = body
    const textSections = rawSections ?? getDefaultTextSections(pdfData)

    const buffer = await renderToBuffer(
      createElement(DueDiligenciaPDF, { data: pdfData, textSections }) as any
    )

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="DD-Tecnica-${pdfData.nombre_proyecto.replace(/\s+/g, '-')}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[due-diligencia/preview]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateRepasoToken } from '@/lib/repasos/auth'
import { loadProyectoData } from '@/lib/repasos/data'
import { buildRepasosPdfData, pdfFilename } from '@/lib/repasos/pdfData'

export const dynamic = 'force-dynamic'
// Descargar imágenes y montar el PDF con muchas fotos puede pasar de los 10 s.
export const maxDuration = 120

/**
 * Informe PDF para un enlace externo. La audiencia sale del token, nunca de la
 * petición: quien tiene el enlace de cliente no puede pedir el de constructora.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient()
    const tokenRow = await validateRepasoToken(admin, params.token)
    if (!tokenRow) {
      return NextResponse.json({ error: 'Enlace no válido o revocado.' }, { status: 404 })
    }

    const data = await loadProyectoData(tokenRow.proyecto_id, tokenRow.audiencia)
    if (!data) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

    const pdfData = await buildRepasosPdfData(data, tokenRow.audiencia)

    const [{ renderToBuffer }, { RepasosObraPDF }, { createElement }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/pdfs/RepasosObraPDF'),
      import('react'),
    ])

    const buffer = await renderToBuffer(
      createElement(RepasosObraPDF, { data: pdfData }) as any
    )

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename(data.proyecto.nombre, tokenRow.audiencia)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el PDF.' },
      { status: 500 }
    )
  }
}

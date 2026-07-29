import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadProyectoData } from '@/lib/repasos/data'
import { buildRepasosPdfData, pdfFilename } from '@/lib/repasos/pdfData'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import type { RepasoAudiencia } from '@/lib/repasos/domain'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Informe PDF desde el área interna. `?audiencia=cliente|constructora` genera
 * exactamente lo que vería esa audiencia (útil para revisarlo antes de mandar el
 * enlace); sin parámetro sale el informe interno, con todos los repasos.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión activa.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()
    if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) {
      return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
    }

    const pedida = new URL(req.url).searchParams.get('audiencia')
    const audiencia: RepasoAudiencia | undefined =
      pedida === 'cliente' || pedida === 'constructora' ? pedida : undefined

    const data = await loadProyectoData(params.id, audiencia)
    if (!data) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

    const pdfData = await buildRepasosPdfData(data, audiencia)

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
        'Content-Disposition': `attachment; filename="${pdfFilename(data.proyecto.nombre, audiencia)}"`,
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

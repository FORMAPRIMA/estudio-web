import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PDF rendering uses dynamic imports to keep @react-pdf/renderer out of the static bundle.

export const runtime = 'nodejs'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()

    // Validación mínima
    if (!body || !body.projectName || !body.fechaInicio || !Array.isArray(body.scheduleChapters)) {
      return NextResponse.json({ error: 'Datos del cronograma incompletos.' }, { status: 400 })
    }

    const reactPdf = await import('@react-pdf/renderer')
    const { buildCronogramaElement } = await import('@/components/pdfs/CronogramaPDF')

    const element = buildCronogramaElement({
      projectName: String(body.projectName),
      fechaInicio: String(body.fechaInicio),
      m2: typeof body.m2 === 'number' ? body.m2 : null,
      scheduleChapters: body.scheduleChapters,
      scheduleMilestones: body.scheduleMilestones ?? [],
      chapterDaysOverrides: body.chapterDaysOverrides ?? {},
      duracionFactor: typeof body.duracionFactor === 'number' && body.duracionFactor > 0 ? body.duracionFactor : 1.0,
    })

    const buffer = await reactPdf.renderToBuffer(element as React.ReactElement)

    const safeName = String(body.projectName).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'Proyecto'

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Cronograma-${safeName}.pdf"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[fpe-projects/cronograma-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev']

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { MemoriaManualPDF } = await import('@/components/pdfs/MemoriaManualPDF')

    const buffer = await renderToBuffer(
      createElement(MemoriaManualPDF) as React.ReactElement
    )

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Manual-Memorias-de-Calidad.pdf"',
      },
    })
  } catch (err) {
    console.error('[memoria/manual]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado' }, { status: 500 })
  }
}

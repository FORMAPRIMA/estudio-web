import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getObraData } from '@/app/actions/control-obra'
import { buildCambiosCliente, clienteTotales, fmtFecha } from '@/lib/control-obra/domain'
import { ControlObraClientePDF } from '@/components/pdfs/ControlObraClientePDF'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const data = await getObraData()
    if (!data) return NextResponse.json({ error: 'Obra no inicializada' }, { status: 404 })

    const { base: totBase, actual: totAct } = clienteTotales(data.partidas)

    const buffer = await renderToBuffer(
      createElement(ControlObraClientePDF, {
        data: {
          obra: data.obra.nombre,
          fecha: fmtFecha(new Date().toISOString().slice(0, 10)),
          totBase,
          totAct,
          capitulos: buildCambiosCliente(data.partidas),
        },
      }) as any
    )

    const nombre = `control-obra-${data.obra.slug}-${new Date().toISOString().slice(0, 10)}.pdf`
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error generando el PDF' }, { status: 500 })
  }
}

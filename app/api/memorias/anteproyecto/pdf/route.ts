import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NIVELES, type NivelCalidad } from '@/lib/memorias/domain'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

function slug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const params = req.nextUrl.searchParams
    const proyectoId = params.get('proyecto_id')
    const nivel = params.get('nivel') as NivelCalidad | null
    const incluirPrecios = params.get('precios') === '1'

    if (!proyectoId) return NextResponse.json({ error: 'Falta el proyecto.' }, { status: 400 })
    if (!nivel || !NIVELES.some(n => n.value === nivel)) {
      return NextResponse.json({ error: 'Nivel de calidad no válido.' }, { status: 400 })
    }

    const { cargarAnteproyecto } = await import('@/lib/memorias/pdfData')
    const data = await cargarAnteproyecto(proyectoId, nivel, incluirPrecios)
    if (!data) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
    if (data.capitulos.length === 0) {
      return NextResponse.json(
        { error: `No hay Favoritos FP en nivel ${nivel}. Marca favoritos en el warehouse antes de generar la memoria.` },
        { status: 409 }
      )
    }

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { MemoriaAnteproyectoPDF } = await import('@/components/pdfs/MemoriaAnteproyectoPDF')

    const buffer = await renderToBuffer(
      createElement(MemoriaAnteproyectoPDF, { data }) as React.ReactElement
    )

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Memoria-calidades-${slug(data.proyecto.nombre)}-${slug(data.nivelLabel)}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[memorias/anteproyecto/pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado generando el PDF.' },
      { status: 500 }
    )
  }
}

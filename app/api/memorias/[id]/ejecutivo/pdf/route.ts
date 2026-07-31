import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

function slug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const query = req.nextUrl.searchParams
    const proveedorId = query.get('proveedor_id')
    // En el pedido de proveedor manda el coste (es lo que le compramos); el PVP no sale nunca
    const incluirCostes = proveedorId ? true : query.get('costes') === '1'

    const { cargarEjecutivo } = await import('@/lib/memorias/pdfData')
    const data = await cargarEjecutivo(params.id, { proveedorId, incluirCostes })
    if (!data) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
    if (data.estancias.length === 0) {
      return NextResponse.json(
        {
          error: proveedorId
            ? 'Ese proveedor no tiene items asignados en esta memoria.'
            : 'La memoria no tiene items todavía.',
        },
        { status: 409 }
      )
    }

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { MemoriaEjecutivaPDF } = await import('@/components/pdfs/MemoriaEjecutivaPDF')

    const buffer = await renderToBuffer(
      createElement(MemoriaEjecutivaPDF, { data }) as React.ReactElement
    )

    const nombre = data.modo === 'proveedor'
      ? `Pedido-${slug(data.proveedorNombre ?? 'proveedor')}-${slug(data.proyecto.nombre)}`
      : `Memoria-ejecucion-${slug(data.proyecto.nombre)}${incluirCostes ? '-interno' : ''}`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[memorias/ejecutivo/pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado generando el PDF.' },
      { status: 500 }
    )
  }
}

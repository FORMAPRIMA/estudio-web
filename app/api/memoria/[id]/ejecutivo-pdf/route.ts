import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const admin = createAdminClient()
    const proyecto_id = params.id

    const [
      { data: proyecto },
      { data: items },
      { data: chapters },
      { data: proveedores },
    ] = await Promise.all([
      admin.from('proyectos').select('nombre, codigo, nivel_calidad').eq('id', proyecto_id).single(),
      admin
        .from('proyecto_memoria_items')
        .select('*')
        .eq('proyecto_id', proyecto_id)
        .eq('estado_definicion', 'confirmado')
        .eq('activo', true)
        .order('orden', { ascending: true }),
      admin
        .from('fpe_template_chapters')
        .select(`
          id, nombre, label_cliente,
          units:fpe_template_units(
            id, nombre, label_cliente,
            line_items:fpe_template_line_items(id, nombre, orden)
          )
        `)
        .eq('activo', true)
        .order('orden', { ascending: true }),
      admin.from('proveedores').select('id, nombre'),
    ])

    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const proveedorMap = Object.fromEntries((proveedores ?? []).map(p => [p.id, p.nombre]))

    const pdfItems = (items ?? []).map(item => ({
      id:                   item.id,
      nombre:               item.nombre,
      marca:                item.marca,
      modelo:               item.modelo,
      referencia:           item.referencia,
      imagen_principal_url: item.imagen_principal_url,
      imagen_lifestyle_url: item.imagen_lifestyle_url,
      cantidad:             item.cantidad,
      acabado_seleccionado: item.acabado_seleccionado,
      ubicaciones:          item.ubicaciones ?? [],
      precio_referencia:    item.precio_referencia,
      moneda:               item.moneda ?? 'EUR',
      proveedor_nombre:     item.proveedor_preferente_id ? (proveedorMap[item.proveedor_preferente_id] ?? null) : null,
      url_producto:         item.url_producto ?? null,
      template_line_item_id: item.template_line_item_id,
    }))

    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { createElement } = await import('react')
    const { MemoriaEjecutivaPDF } = await import('@/components/pdfs/MemoriaEjecutivoPDF')

    const buffer = await renderToBuffer(
      createElement(MemoriaEjecutivaPDF, {
        data: {
          proyecto,
          items: pdfItems,
          chapters: (chapters ?? []) as Parameters<typeof MemoriaEjecutivaPDF>[0]['data']['chapters'],
          fecha: new Date().toISOString(),
        },
      }) as React.ReactElement
    )

    const slug = proyecto.nombre.replace(/\s+/g, '-').toLowerCase()
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Ejecutivo-${slug}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[memoria/ejecutivo-pdf]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado' }, { status: 500 })
  }
}

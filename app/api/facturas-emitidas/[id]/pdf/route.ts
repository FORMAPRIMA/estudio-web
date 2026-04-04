import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Fetch factura + config en paralelo
    const admin = createAdminClient()
    const [{ data: f, error }, config] = await Promise.all([
      admin.from('facturas_emitidas').select('*').eq('id', params.id).single(),
      getEstudioConfig(),
    ])

    if (error || !f) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Fetch original invoice number if rectificativa
    let factura_original_numero: string | null = null
    if (f.es_rectificativa && f.factura_original_id) {
      const { data: orig } = await admin
        .from('facturas_emitidas')
        .select('numero_completo')
        .eq('id', f.factura_original_id)
        .single()
      factura_original_numero = orig?.numero_completo ?? null
    }

    const pdfData: FacturaPDFData = {
      numero_completo:   f.numero_completo,
      serie:             f.serie,
      fecha_emision:     f.fecha_emision,
      fecha_operacion:   f.fecha_operacion,
      emisor_nombre:     f.emisor_nombre,
      emisor_nif:        f.emisor_nif,
      emisor_direccion:  f.emisor_direccion,
      emisor_ciudad:     f.emisor_ciudad,
      emisor_cp:         f.emisor_cp,
      emisor_email:      f.emisor_email,
      emisor_telefono:   f.emisor_telefono,
      cliente_nombre:    f.cliente_nombre,
      cliente_contacto:  f.cliente_contacto,
      cliente_nif:       f.cliente_nif,
      cliente_direccion: f.cliente_direccion,
      proyecto_nombre:   f.proyecto_nombre,
      items:             f.items,
      tipo_iva:          f.tipo_iva,
      base_imponible:    f.base_imponible,
      cuota_iva:         f.cuota_iva,
      tipo_irpf:         f.tipo_irpf,
      cuota_irpf:        f.cuota_irpf,
      total:             f.total,
      notas:             f.notas,
      mencion_legal:     f.mencion_legal,
      iban:              f.iban,
      banco_nombre:      config?.banco_nombre ?? null,
      banco_swift:       config?.banco_swift  ?? null,
      forma_pago:        f.forma_pago,
      condiciones_pago:  f.condiciones_pago,
      es_rectificativa:  f.es_rectificativa,
      factura_original_numero,
      motivo_rectificacion: f.motivo_rectificacion,
    }

    const buffer = await renderToBuffer(
      createElement(FacturaEmitidaPDF, { data: pdfData })
    )

    const filename = `Factura-${f.numero_completo}.pdf`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[pdf/route]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}

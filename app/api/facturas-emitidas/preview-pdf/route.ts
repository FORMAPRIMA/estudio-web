import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { leerEstudioConfig as getEstudioConfig } from '@/lib/facturas/estudioConfig'
import { tipoCambioBCE } from '@/lib/facturas/tipoCambioBCE'
import { calcTotalsMoneda, pagoUsdDesdeConfig } from '@/lib/facturasUtils'

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

    const body = await req.json() as Partial<FacturaPDFData>

    // Fetch banco details from config (not sent by client)
    const config = await getEstudioConfig()

    // Moneda extranjera: el borrador sale con el mismo cambio BCE que pondrá la
    // emisión, y los totales en euros los calcula el servidor.
    const fechaEmision = body.fecha_emision ?? new Date().toISOString().split('T')[0]
    const moneda       = body.moneda ?? 'EUR'
    const cambio       = moneda === 'EUR' ? null : await tipoCambioBCE(fechaEmision, moneda)
    const eurTotals    = cambio
      ? calcTotalsMoneda(body.items ?? [], body.tipo_iva ?? 21, body.tipo_irpf, moneda, cambio.tipo).eur
      : null

    const pdfData: FacturaPDFData = {
      numero_completo:      body.numero_completo  ?? 'BORRADOR',
      serie:                body.serie            ?? 'F',
      fecha_emision:        fechaEmision,
      fecha_operacion:      body.fecha_operacion  ?? null,
      emisor_nombre:        body.emisor_nombre    ?? '',
      emisor_nif:           body.emisor_nif       ?? '',
      emisor_direccion:     body.emisor_direccion ?? '',
      emisor_ciudad:        body.emisor_ciudad    ?? null,
      emisor_cp:            body.emisor_cp        ?? null,
      emisor_email:         body.emisor_email     ?? null,
      emisor_telefono:      body.emisor_telefono  ?? null,
      cliente_nombre:       body.cliente_nombre   ?? '',
      cliente_contacto:     body.cliente_contacto ?? null,
      cliente_nif:          body.cliente_nif      ?? null,
      cliente_direccion:    body.cliente_direccion ?? null,
      proyecto_nombre:      body.proyecto_nombre  ?? null,
      moneda,
      tipo_cambio:          cambio?.tipo  ?? null,
      tipo_cambio_fecha:    cambio?.fecha ?? null,
      items:                body.items            ?? [],
      tipo_iva:             body.tipo_iva         ?? 21,
      base_imponible:       eurTotals?.base_imponible ?? body.base_imponible ?? 0,
      cuota_iva:            eurTotals?.cuota_iva      ?? body.cuota_iva      ?? 0,
      tipo_irpf:            body.tipo_irpf        ?? null,
      cuota_irpf:           eurTotals ? (body.tipo_irpf ? eurTotals.cuota_irpf : null) : (body.cuota_irpf ?? null),
      total:                eurTotals?.total          ?? body.total          ?? 0,
      notas:                body.notas            ?? null,
      mencion_legal:        body.mencion_legal    ?? null,
      iban:                 body.iban             ?? null,
      banco_nombre:         config?.banco_nombre  ?? null,
      banco_swift:          config?.banco_swift   ?? null,
      pago_usd:          pagoUsdDesdeConfig(config),
      forma_pago:           body.forma_pago       ?? null,
      condiciones_pago:     body.condiciones_pago ?? null,
      es_rectificativa:     body.es_rectificativa ?? false,
      factura_original_numero: body.factura_original_numero ?? null,
      motivo_rectificacion: body.motivo_rectificacion ?? null,
    }

    const buffer = await renderToBuffer(
      createElement(FacturaEmitidaPDF, { data: pdfData }) as any
    )

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Borrador-factura.pdf"',
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[preview-pdf/route]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}

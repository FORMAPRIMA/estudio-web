import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // ── Body ────────────────────────────────────────────────────────────────
    const { ids } = await req.json() as { ids: string[] }
    if (!ids?.length) {
      return NextResponse.json({ error: 'Sin facturas seleccionadas.' }, { status: 400 })
    }

    // ── Fetch data ───────────────────────────────────────────────────────────
    const admin = createAdminClient()
    const [{ data: facturas }, config] = await Promise.all([
      admin
        .from('facturas_emitidas')
        .select('*')
        .in('id', ids)
        .order('fecha_emision', { ascending: true })
        .order('numero', { ascending: true }),
      getEstudioConfig(),
    ])

    if (!facturas?.length) {
      return NextResponse.json({ error: 'No se encontraron las facturas.' }, { status: 404 })
    }

    // ── Generate one PDF per factura and add to ZIP ──────────────────────────
    const zip = new JSZip()

    for (const f of facturas) {
      const pdfData: FacturaPDFData = {
        numero_completo:      f.numero_completo,
        serie:                f.serie,
        fecha_emision:        f.fecha_emision,
        fecha_operacion:      f.fecha_operacion,
        emisor_nombre:        f.emisor_nombre,
        emisor_nif:           f.emisor_nif,
        emisor_direccion:     f.emisor_direccion,
        emisor_ciudad:        f.emisor_ciudad,
        emisor_cp:            f.emisor_cp,
        emisor_email:         f.emisor_email,
        emisor_telefono:      f.emisor_telefono,
        cliente_nombre:       f.cliente_nombre,
        cliente_contacto:     f.cliente_contacto,
        cliente_nif:          f.cliente_nif,
        cliente_direccion:    f.cliente_direccion,
        proyecto_nombre:      f.proyecto_nombre,
        items:                f.items,
        tipo_iva:             f.tipo_iva,
        base_imponible:       f.base_imponible,
        cuota_iva:            f.cuota_iva,
        tipo_irpf:            f.tipo_irpf,
        cuota_irpf:           f.cuota_irpf,
        total:                f.total,
        notas:                f.notas,
        mencion_legal:        f.mencion_legal,
        iban:                 f.iban,
        banco_nombre:         config?.banco_nombre ?? null,
        banco_swift:          config?.banco_swift  ?? null,
        forma_pago:           f.forma_pago,
        condiciones_pago:     f.condiciones_pago,
        es_rectificativa:     f.es_rectificativa,
        motivo_rectificacion: f.motivo_rectificacion ?? null,
      }

      const buffer = await renderToBuffer(
        createElement(FacturaEmitidaPDF, { data: pdfData })
      )

      zip.file(`${f.numero_completo}.pdf`, buffer)
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Facturas-FormaPrima.zip"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[batch-pdf/route]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando ZIP' },
      { status: 500 }
    )
  }
}

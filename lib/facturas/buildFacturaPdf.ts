import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Genera el PDF de una factura emitida. Compartido entre la route interna
 * (/api/facturas-emitidas/[id]/pdf) y el portal del gestor.
 * Importa @react-pdf/renderer dinámicamente para no romper el bundling.
 */
export async function buildFacturaPdfBuffer(
  admin: SupabaseClient,
  facturaId: string
): Promise<{ buffer: Buffer; filename: string } | { error: string; status: number }> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { FacturaEmitidaPDF } = await import('@/components/pdfs/FacturaEmitidaPDF')
  const { getEstudioConfig } = await import('@/app/actions/facturasEmitidas')

  const [{ data: f, error }, config] = await Promise.all([
    admin.from('facturas_emitidas').select('*').eq('id', facturaId).single(),
    getEstudioConfig(),
  ])

  if (error || !f) return { error: 'Factura no encontrada', status: 404 }

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

  const pdfData = {
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
    createElement(FacturaEmitidaPDF, { data: pdfData as any }) as any
  )

  return { buffer: buffer as unknown as Buffer, filename: `Factura-${f.numero_completo}.pdf` }
}

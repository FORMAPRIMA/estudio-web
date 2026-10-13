import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerEstudioConfig as getEstudioConfig } from '@/lib/facturas/estudioConfig'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { sendEmail, wrapEmail, type ExtraEmail } from '@/lib/email'
import { resolverReceptorFactura } from '@/lib/finanzas/proveedorDestino'
import { assertSinClientesEnDestinatarios, ClienteEnDestinatariosError } from '@/lib/finanzas/guardCliente'
import { getPartnersCC, destinatariosFactura, emailsInvalidos } from '@/lib/email/destinatarios'
import { buildFacturaEmailBody } from '@/lib/email/facturaBody'
import { updateFacturaEmitidaEstado } from '@/app/actions/facturasEmitidas'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { emailCliente, extraEmails, asunto, cuerpoIntro, includeCTA, clientesAdicionales } =
      await req.json() as {
        emailCliente:         string
        extraEmails:          ExtraEmail[]
        asunto:               string
        cuerpoIntro:          string
        includeCTA:           boolean
        clientesAdicionales?: { nombre: string; apellidos: string | null; email: string | null; email_cc: string | null }[]
      }

    if (!asunto?.trim()) {
      return NextResponse.json({ error: 'El asunto del correo es obligatorio.' }, { status: 400 })
    }

    // ── Fetch factura + config ───────────────────────────────────────────────
    const admin = createAdminClient()
    const [{ data: f, error }, config] = await Promise.all([
      admin.from('facturas_emitidas').select('*').eq('id', params.id).single(),
      getEstudioConfig(),
    ])

    if (error || !f) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // ── Destinatario: cliente o proveedor ─────────────────────────────────────
    // Lo decide el destinatario, no solo la sección (un rappel de mobiliario está
    // en una sección pública y tampoco puede salir hacia el cliente).
    const { esPrivada, proveedor: proveedorDestino } = await resolverReceptorFactura(admin, {
      seccion:         (f.seccion as string | null) ?? null,
      proveedorId:     (f.proveedor_id as string | null) ?? null,
      receptorTipo:    (f.receptor_tipo as string | null) ?? null,
      facturaOrigenId: f.factura_origen_id ?? null,
      proyectoId:      f.proyecto_id ?? null,
    })
    if (esPrivada && !proveedorDestino) {
      return NextResponse.json({
        error: 'Esta factura va a un proveedor pero no hay ninguno asignado. Asígnalo en el control de facturación.',
      }, { status: 422 })
    }
    const emailPrincipal = emailCliente?.trim() || (esPrivada ? proveedorDestino!.email ?? '' : '')
    if (!emailPrincipal) {
      return NextResponse.json({
        error: esPrivada
          ? 'El proveedor no tiene email registrado. Escríbelo en el formulario o añádelo en Proveedores.'
          : 'Email del cliente requerido.',
      }, { status: 400 })
    }
    const invalidos = emailsInvalidos([emailPrincipal, ...(extraEmails ?? []).map(e => e.email)])
    if (invalidos.length) {
      return NextResponse.json({ error: `Email no válido: ${invalidos.join(', ')}` }, { status: 400 })
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

    // Copia interna a los socios (ver lib/email/destinatarios.ts)
    const PARTNERS_CC = await getPartnersCC()

    // ── Generate PDF ─────────────────────────────────────────────────────────
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
      banco_nombre:         config?.banco_nombre   ?? null,
      banco_swift:          config?.banco_swift    ?? null,
      forma_pago:           f.forma_pago,
      condiciones_pago:     f.condiciones_pago,
      es_rectificativa:     f.es_rectificativa,
      factura_original_numero,
      motivo_rectificacion: f.motivo_rectificacion,
    }

    const pdfBuffer = await renderToBuffer(createElement(FacturaEmitidaPDF, { data: pdfData }) as any)

    // ── Distribute recipients ─────────────────────────────────────────────────
    // Socios siempre en copia; a proveedor nunca van los otros clientes del proyecto.
    const adicionales = esPrivada ? [] : (clientesAdicionales ?? [])
    const { to: toList, cc, bcc } = destinatariosFactura({
      principal:           emailPrincipal,
      esParaProveedor:     esPrivada,
      partners:            PARTNERS_CC,
      extras:              extraEmails,
      clientesAdicionales: adicionales,
    })

    // ── Greeting ──────────────────────────────────────────────────────────────
    const mainNombre = esPrivada
      ? proveedorDestino!.nombre
      : (f.cliente_contacto?.trim() || f.cliente_nombre)
    const adicionalNombres = esPrivada ? [] : adicionales
      .map(c => [c.nombre, c.apellidos].filter(Boolean).join(' ').split(' ')[0])
      .filter(Boolean)
    const allNombres = [mainNombre, ...adicionalNombres]
    const saludoNombre = allNombres.length > 1
      ? allNombres.slice(0, -1).join(', ') + ' y ' + allNombres[allNombres.length - 1]
      : allNombres[0]

    // ── Email body ────────────────────────────────────────────────────────────
    const bodyHtml = buildFacturaEmailBody({
      saludoNombre,
      esParaProveedor: esPrivada,
      introHtml:       cuerpoIntro,
      items:           f.items as { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[],
      tipoIva:         f.tipo_iva,
      baseImponible:   f.base_imponible,
      cuotaIva:        f.cuota_iva,
      tipoIrpf:        f.tipo_irpf,
      cuotaIrpf:       f.cuota_irpf,
      total:           f.total,
      banco:           config,
      ctaProyectoId:   includeCTA ? (f.proyecto_id ?? null) : null,
    })

    // ── Send ──────────────────────────────────────────────────────────────────
    // Red de seguridad antes de enviar (ver lib/finanzas/guardCliente.ts).
    if (esPrivada) {
      try {
        await assertSinClientesEnDestinatarios(admin, {
          proyectoId: f.proyecto_id ?? null,
          to: toList, cc, bcc,
        })
      } catch (guardErr) {
        if (guardErr instanceof ClienteEnDestinatariosError) {
          return NextResponse.json({ error: guardErr.message }, { status: 409 })
        }
        throw guardErr
      }
    }

    const emailResult = await sendEmail({
      to:      toList,
      cc,
      ...(bcc.length && { bcc }),
      subject: asunto.trim(),
      html:    wrapEmail(bodyHtml),
      attachments: [{ filename: `Factura-${f.numero_completo}.pdf`, content: pdfBuffer }],
    })

    if (emailResult.error) {
      return NextResponse.json({ error: `El correo falló: ${emailResult.error}` }, { status: 500 })
    }

    // Si el envío original falló, este reenvío es el primero que llega: sale del borrador.
    if (f.estado === 'borrador') await updateFacturaEmitidaEstado(f.id, 'enviada')

    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reenviar/route]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

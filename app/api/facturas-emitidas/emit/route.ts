import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {createFacturaEmitida, updateFacturaEmitidaEstado } from '@/app/actions/facturasEmitidas'
import { leerEstudioConfig as getEstudioConfig } from '@/lib/facturas/estudioConfig'
import type { CreateFacturaInput } from '@/app/actions/facturasEmitidas'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { calcTotals } from '@/lib/facturasUtils'
import { sendEmail, wrapEmail, type ExtraEmail } from '@/lib/email'
import { resolverReceptorFactura } from '@/lib/finanzas/proveedorDestino'
import { assertSinClientesEnDestinatarios, ClienteEnDestinatariosError } from '@/lib/finanzas/guardCliente'
import { getPartnersCC, destinatariosFactura, emailsInvalidos, SIN_SOCIOS_ERROR } from '@/lib/email/destinatarios'
import { buildFacturaEmailBody } from '@/lib/email/facturaBody'

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
    const { input, emailCliente, extraEmails, includeCTA, clientesAdicionales } = await req.json() as {
      input:                CreateFacturaInput
      emailCliente:         string
      extraEmails:          ExtraEmail[]
      includeCTA:           boolean
      clientesAdicionales?: { nombre: string; apellidos: string | null; email: string | null; email_cc: string | null }[]
    }

    // ── Destinatario: cliente o proveedor ────────────────────────────────────
    // Lo decide la factura, no solo su sección. Un rappel de mobiliario vive en una
    // sección pública ("Compra de mobiliario", donde los suplidos sí van al cliente)
    // y aun así jamás puede salir hacia el cliente.
    const adminGuard = createAdminClient()
    const { esPrivada, proveedor: proveedorDestino } = await resolverReceptorFactura(adminGuard, {
      seccion:         input.seccion ?? null,
      proveedorId:     input.proveedor_id ?? null,
      receptorTipo:    input.receptor_tipo ?? null,
      facturaOrigenId: input.factura_origen_id ?? null,
      proyectoId:      input.proyecto_id ?? null,
    })
    const proveedorOrigen = proveedorDestino?.id ?? input.proveedor_id ?? null

    // A proveedor: el formulario precarga el email de su ficha y deja editarlo; si
    // llega vacío se usa el de la ficha. guardCliente impide más abajo que acabe
    // en un cliente del proyecto.
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

    // Copia interna a los socios (ver lib/email/destinatarios.ts)
    const PARTNERS_CC = await getPartnersCC()
    if (PARTNERS_CC.length === 0) {
      return NextResponse.json({ error: SIN_SOCIOS_ERROR }, { status: 503 })
    }

    // ── 1. Crear factura ────────────────────────────────────────────────────
    // El receptor se persiste ya resuelto en servidor, para que reenvíos y
    // recordatorios posteriores no dependan de volver a deducirlo.
    const created = await createFacturaEmitida({
      ...input,
      receptor_tipo: esPrivada ? 'proveedor' : 'cliente',
      proveedor_id:  esPrivada ? (proveedorDestino?.id ?? proveedorOrigen) : null,
    })
    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 422 })
    }
    const { id, numero_completo } = created

    // ── 2. Config de estudio + sección de la factura origen ─────────────────
    const admin = createAdminClient()
    const [config, seccionRow] = await Promise.all([
      getEstudioConfig(),
      input.factura_origen_id
        ? admin.from('facturas').select('seccion').eq('id', input.factura_origen_id).single()
        : Promise.resolve({ data: null }),
    ])
    const seccion: string | null = (seccionRow.data as { seccion?: string } | null)?.seccion ?? null

    // ── 3. Totales ──────────────────────────────────────────────────────────
    const totals   = calcTotals(input.items, input.tipo_iva, input.tipo_irpf)
    const showIrpf = !!input.tipo_irpf && totals.cuota_irpf > 0

    // ── 4. PDF ──────────────────────────────────────────────────────────────
    const pdfData: FacturaPDFData = {
      numero_completo,
      serie:            input.serie,
      fecha_emision:    input.fecha_emision,
      fecha_operacion:  input.fecha_operacion  ?? null,
      emisor_nombre:    input.emisor_nombre,
      emisor_nif:       input.emisor_nif,
      emisor_direccion: input.emisor_direccion,
      emisor_ciudad:    input.emisor_ciudad    ?? null,
      emisor_cp:        input.emisor_cp        ?? null,
      emisor_email:     input.emisor_email     ?? null,
      emisor_telefono:  input.emisor_telefono  ?? null,
      cliente_nombre:   input.cliente_nombre,
      cliente_contacto: input.cliente_contacto ?? null,
      cliente_nif:      input.cliente_nif      ?? null,
      cliente_direccion:input.cliente_direccion ?? null,
      proyecto_nombre:  input.proyecto_nombre  ?? null,
      items:            input.items,
      tipo_iva:         input.tipo_iva,
      base_imponible:   totals.base_imponible,
      cuota_iva:        totals.cuota_iva,
      tipo_irpf:        input.tipo_irpf        ?? null,
      cuota_irpf:       showIrpf ? totals.cuota_irpf : null,
      total:            totals.total,
      notas:            input.notas            ?? null,
      mencion_legal:    input.mencion_legal    ?? null,
      iban:             input.iban             ?? null,
      banco_nombre:     config?.banco_nombre   ?? null,
      banco_swift:      config?.banco_swift    ?? null,
      forma_pago:       input.forma_pago       ?? null,
      condiciones_pago: input.condiciones_pago ?? null,
      es_rectificativa: input.es_rectificativa ?? false,
    }

    const pdfBuffer = await renderToBuffer(createElement(FacturaEmitidaPDF, { data: pdfData }) as any)

    // ── 5. Distribuir emails ────────────────────────────────────────────────
    // Socios siempre en copia; a proveedor nunca van los otros clientes del proyecto.
    const adicionales = esPrivada ? [] : (clientesAdicionales ?? [])
    const { to: toList, cc, bcc } = destinatariosFactura({
      principal:           emailPrincipal,
      esParaProveedor:     esPrivada,
      partners:            PARTNERS_CC,
      extras:              extraEmails,
      clientesAdicionales: adicionales,
    })

    // ── 6. Greeting ──────────────────────────────────────────────────────────
    let saludoNombre: string
    if (esPrivada) {
      saludoNombre = proveedorDestino!.nombre
    } else {
      const mainNombre = input.cliente_contacto?.trim() || input.cliente_nombre
      const adicionalNombres = adicionales
        .map(c => [c.nombre, c.apellidos].filter(Boolean).join(' ').split(' ')[0]) // first name only
        .filter(Boolean)
      const allNombres = [mainNombre, ...adicionalNombres]
      saludoNombre = allNombres.length > 1
        ? allNombres.slice(0, -1).join(', ') + ' y ' + allNombres[allNombres.length - 1]
        : allNombres[0]
    }

    // ── 7. Email body ───────────────────────────────────────────────────────
    const refProyectoFase = input.proyecto_nombre && seccion
      ? `, correspondiente a <strong style="color:#1A1A1A;">${seccion}</strong> del proyecto <strong style="color:#1A1A1A;">${input.proyecto_nombre}</strong>`
      : input.proyecto_nombre
      ? `, correspondiente al proyecto <strong style="color:#1A1A1A;">${input.proyecto_nombre}</strong>`
      : seccion
      ? `, correspondiente a <strong style="color:#1A1A1A;">${seccion}</strong>`
      : ''

    const introHtml = esPrivada
      ? `Les informamos de la emisión de la factura <strong style="color:#1A1A1A;">${numero_completo}</strong>${refProyectoFase}.
         Adjuntamos el documento PDF con el detalle completo. Rogamos procedan a su abono según los datos de pago indicados.`
      : `Nos complace enviarle adjunta la factura <strong style="color:#1A1A1A;">${numero_completo}</strong>${refProyectoFase}.
         Encontrará el detalle completo en el documento PDF adjunto.`

    const bodyHtml = buildFacturaEmailBody({
      saludoNombre:    saludoNombre,
      esParaProveedor: esPrivada,
      introHtml,
      items:           input.items,
      tipoIva:         input.tipo_iva,
      baseImponible:   totals.base_imponible,
      cuotaIva:        totals.cuota_iva,
      tipoIrpf:        input.tipo_irpf ?? null,
      cuotaIrpf:       showIrpf ? totals.cuota_irpf : null,
      total:           totals.total,
      banco:           config,
      ctaProyectoId:   includeCTA ? (input.proyecto_id ?? null) : null,
    })

    // ── 8. Enviar ───────────────────────────────────────────────────────────
    // Red de seguridad: si por cualquier vía un email del cliente se hubiera
    // colado en una factura a proveedor, no se envía. Ver lib/finanzas/guardCliente.ts.
    if (esPrivada) {
      try {
        await assertSinClientesEnDestinatarios(admin, {
          proyectoId: input.proyecto_id ?? null,
          to: toList, cc, bcc,
        })
      } catch (guardErr) {
        if (guardErr instanceof ClienteEnDestinatariosError) {
          return NextResponse.json({
            error: `Factura creada (${numero_completo}) pero NO enviada. ${guardErr.message}`,
          }, { status: 409 })
        }
        throw guardErr
      }
    }

    const emailResult = await sendEmail({
      to:      toList,
      cc,
      ...(bcc.length && { bcc }),
      subject: esPrivada
        ? `Forma Prima — Factura ${numero_completo}${input.proyecto_nombre ? ` · ${input.proyecto_nombre}` : ''}`
        : `Facturación Forma Prima — ¡Aquí tienes tu factura! · ${input.proyecto_nombre ?? numero_completo}`,
      html:    wrapEmail(bodyHtml),
      attachments: [{ filename: `Factura-${numero_completo}.pdf`, content: pdfBuffer }],
    })

    if (emailResult.error) {
      return NextResponse.json({
        error: `Factura creada (${numero_completo}) pero el email falló: ${emailResult.error}. No la emitas otra vez: reenvíala desde Editar → Guardar y reenviar.`,
      }, { status: 500 })
    }

    // ── 9. Marcar como enviada ──────────────────────────────────────────────
    await updateFacturaEmitidaEstado(id, 'enviada')

    return NextResponse.json({ id, numero_completo })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[emit/route]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

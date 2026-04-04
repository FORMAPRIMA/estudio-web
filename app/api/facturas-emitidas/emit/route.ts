import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createFacturaEmitida, getEstudioConfig, updateFacturaEmitidaEstado } from '@/app/actions/facturasEmitidas'
import type { CreateFacturaInput } from '@/app/actions/facturasEmitidas'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { calcTotals } from '@/lib/facturasUtils'
import { sendEmail, wrapEmail } from '@/lib/email'
import type { ExtraEmail } from '@/app/actions/emitirFactura'

const PARTNERS_CC = ['jlorag@formaprima.es', 'ghidalgo@formaprima.es']

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

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

    if (!emailCliente?.trim()) {
      return NextResponse.json({ error: 'Email del cliente requerido.' }, { status: 400 })
    }

    // ── 1. Crear factura ────────────────────────────────────────────────────
    const created = await createFacturaEmitida(input)
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

    const pdfBuffer = await renderToBuffer(createElement(FacturaEmitidaPDF, { data: pdfData }))

    // ── 5. Distribuir emails ────────────────────────────────────────────────
    const valid    = (extraEmails ?? []).filter(e => e.email.trim())
    const toExtra  = valid.filter(e => e.tipo === 'to') .map(e => e.email.trim())
    const ccExtra  = valid.filter(e => e.tipo === 'cc') .map(e => e.email.trim())
    const bccExtra = valid.filter(e => e.tipo === 'bcc').map(e => e.email.trim())

    // Additional project clients → their primary email goes TO, secondary email goes CC
    const adicionales = clientesAdicionales ?? []
    const toAdicional = adicionales.map(c => c.email).filter((e): e is string => !!e?.trim()).map(e => e.trim())
    const ccAdicional = adicionales.map(c => c.email_cc).filter((e): e is string => !!e?.trim()).map(e => e.trim())

    const toList = [emailCliente.trim(), ...toExtra, ...toAdicional].filter(Boolean)
    const cc     = [...PARTNERS_CC, ...ccExtra, ...ccAdicional]
    const bcc    = bccExtra

    // ── 6. Greeting — include all client first names ─────────────────────────
    const mainNombre = input.cliente_contacto?.trim() || input.cliente_nombre
    const adicionalNombres = adicionales
      .map(c => [c.nombre, c.apellidos].filter(Boolean).join(' ').split(' ')[0]) // first name only
      .filter(Boolean)
    const allNombres = [mainNombre, ...adicionalNombres]
    const saludoNombre = allNombres.length > 1
      ? allNombres.slice(0, -1).join(', ') + ' y ' + allNombres[allNombres.length - 1]
      : allNombres[0]

    // ── 7. Email body ───────────────────────────────────────────────────────
    const itemsRows = input.items.map(item => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;line-height:1.4;">${item.descripcion}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#888;text-align:right;white-space:nowrap;padding-left:16px;">${item.cantidad} × ${eur(item.precio_unitario)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;text-align:right;white-space:nowrap;padding-left:16px;font-weight:600;">${eur(item.subtotal)}</td>
      </tr>`).join('')

    const bodyHtml = `
      <p style="margin:0 0 22px;font-size:22px;font-weight:300;color:#1A1A1A;line-height:1.3;">Estimado/a ${saludoNombre},</p>

      <p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.75;">
        Nos complace enviarle adjunta la factura <strong style="color:#1A1A1A;">${numero_completo}</strong>${
          input.proyecto_nombre && seccion
            ? `, correspondiente a la fase de <strong style="color:#1A1A1A;">${seccion}</strong> del proyecto <strong style="color:#1A1A1A;">${input.proyecto_nombre}</strong>`
            : input.proyecto_nombre
            ? `, correspondiente al proyecto <strong style="color:#1A1A1A;">${input.proyecto_nombre}</strong>`
            : seccion
            ? `, correspondiente a la fase de <strong style="color:#1A1A1A;">${seccion}</strong>`
            : ''
        }.
        Encontrará el detalle completo en el documento PDF adjunto.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        <thead>
          <tr>
            <td style="padding:6px 0;border-bottom:1.5px solid #1A1A1A;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;">Concepto</td>
            <td style="padding:6px 0;border-bottom:1.5px solid #1A1A1A;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;text-align:right;padding-left:16px;">Detalle</td>
            <td style="padding:6px 0;border-bottom:1.5px solid #1A1A1A;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;text-align:right;padding-left:16px;">Importe</td>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr><td width="45%"></td><td>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">Base imponible</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">${eur(totals.base_imponible)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">IVA (${input.tipo_iva}%)</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">${eur(totals.cuota_iva)}</td>
            </tr>
            ${showIrpf ? `
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">Retención IRPF (${input.tipo_irpf}%)</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">−${eur(totals.cuota_irpf)}</td>
            </tr>` : ''}
            <tr><td colspan="2" style="padding:4px 0 0;"><div style="height:1px;background:#E6E4DF;"></div></td></tr>
            <tr>
              <td style="padding:10px 16px;background:#1A1A1A;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#F0EDE8;">Total a pagar</td>
              <td style="padding:10px 16px;background:#1A1A1A;font-size:17px;font-weight:700;color:#ffffff;text-align:right;letter-spacing:-0.3px;">${eur(totals.total)}</td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${config?.iban ? `
      <div style="background:#F8F7F4;border-left:3px solid #D85A30;padding:16px 20px;margin-bottom:32px;">
        <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;">Datos de pago</p>
        ${config.banco_nombre ? `<p style="margin:0 0 5px;font-size:13px;color:#3A3A3A;font-weight:600;">${config.banco_nombre}</p>` : ''}
        <p style="margin:0 0 4px;font-size:13px;color:#555555;font-family:'Courier New',monospace;">IBAN: ${config.iban}</p>
        ${config.banco_swift ? `<p style="margin:0;font-size:12px;color:#888888;font-family:'Courier New',monospace;">SWIFT/BIC: ${config.banco_swift}</p>` : ''}
      </div>` : ''}

      ${includeCTA && input.proyecto_id ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="background:#1A1A1A;padding:24px 28px;">
            <div style="height:2px;background:#D85A30;margin-bottom:20px;opacity:0.7;"></div>
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#666060;">Área de cliente</p>
            <p style="margin:0 0 18px;font-size:15px;font-weight:300;color:#F0EDE8;line-height:1.5;">Consulta el avance de tu proyecto,<br/>documentación y facturas en un solo lugar.</p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.formaprima.es'}/portal/${input.proyecto_id}" style="display:inline-block;background:#D85A30;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;padding:12px 28px;">
              Acceder a mi área &rarr;
            </a>
          </td>
        </tr>
      </table>` : ''}

      <p style="margin:0 0 6px;font-size:14px;color:#555555;line-height:1.75;">Quedamos a su disposición para cualquier consulta.</p>
      <p style="margin:0;font-size:14px;color:#555555;line-height:1.75;">
        Un cordial saludo,<br/><strong style="color:#1A1A1A;">Equipo Forma Prima</strong>
      </p>
    `

    // ── 8. Enviar ───────────────────────────────────────────────────────────
    const emailResult = await sendEmail({
      to:      toList,
      cc,
      ...(bcc.length && { bcc }),
      subject: `Facturación Forma Prima — ¡Aquí tienes tu factura! · ${input.proyecto_nombre ?? numero_completo}`,
      html:    wrapEmail(bodyHtml),
      attachments: [{ filename: `Factura-${numero_completo}.pdf`, content: pdfBuffer }],
    })

    if (emailResult.error) {
      return NextResponse.json({
        error: `Factura creada (${numero_completo}) pero el email falló: ${emailResult.error}`,
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

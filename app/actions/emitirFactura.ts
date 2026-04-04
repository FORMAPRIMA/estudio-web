'use server'

import { createElement } from 'react'
import {
  createFacturaEmitida,
  getEstudioConfig,
  updateFacturaEmitidaEstado,
  type CreateFacturaInput,
} from './facturasEmitidas'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { calcTotals } from '@/lib/facturasUtils'
import { sendEmail, wrapEmail } from '@/lib/email'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtraEmail {
  email: string
  tipo:  'to' | 'cc' | 'bcc'
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PARTNERS_CC = ['jlorag@formaprima.es', 'ghidalgo@formaprima.es']

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Acción principal ──────────────────────────────────────────────────────────

export async function emitirYEnviarFactura(
  input:        CreateFacturaInput,
  emailCliente: string,
  extraEmails:  ExtraEmail[],
): Promise<{ id: string; numero_completo: string } | { error: string }> {

  // 1 — Crear la factura
  const created = await createFacturaEmitida(input)
  if ('error' in created) return created
  const { id, numero_completo } = created

  try {
    // 2 — Config de estudio (banco, IBAN, SWIFT)
    const config = await getEstudioConfig()

    // 3 — Totales
    const totals  = calcTotals(input.items, input.tipo_iva, input.tipo_irpf)
    const showIrpf = !!input.tipo_irpf && totals.cuota_irpf > 0

    // 4 — Imports dinámicos (server-only, no llegan al bundle del cliente)
    const [{ renderToBuffer }, { FacturaEmitidaPDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/pdfs/FacturaEmitidaPDF'),
    ])

    // 5 — Datos para el PDF
    const pdfData: FacturaPDFData = {
      numero_completo,
      serie:            input.serie,
      fecha_emision:    input.fecha_emision,
      fecha_operacion:  input.fecha_operacion ?? null,
      emisor_nombre:    input.emisor_nombre,
      emisor_nif:       input.emisor_nif,
      emisor_direccion: input.emisor_direccion,
      emisor_ciudad:    input.emisor_ciudad   ?? null,
      emisor_cp:        input.emisor_cp       ?? null,
      emisor_email:     input.emisor_email    ?? null,
      emisor_telefono:  input.emisor_telefono ?? null,
      cliente_nombre:   input.cliente_nombre,
      cliente_contacto: input.cliente_contacto ?? null,
      cliente_nif:      input.cliente_nif      ?? null,
      cliente_direccion:input.cliente_direccion ?? null,
      proyecto_nombre:  input.proyecto_nombre  ?? null,
      items:            input.items,
      tipo_iva:         input.tipo_iva,
      base_imponible:   totals.base_imponible,
      cuota_iva:        totals.cuota_iva,
      tipo_irpf:        input.tipo_irpf ?? null,
      cuota_irpf:       showIrpf ? totals.cuota_irpf : null,
      total:            totals.total,
      notas:            input.notas          ?? null,
      mencion_legal:    input.mencion_legal  ?? null,
      iban:             input.iban           ?? null,
      banco_nombre:     config?.banco_nombre ?? null,
      banco_swift:      config?.banco_swift  ?? null,
      forma_pago:       input.forma_pago     ?? null,
      condiciones_pago: input.condiciones_pago ?? null,
      es_rectificativa: input.es_rectificativa ?? false,
    }

    // 6 — Generar PDF
    const pdfBuffer = await renderToBuffer(createElement(FacturaEmitidaPDF, { data: pdfData }) as any)

    // 7 — Distribuir emails extra por tipo
    const valid = extraEmails.filter(e => e.email.trim())
    const toExtra  = valid.filter(e => e.tipo === 'to') .map(e => e.email.trim())
    const ccExtra  = valid.filter(e => e.tipo === 'cc') .map(e => e.email.trim())
    const bccExtra = valid.filter(e => e.tipo === 'bcc').map(e => e.email.trim())
    const cc  = [...PARTNERS_CC, ...ccExtra]
    const bcc = bccExtra

    // 8 — Cuerpo del email
    const clienteNombre = input.cliente_nombre

    const itemsRows = input.items.map(item => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;line-height:1.4;">${item.descripcion}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#888;text-align:right;white-space:nowrap;padding-left:16px;">${item.cantidad} × ${eur(item.precio_unitario)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;text-align:right;white-space:nowrap;padding-left:16px;font-weight:600;">${eur(item.subtotal)}</td>
      </tr>`).join('')

    const bodyHtml = `
      <p style="margin:0 0 22px;font-size:22px;font-weight:300;color:#1A1A1A;line-height:1.3;">
        Estimado/a ${clienteNombre},
      </p>

      <p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.75;">
        Nos complace enviarle adjunta la factura <strong style="color:#1A1A1A;">${numero_completo}</strong>${input.proyecto_nombre ? `, correspondiente al proyecto <strong style="color:#1A1A1A;">${input.proyecto_nombre}</strong>` : ''}.
        Encontrará el detalle completo en el documento PDF adjunto.
      </p>

      <!-- Tabla de conceptos -->
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

      <!-- Totales -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td width="45%"></td>
          <td>
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
              <tr>
                <td colspan="2" style="padding:4px 0 0;"><div style="height:1px;background:#E6E4DF;"></div></td>
              </tr>
              <tr>
                <td style="padding:10px 16px;background:#1A1A1A;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#F0EDE8;">Total a pagar</td>
                <td style="padding:10px 16px;background:#1A1A1A;font-size:17px;font-weight:700;color:#ffffff;text-align:right;letter-spacing:-0.3px;">${eur(totals.total)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Datos bancarios -->
      ${config?.iban ? `
      <div style="background:#F8F7F4;border-left:3px solid #D85A30;padding:16px 20px;margin-bottom:32px;">
        <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;">Datos de pago</p>
        ${config.banco_nombre ? `<p style="margin:0 0 5px;font-size:13px;color:#3A3A3A;font-weight:600;">${config.banco_nombre}</p>` : ''}
        <p style="margin:0 0 4px;font-size:13px;color:#555555;font-family:'Courier New',monospace;">IBAN: ${config.iban}</p>
        ${config.banco_swift ? `<p style="margin:0;font-size:12px;color:#888888;font-family:'Courier New',monospace;">SWIFT/BIC: ${config.banco_swift}</p>` : ''}
      </div>` : ''}

      <!-- CTA área de proyecto (placeholder) -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="#" style="display:inline-block;background:#D85A30;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-decoration:none;padding:14px 32px;border-radius:3px;">
          Acceder a mi área de proyecto &rarr;
        </a>
        <p style="margin:10px 0 0;font-size:11px;color:#AAAAAA;font-style:italic;">Disponible próximamente</p>
      </div>

      <p style="margin:0 0 6px;font-size:14px;color:#555555;line-height:1.75;">
        Quedamos a su disposición para cualquier consulta.
      </p>
      <p style="margin:0;font-size:14px;color:#555555;line-height:1.75;">
        Un cordial saludo,<br/>
        <strong style="color:#1A1A1A;">Equipo Forma Prima</strong>
      </p>
    `

    // 9 — Enviar email
    const toList = [emailCliente.trim(), ...toExtra].filter(Boolean)
    if (toList.length === 0) return { error: 'No hay destinatario de email.' }

    const emailResult = await sendEmail({
      to:      toList,
      cc,
      ...(bcc.length && { bcc }),
      subject: `Factura ${numero_completo}${input.proyecto_nombre ? ` — ${input.proyecto_nombre}` : ''}`,
      html:    wrapEmail(bodyHtml),
      attachments: [{
        filename: `Factura-${numero_completo}.pdf`,
        content:  pdfBuffer,
      }],
    })

    if (emailResult.error) {
      // Factura creada pero email fallido — informamos al usuario
      return { error: `Factura creada (${numero_completo}) pero el email no se pudo enviar: ${emailResult.error}` }
    }

    // 10 — Marcar como enviada
    await updateFacturaEmitidaEstado(id, 'enviada')

    return { id, numero_completo }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[emitirYEnviar]', msg)
    return { error: `Factura creada (${numero_completo}) pero ocurrió un error al generar/enviar: ${msg}` }
  }
}

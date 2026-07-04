import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { sendEmail, wrapEmail } from '@/lib/email'
import { esSeccionNoCliente } from '@/lib/finanzas/costs'
import { resolveProveedorDestino } from '@/lib/finanzas/proveedorDestino'
import type { ExtraEmail } from '@/app/actions/emitirFactura'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

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

    // El email del cliente solo se exige en facturas normales (no en márgenes a proveedor,
    // donde el destinatario se resuelve en servidor). Si se aporta, debe ser válido.
    if (emailCliente?.trim() && !EMAIL_RE.test(emailCliente.trim())) {
      return NextResponse.json({ error: 'Email del cliente inválido.' }, { status: 400 })
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

    // ── Márgenes internos: el reenvío va SIEMPRE al proveedor, nunca al cliente ─
    let seccionF: string | null = (f.seccion as string | null) ?? null
    if (!seccionF && f.factura_origen_id) {
      const { data: fSec } = await admin
        .from('facturas').select('seccion').eq('id', f.factura_origen_id).maybeSingle()
      seccionF = (fSec?.seccion as string | undefined) ?? null
    }
    const esPrivada = esSeccionNoCliente(seccionF)
    let proveedorDestino: Awaited<ReturnType<typeof resolveProveedorDestino>> = null
    if (esPrivada) {
      proveedorDestino = await resolveProveedorDestino(admin, {
        facturaOrigenId: f.factura_origen_id ?? null,
        proyectoId:      f.proyecto_id ?? null,
        seccion:         seccionF,
      })
      if (!proveedorDestino?.email) {
        return NextResponse.json({
          error: 'El proveedor de esta factura no tiene email registrado. Añádelo en Proveedores para poder enviársela.',
        }, { status: 422 })
      }
    } else if (!emailCliente?.trim()) {
      return NextResponse.json({ error: 'Email del cliente requerido.' }, { status: 400 })
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

    // ── Partners CC ──────────────────────────────────────────────────────────
    // Solo fp_partner: facturación es información sensible que NO debe llegar a managers
    const { data: partnerProfiles } = await admin
      .from('profiles').select('email').eq('rol', 'fp_partner')
    const PARTNERS_CC = (partnerProfiles ?? []).map((p: { email: string }) => p.email).filter(Boolean)

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
    const valid    = (extraEmails ?? []).filter(e => e.email.trim())
    const toExtra  = valid.filter(e => e.tipo === 'to') .map(e => e.email.trim())
    const ccExtra  = valid.filter(e => e.tipo === 'cc') .map(e => e.email.trim())
    const bccExtra = valid.filter(e => e.tipo === 'bcc').map(e => e.email.trim())

    const adicionales  = clientesAdicionales ?? []
    const toAdicional  = adicionales.map(c => c.email).filter((e): e is string => !!e?.trim()).map(e => e.trim())
    const ccAdicional  = adicionales.map(c => c.email_cc).filter((e): e is string => !!e?.trim()).map(e => e.trim())

    // Márgenes internos: SOLO al proveedor (nunca cliente ni clientes adicionales).
    const toList = esPrivada
      ? [proveedorDestino!.email!.trim()]
      : [emailCliente.trim(), ...toExtra, ...toAdicional].filter(Boolean)
    const cc     = esPrivada
      ? [...PARTNERS_CC, ...(proveedorDestino!.emailCc ? [proveedorDestino!.emailCc.trim()] : [])]
      : [...PARTNERS_CC, ...ccExtra, ...ccAdicional]
    const bcc    = esPrivada ? [] : bccExtra

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

    // ── Items table ───────────────────────────────────────────────────────────
    const itemsRows = (f.items as { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[]).map(item => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;line-height:1.4;">${item.descripcion}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#888;text-align:right;white-space:nowrap;padding-left:16px;">${item.cantidad} × ${eur(item.precio_unitario)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;text-align:right;white-space:nowrap;padding-left:16px;font-weight:600;">${eur(item.subtotal)}</td>
      </tr>`).join('')

    const showIrpf = !!f.tipo_irpf && f.cuota_irpf > 0

    // ── Email body ────────────────────────────────────────────────────────────
    const cuerpoIntroHtml = cuerpoIntro?.trim()
      ? `<p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.75;">${cuerpoIntro.trim()}</p>`
      : ''

    const bodyHtml = `
      <p style="margin:0 0 22px;font-size:22px;font-weight:300;color:#1A1A1A;line-height:1.3;">Estimado/a ${saludoNombre},</p>

      ${cuerpoIntroHtml}

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
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">${eur(f.base_imponible)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">IVA (${f.tipo_iva}%)</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">${eur(f.cuota_iva)}</td>
            </tr>
            ${showIrpf ? `
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">Retención IRPF (${f.tipo_irpf}%)</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">−${eur(f.cuota_irpf)}</td>
            </tr>` : ''}
            <tr><td colspan="2" style="padding:4px 0 0;"><div style="height:1px;background:#E6E4DF;"></div></td></tr>
            <tr>
              <td style="padding:10px 16px;background:#1A1A1A;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#F0EDE8;">Total a pagar</td>
              <td style="padding:10px 16px;background:#1A1A1A;font-size:17px;font-weight:700;color:#ffffff;text-align:right;letter-spacing:-0.3px;">${eur(f.total)}</td>
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

      ${includeCTA && f.proyecto_id && !esPrivada ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="background:#1A1A1A;padding:24px 28px;">
            <div style="height:2px;background:#D85A30;margin-bottom:20px;opacity:0.7;"></div>
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#666060;">Área de cliente</p>
            <p style="margin:0 0 18px;font-size:15px;font-weight:300;color:#F0EDE8;line-height:1.5;">Consulta el avance de tu proyecto,<br/>documentación y facturas en un solo lugar.</p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.formaprima.es'}/portal/${f.proyecto_id}" style="display:inline-block;background:#D85A30;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;padding:12px 28px;">
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

    // ── Send ──────────────────────────────────────────────────────────────────
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

    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reenviar/route]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

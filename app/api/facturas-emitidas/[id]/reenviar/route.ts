import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'
import { FacturaEmitidaPDF } from '@/components/pdfs/FacturaEmitidaPDF'
import type { FacturaPDFData } from '@/components/pdfs/FacturaEmitidaPDF'
import { sendEmail, wrapEmail, type ExtraEmail } from '@/lib/email'
import { esFacturaNoCliente } from '@/lib/finanzas/costs'
import { resolveProveedorDestino } from '@/lib/finanzas/proveedorDestino'
import { assertSinClientesEnDestinatarios, ClienteEnDestinatariosError } from '@/lib/finanzas/guardCliente'
import { getPartnersCC, repartirDestinatarios } from '@/lib/email/destinatarios'
import { buildFacturaEmailBody } from '@/lib/email/facturaBody'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

    // ── Facturas a proveedor: el reenvío va SIEMPRE al proveedor, nunca al cliente ─
    // Lo decide el destinatario, no solo la sección (un rappel de mobiliario está
    // en una sección pública y tampoco puede salir hacia el cliente).
    let seccionF: string | null = (f.seccion as string | null) ?? null
    let proveedorF: string | null = (f.proveedor_id as string | null) ?? null
    if (f.factura_origen_id && (!seccionF || !proveedorF)) {
      const { data: fRow } = await admin
        .from('facturas').select('seccion, proveedor_id').eq('id', f.factura_origen_id).maybeSingle()
      seccionF   = seccionF   ?? ((fRow?.seccion as string | undefined) ?? null)
      proveedorF = proveedorF ?? ((fRow?.proveedor_id as string | undefined) ?? null)
    }
    const esPrivada = esFacturaNoCliente({
      seccion:      seccionF,
      proveedorId:  proveedorF,
      receptorTipo: f.receptor_tipo as string | null,
    })
    let proveedorDestino: Awaited<ReturnType<typeof resolveProveedorDestino>> = null
    if (esPrivada) {
      proveedorDestino = await resolveProveedorDestino(admin, {
        facturaOrigenId: f.factura_origen_id ?? null,
        proyectoId:      f.proyecto_id ?? null,
        seccion:         seccionF,
        proveedorId:     proveedorF,
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
    const valid    = (extraEmails ?? []).filter(e => e.email.trim())
    const toExtra  = valid.filter(e => e.tipo === 'to') .map(e => e.email.trim())
    const ccExtra  = valid.filter(e => e.tipo === 'cc') .map(e => e.email.trim())
    const bccExtra = valid.filter(e => e.tipo === 'bcc').map(e => e.email.trim())

    const adicionales  = clientesAdicionales ?? []
    const toAdicional  = adicionales.map(c => c.email).filter((e): e is string => !!e?.trim()).map(e => e.trim())
    const ccAdicional  = adicionales.map(c => c.email_cc).filter((e): e is string => !!e?.trim()).map(e => e.trim())

    // Facturas a proveedor: SOLO al proveedor (nunca cliente ni clientes adicionales).
    const { to: toList, cc, bcc } = repartirDestinatarios(
      esPrivada
        ? {
            to:  [proveedorDestino!.email],
            cc:  [...PARTNERS_CC, proveedorDestino!.emailCc],
            bcc: [],
          }
        : {
            to:  [emailCliente, ...toExtra, ...toAdicional],
            cc:  [...PARTNERS_CC, ...ccExtra, ...ccAdicional],
            bcc: bccExtra,
          }
    )

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

    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reenviar/route]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

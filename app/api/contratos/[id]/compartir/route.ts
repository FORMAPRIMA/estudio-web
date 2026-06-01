import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratoPDF } from '@/components/pdfs/ContratoPDF'
import type { ContratoPDFData, ServicioContrato, ContratoHonorario } from '@/components/pdfs/ContratoPDF'
import { sendEmail, wrapEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json() as {
      emails:    string[]
      pdfLang:   'es' | 'en' | 'both'
      emailLang: 'es' | 'en'
    }

    if (!body.emails?.length) {
      return NextResponse.json({ error: 'No hay destinatarios.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch contract
    const { data: contrato, error: contratoErr } = await admin
      .from('contratos')
      .select('*')
      .eq('id', params.id)
      .single()
    if (contratoErr || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
    }

    // ¿El contacto del contrato tiene un Espacio? → notificación con link, sin adjunto.
    type EspacioLink = { id: string; token: string; etapa: string }
    let espacioRow: EspacioLink | null = null
    if (contrato.lead_id) {
      const { data } = await admin
        .from('espacios').select('id, token, etapa')
        .eq('lead_id', contrato.lead_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      espacioRow = (data as EspacioLink | null)
    }
    if (!espacioRow && contrato.cliente_id) {
      const { data } = await admin
        .from('espacios').select('id, token, etapa')
        .eq('cliente_id', contrato.cliente_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      espacioRow = (data as EspacioLink | null)
    }

    // Fetch plantilla EN translations
    const { data: plantillaRows } = await admin
      .from('propuestas_servicios_plantilla')
      .select('id, label_en, texto_en, entregables_en, semanas_default_en, pago_en, notas_en')

    const plantilla_en: NonNullable<ContratoPDFData['plantilla_en']> = {}
    for (const row of (plantillaRows ?? [])) {
      plantilla_en[row.id] = {
        label_en:           row.label_en,
        texto_en:           row.texto_en,
        entregables_en:     row.entregables_en,
        semanas_default_en: row.semanas_default_en,
        pago_en:            row.pago_en,
        notas_en:           row.notas_en,
      }
    }

    const serviciosContrato: ServicioContrato[] = (contrato.contenido?.servicios ?? []) as ServicioContrato[]
    const honorarios: ContratoHonorario[]       = (contrato.honorarios ?? []) as ContratoHonorario[]

    const baseData: Omit<ContratoPDFData, 'lang'> = {
      numero:             contrato.numero ?? '—',
      fecha_contrato:     contrato.fecha_contrato ?? null,
      tipo_cliente:       (contrato.contenido?.tipo_cliente ?? (contrato.cliente_empresa ? 'juridica' : 'fisica')) as 'fisica' | 'juridica',
      cliente_nombre:     contrato.cliente_nombre    ?? null,
      cliente_apellidos:  contrato.cliente_apellidos ?? null,
      cliente_empresa:    contrato.cliente_empresa   ?? null,
      cliente_nif:        contrato.cliente_nif       ?? null,
      cliente_direccion:  contrato.cliente_direccion ?? null,
      cliente_ciudad:     contrato.cliente_ciudad    ?? null,
      proyecto_nombre:    contrato.proyecto_nombre   ?? null,
      proyecto_direccion: contrato.proyecto_direccion ?? null,
      proyecto_tipo:      contrato.proyecto_tipo     ?? null,
      servicios_contrato: serviciosContrato,
      honorarios,
      notas:              contrato.notas ?? null,
      plantilla_en,
    }

    // Always use personal name, not company name
    const clientName = [contrato.cliente_nombre, contrato.cliente_apellidos].filter(Boolean).join(' ') || 'Cliente'
    const projectLabel = contrato.proyecto_nombre
      ? (body.emailLang === 'en' ? ` for ${contrato.proyecto_nombre}` : ` para el proyecto ${contrato.proyecto_nombre}`)
      : ''
    const en = body.emailLang === 'en'

    let attachments: { filename: string; content: Buffer }[] | undefined
    let emailBody: string
    let subject: string

    if (espacioRow) {
      // Todo en la plataforma: link al Espacio (ya en etapa Contrato), sin adjunto.
      const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'}/espacio/${espacioRow.token}`
      attachments = undefined
      emailBody = en
        ? `
          <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">Your contract is ready</h2>
          <p style="font-size:13px;color:#555;margin:0 0 24px;line-height:1.6;">
            Dear ${clientName},<br/><br/>
            We have prepared your contract${projectLabel}. You can review it —and see your fee proposal
            archived in your history— in your personal space:
          </p>
          <p style="margin:0 0 24px;">
            <a href="${link}" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:500;">View my contract</a>
          </p>
          <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">Kind regards,<br/><strong>The Forma Prima team</strong></p>
        `
        : `
          <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">Tu contrato está listo</h2>
          <p style="font-size:13px;color:#555;margin:0 0 24px;line-height:1.6;">
            Estimado/a ${clientName},<br/><br/>
            Hemos preparado tu contrato${projectLabel}. Puedes revisarlo —y consultar tu propuesta de
            honorarios archivada en el histórico— en tu espacio personal:
          </p>
          <p style="margin:0 0 24px;">
            <a href="${link}" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:500;">Ver mi contrato</a>
          </p>
          <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">Atentamente,<br/><strong>El equipo de Forma Prima</strong></p>
        `
      subject = en ? `Tu contrato está listo` : `Tu contrato está listo`

      // Asegurar que el Espacio está en la etapa Contrato.
      const ORDER = ['bienvenida', 'propuesta', 'formalizacion', 'contrato', 'proyecto']
      if (ORDER.indexOf(espacioRow.etapa) < ORDER.indexOf('contrato')) {
        await admin
          .from('espacios')
          .update({ etapa: 'contrato', etapa_contrato_at: new Date().toISOString() })
          .eq('id', espacioRow.id)
      }
    } else {
      // Legacy: adjuntar el PDF del contrato.
      attachments = []
      const langs: ('es' | 'en')[] = body.pdfLang === 'both' ? ['es', 'en'] : [body.pdfLang]
      for (const lang of langs) {
        const pdfBuffer = await renderToBuffer(
          createElement(ContratoPDF, { data: { ...baseData, lang } }) as any
        )
        attachments.push({
          filename: `Contrato-${contrato.numero ?? params.id}${langs.length > 1 ? `-${lang.toUpperCase()}` : ''}.pdf`,
          content:  Buffer.from(pdfBuffer),
        })
      }
      emailBody = en
        ? `
          <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">Your contract is ready</h2>
          <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
            Dear ${clientName},<br/><br/>
            Please find attached your contract <strong>${contrato.numero}</strong>${projectLabel},
            including the full scope of services, deliverables, and economic conditions.
          </p>
          <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">Kind regards,<br/><strong>The Forma Prima team</strong></p>
        `
        : `
          <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">Su contrato está listo</h2>
          <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
            Estimado/a ${clientName},<br/><br/>
            Adjunto encontrará el contrato <strong>${contrato.numero}</strong>${projectLabel},
            con el detalle completo de los servicios, entregables y condiciones económicas acordadas.
          </p>
          <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">Atentamente,<br/><strong>El equipo de Forma Prima</strong></p>
        `
      subject = `${en ? 'Contract' : 'Contrato'} ${contrato.numero}${contrato.proyecto_nombre ? ` · ${contrato.proyecto_nombre}` : ''}`
    }

    const [primaryEmail, ...ccEmails] = body.emails
    const result = await sendEmail({
      to:          primaryEmail,
      cc:          ccEmails.length ? ccEmails : undefined,
      subject,
      html:        wrapEmail(emailBody),
      attachments,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Update status to 'enviado' if still borrador
    if (contrato.status === 'borrador') {
      await admin
        .from('contratos')
        .update({ status: 'enviado', fecha_envio: new Date().toISOString().split('T')[0] })
        .eq('id', params.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contratos/compartir]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

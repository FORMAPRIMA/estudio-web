import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DueDiligenciaPDF } from '@/components/pdfs/DueDiligenciaPDF'
import type { DueDiligenciaPDFData } from '@/components/pdfs/DueDiligenciaPDF'
import { sendEmail, wrapEmail } from '@/lib/email'

interface EnviarPayload extends DueDiligenciaPDFData {
  email_to:  string[]
  email_cc?: string[]
}

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

    const body = await req.json() as EnviarPayload
    const { email_to, email_cc, ...pdfData } = body

    if (!email_to || email_to.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un destinatario.' }, { status: 400 })
    }

    const honorarios = pdfData.superficie * pdfData.tarifa_m2
    const fmtEur = (n: number) =>
      new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

    // Generate PDF
    const buffer = await renderToBuffer(
      createElement(DueDiligenciaPDF, { data: pdfData }) as any
    )

    // Build email body
    const body_html = `
      <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">
        Due Diligence Técnica — ${pdfData.nombre_proyecto}
      </h2>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Estimado/a cliente,<br/><br/>
        Adjunto encontrará la propuesta de servicios de <strong>Due Diligence Técnica No Invasiva</strong>
        para el activo residencial ubicado en <strong>${pdfData.nombre_proyecto}</strong>,
        ${pdfData.ciudad}, con una superficie estimada de análisis de
        <strong>${pdfData.superficie} m²</strong>.
      </p>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Los honorarios propuestos ascienden a <strong>${fmtEur(honorarios)}</strong>
        (${fmtEur(pdfData.tarifa_m2)}/m²), abonables en dos hitos iguales:
        aceptación de la propuesta y entrega del informe final.
      </p>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Quedamos a su disposición para cualquier consulta o para concertar una reunión
        de presentación.
      </p>
      <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">
        Atentamente,<br/>
        <strong>El equipo de Forma Prima</strong>
      </p>
    `

    const filename = `DD-Tecnica-${pdfData.nombre_proyecto.replace(/\s+/g, '-')}.pdf`

    const result = await sendEmail({
      to:      email_to,
      cc:      email_cc && email_cc.length > 0 ? email_cc : undefined,
      subject: `Due Diligence Técnica — ${pdfData.nombre_proyecto} · Forma Prima`,
      html:    wrapEmail(body_html),
      attachments: [{ filename, content: buffer }],
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, emailId: result.id })
  } catch (err) {
    console.error('[due-diligencia/enviar]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

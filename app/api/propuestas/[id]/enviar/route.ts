import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PropuestaPDF } from '@/components/pdfs/PropuestaPDF'
import type { PropuestaPDFData } from '@/components/pdfs/PropuestaPDF'
import { sendEmail, wrapEmail } from '@/lib/email'
import type { ServicioId } from '@/lib/propuestas/config'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'

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
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Fetch propuesta
    const { data: propuesta } = await admin
      .from('propuestas')
      .select('*')
      .eq('id', params.id)
      .single()
    if (!propuesta) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

    // Fetch lead
    let lead: PropuestaPDFData['lead'] = null
    if (propuesta.lead_id) {
      const { data: leadRow } = await admin
        .from('leads')
        .select('nombre, apellidos, empresa, email, telefono, direccion')
        .eq('id', propuesta.lead_id)
        .single()
      lead = leadRow ?? null
    }

    if (!lead?.email) {
      return NextResponse.json({ error: 'El lead no tiene email registrado.' }, { status: 400 })
    }

    // Fetch plantilla and ratios in parallel
    const [serviciosPlantilla, { data: ratiosFases }] = await Promise.all([
      getPlantillaServicios(),
      admin
        .from('catalogo_fases')
        .select('id, label, seccion, ratio')
        .eq('seccion', 'Interiorismo')
        .order('orden'),
    ])

    const ratios = (ratiosFases ?? []).map(r => ({
      label:    r.label,
      servicio: 'interiorismo' as ServicioId,
      ratio:    r.ratio ?? 0,
    }))

    const pdfData: PropuestaPDFData = {
      numero:              propuesta.numero,
      titulo:              propuesta.titulo ?? null,
      fecha_propuesta:     propuesta.fecha_propuesta ?? new Date().toISOString().split('T')[0],
      direccion:           propuesta.direccion ?? null,
      notas:               propuesta.notas ?? null,
      servicios:           (propuesta.servicios ?? []) as ServicioId[],
      m2:                  propuesta.m2_diseno ?? 0,
      costo_m2:            propuesta.costo_m2_objetivo ?? 0,
      porcentaje_pem:      propuesta.porcentaje_pem ?? 10,
      pct_junior:          propuesta.pct_junior ?? 0,
      pct_senior:          propuesta.pct_senior ?? 70,
      pct_partner:         propuesta.pct_partner ?? 30,
      semanas:             (propuesta.semanas ?? {}) as Record<string, string>,
      honorarios_override: (propuesta.honorarios_override ?? {}) as Record<string, number>,
      serviciosPlantilla,
      ratios,
      lead,
    }

    // Generate PDF
    const buffer = await renderToBuffer(createElement(PropuestaPDF, { data: pdfData }) as any)

    // Send email
    const clientName = lead.empresa ?? `${lead.nombre} ${lead.apellidos}`
    const body = `
      <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">
        Propuesta de honorarios${propuesta.titulo ? ` — ${propuesta.titulo}` : ''}
      </h2>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Estimado/a ${clientName},<br/><br/>
        Adjunto encontrará nuestra propuesta de honorarios <strong>${propuesta.numero}</strong>
        con el detalle de servicios, entregables y condiciones económicas.
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

    const result = await sendEmail({
      to:      lead.email,
      subject: `Propuesta de honorarios ${propuesta.numero}${propuesta.titulo ? ` · ${propuesta.titulo}` : ''}`,
      html:    wrapEmail(body),
      attachments: [{
        filename: `Propuesta-${propuesta.numero}.pdf`,
        content:  buffer,
      }],
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Mark as enviada
    await admin
      .from('propuestas')
      .update({ status: 'enviada', fecha_envio: new Date().toISOString().split('T')[0] })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, emailId: result.id })
  } catch (err) {
    console.error('[propuestas/enviar]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

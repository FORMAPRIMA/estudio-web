import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PropuestaPDF } from '@/components/pdfs/PropuestaPDF'
import type { PropuestaPDFData } from '@/components/pdfs/PropuestaPDF'
import { sendEmail, wrapEmail } from '@/lib/email'
import type { ServicioId } from '@/lib/propuestas/config'
import { mapInteriorismoRatios } from '@/lib/propuestas/build'
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
      .from('profiles').select('rol, email').eq('id', user.id).single()
    if (!profile || !['fp_manager', 'fp_partner', 'fp_biz_dev'].includes(profile.rol)) {
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

    // No enviar propuestas vacías: sin servicios el PDF y el portal salen en blanco.
    if (!Array.isArray(propuesta.servicios) || propuesta.servicios.length === 0) {
      return NextResponse.json(
        { error: 'La propuesta no tiene servicios; complétala antes de enviar.' },
        { status: 400 }
      )
    }

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

    const ratios = mapInteriorismoRatios(ratiosFases ?? [])

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

    const clientName = [lead.nombre, lead.apellidos].filter(Boolean).join(' ') || lead.empresa || 'Cliente'
    // Nunca exponer "BORRADOR" al cliente: si no hay número real, se omite.
    const numeroLabel = propuesta.numero && propuesta.numero !== 'BORRADOR' ? propuesta.numero : ''

    // ¿El lead tiene un Espacio? → notificación con link (sin adjunto) + avanzar etapa.
    const { data: espacioRow } = await admin
      .from('espacios')
      .select('id, token, etapa')
      .eq('lead_id', propuesta.lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ETAPA_ORDER = ['bienvenida', 'propuesta', 'formalizacion', 'contrato', 'proyecto']
    let body: string
    let attachments: { filename: string; content: Buffer }[] | undefined

    if (espacioRow) {
      const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/espacio/${espacioRow.token}`
      body = `
        <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">
          Tu propuesta de honorarios está lista
        </h2>
        <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
          Estimado/a ${clientName},<br/><br/>
          Hemos preparado tu propuesta de honorarios${numeroLabel ? ` <strong>${numeroLabel}</strong>` : ''}. Puedes verla
          con todo el detalle de servicios, plazos y condiciones —y descargarla en PDF— en tu espacio personal:
        </p>
        <p style="margin:0 0 24px;">
          <a href="${link}" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:500;">
            Ver mi propuesta
          </a>
        </p>
        <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">
          Atentamente,<br/>
          <strong>El equipo de Forma Prima</strong>
        </p>
      `
      attachments = undefined

      // Avanzar la etapa del Espacio a "propuesta" (sin retroceder si ya está más avanzado).
      if (ETAPA_ORDER.indexOf(espacioRow.etapa as string) < ETAPA_ORDER.indexOf('propuesta')) {
        await admin
          .from('espacios')
          .update({ etapa: 'propuesta', etapa_propuesta_at: new Date().toISOString() })
          .eq('id', espacioRow.id)
      }
    } else {
      // Legacy: adjuntar el PDF (leads sin Espacio).
      const buffer = await renderToBuffer(createElement(PropuestaPDF, { data: pdfData }) as any)
      body = `
        <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">
          Propuesta de honorarios${propuesta.titulo ? ` — ${propuesta.titulo}` : ''}
        </h2>
        <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
          Estimado/a ${clientName},<br/><br/>
          Adjunto encontrará nuestra propuesta de honorarios${numeroLabel ? ` <strong>${numeroLabel}</strong>` : ''}
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
      attachments = [{ filename: `Propuesta-${numeroLabel || 'Forma-Prima'}.pdf`, content: buffer }]
    }

    // Build internal CC list:
    // - Partner sends → CC all partners (sender included as they're a partner)
    // - Manager sends → CC sender + all partners
    const { data: partnerProfiles } = await admin
      .from('profiles')
      .select('email')
      .eq('rol', 'fp_partner')

    const partnerEmails = (partnerProfiles ?? []).map(p => p.email).filter(Boolean) as string[]
    const ccEmails: string[] = profile.rol === 'fp_manager'
      ? Array.from(new Set([profile.email, ...partnerEmails].filter((e): e is string => !!e)))
      : partnerEmails

    const result = await sendEmail({
      to:      lead.email,
      cc:      ccEmails.length ? ccEmails : undefined,
      subject: `Propuesta de honorarios${numeroLabel ? ` ${numeroLabel}` : ''}${propuesta.titulo ? ` · ${propuesta.titulo}` : ''}`,
      html:    wrapEmail(body),
      attachments,
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

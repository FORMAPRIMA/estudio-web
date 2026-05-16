import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'

const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'
const TEAM_EMAIL = 'contacto@formaprima.es'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { token: string; pregunta: string; project_unit_id?: string | null }

    if (!body.token || !body.pregunta?.trim()) {
      return NextResponse.json({ error: 'Token y pregunta son requeridos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── Verify token ──────────────────────────────────────────────────────────
    const { data: inv, error: invErr } = await admin
      .from('fpe_tender_invitations')
      .select(`
        id, status, token_expires_at, tender_id, scope_unit_ids,
        partner:fpe_partners ( nombre, email_contacto ),
        tender:fpe_tenders (
          status,
          project:fpe_projects ( nombre )
        )
      `)
      .eq('token', body.token)
      .single()

    if (invErr || !inv) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    if (['revoked', 'expired'].includes(inv.status as string))
      return NextResponse.json({ error: 'Invitación revocada o expirada.' }, { status: 403 })
    if (new Date(inv.token_expires_at as string) < new Date())
      return NextResponse.json({ error: 'El enlace ha expirado.' }, { status: 403 })

    const partner = inv.partner as unknown as { nombre: string; email_contacto: string | null }
    const tender  = inv.tender  as unknown as { status: string; project: { nombre: string } }

    // ── Validate project_unit_id (si viene) está en scope ─────────────────────
    const scopeUnitIds: string[] = (inv.scope_unit_ids as string[] | null) ?? []
    const projectUnitId = body.project_unit_id ?? null
    if (projectUnitId && !scopeUnitIds.includes(projectUnitId)) {
      return NextResponse.json(
        { error: 'La unidad seleccionada no pertenece a tu alcance.' },
        { status: 403 },
      )
    }

    // ── Insert question ───────────────────────────────────────────────────────
    const { data: question, error: qErr } = await admin
      .from('fpe_tender_questions')
      .insert({
        tender_id:       inv.tender_id,
        invitation_id:   inv.id,
        partner_nombre:  partner.nombre,
        pregunta:        body.pregunta.trim(),
        project_unit_id: projectUnitId,
      })
      .select('id, partner_nombre, pregunta, asked_at, respuesta, answered_at, answered_by_name, project_unit_id, invitation_id')
      .single()

    if (qErr || !question)
      return NextResponse.json({ error: qErr?.message ?? 'Error al registrar la pregunta.' }, { status: 500 })

    // ── Resolve unit label (si aplica) para el email al team ──────────────────
    let unitLabel: string | null = null
    if (projectUnitId) {
      const { data: pu } = await admin
        .from('fpe_project_units')
        .select('template_unit:fpe_template_units(nombre)')
        .eq('id', projectUnitId)
        .single()
      const tu = (pu?.template_unit as unknown as { nombre: string } | null) ?? null
      unitLabel = tu?.nombre ?? null
    }

    // ── Notify team ───────────────────────────────────────────────────────────
    await sendEmail({
      to:      TEAM_EMAIL,
      subject: `Nueva consulta de ${partner.nombre} — ${tender.project.nombre}`,
      html:    wrapEmail(`
        <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
          Nueva consulta en licitación
        </h2>
        <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.7;">
          <strong>${partner.nombre}</strong> ha enviado una consulta sobre el proyecto
          <strong>${tender.project.nombre}</strong>${unitLabel ? ` — unidad <strong>${unitLabel}</strong>` : ' (pregunta general)'}:
        </p>
        <div style="border-left:3px solid #1A1A1A;padding:12px 16px;background:#F8F7F4;margin:0 0 24px;border-radius:0 4px 4px 0;">
          <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${body.pregunta.trim()}</p>
        </div>
        <a href="${SITE_URL}/team/fp-execution/projects" style="display:inline-block;background:#1A1A1A;color:#fff;padding:10px 24px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600;">
          Responder en el portal interno →
        </a>
        <p style="margin:18px 0 0;font-size:11px;color:#AAA;line-height:1.5;">
          Al responder, la pregunta y la respuesta se compartirán de forma anónima con todos los partners
          que estén presupuestando ${unitLabel ? 'esa misma unidad' : 'este proyecto'}.
        </p>
      `),
    })

    return NextResponse.json({ ok: true, question })
  } catch (err) {
    console.error('[fpe-portal/question]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, { status: 500 })
  }
}

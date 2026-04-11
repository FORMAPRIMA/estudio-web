import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      token:       string
      notas?:      string | null
      line_items:  { project_line_item_id: string; precio_unitario: number; notas?: string | null }[]
    }

    if (!body.token) return NextResponse.json({ error: 'Token requerido.' }, { status: 400 })

    const admin = createAdminClient()

    // ── Verify token ──────────────────────────────────────────────────────────
    const { data: inv, error: invErr } = await admin
      .from('fpe_tender_invitations')
      .select(`
        id, status, token_expires_at, tender_id,
        partner:fpe_partners ( nombre ),
        tender:fpe_tenders (
          id,
          project:fpe_projects ( id, nombre )
        )
      `)
      .eq('token', body.token)
      .single()

    if (invErr || !inv) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    if (inv.status === 'revoked')  return NextResponse.json({ error: 'Esta invitación ha sido revocada.' }, { status: 403 })
    if (inv.status === 'expired')  return NextResponse.json({ error: 'Esta invitación ha expirado.' }, { status: 403 })
    if (new Date(inv.token_expires_at) < new Date()) {
      await admin.from('fpe_tender_invitations').update({ status: 'expired' }).eq('id', inv.id)
      return NextResponse.json({ error: 'El enlace de invitación ha expirado.' }, { status: 403 })
    }

    // ── Verify tender is still open ──────────────────────────────────────────
    const { data: tender } = await admin
      .from('fpe_tenders')
      .select('status, fecha_limite')
      .eq('id', inv.tender_id)
      .single()

    if (!tender || tender.status === 'closed' || tender.status === 'cancelled') {
      return NextResponse.json({ error: 'La licitación ya está cerrada.' }, { status: 403 })
    }
    if (new Date(tender.fecha_limite) < new Date()) {
      return NextResponse.json({ error: 'El plazo de presentación de ofertas ha finalizado.' }, { status: 403 })
    }

    // ── Upsert bid ────────────────────────────────────────────────────────────
    const { data: existingBid } = await admin
      .from('fpe_bids')
      .select('id')
      .eq('invitation_id', inv.id)
      .single()

    let bid_id: string

    if (existingBid) {
      bid_id = existingBid.id
      await admin
        .from('fpe_bids')
        .update({ notas: body.notas ?? null, status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', bid_id)
    } else {
      const { data: newBid, error: bidErr } = await admin
        .from('fpe_bids')
        .insert({
          invitation_id: inv.id,
          notas:         body.notas ?? null,
          status:        'submitted',
          submitted_at:  new Date().toISOString(),
        })
        .select('id')
        .single()
      if (bidErr || !newBid) return NextResponse.json({ error: bidErr?.message ?? 'Error creando oferta.' }, { status: 500 })
      bid_id = newBid.id
    }

    // ── Upsert line items ─────────────────────────────────────────────────────
    if (body.line_items.length > 0) {
      // Delete old line items and re-insert
      await admin.from('fpe_bid_line_items').delete().eq('bid_id', bid_id)
      const { error: liErr } = await admin
        .from('fpe_bid_line_items')
        .insert(
          body.line_items.map(li => ({
            bid_id,
            project_line_item_id: li.project_line_item_id,
            precio_unitario:      li.precio_unitario,
            notas:                li.notas ?? null,
          }))
        )
      if (liErr) return NextResponse.json({ error: liErr.message }, { status: 500 })
    }

    // ── Update invitation status ──────────────────────────────────────────────
    await admin
      .from('fpe_tender_invitations')
      .update({ status: 'bid_submitted', bid_submitted_at: new Date().toISOString() })
      .eq('id', inv.id)

    // ── Notify FP team (fire-and-forget) ─────────────────────────────────────
    try {
      const partner = inv.partner as unknown as { nombre: string }
      const tender  = inv.tender  as unknown as { id: string; project: { id: string; nombre: string } }
      const projectUrl = `${SITE_URL}/team/fp-execution/projects/${tender.project.id}`
      const submittedAt = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

      await sendEmail({
        to:      'contacto@formaprima.es',
        subject: `Nueva oferta — ${tender.project.nombre}`,
        html:    wrapEmail(`
          <h2 style="font-size:18px;font-weight:600;color:#1A1A1A;margin:0 0 16px;">
            Nueva oferta recibida
          </h2>
          <div style="border-left:3px solid #059669;padding:14px 20px;background:#F0FDF4;margin:0 0 24px;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#1A1A1A;">${partner.nombre}</p>
            <p style="margin:0;font-size:13px;color:#555;">ha enviado su oferta para <strong>${tender.project.nombre}</strong></p>
          </div>
          <p style="font-size:13px;color:#888;margin:0 0 24px;">
            Recibida el ${submittedAt} · ${body.line_items.length} partida${body.line_items.length !== 1 ? 's' : ''} cotizada${body.line_items.length !== 1 ? 's' : ''}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0;">
            <tr>
              <td style="background:#1A1A1A;border-radius:5px;padding:10px 24px;">
                <a href="${projectUrl}" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;display:block;">
                  Ver proyecto y comparar ofertas →
                </a>
              </td>
            </tr>
          </table>
        `),
      })
    } catch {
      // Do not block the response if notification fails
    }

    return NextResponse.json({ ok: true, bid_id })
  } catch (err) {
    console.error('[fpe-portal/bid]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, { status: 500 })
  }
}

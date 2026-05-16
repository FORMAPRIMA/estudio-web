import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'

// Días previos al deadline en los que se envía recordatorio.
const REMINDER_DAYS = [3, 1]
// Días desde sent_at sin que el partner haya abierto → empujón temprano.
const EARLY_NUDGE_DAYS = 5

type PartnerLite = { nombre: string; email_notificaciones: string | null; email_contacto: string | null }

type RawInv = {
  id:               string
  token:            string
  status:           string
  token_expires_at: string
  sent_at:          string | null
  viewed_at:        string | null
  partner:          PartnerLite
  bid:              { status: string; line_items: { precio_unitario: number }[] }[] | null
}

type RawTender = {
  id:           string
  fecha_limite: string
  project:      { nombre: string }
  invitations:  RawInv[]
}

type ReminderKind = 'no_abierto' | 'abierto_sin_bid' | 'parcial_con_borrador' | 'nudge_temprano'

function pickKind(inv: RawInv): ReminderKind {
  if (!inv.viewed_at) return 'no_abierto'
  const draft = inv.bid?.[0]
  if (!draft) return 'abierto_sin_bid'
  const hasPrice = (draft.line_items ?? []).some(li => Number(li.precio_unitario) > 0)
  if (draft.status === 'draft' && hasPrice) return 'parcial_con_borrador'
  return 'abierto_sin_bid'
}

function renderHtml(kind: ReminderKind, partnerNombre: string, projectNombre: string, deadlineLabel: string, daysMsg: string, portalUrl: string): { subject: string; html: string } {
  const buttonRow = `
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#1A1A1A;border-radius:5px;padding:12px 28px;">
          <a href="${portalUrl}" style="color:#fff;font-size:13px;font-weight:600;text-decoration:none;display:block;">
            Acceder al portal de licitación →
          </a>
        </td>
      </tr>
    </table>`
  const footer = `
    <p style="font-size:11px;color:#AAA;margin:0;line-height:1.6;">
      Consultas: <a href="mailto:contacto@formaprima.es" style="color:#D85A30;">contacto@formaprima.es</a>
    </p>`

  switch (kind) {
    case 'nudge_temprano':
      return {
        subject: `Pendiente de abrir: licitación ${projectNombre}`,
        html: wrapEmail(`
          <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
            Aún no has abierto la invitación
          </h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.7;">
            Estimado/a <strong>${partnerNombre}</strong>,<br/><br/>
            Te hemos enviado una invitación para presupuestar el proyecto
            <strong>${projectNombre}</strong> y aún no la has revisado. Echa un vistazo cuando
            puedas — encontrarás el alcance, los planos y todo el detalle dentro del portal.
          </p>
          ${buttonRow}${footer}
        `),
      }

    case 'no_abierto':
      return {
        subject: `Recordatorio: oferta para ${projectNombre} — plazo ${daysMsg}`,
        html: wrapEmail(`
          <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
            Aún no has accedido a la licitación
          </h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.7;">
            Estimado/a <strong>${partnerNombre}</strong>,<br/><br/>
            El plazo para presentar oferta en <strong>${projectNombre}</strong> finaliza el
            <strong>${deadlineLabel}</strong> (${daysMsg}) y aún no has entrado al portal.
            Si estás interesado, te recomendamos abrirlo cuanto antes para revisar alcance y planos.
          </p>
          ${buttonRow}${footer}
        `),
      }

    case 'abierto_sin_bid':
      return {
        subject: `Recordatorio: oferta para ${projectNombre} — plazo ${daysMsg}`,
        html: wrapEmail(`
          <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
            Tu oferta sigue pendiente
          </h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.7;">
            Estimado/a <strong>${partnerNombre}</strong>,<br/><br/>
            Has revisado la licitación de <strong>${projectNombre}</strong> pero aún no has
            enviado oferta. El plazo termina el <strong>${deadlineLabel}</strong> (${daysMsg}).
            Si tienes cualquier duda, puedes mandarnos una consulta desde el propio portal.
          </p>
          ${buttonRow}${footer}
        `),
      }

    case 'parcial_con_borrador':
      return {
        subject: `Tu borrador para ${projectNombre} sigue sin enviar — plazo ${daysMsg}`,
        html: wrapEmail(`
          <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
            Tienes una oferta en borrador
          </h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.7;">
            Estimado/a <strong>${partnerNombre}</strong>,<br/><br/>
            Hemos visto que has empezado a preparar tu oferta para <strong>${projectNombre}</strong>
            pero todavía no la has enviado. Recuerda que el plazo finaliza el
            <strong>${deadlineLabel}</strong> (${daysMsg}) — sólo cuenta la versión que envíes
            definitivamente antes de esa fecha.
          </p>
          ${buttonRow}${footer}
        `),
      }
  }
}

export async function GET(req: NextRequest) {
  // Auth: Vercel passes Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()

  // Find launched tenders con deadline en próximos 3 días
  const inWindow = new Date(now.getTime() + Math.max(...REMINDER_DAYS) * 24 * 60 * 60 * 1000 + 60000)

  const { data: tenders } = await admin
    .from('fpe_tenders')
    .select(`
      id, fecha_limite,
      project:fpe_projects ( nombre ),
      invitations:fpe_tender_invitations (
        id, token, status, token_expires_at, sent_at, viewed_at,
        partner:fpe_partners ( nombre, email_notificaciones, email_contacto ),
        bid:fpe_bids ( status, line_items:fpe_bid_line_items ( precio_unitario ) )
      )
    `)
    .eq('status', 'launched')
    .gte('fecha_limite', now.toISOString())
    .lte('fecha_limite', inWindow.toISOString())

  let sentDeadline = 0
  let sentNudge    = 0
  const errs: string[] = []

  for (const raw of ((tenders ?? []) as unknown as RawTender[])) {
    const deadlineDate = new Date(raw.fecha_limite)
    const daysLeft     = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const inDeadlineWindow = REMINDER_DAYS.includes(daysLeft)

    const deadlineLabel = deadlineDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })
    const daysMsg       = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`

    for (const inv of raw.invitations) {
      if (['bid_submitted', 'revoked', 'expired', 'awarded'].includes(inv.status)) continue
      if (new Date(inv.token_expires_at) < now) continue

      const email = inv.partner.email_notificaciones ?? inv.partner.email_contacto
      if (!email) continue

      const portalUrl = `${SITE_URL}/execution-portal/${inv.token}`

      // ── Decidir kind ────────────────────────────────────────────────────
      let kind: ReminderKind | null = null

      if (inDeadlineWindow) {
        kind = pickKind(inv)
      } else if (!inv.viewed_at && inv.sent_at) {
        // Nudge temprano: enviada hace ≥EARLY_NUDGE_DAYS días, nunca abierta,
        // y aún faltan más de los REMINDER_DAYS al deadline (para no spammear
        // si el ciclo es muy corto).
        // Disparo "exacto" en el día N (no acumulativo) para evitar spam diario.
        const daysSinceSent = Math.floor((now.getTime() - new Date(inv.sent_at).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceSent === EARLY_NUDGE_DAYS && daysLeft > Math.max(...REMINDER_DAYS)) {
          kind = 'nudge_temprano'
        }
      }

      if (!kind) continue

      const { subject, html } = renderHtml(kind, inv.partner.nombre, raw.project.nombre, deadlineLabel, daysMsg, portalUrl)

      const res = await sendEmail({ to: email, subject, html })

      if (res.error) errs.push(`${email}: ${res.error}`)
      else if (kind === 'nudge_temprano') sentNudge++
      else                                sentDeadline++
    }
  }

  return NextResponse.json({
    ok: true,
    sent_deadline: sentDeadline,
    sent_nudge:    sentNudge,
    errors:        errs.length > 0 ? errs : undefined,
  })
}

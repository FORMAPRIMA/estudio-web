import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'

// Days before deadline to send reminder
const REMINDER_DAYS = [3, 1]

export async function GET(req: NextRequest) {
  // Auth: Vercel passes Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()

  // Find launched tenders with deadline approaching in next 3 days
  const inWindow = new Date(now.getTime() + Math.max(...REMINDER_DAYS) * 24 * 60 * 60 * 1000 + 60000)

  type RawInv = {
    id: string; token: string; status: string; token_expires_at: string
    partner: { nombre: string; email_notificaciones: string | null; email_contacto: string | null }
  }
  type RawTender = {
    id: string; fecha_limite: string
    project: { nombre: string }
    invitations: RawInv[]
  }

  const { data: tenders } = await admin
    .from('fpe_tenders')
    .select(`
      id, fecha_limite,
      project:fpe_projects ( nombre ),
      invitations:fpe_tender_invitations (
        id, token, status, token_expires_at,
        partner:fpe_partners ( nombre, email_notificaciones, email_contacto )
      )
    `)
    .eq('status', 'launched')
    .gte('fecha_limite', now.toISOString())
    .lte('fecha_limite', inWindow.toISOString())

  let sent   = 0
  const errs: string[] = []

  for (const raw of ((tenders ?? []) as unknown as RawTender[])) {
    const deadlineDate = new Date(raw.fecha_limite)
    const daysLeft     = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (!REMINDER_DAYS.includes(daysLeft)) continue

    const deadlineLabel = deadlineDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })
    const daysMsg       = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`

    for (const inv of raw.invitations) {
      if (['bid_submitted', 'revoked', 'expired', 'awarded'].includes(inv.status)) continue
      if (new Date(inv.token_expires_at) < now) continue

      const email = inv.partner.email_notificaciones ?? inv.partner.email_contacto
      if (!email) continue

      const res = await sendEmail({
        to:      email,
        subject: `Recordatorio: oferta para ${raw.project.nombre} — plazo ${daysMsg}`,
        html:    wrapEmail(`
          <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
            Recordatorio de licitación
          </h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.7;">
            Estimado/a <strong>${inv.partner.nombre}</strong>,<br/><br/>
            El plazo para presentar su oferta para el proyecto
            <strong>${raw.project.nombre}</strong> finaliza el <strong>${deadlineLabel}</strong>
            (${daysMsg}).
          </p>
          <p style="font-size:13px;color:#555;margin:0 0 24px;line-height:1.7;">
            Si ya ha enviado su oferta, por favor ignore este mensaje.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="background:#1A1A1A;border-radius:5px;padding:12px 28px;">
                <a href="${SITE_URL}/execution-portal/${inv.token}" style="color:#fff;font-size:13px;font-weight:600;text-decoration:none;display:block;">
                  Acceder al portal de licitación →
                </a>
              </td>
            </tr>
          </table>
          <p style="font-size:11px;color:#AAA;margin:0;line-height:1.6;">
            Consultas: <a href="mailto:contacto@formaprima.es" style="color:#D85A30;">contacto@formaprima.es</a>
          </p>
        `),
      })

      if (res.error) errs.push(`${email}: ${res.error}`)
      else sent++
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errs.length > 0 ? errs : undefined })
}

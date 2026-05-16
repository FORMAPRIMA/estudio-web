'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, wrapEmail } from '@/lib/email'

const LIST_PATH = '/team/fp-execution/projects'
const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenderQuestion {
  id:               string
  invitation_id:    string | null
  partner_nombre:   string
  pregunta:         string
  respuesta:        string | null
  asked_at:         string
  answered_at:      string | null
  answered_by_name: string | null
  project_unit_id:  string | null
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    throw new Error('Sin permisos.')
  return user
}

// ── Read questions ────────────────────────────────────────────────────────────

export async function getTenderQuestions(
  tender_id: string
): Promise<TenderQuestion[] | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('fpe_tender_questions')
      .select('id, invitation_id, partner_nombre, pregunta, respuesta, asked_at, answered_at, answered_by_name, project_unit_id')
      .eq('tender_id', tender_id)
      .order('asked_at', { ascending: true })
    if (error) return { error: error.message }
    return (data ?? []) as TenderQuestion[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Answer a question ─────────────────────────────────────────────────────────

export async function answerQuestion(data: {
  question_id:  string
  tender_id:    string
  project_id:   string
  respuesta:    string
  partner_email?: string | null
}): Promise<{ success: true; broadcast: number } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    const { error } = await admin
      .from('fpe_tender_questions')
      .update({
        respuesta:        data.respuesta,
        answered_at:      new Date().toISOString(),
        answered_by_name: user.email ?? 'Forma Prima',
      })
      .eq('id', data.question_id)

    if (error) return { error: error.message }

    // ── Recuperar metadata de la pregunta para el broadcast ──────────────────
    const { data: q } = await admin
      .from('fpe_tender_questions')
      .select('pregunta, project_unit_id, invitation_id')
      .eq('id', data.question_id)
      .single()

    let broadcastCount = 0

    if (q) {
      // ── 1) Email al partner que preguntó (mantiene comportamiento previo) ──
      if (data.partner_email) {
        const { data: ownInv } = q.invitation_id
          ? await admin.from('fpe_tender_invitations').select('token').eq('id', q.invitation_id).single()
          : { data: null }

        const portalUrl = ownInv
          ? `${SITE_URL}/execution-portal/${ownInv.token}`
          : SITE_URL

        await sendEmail({
          to:      data.partner_email,
          subject: 'Respuesta a su consulta — Forma Prima',
          html:    wrapEmail(`
            <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 16px;">
              Su consulta ha sido respondida
            </h2>
            <div style="border-left:3px solid #E8E6E0;padding:12px 16px;background:#F8F7F4;margin:0 0 16px;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 4px;font-size:10px;color:#AAA;text-transform:uppercase;letter-spacing:0.06em;">Su pregunta</p>
              <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${q.pregunta}</p>
            </div>
            <div style="border-left:3px solid #D85A30;padding:12px 16px;background:#FEF6F3;margin:0 0 24px;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 4px;font-size:10px;color:#AAA;text-transform:uppercase;letter-spacing:0.06em;">Respuesta</p>
              <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${data.respuesta}</p>
            </div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
              <tr>
                <td style="background:#1A1A1A;border-radius:5px;padding:10px 24px;">
                  <a href="${portalUrl}" style="color:#fff;font-size:13px;font-weight:600;text-decoration:none;display:block;">
                    Acceder al portal →
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size:11px;color:#AAA;margin:0;">
              Esta respuesta también es visible — de forma anónima — para los demás partners que están
              presupuestando${q.project_unit_id ? ' la misma unidad' : ' esta licitación'}.
            </p>
          `),
        })
      }

      // ── 2) Broadcast anónimo a los demás partners del tender ───────────────
      // Si la pregunta es de una unidad concreta → sólo a los partners cuyo
      // scope_unit_ids contenga esa unidad. Si es general → a todos.
      const { data: peerInvs } = await admin
        .from('fpe_tender_invitations')
        .select(`
          id, token, status, scope_unit_ids,
          partner:fpe_partners ( email_contacto, email_notificaciones )
        `)
        .eq('tender_id', data.tender_id)
        .neq('status', 'revoked')
        .neq('status', 'expired')

      type PeerInv = {
        id: string; token: string; status: string; scope_unit_ids: string[] | null
        partner: { email_contacto: string | null; email_notificaciones: string | null } | null
      }

      const recipients = ((peerInvs ?? []) as unknown as PeerInv[]).filter(p => {
        if (p.id === q.invitation_id) return false // excluir al que preguntó
        if (q.project_unit_id) {
          return (p.scope_unit_ids ?? []).includes(q.project_unit_id)
        }
        return true // pregunta general → todos
      })

      for (const peer of recipients) {
        const email = peer.partner?.email_notificaciones ?? peer.partner?.email_contacto
        if (!email) continue

        const portalUrl = `${SITE_URL}/execution-portal/${peer.token}`

        const res = await sendEmail({
          to:      email,
          subject: 'Nueva respuesta en la licitación — Forma Prima',
          html:    wrapEmail(`
            <h2 style="font-size:18px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">
              Pregunta respondida en la licitación
            </h2>
            <p style="font-size:12px;color:#777;margin:0 0 18px;line-height:1.6;">
              Un participante en esta licitación ha planteado una consulta y nuestro equipo
              ha respondido. Compartimos pregunta y respuesta de forma anónima por si te resulta útil.
            </p>
            <div style="border-left:3px solid #E8E6E0;padding:12px 16px;background:#F8F7F4;margin:0 0 12px;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 4px;font-size:10px;color:#AAA;text-transform:uppercase;letter-spacing:0.06em;">Pregunta</p>
              <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${q.pregunta}</p>
            </div>
            <div style="border-left:3px solid #D85A30;padding:12px 16px;background:#FEF6F3;margin:0 0 24px;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 4px;font-size:10px;color:#AAA;text-transform:uppercase;letter-spacing:0.06em;">Respuesta · Forma Prima</p>
              <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${data.respuesta}</p>
            </div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
              <tr>
                <td style="background:#1A1A1A;border-radius:5px;padding:10px 24px;">
                  <a href="${portalUrl}" style="color:#fff;font-size:13px;font-weight:600;text-decoration:none;display:block;">
                    Ver en tu portal →
                  </a>
                </td>
              </tr>
            </table>
          `),
        })
        if (!res.error) broadcastCount++
      }
    }

    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true, broadcast: broadcastCount }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

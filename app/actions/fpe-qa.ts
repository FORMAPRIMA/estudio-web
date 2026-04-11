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
      .select('id, invitation_id, partner_nombre, pregunta, respuesta, asked_at, answered_at, answered_by_name')
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
}): Promise<{ success: true } | { error: string }> {
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

    // Send email to partner if we have their address
    if (data.partner_email) {
      const { data: q } = await admin
        .from('fpe_tender_questions')
        .select('pregunta, invitation_id')
        .eq('id', data.question_id)
        .single()

      if (q) {
        const { data: inv } = q.invitation_id
          ? await admin.from('fpe_tender_invitations').select('token').eq('id', q.invitation_id).single()
          : { data: null }

        const portalUrl = inv
          ? `${SITE_URL}/execution-portal/${inv.token}`
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
              Esta respuesta es visible para todos los partners invitados a la licitación.
            </p>
          `),
        })
      }
    }

    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

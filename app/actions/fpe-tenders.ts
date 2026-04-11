'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, wrapEmail } from '@/lib/email'

// ── Shared types (used by BidComparison client component) ─────────────────────

export interface ScopeUnitRow {
  unit_id:   string
  unit_nombre: string
  line_items: { id: string; nombre: string; cantidad: number; unidad_medida: string }[]
}

export interface TenderBidRow {
  id:             string
  invitation_id:  string
  partner_nombre: string
  partner_email:  string | null
  submitted_at:   string
  notas:          string | null
  status:         string
  prices:         Record<string, number>  // fpe_project_line_items.id → precio_unitario
}

const LIST_PATH = '/team/fp-execution/projects'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'

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

// ── Tenders ───────────────────────────────────────────────────────────────────

export async function createTender(data: {
  project_id: string
  descripcion?: string | null
  fecha_limite: string
}): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_tenders')
      .insert({
        project_id:  data.project_id,
        descripcion: data.descripcion ?? null,
        fecha_limite: data.fecha_limite,
        created_by:  user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateTender(
  id: string,
  data: { descripcion?: string | null; fecha_limite?: string }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_tenders')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function launchTender(
  tender_id: string,
  project_id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_tenders')
      .update({ status: 'launched', launched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', tender_id)
    if (error) return { error: error.message }
    // Update project status
    await admin.from('fpe_projects').update({ status: 'tender_launched' }).eq('id', project_id)
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function closeTender(
  tender_id: string,
  project_id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_tenders')
      .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', tender_id)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function createInvitation(data: {
  tender_id:              string
  partner_id:             string
  scope_project_unit_ids: string[]  // fpe_project_units.id array
  token_expires_days?:    number    // default 14
}): Promise<{ id: string; token: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const days    = data.token_expires_days ?? 14
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    const { data: row, error } = await admin
      .from('fpe_tender_invitations')
      .insert({
        tender_id:        data.tender_id,
        partner_id:       data.partner_id,
        scope_unit_ids:   data.scope_project_unit_ids,
        token_expires_at: expires,
        status:           'pending',
      })
      .select('id, token')
      .single()

    if (error) return { error: error.message }
    return { id: row.id, token: row.token }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function sendInvitation(
  invitation_id: string,
  project_id:    string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Fetch invitation + partner + tender + project
    const { data: inv, error: invErr } = await admin
      .from('fpe_tender_invitations')
      .select(`
        id, token, token_expires_at, scope_unit_ids,
        partner:fpe_partners ( nombre, email_notificaciones, email_contacto ),
        tender:fpe_tenders (
          id, descripcion, fecha_limite,
          project:fpe_projects ( id, nombre, ciudad, descripcion )
        )
      `)
      .eq('id', invitation_id)
      .single()

    if (invErr || !inv) return { error: invErr?.message ?? 'Invitación no encontrada.' }

    const partner = inv.partner as unknown as { nombre: string; email_notificaciones: string | null; email_contacto: string | null }
    const tender  = inv.tender  as unknown as { id: string; descripcion: string | null; fecha_limite: string; project: { id: string; nombre: string; ciudad: string | null; descripcion: string | null } }

    const email = partner.email_notificaciones ?? partner.email_contacto
    if (!email) return { error: `El partner "${partner.nombre}" no tiene email configurado.` }

    const portalUrl = `${SITE_URL}/execution-portal/${inv.token}`
    const deadline  = new Date(tender.fecha_limite).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

    const body = `
      <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 12px;">
        Invitación a licitación
      </h2>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.7;">
        Estimado/a <strong>${partner.nombre}</strong>,<br/><br/>
        FORMA PRIMA le invita a presentar oferta para el proyecto:
      </p>
      <div style="border-left:3px solid #D85A30;padding:14px 20px;background:#F8F7F4;margin:0 0 24px;border-radius:0 4px 4px 0;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1A1A1A;">${tender.project.nombre}</p>
        ${tender.project.ciudad ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">${tender.project.ciudad}</p>` : ''}
        ${tender.descripcion   ? `<p style="margin:0;font-size:13px;color:#888;">${tender.descripcion}</p>` : ''}
      </div>
      <p style="font-size:13px;color:#555;margin:0 0 8px;line-height:1.7;">
        <strong>Fecha límite de oferta:</strong> ${deadline}
      </p>
      <p style="font-size:13px;color:#555;margin:0 0 28px;line-height:1.7;">
        A través del siguiente enlace puede consultar el scope del proyecto, descargar la documentación disponible y enviar su oferta económica.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="background:#1A1A1A;border-radius:5px;padding:12px 28px;">
            <a href="${portalUrl}" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;display:block;">
              Acceder al portal de licitación →
            </a>
          </td>
        </tr>
      </table>
      <p style="font-size:11px;color:#AAAAAA;margin:0;line-height:1.6;">
        Este enlace es personal e intransferible y caduca el ${new Date(inv.token_expires_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}.
        Si tiene alguna pregunta, puede contactarnos en
        <a href="mailto:contacto@formaprima.es" style="color:#D85A30;">contacto@formaprima.es</a>
      </p>
    `

    const emailRes = await sendEmail({
      to:      email,
      subject: `Invitación a licitación — ${tender.project.nombre}`,
      html:    wrapEmail(body),
    })

    if (emailRes.error) return { error: emailRes.error }

    // Update invitation status
    const { error: updErr } = await admin
      .from('fpe_tender_invitations')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invitation_id)
    if (updErr) return { error: updErr.message }

    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function revokeInvitation(
  invitation_id: string,
  project_id:    string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_tender_invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', invitation_id)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Bid comparison data ───────────────────────────────────────────────────────

export async function getTenderBids(
  tender_id:  string,
  project_id: string
): Promise<{ scope: ScopeUnitRow[]; bids: TenderBidRow[] } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const [{ data: projectUnits }, { data: invitations }] = await Promise.all([
      admin
        .from('fpe_project_units')
        .select(`
          id, orden,
          template_unit:fpe_template_units ( nombre ),
          line_items:fpe_project_line_items (
            id, cantidad,
            template_line_item:fpe_template_line_items ( nombre, unidad_medida )
          )
        `)
        .eq('project_id', project_id)
        .order('orden', { ascending: true }),

      admin
        .from('fpe_tender_invitations')
        .select('id, partner:fpe_partners ( nombre, email_contacto )')
        .eq('tender_id', tender_id)
        .in('status', ['bid_submitted', 'awarded']),
    ])

    const invIds = (invitations ?? []).map(i => i.id)

    const { data: rawBids } = invIds.length > 0
      ? await admin
          .from('fpe_bids')
          .select(`
            id, invitation_id, notas, status, submitted_at,
            line_items:fpe_bid_line_items ( project_line_item_id, precio_unitario )
          `)
          .in('invitation_id', invIds)
      : { data: [] as { id: string; invitation_id: string; notas: string | null; status: string; submitted_at: string; line_items: unknown[] }[] }

    // Build scope
    type RawUnit = {
      id: string; orden: number
      template_unit: { nombre: string } | null
      line_items: { id: string; cantidad: number; template_line_item: { nombre: string; unidad_medida: string } | null }[]
    }
    const scope: ScopeUnitRow[] = ((projectUnits ?? []) as unknown as RawUnit[]).map(pu => ({
      unit_id:     pu.id,
      unit_nombre: pu.template_unit?.nombre ?? '—',
      line_items:  pu.line_items.map(li => ({
        id:            li.id,
        nombre:        li.template_line_item?.nombre ?? '—',
        cantidad:      li.cantidad,
        unidad_medida: li.template_line_item?.unidad_medida ?? '',
      })),
    }))

    // Index invitations by id → partner info
    type RawInv = { id: string; partner: { nombre: string; email_contacto: string | null } | null }
    const invMap: Record<string, { nombre: string; email_contacto: string | null }> = {}
    for (const inv of (invitations ?? []) as unknown as RawInv[]) {
      invMap[inv.id] = inv.partner ?? { nombre: '?', email_contacto: null }
    }

    // Build bids
    type RawBid = {
      id: string; invitation_id: string; notas: string | null; status: string; submitted_at: string
      line_items: { project_line_item_id: string; precio_unitario: number }[]
    }
    const bids: TenderBidRow[] = ((rawBids ?? []) as unknown as RawBid[]).map(bid => {
      const partner = invMap[bid.invitation_id] ?? { nombre: '?', email_contacto: null }
      const prices: Record<string, number> = {}
      for (const li of bid.line_items) prices[li.project_line_item_id] = li.precio_unitario
      return {
        id: bid.id, invitation_id: bid.invitation_id,
        partner_nombre: partner.nombre, partner_email: partner.email_contacto,
        submitted_at: bid.submitted_at, notas: bid.notas, status: bid.status, prices,
      }
    })

    return { scope, bids }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Award a bid ───────────────────────────────────────────────────────────────

export async function awardBid(data: {
  bid_id:     string
  project_id: string
}): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      admin.from('fpe_bids').update({ status: 'awarded', updated_at: new Date().toISOString() }).eq('id', data.bid_id),
      admin.from('fpe_projects').update({ status: 'awarded' }).eq('id', data.project_id),
    ])
    if (e1) return { error: e1.message }
    if (e2) return { error: e2.message }
    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

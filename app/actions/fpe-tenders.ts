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
  id:              string
  invitation_id:   string
  partner_nombre:  string
  partner_email:   string | null
  submitted_at:    string
  notas:           string | null
  status:          string
  prices:          Record<string, number>   // fpe_project_line_items.id → precio_unitario
  totalDaysByUnit: Record<string, number>   // project_unit_id → total días laborales propuestos
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
        .eq('status', 'bid_submitted'),
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

    // Fetch phase durations for all bids
    const bidIds = (rawBids ?? []).map(b => b.id)
    const { data: phaseDurData } = bidIds.length > 0
      ? await admin
          .from('fpe_bid_phase_durations')
          .select('bid_id, project_unit_id, duracion_dias')
          .in('bid_id', bidIds)
      : { data: [] as { bid_id: string; project_unit_id: string; duracion_dias: number }[] }

    // Group: bid_id → unit_id → total days
    const daysByBidUnit: Record<string, Record<string, number>> = {}
    for (const pd of (phaseDurData ?? [])) {
      if (!daysByBidUnit[pd.bid_id]) daysByBidUnit[pd.bid_id] = {}
      daysByBidUnit[pd.bid_id][pd.project_unit_id] =
        (daysByBidUnit[pd.bid_id][pd.project_unit_id] ?? 0) + pd.duracion_dias
    }

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
      const totalDaysByUnit = daysByBidUnit[bid.id] ?? {}
      return {
        id: bid.id, invitation_id: bid.invitation_id,
        partner_nombre: partner.nombre, partner_email: partner.email_contacto,
        submitted_at: bid.submitted_at, notas: bid.notas, status: bid.status,
        prices, totalDaysByUnit,
      }
    })

    return { scope, bids }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Award a bid ───────────────────────────────────────────────────────────────
// Awards bid, records in fpe_awards, creates draft fpe_contract, sends via DocuSign.

export async function awardBid(data: {
  bid_id:     string
  project_id: string
}): Promise<{ success: true; contract_id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // ── 1. Mark bid + project as awarded ─────────────────────────────────────
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      admin.from('fpe_bids').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', data.bid_id),
      admin.from('fpe_projects').update({ status: 'awarded' }).eq('id', data.project_id),
    ])
    if (e1) return { error: e1.message }
    if (e2) return { error: e2.message }

    // ── 2. Fetch bid → invitation → tender + partner ──────────────────────────
    const { data: bid } = await admin
      .from('fpe_bids')
      .select(`
        id,
        invitation:fpe_tender_invitations (
          id, tender_id,
          partner:fpe_partners ( id, nombre, contacto_nombre, email_contacto, email_notificaciones )
        )
      `)
      .eq('id', data.bid_id)
      .single()

    if (!bid) return { error: 'Oferta no encontrada tras adjudicación.' }

    type BidRaw = {
      id: string
      invitation: {
        id: string; tender_id: string
        partner: { id: string; nombre: string; contacto_nombre: string | null; email_contacto: string | null; email_notificaciones: string | null }
      } | null
    }
    const bidTyped = bid as unknown as BidRaw
    const partnerId = bidTyped.invitation?.partner?.id
    const tenderId  = bidTyped.invitation?.tender_id

    if (!partnerId || !tenderId) return { error: 'Datos de partner o licitación incompletos.' }

    // ── 3. Insert fpe_award ───────────────────────────────────────────────────
    const { data: award, error: awdErr } = await admin
      .from('fpe_awards')
      .insert({ tender_id: tenderId, partner_id: partnerId, bid_id: data.bid_id })
      .select('id')
      .single()
    if (awdErr) return { error: awdErr.message }

    // ── 4. Fetch project + bid line items for contract JSON ───────────────────
    const [{ data: project }, { data: bidLineItems }] = await Promise.all([
      admin.from('fpe_projects').select('id, nombre, descripcion, direccion, ciudad').eq('id', data.project_id).single(),
      admin.from('fpe_bid_line_items').select(`
        project_line_item_id, precio_unitario,
        project_line_item:fpe_project_line_items (
          id, cantidad,
          template_line_item:fpe_template_line_items ( nombre, unidad_medida ),
          project_unit:fpe_project_units (
            id,
            template_unit:fpe_template_units ( nombre )
          )
        )
      `).eq('bid_id', data.bid_id),
    ])

    const partner = bidTyped.invitation!.partner

    // Build contenido_json
    const contenido = {
      project:  { id: data.project_id, nombre: project?.nombre ?? '', ciudad: project?.ciudad ?? '', direccion: project?.direccion ?? '' },
      partner:  { id: partnerId, nombre: partner.nombre, email: partner.email_contacto ?? partner.email_notificaciones ?? '' },
      awarded_at: new Date().toISOString(),
      line_items: (bidLineItems ?? []).map((li: any) => ({
        nombre:        li.project_line_item?.template_line_item?.nombre ?? '—',
        unidad:        li.project_line_item?.template_line_item?.unidad_medida ?? '',
        cantidad:      li.project_line_item?.cantidad ?? 0,
        precio_unitario: li.precio_unitario,
        total:         (li.project_line_item?.cantidad ?? 0) * li.precio_unitario,
        unit_nombre:   li.project_line_item?.project_unit?.template_unit?.nombre ?? '—',
      })),
    }

    // ── 5. Create fpe_contract (draft) ────────────────────────────────────────
    const { data: contract, error: ctrErr } = await admin
      .from('fpe_contracts')
      .insert({ award_id: award.id, contenido_json: contenido, status: 'draft' })
      .select('id')
      .single()
    if (ctrErr) return { error: ctrErr.message }

    // ── 6. Generate PDF + send via DocuSign ───────────────────────────────────
    try {
      const { generateFpeContractPDF } = await import('@/components/pdfs/FpeContractPDF')

      const pdfBuffer = await generateFpeContractPDF(contenido)

      const { createAndSendEnvelope } = await import('@/lib/docusign/client')
      const webhookUrl = `${SITE_URL}/api/webhooks/docusign`
      const partnerEmail = partner.email_contacto ?? partner.email_notificaciones ?? ''

      if (partnerEmail) {
        const { envelopeId } = await createAndSendEnvelope({
          contratoId: contract.id,
          numero:     `FPE-${project?.nombre ?? contract.id}`,
          pdfBuffer,
          signers: {
            cliente: { email: partnerEmail, name: partner.nombre },
            estudio: { email: 'contacto@formaprima.es', name: 'Forma Prima' },
          },
          webhookUrl,
        })

        await admin
          .from('fpe_contracts')
          .update({ docusign_envelope_id: envelopeId, status: 'sent_to_sign', sent_at: new Date().toISOString() })
          .eq('id', contract.id)
      }
    } catch (docuErr) {
      console.error('[awardBid] DocuSign error:', docuErr)
      // Non-fatal: award is created, contract is draft — DocuSign can be retried
    }

    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    revalidatePath('/team/fp-execution/control-room')
    return { success: true, contract_id: contract.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Bulk create + send all invitations in one step ────────────────────────────
// Creates (or reuses) a tender in launched state, then creates + sends
// one invitation per partner based on their unit assignments.

export async function createAndSendAllInvitations(
  project_id:        string,
  fecha_limite:      string,
  unit_partners_map: Record<string, string[]>,   // project_unit_id → partner_ids[]
  token_expires_days = 21,
): Promise<{ success: true; tender_id: string; sent: number; total: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // 1. Build reverse map: partner_id → project_unit_ids[]
    const partnerUnits: Record<string, string[]> = {}
    for (const [unitId, partnerIds] of Object.entries(unit_partners_map)) {
      for (const pid of partnerIds) {
        if (!partnerUnits[pid]) partnerUnits[pid] = []
        partnerUnits[pid].push(unitId)
      }
    }
    const uniquePartners = Object.keys(partnerUnits)
    if (uniquePartners.length === 0) return { error: 'No hay execution partners asignados a ninguna unidad.' }

    // 2. Find or create tender
    const { data: existingTender } = await admin
      .from('fpe_tenders')
      .select('id, status')
      .eq('project_id', project_id)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let tenderId: string

    if (existingTender && existingTender.status === 'launched') {
      tenderId = existingTender.id
    } else if (existingTender && existingTender.status === 'draft') {
      // Promote draft to launched
      await admin.from('fpe_tenders').update({
        fecha_limite,
        status:      'launched',
        launched_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }).eq('id', existingTender.id)
      tenderId = existingTender.id
    } else {
      // Create new tender in launched state
      const { data: newTender, error: tErr } = await admin
        .from('fpe_tenders')
        .insert({ project_id, fecha_limite, status: 'launched', launched_at: new Date().toISOString() })
        .select('id')
        .single()
      if (tErr || !newTender) return { error: tErr?.message ?? 'Error creando licitación.' }
      tenderId = newTender.id
    }

    // 3. Fetch existing active invitations for this tender (avoid duplicates)
    const { data: existingInvs } = await admin
      .from('fpe_tender_invitations')
      .select('partner_id')
      .eq('tender_id', tenderId)
      .not('status', 'in', '("revoked","expired")')

    const alreadyInvitedPartnerIds = new Set((existingInvs ?? []).map(i => i.partner_id))

    // 4. Fetch project info for email body
    const { data: project } = await admin
      .from('fpe_projects')
      .select('id, nombre, ciudad, descripcion')
      .eq('id', project_id)
      .single()

    if (!project) return { error: 'Proyecto no encontrado.' }

    const deadline = new Date(fecha_limite).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const expires  = new Date(Date.now() + token_expires_days * 24 * 60 * 60 * 1000).toISOString()

    // 5. Create + send invitations for each partner
    let sent = 0

    for (const partnerId of uniquePartners) {
      if (alreadyInvitedPartnerIds.has(partnerId)) continue

      const unitIds = partnerUnits[partnerId]

      // Create invitation
      const { data: inv, error: invErr } = await admin
        .from('fpe_tender_invitations')
        .insert({
          tender_id:        tenderId,
          partner_id:       partnerId,
          scope_unit_ids:   unitIds,
          token_expires_at: expires,
          status:           'pending',
        })
        .select('id, token, token_expires_at')
        .single()

      if (invErr || !inv) continue  // non-fatal: skip this partner

      // Fetch partner email
      const { data: partner } = await admin
        .from('fpe_partners')
        .select('nombre, email_notificaciones, email_contacto')
        .eq('id', partnerId)
        .single()

      if (!partner) continue

      const email = partner.email_notificaciones ?? partner.email_contacto
      if (!email) continue

      const portalUrl = `${SITE_URL}/execution-portal/${inv.token}`

      const body = `
        <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 12px;">
          Invitación a licitación
        </h2>
        <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.7;">
          Estimado/a <strong>${partner.nombre}</strong>,<br/><br/>
          FORMA PRIMA le invita a presentar oferta para el proyecto:
        </p>
        <div style="border-left:3px solid #D85A30;padding:14px 20px;background:#F8F7F4;margin:0 0 24px;border-radius:0 4px 4px 0;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1A1A1A;">${project.nombre}</p>
          ${project.ciudad ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">${project.ciudad}</p>` : ''}
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
        subject: `Invitación a licitación — ${project.nombre}`,
        html:    wrapEmail(body),
      })

      // Update invitation to 'sent' whether or not email succeeded (non-fatal)
      const newStatus = emailRes.error ? 'pending' : 'sent'
      await admin
        .from('fpe_tender_invitations')
        .update({ status: newStatus, ...(newStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}) })
        .eq('id', inv.id)

      if (!emailRes.error) sent++
    }

    // 6. Update project status
    await admin.from('fpe_projects').update({ status: 'tender_launched' }).eq('id', project_id)

    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true, tender_id: tenderId, sent, total: uniquePartners.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

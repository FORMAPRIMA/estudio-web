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

// ── Discipline-based bulk invite ──────────────────────────────────────────────
// Creates one invitation per partner based on discipline assignments.
// Each invitation carries discipline_ids (what this partner covers) and
// scope_unit_ids = all project unit IDs (portal filters by discipline).

export async function createAndSendDisciplineInvitations(
  project_id:            string,
  fecha_limite:          string,
  discipline_partner_map: Record<string, string>,  // discipline_id → partner_id
  token_expires_days = 21,
): Promise<{ success: true; tender_id: string; sent: number; total: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // 1. Build reverse map: partner_id → discipline_ids[]
    const partnerDisciplines: Record<string, string[]> = {}
    for (const [discId, pid] of Object.entries(discipline_partner_map)) {
      if (!pid) continue
      if (!partnerDisciplines[pid]) partnerDisciplines[pid] = []
      partnerDisciplines[pid].push(discId)
    }
    const uniquePartners = Object.keys(partnerDisciplines)
    if (uniquePartners.length === 0) return { error: 'No hay execution partners asignados a ninguna disciplina.' }

    // 2. Find or create tender (same logic as createAndSendAllInvitations)
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
      await admin.from('fpe_tenders').update({
        fecha_limite,
        status:      'launched',
        launched_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }).eq('id', existingTender.id)
      tenderId = existingTender.id
    } else {
      const { data: newTender, error: tErr } = await admin
        .from('fpe_tenders')
        .insert({ project_id, fecha_limite, status: 'launched', launched_at: new Date().toISOString() })
        .select('id')
        .single()
      if (tErr || !newTender) return { error: tErr?.message ?? 'Error creando licitación.' }
      tenderId = newTender.id
    }

    // 3. Fetch all project unit IDs (scope_unit_ids = all units of the project)
    const { data: projectUnits } = await admin
      .from('fpe_project_units')
      .select('id')
      .eq('project_id', project_id)

    const allUnitIds = (projectUnits ?? []).map(u => u.id)

    // 4. Skip already-invited partners for this tender
    const { data: existingInvs } = await admin
      .from('fpe_tender_invitations')
      .select('partner_id')
      .eq('tender_id', tenderId)
      .not('status', 'in', '("revoked","expired")')

    const alreadyInvited = new Set((existingInvs ?? []).map(i => i.partner_id))

    // 5. Fetch project info for email
    const { data: project } = await admin
      .from('fpe_projects')
      .select('id, nombre, ciudad, descripcion')
      .eq('id', project_id)
      .single()

    if (!project) return { error: 'Proyecto no encontrado.' }

    const deadline = new Date(fecha_limite).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const expires  = new Date(Date.now() + token_expires_days * 24 * 60 * 60 * 1000).toISOString()

    // 6. Create + send one invitation per partner
    let sent = 0

    for (const partnerId of uniquePartners) {
      if (alreadyInvited.has(partnerId)) continue

      const disciplineIds = partnerDisciplines[partnerId]

      const { data: inv, error: invErr } = await admin
        .from('fpe_tender_invitations')
        .insert({
          tender_id:        tenderId,
          partner_id:       partnerId,
          scope_unit_ids:   allUnitIds,
          discipline_ids:   disciplineIds,
          token_expires_at: expires,
          status:           'pending',
        })
        .select('id, token, token_expires_at')
        .single()

      if (invErr || !inv) continue

      // Seed automático del plan de pago de esta invitación con estrategia
      // "dominant" (disciplina con más UEs del partner). Fallo silencioso:
      // si no hay hitos configurados para esa disciplina, la invitación queda
      // sin plan y se podrá editar después desde el modal.
      try {
        const mod = await import('./fpe-payment')
        await mod.regenerateInvitationPaymentPlan(inv.id, 'dominant')
      } catch {
        // ignorar
      }

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

      const newStatus = emailRes.error ? 'pending' : 'sent'
      await admin
        .from('fpe_tender_invitations')
        .update({ status: newStatus, ...(newStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}) })
        .eq('id', inv.id)

      if (!emailRes.error) sent++
    }

    await admin.from('fpe_projects').update({ status: 'tender_launched' }).eq('id', project_id)

    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true, tender_id: tenderId, sent, total: uniquePartners.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Per-unit award (new model) ────────────────────────────────────────────────
// Adjudication happens UE by UE in the BidComparison. The Final Overview
// aggregates per-partner awards and triggers contract generation.

export interface FpeProjectUnitAwardRow {
  project_unit_id: string
  bid_id:          string
  partner_id:      string
  partner_nombre:  string
  awarded_at:      string
}

export async function awardUnit(data: {
  project_id:      string
  project_unit_id: string
  bid_id:          string
}): Promise<{ success: true } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    // Derive partner_id from bid → invitation
    const { data: bid, error: bidErr } = await admin
      .from('fpe_bids')
      .select('id, invitation:fpe_tender_invitations(partner_id)')
      .eq('id', data.bid_id)
      .single()

    if (bidErr || !bid) return { error: bidErr?.message ?? 'Oferta no encontrada.' }

    type RawBid = { id: string; invitation: { partner_id: string } | null }
    const partnerId = (bid as unknown as RawBid).invitation?.partner_id
    if (!partnerId) return { error: 'No se pudo derivar el partner del bid.' }

    const { error } = await admin
      .from('fpe_project_unit_awards')
      .upsert({
        project_id:      data.project_id,
        project_unit_id: data.project_unit_id,
        bid_id:          data.bid_id,
        partner_id:      partnerId,
        awarded_by:      user.id,
        awarded_at:      new Date().toISOString(),
      }, { onConflict: 'project_id,project_unit_id' })

    if (error) return { error: error.message }

    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function revertUnitAward(data: {
  project_id:      string
  project_unit_id: string
}): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_project_unit_awards')
      .delete()
      .eq('project_id', data.project_id)
      .eq('project_unit_id', data.project_unit_id)
    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function getProjectAwards(
  project_id: string
): Promise<{ awards: FpeProjectUnitAwardRow[] } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('fpe_project_unit_awards')
      .select('project_unit_id, bid_id, partner_id, awarded_at, partner:fpe_partners(nombre)')
      .eq('project_id', project_id)

    if (error) return { error: error.message }

    type Raw = {
      project_unit_id: string
      bid_id: string
      partner_id: string
      awarded_at: string
      partner: { nombre: string } | null
    }
    const awards: FpeProjectUnitAwardRow[] = ((data ?? []) as unknown as Raw[]).map(r => ({
      project_unit_id: r.project_unit_id,
      bid_id:          r.bid_id,
      partner_id:      r.partner_id,
      partner_nombre:  r.partner?.nombre ?? '?',
      awarded_at:      r.awarded_at,
    }))

    return { awards }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Generate contracts from per-UE awards ────────────────────────────────────
// Reads fpe_project_unit_awards grouped by partner, builds one contract per
// partner with the union of their awarded UEs, generates PDF, and sends to
// DocuSign. Also generates the per-contract payment schedule using the
// dominant (governing) discipline of each pack.

export async function generateContractsFromAwards(
  project_id: string
): Promise<{ success: true; created: number; sent_to_docusign: number } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    // ── Reuse the overview action to get fully structured data ──────────────
    const overview = await getAdjudicationOverview(project_id)
    if ('error' in overview) return { error: overview.error }
    if (overview.partners.length === 0) return { error: 'No hay UEs adjudicadas todavía.' }

    // ── Project info for contract body ──────────────────────────────────────
    const { data: project } = await admin
      .from('fpe_projects')
      .select('id, nombre, descripcion, direccion, ciudad')
      .eq('id', project_id)
      .single()
    if (!project) return { error: 'Proyecto no encontrado.' }

    // ── Active tender for award linking (one fpe_award per partner expected) ─
    const { data: activeTender } = await admin
      .from('fpe_tenders')
      .select('id')
      .eq('project_id', project_id)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeTender) return { error: 'No se encontró una licitación activa para este proyecto.' }
    const tenderId = activeTender.id

    let created = 0
    let sentToDocusign = 0

    // Process each partner pack
    for (const pkg of overview.partners) {
      // 1. Find the bid_id for this partner (any UE will do — they share the same bid)
      const { data: anyAward } = await admin
        .from('fpe_project_unit_awards')
        .select('bid_id')
        .eq('project_id', project_id)
        .eq('partner_id', pkg.partner_id)
        .limit(1)
        .maybeSingle()
      if (!anyAward) continue

      // 2. Insert / find fpe_award for this (tender, partner)
      let awardId: string
      const { data: existingAward } = await admin
        .from('fpe_awards')
        .select('id')
        .eq('tender_id', tenderId)
        .eq('partner_id', pkg.partner_id)
        .maybeSingle()

      if (existingAward) {
        awardId = existingAward.id
      } else {
        const { data: newAward, error: awErr } = await admin
          .from('fpe_awards')
          .insert({
            tender_id:  tenderId,
            partner_id: pkg.partner_id,
            bid_id:     anyAward.bid_id,
            awarded_by: user.id,
            awarded_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (awErr || !newAward) continue
        awardId = newAward.id
      }

      // 3. Build contenido_json from pkg
      //    line_items[] is the flattened list (PDF expects this);
      //    chapters[] keeps the structured pack for UI / future PDF richer rendering.
      const flatLineItems = pkg.chapters.flatMap(ch =>
        ch.units.flatMap(u =>
          u.line_items.map(li => ({
            nombre:          li.nombre,
            unidad:          li.unidad_medida,
            cantidad:        li.cantidad,
            precio_unitario: li.precio_unitario,
            total:           li.total,
            unit_nombre:     u.unit_nombre,
          }))
        )
      )

      const contenido = {
        project: {
          id:        project.id,
          nombre:    project.nombre,
          ciudad:    project.ciudad ?? '',
          direccion: project.direccion ?? '',
        },
        partner: {
          id:     pkg.partner_id,
          nombre: pkg.partner_nombre,
          email:  pkg.partner_email ?? '',
        },
        awarded_at:                  new Date().toISOString(),
        governing_discipline:        pkg.governing_discipline_nombre,
        total:                       pkg.total,
        line_items:                  flatLineItems,
        chapters: pkg.chapters.map(ch => ({
          chapter_nombre: ch.chapter_nombre,
          units: ch.units.map(u => ({
            unit_nombre: u.unit_nombre,
            total:       u.total,
            days:        u.days,
            line_items:  u.line_items,
          })),
        })),
      }

      // 4. Insert / update fpe_contract (one per award)
      const { data: existingContract } = await admin
        .from('fpe_contracts')
        .select('id, status')
        .eq('award_id', awardId)
        .maybeSingle()

      let contractId: string
      if (existingContract) {
        contractId = existingContract.id
        // Refresh contenido on existing draft only (don't overwrite signed contracts)
        if (existingContract.status === 'draft') {
          await admin.from('fpe_contracts').update({ contenido_json: contenido, updated_at: new Date().toISOString() }).eq('id', contractId)
        }
      } else {
        const { data: newContract, error: ctrErr } = await admin
          .from('fpe_contracts')
          .insert({ award_id: awardId, contenido_json: contenido, status: 'draft' })
          .select('id')
          .single()
        if (ctrErr || !newContract) continue
        contractId = newContract.id
        created++
      }

      // 5. Materialize payment schedule (if governing discipline + milestones present)
      if (pkg.governing_discipline_id && pkg.payment_milestones.length > 0) {
        // Wipe existing schedule rows for this contract to keep things idempotent
        await admin
          .from('fpe_contract_payment_schedule')
          .delete()
          .eq('contract_id', contractId)

        const scheduleRows = pkg.payment_milestones.map((m, idx) => ({
          contract_id: contractId,
          nombre:      m.nombre,
          pct:         m.pct,
          monto:       m.monto,
          status:      'pendiente',
          orden:       idx,
        }))
        if (scheduleRows.length > 0) {
          await admin.from('fpe_contract_payment_schedule').insert(scheduleRows)
        }
      }

      // 6. Generate PDF + send to DocuSign (best-effort, non-fatal per partner)
      try {
        if (existingContract && existingContract.status !== 'draft') {
          // Contract already signed/sent → skip
          continue
        }
        const { generateFpeContractPDF } = await import('@/components/pdfs/FpeContractPDF')
        const pdfBuffer = await generateFpeContractPDF(contenido)

        const { createAndSendEnvelope } = await import('@/lib/docusign/client')
        const webhookUrl = `${SITE_URL}/api/webhooks/docusign`

        if (pkg.partner_email) {
          const { envelopeId } = await createAndSendEnvelope({
            contratoId: contractId,
            numero:     `FPE-${project.nombre}-${pkg.partner_nombre}`,
            pdfBuffer,
            signers: {
              cliente: { email: pkg.partner_email, name: pkg.partner_nombre },
              estudio: { email: 'contacto@formaprima.es', name: 'Forma Prima' },
            },
            webhookUrl,
          })

          await admin
            .from('fpe_contracts')
            .update({ docusign_envelope_id: envelopeId, status: 'sent_to_sign', sent_at: new Date().toISOString() })
            .eq('id', contractId)
          sentToDocusign++
        }
      } catch (err) {
        console.error(`[generateContractsFromAwards] DocuSign error for ${pkg.partner_nombre}:`, err)
        // Non-fatal: contract is created, DocuSign can be retried
      }
    }

    // ── Move project status to 'awarded' if not already past that ───────────
    await admin.from('fpe_projects').update({ status: 'awarded' }).eq('id', project_id).eq('status', 'tender_launched')

    revalidatePath(`${LIST_PATH}/${project_id}`)
    revalidatePath('/team/fp-execution/control-room')
    return { success: true, created, sent_to_docusign: sentToDocusign }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Adjudication Overview (Final step before contracts) ──────────────────────
// Aggregates all per-UE awards by partner. Each partner card shows:
//   - the pack of UEs they won (grouped by chapter)
//   - per-UE prices and totals
//   - aggregated total
//   - governing discipline (auto-derived: dominant in the pack, override at contract time)
//   - discipline breakdown
//   - payment milestones preview (from governing discipline)

export interface FpeOverviewLineItem {
  nombre:          string
  unidad_medida:   string
  cantidad:        number
  precio_unitario: number
  total:           number
}

export interface FpeOverviewUnit {
  project_unit_id: string
  unit_nombre:     string
  total:           number
  days:            number | null
  line_items:      FpeOverviewLineItem[]
}

export interface FpeOverviewChapter {
  chapter_id:     string
  chapter_nombre: string
  units:          FpeOverviewUnit[]
}

export interface FpeOverviewDiscipline {
  id:     string
  nombre: string
  color:  string
  count:  number
}

export interface FpeOverviewPaymentMilestone {
  nombre:       string
  pct:          number
  monto:        number
  trigger_type: string
}

export interface FpeOverviewPartner {
  partner_id:              string
  partner_nombre:          string
  partner_email:           string | null
  total:                   number
  governing_discipline_id: string | null
  governing_discipline_nombre: string | null
  disciplines:             FpeOverviewDiscipline[]
  chapters:                FpeOverviewChapter[]
  payment_milestones:      FpeOverviewPaymentMilestone[]
}

export async function getAdjudicationOverview(
  project_id: string
): Promise<{ partners: FpeOverviewPartner[] } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // 1. Per-unit awards
    const { data: awardsRaw, error: awardsErr } = await admin
      .from('fpe_project_unit_awards')
      .select('project_unit_id, bid_id, partner_id, partner:fpe_partners(nombre, email_contacto, email_notificaciones)')
      .eq('project_id', project_id)

    if (awardsErr) return { error: awardsErr.message }
    if (!awardsRaw || awardsRaw.length === 0) return { partners: [] }

    type AwardRaw = {
      project_unit_id: string
      bid_id:          string
      partner_id:      string
      partner: { nombre: string; email_contacto: string | null; email_notificaciones: string | null } | null
    }
    const awards = awardsRaw as unknown as AwardRaw[]

    const bidIds            = Array.from(new Set(awards.map(a => a.bid_id)))
    const awardedUnitIds    = awards.map(a => a.project_unit_id)

    // 2. Bid line items for awarded bids (prices)
    const { data: bidLineItemsRaw } = await admin
      .from('fpe_bid_line_items')
      .select('bid_id, project_line_item_id, precio_unitario')
      .in('bid_id', bidIds)

    type BidLI = { bid_id: string; project_line_item_id: string; precio_unitario: number }
    const bidLineItems = (bidLineItemsRaw ?? []) as BidLI[]

    // 3. Phase durations (days) for awarded bids + units
    const { data: phaseDurRaw } = await admin
      .from('fpe_bid_phase_durations')
      .select('bid_id, project_unit_id, duracion_dias')
      .in('bid_id', bidIds)
      .in('project_unit_id', awardedUnitIds)

    type PhaseDur = { bid_id: string; project_unit_id: string; duracion_dias: number }
    const phaseDurs = (phaseDurRaw ?? []) as PhaseDur[]

    // 4. Project units (for chapter mapping + line items)
    const { data: unitsRaw } = await admin
      .from('fpe_project_units')
      .select(`
        id, orden,
        template_unit:fpe_template_units (
          id, nombre, chapter_id, principal_discipline_id,
          chapter:fpe_template_chapters ( id, nombre, orden, principal_discipline_id )
        ),
        line_items:fpe_project_line_items (
          id, cantidad,
          template_line_item:fpe_template_line_items ( nombre, unidad_medida, discipline_id )
        )
      `)
      .in('id', awardedUnitIds)

    type UnitRaw = {
      id: string; orden: number
      template_unit: {
        id: string; nombre: string; chapter_id: string; principal_discipline_id: string | null
        chapter: { id: string; nombre: string; orden: number; principal_discipline_id: string | null } | null
      } | null
      line_items: { id: string; cantidad: number; template_line_item: { nombre: string; unidad_medida: string; discipline_id: string | null } | null }[]
    }
    const units = (unitsRaw ?? []) as unknown as UnitRaw[]

    // 5. Disciplines master + payment milestones
    const { data: discsRaw } = await admin
      .from('fpe_disciplines')
      .select('id, nombre, color')
      .eq('activo', true)

    const discById: Record<string, { id: string; nombre: string; color: string }> = {}
    for (const d of (discsRaw ?? [])) discById[d.id] = d

    const { data: milestonesRaw } = await admin
      .from('fpe_discipline_payment_milestones')
      .select('discipline_id, nombre, pct, trigger_type, orden')
      .order('orden', { ascending: true })

    type Milestone = { discipline_id: string; nombre: string; pct: number; trigger_type: string; orden: number }
    const milestones = (milestonesRaw ?? []) as Milestone[]

    // ── Aggregation ──────────────────────────────────────────────────────────

    // Index price by (bid_id, project_line_item_id)
    const priceByBidLi: Record<string, number> = {}
    for (const bli of bidLineItems) priceByBidLi[`${bli.bid_id}:${bli.project_line_item_id}`] = bli.precio_unitario

    // Index days by (bid_id, project_unit_id)
    const daysByBidUnit: Record<string, number> = {}
    for (const pd of phaseDurs) {
      const k = `${pd.bid_id}:${pd.project_unit_id}`
      daysByBidUnit[k] = (daysByBidUnit[k] ?? 0) + pd.duracion_dias
    }

    // Index units
    const unitById: Record<string, UnitRaw> = {}
    for (const u of units) unitById[u.id] = u

    // Group awards by partner
    type PartnerBucket = {
      partner_id: string
      partner_nombre: string
      partner_email: string | null
      total: number
      disciplines: Map<string, FpeOverviewDiscipline>
      // chapter_id → bucket
      chapters: Map<string, {
        chapter_id: string
        chapter_nombre: string
        chapter_orden: number
        units: FpeOverviewUnit[]
      }>
    }
    const partnerBuckets: Map<string, PartnerBucket> = new Map()

    for (const aw of awards) {
      const u = unitById[aw.project_unit_id]
      if (!u || !u.template_unit) continue
      const chMeta = u.template_unit.chapter
      const chId = chMeta?.id ?? '__no_chapter__'
      const chNombre = chMeta?.nombre ?? 'Sin capítulo'
      const chOrden = chMeta?.orden ?? 9999

      const principalDiscId = u.template_unit.principal_discipline_id ?? chMeta?.principal_discipline_id ?? null

      let bucket = partnerBuckets.get(aw.partner_id)
      if (!bucket) {
        bucket = {
          partner_id:     aw.partner_id,
          partner_nombre: aw.partner?.nombre ?? '?',
          partner_email:  aw.partner?.email_contacto ?? aw.partner?.email_notificaciones ?? null,
          total:          0,
          disciplines:    new Map(),
          chapters:       new Map(),
        }
        partnerBuckets.set(aw.partner_id, bucket)
      }

      // Line items
      const lineItems: FpeOverviewLineItem[] = []
      let unitTotal = 0
      for (const li of u.line_items) {
        const price = priceByBidLi[`${aw.bid_id}:${li.id}`]
        if (price === undefined) continue
        const total = price * li.cantidad
        lineItems.push({
          nombre:          li.template_line_item?.nombre ?? '—',
          unidad_medida:   li.template_line_item?.unidad_medida ?? '',
          cantidad:        li.cantidad,
          precio_unitario: price,
          total,
        })
        unitTotal += total
      }
      bucket.total += unitTotal

      // Discipline count
      if (principalDiscId) {
        const d = discById[principalDiscId]
        if (d) {
          const prev = bucket.disciplines.get(d.id)
          if (prev) prev.count++
          else bucket.disciplines.set(d.id, { id: d.id, nombre: d.nombre, color: d.color, count: 1 })
        }
      }

      // Chapter bucket
      let chBucket = bucket.chapters.get(chId)
      if (!chBucket) {
        chBucket = { chapter_id: chId, chapter_nombre: chNombre, chapter_orden: chOrden, units: [] }
        bucket.chapters.set(chId, chBucket)
      }
      chBucket.units.push({
        project_unit_id: aw.project_unit_id,
        unit_nombre:     u.template_unit.nombre,
        total:           unitTotal,
        days:            daysByBidUnit[`${aw.bid_id}:${aw.project_unit_id}`] ?? null,
        line_items:      lineItems,
      })
    }

    // Materialize buckets → output
    const partners: FpeOverviewPartner[] = []

    const bucketArr: PartnerBucket[] = Array.from(partnerBuckets.values())
    for (const bucket of bucketArr) {
      // Derive governing discipline = dominant in pack
      const discList: FpeOverviewDiscipline[] = Array.from(bucket.disciplines.values())
        .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, 'es'))
      const governingId = discList[0]?.id ?? null
      const governingNombre = discList[0]?.nombre ?? null

      // Payment milestones for governing discipline
      const milestonesForGov = governingId
        ? milestones.filter(m => m.discipline_id === governingId).sort((a, b) => a.orden - b.orden)
        : []
      const paymentMilestones: FpeOverviewPaymentMilestone[] = milestonesForGov.map(m => ({
        nombre:       m.nombre,
        pct:          m.pct,
        monto:        Math.round(bucket.total * m.pct) / 100,
        trigger_type: m.trigger_type,
      }))

      type ChapterBucket = { chapter_id: string; chapter_nombre: string; chapter_orden: number; units: FpeOverviewUnit[] }
      const chapterList = (Array.from(bucket.chapters.values()) as ChapterBucket[])
        .sort((a, b) => a.chapter_orden - b.chapter_orden)
        .map(ch => ({
          chapter_id:     ch.chapter_id,
          chapter_nombre: ch.chapter_nombre,
          units:          ch.units,
        }))

      partners.push({
        partner_id:                  bucket.partner_id,
        partner_nombre:              bucket.partner_nombre,
        partner_email:               bucket.partner_email,
        total:                       bucket.total,
        governing_discipline_id:     governingId,
        governing_discipline_nombre: governingNombre,
        disciplines:                 discList,
        chapters:                    chapterList,
        payment_milestones:          paymentMilestones,
      })
    }

    partners.sort((a, b) => a.partner_nombre.localeCompare(b.partner_nombre, 'es'))

    return { partners }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

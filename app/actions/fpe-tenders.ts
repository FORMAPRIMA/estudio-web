'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, wrapEmail } from '@/lib/email'
import { buildContractData, fetchTechnicalDocsForContract } from '@/lib/fp-execution/contractData'
import { loadProjectScheduleInputs, computePartnerPhaseDates } from '@/lib/fp-execution/loadProjectSchedule'

// ── Shared types (used by BidComparison client component) ─────────────────────

export interface ScopeUnitRow {
  unit_id:        string
  unit_nombre:    string
  chapter_id:     string
  chapter_nombre: string
  chapter_orden:  number
  line_items: { id: string; nombre: string; cantidad: number; unidad_medida: string }[]
}

export interface BidPhaseDay {
  phase_id:     string
  phase_nombre: string
  phase_orden:  number
  dias:         number
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
  // chapter_id → desglose de fases con días (las fases viven a nivel capítulo
  // desde fpe_chapter_phases.sql)
  phasesByChapter: Record<string, BidPhaseDay[]>
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

// ── Dream Team — obra start date override ───────────────────────────────────
// Sets / clears fpe_projects.obra_start_date_override. Pass null to clear and
// fall back to fecha_inicio_obra (the parametric Cronograma value).

export async function setDreamTeamObraStartDate(
  project_id: string,
  date: string | null,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Validate ISO date if provided
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: 'Formato de fecha inválido. Esperado YYYY-MM-DD.' }
    }

    const { error } = await admin
      .from('fpe_projects')
      .update({ obra_start_date_override: date, updated_at: new Date().toISOString() })
      .eq('id', project_id)

    if (error) return { error: error.message }
    revalidatePath(`${LIST_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
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

// Autosave de fecha límite desde el TenderPanel. Si no hay tender, crea uno
// en estado 'draft' para persistir la fecha. Si hay tender activo (draft,
// launched, closed), actualiza el campo. Cancelados se ignoran.
export async function upsertTenderFechaLimite(
  project_id: string,
  fecha_limite: string,
): Promise<{ success: true; tender_id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('fpe_tenders')
      .select('id')
      .eq('project_id', project_id)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('fpe_tenders')
        .update({ fecha_limite, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) return { error: error.message }
      return { success: true, tender_id: existing.id }
    }

    const { data: created, error: insErr } = await admin
      .from('fpe_tenders')
      .insert({ project_id, fecha_limite, status: 'draft' })
      .select('id')
      .single()
    if (insErr || !created) return { error: insErr?.message ?? 'Error creando licitación.' }
    return { success: true, tender_id: created.id }
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
          template_unit:fpe_template_units (
            nombre, chapter_id,
            chapter:fpe_template_chapters ( nombre, orden )
          ),
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

    // Fetch phase durations for all bids (las fases son a nivel capítulo desde
    // fpe_chapter_phases.sql — project_unit_id es legacy/null, el chapter_id
    // viene de fpe_template_phases).
    const bidIds = (rawBids ?? []).map(b => b.id)
    const { data: phaseDurData } = bidIds.length > 0
      ? await admin
          .from('fpe_bid_phase_durations')
          .select(`
            bid_id, duracion_dias, template_phase_id,
            phase:fpe_template_phases ( nombre, orden, chapter_id )
          `)
          .in('bid_id', bidIds)
      : { data: [] as RawPhaseDur[] }

    type RawPhaseDur = {
      bid_id:            string
      duracion_dias:     number
      template_phase_id: string
      phase: { nombre: string; orden: number; chapter_id: string | null } | null
    }

    // Build scope (con info de capítulo)
    type RawUnit = {
      id: string; orden: number
      template_unit: {
        nombre: string
        chapter_id: string | null
        chapter: { nombre: string; orden: number } | null
      } | null
      line_items: { id: string; cantidad: number; template_line_item: { nombre: string; unidad_medida: string } | null }[]
    }
    const scope: ScopeUnitRow[] = ((projectUnits ?? []) as unknown as RawUnit[])
      .map(pu => ({
        unit_id:        pu.id,
        unit_nombre:    pu.template_unit?.nombre ?? '—',
        chapter_id:     pu.template_unit?.chapter_id ?? '',
        chapter_nombre: pu.template_unit?.chapter?.nombre ?? 'Sin capítulo',
        chapter_orden:  pu.template_unit?.chapter?.orden ?? 9999,
        line_items: pu.line_items.map(li => ({
          id:            li.id,
          nombre:        li.template_line_item?.nombre ?? '—',
          cantidad:      li.cantidad,
          unidad_medida: li.template_line_item?.unidad_medida ?? '',
        })),
      }))
      // Orden estable: capítulo primero, luego orden interno de la UE
      .sort((a, b) => a.chapter_orden - b.chapter_orden)

    // Group: bid_id → chapter_id → phase_id → { nombre, orden, dias }
    // El capítulo se deriva directamente de fpe_template_phases.chapter_id, no
    // del UE: tras la migración a fases por capítulo, project_unit_id es nulo.
    const phasesByBidChapter: Record<string, Record<string, Record<string, BidPhaseDay>>> = {}

    for (const pd of ((phaseDurData ?? []) as unknown as RawPhaseDur[])) {
      const chapterId = pd.phase?.chapter_id
      if (!chapterId) continue

      if (!phasesByBidChapter[pd.bid_id]) phasesByBidChapter[pd.bid_id] = {}
      if (!phasesByBidChapter[pd.bid_id][chapterId]) phasesByBidChapter[pd.bid_id][chapterId] = {}

      const existing = phasesByBidChapter[pd.bid_id][chapterId][pd.template_phase_id]
      if (existing) {
        existing.dias += pd.duracion_dias
      } else {
        phasesByBidChapter[pd.bid_id][chapterId][pd.template_phase_id] = {
          phase_id:     pd.template_phase_id,
          phase_nombre: pd.phase?.nombre ?? '—',
          phase_orden:  pd.phase?.orden ?? 9999,
          dias:         pd.duracion_dias,
        }
      }
    }

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

      // Aplana phasesByBidChapter[bid.id] → phasesByChapter ordenado por phase_orden
      const phasesByChapter: Record<string, BidPhaseDay[]> = {}
      const bucketsForBid = phasesByBidChapter[bid.id] ?? {}
      for (const [chapterId, phaseMap] of Object.entries(bucketsForBid)) {
        phasesByChapter[chapterId] = Object.values(phaseMap)
          .sort((a, b) => a.phase_orden - b.phase_orden)
      }

      return {
        id: bid.id, invitation_id: bid.invitation_id,
        partner_nombre: partner.nombre, partner_email: partner.email_contacto,
        submitted_at: bid.submitted_at, notas: bid.notas, status: bid.status,
        prices, phasesByChapter,
      }
    })

    return { scope, bids }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Partner-based bulk invite ─────────────────────────────────────────────────
// Crea una invitación por partner con sus disciplinas asociadas. Acepta
// directamente partner_id → discipline_ids[] para soportar el caso de varios
// partners que comparten disciplina principal (escenario común: cada UE de
// la misma disciplina puede ir a un partner distinto).

export async function createAndSendDisciplineInvitations(
  project_id:            string,
  fecha_limite:          string,
  partner_disciplines_map: Record<string, string[]>,  // partner_id → discipline_ids[]
  token_expires_days = 21,
): Promise<{ success: true; tender_id: string; sent: number; total: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const partnerDisciplines: Record<string, string[]> = {}
    for (const [pid, dids] of Object.entries(partner_disciplines_map)) {
      if (!pid) continue
      const filtered = (dids ?? []).filter(Boolean)
      if (filtered.length === 0) continue
      partnerDisciplines[pid] = Array.from(new Set(filtered))
    }
    const uniquePartners = Object.keys(partnerDisciplines)
    if (uniquePartners.length === 0) return { error: 'No hay execution partners con disciplinas para invitar.' }

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

    // 3. Fetch project unit IDs + per-partner assignments.
    //    scope_unit_ids debe ser el subset que el manager asignó a CADA partner
    //    en fpe_project_unit_partners. Si dos partners comparten una UE, ambos
    //    deben tener esa UE en su scope (compiten por las mismas partidas).
    const { data: projectUnits } = await admin
      .from('fpe_project_units')
      .select('id')
      .eq('project_id', project_id)

    const projectUnitIds = (projectUnits ?? []).map(u => u.id)

    const { data: unitPartnersRaw } = projectUnitIds.length > 0
      ? await admin
          .from('fpe_project_unit_partners')
          .select('project_unit_id, partner_id')
          .in('project_unit_id', projectUnitIds)
      : { data: [] as { project_unit_id: string; partner_id: string }[] }

    const unitIdsByPartner: Record<string, string[]> = {}
    for (const row of unitPartnersRaw ?? []) {
      if (!unitIdsByPartner[row.partner_id]) unitIdsByPartner[row.partner_id] = []
      unitIdsByPartner[row.partner_id].push(row.project_unit_id)
    }

    // 4. Carga invitaciones ya existentes (incluye las 'pending' creadas desde
    //    "Personalizar plan" antes de lanzar). Mapeamos por partner_id para
    //    decidir si crear nueva o reusar/mandar email a la existente.
    type ExistingInv = { id: string; partner_id: string; status: string; token: string; token_expires_at: string }
    const { data: existingInvs } = await admin
      .from('fpe_tender_invitations')
      .select('id, partner_id, status, token, token_expires_at')
      .eq('tender_id', tenderId)
      .not('status', 'in', '("revoked","expired")')

    const existingByPartner = new Map<string, ExistingInv>()
    for (const e of (existingInvs ?? []) as ExistingInv[]) {
      existingByPartner.set(e.partner_id, e)
    }
    // Partners cuya invitación ya está sent/viewed/bid_submitted → no re-mandar.
    const alreadySent = new Set(
      (existingInvs ?? [])
        .filter(e => ['sent', 'viewed', 'bid_submitted'].includes(e.status))
        .map(e => e.partner_id)
    )

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
      if (alreadySent.has(partnerId)) continue

      const disciplineIds = partnerDisciplines[partnerId]
      const partnerUnitIds = unitIdsByPartner[partnerId] ?? []
      if (partnerUnitIds.length === 0) continue   // sin UEs asignadas → skip

      // Reusa invitación pending pre-creada desde "Personalizar plan" (su plan
      // ya fue sembrado y posiblemente editado). Si no existe, créala ahora.
      let inv: { id: string; token: string; token_expires_at: string } | null = null
      const existing = existingByPartner.get(partnerId)

      if (existing && existing.status === 'pending') {
        // Actualiza fecha de expiración (puede haber estado mucho tiempo pending)
        // y refresca discipline_ids/scope por si cambiaron.
        await admin
          .from('fpe_tender_invitations')
          .update({
            scope_unit_ids:   partnerUnitIds,
            discipline_ids:   disciplineIds,
            token_expires_at: expires,
          })
          .eq('id', existing.id)
        inv = { id: existing.id, token: existing.token, token_expires_at: expires }
      } else {
        const { data: newInv, error: invErr } = await admin
          .from('fpe_tender_invitations')
          .insert({
            tender_id:        tenderId,
            partner_id:       partnerId,
            scope_unit_ids:   partnerUnitIds,
            discipline_ids:   disciplineIds,
            token_expires_at: expires,
            status:           'pending',
          })
          .select('id, token, token_expires_at')
          .single()
        if (invErr || !newInv) continue
        inv = newInv

        // Seed automático del plan de pago (solo para invitaciones nuevas;
        // las pending pre-existentes ya tienen su plan sembrado).
        try {
          const mod = await import('./fpe-payment')
          await mod.regenerateInvitationPaymentPlan(inv.id, 'dominant')
        } catch {
          // ignorar
        }
      }

      if (!inv) continue

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

// Adjudica todo un capítulo (todas sus UEs) al mismo bid en una sola operación.
// Valida que el bid cubra todas las partidas de todas las UEs del capítulo
// antes de escribir nada.
export async function awardChapter(data: {
  project_id: string
  chapter_id: string
  bid_id:     string
}): Promise<{ success: true; awarded: number } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    // 1. Partner detrás del bid
    const { data: bid, error: bidErr } = await admin
      .from('fpe_bids')
      .select('id, invitation:fpe_tender_invitations(partner_id), line_items:fpe_bid_line_items(project_line_item_id)')
      .eq('id', data.bid_id)
      .single()
    if (bidErr || !bid) return { error: bidErr?.message ?? 'Oferta no encontrada.' }

    type RawBid = {
      id: string
      invitation: { partner_id: string } | null
      line_items: { project_line_item_id: string }[]
    }
    const rawBid    = bid as unknown as RawBid
    const partnerId = rawBid.invitation?.partner_id
    if (!partnerId) return { error: 'No se pudo derivar el partner del bid.' }

    const pricedItemIds = new Set(rawBid.line_items.map(li => li.project_line_item_id))

    // 2. UEs del capítulo en este proyecto + sus partidas
    const { data: unitsRaw } = await admin
      .from('fpe_project_units')
      .select(`
        id,
        template_unit:fpe_template_units!inner ( chapter_id ),
        line_items:fpe_project_line_items ( id )
      `)
      .eq('project_id', data.project_id)
      .eq('template_unit.chapter_id', data.chapter_id)

    type RawChapUnit = {
      id: string
      template_unit: { chapter_id: string } | null
      line_items: { id: string }[]
    }
    const units = (unitsRaw ?? []) as unknown as RawChapUnit[]
    if (units.length === 0) return { error: 'El capítulo no tiene UEs en este proyecto.' }

    // 3. Validar cobertura total
    for (const u of units) {
      for (const li of u.line_items) {
        if (!pricedItemIds.has(li.id)) {
          return { error: 'El partner no cubre todas las partidas del capítulo.' }
        }
      }
    }

    // 4. Upsert por cada UE
    const rows = units.map(u => ({
      project_id:      data.project_id,
      project_unit_id: u.id,
      bid_id:          data.bid_id,
      partner_id:      partnerId,
      awarded_by:      user.id,
      awarded_at:      new Date().toISOString(),
    }))

    const { error } = await admin
      .from('fpe_project_unit_awards')
      .upsert(rows, { onConflict: 'project_id,project_unit_id' })
    if (error) return { error: error.message }

    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true, awarded: rows.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function revertChapterAward(data: {
  project_id: string
  chapter_id: string
}): Promise<{ success: true; reverted: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    const { data: unitsRaw } = await admin
      .from('fpe_project_units')
      .select('id, template_unit:fpe_template_units!inner ( chapter_id )')
      .eq('project_id', data.project_id)
      .eq('template_unit.chapter_id', data.chapter_id)

    type RawChapUnit = { id: string; template_unit: { chapter_id: string } | null }
    const unitIds = ((unitsRaw ?? []) as unknown as RawChapUnit[]).map(u => u.id)
    if (unitIds.length === 0) return { success: true, reverted: 0 }

    const { error, count } = await admin
      .from('fpe_project_unit_awards')
      .delete({ count: 'exact' })
      .eq('project_id', data.project_id)
      .in('project_unit_id', unitIds)
    if (error) return { error: error.message }

    revalidatePath(`${LIST_PATH}/${data.project_id}`)
    return { success: true, reverted: count ?? 0 }
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
  project_id: string,
  partner_id?: string,
): Promise<{ success: true; created: number; sent_to_docusign: number } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    // ── Reuse the overview action to get fully structured data ──────────────
    const overview = await getAdjudicationOverview(project_id)
    if ('error' in overview) return { error: overview.error }
    if (overview.partners.length === 0) return { error: 'No hay UEs adjudicadas todavía.' }

    // If partner_id is provided, restrict the loop to that partner only.
    const partnersToProcess = partner_id
      ? overview.partners.filter(p => p.partner_id === partner_id)
      : overview.partners
    if (partnersToProcess.length === 0) return { error: 'Partner sin UEs adjudicadas.' }

    // ── Project info for contract body ──────────────────────────────────────
    const { data: project } = await admin
      .from('fpe_projects')
      .select('id, nombre, descripcion, direccion, ciudad')
      .eq('id', project_id)
      .single()
    if (!project) return { error: 'Proyecto no encontrado.' }

    // ── Load schedule inputs once for the whole project ─────────────────────
    // Used by every partner pack to derive Anexo III dates from the Dream Team
    // Gantt (effective obra start date = override ?? parametric).
    const scheduleInputs = await loadProjectScheduleInputs(admin, project_id)

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
    for (const pkg of partnersToProcess) {
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

      // 3. Build contract data (used both for persistence and PDF generation).
      //    The full FpeContractData shape is stored in contenido_json so the
      //    downstream webhook + signed-pdf flow can read partner/scope details
      //    without re-querying.
      const scope_unit_ids = pkg.chapters.flatMap(ch => ch.units.map(u => u.project_unit_id))

      const [{ data: partnerRow }, technical_docs] = await Promise.all([
        admin
          .from('fpe_partners')
          .select('id, nombre, razon_social, nif_cif, contacto_nombre, email_contacto, telefono, direccion, ciudad, codigo_postal')
          .eq('id', pkg.partner_id)
          .single(),
        fetchTechnicalDocsForContract({ admin, project_id, scope_unit_ids }),
      ])

      const phase_dates = scheduleInputs
        ? (computePartnerPhaseDates({ inputs: scheduleInputs, pkg }) ?? undefined)
        : undefined

      const contenido = buildContractData({
        project: {
          id:        project.id,
          nombre:    project.nombre,
          direccion: project.direccion ?? null,
          ciudad:    project.ciudad ?? null,
        },
        partner:    partnerRow ?? null,
        pkg,
        awarded_at: new Date().toISOString(),
        technical_docs,
        phase_dates,
      })

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
          const safeProject = project.nombre.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
          const safePartner = pkg.partner_nombre.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
          const docNumero   = `FPE-${safeProject}-${safePartner}`

          const { envelopeId } = await createAndSendEnvelope({
            contratoId:   contractId,
            numero:       docNumero,
            pdfBuffer,
            cliente: { email: pkg.partner_email, name: pkg.partner_nombre },
            estudio: { email: 'contacto@formaprima.es', name: 'Forma Prima' },
            webhookUrl,
            emailSubject: `Orden de Ejecución de Obra · ${project.nombre} — FP execution`,
            documentName: `Orden-Ejecucion-${safePartner}`,
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
  id:               string
  nombre:           string
  color:            string
  count:            number
  warranty_months:  number
}

export interface FpeOverviewPaymentMilestone {
  nombre:           string
  pct:              number
  monto:            number
  trigger_type:     string
  milestone_id:     string | null
  /** Nombre del hito de obra concreto (resuelto desde fpe_template_milestones).
   *  Solo está poblado cuando trigger_type='milestone_achieved' y milestone_id no es null. */
  milestone_nombre: string | null
  /** Origen del plan de pago: 'invitation' = el plan editado y comunicado al EP
   *  en su portal de licitación (fpe_invitation_payment_plan);
   *  'discipline' = fallback al master de la disciplina rectora. */
  source:           'invitation' | 'discipline'
}

export type FpeOverviewContractStatus =
  | 'pendiente'       // No contract row yet
  | 'draft'           // Contract row created, not sent to DocuSign
  | 'sent_to_sign'    // Sent to DocuSign, awaiting signatures
  | 'signed'          // DocuSign reportó completed pero aún no descargamos el PDF
  | 'received'        // PDF firmado descargado y guardado en Storage
  | 'cancelled'

export interface FpeOverviewContract {
  id:                    string
  status:                FpeOverviewContractStatus
  sent_at:               string | null
  signed_at:             string | null
  docusign_envelope_id:  string | null
  pdf_signed_path:       string | null
}

export interface FpeOverviewPhaseDuration {
  template_phase_id: string
  phase_nombre:      string
  phase_orden:       number
  chapter_id:        string | null
  chapter_nombre:    string | null
  chapter_orden:     number | null
  duracion_dias:     number
}

export interface FpeOverviewPartner {
  partner_id:              string
  partner_nombre:          string
  partner_email:           string | null
  bid_id:                  string                       // primary bid (for previews + schedule rebuild)
  total:                   number
  governing_discipline_id: string | null
  governing_discipline_nombre: string | null
  disciplines:             FpeOverviewDiscipline[]
  chapters:                FpeOverviewChapter[]
  payment_milestones:      FpeOverviewPaymentMilestone[]
  phase_durations:         FpeOverviewPhaseDuration[]
  contract:                FpeOverviewContract | null
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

    // 3. Phase durations (days) — ahora a nivel capítulo. Tras la migración a
    // fases por capítulo, project_unit_id es NULL en los nuevos bids; el chapter
    // se deriva de fpe_template_phases.chapter_id.
    const { data: phaseDurRaw } = await admin
      .from('fpe_bid_phase_durations')
      .select(`
        bid_id, template_phase_id, duracion_dias,
        phase:fpe_template_phases (
          id, nombre, orden, chapter_id,
          chapter:fpe_template_chapters ( nombre, orden )
        )
      `)
      .in('bid_id', bidIds)

    type PhaseDur = {
      bid_id:            string
      template_phase_id: string
      duracion_dias:     number
      phase: {
        id:         string
        nombre:     string
        orden:      number
        chapter_id: string | null
        chapter:    { nombre: string; orden: number } | null
      } | null
    }
    const phaseDurs = (phaseDurRaw ?? []) as unknown as PhaseDur[]

    // ── 3b. Contracts for this project (joined via fpe_awards → tender) ─────
    const partnerIds = Array.from(new Set(awards.map(a => a.partner_id)))
    const { data: activeTendersRaw } = await admin
      .from('fpe_tenders')
      .select('id')
      .eq('project_id', project_id)
    const activeTenderIds = (activeTendersRaw ?? []).map(t => t.id)

    const { data: contractsRaw } = activeTenderIds.length > 0
      ? await admin
          .from('fpe_awards')
          .select(`
            id, partner_id, bid_id, tender_id,
            contract:fpe_contracts (
              id, status, sent_at, signed_at, docusign_envelope_id, contenido_json
            )
          `)
          .in('tender_id', activeTenderIds)
          .in('partner_id', partnerIds)
      : { data: [] as never[] }

    type AwardWithContract = {
      id:         string
      partner_id: string
      bid_id:     string
      tender_id:  string
      contract: {
        id:                    string
        status:                FpeOverviewContractStatus
        sent_at:               string | null
        signed_at:             string | null
        docusign_envelope_id:  string | null
        contenido_json:        Record<string, unknown> | null
      } | null
    }
    const awardsWithContracts = (contractsRaw ?? []) as unknown as AwardWithContract[]
    const contractByPartner: Record<string, FpeOverviewContract> = {}
    for (const a of awardsWithContracts) {
      if (!a.contract) continue
      const cj = a.contract.contenido_json ?? {}
      contractByPartner[a.partner_id] = {
        id:                   a.contract.id,
        status:               a.contract.status,
        sent_at:              a.contract.sent_at,
        signed_at:            a.contract.signed_at,
        docusign_envelope_id: a.contract.docusign_envelope_id,
        pdf_signed_path:      (cj['pdf_signed_path'] as string | undefined) ?? null,
      }
    }

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
      .select('id, nombre, color, warranty_months')
      .eq('activo', true)

    type DiscRow = { id: string; nombre: string; color: string; warranty_months: number | null }
    const discById: Record<string, { id: string; nombre: string; color: string; warranty_months: number }> = {}
    for (const d of ((discsRaw ?? []) as DiscRow[])) {
      discById[d.id] = { id: d.id, nombre: d.nombre, color: d.color, warranty_months: d.warranty_months ?? 12 }
    }

    const { data: milestonesRaw } = await admin
      .from('fpe_discipline_payment_milestones')
      .select('discipline_id, milestone_id, nombre, pct, trigger_type, orden')
      .order('orden', { ascending: true })

    type Milestone = { discipline_id: string; milestone_id: string | null; nombre: string; pct: number; trigger_type: string; orden: number }
    const milestones = (milestonesRaw ?? []) as Milestone[]

    // 6. Per-invitation payment plan + master milestone names.
    //    The Orden de Ejecución must mirror the exact plan the EP saw in the
    //    licitation portal (fpe_invitation_payment_plan), and must name the
    //    concrete milestone in 'milestone_achieved' triggers.

    const { data: bidRowsRaw } = await admin
      .from('fpe_bids')
      .select('id, invitation_id')
      .in('id', bidIds)
    type BidRow = { id: string; invitation_id: string }
    const invitationIdByBidId = new Map<string, string>()
    for (const b of ((bidRowsRaw ?? []) as BidRow[])) invitationIdByBidId.set(b.id, b.invitation_id)
    const invitationIds = Array.from(new Set(Array.from(invitationIdByBidId.values()).filter(Boolean)))

    const { data: invitationPlanRaw } = invitationIds.length > 0
      ? await admin
          .from('fpe_invitation_payment_plan')
          .select('invitation_id, nombre, pct, trigger_type, milestone_id, orden')
          .in('invitation_id', invitationIds)
          .order('orden', { ascending: true })
      : { data: [] as never[] }

    type InvitationPlanRow = {
      invitation_id: string
      nombre:        string
      pct:           number
      trigger_type:  string
      milestone_id:  string | null
      orden:         number
    }
    const planByInvitation: Record<string, InvitationPlanRow[]> = {}
    for (const p of ((invitationPlanRaw ?? []) as InvitationPlanRow[])) {
      planByInvitation[p.invitation_id] = [...(planByInvitation[p.invitation_id] ?? []), p]
    }

    // Collect milestone_ids referenced by any source and resolve their names.
    const milestoneIdsToResolve = new Set<string>()
    for (const m of milestones) if (m.milestone_id) milestoneIdsToResolve.add(m.milestone_id)
    for (const p of (invitationPlanRaw ?? []) as InvitationPlanRow[]) {
      if (p.milestone_id) milestoneIdsToResolve.add(p.milestone_id)
    }
    const { data: tmRows } = milestoneIdsToResolve.size > 0
      ? await admin
          .from('fpe_template_milestones')
          .select('id, nombre')
          .in('id', Array.from(milestoneIdsToResolve))
      : { data: [] as never[] }
    type TmRow = { id: string; nombre: string }
    const milestoneNombreById: Record<string, string> = {}
    for (const m of ((tmRows ?? []) as TmRow[])) milestoneNombreById[m.id] = m.nombre

    // ── Aggregation ──────────────────────────────────────────────────────────

    // Index price by (bid_id, project_line_item_id)
    const priceByBidLi: Record<string, number> = {}
    for (const bli of bidLineItems) priceByBidLi[`${bli.bid_id}:${bli.project_line_item_id}`] = bli.precio_unitario

    // Index days by (bid_id, chapter_id). El total del capítulo se reparte
    // uniformemente entre sus UEs adjudicadas para producir un proxy por-UE,
    // necesario para el JSON de contrato y el Gantt del Dream Team mientras
    // las fases sigan a nivel capítulo.
    const daysByBidChapter: Record<string, number> = {}
    for (const pd of phaseDurs) {
      const chapterId = pd.phase?.chapter_id
      if (!chapterId) continue
      const k = `${pd.bid_id}:${chapterId}`
      daysByBidChapter[k] = (daysByBidChapter[k] ?? 0) + pd.duracion_dias
    }

    // Index units
    const unitById: Record<string, UnitRaw> = {}
    for (const u of units) unitById[u.id] = u

    // Cuántas UEs adjudicadas tiene cada (bid, capítulo) — para repartir
    // los días del capítulo proporcionalmente entre sus UEs.
    const awardedUnitsByBidChapter: Record<string, number> = {}
    for (const aw of awards) {
      const u = unitById[aw.project_unit_id]
      const chapterId = u?.template_unit?.chapter_id
      if (!chapterId) continue
      const k = `${aw.bid_id}:${chapterId}`
      awardedUnitsByBidChapter[k] = (awardedUnitsByBidChapter[k] ?? 0) + 1
    }
    const perUnitDays = (bidId: string, chapterId: string): number | null => {
      const k = `${bidId}:${chapterId}`
      const total = daysByBidChapter[k]
      const count = awardedUnitsByBidChapter[k]
      if (!total || !count) return null
      return Math.round((total / count) * 10) / 10
    }

    // Group awards by partner
    type PartnerBucket = {
      partner_id: string
      partner_nombre: string
      partner_email: string | null
      bid_id: string
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
          bid_id:         aw.bid_id,
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
          else bucket.disciplines.set(d.id, { id: d.id, nombre: d.nombre, color: d.color, count: 1, warranty_months: d.warranty_months })
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
        days:            perUnitDays(aw.bid_id, u.template_unit.chapter_id ?? ''),
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

      // Payment milestones — prefer the per-invitation plan (what the EP
      // actually saw in the licitation portal). Fall back to the governing
      // discipline master only when the invitation has no edited plan.
      const invitationId = invitationIdByBidId.get(bucket.bid_id) ?? null
      const invitationPlan = invitationId ? (planByInvitation[invitationId] ?? []) : []

      let paymentMilestones: FpeOverviewPaymentMilestone[]
      if (invitationPlan.length > 0) {
        paymentMilestones = invitationPlan
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map(p => ({
            nombre:           p.nombre,
            pct:              p.pct,
            monto:            Math.round(bucket.total * p.pct) / 100,
            trigger_type:     p.trigger_type,
            milestone_id:     p.milestone_id,
            milestone_nombre: p.milestone_id ? (milestoneNombreById[p.milestone_id] ?? null) : null,
            source:           'invitation',
          }))
      } else {
        const milestonesForGov = governingId
          ? milestones.filter(m => m.discipline_id === governingId).sort((a, b) => a.orden - b.orden)
          : []
        paymentMilestones = milestonesForGov.map(m => ({
          nombre:           m.nombre,
          pct:              m.pct,
          monto:            Math.round(bucket.total * m.pct) / 100,
          trigger_type:     m.trigger_type,
          milestone_id:     m.milestone_id,
          milestone_nombre: m.milestone_id ? (milestoneNombreById[m.milestone_id] ?? null) : null,
          source:           'discipline',
        }))
      }

      // Phase durations for this partner's bid, enriched with phase + chapter
      // names. Used by the Orden de Ejecución Anexo III to list every awarded
      // execution phase individually.
      const partnerPhaseDurs: FpeOverviewPhaseDuration[] = phaseDurs
        .filter(pd => pd.bid_id === bucket.bid_id)
        .map(pd => ({
          template_phase_id: pd.template_phase_id,
          phase_nombre:      pd.phase?.nombre ?? 'Fase de ejecución',
          phase_orden:       pd.phase?.orden ?? 9999,
          chapter_id:        pd.phase?.chapter_id ?? null,
          chapter_nombre:    pd.phase?.chapter?.nombre ?? null,
          chapter_orden:     pd.phase?.chapter?.orden ?? null,
          duracion_dias:     pd.duracion_dias,
        }))
        .sort((a, b) => (a.chapter_orden ?? 9999) - (b.chapter_orden ?? 9999) || a.phase_orden - b.phase_orden)

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
        bid_id:                      bucket.bid_id,
        total:                       bucket.total,
        governing_discipline_id:     governingId,
        governing_discipline_nombre: governingNombre,
        disciplines:                 discList,
        chapters:                    chapterList,
        payment_milestones:          paymentMilestones,
        phase_durations:             partnerPhaseDurs,
        contract:                    contractByPartner[bucket.partner_id] ?? null,
      })
    }

    partners.sort((a, b) => a.partner_nombre.localeCompare(b.partner_nombre, 'es'))

    return { partners }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

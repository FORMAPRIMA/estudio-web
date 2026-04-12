import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PortalPage from '@/components/fp-execution-portal/PortalPage'
import { computeParametricSchedule, type ScheduleChapter } from '@/lib/fp-execution/schedule'

export default async function ExecutionPortalTokenPage({
  params,
}: {
  params: { token: string }
}) {
  const admin = createAdminClient()

  // ── Verify token ────────────────────────────────────────────────────────────
  const { data: inv } = await admin
    .from('fpe_tender_invitations')
    .select(`
      id, token, token_expires_at, scope_unit_ids, discipline_ids, status,
      sent_at, viewed_at, bid_submitted_at,
      partner:fpe_partners ( id, nombre, contacto_nombre, email_contacto ),
      tender:fpe_tenders (
        id, descripcion, fecha_limite, status,
        project:fpe_projects (
          id, nombre, descripcion, direccion, ciudad, tour_virtual_url,
          fecha_inicio_obra, duracion_obra_semanas
        )
      )
    `)
    .eq('token', params.token)
    .single()

  if (!inv) return notFound()

  // Expired or revoked
  const expired = new Date(inv.token_expires_at) < new Date()
  const revoked = inv.status === 'revoked'

  if (!expired && !revoked && !inv.viewed_at) {
    // Mark as viewed
    await admin
      .from('fpe_tender_invitations')
      .update({ status: inv.status === 'sent' ? 'viewed' : inv.status, viewed_at: new Date().toISOString() })
      .eq('id', inv.id)
  }

  const partner = inv.partner as unknown as { id: string; nombre: string; contacto_nombre: string | null; email_contacto: string | null }
  const tender  = inv.tender  as unknown as { id: string; descripcion: string | null; fecha_limite: string; status: string; project: { id: string; nombre: string; descripcion: string | null; direccion: string | null; ciudad: string | null; tour_virtual_url: string | null; fecha_inicio_obra: string | null; duracion_obra_semanas: number | null } }

  if (expired || revoked) {
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '48px 40px', maxWidth: 460, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #E8E6E0' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22 }}>
            ×
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#1A1A1A' }}>
            Enlace {revoked ? 'revocado' : 'expirado'}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            {revoked
              ? 'Este enlace de invitación ha sido revocado. Contacta con el equipo de Forma Prima para más información.'
              : 'Este enlace de invitación ha caducado. Si necesitas acceso, contacta con el equipo de Forma Prima.'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#AAA' }}>
            <a href="mailto:contacto@formaprima.es" style={{ color: '#D85A30', textDecoration: 'none' }}>contacto@formaprima.es</a>
          </p>
        </div>
      </div>
    )
  }

  // ── Fetch project scope (only invited units) ────────────────────────────────
  const scopeUnitIds: string[] = inv.scope_unit_ids as string[]

  const [{ data: projectUnits }, { data: documents }, { data: existingBid }, { data: questions }] = await Promise.all([
    // Fetch only the project_units that are in this invitation's scope
    admin
      .from('fpe_project_units')
      .select(`
        id, template_unit_id, notas,
        template_unit:fpe_template_units (
          id, nombre, descripcion,
          line_items:fpe_template_line_items ( id, nombre, unidad_medida, orden, activo, discipline_id )
        ),
        line_items:fpe_project_line_items (
          id, cantidad, notas,
          template_line_item:fpe_template_line_items ( id, nombre, unidad_medida, discipline_id )
        )
      `)
      .in('id', scopeUnitIds.length > 0 ? scopeUnitIds : ['00000000-0000-0000-0000-000000000000'])
      .order('orden', { ascending: true }),

    // General docs + docs for scope units
    admin
      .from('fpe_documents')
      .select('id, nombre, storage_path, mime_type, size_bytes, discipline_tags, created_at, project_unit_id')
      .eq('project_id', tender.project.id)
      .or(
        scopeUnitIds.length > 0
          ? `project_unit_id.is.null,project_unit_id.in.(${scopeUnitIds.join(',')})`
          : 'project_unit_id.is.null'
      )
      .order('created_at', { ascending: false }),

    // Existing bid (if any)
    admin
      .from('fpe_bids')
      .select(`
        id, notas, status, submitted_at,
        line_items:fpe_bid_line_items (
          id, project_line_item_id, precio_unitario, notas
        ),
        phase_durations:fpe_bid_phase_durations (
          id, template_phase_id, duracion_dias
        )
      `)
      .eq('invitation_id', inv.id)
      .maybeSingle(),

    // Q&A for this tender
    admin
      .from('fpe_tender_questions')
      .select('id, partner_nombre, pregunta, respuesta, asked_at, answered_at, answered_by_name')
      .eq('tender_id', tender.id)
      .order('asked_at', { ascending: true }),
  ])

  const tenderClosed = tender.status === 'closed' || tender.status === 'cancelled'
  const deadlinePassed = new Date(tender.fecha_limite) < new Date()

  // ── Discipline filtering ─────────────────────────────────────────────────────
  // discipline_ids on the invitation: if non-empty, filter line items to those disciplines only
  const invDisciplineIds: string[] = (inv.discipline_ids as string[] | null) ?? []

  type RawPU = {
    id: string
    template_unit_id: string
    notas: string | null
    template_unit: {
      id: string
      nombre: string
      descripcion: string | null
      line_items: { id: string; nombre: string; unidad_medida: string; orden: number; activo: boolean; discipline_id: string | null }[]
    }
    line_items: {
      id: string
      cantidad: number | null
      notas: string | null
      template_line_item: { id: string; nombre: string; unidad_medida: string; discipline_id: string | null }
    }[]
  }

  const filteredProjectUnits: RawPU[] = ((projectUnits ?? []) as unknown as RawPU[]).map(pu => {
    if (invDisciplineIds.length === 0) return pu
    return {
      ...pu,
      template_unit: {
        ...pu.template_unit,
        line_items: pu.template_unit.line_items.filter(li =>
          li.discipline_id === null || invDisciplineIds.includes(li.discipline_id)
        ),
      },
      line_items: pu.line_items.filter(pli =>
        pli.template_line_item.discipline_id === null ||
        invDisciplineIds.includes(pli.template_line_item.discipline_id)
      ),
    }
  })

  // ── Chapter-level schedule + principal discipline ────────────────────────────
  const scopedTemplateUnitIds  = filteredProjectUnits.map(pu => pu.template_unit_id)

  // Fetch the scoped chapters (chapters that contain any scoped unit)
  const [{ data: portalChaptersRaw }, { data: portalPhasesRaw }, { data: portalPhaseLinks }, { data: portalMilestones }, { data: portalChapterSettings }] =
    scopedTemplateUnitIds.length > 0
      ? await Promise.all([
          // Chapters that contain scoped units (with duracion_pct + principal_discipline_id)
          admin
            .from('fpe_template_chapters')
            .select('id, nombre, orden, duracion_pct, principal_discipline_id')
            .filter('id', 'in', `(${
              // We need the chapter IDs. Derive them from the invitation's project units.
              // Re-fetch units to get chapter_id.
              (await admin.from('fpe_template_units').select('chapter_id').in('id', scopedTemplateUnitIds))
                .data?.map(u => u.chapter_id).filter(Boolean).join(',') ?? 'null'
            })`),
          admin.from('fpe_template_phases').select('id, chapter_id, nombre, orden, lead_time_days, duracion_pct').order('orden', { ascending: true }),
          admin.from('fpe_template_phase_milestone_links').select('phase_id, milestone_id, link_type'),
          admin.from('fpe_template_milestones').select('id, nombre, orden').order('orden', { ascending: true }),
          // Project-level principal discipline overrides
          admin.from('fpe_project_chapter_settings')
            .select('chapter_id, principal_discipline_id')
            .eq('project_id', tender.project.id),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  // Build chapter_id set from scoped units
  const { data: unitChapterRows } = await admin
    .from('fpe_template_units').select('id, chapter_id').in('id', scopedTemplateUnitIds)
  const unitToChapterId: Record<string, string> = {}
  for (const r of unitChapterRows ?? []) if (r.chapter_id) unitToChapterId[r.id] = r.chapter_id
  const scopedChapterIds = Array.from(new Set(Object.values(unitToChapterId)))

  // Effective principal discipline per chapter
  // 1. Template default (from chapter.principal_discipline_id)
  // 2. Project override (from fpe_project_chapter_settings)
  const projectChapterSettings: Record<string, string | null> = {}
  for (const cs of portalChapterSettings ?? []) projectChapterSettings[cs.chapter_id] = cs.principal_discipline_id

  const chaptersWithPrincipal = (portalChaptersRaw ?? []).filter(ch => scopedChapterIds.includes(ch.id)).map(ch => ({
    ...ch,
    effective_principal: projectChapterSettings[ch.id] !== undefined
      ? projectChapterSettings[ch.id]
      : (ch as unknown as { principal_discipline_id: string | null }).principal_discipline_id,
  }))

  // isPrincipalForChapterIds: chapter IDs where this partner's disciplines include the effective principal
  const isPrincipalForChapterIds: string[] = invDisciplineIds.length > 0
    ? chaptersWithPrincipal
        .filter(ch => ch.effective_principal && invDisciplineIds.includes(ch.effective_principal))
        .map(ch => ch.id)
    : chaptersWithPrincipal.map(ch => ch.id) // backward compat: no filter → principal for all

  // Build phase milestone maps
  const portalAchievesMap: Record<string, string[]> = {}
  const portalRequiresMap: Record<string, string[]> = {}
  for (const link of portalPhaseLinks ?? []) {
    if (link.link_type === 'achieves') portalAchievesMap[link.phase_id] = [...(portalAchievesMap[link.phase_id] ?? []), link.milestone_id]
    else portalRequiresMap[link.phase_id] = [...(portalRequiresMap[link.phase_id] ?? []), link.milestone_id]
  }

  // Group phases by chapter_id (only for scoped chapters)
  const portalPhasesByChapter: Record<string, typeof portalPhasesRaw> = {}
  for (const ph of portalPhasesRaw ?? []) {
    if (!ph.chapter_id || !scopedChapterIds.includes(ph.chapter_id)) continue
    portalPhasesByChapter[ph.chapter_id] = [...(portalPhasesByChapter[ph.chapter_id] ?? []), ph]
  }

  // Build ScheduleChapter[] for parametric schedule
  const portalScheduleChapters: ScheduleChapter[] = chaptersWithPrincipal.map(ch => ({
    id:           ch.id,
    nombre:       ch.nombre,
    orden:        ch.orden,
    duracion_pct: (ch as unknown as { duracion_pct: number | null }).duracion_pct ?? 0,
    phases: (portalPhasesByChapter[ch.id] ?? []).map(ph => ({
      id:           ph.id,
      chapter_id:   ph.chapter_id ?? ch.id,
      nombre:       ph.nombre,
      orden:        ph.orden,
      duracion_pct: ph.duracion_pct ?? 0,
      achieves:     portalAchievesMap[ph.id] ?? [],
      requires:     portalRequiresMap[ph.id] ?? [],
    })),
  }))

  // Portal chapters to pass down (with phases + lead_time_days for phase duration inputs)
  const portalChaptersForUI = chaptersWithPrincipal.map(ch => ({
    id:   ch.id,
    nombre: ch.nombre,
    isPrincipal: isPrincipalForChapterIds.includes(ch.id),
    phases: (portalPhasesByChapter[ch.id] ?? [])
      .sort((a, b) => a.orden - b.orden)
      .map(ph => ({
        id:             ph.id,
        nombre:         ph.nombre,
        orden:          ph.orden,
        lead_time_days: ph.lead_time_days,
      })),
  }))

  const { fecha_inicio_obra, duracion_obra_semanas } = tender.project
  const portalSchedule = fecha_inicio_obra && duracion_obra_semanas && duracion_obra_semanas > 0
    ? computeParametricSchedule(portalScheduleChapters, new Date(fecha_inicio_obra), duracion_obra_semanas)
    : null

  // Map phaseId → ISO start date string (only start date goes to portal, no durations)
  const phaseStartDates: Record<string, string> = {}
  if (portalSchedule) {
    for (const [phId, entry] of Object.entries(portalSchedule)) {
      phaseStartDates[phId] = entry.startDate.toISOString()
    }
  }

  // Generate signed URLs for image docs (hero renders, max 8, 4-hour TTL)
  const IMAGE_EXTS = ['jpg','jpeg','png','webp','svg','gif']
  const allDocs = documents ?? []
  const imageDocs = allDocs.filter(d =>
    d.mime_type?.startsWith('image/') ||
    IMAGE_EXTS.some(ext => d.nombre.toLowerCase().endsWith(`.${ext}`))
  ).slice(0, 8)

  const renderUrls = (await Promise.all(
    imageDocs.map(async d => {
      const { data } = await admin.storage.from('fpe-documents').createSignedUrl(d.storage_path, 4 * 60 * 60)
      return data?.signedUrl ?? null
    })
  )).filter((u): u is string => !!u)

  return (
    <PortalPage
      token={params.token}
      partner={partner}
      project={tender.project}
      tender={{ id: tender.id, descripcion: tender.descripcion, fecha_limite: tender.fecha_limite, status: tender.status }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      projectUnits={filteredProjectUnits as any}
      documents={allDocs}
      existingBid={existingBid ?? null}
      isReadOnly={tenderClosed || deadlinePassed || inv.status === 'bid_submitted'}
      initialQuestions={(questions ?? []) as Parameters<typeof PortalPage>[0]['initialQuestions']}
      renderUrls={renderUrls}
      tourVirtualUrl={tender.project.tour_virtual_url ?? null}
      phaseStartDates={phaseStartDates}
      isPrincipalForChapterIds={isPrincipalForChapterIds}
      portalChapters={portalChaptersForUI}
    />
  )
}

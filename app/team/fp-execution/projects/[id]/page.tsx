import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ProjectScopePage from '@/components/team/fp-execution/ProjectScopePage'
import { computeAndSaveReadiness, ReadinessCheck } from '@/app/actions/fpe-documents'
import type { FpeTender } from '@/components/team/fp-execution/TenderPanel'
import type { ScopedChapter, PartnerForDocs } from '@/components/team/fp-execution/DocumentHub'
import type { ScheduleUnit, ScheduleMilestone } from '@/lib/fp-execution/schedule'

export default async function FpeProjectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const [
    { data: project },
    { data: chapters },
    { data: linkedProyectos },
    { data: docs },
    { data: tender },
    { data: partners },
    { data: milestones },
  ] = await Promise.all([
    supabase
      .from('fpe_projects')
      .select(`
        id, nombre, descripcion, direccion, ciudad,
        linked_proyecto_id, status, readiness_score, created_at,
        tour_virtual_url, fecha_inicio_obra, duracion_obra_semanas,
        project_units:fpe_project_units (
          id, template_unit_id, notas, orden,
          line_items:fpe_project_line_items (
            id, template_line_item_id, cantidad, notas
          )
        )
      `)
      .eq('id', params.id)
      .single(),

    // Full template tree for scope builder + docs tab
    supabase
      .from('fpe_template_chapters')
      .select(`
        id, nombre, orden,
        units:fpe_template_units (
          id, nombre, descripcion, orden, activo,
          line_items:fpe_template_line_items (
            id, nombre, descripcion, unidad_medida, orden, activo
          )
        )
      `)
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units', ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units.fpe_template_line_items', ascending: true }),

    supabase
      .from('proyectos')
      .select('id, nombre, codigo')
      .order('nombre', { ascending: true }),

    admin
      .from('fpe_documents')
      .select('id, project_id, project_unit_id, chapter_id, nombre, storage_path, mime_type, size_bytes, discipline_tags, uploaded_by, created_at')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false }),

    // Latest tender for this project (with invitations + partner info)
    admin
      .from('fpe_tenders')
      .select(`
        id, descripcion, fecha_limite, status, launched_at, closed_at, created_at,
        invitations:fpe_tender_invitations (
          id, token, status, scope_unit_ids, token_expires_at,
          sent_at, viewed_at, bid_submitted_at,
          partner:fpe_partners ( id, nombre, email_contacto )
        )
      `)
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Active partners with unit capabilities (for docs tab partner filtering)
    admin
      .from('fpe_partners')
      .select('id, nombre, email_contacto, telefono, capabilities:fpe_partner_capabilities(unit_id)')
      .eq('activo', true)
      .order('nombre', { ascending: true }),

    // Milestones for schedule
    supabase
      .from('fpe_template_milestones')
      .select('id, nombre, orden')
      .order('orden', { ascending: true }),
  ])

  if (!project) notFound()

  // ── Schedule data: phases + milestone links for scoped template units ────────
  const scopedTemplateUnitIds = (project.project_units ?? []).map(pu => pu.template_unit_id)

  const [{ data: schedulePhasesRaw }, { data: schedulePhaseLinks }, { data: scheduleUnitsRaw }] =
    scopedTemplateUnitIds.length > 0
      ? await Promise.all([
          supabase
            .from('fpe_template_phases')
            .select('id, unit_id, nombre, orden, duracion_pct')
            .in('unit_id', scopedTemplateUnitIds)
            .order('orden', { ascending: true }),
          supabase
            .from('fpe_template_phase_milestone_links')
            .select('phase_id, milestone_id, link_type'),
          supabase
            .from('fpe_template_units')
            .select('id, nombre, orden, duracion_pct')
            .in('id', scopedTemplateUnitIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }]

  // Build achieves/requires maps
  const schedAchievesMap: Record<string, string[]> = {}
  const schedRequiresMap: Record<string, string[]> = {}
  for (const link of schedulePhaseLinks ?? []) {
    if (link.link_type === 'achieves') {
      schedAchievesMap[link.phase_id] = [...(schedAchievesMap[link.phase_id] ?? []), link.milestone_id]
    } else {
      schedRequiresMap[link.phase_id] = [...(schedRequiresMap[link.phase_id] ?? []), link.milestone_id]
    }
  }

  // Group phases by unit
  const phasesByUnit: Record<string, typeof schedulePhasesRaw> = {}
  for (const ph of schedulePhasesRaw ?? []) {
    phasesByUnit[ph.unit_id] = [...(phasesByUnit[ph.unit_id] ?? []), ph]
  }

  const scheduleUnits: ScheduleUnit[] = (scheduleUnitsRaw ?? []).map(u => ({
    id: u.id,
    nombre: u.nombre,
    orden: u.orden,
    duracion_pct: u.duracion_pct ?? 0,
    phases: (phasesByUnit[u.id] ?? []).map(ph => ({
      id: ph.id,
      unit_id: ph.unit_id,
      nombre: ph.nombre,
      orden: ph.orden,
      duracion_pct: ph.duracion_pct ?? 0,
      achieves: schedAchievesMap[ph.id] ?? [],
      requires: schedRequiresMap[ph.id] ?? [],
    })),
  }))

  // Generate signed URLs for render images (used by Dashboard hero gallery)
  // Prefer docs tagged 'render'; fall back to any image doc without unit/chapter
  const IMAGE_EXTS = ['jpg','jpeg','png','webp','svg','gif']
  const isImgDoc = (d: { mime_type: string | null; nombre: string }) =>
    d.mime_type?.startsWith('image/') || IMAGE_EXTS.some(ext => d.nombre.toLowerCase().endsWith(`.${ext}`))
  const allImageDocs = (docs ?? []).filter(isImgDoc)
  const taggedRenders = allImageDocs.filter(d => (d.discipline_tags as string[] ?? []).includes('render'))
  const imageDocs = (taggedRenders.length > 0 ? taggedRenders : allImageDocs).slice(0, 8)

  const renderUrls = (await Promise.all(
    imageDocs.map(async d => {
      const { data } = await admin.storage.from('fpe-documents').createSignedUrl(d.storage_path, 4 * 60 * 60)
      return data?.signedUrl ?? null
    })
  )).filter((u): u is string => !!u)

  // Fetch unit_partners now that we have project unit IDs
  const projectUnitIds = (project.project_units ?? []).map(pu => pu.id)
  const { data: unitPartnersRaw } = projectUnitIds.length > 0
    ? await admin
        .from('fpe_project_unit_partners')
        .select('project_unit_id, partner_id')
        .in('project_unit_id', projectUnitIds)
    : { data: [] as { project_unit_id: string; partner_id: string }[] }

  // Compute fresh readiness score
  const readiness = await computeAndSaveReadiness(admin, params.id)

  const checks: ReadinessCheck[] = [
    { key: 'scope',    label: 'Scope definido',         passed: readiness.hasScope,      pts: 20, blocking: true  },
    { key: 'qty',      label: 'Cantidades completadas', passed: readiness.allHaveQty,    pts: 20, blocking: true  },
    { key: 'docs',     label: 'Documentación subida',   passed: readiness.hasDocs,       pts: 30, blocking: true  },
    { key: 'partners', label: 'Partners disponibles',   passed: readiness.partnersReady, pts: 30, blocking: false },
  ]

  // Index project_units by template_unit_id
  const puByTemplateUnitId: Record<string, typeof project.project_units[0]> = {}
  for (const pu of (project.project_units ?? [])) puByTemplateUnitId[pu.template_unit_id] = pu

  // Build scopedChapters for DocumentHub: chapters with ≥1 selected UE
  const scopedChapters: ScopedChapter[] = (chapters ?? [])
    .map(ch => ({
      id:    ch.id,
      nombre: ch.nombre,
      units: ch.units
        .filter(u => u.activo && puByTemplateUnitId[u.id])
        .map(u => {
          const pu = puByTemplateUnitId[u.id]
          return {
            project_unit_id:  pu.id,
            template_unit_id: u.id,
            chapter_id:       ch.id,
            nombre:           u.nombre,
            line_items: u.line_items
              .filter(li => li.activo)
              .map(li => {
                const existing = pu.line_items.find(pli => pli.template_line_item_id === li.id)
                return {
                  template_line_item_id: li.id,
                  nombre:       li.nombre,
                  unidad_medida: li.unidad_medida,
                  cantidad:     existing?.cantidad ?? 0,
                }
              }),
          }
        }),
    }))
    .filter(ch => ch.units.length > 0)

  // Build partnersForDocs: partners with their template_unit_id capabilities
  type PartnerRaw = { id: string; nombre: string; email_contacto: string | null; telefono: string | null; capabilities: { unit_id: string }[] }
  const partnersForDocs: PartnerForDocs[] = ((partners ?? []) as unknown as PartnerRaw[]).map(p => ({
    id:       p.id,
    nombre:   p.nombre,
    unit_ids: (p.capabilities ?? []).map(c => c.unit_id),
  }))

  // Build unitPartnersMap: project_unit_id → partner_ids[]
  const unitPartnersMap: Record<string, string[]> = {}
  for (const row of (unitPartnersRaw ?? [])) {
    if (!unitPartnersMap[row.project_unit_id]) unitPartnersMap[row.project_unit_id] = []
    unitPartnersMap[row.project_unit_id].push(row.partner_id)
  }

  // Partners for TenderPanel (with telefono, without capabilities field)
  const tendersPartners = ((partners ?? []) as unknown as PartnerRaw[]).map(p => ({
    id:             p.id,
    nombre:         p.nombre,
    email_contacto: p.email_contacto,
    telefono:       p.telefono,
  }))

  type ProjectExtended = typeof project & {
    tour_virtual_url: string | null
    fecha_inicio_obra: string | null
    duracion_obra_semanas: number | null
  }
  const projectExt = project as unknown as ProjectExtended

  return (
    <ProjectScopePage
      project={{ ...project, readiness_score: readiness.score }}
      chapters={chapters ?? []}
      linkedProyectos={linkedProyectos ?? []}
      scopedChapters={scopedChapters}
      partnersForDocs={partnersForDocs}
      initialUnitPartners={unitPartnersMap}
      initialDocs={docs ?? []}
      initialChecks={checks}
      initialTender={(tender ?? null) as unknown as FpeTender | null}
      partners={tendersPartners}
      renderUrls={renderUrls}
      tourVirtualUrl={projectExt.tour_virtual_url ?? null}
      scheduleUnits={scheduleUnits}
      scheduleMilestones={(milestones ?? []) as ScheduleMilestone[]}
      initialFechaInicio={projectExt.fecha_inicio_obra ?? null}
      initialDuracionSemanas={projectExt.duracion_obra_semanas ?? 0}
    />
  )
}

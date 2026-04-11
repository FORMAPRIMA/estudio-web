import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ProjectScopePage from '@/components/team/fp-execution/ProjectScopePage'
import { computeAndSaveReadiness, ReadinessCheck } from '@/app/actions/fpe-documents'
import type { FpeTender } from '@/components/team/fp-execution/TenderPanel'
import type { ScopedChapter, PartnerForDocs } from '@/components/team/fp-execution/DocumentHub'

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
  ] = await Promise.all([
    supabase
      .from('fpe_projects')
      .select(`
        id, nombre, descripcion, direccion, ciudad,
        linked_proyecto_id, status, readiness_score, created_at,
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
      .select('id, nombre, email_contacto, capabilities:fpe_partner_capabilities(unit_id)')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
  ])

  if (!project) notFound()

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
  type PartnerRaw = { id: string; nombre: string; email_contacto: string | null; capabilities: { unit_id: string }[] }
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

  // Partners for TenderPanel (without capabilities field)
  const tendersPartners = ((partners ?? []) as unknown as PartnerRaw[]).map(p => ({
    id:             p.id,
    nombre:         p.nombre,
    email_contacto: p.email_contacto,
  }))

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
    />
  )
}

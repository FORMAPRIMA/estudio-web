import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ProjectScopePage from '@/components/team/fp-execution/ProjectScopePage'
import { computeAndSaveReadiness, ReadinessCheck } from '@/app/actions/fpe-documents'
import type { FpeTender } from '@/components/team/fp-execution/TenderPanel'

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

    // Full template tree for scope builder
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
      .select('id, project_id, project_unit_id, nombre, storage_path, mime_type, size_bytes, discipline_tags, uploaded_by, created_at')
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

    // Active partners for the invite modal
    admin
      .from('fpe_partners')
      .select('id, nombre, email_contacto')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
  ])

  if (!project) notFound()

  // Compute fresh readiness score
  const readiness = await computeAndSaveReadiness(admin, params.id)

  const checks: ReadinessCheck[] = [
    { key: 'scope',    label: 'Scope definido',         passed: readiness.hasScope,      pts: 20, blocking: true  },
    { key: 'qty',      label: 'Cantidades completadas', passed: readiness.allHaveQty,    pts: 20, blocking: true  },
    { key: 'docs',     label: 'Documentación subida',   passed: readiness.hasDocs,       pts: 30, blocking: true  },
    { key: 'partners', label: 'Partners disponibles',   passed: readiness.partnersReady, pts: 30, blocking: false },
  ]

  // Build unit name map from template (project_units don't store the nombre)
  const unitNameMap: Record<string, string> = {}
  for (const ch of (chapters ?? [])) {
    for (const u of ch.units) unitNameMap[u.id] = u.nombre
  }

  // Enrich project_units with template unit nombre for DocumentHub + TenderPanel
  const enrichedProjectUnits = (project.project_units ?? []).map(pu => ({
    id:               pu.id,
    template_unit_id: pu.template_unit_id,
    nombre:           unitNameMap[pu.template_unit_id] ?? undefined,
  }))

  return (
    <ProjectScopePage
      project={{ ...project, readiness_score: readiness.score }}
      chapters={chapters ?? []}
      linkedProyectos={linkedProyectos ?? []}
      initialDocs={docs ?? []}
      initialChecks={checks}
      initialTender={(tender ?? null) as unknown as FpeTender | null}
      partners={partners ?? []}
      enrichedProjectUnits={enrichedProjectUnits}
    />
  )
}

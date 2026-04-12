import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PortalPage from '@/components/fp-execution-portal/PortalPage'

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
      id, token, token_expires_at, scope_unit_ids, status,
      sent_at, viewed_at, bid_submitted_at,
      partner:fpe_partners ( id, nombre, contacto_nombre, email_contacto ),
      tender:fpe_tenders (
        id, descripcion, fecha_limite, status,
        project:fpe_projects (
          id, nombre, descripcion, direccion, ciudad
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
  const tender  = inv.tender  as unknown as { id: string; descripcion: string | null; fecha_limite: string; status: string; project: { id: string; nombre: string; descripcion: string | null; direccion: string | null; ciudad: string | null } }

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
          phases:fpe_template_phases ( id, nombre, descripcion, orden, lead_time_days ),
          line_items:fpe_template_line_items ( id, nombre, unidad_medida, orden, activo )
        ),
        line_items:fpe_project_line_items (
          id, cantidad, notas,
          template_line_item:fpe_template_line_items ( id, nombre, unidad_medida )
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
          id, template_phase_id, project_unit_id, duracion_dias
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
      projectUnits={(projectUnits ?? []) as any}
      documents={allDocs}
      existingBid={existingBid ?? null}
      isReadOnly={tenderClosed || deadlinePassed || inv.status === 'bid_submitted'}
      initialQuestions={(questions ?? []) as Parameters<typeof PortalPage>[0]['initialQuestions']}
      renderUrls={renderUrls}
    />
  )
}

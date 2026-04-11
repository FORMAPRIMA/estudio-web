import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DreamTeamClient from './DreamTeamClient'

export default async function DreamTeamPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('fpe_projects')
    .select('id, nombre, ciudad, status')
    .eq('id', params.id)
    .single()

  if (!project) return notFound()

  // ── Fetch tenders for this project ─────────────────────────────────────────
  const { data: tenders } = await admin
    .from('fpe_tenders')
    .select('id')
    .eq('project_id', params.id)

  const tenderIds = (tenders ?? []).map(t => t.id)

  if (tenderIds.length === 0) {
    return (
      <DreamTeamShell project={project} isEmpty />
    )
  }

  // ── Fetch awards ───────────────────────────────────────────────────────────
  const { data: awards } = await admin
    .from('fpe_awards')
    .select('id, awarded_at, notas, tender_id, bid_id, partner_id')
    .in('tender_id', tenderIds)
    .order('awarded_at', { ascending: true })

  if (!awards || awards.length === 0) {
    return <DreamTeamShell project={project} isEmpty />
  }

  const awardIds  = awards.map(a => a.id)
  const bidIds    = awards.map(a => a.bid_id)
  const partnerIds = awards.map(a => a.partner_id)

  // ── Parallel fetch of all related data ────────────────────────────────────
  const [
    { data: contracts },
    { data: partners },
    { data: bidLineItems },
    { data: phaseDurations },
  ] = await Promise.all([
    admin
      .from('fpe_contracts')
      .select('id, award_id, status, sent_at, signed_at, docusign_envelope_id, contenido_json')
      .in('award_id', awardIds),

    admin
      .from('fpe_partners')
      .select('id, nombre, contacto_nombre, email_contacto')
      .in('id', partnerIds),

    admin
      .from('fpe_bid_line_items')
      .select(`
        bid_id, project_line_item_id, precio_unitario,
        project_line_item:fpe_project_line_items (
          id, cantidad,
          template_line_item:fpe_template_line_items ( nombre, unidad_medida ),
          project_unit:fpe_project_units (
            id,
            template_unit:fpe_template_units ( nombre )
          )
        )
      `)
      .in('bid_id', bidIds),

    admin
      .from('fpe_bid_phase_durations')
      .select(`
        bid_id, template_phase_id, project_unit_id, duracion_dias,
        phase:fpe_template_phases ( nombre, orden )
      `)
      .in('bid_id', bidIds),
  ])

  // Build lookup maps
  const contractByAward  = Object.fromEntries((contracts ?? []).map(c => [c.award_id, c]))
  const partnerById      = Object.fromEntries((partners ?? []).map(p => [p.id, p]))
  const lineItemsByBid   = groupBy(bidLineItems ?? [], li => li.bid_id)
  const phasesByBid      = groupBy(phaseDurations ?? [], pd => pd.bid_id)

  // Assemble enriched awards
  const enriched = awards.map(award => ({
    id:         award.id,
    awarded_at: award.awarded_at,
    notas:      award.notas,
    partner:    partnerById[award.partner_id] ?? null,
    contract:   contractByAward[award.id] ?? null,
    line_items: lineItemsByBid[award.bid_id] ?? [],
    phase_durations: phasesByBid[award.bid_id] ?? [],
  }))

  return (
    <DreamTeamShell project={project}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DreamTeamClient awards={enriched as any} />
    </DreamTeamShell>
  )
}

// ── Shell layout ──────────────────────────────────────────────────────────────

function DreamTeamShell({
  project,
  isEmpty,
  children,
}: {
  project: { id: string; nombre: string; ciudad: string | null }
  isEmpty?: boolean
  children?: React.ReactNode
}) {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      <div style={{ background: '#1A1A1A' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 32px' }}>
          <div style={{ marginBottom: 8 }}>
            <Link href={`/team/fp-execution/projects/${project.id}`} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
              ← Proyecto
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
            Dream Team
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {project.nombre}{project.ciudad ? ` · ${project.ciudad}` : ''}
          </p>
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 32px' }}>
        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🏗️</div>
            <p style={{ margin: 0, fontWeight: 600, color: '#555', fontSize: 14 }}>Ningún partner adjudicado todavía</p>
            <p style={{ margin: '8px 0 24px', fontSize: 12, color: '#AAA' }}>
              Adjudica una oferta desde la comparativa de licitación para ver el Dream Team.
            </p>
            <Link
              href={`/team/fp-execution/projects/${project.id}`}
              style={{ display: 'inline-block', padding: '10px 20px', background: '#1A1A1A', color: '#fff', borderRadius: 6, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
            >
              Ir al proyecto
            </Link>
          </div>
        ) : children}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of arr) {
    const k = key(item)
    if (!result[k]) result[k] = []
    result[k].push(item)
  }
  return result
}

'use client'

import React from 'react'
import BidComparison from '@/components/team/fp-execution/BidComparison'
import QAPanel from '@/components/team/fp-execution/QAPanel'
import type { FpeTender } from '@/components/team/fp-execution/TenderPanel'

export default function BiddingPanel({
  projectId,
  tender,
  onGoToInvitations,
  onGoToDreamTeam,
}: {
  projectId:          string
  tender:             FpeTender | null
  onGoToInvitations:  () => void
  onGoToDreamTeam?:   () => void
}) {
  // ── No tender yet ────────────────────────────────────────────────────────
  if (!tender || tender.status === 'draft') {
    return (
      <EmptyState
        title="Aún no se ha lanzado la licitación"
        message="Ve a la pestaña de Invitaciones para configurar partners por disciplina y lanzar la licitación."
        ctaLabel="Ir a Invitaciones →"
        onCta={onGoToInvitations}
      />
    )
  }

  const invitations = tender.invitations ?? []
  const totalInv    = invitations.length
  const sentCount   = invitations.filter(i => ['sent','viewed','bid_submitted'].includes(i.status)).length
  const viewedCount = invitations.filter(i => ['viewed','bid_submitted'].includes(i.status)).length
  const bidCount    = invitations.filter(i => i.status === 'bid_submitted').length

  // ── Tender launched, awaiting bids ──────────────────────────────────────
  if (bidCount === 0) {
    return (
      <div>
        <StatusBar
          totalInv={totalInv}
          sentCount={sentCount}
          viewedCount={viewedCount}
          bidCount={bidCount}
          fechaLimite={tender.fecha_limite}
        />
        <div style={{
          marginTop: 24, padding: '60px 28px', textAlign: 'center',
          background: '#fff', border: '1px dashed #E8E6E0', borderRadius: 10,
        }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>📥</div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#555' }}>
            Pendiente de recibir ofertas
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#999' }}>
            En cuanto los partners envíen sus presupuestos aparecerá aquí la comparativa.
          </p>
        </div>

        {/* Q&A panel — partners pueden estar preguntando ya */}
        <div style={{ marginTop: 28 }}>
          <SectionHeader title="Preguntas y respuestas" />
          <QAPanel tenderId={tender.id} projectId={projectId} />
        </div>
      </div>
    )
  }

  // ── Bids received → render comparativa + Q&A ────────────────────────────
  return (
    <div>
      <StatusBar
        totalInv={totalInv}
        sentCount={sentCount}
        viewedCount={viewedCount}
        bidCount={bidCount}
        fechaLimite={tender.fecha_limite}
      />

      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Comparativa de ofertas" subtitle={`${bidCount} oferta${bidCount !== 1 ? 's' : ''} recibida${bidCount !== 1 ? 's' : ''}`} />
        <BidComparison
          tenderId={tender.id}
          projectId={projectId}
          onAllUnitsAwarded={onGoToDreamTeam}
        />
      </div>

      <div style={{ marginTop: 32 }}>
        <SectionHeader title="Preguntas y respuestas" />
        <QAPanel tenderId={tender.id} projectId={projectId} />
      </div>
    </div>
  )
}

// ── Status bar (top of the tab) ────────────────────────────────────────────

function StatusBar({
  totalInv, sentCount, viewedCount, bidCount, fechaLimite,
}: {
  totalInv:    number
  sentCount:   number
  viewedCount: number
  bidCount:    number
  fechaLimite: string
}) {
  const deadline = new Date(fechaLimite)
  const fmtDeadline = deadline.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      padding: '16px 20px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10,
    }}>
      <Stat label="Invitaciones" value={totalInv} />
      <Sep />
      <Stat label="Enviadas" value={sentCount} />
      <Sep />
      <Stat label="Vistas" value={viewedCount} />
      <Sep />
      <Stat label="Ofertas recibidas" value={bidCount} highlight={bidCount > 0} />
      <Sep />
      <div style={{ marginLeft: 'auto' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
          Fecha límite
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: daysLeft < 0 ? '#DC2626' : daysLeft <= 3 ? '#D97706' : '#1A1A1A', marginTop: 2 }}>
          {fmtDeadline} {daysLeft >= 0 ? `· ${daysLeft}d` : '· vencida'}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? '#059669' : '#1A1A1A', marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 32, background: '#E8E6E0' }} />
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{title}</h3>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#888' }}>{subtitle}</p>}
    </div>
  )
}

function EmptyState({
  title, message, ctaLabel, onCta,
}: {
  title:    string
  message:  string
  ctaLabel: string
  onCta:    () => void
}) {
  return (
    <div style={{
      padding: '80px 28px', textAlign: 'center',
      background: '#fff', border: '1px dashed #E8E6E0', borderRadius: 10,
    }}>
      <div style={{ fontSize: 32, marginBottom: 14 }}>🚀</div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#555' }}>{title}</p>
      <p style={{ margin: '8px 0 22px', fontSize: 12, color: '#999' }}>{message}</p>
      <button
        onClick={onCta}
        style={{
          padding: '10px 20px', fontSize: 12, fontWeight: 600,
          borderRadius: 6, border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', background: '#1A1A1A', color: '#fff',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  )
}

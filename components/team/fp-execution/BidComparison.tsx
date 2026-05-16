'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  getTenderBids,
  awardUnit,
  revertUnitAward,
  awardChapter,
  revertChapterAward,
  getProjectAwards,
  type ScopeUnitRow,
  type TenderBidRow,
  type FpeProjectUnitAwardRow,
} from '@/app/actions/fpe-tenders'

// ── Helpers ───────────────────────────────────────────────────────────────────

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

interface ChapterGroup {
  chapter_id:     string
  chapter_nombre: string
  chapter_orden:  number
  units:          ScopeUnitRow[]
}

function groupByChapter(scope: ScopeUnitRow[]): ChapterGroup[] {
  const map = new Map<string, ChapterGroup>()
  for (const u of scope) {
    const k = u.chapter_id || '__sin__'
    if (!map.has(k)) {
      map.set(k, {
        chapter_id:     u.chapter_id,
        chapter_nombre: u.chapter_nombre,
        chapter_orden:  u.chapter_orden,
        units:          [],
      })
    }
    map.get(k)!.units.push(u)
  }
  return Array.from(map.values()).sort((a, b) => a.chapter_orden - b.chapter_orden)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BidComparison({
  tenderId,
  projectId,
  onAllUnitsAwarded,
}: {
  tenderId:           string
  projectId:          string
  onAllUnitsAwarded?: () => void
}) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [scope, setScope]     = useState<ScopeUnitRow[]>([])
  const [bids, setBids]       = useState<TenderBidRow[]>([])
  const [showPhases, setShowPhases] = useState(false)

  const [awards, setAwards]   = useState<Record<string, string>>({})   // unit_id → bid_id
  const [busy, setBusy]       = useState<string | null>(null)
  const [flashMsg, setFlash]  = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      getTenderBids(tenderId, projectId),
      getProjectAwards(projectId),
    ]).then(([bidsRes, awardsRes]) => {
      setLoading(false)
      if ('error' in bidsRes) { setError(bidsRes.error); return }
      setScope(bidsRes.scope)
      setBids(bidsRes.bids)
      if (!('error' in awardsRes)) {
        const m: Record<string, string> = {}
        for (const a of awardsRes.awards as FpeProjectUnitAwardRow[]) {
          m[a.project_unit_id] = a.bid_id
        }
        setAwards(m)
      }
    })
  }, [tenderId, projectId])

  const chapters = useMemo(() => groupByChapter(scope), [scope])

  const flash = (type: 'ok' | 'err', text: string) => {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  // ── Adjudication handlers ────────────────────────────────────────────────
  const handleAwardUnit = async (unitId: string, bidId: string, partnerName: string) => {
    if (!confirm(`¿Adjudicar esta UE a ${partnerName}?`)) return
    setBusy(unitId)
    const res = await awardUnit({ project_id: projectId, project_unit_id: unitId, bid_id: bidId })
    setBusy(null)
    if ('error' in res) { flash('err', res.error); return }
    setAwards(prev => ({ ...prev, [unitId]: bidId }))
    flash('ok', `UE adjudicada a ${partnerName}.`)
    router.refresh()
  }

  const handleRevertUnit = async (unitId: string) => {
    if (!confirm('¿Deshacer la adjudicación de esta UE?')) return
    setBusy(unitId)
    const res = await revertUnitAward({ project_id: projectId, project_unit_id: unitId })
    setBusy(null)
    if ('error' in res) { flash('err', res.error); return }
    setAwards(prev => {
      const next = { ...prev }
      delete next[unitId]
      return next
    })
    flash('ok', 'Adjudicación deshecha.')
    router.refresh()
  }

  const handleAwardChapter = async (chapterId: string, bidId: string, partnerName: string, unitIds: string[]) => {
    if (!confirm(`¿Adjudicar todo el capítulo a ${partnerName}? (${unitIds.length} UE${unitIds.length !== 1 ? 's' : ''})`)) return
    setBusy(chapterId)
    const res = await awardChapter({ project_id: projectId, chapter_id: chapterId, bid_id: bidId })
    setBusy(null)
    if ('error' in res) { flash('err', res.error); return }
    setAwards(prev => {
      const next = { ...prev }
      for (const uid of unitIds) next[uid] = bidId
      return next
    })
    flash('ok', `Capítulo adjudicado a ${partnerName} (${res.awarded} UEs).`)
    router.refresh()
  }

  const handleRevertChapter = async (chapterId: string, unitIds: string[]) => {
    if (!confirm('¿Deshacer la adjudicación del capítulo entero?')) return
    setBusy(chapterId)
    const res = await revertChapterAward({ project_id: projectId, chapter_id: chapterId })
    setBusy(null)
    if ('error' in res) { flash('err', res.error); return }
    setAwards(prev => {
      const next = { ...prev }
      for (const uid of unitIds) delete next[uid]
      return next
    })
    flash('ok', `Adjudicación deshecha (${res.reverted} UEs).`)
    router.refresh()
  }

  // ── CSV export ───────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows: string[] = []
    rows.push([
      q('Capítulo'), q('UE'), q('Partida'), q('Ud.'), q('Cantidad'),
      ...bids.flatMap(b => [q(`${b.partner_nombre} — P/Ud`), q(`${b.partner_nombre} — Importe`)]),
    ].join(','))
    for (const ch of chapters) {
      for (const unit of ch.units) {
        rows.push([q(ch.chapter_nombre), q(unit.unit_nombre), '', '', '', ...bids.flatMap(() => ['', ''])].join(','))
        for (const li of unit.line_items) {
          rows.push([
            q(ch.chapter_nombre), q(unit.unit_nombre), q(li.nombre),
            q(li.unidad_medida), String(li.cantidad),
            ...bids.flatMap(b => {
              const p = b.prices[li.id]
              return p !== undefined ? [p.toFixed(2), (p * li.cantidad).toFixed(2)] : ['', '']
            }),
          ].join(','))
        }
      }
    }
    const csv  = '﻿' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'comparativa-ofertas.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── States ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#AAA', fontSize: 13 }}>
      Cargando comparativa…
    </div>
  )
  if (error) return (
    <div style={{ padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
      Error: {error}
    </div>
  )
  if (bids.length === 0) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
      No hay ofertas enviadas todavía.
    </div>
  )

  // Global progress
  const adjudicableUnits = scope.filter(u =>
    bids.some(b => u.line_items.every(li => b.prices[li.id] !== undefined))
  )
  const awardedCount = adjudicableUnits.filter(u => awards[u.unit_id]).length
  const allAwarded   = awardedCount === adjudicableUnits.length && adjudicableUnits.length > 0

  return (
    <div>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 18, gap: 12, flexWrap: 'wrap',
      }}>
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
          <strong style={{ color: '#1A1A1A' }}>{awardedCount}</strong> de <strong style={{ color: '#1A1A1A' }}>{adjudicableUnits.length}</strong> UEs adjudicadas
          {adjudicableUnits.length < scope.length && (
            <span style={{ color: '#AAA' }}> · {scope.length - adjudicableUnits.length} UE(s) sin oferta completa</span>
          )}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#555', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showPhases}
              onChange={e => setShowPhases(e.target.checked)}
              style={{ accentColor: '#D85A30', cursor: 'pointer' }}
            />
            Mostrar fases de ejecución
          </label>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '7px 14px', fontSize: 11, borderRadius: 6,
              border: '1px solid #E8E6E0', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 500,
              background: '#fff', color: '#555',
            }}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {flashMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 14,
          background: flashMsg.type === 'ok' ? '#FFF8F4' : '#FEF2F2',
          border: `1px solid ${flashMsg.type === 'ok' ? '#F4C9A8' : '#FECACA'}`,
          color:  flashMsg.type === 'ok' ? '#9A3F1B' : '#DC2626',
        }}>
          {flashMsg.text}
        </div>
      )}

      {/* Chapter cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {chapters.map(ch => (
          <ChapterCard
            key={ch.chapter_id || '__sin__'}
            chapter={ch}
            bids={bids}
            awards={awards}
            showPhases={showPhases}
            busy={busy}
            onAwardUnit={handleAwardUnit}
            onRevertUnit={handleRevertUnit}
            onAwardChapter={handleAwardChapter}
            onRevertChapter={handleRevertChapter}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 18, padding: '14px 18px', borderRadius: 12,
        background: allAwarded ? '#FFF8F4' : '#FAFAF8',
        border: `1px solid ${allAwarded ? '#F4C9A8' : '#F0EEE8'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: allAwarded ? '#9A3F1B' : '#1A1A1A' }}>
            {allAwarded
              ? 'Todas las UEs adjudicables están adjudicadas'
              : `${awardedCount} de ${adjudicableUnits.length} UEs adjudicadas`}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            {allAwarded
              ? 'Continúa con el Final Overview para revisar los packs por partner antes de generar contratos.'
              : 'Adjudica las UEs restantes para poder pasar al Final Overview.'}
          </div>
        </div>
        {allAwarded && onAllUnitsAwarded && (
          <button
            onClick={onAllUnitsAwarded}
            style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#D85A30', color: '#fff' }}
          >
            Ir al Overview de adjudicaciones →
          </button>
        )}
      </div>

      {/* Notas por bid */}
      {bids.some(b => b.notas) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bids.filter(b => b.notas).map(bid => (
            <div key={bid.id} style={{
              padding: '10px 14px', background: '#FAFAF8', borderRadius: 8,
              border: '1px solid #F0EEE8', fontSize: 12,
            }}>
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{bid.partner_nombre}: </span>
              <span style={{ color: '#666' }}>{bid.notas}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ChapterCard ──────────────────────────────────────────────────────────────

interface Participant {
  bid:         TenderBidRow
  total:       number
  days:        number
  allCovered:  boolean
}

function ChapterCard({
  chapter, bids, awards, showPhases, busy,
  onAwardUnit, onRevertUnit, onAwardChapter, onRevertChapter,
}: {
  chapter:         ChapterGroup
  bids:            TenderBidRow[]
  awards:          Record<string, string>
  showPhases:      boolean
  busy:            string | null
  onAwardUnit:     (unitId: string, bidId: string, partnerName: string) => void
  onRevertUnit:    (unitId: string) => void
  onAwardChapter:  (chapterId: string, bidId: string, partnerName: string, unitIds: string[]) => void
  onRevertChapter: (chapterId: string, unitIds: string[]) => void
}) {
  const [expanded, setExpanded]            = useState(false)
  const [expandedUnits, setExpandedUnits]  = useState<Record<string, boolean>>({})

  const toggleUnit = (id: string) => setExpandedUnits(prev => ({ ...prev, [id]: !prev[id] }))

  // ── Compute participating partners (any priced line item in this chapter)
  const participants: Participant[] = useMemo(() => {
    return bids
      .map(bid => {
        let total = 0
        let priced = 0
        let totalItems = 0
        for (const u of chapter.units) {
          for (const li of u.line_items) {
            totalItems++
            const p = bid.prices[li.id]
            if (p !== undefined) {
              total  += p * li.cantidad
              priced++
            }
          }
        }
        if (priced === 0) return null
        const days = (bid.phasesByChapter[chapter.chapter_id] ?? []).reduce((s, p) => s + p.dias, 0)
        return {
          bid,
          total,
          days,
          allCovered: priced === totalItems && totalItems > 0,
        }
      })
      .filter((p): p is Participant => p !== null)
      .sort((a, b) => a.total - b.total)
  }, [bids, chapter])

  // ── Cheapest & fastest across full-coverage participants
  const fullCovered = participants.filter(p => p.allCovered)
  const minTotal    = fullCovered.length > 0 ? Math.min(...fullCovered.map(p => p.total)) : null
  const minDays     = fullCovered.filter(p => p.days > 0).length > 0
    ? Math.min(...fullCovered.filter(p => p.days > 0).map(p => p.days))
    : null

  // ── Award state at chapter level
  const unitIds       = chapter.units.map(u => u.unit_id)
  const awardedBidIds = new Set(unitIds.map(uid => awards[uid]).filter(Boolean))
  const allAwarded    = unitIds.every(uid => awards[uid]) && unitIds.length > 0
  const fullyAwardedTo = allAwarded && awardedBidIds.size === 1 ? Array.from(awardedBidIds)[0] : null
  const isMixed        = awardedBidIds.size >= 2

  const isChapterBusy = busy === chapter.chapter_id

  // ── Phase order across all participants
  const phaseOrder: { phase_id: string; phase_nombre: string; phase_orden: number }[] = useMemo(() => {
    const seen = new Map<string, { phase_id: string; phase_nombre: string; phase_orden: number }>()
    for (const p of participants) {
      for (const ph of p.bid.phasesByChapter[chapter.chapter_id] ?? []) {
        if (!seen.has(ph.phase_id)) {
          seen.set(ph.phase_id, { phase_id: ph.phase_id, phase_nombre: ph.phase_nombre, phase_orden: ph.phase_orden })
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.phase_orden - b.phase_orden)
  }, [participants, chapter])

  const partidaCount = chapter.units.reduce((s, u) => s + u.line_items.length, 0)

  // ── Empty: no participant for this chapter at all
  if (participants.length === 0) {
    return (
      <section style={{
        background: '#fff', border: '1px solid #F0EEE8', borderRadius: 12,
        padding: '18px 22px',
      }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A1A', letterSpacing: '0.02em' }}>
            {chapter.chapter_nombre}
          </h3>
          <span style={{ fontSize: 11, color: '#AAA' }}>
            {chapter.units.length} UE{chapter.units.length !== 1 ? 's' : ''} · {partidaCount} partida{partidaCount !== 1 ? 's' : ''}
          </span>
        </header>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#999' }}>
          Sin ofertas para este capítulo todavía.
        </p>
      </section>
    )
  }

  return (
    <section style={{
      background: '#fff',
      border: '1px solid #F0EEE8',
      borderRadius: 12,
      borderLeft: fullyAwardedTo ? '4px solid #D85A30' : '1px solid #F0EEE8',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', cursor: 'pointer',
          borderBottom: '1px solid #F5F4F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A1A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {chapter.chapter_nombre}
          </h3>
          <span style={{ fontSize: 11, color: '#AAA', fontWeight: 500 }}>
            {chapter.units.length} UE{chapter.units.length !== 1 ? 's' : ''} · {partidaCount} partida{partidaCount !== 1 ? 's' : ''}
          </span>
          {fullyAwardedTo && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 11,
              background: '#D85A30', color: '#fff', letterSpacing: '0.06em',
            }}>
              ADJUDICADO · {bids.find(b => b.id === fullyAwardedTo)?.partner_nombre ?? '?'}
            </span>
          )}
          {isMixed && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 11,
              background: '#F0EEE8', color: '#666', letterSpacing: '0.06em',
            }}>
              ADJUDICACIÓN MIXTA · {awardedBidIds.size} partners
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#BBB' }}>{expanded ? '▼' : '▶'}</span>
      </header>

      {/* Partner blocks (always visible) */}
      <div style={{
        padding: '18px 22px',
        display: 'grid',
        gridTemplateColumns: `repeat(${participants.length}, minmax(180px, 1fr))`,
        gap: 14,
        background: '#fff',
      }}>
        {participants.map(p => {
          const isAwarded = fullyAwardedTo === p.bid.id
          const isCheapest = minTotal != null && p.total === minTotal && p.allCovered
          const isFastest  = minDays != null && p.days === minDays && p.allCovered
          return (
            <PartnerBlock
              key={p.bid.id}
              participant={p}
              isAwarded={isAwarded}
              isCheapest={isCheapest}
              isFastest={isFastest}
              chapterUnitIds={unitIds}
              chapterId={chapter.chapter_id}
              canAward={!isMixed && !fullyAwardedTo && p.allCovered}
              disableReason={
                isMixed ? 'Hay UEs adjudicadas a distintos partners — deshaz alguna primero'
                : !p.allCovered ? 'No cubre todas las partidas del capítulo'
                : ''
              }
              busy={isChapterBusy}
              onAwardChapter={onAwardChapter}
              onRevertChapter={onRevertChapter}
            />
          )
        })}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F5F4F0', background: '#FAFAF8' }}>
          {/* Phase strip */}
          {showPhases && phaseOrder.length > 0 && (
            <PhaseStrip
              chapterId={chapter.chapter_id}
              participants={participants}
              phaseOrder={phaseOrder}
            />
          )}

          {/* UE list */}
          <UnitTable
            chapterId={chapter.chapter_id}
            units={chapter.units}
            participants={participants}
            awards={awards}
            expandedUnits={expandedUnits}
            onToggleUnit={toggleUnit}
            chapterAwarded={!!fullyAwardedTo}
            isMixed={isMixed}
            busy={busy}
            onAwardUnit={onAwardUnit}
            onRevertUnit={onRevertUnit}
          />
        </div>
      )}
    </section>
  )
}

// ── PartnerBlock ─────────────────────────────────────────────────────────────

function PartnerBlock({
  participant, isAwarded, isCheapest, isFastest,
  chapterId, chapterUnitIds, canAward, disableReason, busy,
  onAwardChapter, onRevertChapter,
}: {
  participant:      Participant
  isAwarded:        boolean
  isCheapest:       boolean
  isFastest:        boolean
  chapterId:        string
  chapterUnitIds:   string[]
  canAward:         boolean
  disableReason:    string
  busy:             boolean
  onAwardChapter:   (chapterId: string, bidId: string, partnerName: string, unitIds: string[]) => void
  onRevertChapter:  (chapterId: string, unitIds: string[]) => void
}) {
  const { bid, total, days, allCovered } = participant

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        padding: '14px 16px',
        background: isAwarded ? '#FFF8F4' : '#FAFAF8',
        border: `1px solid ${isAwarded ? '#F4C9A8' : '#F0EEE8'}`,
        borderRadius: 10,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
        {bid.partner_nombre}
      </div>

      <div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: isCheapest ? '#D85A30' : '#1A1A1A',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>
          {euros(total)}
        </div>
        {isCheapest && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#D85A30', letterSpacing: '0.08em', marginTop: 3, textTransform: 'uppercase' }}>
            ↓ Más bajo
          </div>
        )}
        {!allCovered && (
          <div style={{ fontSize: 9, fontWeight: 600, color: '#999', letterSpacing: '0.06em', marginTop: 3, textTransform: 'uppercase' }}>
            Cobertura parcial
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
          {days > 0 ? `${days} días laborables` : <span style={{ color: '#BBB' }}>— días</span>}
        </div>
        {isFastest && days > 0 && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#D85A30', letterSpacing: '0.08em', marginTop: 2, textTransform: 'uppercase' }}>
            ↓ Más rápido
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
        {isAwarded ? (
          <button
            onClick={() => onRevertChapter(chapterId, chapterUnitIds)}
            disabled={busy}
            style={{
              width: '100%', padding: '8px 12px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, border: '1px solid #D85A30',
              background: '#fff', color: '#D85A30', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Deshacer capítulo
          </button>
        ) : (
          <button
            onClick={() => onAwardChapter(chapterId, bid.id, bid.partner_nombre, chapterUnitIds)}
            disabled={!canAward || busy}
            title={!canAward ? disableReason : ''}
            style={{
              width: '100%', padding: '8px 12px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, border: 'none',
              background: !canAward ? '#E8E6E0' : '#1A1A1A',
              color: !canAward ? '#999' : '#fff',
              cursor: !canAward ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? '…' : 'Adjudicar capítulo'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── PhaseStrip ───────────────────────────────────────────────────────────────

function PhaseStrip({
  chapterId, participants, phaseOrder,
}: {
  chapterId:    string
  participants: Participant[]
  phaseOrder:   { phase_id: string; phase_nombre: string; phase_orden: number }[]
}) {
  return (
    <div style={{ padding: '14px 22px', borderBottom: '1px solid #F0EEE8' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#999', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
        Fases de ejecución · días laborables
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `200px repeat(${participants.length}, minmax(100px, 1fr))`,
        gap: '6px 14px',
        alignItems: 'baseline',
      }}>
        <div />
        {participants.map(p => (
          <div key={p.bid.id} style={{ fontSize: 10, fontWeight: 600, color: '#888', letterSpacing: '0.04em' }}>
            {p.bid.partner_nombre}
          </div>
        ))}
        {phaseOrder.map(ph => {
          // days per participant for this phase
          const daysByPart: Record<string, number> = {}
          for (const p of participants) {
            const found = (p.bid.phasesByChapter[chapterId] ?? []).find(x => x.phase_id === ph.phase_id)
            if (found) daysByPart[p.bid.id] = found.dias
          }
          const min = Object.values(daysByPart).filter(v => v > 0).length > 0
            ? Math.min(...Object.values(daysByPart).filter(v => v > 0))
            : null
          return (
            <React.Fragment key={ph.phase_id}>
              <div style={{ fontSize: 12, color: '#555' }}>{ph.phase_nombre}</div>
              {participants.map(p => {
                const d = daysByPart[p.bid.id]
                const isMin = min != null && d === min
                return (
                  <div key={p.bid.id} style={{
                    fontSize: 12,
                    fontWeight: isMin ? 700 : 500,
                    color: isMin ? '#D85A30' : '#555',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {d != null ? `${d}d` : <span style={{ color: '#DDD' }}>—</span>}
                  </div>
                )
              })}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── UnitTable ────────────────────────────────────────────────────────────────

function UnitTable({
  chapterId, units, participants, awards, expandedUnits,
  onToggleUnit, chapterAwarded, isMixed, busy,
  onAwardUnit, onRevertUnit,
}: {
  chapterId:      string
  units:          ScopeUnitRow[]
  participants:   Participant[]
  awards:         Record<string, string>
  expandedUnits:  Record<string, boolean>
  onToggleUnit:   (id: string) => void
  chapterAwarded: boolean
  isMixed:        boolean
  busy:           string | null
  onAwardUnit:    (unitId: string, bidId: string, partnerName: string) => void
  onRevertUnit:   (unitId: string) => void
}) {
  return (
    <div style={{ padding: '14px 22px 18px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#999', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
        Unidades de ejecución
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #F0EEE8', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr>
            <th style={{
              padding: '10px 14px', textAlign: 'left',
              fontSize: 9, fontWeight: 700, color: '#888', letterSpacing: '0.06em',
              textTransform: 'uppercase', borderBottom: '1px solid #F0EEE8',
              minWidth: 220,
            }}>
              Unidad
            </th>
            {participants.map(p => (
              <th key={p.bid.id} style={{
                padding: '10px 14px', textAlign: 'right',
                fontSize: 10, fontWeight: 600, color: '#1A1A1A',
                borderBottom: '1px solid #F0EEE8', borderLeft: '1px solid #F0EEE8',
                minWidth: 140,
              }}>
                {p.bid.partner_nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map(u => (
            <UnitRow
              key={u.unit_id}
              unit={u}
              participants={participants}
              awardedBidId={awards[u.unit_id]}
              expanded={!!expandedUnits[u.unit_id]}
              onToggle={() => onToggleUnit(u.unit_id)}
              chapterAwarded={chapterAwarded}
              isMixed={isMixed}
              busy={busy}
              onAwardUnit={onAwardUnit}
              onRevertUnit={onRevertUnit}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── UnitRow ──────────────────────────────────────────────────────────────────

function UnitRow({
  unit, participants, awardedBidId, expanded, onToggle,
  chapterAwarded, isMixed, busy,
  onAwardUnit, onRevertUnit,
}: {
  unit:           ScopeUnitRow
  participants:   Participant[]
  awardedBidId?:  string
  expanded:       boolean
  onToggle:       () => void
  chapterAwarded: boolean
  isMixed:        boolean
  busy:           string | null
  onAwardUnit:    (unitId: string, bidId: string, partnerName: string) => void
  onRevertUnit:   (unitId: string) => void
}) {
  // Each participant: does it fully cover this UE? what's the total?
  // Nota: los días son a nivel capítulo (no per-UE), por eso no se muestran aquí.
  const cellByPart: Record<string, { total: number; covered: boolean; participates: boolean }> = {}
  for (const p of participants) {
    let total = 0; let priced = 0
    for (const li of unit.line_items) {
      const pr = p.bid.prices[li.id]
      if (pr !== undefined) { total += pr * li.cantidad; priced++ }
    }
    cellByPart[p.bid.id] = {
      total,
      covered:      priced === unit.line_items.length && unit.line_items.length > 0,
      participates: priced > 0,
    }
  }

  const covered = participants.filter(p => cellByPart[p.bid.id].covered)
  const minTotal = covered.length > 0 ? Math.min(...covered.map(p => cellByPart[p.bid.id].total)) : null

  const isUnitBusy = busy === unit.unit_id

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          background: awardedBidId ? '#FFF8F4' : '#fff',
          borderTop: '1px solid #F5F4F0',
        }}
      >
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#1A1A1A', fontWeight: 500 }}>
          <span style={{ fontSize: 10, color: '#BBB', marginRight: 8 }}>{expanded ? '▼' : '▶'}</span>
          {unit.unit_nombre}
          <span style={{ fontSize: 10, color: '#BBB', marginLeft: 8, fontWeight: 400 }}>
            {unit.line_items.length} part.
          </span>
          {awardedBidId && (
            <span style={{ marginLeft: 10, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#D85A30', color: '#fff', letterSpacing: '0.06em' }}>
              UE · {participants.find(p => p.bid.id === awardedBidId)?.bid.partner_nombre ?? '?'}
            </span>
          )}
        </td>
        {participants.map(p => {
          const c       = cellByPart[p.bid.id]
          const isAward = awardedBidId === p.bid.id
          const isCheap = minTotal != null && c.total === minTotal && c.covered

          if (!c.participates) {
            return (
              <td key={p.bid.id} style={{ padding: '12px 14px', textAlign: 'right', borderLeft: '1px solid #F5F4F0', verticalAlign: 'top' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#CCC', letterSpacing: '0.08em' }}>NA</span>
                <div style={{ fontSize: 9, color: '#CCC', marginTop: 2 }}>No participa</div>
              </td>
            )
          }

          return (
            <td
              key={p.bid.id}
              onClick={e => e.stopPropagation()}
              style={{
                padding: '12px 14px', textAlign: 'right',
                borderLeft: '1px solid #F5F4F0',
                background: isAward ? '#FFF8F4' : 'transparent',
                verticalAlign: 'top',
              }}
            >
              {c.covered ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isCheap ? '#D85A30' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
                    {euros(c.total)}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {isAward ? (
                      <button
                        onClick={() => onRevertUnit(unit.unit_id)}
                        disabled={isUnitBusy}
                        style={{
                          padding: '4px 10px', fontSize: 10, fontWeight: 600,
                          borderRadius: 4, border: '1px solid #D85A30',
                          background: '#fff', color: '#D85A30', cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Deshacer UE
                      </button>
                    ) : chapterAwarded ? (
                      null
                    ) : (
                      <button
                        onClick={() => onAwardUnit(unit.unit_id, p.bid.id, p.bid.partner_nombre)}
                        disabled={isUnitBusy || !!awardedBidId}
                        style={{
                          padding: '4px 10px', fontSize: 10, fontWeight: 600,
                          borderRadius: 4, border: 'none',
                          background: awardedBidId ? '#E8E6E0' : '#1A1A1A',
                          color: awardedBidId ? '#999' : '#fff',
                          cursor: awardedBidId ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                          opacity: isUnitBusy ? 0.5 : 1,
                        }}
                      >
                        {isUnitBusy ? '…' : 'Adjudicar UE'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 10, color: '#BBB', fontStyle: 'italic' }}>cobertura parcial</span>
              )}
            </td>
          )
        })}
      </tr>

      {/* Partidas (when UE expanded) */}
      {expanded && unit.line_items.map((li, idx) => {
        const priceByPart: Record<string, number | undefined> = {}
        for (const p of participants) priceByPart[p.bid.id] = p.bid.prices[li.id]
        const importes: number[] = []
        for (const p of participants) {
          const pr = priceByPart[p.bid.id]
          if (pr !== undefined) importes.push(pr * li.cantidad)
        }
        const minImporte = importes.length > 0 ? Math.min(...importes) : null

        return (
          <tr key={li.id} style={{ background: idx % 2 === 0 ? '#FAFAF8' : '#fff' }}>
            <td style={{ padding: '8px 14px 8px 38px', fontSize: 12, color: '#555' }}>
              <span style={{ color: '#BBB', marginRight: 6 }}>·</span>
              {li.nombre}
              <span style={{ marginLeft: 8, fontSize: 10, color: '#AAA' }}>
                {li.cantidad.toLocaleString('es-ES')} {li.unidad_medida}
              </span>
            </td>
            {participants.map(p => {
              const pr      = priceByPart[p.bid.id]
              const importe = pr !== undefined ? pr * li.cantidad : null
              const isCheap = minImporte != null && importe != null && importe === minImporte
              return (
                <td key={p.bid.id} style={{
                  padding: '8px 14px', textAlign: 'right',
                  borderLeft: '1px solid #F5F4F0',
                }}>
                  {pr !== undefined ? (
                    <>
                      <div style={{ fontSize: 10, color: '#AAA', marginBottom: 1 }}>
                        {euros(pr)}/{li.unidad_medida}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isCheap ? '#D85A30' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
                        {euros(importe!)}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: '#DDD' }}>—</span>
                  )}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

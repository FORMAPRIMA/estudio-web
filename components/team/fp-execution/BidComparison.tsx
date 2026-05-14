'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getTenderBids,
  awardUnit,
  revertUnitAward,
  getProjectAwards,
  type ScopeUnitRow,
  type TenderBidRow,
  type FpeProjectUnitAwardRow,
} from '@/app/actions/fpe-tenders'

// ── Helpers ───────────────────────────────────────────────────────────────────

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

function minBidIds(values: Record<string, number>): string[] {
  const entries = Object.entries(values).filter(([, v]) => v > 0)
  if (entries.length === 0) return []
  const min = Math.min(...entries.map(([, v]) => v))
  return entries.filter(([, v]) => v === min).map(([k]) => k)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BidComparison({
  tenderId,
  projectId,
  onAllUnitsAwarded,
}: {
  tenderId:           string
  projectId:          string
  onAllUnitsAwarded?: () => void   // optional: notify parent (e.g., switch to Overview)
}) {
  const router = useRouter()

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [scope, setScope]       = useState<ScopeUnitRow[]>([])
  const [bids, setBids]         = useState<TenderBidRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // unit_id → bid_id (which bid won that UE)
  const [awards, setAwards]     = useState<Record<string, string>>({})
  const [awardingUnit, setAwardingUnit] = useState<string | null>(null)
  const [flashMsg, setFlash]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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

  const toggleExpanded = (unitId: string) =>
    setExpanded(prev => ({ ...prev, [unitId]: !prev[unitId] }))

  const flash = (type: 'ok' | 'err', text: string) => {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 3500)
  }

  // ── Per-UE adjudication ──────────────────────────────────────────────────

  const handleAwardUnit = async (unitId: string, bidId: string, partnerName: string) => {
    if (!confirm(`¿Adjudicar esta UE a ${partnerName}?`)) return
    setAwardingUnit(unitId)
    const res = await awardUnit({ project_id: projectId, project_unit_id: unitId, bid_id: bidId })
    setAwardingUnit(null)
    if ('error' in res) { flash('err', res.error); return }
    setAwards(prev => ({ ...prev, [unitId]: bidId }))
    flash('ok', `UE adjudicada a ${partnerName}.`)
    router.refresh()
  }

  const handleRevertUnit = async (unitId: string) => {
    if (!confirm('¿Deshacer la adjudicación de esta UE?')) return
    setAwardingUnit(unitId)
    const res = await revertUnitAward({ project_id: projectId, project_unit_id: unitId })
    setAwardingUnit(null)
    if ('error' in res) { flash('err', res.error); return }
    setAwards(prev => {
      const next = { ...prev }
      delete next[unitId]
      return next
    })
    flash('ok', 'Adjudicación deshecha.')
    router.refresh()
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows: string[] = []

    rows.push([
      q('Partida'), q('Ud.'), q('Cantidad'),
      ...bids.flatMap(b => [q(`${b.partner_nombre} — P/Ud`), q(`${b.partner_nombre} — Importe`)]),
    ].join(','))

    for (const unit of scope) {
      rows.push([q(unit.unit_nombre), '', '', ...bids.flatMap(() => ['', ''])].join(','))
      for (const li of unit.line_items) {
        rows.push([
          q(li.nombre), q(li.unidad_medida), String(li.cantidad),
          ...bids.flatMap(b => {
            const p = b.prices[li.id]
            return p !== undefined ? [p.toFixed(2), (p * li.cantidad).toFixed(2)] : ['', '']
          }),
        ].join(','))
      }
    }

    const csv  = '﻿' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'comparativa-ofertas.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading / error states ────────────────────────────────────────────────

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

  // ── Progress ──────────────────────────────────────────────────────────────

  // Adjudicable UEs = UEs that have at least one bid covering all its line items at any price
  const adjudicableUnits = scope.filter(u =>
    bids.some(b => u.line_items.every(li => b.prices[li.id] !== undefined))
  )
  const awardedCount = adjudicableUnits.filter(u => awards[u.unit_id]).length
  const allAwarded   = awardedCount === adjudicableUnits.length && adjudicableUnits.length > 0

  const COL_W = 200

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#555' }}>
            <strong>{awardedCount}</strong> de <strong>{adjudicableUnits.length}</strong> UEs adjudicadas
            {adjudicableUnits.length < scope.length && (
              <span style={{ color: '#999' }}> · {scope.length - adjudicableUnits.length} UE(s) sin oferta completa</span>
            )}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          style={{ padding: '6px 14px', fontSize: 11, borderRadius: 5, border: '1px solid #E8E6E0', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: '#fff', color: '#555' }}
        >
          Exportar CSV
        </button>
      </div>

      {flashMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 12,
          background: flashMsg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${flashMsg.type === 'ok' ? '#6EE7B7' : '#FECACA'}`,
          color:  flashMsg.type === 'ok' ? '#059669' : '#DC2626',
        }}>
          {flashMsg.text}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ECFDF5', border: '1px solid #6EE7B7', display: 'inline-block' }} />
          Oferta más baja
        </span>
        <span style={{ fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FEF3C7', border: '1px solid #FBBF24', display: 'inline-block' }} />
          UE adjudicada
        </span>
        <span style={{ fontSize: 10, color: '#888' }}>· Click en la UE para ver sus partidas</span>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E8E6E0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 + bids.length * COL_W }}>
          <thead>
            <tr style={{ background: '#1A1A1A' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', width: 280 }}>
                Unidad / Partida
              </th>
              <th style={{ padding: '14px 10px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', width: 55 }}>
                UD.
              </th>
              <th style={{ padding: '14px 10px', textAlign: 'right', color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', width: 75 }}>
                CANT.
              </th>
              {bids.map(bid => (
                <th key={bid.id} style={{ padding: '14px 16px', textAlign: 'right', color: '#fff', fontSize: 12, fontWeight: 600, width: COL_W, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                  {bid.partner_nombre}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {scope.map(unit => {
              const isExpanded = !!expanded[unit.unit_id]
              const awardedBidId = awards[unit.unit_id]

              // Unit totals per bid + check if bid covers all items in this UE
              const unitTotalValues: Record<string, number> = {}
              const bidCoversUnit:   Record<string, boolean> = {}
              for (const bid of bids) {
                let sub = 0; let allCovered = unit.line_items.length > 0
                for (const li of unit.line_items) {
                  const p = bid.prices[li.id]
                  if (p !== undefined) sub += p * li.cantidad
                  else allCovered = false
                }
                unitTotalValues[bid.id] = sub
                bidCoversUnit[bid.id]   = allCovered
              }
              const minUnitTotalIds = minBidIds(
                Object.fromEntries(Object.entries(unitTotalValues).filter(([id]) => bidCoversUnit[id]))
              )

              const unitDaysValues: Record<string, number> = {}
              for (const bid of bids) {
                const d = bid.totalDaysByUnit[unit.unit_id]
                if (d) unitDaysValues[bid.id] = d
              }

              return (
                <React.Fragment key={unit.unit_id}>
                  {/* Unit row (clickable to expand line items) */}
                  <tr
                    style={{
                      background: awardedBidId ? '#FEF3C7' : '#F5F4F0',
                      borderTop: '2px solid #E8E6E0',
                    }}
                  >
                    <td
                      colSpan={3}
                      onClick={() => toggleExpanded(unit.unit_id)}
                      style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#333', letterSpacing: '0.02em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      <span style={{ marginRight: 8, fontSize: 10, color: '#AAA' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      {unit.unit_nombre}
                      <span style={{ fontSize: 9, color: '#BBB', marginLeft: 8, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>
                        {unit.line_items.length} partida{unit.line_items.length !== 1 ? 's' : ''}
                      </span>
                      {awardedBidId && (
                        <span style={{ marginLeft: 12, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#D97706', color: '#fff', letterSpacing: '0.04em', textTransform: 'none' }}>
                          ADJUDICADA · {bids.find(b => b.id === awardedBidId)?.partner_nombre ?? '?'}
                        </span>
                      )}
                    </td>

                    {bids.map(bid => {
                      const val      = unitTotalValues[bid.id] ?? 0
                      const days     = unitDaysValues[bid.id]
                      const covers   = bidCoversUnit[bid.id]
                      const isCheap  = minUnitTotalIds.includes(bid.id) && val > 0
                      const isAwarded = awardedBidId === bid.id
                      const isLoading = awardingUnit === unit.unit_id

                      return (
                        <td key={bid.id} style={{
                          padding: '8px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700,
                          borderLeft: '1px solid #E8E6E0',
                          background: isAwarded ? '#FDE68A' : isCheap ? '#ECFDF5' : 'transparent',
                          verticalAlign: 'top',
                        }}>
                          {covers ? (
                            <>
                              <div style={{ color: isAwarded ? '#92400E' : isCheap ? '#059669' : '#555' }}>
                                {euros(val)}
                              </div>
                              {days != null && (
                                <div style={{ marginTop: 2, fontSize: 10, color: '#888', fontWeight: 600 }}>
                                  {days}d
                                </div>
                              )}
                              <div style={{ marginTop: 6 }}>
                                {isAwarded ? (
                                  <button
                                    onClick={() => handleRevertUnit(unit.unit_id)}
                                    disabled={isLoading}
                                    style={{
                                      padding: '4px 8px', fontSize: 10, fontWeight: 600,
                                      borderRadius: 4, border: '1px solid #D97706',
                                      background: '#fff', color: '#D97706', cursor: 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    Deshacer
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAwardUnit(unit.unit_id, bid.id, bid.partner_nombre)}
                                    disabled={isLoading || !!awardedBidId}
                                    style={{
                                      padding: '4px 10px', fontSize: 10, fontWeight: 700,
                                      borderRadius: 4, border: 'none',
                                      background: awardedBidId ? '#E8E6E0' : '#D85A30',
                                      color: awardedBidId ? '#999' : '#fff',
                                      cursor: awardedBidId ? 'not-allowed' : 'pointer',
                                      fontFamily: 'inherit', letterSpacing: '0.04em',
                                      opacity: isLoading ? 0.5 : 1,
                                    }}
                                  >
                                    {isLoading ? '…' : 'Adjudicar'}
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>sin oferta</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>

                  {/* Expanded line items */}
                  {isExpanded && unit.line_items.map((li, idx) => {
                    const liPriceValues: Record<string, number> = {}
                    for (const bid of bids) {
                      const p = bid.prices[li.id]
                      if (p !== undefined) liPriceValues[bid.id] = p * li.cantidad
                    }
                    const minLiIds = minBidIds(liPriceValues)

                    return (
                      <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: idx % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={{ padding: '9px 16px 9px 36px', fontSize: 12, color: '#333' }}>
                          {li.nombre}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, color: '#999', fontWeight: 600 }}>
                          {li.unidad_medida}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
                          {li.cantidad.toLocaleString('es-ES')}
                        </td>
                        {bids.map(bid => {
                          const price   = bid.prices[li.id]
                          const importe = price !== undefined ? price * li.cantidad : null
                          const isCheap = minLiIds.includes(bid.id) && importe != null
                          return (
                            <td key={bid.id} style={{
                              padding: '9px 16px', textAlign: 'right',
                              borderLeft: '1px solid #F0EEE8',
                              background: isCheap ? '#ECFDF5' : 'transparent',
                            }}>
                              {price !== undefined ? (
                                <>
                                  <div style={{ fontSize: 10, color: '#BBB', marginBottom: 1 }}>
                                    {euros(price)}/{li.unidad_medida}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: isCheap ? '#059669' : '#1A1A1A', fontFamily: 'monospace' }}>
                                    {euros(importe!)}
                                  </div>
                                </>
                              ) : (
                                <span style={{ fontSize: 12, color: '#DDD' }}>—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Sticky footer with progress */}
      <div style={{
        marginTop: 16, padding: '14px 18px', borderRadius: 10,
        background: allAwarded ? '#ECFDF5' : '#FAFAF8',
        border: `1px solid ${allAwarded ? '#6EE7B7' : '#E8E6E0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: allAwarded ? '#059669' : '#333' }}>
            {allAwarded
              ? '✓ Todas las UEs adjudicables están adjudicadas'
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
            style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#059669', color: '#fff' }}
          >
            Ir al Overview de adjudicaciones →
          </button>
        )}
      </div>

      {/* Notes per bid */}
      {bids.some(b => b.notas) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bids.filter(b => b.notas).map(bid => (
            <div key={bid.id} style={{ padding: '10px 14px', background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#555' }}>{bid.partner_nombre}: </span>
              <span style={{ color: '#777' }}>{bid.notas}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getTenderBids,
  awardBid,
  type ScopeUnitRow,
  type TenderBidRow,
} from '@/app/actions/fpe-tenders'

// ── Helpers ───────────────────────────────────────────────────────────────────

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// ── Component ─────────────────────────────────────────────────────────────────

export default function BidComparison({
  tenderId,
  projectId,
}: {
  tenderId:  string
  projectId: string
}) {
  const router = useRouter()

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [scope, setScope]       = useState<ScopeUnitRow[]>([])
  const [bids, setBids]         = useState<TenderBidRow[]>([])
  const [awarding, setAwarding] = useState<string | null>(null)
  const [flashMsg, setFlash]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    getTenderBids(tenderId, projectId).then(res => {
      setLoading(false)
      if ('error' in res) { setError(res.error); return }
      setScope(res.scope)
      setBids(res.bids)
    })
  }, [tenderId, projectId])

  const handleAward = async (bid: TenderBidRow) => {
    if (!confirm(`¿Adjudicar el proyecto a ${bid.partner_nombre}?\n\nEl estado del proyecto cambiará a "Adjudicado".`)) return
    setAwarding(bid.id)
    const res = await awardBid({ bid_id: bid.id, project_id: projectId })
    setAwarding(null)
    if ('error' in res) {
      setFlash({ type: 'err', text: res.error })
      return
    }
    setBids(prev => prev.map(b => b.id === bid.id ? { ...b, status: 'awarded' } : b))
    setFlash({ type: 'ok', text: `Proyecto adjudicado a ${bid.partner_nombre}.` })
    router.refresh()
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows: string[] = []

    // Header
    rows.push([
      q('Partida'), q('Ud.'), q('Cantidad'),
      ...bids.flatMap(b => [q(`${b.partner_nombre} — P/Ud`), q(`${b.partner_nombre} — Importe`)]),
    ].join(','))

    for (const unit of scope) {
      // Unit row
      rows.push([q(unit.unit_nombre), '', '', ...bids.flatMap(() => ['', ''])].join(','))
      for (const li of unit.line_items) {
        rows.push([
          q(li.nombre), q(li.unidad_medida), String(li.cantidad),
          ...bids.flatMap(b => {
            const p = b.prices[li.id]
            return p !== undefined
              ? [p.toFixed(2), (p * li.cantidad).toFixed(2)]
              : ['', '']
          }),
        ].join(','))
      }
    }

    // Total row
    rows.push([
      q('TOTAL GENERAL'), '', '',
      ...bids.flatMap(b => ['', (grandTotals[b.id]?.total ?? 0).toFixed(2)]),
    ].join(','))

    const csv  = '\uFEFF' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'comparativa-ofertas.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#AAA', fontSize: 13 }}>
        Cargando comparativa…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
        Error: {error}
      </div>
    )
  }

  if (bids.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
        No hay ofertas enviadas todavía.
      </div>
    )
  }

  // ── Totals ────────────────────────────────────────────────────────────────

  const allLineItems = scope.flatMap(u => u.line_items.map(li => ({ liId: li.id, cant: li.cantidad })))

  const grandTotals: Record<string, { total: number; missing: number }> = {}
  for (const bid of bids) {
    let total = 0; let missing = 0
    for (const { liId, cant } of allLineItems) {
      const p = bid.prices[liId]
      if (p !== undefined) total += p * cant
      else missing++
    }
    grandTotals[bid.id] = { total, missing }
  }

  const minTotal = Math.min(...bids.map(b => grandTotals[b.id]?.total ?? Infinity))
  const alreadyAwarded = bids.some(b => b.status === 'awarded')

  const COL_W = 160

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Export button */}
      {bids.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            onClick={handleExportCSV}
            style={{ padding: '6px 14px', fontSize: 11, borderRadius: 5, border: '1px solid #E8E6E0', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: '#fff', color: '#555' }}
          >
            Exportar CSV
          </button>
        </div>
      )}

      {/* Flash message */}
      {flashMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 16,
          background: flashMsg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${flashMsg.type === 'ok' ? '#6EE7B7' : '#FECACA'}`,
          color: flashMsg.type === 'ok' ? '#059669' : '#DC2626',
        }}>
          {flashMsg.text}
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E8E6E0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 + bids.length * COL_W }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <thead>
            <tr style={{ background: '#1A1A1A' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', width: 280 }}>
                Partida
              </th>
              <th style={{ padding: '14px 10px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', width: 55 }}>
                UD.
              </th>
              <th style={{ padding: '14px 10px', textAlign: 'right', color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', width: 75 }}>
                CANT.
              </th>
              {bids.map(bid => (
                <th key={bid.id} style={{ padding: '14px 16px', textAlign: 'right', color: '#fff', fontSize: 12, fontWeight: 600, width: COL_W, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>{bid.partner_nombre}</div>
                  {bid.status === 'awarded' && (
                    <div style={{ fontSize: 9, color: '#34D399', fontWeight: 700, letterSpacing: '0.08em', marginTop: 3, textTransform: 'uppercase' }}>
                      Adjudicado
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body: units + line items ─────────────────────────────────── */}
          <tbody>
            {scope.map(unit => {
              const unitTotals: Record<string, number> = {}
              for (const bid of bids) {
                let sub = 0
                for (const li of unit.line_items) {
                  const p = bid.prices[li.id]
                  if (p !== undefined) sub += p * li.cantidad
                }
                unitTotals[bid.id] = sub
              }

              return (
                <React.Fragment key={unit.unit_id}>
                  {/* Unit subheader */}
                  <tr style={{ background: '#F5F4F0', borderTop: '2px solid #E8E6E0' }}>
                    <td colSpan={3} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#333', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      {unit.unit_nombre}
                    </td>
                    {bids.map(bid => (
                      <td key={bid.id} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#555', borderLeft: '1px solid #E8E6E0' }}>
                        {euros(unitTotals[bid.id] ?? 0)}
                      </td>
                    ))}
                  </tr>

                  {/* Line items */}
                  {unit.line_items.map((li, idx) => (
                    <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: idx % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                      <td style={{ padding: '9px 16px 9px 28px', fontSize: 12, color: '#333' }}>
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
                        return (
                          <td key={bid.id} style={{ padding: '9px 16px', textAlign: 'right', borderLeft: '1px solid #F0EEE8' }}>
                            {price !== undefined ? (
                              <>
                                <div style={{ fontSize: 10, color: '#BBB', marginBottom: 1 }}>
                                  {euros(price)}/{li.unidad_medida}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontFamily: 'monospace' }}>
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
                  ))}
                </React.Fragment>
              )
            })}

            {/* ── Grand total row ──────────────────────────────────────────── */}
            <tr style={{ background: '#1A1A1A', borderTop: '2px solid #333' }}>
              <td colSpan={3} style={{ padding: '16px 16px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Total general
              </td>
              {bids.map(bid => {
                const { total, missing } = grandTotals[bid.id] ?? { total: 0, missing: 0 }
                const isMin = total > 0 && total === minTotal
                return (
                  <td key={bid.id} style={{ padding: '16px 16px', textAlign: 'right', verticalAlign: 'top', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: isMin ? '#34D399' : '#fff', fontFamily: 'monospace' }}>
                      {euros(total)}
                    </div>
                    {missing > 0 && (
                      <div style={{ fontSize: 9, color: '#F97316', marginTop: 3, letterSpacing: '0.04em' }}>
                        {missing} partida{missing !== 1 ? 's' : ''} sin precio
                      </div>
                    )}
                    {isMin && (
                      <div style={{ fontSize: 9, color: '#34D399', marginTop: 3, fontWeight: 700, letterSpacing: '0.06em' }}>
                        OFERTA MÁS BAJA
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* ── Award row ────────────────────────────────────────────────── */}
            <tr style={{ background: '#111' }}>
              <td colSpan={3} style={{ padding: '14px 16px' }} />
              {bids.map(bid => (
                <td key={bid.id} style={{ padding: '14px 16px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                  {bid.status === 'awarded' ? (
                    <span style={{ fontSize: 11, color: '#34D399', fontWeight: 700, letterSpacing: '0.04em' }}>
                      ✓ Adjudicado
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAward(bid)}
                      disabled={!!awarding || alreadyAwarded}
                      style={{
                        padding: '8px 16px', fontSize: 11, borderRadius: 5, border: 'none',
                        cursor: alreadyAwarded ? 'default' : 'pointer',
                        fontFamily: 'inherit', fontWeight: 600,
                        background: awarding === bid.id ? '#555' : '#D85A30',
                        color: '#fff',
                        opacity: alreadyAwarded ? 0.35 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {awarding === bid.id ? 'Adjudicando…' : 'Adjudicar'}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
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

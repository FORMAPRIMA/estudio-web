'use client'

import React, { useState } from 'react'
import type { UIChapter, UIPartida, UIUnit } from '@/lib/fp-execution/obra-presupuesto'

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const num = (n: number, max = 3) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: max })

export default function PresupuestoTable({
  view,
  perChapter,
  grand,
  editable,
  onEditPartida,
  onDeletePartida,
  onAddPartida,
  onDeleteUnit,
  onAddUnit,
  onUndoPending,
}: {
  view:          UIChapter[]
  perChapter:    Record<string, number>
  grand:         number
  editable:      boolean
  onEditPartida: (p: UIPartida, u: UIUnit, ch: UIChapter) => void
  onDeletePartida: (p: UIPartida, u: UIUnit, ch: UIChapter) => void
  onAddPartida:  (u: UIUnit, ch: UIChapter) => void
  onDeleteUnit:  (u: UIUnit, ch: UIChapter) => void
  onAddUnit:     (ch: UIChapter) => void
  onUndoPending: (logId: string) => void
}) {
  const [collapsedCh, setCollapsedCh] = useState<Record<string, boolean>>({})
  const [collapsedUE, setCollapsedUE] = useState<Record<string, boolean>>({})

  const toggleCh = (id: string) => setCollapsedCh(s => ({ ...s, [id]: !s[id] }))
  const toggleUE = (id: string) => setCollapsedUE(s => ({ ...s, [id]: !s[id] }))

  // ── Visual tokens según estado ────────────────────────────────────────────
  const numColor    = editable ? '#1A1A1A' : '#BBB'
  const labelColor  = editable ? '#555'    : '#AAA'
  const subColor    = editable ? '#888'    : '#BBB'

  if (view.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px dashed #E8E6E0', borderRadius: 10,
        padding: '60px 20px', textAlign: 'center', color: '#888', fontSize: 13,
      }}>
        Presupuesto vacío. No hay capítulos ni unidades adjudicadas.
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 90px 110px 110px 80px',
        gap: 10, padding: '10px 16px',
        background: '#FAFAF8', borderBottom: '1px solid #E8E6E0',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888',
      }}>
        <div>Concepto</div>
        <div style={{ textAlign: 'right' }}>Cantidad</div>
        <div style={{ textAlign: 'left' }}>U. medida</div>
        <div style={{ textAlign: 'right' }}>Precio ud.</div>
        <div style={{ textAlign: 'right' }}>Total</div>
        <div style={{ textAlign: 'right' }}>{editable ? 'Acciones' : ''}</div>
      </div>

      {view.map(ch => {
        const chCollapsed = !!collapsedCh[ch.id]
        return (
          <React.Fragment key={ch.id}>
            {/* Chapter row */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', background: '#1A1A1A',
                cursor: 'pointer', userSelect: 'none',
              }}
              onClick={() => toggleCh(ch.id)}
            >
              <span style={{ color: '#fff', fontSize: 10, width: 10, display: 'inline-block' }}>
                {chCollapsed ? '▶' : '▼'}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
                {ch.nombre}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {euros(perChapter[ch.id] ?? 0)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onAddUnit(ch) }}
                  title="Añadir UE"
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >+ UE</button>
              )}
            </div>

            {!chCollapsed && ch.units.map(u => {
              const ueCollapsed = !!collapsedUE[u.id]
              const ueTotal = u.partidas
                .filter(p => !p.is_deleted)
                .reduce((a, p) => a + p.cantidad * p.precio_unitario, 0)
              return (
                <React.Fragment key={u.id}>
                  {/* UE row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 16px 8px 28px',
                      background: u.is_deleted ? '#FEF2F2' : (u.is_new ? '#F0F7EE' : '#F8F7F4'),
                      borderTop: '1px solid #F0EEE8',
                      cursor: 'pointer', userSelect: 'none',
                    }}
                    onClick={() => toggleUE(u.id)}
                  >
                    <span style={{ fontSize: 10, color: '#666', width: 10, display: 'inline-block' }}>
                      {ueCollapsed ? '▶' : '▼'}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 12, fontWeight: 600,
                      color: u.is_deleted ? '#888' : (editable ? '#1A1A1A' : '#888'),
                      textDecoration: u.is_deleted ? 'line-through' : 'none',
                    }}>
                      {u.nombre}
                      {u.partner_nombre && (
                        <span style={{ fontSize: 10, color: '#888', fontWeight: 500, marginLeft: 8 }}>
                          · {u.partner_nombre}
                        </span>
                      )}
                      {u.is_new && (
                        <span style={{
                          marginLeft: 8, fontSize: 9, fontWeight: 700,
                          background: '#86EFAC', color: '#065F46',
                          padding: '2px 6px', borderRadius: 3,
                        }}>NUEVA</span>
                      )}
                      {u.is_deleted && (
                        <span style={{
                          marginLeft: 8, fontSize: 9, fontWeight: 700,
                          background: '#FCA5A5', color: '#7F1D1D',
                          padding: '2px 6px', borderRadius: 3,
                        }}>ELIMINAR</span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: subColor, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {euros(ueTotal)}
                    </span>
                    {editable && !u.is_new && !u.is_deleted && (
                      <>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onAddPartida(u, ch) }}
                          title="Añadir partida"
                          style={iconBtnStyle}
                        >+ partida</button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onDeleteUnit(u, ch) }}
                          title="Eliminar UE"
                          style={{ ...iconBtnStyle, color: '#DC2626' }}
                        >✕</button>
                      </>
                    )}
                    {editable && u.pending_log_id && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onUndoPending(u.pending_log_id!) }}
                        title="Deshacer cambio pendiente"
                        style={{ ...iconBtnStyle, color: '#888' }}
                      >↶ undo</button>
                    )}
                  </div>

                  {/* Partidas */}
                  {!ueCollapsed && u.partidas.map(p => {
                    const total = p.cantidad * p.precio_unitario
                    const hasEditPending = !!p.original
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 100px 90px 110px 110px 80px',
                          gap: 10, padding: '7px 16px 7px 50px',
                          borderTop: '1px solid #F8F7F4',
                          alignItems: 'center',
                          background: p.is_deleted ? '#FEF2F2' : (p.is_new ? '#F0F7EE' : (hasEditPending ? '#FFF7ED' : '#fff')),
                          textDecoration: p.is_deleted ? 'line-through' : 'none',
                          opacity: p.is_deleted ? 0.6 : 1,
                        }}
                      >
                        <div style={{ fontSize: 11.5, color: labelColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 4, height: 4, borderRadius: '50%',
                            background: hasEditPending ? '#D85A30' : (p.is_new ? '#059669' : '#CCC'),
                          }} />
                          {p.nombre}
                          {p.is_new && (
                            <span style={{ fontSize: 8, fontWeight: 700, background: '#86EFAC', color: '#065F46', padding: '1px 5px', borderRadius: 2 }}>NUEVA</span>
                          )}
                          {hasEditPending && (
                            <span style={{ fontSize: 8, fontWeight: 700, background: '#FED7AA', color: '#9A3412', padding: '1px 5px', borderRadius: 2 }}>MODIFICADA</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: numColor, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {num(p.cantidad)}
                          {hasEditPending && p.original && p.original.cantidad !== p.cantidad && (
                            <div style={{ fontSize: 9, color: '#999', textDecoration: 'line-through' }}>
                              {num(p.original.cantidad)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: subColor }}>{p.unidad_medida}</div>
                        <div style={{ fontSize: 11, color: numColor, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {euros(p.precio_unitario)}
                          {hasEditPending && p.original && p.original.precio_unitario !== p.precio_unitario && (
                            <div style={{ fontSize: 9, color: '#999', textDecoration: 'line-through' }}>
                              {euros(p.original.precio_unitario)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: numColor, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {euros(total)}
                        </div>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {editable && !p.is_deleted && !p.is_new && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditPartida(p, u, ch)}
                                title="Modificar partida"
                                style={iconBtnStyle}
                              >✏</button>
                              <button
                                type="button"
                                onClick={() => onDeletePartida(p, u, ch)}
                                title="Eliminar partida"
                                style={{ ...iconBtnStyle, color: '#DC2626' }}
                              >✕</button>
                            </>
                          )}
                          {editable && p.pending_log_id && (
                            <button
                              type="button"
                              onClick={() => onUndoPending(p.pending_log_id!)}
                              title="Deshacer cambio pendiente"
                              style={{ ...iconBtnStyle, color: '#888' }}
                            >↶</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </React.Fragment>
        )
      })}

      {/* Grand total */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16,
        padding: '14px 18px', background: '#FAFAF8', borderTop: '2px solid #1A1A1A',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
          Total presupuesto
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: editable ? '#1A1A1A' : '#888', fontVariantNumeric: 'tabular-nums' }}>
          {euros(grand)}
        </span>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #E8E6E0', borderRadius: 4,
  padding: '3px 8px', fontSize: 11, fontWeight: 600,
  color: '#555', cursor: 'pointer', fontFamily: 'inherit',
}

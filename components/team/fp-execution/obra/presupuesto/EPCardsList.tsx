'use client'

import React, { useMemo, useState } from 'react'
import type { UIChapter } from '@/lib/fp-execution/obra-presupuesto'

// ══════════════════════════════════════════════════════════════════════════════
// EPCardsList — Sección "Execution Partners" al final del Presupuesto.
//
// Una card colapsable por cada partner adjudicado en el proyecto. Muestra:
//   - Colapsada: nombre, contacto, total original, modificaciones, total a pagar
//   - Expandida: alcance contratado (UEs + partidas), plan de pagos original,
//                modificaciones (kind='modification') con estado y links a actas
// ══════════════════════════════════════════════════════════════════════════════

type ModStatus = 'pendiente' | 'facturado' | 'cobrado' | 'pending_aprobacion' | 'cancelado_cliente'

interface PaymentRow {
  id:               string
  project_id:       string
  contract_id:      string
  obra_milestone_id: string | null
  partner_id:       string
  nombre:           string
  pct:              number
  monto:            number
  status:           ModStatus
  fecha_estimada:   string | null
  fecha_facturado:  string | null
  fecha_pago:       string | null
  orden:            number | null
  kind:             'original' | 'modification'
  source_change_log_id: string | null
  milestone:        { id: string; nombre: string } | null
  source_log:       {
    id: string; parent_id: string | null; target_id: string | null
    change_type: string; destino_acta: 'cliente' | 'interna'; razon: string
    session_id: string; applied_at: string | null; cancelled_at: string | null
    acta?:   Array<{ id: string; codigo: string; kind: 'cliente' | 'interna' }> | { id: string; codigo: string; kind: 'cliente' | 'interna' } | null
  } | null
}

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function EPCardsList({
  payments,
  partners,
  view,
}: {
  payments: PaymentRow[]
  partners: Array<{ id: string; nombre: string; email_contacto?: string | null; telefono?: string | null }>
  view:     UIChapter[]                  // para mostrar alcance por partner
}) {
  // Group payments by partner_id
  const byPartner = useMemo(() => {
    const map: Record<string, PaymentRow[]> = {}
    for (const p of payments) {
      if (!map[p.partner_id]) map[p.partner_id] = []
      map[p.partner_id].push(p)
    }
    return map
  }, [payments])

  // Build scope per partner (chapter → UEs)
  const scopeByPartner = useMemo(() => {
    const map: Record<string, Array<{ chapterNombre: string; unit: { id: string; nombre: string; total: number; partidas: Array<{ nombre: string; cantidad: number; um: string; precio: number; total: number }> } }>> = {}
    for (const ch of view) {
      for (const u of ch.units) {
        if (u.is_deleted) continue
        if (!u.partner_id) continue
        const partidas = u.partidas.filter(p => !p.is_deleted).map(p => ({
          nombre:   p.nombre,
          cantidad: p.cantidad,
          um:       p.unidad_medida,
          precio:   p.precio_unitario,
          total:    p.cantidad * p.precio_unitario,
        }))
        const total = partidas.reduce((a, p) => a + p.total, 0)
        if (!map[u.partner_id]) map[u.partner_id] = []
        map[u.partner_id].push({
          chapterNombre: ch.nombre,
          unit: { id: u.id, nombre: u.nombre, total, partidas },
        })
      }
    }
    return map
  }, [view])

  // Partners involved = those with payments OR scope
  const activePartnerIds = useMemo(() => {
    const ids = new Set<string>([...Object.keys(byPartner), ...Object.keys(scopeByPartner)])
    return Array.from(ids)
  }, [byPartner, scopeByPartner])

  const partnerById = useMemo(() => {
    const m: Record<string, { id: string; nombre: string; email_contacto?: string | null; telefono?: string | null }> = {}
    for (const p of partners) m[p.id] = p
    return m
  }, [partners])

  if (activePartnerIds.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#888', marginBottom: 10,
      }}>
        Execution Partners
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activePartnerIds.map(pid => (
          <PartnerCard
            key={pid}
            partner={partnerById[pid] ?? { id: pid, nombre: '—' }}
            payments={byPartner[pid] ?? []}
            scope={scopeByPartner[pid] ?? []}
          />
        ))}
      </div>
    </div>
  )
}

function PartnerCard({
  partner, payments, scope,
}: {
  partner: { id: string; nombre: string; email_contacto?: string | null; telefono?: string | null }
  payments: PaymentRow[]
  scope: Array<{ chapterNombre: string; unit: { id: string; nombre: string; total: number; partidas: Array<{ nombre: string; cantidad: number; um: string; precio: number; total: number }> } }>
}) {
  const [open, setOpen] = useState(false)

  const originals     = payments.filter(p => p.kind === 'original')
  const modifications = payments.filter(p => p.kind === 'modification')

  const totalOriginal = originals.reduce((a, p) => a + Number(p.monto), 0)
  const modApplied    = modifications.filter(m => m.status === 'pendiente' || m.status === 'facturado' || m.status === 'cobrado')
  const modPending    = modifications.filter(m => m.status === 'pending_aprobacion')
  const modCancelled  = modifications.filter(m => m.status === 'cancelado_cliente')
  const totalModApplied   = modApplied.reduce((a, p) => a + Number(p.monto), 0)
  const totalModPending   = modPending.reduce((a, p) => a + Number(p.monto), 0)
  const totalModCancelled = modCancelled.reduce((a, p) => a + Number(p.monto), 0)
  const totalToPay        = totalOriginal + totalModApplied

  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header (collapsed) */}
      <div
        style={{
          padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
          display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto',
          gap: 16, alignItems: 'center',
        }}
        onClick={() => setOpen(v => !v)}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
            {open ? '▼' : '▶'} {partner.nombre}
          </div>
          {(partner.email_contacto || partner.telefono) && (
            <div style={{ fontSize: 10.5, color: '#888', marginTop: 2 }}>
              {partner.email_contacto || ''}
              {partner.email_contacto && partner.telefono ? ' · ' : ''}
              {partner.telefono || ''}
            </div>
          )}
        </div>
        <Stat label="Contratado" value={euros(totalOriginal)} />
        <Stat label="Mod. aplicadas" value={euros(totalModApplied)} color={totalModApplied !== 0 ? '#378ADD' : undefined} />
        {totalModPending !== 0 && <Stat label="Mod. pdte. aprob." value={euros(totalModPending)} color="#9A3412" />}
        {totalModCancelled !== 0 && <Stat label="Mod. canceladas" value={euros(totalModCancelled)} color="#DC2626" />}
        <Stat label="Total a pagar" value={euros(totalToPay)} bold />
      </div>

      {open && (
        <>
          {/* Alcance */}
          {scope.length > 0 && (
            <Section title="Alcance contratado">
              {scope.map(({ chapterNombre, unit }) => (
                <div key={unit.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>
                    <span style={{ color: '#888' }}>{chapterNombre} · </span>{unit.nombre}
                    <span style={{ marginLeft: 8, color: '#666', fontWeight: 500 }}>
                      {euros(unit.total)}
                    </span>
                  </div>
                  {unit.partidas.length > 0 && (
                    <div style={{ marginLeft: 12, marginTop: 4 }}>
                      {unit.partidas.map((p, i) => (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '1fr 90px 100px 100px',
                          gap: 8, padding: '3px 0', fontSize: 11, color: '#666',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          <div>{p.nombre}</div>
                          <div style={{ textAlign: 'right' }}>{p.cantidad} {p.um}</div>
                          <div style={{ textAlign: 'right' }}>{euros(p.precio)}</div>
                          <div style={{ textAlign: 'right', fontWeight: 600, color: '#1A1A1A' }}>{euros(p.total)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Plan de pagos original */}
          {originals.length > 0 && (
            <Section title="Plan de pagos original">
              <PaymentTable rows={originals} showActa={false} />
            </Section>
          )}

          {/* Modificaciones */}
          {modifications.length > 0 && (
            <Section title="Modificaciones (pago en hito final)">
              <PaymentTable rows={modifications} showActa />
            </Section>
          )}

          {originals.length === 0 && modifications.length === 0 && (
            <div style={{ padding: '14px 18px', fontSize: 11.5, color: '#888' }}>
              Aún no hay plan de pagos vivo para este partner.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #F0EEE8', padding: '12px 18px' }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#888', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function PaymentTable({ rows, showActa }: { rows: PaymentRow[]; showActa: boolean }) {
  return (
    <div style={{
      border: '1px solid #F0EEE8', borderRadius: 6, overflow: 'hidden',
    }}>
      {rows.map((r, i) => {
        const monto = Number(r.monto)
        const color = monto > 0 ? '#1A1A1A' : monto < 0 ? '#059669' : '#888'
        const acta = Array.isArray(r.source_log?.acta) ? r.source_log?.acta?.[0] : r.source_log?.acta
        return (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 110px 130px 100px',
            gap: 10, padding: '8px 12px', alignItems: 'center',
            borderTop: i > 0 ? '1px solid #F8F7F4' : undefined,
          }}>
            <div style={{ fontSize: 11.5, color: '#1A1A1A' }}>
              {r.nombre}
              {showActa && acta && (
                <span style={{ marginLeft: 6, fontSize: 10, color: '#888' }}>
                  · {acta.codigo}
                </span>
              )}
              {r.milestone && !showActa && (
                <span style={{ marginLeft: 6, fontSize: 10, color: '#888' }}>
                  · {r.milestone.nombre}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10 }}>
              <StatusPill status={r.status} />
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>
              {r.fecha_estimada ? new Date(r.fecha_estimada).toLocaleDateString('es-ES') : '—'}
            </div>
            <div style={{
              textAlign: 'right', fontSize: 12, fontWeight: 600, color,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {monto >= 0 ? '' : '−'}{euros(Math.abs(monto)).replace('-', '')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ status }: { status: ModStatus }) {
  const map: Record<ModStatus, { label: string; bg: string; fg: string }> = {
    pendiente:          { label: 'PENDIENTE',         bg: '#F0EEE8', fg: '#666'    },
    facturado:          { label: 'FACTURADO',         bg: '#DBEAFE', fg: '#1E40AF' },
    cobrado:            { label: 'COBRADO',           bg: '#86EFAC', fg: '#065F46' },
    pending_aprobacion: { label: 'PENDIENTE APROB.',  bg: '#FED7AA', fg: '#9A3412' },
    cancelado_cliente:  { label: 'CANCELADO',         bg: '#FCA5A5', fg: '#7F1D1D' },
  }
  const s = map[status]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
      background: s.bg, color: s.fg,
    }}>{s.label}</span>
  )
}

function Stat({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#888',
      }}>{label}</div>
      <div style={{
        fontSize: bold ? 13 : 11.5, fontWeight: bold ? 700 : 600,
        color: color ?? '#1A1A1A', marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}

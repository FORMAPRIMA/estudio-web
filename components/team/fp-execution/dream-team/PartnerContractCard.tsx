'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateContractsFromAwards, type FpeOverviewPartner, type FpeOverviewContract } from '@/app/actions/fpe-tenders'

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const TRIGGER_LABEL: Record<string, string> = {
  contract_signed:    'Al firmar contrato',
  milestone_achieved: 'Hito alcanzado',
  delivery:           'A entrega',
}

// ── Status bar (4 estados) ────────────────────────────────────────────────────

type ContractStage = 'pendiente' | 'enviado' | 'firmado' | 'recibido' | 'cancelled'

function deriveStage(c: FpeOverviewContract | null): ContractStage {
  if (!c) return 'pendiente'
  switch (c.status) {
    case 'sent_to_sign': return 'enviado'
    case 'signed':       return 'firmado'
    case 'received':     return 'recibido'
    case 'cancelled':    return 'cancelled'
    default:             return 'pendiente'  // 'draft' or 'pendiente'
  }
}

const STAGES: { id: ContractStage; label: string }[] = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'enviado',   label: 'Enviado'   },
  { id: 'firmado',   label: 'Firmado'   },
  { id: 'recibido',  label: 'Recibido'  },
]

function StatusBar({ stage }: { stage: ContractStage }) {
  const stageIdx = STAGES.findIndex(s => s.id === stage)
  const cancelled = stage === 'cancelled'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
      {STAGES.map((s, i) => {
        const reached = !cancelled && i <= stageIdx
        const active  = !cancelled && i === stageIdx
        return (
          <React.Fragment key={s.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: cancelled ? '#FEE2E2' : reached ? (active ? '#059669' : '#10B981') : '#F0EEE8',
                color:      cancelled ? '#DC2626' : reached ? '#fff' : '#BBB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                border: active ? '2px solid #059669' : 'none',
              }}>
                {cancelled ? '×' : reached ? '✓' : (i + 1)}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 600, letterSpacing: '0.04em',
                color: cancelled ? '#DC2626' : reached ? '#1A1A1A' : '#999',
                textTransform: 'uppercase',
              }}>
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, minWidth: 18, height: 2, margin: '0 8px',
                background: !cancelled && i < stageIdx ? '#10B981' : '#F0EEE8',
              }} />
            )}
          </React.Fragment>
        )
      })}
      {cancelled && (
        <span style={{
          marginLeft: 12, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          padding: '3px 8px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626',
        }}>
          CANCELADO
        </span>
      )}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

export default function PartnerContractCard({
  partner,
  projectId,
  expanded,
  onToggleExpanded,
  onChange,
}: {
  partner: FpeOverviewPartner
  projectId: string
  expanded: boolean
  onToggleExpanded: () => void
  onChange?: () => void
}) {
  const router = useRouter()
  const stage = deriveStage(partner.contract)
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const totalUnits = partner.chapters.reduce((a, ch) => a + ch.units.length, 0)
  const chCount    = partner.chapters.length
  const totalDays  = partner.chapters.reduce(
    (a, ch) => a + ch.units.reduce((aa, u) => aa + (u.days ?? 0), 0), 0
  )

  const handlePreviewPDF = async () => {
    try {
      const res = await fetch('/api/fpe-contracts/preview-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ project_id: projectId, partner_id: partner.partner_id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error ?? 'No se pudo generar el preview.')
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    }
  }

  const handleSendContract = async () => {
    if (!confirm(`Se generará el contrato de ${partner.partner_nombre} y se enviará a DocuSign para firma. ¿Continuar?`)) return
    setSending(true); setError(null)
    const res = await generateContractsFromAwards(projectId, partner.partner_id)
    setSending(false)
    if ('error' in res) { setError(res.error); return }
    if (onChange) onChange()
    router.refresh()
  }

  const handleViewSignedPDF = () => {
    if (!partner.contract?.id) return
    window.open(`/api/fpe-contracts/${partner.contract.id}/signed-pdf`, '_blank')
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', overflow: 'hidden' }}>

      {/* Header (dark) */}
      <div style={{ background: '#1A1A1A', padding: '16px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{partner.partner_nombre}</div>
            {partner.partner_email && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{partner.partner_email}</div>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                <strong style={{ color: '#fff' }}>{totalUnits}</strong> UE{totalUnits !== 1 ? 's' : ''} en {chCount} capítulo{chCount !== 1 ? 's' : ''}
              </span>
              {totalDays > 0 && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  Plazo agregado: <strong style={{ color: '#fff' }}>{totalDays}d</strong>
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Total contrato
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'monospace', marginTop: 2 }}>
              {euros(partner.total)}
            </div>
          </div>
        </div>

        {partner.disciplines.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {partner.disciplines.map(d => (
              <span key={d.id} style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: d.color, marginRight: 5, verticalAlign: 'middle' }} />
                {d.nombre} · {d.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{ padding: '14px 22px', background: '#FAFAF8', borderBottom: '1px solid #F0EEE8' }}>
        <StatusBar stage={stage} />
        {partner.contract?.sent_at && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#888' }}>
            Enviado: {new Date(partner.contract.sent_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {partner.contract.signed_at && (
              <> · Firmado: {new Date(partner.contract.signed_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '14px 22px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #F0EEE8' }}>
        <button
          onClick={handlePreviewPDF}
          style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #E8E6E0', background: '#fff', color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Ver borrador (PDF)
        </button>

        {(stage === 'pendiente' || stage === 'cancelled') && (
          <button
            onClick={handleSendContract}
            disabled={sending || !partner.partner_email}
            title={!partner.partner_email ? 'El partner no tiene email de contacto.' : ''}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none',
              background: '#D85A30', color: '#fff', cursor: sending || !partner.partner_email ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: sending || !partner.partner_email ? 0.5 : 1,
            }}
          >
            {sending ? 'Enviando…' : 'Enviar contrato a firma →'}
          </button>
        )}

        {stage === 'enviado' && (
          <span style={{
            padding: '8px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
            background: '#FEF3C7', color: '#92400E', display: 'inline-block',
          }}>
            Esperando firmas en DocuSign…
          </span>
        )}

        {stage === 'firmado' && (
          <span style={{
            padding: '8px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
            background: '#FEF3C7', color: '#92400E', display: 'inline-block',
          }}>
            Firmado · esperando descarga del PDF firmado…
          </span>
        )}

        {stage === 'recibido' && (
          <button
            onClick={handleViewSignedPDF}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Ver PDF firmado ↓
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 22px', background: '#FEF2F2', color: '#DC2626', fontSize: 12, borderBottom: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '16px 22px' }}>

        {/* Payment milestones */}
        {partner.governing_discipline_id ? (
          <div style={{ marginBottom: 14, padding: '12px 14px', background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
                Disciplina rectora de pagos
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
                {partner.governing_discipline_nombre}
                <span style={{ fontSize: 10, color: '#999', marginLeft: 6, fontWeight: 400 }}>(auto · dominante)</span>
              </span>
            </div>
            {partner.payment_milestones.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                Esta disciplina aún no tiene hitos de pago configurados.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {partner.payment_milestones.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                    <span style={{ flex: 1, color: '#555' }}>
                      <strong style={{ color: '#1A1A1A' }}>{m.nombre}</strong>
                      <span style={{ color: '#999', marginLeft: 6 }}>· {TRIGGER_LABEL[m.trigger_type] ?? m.trigger_type}</span>
                    </span>
                    <span style={{ color: '#888', fontWeight: 600 }}>{m.pct}%</span>
                    <span style={{ color: '#1A1A1A', fontWeight: 700, fontFamily: 'monospace', minWidth: 90, textAlign: 'right' }}>
                      {euros(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF3C7', borderRadius: 8, fontSize: 11, color: '#92400E' }}>
            No se pudo derivar disciplina rectora de pagos para este pack. Revisa las disciplinas de las UEs.
          </div>
        )}

        {/* Expandable detail */}
        <button
          onClick={onToggleExpanded}
          style={{
            width: '100%', padding: '8px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 6, border: '1px solid #E8E6E0', cursor: 'pointer',
            fontFamily: 'inherit', background: '#fff', color: '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>{expanded ? 'Ocultar UEs y partidas' : 'Ver UEs y partidas adjudicadas'}</span>
          <span style={{ fontSize: 10, color: '#AAA' }}>{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {partner.chapters.map(ch => (
              <div key={ch.chapter_id} style={{ border: '1px solid #F0EEE8', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: '#FAFAF8', borderBottom: '1px solid #F0EEE8' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>{ch.chapter_nombre}</span>
                  <span style={{ fontSize: 10, color: '#AAA', marginLeft: 6 }}>
                    {ch.units.length} UE{ch.units.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div>
                  {ch.units.map(u => (
                    <div key={u.project_unit_id} style={{ padding: '10px 14px', borderBottom: '1px solid #F0EEE8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{u.unit_nombre}</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {u.days != null && (
                            <span style={{ fontSize: 10, color: '#888' }}>{u.days}d</span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace' }}>
                            {euros(u.total)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 12 }}>
                        {u.line_items.map((li, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#777' }}>
                            <span style={{ flex: 1 }}>— {li.nombre}</span>
                            <span style={{ fontFamily: 'monospace' }}>
                              {li.cantidad.toLocaleString('es-ES')} {li.unidad_medida}
                            </span>
                            <span style={{ fontFamily: 'monospace', color: '#888' }}>
                              {euros(li.precio_unitario)}/{li.unidad_medida}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                              {euros(li.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAdjudicationOverview,
  generateContractsFromAwards,
  type FpeOverviewPartner,
} from '@/app/actions/fpe-tenders'

// ── Helpers ───────────────────────────────────────────────────────────────────

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const TRIGGER_LABEL: Record<string, string> = {
  contract_signed:    'Al firmar contrato',
  milestone_achieved: 'Hito alcanzado',
  delivery:           'A entrega',
}

// ── Partner card ──────────────────────────────────────────────────────────────

function PartnerOverviewCard({
  partner,
  expanded,
  onToggleExpanded,
}: {
  partner: FpeOverviewPartner
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const totalUnits = partner.chapters.reduce((a, ch) => a + ch.units.length, 0)
  const chCount   = partner.chapters.length
  const totalDays = partner.chapters.reduce(
    (a, ch) => a + ch.units.reduce((aa, u) => aa + (u.days ?? 0), 0), 0
  )

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', overflow: 'hidden' }}>

      {/* Card header */}
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

        {/* Discipline distribution */}
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

      {/* Card body */}
      <div style={{ padding: '16px 22px' }}>

        {/* Governing discipline + payments */}
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

        {/* Expand to see chapters + UEs */}
        <button
          onClick={onToggleExpanded}
          style={{
            width: '100%', padding: '8px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 6, border: '1px solid #E8E6E0', cursor: 'pointer',
            fontFamily: 'inherit', background: '#fff', color: '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>{expanded ? 'Ocultar detalle del pack' : 'Ver detalle del pack'}</span>
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdjudicationOverview({
  projectId,
  onContractsGenerated,
}: {
  projectId: string
  onContractsGenerated?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [partners, setPartners] = useState<FpeOverviewPartner[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [flashMsg, setFlash] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    getAdjudicationOverview(projectId).then(res => {
      setLoading(false)
      if ('error' in res) { setError(res.error); return }
      setPartners(res.partners)
    })
  }, [projectId])

  const flash = (type: 'ok' | 'err', text: string) => {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 5000)
  }

  const handleGenerate = async () => {
    if (!confirm(`Se crearán ${partners.length} contrato(s) y se enviarán a firma vía DocuSign. ¿Continuar?`)) return
    setGenerating(true)
    const res = await generateContractsFromAwards(projectId)
    setGenerating(false)
    if ('error' in res) { flash('err', res.error); return }
    flash('ok', `${res.created} contrato(s) generados. ${res.sent_to_docusign} enviados a firma.`)
    if (onContractsGenerated) onContractsGenerated()
    router.refresh()
  }

  if (loading) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#AAA', fontSize: 13 }}>
      Cargando overview de adjudicaciones…
    </div>
  )

  if (error) return (
    <div style={{ padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
      Error: {error}
    </div>
  )

  if (partners.length === 0) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0' }}>
      <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
        No hay UEs adjudicadas todavía.
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#AAA' }}>
        Vuelve a la comparativa de ofertas y adjudica las UEs antes de generar contratos.
      </p>
    </div>
  )

  const grandTotal = partners.reduce((a, p) => a + p.total, 0)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>
          Overview de adjudicaciones
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
          Revisión final antes de generar contratos. Cada partner ganador recibirá un único contrato que cubre todas las UEs adjudicadas a su nombre.
        </p>
      </div>

      {flashMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: flashMsg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${flashMsg.type === 'ok' ? '#6EE7B7' : '#FECACA'}`,
          color:  flashMsg.type === 'ok' ? '#059669' : '#DC2626',
        }}>
          {flashMsg.text}
        </div>
      )}

      {/* Summary bar */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '14px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Contratos a generar</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace' }}>{partners.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Suma de contratos</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace' }}>{euros(grandTotal)}</div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '11px 22px', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
            borderRadius: 6, border: 'none', cursor: generating ? 'wait' : 'pointer',
            fontFamily: 'inherit', background: '#059669', color: '#fff',
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? 'Generando contratos…' : 'Generar contratos y enviar a firma →'}
        </button>
      </div>

      {/* Partner cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {partners.map(p => (
          <PartnerOverviewCard
            key={p.partner_id}
            partner={p}
            expanded={expandedId === p.partner_id}
            onToggleExpanded={() => setExpandedId(prev => prev === p.partner_id ? null : p.partner_id)}
          />
        ))}
      </div>
    </div>
  )
}

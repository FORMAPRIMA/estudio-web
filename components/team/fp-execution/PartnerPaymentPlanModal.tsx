'use client'

import React, { useEffect, useState } from 'react'
import {
  getInvitationPaymentPlan,
  regenerateInvitationPaymentPlan,
  updateInvitationPaymentPlan,
  type InvitationPaymentPlanPayload,
} from '@/app/actions/fpe-payment'
import type { PaymentPlanSeedStrategy } from '@/lib/fp-execution/domain'

interface PlanRow {
  nombre: string
  pct: number
  trigger_type: 'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start'
  milestone_id: string | null
  source_discipline_id: string | null
}

interface MilestoneOption {
  id: string
  nombre: string
}

const TRIGGER_LABEL: Record<PlanRow['trigger_type'], string> = {
  contract_signed:    'Firma',
  milestone_achieved: 'Hito ejec.',
  delivery:           'Entrega',
  pre_start:          'Pre-inicio partner',
  pre_project_start:  'Pre-inicio obra',
}

export default function PartnerPaymentPlanModal({
  invitationId,
  partnerNombre,
  onClose,
  onSaved,
}: {
  invitationId: string
  partnerNombre: string
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [regen,   setRegen]       = useState<PaymentPlanSeedStrategy | null>(null)
  const [payload, setPayload]     = useState<InvitationPaymentPlanPayload | null>(null)
  const [rows, setRows]           = useState<PlanRow[]>([])
  const [milestones, setMilestones] = useState<MilestoneOption[]>([])
  const [err, setErr]             = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await getInvitationPaymentPlan(invitationId)
    setLoading(false)
    if ('error' in res) { setErr(res.error); return }
    setPayload(res)
    setMilestones(res.availableMilestones)
    setRows(res.plan.map(p => ({
      nombre:               p.nombre,
      pct:                  Number(p.pct),
      trigger_type:         p.trigger_type,
      milestone_id:         p.milestone_id,
      source_discipline_id: p.source_discipline_id,
    })))
  }

  useEffect(() => { void load() /* eslint-disable-next-line */ }, [invitationId])

  const sum = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0)
  const sumOk = Math.abs(sum - 100) < 0.01
  const milestonesMissing = rows.some(r => r.trigger_type === 'milestone_achieved' && !r.milestone_id)
  const canSave = sumOk && !milestonesMissing

  const handleRegen = async (strategy: PaymentPlanSeedStrategy) => {
    setRegen(strategy); setErr(null)
    const res = await regenerateInvitationPaymentPlan(invitationId, strategy)
    setRegen(null)
    if ('error' in res) { setErr(res.error); return }
    await load()
  }

  const handleAdd = () => {
    setRows(prev => [...prev, { nombre: 'Nuevo hito', pct: 0, trigger_type: 'milestone_achieved', milestone_id: null, source_discipline_id: null }])
  }

  const handleDelete = (i: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleMove = (i: number, dir: -1 | 1) => {
    setRows(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const handleField = <K extends keyof PlanRow>(i: number, key: K, value: PlanRow[K]) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }

  const handleSave = async () => {
    if (!sumOk) { setErr(`La suma debe ser 100% (actual: ${sum.toFixed(2)}%).`); return }
    if (milestonesMissing) { setErr('Hay hitos con trigger "Hito ejec." sin hito de obra asociado.'); return }
    setSaving(true); setErr(null)
    const res = await updateInvitationPaymentPlan(invitationId, rows)
    setSaving(false)
    if ('error' in res) { setErr(res.error); return }
    onSaved()
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: '100%', maxWidth: 880,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
              Condiciones de pago de la invitación
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>{partnerNombre}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 12 }}>Cargando…</div>
          ) : !payload ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#DC2626', fontSize: 12 }}>{err ?? 'No se pudo cargar.'}</div>
          ) : (
            <>
              {/* Strategy buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Regenerar desde:</span>
                {(['dominant', 'blended', 'concatenated'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleRegen(s)}
                    disabled={regen !== null || saving}
                    style={{
                      padding: '6px 12px', fontSize: 11, fontWeight: 600,
                      background: regen === s ? '#1A1A1A' : '#fff',
                      color:      regen === s ? '#fff' : '#1A1A1A',
                      border: '1px solid #1A1A1A', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {regen === s ? 'Recalculando…' : s === 'dominant' ? 'Dominante' : s === 'blended' ? 'Mezcla ponderada' : 'Concatenado'}
                  </button>
                ))}
              </div>

              {/* Plan editor */}
              <div style={{ border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 130px 1fr 70px', gap: 8, padding: '8px 12px', background: '#F8F7F4', fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <span>#</span>
                  <span>Nombre</span>
                  <span style={{ textAlign: 'right' }}>%</span>
                  <span>Trigger</span>
                  <span>Hito de obra</span>
                  <span></span>
                </div>
                {rows.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: '#888' }}>
                    No hay hitos. Regenera con una estrategia o añade manualmente.
                  </div>
                ) : rows.map((r, i) => {
                  const needsMilestone = r.trigger_type === 'milestone_achieved'
                  const missingMilestone = needsMilestone && !r.milestone_id
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 130px 1fr 70px', gap: 8, padding: '8px 12px', borderTop: '1px solid #F0EEE8', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#888' }}>{i + 1}</span>
                      <input
                        type="text"
                        value={r.nombre}
                        onChange={e => handleField(i, 'nombre', e.target.value)}
                        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 4, fontFamily: 'inherit', outline: 'none' }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={r.pct || ''}
                        onChange={e => handleField(i, 'pct', parseFloat(e.target.value) || 0)}
                        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 4, fontFamily: 'monospace', textAlign: 'right', outline: 'none' }}
                      />
                      <select
                        value={r.trigger_type}
                        onChange={e => {
                          const next = e.target.value as PlanRow['trigger_type']
                          handleField(i, 'trigger_type', next)
                          // Si cambia a un trigger que no necesita milestone, lo limpiamos.
                          if (next !== 'milestone_achieved' && r.milestone_id) {
                            handleField(i, 'milestone_id', null)
                          }
                        }}
                        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 4, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                      >
                        <option value="contract_signed">Firma</option>
                        <option value="pre_project_start">Pre-inicio obra (10 d. háb.)</option>
                        <option value="pre_start">Pre-inicio partner (10 d. háb.)</option>
                        <option value="milestone_achieved">Hito ejec.</option>
                        <option value="delivery">Entrega</option>
                      </select>
                      {needsMilestone ? (
                        <select
                          value={r.milestone_id ?? ''}
                          onChange={e => handleField(i, 'milestone_id', e.target.value || null)}
                          style={{
                            padding: '6px 8px', fontSize: 12,
                            border: `1px solid ${missingMilestone ? '#DC2626' : '#E8E6E0'}`,
                            borderRadius: 4, fontFamily: 'inherit', outline: 'none', background: '#fff',
                            color: missingMilestone ? '#DC2626' : '#1A1A1A',
                          }}
                        >
                          <option value="">— Selecciona hito de obra —</option>
                          {milestones.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>
                          {r.trigger_type === 'contract_signed'
                            ? 'No aplica (firma)'
                            : r.trigger_type === 'pre_start'
                              ? 'No aplica (pre-inicio partner)'
                              : r.trigger_type === 'pre_project_start'
                                ? 'No aplica (pre-inicio obra)'
                                : 'No aplica (entrega)'}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleMove(i, -1)} disabled={i === 0} style={miniBtn}>↑</button>
                        <button onClick={() => handleMove(i,  1)} disabled={i === rows.length - 1} style={miniBtn}>↓</button>
                        <button onClick={() => handleDelete(i)} style={{ ...miniBtn, color: '#DC2626' }}>×</button>
                      </div>
                    </div>
                  )
                })}
                <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EEE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button onClick={handleAdd} style={miniBtn}>+ Añadir hito</button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sumOk ? '#059669' : '#DC2626' }}>
                    Suma: {sum.toFixed(2)}% {sumOk ? '✓' : '✗'}
                  </span>
                </div>
              </div>

              {/* Reference */}
              {payload.reference.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
                    Referencia — planes estándar de cada disciplina
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {payload.reference.map(r => (
                      <div key={r.discipline_id} style={{ padding: '8px 12px', border: '1px solid #F0EEE8', borderRadius: 6, background: '#FAFAF8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.milestones.length > 0 ? 4 : 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: r.color }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{r.nombre}</span>
                          <span style={{ fontSize: 11, color: '#888' }}>
                            · {payload.disciplines.find(d => d.id === r.discipline_id)?.weight ?? 0} UE
                          </span>
                        </div>
                        {r.milestones.length === 0 ? (
                          <span style={{ fontSize: 11, color: '#BBB', fontStyle: 'italic' }}>
                            Sin hitos definidos en plantilla. Edítalos en /team/fp-execution/template.
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {r.milestones.map(m => (
                              <span key={m.id} style={{ fontSize: 10, padding: '2px 8px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, color: '#555' }}>
                                {m.nombre} · {Number(m.pct).toFixed(0)}% · {TRIGGER_LABEL[m.trigger_type]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {err ? <span style={{ fontSize: 11, color: '#DC2626' }}>✗ {err}</span> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={saving} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#1A1A1A', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !canSave} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: canSave ? '#1A1A1A' : '#CCC', color: '#fff', border: 'none', borderRadius: 5, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {saving ? 'Guardando…' : 'Guardar plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  padding: '4px 8px', fontSize: 11, background: '#fff', border: '1px solid #E8E6E0',
  borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', color: '#1A1A1A',
}

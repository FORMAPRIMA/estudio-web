'use client'

import React, { useState } from 'react'
import type { ObraPhase, ObraPhaseStatus } from '@/lib/fp-execution/obra'
import { updateObraPhase } from '@/app/actions/fpe-obra'

const STATUS_OPTIONS: { value: ObraPhaseStatus; label: string; color: string }[] = [
  { value: 'pendiente',  label: 'Pendiente',  color: '#888'    },
  { value: 'en_curso',   label: 'En curso',   color: '#378ADD' },
  { value: 'completada', label: 'Completada', color: '#059669' },
  { value: 'bloqueada',  label: 'Bloqueada',  color: '#DC2626' },
]

export default function ObraPhaseEditor({
  phase,
  onClose,
  onSaved,
}: {
  phase:   ObraPhase
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus]                  = useState<ObraPhaseStatus>(phase.status)
  const [pctAvance, setPctAvance]            = useState<number>(phase.pct_avance)
  const [actualStart, setActualStart]        = useState<string>(phase.actual_start_date ?? '')
  const [actualEnd, setActualEnd]            = useState<string>(phase.actual_end_date ?? '')
  const [actualDuration, setActualDuration]  = useState<string>(phase.actual_duration_dias?.toString() ?? '')
  const [notas, setNotas]                    = useState<string>(phase.notas ?? '')
  const [saving, setSaving]                  = useState(false)
  const [error, setError]                    = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await updateObraPhase({
      phase_id:             phase.id,
      status,
      pct_avance:           pctAvance,
      actual_start_date:    actualStart || null,
      actual_end_date:      actualEnd   || null,
      actual_duration_dias: actualDuration ? Number(actualDuration) : null,
      notas:                notas || null,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved()
  }

  const setQuickStartToday = () => {
    const today = new Date().toISOString().slice(0, 10)
    setActualStart(today)
    if (status === 'pendiente') setStatus('en_curso')
  }
  const setQuickEndToday = () => {
    const today = new Date().toISOString().slice(0, 10)
    setActualEnd(today)
    setStatus('completada')
    setPctAvance(100)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, maxWidth: 520, width: '100%',
        padding: '24px 28px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
              Fase de obra
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
              {phase.nombre}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer', lineHeight: 1, padding: 4 }}
            title="Cerrar (Esc)"
          >✕</button>
        </div>

        <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
          Plan original: {phase.planned_start_date} → {phase.planned_end_date} ({phase.planned_duration_dias ?? '—'} días háb.)
        </div>

        {/* Estado */}
        <Field label="Estado">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                style={{
                  padding: '7px 14px', fontSize: 11, fontWeight: 600,
                  borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  background: status === opt.value ? opt.color : '#F8F7F4',
                  color:      status === opt.value ? '#fff'    : '#666',
                  border:     `1px solid ${status === opt.value ? opt.color : '#E8E6E0'}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* % avance */}
        <Field label="Avance (%)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={0} max={100} step={5}
              value={pctAvance}
              onChange={e => setPctAvance(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#D85A30' }}
            />
            <input
              type="number"
              min={0} max={100} step={1}
              value={pctAvance}
              onChange={e => setPctAvance(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              style={{
                width: 64, padding: '6px 8px', fontSize: 12,
                border: '1px solid #E8E6E0', borderRadius: 5, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 12, color: '#999' }}>%</span>
          </div>
        </Field>

        {/* Fechas reales */}
        <Field label="Fecha real de inicio">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={actualStart}
              onChange={e => setActualStart(e.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={setQuickStartToday} style={quickBtnStyle}>Hoy</button>
            {actualStart && (
              <button type="button" onClick={() => setActualStart('')} style={quickBtnStyle}>Limpiar</button>
            )}
          </div>
        </Field>

        <Field label="Fecha real de fin">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={actualEnd}
              onChange={e => setActualEnd(e.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={setQuickEndToday} style={quickBtnStyle}>Hoy (completar)</button>
            {actualEnd && (
              <button type="button" onClick={() => setActualEnd('')} style={quickBtnStyle}>Limpiar</button>
            )}
          </div>
        </Field>

        <Field label="Duración real (días háb.)">
          <input
            type="number"
            min={0} step={1}
            value={actualDuration}
            onChange={e => setActualDuration(e.target.value)}
            placeholder="—"
            style={{ ...inputStyle, width: 100 }}
          />
        </Field>

        <Field label="Notas">
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Incidencias, motivos de retraso, observaciones…"
            style={{
              width: '100%', padding: '8px 10px', fontSize: 12,
              border: '1px solid #E8E6E0', borderRadius: 6, resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </Field>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
            padding: '8px 12px', marginTop: 4, fontSize: 12, color: '#DC2626',
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
              padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#666',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Cancelar</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 18px', fontSize: 12, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
            }}
          >{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12,
  border: '1px solid #E8E6E0', borderRadius: 6,
  fontFamily: 'inherit', color: '#1A1A1A',
}

const quickBtnStyle: React.CSSProperties = {
  background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 5,
  padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#666',
  cursor: 'pointer', fontFamily: 'inherit',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: '#888', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

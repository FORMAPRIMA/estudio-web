'use client'

import React, { useMemo, useState } from 'react'
import type { ObraPhase, ObraPhaseStatus } from '@/lib/fp-execution/obra'
import { updateObraPhase } from '@/app/actions/fpe-obra'

// ══════════════════════════════════════════════════════════════════════════════
// ObraPhaseEditor
//
// Las fechas de la fase NO son inputs primarios — vienen del CPM (desde
// obra_fecha_inicio + duraciones + dependencias). El editor presenta:
//   1. Plan actual (read-only) — lo que dice el CPM hoy.
//   2. Estado de avance — status + % + botones rápidos.
//   3. Override de realidad (opcional) — sólo si lo real difirió del plan.
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_OPTIONS: { value: ObraPhaseStatus; label: string; color: string }[] = [
  { value: 'pendiente',  label: 'Pendiente',  color: '#888'    },
  { value: 'en_curso',   label: 'En curso',   color: '#378ADD' },
  { value: 'completada', label: 'Completada', color: '#059669' },
  { value: 'bloqueada',  label: 'Bloqueada',  color: '#DC2626' },
]

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

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
  const [plannedDuration, setPlannedDuration] = useState<string>(phase.planned_duration_dias?.toString() ?? '')
  const [notas, setNotas]                    = useState<string>(phase.notas ?? '')
  const [saving, setSaving]                  = useState(false)
  const [error, setError]                    = useState<string | null>(null)
  const [showOverrides, setShowOverrides]    = useState<boolean>(!!(phase.actual_start_date || phase.actual_end_date))

  // Duración real derivada (si tenemos start + end reales)
  const derivedActualDuration = useMemo(() => {
    if (!actualStart || !actualEnd) return null
    const s = new Date(actualStart + 'T00:00:00Z').getTime()
    const e = new Date(actualEnd   + 'T00:00:00Z').getTime()
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null
    return Math.round((e - s) / 86400000) + 1
  }, [actualStart, actualEnd])

  const handleSave = async () => {
    setSaving(true); setError(null)
    const newDuration = plannedDuration === '' ? null : Math.max(0, Number(plannedDuration))
    const res = await updateObraPhase({
      phase_id:               phase.id,
      status,
      pct_avance:             pctAvance,
      actual_start_date:      actualStart || null,
      actual_end_date:        actualEnd   || null,
      planned_duration_dias:  newDuration,
      notas:                  notas || null,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved()
  }

  const quickStart = () => {
    const today = new Date().toISOString().slice(0, 10)
    setActualStart(today)
    setShowOverrides(true)
    if (status === 'pendiente') setStatus('en_curso')
  }
  const quickComplete = () => {
    const today = new Date().toISOString().slice(0, 10)
    if (!actualStart) setActualStart(today)
    setActualEnd(today)
    setStatus('completada')
    setPctAvance(100)
    setShowOverrides(true)
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 560, maxWidth: '100%',
        maxHeight: '90vh', overflow: 'auto',
        padding: '22px 26px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
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

        {/* ── Bloque 1: Plan actual (read-only + duration editable) ── */}
        <Section title="Plan actual" subtitle="Calculado por el CPM desde la fecha de inicio de obra y las dependencias entre fases.">
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
            background: '#FAFAF8', borderRadius: 6, padding: '10px 14px', marginBottom: 10,
          }}>
            <Readonly label="Inicio"   value={fmtDate(phase.planned_start_date)} />
            <Readonly label="Fin"      value={fmtDate(phase.planned_end_date)} />
            <Readonly label="Duración" value={`${phase.planned_duration_dias ?? '—'} días háb.`} />
          </div>
          <Field label="Editar duración planificada (días háb.)" hint="Al cambiarla, el cronograma vivo cascadea las fases dependientes automáticamente.">
            <input
              type="number"
              min={0} step={1}
              value={plannedDuration}
              onChange={e => setPlannedDuration(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            />
          </Field>
        </Section>

        {/* ── Bloque 2: Estado de avance ── */}
        <Section title="Estado de avance">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
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
              >{opt.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', minWidth: 60 }}>
              Avance
            </span>
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
              style={{ ...inputStyle, width: 64, textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: '#999' }}>%</span>
          </div>

          {/* Botones rápidos */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={quickStart} style={quickBtnStyle}>▶ Marcar inicio hoy</button>
            <button type="button" onClick={quickComplete} style={quickBtnStyle}>✓ Marcar completada hoy</button>
          </div>
        </Section>

        {/* ── Bloque 3: Override de realidad ── */}
        <Section
          title="Registro de realidad"
          subtitle="Sólo si lo real difiere del plan. Cuando rellenas estas fechas, el CPM reajusta las fases dependientes a partir de esos anclajes."
        >
          {!showOverrides ? (
            <button
              type="button"
              onClick={() => setShowOverrides(true)}
              style={{
                ...quickBtnStyle,
                background: '#fff', color: '#888',
                padding: '8px 14px',
              }}
            >+ Registrar fecha real distinta del plan</button>
          ) : (
            <>
              <Field label="Inicio real" hint="Si la fase arrancó en una fecha distinta a la planificada.">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    value={actualStart}
                    onChange={e => setActualStart(e.target.value)}
                    style={inputStyle}
                  />
                  {actualStart && (
                    <button type="button" onClick={() => setActualStart('')} style={quickBtnStyle}>Limpiar</button>
                  )}
                </div>
              </Field>

              <Field label="Fin real" hint="Si la fase terminó en una fecha distinta a la planificada.">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    value={actualEnd}
                    onChange={e => setActualEnd(e.target.value)}
                    style={inputStyle}
                  />
                  {actualEnd && (
                    <button type="button" onClick={() => setActualEnd('')} style={quickBtnStyle}>Limpiar</button>
                  )}
                </div>
              </Field>

              {derivedActualDuration !== null && (
                <div style={{
                  fontSize: 11, color: '#666', background: '#F8F7F4',
                  padding: '6px 10px', borderRadius: 5, display: 'inline-block', marginTop: 4,
                }}>
                  Duración real derivada: <strong>{derivedActualDuration}</strong> días naturales
                  {phase.planned_duration_dias != null && (
                    <span style={{ color: '#888' }}>
                      {' '}(plan: {phase.planned_duration_dias} días háb.)
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── Notas ── */}
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

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button
            type="button" onClick={onClose} disabled={saving}
            style={{
              background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
              padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#666',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Cancelar</button>
          <button
            type="button" onClick={handleSave} disabled={saving}
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: 2 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10.5, color: '#AAA', lineHeight: 1.45, marginBottom: 10 }}>
          {subtitle}
        </div>
      )}
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: '#888', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: '#AAA', marginTop: 4, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  )
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

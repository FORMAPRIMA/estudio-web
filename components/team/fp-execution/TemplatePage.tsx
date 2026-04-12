'use client'

import React, { useState } from 'react'
import {
  createChapter, updateChapter, deleteChapter,
  createUnit, updateUnit, deleteUnit,
  createLineItem, updateLineItem, deleteLineItem,
  createPhase, updatePhase, deletePhase,
  createMilestone, updateMilestone, deleteMilestone,
  setPhaseMilestoneLinks,
} from '@/app/actions/fpe-template'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
}

interface LineItem {
  id: string
  unit_id: string
  nombre: string
  descripcion: string | null
  unidad_medida: string
  orden: number
  activo: boolean
}

interface Phase {
  id: string
  unit_id: string
  nombre: string
  descripcion: string | null
  lead_time_days: number
  duracion_pct: number
  orden: number
  achieves: string[]   // milestone ids
  requires: string[]   // milestone ids
}

interface Unit {
  id: string
  chapter_id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  duracion_pct: number
  line_items: LineItem[]
  phases: Phase[]
}

interface Chapter {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  units: Unit[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIDADES = ['ud', 'm²', 'ml', 'm³', 'pa', 'kg', 'h', 'l', 'tn', 'jl']

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  label:    { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:    { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  select:   { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8',
    color: primary ? '#fff' : '#555',
  }),
  btnSm: (color?: string): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: color ?? '#F0EEE8', color: color ? '#fff' : '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const modalCard: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
}

// ── Generic small modal ───────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626', marginTop: 8 }}>
      {msg}
    </div>
  )
}

// ── Chapter Modal ─────────────────────────────────────────────────────────────

function ChapterModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Chapter | null
  onClose: () => void
  onSaved: (c: Chapter) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    if (initial) {
      const res = await updateChapter(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: parseInt(orden) || 0,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
    } else {
      const res = await createChapter({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, activo: true, units: [] })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCard}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar capítulo' : 'Nuevo capítulo'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Estructura" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ width: 100 }}>
              <label style={S.label}>Orden</label>
              <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
            </div>
            {error && <ErrorBanner msg={error} />}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Unit Modal ────────────────────────────────────────────────────────────────

function UnitModal({
  chapterId,
  initial,
  onClose,
  onSaved,
}: {
  chapterId: string
  initial: Unit | null
  onClose: () => void
  onSaved: (u: Unit) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [duracionPct, setDuracionPct] = useState(String(initial?.duracion_pct ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const pct = parseFloat(duracionPct) || 0

    if (initial) {
      const res = await updateUnit(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: parseInt(orden) || 0,
        duracion_pct: pct,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, duracion_pct: pct })
    } else {
      const res = await createUnit({ chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, duracion_pct: pct })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, activo: true, duracion_pct: pct, line_items: [], phases: [] })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCard}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar unidad' : 'Nueva unidad de ejecución'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Movimiento de tierras" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 14 }}>
              <div>
                <label style={S.label}>% del tiempo de obra</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min={0} max={100} step={0.5} value={duracionPct} onChange={e => setDuracionPct(e.target.value)} style={S.input} />
                  <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>%</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: '#BBB' }}>Cuánto ocupa esta UE del total de la obra</p>
              </div>
              <div>
                <label style={S.label}>Orden</label>
                <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
              </div>
            </div>
            {error && <ErrorBanner msg={error} />}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Line Item Modal ───────────────────────────────────────────────────────────

function LineItemModal({
  unitId,
  initial,
  onClose,
  onSaved,
}: {
  unitId: string
  initial: LineItem | null
  onClose: () => void
  onSaved: (item: LineItem) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [unidad, setUnidad] = useState(initial?.unidad_medida ?? 'ud')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    if (initial) {
      const res = await updateLineItem(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        unidad_medida: unidad,
        orden: parseInt(orden) || 0,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, unidad_medida: unidad, orden: parseInt(orden) || 0 })
    } else {
      const res = await createLineItem({ unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, unidad_medida: unidad, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, unidad_medida: unidad, orden: parseInt(orden) || 0, activo: true })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCard}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar partida' : 'Nueva partida'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Excavación mecánica" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 100px', gap: 14 }}>
              <div>
                <label style={S.label}>Unidad de medida</label>
                <select value={unidad} onChange={e => setUnidad(e.target.value)} style={S.select}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Orden</label>
                <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
              </div>
            </div>
            {error && <ErrorBanner msg={error} />}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Milestone tag toggle ──────────────────────────────────────────────────────

function MilestoneTagSelector({
  label,
  color,
  milestones,
  selected,
  onChange,
}: {
  label: string
  color: string
  milestones: Milestone[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div>
      <label style={S.label}>{label}</label>
      {milestones.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: '#CCC' }}>Sin hitos definidos aún.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {[...milestones].sort((a, b) => a.orden - b.orden).map(m => {
            const on = selected.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 20, border: `1px solid ${on ? color : '#E8E6E0'}`,
                  background: on ? color : '#fff', color: on ? '#fff' : '#555',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: on ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >{m.nombre}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Phase Modal ───────────────────────────────────────────────────────────────

function PhaseModal({
  unitId,
  initial,
  milestones,
  onClose,
  onSaved,
}: {
  unitId: string
  initial: Phase | null
  milestones: Milestone[]
  onClose: () => void
  onSaved: (p: Phase) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [duracionPct, setDuracionPct] = useState(String(initial?.duracion_pct ?? 0))
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [achieves, setAchieves] = useState<string[]>(initial?.achieves ?? [])
  const [requires, setRequires] = useState<string[]>(initial?.requires ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const pct = parseFloat(duracionPct) || 0

    if (initial) {
      const [res, linksRes] = await Promise.all([
        updatePhase(initial.id, { nombre: nombre.trim(), descripcion: descripcion.trim() || null, duracion_pct: pct, orden: parseInt(orden) || 0 }),
        setPhaseMilestoneLinks(initial.id, achieves, requires),
      ])
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      if ('error' in linksRes) { setError(linksRes.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, duracion_pct: pct, orden: parseInt(orden) || 0, achieves, requires })
    } else {
      const res = await createPhase({ unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, duracion_pct: pct, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      await setPhaseMilestoneLinks(res.id, achieves, requires)
      onSaved({ id: res.id, unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, lead_time_days: 7, duracion_pct: pct, orden: parseInt(orden) || 0, achieves, requires })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 560 }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar fase' : 'Nueva fase de ejecución'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Replanteo y perfilería" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14 }}>
              <div>
                <label style={S.label}>% del tiempo de la unidad</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min={0} max={100} step={0.5} value={duracionPct} onChange={e => setDuracionPct(e.target.value)} style={S.input} />
                  <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>%</span>
                </div>
              </div>
              <div>
                <label style={S.label}>Orden</label>
                <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
              </div>
            </div>

            {/* Hitos */}
            <div style={{ borderTop: '1px solid #F0EEE8', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
                Co-dependencias vía hitos
              </p>
              <MilestoneTagSelector
                label="Alcanza (al terminar esta fase, estos hitos quedan conseguidos)"
                color="#059669"
                milestones={milestones}
                selected={achieves}
                onChange={setAchieves}
              />
              <MilestoneTagSelector
                label="Requiere (esta fase no puede empezar hasta que se alcancen estos hitos)"
                color="#D85A30"
                milestones={milestones}
                selected={requires}
                onChange={setRequires}
              />
            </div>

            {error && <ErrorBanner msg={error} />}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Confirm delete ────────────────────────────────────────────────────────────

function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ ...modalCard, maxWidth: 380 }}>
        <div style={{ padding: '24px 24px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar?</p>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Se eliminará <strong>{label}</strong> y todo su contenido. Esta acción no se puede deshacer.</p>
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={S.btn()}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...S.btn(), background: '#DC2626', color: '#fff' }}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}

// ── Unit Detail (partidas + fases) ────────────────────────────────────────────

function UnitDetail({
  unit,
  milestones,
  onUnitChanged,
}: {
  unit: Unit
  milestones: Milestone[]
  onUnitChanged: (updated: Unit) => void
}) {
  const [tab, setTab] = useState<'partidas' | 'fases'>('partidas')

  // Line item state
  const [lineItemModal, setLineItemModal] = useState<{ mode: 'create' } | { mode: 'edit'; item: LineItem } | null>(null)
  const [deletingItem, setDeletingItem] = useState<LineItem | null>(null)

  // Phase state
  const [phaseModal, setPhaseModal] = useState<{ mode: 'create' } | { mode: 'edit'; phase: Phase } | null>(null)
  const [deletingPhase, setDeletingPhase] = useState<Phase | null>(null)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'none',
    borderBottom: active ? '2px solid #1A1A1A' : '2px solid transparent',
    color: active ? '#1A1A1A' : '#AAA',
  })

  const handleItemSaved = (item: LineItem) => {
    const exists = unit.line_items.find(i => i.id === item.id)
    const updated = exists
      ? unit.line_items.map(i => i.id === item.id ? item : i)
      : [...unit.line_items, item]
    onUnitChanged({ ...unit, line_items: updated })
    setLineItemModal(null)
  }

  const handleItemDelete = async (item: LineItem) => {
    const res = await deleteLineItem(item.id)
    if ('error' in res) { alert(res.error); return }
    onUnitChanged({ ...unit, line_items: unit.line_items.filter(i => i.id !== item.id) })
    setDeletingItem(null)
  }

  const handlePhaseSaved = (phase: Phase) => {
    const exists = unit.phases.find(p => p.id === phase.id)
    const updated = exists
      ? unit.phases.map(p => p.id === phase.id ? phase : p)
      : [...unit.phases, phase]
    onUnitChanged({ ...unit, phases: updated })
    setPhaseModal(null)
  }

  const handlePhaseDelete = async (phase: Phase) => {
    const res = await deletePhase(phase.id)
    if ('error' in res) { alert(res.error); return }
    onUnitChanged({ ...unit, phases: unit.phases.filter(p => p.id !== phase.id) })
    setDeletingPhase(null)
  }

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #E8E6E0', background: '#FAFAF8', padding: '0 16px' }}>
        <button style={tabStyle(tab === 'partidas')} onClick={() => setTab('partidas')}>
          Partidas ({unit.line_items.length})
        </button>
        <button style={tabStyle(tab === 'fases')} onClick={() => setTab('fases')}>
          Fases ({unit.phases.length})
        </button>
        <div style={{ flex: 1 }} />
        {tab === 'partidas' && (
          <button
            style={{ ...S.btnSm('#1A1A1A'), marginRight: 4 }}
            onClick={() => setLineItemModal({ mode: 'create' })}
          >+ Partida</button>
        )}
        {tab === 'fases' && (
          <button
            style={{ ...S.btnSm('#1A1A1A'), marginRight: 4 }}
            onClick={() => setPhaseModal({ mode: 'create' })}
          >+ Fase</button>
        )}
      </div>

      {/* Partidas tab */}
      {tab === 'partidas' && (
        <div style={{ padding: '12px 16px' }}>
          {unit.line_items.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#BBB', textAlign: 'center', padding: '16px 0' }}>Sin partidas. Añade la primera.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  {['Nombre', 'Descripción', 'Unidad', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...unit.line_items].sort((a, b) => a.orden - b.orden).map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>{item.nombre}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#888', borderBottom: '1px solid #F0EEE8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descripcion ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: '#555', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                      <span style={{ background: '#F0EEE8', borderRadius: 3, padding: '2px 6px', fontWeight: 600, fontFamily: 'monospace' }}>{item.unidad_medida}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button onClick={() => setLineItemModal({ mode: 'edit', item })} style={{ ...S.btnSm(), marginRight: 4 }}>Editar</button>
                      <button onClick={() => setDeletingItem(item)} style={{ ...S.btnSm('#DC2626'), color: '#fff' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Fases tab */}
      {tab === 'fases' && (
        <div style={{ padding: '12px 16px' }}>
          {unit.phases.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#BBB', textAlign: 'center', padding: '16px 0' }}>Sin fases de ejecución. Añade la primera.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  {['Fase', 'Descripción', 'Duración', 'Hitos', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...unit.phases].sort((a, b) => a.orden - b.orden).map((phase, i) => (
                  <tr key={phase.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>{phase.nombre}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#888', borderBottom: '1px solid #F0EEE8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.descripcion ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#555', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                      <span style={{ background: '#EBF5FF', color: '#378ADD', borderRadius: 3, padding: '2px 6px', fontWeight: 600, fontSize: 11 }}>{phase.duracion_pct}%</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {phase.achieves.map(mid => {
                          const m = milestones.find(x => x.id === mid)
                          return m ? <span key={mid} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>{m.nombre}</span> : null
                        })}
                        {phase.requires.map(mid => {
                          const m = milestones.find(x => x.id === mid)
                          return m ? <span key={mid} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: '#FEE2E2', color: '#991B1B', fontWeight: 600 }}>{m.nombre}</span> : null
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button onClick={() => setPhaseModal({ mode: 'edit', phase })} style={{ ...S.btnSm(), marginRight: 4 }}>Editar</button>
                      <button onClick={() => setDeletingPhase(phase)} style={{ ...S.btnSm('#DC2626'), color: '#fff' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {lineItemModal && (
        <LineItemModal
          unitId={unit.id}
          initial={lineItemModal.mode === 'edit' ? lineItemModal.item : null}
          onClose={() => setLineItemModal(null)}
          onSaved={handleItemSaved}
        />
      )}
      {deletingItem && (
        <ConfirmDelete
          label={deletingItem.nombre}
          onConfirm={() => handleItemDelete(deletingItem)}
          onCancel={() => setDeletingItem(null)}
        />
      )}
      {phaseModal && (
        <PhaseModal
          unitId={unit.id}
          initial={phaseModal.mode === 'edit' ? phaseModal.phase : null}
          milestones={milestones}
          onClose={() => setPhaseModal(null)}
          onSaved={handlePhaseSaved}
        />
      )}
      {deletingPhase && (
        <ConfirmDelete
          label={deletingPhase.nombre}
          onConfirm={() => handlePhaseDelete(deletingPhase)}
          onCancel={() => setDeletingPhase(null)}
        />
      )}
    </>
  )
}

// ── Unit Row ──────────────────────────────────────────────────────────────────

function UnitRow({
  unit,
  milestones,
  onUnitChanged,
  onUnitDeleted,
}: {
  unit: Unit
  milestones: Milestone[]
  onUnitChanged: (updated: Unit) => void
  onUnitDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    const res = await deleteUnit(unit.id)
    if ('error' in res) { alert(res.error); return }
    onUnitDeleted(unit.id)
    setDeleting(false)
  }

  return (
    <div style={{ borderBottom: '1px solid #E8E6E0' }}>
      {/* Unit header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#F5F4F0', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 11, color: '#CCC', width: 14, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#333', flex: 1 }}>{unit.nombre}</span>
        {unit.descripcion && <span style={{ fontSize: 11, color: '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.descripcion}</span>}
        <span style={{ fontSize: 10, color: '#AAA' }}>{unit.line_items.length} part. · {unit.phases.length} fases</span>
        <button
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          style={{ ...S.btnSm(), fontSize: 11 }}
        >Editar</button>
        <button
          onClick={e => { e.stopPropagation(); setDeleting(true) }}
          style={{ ...S.btnSm('#DC2626'), color: '#fff', fontSize: 11 }}
        >×</button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ background: '#fff' }}>
          <UnitDetail unit={unit} milestones={milestones} onUnitChanged={onUnitChanged} />
        </div>
      )}

      {editing && (
        <UnitModal
          chapterId={unit.chapter_id}
          initial={unit}
          onClose={() => setEditing(false)}
          onSaved={updated => { onUnitChanged(updated); setEditing(false) }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          label={unit.nombre}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  )
}

// ── Chapter Row ───────────────────────────────────────────────────────────────

function ChapterRow({
  chapter,
  milestones,
  onChapterChanged,
  onChapterDeleted,
}: {
  chapter: Chapter
  milestones: Milestone[]
  onChapterChanged: (updated: Chapter) => void
  onChapterDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingUnit, setAddingUnit] = useState(false)

  const handleDelete = async () => {
    const res = await deleteChapter(chapter.id)
    if ('error' in res) { alert(res.error); return }
    onChapterDeleted(chapter.id)
    setDeleting(false)
  }

  const handleUnitChanged = (updated: Unit) => {
    onChapterChanged({ ...chapter, units: chapter.units.map(u => u.id === updated.id ? updated : u) })
  }

  const handleUnitDeleted = (id: string) => {
    onChapterChanged({ ...chapter, units: chapter.units.filter(u => u.id !== id) })
  }

  const totalItems = chapter.units.reduce((acc, u) => acc + u.line_items.length, 0)
  const totalPhases = chapter.units.reduce((acc, u) => acc + u.phases.length, 0)

  return (
    <div style={{ marginBottom: 8, borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', background: '#fff' }}>
      {/* Chapter header — dark */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1A1A1A', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 14, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, letterSpacing: '0.02em' }}>{chapter.nombre}</span>
        {chapter.descripcion && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{chapter.descripcion}</span>}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
          {chapter.units.length} unid. · {totalItems} part. · {totalPhases} fases
        </span>
        <button
          onClick={e => { e.stopPropagation(); setAddingUnit(true) }}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >+ Unidad</button>
        <button
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >Editar</button>
        <button
          onClick={e => { e.stopPropagation(); setDeleting(true) }}
          style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: 'rgba(220,38,38,0.25)', color: '#FCA5A5' }}
        >×</button>
      </div>

      {/* Units */}
      {expanded && (
        <div>
          {chapter.units.length === 0 ? (
            <p style={{ margin: 0, padding: '16px', fontSize: 12, color: '#CCC', textAlign: 'center' }}>
              Sin unidades de ejecución.{' '}
              <button style={{ background: 'none', border: 'none', color: '#378ADD', cursor: 'pointer', fontSize: 12, padding: 0 }} onClick={() => setAddingUnit(true)}>Añadir la primera.</button>
            </p>
          ) : (
            [...chapter.units].sort((a, b) => a.orden - b.orden).map(unit => (
              <UnitRow
                key={unit.id}
                unit={unit}
                milestones={milestones}
                onUnitChanged={handleUnitChanged}
                onUnitDeleted={handleUnitDeleted}
              />
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {editing && (
        <ChapterModal
          initial={chapter}
          onClose={() => setEditing(false)}
          onSaved={updated => { onChapterChanged(updated); setEditing(false) }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          label={chapter.nombre}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(false)}
        />
      )}
      {addingUnit && (
        <UnitModal
          chapterId={chapter.id}
          initial={null}
          onClose={() => setAddingUnit(false)}
          onSaved={unit => {
            onChapterChanged({ ...chapter, units: [...chapter.units, unit] })
            setAddingUnit(false)
          }}
        />
      )}
    </div>
  )
}

// ── Milestone Modal ───────────────────────────────────────────────────────────

function MilestoneModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Milestone | null
  onClose: () => void
  onSaved: (m: Milestone) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    if (initial) {
      const res = await updateMilestone(initial.id, { nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
    } else {
      const res = await createMilestone({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 420 }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar hito' : 'Nuevo hito de obra'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pladur cerrado (2ª cara + falsos techos)" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Qué significa que este hito esté alcanzado…" style={S.textarea} />
            </div>
            <div style={{ width: 90 }}>
              <label style={S.label}>Orden</label>
              <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
            </div>
            {error && <ErrorBanner msg={error} />}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Milestones Section ────────────────────────────────────────────────────────

function MilestonesSection({
  milestones,
  onChange,
}: {
  milestones: Milestone[]
  onChange: (updated: Milestone[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; m: Milestone } | null>(null)
  const [deleting, setDeleting] = useState<Milestone | null>(null)

  const handleDelete = async (m: Milestone) => {
    const res = await deleteMilestone(m.id)
    if ('error' in res) { alert(res.error); return }
    onChange(milestones.filter(x => x.id !== m.id))
    setDeleting(null)
  }

  const sorted = [...milestones].sort((a, b) => a.orden - b.orden)

  return (
    <div style={{ marginBottom: 24, borderRadius: 8, border: '2px solid #D85A30', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#FFF7F4', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 12, color: '#D85A30', width: 14, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#D85A30', flex: 1, letterSpacing: '0.02em' }}>
          Hitos de obra
        </span>
        <span style={{ fontSize: 10, color: '#D85A30', opacity: 0.6 }}>{milestones.length} hitos configurados</span>
        <button
          onClick={e => { e.stopPropagation(); setModal({ mode: 'create' }) }}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#D85A30', color: '#fff' }}
        >+ Hito</button>
      </div>

      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {sorted.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#BBB', textAlign: 'center', padding: '16px 0' }}>
              Sin hitos configurados.{' '}
              <button style={{ background: 'none', border: 'none', color: '#D85A30', cursor: 'pointer', fontSize: 12, padding: 0 }} onClick={() => setModal({ mode: 'create' })}>Añadir el primero.</button>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorted.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, background: i % 2 === 0 ? '#FAFAF8' : '#fff', border: '1px solid #F0EEE8' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#D85A30', width: 24, flexShrink: 0, fontFamily: 'monospace' }}>{String(m.orden).padStart(2, '0')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{m.nombre}</span>
                    {m.descripcion && <span style={{ fontSize: 11, color: '#AAA', marginLeft: 8 }}>{m.descripcion}</span>}
                  </div>
                  <button onClick={() => setModal({ mode: 'edit', m })} style={{ ...S.btnSm(), fontSize: 11 }}>Editar</button>
                  <button onClick={() => setDeleting(m)} style={{ ...S.btnSm('#DC2626'), color: '#fff', fontSize: 11 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <MilestoneModal
          initial={modal.mode === 'edit' ? modal.m : null}
          onClose={() => setModal(null)}
          onSaved={saved => {
            const exists = milestones.find(x => x.id === saved.id)
            onChange(exists ? milestones.map(x => x.id === saved.id ? saved : x) : [...milestones, saved])
            setModal(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          label={deleting.nombre}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatePage({
  initialChapters,
  initialMilestones,
}: {
  initialChapters: Chapter[]
  initialMilestones: Milestone[]
}) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters)
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [addingChapter, setAddingChapter] = useState(false)

  const totalUnits = chapters.reduce((a, c) => a + c.units.length, 0)
  const totalItems = chapters.reduce((a, c) => a + c.units.reduce((b, u) => b + u.line_items.length, 0), 0)

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>FP Execution</p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Template</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>
            {chapters.length} capítulos · {totalUnits} unidades · {totalItems} partidas · {milestones.length} hitos
          </p>
        </div>
        <button
          onClick={() => setAddingChapter(true)}
          style={{ ...S.btn(true), padding: '9px 18px', fontSize: 13 }}
        >+ Capítulo</button>
      </div>

      {/* Milestones section */}
      <MilestonesSection milestones={milestones} onChange={setMilestones} />

      {/* Empty state */}
      {chapters.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#BBB' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#888' }}>Template vacío</p>
          <p style={{ fontSize: 13, marginBottom: 20 }}>Crea el primer capítulo para empezar a definir el scope.</p>
          <button onClick={() => setAddingChapter(true)} style={S.btn(true)}>+ Nuevo capítulo</button>
        </div>
      )}

      {/* Chapter list */}
      <div>
        {[...chapters].sort((a, b) => a.orden - b.orden).map(chapter => (
          <ChapterRow
            key={chapter.id}
            chapter={chapter}
            milestones={milestones}
            onChapterChanged={updated => setChapters(prev => prev.map(c => c.id === updated.id ? updated : c))}
            onChapterDeleted={id => setChapters(prev => prev.filter(c => c.id !== id))}
          />
        ))}
      </div>

      {/* Add chapter modal */}
      {addingChapter && (
        <ChapterModal
          initial={null}
          onClose={() => setAddingChapter(false)}
          onSaved={chapter => {
            setChapters(prev => [...prev, chapter])
            setAddingChapter(false)
          }}
        />
      )}
    </div>
  )
}

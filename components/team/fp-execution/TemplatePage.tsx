'use client'

import React, { useState } from 'react'
import {
  createChapter, updateChapter, deleteChapter,
  createUnit, updateUnit, deleteUnit,
  createLineItem, updateLineItem, deleteLineItem,
  createPhase, updatePhase, deletePhase,
} from '@/app/actions/fpe-template'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  orden: number
}

interface Unit {
  id: string
  chapter_id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    if (initial) {
      const res = await updateUnit(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: parseInt(orden) || 0,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
    } else {
      const res = await createUnit({ chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, activo: true, line_items: [], phases: [] })
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

// ── Phase Modal ───────────────────────────────────────────────────────────────

function PhaseModal({
  unitId,
  initial,
  onClose,
  onSaved,
}: {
  unitId: string
  initial: Phase | null
  onClose: () => void
  onSaved: (p: Phase) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [leadTime, setLeadTime] = useState(String(initial?.lead_time_days ?? 7))
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const lt = parseInt(leadTime) || 7

    if (initial) {
      const res = await updatePhase(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        lead_time_days: lt,
        orden: parseInt(orden) || 0,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, lead_time_days: lt, orden: parseInt(orden) || 0 })
    } else {
      const res = await createPhase({ unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, lead_time_days: lt, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, lead_time_days: lt, orden: parseInt(orden) || 0 })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCard}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar fase' : 'Nueva fase de ejecución'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Replanteo" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 100px', gap: 14 }}>
              <div>
                <label style={S.label}>Lead time (días)</label>
                <input type="number" min={1} value={leadTime} onChange={e => setLeadTime(e.target.value)} style={S.input} />
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
  onUnitChanged,
}: {
  unit: Unit
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
                  {['Fase', 'Descripción', 'Lead time', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...unit.phases].sort((a, b) => a.orden - b.orden).map((phase, i) => (
                  <tr key={phase.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>{phase.nombre}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#888', borderBottom: '1px solid #F0EEE8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.descripcion ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#555', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                      <span style={{ background: '#EBF5FF', color: '#378ADD', borderRadius: 3, padding: '2px 6px', fontWeight: 600, fontSize: 11 }}>{phase.lead_time_days}d</span>
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
  onUnitChanged,
  onUnitDeleted,
}: {
  unit: Unit
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
          <UnitDetail unit={unit} onUnitChanged={onUnitChanged} />
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
  onChapterChanged,
  onChapterDeleted,
}: {
  chapter: Chapter
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatePage({ initialChapters }: { initialChapters: Chapter[] }) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters)
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
            {chapters.length} capítulos · {totalUnits} unidades · {totalItems} partidas
          </p>
        </div>
        <button
          onClick={() => setAddingChapter(true)}
          style={{ ...S.btn(true), padding: '9px 18px', fontSize: 13 }}
        >+ Capítulo</button>
      </div>

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

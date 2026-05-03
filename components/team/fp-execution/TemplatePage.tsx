'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createChapter, updateChapter, deleteChapter,
  createUnit, updateUnit, deleteUnit,
  createLineItem, updateLineItem, deleteLineItem,
  createPhase, updatePhase, deletePhase,
  createMilestone, updateMilestone, deleteMilestone, mergeMilestones,
  setPhaseMilestoneLinks, setLineItemPhases,
  createDiscipline, updateDiscipline, deleteDiscipline,
} from '@/app/actions/fpe-template'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Discipline {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  orden: number
  activo: boolean
}

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
  discipline_id: string | null
  phase_ids: string[]
}

interface Phase {
  id: string
  chapter_id: string
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
  principal_discipline_id: string | null
  label_cliente: string | null
  descripcion_cliente: string | null
  imagen_portada_url: string | null
  line_items: LineItem[]
}

interface Chapter {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  duracion_pct: number
  principal_discipline_id: string | null
  label_cliente: string | null
  descripcion_cliente: string | null
  imagen_portada_url: string | null
  phases: Phase[]
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

async function uploadPortadaImage(file: File, folder: 'chapters' | 'units', entityId: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `portadas/${folder}/${entityId}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('warehouse').upload(path, file, { upsert: true })
  if (error || !data) return null
  const { data: { publicUrl } } = supabase.storage.from('warehouse').getPublicUrl(data.path)
  return publicUrl
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
  disciplines,
  onClose,
  onSaved,
}: {
  initial: Chapter | null
  disciplines: Discipline[]
  onClose: () => void
  onSaved: (c: Chapter) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [duracionPct, setDuracionPct] = useState(String(initial?.duracion_pct ?? 0))
  const [principalDiscId, setPrincipalDiscId] = useState<string>(initial?.principal_discipline_id ?? '')
  const [labelCliente, setLabelCliente] = useState(initial?.label_cliente ?? '')
  const [descripcionCliente, setDescripcionCliente] = useState(initial?.descripcion_cliente ?? '')
  const [imagenPortadaUrl, setImagenPortadaUrl] = useState<string | null>(initial?.imagen_portada_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeDisciplines = disciplines.filter(d => d.activo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const pct  = parseFloat(duracionPct) || 0
    const pdid = principalDiscId || null

    if (initial) {
      const res = await updateChapter(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: parseInt(orden) || 0,
        duracion_pct: pct,
        principal_discipline_id: pdid,
        label_cliente: labelCliente.trim() || null,
        descripcion_cliente: descripcionCliente.trim() || null,
        imagen_portada_url: imagenPortadaUrl,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, duracion_pct: pct, principal_discipline_id: pdid, label_cliente: labelCliente.trim() || null, descripcion_cliente: descripcionCliente.trim() || null, imagen_portada_url: imagenPortadaUrl })
    } else {
      const res = await createChapter({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, duracion_pct: pct, principal_discipline_id: pdid })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, activo: true, duracion_pct: pct, principal_discipline_id: pdid, label_cliente: null, descripcion_cliente: null, imagen_portada_url: null, phases: [], units: [] })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 560 }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar capítulo' : 'Nuevo capítulo'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Albañilería" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14 }}>
              <div>
                <label style={S.label}>% del tiempo total de obra</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min={0} max={100} step={0.5} value={duracionPct} onChange={e => setDuracionPct(e.target.value)} style={S.input} />
                  <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>%</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: '#BBB' }}>Cuánto ocupa este capítulo del total de la obra</p>
              </div>
              <div>
                <label style={S.label}>Orden</label>
                <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
              </div>
            </div>
            <div>
              <label style={S.label}>Disciplina principal</label>
              <select value={principalDiscId} onChange={e => setPrincipalDiscId(e.target.value)} style={S.select}>
                <option value="">— Sin asignar —</option>
                {activeDisciplines.sort((a, b) => a.orden - b.orden).map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
              <p style={{ margin: '3px 0 0', fontSize: 10, color: '#BBB' }}>El partner de esta disciplina propone la duración de las fases del capítulo</p>
            </div>
            {error && <ErrorBanner msg={error} />}
          </div>

          {initial && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E8E6E0', background: '#FFF7F4' }}>
              <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30' }}>
                Memorias de Calidad — Presentación
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={S.label}>Nombre en lookbook</label>
                  <input value={labelCliente} onChange={e => setLabelCliente(e.target.value)} placeholder={initial.nombre} style={S.input} />
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: '#BBB' }}>Nombre visible al cliente. Si se deja vacío, se usa el nombre interno.</p>
                </div>
                <div>
                  <label style={S.label}>Descripción editorial</label>
                  <textarea rows={3} value={descripcionCliente} onChange={e => setDescripcionCliente(e.target.value)} placeholder="Texto de presentación que acompaña la portada de este capítulo en el anteproyecto…" style={S.textarea} />
                </div>
                <div>
                  <label style={S.label}>Imagen de portada</label>
                  {imagenPortadaUrl ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <img src={imagenPortadaUrl} alt="portada" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      <button type="button" onClick={() => setImagenPortadaUrl(null)} style={{ ...S.btnSm('#DC2626'), color: '#fff' }}>Eliminar</button>
                    </div>
                  ) : (
                    <label style={{ display: 'block', padding: '12px', border: '2px dashed #F0EEE8', borderRadius: 6, cursor: uploading ? 'default' : 'pointer', textAlign: 'center', fontSize: 11, color: '#999' }}>
                      {uploading ? 'Subiendo…' : 'Haz click para subir imagen de portada'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploading(true)
                        const url = await uploadPortadaImage(file, 'chapters', initial.id)
                        setUploading(false)
                        if (url) setImagenPortadaUrl(url)
                      }} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

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
  const [labelCliente, setLabelCliente] = useState(initial?.label_cliente ?? '')
  const [descripcionCliente, setDescripcionCliente] = useState(initial?.descripcion_cliente ?? '')
  const [imagenPortadaUrl, setImagenPortadaUrl] = useState<string | null>(initial?.imagen_portada_url ?? null)
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    if (initial) {
      const res = await updateUnit(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        orden: parseInt(orden) || 0,
        label_cliente: labelCliente.trim() || null,
        descripcion_cliente: descripcionCliente.trim() || null,
        imagen_portada_url: imagenPortadaUrl,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, label_cliente: labelCliente.trim() || null, descripcion_cliente: descripcionCliente.trim() || null, imagen_portada_url: imagenPortadaUrl })
    } else {
      const res = await createUnit({ chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: parseInt(orden) || 0, activo: true, principal_discipline_id: null, label_cliente: null, descripcion_cliente: null, imagen_portada_url: null, line_items: [] })
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
            <div style={{ width: 90 }}>
              <label style={S.label}>Orden</label>
              <input type="number" value={orden} onChange={e => setOrden(e.target.value)} style={S.input} />
            </div>
            {error && <ErrorBanner msg={error} />}
          </div>

          {initial && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E8E6E0', background: '#FFF7F4' }}>
              <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30' }}>
                Memorias de Calidad — Presentación
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={S.label}>Nombre en lookbook</label>
                  <input value={labelCliente} onChange={e => setLabelCliente(e.target.value)} placeholder={initial.nombre} style={S.input} />
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: '#BBB' }}>Nombre visible al cliente. Si se deja vacío, se usa el nombre interno.</p>
                </div>
                <div>
                  <label style={S.label}>Descripción editorial</label>
                  <textarea rows={3} value={descripcionCliente} onChange={e => setDescripcionCliente(e.target.value)} placeholder="Texto de presentación que acompaña la portada de esta unidad en el anteproyecto…" style={S.textarea} />
                </div>
                <div>
                  <label style={S.label}>Imagen de portada</label>
                  {imagenPortadaUrl ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <img src={imagenPortadaUrl} alt="portada" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      <button type="button" onClick={() => setImagenPortadaUrl(null)} style={{ ...S.btnSm('#DC2626'), color: '#fff' }}>Eliminar</button>
                    </div>
                  ) : (
                    <label style={{ display: 'block', padding: '12px', border: '2px dashed #F0EEE8', borderRadius: 6, cursor: uploading ? 'default' : 'pointer', textAlign: 'center', fontSize: 11, color: '#999' }}>
                      {uploading ? 'Subiendo…' : 'Haz click para subir imagen de portada'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploading(true)
                        const url = await uploadPortadaImage(file, 'units', initial.id)
                        setUploading(false)
                        if (url) setImagenPortadaUrl(url)
                      }} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

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
  chapterPhases,
  initial,
  disciplines,
  onClose,
  onSaved,
}: {
  unitId: string
  chapterPhases: Phase[]
  initial: LineItem | null
  disciplines: Discipline[]
  onClose: () => void
  onSaved: (item: LineItem) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [unidad, setUnidad] = useState(initial?.unidad_medida ?? 'ud')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [disciplineId, setDisciplineId] = useState<string>(initial?.discipline_id ?? '')
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<string[]>(initial?.phase_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const togglePhase = (id: string) =>
    setSelectedPhaseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const did = disciplineId || null

    let lineItemId: string

    if (initial) {
      const res = await updateLineItem(initial.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        unidad_medida: unidad,
        orden: parseInt(orden) || 0,
        discipline_id: did,
      })
      if ('error' in res) { setSaving(false); setError(res.error); return }
      lineItemId = initial.id
    } else {
      const res = await createLineItem({ unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, unidad_medida: unidad, orden: parseInt(orden) || 0, discipline_id: did })
      if ('error' in res) { setSaving(false); setError(res.error); return }
      lineItemId = res.id
    }

    const phasesRes = await setLineItemPhases(lineItemId, selectedPhaseIds)
    setSaving(false)
    if ('error' in phasesRes) { setError(phasesRes.error); return }

    const saved: LineItem = initial
      ? { ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, unidad_medida: unidad, orden: parseInt(orden) || 0, discipline_id: did, phase_ids: selectedPhaseIds }
      : { id: lineItemId, unit_id: unitId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, unidad_medida: unidad, orden: parseInt(orden) || 0, activo: true, discipline_id: did, phase_ids: selectedPhaseIds }
    onSaved(saved)
  }

  const activeDisciplines = disciplines.filter(d => d.activo)
  const sortedPhases = [...chapterPhases].sort((a, b) => a.orden - b.orden)

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 14 }}>
              <div>
                <label style={S.label}>Disciplina</label>
                <select value={disciplineId} onChange={e => setDisciplineId(e.target.value)} style={S.select}>
                  <option value="">— Sin asignar —</option>
                  {activeDisciplines.sort((a, b) => a.orden - b.orden).map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Unidad de medida</label>
                <select value={unidad} onChange={e => setUnidad(e.target.value)} style={S.select}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {sortedPhases.length > 0 && (
              <div>
                <label style={S.label}>Fases en que participa esta partida</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 6, padding: '10px 12px', background: '#F0F7FF', borderRadius: 6, border: '1px solid #DAEEFF' }}>
                  {sortedPhases.map(ph => (
                    <label key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#1A1A1A' }}>
                      <input
                        type="checkbox"
                        checked={selectedPhaseIds.includes(ph.id)}
                        onChange={() => togglePhase(ph.id)}
                        style={{ width: 14, height: 14, accentColor: '#378ADD', cursor: 'pointer', flexShrink: 0 }}
                      />
                      {ph.nombre}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
  chapterId,
  initial,
  milestones,
  onClose,
  onSaved,
}: {
  chapterId: string
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
      const res = await createPhase({ chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, duracion_pct: pct, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      await setPhaseMilestoneLinks(res.id, achieves, requires)
      onSaved({ id: res.id, chapter_id: chapterId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, lead_time_days: 7, duracion_pct: pct, orden: parseInt(orden) || 0, achieves, requires })
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
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Tabiquería y trasdosados" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14 }}>
              <div>
                <label style={S.label}>% del tiempo del capítulo</label>
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
  chapterPhases,
  disciplines,
  onUnitChanged,
}: {
  unit: Unit
  chapterPhases: Phase[]
  disciplines: Discipline[]
  onUnitChanged: (updated: Unit) => void
}) {
  const [lineItemModal, setLineItemModal] = useState<{ mode: 'create' } | { mode: 'edit'; item: LineItem } | null>(null)
  const [deletingItem, setDeletingItem] = useState<LineItem | null>(null)

  const discMap: Record<string, Discipline> = {}
  for (const d of disciplines) discMap[d.id] = d

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

  return (
    <>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #E8E6E0', background: '#FAFAF8', padding: '0 16px' }}>
        <span style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#1A1A1A', borderBottom: '2px solid #1A1A1A' }}>
          Partidas ({unit.line_items.length})
        </span>
        <div style={{ flex: 1 }} />
        <button style={{ ...S.btnSm('#1A1A1A'), marginRight: 4 }} onClick={() => setLineItemModal({ mode: 'create' })}>+ Partida</button>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {unit.line_items.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#BBB', textAlign: 'center', padding: '16px 0' }}>Sin partidas. Añade la primera.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1A1A1A' }}>
                {['Nombre', 'Disciplina', 'Unidad', 'Fases', ''].map(h => (
                  <th key={h} style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...unit.line_items].sort((a, b) => a.orden - b.orden).map((item, i) => {
                const disc = item.discipline_id ? discMap[item.discipline_id] : null
                const phaseCount = item.phase_ids.length
                return (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>
                      {item.nombre}
                      <span style={{ marginLeft: 6, fontSize: 9, fontFamily: 'monospace', background: '#F0EEE8', borderRadius: 3, padding: '1px 5px', color: '#888' }}>{item.unidad_medida}</span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                      {disc ? (
                        <span style={{ background: disc.color + '22', color: disc.color, borderRadius: 3, padding: '2px 7px', fontWeight: 600, fontSize: 10 }}>{disc.nombre}</span>
                      ) : (
                        <span style={{ color: '#CCC', fontSize: 10 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: '#555', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                      <span style={{ background: '#F0EEE8', borderRadius: 3, padding: '2px 6px', fontWeight: 600, fontFamily: 'monospace' }}>{item.unidad_medida}</span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                      {phaseCount > 0 ? (
                        <span style={{ background: '#EBF5FF', color: '#378ADD', borderRadius: 3, padding: '2px 6px', fontWeight: 600, fontSize: 10 }}>
                          {phaseCount} {phaseCount === 1 ? 'fase' : 'fases'}
                        </span>
                      ) : (
                        <span style={{ color: '#CCC', fontSize: 10 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button onClick={() => setLineItemModal({ mode: 'edit', item })} style={{ ...S.btnSm(), marginRight: 4 }}>Editar</button>
                      <button onClick={() => setDeletingItem(item)} style={{ ...S.btnSm('#DC2626'), color: '#fff' }}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {lineItemModal && (
        <LineItemModal
          unitId={unit.id}
          chapterPhases={chapterPhases}
          initial={lineItemModal.mode === 'edit' ? lineItemModal.item : null}
          disciplines={disciplines}
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
    </>
  )
}

// ── Unit Row ──────────────────────────────────────────────────────────────────

function UnitRow({
  unit,
  chapterPhases,
  disciplines,
  onUnitChanged,
  onUnitDeleted,
}: {
  unit: Unit
  chapterPhases: Phase[]
  disciplines: Discipline[]
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
        {(unit.imagen_portada_url || unit.descripcion_cliente) && (
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 3, background: '#D85A30', color: '#fff', flexShrink: 0 }}>MEM</span>
        )}
        <span style={{ fontSize: 10, color: '#AAA' }}>{unit.line_items.length} partidas</span>
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
          <UnitDetail unit={unit} chapterPhases={chapterPhases} disciplines={disciplines} onUnitChanged={onUnitChanged} />
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
  disciplines,
  onChapterChanged,
  onChapterDeleted,
}: {
  chapter: Chapter
  milestones: Milestone[]
  disciplines: Discipline[]
  onChapterChanged: (updated: Chapter) => void
  onChapterDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingUnit, setAddingUnit] = useState(false)
  const [phaseModal, setPhaseModal] = useState<{ mode: 'create' } | { mode: 'edit'; phase: Phase } | null>(null)
  const [deletingPhase, setDeletingPhase] = useState<Phase | null>(null)

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

  const handlePhaseSaved = (phase: Phase) => {
    const exists = chapter.phases.find(p => p.id === phase.id)
    const updated = exists
      ? chapter.phases.map(p => p.id === phase.id ? phase : p)
      : [...chapter.phases, phase]
    onChapterChanged({ ...chapter, phases: updated })
    setPhaseModal(null)
  }

  const handlePhaseDelete = async (phase: Phase) => {
    const res = await deletePhase(phase.id)
    if ('error' in res) { alert(res.error); return }
    onChapterChanged({ ...chapter, phases: chapter.phases.filter(p => p.id !== phase.id) })
    setDeletingPhase(null)
  }

  const totalItems = chapter.units.reduce((acc, u) => acc + u.line_items.length, 0)
  const principalDisc = disciplines.find(d => d.id === chapter.principal_discipline_id)

  return (
    <div style={{ marginBottom: 8, borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', background: '#fff' }}>
      {/* Chapter header — dark */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1A1A1A', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 14, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, letterSpacing: '0.02em' }}>{chapter.nombre}</span>
        {principalDisc && (
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: principalDisc.color + '33', color: principalDisc.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {principalDisc.nombre}
          </span>
        )}
        {(chapter.imagen_portada_url || chapter.descripcion_cliente) && (
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 3, background: '#D85A30', color: '#fff', flexShrink: 0 }}>MEM</span>
        )}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
          {chapter.duracion_pct > 0 ? `${chapter.duracion_pct}% · ` : ''}{chapter.units.length} unid. · {totalItems} part. · {chapter.phases.length} fases
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

      {expanded && (
        <div>
          {/* Phases section */}
          <div style={{ borderBottom: '1px solid #E8E6E0', background: '#F0F7FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#378ADD', flex: 1 }}>
                Fases de ejecución ({chapter.phases.length})
              </span>
              <button
                style={{ padding: '3px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: '#378ADD', color: '#fff' }}
                onClick={() => setPhaseModal({ mode: 'create' })}
              >+ Fase</button>
            </div>
            {chapter.phases.length === 0 ? (
              <p style={{ margin: 0, padding: '0 16px 10px', fontSize: 11, color: '#9AC0E0' }}>Sin fases definidas para este capítulo.</p>
            ) : (
              <div style={{ padding: '0 16px 10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1A5CA8' }}>
                      {['Fase', 'Duración', 'Hitos', ''].map(h => (
                        <th key={h} style={{ padding: '5px 10px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...chapter.phases].sort((a, b) => a.orden - b.orden).map((phase, i) => (
                      <tr key={phase.id} style={{ background: i % 2 === 0 ? '#fff' : '#F0F7FF' }}>
                        <td style={{ padding: '7px 10px', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #DAEEFF' }}>{phase.nombre}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, borderBottom: '1px solid #DAEEFF', whiteSpace: 'nowrap' }}>
                          <span style={{ background: '#EBF5FF', color: '#378ADD', borderRadius: 3, padding: '2px 6px', fontWeight: 600, fontSize: 11 }}>{phase.duracion_pct}%</span>
                        </td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #DAEEFF' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {phase.achieves.map(mid => {
                              const m = milestones.find(x => x.id === mid)
                              return m ? <span key={mid} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>{m.nombre}</span> : null
                            })}
                            {phase.requires.map(mid => {
                              const m = milestones.find(x => x.id === mid)
                              return m ? <span key={mid} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontWeight: 600 }}>req: {m.nombre}</span> : null
                            })}
                          </div>
                        </td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #DAEEFF', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <button onClick={() => setPhaseModal({ mode: 'edit', phase })} style={{ ...S.btnSm(), marginRight: 4, fontSize: 10 }}>Editar</button>
                          <button onClick={() => setDeletingPhase(phase)} style={{ ...S.btnSm('#DC2626'), color: '#fff', fontSize: 10 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Units */}
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
                chapterPhases={chapter.phases}
                disciplines={disciplines}
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
          disciplines={disciplines}
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
      {phaseModal && (
        <PhaseModal
          chapterId={chapter.id}
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
    </div>
  )
}

// ── Discipline Modal ──────────────────────────────────────────────────────────

const DISC_COLORS = ['#378ADD', '#059669', '#D97706', '#D85A30', '#7C3AED', '#DB2777', '#374151', '#0369A1', '#92400E', '#B45309']

function DisciplineModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Discipline | null
  onClose: () => void
  onSaved: (d: Discipline) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [color, setColor] = useState(initial?.color ?? '#378ADD')
  const [orden, setOrden] = useState(String(initial?.orden ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    if (initial) {
      const res = await updateDiscipline(initial.id, { nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, orden: parseInt(orden) || 0 })
    } else {
      const res = await createDiscipline({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, orden: parseInt(orden) || 0 })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, orden: parseInt(orden) || 0, activo: true })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 420 }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar disciplina' : 'Nueva disciplina'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Instalaciones eléctricas" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Qué abarca esta disciplina…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14 }}>
              <div>
                <label style={S.label}>Color</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {DISC_COLORS.map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => setColor(c)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '3px solid #1A1A1A' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }}
                    />
                  ))}
                </div>
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

// ── Disciplines Section ───────────────────────────────────────────────────────

function DisciplinesSection({
  disciplines,
  onChange,
}: {
  disciplines: Discipline[]
  onChange: (updated: Discipline[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; d: Discipline } | null>(null)
  const [deleting, setDeleting] = useState<Discipline | null>(null)

  const handleDelete = async (d: Discipline) => {
    const res = await deleteDiscipline(d.id)
    if ('error' in res) { alert(res.error); return }
    onChange(disciplines.filter(x => x.id !== d.id))
    setDeleting(null)
  }

  const sorted = [...disciplines].sort((a, b) => a.orden - b.orden)

  return (
    <div style={{ marginBottom: 16, borderRadius: 8, border: '2px solid #378ADD', overflow: 'hidden', background: '#fff' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#EBF5FF', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 12, color: '#378ADD', width: 14, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A5CA8', flex: 1, letterSpacing: '0.02em' }}>Disciplinas de ejecución</span>
        <span style={{ fontSize: 10, color: '#1A5CA8', opacity: 0.7 }}>{disciplines.length} disciplinas configuradas</span>
        <button
          onClick={e => { e.stopPropagation(); setModal({ mode: 'create' }) }}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#378ADD', color: '#fff' }}
        >+ Disciplina</button>
      </div>

      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {sorted.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#BBB', textAlign: 'center', padding: '16px 0' }}>
              Sin disciplinas configuradas.{' '}
              <button style={{ background: 'none', border: 'none', color: '#378ADD', cursor: 'pointer', fontSize: 12, padding: 0 }} onClick={() => setModal({ mode: 'create' })}>Añadir la primera.</button>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorted.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, background: i % 2 === 0 ? '#FAFAF8' : '#fff', border: '1px solid #F0EEE8' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#AAA', width: 24, flexShrink: 0, fontFamily: 'monospace' }}>{String(d.orden).padStart(2, '0')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{d.nombre}</span>
                    {d.descripcion && <span style={{ fontSize: 11, color: '#AAA', marginLeft: 8 }}>{d.descripcion}</span>}
                  </div>
                  {!d.activo && <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em' }}>INACTIVA</span>}
                  <button onClick={() => setModal({ mode: 'edit', d })} style={{ ...S.btnSm(), fontSize: 11 }}>Editar</button>
                  <button onClick={() => setDeleting(d)} style={{ ...S.btnSm('#DC2626'), color: '#fff', fontSize: 11 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <DisciplineModal
          initial={modal.mode === 'edit' ? modal.d : null}
          onClose={() => setModal(null)}
          onSaved={saved => {
            const exists = disciplines.find(x => x.id === saved.id)
            onChange(exists ? disciplines.map(x => x.id === saved.id ? saved : x) : [...disciplines, saved])
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
  const [merging, setMerging] = useState(false)

  const handleDelete = async (m: Milestone) => {
    const res = await deleteMilestone(m.id)
    if ('error' in res) { alert(res.error); return }
    onChange(milestones.filter(x => x.id !== m.id))
    setDeleting(null)
  }

  const handleMergeGroup = async (keep: Milestone, dupes: Milestone[]) => {
    setMerging(true)
    for (const dupe of dupes) {
      const res = await mergeMilestones(keep.id, dupe.id)
      if ('error' in res) { alert(res.error); setMerging(false); return }
    }
    onChange(milestones.filter(x => dupes.every(d => d.id !== x.id)))
    setMerging(false)
  }

  const sorted = [...milestones].sort((a, b) => a.orden - b.orden)

  const duplicateGroups = Object.values(
    sorted.reduce<Record<string, Milestone[]>>((acc, m) => {
      const key = m.nombre.trim().toLowerCase()
      acc[key] = [...(acc[key] ?? []), m]
      return acc
    }, {})
  ).filter(g => g.length > 1)

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
        {duplicateGroups.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, padding: '2px 6px' }}>
            {duplicateGroups.length} duplicado{duplicateGroups.length > 1 ? 's' : ''}
          </span>
        )}
        <span style={{ fontSize: 10, color: '#D85A30', opacity: 0.6 }}>{milestones.length} hitos configurados</span>
        <button
          onClick={e => { e.stopPropagation(); setModal({ mode: 'create' }) }}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#D85A30', color: '#fff' }}
        >+ Hito</button>
      </div>

      {duplicateGroups.length > 0 && (
        <div style={{ padding: '10px 16px', background: '#FFFBEB', borderBottom: '1px solid #FCD34D' }}>
          {duplicateGroups.map(group => {
            const [keep, ...dupes] = group
            return (
              <div key={keep.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ color: '#92400E' }}>
                  Hito duplicado: <strong>"{keep.nombre}"</strong> aparece {group.length} veces.
                  Se conservará el primero (orden {keep.orden}) y se fusionarán los demás.
                </span>
                <button
                  disabled={merging}
                  onClick={() => handleMergeGroup(keep, dupes)}
                  style={{ padding: '3px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: merging ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#D97706', color: '#fff', flexShrink: 0, opacity: merging ? 0.6 : 1 }}
                >
                  {merging ? 'Fusionando…' : 'Fusionar'}
                </button>
              </div>
            )
          })}
        </div>
      )}

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
  initialDisciplines,
}: {
  initialChapters: Chapter[]
  initialMilestones: Milestone[]
  initialDisciplines: Discipline[]
}) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters)
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [disciplines, setDisciplines] = useState<Discipline[]>(initialDisciplines)
  const [addingChapter, setAddingChapter] = useState(false)

  const totalUnits  = chapters.reduce((a, c) => a + c.units.length, 0)
  const totalItems  = chapters.reduce((a, c) => a + c.units.reduce((b, u) => b + u.line_items.length, 0), 0)
  const totalPhases = chapters.reduce((a, c) => a + c.phases.length, 0)

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>FP Execution</p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Template</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>
            {chapters.length} capítulos · {totalUnits} unidades · {totalItems} partidas · {totalPhases} fases · {milestones.length} hitos · {disciplines.length} disciplinas
          </p>
        </div>
        <button
          onClick={() => setAddingChapter(true)}
          style={{ ...S.btn(true), padding: '9px 18px', fontSize: 13 }}
        >+ Capítulo</button>
      </div>

      {/* Disciplines section */}
      <DisciplinesSection disciplines={disciplines} onChange={setDisciplines} />

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
            disciplines={disciplines}
            onChapterChanged={updated => setChapters(prev => prev.map(c => c.id === updated.id ? updated : c))}
            onChapterDeleted={id => setChapters(prev => prev.filter(c => c.id !== id))}
          />
        ))}
      </div>

      {/* Add chapter modal */}
      {addingChapter && (
        <ChapterModal
          initial={null}
          disciplines={disciplines}
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

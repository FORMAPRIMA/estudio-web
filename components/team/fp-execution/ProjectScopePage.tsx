'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { updateProject, saveProjectScope, saveProjectSchedule } from '@/app/actions/fpe-projects'
import DocumentHub, { FpeDoc, ReadinessCheck, ScopedChapter, PartnerForDocs } from '@/components/team/fp-execution/DocumentHub'
import TenderPanel, { type FpeTender, type FpePartnerSummary, type FpeDiscipline } from '@/components/team/fp-execution/TenderPanel'
import ProjectDashboard from '@/components/team/fp-execution/ProjectDashboard'
import { computeParametricSchedule, formatScheduleDate, type ScheduleChapter, type ScheduleMilestone } from '@/lib/fp-execution/schedule'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectStatus = 'borrador' | 'scope_ready' | 'tender_launched' | 'awarded' | 'contracted' | 'archived'

interface DbProjectUnit {
  id: string
  template_unit_id: string
  notas: string | null
  orden: number
}

interface Project {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  ciudad: string | null
  linked_proyecto_id: string | null
  status: ProjectStatus
  readiness_score: number
  created_at: string
  project_units: DbProjectUnit[]
}

interface TemplateLineItem {
  id: string
  nombre: string
  descripcion: string | null
  unidad_medida: string
  orden: number
  activo: boolean
}

interface TemplateUnit {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  line_items: TemplateLineItem[]
}

interface TemplateChapter {
  id: string
  nombre: string
  orden: number
  units: TemplateUnit[]
}

interface LinkedProyecto { id: string; nombre: string; codigo: string | null }

// re-export for page.tsx
export type { ScheduleChapter, ScheduleMilestone }

// ── Scope state types ─────────────────────────────────────────────────────────

interface UnitScope {
  included: boolean
  notas: string
}

type ScopeState = Record<string, UnitScope> // keyed by template_unit_id

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  borrador:        'Borrador',
  scope_ready:     'Scope listo',
  tender_launched: 'En licitación',
  awarded:         'Adjudicado',
  contracted:      'Contratado',
  archived:        'Archivado',
}

const STATUS_COLORS: Record<ProjectStatus, { bg: string; color: string }> = {
  borrador:        { bg: '#F3F4F6', color: '#6B7280' },
  scope_ready:     { bg: '#EBF5FF', color: '#378ADD' },
  tender_launched: { bg: '#FEF3C7', color: '#D97706' },
  awarded:         { bg: '#ECFDF5', color: '#059669' },
  contracted:      { bg: '#D1FAE5', color: '#065F46' },
  archived:        { bg: '#F9FAFB', color: '#9CA3AF' },
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  label:    { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:    { padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', outline: 'none' },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8',
    color: primary ? '#fff' : '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

// ── Build initial scope state from DB data ────────────────────────────────────

function buildInitialScope(
  chapters: TemplateChapter[],
  projectUnits: DbProjectUnit[]
): ScopeState {
  const state: ScopeState = {}
  const puByTemplateUnitId: Record<string, DbProjectUnit> = {}
  for (const pu of projectUnits) puByTemplateUnitId[pu.template_unit_id] = pu

  for (const ch of chapters) {
    for (const unit of ch.units) {
      const pu = puByTemplateUnitId[unit.id]
      state[unit.id] = {
        included: !!pu,
        notas:    pu?.notas ?? '',
      }
    }
  }

  return state
}

// ── Edit project modal ────────────────────────────────────────────────────────

function EditProjectModal({
  project,
  linkedProyectos,
  onClose,
  onSaved,
}: {
  project: Project
  linkedProyectos: LinkedProyecto[]
  onClose: () => void
  onSaved: (updated: Partial<Project>) => void
}) {
  const [nombre, setNombre] = useState(project.nombre)
  const [descripcion, setDescripcion] = useState(project.descripcion ?? '')
  const [direccion, setDireccion] = useState(project.direccion ?? '')
  const [ciudad, setCiudad] = useState(project.ciudad ?? '')
  const [linkedId, setLinkedId] = useState(project.linked_proyecto_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      direccion: direccion.trim() || null,
      ciudad: ciudad.trim() || null,
      linked_proyecto_id: linkedId || null,
    }
    const res = await updateProject(project.id, payload)
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved(payload)
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Editar proyecto</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14 }}>
              <div>
                <label style={S.label}>Dirección</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)} style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={S.label}>Ciudad</label>
                <input value={ciudad} onChange={e => setCiudad(e.target.value)} style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }} />
              </div>
            </div>
            {linkedProyectos.length > 0 && (
              <div>
                <label style={S.label}>Proyecto FP interno</label>
                <select value={linkedId} onChange={e => setLinkedId(e.target.value)} style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }}>
                  <option value="">Sin vincular</option>
                  {linkedProyectos.map(p => (
                    <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            {error && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>
            )}
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

// ── Unit Scope Row ────────────────────────────────────────────────────────────

function UnitScopeRow({
  unit,
  scope,
  onToggle,
  onNotasChange,
}: {
  unit: TemplateUnit
  scope: UnitScope
  onToggle: (unitId: string) => void
  onNotasChange: (unitId: string, notas: string) => void
}) {
  const activeItems = unit.line_items.filter(li => li.activo)

  return (
    <div style={{ borderBottom: '1px solid #E8E6E0' }}>
      {/* Unit toggle row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: scope.included ? '#F0F7FF' : '#fff',
          transition: 'background 0.15s',
        }}
      >
        <input
          type="checkbox"
          checked={scope.included}
          onChange={() => onToggle(unit.id)}
          style={{ width: 16, height: 16, accentColor: '#378ADD', flexShrink: 0, cursor: 'pointer' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: scope.included ? 600 : 400, color: scope.included ? '#1A1A1A' : '#555' }}>
            {unit.nombre}
          </span>
          {unit.descripcion && (
            <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>{unit.descripcion}</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#AAA', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {activeItems.length > 0 ? `${activeItems.length} partida${activeItems.length !== 1 ? 's' : ''}` : 'Sin partidas'}
        </span>
      </div>

      {/* Notes when included */}
      {scope.included && (
        <div style={{ background: '#F8F7FF', borderTop: '1px solid #E0EAFF', padding: '10px 16px 14px 44px' }}>
          <label style={{ ...S.label, marginBottom: 4 }}>Notas de la unidad</label>
          <textarea
            rows={2}
            value={scope.notas}
            onChange={e => onNotasChange(unit.id, e.target.value)}
            placeholder="Especificaciones, condicionantes, observaciones…"
            style={{ ...S.textarea, fontSize: 11, borderColor: '#DDE8FF' }}
          />
        </div>
      )}
    </div>
  )
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────

function ScheduleTab({
  projectId,
  scheduleChapters,
  scheduleMilestones,
  initialFechaInicio,
  initialDuracionSemanas,
  labelStyle,
  inputStyle,
  btnStyle,
}: {
  projectId: string
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  initialFechaInicio: string | null
  initialDuracionSemanas: number
  labelStyle: React.CSSProperties
  inputStyle: React.CSSProperties
  btnStyle: (primary?: boolean) => React.CSSProperties
}) {
  const [fechaInicio, setFechaInicio] = useState(initialFechaInicio ?? '')
  const [semanas, setSemanas] = useState(String(initialDuracionSemanas || ''))
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const schedule = useMemo(() => {
    if (!fechaInicio || !semanas || parseFloat(semanas) <= 0) return null
    return computeParametricSchedule(
      scheduleChapters,
      new Date(fechaInicio),
      parseFloat(semanas),
    )
  }, [fechaInicio, semanas, scheduleChapters])

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null)
    const res = await saveProjectSchedule(projectId, {
      fecha_inicio_obra: fechaInicio || null,
      duracion_obra_semanas: parseFloat(semanas) || 0,
    })
    setSaving(false)
    if ('error' in res) setSaveMsg({ ok: false, text: res.error })
    else { setSaveMsg({ ok: true, text: 'Parámetros guardados' }); setTimeout(() => setSaveMsg(null), 3000) }
  }

  const hasScope = scheduleChapters.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Inputs */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '20px 24px' }}>
        <p style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
          Parámetros del cronograma
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 200px', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Fecha de inicio de obra</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Duración estimada total</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min={1} step={0.5} value={semanas} onChange={e => setSemanas(e.target.value)} placeholder="0" style={inputStyle} />
              <span style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>semanas</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnStyle(true), padding: '8px 18px', fontSize: 13 }}>
            {saving ? 'Guardando…' : 'Guardar parámetros'}
          </button>
          {saveMsg && <span style={{ fontSize: 12, color: saveMsg.ok ? '#059669' : '#DC2626', fontWeight: 500 }}>{saveMsg.text}</span>}
        </div>
      </div>

      {/* No scope warning */}
      {!hasScope && (
        <div style={{ background: '#FFF7F0', border: '1px solid #FED7AA', borderRadius: 8, padding: '14px 18px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
            Define primero el scope del proyecto. El cronograma se calcula con los <strong>% de duración</strong> configurados en cada capítulo y sus fases (plantilla → editar capítulo/fase).
          </p>
        </div>
      )}

      {/* Schedule preview */}
      {hasScope && !schedule && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#BBB', background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 6 }}>Introduce los parámetros</p>
          <p style={{ fontSize: 12, margin: 0 }}>Con fecha de inicio y duración estimada, el sistema calculará las fechas de cada fase automáticamente.</p>
        </div>
      )}

      {schedule && (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
            Preview — cronograma paramétrico
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: '#AAA' }}>
            Las fechas son estimaciones basadas en los porcentajes configurados en la plantilla. Los execution partners ven solo la fecha de inicio de cada fase, no las duraciones.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scheduleChapters.map(chapter => (
              <div key={chapter.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
                <div style={{ background: '#1A1A1A', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{chapter.nombre}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{chapter.duracion_pct}% del tiempo total</span>
                </div>
                {chapter.phases.length === 0 ? (
                  <p style={{ margin: 0, padding: '12px 16px', fontSize: 11, color: '#CCC' }}>Sin fases definidas en la plantilla.</p>
                ) : (
                  <div>
                    {[...chapter.phases].sort((a, b) => a.orden - b.orden).map((ph, i) => {
                      const entry = schedule[ph.id]
                      const achievesNames = ph.achieves.map(mid => scheduleMilestones.find(m => m.id === mid)?.nombre).filter(Boolean)
                      const requiresNames = ph.requires.map(mid => scheduleMilestones.find(m => m.id === mid)?.nombre).filter(Boolean)
                      return (
                        <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: '#333' }}>{ph.nombre}</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                              {achievesNames.map((n, j) => <span key={j} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>{n}</span>)}
                              {requiresNames.map((n, j) => <span key={j} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontWeight: 600 }}>req: {n}</span>)}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: '#CCC', flexShrink: 0 }}>{ph.duracion_pct}%</span>
                          {entry ? (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#D85A30', fontFamily: 'monospace' }}>
                                {formatScheduleDate(entry.startDate)}
                              </span>
                              <span style={{ display: 'block', fontSize: 9, color: '#BBB' }}>
                                → {formatScheduleDate(entry.endDate)}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 10, color: '#CCC' }}>—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectScopePage({
  project: initialProject,
  chapters,
  linkedProyectos,
  scopedChapters,
  partnersForDocs,
  initialUnitPartners,
  initialDocs,
  initialChecks,
  initialTender,
  partners,
  renderUrls,
  tourVirtualUrl,
  scheduleChapters,
  scheduleMilestones,
  initialFechaInicio,
  initialDuracionSemanas,
  disciplines,
  scopedDisciplineIds,
  chapterSettingsMap,
}: {
  project: Project
  chapters: TemplateChapter[]
  linkedProyectos: LinkedProyecto[]
  scopedChapters: ScopedChapter[]
  partnersForDocs: PartnerForDocs[]
  initialUnitPartners: Record<string, string[]>
  initialDocs: FpeDoc[]
  initialChecks: ReadinessCheck[]
  initialTender: FpeTender | null
  partners: FpePartnerSummary[]
  renderUrls: string[]
  tourVirtualUrl: string | null
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  initialFechaInicio: string | null
  initialDuracionSemanas: number
  disciplines: FpeDiscipline[]
  scopedDisciplineIds: string[]
  chapterSettingsMap: Record<string, string | null>
}) {
  const [project, setProject] = useState<Project>(initialProject)
  const [scope, setScope] = useState<ScopeState>(() =>
    buildInitialScope(chapters, initialProject.project_units)
  )
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editingProject, setEditingProject] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scope' | 'docs' | 'tender' | 'schedule'>('dashboard')

  // Build a unit name lookup from template chapters
  const unitNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const ch of chapters) for (const u of ch.units) m[u.id] = u.nombre
    return m
  }, [chapters])

  // Derive enriched project units for TenderPanel from scopedChapters
  const enrichedProjectUnits = useMemo(
    () => scopedChapters.flatMap(ch => ch.units.map(u => ({
      id:               u.project_unit_id,
      template_unit_id: u.template_unit_id,
      nombre:           u.nombre,
    }))),
    [scopedChapters]
  )

  // Derived counts
  const includedCount = Object.values(scope).filter(u => u.included).length
  const totalUnits    = chapters.reduce((a, c) => a + c.units.length, 0)

  // ── Scope handlers ───────────────────────────────────────────────────────

  const handleToggle = useCallback((unitId: string) => {
    setScope(prev => ({
      ...prev,
      [unitId]: { ...prev[unitId], included: !prev[unitId].included },
    }))
  }, [])

  const handleNotasChange = useCallback((unitId: string, notas: string) => {
    setScope(prev => ({
      ...prev,
      [unitId]: { ...prev[unitId], notas },
    }))
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)

    const unitsPayload = chapters
      .flatMap(ch => ch.units)
      .filter(unit => scope[unit.id]?.included)
      .map(unit => ({
        template_unit_id: unit.id,
        notas: scope[unit.id].notas || null,
      }))

    const res = await saveProjectScope(project.id, unitsPayload)
    setSaving(false)

    if ('error' in res) {
      setSaveMsg({ type: 'err', text: res.error })
    } else {
      const hasUnits = unitsPayload.length > 0
      setProject(p => ({ ...p, status: (hasUnits ? 'scope_ready' : 'borrador') as ProjectStatus }))
      setSaveMsg({ type: 'ok', text: `Scope guardado — ${unitsPayload.length} unidades` })
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // ── Chapter select all / none ─────────────────────────────────────────────

  const toggleChapter = (chapter: TemplateChapter) => {
    const allIncluded = chapter.units.every(u => scope[u.id]?.included)
    setScope(prev => {
      const next = { ...prev }
      for (const u of chapter.units) {
        next[u.id] = { ...next[u.id], included: !allIncluded }
      }
      return next
    })
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
    background: 'none', borderBottom: active ? '2px solid #1A1A1A' : '2px solid transparent',
    color: active ? '#1A1A1A' : '#AAA', fontFamily: 'inherit',
  })

  const statusC = STATUS_COLORS[project.status]

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Project header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0', padding: '20px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Link href="/team/fp-execution/projects" style={{ fontSize: 12, color: '#AAA', textDecoration: 'none' }}>
              Proyectos
            </Link>
            <span style={{ color: '#DDD', fontSize: 12 }}>›</span>
            <span style={{ fontSize: 12, color: '#666' }}>{project.nombre}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
                {project.nombre}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: statusC.bg, color: statusC.color }}>
                  {STATUS_LABELS[project.status]}
                </span>
                {project.ciudad && (
                  <span style={{ fontSize: 12, color: '#888' }}>{project.ciudad}</span>
                )}
                {project.descripcion && (
                  <span style={{ fontSize: 12, color: '#AAA' }}>{project.descripcion}</span>
                )}
                {/* Readiness */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 60, height: 4, background: '#E8E6E0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${project.readiness_score}%`, height: '100%', background: project.readiness_score >= 60 ? '#378ADD' : '#D97706', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#999' }}>{project.readiness_score}% listo</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {(project.status === 'awarded' || project.status === 'contracted') && (
                <Link
                  href={`/team/fp-execution/projects/${project.id}/dream-team`}
                  style={{
                    padding: '8px 14px', fontSize: 12, borderRadius: 6, border: 'none',
                    background: '#D85A30', color: '#fff', fontFamily: 'inherit',
                    fontWeight: 600, textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  Dream Team
                </Link>
              )}
              <button onClick={() => setEditingProject(true)} style={S.btn()}>Editar proyecto</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '1px solid #E8E6E0', marginBottom: -1 }}>
            <button style={tabStyle(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
            <button style={tabStyle(activeTab === 'scope')} onClick={() => setActiveTab('scope')}>Scope</button>
            <button style={tabStyle(activeTab === 'docs')} onClick={() => setActiveTab('docs')}>Documentos</button>
            <button style={tabStyle(activeTab === 'schedule')} onClick={() => setActiveTab('schedule')}>Cronograma</button>
            <button style={tabStyle(activeTab === 'tender')} onClick={() => setActiveTab('tender')}>Licitación</button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>

        {/* ── Dashboard tab ── */}
        {activeTab === 'dashboard' && (
          <ProjectDashboard
            project={project}
            renderUrls={renderUrls}
            initialChecks={initialChecks}
            initialTender={initialTender}
            initialDocs={initialDocs}
            scopedChapters={scopedChapters}
            linkedProyectoNombre={
              linkedProyectos.find(p => p.id === project.linked_proyecto_id)?.nombre ?? null
            }
          />
        )}

        {/* ── Scope tab ── */}
        {activeTab === 'scope' && (
          <div>
            {/* Scope header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Scope del proyecto</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
                  {includedCount} de {totalUnits} unidades de ejecución incluidas
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {saveMsg && (
                  <span style={{ fontSize: 12, color: saveMsg.type === 'ok' ? '#059669' : '#DC2626', fontWeight: 500 }}>
                    {saveMsg.type === 'ok' ? '✓ ' : '✗ '}{saveMsg.text}
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ ...S.btn(true), padding: '9px 20px', fontSize: 13 }}
                >
                  {saving ? 'Guardando…' : 'Guardar scope'}
                </button>
              </div>
            </div>

            {/* No template */}
            {chapters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#BBB' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 8 }}>Template vacío</p>
                <p style={{ fontSize: 13, marginBottom: 20 }}>Define primero los capítulos y unidades en el template.</p>
                <Link href="/team/fp-execution/template" style={{ ...S.btn(true), textDecoration: 'none', display: 'inline-block' }}>
                  Ir al Template →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {chapters.map(chapter => {
                  const chUnits = chapter.units.filter(u => u.activo)
                  if (chUnits.length === 0) return null
                  const allIncluded = chUnits.every(u => scope[u.id]?.included)
                  const someIncluded = chUnits.some(u => scope[u.id]?.included)
                  const includedInChapter = chUnits.filter(u => scope[u.id]?.included).length

                  return (
                    <div key={chapter.id} style={{ borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
                      {/* Chapter header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1A1A1A' }}>
                        <input
                          type="checkbox"
                          checked={allIncluded}
                          ref={el => { if (el) el.indeterminate = someIncluded && !allIncluded }}
                          onChange={() => toggleChapter(chapter)}
                          style={{ width: 15, height: 15, accentColor: '#378ADD', flexShrink: 0, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, letterSpacing: '0.02em' }}>
                          {chapter.nombre}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                          {includedInChapter}/{chUnits.length} unidades
                        </span>
                      </div>

                      {/* Units */}
                      {chUnits.map(unit => (
                        <UnitScopeRow
                          key={unit.id}
                          unit={unit}
                          scope={scope[unit.id] ?? { included: false, notas: '' }}
                          onToggle={handleToggle}
                          onNotasChange={handleNotasChange}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Schedule tab ── */}
        {activeTab === 'schedule' && (
          <ScheduleTab
            projectId={project.id}
            scheduleChapters={scheduleChapters}
            scheduleMilestones={scheduleMilestones}
            initialFechaInicio={initialFechaInicio}
            initialDuracionSemanas={initialDuracionSemanas}
            labelStyle={S.label}
            inputStyle={S.input}
            btnStyle={S.btn}
          />
        )}

        {/* ── Docs tab ── */}
        {activeTab === 'docs' && (
          <DocumentHub
            projectId={project.id}
            scopedChapters={scopedChapters}
            partners={partnersForDocs}
            initialUnitPartners={initialUnitPartners}
            initialDocs={initialDocs}
            initialScore={project.readiness_score}
            initialChecks={initialChecks}
            tourVirtualUrl={tourVirtualUrl}
          />
        )}

        {/* ── Tender tab ── */}
        {activeTab === 'tender' && (
          <TenderPanel
            projectId={project.id}
            projectUnits={enrichedProjectUnits}
            initialTender={initialTender}
            partners={partners}
            initialProjectStatus={project.status}
            disciplines={disciplines}
            scopedDisciplineIds={scopedDisciplineIds}
          />
        )}
      </div>

      {/* Edit project modal */}
      {editingProject && (
        <EditProjectModal
          project={project}
          linkedProyectos={linkedProyectos}
          onClose={() => setEditingProject(false)}
          onSaved={updates => { setProject(p => ({ ...p, ...updates })); setEditingProject(false) }}
        />
      )}
    </div>
  )
}

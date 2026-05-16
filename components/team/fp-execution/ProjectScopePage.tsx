'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { updateProject, saveProjectScope, saveProjectSchedule, saveChapterDaysOverride, saveDuracionFactor, resetProjectSchedule } from '@/app/actions/fpe-projects'
import DocumentHub, { FpeDoc, ReadinessCheck, ScopedChapter, PartnerForDocs } from '@/components/team/fp-execution/DocumentHub'
import TenderPanel, { type FpeTender, type FpePartnerSummary, type FpeDiscipline } from '@/components/team/fp-execution/TenderPanel'
import BiddingPanel from '@/components/team/fp-execution/BiddingPanel'
import DreamTeamPanel from '@/components/team/fp-execution/DreamTeamPanel'
import ProjectDashboard from '@/components/team/fp-execution/ProjectDashboard'
import ObraManagementPage from '@/components/team/fp-execution/obra/ObraManagementPage'
import type { ObraBaselineSnapshot, ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'
import { computeParametricSchedule, computeChapterDays, formatScheduleDate, type ScheduleChapter, type ScheduleMilestone, type PhaseScheduleMap } from '@/lib/fp-execution/schedule'
import { addBusinessDays, snapToNextBusinessDay, calendarDaysBetween, isBusinessDay } from '@/lib/fp-execution/businessDays'

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
  m2_construccion: number | null
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
  duracion_dias_min: number | null
  duracion_dias_max: number | null
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
  const [m2, setM2] = useState(project.m2_construccion != null ? String(project.m2_construccion) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    const m2Val = m2.trim() === '' ? null : parseFloat(m2)
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      direccion: direccion.trim() || null,
      ciudad: ciudad.trim() || null,
      linked_proyecto_id: linkedId || null,
      m2_construccion: m2Val,
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
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>m² de construcción</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min={0} step={1} value={m2} onChange={e => setM2(e.target.value)} placeholder="0" style={{ ...S.input, width: '100%', boxSizing: 'border-box' as const }} />
                  <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>m²</span>
                </div>
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
  hasMem = false,
}: {
  unit: TemplateUnit
  scope: UnitScope
  onToggle: (unitId: string) => void
  onNotasChange: (unitId: string, notas: string) => void
  hasMem?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
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
        {hasMem && (
          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: '#D85A30', color: '#fff', flexShrink: 0, letterSpacing: '0.06em' }}>
            MEM
          </span>
        )}
        {activeItems.length > 0 ? (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: '#888', flexShrink: 0 }}
          >
            <span style={{ fontSize: 10, color: '#AAA', whiteSpace: 'nowrap' }}>
              {activeItems.length} partida{activeItems.length !== 1 ? 's' : ''}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#AAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span style={{ fontSize: 10, color: '#CCC', whiteSpace: 'nowrap', flexShrink: 0 }}>Sin partidas</span>
        )}
      </div>

      {/* Partidas list (read-only) */}
      {expanded && activeItems.length > 0 && (
        <div style={{ background: scope.included ? '#EBF4FF' : '#FAFAF8', borderTop: '1px solid #E8E6E0', padding: '8px 16px 8px 44px' }}>
          {activeItems.map((li, i) => (
            <div
              key={li.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 0',
                borderBottom: i < activeItems.length - 1 ? '1px solid #EEE' : 'none',
              }}
            >
              <span style={{ fontSize: 11, color: '#444' }}>{li.nombre}</span>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 3, background: '#E8E6E0', color: '#888', flexShrink: 0, marginLeft: 12 }}>
                {li.unidad_medida}
              </span>
            </div>
          ))}
        </div>
      )}

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

// ── Chapter Days Cell (scope tab) ─────────────────────────────────────────────
// Renders the estimated days for a chapter (interpolated by m²) plus an editable
// override field. Auto-saves on blur.

function ChapterDaysCell({
  projectId,
  chapter,
  m2,
  factor,
  currentOverride,
  onOverrideChange,
}: {
  projectId: string
  chapter: { id: string; duracion_dias_min: number | null; duracion_dias_max: number | null }
  m2: number | null
  factor: number
  currentOverride: number | null
  onOverrideChange: (chapterId: string, value: number | null) => void
}) {
  const [val, setVal] = useState(currentOverride != null ? String(currentOverride) : '')
  const [saving, setSaving] = useState(false)

  // Cifra interpolada con el factor aplicado (solo si no hay override).
  const interpolated = useMemo(
    () => computeChapterDays(chapter, m2, null, factor),
    [chapter, m2, factor],
  )
  const effective = currentOverride != null ? currentOverride : interpolated
  const factorPct = Math.round(factor * 100)

  const handleBlur = async () => {
    const trimmed = val.trim()
    const parsed  = trimmed === '' ? null : parseFloat(trimmed)
    if (parsed === currentOverride) return
    setSaving(true)
    const res = await saveChapterDaysOverride(projectId, chapter.id, parsed)
    setSaving(false)
    if ('success' in res) onOverrideChange(chapter.id, parsed)
  }

  const hasTemplateDays = chapter.duracion_dias_min != null && chapter.duracion_dias_max != null
  const isOverridden    = currentOverride != null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#FAFAF8', borderTop: '1px solid #F0EEE8', borderBottom: '1px solid #F0EEE8' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
        Días laborables
      </span>
      {hasTemplateDays ? (
        <>
          <span style={{ fontSize: 11, color: '#555' }}>
            Estimado: <strong style={{ color: '#1A1A1A' }}>{effective.toFixed(1)} DL</strong>
            {!isOverridden && m2 != null && (
              <span style={{ color: '#AAA', marginLeft: 4 }}>({m2}m² · rango {chapter.duracion_dias_min}–{chapter.duracion_dias_max} DL)</span>
            )}
            {!isOverridden && m2 == null && (
              <span style={{ color: '#AAA', marginLeft: 4 }}>(promedio · sin m²)</span>
            )}
            {!isOverridden && factorPct !== 100 && (
              <span style={{ color: '#D85A30', marginLeft: 4 }}>(× factor {factorPct}%)</span>
            )}
            {isOverridden && (
              <span style={{ color: '#D85A30', marginLeft: 4 }}>(override · factor no aplica)</span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <input
              type="number"
              min={0}
              step={0.5}
              value={val}
              placeholder={interpolated.toFixed(1)}
              onChange={e => setVal(e.target.value)}
              onBlur={handleBlur}
              disabled={saving}
              style={{ width: 70, padding: '4px 8px', fontSize: 11, border: '1px solid #E8E6E0', borderRadius: 4, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', outline: 'none' }}
            />
            <span style={{ fontSize: 10, color: '#888' }}>DL override</span>
          </div>
        </>
      ) : (
        <span style={{ fontSize: 11, color: '#DC2626' }}>
          Sin rango configurado en plantilla
        </span>
      )}
    </div>
  )
}

// ── Duración Factor Bar (scope tab) ──────────────────────────────────────────
// Ajuste global porcentual de los días laborables del proyecto. Solo afecta a
// los capítulos sin override manual (esos quedan blindados). Auto-save on blur.

function DuracionFactorBar({
  projectId,
  factor,
  onFactorChange,
  scheduleChapters,
  m2,
  chapterDaysOverrides,
}: {
  projectId: string
  factor: number
  onFactorChange: (factor: number) => void
  scheduleChapters: ScheduleChapter[]
  m2: number | null
  chapterDaysOverrides: Record<string, number | null>
}) {
  // Edit como string para permitir vacíos transitorios mientras el usuario teclea.
  const [val, setVal] = useState(String(Math.round(factor * 100)))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Duración real del proyecto: corre la misma simulación que el Gantt
  // (computeParametricSchedule), respetando dependencias entre capítulos vía hitos
  // y solapes (fases que pueden ejecutarse en paralelo). totalDays no es la suma
  // natural de los capítulos sino el span real del cronograma.
  // La fecha de inicio no afecta a totalDays — solo desplaza las fechas absolutas.
  const sums = useMemo(() => {
    const fakeStart = new Date()  // cualquier fecha sirve para calcular el span
    const withFactor    = computeParametricSchedule(scheduleChapters, fakeStart, m2, chapterDaysOverrides, factor).totalDays
    const withoutFactor = computeParametricSchedule(scheduleChapters, fakeStart, m2, chapterDaysOverrides, 1.0).totalDays

    let overriddenChapters = 0
    let totalChaptersWithDays = 0
    for (const ch of scheduleChapters) {
      const override = chapterDaysOverrides[ch.id] ?? null
      const base = computeChapterDays(ch, m2, override, 1.0)
      if (base > 0) {
        totalChaptersWithDays += 1
        if (override != null) overriddenChapters += 1
      }
    }
    return { withFactor, withoutFactor, overriddenChapters, totalChaptersWithDays }
  }, [scheduleChapters, m2, chapterDaysOverrides, factor])

  const handleBlur = async () => {
    const trimmed = val.trim()
    let pct = trimmed === '' ? 100 : parseFloat(trimmed)
    if (!Number.isFinite(pct) || pct <= 0) pct = 100
    // Clamp suave: rango razonable 25–200 % (avisa pero no bloquea valores extremos).
    pct = Math.max(1, Math.min(500, pct))
    const newFactor = pct / 100
    if (Math.abs(newFactor - factor) < 0.0001) {
      setVal(String(Math.round(factor * 100)))
      return
    }
    setSaving(true)
    setMsg(null)
    const res = await saveDuracionFactor(projectId, newFactor)
    setSaving(false)
    if ('error' in res) {
      setMsg({ ok: false, text: res.error })
      setVal(String(Math.round(factor * 100)))
      return
    }
    onFactorChange(newFactor)
    setVal(String(Math.round(newFactor * 100)))
    setMsg({ ok: true, text: 'Factor guardado' })
    setTimeout(() => setMsg(null), 1800)
  }

  const isNonDefault = Math.abs(factor - 1.0) > 0.001
  const totalWeeks = (sums.withFactor / 5).toFixed(1)

  return (
    <div style={{
      background: isNonDefault ? '#FFF7F0' : '#fff',
      border: `1px solid ${isNonDefault ? '#FED7AA' : '#E8E6E0'}`,
      borderRadius: 10,
      padding: '16px 20px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 24,
      alignItems: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
          Ajuste global de duración
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            min={1}
            max={500}
            step={5}
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={handleBlur}
            disabled={saving}
            style={{
              width: 80,
              padding: '6px 10px',
              fontSize: 14,
              fontWeight: 700,
              border: `1px solid ${isNonDefault ? '#FED7AA' : '#E8E6E0'}`,
              borderRadius: 6,
              fontFamily: 'inherit',
              color: '#1A1A1A',
              background: '#fff',
              outline: 'none',
              textAlign: 'right',
            }}
            title="Porcentaje aplicado al cálculo de días laborables. 100 % = sin ajuste."
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: isNonDefault ? '#D85A30' : '#888' }}>%</span>
        </div>
        {msg && (
          <span style={{ fontSize: 10, color: msg.ok ? '#059669' : '#DC2626', fontWeight: 500 }}>
            {msg.text}
          </span>
        )}
      </div>

      <div style={{ height: 36, width: 1, background: '#E8E6E0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
          Duración total del cronograma
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
            {sums.withFactor.toFixed(1)}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>días laborables · {totalWeeks} sem</span>
        </div>
        <span style={{ fontSize: 10, color: '#AAA' }}>
          Calculada con dependencias y solapes entre capítulos (mismo cálculo que el Gantt).
        </span>
        {isNonDefault && (
          <span style={{ fontSize: 11, color: '#888' }}>
            Sin factor: <strong style={{ color: '#555' }}>{sums.withoutFactor.toFixed(1)} DL</strong>
          </span>
        )}
        {sums.overriddenChapters > 0 && (
          <span style={{ fontSize: 10, color: '#999', fontStyle: 'italic' }}>
            {sums.overriddenChapters} de {sums.totalChaptersWithDays} capítulos con override manual: no se ven afectados por el factor.
          </span>
        )}
      </div>
    </div>
  )
}

// ── Zoom slider (control de densidad del Gantt) ──────────────────────────────

function ZoomSlider({
  label, hint, min, max, step, value, onChange,
}: {
  label: string
  hint: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: '#AAA', fontVariantNumeric: 'tabular-nums' }}>{hint}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        style={{
          width: '100%', accentColor: '#D85A30',
          height: 4, cursor: 'pointer',
        }}
      />
    </div>
  )
}

// ── Gantt Chart ───────────────────────────────────────────────────────────────
//
// Gantt profesional con:
//  - Scroll horizontal + vertical interno (sticky-left y sticky-top correctos)
//  - Zoom horizontal (px por día) y zoom vertical (alto de fila) controlado fuera
//  - Franja de hitos con packing greedy multi-fila (sin solapes)
//  - Marcadores circulares de hitos al final de cada barra, con tooltip
//  - Cabecera de meses + semanas
//  - Líneas verticales de hitos en color naranja
//
// Las constantes de columna/alto se reciben por props para que el toolbar de la
// pestaña pueda controlarlas con sliders.

const GANTT_COLORS = ['#378ADD', '#D85A30', '#059669', '#7C3AED', '#0891B2', '#CA8A04', '#BE185D', '#0369A1']

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function estimateChipWidthPx(nombre: string): number {
  // ~6.5px por char + 26px (icono + paddings) — acotado entre 70 y 220
  return Math.min(220, Math.max(70, 26 + nombre.length * 6.5))
}

function GanttChart({
  scheduleChapters,
  scheduleMilestones,
  schedule,
  fechaInicio,
  totalBusinessDays,
  leftColW,
  dayPx,
  rowH,
  chapterRowH,
  containerMaxH,
}: {
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  schedule: PhaseScheduleMap
  fechaInicio: string
  totalBusinessDays: number
  leftColW: number
  dayPx: number
  rowH: number
  chapterRowH: number
  containerMaxH: number
}) {
  // Tooltip custom (en lugar del title nativo del browser, que tiene delay y
  // renderiza mal caracteres unicode como las flechas).
  const [hover, setHover] = useState<{ lines: string[]; x: number; y: number } | null>(null)
  const handleHover = (lines: string[]) => (e: React.MouseEvent) => {
    setHover({ lines, x: e.clientX, y: e.clientY })
  }
  const handleMove = (e: React.MouseEvent) => {
    setHover(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
  }
  const clearHover = () => setHover(null)

  const startAnchor = snapToNextBusinessDay(new Date(fechaInicio))
  const projectStartMs = startAnchor.getTime()

  // Calendar span: del inicio hasta el endDate más tardío (en días naturales).
  let latestMs = projectStartMs
  for (const id of Object.keys(schedule)) {
    const e = schedule[id]
    if (e && e.endDate.getTime() > latestMs) latestMs = e.endDate.getTime()
  }
  const calendarSpanDays = Math.max(1, (latestMs - projectStartMs) / 86400000)

  // Píxeles totales del eje temporal: ancho fijo por día → scroll horizontal real.
  const timelineWidthPx = Math.max(600, Math.ceil(calendarSpanDays * dayPx))

  // Posicionamiento sobre el eje calendario, en píxeles.
  const calOffset = (d: Date) => (d.getTime() - projectStartMs) / 86400000
  const toLeftPx  = (calDays: number) => Math.max(0, calDays * dayPx)
  const toWidthPx = (calDays: number) => Math.max(2, calDays * dayPx)

  // When each milestone is achieved (latest endDate among phases that achieve it)
  const milestoneCalOffset: Record<string, number> = {}
  const milestoneEndDate: Record<string, Date> = {}
  for (const ch of scheduleChapters) {
    for (const ph of ch.phases) {
      const e = schedule[ph.id]
      if (!e) continue
      const d = calOffset(e.endDate)
      for (const mid of ph.achieves) {
        if (milestoneCalOffset[mid] === undefined || d > milestoneCalOffset[mid]) {
          milestoneCalOffset[mid] = d
          milestoneEndDate[mid] = e.endDate
        }
      }
    }
  }

  // Marcadores de semanas LABORABLES (5 días laborables = 1 semana).
  const businessWeeks = Math.ceil(totalBusinessDays / 5)
  const weekStep = dayPx * 5 >= 50 ? 1 : dayPx * 5 >= 30 ? 2 : 4
  const weekMarkers: { week: number; calOffset: number }[] = []
  for (let w = 0; w <= businessWeeks; w += weekStep) {
    const date = addBusinessDays(startAnchor, w * 5)
    weekMarkers.push({ week: w, calOffset: calOffset(date) })
  }

  // Marcadores de meses para la cabecera (eje calendario natural).
  // Iteramos por el primer día de cada mes desde fechaInicio hasta latestMs.
  // IMPORTANTE: usamos UTC en todo el cálculo para que las fronteras de mes
  // caigan exactamente en el día 1 sin desfase por timezone.
  const monthMarkers: { label: string; calOffset: number; widthDays: number; day1Offset: number | null }[] = []
  {
    const start = new Date(projectStartMs)
    let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    const endMs = latestMs + 86400000
    while (cursor < endMs) {
      const cursorDate = new Date(cursor)
      const next = Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() + 1, 1)
      const segStart = Math.max(cursor, projectStartMs)
      const segEnd   = Math.min(next, endMs)
      const offsetDays = (segStart - projectStartMs) / 86400000
      const widthDays  = (segEnd   - segStart) / 86400000
      // Posición del día 1 real del mes (puede ser negativo si está antes del inicio del proyecto).
      const rawDay1 = (cursor - projectStartMs) / 86400000
      const day1Offset = rawDay1 >= 0 ? rawDay1 : null
      if (widthDays > 0) {
        const label = `${MESES_CORTOS[cursorDate.getUTCMonth()]} ${String(cursorDate.getUTCFullYear()).slice(2)}`
        monthMarkers.push({ label, calOffset: offsetDays, widthDays, day1Offset })
      }
      cursor = next
    }
  }

  // Día de hoy en el eje calendario del proyecto (null si está fuera del span).
  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )
  const todayOffsetDays = (todayMs - projectStartMs) / 86400000
  const todayInRange = todayOffsetDays >= 0 && todayOffsetDays <= calendarSpanDays + 1

  const activeMilestones = scheduleMilestones
    .filter(m => milestoneCalOffset[m.id] !== undefined)
    .sort((a, b) => (milestoneCalOffset[a.id] ?? 0) - (milestoneCalOffset[b.id] ?? 0))

  // Packing greedy multi-fila para chips de hito: usa ancho estimado real.
  const CHIP_ROW_H = 26
  const CHIP_GAP_PX = 6
  const milestoneRow: Record<string, number> = {}
  const milestoneLeftPx: Record<string, number> = {}
  const rowLastRight: number[] = []
  for (const m of activeMilestones) {
    const px = toLeftPx(milestoneCalOffset[m.id])
    const w  = estimateChipWidthPx(m.nombre)
    milestoneLeftPx[m.id] = px
    let row = 0
    while (rowLastRight[row] !== undefined && rowLastRight[row] + CHIP_GAP_PX > px) row++
    milestoneRow[m.id] = row
    rowLastRight[row] = px + w
  }
  const milestoneRowsUsed = Math.max(1, rowLastRight.length)
  const milestoneStripH = activeMilestones.length > 0
    ? milestoneRowsUsed * CHIP_ROW_H + 12  // padding inferior para el conector
    : 0

  const monthHeaderH = 22
  const weekHeaderH  = 22
  const totalTopHeaderH = milestoneStripH + monthHeaderH + weekHeaderH

  // Z-INDEX MAP:
  //  8 = corner intersection (sticky-top + sticky-left)
  //  7 = sticky-top headers (right side)
  //  6 = sticky-left chapter row (color background)
  //  5 = sticky-left phase row (white background) — DEBE estar por encima de las barras
  //  3 = milestone circles at end of bar (deben verse sobre la barra)
  //  2 = bar
  //  1 = milestone vertical lines and grid (inside bar area)
  //  0 = bar area background

  return (
    <div style={{
      position: 'relative',
      overflow: 'auto',
      maxHeight: containerMaxH,
      border: '1px solid #E8E6E0',
      borderRadius: 8,
      background: '#fff',
    }}>
      <div style={{ minWidth: leftColW + timelineWidthPx, fontFamily: 'Inter, sans-serif' }}>

        {/* ── Milestone strip (sticky-top) ── */}
        {activeMilestones.length > 0 && (
          <div style={{
            display: 'flex',
            position: 'sticky', top: 0, zIndex: 7,
            background: '#fff',
            borderBottom: '1px solid #F0EEE8',
          }}>
            <div style={{
              width: leftColW, flexShrink: 0,
              position: 'sticky', left: 0, zIndex: 8,
              background: '#fff',
              borderRight: '1px solid #E8E6E0',
              boxShadow: '2px 0 4px -2px rgba(0,0,0,0.06)',
              padding: '8px 14px',
              display: 'flex', alignItems: 'flex-start',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA',
            }}>
              Hitos del proyecto
            </div>
            <div style={{ width: timelineWidthPx, position: 'relative', height: milestoneStripH }}>
              {activeMilestones.map(m => {
                const px = milestoneLeftPx[m.id]
                const row = milestoneRow[m.id]
                const chipTop = 6 + row * CHIP_ROW_H
                const chipBottom = chipTop + 20
                return (
                  <React.Fragment key={m.id}>
                    {/* Conector vertical desde el chip hasta abajo */}
                    <div style={{
                      position: 'absolute',
                      left: px,
                      top: chipBottom,
                      height: milestoneStripH - chipBottom,
                      borderLeft: '1px solid #D85A30',
                      pointerEvents: 'none',
                    }} />
                    {/* Punto en el inicio del chip (ancla a la fecha exacta) */}
                    <div style={{
                      position: 'absolute',
                      left: px - 4, top: chipTop + 6,
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#D85A30',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }} />
                    {/* Chip */}
                    <div
                      onMouseEnter={handleHover([
                        `Hito: ${m.nombre}`,
                        `Fecha: ${formatScheduleDate(milestoneEndDate[m.id])}`,
                      ])}
                      onMouseMove={handleMove}
                      onMouseLeave={clearHover}
                      style={{
                        position: 'absolute',
                        left: px + 6,
                        top: chipTop,
                        background: '#FFF7F0', color: '#D85A30',
                        border: '1px solid #FED7AA', borderRadius: 4,
                        padding: '2px 9px',
                        fontSize: 11, fontWeight: 600, lineHeight: '16px',
                        whiteSpace: 'nowrap',
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        cursor: 'default',
                      }}
                    >
                      {m.nombre}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Month header (sticky-top) ── */}
        <div style={{
          display: 'flex',
          position: 'sticky', top: milestoneStripH, zIndex: 7,
          background: '#FAFAF8',
          borderBottom: '1px solid #E8E6E0',
        }}>
          <div style={{
            width: leftColW, flexShrink: 0,
            position: 'sticky', left: 0, zIndex: 8,
            background: '#FAFAF8',
            borderRight: '1px solid #E8E6E0',
            boxShadow: '2px 0 4px -2px rgba(0,0,0,0.06)',
            padding: '0 14px',
            display: 'flex', alignItems: 'center',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888',
            height: monthHeaderH,
          }}>
            Calendario
          </div>
          <div style={{ width: timelineWidthPx, position: 'relative', height: monthHeaderH }}>
            {/* Etiqueta del mes (rellena el segmento) */}
            {monthMarkers.map((mm, i) => (
              <div key={`lbl-${i}`} style={{
                position: 'absolute',
                left: toLeftPx(mm.calOffset),
                width: toWidthPx(mm.widthDays),
                top: 0, bottom: 0,
                display: 'flex', alignItems: 'center',
                paddingLeft: 6,
                fontSize: 11, fontWeight: 600, color: '#555',
                overflow: 'hidden', whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {mm.label}
              </div>
            ))}
            {/* Marcador "1" en el día 1 real de cada mes (línea vertical + número) */}
            {monthMarkers.map((mm, i) => {
              if (mm.day1Offset == null) return null
              return (
                <React.Fragment key={`d1-${i}`}>
                  <div style={{
                    position: 'absolute',
                    left: toLeftPx(mm.day1Offset),
                    top: 0, bottom: 0,
                    borderLeft: '1px solid #C9C5BD',
                    pointerEvents: 'none',
                  }} />
                  <span style={{
                    position: 'absolute',
                    left: toLeftPx(mm.day1Offset) + 2,
                    top: 2,
                    fontSize: 8, fontWeight: 700, color: '#888',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}>1</span>
                </React.Fragment>
              )
            })}
            {/* Línea roja del día de hoy */}
            {todayInRange && (
              <>
                <div style={{
                  position: 'absolute',
                  left: toLeftPx(todayOffsetDays),
                  top: 0, bottom: 0,
                  borderLeft: '2px solid #DC2626',
                  pointerEvents: 'none',
                  zIndex: 1,
                }} />
                <div style={{
                  position: 'absolute',
                  left: toLeftPx(todayOffsetDays) - 18,
                  top: 2,
                  background: '#DC2626',
                  color: '#fff',
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 5px',
                  borderRadius: 3,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}>HOY</div>
              </>
            )}
          </div>
        </div>

        {/* ── Week header (sticky-top) ── */}
        <div style={{
          display: 'flex',
          position: 'sticky', top: milestoneStripH + monthHeaderH, zIndex: 7,
          background: '#fff',
          borderBottom: '1px solid #E8E6E0',
        }}>
          <div style={{
            width: leftColW, flexShrink: 0,
            position: 'sticky', left: 0, zIndex: 8,
            background: '#fff',
            borderRight: '1px solid #E8E6E0',
            boxShadow: '2px 0 4px -2px rgba(0,0,0,0.06)',
            padding: '0 14px',
            display: 'flex', alignItems: 'center',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA',
            height: weekHeaderH,
          }}>
            Capítulo / Fase
          </div>
          <div style={{ width: timelineWidthPx, position: 'relative', height: weekHeaderH }}>
            {weekMarkers.map(wm => (
              <div key={wm.week} style={{
                position: 'absolute', left: toLeftPx(wm.calOffset),
                top: 0, bottom: 0, paddingLeft: 4,
                borderLeft: wm.week === 0 ? 'none' : '1px solid #F0EEE8',
                display: 'flex', alignItems: 'center',
              }}>
                <span style={{ fontSize: 10, color: '#AAA', whiteSpace: 'nowrap' }}>
                  {wm.week === 0 ? 'Inicio' : `S${wm.week}`}
                </span>
              </div>
            ))}
            {activeMilestones.map(m => (
              <div key={m.id} style={{
                position: 'absolute', left: toLeftPx(milestoneCalOffset[m.id]),
                top: 0, bottom: 0,
                borderLeft: '1px dashed #D85A30', opacity: 0.6,
                pointerEvents: 'none',
              }} />
            ))}
            {/* Línea roja del día de hoy */}
            {todayInRange && (
              <div style={{
                position: 'absolute',
                left: toLeftPx(todayOffsetDays),
                top: 0, bottom: 0,
                borderLeft: '2px solid #DC2626',
                pointerEvents: 'none',
                zIndex: 1,
              }} />
            )}
          </div>
        </div>

        {/* ── Chapters and phases (body) ── */}
        <div style={{ paddingTop: 6, paddingBottom: 6 }}>
        {scheduleChapters.map((ch, ci) => {
          const color = GANTT_COLORS[ci % GANTT_COLORS.length]
          const phases = [...ch.phases].sort((a, b) => a.orden - b.orden)
          if (phases.length === 0) return null

          return (
            <div key={ch.id} style={{ marginBottom: 10 }}>
              {/* Chapter header row */}
              <div style={{ display: 'flex', alignItems: 'stretch', height: chapterRowH, marginBottom: 3 }}>
                <div style={{
                  width: leftColW, flexShrink: 0,
                  position: 'sticky', left: 0, zIndex: 6,
                  background: color, color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '0 14px',
                  display: 'flex', alignItems: 'center', overflow: 'hidden',
                  borderRight: `2px solid ${color}`,
                  boxShadow: '2px 0 4px -2px rgba(0,0,0,0.06)',
                }}>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {ch.nombre}
                  </span>
                </div>
                <div style={{
                  width: timelineWidthPx,
                  background: color, opacity: 0.12,
                  position: 'relative',
                }}>
                  {activeMilestones.map(m => (
                    <div key={m.id} style={{
                      position: 'absolute', left: toLeftPx(milestoneCalOffset[m.id]),
                      top: 0, bottom: 0,
                      borderLeft: '1px dashed #D85A30', opacity: 0.7,
                      pointerEvents: 'none',
                    }} />
                  ))}
                  {todayInRange && (
                    <div style={{
                      position: 'absolute', left: toLeftPx(todayOffsetDays),
                      top: 0, bottom: 0,
                      borderLeft: '2px solid #DC2626', opacity: 0.7,
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
              </div>

              {/* Phase rows */}
              {phases.map(ph => {
                const entry = schedule[ph.id]
                if (!entry) return null
                const startCal = calOffset(entry.startDate)
                const endCal   = calOffset(entry.endDate)
                const calWidth = Math.max(0, endCal - startCal)
                const durD     = entry.durationDays
                const achievesPairs = ph.achieves
                  .map(mid => scheduleMilestones.find(mm => mm.id === mid))
                  .filter((m): m is ScheduleMilestone => !!m)
                const requiresNames = ph.requires
                  .map(mid => scheduleMilestones.find(m => m.id === mid)?.nombre)
                  .filter((n): n is string => !!n)

                const tooltipLines: string[] = [
                  ph.nombre,
                  `${formatScheduleDate(entry.startDate)} → ${formatScheduleDate(entry.endDate)}`,
                  `${Math.round(durD)} días laborables`,
                  achievesPairs.length ? `Logra: ${achievesPairs.map(m => m.nombre).join(', ')}` : '',
                  requiresNames.length ? `Requiere: ${requiresNames.join(', ')}` : '',
                ].filter(Boolean)

                const barH = Math.min(rowH - 10, 24)
                const showLabelInside = toWidthPx(calWidth) >= 60

                return (
                  <div key={ph.id} style={{ display: 'flex', alignItems: 'stretch', height: rowH, marginBottom: 2 }}>
                    {/* Phase name (sticky-left) */}
                    <div
                      onMouseEnter={handleHover(tooltipLines)}
                      onMouseMove={handleMove}
                      onMouseLeave={clearHover}
                      style={{
                        width: leftColW, flexShrink: 0,
                        position: 'sticky', left: 0, zIndex: 5,
                        background: '#fff',
                        paddingLeft: 16, paddingRight: 10,
                        fontSize: 12.5, color: '#333', lineHeight: 1.3,
                        display: 'flex', alignItems: 'center', gap: 7,
                        borderRight: '1px solid #E8E6E0',
                        boxShadow: '2px 0 4px -2px rgba(0,0,0,0.06)',
                        cursor: 'default',
                      }}
                    >
                      {requiresNames.length > 0 && (
                        <span style={{
                          color: '#DC2626', fontSize: 10, flexShrink: 0,
                        }}>▶</span>
                      )}
                      <span style={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word',
                      }}>
                        {ph.nombre}
                      </span>
                    </div>

                    {/* Bar area */}
                    <div style={{
                      width: timelineWidthPx, position: 'relative',
                      background: '#FAFAF8',
                      borderBottom: '1px solid #F4F2EC',
                    }}>
                      {/* Week grid lines */}
                      {weekMarkers.filter(wm => wm.week > 0).map(wm => (
                        <div key={wm.week} style={{
                          position: 'absolute', left: toLeftPx(wm.calOffset),
                          top: 0, bottom: 0,
                          borderLeft: '1px solid #F0EEE8',
                          pointerEvents: 'none',
                        }} />
                      ))}

                      {/* Milestone vertical lines */}
                      {activeMilestones.map(m => (
                        <div key={m.id} style={{
                          position: 'absolute', left: toLeftPx(milestoneCalOffset[m.id]),
                          top: 0, bottom: 0,
                          borderLeft: '1px dashed #D85A30', opacity: 0.35,
                          pointerEvents: 'none', zIndex: 1,
                        }} />
                      ))}

                      {/* Línea roja del día de hoy */}
                      {todayInRange && (
                        <div style={{
                          position: 'absolute', left: toLeftPx(todayOffsetDays),
                          top: 0, bottom: 0,
                          borderLeft: '2px solid #DC2626', opacity: 0.7,
                          pointerEvents: 'none', zIndex: 3,
                        }} />
                      )}

                      {/* Bar */}
                      <div
                        onMouseEnter={handleHover(tooltipLines)}
                        onMouseMove={handleMove}
                        onMouseLeave={clearHover}
                        style={{
                          position: 'absolute',
                          left: toLeftPx(startCal),
                          width: toWidthPx(calWidth),
                          top: '50%', transform: 'translateY(-50%)',
                          height: barH,
                          background: color,
                          borderRadius: 4,
                          zIndex: 2,
                          cursor: 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                          paddingLeft: 8, paddingRight: 8,
                          color: '#fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        {showLabelInside && (
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {Math.round(durD)} DL
                          </span>
                        )}
                      </div>

                      {/* Círculos de hito al final de la barra (uno por cada hito que logra) */}
                      {achievesPairs.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          left: toLeftPx(endCal),
                          top: '50%', transform: 'translate(-50%, -50%)',
                          display: 'flex', alignItems: 'center', gap: 3,
                          zIndex: 4, pointerEvents: 'auto',
                        }}>
                          {achievesPairs.map(m => (
                            <div
                              key={m.id}
                              onMouseEnter={handleHover([
                                `Logra hito: ${m.nombre}`,
                                `Fecha: ${formatScheduleDate(entry.endDate)}`,
                              ])}
                              onMouseMove={handleMove}
                              onMouseLeave={clearHover}
                              style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: '#fff',
                                border: '2.5px solid #D85A30',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                cursor: 'default',
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        </div>
      </div>

      {/* Tooltip flotante — sigue al cursor, sin delay, renderiza unicode bien */}
      {hover && (
        <div style={{
          position: 'fixed',
          left: hover.x + 14,
          top: hover.y + 14,
          zIndex: 10000,
          background: 'rgba(26,26,26,0.96)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.5,
          maxWidth: 320,
          pointerEvents: 'none',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          whiteSpace: 'pre-wrap',
        }}>
          {hover.lines.map((line, i) => (
            <div key={i} style={{
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? '#fff' : '#D8D6D2',
              marginTop: i > 0 ? 2 : 0,
            }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────

function ScheduleTab({
  projectId,
  projectName,
  projectDireccion,
  projectCiudad,
  scheduleChapters,
  scheduleMilestones,
  initialFechaInicio,
  m2,
  duracionFactor,
  chapterDaysOverrides,
  onResetOverrides,
  labelStyle,
  inputStyle,
  btnStyle,
}: {
  projectId: string
  projectName: string
  projectDireccion: string | null
  projectCiudad: string | null
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  initialFechaInicio: string | null
  m2: number | null
  duracionFactor: number
  chapterDaysOverrides: Record<string, number | null>
  onResetOverrides: () => void
  labelStyle: React.CSSProperties
  inputStyle: React.CSSProperties
  btnStyle: (primary?: boolean) => React.CSSProperties
}) {
  const [fechaInicio, setFechaInicio] = useState(initialFechaInicio ?? '')
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resetting, setResetting] = useState(false)

  // Controles de visualización
  const [dayPx, setDayPx]           = useState(14)  // 6–32 px por día calendario
  const [rowH, setRowH]             = useState(36)  // 26–60 px por fila de fase
  const [containerH, setContainerH] = useState(560) // 360–1000 px alto del contenedor con scroll
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingPlanning, setExportingPlanning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 900)

  // Fullscreen: cierre con Esc + bloqueo de scroll del body mientras está abierto.
  // También trackeamos el viewport height para que el Gantt llene la pantalla en fullscreen.
  useEffect(() => {
    if (!isFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    const onResize = () => setViewportH(window.innerHeight)
    onResize()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [isFullscreen])

  const chapterRowH = Math.max(26, Math.round(rowH * 0.75))

  const handleExportPdf = async () => {
    if (!schedule || !fechaInicio) return
    setExportingPdf(true)
    try {
      const res = await fetch(`/api/fpe-projects/${projectId}/cronograma-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          fechaInicio,
          m2,
          scheduleChapters,
          scheduleMilestones,
          chapterDaysOverrides,
          duracionFactor,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error generando PDF' }))
        alert(err.error ?? 'Error generando PDF')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportPlanning = async () => {
    if (!schedule || !fechaInicio) return
    setExportingPlanning(true)
    try {
      const res = await fetch(`/api/fpe-projects/${projectId}/planning-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          direccion: projectDireccion,
          ciudad: projectCiudad,
          fechaInicio,
          m2,
          scheduleChapters,
          scheduleMilestones,
          chapterDaysOverrides,
          duracionFactor,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error generando planning' }))
        alert(err.error ?? 'Error generando planning')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando planning')
    } finally {
      setExportingPlanning(false)
    }
  }

  const hasSavedParams = !!initialFechaInicio || Object.values(chapterDaysOverrides).some(v => v != null)

  const handleReset = async () => {
    if (!confirm('¿Reiniciar el cronograma? Se borrará la fecha de inicio y los overrides de días por capítulo. Esta acción no se puede deshacer.')) return
    setResetting(true)
    setSaveMsg(null)
    const res = await resetProjectSchedule(projectId)
    setResetting(false)
    if ('error' in res) {
      setSaveMsg({ ok: false, text: res.error })
      return
    }
    setFechaInicio('')
    onResetOverrides()
    setSaveMsg({ ok: true, text: 'Cronograma reiniciado' })
    setTimeout(() => setSaveMsg(null), 2500)
  }

  const schedule = useMemo(() => {
    if (!fechaInicio) return null
    return computeParametricSchedule(
      scheduleChapters,
      new Date(fechaInicio),
      m2,
      chapterDaysOverrides,
      duracionFactor,
    )
  }, [fechaInicio, scheduleChapters, m2, chapterDaysOverrides, duracionFactor])

  // Auto-save fecha de inicio al perder foco
  const handleFechaBlur = async () => {
    setSaveMsg(null)
    const res = await saveProjectSchedule(projectId, {
      fecha_inicio_obra: fechaInicio || null,
    })
    if ('error' in res) setSaveMsg({ ok: false, text: res.error })
    else { setSaveMsg({ ok: true, text: 'Fecha guardada' }); setTimeout(() => setSaveMsg(null), 2000) }
  }

  const hasScope = scheduleChapters.length > 0
  const totalDays = schedule?.totalDays ?? 0
  const totalWeeks = totalDays > 0 ? (totalDays / 5).toFixed(1) : null  // semanas laborables = 5 días
  const endDate = totalDays > 0 && fechaInicio
    ? addBusinessDays(snapToNextBusinessDay(new Date(fechaInicio)), Math.round(totalDays))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Inputs */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 16px' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
            Parámetros del cronograma
          </p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || !hasSavedParams}
            style={{
              ...btnStyle(false),
              fontSize: 11,
              padding: '6px 12px',
              color: hasSavedParams && !resetting ? '#DC2626' : '#BBB',
              borderColor: hasSavedParams && !resetting ? '#FCA5A5' : '#E8E6E0',
              cursor: hasSavedParams && !resetting ? 'pointer' : 'not-allowed',
            }}
            title={hasSavedParams ? 'Borrar fecha de inicio y overrides de días' : 'No hay parámetros guardados'}
          >
            {resetting ? 'Reiniciando…' : 'Reiniciar cronograma'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Fecha de inicio de obra</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} onBlur={handleFechaBlur} style={inputStyle} />
            {saveMsg && <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: saveMsg.ok ? '#059669' : '#DC2626', fontWeight: 500 }}>{saveMsg.text}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Estimación</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, color: '#888' }}>m²: <strong style={{ color: '#1A1A1A' }}>{m2 ?? '—'}</strong></span>
              <span style={{ fontSize: 11, color: '#888' }}>
                Duración total: <strong style={{ color: '#D85A30' }}>{totalDays > 0 ? `${Math.round(totalDays)} días laborables (${totalWeeks} sem)` : '—'}</strong>
              </span>
              {endDate && (
                <span style={{ fontSize: 11, color: '#888' }}>
                  Fin estimado: <strong style={{ color: '#1A1A1A' }}>{formatScheduleDate(endDate)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* No scope warning */}
      {!hasScope && (
        <div style={{ background: '#FFF7F0', border: '1px solid #FED7AA', borderRadius: 8, padding: '14px 18px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
            Define primero el scope del proyecto. La duración de cada capítulo se calcula con los <strong>días laborables estimados</strong> configurados en la plantilla, interpolados según los m² del proyecto.
          </p>
        </div>
      )}

      {/* Schedule preview */}
      {hasScope && !schedule && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#BBB', background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 6 }}>Introduce la fecha de inicio</p>
          <p style={{ fontSize: 12, margin: 0 }}>Con la fecha de inicio el sistema calcula automáticamente todas las fases.</p>
        </div>
      )}

      {schedule && totalDays > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 240 }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
                Cronograma paramétrico
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#888' }}>
                Estimación en <strong>días laborables</strong> (Lun-Vie sin festivos), interpolada por m². El eje muestra el calendario real — los huecos en las barras son fines de semana y festivos.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                style={{
                  ...btnStyle(false),
                  fontSize: 12,
                  padding: '8px 14px',
                }}
                title="Ver el Gantt a pantalla completa (Esc para salir)"
              >
                ⛶ Pantalla completa
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                style={{
                  ...btnStyle(false),
                  fontSize: 12,
                  padding: '8px 16px',
                  cursor: exportingPdf ? 'wait' : 'pointer',
                }}
                title="Exportar el cronograma a PDF horizontal brandeado (A3, o A2 si la densidad lo requiere)"
              >
                {exportingPdf ? 'Generando…' : '⬇ Exportar PDF'}
              </button>
              <button
                type="button"
                onClick={handleExportPlanning}
                disabled={exportingPlanning}
                style={{
                  ...btnStyle(true),
                  fontSize: 12,
                  padding: '8px 16px',
                  cursor: exportingPlanning ? 'wait' : 'pointer',
                }}
                title="Generar un documento corporativo narrativo del planning, con redacción profesional, hitos y ruta crítica"
              >
                {exportingPlanning ? 'Redactando planning…' : '📄 Exportar planning'}
              </button>
            </div>
          </div>

          {/* Toolbar de visualización */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 24,
            background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
            padding: '12px 18px',
            alignItems: 'center',
          }}>
            <ZoomSlider
              label="Densidad horizontal"
              hint={`${dayPx}px/día`}
              min={6} max={32} step={1}
              value={dayPx} onChange={setDayPx}
            />
            <ZoomSlider
              label="Aire vertical"
              hint={`${rowH}px/fila`}
              min={26} max={60} step={2}
              value={rowH} onChange={setRowH}
            />
            <ZoomSlider
              label="Alto del Gantt"
              hint={`${containerH}px`}
              min={360} max={1000} step={20}
              value={containerH} onChange={setContainerH}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#888' }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                  background: '#fff', border: '2px solid #D85A30',
                }} />
                logra hito (hover)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#888' }}>
                <span style={{ color: '#DC2626', fontSize: 10 }}>▶</span>
                requiere hito previo
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#888' }}>
                <span style={{ width: 18, borderTop: '1px dashed #D85A30', display: 'inline-block' }} />
                fecha del hito
              </span>
            </div>
          </div>

          {!isFullscreen && (
            <GanttChart
              scheduleChapters={scheduleChapters}
              scheduleMilestones={scheduleMilestones}
              schedule={schedule.phases}
              fechaInicio={fechaInicio}
              totalBusinessDays={totalDays}
              leftColW={300}
              dayPx={dayPx}
              rowH={rowH}
              chapterRowH={chapterRowH}
              containerMaxH={containerH}
            />
          )}
        </div>
      )}

      {/* Overlay fullscreen del Gantt */}
      {isFullscreen && schedule && totalDays > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#fff',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #E8E6E0',
            background: '#FAFAF8',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
                Cronograma · pantalla completa
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                {projectName}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ZoomSlider label="Densidad" hint={`${dayPx}px/día`} min={6} max={32} step={1} value={dayPx} onChange={setDayPx} />
              <ZoomSlider label="Aire vertical" hint={`${rowH}px/fila`} min={26} max={60} step={2} value={rowH} onChange={setRowH} />
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                style={{ ...btnStyle(false), fontSize: 12, padding: '8px 14px' }}
                title="Cerrar (Esc)"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'hidden' }}>
            <GanttChart
              scheduleChapters={scheduleChapters}
              scheduleMilestones={scheduleMilestones}
              schedule={schedule.phases}
              fechaInicio={fechaInicio}
              totalBusinessDays={totalDays}
              leftColW={300}
              dayPx={dayPx}
              rowH={rowH}
              chapterRowH={chapterRowH}
              containerMaxH={Math.max(360, viewportH - 110)}
            />
          </div>
        </div>
      )}

      {schedule && totalDays === 0 && hasScope && (
        <div style={{ background: '#FFF7F0', border: '1px solid #FED7AA', borderRadius: 8, padding: '14px 18px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
            Los capítulos en scope no tienen días laborables configurados en la plantilla. Ve a <strong>FP Execution → Plantilla</strong> y rellena los días laborables mín/máx de cada capítulo.
          </p>
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
  initialObraStartOverride = null,
  initialM2,
  initialChapterDaysOverrides,
  initialDuracionFactor = 1.0,
  disciplines,
  chapterSettingsMap,
  memoriaUnitIds = [],
  obraStartedAt = null,
  obraBaselineSnapshot = null,
  obraPhases = [],
  obraMilestones = [],
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
  initialObraStartOverride?: string | null
  initialM2: number | null
  initialChapterDaysOverrides: Record<string, number | null>
  initialDuracionFactor?: number
  disciplines: FpeDiscipline[]
  chapterSettingsMap: Record<string, string | null>
  memoriaUnitIds?: string[]
  /** Si está set, la gestión de obra está activada. Habilita la 2ª top-tab. */
  obraStartedAt?:        string | null
  obraBaselineSnapshot?: ObraBaselineSnapshot | null
  obraPhases?:           ObraPhase[]
  obraMilestones?:       ObraMilestone[]
}) {
  const [project, setProject] = useState<Project>(initialProject)
  const [scope, setScope] = useState<ScopeState>(() =>
    buildInitialScope(chapters, initialProject.project_units)
  )
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editingProject, setEditingProject] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scope' | 'docs' | 'schedule' | 'invitations' | 'bidding' | 'dreamteam'>('dashboard')
  // Top-level phase: 'licitacion' (los 7 tabs actuales) vs 'obra' (gestión de obra).
  // Si la obra ya está activada, arrancamos directamente en ese modo.
  const obraEnabled = !!obraStartedAt
  const [topTab, setTopTab] = useState<'licitacion' | 'obra'>(obraEnabled ? 'obra' : 'licitacion')
  const [chapterDaysOverrides, setChapterDaysOverrides] = useState<Record<string, number | null>>(initialChapterDaysOverrides)
  const [duracionFactor, setDuracionFactor] = useState<number>(initialDuracionFactor)

  // Build a unit name lookup from template chapters
  const unitNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const ch of chapters) for (const u of ch.units) m[u.id] = u.nombre
    return m
  }, [chapters])

  // Derive enriched project units for TenderPanel from scopedChapters
  // (with chapter info + principal discipline for partner filtering)
  const enrichedProjectUnits = useMemo(
    () => scopedChapters.flatMap(ch => {
      const chMeta = chapters.find(c => c.id === ch.id)
      return ch.units.map(u => ({
        id:                      u.project_unit_id,
        template_unit_id:        u.template_unit_id,
        nombre:                  u.nombre,
        chapter_id:              ch.id,
        chapter_nombre:          ch.nombre,
        chapter_orden:           chMeta?.orden ?? 0,
        principal_discipline_id: u.principal_discipline_id,
      }))
    }),
    [scopedChapters, chapters]
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
              <button onClick={() => setEditingProject(true)} style={S.btn()}>Editar proyecto</button>
            </div>
          </div>

          {/* Top-level phase tabs: Licitación de obra ↔ Gestión de obra */}
          <div style={{
            display: 'flex', gap: 6, marginTop: 18,
            background: '#F0EEE8', borderRadius: 10, padding: 4,
            width: 'fit-content',
          }}>
            <PhaseTabBtn
              label="Licitación de obra"
              active={topTab === 'licitacion'}
              onClick={() => setTopTab('licitacion')}
            />
            <PhaseTabBtn
              label="Gestión de obra"
              active={topTab === 'obra'}
              disabled={!obraEnabled}
              tooltip={!obraEnabled ? 'Activa la gestión de obra desde Dream Team' : undefined}
              onClick={() => obraEnabled && setTopTab('obra')}
            />
          </div>

          {/* Sub-tabs de licitación (solo si topTab === 'licitacion') */}
          {topTab === 'licitacion' && (
            <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '1px solid #E8E6E0', marginBottom: -1 }}>
              <button style={tabStyle(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
              <button style={tabStyle(activeTab === 'scope')} onClick={() => setActiveTab('scope')}>Scope</button>
              <button style={tabStyle(activeTab === 'docs')} onClick={() => setActiveTab('docs')}>Documentos</button>
              <button style={tabStyle(activeTab === 'schedule')} onClick={() => setActiveTab('schedule')}>Cronograma</button>
              <button style={tabStyle(activeTab === 'invitations')} onClick={() => setActiveTab('invitations')}>Invitaciones</button>
              <button style={tabStyle(activeTab === 'bidding')} onClick={() => setActiveTab('bidding')}>Licitación</button>
              <button style={tabStyle(activeTab === 'dreamteam')} onClick={() => setActiveTab('dreamteam')}>Dream Team</button>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>

        {/* ── Gestión de obra (top-tab) ── */}
        {topTab === 'obra' && obraEnabled && obraStartedAt && (
          <ObraManagementPage
            projectId={project.id}
            obraStartedAt={obraStartedAt}
            baselineSnapshot={obraBaselineSnapshot}
            phases={obraPhases}
            milestones={obraMilestones}
            chapterNames={Object.fromEntries(chapters.map(ch => [ch.id, ch.nombre]))}
          />
        )}

        {/* ── Licitación de obra (top-tab) — agrupa los 7 tabs actuales ── */}
        {topTab === 'licitacion' && (
        <>
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
                {scheduleChapters.length > 0 && (
                  <DuracionFactorBar
                    projectId={project.id}
                    factor={duracionFactor}
                    onFactorChange={setDuracionFactor}
                    scheduleChapters={scheduleChapters}
                    m2={project.m2_construccion}
                    chapterDaysOverrides={chapterDaysOverrides}
                  />
                )}
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

                      {/* Days cell (interpolation + override) — visible only if at least one unit included */}
                      {someIncluded && (
                        <ChapterDaysCell
                          projectId={project.id}
                          chapter={chapter}
                          m2={project.m2_construccion}
                          factor={duracionFactor}
                          currentOverride={chapterDaysOverrides[chapter.id] ?? null}
                          onOverrideChange={(chId, val) => setChapterDaysOverrides(prev => ({ ...prev, [chId]: val }))}
                        />
                      )}

                      {/* Units */}
                      {chUnits.map(unit => (
                        <UnitScopeRow
                          key={unit.id}
                          unit={unit}
                          scope={scope[unit.id] ?? { included: false, notas: '' }}
                          onToggle={handleToggle}
                          onNotasChange={handleNotasChange}
                          hasMem={memoriaUnitIds.includes(unit.id)}
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
            projectName={project.nombre}
            projectDireccion={project.direccion}
            projectCiudad={project.ciudad}
            scheduleChapters={scheduleChapters}
            scheduleMilestones={scheduleMilestones}
            initialFechaInicio={initialFechaInicio}
            m2={project.m2_construccion}
            duracionFactor={duracionFactor}
            chapterDaysOverrides={chapterDaysOverrides}
            onResetOverrides={() => setChapterDaysOverrides({})}
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

        {/* ── Invitations tab (formerly "Licitación") ── */}
        {activeTab === 'invitations' && (
          <TenderPanel
            projectId={project.id}
            projectUnits={enrichedProjectUnits}
            initialUnitPartners={initialUnitPartners}
            initialTender={initialTender}
            partners={partners}
            initialProjectStatus={project.status}
            onNavigateToBidding={() => setActiveTab('bidding')}
          />
        )}

        {/* ── Bidding tab (new "Licitación" — comparativa + Q&A) ── */}
        {activeTab === 'bidding' && (
          <BiddingPanel
            projectId={project.id}
            tender={initialTender}
            onGoToInvitations={() => setActiveTab('invitations')}
            onGoToDreamTeam={() => setActiveTab('dreamteam')}
          />
        )}

        {/* ── Dream Team tab (formerly "Adjudicación") ── */}
        {activeTab === 'dreamteam' && (
          <DreamTeamPanel
            projectId={project.id}
            scheduleChapters={scheduleChapters}
            scheduleMilestones={scheduleMilestones}
            fechaInicioParametrica={initialFechaInicio}
            initialObraStartOverride={initialObraStartOverride}
            m2={project.m2_construccion}
            chapterDaysOverrides={chapterDaysOverrides}
            duracionFactor={duracionFactor}
            obraStartedAt={obraStartedAt}
            onObraStarted={() => setTopTab('obra')}
          />
        )}
        </>
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

// ── Phase tab button (Licitación de obra / Gestión de obra) ───────────────────
function PhaseTabBtn({
  label, active, disabled, tooltip, onClick,
}: {
  label:    string
  active:   boolean
  disabled?: boolean
  tooltip?:  string
  onClick:   () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        padding: '8px 18px', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.02em',
        borderRadius: 7, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        background: active   ? '#1A1A1A' : 'transparent',
        color:      active   ? '#fff'    : (disabled ? '#BBB' : '#666'),
        opacity:    disabled ? 0.6       : 1,
        boxShadow:  active   ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
        transition: 'all 120ms ease',
      }}
    >
      {label}
    </button>
  )
}

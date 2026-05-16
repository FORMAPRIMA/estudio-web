'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ObraBaselineSnapshot, ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'
import ObraGantt from '@/components/team/fp-execution/obra/ObraGantt'
import ObraPhaseEditor from '@/components/team/fp-execution/obra/ObraPhaseEditor'

export default function ObraDashboardTab({
  projectId: _projectId,
  obraStartedAt,
  baselineSnapshot,
  phases,
  milestones,
  chapterNames,
}: {
  projectId:        string
  obraStartedAt:    string
  baselineSnapshot: ObraBaselineSnapshot | null
  phases:           ObraPhase[]
  milestones:       ObraMilestone[]
  chapterNames:     Record<string, string>
}) {
  const router = useRouter()
  const [shadowVisible, setShadowVisible] = useState(true)
  const [dayPx, setDayPx]                 = useState(6)
  const [rowH, setRowH]                   = useState(30)
  const [containerH, setContainerH]       = useState(560)
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)

  const editingPhase = useMemo(
    () => phases.find(p => p.id === editingPhaseId) ?? null,
    [phases, editingPhaseId]
  )

  // KPIs
  const totalPhases     = phases.length
  const completedPhases = phases.filter(p => p.status === 'completada').length
  const enCursoPhases   = phases.filter(p => p.status === 'en_curso').length
  const blockedPhases   = phases.filter(p => p.status === 'bloqueada').length
  const avgProgress     = phases.length > 0
    ? Math.round(phases.reduce((a, p) => a + p.pct_avance, 0) / phases.length)
    : 0
  const achievedMs      = milestones.filter(m => m.actual_date).length

  const startedLabel = new Date(obraStartedAt).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Hero KPIs */}
      <div style={{
        background: '#1A1A1A', borderRadius: 10, padding: '18px 22px',
        display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Obra en gestión
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4 }}>
            Día {Math.max(1, Math.floor((Date.now() - new Date(obraStartedAt).getTime()) / 86400000) + 1)}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            Activada el {startedLabel}
          </div>
        </div>
        <KPI label="Avance medio"  value={`${avgProgress}%`} />
        <KPI label="Completadas"   value={`${completedPhases}/${totalPhases}`} />
        <KPI label="En curso"      value={`${enCursoPhases}`} />
        {blockedPhases > 0 && <KPI label="Bloqueadas" value={`${blockedPhases}`} accent="#FCA5A5" />}
        <KPI label="Hitos logrados" value={`${achievedMs}/${milestones.length}`} />
      </div>

      {/* Toolbar */}
      <div style={{
        background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
        padding: '12px 18px',
        display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#666', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={shadowVisible}
              onChange={e => setShadowVisible(e.target.checked)}
              style={{ marginRight: 6, accentColor: '#D85A30' }}
            />
            Mostrar plan original (shadow)
          </label>
        </div>

        <ZoomSlider label="Densidad horizontal" hint={`${dayPx}px/día`} min={2} max={24} step={1} value={dayPx} onChange={setDayPx} />
        <ZoomSlider label="Aire vertical"        hint={`${rowH}px/fila`} min={26} max={60} step={2} value={rowH}  onChange={setRowH} />
        <ZoomSlider label="Alto del Gantt"       hint={`${containerH}px`} min={360} max={1000} step={20} value={containerH} onChange={setContainerH} />
      </div>

      {/* Gantt */}
      <ObraGantt
        phases={phases}
        milestones={milestones}
        chapterNames={chapterNames}
        baselineSnapshot={baselineSnapshot}
        shadowVisible={shadowVisible}
        dayPx={dayPx}
        rowH={rowH}
        containerMaxH={containerH}
        onPhaseClick={setEditingPhaseId}
      />

      {/* Editor */}
      {editingPhase && (
        <ObraPhaseEditor
          phase={editingPhase}
          onClose={() => setEditingPhaseId(null)}
          onSaved={() => { setEditingPhaseId(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? '#fff', marginTop: 4, fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  )
}

function ZoomSlider({
  label, hint, min, max, step, value, onChange,
}: {
  label: string; hint: string; min: number; max: number; step: number
  value: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
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
        style={{ width: '100%', accentColor: '#D85A30', height: 4, cursor: 'pointer' }}
      />
    </div>
  )
}

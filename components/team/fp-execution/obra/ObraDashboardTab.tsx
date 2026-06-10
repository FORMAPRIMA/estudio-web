'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ObraBaselineSnapshot, ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'
import ObraGantt from '@/components/team/fp-execution/obra/ObraGantt'
import ObraPhasesTimeline from '@/components/team/fp-execution/obra/ObraPhasesTimeline'
import ObraPhaseEditor from '@/components/team/fp-execution/obra/ObraPhaseEditor'
import { setObraFechaInicio, marcarObraIniciada, revertirObraIniciada } from '@/app/actions/fpe-obra'

export default function ObraDashboardTab({
  projectId,
  obraStartedAt,
  obraFechaInicio,
  obraIniciadaAt,
  baselineSnapshot,
  phases,
  milestones,
  chapterNames,
  partnerNames,
}: {
  projectId:        string
  obraStartedAt:    string
  obraFechaInicio:  string | null
  obraIniciadaAt:   string | null
  baselineSnapshot: ObraBaselineSnapshot | null
  phases:           ObraPhase[]
  milestones:       ObraMilestone[]
  chapterNames:     Record<string, string>
  partnerNames:     Record<string, string>
}) {
  const router = useRouter()
  const [shadowVisible, setShadowVisible] = useState(true)
  const [dayPx, setDayPx]                 = useState(6)
  const [rowH, setRowH]                   = useState(30)
  const [containerH, setContainerH]       = useState(560)
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [ganttFullscreen, setGanttFullscreen] = useState(false)
  const [viewportH, setViewportH]         = useState(typeof window !== 'undefined' ? window.innerHeight : 900)

  // Fullscreen: cierre con Esc + bloqueo de scroll del body + tracking del viewport.
  useEffect(() => {
    if (!ganttFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setGanttFullscreen(false) }
    const onResize = () => setViewportH(window.innerHeight)
    onResize()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [ganttFullscreen])

  // Fecha de inicio (editable)
  const [fechaInput, setFechaInput] = useState<string>(obraFechaInicio ?? '')
  const [savingFecha, setSavingFecha] = useState(false)
  const [fechaErr, setFechaErr] = useState<string | null>(null)

  // Empezar / revertir obra
  const [togglingStart, setTogglingStart] = useState(false)
  const [startErr, setStartErr] = useState<string | null>(null)

  const editingPhase = useMemo(
    () => phases.find(p => p.id === editingPhaseId) ?? null,
    [phases, editingPhaseId]
  )

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalPhases     = phases.length
  const completedPhases = phases.filter(p => p.status === 'completada').length
  const enCursoPhases   = phases.filter(p => p.status === 'en_curso').length
  const blockedPhases   = phases.filter(p => p.status === 'bloqueada').length
  const avgProgress     = phases.length > 0
    ? Math.round(phases.reduce((a, p) => a + p.pct_avance, 0) / phases.length)
    : 0
  const achievedMs      = milestones.filter(m => m.actual_date).length

  // ── Estado temporal ────────────────────────────────────────────────────────
  const baseFechaInicio = obraFechaInicio ? new Date(obraFechaInicio + 'T00:00:00Z') : null
  const todayUTC = new Date(); const todayMs = Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())
  const daysToStart = baseFechaInicio ? Math.round((baseFechaInicio.getTime() - todayMs) / 86400000) : null
  const daysSinceStart = obraIniciadaAt
    ? Math.max(1, Math.floor((Date.now() - new Date(obraIniciadaAt).getTime()) / 86400000) + 1)
    : null

  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveFecha = async () => {
    if (!fechaInput || fechaInput === obraFechaInicio) return
    setSavingFecha(true); setFechaErr(null)
    const res = await setObraFechaInicio(projectId, fechaInput)
    setSavingFecha(false)
    if ('error' in res) { setFechaErr(res.error); return }
    router.refresh()
  }

  const handleEmpezarObra = async () => {
    setTogglingStart(true); setStartErr(null)
    const res = await marcarObraIniciada(projectId)
    setTogglingStart(false)
    if ('error' in res) { setStartErr(res.error); return }
    router.refresh()
  }

  const handleRevertirObra = async () => {
    if (!confirm('¿Revertir el inicio de obra? Esto solo desmarca el flag, no toca las fechas reales registradas en las fases.')) return
    setTogglingStart(true); setStartErr(null)
    const res = await revertirObraIniciada(projectId)
    setTogglingStart(false)
    if ('error' in res) { setStartErr(res.error); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero ── */}
      <div style={{
        background: '#1A1A1A', borderRadius: 10, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
      }}>
        {/* Estado temporal */}
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Estado de obra
          </div>
          {obraIniciadaAt ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#86EFAC', marginTop: 4 }}>
                Día {daysSinceStart}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                Iniciada el {fmt(new Date(obraIniciadaAt))}
              </div>
            </>
          ) : daysToStart !== null && daysToStart > 0 ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FDB874', marginTop: 4 }}>
                En {daysToStart} {daysToStart === 1 ? 'día' : 'días'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                Comienza el {baseFechaInicio ? fmt(baseFechaInicio) : '—'}
              </div>
            </>
          ) : daysToStart !== null && daysToStart <= 0 ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FCA5A5', marginTop: 4 }}>
                {daysToStart === 0 ? 'Hoy' : `${-daysToStart} ${-daysToStart === 1 ? 'día' : 'días'} retraso`}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                Previsto: {baseFechaInicio ? fmt(baseFechaInicio) : '—'} — sin iniciar
              </div>
            </>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4 }}>
              Sin fecha
            </div>
          )}
        </div>

        <KPI label="Avance medio"  value={`${avgProgress}%`} />
        <KPI label="Completadas"   value={`${completedPhases}/${totalPhases}`} />
        <KPI label="En curso"      value={`${enCursoPhases}`} />
        {blockedPhases > 0 && <KPI label="Bloqueadas" value={`${blockedPhases}`} accent="#FCA5A5" />}
        <KPI label="Hitos logrados" value={`${achievedMs}/${milestones.length}`} />

        {/* Acción principal: empezar / revertir */}
        <div style={{ marginLeft: 'auto' }}>
          {obraIniciadaAt ? (
            <button
              type="button"
              onClick={handleRevertirObra}
              disabled={togglingStart}
              style={{
                background: 'transparent', color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7,
                padding: '8px 14px', fontSize: 11, fontWeight: 600,
                cursor: togglingStart ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >Revertir inicio</button>
          ) : (
            <button
              type="button"
              onClick={handleEmpezarObra}
              disabled={togglingStart}
              style={{
                background: '#D85A30', color: '#fff', border: 'none', borderRadius: 7,
                padding: '10px 18px', fontSize: 12, fontWeight: 700,
                cursor: togglingStart ? 'wait' : 'pointer', fontFamily: 'inherit',
                letterSpacing: '0.02em', boxShadow: '0 1px 4px rgba(216,90,48,0.3)',
              }}
            >{togglingStart ? 'Marcando…' : 'Empezar obra'}</button>
          )}
        </div>
      </div>

      {startErr && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          padding: '8px 12px', fontSize: 12, color: '#DC2626',
        }}>{startErr}</div>
      )}

      {/* ── Fecha de inicio editable ── */}
      <div style={{
        background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
        padding: '12px 18px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#888',
          }}>
            Fecha de inicio de obra
          </label>
          <input
            type="date"
            value={fechaInput}
            onChange={e => setFechaInput(e.target.value)}
            style={{
              padding: '7px 10px', fontSize: 13,
              border: '1px solid #E8E6E0', borderRadius: 6,
              fontFamily: 'inherit', color: '#1A1A1A',
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSaveFecha}
          disabled={savingFecha || !fechaInput || fechaInput === obraFechaInicio}
          style={{
            background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            cursor: (savingFecha || !fechaInput || fechaInput === obraFechaInicio) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: (!fechaInput || fechaInput === obraFechaInicio) ? 0.4 : 1,
          }}
        >{savingFecha ? 'Aplicando…' : 'Aplicar y desplazar cronograma'}</button>
        <div style={{ fontSize: 11, color: '#888', flex: 1, minWidth: 220 }}>
          Heredada de Dream Team al activar. Si la modificas, todas las fechas planificadas
          del cronograma se desplazan por el delta. Las fechas reales ya registradas en fases
          NO se mueven.
        </div>
        {fechaErr && (
          <div style={{ fontSize: 11, color: '#DC2626', width: '100%' }}>{fechaErr}</div>
        )}
      </div>

      {/* ── Toolbar Gantt ── */}
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

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: '#AAA' }}>
            Plataforma activada el {new Date(obraStartedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => setGanttFullscreen(true)}
            style={{
              background: '#fff',
              border: '1px solid #E8E6E0',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 12, fontWeight: 600, color: '#1A1A1A',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            title="Ver el Gantt a pantalla completa (Esc para salir)"
          >
            ⛶ Pantalla completa
          </button>
        </div>
      </div>

      {/* ── Gantt ── */}
      <ObraGantt
        phases={phases}
        milestones={milestones}
        chapterNames={chapterNames}
        partnerNames={partnerNames}
        baselineSnapshot={baselineSnapshot}
        shadowVisible={shadowVisible}
        dayPx={dayPx}
        rowH={rowH}
        containerMaxH={containerH}
        onPhaseClick={setEditingPhaseId}
      />

      {/* ── Lista cronológica (espejo del Gantt) ── */}
      <ObraPhasesTimeline
        phases={phases}
        milestones={milestones}
        chapterNames={chapterNames}
        partnerNames={partnerNames}
        onPhaseClick={setEditingPhaseId}
      />

      {/* Overlay fullscreen del Gantt */}
      {ganttFullscreen && (
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
            gap: 16, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
              Cronograma de obra · pantalla completa
            </span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#666', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={shadowVisible}
                  onChange={e => setShadowVisible(e.target.checked)}
                  style={{ marginRight: 6, accentColor: '#D85A30' }}
                />
                Mostrar plan original
              </label>
              <ZoomSlider label="Densidad"      hint={`${dayPx}px/día`} min={2} max={24} step={1} value={dayPx} onChange={setDayPx} />
              <ZoomSlider label="Aire vertical" hint={`${rowH}px/fila`} min={26} max={60} step={2} value={rowH}  onChange={setRowH} />
              <button
                type="button"
                onClick={() => setGanttFullscreen(false)}
                style={{
                  background: '#fff',
                  border: '1px solid #E8E6E0',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 12, fontWeight: 600, color: '#1A1A1A',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                title="Cerrar (Esc)"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'hidden' }}>
            <ObraGantt
              phases={phases}
              milestones={milestones}
              chapterNames={chapterNames}
              partnerNames={partnerNames}
              baselineSnapshot={baselineSnapshot}
              shadowVisible={shadowVisible}
              dayPx={dayPx}
              rowH={rowH}
              containerMaxH={Math.max(360, viewportH - 110)}
              onPhaseClick={(id) => { setGanttFullscreen(false); setEditingPhaseId(id) }}
            />
          </div>
        </div>
      )}

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

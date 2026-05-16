'use client'

import React, { useEffect, useState } from 'react'
import { getAdjudicationOverview, setDreamTeamObraStartDate, type FpeOverviewPartner } from '@/app/actions/fpe-tenders'
import PartnerContractCard from '@/components/team/fp-execution/dream-team/PartnerContractCard'
import AwardedGantt       from '@/components/team/fp-execution/dream-team/AwardedGantt'
import CashFlowChart      from '@/components/team/fp-execution/dream-team/CashFlowChart'
import type { ScheduleChapter, ScheduleMilestone } from '@/lib/fp-execution/schedule'

type SubTab = 'partners' | 'gantt' | 'cashflow'

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function DreamTeamPanel({
  projectId,
  scheduleChapters,
  scheduleMilestones,
  fechaInicioParametrica,
  initialObraStartOverride,
  m2,
  chapterDaysOverrides,
  duracionFactor,
}: {
  projectId:                string
  scheduleChapters:         ScheduleChapter[]
  scheduleMilestones:       ScheduleMilestone[]
  /** Fecha de inicio de obra del cronograma paramétrico (tab Cronograma). */
  fechaInicioParametrica:   string | null
  /** Override post-adjudicación específico del Dream Team. Si está set, prevalece. */
  initialObraStartOverride: string | null
  m2:                       number | null
  chapterDaysOverrides:     Record<string, number | null>
  duracionFactor:           number
}) {
  const [subTab, setSubTab]       = useState<SubTab>('partners')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [partners, setPartners]   = useState<FpeOverviewPartner[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // Obra start date override (Dream Team-level)
  const [override, setOverride]       = useState<string | null>(initialObraStartOverride)
  const [savingDate, setSavingDate]   = useState(false)
  const [dateError, setDateError]     = useState<string | null>(null)
  const effectiveFechaInicio = override ?? fechaInicioParametrica

  // Controles visuales del Gantt adjudicado
  const [ganttDayPx, setGanttDayPx]       = useState(6)   // 2–24 px/día
  const [ganttRowH, setGanttRowH]         = useState(30)  // 26–60 px/fila
  const [ganttContainerH, setGanttContainerH] = useState(560) // 360–1000 px alto
  const [ganttFullscreen, setGanttFullscreen] = useState(false)
  const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 900)

  useEffect(() => {
    setLoading(true)
    getAdjudicationOverview(projectId).then(res => {
      setLoading(false)
      if ('error' in res) { setError(res.error); return }
      setPartners(res.partners)
      setError(null)
    })
  }, [projectId, refreshTick])

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

  const handleRefresh = () => setRefreshTick(t => t + 1)

  const handleOverrideChange = async (raw: string) => {
    const value = raw.trim() === '' ? null : raw
    // Optimistic update
    const previous = override
    setOverride(value)
    setSavingDate(true); setDateError(null)
    const res = await setDreamTeamObraStartDate(projectId, value)
    setSavingDate(false)
    if ('error' in res) {
      setOverride(previous)
      setDateError(res.error)
    }
  }

  const handleClearOverride = () => handleOverrideChange('')

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#AAA', fontSize: 13 }}>
        Cargando Dream Team…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
        Error: {error}
      </div>
    )
  }

  if (partners.length === 0) {
    return (
      <div style={{ padding: '80px 28px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>🏗️</div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#555' }}>
          Aún no hay partners en el Dream Team
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#999' }}>
          Adjudica las UEs en la pestaña Licitación. Cada partner adjudicado entrará automáticamente aquí.
        </p>
      </div>
    )
  }

  const grandTotal = partners.reduce((a, p) => a + p.total, 0)
  const sentCount     = partners.filter(p => ['sent_to_sign','signed','received'].includes(p.contract?.status ?? '')).length
  const signedCount   = partners.filter(p => ['signed','received'].includes(p.contract?.status ?? '')).length
  const receivedCount = partners.filter(p => p.contract?.status === 'received').length

  return (
    <div>
      {/* Summary */}
      <div style={{ background: '#1A1A1A', borderRadius: 10, padding: '18px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Dream Team
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4 }}>
            {partners.length} partner{partners.length !== 1 ? 's' : ''} adjudicados
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Total contratos
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'monospace', marginTop: 4 }}>
            {euros(grandTotal)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <KPI label="Enviados"  value={`${sentCount}/${partners.length}`}  />
          <KPI label="Firmados"  value={`${signedCount}/${partners.length}`} />
          <KPI label="Recibidos" value={`${receivedCount}/${partners.length}`} />
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: '#F0EEE8', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        <SubTabBtn label="Partners"        active={subTab === 'partners'} onClick={() => setSubTab('partners')} />
        <SubTabBtn label="Cronograma obra" active={subTab === 'gantt'}    onClick={() => setSubTab('gantt')} />
        <SubTabBtn label="Flujo económico" active={subTab === 'cashflow'} onClick={() => setSubTab('cashflow')} />
      </div>

      {/* Content */}
      {subTab === 'partners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {partners.map(p => (
            <PartnerContractCard
              key={p.partner_id}
              partner={p}
              projectId={projectId}
              expanded={expandedId === p.partner_id}
              onToggleExpanded={() => setExpandedId(prev => prev === p.partner_id ? null : p.partner_id)}
              onChange={handleRefresh}
            />
          ))}
        </div>
      )}

      {subTab === 'gantt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Fecha de inicio de obra (Dream Team override) */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
            background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
            padding: '12px 18px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>
                Fecha de inicio de obra
              </label>
              <input
                type="date"
                value={effectiveFechaInicio ?? ''}
                onChange={e => handleOverrideChange(e.target.value)}
                style={{
                  padding: '6px 10px', fontSize: 13, border: '1px solid #E8E6E0',
                  borderRadius: 6, fontFamily: 'inherit', color: '#1A1A1A',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' }}>
              {override
                ? (
                  <>
                    <span style={{ color: '#D85A30', fontWeight: 600 }}>Override post-adjudicación activo</span>
                    <span>Paramétrica original: {fechaInicioParametrica ?? '—'}</span>
                    <button
                      type="button"
                      onClick={handleClearOverride}
                      style={{
                        marginTop: 2, alignSelf: 'flex-start', background: 'none',
                        border: 'none', color: '#888', textDecoration: 'underline',
                        cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: 'inherit',
                      }}
                    >Quitar override y volver al paramétrico</button>
                  </>
                )
                : (
                  <>
                    <span>Heredada del cronograma paramétrico.</span>
                    <span style={{ color: '#AAA' }}>Modifica este campo si la fecha cambió entre licitación y adjudicación.</span>
                  </>
                )
              }
              {savingDate && <span style={{ color: '#AAA' }}>Guardando…</span>}
              {dateError && <span style={{ color: '#DC2626' }}>Error: {dateError}</span>}
            </div>
          </div>

          {/* Toolbar: sliders + pantalla completa */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 24,
            background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
            padding: '12px 18px',
            alignItems: 'center',
          }}>
            <ZoomSlider
              label="Densidad horizontal"
              hint={`${ganttDayPx}px/día`}
              min={2} max={24} step={1}
              value={ganttDayPx} onChange={setGanttDayPx}
            />
            <ZoomSlider
              label="Aire vertical"
              hint={`${ganttRowH}px/fila`}
              min={26} max={60} step={2}
              value={ganttRowH} onChange={setGanttRowH}
            />
            <ZoomSlider
              label="Alto del Gantt"
              hint={`${ganttContainerH}px`}
              min={360} max={1000} step={20}
              value={ganttContainerH} onChange={setGanttContainerH}
            />
            <button
              type="button"
              onClick={() => setGanttFullscreen(true)}
              style={{
                marginLeft: 'auto',
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

          <AwardedGantt
            partners={partners}
            scheduleChapters={scheduleChapters}
            scheduleMilestones={scheduleMilestones}
            fechaInicio={effectiveFechaInicio}
            m2={m2}
            chapterDaysOverrides={chapterDaysOverrides}
            duracionFactor={duracionFactor}
            dayPx={ganttDayPx}
            rowH={ganttRowH}
            containerMaxH={ganttContainerH}
          />
        </div>
      )}

      {/* Overlay fullscreen del Gantt adjudicado */}
      {ganttFullscreen && subTab === 'gantt' && (
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
              Cronograma adjudicado · pantalla completa
            </span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <ZoomSlider label="Densidad" hint={`${ganttDayPx}px/día`} min={2} max={24} step={1} value={ganttDayPx} onChange={setGanttDayPx} />
              <ZoomSlider label="Aire vertical" hint={`${ganttRowH}px/fila`} min={26} max={60} step={2} value={ganttRowH} onChange={setGanttRowH} />
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
            <AwardedGantt
              partners={partners}
              scheduleChapters={scheduleChapters}
              scheduleMilestones={scheduleMilestones}
              fechaInicio={effectiveFechaInicio}
              m2={m2}
              chapterDaysOverrides={chapterDaysOverrides}
              duracionFactor={duracionFactor}
              dayPx={ganttDayPx}
              rowH={ganttRowH}
              containerMaxH={Math.max(360, viewportH - 110)}
            />
          </div>
        </div>
      )}

      {subTab === 'cashflow' && (
        <CashFlowChart
          partners={partners}
          scheduleChapters={scheduleChapters}
          scheduleMilestones={scheduleMilestones}
          fechaInicio={effectiveFechaInicio}
          m2={m2}
          chapterDaysOverrides={chapterDaysOverrides}
          duracionFactor={duracionFactor}
        />
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  )
}

function SubTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 600,
        borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? '#fff' : 'transparent',
        color:      active ? '#1A1A1A' : '#888',
        boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

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

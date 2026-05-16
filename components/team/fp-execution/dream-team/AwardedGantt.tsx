'use client'

import React, { useMemo, useState } from 'react'
import {
  computeAwardedSchedule,
  formatScheduleDate,
  type ScheduleChapter,
  type ScheduleMilestone,
  type AwardedPhaseDuration,
  type ProjectUnitChapterMap,
} from '@/lib/fp-execution/schedule'
import { addBusinessDays, snapToNextBusinessDay } from '@/lib/fp-execution/businessDays'
import type { FpeOverviewPartner } from '@/app/actions/fpe-tenders'

// Mismas constantes visuales que el Gantt paramétrico (ProjectScopePage.tsx).
// Garantiza que ambos cronogramas se vean idénticos a nivel de estructura, colores
// por capítulo y cabeceras. La única diferencia visual es la distinción adjudicada
// vs paramétrica en las barras y el contenido del tooltip.
const GANTT_COLORS = ['#378ADD', '#D85A30', '#059669', '#7C3AED', '#0891B2', '#CA8A04', '#BE185D', '#0369A1']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function estimateChipWidthPx(nombre: string): number {
  return Math.min(220, Math.max(70, 26 + nombre.length * 6.5))
}

export default function AwardedGantt({
  partners,
  scheduleChapters,
  scheduleMilestones,
  fechaInicio,
  m2,
  chapterDaysOverrides,
  duracionFactor,
  dayPx = 6,
  rowH = 30,
  containerMaxH,
}: {
  partners:             FpeOverviewPartner[]
  scheduleChapters:     ScheduleChapter[]
  scheduleMilestones:   ScheduleMilestone[]
  fechaInicio:          string | null
  m2:                   number | null
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor:       number
  dayPx?:               number
  rowH?:                number
  containerMaxH?:       number
}) {
  // ── Inputs derivados de la adjudicación ────────────────────────────────────
  // Las fases viven a nivel capítulo: replicamos la duración del capítulo a cada
  // UE adjudicada de ese capítulo para que computeAwardedSchedule (que indexa por
  // phase × unit) funcione tal cual.
  const awardedDurations: AwardedPhaseDuration[] = useMemo(() => {
    const out: AwardedPhaseDuration[] = []
    for (const p of partners) {
      const unitsInChapter: Record<string, string[]> = {}
      for (const ch of p.chapters) {
        unitsInChapter[ch.chapter_id] = ch.units.map(u => u.project_unit_id)
      }
      for (const pd of p.phase_durations) {
        if (!pd.chapter_id) continue
        for (const uid of unitsInChapter[pd.chapter_id] ?? []) {
          out.push({
            template_phase_id: pd.template_phase_id,
            project_unit_id:   uid,
            partner_id:        p.partner_id,
            duracion_dias:     pd.duracion_dias,
          })
        }
      }
    }
    return out
  }, [partners])

  const unitChapters: ProjectUnitChapterMap[] = useMemo(() => {
    const out: ProjectUnitChapterMap[] = []
    for (const p of partners) {
      for (const ch of p.chapters) {
        for (const u of ch.units) {
          out.push({ project_unit_id: u.project_unit_id, chapter_id: ch.chapter_id })
        }
      }
    }
    return out
  }, [partners])

  const partnerNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of partners) m[p.partner_id] = p.partner_nombre
    return m
  }, [partners])

  // ── Estados previos al cálculo ─────────────────────────────────────────────
  if (scheduleChapters.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
          No hay cronograma configurado. Define el cronograma en la pestaña Cronograma primero.
        </p>
      </div>
    )
  }

  if (!fechaInicio) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#555' }}>
          Falta la fecha de inicio de obra
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
          Defínela en la pestaña <strong>Cronograma</strong> del proyecto.
        </p>
      </div>
    )
  }

  return (
    <AwardedGanttInner
      partners={partners}
      scheduleChapters={scheduleChapters}
      scheduleMilestones={scheduleMilestones}
      fechaInicio={fechaInicio}
      m2={m2}
      chapterDaysOverrides={chapterDaysOverrides}
      duracionFactor={duracionFactor}
      awardedDurations={awardedDurations}
      unitChapters={unitChapters}
      partnerNameById={partnerNameById}
      dayPx={dayPx}
      rowH={rowH}
      containerMaxH={containerMaxH}
    />
  )
}

// El render real va en un componente interno: así podemos usar useMemo sobre
// `schedule` sin violar las reglas de hooks por los early-returns del padre.
function AwardedGanttInner({
  partners,
  scheduleChapters,
  scheduleMilestones,
  fechaInicio,
  m2,
  chapterDaysOverrides,
  duracionFactor,
  awardedDurations,
  unitChapters,
  partnerNameById,
  dayPx,
  rowH,
  containerMaxH,
}: {
  partners:             FpeOverviewPartner[]
  scheduleChapters:     ScheduleChapter[]
  scheduleMilestones:   ScheduleMilestone[]
  fechaInicio:          string
  m2:                   number | null
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor:       number
  awardedDurations:     AwardedPhaseDuration[]
  unitChapters:         ProjectUnitChapterMap[]
  partnerNameById:      Record<string, string>
  dayPx:                number
  rowH:                 number
  containerMaxH?:       number
}) {
  const schedule = useMemo(
    () => computeAwardedSchedule(
      scheduleChapters,
      new Date(fechaInicio),
      m2,
      chapterDaysOverrides,
      duracionFactor,
      awardedDurations,
      unitChapters,
    ),
    [scheduleChapters, fechaInicio, m2, chapterDaysOverrides, duracionFactor, awardedDurations, unitChapters]
  )

  const totalDays = schedule.totalDays

  // Tooltip flotante (sigue al cursor) — idéntico al del paramétrico.
  const [hover, setHover] = useState<{ lines: string[]; x: number; y: number } | null>(null)
  const handleHover = (lines: string[]) => (e: React.MouseEvent) => {
    setHover({ lines, x: e.clientX, y: e.clientY })
  }
  const handleMove = (e: React.MouseEvent) => {
    setHover(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
  }
  const clearHover = () => setHover(null)

  if (totalDays === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
          No se pudieron computar duraciones. Revisa el cronograma paramétrico.
        </p>
      </div>
    )
  }

  // ── Layout (mismo que el Gantt paramétrico) ───────────────────────────────
  const leftColW     = 300
  const chapterRowH  = Math.max(26, Math.round(rowH * 0.75))

  const startAnchor    = snapToNextBusinessDay(new Date(fechaInicio))
  const projectStartMs = startAnchor.getTime()

  // Calendar span hasta el endDate más tardío.
  let latestMs = projectStartMs
  for (const id of Object.keys(schedule.phases)) {
    const e = schedule.phases[id]
    if (e && e.endDate.getTime() > latestMs) latestMs = e.endDate.getTime()
  }
  const calendarSpanDays = Math.max(1, (latestMs - projectStartMs) / 86400000)
  const timelineWidthPx  = Math.max(600, Math.ceil(calendarSpanDays * dayPx))

  const calOffset = (d: Date) => (d.getTime() - projectStartMs) / 86400000
  const toLeftPx  = (calDays: number) => Math.max(0, calDays * dayPx)
  const toWidthPx = (calDays: number) => Math.max(2, calDays * dayPx)

  // ── Hitos: fecha en la que se logran (último fin entre las fases que lo logran) ─
  const milestoneCalOffset: Record<string, number> = {}
  const milestoneEndDate:   Record<string, Date>   = {}
  for (const ch of scheduleChapters) {
    for (const ph of ch.phases) {
      const e = schedule.phases[ph.id]
      if (!e) continue
      const d = calOffset(e.endDate)
      for (const mid of ph.achieves) {
        if (milestoneCalOffset[mid] === undefined || d > milestoneCalOffset[mid]) {
          milestoneCalOffset[mid] = d
          milestoneEndDate[mid]   = e.endDate
        }
      }
    }
  }

  // Marcadores de semanas laborables.
  const businessWeeks = Math.ceil(totalDays / 5)
  const weekStep      = dayPx * 5 >= 50 ? 1 : dayPx * 5 >= 30 ? 2 : 4
  const weekMarkers: { week: number; calOffset: number }[] = []
  for (let w = 0; w <= businessWeeks; w += weekStep) {
    const date = addBusinessDays(startAnchor, w * 5)
    weekMarkers.push({ week: w, calOffset: calOffset(date) })
  }

  // Marcadores de meses (eje calendario natural) en UTC.
  const monthMarkers: { label: string; calOffset: number; widthDays: number; day1Offset: number | null }[] = []
  {
    const start = new Date(projectStartMs)
    let cursor  = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    const endMs = latestMs + 86400000
    while (cursor < endMs) {
      const cursorDate = new Date(cursor)
      const next       = Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() + 1, 1)
      const segStart   = Math.max(cursor, projectStartMs)
      const segEnd     = Math.min(next, endMs)
      const offsetDays = (segStart - projectStartMs) / 86400000
      const widthDays  = (segEnd   - segStart) / 86400000
      const rawDay1    = (cursor - projectStartMs) / 86400000
      const day1Offset = rawDay1 >= 0 ? rawDay1 : null
      if (widthDays > 0) {
        const label = `${MESES_CORTOS[cursorDate.getUTCMonth()]} ${String(cursorDate.getUTCFullYear()).slice(2)}`
        monthMarkers.push({ label, calOffset: offsetDays, widthDays, day1Offset })
      }
      cursor = next
    }
  }

  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )
  const todayOffsetDays = (todayMs - projectStartMs) / 86400000
  const todayInRange    = todayOffsetDays >= 0 && todayOffsetDays <= calendarSpanDays + 1

  const activeMilestones = scheduleMilestones
    .filter(m => milestoneCalOffset[m.id] !== undefined)
    .sort((a, b) => (milestoneCalOffset[a.id] ?? 0) - (milestoneCalOffset[b.id] ?? 0))

  // Packing greedy multi-fila para chips de hito.
  const CHIP_ROW_H   = 26
  const CHIP_GAP_PX  = 6
  const milestoneRow:    Record<string, number> = {}
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
  const milestoneStripH   = activeMilestones.length > 0
    ? milestoneRowsUsed * CHIP_ROW_H + 12
    : 0

  const monthHeaderH = 22
  const weekHeaderH  = 22

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
                const px         = milestoneLeftPx[m.id]
                const row        = milestoneRow[m.id]
                const chipTop    = 6 + row * CHIP_ROW_H
                const chipBottom = chipTop + 20
                return (
                  <React.Fragment key={m.id}>
                    <div style={{
                      position: 'absolute',
                      left: px,
                      top: chipBottom,
                      height: milestoneStripH - chipBottom,
                      borderLeft: '1px solid #D85A30',
                      pointerEvents: 'none',
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: px - 4, top: chipTop + 6,
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#D85A30',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }} />
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
        {[...scheduleChapters].sort((a, b) => a.orden - b.orden).map((ch, ci) => {
          const color  = GANTT_COLORS[ci % GANTT_COLORS.length]
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
                const entry = schedule.phases[ph.id]
                if (!entry) return null
                const startCal = calOffset(entry.startDate)
                const endCal   = calOffset(entry.endDate)
                const calWidth = Math.max(0, endCal - startCal)
                const durD     = entry.durationDays
                const achievesPairs = ph.achieves
                  .map(mid => scheduleMilestones.find(mm => mm.id === mid))
                  .filter((m): m is ScheduleMilestone => !!m)
                const requiresPairs = ph.requires
                  .map(mid => scheduleMilestones.find(mm => mm.id === mid))
                  .filter((m): m is ScheduleMilestone => !!m)

                const isAwarded = schedule.phaseSource[ph.id] === 'awarded'
                const partnersForPhase = schedule.phasePartners[ph.id] ?? []
                const partnersLabel = isAwarded && partnersForPhase.length > 0
                  ? partnersForPhase.map(pid => partnerNameById[pid] ?? '?').join(', ')
                  : 'Sin partner adjudicado'

                const tooltipLines: string[] = [
                  ph.nombre,
                  `Inicio: ${formatScheduleDate(entry.startDate)}`,
                  `Fin: ${formatScheduleDate(entry.endDate)}`,
                  `${Math.round(durD)} días laborables`,
                  `Partners: ${partnersLabel}`,
                  requiresPairs.length ? `Requiere hito: ${requiresPairs.map(m => m.nombre).join(', ')}` : '',
                  achievesPairs.length ? `Logra hito: ${achievesPairs.map(m => m.nombre).join(', ')}` : '',
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
                      {requiresPairs.length > 0 && (
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

                      {todayInRange && (
                        <div style={{
                          position: 'absolute', left: toLeftPx(todayOffsetDays),
                          top: 0, bottom: 0,
                          borderLeft: '2px solid #DC2626', opacity: 0.7,
                          pointerEvents: 'none', zIndex: 3,
                        }} />
                      )}

                      {/* Bar — adjudicada (rellena) vs paramétrica (hueca dashed) */}
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
                          background: isAwarded ? color : 'transparent',
                          border: isAwarded ? 'none' : `1.5px dashed ${color}`,
                          borderRadius: 4,
                          zIndex: 2,
                          cursor: 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                          paddingLeft: 8, paddingRight: 8,
                          color: isAwarded ? '#fff' : color,
                          boxShadow: isAwarded ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
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

                      {/* Círculos de hito al final de la barra */}
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

      {/* Tooltip flotante — sigue al cursor */}
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

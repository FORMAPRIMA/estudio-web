'use client'

// ══════════════════════════════════════════════════════════════════════════════
// ObraGantt — Cronograma vivo de la obra
//
// A diferencia de AwardedGantt (que calcula el cronograma on-the-fly), aquí las
// fechas ya están persistidas en fpe_obra_phases. Este componente:
//   - Dibuja una barra por fase, según actual_* si está set, planned_* en caso
//     contrario. Color según status.
//   - Si shadowVisible, superpone outlines de las posiciones del baseline
//     (fpe_projects.obra_baseline_snapshot) para comparar plan vs realidad.
//   - Click en una fase → ObraPhaseEditor (popover de edición).
//   - Marcador de HOY y chips de hito en la franja superior.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import type { ObraBaselineSnapshot, ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'
import {
  STATUS_STYLE,
  parseISODate,
  fmtDate,
  resolvePhaseDates,
  type ResolvedPhaseDates,
} from '@/lib/fp-execution/obra-view'

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function dayDiff(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 86400000
}

export default function ObraGantt({
  phases,
  milestones,
  chapterNames,
  partnerNames,
  baselineSnapshot,
  shadowVisible,
  dayPx = 6,
  rowH = 30,
  containerMaxH,
  onPhaseClick,
}: {
  phases:           ObraPhase[]
  milestones:       ObraMilestone[]
  chapterNames:     Record<string, string>
  partnerNames:     Record<string, string>
  baselineSnapshot: ObraBaselineSnapshot | null
  shadowVisible:    boolean
  dayPx?:           number
  rowH?:            number
  containerMaxH?:   number
  onPhaseClick?:    (phaseId: string) => void
}) {
  // ── Build chapter groups ───────────────────────────────────────────────────
  type ChapterGroup = { chapter_id: string; phases: ObraPhase[] }
  const chapterGroups: ChapterGroup[] = useMemo(() => {
    const byChapter = new Map<string, ObraPhase[]>()
    for (const ph of [...phases].sort((a, b) => a.orden - b.orden)) {
      const key = ph.chapter_id ?? '__nochapter__'
      const arr = byChapter.get(key) ?? []
      arr.push(ph)
      byChapter.set(key, arr)
    }
    return Array.from(byChapter.entries()).map(([chapter_id, ps]) => ({
      chapter_id,
      phases: ps,
    }))
  }, [phases])

  // ── Date helpers per phase ────────────────────────────────────────────────
  // Regla canónica de fallback actual_/planned_ centralizada en obra-view.ts.
  const phaseDates = useMemo(() => {
    const map: Record<string, ResolvedPhaseDates> = {}
    for (const ph of phases) map[ph.id] = resolvePhaseDates(ph)
    return map
  }, [phases])

  // ── Baseline lookup ────────────────────────────────────────────────────────
  const baselineByTemplatePhase = useMemo(() => {
    const m: Record<string, { start: Date; end: Date }> = {}
    if (!baselineSnapshot) return m
    for (const bp of baselineSnapshot.phases) {
      const s = parseISODate(bp.start_date)
      const e = parseISODate(bp.end_date)
      if (s && e) m[bp.template_phase_id] = { start: s, end: e }
    }
    return m
  }, [baselineSnapshot])

  // ── Timeline span ──────────────────────────────────────────────────────────
  // Snap a límites de mes: el timeline empieza el día 1 del mes más temprano y
  // termina al inicio del mes siguiente al evento más tardío. Así los marcadores
  // de mes siempre arrancan en el 1 (no en el día del primer evento).
  const { projectStart, totalDays } = useMemo(() => {
    let minMs = Infinity
    let maxMs = -Infinity
    for (const ph of phases) {
      const d = phaseDates[ph.id]
      if (d.start) minMs = Math.min(minMs, d.start.getTime())
      if (d.end)   maxMs = Math.max(maxMs, d.end.getTime())
    }
    if (shadowVisible) {
      for (const bp of Object.values(baselineByTemplatePhase)) {
        minMs = Math.min(minMs, bp.start.getTime())
        maxMs = Math.max(maxMs, bp.end.getTime())
      }
    }
    if (minMs === Infinity || maxMs === -Infinity) {
      const t = new Date()
      const snapped = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))
      return { projectStart: snapped, totalDays: 30 }
    }
    const startRaw = new Date(minMs)
    const endRaw   = new Date(maxMs)
    const snappedStart = new Date(Date.UTC(startRaw.getUTCFullYear(), startRaw.getUTCMonth(), 1))
    const snappedEnd   = new Date(Date.UTC(endRaw.getUTCFullYear(),   endRaw.getUTCMonth() + 1, 1))
    const days = Math.max(1, (snappedEnd.getTime() - snappedStart.getTime()) / 86400000)
    return { projectStart: snappedStart, totalDays: days }
  }, [phases, phaseDates, shadowVisible, baselineByTemplatePhase])

  const calOffset = (d: Date) => dayDiff(d, projectStart)
  const toLeftPx  = (calDays: number) => Math.max(0, calDays * dayPx)
  const toWidthPx = (calDays: number) => Math.max(2, calDays * dayPx)

  const timelineWidthPx = Math.max(600, Math.ceil(totalDays * dayPx))
  const leftColW   = 280
  const chapterRowH = Math.max(26, Math.round(rowH * 0.75))

  // ── Today ──────────────────────────────────────────────────────────────────
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const todayOffsetDays = calOffset(todayUTC)
  const todayInRange    = todayOffsetDays >= 0 && todayOffsetDays <= totalDays + 1

  // ── Week markers (lunes) ───────────────────────────────────────────────────
  // Offsets en días desde projectStart de cada lunes dentro del rango.
  const weekOffsets: number[] = useMemo(() => {
    const out: number[] = []
    const startDay = projectStart.getUTCDay()             // 0=Dom … 6=Sáb
    const daysToFirstMonday = (8 - startDay) % 7          // 0 si ya es lunes
    for (let off = daysToFirstMonday; off < totalDays; off += 7) {
      out.push(off)
    }
    return out
  }, [projectStart, totalDays])

  // ── Month markers ──────────────────────────────────────────────────────────
  // Año completo solo en el primer marcador y cuando cambia de año (enero).
  // En el resto, solo el nombre del mes — evita confundir "Jul 26" con "Jul 26".
  type MonthMarker = { label: string; calOffset: number; widthDays: number; day1Offset: number | null }
  const monthMarkers: MonthMarker[] = useMemo(() => {
    const out: MonthMarker[] = []
    const startMs = projectStart.getTime()
    const endMs   = startMs + totalDays * 86400000
    const startDate = new Date(startMs)
    let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
    let prevYear: number | null = null
    while (cursor < endMs) {
      const cursorDate = new Date(cursor)
      const next       = Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() + 1, 1)
      const segStart   = Math.max(cursor, startMs)
      const segEnd     = Math.min(next, endMs)
      const offsetDays = (segStart - startMs) / 86400000
      const widthDays  = (segEnd - segStart) / 86400000
      const rawDay1    = (cursor - startMs) / 86400000
      const day1Offset = rawDay1 >= 0 ? rawDay1 : null
      if (widthDays > 0) {
        const year     = cursorDate.getUTCFullYear()
        const showYear = prevYear === null || year !== prevYear
        const mesNombre = MESES_CORTOS[cursorDate.getUTCMonth()]
        const label = showYear ? `${mesNombre} ${year}` : mesNombre
        out.push({ label, calOffset: offsetDays, widthDays, day1Offset })
        prevYear = year
      }
      cursor = next
    }
    return out
  }, [projectStart, totalDays])

  // ── Milestone chips at top ────────────────────────────────────────────────
  type MsChip = { id: string; nombre: string; offset: number; achieved: boolean; date: Date }
  const milestoneChips: MsChip[] = useMemo(() => {
    const out: MsChip[] = []
    for (const m of milestones) {
      const dt = parseISODate(m.actual_date) ?? parseISODate(m.planned_date)
      if (!dt) continue
      out.push({
        id: m.id,
        nombre: m.nombre,
        offset: calOffset(dt),
        achieved: !!m.actual_date,
        date: dt,
      })
    }
    return out.sort((a, b) => a.offset - b.offset)
  }, [milestones, projectStart])

  // Pack chips into multiple rows
  const CHIP_ROW_H  = 26
  const CHIP_GAP_PX = 6
  const estimateChipWidth = (s: string) => Math.min(220, Math.max(70, 26 + s.length * 6.5))
  const chipRowMap: Record<string, number> = {}
  const chipLeftPxMap: Record<string, number> = {}
  const rowLastRight: number[] = []
  for (const c of milestoneChips) {
    const px = toLeftPx(c.offset)
    const w  = estimateChipWidth(c.nombre)
    chipLeftPxMap[c.id] = px
    let row = 0
    while (rowLastRight[row] !== undefined && rowLastRight[row] + CHIP_GAP_PX > px) row++
    chipRowMap[c.id] = row
    rowLastRight[row] = px + w
  }
  const milestoneRowsUsed = Math.max(1, rowLastRight.length)
  const milestoneStripH   = milestoneChips.length > 0
    ? milestoneRowsUsed * CHIP_ROW_H + 12
    : 0

  // ── Hover tooltip ──────────────────────────────────────────────────────────
  const [hover, setHover] = useState<{ lines: string[]; x: number; y: number } | null>(null)
  const handleHover = (lines: string[]) => (e: React.MouseEvent) => {
    setHover({ lines, x: e.clientX, y: e.clientY })
  }
  const handleMove = (e: React.MouseEvent) => {
    setHover(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
  }
  const clearHover = () => setHover(null)

  const monthHeaderH = 22

  if (phases.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
          No hay fases en el cronograma de obra.
        </p>
      </div>
    )
  }

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

        {/* ── Milestone strip ── */}
        {milestoneChips.length > 0 && (
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
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA',
            }}>
              Hitos del proyecto
            </div>
            <div style={{ width: timelineWidthPx, position: 'relative', height: milestoneStripH }}>
              {milestoneChips.map(c => {
                const px         = chipLeftPxMap[c.id]
                const row        = chipRowMap[c.id]
                const chipTop    = 6 + row * CHIP_ROW_H
                const chipBottom = chipTop + 20
                const color      = c.achieved ? '#059669' : '#D85A30'
                const bg         = c.achieved ? '#ECFDF5' : '#FFF7F0'
                const borderC    = c.achieved ? '#86EFAC' : '#FED7AA'
                return (
                  <React.Fragment key={c.id}>
                    <div style={{
                      position: 'absolute',
                      left: px, top: chipBottom, height: milestoneStripH - chipBottom,
                      borderLeft: `1px solid ${color}`,
                      pointerEvents: 'none',
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: px - 4, top: chipTop + 6,
                      width: 8, height: 8, borderRadius: '50%',
                      background: color,
                      pointerEvents: 'none', zIndex: 1,
                    }} />
                    <div
                      onMouseEnter={handleHover([
                        `Hito: ${c.nombre}`,
                        `${c.achieved ? 'Logrado' : 'Previsto'}: ${fmtDate(c.date)}`,
                      ])}
                      onMouseMove={handleMove}
                      onMouseLeave={clearHover}
                      style={{
                        position: 'absolute',
                        left: px + 6, top: chipTop,
                        background: bg, color,
                        border: `1px solid ${borderC}`, borderRadius: 4,
                        padding: '2px 9px',
                        fontSize: 11, fontWeight: 600, lineHeight: '16px',
                        whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                        cursor: 'default',
                      }}
                    >
                      {c.achieved && '✓ '}{c.nombre}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Month header ── */}
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
                display: 'flex', alignItems: 'center', paddingLeft: 6,
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
                <div key={`d1-${i}`} style={{
                  position: 'absolute',
                  left: toLeftPx(mm.day1Offset),
                  top: 0, bottom: 0,
                  borderLeft: '1px solid #C9C5BD',
                  pointerEvents: 'none',
                }} />
              )
            })}
            {todayInRange && (
              <>
                <div style={{
                  position: 'absolute',
                  left: toLeftPx(todayOffsetDays),
                  top: 0, bottom: 0,
                  borderLeft: '2px solid #DC2626',
                  pointerEvents: 'none', zIndex: 1,
                }} />
                <div style={{
                  position: 'absolute',
                  left: toLeftPx(todayOffsetDays) - 18,
                  top: 2,
                  background: '#DC2626', color: '#fff',
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 5px', borderRadius: 3,
                  pointerEvents: 'none', zIndex: 2,
                }}>HOY</div>
              </>
            )}
          </div>
        </div>

        {/* ── Chapter & phase rows ── */}
        {chapterGroups.map((cg, cgIdx) => (
          <React.Fragment key={cg.chapter_id}>
            {/* Chapter label row */}
            <div style={{
              display: 'flex',
              borderTop: cgIdx === 0 ? 'none' : '1px solid #F0EEE8',
              background: '#FAFAF8',
            }}>
              <div style={{
                width: leftColW, flexShrink: 0,
                position: 'sticky', left: 0, zIndex: 5,
                background: '#FAFAF8',
                borderRight: '1px solid #E8E6E0',
                padding: '0 14px',
                display: 'flex', alignItems: 'center',
                fontSize: 11, fontWeight: 700, color: '#1A1A1A',
                letterSpacing: '0.02em',
                height: chapterRowH,
              }}>
                {chapterNames[cg.chapter_id] ?? `Capítulo ${cgIdx + 1}`}
              </div>
              <div style={{ width: timelineWidthPx, height: chapterRowH, position: 'relative' }}>
                {weekOffsets.map((off, i) => (
                  <div key={`wk-${i}`} style={{
                    position: 'absolute', left: toLeftPx(off),
                    top: 0, bottom: 0,
                    borderLeft: '1px dotted rgba(0,0,0,0.08)',
                    pointerEvents: 'none',
                  }} />
                ))}
                {todayInRange && (
                  <div style={{
                    position: 'absolute', left: toLeftPx(todayOffsetDays),
                    top: 0, bottom: 0, borderLeft: '1px solid rgba(220,38,38,0.3)',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            </div>

            {/* Phase rows */}
            {cg.phases.map(ph => {
              const d         = phaseDates[ph.id]
              const baseline  = ph.template_phase_id ? baselineByTemplatePhase[ph.template_phase_id] : null
              const styling   = STATUS_STYLE[ph.status]
              const startOff  = d.start ? calOffset(d.start) : null
              const endOff    = d.end   ? calOffset(d.end)   : null
              const widthDays = startOff !== null && endOff !== null ? Math.max(0.5, endOff - startOff) : null
              const baselineOff = baseline ? calOffset(baseline.start) : null
              const baselineWidth = baseline ? Math.max(0.5, calOffset(baseline.end) - calOffset(baseline.start)) : null

              // ── Build rich tooltip lines ───────────────────────────────────
              const chapterLabel = ph.chapter_id ? (chapterNames[ph.chapter_id] ?? '—') : '—'
              const partnersLabel = ph.partner_ids.length > 0
                ? ph.partner_ids.map(pid => partnerNames[pid] ?? pid.slice(0, 8)).join(', ')
                : '— sin asignar'
              const plannedStart = parseISODate(ph.planned_start_date)
              const plannedEnd   = parseISODate(ph.planned_end_date)
              const actualStart  = parseISODate(ph.actual_start_date)
              const actualEnd    = parseISODate(ph.actual_end_date)

              const phaseTooltip: string[] = [
                `Fase: ${ph.nombre}`,
                `Capítulo: ${chapterLabel}`,
                `Partner: ${partnersLabel}`,
                `Estado: ${styling.label}`,
              ]
              if (baseline) {
                phaseTooltip.push(`Plan original: ${fmtDate(baseline.start)} → ${fmtDate(baseline.end)}`)
              }
              if (plannedStart && plannedEnd) {
                const dur = ph.planned_duration_dias != null ? ` (${Math.round(ph.planned_duration_dias)} días háb.)` : ''
                phaseTooltip.push(`Plan actual: ${fmtDate(plannedStart)} → ${fmtDate(plannedEnd)}${dur}`)
              }
              if (actualStart || actualEnd) {
                const dur = ph.actual_duration_dias != null ? ` (${Math.round(ph.actual_duration_dias)} días háb.)` : ''
                phaseTooltip.push(`Real: ${actualStart ? fmtDate(actualStart) : '—'} → ${actualEnd ? fmtDate(actualEnd) : '—'}${dur}`)
              }
              if (ph.pct_avance > 0) {
                phaseTooltip.push(`Avance: ${Math.round(ph.pct_avance)}%`)
              }
              if (ph.notas) phaseTooltip.push(`Notas: ${ph.notas}`)

              return (
                <div key={ph.id} style={{
                  display: 'flex',
                  borderTop: '1px solid #F8F7F4',
                  height: rowH,
                }}>
                  <div style={{
                    width: leftColW, flexShrink: 0,
                    position: 'sticky', left: 0, zIndex: 4,
                    background: '#fff',
                    borderRight: '1px solid #E8E6E0',
                    padding: '0 14px 0 28px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 11, color: '#555',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: styling.fill,
                      flexShrink: 0,
                    }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ph.nombre}
                    </span>
                    {ph.pct_avance > 0 && ph.status !== 'completada' && (
                      <span style={{ fontSize: 9, color: '#999', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(ph.pct_avance)}%
                      </span>
                    )}
                  </div>
                  <div style={{ width: timelineWidthPx, position: 'relative', height: rowH }}>
                    {/* Week lines (Mondays) — debajo de barras */}
                    {weekOffsets.map((off, i) => (
                      <div key={`wk-${i}`} style={{
                        position: 'absolute', left: toLeftPx(off),
                        top: 0, bottom: 0,
                        borderLeft: '1px dotted rgba(0,0,0,0.08)',
                        pointerEvents: 'none',
                      }} />
                    ))}
                    {/* Today line */}
                    {todayInRange && (
                      <div style={{
                        position: 'absolute', left: toLeftPx(todayOffsetDays),
                        top: 0, bottom: 0, borderLeft: '1px solid rgba(220,38,38,0.3)',
                        pointerEvents: 'none',
                      }} />
                    )}

                    {/* Shadow (baseline) — render BEHIND live bar */}
                    {shadowVisible && baselineOff !== null && baselineWidth !== null && (
                      <div
                        onMouseEnter={handleHover([
                          `${ph.nombre} — plan original (baseline)`,
                          `Capítulo: ${chapterLabel}`,
                          `${fmtDate(baseline!.start)} → ${fmtDate(baseline!.end)}`,
                        ])}
                        onMouseMove={handleMove}
                        onMouseLeave={clearHover}
                        style={{
                          position: 'absolute',
                          left:  toLeftPx(baselineOff),
                          width: toWidthPx(baselineWidth),
                          top: rowH / 2 - 7,
                          height: 14,
                          border: '1.5px dashed #999',
                          borderRadius: 3,
                          background: 'transparent',
                          pointerEvents: 'auto',
                          zIndex: 1,
                        }}
                      />
                    )}

                    {/* Live bar */}
                    {startOff !== null && widthDays !== null && (
                      <div
                        onClick={() => onPhaseClick?.(ph.id)}
                        onMouseEnter={handleHover(phaseTooltip)}
                        onMouseMove={handleMove}
                        onMouseLeave={clearHover}
                        style={{
                          position: 'absolute',
                          left:  toLeftPx(startOff),
                          width: toWidthPx(widthDays),
                          top: rowH / 2 - 9,
                          height: 18,
                          background: styling.fill,
                          border: `1px solid ${styling.border}`,
                          borderRadius: 4,
                          cursor: 'pointer',
                          zIndex: 2,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        {/* % avance fill (solo si en_curso) */}
                        {ph.status === 'en_curso' && ph.pct_avance > 0 && (
                          <div style={{
                            position: 'absolute',
                            left: 0, top: 0, bottom: 0,
                            width: `${ph.pct_avance}%`,
                            background: 'rgba(255,255,255,0.28)',
                            pointerEvents: 'none',
                          }} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Hover tooltip */}
      {hover && hover.lines.length > 0 && (
        <div style={{
          position: 'fixed',
          left: hover.x + 14, top: hover.y + 14,
          zIndex: 9999,
          background: '#1A1A1A', color: '#fff',
          padding: '8px 12px', borderRadius: 6,
          fontSize: 11, lineHeight: 1.5,
          maxWidth: 320,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {hover.lines.map((l, i) => (
            <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}

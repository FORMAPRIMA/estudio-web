// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import {
  computeParametricSchedule,
  formatScheduleDate,
  type ScheduleChapter,
  type ScheduleMilestone,
  type PhaseScheduleMap,
} from '@/lib/fp-execution/schedule'
import { addBusinessDays, snapToNextBusinessDay } from '@/lib/fp-execution/businessDays'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  headerBg: '#1A1A1A',
  brand:    '#D85A30',
  ink:      '#1A1A1A',
  soft:     '#555555',
  mid:      '#888888',
  meta:     '#AAAAAA',
  rule:     '#E6E4DF',
  light:    '#F8F7F4',
  faint:    '#FAFAF8',
  white:    '#FFFFFF',
  hInk:     '#F0EDE8',
  hMid:     '#888580',
  milestone: '#FFF7F0',
  milestoneBorder: '#FED7AA',
}

// Paleta de colores por capítulo (consistente con la UI)
const CAP_COLORS = ['#378ADD', '#D85A30', '#059669', '#7C3AED', '#0891B2', '#CA8A04', '#BE185D', '#0369A1']

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Page geometry ─────────────────────────────────────────────────────────────
// A3 landscape: 1191 x 842 pt · A2 landscape: 1684 x 1191 pt.
// Si el cronograma es muy denso, escalamos automáticamente a A2.
const A3_W = 1191
const A3_H = 842
const A2_W = 1684
const A2_H = 1191
const MARGIN_X = 36
const MARGIN_TOP = 24
const MARGIN_BOTTOM = 28

// Header brandeado
const HEADER_H = 78
const FOOTER_H = 24

// Área del Gantt
const LEFT_COL_W = 220
const GUTTER     = 4   // entre columna izquierda y barras

// Strip headers (deben coincidir con los usados en buildCronogramaElement)
const META_STRIP_H = 32
const MILESTONE_STRIP_H = 18
const MONTHS_ROW_H = 16
const WEEKS_ROW_H = 14
const STRIPS_GAP = 4
const LEGEND_H = 18

// Umbrales de auto-fit
const MIN_ROW_H_A3 = 12   // si la fila quedaría < 12pt en A3, escalamos a A2
const MAX_ROW_H    = 28

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CronogramaPDFData {
  projectName: string
  fechaInicio: string                                    // 'YYYY-MM-DD'
  m2: number | null
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor?: number                                // multiplicador global (default 1.0)
}

// ── Layout calculation ────────────────────────────────────────────────────────
function computeLayout(data: CronogramaPDFData) {
  const start = snapToNextBusinessDay(new Date(data.fechaInicio))
  const result = computeParametricSchedule(
    data.scheduleChapters,
    new Date(data.fechaInicio),
    data.m2,
    data.chapterDaysOverrides,
    data.duracionFactor ?? 1.0,
  )

  const schedule: PhaseScheduleMap = result.phases
  const totalDays = result.totalDays

  // Calendar span
  let latestMs = start.getTime()
  for (const id of Object.keys(schedule)) {
    const e = schedule[id]
    if (e && e.endDate.getTime() > latestMs) latestMs = e.endDate.getTime()
  }
  const calendarSpanDays = Math.max(1, (latestMs - start.getTime()) / 86400000)

  // Filas totales
  let totalRows = 0
  for (const ch of data.scheduleChapters) {
    if (ch.phases.length === 0) continue
    totalRows += 1                          // fila de capítulo
    totalRows += ch.phases.length           // filas de fases
  }
  totalRows = Math.max(totalRows, 1)

  // ── Auto-fit: prueba A3 horizontal, si las filas saldrían < MIN_ROW_H_A3 → A2 ──
  // contentTop usa los mismos valores que buildCronogramaElement para que no haya overshoot.
  const fixedHeader = MARGIN_TOP + HEADER_H + 12 + META_STRIP_H
  const stripsH     = MILESTONE_STRIP_H + MONTHS_ROW_H + WEEKS_ROW_H + STRIPS_GAP
  const computeFor = (pageW: number, pageH: number) => {
    const contentTop    = fixedHeader + stripsH
    const contentBottom = pageH - MARGIN_BOTTOM - FOOTER_H - LEGEND_H
    const availableH    = contentBottom - contentTop
    let rowH = Math.floor(availableH / totalRows)
    if (rowH > MAX_ROW_H) rowH = MAX_ROW_H
    // ganttLeft empieza en MARGIN_X + 20 (labelCol) + LEFT_COL_W + GUTTER,
    // y por la derecha respetamos otro MARGIN_X.
    const barsAreaW = pageW - (MARGIN_X + 20 + LEFT_COL_W + GUTTER) - MARGIN_X
    return { pageW, pageH, rowH, availableH, barsAreaW, contentTop }
  }

  let layout = computeFor(A3_W, A3_H)
  // Si en A3 horizontal las filas quedarían apretadas (< 12pt) → escalamos a A2 horizontal.
  if (layout.rowH < MIN_ROW_H_A3) {
    layout = computeFor(A2_W, A2_H)
  }

  const PAGE_W = layout.pageW
  const PAGE_H = layout.pageH
  const barsAreaW = layout.barsAreaW
  const dayPx = barsAreaW / calendarSpanDays
  // Mantenemos un piso de 10pt por fila (si pasamos a A2 con muchísimas fases) para que siempre quepan.
  const rowH = Math.max(10, layout.rowH)
  const chapterH = Math.max(14, Math.round(rowH * 0.9))

  // Posiciones helpers
  const startMs = start.getTime()
  const calOffset = (d: Date) => (d.getTime() - startMs) / 86400000

  // Milestones (latest endDate)
  const milestoneCalOffset: Record<string, number> = {}
  const milestoneEndDate: Record<string, Date> = {}
  for (const ch of data.scheduleChapters) {
    for (const ph of ch.phases) {
      const e = schedule[ph.id]
      if (!e) continue
      const off = calOffset(e.endDate)
      for (const mid of ph.achieves) {
        if (milestoneCalOffset[mid] === undefined || off > milestoneCalOffset[mid]) {
          milestoneCalOffset[mid] = off
          milestoneEndDate[mid] = e.endDate
        }
      }
    }
  }
  const activeMilestones = data.scheduleMilestones
    .filter(m => milestoneCalOffset[m.id] !== undefined)
    .sort((a, b) => (milestoneCalOffset[a.id] ?? 0) - (milestoneCalOffset[b.id] ?? 0))

  // Week markers
  const businessWeeks = Math.ceil(totalDays / 5)
  const weekStep = dayPx * 5 >= 50 ? 1 : dayPx * 5 >= 28 ? 2 : 4
  const weekMarkers: { week: number; cal: number }[] = []
  for (let w = 0; w <= businessWeeks; w += weekStep) {
    const date = addBusinessDays(start, w * 5)
    weekMarkers.push({ week: w, cal: calOffset(date) })
  }

  // Month markers — cálculo en UTC consistente con startMs (sin desfase por TZ).
  const monthMarkers: { label: string; cal: number; width: number; day1: number | null }[] = []
  {
    const s = new Date(startMs)
    let cursor = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1)
    const endMs = latestMs + 86400000
    while (cursor < endMs) {
      const cd = new Date(cursor)
      const next = Date.UTC(cd.getUTCFullYear(), cd.getUTCMonth() + 1, 1)
      const segStart = Math.max(cursor, startMs)
      const segEnd   = Math.min(next, endMs)
      const offsetDays = (segStart - startMs) / 86400000
      const widthDays  = (segEnd   - segStart) / 86400000
      const rawDay1 = (cursor - startMs) / 86400000
      const day1 = rawDay1 >= 0 ? rawDay1 : null
      if (widthDays > 0) {
        const label = `${MESES_CORTOS[cd.getUTCMonth()]} ${String(cd.getUTCFullYear()).slice(2)}`
        monthMarkers.push({ label, cal: offsetDays, width: widthDays, day1 })
      }
      cursor = next
    }
  }

  // Today (en UTC) en el eje del proyecto. null si está fuera del span.
  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )
  const todayOffsetDays = (todayMs - startMs) / 86400000
  const todayInRange = todayOffsetDays >= 0 && todayOffsetDays <= calendarSpanDays + 1
    ? todayOffsetDays
    : null

  return {
    schedule, totalDays, start, calendarSpanDays, dayPx,
    barsAreaW, rowH, chapterH,
    pageW: PAGE_W, pageH: PAGE_H,
    activeMilestones, milestoneCalOffset, milestoneEndDate,
    weekMarkers, monthMarkers,
    todayInRange,
    calOffset,
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.ink,
    backgroundColor: C.white,
  },

  // Header
  headerBlock: {
    backgroundColor: C.headerBg,
    height: HEADER_H,
    marginHorizontal: MARGIN_X,
    marginTop: MARGIN_TOP,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { width: 110, height: 'auto' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: {
    color: C.hInk,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: C.hMid,
    fontSize: 8,
    marginTop: 4,
  },
  headerProjectName: {
    color: C.white,
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
    maxWidth: 700,
  },
  headerAccent: {
    height: 2,
    marginTop: 8,
    backgroundColor: C.brand,
    opacity: 0.85,
    width: 80,
  },

  // Meta strip below header
  metaStrip: {
    flexDirection: 'row',
    paddingHorizontal: MARGIN_X + 20,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 30,
  },
  metaItem: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  metaLabel: {
    fontSize: 7,
    color: C.meta,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: MARGIN_BOTTOM,
    left: MARGIN_X,
    right: MARGIN_X,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.rule,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.mid },
})

// ── Build PDF element ─────────────────────────────────────────────────────────
export function buildCronogramaElement(data: CronogramaPDFData) {
  const L = computeLayout(data)
  const ganttLeft = MARGIN_X + 20 + LEFT_COL_W + GUTTER
  const barsW = L.barsAreaW

  const toX     = (cal: number) => ganttLeft + cal * L.dayPx
  const toW     = (cal: number) => Math.max(1.5, cal * L.dayPx)
  const labelCol = MARGIN_X + 20

  // Strip headers (constantes globales — el cálculo de layout las usa también)
  const milestoneStripH = MILESTONE_STRIP_H
  const monthsRowH      = MONTHS_ROW_H
  const weeksRowH       = WEEKS_ROW_H
  const stripsTop = MARGIN_TOP + HEADER_H + 12 + META_STRIP_H

  // Body rows
  const bodyTop = stripsTop + milestoneStripH + monthsRowH + weeksRowH + STRIPS_GAP

  const endDate = L.totalDays > 0
    ? addBusinessDays(L.start, Math.round(L.totalDays))
    : null

  // Rows model
  type Row =
    | { kind: 'chapter'; chIndex: number; label: string; color: string }
    | { kind: 'phase'; phaseId: string; phaseName: string; color: string; achievesIds: string[]; requiresIds: string[] }
  const rows: Row[] = []
  data.scheduleChapters.forEach((ch, ci) => {
    if (ch.phases.length === 0) return
    const color = CAP_COLORS[ci % CAP_COLORS.length]
    rows.push({ kind: 'chapter', chIndex: ci, label: ch.nombre, color })
    const phases = [...ch.phases].sort((a, b) => a.orden - b.orden)
    for (const ph of phases) {
      if (!L.schedule[ph.id]) continue
      rows.push({
        kind: 'phase',
        phaseId: ph.id,
        phaseName: ph.nombre,
        color,
        achievesIds: ph.achieves,
        requiresIds: ph.requires,
      })
    }
  })

  // Compute Y for each row
  const rowYs: number[] = []
  let y = bodyTop
  for (const r of rows) {
    rowYs.push(y)
    y += r.kind === 'chapter' ? L.chapterH : L.rowH
  }

  return (
    <Document>
      <Page size={[L.pageW, L.pageH]} style={s.page}>

        {/* Header brandeado */}
        <View style={s.headerBlock}>
          <View>
            <Image src={LOGO_BLANCO} style={s.logo} />
            <Text style={s.headerProjectName}>{data.projectName}</Text>
            <View style={s.headerAccent} />
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>Cronograma de obra</Text>
            <Text style={s.headerSubtitle}>FP Execution · Forma Prima</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={s.metaStrip}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Inicio</Text>
            <Text style={s.metaValue}>{formatScheduleDate(L.start)}</Text>
          </View>
          {endDate && (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Fin estimado</Text>
              <Text style={s.metaValue}>{formatScheduleDate(endDate)}</Text>
            </View>
          )}
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Duración</Text>
            <Text style={s.metaValue}>{Math.round(L.totalDays)} DL · {(L.totalDays / 5).toFixed(1)} sem</Text>
          </View>
          {data.m2 != null && (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Superficie</Text>
              <Text style={s.metaValue}>{data.m2} m²</Text>
            </View>
          )}
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Hitos</Text>
            <Text style={s.metaValue}>{L.activeMilestones.length}</Text>
          </View>
        </View>

        {/* ── Milestone strip ── */}
        {L.activeMilestones.length > 0 && (
          <>
            <Text style={{
              position: 'absolute',
              left: labelCol, top: stripsTop + 4,
              width: LEFT_COL_W - 4,
              fontSize: 7, color: C.meta,
              letterSpacing: 1, textTransform: 'uppercase',
              fontFamily: 'Helvetica-Bold',
            }}>
              Hitos
            </Text>

            {/* Packing greedy multi-fila simplificado: distribuir en 2 niveles si chocan */}
            {(() => {
              const ROW_H_CHIP = 10
              const lastRightPerRow: number[] = []
              return L.activeMilestones.map(m => {
                const x = toX(L.milestoneCalOffset[m.id])
                const chipW = Math.min(120, 22 + m.nombre.length * 4.2)
                let row = 0
                while (lastRightPerRow[row] !== undefined && lastRightPerRow[row] + 4 > x) row++
                lastRightPerRow[row] = x + chipW
                const chipY = stripsTop + row * ROW_H_CHIP
                return (
                  <View key={m.id}>
                    {/* Conector hasta el body */}
                    <View style={{
                      position: 'absolute',
                      left: x, top: chipY + 9,
                      width: 0.6,
                      height: bodyTop - (chipY + 9) - 2,
                      backgroundColor: C.brand,
                      opacity: 0.6,
                    }} />
                    {/* Ancla circular */}
                    <View style={{
                      position: 'absolute',
                      left: x - 2, top: chipY + 1,
                      width: 5, height: 5, borderRadius: 2.5,
                      backgroundColor: C.brand,
                    }} />
                    {/* Chip */}
                    <View style={{
                      position: 'absolute',
                      left: x + 4, top: chipY,
                      width: chipW, height: 9,
                      backgroundColor: C.milestone,
                      borderWidth: 0.6,
                      borderColor: C.milestoneBorder,
                      borderRadius: 2,
                      paddingHorizontal: 4,
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand,
                      }}>
                        {m.nombre}
                      </Text>
                    </View>
                  </View>
                )
              })
            })()}
          </>
        )}

        {/* ── Months header ── */}
        <Text style={{
          position: 'absolute',
          left: labelCol, top: stripsTop + milestoneStripH + 4,
          width: LEFT_COL_W - 4,
          fontSize: 7, color: C.mid,
          letterSpacing: 1, textTransform: 'uppercase',
          fontFamily: 'Helvetica-Bold',
        }}>
          Calendario
        </Text>
        {L.monthMarkers.map((mm, i) => (
          <View key={`m-${i}`}>
            <View style={{
              position: 'absolute',
              left: toX(mm.cal),
              top: stripsTop + milestoneStripH,
              width: toW(mm.width),
              height: monthsRowH,
              backgroundColor: C.faint,
              paddingLeft: 4,
              justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.soft }}>
                {mm.label}
              </Text>
            </View>
          </View>
        ))}
        {/* Marcadores del día 1 real de cada mes (línea + "1") */}
        {L.monthMarkers.map((mm, i) => {
          if (mm.day1 == null) return null
          return (
            <View key={`d1-${i}`}>
              <View style={{
                position: 'absolute',
                left: toX(mm.day1),
                top: stripsTop + milestoneStripH,
                width: 0.6,
                height: monthsRowH,
                backgroundColor: C.rule,
              }} />
              <Text style={{
                position: 'absolute',
                left: toX(mm.day1) + 1.5,
                top: stripsTop + milestoneStripH + 1,
                fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.meta,
              }}>1</Text>
            </View>
          )
        })}

        {/* ── Weeks header ── */}
        <Text style={{
          position: 'absolute',
          left: labelCol, top: stripsTop + milestoneStripH + monthsRowH + 2,
          width: LEFT_COL_W - 4,
          fontSize: 7, color: C.meta,
          letterSpacing: 1, textTransform: 'uppercase',
          fontFamily: 'Helvetica-Bold',
        }}>
          Capítulo / Fase
        </Text>
        {L.weekMarkers.map(wm => (
          <View key={`w-${wm.week}`}>
            <View style={{
              position: 'absolute',
              left: toX(wm.cal),
              top: stripsTop + milestoneStripH + monthsRowH,
              width: 0.5,
              height: weeksRowH,
              backgroundColor: C.rule,
            }} />
            <Text style={{
              position: 'absolute',
              left: toX(wm.cal) + 2,
              top: stripsTop + milestoneStripH + monthsRowH + 2,
              fontSize: 6.5, color: C.meta,
            }}>
              {wm.week === 0 ? 'Inicio' : `S${wm.week}`}
            </Text>
          </View>
        ))}

        {/* Línea inferior del header */}
        <View style={{
          position: 'absolute',
          left: ganttLeft, right: MARGIN_X,
          top: bodyTop - 2,
          height: 0.8,
          backgroundColor: C.ink,
        }} />

        {/* ── Milestone vertical lines across body ── */}
        {L.activeMilestones.map(m => (
          <View key={`mvl-${m.id}`} style={{
            position: 'absolute',
            left: toX(L.milestoneCalOffset[m.id]),
            top: bodyTop,
            width: 0.6,
            height: y - bodyTop,
            backgroundColor: C.brand,
            opacity: 0.25,
          }} />
        ))}

        {/* ── Línea roja del día de hoy (sólo si cae dentro del cronograma) ── */}
        {L.todayInRange !== null && (
          <>
            <View style={{
              position: 'absolute',
              left: toX(L.todayInRange),
              top: stripsTop + milestoneStripH,
              width: 1.2,
              height: y - (stripsTop + milestoneStripH),
              backgroundColor: '#DC2626',
              opacity: 0.7,
            }} />
            <View style={{
              position: 'absolute',
              left: toX(L.todayInRange) - 10,
              top: stripsTop + milestoneStripH - 12,
              width: 22, height: 10,
              backgroundColor: '#DC2626',
              borderRadius: 2,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#fff' }}>HOY</Text>
            </View>
          </>
        )}

        {/* ── Body rows ── */}
        {rows.map((row, idx) => {
          const yTop = rowYs[idx]
          if (row.kind === 'chapter') {
            return (
              <View key={`row-${idx}`}>
                {/* Etiqueta de capítulo */}
                <View style={{
                  position: 'absolute',
                  left: labelCol, top: yTop,
                  width: LEFT_COL_W, height: L.chapterH,
                  backgroundColor: row.color,
                  paddingHorizontal: 6,
                  justifyContent: 'center',
                }}>
                  <Text style={{
                    fontSize: 8,
                    fontFamily: 'Helvetica-Bold',
                    color: C.white,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}>
                    {row.label}
                  </Text>
                </View>
                {/* Banda tenue en el área de barras */}
                <View style={{
                  position: 'absolute',
                  left: ganttLeft, top: yTop,
                  width: barsW, height: L.chapterH,
                  backgroundColor: row.color,
                  opacity: 0.12,
                }} />
              </View>
            )
          }

          // Phase row
          const entry = L.schedule[row.phaseId]
          if (!entry) return null
          const startCal = L.calOffset(entry.startDate)
          const endCal   = L.calOffset(entry.endDate)
          const wDays    = Math.max(0, endCal - startCal)
          const durD     = entry.durationDays
          const barH     = Math.min(L.rowH - 4, 14)
          const labelInside = toW(wDays) >= 32

          return (
            <View key={`row-${idx}`}>
              {/* Background sutil para fila zebra */}
              {idx % 2 === 0 && (
                <View style={{
                  position: 'absolute',
                  left: ganttLeft, top: yTop,
                  width: barsW, height: L.rowH,
                  backgroundColor: C.faint,
                }} />
              )}

              {/* Etiqueta de fase */}
              <View style={{
                position: 'absolute',
                left: labelCol, top: yTop,
                width: LEFT_COL_W - 4, height: L.rowH,
                paddingLeft: 4, paddingRight: 6,
                justifyContent: 'center',
                borderRightWidth: 0.6, borderRightColor: C.rule,
              }}>
                <Text style={{
                  fontSize: 8.5,
                  color: C.ink,
                }}>
                  {row.requiresIds.length > 0 ? '▶ ' : ''}{row.phaseName}
                </Text>
              </View>

              {/* Barra */}
              <View style={{
                position: 'absolute',
                left: toX(startCal),
                top: yTop + (L.rowH - barH) / 2,
                width: toW(wDays),
                height: barH,
                backgroundColor: row.color,
                borderRadius: 2,
              }}>
                {labelInside && (
                  <Text style={{
                    position: 'absolute',
                    left: 4, top: (barH - 8) / 2,
                    fontSize: 7,
                    fontFamily: 'Helvetica-Bold',
                    color: C.white,
                  }}>
                    {Math.round(durD)} DL
                  </Text>
                )}
              </View>

              {/* Círculos de hito al final de la barra (uno por hito logrado) */}
              {row.achievesIds.map((mid, i) => {
                const exists = L.milestoneCalOffset[mid] !== undefined
                if (!exists) return null
                const cx = toX(endCal) + (i * 9) - 4
                const cy = yTop + L.rowH / 2
                return (
                  <View key={`ach-${idx}-${mid}`}>
                    <View style={{
                      position: 'absolute',
                      left: cx - 3, top: cy - 3,
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: C.white,
                      borderWidth: 1.2, borderColor: C.brand,
                    }} />
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Cronograma generado por Forma Prima · Estimación paramétrica en días laborables
          </Text>
          <Text style={s.footerText}>
            {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Text>
        </View>

      </Page>
    </Document>
  )
}

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  computeAwardedSchedule,
  type ScheduleChapter,
  type ScheduleMilestone,
  type AwardedPhaseDuration,
  type ProjectUnitChapterMap,
} from '@/lib/fp-execution/schedule'
import {
  computeCashFlow,
  type CashFlowInputPartner,
  type PaymentEvent,
} from '@/lib/fp-execution/cashflow'
import type { FpeOverviewPartner } from '@/app/actions/fpe-tenders'

// Paleta sobria por partner — consistente con la marca Forma Prima.
// Asignación estable por hash del partner_id (cíclica si hay >8 partners).
const PARTNER_PALETTE = [
  '#D85A30',  // brand orange
  '#1F3A5F',  // navy
  '#5C6B5A',  // olive
  '#7C5A4A',  // warm brown
  '#456478',  // steel blue
  '#8C7355',  // ochre
  '#3D5847',  // forest
  '#7B4F62',  // muted plum
] as const

function partnerColor(partnerId: string): string {
  let h = 0
  for (let i = 0; i < partnerId.length; i++) h = (h * 31 + partnerId.charCodeAt(i)) >>> 0
  return PARTNER_PALETTE[h % PARTNER_PALETTE.length]
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const eur0 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
const eur2 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const compactEur = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M €'
  if (n >= 1_000)     return (n / 1_000).toFixed(n >= 100_000 ? 0 : 0) + 'k €'
  return Math.round(n) + ' €'
}

const formatDateShort = (d: Date) =>
  d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Component ───────────────────────────────────────────────────────────────

export default function CashFlowChart({
  partners,
  scheduleChapters,
  scheduleMilestones: _scheduleMilestones,
  fechaInicio,
  m2,
  chapterDaysOverrides,
  duracionFactor,
}: {
  partners:             FpeOverviewPartner[]
  scheduleChapters:     ScheduleChapter[]
  scheduleMilestones:   ScheduleMilestone[]
  fechaInicio:          string | null
  m2:                   number | null
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor:       number
}) {
  const [showTable, setShowTable] = useState(false)
  const [showWarnings, setShowWarnings] = useState(false)

  const startDate = fechaInicio ? new Date(fechaInicio) : new Date()

  // ── Inputs derivados (idéntico patrón a AwardedGantt) ────────────────────
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

  const schedule = useMemo(
    () => computeAwardedSchedule(scheduleChapters, startDate, m2, chapterDaysOverrides, duracionFactor, awardedDurations, unitChapters),
    [scheduleChapters, startDate, m2, chapterDaysOverrides, duracionFactor, awardedDurations, unitChapters]
  )

  const contractDateByPartner: Record<string, Date | null> = useMemo(() => {
    const m: Record<string, Date | null> = {}
    for (const p of partners) {
      const c = p.contract
      if (!c) { m[p.partner_id] = null; continue }
      const ref = c.signed_at ?? c.sent_at
      m[p.partner_id] = ref ? new Date(ref) : null
    }
    return m
  }, [partners])

  const cashFlowInput: CashFlowInputPartner[] = useMemo(() => partners.map(p => ({
    partner_id:         p.partner_id,
    partner_nombre:     p.partner_nombre,
    total:              p.total,
    payment_milestones: p.payment_milestones,
  })), [partners])

  const cashFlow = useMemo(
    () => computeCashFlow(cashFlowInput, schedule, startDate, contractDateByPartner),
    [cashFlowInput, schedule, startDate, contractDateByPartner]
  )

  // events agrupados por (weekKey, partner_id) → permite tooltips ricos con
  // los hitos de pago concretos en cada barra apilada.
  const eventsByWeekPartner = useMemo(() => {
    const m: Record<string, Record<string, PaymentEvent[]>> = {}
    for (const ev of cashFlow.events) {
      if (!ev.date) continue
      const d = new Date(ev.date)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const monday = new Date(d)
      monday.setDate(d.getDate() + diff)
      monday.setHours(0, 0, 0, 0)
      const key = monday.toISOString().slice(0, 10)
      if (!m[key]) m[key] = {}
      if (!m[key][ev.partner_id]) m[key][ev.partner_id] = []
      m[key][ev.partner_id].push(ev)
    }
    return m
  }, [cashFlow.events])

  // ── Estado vacío ─────────────────────────────────────────────────────────
  if (cashFlow.weeks.length === 0 && cashFlow.undated.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
          No hay hitos de pago configurados todavía.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#AAA' }}>
          Configura los hitos de pago por disciplina para ver el flujo económico.
        </p>
      </div>
    )
  }

  // ── KPIs accionables ─────────────────────────────────────────────────────
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  const paidUntilToday = cashFlow.events
    .filter(e => e.date && e.date.getTime() <= todayMs)
    .reduce((a, e) => a + e.monto, 0)

  const pending = Math.max(0, cashFlow.grandTotal - paidUntilToday)

  const nextEvent = cashFlow.events.find(e => e.date && e.date.getTime() > todayMs) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiStrip
        total={cashFlow.grandTotal}
        paid={paidUntilToday}
        pending={pending}
        nextEvent={nextEvent}
        undatedCount={cashFlow.undated.length}
        fallbackCount={cashFlow.fallbacks.length}
        showWarnings={showWarnings}
        onToggleWarnings={() => setShowWarnings(v => !v)}
      />

      {showWarnings && (cashFlow.undated.length > 0 || cashFlow.fallbacks.length > 0) && (
        <WarningPanel undated={cashFlow.undated} fallbacks={cashFlow.fallbacks} />
      )}

      <ChartPanel
        weeks={cashFlow.weeks}
        partners={partners}
        eventsByWeekPartner={eventsByWeekPartner}
        todayMs={todayMs}
      />

      <PartnerBreakdown
        partners={partners}
        eventsByPartner={
          cashFlow.events.reduce((acc, e) => {
            (acc[e.partner_id] ??= []).push(e)
            return acc
          }, {} as Record<string, PaymentEvent[]>)
        }
        todayMs={todayMs}
      />

      <details
        open={showTable}
        onToggle={(e) => setShowTable((e.target as HTMLDetailsElement).open)}
        style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden' }}
      >
        <summary style={{
          padding: '14px 20px',
          cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888',
          listStyle: 'none',
        }}>
          {showTable ? '▼' : '▶'} Tabla detallada por semana
        </summary>
        <DetailedTable weeks={cashFlow.weeks} partners={partners} />
      </details>
    </div>
  )
}

// ── KPI strip ───────────────────────────────────────────────────────────────

function KpiStrip({
  total, paid, pending, nextEvent,
  undatedCount, fallbackCount, showWarnings, onToggleWarnings,
}: {
  total: number
  paid: number
  pending: number
  nextEvent: PaymentEvent | null
  undatedCount: number
  fallbackCount: number
  showWarnings: boolean
  onToggleWarnings: () => void
}) {
  const pctPaid = total > 0 ? (paid / total) * 100 : 0
  const warningCount = undatedCount + fallbackCount

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 1,
      background: '#E8E6E0',
      borderRadius: 10,
      border: '1px solid #E8E6E0',
      overflow: 'hidden',
    }}>
      <Kpi
        label="Total contratado"
        value={eur2(total)}
        accent="#1A1A1A"
      />
      <Kpi
        label="Pagado hasta hoy"
        value={eur0(paid)}
        sub={total > 0 ? `${pctPaid.toFixed(0)}% del total` : undefined}
        accent="#059669"
      >
        {total > 0 && (
          <div style={{
            marginTop: 8, height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, pctPaid)}%`, height: '100%', background: '#059669',
            }} />
          </div>
        )}
      </Kpi>
      <Kpi
        label="Pendiente"
        value={eur0(pending)}
        accent="#D85A30"
      />
      <Kpi
        label="Próximo desembolso"
        value={nextEvent && nextEvent.date ? eur0(nextEvent.monto) : '—'}
        sub={nextEvent && nextEvent.date
          ? `${formatDateShort(nextEvent.date)} · ${nextEvent.partner_nombre}`
          : 'Nada programado'}
        accent="#1A1A1A"
      />
      {warningCount > 0 && (
        <button
          onClick={onToggleWarnings}
          style={{
            background: '#FFF7F0',
            padding: '14px 18px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            gridColumn: 'span 1',
          }}
        >
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#9A3F1B', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ⚠ Avisos
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#9A3F1B', marginTop: 4 }}>
            {warningCount} hito{warningCount !== 1 ? 's' : ''} con fecha aproximada
          </div>
          <div style={{ fontSize: 10, color: '#9A3F1B', opacity: 0.7, marginTop: 2 }}>
            {showWarnings ? 'Ocultar detalles ▲' : 'Ver detalles ▼'}
          </div>
        </button>
      )}
    </div>
  )
}

function Kpi({
  label, value, sub, accent, children,
}: {
  label: string
  value: string
  sub?: string
  accent: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', padding: '14px 18px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700, color: accent,
        fontFamily: 'monospace', marginTop: 4, lineHeight: 1.2,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Warning panel ───────────────────────────────────────────────────────────

function WarningPanel({
  undated, fallbacks,
}: {
  undated:   PaymentEvent[]
  fallbacks: PaymentEvent[]
}) {
  return (
    <div style={{
      background: '#FFF7F0',
      border: '1px solid #F4C9A8',
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {fallbacks.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A3F1B' }}>
            Fecha estimada ({fallbacks.length})
          </div>
          <div style={{ fontSize: 11, color: '#9A3F1B', opacity: 0.75, marginTop: 2 }}>
            El hito de obra asociado no se alcanza en este proyecto · plotado al cierre del partner.
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#1A1A1A' }}>
            {fallbacks.map((e, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                <strong>{e.partner_nombre}</strong> — {e.milestone_nombre} · <span style={{ fontFamily: 'monospace' }}>{eur0(e.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {undated.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#92400E' }}>
            Sin fecha ({undated.length})
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#1A1A1A' }}>
            {undated.map((e, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                <strong>{e.partner_nombre}</strong> — {e.milestone_nombre} · <span style={{ fontFamily: 'monospace' }}>{eur0(e.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Chart ───────────────────────────────────────────────────────────────────

function ChartPanel({
  weeks, partners, eventsByWeekPartner, todayMs,
}: {
  weeks:               { weekStart: Date; weekLabel: string; byPartner: Record<string, number>; total: number; cumulative: number }[]
  partners:            FpeOverviewPartner[]
  eventsByWeekPartner: Record<string, Record<string, PaymentEvent[]>>
  todayMs:             number
}) {
  // Responsive width
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(900)
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width)
      if (w > 0) setChartW(Math.max(600, w))
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const [hover, setHover] = useState<{ lines: string[]; x: number; y: number } | null>(null)
  const handleHover = (lines: string[]) => (e: React.MouseEvent) => setHover({ lines, x: e.clientX, y: e.clientY })
  const handleMove  = (e: React.MouseEvent) => setHover(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
  const clearHover  = () => setHover(null)

  if (weeks.length === 0) {
    return (
      <div ref={containerRef} style={{ padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', color: '#888', fontSize: 12 }}>
        Todos los hitos de pago están sin fecha. Configura los hitos de obra para visualizar el flujo.
      </div>
    )
  }

  // Layout
  const CHART_H = 320
  const PAD_L   = 70
  const PAD_R   = 80
  const PAD_T   = 50  // espacio para month header
  const PAD_B   = 32
  const PLOT_W  = Math.max(200, chartW - PAD_L - PAD_R)
  const PLOT_H  = CHART_H - PAD_T - PAD_B

  // Calendar span: del lunes de la primera semana al domingo de la última.
  const minMs = weeks[0].weekStart.getTime()
  const maxMs = weeks[weeks.length - 1].weekStart.getTime() + 7 * 86400000
  const totalMs = Math.max(1, maxMs - minMs)
  const xFromMs = (t: number) => PAD_L + ((t - minMs) / totalMs) * PLOT_W

  const weekWidthPx = (7 * 86400000 / totalMs) * PLOT_W
  const barInnerW   = Math.max(2, weekWidthPx * 0.78)
  const barOffset   = (weekWidthPx - barInnerW) / 2

  // Scales — eje izquierdo = monto por semana; eje derecho = acumulado.
  const maxWeekTotal  = Math.max(1, ...weeks.map(w => w.total))
  const maxCumulative = Math.max(1, weeks[weeks.length - 1]?.cumulative ?? 0)

  // Y ticks (4 segmentos)
  const yTicks = 4
  const tickValues: number[] = []
  for (let i = 0; i <= yTicks; i++) tickValues.push((maxWeekTotal * i) / yTicks)

  // Month markers (UTC, mismo cálculo que el Gantt)
  const monthMarkers: { label: string; xStart: number; xEnd: number; day1X: number | null }[] = []
  {
    const start = new Date(minMs)
    let cursor  = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    const endMs = maxMs
    while (cursor < endMs) {
      const cursorDate = new Date(cursor)
      const next       = Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() + 1, 1)
      const segStart   = Math.max(cursor, minMs)
      const segEnd     = Math.min(next, endMs)
      const rawDay1    = cursor
      const day1X      = rawDay1 >= minMs ? xFromMs(rawDay1) : null
      if (segEnd > segStart) {
        const label = `${MESES_CORTOS[cursorDate.getUTCMonth()]} ${String(cursorDate.getUTCFullYear()).slice(2)}`
        monthMarkers.push({
          label,
          xStart: xFromMs(segStart),
          xEnd:   xFromMs(segEnd),
          day1X,
        })
      }
      cursor = next
    }
  }

  // HOY
  const todayInRange = todayMs >= minMs && todayMs <= maxMs
  const todayX       = todayInRange ? xFromMs(todayMs) : null

  // Cumulative line points
  const cumPoints = weeks.map(w => ({
    x: xFromMs(w.weekStart.getTime() + 3.5 * 86400000),
    y: PAD_T + PLOT_H - (w.cumulative / maxCumulative) * PLOT_H,
  }))
  const cumPath = cumPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const cumArea = cumPoints.length > 1
    ? `M ${cumPoints[0].x.toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} ` +
      cumPoints.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
      ` L ${cumPoints[cumPoints.length - 1].x.toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} Z`
    : ''

  return (
    <div
      ref={containerRef}
      onMouseLeave={clearHover}
      style={{
        background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0',
        padding: '14px 0 4px',
        position: 'relative',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
            Flujo económico
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            Desembolsos por semana · curva acumulada
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#888' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1F3A5F' }} />
            Barra = por semana (eje izq.)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2, background: '#D85A30' }} />
            Acumulado (eje der.)
          </span>
        </div>
      </div>

      <svg width={chartW} height={CHART_H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#D85A30" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#D85A30" stopOpacity={0}    />
          </linearGradient>
        </defs>

        {/* Month header */}
        <g>
          {monthMarkers.map((mm, i) => (
            <g key={`m-${i}`}>
              <rect x={mm.xStart} y={6} width={Math.max(0, mm.xEnd - mm.xStart)} height={20} fill="#FAFAF8" />
              <text x={mm.xStart + 6} y={20} fontSize={11} fontWeight={600} fill="#555">
                {mm.label}
              </text>
              {mm.day1X != null && (
                <>
                  <line x1={mm.day1X} y1={6} x2={mm.day1X} y2={PAD_T + PLOT_H} stroke="#E8E6E0" strokeWidth={1} />
                  <text x={mm.day1X + 2} y={14} fontSize={8} fontWeight={700} fill="#888">1</text>
                </>
              )}
            </g>
          ))}
        </g>

        {/* Y-axis grid + left labels */}
        {tickValues.map((v, i) => {
          const y = PAD_T + PLOT_H - (v / maxWeekTotal) * PLOT_H
          return (
            <g key={`y-${i}`}>
              <line x1={PAD_L} y1={y} x2={PAD_L + PLOT_W} y2={y} stroke="#F4F2EC" strokeWidth={1} />
              <text x={PAD_L - 8} y={y + 3} fontSize={9} fill="#AAA" textAnchor="end">
                {compactEur(v)}
              </text>
            </g>
          )
        })}

        {/* Right Y-axis (cumulative) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PAD_T + PLOT_H - t * PLOT_H
          return (
            <text key={`yr-${i}`} x={PAD_L + PLOT_W + 8} y={y + 3} fontSize={9} fill="#D85A30">
              {compactEur(maxCumulative * t)}
            </text>
          )
        })}

        {/* Axis caption */}
        <text x={PAD_L} y={PAD_T - 4} fontSize={9} fill="#888" fontWeight={700} letterSpacing="0.06em">
          POR SEMANA
        </text>
        <text x={PAD_L + PLOT_W} y={PAD_T - 4} fontSize={9} fill="#D85A30" fontWeight={700} letterSpacing="0.06em" textAnchor="end">
          ACUMULADO
        </text>

        {/* Cumulative area (background, sutil) */}
        {cumArea && <path d={cumArea} fill="url(#cumGradient)" />}

        {/* Stacked bars per week */}
        {weeks.map((w, i) => {
          const x = xFromMs(w.weekStart.getTime()) + barOffset
          const weekKey = w.weekStart.toISOString().slice(0, 10)
          let acc = 0
          return (
            <g key={i}>
              {partners.map(p => {
                const amount = w.byPartner[p.partner_id] ?? 0
                if (amount === 0) return null
                const h = (amount / maxWeekTotal) * PLOT_H
                const y = PAD_T + PLOT_H - (acc + amount) / maxWeekTotal * PLOT_H
                acc += amount
                const evts = eventsByWeekPartner[weekKey]?.[p.partner_id] ?? []
                const lines = [
                  `${p.partner_nombre}`,
                  `${w.weekLabel}`,
                  `Pago: ${eur0(amount)}`,
                  `Total proyecto: ${eur0(p.total)} · ${p.total > 0 ? ((amount / p.total) * 100).toFixed(0) : 0}%`,
                  ...evts.map(e =>
                    `· ${e.milestone_nombre}${e.fallback_reason ? ' (fecha estimada)' : ''}`
                  ),
                ]
                return (
                  <rect
                    key={p.partner_id}
                    x={x} y={y} width={barInnerW} height={Math.max(1, h)}
                    fill={partnerColor(p.partner_id)}
                    onMouseEnter={handleHover(lines)}
                    onMouseMove={handleMove}
                    onMouseLeave={clearHover}
                    style={{ cursor: 'default' }}
                  >
                  </rect>
                )
              })}
            </g>
          )
        })}

        {/* Cumulative line */}
        {cumPath && (
          <path d={cumPath} stroke="#D85A30" strokeWidth={2} fill="none" strokeLinejoin="round" />
        )}
        {cumPoints.map((p, i) => (
          <circle
            key={`cp-${i}`}
            cx={p.x} cy={p.y} r={3}
            fill="#fff" stroke="#D85A30" strokeWidth={1.5}
            onMouseEnter={handleHover([
              weeks[i].weekLabel,
              `Acumulado: ${eur0(weeks[i].cumulative)}`,
              `Semana: ${eur0(weeks[i].total)}`,
            ])}
            onMouseMove={handleMove}
            onMouseLeave={clearHover}
            style={{ cursor: 'default' }}
          />
        ))}

        {/* HOY */}
        {todayX != null && (
          <g pointerEvents="none">
            <line x1={todayX} y1={PAD_T - 2} x2={todayX} y2={PAD_T + PLOT_H} stroke="#DC2626" strokeWidth={1.5} />
            <rect x={todayX - 18} y={PAD_T - 18} width={36} height={14} rx={3} fill="#DC2626" />
            <text x={todayX} y={PAD_T - 8} fontSize={9} fontWeight={700} fill="#fff" textAnchor="middle" letterSpacing="0.06em">
              HOY
            </text>
          </g>
        )}

        {/* Bottom baseline */}
        <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} stroke="#E8E6E0" strokeWidth={1} />
      </svg>

      {/* Partner legend */}
      <div style={{
        padding: '10px 20px 14px',
        display: 'flex', gap: 14, flexWrap: 'wrap',
        fontSize: 11,
        borderTop: '1px solid #F4F2EC',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', alignSelf: 'center' }}>
          Partners
        </span>
        {partners.map(p => (
          <span key={p.partner_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: partnerColor(p.partner_id) }} />
            <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{p.partner_nombre}</span>
          </span>
        ))}
      </div>

      {/* Floating tooltip */}
      {hover && (
        <div style={{
          position: 'fixed',
          left: hover.x + 14,
          top:  hover.y + 14,
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

// ── Partner breakdown (cuánto debe cobrar cada partner total/pagado/pendiente) ─

function PartnerBreakdown({
  partners, eventsByPartner, todayMs,
}: {
  partners:         FpeOverviewPartner[]
  eventsByPartner:  Record<string, PaymentEvent[]>
  todayMs:          number
}) {
  if (partners.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EEE8' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
          Por partner
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {partners.map((p, idx) => {
          const evts   = eventsByPartner[p.partner_id] ?? []
          const paid   = evts.filter(e => e.date && e.date.getTime() <= todayMs).reduce((a, e) => a + e.monto, 0)
          const total  = p.total
          const pending = Math.max(0, total - paid)
          const pct    = total > 0 ? (paid / total) * 100 : 0
          return (
            <div key={p.partner_id} style={{
              padding: '12px 20px',
              borderTop: idx > 0 ? '1px solid #F4F2EC' : 'none',
              display: 'grid',
              gridTemplateColumns: '14px minmax(140px, 1.2fr) 1fr 1fr 1fr',
              gap: 14,
              alignItems: 'center',
              fontSize: 12,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: partnerColor(p.partner_id) }} />
              <div style={{ fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.partner_nombre}
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#AAA', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div>
                <div style={{ fontFamily: 'monospace', color: '#1A1A1A', fontWeight: 600, marginTop: 1 }}>
                  {eur0(total)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#AAA', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pagado</div>
                <div style={{ fontFamily: 'monospace', color: '#059669', fontWeight: 600, marginTop: 1 }}>
                  {eur0(paid)}
                </div>
                <div style={{ height: 3, background: '#F0EEE8', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: '#059669' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#AAA', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pendiente</div>
                <div style={{ fontFamily: 'monospace', color: '#D85A30', fontWeight: 600, marginTop: 1 }}>
                  {eur0(pending)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Detailed table ──────────────────────────────────────────────────────────

function DetailedTable({
  weeks, partners,
}: {
  weeks:    { weekLabel: string; byPartner: Record<string, number>; total: number; cumulative: number }[]
  partners: FpeOverviewPartner[]
}) {
  return (
    <div style={{ maxHeight: 420, overflow: 'auto', borderTop: '1px solid #F0EEE8' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 600 }}>
        <thead>
          <tr style={{ background: '#1A1A1A', position: 'sticky', top: 0, zIndex: 1 }}>
            <th style={th('left')}>SEMANA</th>
            {partners.map(p => (
              <th key={p.partner_id} style={th('right')}>{p.partner_nombre}</th>
            ))}
            <th style={{ ...th('right'), background: '#000' }}>TOTAL</th>
            <th style={{ ...th('right'), background: '#000', color: '#D85A30' }}>ACUM.</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid #F4F2EC' }}>
              <td style={{ padding: '7px 12px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>{w.weekLabel}</td>
              {partners.map(p => {
                const a = w.byPartner[p.partner_id] ?? 0
                return (
                  <td key={p.partner_id} style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', color: a > 0 ? '#1A1A1A' : '#D0CDC5' }}>
                    {a > 0 ? eur0(a) : '—'}
                  </td>
                )
              })}
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                {w.total > 0 ? eur0(w.total) : '—'}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#D85A30' }}>
                {eur0(w.cumulative)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function th(align: 'left' | 'right'): React.CSSProperties {
  return {
    padding: '10px 12px',
    textAlign: align,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  }
}

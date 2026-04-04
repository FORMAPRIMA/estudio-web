'use client'

import { useMemo, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Factura {
  monto: number
  fecha_pago_acordada: string | null
  status: string
}

interface SectionMargin {
  seccion: string
  billingTotal: number
  costTotal: number
  margin: number | null
}

interface KPIs {
  avgProjectMargin: number | null
  projectCount: number
  sectionMargins: SectionMargin[]
}

interface Props {
  facturas: Factura[]
  year: number
  monthlyCosts: Record<number, number>   // 0-indexed month → total cost
  kpis: KPIs
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TARGET_MONTHLY = 67_000

const STATUS_ORDER = ['acordada_contrato', 'cobrable', 'enviada', 'pagada', 'impagada'] as const

const STATUS_META: Record<string, { label: string; color: string }> = {
  acordada_contrato: { label: 'En contrato',  color: '#C8C4BC' },
  cobrable:          { label: 'Cobrable',     color: '#378ADD' },
  enviada:           { label: 'Enviada',      color: '#E8913A' },
  pagada:            { label: 'Pagada',       color: '#1D9E75' },
  impagada:          { label: 'Impagada',     color: '#E53E3E' },
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const fmtK  = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`
const fmtK1 = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v.toFixed(0)}`
const fmtFull = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── Chart ─────────────────────────────────────────────────────────────────────

function BillingChart({ facturas, year, monthlyCosts }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; month: string
    segments: { label: string; color: string; value: number }[]
    billingTotal: number; costTotal: number
  } | null>(null)

  const monthData = useMemo(() => {
    const grid: Record<number, Record<string, number>> = {}
    for (let m = 0; m < 12; m++) grid[m] = {}
    for (const f of facturas) {
      if (!f.fecha_pago_acordada) continue
      const d = new Date(f.fecha_pago_acordada)
      if (d.getFullYear() !== year) continue
      const m = d.getMonth()
      grid[m][f.status] = (grid[m][f.status] ?? 0) + f.monto
    }
    return grid
  }, [facturas, year])

  const maxVal = useMemo(() => {
    let max = TARGET_MONTHLY * 1.2
    for (let m = 0; m < 12; m++) {
      const billing = Object.values(monthData[m]).reduce((s, v) => s + v, 0)
      const cost    = monthlyCosts[m] ?? 0
      if (billing > max) max = billing
      if (cost    > max) max = cost
    }
    return max * 1.08
  }, [monthData, monthlyCosts])

  // Chart dimensions
  const W = 920
  const H = 360
  const PADDING_LEFT   = 56
  const PADDING_RIGHT  = 24
  const PADDING_TOP    = 56   // extra room for labels above bars
  const PADDING_BOTTOM = 40
  const chartW = W - PADDING_LEFT - PADDING_RIGHT
  const chartH = H - PADDING_TOP - PADDING_BOTTOM
  const slotW  = chartW / 12

  // Two bars per month
  const billingW = slotW * 0.40
  const costW    = slotW * 0.17
  const barGap   = 3
  const pairW    = billingW + barGap + costW

  const toY = (v: number) => PADDING_TOP + chartH - (v / maxVal) * chartH
  const pairLeft = (m: number) => PADDING_LEFT + m * slotW + (slotW - pairW) / 2
  const billingX = (m: number) => pairLeft(m)
  const costX    = (m: number) => pairLeft(m) + billingW + barGap

  const tickCount = 5
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxVal / tickCount) * i / 1000) * 1000
  )
  const targetY = toY(TARGET_MONTHLY)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines */}
        {ticks.map(tick => {
          const y = toY(tick)
          return (
            <g key={tick}>
              <line x1={PADDING_LEFT} y1={y} x2={W - PADDING_RIGHT} y2={y}
                stroke={tick === 0 ? '#D4D0C8' : '#ECEAE4'}
                strokeWidth={tick === 0 ? 1 : 0.75}
              />
              <text x={PADDING_LEFT - 8} y={y + 4} textAnchor="end" fontSize={9}
                fill="#BBB" fontFamily="'Inter', system-ui, sans-serif"
              >
                {fmtK(tick)}
              </text>
            </g>
          )
        })}

        {/* Target line */}
        <line x1={PADDING_LEFT} y1={targetY} x2={W - PADDING_RIGHT} y2={targetY}
          stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.75}
        />
        <text x={W - PADDING_RIGHT + 4} y={targetY + 4}
          fontSize={8.5} fill="#1D9E75" fontFamily="'Inter', system-ui, sans-serif" fontWeight={600}
        >
          obj.
        </text>

        {/* Bars + labels per month */}
        {Array.from({ length: 12 }, (_, m) => {
          const data         = monthData[m]
          const costTotal    = monthlyCosts[m] ?? 0
          const segments     = STATUS_ORDER
            .map(s => ({ status: s, value: data[s] ?? 0, meta: STATUS_META[s] }))
            .filter(s => s.value > 0)
          const billingTotal = segments.reduce((s, seg) => s + seg.value, 0)
          const diff         = billingTotal - costTotal
          const hasCost      = costTotal > 0
          const hasBilling   = billingTotal > 0

          // Billing bar (stacked)
          const barsX = billingX(m)
          let stackY  = PADDING_TOP + chartH

          // Label Y positions — float just above each bar
          const billingTopY = hasBilling ? toY(billingTotal) : PADDING_TOP + chartH
          const costTopY    = hasCost    ? toY(costTotal)    : PADDING_TOP + chartH
          const diffTopY    = clamp(Math.min(billingTopY, costTopY) - 18, 4, PADDING_TOP - 6)
          const billLabelY  = clamp(billingTopY - 5, PADDING_TOP - 4, PADDING_TOP + chartH - 6)
          const costLabelY  = clamp(costTopY    - 5, PADDING_TOP - 4, PADDING_TOP + chartH - 6)

          const pairCenterX = pairLeft(m) + pairW / 2

          return (
            <g key={m}>
              {/* Billing stacked bars */}
              {segments.map(({ status, value, meta }) => {
                const h = (value / maxVal) * chartH
                stackY -= h
                const isTop = status === segments[segments.length - 1].status
                return (
                  <rect key={status}
                    x={barsX} y={stackY} width={billingW} height={h}
                    fill={meta.color}
                    rx={isTop ? 2 : 0} ry={isTop ? 2 : 0}
                  />
                )
              })}

              {/* Cost bar (thin, red) */}
              {hasCost && (() => {
                const h = (costTotal / maxVal) * chartH
                const cy = toY(costTotal)
                return (
                  <rect
                    x={costX(m)} y={cy} width={costW} height={h}
                    fill="#D85A30" rx={2} ry={2} opacity={0.85}
                  />
                )
              })()}

              {/* Labels above billing bar */}
              {hasBilling && (
                <text
                  x={barsX + billingW / 2} y={billLabelY}
                  textAnchor="middle" fontSize={7.5}
                  fill="#666" fontFamily="'Inter', system-ui, sans-serif"
                >
                  {fmtK1(billingTotal)}
                </text>
              )}

              {/* Label above cost bar */}
              {hasCost && (
                <text
                  x={costX(m) + costW / 2} y={costLabelY}
                  textAnchor="middle" fontSize={7.5}
                  fill="#D85A30" fontFamily="'Inter', system-ui, sans-serif" fontWeight={600}
                >
                  {fmtK1(costTotal)}
                </text>
              )}

              {/* Difference label — centered above pair */}
              {hasBilling && hasCost && (
                <text
                  x={pairCenterX} y={diffTopY}
                  textAnchor="middle" fontSize={8.5}
                  fill={diff >= 0 ? '#1D9E75' : '#E53E3E'}
                  fontFamily="'Inter', system-ui, sans-serif" fontWeight={700}
                >
                  {diff >= 0 ? '+' : ''}{fmtK1(diff)}
                </text>
              )}

              {/* Hover target */}
              <rect
                x={pairLeft(m) - 4} y={PADDING_TOP} width={pairW + 8} height={chartH}
                fill="transparent"
                style={{ cursor: (hasBilling || hasCost) ? 'pointer' : 'default' }}
                onMouseEnter={e => {
                  if (!hasBilling && !hasCost) return
                  const svgRect = (e.currentTarget.closest('svg') as SVGElement).getBoundingClientRect()
                  setTooltip({
                    x: svgRect.left + (pairCenterX / W) * svgRect.width,
                    y: svgRect.top  + (PADDING_TOP  / H) * svgRect.height,
                    month: MONTHS[m],
                    segments: segments.map(s => ({ label: s.meta.label, color: s.meta.color, value: s.value })),
                    billingTotal, costTotal,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />

              {/* X label */}
              <text
                x={pairCenterX} y={H - PADDING_BOTTOM + 14}
                textAnchor="middle" fontSize={9.5}
                fill={(hasBilling || hasCost) ? '#888' : '#CCC'}
                fontFamily="'Inter', system-ui, sans-serif"
              >
                {MONTHS[m]}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y - 8,
          transform: 'translate(-50%, -100%)', background: '#1A1A1A',
          borderRadius: 8, padding: '14px 18px', pointerEvents: 'none',
          zIndex: 9999, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
            {tooltip.month}
          </p>

          {/* Billing breakdown */}
          {tooltip.segments.length > 0 && (
            <>
              <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px' }}>
                Facturación
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {[...tooltip.segments].reverse().map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>€ {fmtFull.format(s.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Totals row */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tooltip.billingTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total facturado</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>€ {fmtFull.format(tooltip.billingTotal)}</span>
              </div>
            )}
            {tooltip.costTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total costes</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#D85A30', fontVariantNumeric: 'tabular-nums' }}>€ {fmtFull.format(tooltip.costTotal)}</span>
              </div>
            )}
            {tooltip.billingTotal > 0 && tooltip.costTotal > 0 && (() => {
              const diff = tooltip.billingTotal - tooltip.costTotal
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Diferencia</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: diff >= 0 ? '#1D9E75' : '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
                    {diff >= 0 ? '+' : ''}€ {fmtFull.format(diff)}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

const SECTION_SHORT: Record<string, string> = {
  'Anteproyecto':          'Anteproyecto',
  'Proyecto de ejecución': 'P. Ejecución',
  'Obra':                  'Obra',
  'Interiorismo':          'Interiorismo',
  'Post venta':            'Post venta',
}

function marginColor(m: number | null) {
  if (m === null) return '#CCC'
  if (m >= 40)  return '#1D9E75'
  if (m >= 20)  return '#E8913A'
  return '#E53E3E'
}

function AvgProjectMarginCard({ kpis }: { kpis: KPIs }) {
  const { avgProjectMargin, projectCount } = kpis
  const color = marginColor(avgProjectMargin)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0',
      padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 160,
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#BBB', margin: 0 }}>
        Rentabilidad media por proyecto
      </p>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingTop: 12 }}>
        {avgProjectMargin !== null ? (
          <div>
            <p style={{
              fontSize: 52, fontWeight: 200, letterSpacing: '-0.03em',
              color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {avgProjectMargin >= 0 ? '' : '−'}{Math.abs(avgProjectMargin).toFixed(1)}
              <span style={{ fontSize: 24, fontWeight: 300 }}>%</span>
            </p>
            <p style={{ fontSize: 10, color: '#AAA', margin: '10px 0 0' }}>
              promedio · {projectCount} proyecto{projectCount !== 1 ? 's' : ''} con datos
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 40, fontWeight: 200, color: '#D4D0C8', margin: 0 }}>—</p>
            <p style={{ fontSize: 10, color: '#CCC', margin: '8px 0 0' }}>Sin datos suficientes</p>
          </div>
        )}
      </div>

      {/* Mini bar showing margin level */}
      {avgProjectMargin !== null && (
        <div style={{ marginTop: 20 }}>
          <div style={{ height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${Math.min(100, Math.max(0, avgProjectMargin))}%`,
              background: color, transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 8, color: '#CCC' }}>0%</span>
            <span style={{ fontSize: 8, color: '#1D9E75' }}>40%+</span>
            <span style={{ fontSize: 8, color: '#CCC' }}>100%</span>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionMarginsCard({ kpis }: { kpis: KPIs }) {
  const fmtE = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sections = kpis.sectionMargins.filter(s => s.billingTotal > 0 || s.costTotal > 0)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0',
      padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', minHeight: 160,
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 20px' }}>
        Rentabilidad por sección
      </p>

      {sections.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <p style={{ fontSize: 12, color: '#CCC' }}>Sin datos suficientes</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {kpis.sectionMargins.map(s => {
            const color   = marginColor(s.margin)
            const barPct  = s.margin !== null ? Math.min(100, Math.max(0, s.margin)) : 0
            const hasData = s.billingTotal > 0 || s.costTotal > 0
            return (
              <div key={s.seccion}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: hasData ? '#555' : '#CCC', fontWeight: 500 }}>
                    {SECTION_SHORT[s.seccion] ?? s.seccion}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    {hasData && (
                      <span style={{ fontSize: 9, color: '#BBB', fontVariantNumeric: 'tabular-nums' }}>
                        € {fmtE.format(s.billingTotal)}
                      </span>
                    )}
                    <span style={{
                      fontSize: 14, fontWeight: 600, color,
                      fontVariantNumeric: 'tabular-nums', minWidth: 42, textAlign: 'right',
                    }}>
                      {s.margin !== null ? `${s.margin.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                </div>
                <div style={{ height: 3, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: hasData ? `${barPct}%` : '0%',
                    background: hasData ? color : '#F0EEE8',
                    opacity: hasData ? 1 : 0.3,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div style={{
      background: '#FAFAF8', borderRadius: 12,
      border: '1px dashed #E0DDD6',
      padding: '28px 32px', minHeight: 160,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#CCC', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 11, color: '#D4D0C8', margin: 0 }}>Próximamente</p>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {STATUS_ORDER.map(s => {
        const m = STATUS_META[s]
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: m.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#888', letterSpacing: '0.04em' }}>{m.label}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#D85A30', opacity: 0.85, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: '#D85A30', letterSpacing: '0.04em', fontWeight: 600 }}>Costes</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={24} height={10} style={{ flexShrink: 0 }}>
          <line x1={0} y1={5} x2={24} y2={5} stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.75} />
        </svg>
        <span style={{ fontSize: 10, color: '#1D9E75', letterSpacing: '0.04em', fontWeight: 600 }}>Obj. mensual (€67k)</span>
      </div>
    </div>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────────

function KpiBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 300, color: color ?? '#1A1A1A', margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#AAA', margin: '3px 0 0' }}>{sub}</p>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FinanzasDashboard({ facturas, year, monthlyCosts, kpis }: Props) {
  const fmtE0 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const yearFacturas = facturas.filter(f => {
    if (!f.fecha_pago_acordada) return false
    return new Date(f.fecha_pago_acordada).getFullYear() === year
  })

  const totalAnual    = yearFacturas.reduce((s, f) => s + f.monto, 0)
  const totalCobrado  = yearFacturas.filter(f => f.status === 'pagada').reduce((s, f) => s + f.monto, 0)
  const totalEnviadas = yearFacturas.filter(f => f.status === 'enviada').reduce((s, f) => s + f.monto, 0)
  const totalImpagado = yearFacturas.filter(f => f.status === 'impagada').reduce((s, f) => s + f.monto, 0)
  const targetAnual   = TARGET_MONTHLY * 12
  const pctObjetivo   = totalCobrado / targetAnual * 100
  const currentMonth  = new Date().getMonth()
  const mesesPasados  = currentMonth + 1
  const targetParcial = TARGET_MONTHLY * mesesPasados

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 32px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Finanzas · {year}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
          Dashboard
        </h1>
      </div>

      {/* KPIs */}
      <div style={{ padding: '24px 40px 0', background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
        <div style={{ display: 'flex', background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', marginBottom: 24 }}>
          {[
            { label: 'Contratado año',       value: `€ ${fmtE0.format(totalAnual)}`,    sub: `Obj. anual € ${fmtE0.format(targetAnual)}` },
            { label: 'Cobrado',              value: `€ ${fmtE0.format(totalCobrado)}`,  sub: `${pctObjetivo.toFixed(0)}% del objetivo anual`, color: '#1D9E75' },
            { label: 'Cobrable acum.',       value: `€ ${fmtE0.format(targetParcial)}`, sub: `Objetivo a ${mesesPasados} meses`, color: '#888' },
            { label: 'Enviadas pendientes',  value: totalEnviadas > 0 ? `€ ${fmtE0.format(totalEnviadas)}` : '—', color: '#E8913A' },
            { label: 'Impagadas',            value: totalImpagado > 0 ? `€ ${fmtE0.format(totalImpagado)}` : '—', color: totalImpagado > 0 ? '#E53E3E' : '#CCC' },
          ].map((kpi, i, arr) => (
            <div key={kpi.label} style={{ flex: 1, padding: '16px 24px', borderRight: i < arr.length - 1 ? '1px solid #E8E6E0' : 'none' }}>
              <KpiBox {...kpi} />
            </div>
          ))}
        </div>
      </div>

      {/* KPI Grid — 4 slots, 2 filled */}
      <div style={{ padding: '32px 40px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        <AvgProjectMarginCard kpis={kpis} />
        <SectionMarginsCard   kpis={kpis} />
        <PlaceholderCard label="KPI disponible" />
        <PlaceholderCard label="KPI disponible" />
      </div>

      {/* Chart */}
      <div style={{ padding: '32px 40px' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '28px 28px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>
                Facturación vs Costes
              </p>
              <p style={{ fontSize: 13, color: '#555', margin: 0, fontWeight: 300 }}>
                Barra ancha = facturación por estado · Barra fina = costes totales del mes
              </p>
            </div>
            <Legend />
          </div>
          <BillingChart facturas={facturas} year={year} monthlyCosts={monthlyCosts} />
        </div>
      </div>

    </div>
  )
}

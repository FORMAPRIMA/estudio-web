'use client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FondoPeriodo {
  id:               string
  periodo:          string  // 'YYYY-Q1'
  valor_total:      number
  rendimiento_pct:  number | null
  notas:            string | null
  fecha_referencia: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMXN(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}K`
  return `€${n.toLocaleString('es-ES')}`
}

function fmtPeriodo(p: string): string {
  // '2024-Q3' → 'Q3 '24'
  const [year, q] = p.split('-')
  return `${q} '${year.slice(2)}`
}

// ── Chart constants ───────────────────────────────────────────────────────────

const W   = 640
const H   = 200
const PAD = { top: 20, right: 20, bottom: 38, left: 68 }
const CW  = W - PAD.left - PAD.right
const CH  = H - PAD.top - PAD.bottom

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data:       FondoPeriodo[]
  userPct?:   number | null   // % participación del usuario
  hoverColor?: string
}

export default function FondoChart({ data, userPct = null }: Props) {
  if (data.length === 0) {
    return (
      <div style={{
        height: H, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#FAFAF8', border: '1px dashed #E0DED8',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
          <path d="M3 17L9 11L13 15L21 7" stroke="#CCC" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p style={{ fontSize: 11, color: '#CCC', fontWeight: 300 }}>
          Sin datos de rendimiento disponibles
        </p>
      </div>
    )
  }

  const values = data.map(d => d.valor_total)
  const minV   = Math.min(...values)
  const maxV   = Math.max(...values)
  const pad    = (maxV - minV) * 0.15 || maxV * 0.1
  const lo     = minV - pad
  const hi     = maxV + pad

  const xOf = (i: number) =>
    PAD.left + (data.length > 1 ? (i / (data.length - 1)) * CW : CW / 2)

  const yOf = (v: number) =>
    PAD.top + CH - ((v - lo) / (hi - lo)) * CH

  const pts  = data.map((d, i) => ({ x: xOf(i), y: yOf(d.valor_total) }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  const area = [
    `M ${pts[0].x.toFixed(1)} ${(PAD.top + CH).toFixed(1)}`,
    ...pts.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    `L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + CH).toFixed(1)}`,
    'Z',
  ].join(' ')

  // Y-axis ticks (3 labels)
  const yTicks = [lo + (hi - lo) * 0, lo + (hi - lo) * 0.5, hi]

  // X labels: show at most 8
  const step    = Math.ceil(data.length / 7)
  const xLabels = data.map((_, i) => i).filter(i => i % step === 0 || i === data.length - 1)

  // Returns bars (color-coded)
  const barW = Math.min(CW / data.length * 0.5, 18)
  const retMin = Math.min(0, ...data.map(d => d.rendimiento_pct ?? 0))
  const retMax = Math.max(0, ...data.map(d => d.rendimiento_pct ?? 0))
  const retScale = retMin === retMax ? 1 : 30 / (retMax - retMin)
  const zero = H - PAD.bottom + 14 // baseline for return bars (below chart)

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 30}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Gráfica de rendimiento del Fondo FP"
    >
      <defs>
        <linearGradient id="fundArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#D85A30" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#D85A30" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="userArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1D9E75" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#1D9E75" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* ── Grid lines ──────────────────────────────────────────────────── */}
      {yTicks.map((v, i) => {
        const y = yOf(v)
        return (
          <g key={i}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#ECEAE6" strokeWidth={1}
              strokeDasharray={i === 0 ? 'none' : '3 3'}
            />
            <text
              x={PAD.left - 9} y={y + 3.5}
              textAnchor="end" fontSize={9} fill="#BBB" fontWeight={300}
            >
              {fmtMXN(v)}
            </text>
          </g>
        )
      })}

      {/* ── Area fill ───────────────────────────────────────────────────── */}
      <path d={area} fill="url(#fundArea)" />

      {/* ── User portion area (dashed line) ─────────────────────────────── */}
      {userPct !== null && data.length > 1 && (() => {
        const uPts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.valor_total * userPct / 100) }))
        const uLine = uPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        const uArea = [
          `M ${uPts[0].x.toFixed(1)} ${(PAD.top + CH).toFixed(1)}`,
          ...uPts.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
          `L ${uPts[uPts.length - 1].x.toFixed(1)} ${(PAD.top + CH).toFixed(1)}`,
          'Z',
        ].join(' ')
        return (
          <g>
            <path d={uArea} fill="url(#userArea)" />
            <path d={uLine} fill="none" stroke="#1D9E75" strokeWidth={1.2}
              strokeDasharray="5 3" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        )
      })()}

      {/* ── Main line ───────────────────────────────────────────────────── */}
      <path
        d={line}
        fill="none"
        stroke="#D85A30"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ── Data points ─────────────────────────────────────────────────── */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#D85A30" strokeWidth={1.5} />
          {/* Tooltip on hover via title */}
          <circle cx={p.x} cy={p.y} r={10} fill="transparent">
            <title>{`${data[i].periodo}: ${fmtMXN(data[i].valor_total)}${data[i].rendimiento_pct != null ? ` (${data[i].rendimiento_pct! > 0 ? '+' : ''}${data[i].rendimiento_pct}%)` : ''}`}</title>
          </circle>
        </g>
      ))}

      {/* ── Rendimiento bars (below chart) ──────────────────────────────── */}
      {data.map((d, i) => {
        const r = d.rendimiento_pct
        if (r == null) return null
        const x    = xOf(i)
        const bH   = Math.abs(r) * retScale
        const isPos = r >= 0
        const barY = isPos ? zero - bH : zero
        return (
          <g key={`r-${i}`}>
            <rect
              x={x - barW / 2} y={barY}
              width={barW} height={Math.max(bH, 1)}
              fill={isPos ? 'rgba(29,158,117,0.3)' : 'rgba(216,90,48,0.3)'}
              rx={1}
            >
              <title>{`${r > 0 ? '+' : ''}${r}%`}</title>
            </rect>
          </g>
        )
      })}

      {/* Baseline for returns */}
      <line
        x1={PAD.left} y1={zero} x2={W - PAD.right} y2={zero}
        stroke="#ECEAE6" strokeWidth={1}
      />

      {/* ── X labels ────────────────────────────────────────────────────── */}
      {xLabels.map(i => (
        <text
          key={i}
          x={xOf(i)} y={H - PAD.bottom + 14}
          textAnchor="middle" fontSize={9} fill="#AAA" fontWeight={300}
        >
          {fmtPeriodo(data[i].periodo)}
        </text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PAD.left}, ${H + 14})`}>
        <circle cx={6}  cy={5} r={4} fill="#D85A30" />
        <text x={14} y={8.5} fontSize={9} fill="#888" fontWeight={300}>Valor total del fondo</text>
        {userPct !== null && (
          <>
            <line x1={80} y1={5} x2={94} y2={5} stroke="#1D9E75" strokeWidth={1.2} strokeDasharray="4 2" />
            <text x={98} y={8.5} fontSize={9} fill="#888" fontWeight={300}>Mi participación estimada</text>
          </>
        )}
      </g>
    </svg>
  )
}

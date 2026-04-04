'use client'

import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProyectoCard {
  id: string
  nombre: string
  codigo: string | null
  imagen_url: string | null
  status: string
  cliente: string | null
  totalHoras: number
  totalCosto: number
  totalAcordado: number
  totalCobrado: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS = [
  { status: 'activo',    label: 'Activos',    color: '#D85A30' },
  { status: 'on_hold',   label: 'On Hold',    color: '#378ADD' },
  { status: 'terminado', label: 'Terminados', color: '#1D9E75' },
  { status: 'archivado', label: 'Archivados', color: '#999999' },
] as const

const fmtH = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const fmtE = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProyectosAnalisisPage({ cards }: { cards: ProyectoCard[] }) {
  const router = useRouter()

  const total = {
    horas:    cards.reduce((s, c) => s + c.totalHoras,    0),
    costo:    cards.reduce((s, c) => s + c.totalCosto,    0),
    acordado: cards.reduce((s, c) => s + c.totalAcordado, 0),
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Finanzas operativas
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Análisis de proyectos
          </h1>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            {cards.length} proyecto{cards.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 32 }}>
          <SummaryPill label="Total horas invertidas" value={`${fmtH.format(total.horas)} h`} />
          <SummaryPill label="Coste empresa total" value={`€ ${fmtE.format(total.costo)}`} accent />
          <SummaryPill label="Total contratado" value={total.acordado > 0 ? `€ ${fmtE.format(total.acordado)}` : '—'} color={total.acordado > 0 ? '#1D9E75' : undefined} />
          <SummaryPill
            label="Margen estimado"
            value={total.acordado > 0 && total.costo > 0 ? `${Math.round(((total.acordado - total.costo) / total.acordado) * 100)}%` : '—'}
            color={total.acordado > total.costo ? '#1D9E75' : total.acordado > 0 ? '#E53E3E' : undefined}
          />
        </div>
      </div>

      {/* Kanban */}
      <div style={{
        display: 'flex', gap: 20, padding: '28px 40px',
        overflowX: 'auto', alignItems: 'flex-start',
        minHeight: 'calc(100vh - 200px)',
      }}>
        {COLUMNS.map(col => {
          const colCards = cards.filter(c => c.status === col.status)
          const colHoras = colCards.reduce((s, c) => s + c.totalHoras, 0)
          const colCosto = colCards.reduce((s, c) => s + c.totalCosto, 0)

          return (
            <div key={col.status} style={{ flex: '0 0 290px', minWidth: 290 }}>
              {/* Column header */}
              <div style={{ marginBottom: 14, padding: '0 2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444' }}>
                    {col.label}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#fff',
                    background: col.color, padding: '1px 7px', borderRadius: 10,
                  }}>
                    {colCards.length}
                  </span>
                </div>
                {colCards.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, paddingLeft: 16 }}>
                    <span style={{ fontSize: 10, color: '#AAA' }}>{fmtH.format(colHoras)} h</span>
                    <span style={{ fontSize: 10, color: col.color, fontWeight: 500 }}>€ {fmtE.format(colCosto)}</span>
                  </div>
                )}
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colCards.length === 0 ? (
                  <div style={{
                    padding: '28px 20px', textAlign: 'center',
                    border: '1px dashed #DDD', borderRadius: 8,
                    fontSize: 11, color: '#CCC',
                  }}>
                    Sin proyectos
                  </div>
                ) : colCards.map(card => (
                  <KanbanCard
                    key={card.id}
                    card={card}
                    accentColor={col.color}
                    onClick={() => router.push(`/team/finanzas/operativas/proyectos/${card.id}`)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function KanbanCard({
  card, accentColor, onClick,
}: {
  card: ProyectoCard
  accentColor: string
  onClick: () => void
}) {
  const hasData   = card.totalHoras > 0
  const hasBilling = card.totalAcordado > 0
  const margin    = hasBilling ? card.totalAcordado - card.totalCosto : null
  const marginPct = margin !== null && card.totalAcordado > 0
    ? Math.round((margin / card.totalAcordado) * 100)
    : null

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 10,
        border: '1px solid #E8E6E0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Banner */}
      <div style={{
        position: 'relative', height: 120, overflow: 'hidden',
        background: card.imagen_url
          ? 'transparent'
          : `linear-gradient(135deg, ${accentColor}CC 0%, ${accentColor}55 100%)`,
      }}>
        {card.imagen_url && (
          <img
            src={card.imagen_url}
            alt={card.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {/* Dark overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
        }} />
        {/* Status dot + code */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          {card.codigo && (
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.35)',
              padding: '2px 7px', borderRadius: 3, fontFamily: 'monospace',
              backdropFilter: 'blur(4px)',
            }}>
              {card.codigo}
            </span>
          )}
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, boxShadow: '0 0 0 2px rgba(255,255,255,0.3)' }} />
        </div>
        {/* Name + client at bottom */}
        <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {card.nombre}
          </p>
          {card.cliente && (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>
              {card.cliente}
            </p>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 1, background: '#ECEAE4',
      }}>
        <MetricCell
          label="Horas invertidas"
          value={hasData ? `${fmtH.format(card.totalHoras)} h` : '—'}
          bold={hasData}
        />
        <MetricCell
          label="Coste empresa"
          value={hasData ? `€ ${fmtE.format(card.totalCosto)}` : '—'}
          color={hasData ? accentColor : undefined}
          bold={hasData}
        />
        <MetricCell
          label="Contratado"
          value={hasBilling ? `€ ${fmtE.format(card.totalAcordado)}` : '—'}
          color={hasBilling ? '#1D9E75' : undefined}
          bold={hasBilling}
          muted={!hasBilling}
          placeholder={!hasBilling ? 'sin facturas' : undefined}
        />
        <MetricCell
          label="Margen estimado"
          value={marginPct !== null ? `${marginPct}%` : '—'}
          color={margin !== null ? (margin >= 0 ? '#1D9E75' : '#E53E3E') : undefined}
          bold={marginPct !== null}
          muted={marginPct === null}
          placeholder={marginPct === null ? 'sin datos' : undefined}
        />
      </div>
    </div>
  )
}

function MetricCell({ label, value, color, bold, muted, placeholder }: {
  label: string
  value: string
  color?: string
  bold?: boolean
  muted?: boolean
  placeholder?: string
}) {
  return (
    <div style={{ background: muted ? '#FAFAF8' : '#fff', padding: '10px 12px' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C0BCB4', margin: '0 0 3px' }}>
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: bold ? 600 : 400, color: muted ? '#D4D0C8' : (color ?? '#1A1A1A'), margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {placeholder && (
        <p style={{ fontSize: 9, color: '#D4D0C8', margin: '2px 0 0', fontStyle: 'italic' }}>{placeholder}</p>
      )}
    </div>
  )
}

// ── Summary pill ──────────────────────────────────────────────────────────────

function SummaryPill({ label, value, accent, dim, note, color }: {
  label: string
  value: string
  accent?: boolean
  dim?: boolean
  note?: string
  color?: string
}) {
  const resolvedColor = color ?? (dim ? '#CCC' : accent ? '#D85A30' : value === '—' ? '#CCC' : '#1A1A1A')
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 300, color: resolvedColor, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {note && (
        <p style={{ fontSize: 9, color: '#CCC', margin: '2px 0 0', fontStyle: 'italic' }}>{note}</p>
      )}
    </div>
  )
}

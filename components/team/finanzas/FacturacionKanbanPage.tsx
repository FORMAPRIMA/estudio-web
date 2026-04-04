'use client'

import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FacturacionCard {
  id: string
  nombre: string
  codigo: string | null
  imagen_url: string | null
  status: string
  cliente: string | null
  totalAcordado: number
  totalCobrado: number
  totalEnviada: number
  totalCobrable: number
  totalImpagada: number
  facturaCount: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS = [
  { status: 'activo',    label: 'En proceso',  color: '#D85A30', gradient: 'linear-gradient(135deg, #D85A30 0%, #E8913A 100%)' },
  { status: 'on_hold',   label: 'On Hold',     color: '#378ADD', gradient: 'linear-gradient(135deg, #378ADD 0%, #5B9FDE 100%)' },
  { status: 'terminado', label: 'Terminados',  color: '#1D9E75', gradient: 'linear-gradient(135deg, #1D9E75 0%, #27C290 100%)' },
  { status: 'archivado', label: 'Archivados',  color: '#999',    gradient: 'linear-gradient(135deg, #888 0%, #BBB 100%)' },
] as const

const fmtE = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Component ─────────────────────────────────────────────────────────────────

export default function FacturacionKanbanPage({ cards }: { cards: FacturacionCard[] }) {
  const router = useRouter()

  const totals = {
    acordado: cards.reduce((s, c) => s + c.totalAcordado, 0),
    cobrado:  cards.reduce((s, c) => s + c.totalCobrado,  0),
    enviada:  cards.reduce((s, c) => s + c.totalEnviada,  0),
    impagada: cards.reduce((s, c) => s + c.totalImpagada, 0),
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Facturación
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Facturación por proyecto
          </h1>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            {cards.length} proyecto{cards.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Global summary */}
        <div style={{ display: 'flex', gap: 0, background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <HeaderStat label="Total contratado"  value={`€ ${fmtE.format(totals.acordado)}`} accent />
          <HeaderStat label="Total cobrado"      value={`€ ${fmtE.format(totals.cobrado)}`}  color="#1D9E75" />
          <HeaderStat label="Pendiente de cobro" value={`€ ${fmtE.format(totals.enviada)}`}  color="#E8913A" />
          <HeaderStat label="Impagadas"          value={totals.impagada > 0 ? `€ ${fmtE.format(totals.impagada)}` : '—'} color={totals.impagada > 0 ? '#E53E3E' : undefined} last />
        </div>
      </div>

      {/* Kanban */}
      <div style={{
        display: 'flex', gap: 20, padding: '28px 40px',
        overflowX: 'auto', alignItems: 'flex-start',
        minHeight: 'calc(100vh - 220px)',
      }}>
        {COLUMNS.map(col => {
          const colCards = cards.filter(c => c.status === col.status)
          const colTotal = colCards.reduce((s, c) => s + c.totalAcordado, 0)

          return (
            <div key={col.status} style={{ flex: '0 0 300px', minWidth: 300 }}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '0 2px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444' }}>
                  {col.label}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#fff', background: col.color, padding: '1px 7px', borderRadius: 10 }}>
                  {colCards.length}
                </span>
              </div>
              {colCards.length > 0 && colTotal > 0 && (
                <p style={{ fontSize: 10, color: col.color, fontWeight: 500, margin: '-8px 0 12px 16px' }}>
                  € {fmtE.format(colTotal)} contratado
                </p>
              )}

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {colCards.length === 0 ? (
                  <div style={{ padding: '28px 20px', textAlign: 'center', border: '1px dashed #DDD', borderRadius: 8, fontSize: 11, color: '#CCC' }}>
                    Sin proyectos
                  </div>
                ) : colCards.map(card => (
                  <FacturacionCard
                    key={card.id}
                    card={card}
                    accentColor={col.color}
                    gradient={col.gradient}
                    onClick={() => router.push(`/team/finanzas/facturacion/control/${card.id}`)}
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

function FacturacionCard({
  card, accentColor, gradient, onClick,
}: {
  card: FacturacionCard
  accentColor: string
  gradient: string
  onClick: () => void
}) {
  const pct = card.totalAcordado > 0
    ? Math.round((card.totalCobrado / card.totalAcordado) * 100)
    : 0
  const pendiente = card.totalAcordado - card.totalCobrado

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
      {/* Image banner */}
      <div style={{ position: 'relative', height: 130, overflow: 'hidden' }}>
        {card.imagen_url ? (
          <img
            src={card.imagen_url}
            alt={card.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: gradient }} />
        )}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.10) 60%, transparent 100%)',
        }} />
        {/* Text over image */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.nombre}
              </p>
              {card.cliente && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.cliente}
                </p>
              )}
            </div>
            {card.codigo && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.35)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', flexShrink: 0 }}>
                {card.codigo}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: '14px 16px 16px' }}>
        {card.facturaCount === 0 ? (
          <p style={{ fontSize: 11, color: '#CCC', textAlign: 'center', margin: '8px 0', fontStyle: 'italic' }}>
            Sin facturas registradas
          </p>
        ) : (
          <>
            {/* Main metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#ECEAE4', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
              <MCell label="Contratado"  value={`€ ${fmtE.format(card.totalAcordado)}`} bold />
              <MCell label="Cobrado"     value={card.totalCobrado > 0 ? `€ ${fmtE.format(card.totalCobrado)}` : '—'} color={card.totalCobrado > 0 ? '#1D9E75' : undefined} />
              <MCell label="Por cobrar"  value={pendiente > 0 ? `€ ${fmtE.format(pendiente)}` : '—'} color={pendiente > 0 ? '#E8913A' : undefined} />
              <MCell
                label="Impagadas"
                value={card.totalImpagada > 0 ? `€ ${fmtE.format(card.totalImpagada)}` : '—'}
                color={card.totalImpagada > 0 ? '#E53E3E' : undefined}
              />
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: '#AAA' }}>Cobrado</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: pct > 0 ? '#1D9E75' : '#CCC' }}>{pct}%</span>
              </div>
              <div style={{ height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: card.totalImpagada > 0 ? '#E53E3E' : '#1D9E75',
                  width: `${pct}%`, transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MCell({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ background: '#fff', padding: '9px 12px' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C0BCB4', margin: '0 0 2px' }}>
        {label}
      </p>
      <p style={{ fontSize: 12, fontWeight: bold ? 600 : 400, color: color ?? (value === '—' ? '#D4D0C8' : '#1A1A1A'), margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  )
}

function HeaderStat({ label, value, accent, color, last }: { label: string; value: string; accent?: boolean; color?: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '16px 22px', borderRight: last ? 'none' : '1px solid #E8E6E0', background: '#fff' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 5px' }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 300, color: color ?? (accent ? '#D85A30' : '#1A1A1A'), margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  )
}

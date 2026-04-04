'use client'

import { useState } from 'react'
import {
  saveFondoProyecto,
  deleteFondoProyecto,
  saveParticipacion,
  deleteParticipacion,
} from '@/app/actions/area-interna'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Proyecto {
  id: string
  fondo_id: string
  nombre: string
  descripcion: string | null
  monto_invertido: number
  fecha_inversion: string
  monto_retornado: number | null
  fecha_retorno: string | null
}

export interface Participacion {
  user_id: string
  porcentaje_participacion: number
  fecha_inicio_participacion: string
  notas: string | null
  profiles?: { nombre: string; apellido: string | null; email: string; rol: string } | null
}

export interface Member {
  id: string
  nombre: string
  apellido: string | null
  avatar_url: string | null
  rol: string
}

interface Props {
  proyectos: Proyecto[]
  participaciones: Participacion[]
  isPartner: boolean
  allMembers: Member[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUND_START   = new Date('2025-01-01')
const FUND_END     = new Date('2032-01-01')
const CLIFF_DATE   = new Date('2028-01-01')
const VESTING_DATES = [
  new Date('2028-01-01'),
  new Date('2029-01-01'),
  new Date('2030-01-01'),
  new Date('2031-01-01'),
]

const SVG_W  = 900
const SVG_H  = 360
const PADT   = 90   // top padding (callout boxes)
const PADR   = 30
const PADB   = 55
const PADL   = 72
const CW     = SVG_W - PADL - PADR
const CH     = SVG_H - PADT - PADB

const AVATAR_PALETTE = [
  '#D85A30','#E8913A','#C9A227','#1D9E75','#378ADD','#8B5CF6','#C04828','#059669',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}K`
  return `€${n.toLocaleString('es-ES')}`
}

function fmtEurFull(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)
}

function dateToX(d: Date): number {
  const totalMs  = FUND_END.getTime() - FUND_START.getTime()
  const offsetMs = d.getTime() - FUND_START.getTime()
  return PADL + Math.max(0, Math.min(1, offsetMs / totalMs)) * CW
}

function valToY(v: number, maxV: number): number {
  return PADT + CH - (v / maxV) * CH
}

function yearsHeld(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
}

function memberInitials(m: Member): string {
  return [(m.nombre.trim()[0] ?? ''), (m.apellido?.trim()[0] ?? '')].join('').toUpperCase()
}

function memberName(m: { nombre: string; apellido: string | null } | undefined | null): string {
  if (!m) return '—'
  return `${m.nombre}${m.apellido ? ` ${m.apellido}` : ''}`
}

// ── Fund math ─────────────────────────────────────────────────────────────────

function calcIRR(proyectos: Proyecto[]): { irr: number; isEstimated: boolean } {
  const closed = proyectos.filter(p => p.monto_retornado != null && p.fecha_retorno != null)
  if (closed.length === 0) return { irr: 0.12, isEstimated: true }

  let totalWeighted = 0
  let totalInvested = 0
  for (const p of closed) {
    const y = yearsHeld(
      new Date(p.fecha_inversion + 'T12:00:00'),
      new Date(p.fecha_retorno! + 'T12:00:00'),
    )
    if (y <= 0 || p.monto_invertido <= 0) continue
    const cagr = Math.pow(p.monto_retornado! / p.monto_invertido, 1 / y) - 1
    totalWeighted += cagr * p.monto_invertido
    totalInvested += p.monto_invertido
  }
  if (totalInvested === 0) return { irr: 0.12, isEstimated: true }
  return { irr: totalWeighted / totalInvested, isEstimated: false }
}

function fundValueAt(date: Date, proyectos: Proyecto[], irr: number): number {
  let total = 0
  for (const p of proyectos) {
    const investDate = new Date(p.fecha_inversion + 'T12:00:00')
    if (investDate > date) continue
    const isClosed   = p.monto_retornado != null && p.fecha_retorno != null
    const closeDate  = isClosed ? new Date(p.fecha_retorno! + 'T12:00:00') : null
    if (isClosed && closeDate! <= date) {
      total += p.monto_retornado!
    } else {
      const y = yearsHeld(investDate, date)
      total += p.monto_invertido * Math.pow(1 + irr, Math.max(0, y))
    }
  }
  return total
}

// ── Y-axis ticks ──────────────────────────────────────────────────────────────

function niceYTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0]
  const rawStep = max / (count - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const nice = [1, 2, 2.5, 5, 10].map(f => f * magnitude)
  const step = nice.find(s => s >= rawStep) ?? nice[nice.length - 1]
  const ticks: number[] = []
  for (let v = 0; v <= max * 1.01; v += step) ticks.push(v)
  return ticks
}

// ── Inline style constants ─────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid #E8E6E0', background: '#fff',
  fontSize: 13, color: '#1A1A1A', fontWeight: 300,
  outline: 'none', boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 9, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#AAA', fontWeight: 300, marginBottom: 6,
}
const btnPrimary: React.CSSProperties = {
  background: '#1A1A1A', color: '#fff', border: 'none',
  padding: '9px 20px', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 300, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'none', color: '#888', border: '1px solid #E8E6E0',
  padding: '8px 16px', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 300, cursor: 'pointer',
}
const btnAccent: React.CSSProperties = {
  background: 'none', color: '#1D9E75', border: '1px solid #1D9E7540',
  padding: '8px 16px', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 300, cursor: 'pointer',
}

// ── Modal wrapper ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        borderRadius: 2,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #ECEAE6',
        }}>
          <p style={{ fontSize: 11, fontWeight: 300, color: '#1A1A1A', letterSpacing: '0.06em' }}>{title}</p>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 18,
            color: '#AAA', cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Modal: Añadir proyecto ─────────────────────────────────────────────────────

function AddProyectoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    nombre: '', descripcion: '',
    monto_invertido: '', fecha_inversion: '',
    monto_retornado: '', fecha_retorno: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await saveFondoProyecto({
      fondo_id:        'FPTEAM-2025',
      nombre:          form.nombre.trim(),
      descripcion:     form.descripcion.trim() || null,
      monto_invertido: parseFloat(form.monto_invertido),
      fecha_inversion: form.fecha_inversion,
      monto_retornado: form.monto_retornado ? parseFloat(form.monto_retornado) : null,
      fecha_retorno:   form.fecha_retorno || null,
    })
    if ('error' in res) { setError(res.error); setLoading(false); return }
    window.location.reload()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelSt}>Nombre del proyecto *</label>
        <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          required style={inputSt} placeholder="Proyecto XYZ" />
      </div>
      <div>
        <label style={labelSt}>Descripción (opcional)</label>
        <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          style={inputSt} placeholder="Breve descripción…" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelSt}>Monto invertido (€) *</label>
          <input type="number" value={form.monto_invertido}
            onChange={e => setForm(f => ({ ...f, monto_invertido: e.target.value }))}
            required min={0} step={0.01} style={inputSt} placeholder="50000" />
        </div>
        <div>
          <label style={labelSt}>Fecha inversión *</label>
          <input type="date" value={form.fecha_inversion}
            onChange={e => setForm(f => ({ ...f, fecha_inversion: e.target.value }))}
            required style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>Monto retornado (€)</label>
          <input type="number" value={form.monto_retornado}
            onChange={e => setForm(f => ({ ...f, monto_retornado: e.target.value }))}
            min={0} step={0.01} style={inputSt} placeholder="Opcional" />
        </div>
        <div>
          <label style={labelSt}>Fecha retorno</label>
          <input type="date" value={form.fecha_retorno}
            onChange={e => setForm(f => ({ ...f, fecha_retorno: e.target.value }))}
            style={inputSt} />
        </div>
      </div>
      {error && <p style={{ fontSize: 11, color: '#C04828', fontWeight: 300 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
        <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
          {loading ? 'Guardando…' : 'Guardar proyecto'}
        </button>
        <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
      </div>
    </form>
  )
}

// ── Modal: Gestionar participantes ─────────────────────────────────────────────

function GestionarParticipantesModal({
  participaciones,
  allMembers,
  onClose,
}: {
  participaciones: Participacion[]
  allMembers: Member[]
  onClose: () => void
}) {
  const [parts,     setParts]     = useState<Participacion[]>(participaciones)
  const [form,      setForm]      = useState({ user_id: '', porcentaje: '', fecha_inicio: '', notas: '' })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const unassigned = allMembers.filter(m => !parts.some(p => p.user_id === m.id))

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await saveParticipacion({
      user_id:                    form.user_id,
      porcentaje_participacion:   parseFloat(form.porcentaje),
      fecha_inicio_participacion: form.fecha_inicio,
      notas:                      form.notas.trim(),
    })
    if ('error' in res) { setError(res.error ?? null); setLoading(false); return }
    window.location.reload()
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('¿Eliminar esta participación?')) return
    setDeletingId(userId)
    await deleteParticipacion(userId)
    setParts(prev => prev.filter(p => p.user_id !== userId))
    setDeletingId(null)
  }

  const memberById = Object.fromEntries(allMembers.map(m => [m.id, m]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current list */}
      {parts.length > 0 && (
        <div>
          <p style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAA', fontWeight: 300, marginBottom: 12 }}>
            Participantes actuales
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {parts.map((p, i) => {
              const m = memberById[p.user_id]
              return (
                <div key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#FAFAF8', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: m?.avatar_url ? '#F0EEE8' : AVATAR_PALETTE[i % AVATAR_PALETTE.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {m?.avatar_url
                        ? <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 8, color: '#fff', fontWeight: 600 }}>{m ? memberInitials(m) : '?'}</span>
                      }
                    </div>
                    <span style={{ fontSize: 13, color: '#333', fontWeight: 300 }}>
                      {m ? memberName(m) : p.user_id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 16, fontWeight: 200, color: '#1A1A1A' }}>{p.porcentaje_participacion}%</span>
                    <button onClick={() => handleDelete(p.user_id)} disabled={deletingId === p.user_id}
                      style={{ ...btnGhost, fontSize: 9, padding: '4px 10px', color: '#C04828', borderColor: '#F0D0C8' }}>
                      {deletingId === p.user_id ? '…' : '×'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add form */}
      <div>
        <p style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAA', fontWeight: 300, marginBottom: 12 }}>
          Añadir participante
        </p>
        <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={labelSt}>Miembro</label>
            <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
              required style={{ ...inputSt, cursor: 'pointer' }}>
              <option value="">Seleccionar…</option>
              {unassigned.map(m => (
                <option key={m.id} value={m.id}>{memberName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelSt}>% de participación</label>
            <input type="number" value={form.porcentaje}
              onChange={e => setForm(f => ({ ...f, porcentaje: e.target.value }))}
              required min={0} max={100} step={0.1} style={inputSt} placeholder="15.0" />
          </div>
          <div>
            <label style={labelSt}>Fecha inicio</label>
            <input type="date" value={form.fecha_inicio}
              onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
              required style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Notas (opcional)</label>
            <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              style={inputSt} placeholder="Opcional…" />
          </div>
          {error && <p style={{ fontSize: 11, color: '#C04828', fontWeight: 300, gridColumn: '1/-1' }}>{error}</p>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Guardando…' : 'Añadir'}
            </button>
            <button type="button" onClick={onClose} style={btnGhost}>Cerrar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── SVG Chart ─────────────────────────────────────────────────────────────────

function FondoSVGChart({
  proyectos,
  maxY,
  irr,
  isEstimated,
}: {
  proyectos: Proyecto[]
  maxY: number
  irr: number
  isEstimated: boolean
}) {
  const today = new Date()

  // Build line data points: monthly sample from FUND_START to FUND_END
  const points: { d: Date; v: number }[] = []
  const step = 30 * 24 * 60 * 60 * 1000 // ~monthly
  for (let t = FUND_START.getTime(); t <= FUND_END.getTime(); t += step) {
    const d = new Date(t)
    const v = fundValueAt(d, proyectos, irr)
    points.push({ d, v })
  }

  // Split into past (solid) and future (dashed)
  const todayX  = dateToX(today)
  const pastPts  = points.filter(p => p.d <= today)
  const futurePts = points.filter(p => p.d >= today)
  // Ensure continuity at today
  if (pastPts.length > 0 && futurePts.length > 0 && pastPts[pastPts.length - 1].d < today) {
    const todayV = fundValueAt(today, proyectos, irr)
    pastPts.push({ d: today, v: todayV })
    futurePts.unshift({ d: today, v: todayV })
  }

  const ptToXY = (pt: { d: Date; v: number }) => ({
    x: dateToX(pt.d),
    y: valToY(pt.v, maxY),
  })

  const makePath = (pts: { d: Date; v: number }[]) =>
    pts.map((p, i) => {
      const { x, y } = ptToXY(p)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')

  const makeArea = (pts: { d: Date; v: number }[]) => {
    if (pts.length === 0) return ''
    const bottom = PADT + CH
    const first  = ptToXY(pts[0])
    const last   = ptToXY(pts[pts.length - 1])
    return [
      `M ${first.x.toFixed(1)} ${bottom.toFixed(1)}`,
      ...pts.map(p => { const { x, y } = ptToXY(p); return `L ${x.toFixed(1)} ${y.toFixed(1)}` }),
      `L ${last.x.toFixed(1)} ${bottom.toFixed(1)}`,
      'Z',
    ].join(' ')
  }

  const yTicks = niceYTicks(maxY, 6)
  const cliffX = dateToX(CLIFF_DATE)

  // Investment & return event dots
  const investEvents = proyectos.map(p => {
    const d = new Date(p.fecha_inversion + 'T12:00:00')
    return {
      x: dateToX(d),
      y: valToY(fundValueAt(d, proyectos, irr), maxY),
      label: p.nombre,
      monto: p.monto_invertido,
    }
  })
  const returnEvents = proyectos
    .filter(p => p.fecha_retorno && p.monto_retornado != null)
    .map(p => {
      const d = new Date(p.fecha_retorno! + 'T12:00:00')
      return {
        x: dateToX(d),
        y: valToY(fundValueAt(d, proyectos, irr), maxY),
        label: p.nombre,
        monto: p.monto_retornado!,
      }
    })

  // Vesting milestone callout data
  const vestingCallouts = VESTING_DATES.map((vd, i) => {
    const x    = dateToX(vd)
    const val  = fundValueAt(vd, proyectos, irr)
    const y    = valToY(val, maxY)
    const tranche = (i + 1) * 25
    // Stagger: even index at top row (y=4), odd at second row (y=44)
    const boxY = i % 2 === 0 ? 4 : 44
    return { x, y, val, tranche, year: 2028 + i, boxY }
  })

  const allLinePts = [...pastPts, ...futurePts.filter(p => p.d > today)]

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Fondo de Retención de Talento — proyección"
    >
      <defs>
        <linearGradient id="ftAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#D85A30" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#D85A30" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="ftAreaFutureGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#E8913A" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#E8913A" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* ── Zone fills ─────────────────────────────────────────────────── */}
      {/* Cliff zone: FUND_START to CLIFF */}
      <rect
        x={PADL} y={PADT}
        width={cliffX - PADL} height={CH}
        fill="rgba(232,145,58,0.06)"
      />
      {/* Post-cliff vesting zone: CLIFF to FUND_END */}
      <rect
        x={cliffX} y={PADT}
        width={dateToX(FUND_END) - cliffX} height={CH}
        fill="rgba(29,158,117,0.05)"
      />

      {/* ── Zone labels ────────────────────────────────────────────────── */}
      <text
        x={(PADL + cliffX) / 2} y={PADT + CH - 10}
        textAnchor="middle" fontSize={9} fill="#E8913A" fontWeight={300}
        letterSpacing="0.1em" style={{ textTransform: 'uppercase' } as React.CSSProperties}
      >
        CLIFF 3A
      </text>
      <text
        x={(cliffX + dateToX(FUND_END)) / 2} y={PADT + CH - 10}
        textAnchor="middle" fontSize={9} fill="#1D9E75" fontWeight={300}
        letterSpacing="0.1em" style={{ textTransform: 'uppercase' } as React.CSSProperties}
      >
        VESTING
      </text>

      {/* ── Horizontal grid lines ──────────────────────────────────────── */}
      {yTicks.map((v, i) => {
        const y = valToY(v, maxY)
        if (y < PADT || y > PADT + CH) return null
        return (
          <g key={i}>
            <line
              x1={PADL} y1={y} x2={SVG_W - PADR} y2={y}
              stroke="#ECEAE6" strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '3 3'}
            />
            <text x={PADL - 9} y={y + 3.5} textAnchor="end" fontSize={9} fill="#BBB" fontWeight={300}>
              {fmtEur(v)}
            </text>
          </g>
        )
      })}

      {/* ── Area fill (past) ───────────────────────────────────────────── */}
      {pastPts.length > 0 && (
        <path d={makeArea(pastPts)} fill="url(#ftAreaGrad)" />
      )}

      {/* ── Area fill (future, lighter) ────────────────────────────────── */}
      {futurePts.length > 0 && (
        <path d={makeArea(futurePts)} fill="url(#ftAreaFutureGrad)" />
      )}

      {/* ── Fund line: past (solid) ────────────────────────────────────── */}
      {pastPts.length > 1 && (
        <path
          d={makePath(pastPts)}
          fill="none" stroke="#D85A30" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
        />
      )}

      {/* ── Fund line: future (dashed) ─────────────────────────────────── */}
      {futurePts.length > 1 && (
        <path
          d={makePath(futurePts)}
          fill="none" stroke="#E8913A" strokeWidth={1.8}
          strokeDasharray="6 3"
          strokeLinejoin="round" strokeLinecap="round"
        />
      )}

      {/* ── TODAY marker ───────────────────────────────────────────────── */}
      <line
        x1={todayX} y1={PADT}
        x2={todayX} y2={PADT + CH}
        stroke="#AAAAAA" strokeWidth={1} strokeDasharray="4 3"
      />
      <text x={todayX + 4} y={PADT + 12} fontSize={8} fill="#AAA" fontWeight={300} letterSpacing="0.1em">
        HOY
      </text>

      {/* ── CLIFF boundary ─────────────────────────────────────────────── */}
      <line
        x1={cliffX} y1={PADT}
        x2={cliffX} y2={PADT + CH}
        stroke="#E8913A" strokeWidth={1.2} strokeDasharray="5 4"
      />
      <rect x={cliffX - 18} y={PADT + CH + 6} width={36} height={14} fill="#E8913A" rx={2} />
      <text x={cliffX} y={PADT + CH + 16} textAnchor="middle" fontSize={8} fill="#fff" fontWeight={500} letterSpacing="0.1em">
        CLIFF
      </text>

      {/* ── Vesting milestone lines + callout boxes ────────────────────── */}
      {vestingCallouts.map((vc) => {
        const boxW  = 88
        const boxH  = 36
        const boxX  = vc.x - boxW / 2
        const lineEndY = vc.boxY + boxH

        return (
          <g key={vc.year}>
            {/* Vertical dashed line */}
            <line
              x1={vc.x} y1={PADT}
              x2={vc.x} y2={PADT + CH}
              stroke="#1D9E75" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.7}
            />
            {/* Thin connector from box bottom to top of chart area */}
            <line
              x1={vc.x} y1={lineEndY}
              x2={vc.x} y2={PADT}
              stroke="#1D9E75" strokeWidth={0.8} strokeDasharray="2 3" strokeOpacity={0.5}
            />
            {/* Callout box */}
            <rect
              x={boxX} y={vc.boxY}
              width={boxW} height={boxH}
              fill="#fff" stroke="#1D9E75" strokeWidth={0.8}
              rx={2} opacity={0.97}
            />
            <text x={vc.x} y={vc.boxY + 11} textAnchor="middle" fontSize={8} fill="#1D9E75" fontWeight={400} letterSpacing="0.08em">
              {vc.year} · +{vc.tranche}%
            </text>
            <text x={vc.x} y={vc.boxY + 23} textAnchor="middle" fontSize={9} fill="#1A1A1A" fontWeight={300}>
              {fmtEur(vc.val)}
            </text>
            {isEstimated && (
              <text x={vc.x} y={vc.boxY + 33} textAnchor="middle" fontSize={7} fill="#AAA" fontWeight={300}>
                estimado
              </text>
            )}
          </g>
        )
      })}

      {/* ── Investment event dots ──────────────────────────────────────── */}
      {investEvents.map((ev, i) => (
        <g key={`inv-${i}`}>
          <circle cx={ev.x} cy={ev.y} r={5} fill="#D85A30" stroke="#fff" strokeWidth={1.5}>
            <title>{ev.label}: {fmtEurFull(ev.monto)} invertido</title>
          </circle>
          <text x={ev.x + 7} y={ev.y - 6} fontSize={8} fill="#D85A30" fontWeight={300}>
            {ev.label.length > 14 ? ev.label.slice(0, 13) + '…' : ev.label}
          </text>
        </g>
      ))}

      {/* ── Return event dots ──────────────────────────────────────────── */}
      {returnEvents.map((ev, i) => (
        <g key={`ret-${i}`}>
          <circle cx={ev.x} cy={ev.y} r={5} fill="#1D9E75" stroke="#fff" strokeWidth={1.5}>
            <title>{ev.label}: {fmtEurFull(ev.monto)} retornado</title>
          </circle>
          <text x={ev.x + 7} y={ev.y - 6} fontSize={8} fill="#1D9E75" fontWeight={300}>
            +{fmtEur(ev.monto)}
          </text>
        </g>
      ))}

      {/* ── X-axis labels ─────────────────────────────────────────────── */}
      {[2025,2026,2027,2028,2029,2030,2031,2032].map(yr => {
        const x = dateToX(new Date(`${yr}-01-01`))
        return (
          <text key={yr} x={x} y={PADT + CH + 18} textAnchor="middle" fontSize={9} fill="#AAA" fontWeight={300}>
            {yr}
          </text>
        )
      })}

      {/* ── Bottom axis line ──────────────────────────────────────────── */}
      <line
        x1={PADL} y1={PADT + CH}
        x2={SVG_W - PADR} y2={PADT + CH}
        stroke="#ECEAE6" strokeWidth={1}
      />
    </svg>
  )
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function StatCard({ label, value, note, color }: {
  label: string; value: string; note?: string; color?: string
}) {
  return (
    <div style={{ background: '#FAFAF8', padding: '16px 20px', flex: 1, minWidth: 120 }}>
      <p style={{ fontSize: 9, color: '#BBB', fontWeight: 300, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 200, color: color ?? '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 4 }}>
        {value}
      </p>
      {note && <p style={{ fontSize: 9, color: '#BBB', fontWeight: 300 }}>{note}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FondoTimeline({ proyectos, participaciones, isPartner, allMembers }: Props) {
  const [showAddProyecto,   setShowAddProyecto]   = useState(false)
  const [showGestPartes,    setShowGestPartes]    = useState(false)
  const [deletingId,        setDeletingId]        = useState<string | null>(null)

  const { irr, isEstimated } = calcIRR(proyectos)

  const totalInvested  = proyectos.reduce((s, p) => s + p.monto_invertido, 0)
  const totalReturned  = proyectos.reduce((s, p) => s + (p.monto_retornado ?? 0), 0)

  // Compute max Y for chart
  const projAt2031     = fundValueAt(new Date('2031-01-01'), proyectos, irr)
  const rawMax         = projAt2031 * 1.15
  const maxY           = Math.max(rawMax, 50_000)

  const projAt2028     = fundValueAt(CLIFF_DATE, proyectos, irr)

  // Handle delete project
  const handleDeleteProyecto = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto?')) return
    setDeletingId(id)
    await deleteFondoProyecto(id)
    window.location.reload()
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Chart section ──────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #E8E6E0', padding: '24px 28px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 4 }}>
              Fondo de Retención de Talento
            </p>
            <p style={{ fontSize: 16, fontWeight: 200, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
              FPTEAM-2025
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 2, background: '#D85A30' }} />
              <span style={{ fontSize: 9, color: '#AAA', fontWeight: 300 }}>Valor real</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 2, background: '#E8913A', borderTop: '2px dashed #E8913A' }} />
              <span style={{ fontSize: 9, color: '#AAA', fontWeight: 300 }}>Proyectado{isEstimated ? ' (est.)' : ''}</span>
            </div>
          </div>
        </div>

        <FondoSVGChart
          proyectos={proyectos}
          maxY={maxY}
          irr={irr}
          isEstimated={isEstimated}
        />
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 1, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard
          label="Total comprometido"
          value={totalInvested > 0 ? fmtEurFull(totalInvested) : '—'}
          color="#1A1A1A"
        />
        <StatCard
          label="Retornado"
          value={totalReturned > 0 ? fmtEurFull(totalReturned) : '—'}
          color="#1D9E75"
        />
        <StatCard
          label="IRR anualizado"
          value={`${(irr * 100).toFixed(1)}%`}
          note={isEstimated ? 'estimado (12% ref.)' : 'basado en proyectos cerrados'}
          color={isEstimated ? '#E8913A' : '#1D9E75'}
        />
        <StatCard
          label="Proyección 2028"
          value={totalInvested > 0 ? fmtEurFull(projAt2028) : '—'}
          note="Valor estimado al cliff"
          color="#D85A30"
        />
      </div>

      {/* ── Participants table ─────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #E8E6E0', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #ECEAE6' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300 }}>
            Participantes y tramos de vesting
          </p>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                {['Participante', '%', '2028 · 25%', '2029 · 50%', '2030 · 75%', '2031 · 100%'].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 14px', fontSize: 9, fontWeight: 300,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAA',
                    textAlign: i >= 2 ? 'right' : 'left',
                    borderBottom: '1px solid #ECEAE6', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participaciones.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px 14px', fontSize: 12, color: '#CCC', fontWeight: 300, textAlign: 'center' }}>
                    Sin participantes asignados
                  </td>
                </tr>
              ) : participaciones.map((p, i) => {
                const memberProfile = p.profiles
                const displayName = memberProfile
                  ? memberName(memberProfile)
                  : allMembers.find(m => m.id === p.user_id)
                    ? memberName(allMembers.find(m => m.id === p.user_id)!)
                    : p.user_id

                const trancheDates = VESTING_DATES
                const trancheMultipliers = [0.25, 0.50, 0.75, 1.00]

                return (
                  <tr key={p.user_id} style={{ borderBottom: '1px solid #F5F3EF' }}>
                    <td style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 8, color: '#fff', fontWeight: 600 }}>
                            {memberProfile
                              ? [(memberProfile.nombre?.[0] ?? ''), (memberProfile.apellido?.[0] ?? '')].join('').toUpperCase()
                              : '?'
                            }
                          </span>
                        </div>
                        <span style={{ fontSize: 13, color: '#333', fontWeight: 300 }}>{displayName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 200, color: '#1A1A1A' }}>
                      {p.porcentaje_participacion}%
                    </td>
                    {trancheDates.map((vd, ti) => {
                      const fundVal = fundValueAt(vd, proyectos, irr)
                      const share   = fundVal * (p.porcentaje_participacion / 100) * trancheMultipliers[ti]
                      return (
                        <td key={ti} style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12, fontWeight: 300, color: totalInvested === 0 ? '#CCC' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
                          {totalInvested === 0 ? '—' : fmtEurFull(share)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Projects list ─────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #E8E6E0', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #ECEAE6' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300 }}>
            Proyectos del fondo
          </p>
        </div>
        {proyectos.length === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#CCC', fontWeight: 300 }}>
              Sin proyectos registrados. {isPartner && 'Añade el primer proyecto con el botón de abajo.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: '#FAFAF8' }}>
                  {['Nombre', 'Invertido', 'Retornado', 'IRR', 'Estado', ...(isPartner ? [''] : [])].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 14px', fontSize: 9, fontWeight: 300,
                      letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAA',
                      textAlign: i >= 1 && i <= 3 ? 'right' : 'left',
                      borderBottom: '1px solid #ECEAE6', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proyectos.map(p => {
                  const isClosed = p.monto_retornado != null && p.fecha_retorno != null
                  let proyIrr: number | null = null
                  if (isClosed && p.monto_invertido > 0) {
                    const y = yearsHeld(
                      new Date(p.fecha_inversion + 'T12:00:00'),
                      new Date(p.fecha_retorno! + 'T12:00:00'),
                    )
                    if (y > 0) proyIrr = Math.pow(p.monto_retornado! / p.monto_invertido, 1 / y) - 1
                  }
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F5F3EF' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#333', fontWeight: 300 }}>
                        <div>
                          <p style={{ margin: 0 }}>{p.nombre}</p>
                          {p.descripcion && (
                            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#AAA', fontWeight: 300 }}>{p.descripcion}</p>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: '#1A1A1A', fontWeight: 300, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {fmtEurFull(p.monto_invertido)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, fontWeight: 300, color: isClosed ? '#1D9E75' : '#AAA', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {isClosed ? fmtEurFull(p.monto_retornado!) : 'Activo'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, fontWeight: 300, color: proyIrr != null ? (proyIrr >= 0 ? '#1D9E75' : '#D85A30') : '#CCC', fontVariantNumeric: 'tabular-nums' }}>
                        {proyIrr != null ? `${(proyIrr * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 400, letterSpacing: '0.08em',
                          textTransform: 'uppercase', padding: '2px 8px',
                          borderRadius: 2,
                          background: isClosed ? '#1D9E7514' : '#E8913A14',
                          color:      isClosed ? '#1D9E75'   : '#E8913A',
                          border:     `1px solid ${isClosed ? '#1D9E7530' : '#E8913A30'}`,
                        }}>
                          {isClosed ? 'Retornado' : 'Activo'}
                        </span>
                      </td>
                      {isPartner && (
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteProyecto(p.id)}
                            disabled={deletingId === p.id}
                            style={{ ...btnGhost, fontSize: 9, padding: '4px 10px', color: '#C04828', borderColor: '#F0D0C8' }}
                          >
                            {deletingId === p.id ? '…' : '×'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Partner management buttons ─────────────────────────────────── */}
      {isPartner && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddProyecto(true)} style={btnPrimary}>
            ⊕ Añadir proyecto
          </button>
          <button onClick={() => setShowGestPartes(true)} style={btnAccent}>
            ⚙ Gestionar participantes
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showAddProyecto && (
        <Modal title="Añadir proyecto" onClose={() => setShowAddProyecto(false)}>
          <AddProyectoModal onClose={() => setShowAddProyecto(false)} />
        </Modal>
      )}

      {showGestPartes && (
        <Modal title="Gestionar participantes" onClose={() => setShowGestPartes(false)}>
          <GestionarParticipantesModal
            participaciones={participaciones}
            allMembers={allMembers}
            onClose={() => setShowGestPartes(false)}
          />
        </Modal>
      )}
    </div>
  )
}

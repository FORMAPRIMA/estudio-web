'use client'

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react'
import {
  getCalendarioData,
  createEventoCalendario,
  deleteEventoCalendario,
  marcarVistoBueno,
  type CalendarioData,
  type CalendarioEvento,
  type TipoEvento,
  type AlcanceEvento,
} from '@/app/actions/calendario'

// ── Constantes de presentación ───────────────────────────────────────────────

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type TipoVisual = TipoEvento | 'festivo'
const TIPO_META: Record<TipoVisual, { label: string; text: string; bg: string; border: string }> = {
  vacaciones:  { label: 'Vacaciones',  text: '#2F8F5B', bg: '#E8F2EC', border: '#C3E0CE' },
  teletrabajo: { label: 'Teletrabajo', text: '#2E6BA8', bg: '#E9F0F9', border: '#C8DAF0' },
  hito:        { label: 'Hito',        text: '#C2592A', bg: '#FBEDE5', border: '#F0D6C5' },
  festivo:     { label: 'Festivo',     text: '#B0413A', bg: '#FCEBE9', border: '#F3D4CF' },
}

const PERSON_COLORS = [
  '#D85A30', '#3CA56B', '#3B82C4', '#9B59B6', '#E0A93B',
  '#C0504A', '#5A6ACF', '#2FA39B', '#B5651D', '#7A8B3A',
]
function personColor(id: string | null) {
  if (!id) return '#9AA0A6'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PERSON_COLORS[h % PERSON_COLORS.length]
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function buildGrid(year: number, month0: number): Date[] {
  const first = new Date(year, month0, 1)
  const startWeekday = (first.getDay() + 6) % 7 // Lunes = 0
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const weeks = Math.ceil((startWeekday + daysInMonth) / 7)
  const gridStart = new Date(year, month0, 1 - startWeekday)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function fmtRango(inicio: string, fin: string) {
  const f = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}` }
  return inicio === fin ? f(inicio) : `${f(inicio)} – ${f(fin)}`
}

/** Cuenta días hábiles (lun–vie excluyendo festivos) en un rango inclusivo. */
function diasHabilesEnRango(inicio: string, fin: string, festivos: Record<string, string>) {
  let count = 0
  const cur = new Date(inicio + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6 && !festivos[keyOf(cur)]) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// ── Componente principal ──────────────────────────────────────────────────────

type Modal =
  | { mode: 'create'; fecha: string }
  | { mode: 'view'; evento: CalendarioEvento }
  | { mode: 'dayList'; fecha: string }
  | null

const TIPO_FILTROS: TipoVisual[] = ['vacaciones', 'teletrabajo', 'hito', 'festivo']

export default function CalendarioEquipo() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month0, setMonth0] = useState(now.getMonth()) // 0–11

  const [data, setData] = useState<CalendarioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [activos, setActivos] = useState<TipoVisual[]>([...TIPO_FILTROS])
  const [personaId, setPersonaId] = useState<string>('')

  const load = useCallback(async () => {
    const res = await getCalendarioData(year, month0 + 1)
    setData(res)
    setLoading(false)
  }, [year, month0])

  useEffect(() => { load() }, [load])

  const todayKey = keyOf(now)
  const grid = useMemo(() => buildGrid(year, month0), [year, month0])

  // Índice de eventos por día (ya filtrado por toggles y persona)
  const eventosPorDia = useMemo(() => {
    const map: Record<string, CalendarioEvento[]> = {}
    if (!data) return map
    for (const ev of data.eventos) {
      if (!activos.includes(ev.tipo)) continue
      if (personaId && ev.user_id !== personaId) continue
      let d = new Date(ev.fecha_inicio + 'T00:00:00')
      const end = new Date(ev.fecha_fin + 'T00:00:00')
      while (d <= end) {
        const k = keyOf(d);
        (map[k] ??= []).push(ev)
        d = new Date(d); d.setDate(d.getDate() + 1)
      }
    }
    return map
  }, [data, activos, personaId])

  const festivosPorDia = useMemo(() => {
    const map: Record<string, string> = {}
    if (!data || !activos.includes('festivo')) return map
    for (const f of data.festivos) map[f.fecha] = f.nombre
    return map
  }, [data, activos])

  const goPrev  = () => { const m = month0 - 1; if (m < 0) { setMonth0(11); setYear(y => y - 1) } else setMonth0(m) }
  const goNext  = () => { const m = month0 + 1; if (m > 11) { setMonth0(0); setYear(y => y + 1) } else setMonth0(m) }
  const goToday = () => { setYear(now.getFullYear()); setMonth0(now.getMonth()) }

  const toggleTipo = (t: TipoVisual) =>
    setActivos(prev => prev.includes(t)
      ? (prev.length === 1 ? prev : prev.filter(x => x !== t))
      : [...prev, t])

  return (
    <div style={{ fontFamily: 'inherit', color: '#1A1A1A' }}>

      {/* ── Cabecera: mes + navegación ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.01em', margin: 0 }}>
            {MESES[month0]} <span style={{ color: '#B8B4AC' }}>{year}</span>
          </h3>
          <button onClick={goToday} style={navTextBtn}>Hoy</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={goPrev} style={navArrowBtn} aria-label="Mes anterior">‹</button>
          <button onClick={goNext} style={navArrowBtn} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      {/* ── Filtros: tipos + persona ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {TIPO_FILTROS.map(t => {
            const meta = TIPO_META[t]
            const on = activos.includes(t)
            return (
              <button key={t} onClick={() => toggleTipo(t)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 26, padding: '0 11px', borderRadius: 13, cursor: 'pointer',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${on ? meta.border : '#E8E6E0'}`,
                background: on ? meta.bg : '#fff',
                color: on ? meta.text : '#B0ABA2',
                transition: 'all .12s',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? meta.text : '#D8D4CC' }} />
                {meta.label}
              </button>
            )
          })}
        </div>
        {data && data.miembros.length > 0 && (
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={{
            height: 28, padding: '0 10px', fontSize: 12, fontFamily: 'inherit',
            color: '#1A1A1A', border: '1px solid #E8E6E0', borderRadius: 6,
            background: '#fff', cursor: 'pointer', outline: 'none',
          }}>
            <option value="">Todo el equipo</option>
            {data.miembros.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}
      </div>

      {/* ── Rejilla ────────────────────────────────────────────────────────── */}
      <div style={{ border: '1px solid #ECEAE3', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        {/* Cabecera de días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {DIAS.map((d, i) => (
            <div key={d} style={{
              padding: '9px 0', textAlign: 'center', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: i >= 5 ? '#C2724F' : '#A8A39A',
              borderBottom: '1px solid #ECEAE3',
              background: '#FBFAF7',
            }}>{d}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '64px 0', textAlign: 'center', color: '#B8B4AC', fontSize: 13 }}>Cargando calendario…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {grid.map((d, i) => {
              const k = keyOf(d)
              const inMonth = d.getMonth() === month0
              const isToday = k === todayKey
              const weekend = i % 7 >= 5
              const festivo = festivosPorDia[k]
              const evs = eventosPorDia[k] ?? []
              const maxChips = 3

              return (
                <div
                  key={k}
                  onClick={() => setModal({ mode: 'create', fecha: k })}
                  style={{
                    minHeight: 96, padding: 6, cursor: 'pointer', position: 'relative',
                    borderRight: (i % 7 !== 6) ? '1px solid #F0EEE8' : 'none',
                    borderBottom: i < grid.length - 7 ? '1px solid #F0EEE8' : 'none',
                    background: festivo ? TIPO_META.festivo.bg
                      : !inMonth ? '#FCFBF8'
                      : weekend ? '#FBFAF7' : '#fff',
                    opacity: inMonth ? 1 : 0.55,
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (!festivo && inMonth) (e.currentTarget as HTMLElement).style.background = '#FAF8F3' }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = festivo ? TIPO_META.festivo.bg
                      : !inMonth ? '#FCFBF8' : weekend ? '#FBFAF7' : '#fff'
                  }}
                >
                  {/* Número del día */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 20, height: 20, borderRadius: '50%', padding: '0 5px',
                      fontSize: 11.5, fontWeight: isToday ? 700 : 500, fontVariantNumeric: 'tabular-nums',
                      background: isToday ? '#1A1A1A' : 'transparent',
                      color: isToday ? '#fff' : festivo ? TIPO_META.festivo.text : weekend ? '#C2724F' : '#46423B',
                    }}>{d.getDate()}</span>
                  </div>

                  {/* Festivo */}
                  {festivo && (
                    <div title={festivo} style={{
                      fontSize: 9.5, fontWeight: 600, color: TIPO_META.festivo.text,
                      lineHeight: 1.2, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{festivo}</div>
                  )}

                  {/* Chips de eventos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {evs.slice(0, maxChips).map((ev, idx) => {
                      const isStart    = ev.fecha_inicio === k
                      const isEnd      = ev.fecha_fin    === k
                      const isWeekStart = i % 7 === 0
                      const isWeekEnd   = i % 7 === 6
                      const isLastCol   = i % 7 === 6
                      return (
                        <Chip
                          key={ev.id + idx}
                          ev={ev}
                          isStart={isStart}
                          isEnd={isEnd}
                          isWeekStart={isWeekStart}
                          isWeekEnd={isWeekEnd}
                          isLastCol={isLastCol}
                          onClick={e => { e.stopPropagation(); setModal({ mode: 'view', evento: ev }) }}
                        />
                      )
                    })}
                    {evs.length > maxChips && (
                      <button
                        onClick={e => { e.stopPropagation(); setModal({ mode: 'dayList', fecha: k }) }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: '#9A958C', textAlign: 'left', padding: '1px 4px' }}
                      >+{evs.length - maxChips} más</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Leyenda ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 12, fontSize: 11, color: '#9A958C' }}>
        {TIPO_FILTROS.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: TIPO_META[t].bg, border: `1px solid ${TIPO_META[t].border}` }} />
            {TIPO_META[t].label}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#9AA0A6' }} />
          El punto indica la persona
        </span>
      </div>

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      {modal && (
        <Overlay onClose={() => setModal(null)}>
          {modal.mode === 'create' && (
            <CreateForm fecha={modal.fecha} onDone={() => { setModal(null); load() }} />
          )}
          {modal.mode === 'view' && data && (
            <ViewEvento
              ev={modal.evento}
              data={data}
              onDone={() => { setModal(null); load() }}
            />
          )}
          {modal.mode === 'dayList' && (
            <DayList
              fecha={modal.fecha}
              eventos={eventosPorDia[modal.fecha] ?? []}
              festivo={festivosPorDia[modal.fecha]}
              onPick={ev => setModal({ mode: 'view', evento: ev })}
              onAdd={() => setModal({ mode: 'create', fecha: modal.fecha })}
            />
          )}
        </Overlay>
      )}
    </div>
  )
}

// ── Chip ────────────────────────────────────────────────────────────────────

function Chip({
  ev, isStart, isEnd, isWeekStart, isWeekEnd, isLastCol, onClick,
}: {
  ev: CalendarioEvento
  isStart: boolean
  isEnd: boolean
  isWeekStart: boolean
  isWeekEnd: boolean
  isLastCol: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const meta = TIPO_META[ev.tipo]
  const pendiente = ev.tipo === 'vacaciones' && !ev.visto_bueno
  const segmentStart = isStart || isWeekStart
  const segmentEnd   = isEnd   || isWeekEnd
  const continuesLeft  = !segmentStart
  const continuesRight = !segmentEnd

  // Etiqueta visible solo al inicio del segmento (inicio del evento o lunes).
  const baseLabel = ev.tipo === 'hito'
    ? (ev.titulo ?? 'Hito')
    : `${ev.autor_nombre} - ${meta.label}`
  const showLabel = segmentStart

  return (
    <button
      onClick={onClick}
      title={`${meta.label} · ${ev.autor_nombre}${ev.titulo ? ` · ${ev.titulo}` : ''} · ${fmtRango(ev.fecha_inicio, ev.fecha_fin)}${pendiente ? ' · pendiente de visto bueno' : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        width: 'auto',
        marginLeft:  continuesLeft  ? -7 : 0,
        marginRight: continuesRight ? (isLastCol ? -6 : -7) : 0,
        padding: showLabel ? '2px 6px' : '2px 0',
        minHeight: 18,
        borderTopLeftRadius:     continuesLeft  ? 0 : 5,
        borderBottomLeftRadius:  continuesLeft  ? 0 : 5,
        borderTopRightRadius:    continuesRight ? 0 : 5,
        borderBottomRightRadius: continuesRight ? 0 : 5,
        textAlign: 'left', cursor: 'pointer',
        background: meta.bg, color: meta.text,
        borderTop:    `1px ${pendiente ? 'dashed' : 'solid'} ${meta.border}`,
        borderBottom: `1px ${pendiente ? 'dashed' : 'solid'} ${meta.border}`,
        borderLeft:   continuesLeft  ? 'none' : `1px ${pendiente ? 'dashed' : 'solid'} ${meta.border}`,
        borderRight:  continuesRight ? 'none' : `1px ${pendiente ? 'dashed' : 'solid'} ${meta.border}`,
        opacity: pendiente ? 0.78 : 1, overflow: 'hidden',
      }}
    >
      {showLabel && (
        <>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: personColor(ev.user_id), flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {baseLabel}
          </span>
        </>
      )}
    </button>
  )
}

// ── Overlay genérico ──────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,26,26,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 30px', width: 380, maxWidth: '100%', boxShadow: '0 24px 70px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  )
}

// ── Formulario de creación ────────────────────────────────────────────────────

function CreateForm({ fecha, onDone }: { fecha: string; onDone: () => void }) {
  const [tipo, setTipo] = useState<TipoEvento>('vacaciones')
  const [alcance, setAlcance] = useState<AlcanceEvento>('personal')
  const [titulo, setTitulo] = useState('')
  const [inicio, setInicio] = useState(fecha)
  const [fin, setFin] = useState(fecha)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  const submit = () => {
    setError(null)
    startSave(async () => {
      const res = await createEventoCalendario({
        tipo, alcance: tipo === 'hito' ? alcance : undefined,
        titulo: tipo === 'hito' ? titulo : undefined,
        fecha_inicio: inicio, fecha_fin: fin, nota,
      })
      if ('error' in res) setError(res.error)
      else onDone()
    })
  }

  return (
    <>
      <div>
        <p style={labelEyebrow}>Nuevo evento</p>
        <h3 style={{ fontSize: 19, fontWeight: 300, margin: '2px 0 0' }}>Añadir al calendario</h3>
      </div>

      {/* Tipo */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['vacaciones', 'teletrabajo', 'hito'] as TipoEvento[]).map(t => {
          const meta = TIPO_META[t]
          const on = tipo === t
          return (
            <button key={t} onClick={() => setTipo(t)} style={{
              flex: 1, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
              border: `1px solid ${on ? meta.border : '#E8E6E0'}`,
              background: on ? meta.bg : '#fff', color: on ? meta.text : '#9A958C',
            }}>{meta.label}</button>
          )
        })}
      </div>

      {/* Hito: título + alcance */}
      {tipo === 'hito' && (
        <>
          <Field label="Título del hito">
            <input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus placeholder="Entrega de planos, reunión…" style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['personal', 'equipo'] as AlcanceEvento[]).map(a => (
              <button key={a} onClick={() => setAlcance(a)} style={{
                flex: 1, height: 30, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', textTransform: 'capitalize',
                border: `1px solid ${alcance === a ? '#1A1A1A' : '#E8E6E0'}`,
                background: alcance === a ? '#1A1A1A' : '#fff', color: alcance === a ? '#fff' : '#9A958C',
              }}>{a === 'equipo' ? 'De equipo' : 'Personal'}</button>
            ))}
          </div>
        </>
      )}

      {/* Fechas */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Desde"><input type="date" value={inicio} onChange={e => { setInicio(e.target.value); if (fin < e.target.value) setFin(e.target.value) }} style={inputStyle} /></Field>
        <Field label="Hasta"><input type="date" value={fin} min={inicio} onChange={e => setFin(e.target.value)} style={inputStyle} /></Field>
      </div>

      <Field label="Nota (opcional)">
        <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Detalle…" style={inputStyle} />
      </Field>

      {tipo === 'vacaciones' && (
        <p style={{ fontSize: 11, color: '#9A958C', margin: 0, lineHeight: 1.4 }}>
          Se avisará a los socios. No serán visibles para el equipo hasta su visto bueno.
        </p>
      )}

      {error && <p style={errorStyle}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onDone} style={btnGhost}>Cancelar</button>
        <button onClick={submit} disabled={saving} style={btnPrimary(saving)}>{saving ? 'Guardando…' : 'Añadir'}</button>
      </div>
    </>
  )
}

// ── Vista de un evento ──────────────────────────────────────────────────────

function ViewEvento({ ev, data, onDone }: { ev: CalendarioEvento; data: CalendarioData; onDone: () => void }) {
  const meta = TIPO_META[ev.tipo]
  const [error, setError] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()
  const pendiente = ev.tipo === 'vacaciones' && !ev.visto_bueno
  const puedeBorrar = ev.user_id === data.currentUserId || data.isPartner

  // Días hábiles del rango (lun–vie, excluyendo festivos del año cargados en `data`).
  const festivosMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const f of data.festivos) m[f.fecha] = f.nombre
    return m
  }, [data.festivos])
  const diasHabiles = ev.tipo === 'vacaciones' || ev.tipo === 'teletrabajo'
    ? diasHabilesEnRango(ev.fecha_inicio, ev.fecha_fin, festivosMap)
    : 0
  const labelDias = `${diasHabiles} día${diasHabiles === 1 ? '' : 's'} háb.`

  const aprobar = () => startBusy(async () => {
    const res = await marcarVistoBueno(ev.id)
    if ('error' in res) setError(res.error); else onDone()
  })
  const borrar = () => startBusy(async () => {
    const res = await deleteEventoCalendario(ev.id)
    if ('error' in res) setError(res.error); else onDone()
  })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 11, height: 11, borderRadius: 4, background: meta.bg, border: `1px solid ${meta.border}` }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: meta.text }}>{meta.label}</span>
        {ev.tipo === 'hito' && ev.alcance === 'equipo' && (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#9A958C', border: '1px solid #E8E6E0', borderRadius: 10, padding: '1px 8px' }}>Equipo</span>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: 19, fontWeight: 300, margin: 0 }}>
          {ev.tipo === 'hito' ? (ev.titulo || 'Hito') : ev.autor_nombre}
        </h3>
        <p style={{ fontSize: 13, color: '#6B655C', margin: '4px 0 0' }}>
          {fmtRango(ev.fecha_inicio, ev.fecha_fin)}
          {(ev.tipo === 'vacaciones' || ev.tipo === 'teletrabajo') && (
            <span style={{ color: '#9A958C' }}> · {labelDias}</span>
          )}
        </p>
        {ev.tipo !== 'hito' && (
          <p style={{ fontSize: 12, color: '#9A958C', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: personColor(ev.user_id) }} />
            {ev.autor_nombre}
          </p>
        )}
        {ev.nota && <p style={{ fontSize: 13, color: '#46423B', margin: '10px 0 0', lineHeight: 1.45 }}>{ev.nota}</p>}
      </div>

      {/* Estado de visto bueno (vacaciones) */}
      {ev.tipo === 'vacaciones' && (
        <div style={{
          fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8,
          background: pendiente ? '#FCF4E8' : '#E8F2EC',
          color: pendiente ? '#B7791F' : '#2F8F5B',
          border: `1px solid ${pendiente ? '#F0DEC0' : '#C3E0CE'}`,
        }}>
          {pendiente
            ? `Pendiente de visto bueno · vas a aprobar ${labelDias} (${fmtRango(ev.fecha_inicio, ev.fecha_fin)})`
            : '✓ Con visto bueno · visible para el equipo'}
        </div>
      )}

      {error && <p style={errorStyle}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {puedeBorrar && (
            <button onClick={borrar} disabled={busy} style={{ ...btnGhost, color: '#C0504A', borderColor: '#F0D6D2' }}>Eliminar</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDone} style={btnGhost}>Cerrar</button>
          {pendiente && data.isPartner && (
            <button onClick={aprobar} disabled={busy} style={btnPrimary(busy)}>
              {busy ? '…' : `Aprobar (${labelDias})`}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Lista de un día (cuando hay muchos eventos) ───────────────────────────────

function DayList({ fecha, eventos, festivo, onPick, onAdd }: {
  fecha: string; eventos: CalendarioEvento[]; festivo?: string
  onPick: (ev: CalendarioEvento) => void; onAdd: () => void
}) {
  const [y, m, d] = fecha.split('-')
  return (
    <>
      <div>
        <p style={labelEyebrow}>{`${d}/${m}/${y}`}</p>
        <h3 style={{ fontSize: 19, fontWeight: 300, margin: '2px 0 0' }}>Eventos del día</h3>
      </div>
      {festivo && (
        <div style={{ fontSize: 12, fontWeight: 600, color: TIPO_META.festivo.text, background: TIPO_META.festivo.bg, border: `1px solid ${TIPO_META.festivo.border}`, borderRadius: 8, padding: '8px 12px' }}>{festivo}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
        {eventos.map((ev, i) => {
          const meta = TIPO_META[ev.tipo]
          return (
            <button key={ev.id + i} onClick={() => onPick(ev)} style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
              padding: '8px 11px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${meta.border}`, background: meta.bg,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: personColor(ev.user_id), flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: meta.text }}>
                {ev.tipo === 'hito' ? (ev.titulo || 'Hito') : ev.autor_nombre}
              </span>
              <span style={{ fontSize: 11, color: meta.text, opacity: 0.7, marginLeft: 'auto' }}>{meta.label}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onAdd} style={btnPrimary(false)}>+ Añadir evento</button>
      </div>
    </>
  )
}

// ── Sub-componentes y estilos ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A8A39A', display: 'block', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}

const labelEyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B8B4AC', margin: 0 }
const inputStyle: React.CSSProperties = { width: '100%', height: 38, padding: '0 11px', fontSize: 13, fontFamily: 'inherit', color: '#1A1A1A', border: '1px solid #E8E6E0', borderRadius: 7, outline: 'none', boxSizing: 'border-box' }
const errorStyle: React.CSSProperties = { fontSize: 12, color: '#C0504A', margin: 0 }
const btnGhost: React.CSSProperties = { height: 36, padding: '0 16px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#6B655C', fontFamily: 'inherit' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({ height: 36, padding: '0 18px', background: disabled ? '#CCC' : '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' })
const navTextBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#D85A30', fontFamily: 'inherit', padding: 0 }
const navArrowBtn: React.CSSProperties = { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, cursor: 'pointer', fontSize: 18, color: '#46423B', fontFamily: 'inherit', lineHeight: 1 }

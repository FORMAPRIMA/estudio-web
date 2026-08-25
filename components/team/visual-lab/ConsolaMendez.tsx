'use client'

import { useMemo, useState } from 'react'
import {
  type Vivienda, type EstadoId, type Palancas, type CotEmitida, type LogEntry,
  TIPOS, ESTADOS, PLANTAS_MAX,
  plantaLabel, colocada, eur, mm, num, C,
} from '@/lib/visual-lab/mendez'

type Vista = 'inventario' | 'precios' | 'cotizaciones' | 'actividad'

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'inventario', label: 'Inventario' },
  { id: 'precios', label: 'Matriz de precios' },
  { id: 'cotizaciones', label: 'Cotizaciones' },
  { id: 'actividad', label: 'Actividad' },
]

const GRID = '.7fr 1.1fr .7fr .5fr .9fr 1fr .8fr .9fr 1.1fr'

interface Props {
  units: Vivienda[]
  palancas: Palancas
  onPalancas: (p: Palancas) => void
  onRecalcular: () => void
  cots: CotEmitida[]
  log: LogEntry[]
  selId: string | null
  onSel: (id: string) => void
  onVerVivienda: (id: string) => void
  onSetEstado: (id: string, e: EstadoId) => void
  onCotizar: (id: string) => void
}

export default function ConsolaMendez({
  units, palancas, onPalancas, onRecalcular, cots, log, selId, onSel, onVerVivienda, onSetEstado, onCotizar,
}: Props) {
  const [vista, setVista] = useState<Vista>('inventario')
  const [q, setQ] = useState('')
  const [fEstado, setFEstado] = useState<EstadoId | ''>('')

  const cuenta: Record<string, number> = {}
  ;(Object.keys(ESTADOS) as EstadoId[]).forEach((k) => { cuenta[k] = 0 })
  let valorTotal = 0, valorCol = 0
  units.forEach((u) => {
    cuenta[u.estado]++
    valorTotal += u.precio
    if (colocada(u)) valorCol += u.precio
  })

  const filas = useMemo(() => units.filter((u) => {
    if (fEstado && u.estado !== fEstado) return false
    if (q) {
      const s = (u.id + ' ' + TIPOS[u.tipo].label + ' ' + u.orient).toLowerCase()
      if (!s.includes(q.toLowerCase())) return false
    }
    return true
  }), [units, q, fEstado])

  /** Plano de apilamiento: una fila por planta, una celda por vivienda. */
  const plantas = useMemo(() => {
    const out: { p: string; celdas: Vivienda[]; nota: string }[] = []
    for (let p = PLANTAS_MAX; p >= 0; p--) {
      const us = units.filter((x) => x.planta === p)
      out.push({ p: plantaLabel(p, true), celdas: us, nota: us.length ? '' : 'Amenidades' })
    }
    return out
  }, [units])

  const sel = selId ? units.find((u) => u.id === selId) ?? null : null

  const tiles = [
    { k: 'Disponibles', v: String(cuenta.disponible), fg: C.green },
    { k: 'En negociación', v: String(cuenta.negociacion), fg: C.blue },
    { k: 'Reservadas', v: String(cuenta.reservada), fg: C.gold },
    { k: 'Vendidas', v: String(cuenta.vendida), fg: C.grey },
    { k: 'Valor inventario', v: mm(valorTotal), fg: C.ink },
    { k: 'Comercializado', v: mm(valorCol), fg: C.ink },
  ]

  const campos: { k: string; get: () => number; set: (v: number) => Palancas; step: number }[] = [
    { k: 'Precio base €/m²', get: () => palancas.base, set: (v) => ({ ...palancas, base: v }), step: 50 },
    { k: 'Prima por planta %', get: () => +(palancas.planta * 100).toFixed(2), set: (v) => ({ ...palancas, planta: v / 100 }), step: 0.05 },
    { k: 'Prima ático %', get: () => +((palancas.atico - 1) * 100).toFixed(0), set: (v) => ({ ...palancas, atico: 1 + v / 100 }), step: 1 },
    { k: 'Prima vista sierra %', get: () => +(palancas.vista.Sierra * 100).toFixed(0), set: (v) => ({ ...palancas, vista: { ...palancas.vista, Sierra: v / 100 } }), step: 1 },
    { k: 'Prima vista ciudad %', get: () => +(palancas.vista.Ciudad * 100).toFixed(0), set: (v) => ({ ...palancas, vista: { ...palancas.vista, Ciudad: v / 100 } }), step: 1 },
    { k: 'Prima vista parque %', get: () => +(palancas.vista.Parque * 100).toFixed(0), set: (v) => ({ ...palancas, vista: { ...palancas.vista, Parque: v / 100 } }), step: 1 },
  ]

  return (
    <div className="vl-consola">
      <div className="vl-consola-nav">
        {VISTAS.map((x) => (
          <button key={x.id} onClick={() => setVista(x.id)} data-on={vista === x.id ? '1' : '0'}>{x.label}</button>
        ))}
      </div>

      <div className="vl-consola-body">
        <div className="vl-tiles" style={{ marginBottom: 16 }}>
          {tiles.map((t) => (
            <div key={t.k} className="vl-tile">
              <p className="vl-tile-k" style={{ margin: 0 }}>{t.k}</p>
              <p className="vl-tile-v" style={{ margin: 0, color: t.fg }}>{t.v}</p>
            </div>
          ))}
        </div>

        {vista === 'inventario' && (
          <div className="vl-mz-inv">
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <input className="vl-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clave, tipología u orientación" />
                <div className="vl-scrollx">
                  {([{ k: '' as const, l: 'Todas' }, ...(Object.keys(ESTADOS) as EstadoId[]).map((k) => ({ k, l: ESTADOS[k].label }))]).map((o) => (
                    <button key={o.k || 'todas'} className="vl-chip" data-on={fEstado === o.k ? '1' : '0'} onClick={() => setFEstado(o.k)}>{o.l}</button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: C.faint, margin: 0 }}>{filas.length} de {units.length} viviendas</p>
              </div>

              {/* Escritorio */}
              <div className="vl-inv-table" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 14px', borderBottom: `1px solid ${C.border}` }}>
                  {[
                    { t: 'Clave', a: 'left' }, { t: 'Tipo', a: 'left' }, { t: 'Planta', a: 'left' },
                    { t: 'Dorm', a: 'left' }, { t: 'm² ú/t', a: 'left' }, { t: 'Orient.', a: 'left' },
                    { t: '€/m²', a: 'right' }, { t: 'Precio', a: 'right' }, { t: 'Estado', a: 'right' },
                  ].map((h, i) => (
                    <div key={i} className="vl-label" style={{ padding: '10px 0', textAlign: h.a as 'left' | 'right' }}>{h.t}</div>
                  ))}
                </div>
                {filas.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => onSel(u.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: GRID, padding: '0 14px', alignItems: 'center',
                      borderBottom: `1px solid ${C.borderSoft}`, cursor: 'pointer',
                      background: selId === u.id ? '#FDF4EF' : 'transparent',
                    }}
                  >
                    <button onClick={(e) => { e.stopPropagation(); onVerVivienda(u.id) }} style={{ padding: '8px 0', fontSize: 13, fontWeight: 500, textAlign: 'left', color: C.ink }}>{u.id}</button>
                    <div style={{ fontSize: 11.5, color: '#3A3A36' }}>{TIPOS[u.tipo].label}</div>
                    <div style={{ fontSize: 11.5, color: '#3A3A36' }}>{plantaLabel(u.planta, true)}</div>
                    <div style={{ fontSize: 11.5, color: '#3A3A36' }}>{u.dorm}</div>
                    <div style={{ fontSize: 11.5, color: '#3A3A36' }}>{u.util} / {u.ter}</div>
                    <div style={{ fontSize: 11.5, color: '#3A3A36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.orient}</div>
                    <div style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{num(u.precio / u.util)}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{eur(u.precio)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <span style={{ width: 7, height: 7, flex: '0 0 7px', background: ESTADOS[u.estado].color }} />
                      <span style={{ fontSize: 11, color: ESTADOS[u.estado].color, whiteSpace: 'nowrap' }}>{ESTADOS[u.estado].label}</span>
                    </div>
                  </div>
                ))}
                {filas.length === 0 && (
                  <p style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: C.muted, margin: 0 }}>Ninguna vivienda cumple el filtro.</p>
                )}
              </div>

              {/* Móvil */}
              <div>
                {filas.map((u) => (
                  <div key={u.id} className="vl-inv-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                      <button onClick={() => onVerVivienda(u.id)} style={{ fontSize: 18, fontWeight: 300, color: C.ink }}>{u.id}</button>
                      <span style={{ fontSize: 11, color: ESTADOS[u.estado].color }}>{ESTADOS[u.estado].label}</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>
                      {TIPOS[u.tipo].label} · {plantaLabel(u.planta)} · {u.orient}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
                      <Dato k="m² ú/t" v={`${u.util} / ${u.ter}`} />
                      <Dato k="€/m²" v={num(u.precio / u.util)} />
                      <Dato k="Precio" v={eur(u.precio)} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
                      {(Object.keys(ESTADOS) as EstadoId[]).map((k) => (
                        <button key={k} className="vl-chip" style={{ fontSize: 10, padding: '6px 9px' }} data-on={u.estado === k ? '1' : '0'} onClick={() => onSetEstado(u.id, k)}>
                          {ESTADOS[k].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plano de apilamiento + inspector */}
            <div className="vl-mz-aside">
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px 16px' }}>
                <p className="vl-label" style={{ margin: '0 0 12px' }}>Plano de apilamiento</p>
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {plantas.map((pl) => (
                    <div key={pl.p} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: C.faint, width: 24, flex: '0 0 24px' }}>{pl.p}</span>
                      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                        {pl.celdas.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => onSel(u.id)}
                            aria-label={`Vivienda ${u.id}`}
                            style={{
                              flex: 1, height: 14, background: ESTADOS[u.estado].color,
                              border: `1px solid ${selId === u.id ? C.ink : 'rgba(23,24,26,.14)'}`,
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: 8.5, letterSpacing: '0.08em', color: '#C4C4BE', width: 58, flex: '0 0 58px' }}>{pl.nota}</span>
                    </div>
                  ))}
                </div>
              </div>

              {sel && (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 300, lineHeight: 1 }}>{sel.id}</span>
                    <span style={{ fontSize: 11, color: ESTADOS[sel.estado].color }}>{ESTADOS[sel.estado].label}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: C.muted, margin: '7px 0 0', lineHeight: 1.5 }}>
                    {TIPOS[sel.tipo].label} · {plantaLabel(sel.planta, true)} · {sel.util} m² · {sel.orient}
                  </p>
                  <p style={{ fontSize: 22, fontWeight: 300, margin: '10px 0 0' }}>{eur(sel.precio)}</p>
                  <p className="vl-label" style={{ margin: '16px 0 8px' }}>Cambiar estado</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(Object.keys(ESTADOS) as EstadoId[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => onSetEstado(sel.id, k)}
                        style={{
                          padding: '8px 10px', textAlign: 'left', fontSize: 11, borderRadius: 3,
                          border: `1px solid ${sel.estado === k ? ESTADOS[k].color : C.border}`,
                          background: sel.estado === k ? ESTADOS[k].color + '20' : 'transparent',
                          color: sel.estado === k ? C.ink : '#3A3A36',
                        }}
                      >
                        {ESTADOS[k].label}
                      </button>
                    ))}
                  </div>
                  <button className="vl-btn vl-btn-primary" style={{ marginTop: 12 }} onClick={() => onCotizar(sel.id)}>Generar cotización</button>
                </div>
              )}
            </div>
          </div>
        )}

        {vista === 'precios' && (
          <div style={{ maxWidth: 760, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '20px 22px 22px' }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3A3A36', margin: '0 0 20px', maxWidth: '62ch' }}>
              El precio de cada vivienda sale del precio base por metro útil con primas acumulativas por altura,
              vista y orientación. Al recalcular se sobrescriben las {units.length} viviendas y queda registrado en la bitácora.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 26px' }}>
              {campos.map((c) => (
                <div key={c.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingBottom: 9, borderBottom: `1px solid ${C.border}` }}>
                  <span className="vl-label">{c.k}</span>
                  <input
                    type="number"
                    value={c.get()}
                    step={c.step}
                    onChange={(e) => onPalancas(c.set(+e.target.value))}
                    style={{ width: 96, textAlign: 'right', padding: '7px 9px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, color: C.ink, outline: 'none' }}
                  />
                </div>
              ))}
            </div>
            <button className="vl-btn vl-btn-primary" style={{ marginTop: 24, width: 'auto', padding: '13px 24px' }} onClick={onRecalcular}>
              Recalcular {units.length} viviendas
            </button>
          </div>
        )}

        {vista === 'cotizaciones' && (
          cots.length === 0 ? (
            <p style={{ padding: '56px 0', textAlign: 'center', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Sin cotizaciones emitidas.
              <br />
              Selecciona una vivienda en el showroom y genera una cotización con plan de pago.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {cots.map((c) => (
                <div key={c.folio} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span className="vl-label">{c.folio}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{c.fecha}</span>
                  </div>
                  <p style={{ fontSize: 22, margin: '8px 0 0', fontWeight: 300 }}>{c.id}</p>
                  <p style={{ fontSize: 11.5, color: C.muted, margin: '4px 0 0' }}>{c.cliente}</p>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
                    <div className="vl-row" style={{ padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: '#3A3A36' }}>Precio</span>
                      <span style={{ fontSize: 13 }}>{c.precio}</span>
                    </div>
                    <div className="vl-row" style={{ padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: '#3A3A36' }}>Total con impuestos</span>
                      <span style={{ fontSize: 13 }}>{c.total}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {vista === 'actividad' && (
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 16px 8px' }}>
            {(log.length ? log : [{ t: '', txt: 'Sin movimientos registrados en esta sesión.' }]).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'baseline', padding: '11px 0', borderBottom: i === log.length - 1 ? 'none' : `1px solid ${C.borderSoft}`, flexWrap: 'wrap' }}>
                <span style={{ flex: '0 0 110px', fontSize: 11, color: C.muted }}>
                  {l.t ? new Date(l.t).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
                <span style={{ fontSize: 13, color: '#3A3A36' }}>{l.txt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="vl-label" style={{ margin: 0, fontSize: 9.5 }}>{k}</p>
      <p style={{ fontSize: 12.5, margin: '3px 0 0' }}>{v}</p>
    </div>
  )
}

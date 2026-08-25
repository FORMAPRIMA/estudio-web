'use client'

import { useMemo, useState } from 'react'
import {
  type Local, type EstadoId, type PropEmitida, type LogEntry,
  RUBROS, FORMATOS, ESTADOS,
  valorar, contratado, eur, mm, num, dec, C,
} from '@/lib/visual-lab/dehesa'

type Vista = 'inventario' | 'mix' | 'propuestas' | 'actividad'

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'inventario', label: 'Inventario' },
  { id: 'mix', label: 'Mix y valoración' },
  { id: 'propuestas', label: 'Propuestas' },
  { id: 'actividad', label: 'Actividad' },
]

const GRID = '.9fr 1.3fr 1fr .8fr .8fr 1.1fr 1.3fr 1.1fr'

const ACCIONES: { e: EstadoId; l: string }[] = [
  { e: 'disponible', l: 'Libre' },
  { e: 'negociacion', l: 'Neg.' },
  { e: 'firmado', l: 'Firma' },
]

interface Props {
  units: Local[]
  glaTotal: number
  plazas: number
  opex: number
  yld: number
  onOpex: (v: number) => void
  onYield: (v: number) => void
  props: PropEmitida[]
  log: LogEntry[]
  onVerLocal: (id: string) => void
  onSetEstado: (id: string, e: EstadoId) => void
}

export default function ConsolaDehesa({
  units, glaTotal, plazas, opex, yld, onOpex, onYield, props, log, onVerLocal, onSetEstado,
}: Props) {
  const [vista, setVista] = useState<Vista>('inventario')
  const [q, setQ] = useState('')
  const [fEstado, setFEstado] = useState<EstadoId | ''>('')

  const glaCon = units.filter(contratado).reduce((a, u) => a + u.gla, 0)
  const v = useMemo(() => valorar(units, opex, yld), [units, opex, yld])

  const filas = useMemo(() => units.filter((u) => {
    if (fEstado && u.estado !== fEstado) return false
    if (q) {
      const s = (u.id + ' ' + RUBROS[u.rubro].label + ' ' + u.inquilino).toLowerCase()
      if (!s.includes(q.toLowerCase())) return false
    }
    return true
  }), [units, q, fEstado])

  const tiles = [
    { k: 'GLA total', v: num(glaTotal) + ' m²', fg: C.ink },
    { k: 'Ocupación', v: Math.round((glaCon / glaTotal) * 100) + '%', fg: C.accent },
    { k: 'Renta contratada', v: mm(v.rentaCon, 2), fg: C.ink },
    { k: 'NOI', v: mm(v.noi, 2), fg: C.ink },
    { k: 'Valor', v: mm(v.valor, 2), fg: C.ink },
    { k: 'Plazas', v: num(plazas), fg: C.ink },
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
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <input className="vl-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar local, rubro o inquilino" />
              <div className="vl-scrollx">
                {([{ k: '' as const, l: 'Todos' }, ...(Object.keys(ESTADOS) as EstadoId[]).map((k) => ({ k, l: ESTADOS[k].label }))]).map((o) => (
                  <button key={o.k || 'todos'} className="vl-chip" data-on={fEstado === o.k ? '1' : '0'} onClick={() => setFEstado(o.k)}>{o.l}</button>
                ))}
              </div>
            </div>

            {/* Escritorio */}
            <div className="vl-inv-table" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 16px', borderBottom: `1px solid ${C.border}` }}>
                {[
                  { t: 'Local', a: 'left' }, { t: 'Rubro', a: 'left' }, { t: 'Formato', a: 'left' },
                  { t: 'GLA', a: 'right' }, { t: '€/m²', a: 'right' }, { t: 'Renta/mes', a: 'right' },
                  { t: 'Estado', a: 'right' }, { t: '', a: 'right' },
                ].map((h, i) => (
                  <div key={i} className="vl-label" style={{ padding: '11px 0', textAlign: h.a as 'left' | 'right' }}>{h.t}</div>
                ))}
              </div>
              {filas.map((u) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 16px', borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center' }}>
                  <button onClick={() => onVerLocal(u.id)} style={{ padding: '10px 0', fontSize: 13, textAlign: 'left', color: C.ink }}>{u.id}</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ flex: '0 0 auto', width: 6, height: 6, background: RUBROS[u.rubro].color }} />
                    <span style={{ fontSize: 12, color: '#3A3A36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{RUBROS[u.rubro].label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{FORMATOS[u.tipo].label}</div>
                  <div style={{ fontSize: 12.5, textAlign: 'right' }}>{num(u.gla)}</div>
                  <div style={{ fontSize: 12.5, textAlign: 'right' }}>{dec(u.renta)}</div>
                  <div style={{ fontSize: 12.5, textAlign: 'right' }}>{eur(u.renta * u.gla)}</div>
                  <div style={{ fontSize: 11, textAlign: 'right', letterSpacing: '0.06em', color: ESTADOS[u.estado].color }}>{ESTADOS[u.estado].label}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
                    {ACCIONES.map((a) => (
                      <button
                        key={a.e}
                        onClick={() => onSetEstado(u.id, a.e)}
                        style={{
                          padding: '5px 8px', fontSize: 10, letterSpacing: '0.06em', borderRadius: 3,
                          border: `1px solid ${u.estado === a.e ? C.ink : C.border}`,
                          background: u.estado === a.e ? C.ink : 'transparent',
                          color: u.estado === a.e ? '#fff' : C.muted,
                        }}
                      >
                        {a.l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filas.length === 0 && (
                <p style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: C.muted, margin: 0 }}>Ningún local cumple el filtro.</p>
              )}
            </div>

            {/* Móvil */}
            <div>
              {filas.map((u) => (
                <div key={u.id} className="vl-inv-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <button onClick={() => onVerLocal(u.id)} style={{ fontSize: 18, fontWeight: 300, color: C.ink }}>{u.id}</button>
                    <span style={{ fontSize: 11, letterSpacing: '0.06em', color: ESTADOS[u.estado].color }}>{ESTADOS[u.estado].label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                    <span style={{ width: 6, height: 6, background: RUBROS[u.rubro].color, flex: '0 0 auto' }} />
                    <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {RUBROS[u.rubro].label} · {FORMATOS[u.tipo].label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
                    <Dato k="GLA" v={num(u.gla) + ' m²'} />
                    <Dato k="€/m²/mes" v={dec(u.renta)} />
                    <Dato k="Renta/mes" v={eur(u.renta * u.gla)} />
                  </div>
                  {u.inquilino !== '—' && (
                    <p style={{ fontSize: 11.5, color: C.faint, margin: '10px 0 0' }}>{u.inquilino}</p>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                    {ACCIONES.map((a) => (
                      <button key={a.e} onClick={() => onSetEstado(u.id, a.e)} className="vl-chip vl-chip-sq" data-on={u.estado === a.e ? '1' : '0'}>{a.l}</button>
                    ))}
                  </div>
                </div>
              ))}
              {filas.length === 0 && (
                <p style={{ padding: '36px 0', textAlign: 'center', fontSize: 13, color: C.muted }}>Ningún local cumple el filtro.</p>
              )}
            </div>
          </>
        )}

        {vista === 'mix' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 20px' }}>
              <p className="vl-label" style={{ margin: 0 }}>Mix comercial por GLA</p>
              {(Object.keys(RUBROS) as (keyof typeof RUBROS)[])
                .map((k) => {
                  const us = units.filter((u) => u.rubro === k)
                  const g = us.reduce((a, u) => a + u.gla, 0)
                  return { k, label: RUBROS[k].label, color: RUBROS[k].color, n: us.length, g }
                })
                .sort((a, b) => b.g - a.g)
                .map((r) => (
                  <div key={r.k} style={{ padding: '11px 0 12px', borderBottom: `1px solid ${C.borderSoft}` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{ width: 7, height: 7, background: r.color, flex: '0 0 auto' }} />
                        <span style={{ fontSize: 12.5, color: '#3A3A36' }}>{r.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, color: C.faint }}>{r.n} loc · {num(r.g)} m²</span>
                        <span style={{ fontSize: 13 }}>{Math.round((r.g / glaTotal) * 100)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 3, background: C.borderSoft, marginTop: 8 }}>
                      <div style={{ height: '100%', width: (r.g / glaTotal) * 100 + '%', background: r.color }} />
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 20px' }}>
              <p className="vl-label" style={{ margin: 0 }}>Valoración por yield</p>
              <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, margin: '10px 0 0' }}>
                Un activo de renta no vale lo que suman sus locales: vale su NOI capitalizado. Las dos palancas mueven ese número.
              </p>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="vl-label">Opex no recuperable</span>
                  <span style={{ fontSize: 12 }}>{opex}%</span>
                </div>
                <input className="vl-range" type="range" min={4} max={24} step={1} value={opex} onChange={(e) => onOpex(+e.target.value)} style={{ marginTop: 10 }} />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="vl-label">Yield de salida</span>
                  <span style={{ fontSize: 12 }}>{dec(yld / 100, 2)}%</span>
                </div>
                <input className="vl-range" type="range" min={450} max={850} step={5} value={yld} onChange={(e) => onYield(+e.target.value)} style={{ marginTop: 10 }} />
              </div>

              <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}` }}>
                {[
                  { k: 'Renta potencial estabilizada', v: mm(v.potencial, 2), fg: '#3A3A36' },
                  { k: 'Renta contratada a hoy', v: mm(v.rentaCon, 2), fg: '#3A3A36' },
                  { k: 'Opex no recuperable', v: '− ' + mm(v.rentaCon * (opex / 100), 2), fg: C.muted },
                  { k: 'NOI actual', v: mm(v.noi, 2), fg: C.ink },
                  { k: 'NOI estabilizado', v: mm(v.noiEstab, 2), fg: C.ink },
                  { k: 'Valor a hoy', v: mm(v.valor, 2), fg: C.accent },
                  { k: 'Valor estabilizado', v: mm(v.valorEstab, 2), fg: C.accent },
                ].map((r) => (
                  <div key={r.k} className="vl-row">
                    <span style={{ fontSize: 13, color: r.fg }}>{r.k}</span>
                    <span style={{ fontSize: 13, color: r.fg, textAlign: 'right' }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {vista === 'propuestas' && (
          props.length === 0 ? (
            <p style={{ padding: '56px 0', textAlign: 'center', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Sin propuestas emitidas.
              <br />
              Selecciona un local en el showroom y genera una propuesta de arrendamiento.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {props.map((p) => (
                <div key={p.folio} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span className="vl-label">{p.folio}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{p.fecha}</span>
                  </div>
                  <p style={{ fontSize: 22, margin: '8px 0 0', fontWeight: 300 }}>{p.local}</p>
                  <p style={{ fontSize: 11.5, color: C.muted, margin: '4px 0 0' }}>{p.rubro} · {p.gla}</p>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
                    <div className="vl-row" style={{ padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: '#3A3A36' }}>Total mensual</span>
                      <span style={{ fontSize: 13 }}>{p.mes}</span>
                    </div>
                    <div className="vl-row" style={{ padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: '#3A3A36' }}>Plazo</span>
                      <span style={{ fontSize: 13 }}>{p.plazo}</span>
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

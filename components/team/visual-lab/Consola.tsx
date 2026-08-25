'use client'

import { useMemo, useState } from 'react'
import {
  type Parcela, type EstadoId, type Palancas, type CotEmitida, type LogEntry,
  TIPOS, ESTADOS, VIAS,
  pm2Con, colocado, eur, mm, num, C,
} from '@/lib/visual-lab/valdeserra'

type Vista = 'inventario' | 'precios' | 'cotizaciones' | 'actividad'

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'inventario', label: 'Inventario' },
  { id: 'precios', label: 'Matriz de precios' },
  { id: 'cotizaciones', label: 'Cotizaciones' },
  { id: 'actividad', label: 'Actividad' },
]

const GRID = '.8fr 1.2fr 1.3fr .8fr .7fr .8fr 1fr 1.1fr 1.2fr'

interface Props {
  units: Parcela[]
  suelo: number
  palancas: Palancas
  onPalancas: (p: Palancas) => void
  onAplicar: () => void
  cots: CotEmitida[]
  log: LogEntry[]
  onVerParcela: (id: string) => void
  onSetEstado: (id: string, e: EstadoId) => void
}

export default function Consola({ units, suelo, palancas, onPalancas, onAplicar, cots, log, onVerParcela, onSetEstado }: Props) {
  const [vista, setVista] = useState<Vista>('inventario')
  const [q, setQ] = useState('')
  const [fEstado, setFEstado] = useState<EstadoId | ''>('')

  const disp = units.filter((u) => u.estado === 'disponible').length
  const cols = units.filter(colocado).length
  const valorCol = units.filter(colocado).reduce((a, u) => a + u.precio, 0)

  const filas = useMemo(() => units.filter((u) => {
    if (fEstado && u.estado !== fEstado) return false
    if (q) {
      const s = (u.id + ' ' + TIPOS[u.tipo].label + ' ' + VIAS[u.via].label).toLowerCase()
      if (!s.includes(q.toLowerCase())) return false
    }
    return true
  }), [units, q, fEstado])

  const gdvSim = useMemo(
    () => units.reduce((a, u) => a + u.sup * pm2Con(u, palancas), 0),
    [units, palancas],
  )

  const tiles = [
    { k: 'Parcelas', v: String(units.length), fg: C.ink },
    { k: 'Disponibles', v: String(disp), fg: C.green },
    { k: 'Colocación', v: Math.round((cols / units.length) * 100) + '%', fg: C.accent },
    { k: 'Suelo', v: num(suelo) + ' m²', fg: C.ink },
    { k: 'En contrato', v: mm(valorCol), fg: C.ink },
    { k: 'GDV', v: mm(units.reduce((a, u) => a + u.precio, 0)), fg: C.ink },
  ]

  const setP = (k: keyof Palancas) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onPalancas({ ...palancas, [k]: +e.target.value })

  return (
    <div className="vl-consola">
      <div className="vl-consola-nav">
        {VISTAS.map((v) => (
          <button key={v.id} onClick={() => setVista(v.id)} data-on={vista === v.id ? '1' : '0'}>{v.label}</button>
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
              <input
                className="vl-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar parcela, cornisa o carácter"
              />
              <div className="vl-scrollx">
                {([{ k: '' as const, l: 'Todas' }, ...(Object.keys(ESTADOS) as EstadoId[]).map((k) => ({ k, l: ESTADOS[k].label }))]).map((o) => (
                  <button key={o.k || 'todas'} className="vl-chip" data-on={fEstado === o.k ? '1' : '0'} onClick={() => setFEstado(o.k)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Escritorio: tabla */}
            <div className="vl-inv-table" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 16px', borderBottom: `1px solid ${C.border}` }}>
                {[
                  { t: 'Parcela', a: 'left' }, { t: 'Vía', a: 'left' }, { t: 'Carácter', a: 'left' },
                  { t: 'Sup.', a: 'right' }, { t: 'Pend.', a: 'right' }, { t: '€/m²', a: 'right' },
                  { t: 'Precio', a: 'right' }, { t: 'Estado', a: 'right' }, { t: '', a: 'right' },
                ].map((h, i) => (
                  <div key={i} className="vl-label" style={{ padding: '11px 0', textAlign: h.a as 'left' | 'right' }}>{h.t}</div>
                ))}
              </div>
              {filas.map((u) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 16px', borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center' }}>
                  <button onClick={() => onVerParcela(u.id)} style={{ padding: '10px 0', fontSize: 13, textAlign: 'left', color: C.ink }}>{u.id}</button>
                  <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{VIAS[u.via].label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ flex: '0 0 auto', width: 6, height: 6, background: TIPOS[u.tipo].color }} />
                    <span style={{ fontSize: 12, color: '#3A3A36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TIPOS[u.tipo].label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, textAlign: 'right' }}>{num(u.sup)}</div>
                  <div style={{ fontSize: 12.5, textAlign: 'right', color: C.muted }}>{u.pend}%</div>
                  <div style={{ fontSize: 12.5, textAlign: 'right' }}>{num(u.pm2)}</div>
                  <div style={{ fontSize: 12.5, textAlign: 'right' }}>{eur(u.precio)}</div>
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
                <p style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: C.muted, margin: 0 }}>Ninguna parcela cumple el filtro.</p>
              )}
            </div>

            {/* Móvil: tarjetas */}
            <div>
              {filas.map((u) => (
                <div key={u.id} className="vl-inv-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <button onClick={() => onVerParcela(u.id)} style={{ fontSize: 18, fontWeight: 300, color: C.ink }}>{u.id}</button>
                    <span style={{ fontSize: 11, letterSpacing: '0.06em', color: ESTADOS[u.estado].color }}>{ESTADOS[u.estado].label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                    <span style={{ width: 6, height: 6, background: TIPOS[u.tipo].color, flex: '0 0 auto' }} />
                    <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {TIPOS[u.tipo].label} · {VIAS[u.via].label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                    <Dato k="Sup." v={num(u.sup)} />
                    <Dato k="Pend." v={u.pend + '%'} />
                    <Dato k="€/m²" v={num(u.pm2)} />
                    <Dato k="Precio" v={eur(u.precio)} />
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                    {ACCIONES.map((a) => (
                      <button
                        key={a.e}
                        onClick={() => onSetEstado(u.id, a.e)}
                        className="vl-chip vl-chip-sq"
                        data-on={u.estado === a.e ? '1' : '0'}
                      >
                        {a.l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filas.length === 0 && (
                <p style={{ padding: '36px 0', textAlign: 'center', fontSize: 13, color: C.muted }}>Ninguna parcela cumple el filtro.</p>
              )}
            </div>
          </>
        )}

        {vista === 'precios' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 20px' }}>
              <p className="vl-label" style={{ margin: 0 }}>Matriz por fase y carácter · €/m² de suelo</p>
              <div style={{ overflowX: 'auto', marginTop: 14 }}>
                <div style={{ minWidth: 340 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', borderBottom: `1px solid ${C.border}` }}>
                    {['Carácter', 'Fase I', 'Fase II', 'Fase III', 'Media'].map((h, i) => (
                      <div key={h} className="vl-label" style={{ padding: '0 0 10px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
                    ))}
                  </div>
                  {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((k) => {
                    const us = units.filter((u) => u.tipo === k)
                    const med = (e: number) => {
                      const g = us.filter((u) => u.etapa === e)
                      return g.length ? num(g.reduce((a, u) => a + u.pm2, 0) / g.length) : '—'
                    }
                    return (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', padding: '10px 0', borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'baseline' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 6, height: 6, background: TIPOS[k].color, flex: '0 0 auto' }} />
                          <span style={{ fontSize: 12.5, color: '#3A3A36' }}>{TIPOS[k].label}</span>
                        </div>
                        <div style={{ fontSize: 12.5, textAlign: 'right' }}>{med(1)}</div>
                        <div style={{ fontSize: 12.5, textAlign: 'right' }}>{med(2)}</div>
                        <div style={{ fontSize: 12.5, textAlign: 'right' }}>{med(3)}</div>
                        <div style={{ fontSize: 12.5, textAlign: 'right', color: C.accent }}>
                          {us.length ? num(us.reduce((a, u) => a + u.pm2, 0) / us.length) : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 20px' }}>
              <p className="vl-label" style={{ margin: 0 }}>Motor de precio</p>
              <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, margin: '10px 0 0' }}>
                Cada palanca recalcula la lista completa sobre la geometría y la cota reales de cada parcela.
              </p>
              {PALANCAS_UI.map((p) => (
                <div key={p.k} style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="vl-label">{p.label}</span>
                    <span style={{ fontSize: 12 }}>{p.k === 'base' ? num(palancas.base) + ' €/m²' : palancas[p.k] + '%'}</span>
                  </div>
                  <input className="vl-range" type="range" min={p.min} max={p.max} step={p.step} value={palancas[p.k]} onChange={setP(p.k)} style={{ marginTop: 10 }} />
                </div>
              ))}
              <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="vl-label">GDV recalculado</span>
                <span style={{ fontSize: 22 }}>{mm(gdvSim)}</span>
              </div>
              <button className="vl-btn vl-btn-primary" style={{ marginTop: 14 }} onClick={onAplicar}>Aplicar a lista de precios</button>
            </div>
          </div>
        )}

        {vista === 'cotizaciones' && (
          cots.length === 0 ? (
            <p style={{ padding: '56px 0', textAlign: 'center', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Sin cotizaciones emitidas.
              <br />
              Selecciona una parcela en el showroom y genera una cotización con plan de pago.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {cots.map((p) => (
                <div key={p.folio} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span className="vl-label">{p.folio}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{p.fecha}</span>
                  </div>
                  <p style={{ fontSize: 22, margin: '8px 0 0', fontWeight: 300 }}>{p.lote}</p>
                  <p style={{ fontSize: 11.5, color: C.muted, margin: '4px 0 0' }}>{p.tipo} · {p.sup}</p>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
                    <div className="vl-row" style={{ padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: '#3A3A36' }}>Precio</span>
                      <span style={{ fontSize: 13 }}>{p.precio}</span>
                    </div>
                    <div className="vl-row" style={{ padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: '#3A3A36' }}>Mensualidad</span>
                      <span style={{ fontSize: 13 }}>{p.mens}</span>
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

const ACCIONES: { e: EstadoId; l: string }[] = [
  { e: 'disponible', l: 'Libre' },
  { e: 'reservado', l: 'Reserva' },
  { e: 'vendido', l: 'Venta' },
]

const PALANCAS_UI: { k: keyof Palancas; label: string; min: number; max: number; step: number }[] = [
  { k: 'base', label: 'Precio base', min: 520, max: 1200, step: 10 },
  { k: 'vista', label: 'Prima por cota', min: 0, max: 45, step: 1 },
  { k: 'mirador', label: 'Prima mirador', min: 0, max: 45, step: 1 },
  { k: 'cornisa', label: 'Prima cornisa', min: 0, max: 35, step: 1 },
  { k: 'linde', label: 'Prima linde verde', min: 0, max: 30, step: 1 },
]

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="vl-label" style={{ margin: 0, fontSize: 9.5 }}>{k}</p>
      <p style={{ fontSize: 12.5, margin: '3px 0 0' }}>{v}</p>
    </div>
  )
}

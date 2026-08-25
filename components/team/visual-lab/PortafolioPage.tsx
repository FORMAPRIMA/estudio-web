'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  type Activo, type Escenario, type Periodo,
  ACTIVOS, ESCENARIOS, PERIODOS, SERIES, HITOS, HOY,
  resumen, mesDe, lecturaMix,
} from '@/lib/visual-lab/cartera'
import { C, mm, dec, pct, quarter, masMeses } from '@/lib/visual-lab/ui'

type Vista = 'cartera' | 'pipeline'

export default function PortafolioPage() {
  const [vista, setVista] = useState<Vista>('cartera')
  const [esc, setEsc] = useState<Escenario>('BASE')
  const [per, setPer] = useState<Periodo>('12M')
  const [fichaId, setFichaId] = useState<string | null>(null)

  const r = useMemo(() => resumen(esc), [esc])
  const ficha = fichaId ? ACTIVOS.find((a) => a.id === fichaId) ?? null : null
  const k = ESCENARIOS[esc]

  // Ventana de la curva: los últimos N meses de las 24 que guarda cada serie
  const idx = useMemo(() => {
    const n = PERIODOS[per]
    return Array.from({ length: n }, (_, j) => 24 - n + j)
  }, [per])
  const maxCol = useMemo(() => {
    let m = 1
    idx.forEach((i) => {
      const t = ACTIVOS.reduce((a, p) => a + SERIES[p.id][i], 0)
      if (t > m) m = t
    })
    return m
  }, [idx])

  return (
    <div style={{ background: C.cream, minHeight: '100dvh', color: C.ink }}>
      {/* Cabecera */}
      <header className="vl-header" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div className="vl-header-id">
          <p className="vl-eyebrow">
            <Link href="/team/apps" style={{ color: 'inherit' }}>Apps</Link> · FP Visual Lab
          </p>
          <h1 className="vl-title">Portafolio de desarrollo</h1>
          <p className="vl-subtitle">
            3 activos · {mm(r.gdv)} GDV · agosto 2026
          </p>
        </div>
        <div className="vl-seg" role="tablist">
          <button role="tab" aria-selected={vista === 'cartera'} data-on={vista === 'cartera' ? '1' : '0'} onClick={() => setVista('cartera')}>Cartera</button>
          <button role="tab" aria-selected={vista === 'pipeline'} data-on={vista === 'pipeline' ? '1' : '0'} onClick={() => setVista('pipeline')}>Pipeline</button>
        </div>
      </header>

      {vista === 'cartera' ? (
        <>
          {/* KPIs de cartera */}
          <div className="vl-port-kpis">
            {r.kpis.map((x) => (
              <div key={x.k} className="vl-port-kpi">
                <p className="vl-label" style={{ margin: 0 }}>{x.k}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{x.v}</span>
                  {x.u && <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{x.u}</span>}
                </div>
                <p style={{ fontSize: 11, color: C.faint, margin: '8px 0 0', lineHeight: 1.45 }}>{x.nota}</p>
              </div>
            ))}
          </div>

          <div className="vl-port-body">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 0 12px' }}>
              <span className="vl-label">Activos en comercialización</span>
              <span style={{ fontSize: 11, color: C.faint }}>GDV normalizado · valor bruto de desarrollo</span>
            </div>

            <div className="vl-port-cards">
              {ACTIVOS.map((p) => <TarjetaActivo key={p.id} p={p} onFicha={() => setFichaId(p.id)} />)}
            </div>

            {/* Hitos */}
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 20px', marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="vl-label">Hitos comerciales · próximos 45 días</span>
                <span style={{ fontSize: 11, color: C.faint }}>Ordenados por fecha · fuente consola de ventas</span>
              </div>
              <div className="vl-port-hitos">
                {HITOS.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '11px 0 12px', borderBottom: `1px solid ${C.borderSoft}`, flexWrap: 'wrap' }}>
                    <span style={{ flex: '0 0 58px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: h.urgente ? C.accent : C.muted }}>{h.fecha}</span>
                    <span style={{ flex: '0 0 84px', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint }}>{h.proy}</span>
                    <span style={{ flex: '1 1 200px', fontSize: 13, color: '#3A3A36' }}>{h.txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="vl-port-body" style={{ paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="vl-label" style={{ margin: 0 }}>Proyección de colocación</p>
              <p style={{ fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '5px 0 0', fontWeight: 300 }}>Pipeline consolidado</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="vl-label">Escenario</span>
              <div className="vl-scrollx">
                {(Object.keys(ESCENARIOS) as Escenario[]).map((e) => (
                  <button key={e} className="vl-chip" data-on={esc === e ? '1' : '0'} onClick={() => setEsc(e)}>
                    {e.charAt(0) + e.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla consolidada */}
          <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, overflowX: 'auto' }}>
            <div style={{ minWidth: 780 }}>
              <div className="vl-pipe-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Activo', 'Clase', 'Inventario', 'Colocado', 'GDV', 'Valor colocado', 'Ritmo', 'Sell-out'].map((t, i) => (
                  <div key={t} className="vl-label" style={{ padding: '12px 0', textAlign: i < 2 ? 'left' : 'right' }}>{t}</div>
                ))}
              </div>
              {ACTIVOS.map((p) => {
                const meses = (p.n - p.col) / Math.max(0.1, p.ritmo * k)
                return (
                  <div key={p.id} className="vl-pipe-row" style={{ borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center' }}>
                    <div style={{ padding: '13px 0' }}>
                      <Link href={p.href} style={{ fontSize: 14, color: C.ink }}>{p.nombre}</Link>
                      <p style={{ fontSize: 11, color: C.faint, margin: '3px 0 0' }}>{p.ciudad}</p>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>{p.claseCorta}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{p.n} {p.nounC}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{p.col} {p.nounC}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{mm(p.gdv)}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right', color: C.accent }}>{mm(p.gdv * p.pctVal)}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{dec(p.ritmo * k)}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{quarter(masMeses(HOY, meses))}</div>
                  </div>
                )
              })}
              <div className="vl-pipe-row" style={{ alignItems: 'center', background: '#FAF9F6' }}>
                <div style={{ padding: '13px 0', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Consolidado</div>
                <div />
                <div style={{ fontSize: 12.5, textAlign: 'right', color: C.muted }}>{ACTIVOS.reduce((a, p) => a + p.n, 0)} uds</div>
                <div style={{ fontSize: 12.5, textAlign: 'right', color: C.muted }}>{ACTIVOS.reduce((a, p) => a + p.col, 0)} uds</div>
                <div style={{ fontSize: 12.5, textAlign: 'right' }}>{mm(r.gdv)}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right', color: C.accent }}>{mm(r.valCol)}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right' }}>{dec(r.ritmo)}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right' }}>{quarter(masMeses(HOY, r.mesesTot))}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
            {/* Curva de absorción */}
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span className="vl-label">Curva de absorción · unidades / mes</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
                    <button key={p} className="vl-chip" style={{ padding: '5px 10px', fontSize: 10.5 }} data-on={per === p ? '1' : '0'} onClick={() => setPer(p)}>{p}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, marginTop: 20, borderBottom: `1px solid ${C.border}` }}>
                {idx.map((i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, height: '100%' }}>
                    {ACTIVOS.map((p) => (
                      <div key={p.id} style={{ width: '100%', height: Math.round((SERIES[p.id][i] / maxCol) * 100) + '%', background: p.color }} />
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                {idx.map((i) => {
                  const m = mesDe(i)
                  return <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: m.mes === 0 ? C.ink : C.faint }}>{m.l}</div>
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
                {ACTIVOS.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, background: p.color, flex: '0 0 auto' }} />
                    <span style={{ fontSize: 11, color: '#3A3A36' }}>{p.nombre}</span>
                    <span style={{ fontSize: 11, color: C.faint }}>{p.col} {p.nounC}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mix por clase de activo */}
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '18px 20px 18px' }}>
              <p className="vl-label" style={{ margin: 0 }}>Exposición por clase de activo</p>
              <div style={{ display: 'flex', height: 10, marginTop: 16, gap: 2 }}>
                {ACTIVOS.map((p) => (
                  <div key={p.id} style={{ width: (p.gdv / r.gdv) * 100 + '%', background: p.color }} />
                ))}
              </div>
              {ACTIVOS.map((p) => (
                <div key={p.id} className="vl-row" style={{ padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, background: p.color, flex: '0 0 auto' }} />
                    <span style={{ fontSize: 12.5, color: '#3A3A36' }}>{p.claseCorta}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontSize: 11, color: C.faint }}>{mm(p.gdv)}</span>
                    <span style={{ fontSize: 13 }}>{pct(p.gdv / r.gdv)}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <p className="vl-label" style={{ margin: 0 }}>Lectura</p>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: '#3A3A36', margin: '10px 0 0', textWrap: 'pretty' }}>{lecturaMix()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ficha del activo */}
      {ficha && <FichaActivo a={ficha} onClose={() => setFichaId(null)} />}
    </div>
  )
}

function TarjetaActivo({ p, onFicha }: { p: Activo; onFicha: () => void }) {
  return (
    <div className="vl-port-card">
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#EDECE7', borderBottom: `1px solid ${C.border}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${p.render}-1280.jpg`}
          srcSet={`${p.render}-1280.jpg 1280w, ${p.render}-2560.jpg 2560w`}
          sizes="(min-width: 1024px) 33vw, 100vw"
          alt={p.hint}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
        <span style={{
          position: 'absolute', left: 0, top: 14, padding: '5px 12px 6px',
          background: 'rgba(26,26,26,.82)', color: '#F2F2F0',
          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {p.clase}
        </span>
      </div>
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, background: p.fcolor, flex: '0 0 auto' }} />
          <span style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: p.fcolor }}>{p.fase}</span>
        </div>
        <p style={{ fontSize: 24, lineHeight: 1.12, letterSpacing: '-0.015em', margin: '9px 0 0', fontWeight: 300 }}>{p.nombre}</p>
        <p style={{ fontSize: 11.5, color: C.muted, margin: '6px 0 0' }}>{p.ciudad}</p>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: `1px solid ${C.border}` }}>
          {p.metricas.map((m) => (
            <div key={m.k} style={{ padding: '10px 8px 11px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
              <p className="vl-label" style={{ margin: 0, fontSize: 9.5 }}>{m.k}</p>
              <p style={{ fontSize: 12.5, margin: '5px 0 0' }}>{m.v}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span className="vl-label">Colocado</span>
          <span style={{ fontSize: 12.5 }}>
            {mm(p.gdv * p.pctVal)} <span style={{ fontSize: 11, color: C.faint }}>/ {mm(p.gdv)}</span>
          </span>
        </div>
        <div style={{ height: 2, background: C.border, marginTop: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: '0 auto 0 0', background: C.accent, width: pct(p.pctVal) }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.faint, marginTop: 8 }}>
          <span>{pct(p.pctVal)} del valor</span>
          <span>{p.n - p.col} / {p.n} {p.noun}</span>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', gap: 8 }}>
          <Link href={p.href} className="vl-btn vl-btn-primary" style={{ flex: 1, width: 'auto', textDecoration: 'none' }}>
            Abrir showroom
          </Link>
          <button className="vl-btn vl-btn-ghost" style={{ flex: '0 0 auto', width: 'auto', padding: '13px 18px' }} onClick={onFicha}>
            Ficha
          </button>
        </div>
      </div>
    </div>
  )
}

function FichaActivo({ a, onClose }: { a: Activo; onClose: () => void }) {
  return (
    <>
      <div className="vl-modal-bg" style={{ position: 'fixed', zIndex: 80 }} onClick={onClose} />
      <div className="vl-port-ficha">
        <div style={{ padding: '20px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p className="vl-label" style={{ margin: 0 }}>{a.clase}</p>
            <p style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '7px 0 0', fontWeight: 300 }}>{a.nombre}</p>
            <p style={{ fontSize: 11.5, color: C.muted, margin: '7px 0 0' }}>{a.ciudad}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ficha"
            style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, color: '#3A3A36', fontSize: 17 }}
          >
            ×
          </button>
        </div>

        <div style={{ margin: '20px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${C.border}` }}>
          {a.datos.map(([k, v]) => (
            <div key={k} style={{ padding: '11px 10px 12px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
              <p className="vl-label" style={{ margin: 0 }}>{k}</p>
              <p style={{ fontSize: 13, margin: '5px 0 0' }}>{v}</p>
            </div>
          ))}
        </div>

        <div style={{ margin: '20px 22px 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <p className="vl-label" style={{ margin: 0 }}>Tesis de comercialización</p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#3A3A36', margin: '11px 0 0', textWrap: 'pretty' }}>{a.tesis}</p>
        </div>

        <div style={{ margin: '22px 22px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href={a.href} className="vl-btn vl-btn-primary" style={{ textDecoration: 'none' }}>Abrir showroom 3D</Link>
          <button className="vl-btn vl-btn-ghost" onClick={onClose}>Volver a la cartera</button>
        </div>
      </div>
    </>
  )
}

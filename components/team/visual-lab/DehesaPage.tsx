'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  type Local, type EstadoId, type FormatoId, type RubroId, type ModoId,
  type FichaTab, type PropConfig, type PropEmitida, type LogEntry,
  RUBROS, FORMATOS, ESTADOS, MODULOS, MODOS,
  FICHA_TABS, FICHA_HINT, FICHA_CAPTION,
  buildConjunto, contratado, propuesta, propuestaBase, siguienteEstado, accionDe,
  datosLocal, condiciones, valorar,
  cargarLocal, guardarLocal,
  eur, mm, num, dec, C,
} from '@/lib/visual-lab/dehesa'
import { horaSolar } from '@/lib/visual-lab/ui'
import type { Escena } from './escena-dehesa'
import ConsolaDehesa from './ConsolaDehesa'

type SheetPos = 'peek' | 'medio' | 'full'
const SHEET_H: Record<SheetPos, string> = { peek: '90px', medio: '48%', full: '88%' }

export default function DehesaPage() {
  const conj = useMemo(() => buildConjunto(), [])
  const { units, byId, glaTotal, rMin, rMax } = conj

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const escenaRef = useRef<Escena | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rev, setRev] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [modo, setModo] = useState<ModoId>('disponibilidad')
  const [selId, setSelId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [tab, setTab] = useState<FichaTab>('render')
  const [consola, setConsola] = useState(false)

  const [fTipos, setFTipos] = useState<FormatoId[]>([])
  const [fRubros, setFRubros] = useState<RubroId[]>([])
  const [fGla, setFGla] = useState(0)
  const [fRenta, setFRenta] = useState(rMax)
  const [fOpen, setFOpen] = useState(true)

  const [sol, setSol] = useState(790)
  const [opex, setOpex] = useState(12)
  const [yld, setYld] = useState(625)

  const [cot, setCot] = useState<PropConfig | null>(null)
  const [props, setProps] = useState<PropEmitida[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetPos>('peek')
  const [plazas, setPlazas] = useState(612)

  const sel = selId ? byId[selId] : null

  const match = useCallback((u: Local) => {
    if (fTipos.length && !fTipos.includes(u.tipo)) return false
    if (fRubros.length && !fRubros.includes(u.rubro)) return false
    if (u.gla < fGla) return false
    if (u.renta > fRenta) return false
    return true
  }, [fTipos, fRubros, fGla, fRenta])

  const matchRef = useRef(match)

  /* ── Placa de firma ──────────────────────────────────────────────── */
  const placaRef = useRef({ on: false, timers: [] as ReturnType<typeof setTimeout>[] })
  const limpiaTimers = () => {
    placaRef.current.timers.forEach(clearTimeout)
    placaRef.current.timers = []
  }
  const ocultarPlaca = useCallback(() => {
    if (!placaRef.current.on) return
    placaRef.current.on = false
    limpiaTimers()
    const el = plateRef.current
    if (el) {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      placaRef.current.timers.push(setTimeout(() => { if (el) el.style.visibility = 'hidden' }, 780))
    }
    escenaRef.current?.derivar()
  }, [])
  const verFirma = () => {
    limpiaTimers()
    setSol(790)
    escenaRef.current?.setSol(790)
    escenaRef.current?.vistaFirma()
    placaRef.current.timers.push(setTimeout(() => {
      const el = plateRef.current
      if (!el) return
      placaRef.current.on = true
      el.style.visibility = 'visible'
      el.style.pointerEvents = 'auto'
      el.style.setProperty('--vl-plate-k', '1')
      el.style.opacity = '1'
    }, 1120))
  }

  /* ── Montaje ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return

    const st = cargarLocal()
    Object.entries(st.ov || {}).forEach(([id, o]) => {
      if (byId[id]) { byId[id].renta = o.renta; byId[id].estado = o.estado }
    })
    if (st.props?.length) setProps(st.props)
    if (st.log?.length) setLog(st.log)

    let vivo = true
    let t: ReturnType<typeof setTimeout> | null = null
    import('./escena-dehesa').then(({ Escena }) => {
      if (!vivo) return
      const e = new Escena({
        canvas, wrap, labelEl: labelRef.current, units,
        onHover: (id) => setHoverId(id),
        onPick: (id) => { setSelId(id); if (id) setTab('render') },
      })
      escenaRef.current = e
      e.posarEnFirma()
      e.setFiltro(matchRef.current)
      setPlazas(e.plazas)
      setCargando(false)

      placaRef.current.on = true
      requestAnimationFrame(() => {
        const el = plateRef.current
        if (el) el.style.setProperty('--vl-plate-k', '1')
      })
      placaRef.current.timers.push(setTimeout(ocultarPlaca, 1500))

      const pedido = new URLSearchParams(window.location.search).get('local')
      if (pedido && byId[pedido]) t = setTimeout(() => { ocultarPlaca(); setSelId(pedido) }, 900)
    })

    const skip = () => ocultarPlaca()
    window.addEventListener('pointerdown', skip, true)
    window.addEventListener('keydown', skip, true)
    window.addEventListener('wheel', skip, { capture: true, passive: true })

    return () => {
      vivo = false
      if (t) clearTimeout(t)
      limpiaTimers()
      window.removeEventListener('pointerdown', skip, true)
      window.removeEventListener('keydown', skip, true)
      window.removeEventListener('wheel', skip, { capture: true })
      escenaRef.current?.dispose()
      escenaRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { matchRef.current = match; escenaRef.current?.setFiltro(match) }, [match])
  useEffect(() => { escenaRef.current?.setSol(sol) }, [sol])
  useEffect(() => { escenaRef.current?.setSel(selId) }, [selId])
  useEffect(() => { escenaRef.current?.pausar(consola) }, [consola])
  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current) }, [])

  /* ── Acciones ────────────────────────────────────────────────────── */
  const toast = (msg: string) => {
    setAviso(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setAviso(null), 2600)
  }

  const bitacora = (txt: string, propsNext = props) => {
    const next = [{ t: new Date().toISOString(), txt }, ...log].slice(0, 60)
    setLog(next)
    guardarLocal(units, propsNext, next)
  }

  const pickModo = (id: ModoId) => { setModo(id); escenaRef.current?.setModo(id) }

  const setEstado = (id: string, estado: EstadoId) => {
    const u = byId[id]
    if (!u || u.estado === estado) return
    const prev = ESTADOS[u.estado].label
    u.estado = estado
    escenaRef.current?.refrescar()
    setRev((r) => r + 1)
    bitacora(`${u.id} · ${prev} → ${ESTADOS[estado].label}`)
  }

  const avanzar = () => {
    if (!sel) return
    const next = siguienteEstado(sel.estado)
    setEstado(sel.id, next)
    toast(`${sel.id} · ${ESTADOS[next].label}`)
  }

  const emitir = () => {
    if (!sel || !cot) return
    const p = propuesta(sel, cot)
    const folio = 'LD-' + String(props.length + 1).padStart(3, '0')
    const next: PropEmitida[] = [{
      folio, local: sel.id, rubro: RUBROS[sel.rubro].label, gla: num(sel.gla) + ' m²',
      mes: eur(p.total), plazo: `${p.cfg.plazo} años · ${p.cfg.carencia} meses`,
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    }, ...props]
    setProps(next)
    setCot(null)
    if (sel.estado === 'disponible') {
      sel.estado = 'intencion'
      escenaRef.current?.refrescar()
      setRev((r) => r + 1)
    }
    bitacora(`Propuesta ${folio} emitida · ${sel.id}`, next)
    toast(`Propuesta ${folio} emitida`)
  }

  const dealRoom = async () => {
    if (!sel) return
    const url = `${window.location.origin}${window.location.pathname}?local=${sel.id}`
    try { await navigator.clipboard.writeText(url); toast('Enlace de deal room copiado') }
    catch { toast('No se pudo copiar el enlace') }
  }

  const verLocalDesdeConsola = (id: string) => {
    setConsola(false)
    setTab('render')
    setTimeout(() => setSelId(id), 60)
  }

  const limpiar = () => { setFTipos([]); setFRubros([]); setFGla(0); setFRenta(rMax) }

  /* ── Derivados ───────────────────────────────────────────────────── */
  const glaCon = units.filter(contratado).reduce((a, u) => a + u.gla, 0)
  const ocup = Math.round((glaCon / glaTotal) * 100)
  const val = valorar(units, opex, yld)
  const rentaMedia = units.reduce((a, u) => a + u.renta * u.gla, 0) / glaTotal
  const visibles = units.filter(match)
  const libres = units.filter((u) => u.estado === 'disponible').length

  const cuenta: Record<string, number> = {}
  units.forEach((u) => { cuenta[u.estado] = (cuenta[u.estado] || 0) + 1 })

  const leyenda: { color: string; label: string; n: string }[] =
    modo === 'mix'
      ? (Object.keys(RUBROS) as RubroId[]).map((k) => ({
        color: RUBROS[k].color, label: RUBROS[k].label, n: String(units.filter((u) => u.rubro === k).length),
      }))
      : modo === 'renta'
        ? [
          { color: '#CFCDC6', label: 'Renta baja', n: dec(rMin) + ' €' },
          { color: C.accent, label: 'Renta alta', n: dec(rMax) + ' €' },
        ]
        : modo === 'flujo'
          ? [
            { color: '#CFCDC6', label: 'Flujo bajo', n: 'periferia' },
            { color: C.ink, label: 'Flujo alto', n: 'frente a anclas' },
          ]
          : (Object.keys(ESTADOS) as EstadoId[]).map((k) => ({
            color: ESTADOS[k].color, label: ESTADOS[k].label, n: String(cuenta[k] || 0),
          }))

  const hov = hoverId ? byId[hoverId] : null
  const conSol = !consola && modo === 'conjunto'

  /* ── Bloques ─────────────────────────────────────────────────────── */

  const Kpi = (
    <div>
      <p className="vl-label" style={{ margin: 0 }}>Ocupación</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 4 }}>
        <span style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{ocup}%</span>
        <span style={{ fontSize: 11, color: C.muted }}>de {num(glaTotal)} m² GLA</span>
      </div>
      <div style={{ height: 2, background: C.border, marginTop: 9, position: 'relative', maxWidth: 232 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', background: C.accent, width: ocup + '%', transition: 'width .9s cubic-bezier(.16,1,.3,1)' }} />
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
        {units.length} locales · {libres} libres
        <br />
        Renta media {dec(rentaMedia)} €/m²/mes · {mm(val.rentaCon, 2)} contratada
      </p>
    </div>
  )

  const Lectura = (
    <div className="vl-card">
      <p className="vl-label" style={{ margin: 0, padding: '11px 14px 7px' }}>Lectura</p>
      {MODOS.map((m, i) => (
        <button key={m.id} className="vl-modo" data-on={modo === m.id ? '1' : '0'} onClick={() => pickModo(m.id)}>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  )

  const Filtros = (
    <div className="vl-card" style={{ padding: '12px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="vl-label">Filtros</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={limpiar} style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.ink, padding: '6px 4px' }}>Limpiar</button>
          <button
            onClick={() => setFOpen(!fOpen)}
            aria-label={fOpen ? 'Plegar filtros' : 'Desplegar filtros'}
            style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', fontSize: 16, color: C.muted, marginRight: -6 }}
          >
            {fOpen ? '−' : '+'}
          </button>
        </div>
      </div>

      {fOpen && (
        <>
          <p className="vl-label" style={{ margin: '14px 0 8px' }}>Formato</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(Object.keys(FORMATOS) as FormatoId[]).map((k) => (
              <button
                key={k}
                className="vl-chip"
                data-on={fTipos.includes(k) ? '1' : '0'}
                onClick={() => setFTipos(fTipos.includes(k) ? fTipos.filter((x) => x !== k) : [...fTipos, k])}
              >
                {FORMATOS[k].label}
                <b>{units.filter((x) => x.tipo === k).length}</b>
              </button>
            ))}
          </div>

          <p className="vl-label" style={{ margin: '16px 0 8px' }}>Rubro</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(Object.keys(RUBROS) as RubroId[]).map((k) => (
              <button
                key={k}
                className="vl-chip"
                data-on={fRubros.includes(k) ? '1' : '0'}
                onClick={() => setFRubros(fRubros.includes(k) ? fRubros.filter((x) => x !== k) : [...fRubros, k])}
              >
                <i style={{ background: RUBROS[k].color }} />
                {RUBROS[k].label}
                <b>{units.filter((x) => x.rubro === k).length}</b>
              </button>
            ))}
          </div>

          <Slider label="GLA desde" valor={fGla === 0 ? 'Cualquiera' : num(fGla) + ' m²'} min={0} max={1200} step={20} value={fGla} onChange={setFGla} />
          <Slider label="Renta hasta" valor={dec(fRenta) + ' €/m²'} min={rMin} max={rMax} step={1} value={fRenta} onChange={setFRenta} />

          <p style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
            {visibles.length} locales · {num(visibles.reduce((a, x) => a + x.gla, 0))} m² GLA
          </p>
        </>
      )}
    </div>
  )

  const Modulos = (
    <>
      <p className="vl-label" style={{ margin: 0 }}>Módulos</p>
      {(Object.keys(MODULOS) as (keyof typeof MODULOS)[]).map((k) => (
        <div key={k} className="vl-row" style={{ padding: '7px 0' }}>
          <span style={{ fontSize: 12, color: '#3A3A36' }}>{MODULOS[k].label}</span>
          <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
            {(() => { const n = units.filter((x) => x.mod === k).length; return `${n} ${n === 1 ? 'local' : 'locales'}` })()}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
        <span className="vl-label">Valor a hoy</span>
        <span style={{ fontSize: 15 }}>{mm(val.valor, 2)}</span>
      </div>
      <p style={{ fontSize: 10.5, color: C.faint, margin: '6px 0 0', lineHeight: 1.5 }}>
        NOI {mm(val.noi, 2)} al {dec(yld / 100, 2)}% · opex {opex}% · se ajusta en la consola
      </p>
    </>
  )

  const Leyenda = (
    <>
      {leyenda.map((l) => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, background: l.color, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11, letterSpacing: '0.04em', color: '#3A3A36' }}>{l.label}</span>
          <span style={{ fontSize: 11, color: C.faint }}>{l.n}</span>
        </div>
      ))}
    </>
  )

  const SolSlider = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="vl-label">Sombra del conjunto</span>
        <span style={{ fontSize: 13 }}>{horaSolar(sol)}</span>
      </div>
      <input className="vl-range" type="range" min={0} max={1000} step={1} value={sol} onChange={(e) => setSol(+e.target.value)} />
    </>
  )

  /* ── Sheet ───────────────────────────────────────────────────────── */
  const dragRef = useRef<{ y0: number; pos: SheetPos } | null>(null)
  const onSheetDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { y0: e.clientY, pos: sheet }
  }
  const onSheetUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    const dy = e.clientY - d.y0
    const orden: SheetPos[] = ['peek', 'medio', 'full']
    let i = orden.indexOf(d.pos)
    if (Math.abs(dy) < 14) i = (i + 1) % 3
    else if (dy < 0) i = Math.min(2, i + 1)
    else i = Math.max(0, i - 1)
    setSheet(orden[i])
  }

  return (
    <div className="vl-shell" data-rev={rev}>
      <header className="vl-header">
        <div className="vl-header-id">
          <p className="vl-eyebrow">
            <Link href="/team/apps/visual-lab" style={{ color: 'inherit' }}>← FP Visual Lab</Link> · Retail
          </p>
          <h1 className="vl-title">Parque Comercial La Dehesa</h1>
          <p className="vl-subtitle">Alcalá de Henares · {units.length} locales · {num(glaTotal)} m² GLA</p>
        </div>
        <div className="vl-seg" role="tablist">
          <button role="tab" aria-selected={!consola} data-on={consola ? '0' : '1'} onClick={() => setConsola(false)}>Showroom</button>
          <button role="tab" aria-selected={consola} data-on={consola ? '1' : '0'} onClick={() => { setConsola(true); setSelId(null) }}>Consola</button>
        </div>
      </header>

      <main className="vl-main">
        <div className="vl-canvas-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} />
          <div className="vl-vignette" />
        </div>

        <div className="vl-hover-label" ref={labelRef}>
          <div className="vl-hover-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontSize: 13 }}>{hov?.id ?? ''}</span>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: hov ? ESTADOS[hov.estado].color : C.ink }}>
                {hov ? ESTADOS[hov.estado].label : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              {hov ? `${RUBROS[hov.rubro].label} · ${num(hov.gla)} m² · ${dec(hov.renta)} €/m²/mes` : ''}
            </div>
          </div>
        </div>

        <div className="vl-plate" ref={plateRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/visual-lab/firma-dehesa-2560.jpg"
            srcSet="/visual-lab/firma-dehesa-1280.jpg 1280w, /visual-lab/firma-dehesa-2560.jpg 2560w"
            sizes="100vw"
            alt="Vista aérea del Parque Comercial La Dehesa al atardecer"
          />
          <span className="vl-plate-badge"><i />Render</span>
        </div>

        {cargando && <div className="vl-cargando"><span className="vl-label">Levantando la maqueta</span></div>}

        <button className="vl-firma" onClick={verFirma}><i />Vista firma</button>

        <div className="vl-panel-left">
          {Kpi}
          {Lectura}
          {Filtros}
        </div>
        <div className="vl-panel-right vl-card">{Modulos}</div>
        <div className="vl-legend vl-card">{Leyenda}</div>
        {conSol && <div className="vl-sol">{SolSlider}</div>}

        <div className="vl-sheet" style={{ height: SHEET_H[sheet] }}>
          <div className="vl-sheet-handle" onPointerDown={onSheetDown} onPointerUp={onSheetUp}><span /></div>
          <div className="vl-sheet-peek">
            <div>
              <p className="vl-label" style={{ margin: 0 }}>Ocupación</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1, color: C.accent }}>{ocup}%</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Libres</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>
                {libres}<span style={{ fontSize: 11, color: C.muted, marginLeft: 5 }}>/ {units.length}</span>
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Renta</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{mm(val.rentaCon, 2)}</p>
            </div>
          </div>
          <div className="vl-sheet-body">
            <div style={{ marginBottom: 12 }}>{Lectura}</div>
            <div className="vl-card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>{Leyenda}</div>
            {conSol && <div className="vl-card" style={{ padding: '12px 14px 14px', marginBottom: 12 }}>{SolSlider}</div>}
            <div style={{ marginBottom: 12 }}>{Filtros}</div>
            <div className="vl-card" style={{ padding: '12px 14px 14px' }}>{Modulos}</div>
          </div>
        </div>

        {sel && !consola && (
          <FichaLocal
            u={sel}
            tab={tab}
            onTab={setTab}
            onClose={() => setSelId(null)}
            onPropuesta={() => setCot(propuestaBase(sel))}
            onAvanzar={avanzar}
            onDealRoom={dealRoom}
          />
        )}

        {consola && (
          <ConsolaDehesa
            units={units}
            glaTotal={glaTotal}
            plazas={plazas}
            opex={opex}
            yld={yld}
            onOpex={setOpex}
            onYield={setYld}
            props={props}
            log={log}
            onVerLocal={verLocalDesdeConsola}
            onSetEstado={setEstado}
          />
        )}

        {cot && sel && (
          <PropuestaModal u={sel} cfg={cot} onChange={setCot} onEmitir={emitir} onClose={() => setCot(null)} />
        )}

        {aviso && <div className="vl-toast">{aviso}</div>}
      </main>
    </div>
  )
}

/* ── Ficha del local ─────────────────────────────────────────────────── */

function FichaLocal({ u, tab, onTab, onClose, onPropuesta, onAvanzar, onDealRoom }: {
  u: Local; tab: FichaTab; onTab: (t: FichaTab) => void
  onClose: () => void; onPropuesta: () => void; onAvanzar: () => void; onDealRoom: () => void
}) {
  const est = ESTADOS[u.estado]
  return (
    <div className="vl-ficha">
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="vl-label" style={{ margin: 0 }}>{FORMATOS[u.tipo].label} · {MODULOS[u.mod].label}</p>
          <p style={{ fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '6px 0 0', fontWeight: 300 }}>{u.id}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ width: 7, height: 7, background: RUBROS[u.rubro].color, display: 'block' }} />
            <span style={{ fontSize: 11.5, color: C.muted }}>{RUBROS[u.rubro].label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <span style={{ width: 7, height: 7, background: est.color, display: 'block' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: est.color }}>{est.label}</span>
          </div>
          {u.inquilino !== '—' && (
            <p style={{ fontSize: 11.5, color: C.faint, margin: '8px 0 0' }}>{u.inquilino}</p>
          )}
        </div>
        <button onClick={onClose} aria-label="Cerrar ficha" style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, color: '#3A3A36', fontSize: 17 }}>×</button>
      </div>

      <div className="vl-datos" style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
        {datosLocal(u).map((d) => (
          <div key={d.k} style={{ padding: '11px 10px 12px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
            <p className="vl-label" style={{ margin: 0 }}>{d.k}</p>
            <p style={{ fontSize: 13, margin: '5px 0 0' }}>{d.v}</p>
          </div>
        ))}
      </div>

      <div style={{ margin: '18px 20px 0', padding: '16px 0 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: 0 }}>Renta de salida</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{dec(u.renta)}</span>
          <span style={{ fontSize: 12, color: C.muted }}>€/m²/mes</span>
        </div>
        <p style={{ fontSize: 11, color: C.muted, margin: '9px 0 0', lineHeight: 1.5 }}>
          {eur(u.renta * u.gla)} / mes · {eur(u.renta * u.gla * 12)} / año · renta mínima garantizada
        </p>
      </div>

      <div style={{ margin: '18px 20px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FICHA_TABS.map((t) => (
            <button key={t.id} onClick={() => onTab(t.id)} className="vl-chip vl-chip-sq" data-on={tab === t.id ? '1' : '0'}>{t.label}</button>
          ))}
        </div>
        <div style={{ marginTop: 10, height: 200, borderRadius: 4, border: `1px dashed ${C.border}`, background: '#F4F2EC', display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: 22, margin: 0, opacity: 0.3 }}>◳</p>
            <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
              {FICHA_HINT[tab]}
              <br />
              <span style={{ color: C.faint }}>{u.id}</span>
            </p>
          </div>
        </div>
        <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, margin: '8px 0 0' }}>{FICHA_CAPTION[tab]}</p>
      </div>

      <div style={{ margin: '20px 20px 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: '0 0 8px' }}>Condiciones de arrendamiento</p>
        {condiciones(u).map((p) => (
          <div key={p.k} className="vl-row">
            <span style={{ fontSize: 13, color: '#3A3A36' }}>{p.k}</span>
            <span style={{ fontSize: 13, textAlign: 'right' }}>{p.v}</span>
          </div>
        ))}
      </div>

      <div style={{ margin: '22px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vl-btn vl-btn-primary" onClick={onPropuesta}>Generar propuesta</button>
        <button className="vl-btn vl-btn-ghost" onClick={onAvanzar}>{accionDe(u.estado)}</button>
        <button className="vl-btn vl-btn-plain" onClick={onDealRoom}>Compartir deal room</button>
      </div>
    </div>
  )
}

/* ── Modal de propuesta ──────────────────────────────────────────────── */

function PropuestaModal({ u, cfg, onChange, onEmitir, onClose }: {
  u: Local; cfg: PropConfig; onChange: (c: PropConfig) => void; onEmitir: () => void; onClose: () => void
}) {
  const p = propuesta(u, cfg)
  const set = (k: keyof PropConfig, f?: (v: number) => number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...cfg, [k]: f ? f(+e.target.value) : +e.target.value })

  const inputs = [
    { k: 'Plazo', v: cfg.plazo + ' años', min: 2, max: 20, step: 1, val: cfg.plazo, on: set('plazo') },
    { k: 'Carencia de obra', v: cfg.carencia + ' meses', min: 0, max: 12, step: 1, val: cfg.carencia, on: set('carencia') },
    { k: 'Escalado anual', v: dec(cfg.escalado) + '%', min: 0, max: 60, step: 1, val: cfg.escalado * 10, on: set('escalado', (v) => v / 10) },
    { k: 'Aportación a obra', v: eur(cfg.aport) + '/m²', min: 0, max: 400, step: 10, val: cfg.aport, on: set('aport') },
  ]

  const filas = [
    { k: 'Renta mínima garantizada', v: eur(p.mes) + ' / mes', fg: '#3A3A36' },
    { k: 'Gastos comunes', v: eur(p.gc) + ' / mes', fg: '#3A3A36' },
    { k: 'Fondo de marketing', v: eur(p.mkt) + ' / mes', fg: '#3A3A36' },
    { k: 'Total mensual a facturar', v: eur(p.total), fg: C.ink },
    { k: 'Renta variable sobre ventas', v: '8% del exceso sobre umbral', fg: C.muted },
    { k: 'Aportación del propietario a obra', v: '− ' + eur(p.aportacion), fg: C.muted },
    { k: 'Renta anual año 1', v: eur(p.anual * (1 - p.cfg.carencia / 12)), fg: C.ink },
  ]

  return (
    <>
      <div className="vl-modal-bg" onClick={onClose} />
      <div className="vl-modal" role="dialog" aria-label={`Propuesta para el local ${u.id}`}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="vl-label" style={{ margin: 0 }}>Propuesta de arrendamiento</p>
            <p style={{ fontSize: 28, lineHeight: 1.1, margin: '6px 0 0', fontWeight: 300, letterSpacing: '-0.01em' }}>{u.id}</p>
            <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>
              {RUBROS[u.rubro].label} · {num(u.gla)} m² GLA · {dec(u.renta)} €/m²/mes
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar propuesta" style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 17, color: '#3A3A36' }}>×</button>
        </div>

        <div style={{ padding: '18px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 24px' }}>
          {inputs.map((i) => (
            <div key={i.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="vl-label">{i.k}</span>
                <span style={{ fontSize: 12 }}>{i.v}</span>
              </div>
              <input className="vl-range" type="range" min={i.min} max={i.max} step={i.step} value={i.val} onChange={i.on} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>

        <div style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
          {filas.map((r) => (
            <div key={r.k} className="vl-row">
              <span style={{ fontSize: 13, color: r.fg }}>{r.k}</span>
              <span style={{ fontSize: 13, color: r.fg, textAlign: 'right' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ margin: '18px 20px 0', padding: '14px 16px', background: '#FAF9F6', border: `1px solid ${C.borderSoft}`, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span className="vl-label">Renta media efectiva</span>
          <span style={{ fontSize: 22, letterSpacing: '-0.01em' }}>{eur(p.efectiva)}<span style={{ fontSize: 12, color: C.muted }}> / mes</span></span>
        </div>

        <div style={{ padding: '18px 20px 26px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="vl-btn vl-btn-primary" style={{ flex: '1 1 200px', width: 'auto' }} onClick={onEmitir}>Emitir propuesta</button>
          <button className="vl-btn vl-btn-ghost" style={{ flex: '0 0 auto', width: 'auto', padding: '13px 22px' }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </>
  )
}

function Slider({ label, valor, min, max, step, value, onChange }: {
  label: string; valor: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '16px 0 8px' }}>
        <span className="vl-label">{label}</span>
        <span style={{ fontSize: 12 }}>{valor}</span>
      </div>
      <input className="vl-range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </>
  )
}

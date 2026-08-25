'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  type Vivienda, type EstadoId, type TipoId, type ModoId, type FichaTab,
  type CotConfig, type CotEmitida, type LogEntry, type Palancas,
  TIPOS, ESTADOS, MODOS, PALANCAS_BASE, COT_BASE,
  FICHA_TABS, FICHA_HINT, fichaCaption,
  buildConjunto, precioDe, cotizar, siguienteEstado, accionDe,
  plantaLabel, colocada, datosVivienda, planPago,
  cargarLocal, guardarLocal,
  eur, mm, num, C,
} from '@/lib/visual-lab/mendez'
import { horaSolar } from '@/lib/visual-lab/ui'
import type { Escena } from './escena-mendez'
import ConsolaMendez from './ConsolaMendez'

type SheetPos = 'peek' | 'medio' | 'full'
const SHEET_H: Record<SheetPos, string> = { peek: '90px', medio: '48%', full: '88%' }

export default function MendezPage() {
  const conj = useMemo(() => buildConjunto(), [])
  const { units, byId, pMin, pMax } = conj

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
  const [tab, setTab] = useState<FichaTab>('plano')
  const [consola, setConsola] = useState(false)

  const [fTipos, setFTipos] = useState<TipoId[]>([])
  const [fDorm, setFDorm] = useState<number[]>([])
  const [fMax, setFMax] = useState(pMax)
  const [fPlanta, setFPlanta] = useState(0)
  const [fOpen, setFOpen] = useState(true)

  const [sol, setSol] = useState(790)
  const [palancas, setPalancas] = useState<Palancas>(PALANCAS_BASE)

  const [cot, setCot] = useState<(CotConfig & { unitId: string; cliente: string }) | null>(null)
  const [cots, setCots] = useState<CotEmitida[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetPos>('peek')

  const sel = selId ? byId[selId] : null

  const match = useCallback((u: Vivienda) => {
    if (fTipos.length && !fTipos.includes(u.tipo)) return false
    if (fDorm.length && !fDorm.includes(u.dorm)) return false
    if (u.precio > fMax) return false
    if (u.planta < fPlanta) return false
    return true
  }, [fTipos, fDorm, fMax, fPlanta])

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
      if (byId[id]) { byId[id].precio = o.precio; byId[id].estado = o.estado }
    })
    if (st.cots?.length) setCots(st.cots)
    if (st.log?.length) setLog(st.log)

    let vivo = true
    let t: ReturnType<typeof setTimeout> | null = null
    import('./escena-mendez').then(({ Escena }) => {
      if (!vivo) return
      const e = new Escena({
        canvas, wrap, labelEl: labelRef.current, units,
        onHover: (id) => setHoverId(id),
        onPick: (id) => { setSelId(id); if (id) setTab('plano') },
      })
      escenaRef.current = e
      e.posarEnFirma()
      e.setFiltro(matchRef.current)
      setCargando(false)

      placaRef.current.on = true
      requestAnimationFrame(() => {
        const el = plateRef.current
        if (el) el.style.setProperty('--vl-plate-k', '1')
      })
      placaRef.current.timers.push(setTimeout(ocultarPlaca, 1500))

      const pedida = new URLSearchParams(window.location.search).get('vivienda')
      if (pedida && byId[pedida]) t = setTimeout(() => { ocultarPlaca(); setSelId(pedida) }, 900)
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

  const bitacora = (txt: string, cotsNext = cots) => {
    const next = [{ t: new Date().toISOString(), txt }, ...log].slice(0, 60)
    setLog(next)
    guardarLocal(units, cotsNext, next)
  }

  const pickModo = (id: ModoId) => {
    setModo(id)
    const forzado = escenaRef.current?.setModo(id)
    // el modo "vista" se sitúa dentro de una vivienda concreta: la escena
    // decide cuál si no hay ninguna seleccionada
    if (forzado) setSelId(forzado)
  }

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
    toast(next === 'reservada' ? `${sel.id} reservada · 72 h de vigencia` : `${sel.id} · ${ESTADOS[next].label}`)
  }

  const recalcular = () => {
    units.forEach((u) => {
      u.precio = precioDe(u, palancas)
      u.precioLista = u.precio
    })
    const max = Math.ceil(Math.max(...units.map((u) => u.precio)) / 10000) * 10000
    setFMax(max)
    escenaRef.current?.refrescar()
    setRev((r) => r + 1)
    bitacora(`Matriz de precios recalculada · base ${eur(palancas.base)}/m²`)
    toast('Matriz de precios actualizada')
  }

  const emitir = () => {
    if (!cot) return
    const u = byId[cot.unitId]
    if (!u) return
    const q = cotizar(u, cot)
    const folio = 'COT-2026-' + String(cots.length + 1).padStart(4, '0')
    const next: CotEmitida[] = [{
      folio, id: u.id, cliente: cot.cliente || 'Prospecto sin nombre',
      precio: eur(u.precio), total: eur(q.total),
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    }, ...cots]
    setCots(next)
    setCot(null)
    bitacora(`Cotización ${folio} emitida · ${u.id} · ${eur(q.total)}`, next)
    toast(`Cotización ${folio} emitida · validez 15 días`)
  }

  const dealRoom = async () => {
    if (!sel) return
    const url = `${window.location.origin}${window.location.pathname}?vivienda=${sel.id}`
    try { await navigator.clipboard.writeText(url); toast('Enlace de deal room copiado') }
    catch { toast('No se pudo copiar el enlace') }
  }

  const verViviendaDesdeConsola = (id: string) => {
    setConsola(false)
    setTab('plano')
    setTimeout(() => setSelId(id), 60)
  }

  const limpiar = () => { setFTipos([]); setFDorm([]); setFMax(pMax); setFPlanta(0) }

  /* ── Derivados ───────────────────────────────────────────────────── */
  const cuenta: Record<string, number> = {}
  ;(Object.keys(ESTADOS) as EstadoId[]).forEach((k) => { cuenta[k] = 0 })
  let valorTotal = 0, valorCol = 0
  units.forEach((u) => {
    cuenta[u.estado]++
    valorTotal += u.precio
    if (colocada(u)) valorCol += u.precio
  })
  const abs = Math.round(((cuenta.vendida + cuenta.reservada) / units.length) * 100)
  const visibles = units.filter(match)
  const dispVis = visibles.filter((u) => u.estado === 'disponible').length

  const hov = hoverId ? byId[hoverId] : null
  const conSol = !consola && modo === 'asoleamiento'

  /* ── Bloques ─────────────────────────────────────────────────────── */

  const Kpi = (
    <div>
      <p className="vl-label" style={{ margin: 0 }}>Inventario disponible</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 4 }}>
        <span style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{cuenta.disponible}</span>
        <span style={{ fontSize: 11, color: C.muted }}>/ {units.length} viviendas</span>
      </div>
      <div style={{ height: 2, background: C.border, marginTop: 9, position: 'relative', maxWidth: 232 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', background: C.accent, width: abs + '%', transition: 'width .9s cubic-bezier(.16,1,.3,1)' }} />
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
        Absorción {abs}% · {mm(valorCol)} comercializado
        <br />
        Valor total {mm(valorTotal)}
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
          <p className="vl-label" style={{ margin: '14px 0 8px' }}>Tipología</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(Object.keys(TIPOS) as TipoId[]).map((k) => (
              <button
                key={k}
                className="vl-chip"
                data-on={fTipos.includes(k) ? '1' : '0'}
                onClick={() => setFTipos(fTipos.includes(k) ? fTipos.filter((x) => x !== k) : [...fTipos, k])}
              >
                {TIPOS[k].label}
                <b>{units.filter((x) => x.tipo === k).length}</b>
              </button>
            ))}
          </div>

          <p className="vl-label" style={{ margin: '16px 0 8px' }}>Dormitorios</p>
          <div style={{ display: 'flex', gap: 5 }}>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                className="vl-chip"
                style={{ width: 40, height: 34, justifyContent: 'center', padding: 0 }}
                data-on={fDorm.includes(d) ? '1' : '0'}
                onClick={() => setFDorm(fDorm.includes(d) ? fDorm.filter((x) => x !== d) : [...fDorm, d])}
              >
                {d}
              </button>
            ))}
          </div>

          <Slider label="Precio hasta" valor={eur(fMax)} min={pMin} max={pMax} step={10000} value={fMax} onChange={setFMax} />
          <Slider label="Planta desde" valor={fPlanta === 0 ? 'Todas' : 'Planta ' + fPlanta} min={0} max={24} step={1} value={fPlanta} onChange={setFPlanta} />

          <p style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
            {visibles.length} viviendas · {dispVis} disponibles
          </p>
        </>
      )}
    </div>
  )

  const Tipologias = (
    <>
      <p className="vl-label" style={{ margin: 0 }}>Tipologías</p>
      {(Object.keys(TIPOS) as TipoId[]).map((k) => {
        const us = units.filter((x) => x.tipo === k)
        if (!us.length) return null
        const libres = us.filter((x) => x.estado === 'disponible').length
        return (
          <div key={k} className="vl-row" style={{ padding: '7px 0' }}>
            <span style={{ fontSize: 12, color: '#3A3A36' }}>{TIPOS[k].label} · {TIPOS[k].dorm} dorm</span>
            <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{libres} / {us.length}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
        <span className="vl-label">Precio medio</span>
        <span style={{ fontSize: 15 }}>{num(units.reduce((a, u) => a + u.precio / u.util, 0) / units.length)} €/m²</span>
      </div>
      <p style={{ fontSize: 10.5, color: C.faint, margin: '6px 0 0', lineHeight: 1.5 }}>
        Sobre metro útil · IVA 10% no incluido · las primas se ajustan en la consola
      </p>
    </>
  )

  const Leyenda = (
    <>
      {(Object.keys(ESTADOS) as EstadoId[]).map((k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, background: ESTADOS[k].color, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11, letterSpacing: '0.04em', color: '#3A3A36' }}>{ESTADOS[k].label}</span>
          <span style={{ fontSize: 11, color: C.faint }}>{cuenta[k]}</span>
        </div>
      ))}
    </>
  )

  const SolSlider = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="vl-label">Asoleamiento · 21 junio</span>
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
            <Link href="/team/apps/visual-lab" style={{ color: 'inherit' }}>← FP Visual Lab</Link> · Residencial
          </p>
          <h1 className="vl-title">Méndez Álvaro 32</h1>
          <p className="vl-subtitle">Madrid · Arganzuela · {units.length} viviendas · 24 plantas</p>
        </div>
        <div className="vl-seg" role="tablist">
          <button role="tab" aria-selected={!consola} data-on={consola ? '0' : '1'} onClick={() => setConsola(false)}>Showroom</button>
          <button role="tab" aria-selected={consola} data-on={consola ? '1' : '0'} onClick={() => setConsola(true)}>Consola</button>
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
              {hov ? `${TIPOS[hov.tipo].label} · ${hov.util} m² · ${eur(hov.precio)}` : ''}
            </div>
          </div>
        </div>

        <div className="vl-plate" ref={plateRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/visual-lab/firma-mendez-2560.jpg"
            srcSet="/visual-lab/firma-mendez-1280.jpg 1280w, /visual-lab/firma-mendez-2560.jpg 2560w"
            sizes="100vw"
            alt="Torre de Méndez Álvaro 32 desde el sureste, a la hora dorada"
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
        <div className="vl-panel-right vl-card">{Tipologias}</div>
        <div className="vl-legend vl-card">{Leyenda}</div>
        {conSol && <div className="vl-sol">{SolSlider}</div>}

        <div className="vl-sheet" style={{ height: SHEET_H[sheet] }}>
          <div className="vl-sheet-handle" onPointerDown={onSheetDown} onPointerUp={onSheetUp}><span /></div>
          <div className="vl-sheet-peek">
            <div>
              <p className="vl-label" style={{ margin: 0 }}>Disponibles</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>
                {cuenta.disponible}<span style={{ fontSize: 11, color: C.muted, marginLeft: 5 }}>/ {units.length}</span>
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Absorción</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1, color: C.accent }}>{abs}%</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Colocado</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{mm(valorCol)}</p>
            </div>
          </div>
          <div className="vl-sheet-body">
            <div style={{ marginBottom: 12 }}>{Lectura}</div>
            <div className="vl-card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>{Leyenda}</div>
            {conSol && <div className="vl-card" style={{ padding: '12px 14px 14px', marginBottom: 12 }}>{SolSlider}</div>}
            <div style={{ marginBottom: 12 }}>{Filtros}</div>
            <div className="vl-card" style={{ padding: '12px 14px 14px' }}>{Tipologias}</div>
          </div>
        </div>

        {sel && !consola && (
          <FichaVivienda
            u={sel}
            tab={tab}
            onTab={setTab}
            onClose={() => setSelId(null)}
            onCotizar={() => setCot({ ...COT_BASE, unitId: sel.id, cliente: '' })}
            onAvanzar={avanzar}
            onDealRoom={dealRoom}
          />
        )}

        {consola && (
          <ConsolaMendez
            units={units}
            palancas={palancas}
            onPalancas={setPalancas}
            onRecalcular={recalcular}
            cots={cots}
            log={log}
            selId={selId}
            onSel={setSelId}
            onVerVivienda={verViviendaDesdeConsola}
            onSetEstado={setEstado}
            onCotizar={(id) => setCot({ ...COT_BASE, unitId: id, cliente: '' })}
          />
        )}

        {cot && byId[cot.unitId] && (
          <CotizacionModal
            u={byId[cot.unitId]}
            cfg={cot}
            onChange={setCot}
            onEmitir={emitir}
            onClose={() => setCot(null)}
          />
        )}

        {aviso && <div className="vl-toast">{aviso}</div>}
      </main>
    </div>
  )
}

/* ── Ficha de la vivienda ────────────────────────────────────────────── */

function FichaVivienda({ u, tab, onTab, onClose, onCotizar, onAvanzar, onDealRoom }: {
  u: Vivienda; tab: FichaTab; onTab: (t: FichaTab) => void
  onClose: () => void; onCotizar: () => void; onAvanzar: () => void; onDealRoom: () => void
}) {
  const est = ESTADOS[u.estado]
  return (
    <div className="vl-ficha">
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="vl-label" style={{ margin: 0 }}>{TIPOS[u.tipo].label} · planta {plantaLabel(u.planta)}</p>
          <p style={{ fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '6px 0 0', fontWeight: 300 }}>{u.id}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <span style={{ width: 7, height: 7, background: est.color, display: 'block' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: est.color }}>{est.label}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Cerrar ficha" style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, color: '#3A3A36', fontSize: 17 }}>×</button>
      </div>

      <div className="vl-datos" style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
        {datosVivienda(u).map((d) => (
          <div key={d.k} style={{ padding: '11px 10px 12px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
            <p className="vl-label" style={{ margin: 0 }}>{d.k}</p>
            <p style={{ fontSize: 13, margin: '5px 0 0' }}>{d.v}</p>
          </div>
        ))}
      </div>

      <div style={{ margin: '18px 20px 0', padding: '16px 0 18px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: 0 }}>Precio de venta</p>
        <p style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', margin: '8px 0 0', fontWeight: 300 }}>{eur(u.precio)}</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '9px 0 0', lineHeight: 1.5 }}>
          {eur(Math.round(u.precio / u.util))}/m² útil · IVA 10% no incluido
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
              <span style={{ color: C.faint }}>{TIPOS[u.tipo].label}</span>
            </p>
          </div>
        </div>
        <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, margin: '8px 0 0' }}>{fichaCaption(tab, u.tipo)}</p>
      </div>

      <div style={{ margin: '20px 20px 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: '0 0 8px' }}>Plan de pago orientativo</p>
        {planPago(u).map((p) => (
          <div key={p.k} className="vl-row">
            <span style={{ fontSize: 13, color: '#3A3A36' }}>{p.k}</span>
            <span style={{ fontSize: 13, textAlign: 'right' }}>{p.v}</span>
          </div>
        ))}
      </div>

      <div style={{ margin: '22px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vl-btn vl-btn-primary" onClick={onCotizar}>Generar cotización</button>
        <button className="vl-btn vl-btn-ghost" onClick={onAvanzar}>{accionDe(u.estado)}</button>
        <button className="vl-btn vl-btn-plain" onClick={onDealRoom}>Compartir deal room</button>
      </div>
    </div>
  )
}

/* ── Modal de cotización ─────────────────────────────────────────────── */

type CotEstado = CotConfig & { unitId: string; cliente: string }

function CotizacionModal({ u, cfg, onChange, onEmitir, onClose }: {
  u: Vivienda; cfg: CotEstado; onChange: (c: CotEstado) => void; onEmitir: () => void; onClose: () => void
}) {
  const q = cotizar(u, cfg)
  const set = (k: keyof CotConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...cfg, [k]: +e.target.value })

  const ctrl = [
    { k: 'Entrada a contrato', v: cfg.entrada + '%', min: 10, max: 40, step: 1, val: cfg.entrada, on: set('entrada') },
    { k: 'Aplazado en obra', v: cfg.obra + '%', min: 0, max: 25, step: 1, val: cfg.obra, on: set('obra') },
    { k: 'Meses de obra', v: cfg.meses + ' meses', min: 6, max: 36, step: 1, val: cfg.meses, on: set('meses') },
    { k: 'Plazo hipoteca', v: cfg.anos + ' años', min: 10, max: 30, step: 1, val: cfg.anos, on: set('anos') },
    { k: 'Tipo de interés', v: String(cfg.tipo).replace('.', ',') + '%', min: 1.5, max: 6, step: 0.1, val: cfg.tipo, on: set('tipo') },
  ]

  return (
    <>
      <div className="vl-modal-bg" onClick={onClose} />
      <div className="vl-modal" role="dialog" aria-label={`Cotización de la vivienda ${u.id}`}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="vl-label" style={{ margin: 0 }}>Cotización de vivienda</p>
            <p style={{ fontSize: 28, lineHeight: 1.1, margin: '6px 0 0', fontWeight: 300, letterSpacing: '-0.01em' }}>{u.id}</p>
            <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>
              {TIPOS[u.tipo].label} · planta {plantaLabel(u.planta)} · {u.util} m² útiles
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar cotización" style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 17, color: '#3A3A36' }}>×</button>
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          <p className="vl-label" style={{ margin: '0 0 7px' }}>Cliente</p>
          <input className="vl-input" value={cfg.cliente} onChange={(e) => onChange({ ...cfg, cliente: e.target.value })} placeholder="Nombre del prospecto" />
        </div>

        <div style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 24px' }}>
          {ctrl.map((i) => (
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
          {[
            { k: 'Precio de venta', v: eur(q.precio), fg: C.ink },
            { k: 'IVA 10%', v: eur(q.iva), fg: '#3A3A36' },
            { k: 'AJD 1,5%', v: eur(q.ajd), fg: '#3A3A36' },
            { k: 'Notaría, registro y gestión 1,2%', v: eur(q.gastos), fg: '#3A3A36' },
            { k: 'Total con impuestos', v: eur(q.total), fg: C.ink },
            { k: 'Reserva (a la firma)', v: eur(q.reserva), fg: C.muted },
            { k: 'Contrato privado', v: eur(q.contrato), fg: C.muted },
            { k: `Durante obra · ${cfg.meses} mensualidades`, v: eur(q.mensualObra) + '/mes', fg: C.muted },
            { k: 'A la entrega (hipoteca)', v: eur(q.entrega), fg: C.muted },
          ].map((r) => (
            <div key={r.k} className="vl-row">
              <span style={{ fontSize: 13, color: r.fg }}>{r.k}</span>
              <span style={{ fontSize: 13, color: r.fg, textAlign: 'right' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div style={{ margin: '18px 20px 0', padding: '14px 16px', background: '#FAF9F6', border: `1px solid ${C.borderSoft}`, borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span className="vl-label">Cuota hipoteca estimada</span>
            <span style={{ fontSize: 22, letterSpacing: '-0.01em' }}>{eur(q.cuota)}<span style={{ fontSize: 12, color: C.muted }}> / mes</span></span>
          </div>
          <p style={{ fontSize: 11, color: C.faint, margin: '7px 0 0' }}>
            {cfg.anos} años al {String(cfg.tipo).replace('.', ',')}% · capital {eur(q.entrega)}
          </p>
        </div>

        <div style={{ padding: '18px 20px 26px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="vl-btn vl-btn-primary" style={{ flex: '1 1 200px', width: 'auto' }} onClick={onEmitir}>Emitir cotización</button>
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

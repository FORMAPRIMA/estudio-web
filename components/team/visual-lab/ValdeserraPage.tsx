'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  type Parcela, type EstadoId, type TipoId, type EtapaId, type ModoId,
  type FichaTab, type CotConfig, type Palancas, type CotEmitida, type LogEntry,
  TIPOS, ESTADOS, ETAPAS, VIAS, MODOS, PALANCAS_BASE, C,
  buildConjunto, pm2Con, precioDe, colocado, cotizar, siguienteEstado,
  cargarLocal, guardarLocal,
  eur, mm, num, dec,
} from '@/lib/visual-lab/valdeserra'
import type { Escena } from './escena-valdeserra'
import FichaParcela from './FichaParcela'
import CotizacionModal from './CotizacionModal'
import Consola from './Consola'

type SheetPos = 'peek' | 'medio' | 'full'
const SHEET_H: Record<SheetPos, string> = { peek: '90px', medio: '48%', full: '88%' }

export default function ValdeserraPage() {
  // El conjunto es determinista: se genera una vez y se muta en sitio
  // (estado comercial y precio). `rev` es lo que fuerza el repintado.
  const conj = useMemo(() => buildConjunto(), [])
  const { units, byId, desnivel, suelo, sMin, sMax, pMin, pMax } = conj

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
  const [tab, setTab] = useState<FichaTab>('aereo')
  const [consola, setConsola] = useState(false)

  const [fEtapas, setFEtapas] = useState<EtapaId[]>([])
  const [fTipos, setFTipos] = useState<TipoId[]>([])
  const [fSup, setFSup] = useState(sMin)
  const [fPrecio, setFPrecio] = useState(pMax)
  const [fPend, setFPend] = useState(34)
  const [fOpen, setFOpen] = useState(true)

  const [exag, setExag] = useState(15)
  // 790 = tarde baja, la misma luz del render de firma: al retirarse la placa,
  // la maqueta que asoma tiene las sombras largas de la foto
  const [sol, setSol] = useState(790)
  const [palancas, setPalancas] = useState<Palancas>(PALANCAS_BASE)

  const [cot, setCot] = useState<CotConfig | null>(null)
  const [cots, setCots] = useState<CotEmitida[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetPos>('peek')

  const sel = selId ? byId[selId] : null

  /* ── Filtro ──────────────────────────────────────────────────────── */
  const match = useCallback((u: Parcela) => {
    if (fEtapas.length && !fEtapas.includes(u.etapa)) return false
    if (fTipos.length && !fTipos.includes(u.tipo)) return false
    if (u.sup < fSup) return false
    if (u.precio > fPrecio) return false
    if (u.pend > fPend) return false
    return true
  }, [fEtapas, fTipos, fSup, fPrecio, fPend])

  // la escena llega tarde (three.js va en su propio chunk): guarda el filtro
  // vigente para poder aplicárselo en cuanto exista
  const matchRef = useRef(match)

  /* ── Placa de firma ──────────────────────────────────────────────────
     El render fotorrealista está tomado desde el POV maestro de la escena,
     así que la maqueta arranca en ese mismo encuadre detrás de la foto: al
     desvanecerse, la imagen y el 3D coinciden y el corte no se nota. */
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
    // la luz del render es la de la tarde baja: el 3° que asoma debajo la iguala
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

  /* ── Montaje de la escena ────────────────────────────────────────── */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return

    // overrides guardados: estado comercial y precios tocados en sesiones previas
    const st = cargarLocal()
    Object.entries(st.ov || {}).forEach(([id, o]) => {
      if (byId[id]) { byId[id].precio = o.precio; byId[id].estado = o.estado }
    })
    if (st.cots?.length) setCots(st.cots)
    if (st.log?.length) setLog(st.log)

    // three.js pesa: se carga aparte para que la UI pinte antes que la maqueta
    let vivo = true
    let t: ReturnType<typeof setTimeout> | null = null
    import('./escena-valdeserra').then(({ Escena }) => {
      if (!vivo) return
      const e = new Escena({
        canvas, wrap, labelEl: labelRef.current, units,
        onHover: (id) => setHoverId(id),
        onPick: (id) => { setSelId(id); if (id) setTab('aereo') },
      })
      escenaRef.current = e
      e.posarEnFirma()
      e.setFiltro(matchRef.current)
      setCargando(false)

      // la placa ya está delante desde el primer pintado: se le arranca el
      // zoom lento y se retira sola descubriendo la maqueta ya encuadrada
      placaRef.current.on = true
      requestAnimationFrame(() => {
        const el = plateRef.current
        if (el) el.style.setProperty('--vl-plate-k', '1')
      })
      placaRef.current.timers.push(setTimeout(ocultarPlaca, 1500))

      // enlace de deal room: ?parcela=II-07 abre la ficha al terminar la entrada
      const pedida = new URLSearchParams(window.location.search).get('parcela')
      if (pedida && byId[pedida]) t = setTimeout(() => { ocultarPlaca(); setSelId(pedida) }, 900)
    })

    // cualquier gesto se salta la placa: nadie tiene por qué esperar a la intro
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
    // se monta una sola vez: `units`/`byId` vienen de un useMemo sin dependencias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { matchRef.current = match; escenaRef.current?.setFiltro(match) }, [match])
  useEffect(() => { escenaRef.current?.setExag(exag) }, [exag])
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
    return next
  }

  const pickModo = (id: ModoId) => {
    setModo(id)
    escenaRef.current?.setModo(id)
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

  const reservar = () => {
    if (!sel) return
    const next = siguienteEstado(sel.estado)
    setEstado(sel.id, next)
    toast(`${sel.id} · ${ESTADOS[next].label}`)
  }

  const aplicarPrecios = () => {
    units.forEach((u) => {
      u.pm2 = pm2Con(u, palancas)
      u.precio = precioDe(u.sup, u.pm2)
      u.precioLista = u.precio
    })
    escenaRef.current?.refrescar()
    setRev((r) => r + 1)
    bitacora(`Lista de precios recalculada · base ${palancas.base} €/m²`)
    toast('Lista de precios actualizada')
  }

  const emitir = () => {
    if (!sel || !cot) return
    const p = cotizar(sel, cot)
    const folio = 'VS-' + String(cots.length + 1).padStart(3, '0')
    const next: CotEmitida[] = [{
      folio, lote: sel.id, tipo: TIPOS[sel.tipo].label, sup: num(sel.sup) + ' m²',
      precio: eur(sel.precio), mens: eur(p.mens),
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    }, ...cots]
    setCots(next)
    setCot(null)
    if (sel.estado === 'disponible') {
      sel.estado = 'opcion'
      escenaRef.current?.refrescar()
      setRev((r) => r + 1)
    }
    bitacora(`Cotización ${folio} emitida · ${sel.id}`, next)
    toast(`Cotización ${folio} emitida`)
  }

  const dealRoom = async () => {
    if (!sel) return
    const url = `${window.location.origin}${window.location.pathname}?parcela=${sel.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Enlace de deal room copiado')
    } catch {
      toast('No se pudo copiar el enlace')
    }
  }

  const verParcelaDesdeConsola = (id: string) => {
    setConsola(false)
    setTab('aereo')
    setTimeout(() => setSelId(id), 60)
  }

  const limpiar = () => {
    setFEtapas([]); setFTipos([]); setFSup(sMin); setFPrecio(pMax); setFPend(34)
  }

  /* ── Derivados de la UI ──────────────────────────────────────────── */
  const disp = units.filter((u) => u.estado === 'disponible').length
  const cols = units.filter(colocado).length
  const valorCol = units.filter(colocado).reduce((a, u) => a + u.precio, 0)
  const visibles = units.filter(match)
  const pctCol = Math.round((cols / units.length) * 100)

  const cuenta: Record<string, number> = {}
  units.forEach((u) => { cuenta[u.estado] = (cuenta[u.estado] || 0) + 1 })

  const leyenda: { color: string; label: string; n: string }[] =
    modo === 'etapas'
      ? ([1, 2, 3] as EtapaId[]).map((e) => ({
        color: ETAPAS[e].color,
        label: `${ETAPAS[e].label} · ${ETAPAS[e].estado}`,
        n: String(units.filter((u) => u.etapa === e).length),
      }))
      : modo === 'caracter'
        ? (Object.keys(TIPOS) as TipoId[]).map((k) => ({
          color: TIPOS[k].color, label: TIPOS[k].label, n: String(units.filter((u) => u.tipo === k).length),
        }))
        : modo === 'topografia'
          ? [
            { color: '#DCDED2', label: 'Cornisa baja', n: '+' + dec(Math.min(...units.map((x) => x.cota))) + ' m' },
            { color: C.gold, label: 'Cornisa alta · vista sierra', n: '+' + dec(Math.max(...units.map((x) => x.cota))) + ' m' },
          ]
          : modo === 'precio'
            ? [
              { color: '#D2CFC6', label: 'Menor €/m²', n: num(Math.min(...units.map((u) => u.pm2))) },
              { color: C.accent, label: 'Mayor €/m²', n: num(Math.max(...units.map((u) => u.pm2))) },
            ]
            : (Object.keys(ESTADOS) as EstadoId[]).map((k) => ({
              color: ESTADOS[k].color, label: ESTADOS[k].label, n: String(cuenta[k] || 0),
            }))

  const hov = hoverId ? byId[hoverId] : null
  const conSol = !consola && (modo === 'topografia' || modo === 'conjunto')

  /* ── Bloques reutilizados por el panel de escritorio y el sheet ───── */

  const Kpi = (
    <div>
      <p className="vl-label" style={{ margin: 0 }}>Parcelas disponibles</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 4 }}>
        <span style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{disp}</span>
        <span style={{ fontSize: 11, color: C.muted }}>/ {units.length} parcelas</span>
      </div>
      <div style={{ height: 2, background: C.border, marginTop: 9, position: 'relative', maxWidth: 232 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', background: C.accent, width: pctCol + '%', transition: 'width .9s cubic-bezier(.16,1,.3,1)' }} />
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
        Colocación {pctCol}% · {mm(valorCol)} en contrato
        <br />
        {num(suelo)} m² de suelo · parcela media {num(suelo / units.length)} m²
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
          <p className="vl-label" style={{ margin: '14px 0 8px' }}>Fase</p>
          <div style={{ display: 'flex', gap: 5 }}>
            {([1, 2, 3] as EtapaId[]).map((e) => (
              <button
                key={e}
                className="vl-chip vl-chip-sq"
                data-on={fEtapas.includes(e) ? '1' : '0'}
                onClick={() => setFEtapas(fEtapas.includes(e) ? fEtapas.filter((x) => x !== e) : [...fEtapas, e])}
              >
                {ETAPAS[e].label}
                <b>{units.filter((x) => x.etapa === e).length}</b>
              </button>
            ))}
          </div>

          <p className="vl-label" style={{ margin: '16px 0 8px' }}>Carácter de la parcela</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(Object.keys(TIPOS) as TipoId[]).map((k) => (
              <button
                key={k}
                className="vl-chip"
                data-on={fTipos.includes(k) ? '1' : '0'}
                onClick={() => setFTipos(fTipos.includes(k) ? fTipos.filter((x) => x !== k) : [...fTipos, k])}
              >
                <i style={{ background: TIPOS[k].color }} />
                {TIPOS[k].label}
                <b>{units.filter((x) => x.tipo === k).length}</b>
              </button>
            ))}
          </div>

          <Slider label="Superficie desde" valor={num(fSup) + ' m²'} min={sMin} max={sMax} step={25} value={fSup} onChange={(v) => setFSup(v)} />
          <Slider label="Precio hasta" valor={eur(fPrecio)} min={pMin} max={pMax} step={25000} value={fPrecio} onChange={(v) => setFPrecio(v)} />
          <Slider label="Pendiente máxima" valor={fPend + '%'} min={4} max={34} step={1} value={fPend} onChange={(v) => setFPend(v)} />

          <p style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
            {visibles.length} parcelas · {num(visibles.reduce((a, x) => a + x.sup, 0))} m² de suelo
          </p>
        </>
      )}
    </div>
  )

  const Trazado = (
    <>
      <p className="vl-label" style={{ margin: 0 }}>Trazado</p>
      {(Object.keys(VIAS) as (keyof typeof VIAS)[]).map((k) => (
        <div key={k} className="vl-row" style={{ padding: '7px 0' }}>
          <span style={{ fontSize: 12, color: '#3A3A36' }}>{VIAS[k].label}</span>
          <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
            {k === 'AV' ? 'eje de acceso' : units.filter((x) => x.via === k).length + ' parcelas'}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
        <span className="vl-label">Relieve</span>
        <span style={{ fontSize: 12 }}>{dec(exag / 10)}×</span>
      </div>
      <input className="vl-range" type="range" min={10} max={24} step={1} value={exag} onChange={(e) => setExag(+e.target.value)} style={{ marginTop: 10 }} />
      <p style={{ fontSize: 10.5, color: C.faint, margin: '8px 0 0', lineHeight: 1.5 }}>
        Exageración vertical · desnivel real {desnivel} m entre cornisas
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
        <span className="vl-label">Sombra de ladera · 21 marzo</span>
        <span style={{ fontSize: 13 }}>{horaSolar(sol)}</span>
      </div>
      <input className="vl-range" type="range" min={0} max={1000} step={1} value={sol} onChange={(e) => setSol(+e.target.value)} />
    </>
  )

  /* ── Arrastre del bottom sheet ───────────────────────────────────── */
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
    if (Math.abs(dy) < 14) i = (i + 1) % 3          // toque simple: siguiente posición
    else if (dy < 0) i = Math.min(2, i + 1)          // arrastre hacia arriba: abre
    else i = Math.max(0, i - 1)                      // hacia abajo: cierra
    setSheet(orden[i])
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="vl-shell" data-rev={rev}>
      <header className="vl-header">
        <div className="vl-header-id">
          <p className="vl-eyebrow">
            <Link href="/team/apps/visual-lab" style={{ color: 'inherit' }}>← FP Visual Lab</Link> · Suelo
          </p>
          <h1 className="vl-title">Valdeserra</h1>
          <p className="vl-subtitle">Colmenar Viejo · residencial de alto estándar · {units.length} parcelas</p>
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

        {/* Placa de firma: el render desde el POV maestro de la maqueta */}
        <div className="vl-plate" ref={plateRef}>
          <img
            src="/visual-lab/firma-valdeserra-2560.jpg"
            srcSet="/visual-lab/firma-valdeserra-1280.jpg 1280w, /visual-lab/firma-valdeserra-2560.jpg 2560w"
            sizes="100vw"
            alt="Vista aérea de Valdeserra al atardecer: el trazado de parcelas sobre la ladera"
          />
          <span className="vl-plate-badge"><i />Render</span>
        </div>

        {cargando && (
          <div className="vl-cargando">
            <span className="vl-label">Levantando la maqueta</span>
          </div>
        )}

        {/* Etiqueta de hover — sólo tiene sentido con puntero fino */}
        <div className="vl-hover-label" ref={labelRef}>
          <div className="vl-hover-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontSize: 13 }}>{hov?.id ?? ''}</span>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: hov ? ESTADOS[hov.estado].color : C.ink }}>
                {hov ? ESTADOS[hov.estado].label : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              {hov ? `${num(hov.sup)} m² · ${TIPOS[hov.tipo].label} · ${eur(hov.precio)}` : ''}
            </div>
          </div>
        </div>

        <button className="vl-firma" onClick={verFirma}>
          <i />
          Vista firma
        </button>

        {/* Paneles flotantes (escritorio) */}
        <div className="vl-panel-left">
          {Kpi}
          {Lectura}
          {Filtros}
        </div>
        <div className="vl-panel-right vl-card">{Trazado}</div>
        <div className="vl-legend vl-card">{Leyenda}</div>
        {conSol && <div className="vl-sol">{SolSlider}</div>}

        {/* Bottom sheet (móvil) */}
        <div className="vl-sheet" style={{ height: SHEET_H[sheet] }}>
          <div className="vl-sheet-handle" onPointerDown={onSheetDown} onPointerUp={onSheetUp}>
            <span />
          </div>
          <div className="vl-sheet-peek">
            <div>
              <p className="vl-label" style={{ margin: 0 }}>Disponibles</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>
                {disp}
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>/ {units.length}</span>
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Colocación</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1, color: C.accent }}>{pctCol}%</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>En contrato</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{mm(valorCol)}</p>
            </div>
          </div>
          <div className="vl-sheet-body">
            <div style={{ marginBottom: 12 }}>{Lectura}</div>
            <div className="vl-card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
              {Leyenda}
            </div>
            {conSol && <div className="vl-card" style={{ padding: '12px 14px 14px', marginBottom: 12 }}>{SolSlider}</div>}
            <div style={{ marginBottom: 12 }}>{Filtros}</div>
            <div className="vl-card" style={{ padding: '12px 14px 14px' }}>{Trazado}</div>
          </div>
        </div>

        {/* Ficha de parcela */}
        {sel && !consola && (
          <FichaParcela
            u={sel}
            tab={tab}
            onTab={setTab}
            onClose={() => setSelId(null)}
            onCotizar={() => setCot(cotizar(sel).cfg)}
            onReservar={reservar}
            onDealRoom={dealRoom}
          />
        )}

        {/* Consola */}
        {consola && (
          <Consola
            units={units}
            suelo={suelo}
            palancas={palancas}
            onPalancas={setPalancas}
            onAplicar={aplicarPrecios}
            cots={cots}
            log={log}
            onVerParcela={verParcelaDesdeConsola}
            onSetEstado={setEstado}
          />
        )}

        {/* Cotización */}
        {cot && sel && (
          <CotizacionModal u={sel} cfg={cot} onChange={setCot} onEmitir={emitir} onClose={() => setCot(null)} />
        )}

        {aviso && <div className="vl-toast">{aviso}</div>}
      </main>
    </div>
  )
}

/* ── Auxiliares ───────────────────────────────────────────────────── */

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

/** 0..1000 → hora del día entre las 06:00 y las 20:00, en tramos de media hora. */
function horaSolar(v: number): string {
  const h = 6 + (v / 1000) * 14
  const hh = String(Math.floor(h)).padStart(2, '0')
  return `${hh}:${(h % 1) < 0.5 ? '00' : '30'}`
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  type Conjunto, type Parcela, type ModoId, type VistaId, type CapaId, type TipoId, type DemoEstado,
  TIPOS, DEMO, MODOS, VISTAS, CAPAS, C,
  ASSETS, GLB_URL, REVISION, FECHA_REVISION,
  cargarConjunto, usd, mUsd, m2, num, buscar, manzanaLabel,
} from '@/lib/visual-lab/isla-creta'
import type { Escena, QA } from './escena-isla-creta'
import FichaIslaCreta from './FichaIslaCreta'

type SheetPos = 'peek' | 'medio' | 'full'
const SHEET_H: Record<SheetPos, string> = { peek: '90px', medio: '48%', full: '88%' }

export default function IslaCretaPage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const compassRef = useRef<HTMLSpanElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const escenaRef = useRef<Escena | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [conj, setConj] = useState<Conjunto | null>(null)
  const [errorDatos, setErrorDatos] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [frac, setFrac] = useState(0)
  const [listo, setListo] = useState(false)
  const [qa, setQa] = useState<QA | null>(null)
  const [errorGlb, setErrorGlb] = useState<string | null>(null)

  const [modo, setModo] = useState<ModoId>('conjunto')
  const [vista, setVista] = useState<VistaId>('phase')
  const [capas, setCapas] = useState<Record<CapaId, boolean>>({ entorno: true, vegetacion: true, arquitectura: true, volumenes: false })
  const [noche, setNoche] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [inventario, setInventario] = useState(false)
  const [fManzana, setFManzana] = useState<number | 'MF' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetPos>('peek')

  const demo = modo === 'simulado'
  const units = conj?.units ?? []
  const sel = selId && conj ? conj.byId[selId] ?? null : null
  const hov = hoverId && conj ? conj.byId[hoverId] ?? null : null

  /* ── Datos ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let vivo = true
    setErrorDatos(null)
    cargarConjunto()
      .then((c) => { if (vivo) setConj(c) })
      .catch((e: Error) => { if (vivo) setErrorDatos(e.message) })
    return () => { vivo = false }
  }, [intento])

  /* ── Escena ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas || !conj) return
    let vivo = true
    let t: ReturnType<typeof setTimeout> | null = null
    setListo(false); setErrorGlb(null); setFrac(0)

    // three.js y el GLB van aparte: la UI pinta antes que la maqueta
    import('./escena-isla-creta').then(({ Escena }) => {
      if (!vivo) return
      const e = new Escena({
        canvas, wrap, labelEl: labelRef.current, compassEl: compassRef.current,
        units: conj.units, volumenes: conj.volumenes, glbUrl: GLB_URL,
        onHover: (id) => setHoverId(id),
        onPick: (id) => setSelId(id),
        onProgress: (f) => setFrac(f),
        onReady: (r) => {
          setQa(r)
          setListo(true)
          // enlace directo: ?parcela=MZ1-1 abre la ficha en cuanto hay maqueta
          const pedida = new URLSearchParams(window.location.search).get('parcela')
          if (pedida && conj.byId[pedida]) t = setTimeout(() => { setSelId(pedida); e.acercar(pedida, 1600) }, 600)
        },
        onError: (m) => setErrorGlb(m),
      })
      escenaRef.current = e
    })

    return () => {
      vivo = false
      if (t) clearTimeout(t)
      escenaRef.current?.dispose()
      escenaRef.current = null
    }
  }, [conj, intento])

  useEffect(() => { escenaRef.current?.setDemo(demo) }, [demo, listo])
  useEffect(() => { escenaRef.current?.setNoche(noche) }, [noche, listo])
  useEffect(() => { escenaRef.current?.setSel(selId) }, [selId, listo])
  useEffect(() => { escenaRef.current?.pausar(inventario) }, [inventario])
  useEffect(() => {
    const e = escenaRef.current
    if (!e) return
    ;(Object.keys(capas) as CapaId[]).forEach((k) => e.setCapa(k, capas[k]))
  }, [capas, listo])
  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current) }, [])

  /* ── Acciones ────────────────────────────────────────────────────── */
  const toast = (msg: string) => {
    setAviso(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setAviso(null), 2600)
  }

  const pickVista = (v: VistaId) => { setVista(v); escenaRef.current?.setVista(v) }
  const toggleCapa = (k: CapaId) => setCapas((c) => ({ ...c, [k]: !c[k] }))

  const seleccionar = useCallback((id: string, acercar = false) => {
    setSelId(id)
    setQ('')
    setInventario(false)
    if (acercar) setTimeout(() => escenaRef.current?.acercar(id), 80)
  }, [])

  const enlace = async () => {
    if (!sel) return
    const url = `${window.location.origin}${window.location.pathname}?parcela=${sel.unitId}`
    try { await navigator.clipboard.writeText(url); toast('Enlace a la parcela copiado') }
    catch { toast('No se pudo copiar el enlace') }
  }

  const reintentar = () => { setConj(null); setIntento((n) => n + 1) }

  /* ── Derivados ───────────────────────────────────────────────────── */
  const unif = units.filter((u) => u.type === 'unifamiliar').length
  const multi = units.length - unif
  const cuentaDemo: Record<DemoEstado, number> = { disponible: 0, reservado: 0, vendido: 0 }
  units.forEach((u) => { cuentaDemo[u.demoStatus]++ })
  const resultados = useMemo(() => buscar(units, q), [units, q])

  const leyenda: { color: string; label: string; n: string }[] = demo
    ? (Object.keys(DEMO) as DemoEstado[]).map((k) => ({ color: DEMO[k].color, label: DEMO[k].label, n: String(cuentaDemo[k]) }))
    : (Object.keys(TIPOS) as TipoId[]).map((k) => ({ color: TIPOS[k].color, label: TIPOS[k].label, n: String(units.filter((u) => u.type === k).length) }))

  const filasInv = useMemo(() => {
    let l = units
    if (fManzana === 'MF') l = l.filter((u) => u.type === 'multifamiliar')
    else if (fManzana != null) l = l.filter((u) => u.block === fManzana)
    if (q.trim()) l = buscar(l, q, 999)
    return l
  }, [units, fManzana, q])

  /* ── Bloques compartidos por el panel de escritorio y el sheet ───── */
  const Kpi = (
    <div>
      <p className="vl-label" style={{ margin: 0 }}>Parcelas en inventario</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 4 }}>
        <span style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{units.length || '—'}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{unif} unifamiliares · {multi} multifamiliares</span>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
        {conj ? `${m2(conj.sueloM2)} de suelo parcelado · parcela media ${m2(conj.sueloM2 / units.length)}` : 'Cargando inventario…'}
        <br />
        {conj ? `Valor ilustrativo ${mUsd(conj.valorUsd)} · disponibilidad por confirmar` : ''}
      </p>
    </div>
  )

  const Lectura = (
    <div className="vl-card">
      <p className="vl-label" style={{ margin: 0, padding: '11px 14px 7px' }}>Lectura</p>
      {MODOS.map((m, i) => (
        <button key={m.id} className="vl-modo" data-on={modo === m.id ? '1' : '0'} onClick={() => setModo(m.id)}>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span>{m.label}</span>
        </button>
      ))}
      {demo && (
        <p style={{ fontSize: 10.5, color: C.faint, margin: 0, padding: '4px 14px 12px', lineHeight: 1.5 }}>
          Reparto sintético reproducible. No representa ventas del promotor.
        </p>
      )}
    </div>
  )

  const Capas = (
    <div className="vl-card" style={{ padding: '12px 14px 14px' }}>
      <span className="vl-label">Capas</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
        {CAPAS.map((c) => (
          <button key={c.id} className="vl-chip" data-on={capas[c.id] ? '1' : '0'} onClick={() => toggleCapa(c.id)} title={c.nota}>
            {c.label}
          </button>
        ))}
        <button className="vl-chip" data-on={noche ? '1' : '0'} onClick={() => setNoche(!noche)}>Atardecer</button>
      </div>
      {!capas.entorno && capas.vegetacion && (
        <p style={{ fontSize: 10.5, color: C.faint, margin: '10px 0 0', lineHeight: 1.5 }}>Sin entorno tampoco se ven sus árboles.</p>
      )}
    </div>
  )

  const Encuadres = (
    <>
      <p className="vl-label" style={{ margin: 0 }}>Encuadre</p>
      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
        {VISTAS.map((v) => (
          <button key={v.id} className="vl-chip vl-chip-sq" data-on={vista === v.id ? '1' : '0'} onClick={() => pickVista(v.id)}>{v.label}</button>
        ))}
      </div>
      <p className="vl-label" style={{ margin: '16px 0 8px' }}>Buscar parcela</p>
      <input
        className="vl-input"
        placeholder="MZ1-1, manzana 7, MF-01…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {resultados.length > 0 && (
        <div style={{ marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 4, maxHeight: 190, overflowY: 'auto', background: '#fff' }}>
          {resultados.map((u) => (
            <button
              key={u.unitId}
              onClick={() => seleccionar(u.unitId, true)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', padding: '9px 10px', borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12, color: C.ink, textAlign: 'left' }}
            >
              <span>{u.unitId}</span>
              <span style={{ color: C.muted }}>{m2(u.areaM2)}</span>
            </button>
          ))}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: C.faint, margin: '14px 0 0', lineHeight: 1.55 }}>
        Geometría del CAD de julio de 2026. Viviendas, torres, paisaje y ribera son ilustrativos.
        Etapa 2 sin parcelación documentada. Maqueta revisión {REVISION} · {FECHA_REVISION}.
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

  /* ── Bottom sheet ────────────────────────────────────────────────── */
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

  const pct = Math.round(frac * 100)
  const fallo = errorDatos || errorGlb

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="vl-shell">
      <header className="vl-header">
        <div className="vl-header-id">
          <p className="vl-eyebrow">
            <Link href="/team/apps/visual-lab" style={{ color: 'inherit' }}>← FP Visual Lab</Link> · Suelo · USD
          </p>
          <h1 className="vl-title">Isla Creta</h1>
          <p className="vl-subtitle">Samborondón, Ecuador · {units.length || 173} parcelas · precios de demostración en USD</p>
        </div>
        <div className="vl-seg" role="tablist">
          <button role="tab" aria-selected={!inventario} data-on={inventario ? '0' : '1'} onClick={() => setInventario(false)}>Showroom</button>
          <button role="tab" aria-selected={inventario} data-on={inventario ? '1' : '0'} onClick={() => { setInventario(true); setSelId(null) }}>Inventario</button>
        </div>
      </header>

      <main className="vl-main">
        <div className="vl-canvas-wrap" ref={wrapRef} style={{ background: '#1b4147' }}>
          <canvas ref={canvasRef} />
        </div>

        {/* Placa: render de la maqueta que hace de pantalla de carga del GLB */}
        <div
          className="vl-plate"
          ref={plateRef}
          style={{ opacity: listo ? 0 : 1, pointerEvents: listo ? 'none' : 'auto', visibility: listo ? 'hidden' : 'visible', transition: 'opacity .9s ease .35s, visibility 0s 1.3s' }}
        >
          <img
            src={`${ASSETS}/firma-2100.jpg`}
            srcSet={`${ASSETS}/firma-1280.jpg 1280w, ${ASSETS}/firma-2100.jpg 2100w`}
            sizes="100vw"
            alt="Isla Creta desde el norte: la isla, el canal y la ribera aproximada"
            style={{ transform: listo ? 'scale(1.035)' : 'scale(1)' }}
          />
          <span className="vl-plate-badge"><i />Revisión {REVISION}</span>
          <div style={{
            position: 'absolute', left: '50%', bottom: 56, transform: 'translateX(-50%)',
            width: 'min(360px, calc(100% - 32px))', padding: '14px 18px 16px', borderRadius: 4,
            background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          }}>
            {fallo ? (
              <>
                <p className="vl-label" style={{ margin: 0, color: C.accent }}>No se ha podido cargar la maqueta</p>
                <p style={{ fontSize: 12, color: '#3A3A36', margin: '6px 0 0', lineHeight: 1.5 }}>{fallo}</p>
                <button className="vl-btn vl-btn-primary" style={{ marginTop: 12 }} onClick={reintentar}>Reintentar</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="vl-label">{conj ? 'Descargando la maqueta' : 'Cargando inventario'}</span>
                  <span style={{ fontSize: 12 }}>{conj ? `${pct}%` : ''}</span>
                </div>
                <div style={{ height: 2, background: C.border, marginTop: 10, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: '0 auto 0 0', background: C.accent, width: `${conj ? pct : 4}%`, transition: 'width .25s linear' }} />
                </div>
                <p style={{ fontSize: 10.5, color: C.faint, margin: '9px 0 0' }}>Modelo completo · 16 MB · 173 parcelas · 2.057 árboles</p>
              </>
            )}
          </div>
        </div>

        {/* Etiqueta de hover — solo puntero fino */}
        <div className="vl-hover-label" ref={labelRef}>
          <div className="vl-hover-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontSize: 13 }}>{hov?.unitId ?? ''}</span>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: hov && demo ? DEMO[hov.demoStatus].color : C.muted }}>
                {hov ? (demo ? DEMO[hov.demoStatus].label : manzanaLabel(hov)) : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              {hov ? `${m2(hov.areaM2)} · ${usd(hov.priceUsd)} · demo` : ''}
            </div>
          </div>
        </div>

        {/* Brújula */}
        <div className="vl-ic-compass" aria-hidden>
          <span ref={compassRef}>↑</span>
          N
        </div>

        <div className="vl-ic-marca">Arquitectura y precios ilustrativos</div>

        {/* Paneles flotantes (escritorio) */}
        <div className="vl-panel-left">
          {Kpi}
          {Lectura}
          {Capas}
        </div>
        <div className="vl-panel-right vl-card">{Encuadres}</div>
        <div className="vl-legend vl-card">
          {Leyenda}
          {qa && (
            <span style={{ fontSize: 10.5, color: C.faint }} title={`${qa.raycast} comprobaciones de selección · ${qa.ms} ms`}>
              {qa.vinculadas}/{qa.esperadas} vinculadas
            </span>
          )}
        </div>

        {/* Bottom sheet (móvil) */}
        <div className="vl-sheet" style={{ height: SHEET_H[sheet] }}>
          <div className="vl-sheet-handle" onPointerDown={onSheetDown} onPointerUp={onSheetUp}>
            <span />
          </div>
          <div className="vl-sheet-peek">
            <div>
              <p className="vl-label" style={{ margin: 0 }}>Parcelas</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{units.length || '—'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Suelo</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{conj ? m2(conj.sueloM2) : '—'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Valor demo</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1, color: C.accent }}>{conj ? mUsd(conj.valorUsd) : '—'}</p>
            </div>
          </div>
          <div className="vl-sheet-body">
            <div className="vl-card" style={{ padding: '12px 14px 14px', marginBottom: 12 }}>{Encuadres}</div>
            <div style={{ marginBottom: 12 }}>{Lectura}</div>
            <div className="vl-card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>{Leyenda}</div>
            <div style={{ marginBottom: 12 }}>{Capas}</div>
          </div>
        </div>

        {/* Ficha de parcela */}
        {sel && conj && !inventario && (
          <FichaIslaCreta
            u={sel}
            reglas={conj.reglas}
            demo={demo}
            onClose={() => setSelId(null)}
            onAcercar={() => escenaRef.current?.acercar(sel.unitId)}
            onEnlace={enlace}
          />
        )}

        {/* Inventario */}
        {inventario && conj && (
          <div className="vl-consola">
            <div className="vl-consola-nav">
              <button data-on={fManzana == null ? '1' : '0'} onClick={() => setFManzana(null)}>Todas · {units.length}</button>
              {conj.manzanas.map((b) => (
                <button key={b} data-on={fManzana === b ? '1' : '0'} onClick={() => setFManzana(b)}>MZ {b}</button>
              ))}
              <button data-on={fManzana === 'MF' ? '1' : '0'} onClick={() => setFManzana('MF')}>Multifamiliar</button>
            </div>
            <div className="vl-consola-body">
              <div className="vl-tiles" style={{ marginBottom: 16 }}>
                <div className="vl-tile"><div className="vl-tile-k">Parcelas</div><div className="vl-tile-v">{filasInv.length}</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Suelo</div><div className="vl-tile-v">{m2(filasInv.reduce((a, u) => a + u.areaM2, 0))}</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Valor demo</div><div className="vl-tile-v">{mUsd(filasInv.reduce((a, u) => a + u.priceUsd, 0))}</div></div>
                <div className="vl-tile"><div className="vl-tile-k">USD/m² medio</div><div className="vl-tile-v">{filasInv.length ? num(filasInv.reduce((a, u) => a + u.priceUsd, 0) / filasInv.reduce((a, u) => a + u.areaM2, 0)) : '—'}</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Disponibilidad</div><div className="vl-tile-v" style={{ fontSize: 13, marginTop: 6 }}>Por confirmar</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Precios</div><div className="vl-tile-v" style={{ fontSize: 13, marginTop: 6 }}>{conj.reglas.version}</div></div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <input className="vl-input" style={{ maxWidth: 320 }} placeholder="Buscar por ID o manzana" value={q} onChange={(e) => setQ(e.target.value)} />
                <span style={{ fontSize: 11, color: C.faint }}>{conj.aviso}</span>
              </div>

              <div className="vl-inv-table" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div className="vl-ic-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Parcela', 'Manzana', 'Tipo', 'Superficie', 'USD/m²', 'Precio demo', demo ? 'Estado simulado' : 'Disponibilidad', ''].map((t, i) => (
                    <div key={t || 'x'} className="vl-label" style={{ padding: '12px 0', textAlign: i >= 3 && i <= 5 ? 'right' : 'left' }}>{t}</div>
                  ))}
                </div>
                {filasInv.map((u) => <FilaInv key={u.unitId} u={u} demo={demo} onVer={() => seleccionar(u.unitId, true)} />)}
              </div>
              {filasInv.map((u) => (
                <div key={u.unitId} className="vl-inv-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 16 }}>{u.unitId}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{manzanaLabel(u)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>{m2(u.areaM2)} · {num(u.effectiveUsdM2)} USD/m²</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 15 }}>{usd(u.priceUsd)}</span>
                    <button className="vl-chip" onClick={() => seleccionar(u.unitId, true)}>Ver en maqueta</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aviso && <div className="vl-toast">{aviso}</div>}
      </main>
    </div>
  )
}

function FilaInv({ u, demo, onVer }: { u: Parcela; demo: boolean; onVer: () => void }) {
  const d = DEMO[u.demoStatus]
  return (
    <div className="vl-ic-row" style={{ borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center' }}>
      <div style={{ padding: '11px 0', fontSize: 13 }}>{u.unitId}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{u.block != null ? `MZ ${u.block}` : '—'}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{TIPOS[u.type].corto}</div>
      <div style={{ fontSize: 12.5, textAlign: 'right' }}>{m2(u.areaM2)}</div>
      <div style={{ fontSize: 12.5, textAlign: 'right' }}>{num(u.effectiveUsdM2)}</div>
      <div style={{ fontSize: 12.5, textAlign: 'right' }}>{usd(u.priceUsd)}</div>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: demo ? d.color : C.faint }}>
        {demo ? d.label : 'Por confirmar'}
      </div>
      <div style={{ textAlign: 'right' }}>
        <button onClick={onVer} style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accent, padding: '8px 0' }}>Ver →</button>
      </div>
    </div>
  )
}

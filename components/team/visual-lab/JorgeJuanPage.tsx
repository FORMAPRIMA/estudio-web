'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  type ModoId, type VistaId, type CapaId, type FichaTab, type Vivienda,
  VIVIENDAS, BY_ID, SUP_TOTAL, PLANTAS, MODOS, VISTAS, CAPAS, FICHA_TABS, PROGRAMA, RENDERS, C,
  renderUrl,
  ASSETS, GLB_URL, REVISION, FECHA_REVISION,
  plantaLabel, nombreVivienda, datosVivienda,
} from '@/lib/visual-lab/jorge-juan'
import type { Escena, QA } from './escena-jorge-juan'

type SheetPos = 'peek' | 'medio' | 'full'
const SHEET_H: Record<SheetPos, string> = { peek: '90px', medio: '48%', full: '88%' }
const num = (n: number) => new Intl.NumberFormat('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions).format(n)

export default function JorgeJuanPage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const compassRef = useRef<HTMLSpanElement>(null)
  const estanciasRef = useRef<HTMLDivElement>(null)
  const escenaRef = useRef<Escena | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [intento, setIntento] = useState(0)
  const [frac, setFrac] = useState(0)
  const [listo, setListo] = useState(false)
  const [qa, setQa] = useState<QA | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [modo, setModo] = useState<ModoId>('edificio')
  const [vista, setVista] = useState<VistaId>('calle')
  const [capas, setCapas] = useState<Record<CapaId, boolean>>({ entorno: true, calle: true, volumenes: false })
  const [selId, setSelId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [tab, setTab] = useState<FichaTab>('distribucion')
  const [inventario, setInventario] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetPos>('peek')

  const sel = selId ? BY_ID[selId] ?? null : null
  const hov = hoverId ? BY_ID[hoverId] ?? null : null

  /* ── Escena ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return
    let vivo = true
    let t: ReturnType<typeof setTimeout> | null = null
    setListo(false); setError(null); setFrac(0)

    // three.js y el GLB van aparte: la UI pinta antes que la maqueta
    import('./escena-jorge-juan').then(({ Escena }) => {
      if (!vivo) return
      const e = new Escena({
        canvas, wrap, labelEl: labelRef.current, compassEl: compassRef.current, estanciasEl: estanciasRef.current, glbUrl: GLB_URL,
        onHover: (id) => setHoverId(id),
        // tocar una vivienda despieza el edificio por su planta
        onPick: (id) => { setSelId(id); setTab('distribucion'); setModo('planta') },
        onProgress: (f) => setFrac(f),
        onReady: (r) => {
          setQa(r)
          setListo(true)
          // enlace directo: ?vivienda=5-IZ abre la ficha con el edificio despiezado
          const pedida = new URLSearchParams(window.location.search).get('vivienda')
          if (pedida && BY_ID[pedida]) t = setTimeout(() => { setSelId(pedida); setModo('planta') }, 600)
        },
        onError: (m) => setError(m),
      })
      escenaRef.current = e
    })

    return () => {
      vivo = false
      if (t) clearTimeout(t)
      escenaRef.current?.dispose()
      escenaRef.current = null
    }
  }, [intento])

  useEffect(() => { escenaRef.current?.setSel(selId) }, [selId, listo])
  useEffect(() => { escenaRef.current?.setModo(modo) }, [modo, listo])
  useEffect(() => { if (selId) escenaRef.current?.acercar(selId) }, [selId, listo])
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

  const seleccionar = useCallback((id: string) => {
    setSelId(id)
    setTab('distribucion')
    setInventario(false)
    setModo('planta')
  }, [])

  const pickModo = (m: ModoId) => {
    // la planta abierta necesita una vivienda: si no hay, se abre la del ejemplo
    if (m === 'planta' && !selId) setSelId('5-IZ')
    setModo(m)
  }

  const cerrarFicha = () => {
    setSelId(null)
    if (modo === 'planta') setModo('edificio')
  }

  const enlace = async () => {
    if (!sel) return
    const url = `${window.location.origin}${window.location.pathname}?vivienda=${sel.id}`
    try { await navigator.clipboard.writeText(url); toast('Enlace a la vivienda copiado') }
    catch { toast('No se pudo copiar el enlace') }
  }

  const reintentar = () => setIntento((n) => n + 1)

  /* ── Bloques compartidos por el panel de escritorio y el sheet ───── */
  const Kpi = (
    <div>
      <p className="vl-label" style={{ margin: 0 }}>Viviendas</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 4 }}>
        <span style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{VIVIENDAS.length}</span>
        <span style={{ fontSize: 11, color: C.muted }}>dos por planta · bajo + {PLANTAS} plantas</span>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
        {num(SUP_TOTAL)} m² según Catastro · ático retranqueado
        <br />
        Toca una vivienda: el edificio se abre por su planta
      </p>
    </div>
  )

  const Lectura = (
    <div className="vl-card">
      <p className="vl-label" style={{ margin: 0, padding: '11px 14px 7px' }}>Lectura</p>
      {MODOS.map((m, i) => (
        <button key={m.id} className="vl-modo" data-on={modo === m.id ? '1' : '0'} onClick={() => pickModo(m.id)} title={m.nota}>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span>{m.label}</span>
        </button>
      ))}
      {modo === 'planta' && sel && (
        <p style={{ fontSize: 10.5, color: C.faint, margin: 0, padding: '4px 14px 12px', lineHeight: 1.5 }}>
          Despiezado por la planta {plantaLabel(sel.planta)}. Distribución de la propuesta del 5º izquierda.
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
      </div>
    </div>
  )

  const Apilamiento = (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 1fr', gap: 4, alignItems: 'center' }}>
        <span />
        <span className="vl-label" style={{ textAlign: 'center' }}>Izq.</span>
        <span className="vl-label" style={{ textAlign: 'center' }}>Der.</span>
        {Array.from({ length: PLANTAS + 1 }, (_, i) => PLANTAS - i).map((p) => (
          <FilaPlanta key={p} p={p} selId={selId} hoverId={hoverId} onSel={seleccionar} />
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: C.faint, margin: '10px 0 0', lineHeight: 1.5 }}>Vistas desde Jorge Juan: la izquierda queda al este.</p>
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
      <p className="vl-label" style={{ margin: '16px 0 10px' }}>Viviendas por planta</p>
      {Apilamiento}
      <p style={{ fontSize: 10.5, color: C.faint, margin: '14px 0 0', lineHeight: 1.55 }}>
        Maqueta de ejemplo sobre un edificio real. Superficies de Catastro; interiores en clay con la
        propuesta de reforma del 5º izquierda. {REVISION} · {FECHA_REVISION}.
      </p>
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

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="vl-shell vl-jj">
      <header className="vl-header">
        <div className="vl-header-id">
          <p className="vl-eyebrow">
            <Link href="/team/apps/visual-lab" style={{ color: 'inherit' }}>← FP Visual Lab</Link> · Residencial · Madrid
          </p>
          <h1 className="vl-title">Jorge Juan 40</h1>
          <p className="vl-subtitle">Salamanca, Madrid · 14 viviendas en bajo + 6 plantas · maqueta digital de ejemplo</p>
        </div>
        <div className="vl-seg" role="tablist">
          <button role="tab" aria-selected={!inventario} data-on={inventario ? '0' : '1'} onClick={() => setInventario(false)}>Showroom</button>
          <button role="tab" aria-selected={inventario} data-on={inventario ? '1' : '0'} onClick={() => setInventario(true)}>Viviendas</button>
        </div>
      </header>

      <main className="vl-main">
        <div className="vl-canvas-wrap" ref={wrapRef} style={{ background: '#E9E7E1' }}>
          <canvas ref={canvasRef} />
          {/* etiquetas de estancia de la vivienda abierta (las posiciona la escena) */}
          <div className="vl-est-capa" ref={estanciasRef} />
        </div>

        {/* Placa: render de la maqueta desde el mismo encuadre; hace de pantalla de carga */}
        <div
          className="vl-plate"
          style={{ opacity: listo ? 0 : 1, pointerEvents: listo ? 'none' : 'auto', visibility: listo ? 'hidden' : 'visible', transition: 'opacity .9s ease .35s, visibility 0s 1.3s', background: '#E9E7E1' }}
        >
          <img
            src={`${ASSETS}/firma-2560.jpg`}
            srcSet={`${ASSETS}/firma-1280.jpg 1280w, ${ASSETS}/firma-2560.jpg 2560w`}
            sizes="100vw"
            alt="Jorge Juan 40 desde la calle: fachada, cuerpos volados curvos y la fila de acacias"
            style={{ transform: listo ? 'scale(1.035)' : 'scale(1)' }}
          />
          <span className="vl-plate-badge"><i />Maqueta {REVISION}</span>
          <div style={{
            position: 'absolute', left: '50%', bottom: 56, transform: 'translateX(-50%)',
            width: 'min(360px, calc(100% - 32px))', padding: '14px 18px 16px', borderRadius: 4,
            background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          }}>
            {error ? (
              <>
                <p className="vl-label" style={{ margin: 0, color: C.accent }}>No se ha podido cargar la maqueta</p>
                <p style={{ fontSize: 12, color: '#3A3A36', margin: '6px 0 0', lineHeight: 1.5 }}>{error}</p>
                <button className="vl-btn vl-btn-primary" style={{ marginTop: 12 }} onClick={reintentar}>Reintentar</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="vl-label">Descargando la maqueta</span>
                  <span style={{ fontSize: 12 }}>{pct}%</span>
                </div>
                <div style={{ height: 2, background: C.border, marginTop: 10, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: '0 auto 0 0', background: C.accent, width: `${Math.max(4, pct)}%`, transition: 'width .25s linear' }} />
                </div>
                <p style={{ fontSize: 10.5, color: C.faint, margin: '9px 0 0' }}>Edificio, interiores y calle · 0,3 MB</p>
              </>
            )}
          </div>
        </div>

        {/* Etiqueta de hover — solo puntero fino */}
        <div className="vl-hover-label" ref={labelRef}>
          <div className="vl-hover-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontSize: 13 }}>{hov ? nombreVivienda(hov) : ''}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{hov ? `${hov.supCatastro} m² · Catastro` : ''}</div>
          </div>
        </div>

        <div className="vl-ic-compass" aria-hidden>
          <span ref={compassRef}>↑</span>
          N
        </div>
        <div className="vl-ic-marca">Maqueta de ejemplo · interiores ilustrativos</div>

        {/* Paneles flotantes (escritorio) */}
        <div className="vl-panel-left">
          {Kpi}
          {Lectura}
          {Capas}
        </div>
        <div className="vl-panel-right vl-card">{Encuadres}</div>
        <div className="vl-legend vl-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, background: C.accent, flex: '0 0 auto' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.04em', color: '#3A3A36' }}>Vivienda seleccionada</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, background: '#E9E7E1', border: `1px solid ${C.border}`, flex: '0 0 auto' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.04em', color: '#3A3A36' }}>Interior en clay</span>
          </div>
          {qa && (
            <span style={{ fontSize: 10.5, color: C.faint }} title={`${num(qa.triangulos)} triángulos visibles · ${qa.ms} ms`}>
              {qa.viviendas}/{qa.esperadas} viviendas
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
              <p className="vl-label" style={{ margin: 0 }}>Viviendas</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{VIVIENDAS.length}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Plantas</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>B + {PLANTAS}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="vl-label" style={{ margin: 0 }}>Catastro</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 300, lineHeight: 1.1 }}>{num(SUP_TOTAL)} m²</p>
            </div>
          </div>
          <div className="vl-sheet-body">
            <div className="vl-card" style={{ padding: '12px 14px 14px', marginBottom: 12 }}>{Encuadres}</div>
            <div style={{ marginBottom: 12 }}>{Lectura}</div>
            <div style={{ marginBottom: 12 }}>{Capas}</div>
          </div>
        </div>

        {/* Ficha de vivienda */}
        {sel && !inventario && (
          <Ficha
            v={sel}
            tab={tab}
            onTab={setTab}
            abierta={modo === 'planta'}
            onAbrir={() => setModo(modo === 'planta' ? 'edificio' : 'planta')}
            onAcercar={() => escenaRef.current?.acercar(sel.id)}
            onEnlace={enlace}
            onClose={cerrarFicha}
          />
        )}

        {/* Inventario */}
        {inventario && (
          <div className="vl-consola">
            <div className="vl-consola-body">
              <div className="vl-tiles" style={{ marginBottom: 16 }}>
                <div className="vl-tile"><div className="vl-tile-k">Viviendas</div><div className="vl-tile-v">{VIVIENDAS.length}</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Plantas</div><div className="vl-tile-v">B + {PLANTAS}</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Superficie Catastro</div><div className="vl-tile-v">{num(SUP_TOTAL)} m²</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Planta tipo</div><div className="vl-tile-v">368 m²</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Ref. catastral</div><div className="vl-tile-v" style={{ fontSize: 13, marginTop: 6 }}>2251203VK4725A</div></div>
                <div className="vl-tile"><div className="vl-tile-k">Disponibilidad</div><div className="vl-tile-v" style={{ fontSize: 13, marginTop: 6 }}>Sin datos</div></div>
              </div>
              <div className="vl-inv-table" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div className="vl-jj-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Vivienda', 'Planta', 'Mano', 'Catastro', 'Referencia catastral', ''].map((t, i) => (
                    <div key={t || 'x'} className="vl-label" style={{ padding: '12px 0', textAlign: i === 3 ? 'right' : 'left' }}>{t}</div>
                  ))}
                </div>
                {VIVIENDAS.map((v) => (
                  <div key={v.id} className="vl-jj-row" style={{ borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center' }}>
                    <div style={{ padding: '11px 0', fontSize: 13 }}>{nombreVivienda(v)}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{plantaLabel(v.planta)}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{v.mano === 'IZ' ? 'Izquierda' : 'Derecha'}</div>
                    <div style={{ fontSize: 12.5, textAlign: 'right' }}>{v.supCatastro} m²</div>
                    <div style={{ fontSize: 12, color: C.muted, paddingLeft: 24 }}>{v.refCatastral}</div>
                    <div style={{ textAlign: 'right' }}>
                      <button onClick={() => seleccionar(v.id)} style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accent, padding: '8px 0' }}>Ver →</button>
                    </div>
                  </div>
                ))}
              </div>
              {VIVIENDAS.map((v) => (
                <div key={v.id} className="vl-inv-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 16 }}>{nombreVivienda(v)}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{v.supCatastro} m²</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>{v.refCatastral}</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button className="vl-chip" onClick={() => seleccionar(v.id)}>Ver en maqueta</button>
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

function FilaPlanta({ p, selId, hoverId, onSel }: { p: number; selId: string | null; hoverId: string | null; onSel: (id: string) => void }) {
  return (
    <>
      <span style={{ fontSize: 11, color: C.muted }}>{plantaLabel(p)}</span>
      {(['IZ', 'DR'] as const).map((m) => {
        const id = `${p === 0 ? 'BJ' : p}-${m}`
        const on = id === selId, hover = id === hoverId
        return (
          <button
            key={id}
            onClick={() => onSel(id)}
            aria-label={nombreVivienda(BY_ID[id])}
            style={{
              height: 26, borderRadius: 3, fontSize: 11,
              border: `1px solid ${on || hover ? C.accent : C.border}`,
              background: on ? C.accent : hover ? '#FBEDE7' : '#fff',
              color: on ? '#fff' : '#3A3A36',
            }}
          >
            {BY_ID[id].supCatastro} m²
          </button>
        )
      })}
    </>
  )
}

function Ficha({ v, tab, onTab, abierta, onAbrir, onAcercar, onEnlace, onClose }: {
  v: Vivienda; tab: FichaTab; onTab: (t: FichaTab) => void; abierta: boolean
  onAbrir: () => void; onAcercar: () => void; onEnlace: () => void; onClose: () => void
}) {
  return (
    <div className="vl-ficha">
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p className="vl-label" style={{ margin: 0 }}>Vivienda · planta {plantaLabel(v.planta)}</p>
          <p style={{ fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.01em', margin: '6px 0 0', fontWeight: 300 }}>{nombreVivienda(v)}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '7px 0 0' }}>Jorge Juan 40 · Salamanca, Madrid</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar ficha"
          style={{ flex: '0 0 auto', width: 36, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, color: '#3A3A36', fontSize: 17 }}
        >
          ×
        </button>
      </div>

      <div className="vl-datos" style={{ margin: '20px 20px 0', borderTop: `1px solid ${C.border}` }}>
        {datosVivienda(v).map((x) => (
          <div key={x.k} style={{ padding: '11px 10px 12px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
            <p className="vl-label" style={{ margin: 0 }}>{x.k}</p>
            <p style={{ fontSize: 13, margin: '5px 0 0', wordBreak: 'break-word' }}>{x.v}</p>
          </div>
        ))}
      </div>

      <div style={{ margin: '18px 20px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FICHA_TABS.map((t) => (
            <button key={t.id} onClick={() => onTab(t.id)} className="vl-chip vl-chip-sq" data-on={tab === t.id ? '1' : '0'}>{t.label}</button>
          ))}
        </div>
        {tab === 'distribucion' ? (
          <a href={`${ASSETS}/distribucion-tipo.jpg`} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSETS}/distribucion-tipo.jpg`} alt="Distribución de la propuesta de reforma del 5º izquierda" style={{ width: '100%', display: 'block' }} />
          </a>
        ) : tab === 'renders' ? (
          <Galeria />
        ) : (
          <div style={{ marginTop: 10, height: 180, borderRadius: 4, border: `1px dashed ${C.border}`, background: '#F4F2EC', display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center' }}>
            <div>
              <p style={{ fontSize: 22, margin: 0, opacity: 0.3 }}>◳</p>
              <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
                Recorrido virtual por la vivienda
                <br />
                <span style={{ color: C.faint }}>Pendiente de producir</span>
              </p>
            </div>
          </div>
        )}
        <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, margin: '8px 0 0' }}>
          {tab === 'distribucion' ? 'Propuesta de reforma · 5º izquierda · toca para ampliar'
            : tab === 'renders' ? `${RENDERS.length} renders del proyecto · toca para ampliar` : 'Hueco reservado'}
        </p>
      </div>

      <div style={{ margin: '20px 20px 0', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <p className="vl-label" style={{ margin: '0 0 8px' }}>Programa de la propuesta</p>
        {PROGRAMA.map((p) => (
          <div key={p.k} className="vl-row">
            <span style={{ fontSize: 13, color: '#3A3A36' }}>{p.k}</span>
            <span style={{ fontSize: 13, textAlign: 'right' }}>{p.v}</span>
          </div>
        ))}
        {v.tipo !== 'tipo' && (
          <p style={{ fontSize: 11, color: C.faint, margin: '8px 0 0', lineHeight: 1.5 }}>
            {v.tipo === 'atico' ? 'En el ático la distribución se recorta a sus retranqueos.' : 'En el bajo la distribución pierde la galería trasera.'}
          </p>
        )}
      </div>

      <div style={{ margin: '18px 20px 0', padding: '12px 14px', background: '#F4F2EC', borderRadius: 4 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.ink, margin: 0 }}>Maqueta de ejemplo</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.55 }}>
          Edificio real, maqueta abstracta. Las dos viviendas de cada planta se han modelado en espejo y todas
          llevan la distribución propuesta para el 5º izquierda: no describe el estado de cada vivienda.
        </p>
      </div>

      <div style={{ margin: '22px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vl-btn vl-btn-primary" onClick={onAbrir}>{abierta ? 'Recomponer el edificio' : 'Despiezar por esta planta'}</button>
        <button className="vl-btn vl-btn-ghost" onClick={onAcercar}>Acercar a esta vivienda</button>
        <button className="vl-btn vl-btn-plain" onClick={onEnlace}>Copiar enlace a la vivienda</button>
      </div>
    </div>
  )
}

/** Renders del proyecto: miniaturas ligeras y visor a pantalla completa con flechas y swipe. */
function Galeria() {
  const [i, setI] = useState<number | null>(null)
  const x0 = useRef<number | null>(null)
  const n = RENDERS.length
  const mover = useCallback((d: number) => setI((v) => (v == null ? v : (v + d + n) % n)), [n])

  useEffect(() => {
    if (i == null) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setI(null)
      else if (e.key === 'ArrowRight') mover(1)
      else if (e.key === 'ArrowLeft') mover(-1)
    }
    window.addEventListener('keydown', k)
    // precarga la siguiente para que el paso sea instantáneo
    const img = new Image()
    img.src = renderUrl(RENDERS[(i + 1) % n].n)
    return () => window.removeEventListener('keydown', k)
  }, [i, mover, n])

  const r = i != null ? RENDERS[i] : null
  return (
    <>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {RENDERS.map((x, k) => (
          <button key={x.n} onClick={() => setI(k)} style={{ padding: 0, border: 'none', borderRadius: 3, overflow: 'hidden', background: '#EEE', aspectRatio: '5 / 4', position: 'relative' }} aria-label={x.t}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={renderUrl(x.n, true)} alt={x.t} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      {/* portal: la animación de la ficha deja un transform que atraparía el position: fixed */}
      {r && createPortal(
        <div
          onClick={() => setI(null)}
          onPointerDown={(e) => { x0.current = e.clientX }}
          onPointerUp={(e) => {
            const d = x0.current == null ? 0 : e.clientX - x0.current
            x0.current = null
            if (Math.abs(d) > 40) { e.stopPropagation(); mover(d < 0 ? 1 : -1) }
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(16,15,13,.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={renderUrl(r.n)} alt={r.t} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: 'calc(100dvh - 110px)', objectFit: 'contain', display: 'block', userSelect: 'none' }} draggable={false} />
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, color: '#F2F1EC' }}>
            <button onClick={() => mover(-1)} aria-label="Anterior" style={{ color: 'inherit', fontSize: 22, padding: '4px 10px' }}>‹</button>
            <span style={{ fontSize: 12, letterSpacing: '0.06em', minWidth: 220, textAlign: 'center' }}>
              {r.t} <span style={{ opacity: 0.5 }}>· {i! + 1}/{n}</span>
            </span>
            <button onClick={() => mover(1)} aria-label="Siguiente" style={{ color: 'inherit', fontSize: 22, padding: '4px 10px' }}>›</button>
          </div>
          <button onClick={() => setI(null)} aria-label="Cerrar" style={{ position: 'absolute', top: 14, right: 16, color: '#F2F1EC', fontSize: 26 }}>×</button>
        </div>,
        document.body,
      )}
    </>
  )
}

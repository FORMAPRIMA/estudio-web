'use client'

// Pantalla de la maqueta digital: la torre de Méndez Álvaro 32 de FP Visual Lab
// (components/team/visual-lab/escena-mendez.ts), en solo lectura y con el sello
// de demostración siempre visible. Sin consola, sin precios editables, sin
// cambiar estados: el visitante filtra por modo y toca viviendas.
//
// Mismo patrón que el mapa: en reposo no atrapa el scroll (en escritorio se
// arrastra para girar; la rueda es de la página salvo con Ctrl/pellizco), y
// «Explorar la maqueta» la abre a pantalla completa con todos los gestos.

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildConjunto, eur, plantaLabel, type ModoId, type Vivienda } from '@/lib/visual-lab/mendez'
import type { Escena } from '@/components/team/visual-lab/escena-mendez'
import type { Textos } from '@/lib/para/textos'
import { useBloqueoScroll, useEnPantalla, useVisto } from './Presentacion'

const MODOS: ModoId[] = ['disponibilidad', 'plantas', 'asoleamiento', 'vista']
const COLOR: Record<string, string> = { disponible: '#3D8B5F', negociacion: '#5B7FA6', reservada: '#8A6220', vendida: '#9C9C96', piloto: '#8A5A72' }
const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MaquetaTorre({ t }: { t: Textos }) {
  const conj = useMemo(() => buildConjunto(), [])
  const { units, byId } = conj
  const disponibles = units.filter((u) => u.estado === 'disponible').length

  const [refCerca, cerca] = useEnPantalla<HTMLElement>('70% 0px')
  const [refActiva, activa] = useEnPantalla<HTMLDivElement>('0px')
  const [refVisto, visto] = useVisto<HTMLDivElement>(0.5)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const etiqueta = useRef<HTMLDivElement>(null)
  const escena = useRef<Escena | null>(null)
  const explorandoRef = useRef(false)

  const [lista, setLista] = useState(false)
  const [placa, setPlaca] = useState(true)
  const [modo, setModo] = useState<ModoId>('disponibilidad')
  const [sel, setSel] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [explorando, setExplorando] = useState(false)
  useBloqueoScroll(explorando)
  explorandoRef.current = explorando

  // three.js (~190 KB) solo se pide cuando la pantalla se acerca.
  useEffect(() => {
    if (!cerca || escena.current || !wrap.current || !canvas.current) return
    let vivo = true
    import('@/components/team/visual-lab/escena-mendez').then(({ Escena }) => {
      if (!vivo || !wrap.current || !canvas.current) return
      const e = new Escena({
        canvas: canvas.current, wrap: wrap.current, labelEl: etiqueta.current, units,
        onHover: (id) => setHover(id),
        onPick: (id) => setSel(id),
        rueda: (ev) => explorandoRef.current || ev.ctrlKey,
      })
      e.posarEnFirma()
      escena.current = e
      setLista(true)
    })
    return () => { vivo = false }
  }, [cerca, units])

  useEffect(() => () => { escena.current?.dispose(); escena.current = null }, [])

  // Fuera de pantalla no se pinta: el mapa y la maqueta nunca compiten por la GPU.
  useEffect(() => { escena.current?.pausar(!activa && !explorando) }, [activa, explorando, lista])

  // Al llegar: la foto de firma se funde con la maqueta (mismo encuadre) y la cámara deriva.
  useEffect(() => {
    if (!lista || !visto || !placa) return
    const k = setTimeout(() => { setPlaca(false); escena.current?.derivar(sinMovimiento() ? 0 : 2600) }, 900)
    return () => clearTimeout(k)
  }, [lista, visto, placa])

  useEffect(() => {
    const e = escena.current
    if (!e || !lista) return
    const id = e.setModo(modo)
    if (modo === 'vista' && id) setSel(id)
  }, [modo, lista])

  // Modo «Luz»: el sol recorre el día en bucle mientras el modo está activo.
  useEffect(() => {
    const e = escena.current
    if (!e || modo !== 'asoleamiento') { escena.current?.setSol(790); return }
    if (sinMovimiento()) { e.setSol(560); return }
    let raf = 0
    const t0 = performance.now()
    const paso = (now: number) => {
      const f = ((now - t0) / 9000) % 1
      e.setSol(120 + (0.5 - 0.5 * Math.cos(f * Math.PI * 2)) * 820)
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [modo, lista])

  useEffect(() => { escena.current?.setSel(sel) }, [sel])

  useEffect(() => {
    if (!explorando) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setExplorando(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [explorando])

  const seguir = () => {
    setExplorando(false)
    setSel(null)
    requestAnimationFrame(() => {
      const sec = refCerca.current?.nextElementSibling as HTMLElement | null
      if (sec) sec.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth' })
      else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    })
  }

  const u: Vivienda | null = sel ? byId[sel] : null
  const h: Vivienda | null = hover ? byId[hover] : null

  return (
    <section ref={refCerca} data-tema="claro" className={`p-escena p-maqueta${explorando ? ' explorando' : ''}`} aria-label={t.maquetaTitulo}>
      <div ref={refActiva} className="p-maqueta-grid">
        <div ref={refVisto} className={`p-maqueta-txt${visto ? ' visto' : ''}`}>
          <p className="p-it p-in">03 · {t.maquetaRotulo}</p>
          <h2 className="p-h2"><span className="p-in-h"><span style={{ ['--d' as string]: '.12s' }}>{t.maquetaTitulo}</span></span></h2>
          <p className="p-texto p-in p-maqueta-texto" style={{ ['--d' as string]: '.3s' }}>{t.maquetaTexto}</p>
          <div className="p-maqueta-dato p-in" style={{ ['--d' as string]: '.42s' }}>
            <b>{disponibles}</b><span>/ {units.length} {t.viviendas} {t.disponibles}</span>
          </div>
        </div>

        <div ref={wrap} className="p-maqueta-lienzo">
          <canvas ref={canvas} />
          <img
            className={`p-maqueta-placa${placa ? '' : ' fuera'}`}
            src="/visual-lab/firma-mendez-1280.jpg"
            srcSet="/visual-lab/firma-mendez-1280.jpg 1280w, /visual-lab/firma-mendez-2560.jpg 2560w"
            sizes="(min-width: 1024px) 66vw, 100vw"
            alt=""
            loading="lazy"
          />
          <div ref={etiqueta} className="p-maqueta-etiqueta" aria-hidden>
            {h && <><b>{h.id}</b>{t.estados[h.estado]}</>}
          </div>
          <span className="p-sello">{t.sello}</span>
          {!explorando && <button type="button" className="p-maqueta-toque" aria-label={t.explorarMaqueta} onClick={() => setExplorando(true)} />}
        </div>

        <div className={`p-maqueta-mandos${visto ? ' visto' : ''}`}>
          <div className="p-modos p-in" style={{ ['--d' as string]: '.55s' }} role="tablist">
            {MODOS.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={modo === m} className={modo === m ? 'on' : ''} onClick={() => { setModo(m); if (m !== 'vista') setSel(null) }}>
                {t.modos[m]}
              </button>
            ))}
          </div>
          {!explorando && (
            <button type="button" className="p-explorar p-explorar-claro p-in" style={{ ['--d' as string]: '.65s' }} onClick={() => setExplorando(true)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" /></svg>
              {t.explorarMaqueta}
            </button>
          )}
        </div>
      </div>

      {explorando && (
        <button type="button" className="p-explorar p-explorar-claro p-seguir" onClick={seguir}>
          {t.cerrar}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" /></svg>
        </button>
      )}

      {u && (
        <article className="p-ficha" key={u.id}>
          <div className="p-ficha-cab">
            <span className="p-ficha-id">{u.id}</span>
            <span className="p-ficha-estado"><i style={{ background: COLOR[u.estado] }} />{t.estados[u.estado]}</span>
            <button type="button" className="p-ficha-x" aria-label="×" onClick={() => setSel(null)}>×</button>
          </div>
          <dl className="p-ficha-datos">
            <div><dt>{plantaLabel(u.planta)}</dt><dd>{u.util} m²</dd></div>
            <div><dt>{t.dorm}</dt><dd>{u.dorm}</dd></div>
            <div><dt>{u.vista}</dt><dd>{u.orient}</dd></div>
            <div><dt>€</dt><dd>{eur(u.precio)}</dd></div>
          </dl>
          <p className="p-ficha-nota">{t.sello}</p>
        </article>
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </section>
  )
}

const CSS = `
.p-maqueta{background:#f4f3f0;color:#141414;}
.p-maqueta-grid{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;}
.p-maqueta-txt{position:relative;z-index:2;padding:calc(env(safe-area-inset-top) + 76px) var(--p-gutter) 0;display:flex;flex-direction:column;gap:14px;pointer-events:none;}
.p-maqueta .p-it{color:#4f6556;}
.p-maqueta .p-h2{max-width:14ch;}
.p-maqueta-texto{display:none;color:rgba(20,20,20,.68);}
.p-maqueta-dato{display:flex;align-items:baseline;gap:8px;font-size:13px;color:rgba(20,20,20,.62);}
.p-maqueta-dato b{font-weight:200;font-size:30px;color:#141414;letter-spacing:-.02em;}
.p-maqueta-lienzo{position:relative;min-height:0;}
.p-maqueta-lienzo canvas,.p-maqueta-placa{-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 88%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 88%,transparent 100%);}
.p-maqueta.explorando .p-maqueta-lienzo canvas{-webkit-mask-image:none;mask-image:none;}
.p-maqueta-lienzo canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;}
.p-maqueta-placa{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 1.4s cubic-bezier(.33,0,.2,1);pointer-events:none;}
.p-maqueta-placa.fuera{opacity:0;}
.p-maqueta-etiqueta{position:absolute;left:0;top:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .25s;margin:-44px 0 0 12px;
  display:flex;gap:8px;align-items:baseline;padding:7px 11px;background:#141414;color:#fbfbfa;font-size:12px;white-space:nowrap;}
.p-maqueta-etiqueta b{font-weight:500;letter-spacing:.06em;}
.p-sello{position:absolute;z-index:3;top:12px;right:var(--p-gutter);padding:7px 11px;border:1px solid rgba(138,98,32,.45);background:rgba(244,243,240,.85);
  color:#8A6220;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:500;pointer-events:none;}
.p-maqueta-toque{position:absolute;inset:0;z-index:2;background:transparent;border:0;padding:0;display:none;}
@media (pointer:coarse){
  .p-maqueta-toque{display:block;}
  .p-maqueta:not(.explorando) .p-maqueta-lienzo canvas{pointer-events:none;}
}
.p-maqueta-mandos{position:relative;z-index:2;display:flex;flex-direction:column;gap:14px;align-items:flex-start;
  padding:0 var(--p-gutter) calc(env(safe-area-inset-bottom) + 24px);}
.p-modos{display:flex;gap:6px;max-width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.p-modos::-webkit-scrollbar{display:none;}
.p-modos button{flex:none;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(20,20,20,.16);background:rgba(244,243,240,.8);color:#141414;
  font-size:13px;font-weight:400;transition:background .3s,color .3s,border-color .3s;}
.p-modos button:hover{border-color:rgba(20,20,20,.4);}
.p-modos button.on{background:#141414;color:#fbfbfa;border-color:#141414;}
.p-explorar-claro{color:#141414;border-color:rgba(20,20,20,.22);background:rgba(244,243,240,.72);}
.p-explorar-claro:hover{background:rgba(244,243,240,.95);border-color:rgba(20,20,20,.45);}
.p-maqueta.explorando .p-maqueta-txt,.p-maqueta.explorando .p-maqueta-dato{opacity:0;transition:opacity .4s;}
.p-maqueta.explorando .p-maqueta-grid{grid-template-rows:0 1fr auto;}

.p-ficha{position:absolute;z-index:6;left:var(--p-gutter);right:var(--p-gutter);bottom:calc(env(safe-area-inset-bottom) + 92px);background:#fbfbfa;
  border:1px solid rgba(20,20,20,.1);box-shadow:0 24px 60px -20px rgba(20,20,20,.35);padding:16px 18px 14px;animation:p-sube .6s var(--p-curva);}
.p-ficha-cab{display:flex;align-items:center;gap:12px;}
.p-ficha-id{font-size:24px;font-weight:200;letter-spacing:-.02em;}
.p-ficha-estado{display:flex;align-items:center;gap:7px;font-size:13px;color:rgba(20,20,20,.7);}
.p-ficha-estado i{width:8px;height:8px;border-radius:50%;}
.p-ficha-x{margin-left:auto;background:none;border:0;font-size:24px;font-weight:200;color:rgba(20,20,20,.55);width:40px;height:40px;}
.p-ficha-datos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0 10px;padding:12px 0 0;border-top:1px solid rgba(20,20,20,.1);}
.p-ficha-datos div{min-width:0;}
.p-ficha-datos dt{font-size:12px;color:rgba(20,20,20,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.p-ficha-datos dd{margin:3px 0 0;font-size:15px;white-space:nowrap;}
.p-ficha-nota{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8A6220;font-weight:500;}
@keyframes p-sube{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

@media (min-width:1024px){
  .p-maqueta-grid{grid-template-columns:minmax(360px,34%) 1fr;grid-template-rows:1fr auto;}
  .p-maqueta-txt{grid-row:1;grid-column:1;padding:0 clamp(24px,3vw,56px) 0 var(--p-gutter);justify-content:center;gap:20px;}
  .p-maqueta-txt .p-texto{max-width:38ch;}
  .p-maqueta-lienzo canvas,.p-maqueta-placa{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16%);mask-image:linear-gradient(90deg,transparent 0,#000 16%);}
  .p-maqueta-texto{display:block;}
  .p-maqueta-lienzo{grid-row:1 / span 2;grid-column:2;}
  .p-maqueta-mandos{grid-row:2;grid-column:1;padding:0 0 clamp(40px,8vh,96px) var(--p-gutter);}
  .p-modos{flex-wrap:wrap;}
  .p-sello{top:auto;bottom:clamp(40px,8vh,96px);right:var(--p-gutter);}
  .p-ficha{left:auto;right:var(--p-gutter);bottom:auto;top:clamp(90px,14vh,140px);width:420px;}
  .p-maqueta.explorando .p-maqueta-grid{grid-template-columns:0 1fr;}
  .p-maqueta.explorando .p-maqueta-mandos{position:absolute;left:var(--p-gutter);bottom:clamp(40px,8vh,96px);padding:0;}
}
`

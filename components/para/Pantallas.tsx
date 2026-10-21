'use client'

// Pantallas del dossier de prospección (las que no son interactivas pesadas: el
// mapa y la maqueta viven en su propio archivo). Cada una es una «diapositiva»
// de al menos 100svh dentro de una página que se recorre con scroll.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LeadPara, Textos } from '@/lib/para/textos'
import { useBloqueoScroll, useEnPantalla, useVisto } from './Presentacion'

export type AlEvento = (k: string, d?: string) => void

/** Marco común: tema, rótulo numerado y la clase «visto» que dispara las entradas. */
export function Pantalla({ id, tema, num, rotulo, className = '', children, umbral = 0.3 }: {
  id: string; tema: 'oscuro' | 'claro'; num: number; rotulo: string; className?: string; children: ReactNode; umbral?: number
}) {
  const [ref, visto] = useVisto<HTMLElement>(umbral)
  return (
    <section ref={ref} data-pantalla={id} data-tema={tema === 'claro' ? 'claro' : undefined}
      className={`p-pant p-${tema} ${className}${visto ? ' visto' : ''}`}>
      <p className="p-it p-in p-pant-rotulo">{String(num).padStart(2, '0')} · {rotulo}</p>
      {children}
    </section>
  )
}

const H = ({ children, d = '.1s' }: { children: ReactNode; d?: string }) => (
  <h2 className="p-h2"><span className="p-in-h"><span style={{ ['--d' as string]: d }}>{children}</span></span></h2>
)
const D = (s: string) => ({ ['--d' as string]: s })

// ── Vídeo: AV1 + HEVC (la mayoría de iPhone no decodifica AV1), en silencio y en
//    bucle mientras está en pantalla; el sonido, a petición.
export function VideoFP({ base, poster, className = '', nombre, alEvento, t }: {
  base: string; poster?: string; className?: string; nombre: string; alEvento?: AlEvento; t: Textos
}) {
  const [ref, dentro] = useEnPantalla<HTMLDivElement>('0px')
  const v = useRef<HTMLVideoElement>(null)
  const [sonido, setSonido] = useState(false)
  useEffect(() => {
    const el = v.current
    if (!el) return
    if (dentro) el.play().catch(() => {})
    else el.pause()
  }, [dentro])
  return (
    <div ref={ref} className={`p-video ${className}`}>
      <video ref={v} muted={!sonido} loop playsInline preload="none" poster={poster}>
        <source src={`${base}.av1.mp4`} type='video/mp4; codecs="av01.0.08M.10"' />
        <source src={`${base}.hevc.mp4`} type='video/mp4; codecs="hvc1"' />
      </video>
      <button type="button" className="p-sonido" onClick={() => {
        const n = !sonido; setSonido(n)
        if (v.current) { v.current.muted = !n; if (n) v.current.play().catch(() => {}) }
        if (n) alEvento?.('video', nombre)
      }}>
        <span aria-hidden>{sonido ? '■' : '♪'}</span>{sonido ? t.silencio : t.sonido}
      </button>
    </div>
  )
}

// ── 02 · El estudio ──────────────────────────────────────────────────────────
export function Estudio({ t, lead, num }: { t: Textos; lead: LeadPara; num: number }) {
  return (
    <Pantalla id="estudio" tema="oscuro" num={num} rotulo={t.estudioRotulo} className="p-estudio">
      <div className="p-estudio-a">
        <H>{t.estudioTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.estudioTexto}</p>
        <p className="p-nucleo p-in" style={D('.45s')}>{t.nucleo[lead.perfil]}</p>
      </div>
      <ul className="p-cifras">
        {t.estudioCifras.map((c, i) => (
          <li key={c.l} className="p-in" style={D(`${0.35 + i * 0.12}s`)}><b>{c.v}</b><span>{c.l}</span></li>
        ))}
      </ul>
    </Pantalla>
  )
}

// ── Obra seleccionada ────────────────────────────────────────────────────────
export function Obra({ t, num }: { t: Textos; num: number }) {
  return (
    <Pantalla id="obra" tema="claro" num={num} rotulo={t.obraRotulo} className="p-obrasel">
      <div className="p-cab"><H>{t.obraTitulo}</H><span className="p-desliza p-in" style={D('.4s')}>{t.desliza} →</span></div>
      <div className="p-obra-pista">
        {t.obras.map((o, i) => (
          <figure key={o.nombre} className="p-obra-ficha p-in" style={D(`${0.2 + i * 0.07}s`)}>
            <div className="p-obra-img"><img src={o.img} alt={o.nombre} loading="lazy" decoding="async" /></div>
            <figcaption><b>{o.nombre}</b><span>{o.lugar} · {o.tipo}</span></figcaption>
          </figure>
        ))}
      </div>
    </Pantalla>
  )
}

// ── Equipo ───────────────────────────────────────────────────────────────────
export function Equipo({ t, lead, num }: { t: Textos; lead: LeadPara; num: number }) {
  return (
    <Pantalla id="equipo" tema="oscuro" num={num} rotulo={t.equipoRotulo} className="p-equipo">
      <div className="p-equipo-foto p-in">
        <img src="/para/equipo/equipo-fp.webp" alt="" loading="lazy" decoding="async" />
      </div>
      <div className="p-cab"><H>{t.equipoTitulo}</H></div>
      <p className="p-texto p-in" style={D('.3s')}>{t.equipoTexto}</p>
      <ul className="p-personas">
        {t.personas.map((p, i) => (
          <li key={p.nombre} className={`p-in${p.nombre === lead.contacto.nombre ? ' contacto' : ''}`} style={D(`${0.3 + i * 0.06}s`)}>
            <img src={p.foto} alt={p.nombre} loading="lazy" decoding="async" />
            <b>{p.nombre}</b><span>{p.cargo}</span>
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}

function Puntos({ puntos, base = 0.3 }: { puntos: { t: string; d: string }[]; base?: number }) {
  return (
    <ol className="p-puntos">
      {puntos.map((p, i) => (
        <li key={p.t} className="p-in" style={D(`${base + i * 0.12}s`)}>
          <span className="p-puntos-n">{String(i + 1).padStart(2, '0')}</span>
          <b>{p.t}</b><p>{p.d}</p>
        </li>
      ))}
    </ol>
  )
}

// ── Developer · producto ─────────────────────────────────────────────────────
export function Producto({ t, num }: { t: Textos; num: number }) {
  return (
    <Pantalla id="producto" tema="claro" num={num} rotulo={t.productoRotulo} className="p-dos">
      <div className="p-dos-img p-in"><img src="/para/obra/cv-producto.webp" alt="" loading="lazy" decoding="async" /></div>
      <div className="p-dos-txt">
        <H>{t.productoTitulo}</H>
        <Puntos puntos={t.productoPuntos} />
      </div>
    </Pantalla>
  )
}

// ── Constructora · proyecto de ejecución: las láminas pasan rápido y en bucle.
//    No es para leer plano a plano: es para ver cuánto se define.
const LAMINAS = Array.from({ length: 21 }, (_, i) => `/para/laminas/cc38-${String(i + 1).padStart(2, '0')}.webp`)

function Cinta({ laminas, sentido, activa }: { laminas: string[]; sentido: 1 | -1; activa: boolean }) {
  const pista = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  useEffect(() => {
    const el = pista.current
    if (!el || anim.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const de = sentido === 1 ? '0%' : '-50%', a = sentido === 1 ? '-50%' : '0%'
    anim.current = el.animate([{ transform: `translate3d(${de},0,0)` }, { transform: `translate3d(${a},0,0)` }], { duration: 52_000, iterations: Infinity })
    anim.current.pause()
  }, [sentido])
  // Entra deprisa y se calma a velocidad de crucero; fuera de pantalla, quieta.
  useEffect(() => {
    const a = anim.current
    if (!a) return
    if (!activa) { a.pause(); return }
    a.play()
    let raf = 0
    const t0 = performance.now()
    const paso = (now: number) => {
      const k = Math.min(1, (now - t0) / 2200)
      a.playbackRate = 4 - 3 * (1 - Math.pow(1 - k, 3))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [activa])
  return (
    <div className="p-cinta" onPointerEnter={() => { if (anim.current) anim.current.playbackRate = 0.35 }} onPointerLeave={() => { if (anim.current) anim.current.playbackRate = 1 }}>
      <div ref={pista} className="p-cinta-pista">
        {[...laminas, ...laminas].map((src, i) => <img key={i} src={src} alt="" loading={i < 6 ? 'eager' : 'lazy'} decoding="async" />)}
      </div>
    </div>
  )
}

function Cuenta({ hasta, activa }: { hasta: number; activa: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!activa) return
    let raf = 0
    const t0 = performance.now()
    const paso = (now: number) => {
      const k = Math.min(1, (now - t0) / 1300)
      setN(Math.round(hasta * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [activa, hasta])
  return <>{n}</>
}

export function Ejecucion({ t, num }: { t: Textos; num: number }) {
  const [ref, dentro] = useEnPantalla<HTMLDivElement>('0px')
  const mitad = Math.ceil(LAMINAS.length / 2)
  return (
    <Pantalla id="ejecucion" tema="claro" num={num} rotulo={t.ejecucionRotulo} className="p-ejecucion">
      <div className="p-ejecucion-txt">
        <H>{t.ejecucionTitulo}</H>
        <p className="p-ejecucion-cifra p-in" style={D('.3s')}><b><Cuenta hasta={LAMINAS.length} activa={dentro} /></b>{t.ejecucionCifra}</p>
        <p className="p-texto p-in" style={D('.42s')}>{t.ejecucionTexto}</p>
      </div>
      <div ref={ref} className="p-cintas p-in" style={D('.2s')}>
        <Cinta laminas={LAMINAS.slice(0, mitad)} sentido={1} activa={dentro} />
        <Cinta laminas={LAMINAS.slice(mitad)} sentido={-1} activa={dentro} />
      </div>
      <p className="p-pie p-in" style={D('.6s')}>{t.ejecucionPie}</p>
    </Pantalla>
  )
}

// ── Portal de cliente ────────────────────────────────────────────────────────
export function Portal({ t, num, alEvento }: { t: Textos; num: number; alEvento: AlEvento }) {
  return (
    <Pantalla id="portal" tema="oscuro" num={num} rotulo={t.portalRotulo} className="p-dos p-portal">
      <div className="p-dos-txt">
        <H>{t.portalTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.portalTexto}</p>
        <ul className="p-lista">
          {t.portalPuntos.map((x, i) => <li key={x} className="p-in" style={D(`${0.4 + i * 0.08}s`)}>{x}</li>)}
        </ul>
      </div>
      <div className="p-dos-img p-in" style={D('.2s')}>
        <VideoFP base="/para/video/portal-clientes" nombre="portal" alEvento={alEvento} t={t} className="p-marco" />
      </div>
    </Pantalla>
  )
}

// ── Constructora · colaboración ──────────────────────────────────────────────
export function Colaboracion({ t, num }: { t: Textos; num: number }) {
  return (
    <Pantalla id="colaboracion" tema="claro" num={num} rotulo={t.colaboracionRotulo} className="p-dos">
      <div className="p-dos-img p-in"><img src="/para/obra/cv-arquitectura.webp" alt="" loading="lazy" decoding="async" /></div>
      <div className="p-dos-txt">
        <H>{t.colaboracionTitulo}</H>
        <Puntos puntos={t.colaboracionPuntos} />
      </div>
    </Pantalla>
  )
}

// ── Dossier digital: Casa Zurbano de verdad, dentro de un móvil. En reposo, su
//    portada; al tocar, el dossier vivo (?demo=1: se ve igual, no se mide).
export function Dossier({ t, num, alEvento }: { t: Textos; num: number; alEvento: AlEvento }) {
  const [vivo, setVivo] = useState(false)
  const [amplio, setAmplio] = useState(false)
  useBloqueoScroll(amplio)
  const abrir = () => {
    setVivo(true); alEvento('3d', 'dossier')
    if (window.matchMedia('(max-width: 700px)').matches) setAmplio(true)
  }
  return (
    <Pantalla id="dossier" tema="oscuro" num={num} rotulo={t.dossierRotulo} className={`p-dos p-dossier${amplio ? ' amplio' : ''}`}>
      <div className="p-dossier-fondo" aria-hidden><img src="/para/obra/zurbano-salon.webp" alt="" loading="lazy" /></div>
      <div className="p-dos-txt">
        <H>{t.dossierTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.dossierTexto}</p>
        <p className="p-pie p-in" style={D('.45s')}>{t.dossierPie}</p>
      </div>
      <div className="p-dos-img p-in" style={D('.2s')}>
        <div className="p-movil">
          {vivo
            ? <iframe src="/propuesta/casa-zurbano-xzw9e?demo=1" title="Casa Zurbano" loading="lazy" allow="autoplay; fullscreen" />
            : <button type="button" className="p-movil-portada" onClick={abrir}>
                <img src="/para/obra/zurbano-portada.webp" alt="Casa Zurbano" loading="lazy" />
                <span className="p-explorar"><span aria-hidden>↗</span>{t.abrirDossier}</span>
              </button>}
        </div>
      </div>
      {amplio && <button type="button" className="p-explorar p-seguir" onClick={() => setAmplio(false)}>{t.cerrar} ↓</button>}
    </Pantalla>
  )
}

// ── Realidad virtual ─────────────────────────────────────────────────────────
export function VR({ t, num, alEvento }: { t: Textos; num: number; alEvento: AlEvento }) {
  return (
    <Pantalla id="vr" tema="oscuro" num={num} rotulo={t.vrRotulo} className="p-vr">
      <VideoFP base="/para/video/visual-lab" nombre="vr" alEvento={alEvento} t={t} className="p-vr-video" />
      <div className="p-vr-txt">
        <H>{t.vrTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.vrTexto}</p>
      </div>
    </Pantalla>
  )
}

// ── Por qué Forma Prima ──────────────────────────────────────────────────────
export function Porque({ t, lead, num }: { t: Textos; lead: LeadPara; num: number }) {
  return (
    <Pantalla id="porque" tema="claro" num={num} rotulo={t.porqueRotulo} className="p-porque">
      <div className="p-cab"><H>{t.porqueTitulo}</H></div>
      <Puntos puntos={t.porque[lead.perfil]} base={0.25} />
    </Pantalla>
  )
}

// ── Cierre. La fase 4 añade aquí la agenda viva (días 6–10 desde la apertura).
export function Hablemos({ t, lead, num, alEvento }: { t: Textos; lead: LeadPara; num: number; alEvento: AlEvento }) {
  const c = lead.contacto
  const asunto = encodeURIComponent(`${lead.empresa} × Forma Prima`)
  return (
    <Pantalla id="hablemos" tema="oscuro" num={num} rotulo={t.hablemosRotulo} className="p-hablemos">
      <div className="p-hablemos-a">
        <h2 className="p-h1-cierre"><span className="p-in-h"><span style={D('.1s')}>{t.hablemosTitulo(lead.nombre)}</span></span></h2>
        <span className="p-raya p-in" style={D('.3s')} aria-hidden />
        <p className="p-texto p-in" style={D('.4s')}>{t.hablemosTexto(lead.empresa)}</p>
      </div>
      <div className="p-contacto p-in" style={D('.5s')}>
        {c.foto && <img src={c.foto} alt={c.nombre} loading="lazy" />}
        <div>
          <b>{c.nombre}</b><span>{c.cargo}</span>
          <a href={`mailto:${c.email}?subject=${asunto}`} className="p-boton" onClick={() => alEvento('interes', 'correo')}>{t.escribir} {c.nombre.split(' ')[0]}</a>
          <a href="https://formaprima.es" target="_blank" rel="noopener" className="p-enlace" onClick={() => alEvento('enlace', 'web')}>{t.web} →</a>
        </div>
      </div>
    </Pantalla>
  )
}

export const CSS_PANTALLAS = `
.p-pant{position:relative;min-height:100svh;padding:calc(env(safe-area-inset-top) + 84px) var(--p-gutter) calc(env(safe-area-inset-bottom) + 56px);
  display:flex;flex-direction:column;gap:22px;overflow:hidden;}
.p-oscuro{background:var(--p-negro);color:var(--p-blanco);}
.p-claro{background:var(--p-papel);color:var(--p-tinta);}
.p-claro .p-it{color:#4f6556;}
.p-claro .p-texto{color:rgba(20,20,20,.68);}
.p-pant-rotulo{margin-bottom:-4px!important;position:relative;z-index:2;}
.p-cab{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;}
.p-desliza{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;color:rgba(20,20,20,.55);white-space:nowrap;}
.p-pie{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:500;color:rgba(20,20,20,.5);}
.p-oscuro .p-pie{color:rgba(251,251,250,.55);}
.p-raya{display:block;width:44px;height:1px;background:currentColor;opacity:.45;}

/* Estudio */
.p-estudio{justify-content:center;}
.p-estudio-a{display:flex;flex-direction:column;gap:20px;}
.p-estudio .p-h2{max-width:18ch;}
.p-nucleo{font-family:'Newsreader',serif;font-style:italic;font-size:clamp(18px,1rem + .6vw,24px);line-height:1.45;color:var(--p-blanco);
  border-left:1px solid var(--p-salvia);padding-left:18px;max-width:36ch;}
.p-cifras{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:0;}
.p-cifras li{display:flex;align-items:baseline;gap:16px;padding:16px 0;border-top:1px solid rgba(251,251,250,.14);}
.p-cifras b{font-weight:200;font-size:clamp(40px,1.6rem + 3vw,72px);letter-spacing:-.03em;min-width:2.2ch;line-height:1;}
.p-cifras span{font-size:14px;color:rgba(251,251,250,.66);line-height:1.4;}

/* Obra (p-obra es el punto del mapa: otro nombre) */
.p-obrasel{justify-content:center;}
.p-obra-pista{display:grid;grid-auto-flow:column;grid-auto-columns:78%;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:var(--p-gutter);margin:8px calc(var(--p-gutter) * -1) 0;
  padding:0 var(--p-gutter) 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.p-obra-pista::-webkit-scrollbar{display:none;}
.p-obra-ficha{margin:0;scroll-snap-align:start;}
.p-obra-img{aspect-ratio:4/5;overflow:hidden;background:#e6e3dc;}
.p-obra-img img{width:100%;height:100%;object-fit:cover;transition:transform 1.4s var(--p-curva);}
.p-obra-ficha:hover .p-obra-img img{transform:scale(1.04);}
.p-obra-ficha figcaption{display:flex;flex-direction:column;gap:3px;padding-top:12px;}
.p-obra-ficha b{font-weight:400;font-size:16px;}
.p-obra-ficha span{font-size:13px;color:rgba(20,20,20,.55);}

/* Equipo */
.p-equipo-foto{margin:0 calc(var(--p-gutter) * -1) 4px;aspect-ratio:16/10;overflow:hidden;}
.p-equipo-foto img{width:100%;height:100%;object-fit:cover;filter:grayscale(1);}
.p-personas{list-style:none;margin:6px calc(var(--p-gutter) * -1) 0;padding:0 var(--p-gutter);scroll-padding-inline:var(--p-gutter);display:grid;grid-auto-flow:column;grid-auto-columns:40%;gap:12px;
  overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;}
.p-personas::-webkit-scrollbar{display:none;}
.p-personas li{scroll-snap-align:start;display:flex;flex-direction:column;gap:3px;}
.p-personas img{aspect-ratio:3/4;width:100%;object-fit:cover;filter:grayscale(1);margin-bottom:8px;}
.p-personas b{font-weight:400;font-size:14px;}
.p-personas span{font-size:12px;color:rgba(251,251,250,.6);line-height:1.35;}
.p-personas li.contacto b::after{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--p-salvia);margin-left:8px;vertical-align:2px;}

/* Dos columnas (imagen + texto) */
.p-dos{justify-content:center;}
.p-dos-txt{display:flex;flex-direction:column;gap:18px;position:relative;z-index:1;}
.p-dos-img{position:relative;z-index:1;}
.p-dos-img>img{width:100%;max-height:44svh;object-fit:cover;}
.p-puntos{list-style:none;margin:6px 0 0;padding:0;display:grid;}
.p-puntos li{display:grid;grid-template-columns:auto 1fr;column-gap:16px;padding:16px 0;border-top:1px solid rgba(20,20,20,.12);}
.p-oscuro .p-puntos li{border-color:rgba(251,251,250,.14);}
.p-puntos-n{grid-row:span 2;font-size:12px;font-weight:500;letter-spacing:.1em;color:#4f6556;padding-top:4px;}
.p-oscuro .p-puntos-n{color:var(--p-salvia);}
.p-puntos b{font-weight:400;font-size:clamp(18px,1rem + .4vw,22px);letter-spacing:-.01em;}
.p-puntos p{font-size:14.5px;line-height:1.55;color:rgba(20,20,20,.66);margin-top:4px;max-width:46ch;}
.p-oscuro .p-puntos p{color:rgba(251,251,250,.66);}
.p-lista{list-style:none;margin:4px 0 0;padding:0;}
.p-lista li{padding:12px 0;border-top:1px solid rgba(251,251,250,.14);font-size:15px;}

/* Ejecución */
.p-ejecucion{justify-content:center;gap:20px;}
.p-ejecucion-txt{display:flex;flex-direction:column;gap:14px;}
.p-ejecucion-cifra{display:flex;align-items:baseline;gap:12px;font-size:15px;color:rgba(20,20,20,.7);}
.p-ejecucion-cifra b{font-weight:200;font-size:clamp(56px,2rem + 4vw,104px);letter-spacing:-.04em;color:#141414;line-height:.9;font-variant-numeric:tabular-nums;min-width:2ch;}
.p-cintas{display:grid;gap:12px;margin:0 calc(var(--p-gutter) * -1);}
.p-cinta{overflow:hidden;}
.p-cinta-pista{display:flex;gap:12px;width:max-content;will-change:transform;}
.p-cinta-pista img{height:clamp(150px,24svh,250px);width:auto;aspect-ratio:1400/1151;background:#fff;box-shadow:0 14px 34px -18px rgba(20,20,20,.35);}

/* Vídeo */
.p-video{position:relative;}
.p-video video{display:block;width:100%;height:100%;object-fit:cover;background:#141414;}
.p-sonido{position:absolute;left:14px;bottom:14px;z-index:2;display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 14px;border-radius:999px;
  border:1px solid rgba(251,251,250,.3);background:rgba(13,13,13,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fbfbfa;
  font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:500;}
.p-marco{aspect-ratio:16/10;border-radius:10px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.7);border:1px solid rgba(251,251,250,.1);}

/* Dossier digital */
.p-dossier-fondo{position:absolute;inset:0;}
.p-dossier-fondo img{width:100%;height:100%;object-fit:cover;filter:blur(24px) brightness(.32) saturate(1.1);transform:scale(1.15);}
.p-movil{position:relative;margin:0 auto;width:min(300px,72vw);aspect-ratio:9/19.3;border-radius:44px;padding:10px;background:#0b0b0b;
  box-shadow:0 0 0 1px rgba(251,251,250,.16),0 50px 100px -30px rgba(0,0,0,.8);}
.p-movil::before{content:'';position:absolute;top:18px;left:50%;transform:translateX(-50%);width:84px;height:22px;border-radius:12px;background:#0b0b0b;z-index:2;}
.p-movil iframe,.p-movil-portada{display:block;width:100%;height:100%;border:0;border-radius:34px;overflow:hidden;background:#f6f1ea;}
.p-movil-portada{position:relative;padding:0;cursor:pointer;}
.p-movil-portada img{width:100%;height:100%;object-fit:cover;}
.p-movil-portada .p-explorar{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);white-space:nowrap;color:#2b2622;background:rgba(246,241,234,.85);border-color:rgba(43,38,34,.25);}
.p-dossier.amplio{position:fixed;inset:0;z-index:80;min-height:0;height:100%;padding:0;}
.p-dossier.amplio .p-dos-txt{display:none;}
.p-dossier.amplio .p-dos-img{flex:1;display:flex;}
.p-dossier.amplio .p-movil{width:100%;height:100%;aspect-ratio:auto;border-radius:0;padding:0;box-shadow:none;}
.p-dossier.amplio .p-movil::before{display:none;}
.p-dossier.amplio .p-movil iframe{border-radius:0;}
.p-dossier.amplio .p-seguir{position:fixed;}

/* Realidad virtual */
.p-vr{padding:0;justify-content:flex-end;}
.p-vr .p-pant-rotulo{position:absolute;top:calc(env(safe-area-inset-top) + 84px);left:var(--p-gutter);right:calc(var(--p-gutter) + 170px);z-index:2;}
.p-vr-video{position:absolute;inset:0;}
.p-vr-video::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(13,13,13,.55) 0%,rgba(13,13,13,0) 30%,rgba(13,13,13,0) 45%,rgba(13,13,13,.92) 100%);}
.p-vr-video .p-sonido{left:auto;right:var(--p-gutter);bottom:auto;top:calc(env(safe-area-inset-top) + 74px);}
.p-vr-txt{position:relative;z-index:2;display:flex;flex-direction:column;gap:16px;padding:0 var(--p-gutter) calc(env(safe-area-inset-bottom) + 56px);}

/* Por qué */
.p-porque{justify-content:center;}

/* Cierre */
.p-hablemos{justify-content:center;gap:40px;}
.p-hablemos-a{display:flex;flex-direction:column;gap:22px;}
.p-h1-cierre{font-size:clamp(46px,1.4rem + 6vw,104px);line-height:1;}
.p-contacto{display:flex;gap:18px;align-items:flex-start;padding-top:26px;border-top:1px solid rgba(251,251,250,.14);}
.p-contacto img{width:88px;aspect-ratio:3/4;object-fit:cover;filter:grayscale(1);}
.p-contacto div{display:flex;flex-direction:column;gap:4px;}
.p-contacto b{font-weight:400;font-size:18px;}
.p-contacto span{font-size:13px;color:rgba(251,251,250,.6);margin-bottom:12px;}
.p-boton{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;background:var(--p-blanco);color:var(--p-negro);
  font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;text-decoration:none;align-self:flex-start;}
.p-enlace{font-size:13px;color:var(--p-salvia);text-decoration:none;margin-top:10px;}

@media (min-width:1024px){
  .p-pant{padding:clamp(96px,12vh,140px) var(--p-gutter) clamp(56px,9vh,104px);gap:28px;}
  .p-estudio{display:grid;grid-template-columns:1.2fr 1fr;column-gap:clamp(40px,6vw,120px);align-content:center;}
  .p-estudio .p-pant-rotulo{grid-column:1 / -1;}
  .p-cifras{margin:0;align-self:center;}
  .p-obra-pista{grid-auto-flow:row;grid-template-columns:repeat(3,1fr);grid-auto-columns:auto;overflow:visible;margin:8px 0 0;padding:0;gap:22px;}
  .p-obra-img{aspect-ratio:16/11;}
  .p-desliza{display:none;}
  .p-equipo{display:grid;grid-template-columns:1fr 1fr;column-gap:56px;align-content:center;}
  .p-equipo .p-pant-rotulo{grid-column:1 / -1;}
  .p-equipo-foto{grid-row:2 / span 2;grid-column:2;margin:0;aspect-ratio:4/3;}
  .p-equipo .p-cab{grid-column:1;align-self:end;}
  .p-equipo .p-texto{grid-column:1;align-self:start;}
  .p-personas{grid-column:1 / -1;grid-auto-flow:row;grid-template-columns:repeat(7,1fr);grid-auto-columns:auto;overflow:visible;margin:12px 0 0;padding:0;}
  .p-dos{display:grid;grid-template-columns:1fr 1fr;column-gap:clamp(40px,6vw,112px);align-content:center;align-items:center;}
  .p-dos .p-pant-rotulo{grid-column:1 / -1;}
  .p-dos-img>img{max-height:66svh;}
  .p-portal .p-dos-txt{order:0;}
  .p-ejecucion{display:grid;grid-template-columns:minmax(340px,.8fr) 1.6fr;column-gap:48px;align-content:center;align-items:center;}
  .p-ejecucion .p-pant-rotulo{grid-column:1 / -1;}
  .p-cintas{margin:0 calc(var(--p-gutter) * -1) 0 0;}
  .p-ejecucion .p-pie{grid-column:1 / -1;}
  .p-cinta-pista img{height:clamp(200px,27svh,300px);}
  .p-movil{width:min(330px,24vw);}
  .p-porque .p-puntos{grid-template-columns:repeat(3,1fr);column-gap:40px;}
  .p-porque .p-puntos li{grid-template-columns:1fr;row-gap:10px;padding-top:24px;}
  .p-porque .p-puntos-n{grid-row:auto;}
  .p-hablemos{display:grid;grid-template-columns:1.3fr 1fr;column-gap:80px;align-content:center;align-items:end;}
  .p-hablemos .p-pant-rotulo{grid-column:1 / -1;}
  .p-contacto{border-top:0;border-left:1px solid rgba(251,251,250,.14);padding:0 0 0 40px;}
  .p-contacto img{width:120px;}
  .p-vr{padding:0;}
  .p-vr-txt{max-width:780px;padding-bottom:clamp(56px,9vh,104px);}
  .p-vr .p-pant-rotulo{top:clamp(96px,12vh,140px);}
}
`

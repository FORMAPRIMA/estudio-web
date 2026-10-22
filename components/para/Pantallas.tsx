'use client'

// Pantallas del dossier de prospección (las que no son interactivas pesadas: el
// mapa y la maqueta viven en su propio archivo). Cada una es una «diapositiva»
// de al menos 100svh dentro de una página que se recorre con scroll.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LeadPara, Textos } from '@/lib/para/textos'
import { useBloqueoScroll, useEnPantalla, useVisto } from './Presentacion'
import Agenda, { CSS_AGENDA, type EstadoAgendaCliente } from './Agenda'
import PortalDemo, { CSS_PORTAL_DEMO } from './PortalDemo'
import Cifra from './Cifra'
import type { Idioma } from '@/lib/para/textos'

export type AlEvento = (k: string, d?: string) => void

/** Marco común: tema, rótulo numerado y la clase «visto» que dispara las entradas. */
export function Pantalla({ id, tema, num, rotulo, className = '', children, umbral = 0.6 }: {
  id: string; tema: 'oscuro' | 'claro'; num: number; rotulo: string; className?: string; children: ReactNode; umbral?: number
}) {
  const [ref, visto] = useVisto<HTMLElement>(umbral)
  return (
    <section ref={ref} data-pantalla={id} data-tema={tema === 'claro' ? 'claro' : undefined}
      className={`p-pant p-${tema} ${className}${visto ? ' visto' : ''}`}>
      <Rotulo num={num} texto={rotulo} />
      {children}
    </section>
  )
}

/** Rótulo de sección: el número pequeño y el nombre de la sección bien visible. */
export const Rotulo = ({ num, texto, className = '' }: { num: number; texto: string; className?: string }) => (
  <p className={`p-rotulo-sec p-in p-pant-rotulo ${className}`}><span className="p-rotulo-n">{String(num).padStart(2, '0')}</span>{texto}</p>
)

const H = ({ children, d = '.1s' }: { children: ReactNode; d?: string }) => (
  <h2 className="p-h2"><span className="p-in-h"><span style={{ ['--d' as string]: d }}>{children}</span></span></h2>
)
const D = (s: string) => ({ ['--d' as string]: s })

// ── Vídeo: AV1 + HEVC (la mayoría de iPhone no decodifica AV1). Nunca arranca
//    solo: se ve su fotograma de portada con un botón de play; al pulsarlo empieza
//    DESDE EL PRINCIPIO y con sonido. Al salir de la pantalla se para y vuelve a la
//    portada, así que al volver se puede ver entero otra vez.
export function VideoFP({ base, segundos, className = '', nombre, alEvento, t }: {
  base: string; segundos: number; className?: string; nombre: string; alEvento?: AlEvento; t: Textos
}) {
  const [ref, dentro] = useEnPantalla<HTMLDivElement>('0px')
  const v = useRef<HTMLVideoElement>(null)
  const [fase, setFase] = useState<'portada' | 'play' | 'pausa'>('portada')
  const [mudo, setMudo] = useState(false)
  const [avance, setAvance] = useState(0)
  useEffect(() => {
    if (dentro || fase === 'portada') return
    const el = v.current
    if (el) { el.pause(); el.currentTime = 0 }
    setFase('portada'); setAvance(0)
  }, [dentro, fase])
  const empezar = () => {
    const el = v.current
    if (!el) return
    el.currentTime = 0; el.muted = false; setMudo(false)
    el.play().then(() => setFase('play')).catch(() => { el.muted = true; setMudo(true); el.play().then(() => setFase('play')).catch(() => {}) })
    alEvento?.('video', nombre)
  }
  const alternar = () => {
    const el = v.current
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setFase('play') } else { el.pause(); setFase('pausa') }
  }
  return (
    <div ref={ref} className={`p-video ${className}`} data-fase={fase}>
      <video ref={v} playsInline preload="none" poster={`${base}-portada.webp`}
        onTimeUpdate={(e) => { const el = e.currentTarget; if (el.duration) setAvance(el.currentTime / el.duration) }}
        onEnded={() => { setFase('portada'); setAvance(0) }} onClick={fase !== 'portada' ? alternar : undefined}>
        <source src={`${base}.av1.mp4`} type='video/mp4; codecs="av01.0.08M.10"' />
        <source src={`${base}.hevc.mp4`} type='video/mp4; codecs="hvc1"' />
      </video>
      {fase === 'portada' && (
        <button type="button" className="p-play" onClick={empezar} aria-label={t.verVideo}>
          <span className="p-play-boton" aria-hidden><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
          <span className="p-play-txt">{t.verVideo}<small>{segundos} s · {t.conSonido}</small></span>
        </button>
      )}
      {fase !== 'portada' && (
        <div className="p-video-mandos">
          <button type="button" onClick={alternar} aria-label={fase === 'play' ? t.pausa : t.seguirVideo}>{fase === 'play' ? '❚❚' : '▶'}</button>
          <span className="p-video-barra"><i style={{ width: `${avance * 100}%` }} /></span>
          <button type="button" onClick={() => { const el = v.current; if (!el) return; el.muted = !el.muted; setMudo(el.muted) }}>{mudo ? t.sonido : t.silencio}</button>
        </div>
      )}
    </div>
  )
}

/** Bucle de fondo: mudo, tenue, solo mientras la pantalla está a la vista. */
function FondoVideo({ base }: { base: string }) {
  const [ref, dentro] = useEnPantalla<HTMLDivElement>('0px')
  const v = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = v.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (dentro) el.play().catch(() => {}); else el.pause()
  }, [dentro])
  return (
    <div ref={ref} className="p-fondo-video" aria-hidden>
      <video ref={v} muted loop playsInline preload="none">
        <source src={`${base}.av1.mp4`} type='video/mp4; codecs="av01.0.08M.10"' />
        <source src={`${base}.hevc.mp4`} type='video/mp4; codecs="hvc1"' />
      </video>
    </div>
  )
}

/** Pantalla de vídeo: titular arriba y el vídeo enmarcado en 16:9 (nunca recortado). */
function PantallaVideo({ id, t, num, rotulo, titulo, texto, base, segundos, alEvento, fondo }: {
  id: string; t: Textos; num: number; rotulo: string; titulo: string; texto: string; base: string; segundos: number; alEvento: AlEvento
  /** Bucle mudo y tenue de fondo (no es «el» vídeo: ese sigue esperando su play). */
  fondo?: string
}) {
  return (
    <Pantalla id={id} tema="oscuro" num={num} rotulo={rotulo} className="p-pvideo">
      {fondo && <FondoVideo base={fondo} />}
      <div className="p-pvideo-txt">
        <H>{titulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{texto}</p>
      </div>
      <div className="p-in" style={D('.2s')}>
        <VideoFP base={base} segundos={segundos} nombre={id} alEvento={alEvento} t={t} className="p-marco" />
      </div>
    </Pantalla>
  )
}

// ── 02 · El estudio ──────────────────────────────────────────────────────────
export function Estudio({ t, lead, num }: { t: Textos; lead: LeadPara; num: number }) {
  const [ref, dentro] = useEnPantalla<HTMLUListElement>('0px')
  return (
    <Pantalla id="estudio" tema="oscuro" num={num} rotulo={t.estudioRotulo} className="p-estudio">
      <div className="p-estudio-a">
        <H>{t.estudioTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.estudioTexto}</p>
        <p className="p-nucleo p-in" style={D('.45s')}>{t.nucleo[lead.perfil]}</p>
      </div>
      <ul ref={ref} className="p-cifras">
        {t.estudioCifras.map((c, i) => (
          <li key={c.l} className="p-in" style={D(`${0.35 + i * 0.12}s`)}><b><Cifra texto={c.v} activa={dentro} retraso={0.45 + i * 0.12} /></b><span>{c.l}</span></li>
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
      <div className="p-personas p-in" style={D('.3s')}>
        <ul className="p-personas-pista">
          {[...t.personas, ...t.personas].map((p, i) => (
            <li key={i} className={`${p.nombre === lead.contacto.nombre ? 'contacto' : ''}${i >= t.personas.length ? ' p-copia' : ''}`} aria-hidden={i >= t.personas.length || undefined}>
              <img src={p.foto} alt={p.nombre} loading="lazy" decoding="async" />
              <b>{p.nombre}</b><span>{p.cargo}</span>
            </li>
          ))}
        </ul>
      </div>
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
    <Pantalla id="producto" tema="claro" num={num} rotulo={t.productoRotulo} className="p-dos p-producto">
      <div className="p-dos-img p-in">
        <div className="p-tipologias" aria-hidden>
          {['a', 'b', 'c', 'd'].map((x, i) => <img key={x} src={`/para/obra/producto-${x}.webp`} alt="" loading="lazy" decoding="async" style={{ animationDelay: `${i * 2.6}s` }} />)}
        </div>
      </div>
      <div className="p-dos-txt">
        <H>{t.productoTitulo}</H>
        <p className="p-acompana p-in" style={D('.25s')}>{t.acompanamos.developer}</p>
        <Puntos puntos={t.productoPuntos} />
      </div>
    </Pantalla>
  )
}

// ── FP Visual Lab: qué es y qué herramientas hace (antes de los ejemplos)
export function VisualLab({ t, num }: { t: Textos; num: number }) {
  return (
    <Pantalla id="visuallab" tema="oscuro" num={num} rotulo={t.vlRotulo} className="p-vl">
      <div className="p-vl-fondo" aria-hidden><img src="/para/obra/cv-visuallab.webp" alt="" loading="lazy" /></div>
      <div className="p-vl-txt">
        <H>{t.vlTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.vlTexto}</p>
      </div>
      <ol className="p-vl-lista">
        {t.vlHerramientas.map((h, i) => (
          <li key={h.t} className="p-in" style={D(`${0.35 + i * 0.09}s`)}>
            <span>{String(i + 1).padStart(2, '0')}</span><b>{h.t}</b><p>{h.d}</p>
          </li>
        ))}
      </ol>
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
    anim.current = el.animate([{ transform: `translate3d(${de},0,0)` }, { transform: `translate3d(${a},0,0)` }], { duration: 20_000, iterations: Infinity })
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

export function Ejecucion({ t, num }: { t: Textos; num: number }) {
  const [ref, dentro] = useEnPantalla<HTMLDivElement>('0px')
  const mitad = Math.ceil(LAMINAS.length / 2)
  return (
    <Pantalla id="ejecucion" tema="claro" num={num} rotulo={t.ejecucionRotulo} className="p-ejecucion">
      <div className="p-ejecucion-txt">
        <H>{t.ejecucionTitulo}</H>
        <p className="p-acompana p-in" style={D('.3s')}>{t.ejecucionTexto}</p>
      </div>
      <div ref={ref} className="p-cintas p-in" style={D('.2s')}>
        <Cinta laminas={LAMINAS.slice(0, mitad)} sentido={1} activa={dentro} />
        <Cinta laminas={LAMINAS.slice(mitad)} sentido={-1} activa={dentro} />
      </div>
      <p className="p-pie p-in" style={D('.6s')}>{t.ejecucionPie}</p>
    </Pantalla>
  )
}

// ── Portal de cliente: una obra de ejemplo que se puede tocar (el vídeo, en la pantalla siguiente).
export function Portal({ t, idioma, num, alEvento }: { t: Textos; idioma: Idioma; num: number; alEvento: AlEvento }) {
  return (
    <Pantalla id="portal" tema="oscuro" num={num} rotulo={t.portalRotulo} className="p-dos p-portal">
      <div className="p-dos-txt">
        <H>{t.portalTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.portalTexto}</p>
        <ul className="p-lista">
          {t.portalPuntos.map((x, i) => <li key={x} className="p-in" style={D(`${0.4 + i * 0.08}s`)}>{x}</li>)}
        </ul>
      </div>
      <div className="p-dos-img p-in" style={D('.2s')}><PortalDemo idioma={idioma} alEvento={alEvento} /></div>
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
        <p className="p-acompana p-in" style={D('.25s')}>{t.acompanamos.constructora}</p>
        <Puntos puntos={t.colaboracionPuntos} />
      </div>
    </Pantalla>
  )
}

// ── Dossier digital: Casa Zurbano como ejemplo, en un móvil. El ejemplo se abre en
//    su propia pestaña (dentro de este dossier pesaba demasiado). ?demo=1: no se mide.
export function Dossier({ t, num, alEvento }: { t: Textos; num: number; alEvento: AlEvento }) {
  return (
    <Pantalla id="dossier" tema="oscuro" num={num} rotulo={t.dossierRotulo} className="p-dos p-dossier">
      <div className="p-dossier-fondo" aria-hidden><img src="/para/obra/zurbano-salon.webp" alt="" loading="lazy" /></div>
      <div className="p-dos-txt">
        <H>{t.dossierTitulo}</H>
        <p className="p-texto p-in" style={D('.3s')}>{t.dossierTexto}</p>
        <p className="p-pie p-in" style={D('.45s')}>{t.dossierPie}</p>
        <a className="p-explorar p-explorar-grande p-in" style={D('.55s')} href="/propuesta/casa-zurbano-xzw9e?demo=1" target="_blank" rel="noopener" onClick={() => alEvento('enlace', 'dossier-zurbano')}>
          {t.abrirDossier} <span aria-hidden>↗</span>
        </a>
      </div>
      <div className="p-dos-img p-in" style={D('.2s')}>
        <a className="p-movil" href="/propuesta/casa-zurbano-xzw9e?demo=1" target="_blank" rel="noopener" onClick={() => alEvento('enlace', 'dossier-zurbano')} aria-label={t.abrirDossier}>
          <span className="p-movil-portada"><img src="/para/obra/zurbano-portada.webp" alt="Casa Zurbano" loading="lazy" /></span>
        </a>
      </div>
    </Pantalla>
  )
}

// ── Realidad virtual y portal en vídeo ──────────────────────────────────────
export function VR({ t, num, alEvento }: { t: Textos; num: number; alEvento: AlEvento }) {
  return <PantallaVideo id="vr" t={t} num={num} rotulo={t.vrRotulo} titulo={t.vrTitulo} texto={t.vrTexto} base="/para/video/visual-lab" segundos={36} alEvento={alEvento} fondo="/para/video/vr-fondo" />
}
export function PortalVideo({ t, num, alEvento }: { t: Textos; num: number; alEvento: AlEvento }) {
  return <PantallaVideo id="portalvideo" t={t} num={num} rotulo={t.portalRotulo} titulo={t.portalTitulo} texto={t.portalTexto} base="/para/video/portal-clientes" segundos={42} alEvento={alEvento} />
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

// ── Cierre: la agenda viva (días laborables 6–10 desde hoy) y quien lo firma.
export function Hablemos({ t, idioma, lead, num, alEvento, agenda, token }: {
  t: Textos; idioma: Idioma; lead: LeadPara; num: number; alEvento: AlEvento; agenda: EstadoAgendaCliente; token: string | null
}) {
  const c = lead.contacto
  const asunto = encodeURIComponent(`${lead.empresa} × Forma Prima`)
  return (
    <Pantalla id="hablemos" tema="oscuro" num={num} rotulo={t.hablemosRotulo} className="p-hablemos">
      <div className="p-hablemos-a">
        <h2 className="p-h1-cierre"><span className="p-in-h"><span style={D('.1s')}>{t.hablemosTitulo(lead.nombre)}</span></span></h2>
        <span className="p-raya p-in" style={D('.3s')} aria-hidden />
        <p className="p-texto p-in" style={D('.4s')}>{t.hablemosTexto(lead.empresa)}</p>
        <div className="p-contacto p-in" style={D('.5s')}>
          {c.foto && <img src={c.foto} alt={c.nombre} loading="lazy" />}
          <div>
            <b>{c.nombre}</b><span>{c.cargo}</span>
            <a href={`mailto:${c.email}?subject=${asunto}`} className="p-enlace" onClick={() => alEvento('enlace', 'correo')}>{c.email}</a>
            <a href="https://formaprima.es" target="_blank" rel="noopener" className="p-enlace" onClick={() => alEvento('enlace', 'web')}>{t.web} →</a>
          </div>
        </div>
      </div>
      <div className="p-in" style={D('.45s')}>
        <Agenda t={t} idioma={idioma} lead={lead} estado={agenda} token={token} alEvento={alEvento} />
      </div>
    </Pantalla>
  )
}

export const CSS_PANTALLAS = CSS_AGENDA + CSS_PORTAL_DEMO + `
.p-sensor{position:absolute;inset:0;pointer-events:none;}
.p-pant{position:relative;padding:calc(env(safe-area-inset-top) + 84px) var(--p-gutter) calc(env(safe-area-inset-bottom) + 56px);
  display:flex;flex-direction:column;gap:22px;overflow:hidden;}
.p-oscuro{background:var(--p-negro);color:var(--p-blanco);}
.p-claro{background:var(--p-papel);color:var(--p-tinta);}
.p-claro .p-it{color:#4f6556;}
.p-claro .p-texto{color:rgba(20,20,20,.68);}
.p-pant-rotulo{margin-bottom:-4px!important;position:relative;z-index:2;}
.p-rotulo-sec{display:flex;align-items:baseline;gap:12px;font-family:'Newsreader',serif;font-style:italic;font-weight:400;
  font-size:clamp(20px,1rem + .9vw,30px);line-height:1.15;color:var(--p-salvia);}
.p-claro .p-rotulo-sec{color:#4f6556;}
.p-rotulo-n{font-family:'Hanken Grotesk',sans-serif;font-style:normal;font-size:12px;font-weight:500;letter-spacing:.14em;opacity:.8;
  padding:3px 7px;border:1px solid currentColor;border-radius:999px;transform:translateY(-3px);}
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
.p-cifras li>span{font-size:14px;color:rgba(251,251,250,.66);line-height:1.4;}

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
.p-personas{margin:6px calc(var(--p-gutter) * -1) 0;overflow:hidden;}
.p-personas-pista{list-style:none;margin:0;padding:0 0 0 var(--p-gutter);display:flex;gap:12px;width:max-content;animation:p-cinta-equipo 46s linear infinite;}
.p-personas:active .p-personas-pista,.p-personas:hover .p-personas-pista{animation-play-state:paused;}
@keyframes p-cinta-equipo{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(-50% - 6px),0,0)}}
.p-personas li{flex:none;width:38vw;max-width:220px;display:flex;flex-direction:column;gap:3px;}
.p-personas img{aspect-ratio:3/4;width:100%;object-fit:cover;filter:grayscale(1);margin-bottom:8px;transform:scale(1.03);transform-origin:50% 0;}
.p-personas li{overflow:hidden;}
@media (prefers-reduced-motion:reduce){.p-personas{overflow-x:auto;}.p-personas-pista{animation:none;}.p-copia{display:none!important;}}
/* Producto en móvil: una tipología cada vez */
.p-tipologias{display:none;position:relative;height:36svh;}
.p-tipologias img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;opacity:0;animation:p-tipologia 10.4s ease-in-out infinite;}
@keyframes p-tipologia{0%{opacity:0;transform:scale(.97)}6%,25%{opacity:1;transform:none}31%,100%{opacity:0;transform:scale(1.02)}}
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

/* Vídeo: portada con play; nunca arranca solo */
.p-video{position:relative;background:#141414;}
.p-video video{display:block;width:100%;height:100%;object-fit:cover;background:#141414;}
.p-marco{aspect-ratio:16/9;border-radius:10px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.7);border:1px solid rgba(251,251,250,.1);}
.p-play{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border:0;padding:0;
  background:radial-gradient(ellipse at center,rgba(13,13,13,.55) 0%,rgba(13,13,13,.25) 60%,rgba(13,13,13,.4) 100%);color:#fbfbfa;cursor:pointer;}
@media (max-width:700px){.p-play-txt small{display:none;}.p-play{gap:10px;}}
.p-play-boton{width:clamp(64px,7vw,92px);height:clamp(64px,7vw,92px);border-radius:50%;display:grid;place-items:center;background:rgba(251,251,250,.92);color:#0d0d0d;
  box-shadow:0 18px 40px -12px rgba(0,0,0,.6);transition:transform .5s var(--p-curva),background .3s;}
.p-play-boton svg{width:40%;height:40%;margin-left:6%;}
.p-play:hover .p-play-boton{transform:scale(1.07);background:#fff;}
.p-play-txt{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;text-shadow:0 2px 12px rgba(0,0,0,.5);}
.p-play-txt small{font-size:12px;letter-spacing:.08em;text-transform:none;font-weight:400;opacity:.8;}
.p-video-mandos{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;align-items:center;gap:12px;padding:12px 14px;
  background:linear-gradient(0deg,rgba(13,13,13,.75),rgba(13,13,13,0));opacity:0;transition:opacity .4s;}
.p-video:hover .p-video-mandos,.p-video[data-fase="pausa"] .p-video-mandos{opacity:1;}
@media (pointer:coarse){.p-video-mandos{opacity:1;}}
.p-video-mandos button{flex:none;min-height:36px;min-width:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(251,251,250,.3);background:rgba(13,13,13,.5);
  color:#fbfbfa;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:500;}
.p-video-barra{flex:1;height:3px;background:rgba(251,251,250,.25);border-radius:2px;overflow:hidden;}
.p-video-barra i{display:block;height:100%;background:#fbfbfa;}

/* Pantalla de vídeo */
.p-pvideo{justify-content:center;}
.p-pvideo-txt{display:flex;flex-direction:column;gap:14px;position:relative;z-index:1;}
.p-pvideo>.p-in{position:relative;z-index:1;}
.p-fondo-video{position:absolute;inset:0;overflow:hidden;}
.p-fondo-video video{width:100%;height:100%;object-fit:cover;opacity:.32;filter:saturate(.8);transform:scale(1.04);}
.p-fondo-video::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,13,13,.7) 0%,rgba(13,13,13,.35) 45%,rgba(13,13,13,.85) 100%);}

/* Frase de acompañamiento (producto / colaboración) */
.p-acompana{font-family:'Newsreader',serif;font-style:italic;font-size:clamp(18px,1rem + .6vw,24px);line-height:1.4;color:#2f4238;border-left:1px solid #2f4238;padding-left:16px;max-width:34ch;}

/* FP Visual Lab */
.p-vl{justify-content:center;}
.p-vl-fondo{position:absolute;inset:0;overflow:hidden;}
.p-vl-fondo img{width:100%;height:100%;object-fit:cover;object-position:70% 30%;opacity:.28;filter:grayscale(.3);}
.p-vl-fondo::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,13,13,.92) 0%,rgba(13,13,13,.6) 55%,rgba(13,13,13,.35) 100%);}
.p-vl-txt{position:relative;z-index:1;display:flex;flex-direction:column;gap:14px;}
.p-vl-lista{position:relative;z-index:1;list-style:none;margin:6px 0 0;padding:0;display:grid;}
.p-vl-lista li{display:grid;grid-template-columns:34px 1fr;column-gap:12px;padding:11px 0;border-top:1px solid rgba(251,251,250,.14);}
.p-vl-lista span{grid-row:span 2;font-size:12px;font-weight:500;letter-spacing:.1em;color:var(--p-salvia);padding-top:4px;}
.p-vl-lista b{font-weight:400;font-size:clamp(17px,1rem + .35vw,21px);}
.p-vl-lista p{font-size:13.5px;color:rgba(251,251,250,.62);margin-top:2px;}

/* Botón de exploración grande, que late para invitar */
.p-explorar-grande{min-height:54px;padding:0 26px;font-size:13px;align-self:flex-start;text-decoration:none;position:relative;}
.p-explorar-grande::after{content:'';position:absolute;inset:-1px;border-radius:999px;border:1px solid currentColor;opacity:0;animation:p-late 2.4s ease-out infinite 1.5s;pointer-events:none;}
@keyframes p-late{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.18,1.5);opacity:0}}

/* Dossier digital */
.p-dossier-fondo{position:absolute;inset:0;overflow:hidden;}
.p-dossier-fondo img{width:100%;height:100%;object-fit:cover;filter:blur(24px) brightness(.32) saturate(1.1);transform:scale(1.15);}
.p-movil{position:relative;margin:0 auto;height:min(48svh,600px);width:auto;aspect-ratio:9/19.3;max-width:80vw;border-radius:40px;padding:9px;background:#0b0b0b;
  box-shadow:0 0 0 1px rgba(251,251,250,.16),0 50px 100px -30px rgba(0,0,0,.8);}
.p-movil::before{content:'';position:absolute;top:18px;left:50%;transform:translateX(-50%);width:84px;height:22px;border-radius:12px;background:#0b0b0b;z-index:2;}
.p-movil iframe,.p-movil-portada{display:block;width:100%;height:100%;border:0;border-radius:34px;overflow:hidden;background:#f6f1ea;}
.p-movil-portada{position:relative;padding:0;cursor:pointer;display:block;}
.p-movil-portada img{animation:p-desliza-movil 16s ease-in-out infinite alternate;}
@keyframes p-desliza-movil{from{transform:scale(1.02) translateY(0)}to{transform:scale(1.12) translateY(-4%)}}
.p-movil{display:block;}
.p-movil-portada img{width:100%;height:100%;object-fit:cover;}
.p-movil-portada .p-explorar{position:absolute;left:10px;right:10px;bottom:22px;justify-content:center;white-space:nowrap;padding:0 10px;min-height:40px;font-size:11px;letter-spacing:.12em;color:#2b2622;background:rgba(246,241,234,.88);border-color:rgba(43,38,34,.25);}
.p-dossier.amplio{position:fixed;inset:0;z-index:80;min-height:0;height:100%;padding:0;}
.p-dossier.amplio .p-dos-txt{display:none;}
.p-dossier.amplio .p-dos-img{flex:1;display:flex;}
.p-dossier.amplio .p-movil{width:100%;height:100%;aspect-ratio:auto;border-radius:0;padding:0;box-shadow:none;}
.p-dossier.amplio .p-movil::before{display:none;}
.p-dossier.amplio .p-movil iframe{border-radius:0;}
.p-dossier.amplio .p-seguir{position:fixed;}

/* Por qué */
.p-porque{justify-content:center;}

/* Cierre */
.p-hablemos{justify-content:center;gap:40px;}
.p-hablemos-a{display:flex;flex-direction:column;gap:22px;}
.p-h1-cierre{font-size:clamp(46px,1.4rem + 6vw,104px);line-height:1;}
.p-contacto{display:flex;gap:16px;align-items:flex-start;margin-top:8px;}
.p-contacto img{width:64px;aspect-ratio:3/4;object-fit:cover;filter:grayscale(1);}
.p-contacto div{display:flex;flex-direction:column;gap:4px;}
.p-contacto b{font-weight:400;font-size:18px;}
.p-contacto span{font-size:13px;color:rgba(251,251,250,.6);margin-bottom:6px;}
.p-boton{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;background:var(--p-blanco);color:var(--p-negro);
  font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;text-decoration:none;align-self:flex-start;}
.p-enlace{font-size:13px;color:var(--p-salvia);text-decoration:none;margin-top:4px;}

/* Pantallas bajas: menos aire para que todo quepa en una pantalla */
@media (max-height:760px){
  .p-puntos li{padding:10px 0;}
  .p-acompana{font-size:17px;}
  .p-pant{padding-top:calc(env(safe-area-inset-top) + 66px);padding-bottom:calc(env(safe-area-inset-bottom) + 28px);gap:14px;}
  .p-h2{font-size:clamp(28px,1.2rem + 2.2vw,46px);}
  .p-cifras li{padding:10px 0;}
  .p-cifras b{font-size:clamp(34px,1.4rem + 2.4vw,56px);}
  .p-cinta-pista img{height:clamp(120px,19svh,210px);}
  .p-ejecucion-cifra b{font-size:clamp(48px,1.6rem + 3vw,80px);}
  .p-h1-cierre{font-size:clamp(38px,1.2rem + 4.4vw,80px);}
}
@media (max-width:1023px){
  .p-movil{height:min(44svh,520px);}
  .p-dos-img>img{max-height:28svh;}
  .p-producto .p-tipologias{display:block;}
  .p-producto .p-puntos p{display:none;}
  .p-puntos li{padding:12px 0;}
  .p-puntos p{font-size:14px;margin-top:2px;}
  .p-portal .p-lista{display:none;}
  .p-portal .p-pd{min-height:0;height:min(54svh,480px);}
  .p-portal .p-pd-cuerpo{overflow-y:auto;}
}
@media (max-width:700px){
  .p-movil{height:min(38svh,460px);}
  .p-dossier .p-explorar-grande{min-height:46px;}
  .p-cinta-pista img{height:clamp(120px,20svh,200px);}
  .p-equipo-foto{aspect-ratio:2/1;}
  .p-personas img{aspect-ratio:4/5;}
  .p-dossier .p-pie{display:none;}
  .p-hablemos{gap:18px;}
  .p-hablemos .p-raya{display:none;}
  .p-hablemos .p-contacto img{display:none;}
  .p-hablemos .p-contacto{margin-top:0;}
}
@media (max-width:700px) and (max-height:760px){
  .p-tipologias{height:26svh;}
  .p-personas li{width:31vw;}
  .p-movil{height:30svh;}
  .p-dossier .p-texto{font-size:14px;}
  .p-vl-lista p{display:none;}
  .p-vl-lista li{padding:8px 0;}
  .p-dos-img>img{max-height:20svh;}
  .p-puntos li{padding:9px 0;}
  .p-puntos p{display:none;}
  .p-equipo-foto{aspect-ratio:16/7;}
  .p-personas{grid-auto-columns:34%;}
  .p-hablemos .p-hablemos-a>.p-texto{display:none;}
  .p-estudio .p-nucleo{font-size:16px;}
}
@media (min-width:1024px){
  .p-pant{padding:clamp(96px,12vh,140px) var(--p-gutter) clamp(56px,9vh,104px);gap:28px;}
  .p-estudio{display:grid;grid-template-columns:1.2fr 1fr;column-gap:clamp(40px,6vw,120px);align-content:center;}
  .p-estudio .p-pant-rotulo{grid-column:1 / -1;}
  .p-cifras{margin:0;align-self:center;}
  .p-obra-pista{grid-auto-flow:row;grid-template-columns:repeat(3,1fr);grid-auto-columns:auto;overflow:visible;margin:8px 0 0;padding:0;gap:22px;}
  .p-obra-img{aspect-ratio:auto;height:calc((100svh - 500px) / 2);max-height:250px;min-height:110px;}
  .p-desliza{display:none;}
  .p-equipo{display:grid;grid-template-columns:1fr 1fr;column-gap:56px;align-content:center;}
  .p-equipo .p-pant-rotulo{grid-column:1 / -1;}
  .p-equipo-foto{grid-row:2 / span 2;grid-column:2;margin:0;aspect-ratio:auto;height:min(28svh,340px);align-self:center;}
  .p-equipo .p-cab{grid-column:1;align-self:end;}
  .p-equipo .p-texto{grid-column:1;align-self:start;}
  .p-personas{grid-column:1 / -1;margin:12px 0 0;overflow:visible;}
  .p-personas-pista{display:grid;grid-template-columns:repeat(7,1fr);width:auto;padding:0;animation:none;}
  .p-personas li{width:auto;max-width:none;}
  .p-personas img{aspect-ratio:auto;height:min(28svh,320px);}
  .p-copia{display:none!important;}
  .p-dos{display:grid;grid-template-columns:1fr 1fr;column-gap:clamp(40px,6vw,112px);align-content:center;align-items:center;}
  .p-dos .p-pant-rotulo{grid-column:1 / -1;}
  .p-vl{display:grid;grid-template-columns:1fr 1fr;column-gap:clamp(48px,6vw,112px);align-content:center;align-items:center;}
  .p-vl .p-pant-rotulo{grid-column:1 / -1;}
  .p-dos-img>img{max-height:66svh;}
  /* en escritorio, las cuatro tipologías a la vez y grandes (recortadas, sin el blanco del original) */
  .p-producto .p-tipologias{display:grid;grid-template-columns:1fr 1fr;gap:clamp(16px,2vw,32px);height:auto;}
  .p-producto .p-tipologias img{position:static;opacity:1;animation:none;width:100%;height:calc((100svh - 330px) / 2);max-height:360px;object-fit:contain;}
  .p-portal .p-dos-txt{order:0;}
  .p-ejecucion{display:grid;grid-template-columns:minmax(340px,.8fr) 1.6fr;column-gap:48px;align-content:center;align-items:center;}
  .p-ejecucion .p-pant-rotulo{grid-column:1 / -1;}
  .p-cintas{margin:0 calc(var(--p-gutter) * -1) 0 0;}
  .p-ejecucion .p-pie{grid-column:1 / -1;}
  .p-cinta-pista img{height:clamp(200px,27svh,300px);}
  .p-movil{height:min(68svh,700px);}
  .p-porque .p-puntos{grid-template-columns:repeat(3,1fr);column-gap:40px;}
  .p-porque .p-puntos li{grid-template-columns:1fr;row-gap:10px;padding-top:24px;}
  .p-porque .p-puntos-n{grid-row:auto;}
  .p-hablemos{display:grid;grid-template-columns:1fr 1fr;column-gap:clamp(48px,6vw,112px);align-content:center;align-items:start;}
  .p-hablemos .p-pant-rotulo{grid-column:1 / -1;}
  .p-hablemos .p-agenda{border-top:0;border-left:1px solid rgba(251,251,250,.14);padding:4px 0 0 clamp(32px,3vw,56px);}
  .p-agenda-dias{margin:0;padding:0;flex-wrap:wrap;}
  .p-pvideo{display:grid;grid-template-columns:minmax(300px,.7fr) 1.6fr;column-gap:clamp(40px,5vw,96px);align-content:center;align-items:center;}
  .p-pvideo .p-pant-rotulo{grid-column:1 / -1;}
}
`

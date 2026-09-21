'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { site, display } from '../theme'
import { Img } from '../Img'
import { useVariantes } from '../AssetsProvider'
import { urlWebm } from '@/lib/web-publica/imagenes'

/**
 * La primera pantalla de una capacidad: su vídeo explicativo.
 *
 * Arranca en PÓSTER, no en reproducción. Un vídeo explicativo no es la intro de
 * la Home: aquella es atmósfera y se puede lanzar sola en silencio, esta es una
 * pieza con voz que dura minutos, y soltarla encima de quien acaba de llegar es
 * ruido. Así que se ve un fotograma a pantalla completa con el nombre encima, y
 * el play es una decisión.
 *
 * Los controles son propios y no los del navegador. Los nativos traen su propia
 * estética —barras opacas, iconos de sistema, tipografías ajenas— y aquí romperían
 * la página entera. Lo que hace falta es poco: parar, silenciar, saber por dónde
 * va y poder saltar a otro punto.
 */

const PALABRAS = {
  es: { ver: 'Reproducir', pausa: 'Pausa', seguir: 'Seguir', silencio: 'Silenciar', sonido: 'Sonido', baja: 'Desliza' },
  en: { ver: 'Play', pausa: 'Pause', seguir: 'Resume', silencio: 'Mute', sonido: 'Sound', baja: 'Scroll' },
} as const

/** mm:ss. Las piezas del estudio no llegan a la hora. */
function reloj(s: number) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function ToolVideo({ videoUrl, posterUrl, nombre, eyebrow, tagline, locale, indice, conBarra = true }: {
  videoUrl: string | null
  posterUrl: string | null
  nombre: string
  eyebrow: string
  tagline: string
  locale: 'es' | 'en'
  indice: string
  /** Si arriba hay barra de capacidades. Con una sola capacidad no se pinta, y
   *  entonces la ventana recupera esos píxeles en vez de dejar una franja muerta. */
  conBarra?: boolean
}) {
  const t = PALABRAS[locale]
  const varVideo = useVariantes(videoUrl)
  const webmUrl = videoUrl && varVideo ? urlWebm(videoUrl, varVideo) : null

  const videoRef = useRef<HTMLVideoElement>(null)
  const barraRef = useRef<HTMLDivElement>(null)
  /** Ha empezado alguna vez: es lo que retira el póster y el título. */
  const [arrancado, setArrancado] = useState(false)
  const [sonando, setSonando] = useState(false)
  const [mudo, setMudo] = useState(false)
  const [t0, setT0] = useState(0)
  const [dur, setDur] = useState(0)
  /** Los controles se esconden solos mientras corre y nadie mueve el ratón. */
  const [ocioso, setOcioso] = useState(false)
  const reloj0 = useRef(0)
  /** El aviso de bajar se retira al primer scroll: a partir de ahí ya sobra. */
  const [bajado, setBajado] = useState(false)

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 40) setBajado(true) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const despertar = useCallback(() => {
    setOcioso(false)
    window.clearTimeout(reloj0.current)
    reloj0.current = window.setTimeout(() => setOcioso(true), 2600)
  }, [])

  useEffect(() => () => window.clearTimeout(reloj0.current), [])

  const arrancar = () => {
    const v = videoRef.current
    if (!v) return
    setArrancado(true)
    // Con sonido desde el primer fotograma: este play ES el gesto del visitante,
    // así que ningún navegador lo bloquea. La intro de la Home tiene que pelear
    // con el autoplay; aquí no hay nada que pelear.
    v.muted = false
    setMudo(false)
    v.play().catch(() => {
      // Si aun así lo rechaza (política agresiva, ahorro de datos), se cae a
      // silencio antes que quedarse con un fotograma congelado.
      v.muted = true
      setMudo(true)
      v.play().catch(() => {})
    })
    despertar()
  }

  const alternar = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
    despertar()
  }

  const silenciar = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMudo(v.muted)
    despertar()
  }

  /** Saltar a un punto. La barra es fina, así que el área sensible es la fila
   *  entera y no el pelo de un píxel: se pincha con el ratón, no con pinzas. */
  const saltar = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    const caja = barraRef.current?.getBoundingClientRect()
    if (!v || !caja || !dur) return
    v.currentTime = Math.max(0, Math.min(dur, ((e.clientX - caja.left) / caja.width) * dur))
    despertar()
  }

  const progreso = dur ? (t0 / dur) * 100 : 0
  const hayVideo = !!videoUrl

  return (
    <section className="ft-hero" onMouseMove={arrancado ? despertar : undefined}
      style={{
        position: 'relative', width: '100%', overflow: 'hidden',
        background: site.color.stage, color: site.color.white,
        ...(conBarra ? null : { ['--ft-tope' as string]: '72px' }),
      }}>

      {/* El vídeo. Está en el DOM desde el principio —con `preload="metadata"`, que
          son unos kilobytes— para que el play sea instantáneo y no un compás de
          espera con la pantalla ya en negro. */}
      {hayVideo && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video ref={videoRef} playsInline preload="metadata"
          poster={posterUrl || undefined}
          onClick={arrancado ? alternar : undefined}
          onPlay={() => { setSonando(true); setArrancado(true) }}
          onPause={() => { setSonando(false); setOcioso(false) }}
          onTimeUpdate={(e) => setT0(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onEnded={(e) => { e.currentTarget.currentTime = 0; setSonando(false); setOcioso(false) }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            cursor: arrancado ? 'pointer' : 'default',
            opacity: arrancado ? 1 : 0, transition: `opacity 1.1s ${site.ease}`,
          }}>
          {webmUrl && <source src={webmUrl} type="video/webm" />}
          <source src={videoUrl!} type="video/mp4" />
        </video>
      )}

      {/* El póster, como imagen de verdad y no como atributo `poster`: así pasa por
          la escalera de variantes y no se sirve el original de varios megas para
          un fotograma. Se funde al arrancar en vez de desaparecer de golpe. */}
      {posterUrl && (
        <div aria-hidden={arrancado || undefined} style={{
          position: 'absolute', inset: 0,
          opacity: arrancado ? 0 : 1, transition: `opacity 1.1s ${site.ease}`,
          pointerEvents: 'none',
        }}>
          <Img src={posterUrl} alt="" contexto="hero" prioridad
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Veladura. El título va en blanco sobre un fotograma que no controlamos:
          sin esta base, un plano claro se lo come. Más densa abajo, que es donde
          vive el texto, y casi limpia en el centro para no ensuciar la imagen. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(13,13,13,.78) 0%, rgba(13,13,13,.34) 34%, rgba(13,13,13,.06) 62%, rgba(13,13,13,.34) 100%)',
        opacity: arrancado ? 0 : 1, transition: `opacity 1.1s ${site.ease}`,
      }} />

      {/* ── Estado de reposo: identidad y play ─────────────────────────────── */}
      <div className="ft-hero-cara" aria-hidden={arrancado || undefined} style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: `0 ${site.gutter} clamp(46px, 9vh, 96px)`,
        opacity: arrancado ? 0 : 1,
        transform: arrancado ? 'translateY(-14px)' : 'translateY(0)',
        transition: `opacity .8s ${site.ease}, transform 1.1s ${site.ease}`,
        pointerEvents: arrancado ? 'none' : 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: site.maxWidth, margin: '0 auto' }}>
          <div className="ft-hero-fila">
            <div style={{ minWidth: 0 }}>
              <p className="ft-anim" style={{ margin: 0, fontSize: 10.5, letterSpacing: site.track.ultra, textTransform: 'uppercase', opacity: 0.6 }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{indice}</span>
                <span style={{ margin: '0 12px', opacity: 0.5 }}>·</span>
                {eyebrow}
              </p>
              {/* `display.hero`, el token del sitio, y no una escala propia. Tuvo
                  una —hasta 74 px— y era exactamente lo que theme.ts ya daba por
                  descartado: aquí el protagonista es la pieza, y el nombre
                  acompaña. */}
              <h1 className="ft-anim ft-d1" style={{ margin: '14px 0 0', fontSize: display.hero, fontWeight: 300, lineHeight: 1.18, letterSpacing: '-0.005em', maxWidth: '20ch' }}>
                {nombre}
              </h1>
              {tagline && (
                <p className="ft-anim ft-d2" style={{ margin: '18px 0 0', fontSize: 'clamp(0.95rem, 1.4vw, 1.2rem)', fontWeight: 300, lineHeight: 1.55, opacity: 0.74, maxWidth: '46ch' }}>
                  {tagline}
                </p>
              )}
            </div>

            {hayVideo && (
              <div className="ft-anim ft-d3">
                <button type="button" className="ft-play" data-cursor="" onClick={arrancar}
                  aria-label={`${t.ver} — ${nombre}`}>
                  <span className="ft-play-disco" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5 L17.5 12 L9 17.5 Z" fill="currentColor" /></svg>
                  </span>
                  <span className="ft-play-lbl">{t.ver}{dur ? ` · ${reloj(dur)}` : ''}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Controles, solo mientras la pieza corre ────────────────────────── */}
      {hayVideo && (
        <div className="ft-ctrl" data-ocioso={arrancado && sonando && ocioso ? '1' : undefined}
          aria-hidden={!arrancado || undefined}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3,
            padding: `56px ${site.gutter} clamp(26px, 4vh, 40px)`,
            background: 'linear-gradient(to top, rgba(13,13,13,.72), rgba(13,13,13,0))',
            opacity: arrancado ? 1 : 0,
            pointerEvents: arrancado ? 'auto' : 'none',
            transition: `opacity .5s ${site.ease}`,
          }}>
          <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
            {/* La barra: un pelo de luz sobre otro apagado. Toda la fila es
                pinchable, aunque solo se vea el filete. */}
            <div ref={barraRef} className="ft-barra" onClick={saltar} role="presentation">
              <span className="ft-barra-pista" />
              <span className="ft-barra-ido" style={{ transform: `scaleX(${progreso / 100})` }} />
            </div>
            <div className="ft-ctrl-fila">
              <button type="button" className="ft-ctrl-btn" data-cursor="" onClick={alternar}>
                {sonando ? t.pausa : t.seguir}
              </button>
              <button type="button" className="ft-ctrl-btn" data-cursor="" onClick={silenciar}>
                {mudo ? t.sonido : t.silencio}
              </button>
              <span className="ft-ctrl-t">{reloj(t0)} / {reloj(dur)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de que la página sigue. Desaparece al primer scroll y no vuelve. */}
      <div aria-hidden="true" className="ft-baja" data-ido={bajado || arrancado ? '1' : undefined}>
        <span className="ft-baja-lbl">{t.baja}</span>
        <span className="ft-baja-linea" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </section>
  )
}

const CSS = `
/* ── El alto de la ventana ──────────────────────────────────────────────────
   Ni 100dvh ni una proporción fija: lo que queda de pantalla por debajo del
   isotipo y de la barra de capacidades. Con 100dvh el vídeo empezaba en el tope
   del documento y esos 124 px de arriba quedaban tapados — se perdía justo la
   parte alta del encuadre, que en una pieza explicativa suele ser donde está el
   título. Así la ventana abre pegada a la barra y cierra en el canto inferior de
   la pantalla: se ve entera y sigue diciendo que hay más abajo.

   En variable CSS para que el alto de la barra y este cálculo no se separen: son
   el mismo número escrito una vez. */
.ft-hero { --ft-tope: 124px; height: calc(100dvh - var(--ft-tope)); }
@media (max-width: 760px) { .ft-hero { --ft-tope: 120px; } }

/* Entrada escalonada de la identidad, con el mismo desenfoque que se disipa que
   usa Reveal en el resto del sitio. Aquí no se usa el componente porque estos
   elementos ya están en pantalla al cargar: no hay nada que observar. */
.ft-anim { animation: ft-sube 1.05s cubic-bezier(.16,1,.3,1) both; }
.ft-d1 { animation-delay: .1s; }
.ft-d2 { animation-delay: .2s; }
.ft-d3 { animation-delay: .32s; }
@keyframes ft-sube {
  from { opacity: 0; transform: translateY(26px); filter: blur(7px); }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
}

.ft-hero-fila {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: clamp(24px, 5vw, 72px); flex-wrap: wrap;
}

/* ── Play ──────────────────────────────────────────────────────────────────
   Un disco de filete y una etiqueta al lado. El disco se rellena de dentro
   hacia fuera al pasar el cursor —un pseudo-elemento que escala, no un cambio
   de fondo— para que la transición sea de composición y no de repintado. */
.ft-play {
  display: inline-flex; align-items: center; gap: 16px;
  background: none; border: none; padding: 8px 0; cursor: pointer;
  font-family: inherit; color: inherit; white-space: nowrap;
}
.ft-play-disco {
  position: relative; flex: none;
  width: 62px; height: 62px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.55);
  display: inline-flex; align-items: center; justify-content: center;
  transition: border-color .5s cubic-bezier(.22,1,.36,1);
}
.ft-play-disco::before {
  content: ''; position: absolute; inset: -1px; border-radius: 50%;
  background: #fff; transform: scale(0); opacity: 0;
  transition: transform .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;
}
.ft-play-disco svg {
  position: relative; width: 17px; height: 17px;
  /* El triángulo no está centrado en su caja: su masa cae a la izquierda del
     centro geométrico, así que se empuja para que el ojo lo vea centrado. */
  margin-left: 3px;
  transition: color .45s ease;
}
.ft-play:hover .ft-play-disco { border-color: #fff; }
.ft-play:hover .ft-play-disco::before { transform: scale(1); opacity: 1; }
.ft-play:hover .ft-play-disco svg { color: #0D0D0D; }
.ft-play:focus-visible .ft-play-disco { outline: 1px solid #fff; outline-offset: 4px; }
.ft-play-lbl {
  font-size: 10.5px; letter-spacing: .26em; text-transform: uppercase;
  opacity: .72; transition: opacity .35s ease;
}
.ft-play:hover .ft-play-lbl { opacity: 1; }

/* ── Controles ─────────────────────────────────────────────────────────── */
.ft-ctrl[data-ocioso="1"] { opacity: 0 !important; }
.ft-barra { position: relative; height: 22px; display: flex; align-items: center; cursor: pointer; }
.ft-barra-pista, .ft-barra-ido {
  position: absolute; left: 0; right: 0; height: 1px; border-radius: 1px;
}
.ft-barra-pista { background: rgba(255,255,255,.22); }
.ft-barra-ido {
  background: #fff; transform-origin: left center;
  /* Sin transición: timeupdate llega cuatro veces por segundo y una transición
     encima lo convertiría en un arrastre perezoso. */
}
.ft-barra:hover .ft-barra-pista, .ft-barra:hover .ft-barra-ido { height: 2px; }

.ft-ctrl-fila { display: flex; align-items: center; gap: 26px; margin-top: 10px; }
.ft-ctrl-btn {
  background: none; border: none; padding: 4px 0; cursor: pointer; font-family: inherit;
  color: #fff; font-size: 10px; letter-spacing: .26em; text-transform: uppercase;
  opacity: .62; transition: opacity .3s ease;
}
.ft-ctrl-btn:hover, .ft-ctrl-btn:focus-visible { opacity: 1; }
.ft-ctrl-t {
  margin-left: auto; font-size: 10px; letter-spacing: .08em; opacity: .45;
  font-variant-numeric: tabular-nums;
}

/* ── Aviso de scroll ───────────────────────────────────────────────────── */
.ft-baja {
  position: absolute; z-index: 2; right: clamp(20px, 5vw, 80px); bottom: clamp(46px, 9vh, 96px);
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: #fff; pointer-events: none;
  opacity: .5; transition: opacity .6s ease;
  animation: ft-respira 3.2s ease-in-out infinite;
}
.ft-baja[data-ido="1"] { opacity: 0; animation: none; }
.ft-baja-lbl { font-size: 9px; letter-spacing: .34em; text-transform: uppercase; writing-mode: vertical-rl; }
.ft-baja-linea { display: block; width: 1px; height: 46px; background: currentColor; opacity: .5; }
@keyframes ft-respira { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }

/* En móvil el play baja debajo del título: en una columna estrecha, a la derecha
   del nombre no cabe sin partir la palabra. Y la pista de scroll sobra: ahí el
   gesto de deslizar no hay que enseñárselo a nadie. */
@media (max-width: 760px) {
  .ft-hero-fila { flex-direction: column; align-items: flex-start; gap: 30px; }
  .ft-baja { display: none; }
  .ft-play-disco { width: 54px; height: 54px; }
}

@media (prefers-reduced-motion: reduce) {
  .ft-anim { animation: none; }
  .ft-baja { animation: none; }
  .ft-play-disco, .ft-play-disco::before, .ft-play-disco svg { transition: none; }
}
`

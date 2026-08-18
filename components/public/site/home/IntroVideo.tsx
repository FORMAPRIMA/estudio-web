'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { site } from '../theme'
import { pick, esNo, type ContentMap } from '@/lib/web-publica'
import { useVariantes } from '../AssetsProvider'
import { urlWebm, urlVariante } from '@/lib/web-publica/imagenes'

// useLayoutEffect avisa por consola al renderizar en servidor; en SSR no hay nada
// que medir, así que allí cae a useEffect (que tampoco se ejecuta).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Vídeo de intro a pantalla completa, con sonido.
//
// El límite de partida: NINGÚN navegador deja arrancar con audio en la primera
// visita. Chrome solo lo permite si el dominio acumula "media engagement" previo y
// Safari en iOS no lo permite nunca sin un gesto. Así que el objetivo no es
// autoplay con sonido — es que activarlo cueste UN gesto y que casi nadie se lo
// pierda. De ahí las decisiones:
//
//  · Un clic o toque EN CUALQUIER PARTE de la pantalla activa el sonido. Es lo
//    primero que hace cualquiera ante un vídeo a pantalla completa, así que la
//    conversión es altísima. El doble clic sigue siendo entrar, y funciona en los
//    dos estados: nadie se queda atrapado.
//  · El desmuteo ocurre DENTRO del handler, de forma sincrónica. iOS solo lo
//    permite en la misma pila de llamada del gesto: cualquier setTimeout (por
//    ejemplo para distinguir un toque de dos) lo bloquearía.
//  · La invitación no aparece hasta que el vídeo está de verdad reproduciéndose,
//    para no invitar sobre un póster congelado.
//  · Si ya activaste el sonido antes, en la siguiente visita intentamos arrancar
//    con audio directamente. Si el navegador lo rechaza, caemos a silencio sin que
//    se note. En la primera visita jamás: soltar audio a quien no lo pidió es
//    hostil (y la WCAG 1.4.2 exige un control si suena solo más de 3 s — el botón
//    de silenciar del estado activo es ese control).

const RECUERDO = 'fp_intro_sound'
const VISTA = 'fp_intro_seen'

export function IntroVideo({ content, locale, mobile }: { content: ContentMap; locale: 'es' | 'en'; mobile: boolean }) {
  const activo = pick(content, 'intro', 'activo', { locale, mobile })
  const videoUrl = pick(content, 'intro', 'video', { locale, mobile })
  const poster = pick(content, 'intro', 'poster', { locale, mobile })
  // Variante AV1 del vídeo, si está registrada. La escalera de imagen no
  // aplica a vídeo: aquí solo interesa saber si existe el WebM hermano.
  const varVideo = useVariantes(videoUrl)
  const webmUrl = varVideo ? urlWebm(videoUrl, varVideo) : null

  // El póster es el único sitio del sitio donde no se puede usar <picture>: el
  // atributo `poster` acepta UNA url y sin srcset. Así que se elige a mano el
  // peldaño de 1920 —suficiente para un fotograma a pantalla completa, y se
  // sustituye por el vídeo en cuanto arranca— en vez de servir el original de
  // 0,85 MB. WebP y no AVIF porque algún Safari antiguo aún no decodifica AVIF
  // en `poster` y quedarse sin póster se ve como un fogonazo negro.
  const varPoster = useVariantes(poster)
  const posterUrl = varPoster && varPoster.webp.length
    ? urlVariante(poster, varPoster.stem, Math.min(...varPoster.webp.filter((w) => w >= 1080)) || Math.max(...varPoster.webp), 'webp')
    : poster
  // Si hay vídeo subido, se reproduce salvo que el interruptor diga "no".
  const enabled = !!videoUrl && !esNo(activo)
  // El sonido se puede desactivar por CMS sin tocar el vídeo.
  const ofreceSonido = !esNo(pick(content, 'intro', 'sonido', { locale, mobile }))

  // Arranca visible en el primer render (también en el HTML del servidor): si
  // esperásemos al efecto, la primera pintura serían las imágenes widescreen.
  const [show, setShow] = useState(enabled)
  const [fading, setFading] = useState(false)
  const [sonando, setSonando] = useState(false)
  const [listo, setListo] = useState(false)
  const [avisoSilencio, setAvisoSilencio] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const lastTap = useRef(0)
  const rampa = useRef(0)
  const tapDesde = useRef<{ x: number; y: number } | null>(null)

  // Si ya se vio en esta pestaña hay que retirarlo ANTES de pintar, o asoma un
  // fogonazo negro al volver a la Home.
  useIsoLayoutEffect(() => {
    if (!enabled) return
    if (sessionStorage.getItem(VISTA)) setShow(false)
  }, [enabled])

  // Intento oportunista de arrancar ya con sonido, solo para quien lo activó antes.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !enabled || !ofreceSonido) return
    let recuerda = false
    try { recuerda = localStorage.getItem(RECUERDO) === '1' } catch {}
    if (!recuerda) return

    v.muted = false
    v.play().then(() => setSonando(true)).catch(() => {
      // Rechazado: el navegador no da permiso todavía. Volvemos a silencio y que
      // el visitante lo active con un gesto, como en la primera visita.
      v.muted = true
      v.play().catch(() => {})
    })
  }, [enabled, ofreceSonido])

  useEffect(() => () => cancelAnimationFrame(rampa.current), [])

  // Mientras la intro está en pantalla, el amago que enciende la navegación
  // (SiteNav) tiene que callarse: el overlay está encima y abrir el menú detrás
  // de un vídeo a pantalla completa no significa nada. Una bandera en <html> en
  // vez de estado compartido: son dos componentes hermanos y no hay más que
  // decirse que esto.
  useEffect(() => {
    const root = document.documentElement
    if (enabled && show) root.dataset.fpIntro = '1'
    else delete root.dataset.fpIntro
    return () => { delete root.dataset.fpIntro }
  }, [enabled, show])

  // Red de seguridad: si el vídeo no ha arrancado en 6 s (conexión mala, archivo
  // que no carga), nos quitamos de en medio. La invitación solo aparece cuando el
  // vídeo corre de verdad, así que sin esto el visitante se quedaría ante un negro
  // sin ninguna pista de que se puede salir con doble clic.
  useEffect(() => {
    if (!enabled || !show || listo) return
    const id = setTimeout(() => dismiss(), 6000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, show, listo])

  /** Sube el volumen de 0 a 1 en ~700 ms. Ojo: en iOS `volume` es de solo
   *  lectura, así que allí el audio entra directo a tope — es lo que hay. */
  const entrarVolumen = (v: HTMLVideoElement) => {
    const t0 = performance.now()
    const paso = (ahora: number) => {
      const p = Math.min(1, (ahora - t0) / 700)
      v.volume = p * p            // curva suave, sin golpe inicial
      if (p < 1) rampa.current = requestAnimationFrame(paso)
    }
    rampa.current = requestAnimationFrame(paso)
  }

  /** SINCRÓNICO y dentro del gesto: es el único momento en que iOS lo permite. */
  const activarSonido = () => {
    const v = videoRef.current
    if (!v || sonando || !ofreceSonido) return
    v.volume = 0
    v.muted = false
    v.play().catch(() => {})
    entrarVolumen(v)
    setSonando(true)
    try { localStorage.setItem(RECUERDO, '1') } catch {}
    // En táctil el interruptor de silencio del teléfono manda sobre el vídeo:
    // quien lo tenga puesto tocaría y no oiría nada, y pensaría que está roto.
    if (mobile || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      setAvisoSilencio(true)
      setTimeout(() => setAvisoSilencio(false), 5200)
    }
  }

  const silenciar = () => {
    const v = videoRef.current
    if (!v) return
    cancelAnimationFrame(rampa.current)
    v.muted = true
    setSonando(false)
    try { localStorage.setItem(RECUERDO, '0') } catch {}
  }

  const dismiss = () => {
    const v = videoRef.current
    // El audio baja en paralelo al fundido de la imagen: cortarlo en seco
    // estropea el final de la pieza.
    if (v && sonando) {
      cancelAnimationFrame(rampa.current)
      const desde = v.volume || 1
      const t0 = performance.now()
      const bajar = (ahora: number) => {
        const p = Math.min(1, (ahora - t0) / 620)
        v.volume = desde * (1 - p)
        if (p < 1) rampa.current = requestAnimationFrame(bajar)
        else v.muted = true
      }
      rampa.current = requestAnimationFrame(bajar)
    }
    setFading(true)
    sessionStorage.setItem(VISTA, '1')
    setTimeout(() => setShow(false), 700)
  }

  // Doble tap en táctil (dos toques < 320 ms). El primer toque ya activó el
  // sonido vía onClick, así que aquí solo queda saltar.
  //
  // Un arrastre NO cuenta como toque: ahora que el documento está bloqueado, el
  // dedo que barre la pantalla ya no scrollea nada, y sin este filtro dos barridos
  // seguidos se leerían como doble toque y saltarían la pieza sin querer.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    tapDesde.current = t ? { x: t.clientX, y: t.clientY } : null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const desde = tapDesde.current
    const t = e.changedTouches[0]
    tapDesde.current = null
    if (desde && t && Math.hypot(t.clientX - desde.x, t.clientY - desde.y) > 10) return
    const now = Date.now()
    if (now - lastTap.current < 320) dismiss()
    lastTap.current = now
  }

  if (!enabled || !show) return null

  const t = (es: string, en: string) => (locale === 'en' ? en : es)
  // "Saltar", no "entrar": el vídeo termina solo y se funde, así que el gesto es
  // un atajo, no la única puerta.
  const gesto = mobile
    ? { toque: t('Toca para escuchar', 'Tap for sound'), entrar: t('Doble toque para saltar', 'Double tap to skip') }
    : { toque: t('Clic para escuchar', 'Click for sound'), entrar: t('Doble clic para saltar', 'Double-click to skip') }

  return (
    <div onClick={activarSonido} onDoubleClick={dismiss}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{
        // `height: 100dvh` y no `inset: 0`: la caja de un elemento fijo crece en
        // móvil cuando la barra del navegador se retrae, y con `inset: 0` todo lo
        // anclado al pie —la invitación— se deslizaba mientras el vídeo corría.
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
        zIndex: 100, background: '#000', cursor: 'pointer',
        opacity: fading ? 0 : 1, transition: `opacity .7s ${site.ease}`,
      }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {/* Sin `loop`: la pieza se ve entera una vez y al acabar se funde sola hacia
          la Home. `onError` cierra igual — un rectángulo negro eterno porque el MP4
          no cargó sería peor que no tener intro. */}
      {/* Sin `src` en el <video>: con hijos <source> el atributo ganaría y nunca se
          serviría el AV1. El WebM va primero porque pesa un 69% menos con la misma
          calidad medida (VMAF 96,2); quien no lo soporte cae al MP4 original, que se
          conserva intacto — recodificarlo lo empeoraba. */}
      <video ref={videoRef} poster={posterUrl || undefined}
        autoPlay muted playsInline preload="auto"
        onPlaying={() => setListo(true)}
        onEnded={dismiss}
        onError={dismiss}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
        {webmUrl && <source src={webmUrl} type="video/webm" />}
        <source src={videoUrl} type="video/mp4" />
      </video>

      {/* Veladura al pie. La invitación va en NEGRO (decisión de marca: en blanco
          se perdía sobre los fotogramas claros), y el negro sin base desaparecería
          en los oscuros. Es el crema del sitio, no blanco, y a media opacidad: se
          lee como una veladura de la propia pieza, no como una barra. */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 240, zIndex: 1,
        pointerEvents: 'none',
        // Las paradas no son una rampa lineal: la franja de los 90 px de abajo
        // —donde vive de verdad el texto— entra ya casi opaca, y el desvanecido
        // se gasta por encima, donde no hay nada que leer. Una rampa recta dejaba
        // la invitación justo en la mitad floja del degradado.
        background: 'linear-gradient(to top, rgba(244,243,240,0.80) 0px, rgba(244,243,240,0.74) 90px, rgba(244,243,240,0.30) 165px, rgba(244,243,240,0) 240px)',
        opacity: listo ? 1 : 0, transition: `opacity .9s ${site.ease} .25s`,
      }} />

      {/* Invitación. No aparece hasta que el vídeo corre de verdad. */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 46, gap: 14,
        pointerEvents: 'none', fontFamily: site.font, color: site.color.ink,
        opacity: listo ? 1 : 0, transition: `opacity .9s ${site.ease} .25s`,
      }}>
        <div className={`iv-inv${sonando ? ' iv-on' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="iv-eq" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span style={{ fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase' }}>
            {sonando ? gesto.entrar : gesto.toque}
          </span>
        </div>

        {/* Se apaga, no se desmonta. Al activar el sonido esta fila desaparecía
            del flex y el bloque entero daba un salto de ~25 px justo en el
            momento de más atención. Ahora el hueco se queda reservado. */}
        <span className="iv-sec" aria-hidden={sonando || undefined} style={{
          fontSize: 9.5, letterSpacing: site.track.normal, textTransform: 'uppercase',
          opacity: sonando ? 0 : 0.55, visibility: sonando ? 'hidden' : 'visible',
          transition: `opacity .45s ${site.ease}`,
        }}>
          {t(`o ${gesto.entrar.toLowerCase()}`, `or ${gesto.entrar.toLowerCase()}`)}
        </span>

        {/* Absoluto: en flujo empujaba la invitación hacia arriba al aparecer y
            la dejaba caer al irse, cinco segundos después. */}
        {avisoSilencio && (
          <span className="iv-fade" style={{ position: 'absolute', left: 0, right: 0, bottom: 12, margin: '0 auto', fontSize: 9.5, letterSpacing: site.track.tight, opacity: 0.65, textAlign: 'center', maxWidth: '30ch', lineHeight: 1.5 }}>
            {t('¿No oyes nada? Revisa el interruptor de silencio del teléfono.', 'No sound? Check your phone’s ringer switch.')}
          </span>
        )}
      </div>

      {/* Control de silencio: la WCAG pide poder parar el audio. Solo cuando suena. */}
      {sonando && (
        <button type="button" className="iv-mute"
          onClick={(e) => { e.stopPropagation(); silenciar() }}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', left: site.gutter, bottom: 42, zIndex: 3,
            background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer',
            color: site.color.ink, fontFamily: site.font, fontSize: 10,
            letterSpacing: site.track.ultra, textTransform: 'uppercase',
          }}>
          {t('Silenciar', 'Mute')}
        </button>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* Ecualizador: cuatro barras finas. Quietas y bajas mientras está en
           silencio (una insinuación de que ahí hay audio), bailando cuando suena. */
        .iv-eq { display: flex; align-items: flex-end; gap: 2.5px; height: 12px; }
        .iv-eq i {
          display: block; width: 1.5px; height: 12px; background: currentColor;
          transform-origin: bottom center; transform: scaleY(0.28);
          transition: transform .5s cubic-bezier(.22,1,.36,1);
        }
        .iv-on .iv-eq i { animation: iv-bar .95s ease-in-out infinite alternate; }
        .iv-on .iv-eq i:nth-child(2) { animation-duration: .72s; animation-delay: .1s; }
        .iv-on .iv-eq i:nth-child(3) { animation-duration: 1.15s; animation-delay: .04s; }
        .iv-on .iv-eq i:nth-child(4) { animation-duration: .84s; animation-delay: .18s; }
        @keyframes iv-bar { from { transform: scaleY(0.24); } to { transform: scaleY(1); } }

        /* En silencio la invitación respira despacio, para que el ojo la encuentre
           sin que parezca un banner. Solo opacity y transform. */
        .iv-inv { animation: iv-breathe 3.4s ease-in-out infinite; }
        .iv-inv.iv-on { animation: none; opacity: 0.82; }
        @keyframes iv-breathe {
          0%, 100% { opacity: 0.7; transform: translateY(0); }
          50%      { opacity: 1;   transform: translateY(-2px); }
        }

        /* En táctil la respiración pierde el vaivén y se queda en opacidad: dos
           píxeles de sube-y-baja en un móvil sostenido con la mano no se leen
           como respiración, se leen como temblor. En escritorio, con el cursor
           quieto y la pantalla fija, sí funcionan. */
        @media (hover: none) {
          .iv-inv { animation-name: iv-breathe-plana; }
        }
        @keyframes iv-breathe-plana {
          0%, 100% { opacity: 0.72; }
          50%      { opacity: 1; }
        }

        .iv-sec, .iv-fade { animation: iv-in .8s ease both .3s; }
        @keyframes iv-in { from { opacity: 0; } }

        .iv-mute { opacity: 0.62; transition: opacity .3s ease; }
        .iv-mute:hover { opacity: 1; }

        @media (prefers-reduced-motion: reduce) {
          .iv-inv, .iv-on .iv-eq i, .iv-sec, .iv-fade { animation: none; }
          .iv-eq i { transition: none; }
        }
      ` }} />
    </div>
  )
}


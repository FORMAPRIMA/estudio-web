'use client'

import { useEffect, useRef, useState } from 'react'

// Vídeo de introducción de todas las visitas: las vigas de la casa, 1890-2026.
//
// Al terminar se QUEDA CONGELADO en el último fotograma (el piso en blanco y
// negro, con el forjado de vigas al descubierto): es el pie para que el guía
// explique que la estructura es el concepto del proyecto antes de empezar el
// recorrido. Por eso, si se vuelve a esta diapositiva, se ve el fotograma
// congelado y no se relanza el vídeo; para eso está «Repetir para todos».
//
// · Guía: con sonido. El toque para avanzar ya cuenta como gesto del usuario,
//   así que el navegador deja reproducir.
// · Invitado en directo: SIN sonido (cinco móviles sonando a destiempo en un
//   salón sería un desastre) y sincronizado con el guía a partir de `desde`.

export const VIDEO_INTRO = {
  hd: '/open-house/cc38/video/cc38-intro.mp4',
  movil: '/open-house/cc38/video/cc38-intro-720.mp4',
  poster: '/open-house/cc38/video/cc38-intro-poster.jpg',
  duracion: 22,
}

interface Props {
  modo: 'guia' | 'invitado'
  /** Epoch ms en que se lanzó el vídeo (sincroniza a los invitados y recuerda si ya se vio). */
  desde?: number | null
  onRepetir?: () => void
}

export default function VideoIntro({ modo, desde, onRepetir }: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const [pausado, setPausado] = useState(true)
  const [mudo, setMudo] = useState(modo === 'invitado')
  const [congelado, setCongelado] = useState(false)

  // Lleva el vídeo al punto que toca (desde el principio, a mitad para quien
  // llega tarde, o congelado en el final si ya terminó).
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const seg = desde ? (Date.now() - desde) / 1000 : 0
    const fin = seg >= VIDEO_INTRO.duracion - 0.5
    const colocar = () => {
      if (fin) {
        try { v.currentTime = Math.max(0, (v.duration || VIDEO_INTRO.duracion) - 0.05) } catch { /* */ }
        v.pause()
        setCongelado(true)
        return
      }
      setCongelado(false)
      try { v.currentTime = seg > 0.5 ? seg : 0 } catch { /* */ }
      v.muted = modo === 'invitado' ? mudo : false
      v.play().then(() => setPausado(false)).catch(() => setPausado(true))
    }
    if (v.readyState >= 1) colocar()
    else { v.addEventListener('loadedmetadata', colocar, { once: true }); return () => v.removeEventListener('loadedmetadata', colocar) }
  }, [desde]) // eslint-disable-line react-hooks/exhaustive-deps

  function alternar() {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().then(() => setPausado(false)).catch(() => {})
    else { v.pause(); setPausado(true) }
  }

  function activarSonido() {
    const v = ref.current
    if (!v) return
    v.muted = false
    setMudo(false)
    if (v.paused && !congelado) v.play().then(() => setPausado(false)).catch(() => {})
  }

  // Que los toques sobre los controles no avancen la story.
  const parar = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onPointerUp: (e: React.PointerEvent) => e.stopPropagation() }

  return (
    <div className={`rc-video${congelado ? ' is-congelado' : ''}`}>
      <video
        ref={ref}
        className="rc-video-el"
        src={modo === 'guia' ? VIDEO_INTRO.hd : VIDEO_INTRO.movil}
        poster={desde ? undefined : VIDEO_INTRO.poster}
        playsInline
        preload="auto"
        muted={mudo}
        onPlay={() => { setPausado(false); setCongelado(false) }}
        onPause={() => setPausado(true)}
        onEnded={() => { setCongelado(true); setPausado(true) }}
      />

      {congelado ? (
        <div className="rc-video-pie">
          <span className="rc-eyebrow">Así encontramos la casa</span>
          <p className="rc-serif">Las vigas, el origen del proyecto</p>
        </div>
      ) : (
        <div className="rc-video-txt">
          <span className="rc-eyebrow">Antes de empezar</span>
          <p className="rc-serif">Claudio Coello 38, desde 1890</p>
        </div>
      )}

      <div className="rc-video-acc" {...parar}>
        {modo === 'invitado' && mudo && !congelado && (
          <button className="rc-video-btn" onClick={activarSonido}>🔊 Activar sonido</button>
        )}
        {!congelado && pausado && <button className="rc-video-btn" onClick={alternar}>▶ Reproducir</button>}
        {modo === 'guia' && !congelado && !pausado && <button className="rc-video-btn" onClick={alternar}>Pausa</button>}
        {modo === 'guia' && onRepetir && congelado && (
          <button className="rc-video-btn rc-video-btn-sutil" onClick={onRepetir}>↺ Repetir para todos</button>
        )}
      </div>
    </div>
  )
}

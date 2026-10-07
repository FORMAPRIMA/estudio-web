'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RcDetallePublico } from '@/lib/recorrido/domain'

// Visor tipo stories: una diapositiva por detalle del recorrido, con barras de
// progreso arriba (una por parada), toque a izquierda/derecha y swipe. Si un
// detalle tiene varias fotos, el toque recorre primero sus fotos.
//
// La foto nunca se recorta: va con object-fit: contain sobre una copia suya
// desenfocada a sangre, así una pieza alargada se ve entera y la pantalla no
// queda con bandas vacías.

export type Diapositiva =
  | { tipo: 'portada' }
  | { tipo: 'detalle'; d: RcDetallePublico & { notas_guia?: string | null } }
  | { tipo: 'fin' }

interface Props {
  diapositivas: Diapositiva[]
  indice: number
  onIndice: (i: number) => void
  /** Foto dentro del detalle actual (controlado para que el directo la sincronice si se quiere). */
  foto: number
  onFoto: (i: number) => void
  tema: 'oscuro' | 'claro'
  /** Números de parada por id (1..n) para la etiqueta "Parada 3 de 12". */
  total: number
  /** Etiqueta superior en lugar de la barra de progreso: p. ej. «Pregunta de la visita». */
  suelto?: string | null
  mostrarNotas?: boolean
  portada?: ReactNode
  fin?: ReactNode
  /** Esquina superior derecha (minimapa). */
  esquina?: ReactNode
  /** Barra inferior extra (acciones del guía o del invitado). */
  pie?: ReactNode
}

const SWIPE = 50

export default function Story({
  diapositivas, indice, onIndice, foto, onFoto, tema, total, suelto, mostrarNotas, portada, fin, esquina, pie,
}: Props) {
  const actual = diapositivas[Math.min(indice, diapositivas.length - 1)]
  const fotos = actual?.tipo === 'detalle' ? actual.d.fotos : []
  const nFotos = Math.max(1, fotos.length)
  const toque = useRef<{ x: number; y: number; t: number } | null>(null)
  const [limpia, setLimpia] = useState(false)

  useEffect(() => { setLimpia(false) }, [indice])

  function siguiente() {
    if (actual?.tipo === 'detalle' && foto < nFotos - 1) { onFoto(foto + 1); return }
    if (!suelto && indice < diapositivas.length - 1) onIndice(indice + 1)
  }
  function anterior() {
    if (actual?.tipo === 'detalle' && foto > 0) { onFoto(foto - 1); return }
    if (!suelto && indice > 0) onIndice(indice - 1)
  }

  // Teclado (tablet con funda, o el portátil del ensayo).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); siguiente() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); anterior() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  function onDown(e: React.PointerEvent) { toque.current = { x: e.clientX, y: e.clientY, t: Date.now() } }
  function onUp(e: React.PointerEvent) {
    const s = toque.current
    toque.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
      // El swipe salta de parada entera, sin pasar foto a foto.
      if (suelto) return
      if (dx < 0 && indice < diapositivas.length - 1) onIndice(indice + 1)
      if (dx > 0 && indice > 0) onIndice(indice - 1)
      return
    }
    if (Math.hypot(dx, dy) > 10 || Date.now() - s.t > 500) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const rel = (e.clientX - r.left) / r.width
    if (rel < 0.28) anterior()
    else if (rel > 0.72) siguiente()
    else setLimpia((v) => !v)
  }

  const numero = diapositivas.slice(0, indice + 1).filter((x) => x.tipo === 'detalle').length

  return (
    <div className={`rc-story rc-story-${tema}${limpia ? ' is-limpia' : ''}`}>
      {/* Progreso: una barra por diapositiva; la actual se llena por fotos. */}
      <div className="rc-story-top">
        {suelto ? (
          <div className="rc-story-suelto"><span className="rc-vivo-dot" />{suelto}</div>
        ) : (
          <div className="rc-story-barras">
            {diapositivas.map((x, i) => (
              <span key={i} className={`rc-barra${x.tipo !== 'detalle' ? ' rc-barra-corta' : ''}`}>
                <i style={{ width: i < indice ? '100%' : i > indice ? '0%' : `${((foto + 1) / (x.tipo === 'detalle' ? Math.max(1, x.d.fotos.length) : 1)) * 100}%` }} />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rc-story-escena" onPointerDown={onDown} onPointerUp={onUp}>
        {actual?.tipo === 'portada' && <div className="rc-story-especial" key="portada">{portada}</div>}
        {actual?.tipo === 'fin' && <div className="rc-story-especial" key="fin">{fin}</div>}
        {actual?.tipo === 'detalle' && (
          <div className="rc-story-detalle" key={actual.d.id}>
            <div className="rc-story-media">
              {fotos.length ? (
                fotos.map((f, i) => (
                  <div key={f.id ?? f.url} className={`rc-story-foto${i === foto ? ' is-on' : ''}`} aria-hidden={i !== foto}>
                    <img className="rc-story-fondo" src={f.url} alt="" />
                    <img className="rc-story-img" src={f.url} alt={actual.d.titulo} />
                  </div>
                ))
              ) : (
                <div className="rc-story-sinfoto rc-serif">{actual.d.titulo}</div>
              )}
              {fotos.length > 1 && (
                <div className="rc-story-puntos">
                  {fotos.map((_, i) => <span key={i} className={i === foto ? 'is-on' : ''} />)}
                </div>
              )}
            </div>

            <div className="rc-story-texto">
              <div className="rc-story-meta">
                {!suelto && <span className="rc-story-num">{String(numero).padStart(2, '0')}<small> / {String(total).padStart(2, '0')}</small></span>}
                <span className="rc-eyebrow">{[actual.d.estancia, actual.d.categoria].filter(Boolean).join(' · ')}</span>
              </div>
              <h2 className="rc-serif rc-story-titulo">{actual.d.titulo}</h2>
              {actual.d.texto && <p className="rc-story-cuerpo">{actual.d.texto}</p>}
              {mostrarNotas && actual.d.notas_guia && (
                <div className="rc-story-notas">
                  <span className="rc-eyebrow">Solo para ti</span>
                  <p>{actual.d.notas_guia}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {esquina && <div className="rc-story-esquina">{esquina}</div>}
      {pie && <div className="rc-story-pie">{pie}</div>}
    </div>
  )
}

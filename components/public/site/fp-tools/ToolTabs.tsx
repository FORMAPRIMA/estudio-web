'use client'

import { useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { site } from '../theme'
import { href } from '../SiteProvider'

/**
 * La barra de capacidades: el menú lineal que preside /fp-tools.
 *
 * FP Tools no tiene portada. Entrar en la sección ES entrar en la primera
 * capacidad, y esta barra es lo que permite saltar a otra sin pasar por un índice
 * intermedio — que era un paso de más para enseñar cuatro cosas.
 *
 * Cada pestaña es un enlace de verdad a /fp-tools/<slug> y no un estado de
 * cliente: así cada capacidad tiene su URL, se puede compartir, el botón de atrás
 * hace lo que tiene que hacer y el buscador las encuentra. Next las navega sin
 * recargar, así que el salto se siente igual de instantáneo.
 *
 * ── Por qué `sticky` y no fija ────────────────────────────────────────────
 * Estuvo fija y flotando SOBRE el vídeo, y se perdía la parte de arriba de la
 * pieza: entre el isotipo y la barra tapaban los primeros 124 px. Ahora la ventana
 * del vídeo empieza justo debajo de esta barra, así que la barra está en el flujo
 * y `sticky` basta — que además lo resuelve el navegador, sin escuchar el scroll
 * ni animar el tope a mano.
 *
 * Y por eso es de un solo color: encima nunca hay vídeo. Antes cambiaba de blanco
 * a tinta según lo que pasara por debajo, y eso era pura consecuencia de flotar.
 */

/** El hueco del header del sitio. SiteNav es `absolute` y no ocupa flujo, así que
 *  esta barra tiene que dejárselo ella. Es el mismo 72 que declara SiteNav. */
export const TOPE_HEADER = 72

export function ToolTabs({ tools, activo, locale }: {
  tools: { slug: string; nombre: string }[]
  activo: string
  locale: 'es' | 'en'
}) {
  const pista = useRef<HTMLDivElement>(null)
  const activoRef = useRef<HTMLAnchorElement>(null)

  // En móvil la barra scrollea a lo ancho y la capacidad abierta puede caer fuera.
  // `useLayoutEffect` para que el ajuste ocurra antes de pintar: verla saltar de
  // sitio nada más entrar se lee como un fallo.
  useLayoutEffect(() => {
    const caja = pista.current
    const el = activoRef.current
    if (!caja || !el) return
    if (caja.scrollWidth <= caja.clientWidth) return
    caja.scrollLeft = Math.max(0, el.offsetLeft - caja.clientWidth / 2 + el.offsetWidth / 2)
  }, [activo])

  if (tools.length < 2) return null

  return (
    <div className="ftt">
      <div className="ftt-marco">
        <nav ref={pista} className="ftt-pista" aria-label={locale === 'en' ? 'Capabilities' : 'Capacidades'}>
          {tools.map((t, i) => {
            const esActivo = t.slug === activo
            return (
              <Link key={t.slug} href={href(`/fp-tools/${t.slug}`)} data-cursor=""
                ref={esActivo ? activoRef : undefined}
                className="ftt-tab" data-on={esActivo ? '1' : undefined}
                aria-current={esActivo ? 'page' : undefined}>
                <span className="ftt-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="ftt-nom">{t.nombre}</span>
              </Link>
            )
          })}
        </nav>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )
}

const CSS = `
.ftt {
  position: sticky; top: 0; z-index: 45;
  /* Translúcida y con desenfoque, como las ventanas flotantes del mapa: al
     pegarse arriba, lo que pasa por debajo es el vídeo y luego las imágenes de
     los bloques, y una banda opaca los cortaría en seco. */
  background: rgba(244,243,240,.88);
  -webkit-backdrop-filter: blur(16px) saturate(1.08); backdrop-filter: blur(16px) saturate(1.08);
  border-bottom: 1px solid rgba(20,20,20,.09);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .ftt { background: #F4F3F0; }
}

.ftt-marco { max-width: ${site.maxWidth}px; margin: 0 auto; padding: 0 ${site.gutter}; }

.ftt-pista {
  display: flex; align-items: center; gap: clamp(20px, 3.2vw, 44px);
  height: 52px; overflow-x: auto; scrollbar-width: none;
  /* Que el gesto lateral no arrastre la página de detrás ni active el "atrás". */
  overscroll-behavior-x: contain;
}
.ftt-pista::-webkit-scrollbar { display: none; }

.ftt-tab {
  position: relative; flex: none; display: inline-flex; align-items: baseline; gap: 8px;
  padding: 16px 0 15px; text-decoration: none; color: ${site.color.ink};
  font-size: 10.5px; letter-spacing: ${site.track.wide}; text-transform: uppercase;
  white-space: nowrap;
  transition: opacity .35s ease;
  opacity: .42;
}
.ftt-tab:hover, .ftt-tab:focus-visible { opacity: .82; }
.ftt-tab[data-on="1"] { opacity: 1; }
.ftt-tab:focus-visible { outline: 1px solid currentColor; outline-offset: 3px; }

/* El número no compite con el nombre: queda como una marca de posición. */
.ftt-n { font-size: 8.5px; opacity: .55; font-variant-numeric: tabular-nums; letter-spacing: .1em; }

/* El filete de la pestaña abierta. Se abre desde la izquierda, como todos los
   subrayados del sitio, en vez de aparecer de golpe. */
.ftt-tab::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: currentColor;
  transform: scaleX(0); transform-origin: left center;
  transition: transform .55s cubic-bezier(.22,1,.36,1);
}
.ftt-tab[data-on="1"]::after { transform: scaleX(1); }

/* En pantallas estrechas la barra se lee como una tira que se arrastra, así que
   pierde el gutter grande: los nombres tienen que llegar al canto para que se vea
   que hay más a la derecha. */
@media (max-width: 760px) {
  .ftt-marco { padding: 0; }
  .ftt-pista { gap: 22px; padding: 0 20px; height: 48px; }
  .ftt-nom { font-size: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .ftt-tab, .ftt-tab::after { transition: none; }
}
`

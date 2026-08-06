'use client'

import { useEffect, useState } from 'react'
import { site } from './theme'
import { useSite } from './SiteProvider'

// Cierre de página: el sitio no tiene footer, así que al llegar al final aparece
// el isotipo como firma a la izquierda y un "volver arriba" a la derecha. Nada
// más: un footer completo repetiría la navegación que ya está fija arriba.
//
// Es una barra fija que solo asoma al final del documento (no un bloque en el
// flujo) para no tener que tocar cada página, y no se muestra si la página no
// scrollea — en la Home no habría de dónde volver.

const ISOTIPO = '/ISOTIPO%20NEGRO%20cropped.png'

/** Margen desde el fondo real a partir del cual se considera "has llegado". */
const UMBRAL = 90

export function SiteEndMark() {
  const { locale } = useSite()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      // Páginas de una sola pantalla (la Home): nunca.
      if (scrollable < 40) { setVisible(false); return }
      setVisible(window.scrollY + window.innerHeight >= doc.scrollHeight - UMBRAL)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])

  const subir = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div aria-hidden={!visible}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45, height: 62,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${site.gutter}`, fontFamily: site.font,
        // El contenido de la página tiene que seguir siendo clicable por debajo:
        // solo el botón recupera los eventos.
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity .5s ${site.ease}, transform .5s ${site.ease}`,
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ISOTIPO} alt="Forma Prima"
        style={{ height: 20, width: 'auto', display: 'block', opacity: 0.5 }} />

      <button type="button" onClick={subir} className="fp-top" data-cursor=""
        disabled={!visible}
        style={{
          pointerEvents: visible ? 'auto' : 'none',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 11, letterSpacing: site.track.wide,
          textTransform: 'uppercase', color: site.color.ink, opacity: 0.62,
        }}>
        <span className="fp-top-arrow" aria-hidden="true" />
        {locale === 'en' ? 'Back to top' : 'Volver arriba'}
      </button>

      <style dangerouslySetInnerHTML={{ __html: `
        .fp-top { transition: opacity .3s ${site.ease}; }
        .fp-top:hover { opacity: 1 !important; }
        /* Flecha dibujada en CSS: una barra vertical con dos aspas. Sube al pasar
           por encima, que es la única pista de dirección que necesita. */
        .fp-top-arrow {
          position: relative; display: block; width: 9px; height: 13px;
          transition: transform .35s ${site.ease};
        }
        .fp-top-arrow::before {
          content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
          background: currentColor; transform: translateX(-50%);
        }
        .fp-top-arrow::after {
          content: ''; position: absolute; left: 50%; top: 0; width: 6px; height: 6px;
          border-left: 1px solid currentColor; border-top: 1px solid currentColor;
          transform: translateX(-50%) rotate(45deg); transform-origin: center;
        }
        .fp-top:hover .fp-top-arrow { transform: translateY(-3px); }
        @media (prefers-reduced-motion: reduce) {
          .fp-top-arrow, .fp-top { transition: none; }
        }
      ` }} />
    </div>
  )
}

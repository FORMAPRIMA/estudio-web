'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, type ContentMap } from '@/lib/web-publica'
import { tieneCoordenadas, type MapaPunto } from '@/lib/web-mapa'

// mapbox-gl solo se descarga cuando esta página se monta.
const MapaLienzo = dynamic(() => import('./MapaLienzo'), { ssr: false })

export function MapaPage({ content, puntos }: { content: ContentMap; puntos: MapaPunto[] }) {
  const { locale, mobile } = useSite()
  const [activo, setActivo] = useState<number | null>(null)
  const [fallo, setFallo] = useState(false)

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })

  // La lista y el mapa son la MISMA serie numerada: el punto 07 del mapa es la
  // entrada 07 de la lista. Por eso se numera sobre los que tienen coordenadas.
  const listados = puntos.filter(tieneCoordenadas)
  const onFallo = useCallback(() => setFallo(true), [])

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100dvh',
      padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <header style={{ marginBottom: 'clamp(30px, 5vh, 54px)' }}>
          {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
          {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.2, margin: 0, maxWidth: '22ch' }}>{titulo}</Reveal>}
          {intro && <Reveal as="p" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '56ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
        </header>

        {listados.length === 0 ? (
          <Respaldo locale={locale} motivo="sin-datos" />
        ) : (
          <div className="fp-mapa-grid">
            {/* El lienzo */}
            <div className="fp-mapa-caja">
              {fallo
                ? <Respaldo locale={locale} motivo="sin-webgl" />
                : <MapaLienzo puntos={listados} activo={activo} onActivo={setActivo} onFallo={onFallo} />}
            </div>

            {/* La lista. No es un adorno del mapa: un <canvas> es invisible para
                Google y para un lector de pantalla, y hay quien no tiene WebGL.
                Esta lista resuelve las tres cosas y además es cómoda con teclado. */}
            <nav className="fp-mapa-lista" aria-label={locale === 'en' ? 'Works in Madrid' : 'Obras en Madrid'}>
              <p className="fp-mapa-cuenta">
                {listados.length} {locale === 'en' ? 'works in Madrid' : 'obras en Madrid'}
              </p>
              <ol>
                {listados.map((p, i) => {
                  const n = i + 1
                  const on = activo === n
                  const etiqueta = (
                    <>
                      <span className="fp-mapa-n">{String(n).padStart(2, '0')}</span>
                      <span className="fp-mapa-nombre">{p.nombre}</span>
                      {p.anio && <span className="fp-mapa-anio">{p.anio}</span>}
                    </>
                  )
                  return (
                    <li key={p.id}>
                      <button type="button" data-on={on ? '1' : undefined} data-cursor=""
                        onClick={() => setActivo(on ? null : n)}
                        onMouseEnter={() => setActivo(n)}>
                        {etiqueta}
                      </button>
                      {/* La ficha solo existe para las obras publicadas; el resto
                          son presencia, que también cuenta. */}
                      {on && p.proyecto_slug && (
                        <Link href={href(`/proyectos/${p.proyecto_slug}`)} className="fp-mapa-ficha" data-cursor="">
                          {locale === 'en' ? 'View project' : 'Ver proyecto'} →
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .fp-mapa-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 290px;
          gap: clamp(20px, 3vw, 40px);
          align-items: stretch;
        }
        .fp-mapa-caja {
          position: relative;
          height: clamp(420px, 70vh, 760px);
          overflow: hidden;
          background: #eceae5;
          border: 1px solid ${site.color.ink}12;
        }
        .fp-mapa-lienzo { position: absolute; inset: 0; }

        .fp-mapa-lista {
          height: clamp(420px, 70vh, 760px);
          overflow-y: auto;
          padding-right: 4px;
        }
        .fp-mapa-cuenta {
          font-size: 10px; letter-spacing: ${site.track.wide}; text-transform: uppercase;
          opacity: 0.45; margin: 0 0 14px;
        }
        .fp-mapa-lista ol { list-style: none; margin: 0; padding: 0; }
        .fp-mapa-lista li { border-bottom: 1px solid ${site.color.ink}0f; }
        .fp-mapa-lista button {
          display: grid;
          grid-template-columns: 3.2ch 1fr auto;
          gap: 12px;
          align-items: baseline;
          width: 100%;
          padding: 11px 0;
          background: none; border: none; cursor: pointer;
          font-family: inherit; color: inherit; text-align: left;
          transition: opacity .25s ${site.ease};
          opacity: 0.72;
        }
        .fp-mapa-lista button:hover,
        .fp-mapa-lista button:focus-visible,
        .fp-mapa-lista button[data-on] { opacity: 1; }
        .fp-mapa-lista button:focus-visible { outline: 1px solid ${site.color.ink}; outline-offset: 2px; }
        .fp-mapa-n { font-size: 10.5px; font-variant-numeric: tabular-nums; opacity: 0.4; letter-spacing: 0.1em; }
        .fp-mapa-nombre { font-size: 13.5px; font-weight: 300; }
        .fp-mapa-lista button[data-on] .fp-mapa-nombre { font-weight: 400; }
        .fp-mapa-anio { font-size: 10.5px; opacity: 0.4; font-variant-numeric: tabular-nums; }
        .fp-mapa-ficha {
          display: inline-block; margin: 0 0 12px calc(3.2ch + 12px);
          font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase;
          color: inherit; text-decoration: none; opacity: 0.6;
          border-bottom: 1px solid ${site.color.ink}30;
        }
        .fp-mapa-ficha:hover { opacity: 1; }

        @media (max-width: 900px) {
          /* La lista baja debajo del mapa y deja de tener alto propio: dos zonas
             de scroll independientes en una pantalla de móvil es una trampa. */
          .fp-mapa-grid { grid-template-columns: 1fr; }
          .fp-mapa-caja { height: clamp(340px, 52vh, 480px); }
          .fp-mapa-lista { height: auto; overflow: visible; }
        }
      ` }} />
    </main>
  )
}

/** Sin WebGL, sin token o sin puntos geocodificados: el plano de siempre. Nunca
 *  un rectángulo vacío. */
function Respaldo({ locale, motivo }: { locale: 'es' | 'en'; motivo: 'sin-webgl' | 'sin-datos' }) {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 340, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30, textAlign: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wip/mapa-madrid.png" alt={locale === 'en' ? 'Map of works in Madrid' : 'Mapa de obras en Madrid'}
        style={{ maxWidth: 'min(100%, 620px)', height: 'auto', display: 'block', opacity: 0.9 }} />
      <p style={{ fontSize: 10.5, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.42, margin: 0 }}>
        {motivo === 'sin-webgl'
          ? (locale === 'en' ? 'Interactive map unavailable in this browser' : 'El mapa interactivo no está disponible en este navegador')
          : (locale === 'en' ? 'Interactive map coming soon' : 'Mapa interactivo en preparación')}
      </p>
    </div>
  )
}

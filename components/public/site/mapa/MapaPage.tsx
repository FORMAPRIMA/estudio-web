'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { Img } from '../Img'
import { pick, type ContentMap } from '@/lib/web-publica'
import { datosDeTarjeta, tieneCoordenadas, type MapaPunto } from '@/lib/web-mapa'

// mapbox-gl solo se descarga cuando esta página se monta.
const MapaLienzo = dynamic(() => import('./MapaLienzo'), { ssr: false })

export function MapaPage({ content, puntos }: { content: ContentMap; puntos: MapaPunto[] }) {
  const { locale, mobile } = useSite()

  // DOS estados, no uno. El hover solo enciende; el clic viaja. Cuando los dos
  // compartían variable, rozar la lista con el ratón disparaba un vuelo de cámara.
  const [resaltado, setResaltado] = useState<number | null>(null)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [fallo, setFallo] = useState(false)

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })

  // useMemo NO es una optimización aquí, es corrección: sin él este filtro devuelve
  // un array nuevo en cada render, el lienzo lo ve como un prop distinto y vuelve a
  // ejecutar su efecto de encuadre inicial, que devolvía la cámara de golpe al
  // plano general. (El lienzo tiene además su propio cerrojo, por si acaso.)
  const listados = useMemo(() => puntos.filter(tieneCoordenadas), [puntos])

  const onFallo = useCallback(() => setFallo(true), [])
  const alternar = useCallback((n: number | null) => {
    setSeleccionado((prev) => (prev === n ? null : n))
  }, [])

  const punto = seleccionado != null ? listados[seleccionado - 1] : null

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
            <div className="fp-mapa-caja">
              {fallo
                ? <Respaldo locale={locale} motivo="sin-webgl" />
                : (
                  <>
                    <MapaLienzo puntos={listados} resaltado={resaltado} seleccionado={seleccionado}
                      onResaltar={setResaltado} onSeleccionar={alternar} onFallo={onFallo} />
                    {/* La tarjeta va anclada al LIENZO, no a la coordenada. Un
                        Popup de Mapbox vive pegado a un punto del terreno: durante
                        la órbita cruzaría la pantalla nadando, y con 63° de cabeceo
                        los que caen hacia el horizonte se empequeñecen y se
                        tuercen. Fija en la esquina se queda quieta mientras la
                        ciudad gira detrás, que además es mejor imagen. */}
                    {punto && <Ficha punto={punto} locale={locale} onCerrar={() => setSeleccionado(null)} />}
                  </>
                )}
            </div>

            {/* La lista no es un adorno del mapa: un <canvas> es invisible para
                Google y para un lector de pantalla, y hay quien no tiene WebGL.
                Resuelve las tres cosas y encima es cómoda con teclado. */}
            <nav className="fp-mapa-lista" aria-label={locale === 'en' ? 'Works' : 'Obras'}>
              <div className="fp-mapa-cab">
                <p className="fp-mapa-cuenta">
                  {/* «obras» a secas: ya no todas están en Madrid. */}
                  {listados.length} {locale === 'en' ? 'works' : 'obras'}
                </p>
                {seleccionado != null && (
                  <button type="button" className="fp-mapa-todas" data-cursor="" onClick={() => setSeleccionado(null)}>
                    {locale === 'en' ? 'See all' : 'Ver todas'}
                  </button>
                )}
              </div>
              <ol>
                {listados.map((p, i) => {
                  const n = i + 1
                  const sel = seleccionado === n
                  return (
                    <li key={p.id}>
                      <button type="button" data-sel={sel ? '1' : undefined} data-res={resaltado === n ? '1' : undefined}
                        data-cursor="" aria-current={sel || undefined}
                        onClick={() => alternar(n)}
                        // El hover y el foco solo RESALTAN. Mover la cámara con el
                        // ratón de paso convertía un gesto sin compromiso en una
                        // consecuencia de segundo y medio.
                        onMouseEnter={() => setResaltado(n)}
                        onMouseLeave={() => setResaltado(null)}
                        onFocus={() => setResaltado(n)}
                        onBlur={() => setResaltado(null)}>
                        <span className="fp-mapa-n">{String(n).padStart(2, '0')}</span>
                        <span className="fp-mapa-nombre">{p.nombre}</span>
                        {p.anio && <span className="fp-mapa-anio">{p.anio}</span>}
                      </button>
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

        /* ── Tarjeta de la obra ───────────────────────────────────────────── */
        .fp-mapa-ficha {
          position: absolute;
          left: 18px; bottom: 18px; z-index: 3;
          width: 264px;
          background: ${site.color.cream};
          box-shadow: 0 18px 44px -22px rgba(20,20,20,.55), 0 0 0 1px ${site.color.ink}0f;
          /* Entrada corta y de una sola pieza: lo que se mueve en esta pantalla
             es el mapa, no la interfaz. */
          animation: fp-ficha-entra .24s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes fp-ficha-entra { from { opacity: 0; transform: translateY(8px); } }
        .fp-mapa-ficha-foto { position: relative; width: 100%; aspect-ratio: 16 / 10; overflow: hidden; background: #e7e5df; }
        .fp-mapa-ficha-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .fp-mapa-ficha-txt { padding: 13px 15px 15px; display: flex; flex-direction: column; gap: 6px; }
        .fp-mapa-ficha-nombre { font-size: 15px; font-weight: 400; margin: 0; letter-spacing: -0.01em; }
        .fp-mapa-ficha-meta { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: 0.5; margin: 0; }
        .fp-mapa-ficha-dir { font-size: 11.5px; font-weight: 300; opacity: 0.6; margin: 0; }
        .fp-mapa-ficha-link {
          margin-top: 5px; font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase;
          color: inherit; text-decoration: none; align-self: flex-start;
          border-bottom: 1px solid ${site.color.ink}33; padding-bottom: 2px;
        }
        .fp-mapa-ficha-link:hover { border-bottom-color: ${site.color.ink}; }
        .fp-mapa-cerrar {
          position: absolute; top: 6px; right: 8px; z-index: 2;
          background: none; border: none; cursor: pointer; line-height: 1;
          font-size: 19px; color: ${site.color.cream};
          text-shadow: 0 1px 5px rgba(0,0,0,.5);
          padding: 4px 6px;
        }
        .fp-mapa-ficha[data-sinfoto="1"] .fp-mapa-cerrar { color: ${site.color.ink}; text-shadow: none; }

        /* ── Lista ────────────────────────────────────────────────────────── */
        .fp-mapa-lista { height: clamp(420px, 70vh, 760px); overflow-y: auto; padding-right: 4px; }
        .fp-mapa-cab { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .fp-mapa-cuenta { font-size: 10px; letter-spacing: ${site.track.wide}; text-transform: uppercase; opacity: 0.45; margin: 0; }
        .fp-mapa-todas {
          background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; color: inherit;
          font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: 0.55;
          border-bottom: 1px solid ${site.color.ink}30;
        }
        .fp-mapa-todas:hover, .fp-mapa-todas:focus-visible { opacity: 1; }
        .fp-mapa-lista ol { list-style: none; margin: 0; padding: 0; }
        .fp-mapa-lista li { border-bottom: 1px solid ${site.color.ink}0f; }
        .fp-mapa-lista button {
          display: grid; grid-template-columns: 3.2ch 1fr auto; gap: 12px;
          align-items: baseline; width: 100%; padding: 11px 0;
          background: none; border: none; cursor: pointer;
          font-family: inherit; color: inherit; text-align: left;
          transition: opacity .25s ${site.ease};
          opacity: 0.72;
        }
        .fp-mapa-lista button:hover,
        .fp-mapa-lista button[data-res],
        .fp-mapa-lista button[data-sel] { opacity: 1; }
        .fp-mapa-lista button:focus-visible { outline: 1px solid ${site.color.ink}; outline-offset: 2px; }
        .fp-mapa-n { font-size: 10.5px; font-variant-numeric: tabular-nums; opacity: 0.4; letter-spacing: 0.1em; }
        .fp-mapa-nombre { font-size: 13.5px; font-weight: 300; }
        .fp-mapa-lista button[data-sel] .fp-mapa-nombre { font-weight: 400; }
        .fp-mapa-anio { font-size: 10.5px; opacity: 0.4; font-variant-numeric: tabular-nums; }

        @media (max-width: 900px) {
          /* La lista baja debajo del mapa y deja de tener alto propio: dos zonas
             de scroll independientes en una pantalla de móvil es una trampa. */
          .fp-mapa-grid { grid-template-columns: 1fr; }
          .fp-mapa-caja { height: clamp(340px, 52vh, 480px); }
          .fp-mapa-lista { height: auto; overflow: visible; }
          /* La tarjeta sube desde el pie a todo el ancho, el mismo gesto que ya
             conoce el menú. */
          .fp-mapa-ficha { left: 0; right: 0; bottom: 0; width: auto; }
          .fp-mapa-ficha-foto { aspect-ratio: 21 / 9; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-mapa-ficha { animation: none; }
        }
      ` }} />
    </main>
  )
}

/** Tarjeta de la obra seleccionada. */
function Ficha({ punto, locale, onCerrar }: { punto: MapaPunto; locale: 'es' | 'en'; onCerrar: () => void }) {
  const { imagen, descriptor, slug } = datosDeTarjeta(punto, locale)
  const meta = [descriptor, punto.anio].filter(Boolean).join(' · ')

  return (
    <div className="fp-mapa-ficha" data-sinfoto={imagen ? undefined : '1'}>
      <button type="button" className="fp-mapa-cerrar" data-cursor="" aria-label={locale === 'en' ? 'Close' : 'Cerrar'} onClick={onCerrar}>×</button>
      {/* Sin foto la tarjeta funciona igual: se queda en nombre, uso y año. Es lo
          que permite ir subiendo las fotos poco a poco en vez de tener que
          preparar las veintiuna antes de encender nada. */}
      {imagen && (
        <div className="fp-mapa-ficha-foto">
          <Img src={imagen} alt={punto.nombre} contexto="fichaMapa" />
        </div>
      )}
      <div className="fp-mapa-ficha-txt">
        <h2 className="fp-mapa-ficha-nombre">{punto.nombre}</h2>
        {meta && <p className="fp-mapa-ficha-meta">{meta}</p>}
        {punto.direccion && <p className="fp-mapa-ficha-dir">{punto.direccion.replace(/,\s*(Madrid,\s*)?España$/i, '')}</p>}
        {/* La ficha solo existe para las obras publicadas; el resto son presencia,
            que también cuenta. */}
        {slug && (
          <Link href={href(`/proyectos/${slug}`)} className="fp-mapa-ficha-link" data-cursor="">
            {locale === 'en' ? 'View project' : 'Ver proyecto'} →
          </Link>
        )}
      </div>
    </div>
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

'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

/**
 * Cuánto asoma la lámina en cada detención, EN UNIDADES CSS y no en píxeles
 * medidos. Los porcentajes van referidos a la propia lámina, que mide el 94% del
 * lienzo; así el navegador resuelve las alturas solo y no hace falta medir nada
 * para pintar. La primera versión dependía de un ResizeObserver, y una medida que
 * llega tarde —o que no llega— dejaba la lámina sin recorrido: se podía abrir y
 * no pasaba nada.
 *
 * `ficha` es la que aparece con una obra elegida: cabe la foto y el mapa sigue
 * siendo lo que más se ve, que es de lo que va esta pantalla.
 */
const DETENTES = {
  peek:  '52px',
  ficha: '200px',
  medio: '57.4%',   // ≈ 54% del lienzo
  alto:  '100%',
} as const
/** Fracción de la lámina que ocupa cada detención, para decidir a cuál se salta al
 *  soltar el arrastre. Mismos valores, en número. */
const FRACCION = { peek: 0, ficha: 0, medio: 0.574, alto: 1 } as const
/** Lo que ocupa el asa más la fila del contador. `peek` vale exactamente esto para
 *  que en reposo la lámina corte limpio y no asome media fila cortada. */
const CABECERA = 52
type Detente = keyof typeof DETENTES

const MOVIL = '(max-width: 900px)'

export function MapaPage({ content, puntos }: { content: ContentMap; puntos: MapaPunto[] }) {
  const { locale, mobile } = useSite()

  // DOS estados, no uno. El hover solo enciende; el clic viaja. Cuando los dos
  // compartían variable, rozar la lista con el ratón disparaba un vuelo de cámara.
  const [resaltado, setResaltado] = useState<number | null>(null)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [fallo, setFallo] = useState(false)

  const [esMovil, setEsMovil] = useState(false)
  const [detente, setDetente] = useState<Detente>('peek')
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  /** Durante el arrastre, los píxeles que asoma. Fuera de él, null y manda el CSS. */
  const [arrastre, setArrastre] = useState<number | null>(null)
  const hojaRef = useRef<HTMLDivElement>(null)

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })

  // useMemo NO es una optimización aquí, es corrección: sin él este filtro devuelve
  // un array nuevo en cada render, el lienzo lo ve como un prop distinto y vuelve a
  // ejecutar su efecto de encuadre inicial, que devolvía la cámara al plano general.
  const listados = useMemo(() => puntos.filter(tieneCoordenadas), [puntos])
  const total = listados.length

  useEffect(() => {
    const mq = window.matchMedia(MOVIL)
    const sync = () => setEsMovil(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  /** Píxeles de cada detención. Solo hace falta al soltar el arrastre, y ahí la
   *  lámina lleva rato en pantalla: medirla es fiable. */
  const pxDe = useCallback((d: Detente) => {
    const alto = hojaRef.current?.getBoundingClientRect().height ?? 0
    return FRACCION[d] ? Math.round(alto * FRACCION[d]) : parseInt(DETENTES[d], 10)
  }, [])

  /**
   * Píxeles del lienzo que tapa la lámina. Mapbox los necesita como número para
   * centrar en el área VISIBLE: sin esto, la obra a la que vuelas aterriza debajo
   * de la lámina y parece que no ha pasado nada.
   *
   * Se actualiza al cambiar de detención y no durante el arrastre: reencuadrar la
   * cámara mientras el dedo se mueve sería marear por marear.
   */
  const [tapado, setTapado] = useState(CABECERA)
  useEffect(() => {
    setTapado(esMovil ? pxDe(detente) : 0)
  }, [detente, esMovil, pxDe])

  // Elegir una obra baja la lámina a la ficha: el mapa tiene que verse mientras la
  // cámara vuela, que es exactamente lo que no pasaba con la lista debajo.
  //
  // Sin condicionarlo a `esMovil` a propósito. La lámina solo existe en móvil —el
  // CSS la esconde en escritorio— así que en pantalla grande esto no se nota; y
  // atarlo además a `matchMedia` significaba tener DOS fuentes de verdad para el
  // mismo umbral, con lo que si alguna vez discrepan la ficha aparece recortada.
  useEffect(() => {
    if (seleccionado != null) setDetente('ficha')
    else setDetente((d) => (d === 'ficha' ? 'peek' : d))
  }, [seleccionado])

  // A pantalla completa se bloquea el documento: si no, el dedo que mueve el mapa
  // arrastra también la página de detrás.
  useEffect(() => {
    if (!pantallaCompleta) return
    const html = document.documentElement
    const previo = html.style.cssText
    html.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPantallaCompleta(false) }
    window.addEventListener('keydown', onKey)
    return () => { html.style.cssText = previo; window.removeEventListener('keydown', onKey) }
  }, [pantallaCompleta])

  const onFallo = useCallback(() => setFallo(true), [])
  const alternar = useCallback((n: number | null) => {
    setSeleccionado((prev) => (prev === n ? null : n))
  }, [])
  /** Recorre la lista dando la vuelta al final. */
  const mover = (paso: 1 | -1) => {
    if (seleccionado == null || !total) return
    setSeleccionado(((seleccionado - 1 + paso + total) % total) + 1)
  }

  const punto = seleccionado != null ? listados[seleccionado - 1] : null
  /** Lo que asoma, como valor CSS: píxeles mientras se arrastra, token si no. */
  const asoma = arrastre != null ? `${arrastre}px` : DETENTES[detente]

  // ── Arrastre de la lámina ───────────────────────────────────────────────────
  const inicio = useRef<{ y: number; base: number } | null>(null)
  const onAsaBajar = (e: React.PointerEvent) => {
    inicio.current = { y: e.clientY, base: pxDe(detente) }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onAsaMover = (e: React.PointerEvent) => {
    if (!inicio.current) return
    const alto = inicio.current.base + (inicio.current.y - e.clientY)
    setArrastre(Math.max(CABECERA, Math.min(pxDe('alto'), alto)))
  }
  const onAsaSoltar = () => {
    if (!inicio.current) return
    const soltado = arrastre ?? inicio.current.base
    inicio.current = null
    setArrastre(null)
    // A la detención más cercana. `ficha` solo entra en juego si hay obra elegida;
    // sin ella no tiene nada que enseñar y se salta.
    const candidatas: Detente[] = seleccionado != null
      ? ['peek', 'ficha', 'medio', 'alto']
      : ['peek', 'medio', 'alto']
    let mejor = candidatas[0]
    for (const c of candidatas) if (Math.abs(pxDe(c) - soltado) < Math.abs(pxDe(mejor) - soltado)) mejor = c
    setDetente(mejor)
  }

  const cuenta = `${total} ${locale === 'en' ? 'works' : 'obras'}`

  return (
    <main className={`fp-mapa${pantallaCompleta ? ' fp-mapa-pc' : ''}`}
      style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100dvh',
        padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <header className="fp-mapa-header" style={{ marginBottom: 'clamp(30px, 5vh, 54px)' }}>
          {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
          {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.2, margin: 0, maxWidth: '22ch' }}>{titulo}</Reveal>}
          {intro && <Reveal as="p" className="fp-mapa-intro" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '56ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
        </header>

        {total === 0 ? (
          <Respaldo locale={locale} motivo="sin-datos" />
        ) : (
          <div className="fp-mapa-grid">
            <div className="fp-mapa-caja">
              {fallo ? <Respaldo locale={locale} motivo="sin-webgl" /> : (
                <>
                  <MapaLienzo puntos={listados} resaltado={resaltado} seleccionado={seleccionado}
                    onResaltar={setResaltado} onSeleccionar={alternar} onFallo={onFallo}
                    tapadoAbajo={esMovil ? tapado : 0}
                    unDedo={pantallaCompleta} />

                  {/* En escritorio la tarjeta va anclada al LIENZO y no a la
                      coordenada: un Popup de Mapbox cruzaría la pantalla nadando
                      durante la órbita, y con 63° de cabeceo los que caen al
                      horizonte se empequeñecen. En móvil su sitio es la lámina. */}
                  {punto && !esMovil && (
                    <Ficha punto={punto} locale={locale} onCerrar={() => setSeleccionado(null)} />
                  )}

                  {/* Pantalla completa, solo móvil. Es lo que permite que UN dedo
                      mueva el mapa: embebido no puede, porque se tragaría el scroll
                      de la página y no habría manera de pasar de largo. */}
                  <button type="button" className="fp-mapa-pc-btn" data-cursor=""
                    aria-label={pantallaCompleta
                      ? (locale === 'en' ? 'Exit full screen' : 'Salir de pantalla completa')
                      : (locale === 'en' ? 'Full screen' : 'Pantalla completa')}
                    onClick={() => setPantallaCompleta((v) => !v)}>
                    {pantallaCompleta ? '✕' : '⤢'}
                  </button>

                </>
              )}

                  {/* ── Lámina (móvil) ─────────────────────────────────────── */}
                  <div className="fp-mapa-hoja" ref={hojaRef} style={{
                    // El navegador resuelve el recorrido solo: la lámina mide
                    // siempre lo mismo y solo cambia cuánto se baja.
                    transform: `translateY(calc(100% - ${asoma}))`,
                    transition: arrastre == null ? `transform .34s ${site.ease}` : 'none',
                  }}>
                    <div className="fp-mapa-asa" onPointerDown={onAsaBajar} onPointerMove={onAsaMover}
                      onPointerUp={onAsaSoltar} onPointerCancel={onAsaSoltar}
                      role="separator" aria-label={locale === 'en' ? 'Resize list' : 'Ajustar la lista'}>
                      <span />
                    </div>

                    {punto ? (
                      <FichaCompacta punto={punto} locale={locale} indice={seleccionado!} total={total}
                        onMover={mover} onCerrar={() => setSeleccionado(null)}
                        onAbrirLista={() => setDetente('medio')} />
                    ) : (
                      <button type="button" className="fp-mapa-hoja-cab"
                        onClick={() => setDetente(detente === 'peek' ? 'medio' : 'peek')}>
                        <span className="fp-mapa-cuenta">{cuenta}</span>
                        <span className="fp-mapa-pista">
                          {detente === 'peek' ? (locale === 'en' ? 'See the list' : 'Ver la lista') : (locale === 'en' ? 'Hide' : 'Ocultar')}
                        </span>
                      </button>
                    )}

                    {/* El área que scrollea es solo la VISIBLE. Si la lista midiera
                        la lámina entera, al arrastrar hacia arriba aparecería ya
                        desplazada por dentro. */}
                    <div className="fp-mapa-hoja-lista"
                      style={{ maxHeight: `calc(${asoma} - ${punto ? DETENTES.ficha : `${CABECERA}px`})` }}>
                      <Lista listados={listados} seleccionado={seleccionado} resaltado={resaltado}
                        locale={locale} conFoto onElegir={alternar} onResaltar={setResaltado} />
                    </div>
                  </div>
            </div>

            {/* La lista de escritorio. No es un adorno del mapa: un <canvas> es
                invisible para Google y para un lector de pantalla, y hay quien no
                tiene WebGL. Resuelve las tres cosas y es cómoda con teclado. */}
            <nav className="fp-mapa-lista" aria-label={locale === 'en' ? 'Works' : 'Obras'}>
              <div className="fp-mapa-cab">
                <p className="fp-mapa-cuenta">{cuenta}</p>
                {seleccionado != null && (
                  <button type="button" className="fp-mapa-todas" data-cursor="" onClick={() => setSeleccionado(null)}>
                    {locale === 'en' ? 'See all' : 'Ver todas'}
                  </button>
                )}
              </div>
              <Lista listados={listados} seleccionado={seleccionado} resaltado={resaltado}
                locale={locale} onElegir={alternar} onResaltar={setResaltado} />
            </nav>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  )
}

// ── Lista ─────────────────────────────────────────────────────────────────────
function Lista({ listados, seleccionado, resaltado, locale, conFoto, onElegir, onResaltar }: {
  listados: MapaPunto[]; seleccionado: number | null; resaltado: number | null
  locale: 'es' | 'en'; conFoto?: boolean
  onElegir: (n: number) => void; onResaltar: (n: number | null) => void
}) {
  return (
    <ol className="fp-mapa-ol">
      {listados.map((p, i) => {
        const n = i + 1
        const sel = seleccionado === n
        const { imagen, descriptor } = datosDeTarjeta(p, locale)
        return (
          <li key={p.id}>
            <button type="button" data-sel={sel ? '1' : undefined} data-res={resaltado === n ? '1' : undefined}
              data-cursor="" aria-current={sel || undefined}
              onClick={() => onElegir(n)}
              // El hover y el foco solo RESALTAN. Mover la cámara con el ratón de
              // paso convertía un gesto sin compromiso en una consecuencia de
              // segundo y medio.
              onMouseEnter={() => onResaltar(n)}
              onMouseLeave={() => onResaltar(null)}
              onFocus={() => onResaltar(n)}
              onBlur={() => onResaltar(null)}>
              {/* Con 22 obras fotografiadas, una miniatura dice en un teléfono lo
                  que ninguna fila de texto puede. Sin foto queda el número, que es
                  el mismo que se pinta en el mapa. */}
              {conFoto
                ? (
                  <span className="fp-mapa-mini">
                    {imagen
                      ? <Img src={imagen} alt="" contexto="miniaturaMapa" />
                      : <span className="fp-mapa-mini-n">{String(n).padStart(2, '0')}</span>}
                  </span>
                )
                : <span className="fp-mapa-n">{String(n).padStart(2, '0')}</span>}
              <span className="fp-mapa-txt">
                <span className="fp-mapa-nombre">{p.nombre}</span>
                {(descriptor || p.anio) && (
                  <span className="fp-mapa-sub">{[descriptor, p.anio].filter(Boolean).join(' · ')}</span>
                )}
              </span>
              {!conFoto && p.anio && <span className="fp-mapa-anio">{p.anio}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Ficha de la lámina: foto grande y ‹ › para recorrer las obras sin volver a la
 *  lista. Es el gesto que convierte el mapa en algo que se hojea con el pulgar. */
function FichaCompacta({ punto, locale, indice, total, onMover, onCerrar, onAbrirLista }: {
  punto: MapaPunto; locale: 'es' | 'en'; indice: number; total: number
  onMover: (paso: 1 | -1) => void; onCerrar: () => void; onAbrirLista: () => void
}) {
  const { imagen, descriptor, slug } = datosDeTarjeta(punto, locale)
  const meta = [descriptor, punto.anio].filter(Boolean).join(' · ')
  return (
    <div className="fp-mapa-fc">
      <div className="fp-mapa-fc-foto">
        {imagen
          ? <Img src={imagen} alt={punto.nombre} contexto="fichaMapa" />
          : <span className="fp-mapa-fc-sinfoto">{String(indice).padStart(2, '0')}</span>}
      </div>
      <div className="fp-mapa-fc-txt">
        <p className="fp-mapa-fc-nombre">{punto.nombre}</p>
        {meta && <p className="fp-mapa-fc-meta">{meta}</p>}
        {slug
          ? <Link href={href(`/proyectos/${slug}`)} className="fp-mapa-fc-link" data-cursor="">{locale === 'en' ? 'View project' : 'Ver proyecto'} →</Link>
          : <button type="button" className="fp-mapa-fc-link" onClick={onAbrirLista}>{locale === 'en' ? 'All works' : 'Todas las obras'} ↑</button>}
        <div className="fp-mapa-fc-nav">
          <button type="button" onClick={() => onMover(-1)} aria-label={locale === 'en' ? 'Previous' : 'Anterior'}>‹</button>
          <span>{indice} / {total}</span>
          <button type="button" onClick={() => onMover(1)} aria-label={locale === 'en' ? 'Next' : 'Siguiente'}>›</button>
        </div>
      </div>
      <button type="button" className="fp-mapa-fc-x" onClick={onCerrar} aria-label={locale === 'en' ? 'Close' : 'Cerrar'}>×</button>
    </div>
  )
}

/** Tarjeta de escritorio, anclada a la esquina del lienzo. */
function Ficha({ punto, locale, onCerrar }: { punto: MapaPunto; locale: 'es' | 'en'; onCerrar: () => void }) {
  const { imagen, descriptor, slug } = datosDeTarjeta(punto, locale)
  const meta = [descriptor, punto.anio].filter(Boolean).join(' · ')
  return (
    <div className="fp-mapa-ficha" data-sinfoto={imagen ? undefined : '1'}>
      <button type="button" className="fp-mapa-cerrar" data-cursor="" aria-label={locale === 'en' ? 'Close' : 'Cerrar'} onClick={onCerrar}>×</button>
      {imagen && (
        <div className="fp-mapa-ficha-foto">
          <Img src={imagen} alt={punto.nombre} contexto="fichaMapa" />
        </div>
      )}
      <div className="fp-mapa-ficha-txt">
        <h2 className="fp-mapa-ficha-nombre">{punto.nombre}</h2>
        {meta && <p className="fp-mapa-ficha-meta">{meta}</p>}
        {punto.direccion && <p className="fp-mapa-ficha-dir">{punto.direccion.replace(/,\s*(Madrid,\s*)?España$/i, '')}</p>}
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
      <img src="/wip/mapa-madrid.png" alt={locale === 'en' ? 'Map of works' : 'Mapa de obras'}
        style={{ maxWidth: 'min(100%, 620px)', height: 'auto', display: 'block', opacity: 0.9 }} />
      <p style={{ fontSize: 10.5, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.42, margin: 0 }}>
        {motivo === 'sin-webgl'
          ? (locale === 'en' ? 'Interactive map unavailable in this browser' : 'El mapa interactivo no está disponible en este navegador')
          : (locale === 'en' ? 'Interactive map coming soon' : 'Mapa interactivo en preparación')}
      </p>
    </div>
  )
}

const CSS = `
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

/* ── Tarjeta de escritorio ─────────────────────────────────────────────── */
.fp-mapa-ficha {
  position: absolute; left: 18px; bottom: 18px; z-index: 3; width: 264px;
  background: ${site.color.cream};
  box-shadow: 0 18px 44px -22px rgba(20,20,20,.55), 0 0 0 1px ${site.color.ink}0f;
  animation: fp-ficha-entra .24s cubic-bezier(.22,1,.36,1) both;
}
@keyframes fp-ficha-entra { from { opacity: 0; transform: translateY(8px); } }
.fp-mapa-ficha-foto { position: relative; width: 100%; aspect-ratio: 16 / 10; overflow: hidden; background: #e7e5df; }
.fp-mapa-ficha-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fp-mapa-ficha-txt { padding: 13px 15px 15px; display: flex; flex-direction: column; gap: 6px; }
.fp-mapa-ficha-nombre { font-size: 15px; font-weight: 400; margin: 0; letter-spacing: -0.01em; }
.fp-mapa-ficha-meta { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .5; margin: 0; }
.fp-mapa-ficha-dir { font-size: 11.5px; font-weight: 300; opacity: .6; margin: 0; }
.fp-mapa-ficha-link {
  margin-top: 5px; font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase;
  color: inherit; text-decoration: none; align-self: flex-start;
  border-bottom: 1px solid ${site.color.ink}33; padding-bottom: 2px;
}
.fp-mapa-cerrar {
  position: absolute; top: 6px; right: 8px; z-index: 2; background: none; border: none;
  cursor: pointer; line-height: 1; font-size: 19px; color: ${site.color.cream};
  text-shadow: 0 1px 5px rgba(0,0,0,.5); padding: 4px 6px;
}
.fp-mapa-ficha[data-sinfoto="1"] .fp-mapa-cerrar { color: ${site.color.ink}; text-shadow: none; }

/* ── Lista ─────────────────────────────────────────────────────────────── */
.fp-mapa-lista { height: clamp(420px, 70vh, 760px); overflow-y: auto; padding-right: 4px; }
.fp-mapa-cab { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.fp-mapa-cuenta { font-size: 10px; letter-spacing: ${site.track.wide}; text-transform: uppercase; opacity: .45; margin: 0; }
.fp-mapa-todas {
  background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; color: inherit;
  font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .55;
  border-bottom: 1px solid ${site.color.ink}30;
}
.fp-mapa-todas:hover, .fp-mapa-todas:focus-visible { opacity: 1; }
.fp-mapa-ol { list-style: none; margin: 0; padding: 0; }
.fp-mapa-ol li { border-bottom: 1px solid ${site.color.ink}0f; }
.fp-mapa-ol button {
  display: grid; grid-template-columns: 3.2ch 1fr auto; gap: 12px; align-items: baseline;
  width: 100%; padding: 11px 0; background: none; border: none; cursor: pointer;
  font-family: inherit; color: inherit; text-align: left; opacity: .72;
  transition: opacity .25s ${site.ease};
}
.fp-mapa-ol button:hover, .fp-mapa-ol button[data-res], .fp-mapa-ol button[data-sel] { opacity: 1; }
.fp-mapa-ol button:focus-visible { outline: 1px solid ${site.color.ink}; outline-offset: 2px; }
.fp-mapa-n { font-size: 10.5px; font-variant-numeric: tabular-nums; opacity: .4; letter-spacing: .1em; }
.fp-mapa-nombre { font-size: 13.5px; font-weight: 300; display: block; }
.fp-mapa-ol button[data-sel] .fp-mapa-nombre { font-weight: 400; }
.fp-mapa-sub { display: none; }
.fp-mapa-anio { font-size: 10.5px; opacity: .4; font-variant-numeric: tabular-nums; }

/* ── Móvil ─────────────────────────────────────────────────────────────── */
.fp-mapa-hoja, .fp-mapa-pc-btn { display: none; }

@media (max-width: 900px) {
  /* El mapa deja de ser un recuadro DENTRO de la página y pasa a ser la página:
     a sangre de lado a lado y ocupando casi todo el alto. Un mapa de 340 px con
     34 filas de texto debajo no es un mapa con lista, es una lista con un mapa de
     adorno — y aquí el 95% de las visitas llegan desde un teléfono. */
  .fp-mapa-grid { display: block; }
  .fp-mapa-caja {
    height: min(74dvh, calc(100dvh - 168px));
    margin-left: calc(-1 * ${site.gutter});
    margin-right: calc(-1 * ${site.gutter});
    border-left: none; border-right: none;
  }
  .fp-mapa-intro { display: none; }   /* el sitio de un párrafo largo no es este */
  .fp-mapa-header { margin-bottom: 18px !important; }
  .fp-mapa-lista { display: none; }   /* en móvil la lista vive dentro de la lámina */

  /* Pantalla completa: el mapa se despega de la página, y solo entonces un dedo
     puede moverlo sin robarle el scroll a nadie. */
  .fp-mapa-pc .fp-mapa-caja {
    position: fixed; inset: 0; z-index: 70; height: auto; margin: 0; border: none;
  }
  .fp-mapa-pc-btn {
    display: flex; align-items: center; justify-content: center;
    position: absolute; top: 12px; right: 12px; z-index: 6;
    width: 38px; height: 38px; border-radius: 50%;
    background: ${site.color.cream}; border: 1px solid ${site.color.ink}14;
    box-shadow: 0 6px 18px -8px rgba(20,20,20,.5);
    font-size: 15px; line-height: 1; color: ${site.color.ink}; cursor: pointer;
  }

  /* ── La lámina ───────────────────────────────────────────────────────── */
  .fp-mapa-hoja {
    display: flex; flex-direction: column;
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
    /* Mide siempre lo mismo; lo que cambia es cuánto se baja. Los porcentajes de
       DETENTES van referidos a esta altura, así que fijarla aquí es lo que hace
       que el recorrido de la lámina no dependa de ninguna medida en JavaScript. */
    height: 94%;
    background: ${site.color.cream};
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -14px 40px -20px rgba(20,20,20,.5);
    will-change: transform;
  }
  .fp-mapa-asa {
    flex: none; height: 26px; display: flex; align-items: center; justify-content: center;
    cursor: grab;
    /* El asa se queda el gesto vertical. Sin esto el navegador lo interpreta como
       scroll de la página y la lámina no se mueve. */
    touch-action: none;
  }
  .fp-mapa-asa span { width: 38px; height: 4px; border-radius: 2px; background: ${site.color.ink}22; display: block; }

  .fp-mapa-hoja-cab {
    flex: none; display: flex; align-items: baseline; justify-content: space-between;
    padding: 0 ${site.gutter} 12px; background: none; border: none; width: 100%;
    font-family: inherit; color: inherit; cursor: pointer;
  }
  .fp-mapa-pista { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .45; }

  .fp-mapa-hoja-lista {
    flex: 1; min-height: 0; overflow-y: auto;
    padding: 0 ${site.gutter} 20px;
    /* Que el rebote de la lista no arrastre la página de detrás. */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  /* Filas con miniatura y 56 px de alto: eso es un dedo, no un puntero. */
  .fp-mapa-hoja-lista .fp-mapa-ol button {
    grid-template-columns: 56px 1fr; gap: 14px; align-items: center;
    padding: 9px 0; opacity: 1;
  }
  .fp-mapa-mini {
    width: 56px; height: 42px; border-radius: 3px; overflow: hidden; background: #e7e5df;
    display: flex; align-items: center; justify-content: center;
  }
  .fp-mapa-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fp-mapa-mini-n { font-size: 11px; opacity: .35; font-variant-numeric: tabular-nums; }
  .fp-mapa-hoja-lista .fp-mapa-nombre { font-size: 15px; font-weight: 400; }
  .fp-mapa-hoja-lista .fp-mapa-sub {
    display: block; font-size: 10px; letter-spacing: ${site.track.tight};
    text-transform: uppercase; opacity: .45; margin-top: 3px;
  }
  .fp-mapa-hoja-lista .fp-mapa-anio { display: none; }
  .fp-mapa-hoja-lista .fp-mapa-ol button[data-sel] {
    /* Marcada con un filete al canto y no con un fondo: un fondo compite con las
       fotos, que es justo lo que aquí tiene que mandar. */
    box-shadow: inset 3px 0 0 ${site.color.ink};
    padding-left: 12px; margin-left: -12px;
  }

  /* ── Ficha dentro de la lámina ───────────────────────────────────────── */
  .fp-mapa-fc {
    flex: none; position: relative;
    display: grid; grid-template-columns: 128px 1fr; gap: 14px;
    padding: 0 ${site.gutter} 16px;
  }
  .fp-mapa-fc-foto {
    width: 128px; aspect-ratio: 4 / 3; border-radius: 3px; overflow: hidden; background: #e7e5df;
    display: flex; align-items: center; justify-content: center;
  }
  .fp-mapa-fc-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fp-mapa-fc-sinfoto { font-size: 15px; opacity: .3; font-variant-numeric: tabular-nums; }
  .fp-mapa-fc-txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-right: 22px; }
  .fp-mapa-fc-nombre { font-size: 17px; font-weight: 400; margin: 0; letter-spacing: -0.01em; }
  .fp-mapa-fc-meta { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .5; margin: 0; }
  .fp-mapa-fc-link {
    margin-top: 4px; align-self: flex-start; background: none; border: none; padding: 0 0 2px;
    font-family: inherit; font-size: 10px; letter-spacing: ${site.track.normal};
    text-transform: uppercase; color: inherit; text-decoration: none; cursor: pointer;
    border-bottom: 1px solid ${site.color.ink}33;
  }
  .fp-mapa-fc-nav { display: flex; align-items: center; gap: 14px; margin-top: auto; padding-top: 8px; }
  .fp-mapa-fc-nav button {
    width: 34px; height: 34px; border-radius: 50%; border: 1px solid ${site.color.ink}18;
    background: none; font-size: 17px; line-height: 1; color: inherit; cursor: pointer;
    font-family: inherit;
  }
  .fp-mapa-fc-nav span { font-size: 10.5px; opacity: .45; font-variant-numeric: tabular-nums; }
  .fp-mapa-fc-x {
    position: absolute; top: -4px; right: calc(${site.gutter} - 6px);
    background: none; border: none; font-size: 20px; line-height: 1; color: ${site.color.ink};
    opacity: .4; cursor: pointer; padding: 4px 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fp-mapa-ficha { animation: none; }
  .fp-mapa-hoja { transition: none !important; }
}
`

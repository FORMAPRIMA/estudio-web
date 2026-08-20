'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Img } from '../Img'
import { pick, type ContentMap } from '@/lib/web-publica'
import {
  datosDeTarjeta, tieneCoordenadas, ordenarPorSede, sedesConObra, sedeDe, etiquetaSede,
  SIN_MARGENES, SEDE_CASA, type MapaPunto, type Margenes, type SedeCodigo,
} from '@/lib/web-mapa'

// mapbox-gl solo se descarga cuando esta página se monta.
const MapaLienzo = dynamic(() => import('./MapaLienzo'), { ssr: false })

/**
 * Cuánto asoma la lámina en cada detención, EN UNIDADES CSS y no en píxeles
 * medidos. Los porcentajes van referidos a la propia lámina, cuya altura la fija
 * el CSS con `top` y `bottom`; así el navegador resuelve las alturas solo y no
 * hace falta medir nada para pintar. La primera versión dependía de un
 * ResizeObserver, y una medida que llega tarde —o que no llega— dejaba la lámina
 * sin recorrido: se podía abrir y no pasaba nada.
 *
 * `ficha` es la que aparece con una obra elegida: cabe la foto y el mapa sigue
 * siendo lo que más se ve, que es de lo que va esta pantalla.
 */
const DETENTES = {
  peek:  '52px',
  ficha: '200px',
  medio: '57.4%',
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

/**
 * La rejilla de la pantalla, en píxeles y para la CÁMARA. El CSS tiene sus propias
 * variables con los mismos nombres; estas son las que se le pasan a Mapbox como
 * `padding`, y ahí no valen `clamp()` ni porcentajes.
 *
 * `TOPE` es el alto exacto del header del sitio (SiteNav): es lo que hace que las
 * ventanas floten POR DEBAJO del isotipo y del menú respetando su margen, en vez
 * de pelearse con ellos.
 */
const TOPE = 72
/** Aire entre el header y las ventanas, y de las ventanas al suelo. */
const AIRE = 20
/** Lo que separa la lámina de los cantos en móvil, para que se lea como ventana. */
const HUECO = 8

export function MapaPage({ content, puntos }: { content: ContentMap; puntos: MapaPunto[] }) {
  const { locale, mobile } = useSite()

  // DOS estados, no uno. El hover solo enciende; el clic viaja. Cuando los dos
  // compartían variable, rozar la lista con el ratón disparaba un vuelo de cámara.
  const [resaltado, setResaltado] = useState<number | null>(null)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [fallo, setFallo] = useState(false)

  const [esMovil, setEsMovil] = useState(false)
  const [detente, setDetente] = useState<Detente>('peek')
  const [plegado, setPlegado] = useState(false)
  /** Contador: cada incremento pide al lienzo el encuadre general de `sede`. */
  const [reencuadre, setReencuadre] = useState(0)
  /** La sede que se está mirando. Arranca en casa —España— siempre. */
  const [sede, setSede] = useState<SedeCodigo>(SEDE_CASA)
  /** Durante el arrastre, los píxeles que asoma. Fuera de él, null y manda el CSS. */
  const [arrastre, setArrastre] = useState<number | null>(null)
  const hojaRef = useRef<HTMLDivElement>(null)
  const indiceRef = useRef<HTMLElement>(null)
  const fichaRef = useRef<HTMLDivElement>(null)

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })

  // useMemo NO es una optimización aquí, es corrección: sin él este filtro devuelve
  // un array nuevo en cada render, el lienzo lo ve como un prop distinto y vuelve a
  // ejecutar su efecto de encuadre inicial, que devolvía la cámara al plano general.
  //
  // Ordenado por sede: es el array del que sale la NUMERACIÓN —el número del punto
  // en el mapa es su índice aquí, y el de la lista también— así que agrupar por país
  // agrupa los números solo, sin romper que las dos series sean la misma.
  const listados = useMemo(() => ordenarPorSede(puntos.filter(tieneCoordenadas)), [puntos])
  const total = listados.length
  /** Solo las sedes que tienen obra. Con todo en Madrid es una, y el conmutador ni
   *  se pinta: la pantalla queda exactamente como estaba. */
  const sedes = useMemo(() => sedesConObra(listados), [listados])

  /**
   * El mapa manda de verdad. Es lo que enciende la pantalla completa —sin scroll y
   * sin footer— y por eso NO se da por hecho: sin WebGL, sin token o sin ningún
   * punto geocodificado el atributo no se pone y la página vuelve sola al documento
   * de siempre, con su plano estático. Una pantalla completa vacía no es un
   * respaldo, es un agujero.
   */
  const inmersivo = !fallo && total > 0

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
   * El hueco visible del lienzo: lo que queda cuando se descuentan el header y las
   * ventanas flotantes. Mapbox lo necesita en píxeles para centrar ahí y no en el
   * centro geométrico — sin esto, la obra a la que vuelas aterriza debajo del
   * índice o debajo de la ficha y parece que no ha pasado nada.
   *
   * Se MIDEN las ventanas en vez de calcularlas: sus anchos son `clamp()` y el
   * margen lateral del sitio también, así que reproducir aquí esa aritmética sería
   * tener dos fuentes de verdad condenadas a discrepar. Medir es seguro porque
   * esto solo alimenta a la cámara: no pinta nada, así que una medida que llega
   * tarde reencuadra un poco después, no deja la pantalla rota.
   */
  const [margenes, setMargenes] = useState<Margenes>(SIN_MARGENES)
  const medir = useCallback(() => {
    const ancho = window.innerWidth
    const nuevo: Margenes = esMovil
      ? { top: TOPE, right: 0, bottom: pxDe(detente) + HUECO, left: 0 }
      : {
          top: TOPE + AIRE,
          left: Math.round(indiceRef.current?.getBoundingClientRect().right ?? 0) + AIRE,
          right: fichaRef.current
            ? Math.round(ancho - fichaRef.current.getBoundingClientRect().left) + AIRE
            : AIRE,
          bottom: AIRE,
        }
    // Sin esta comparación, cada medida crearía un objeto nuevo, el estado
    // cambiaría siempre y el efecto se realimentaría sin parar.
    setMargenes((prev) =>
      prev.top === nuevo.top && prev.right === nuevo.right &&
      prev.bottom === nuevo.bottom && prev.left === nuevo.left ? prev : nuevo)
  }, [esMovil, detente, pxDe])

  // `useLayoutEffect` y no `useEffect`: se mide después de que el navegador haya
  // colocado la ficha que acaba de entrar, pero antes de pintar.
  useLayoutEffect(() => {
    if (!inmersivo) return
    medir()
    const ro = new ResizeObserver(medir)
    if (indiceRef.current) ro.observe(indiceRef.current)
    if (fichaRef.current) ro.observe(fichaRef.current)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [medir, inmersivo, seleccionado, plegado])

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

  // Escape cierra la ficha. Una ventana que solo se cierra con la × del ratón es
  // una ventana que no se puede cerrar con el teclado.
  useEffect(() => {
    if (seleccionado == null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSeleccionado(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seleccionado])

  const onFallo = useCallback(() => setFallo(true), [])
  const alternar = useCallback((n: number | null) => {
    setSeleccionado((prev) => (prev === n ? null : n))
  }, [])
  /** Recorre la lista dando la vuelta al final. */
  const mover = (paso: 1 | -1) => {
    if (seleccionado == null || !total) return
    setSeleccionado(((seleccionado - 1 + paso + total) % total) + 1)
  }
  /** «Ver todas»: soltar la obra Y volver al plano general de la sede que se mira.
   *  Son dos cosas, y la segunda no tenía hasta ahora ninguna puerta. */
  const verTodas = () => { setSeleccionado(null); setReencuadre((n) => n + 1) }
  /** Cambiar de sede mueve la cámara y lleva la lista a su grupo. Las dos cosas: un
   *  conmutador que solo hiciera una de ellas dejaría la mitad de la pantalla
   *  hablando de otro país. */
  const irASede = (s: SedeCodigo) => {
    setSede(s)
    setSeleccionado(null)
    setReencuadre((n) => n + 1)
    const id = `${esMovil ? 'hoja' : 'indice'}-sede-${s}`
    // Tras el render, que es cuando el título del grupo existe en su sitio.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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

  // ── Respaldo: sin mapa, la página es un documento normal ────────────────────
  if (!inmersivo) {
    return (
      <main className="fp-mapa" style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink,
        minHeight: '100dvh', padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
        <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
          <header style={{ marginBottom: 'clamp(30px, 5vh, 54px)' }}>
            {eyebrow && <p style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</p>}
            {titulo && <h1 style={{ fontSize: display.hero, fontWeight: 300, lineHeight: 1.2, margin: 0, maxWidth: '22ch' }}>{titulo}</h1>}
            {intro && <p style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '56ch', whiteSpace: 'pre-wrap' }}>{intro}</p>}
          </header>
          <Respaldo locale={locale} motivo={total === 0 ? 'sin-datos' : 'sin-webgl'} />
          {total > 0 && (
            <nav className="fp-mapa-doc-lista" aria-label={locale === 'en' ? 'Works' : 'Obras'}>
              <p className="fp-mapa-cuenta">{cuenta}</p>
              <Lista listados={listados} seleccionado={null} resaltado={null}
                locale={locale} sedes={sedes} idPrefijo="doc"
                onElegir={() => {}} onResaltar={() => {}} />
            </nav>
          )}
        </div>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </main>
    )
  }

  // ── Pantalla inmersiva ──────────────────────────────────────────────────────
  return (
    <main className="fp-mapa" data-inmersivo="1"
      style={{ fontFamily: site.font, background: '#eceae5', color: site.color.ink,
        // Lo que asoma la lámina, en píxeles, para que la atribución de Mapbox se
        // suba por encima de ella. Es requisito de uso: no puede quedar tapada.
        ['--fp-asomo' as string]: `${margenes.bottom}px` }}>

      <MapaLienzo puntos={listados} resaltado={resaltado} seleccionado={seleccionado}
        onResaltar={setResaltado} onSeleccionar={alternar} onFallo={onFallo}
        margenes={margenes} reencuadre={reencuadre} sedeEncuadre={sede} />

      {/* El isotipo y el menú son negros sobre lo que haya debajo, y debajo hay
          una ciudad que a veces es una manzana oscura. Este velo es lo que les
          devuelve el suelo sin tocar SiteNav ni ponerle una banda. */}
      <div className="fp-mapa-velo" aria-hidden="true" />

      {/* ── Ventana de índice ─────────────────────────────────────────────── */}
      <aside ref={indiceRef} className="fp-mapa-indice" data-plegado={plegado ? '1' : undefined}
        aria-label={locale === 'en' ? 'Works' : 'Obras'}>
        <div className="fp-mapa-indice-titulo">
          {eyebrow && <p className="fp-mapa-eyebrow">{eyebrow}</p>}
          {titulo && <h1 className="fp-mapa-h1">{titulo}</h1>}
          {intro && !punto && <p className="fp-mapa-intro">{intro}</p>}
        </div>

        <div className="fp-mapa-barra">
          <p className="fp-mapa-cuenta">{cuenta}</p>
          <div className="fp-mapa-barra-acc">
            <button type="button" className="fp-mapa-mini-btn" data-cursor="" onClick={verTodas}>
              {locale === 'en' ? 'See all' : 'Ver todas'}
            </button>
            <button type="button" className="fp-mapa-mini-btn" data-cursor=""
              aria-expanded={!plegado} onClick={() => setPlegado((v) => !v)}>
              {plegado
                ? (locale === 'en' ? 'Show' : 'Mostrar')
                : (locale === 'en' ? 'Hide' : 'Ocultar')}
            </button>
          </div>
        </div>

        <Sedes sedes={sedes} activa={sede} locale={locale} onIr={irASede} />

        <div className="fp-mapa-indice-cuerpo">
          <Lista listados={listados} seleccionado={seleccionado} resaltado={resaltado}
            locale={locale} sedes={sedes} idPrefijo="indice"
            onElegir={alternar} onResaltar={setResaltado} />
        </div>
      </aside>

      {/* ── Ventana de ficha (escritorio) ─────────────────────────────────────
          Anclada al LIENZO y no a la coordenada: un Popup de Mapbox cruzaría la
          pantalla nadando durante la órbita, y con 63° de cabeceo los que caen al
          horizonte se empequeñecen. En móvil su sitio es la lámina. */}
      {punto && !esMovil && (
        <Ficha refCaja={fichaRef} punto={punto} locale={locale} indice={seleccionado!} total={total}
          onMover={mover} onCerrar={() => setSeleccionado(null)} />
      )}

      {/* ── Lámina (móvil) ────────────────────────────────────────────────── */}
      <div className="fp-mapa-hoja" ref={hojaRef} style={{
        // El navegador resuelve el recorrido solo: la lámina mide siempre lo mismo
        // y solo cambia cuánto se baja.
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

        {/* El área que scrollea es solo la VISIBLE. Si la lista midiera la lámina
            entera, al arrastrar hacia arriba aparecería ya desplazada por dentro. */}
        <div className="fp-mapa-hoja-lista"
          style={{ maxHeight: `calc(${asoma} - ${punto ? DETENTES.ficha : `${CABECERA}px`})` }}>
          {/* En móvil el conmutador va DENTRO del área que scrollea, y no en la
              cabecera: la cabecera mide exactamente los 52 px de la detención en
              reposo, y meterle una fila más partiría el recorrido de la lámina. */}
          <Sedes sedes={sedes} activa={sede} locale={locale} onIr={irASede} />
          <Lista listados={listados} seleccionado={seleccionado} resaltado={resaltado}
            locale={locale} sedes={sedes} idPrefijo="hoja"
            onElegir={alternar} onResaltar={setResaltado} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  )
}

/**
 * Conmutador de sedes. Con una sola sede no se pinta: el estudio empezó en Madrid
 * y la pantalla no tiene por qué anunciar una geografía que no existe todavía.
 */
function Sedes({ sedes, activa, locale, onIr }: {
  sedes: SedeCodigo[]; activa: SedeCodigo; locale: 'es' | 'en'; onIr: (s: SedeCodigo) => void
}) {
  if (sedes.length < 2) return null
  return (
    <nav className="fp-mapa-sedes" aria-label={locale === 'en' ? 'Places' : 'Sedes'}>
      {sedes.map((s) => (
        <button key={s} type="button" data-cursor="" data-activa={s === activa ? '1' : undefined}
          aria-current={s === activa || undefined} onClick={() => onIr(s)}>
          {etiquetaSede(s, locale)}
        </button>
      ))}
    </nav>
  )
}

// ── Lista ─────────────────────────────────────────────────────────────────────
// Un <canvas> es invisible para Google y para un lector de pantalla, y hay quien
// no tiene WebGL. Esta lista resuelve las tres cosas y es cómoda con teclado: no
// es un adorno del mapa, es su otra mitad.
//
// No FILTRA por sede, agrupa. Un índice enseña el archivo entero; lo que hace el
// conmutador es llevarte a un sitio de él, no esconderte el resto.
function Lista({ listados, seleccionado, resaltado, locale, sedes, idPrefijo, onElegir, onResaltar }: {
  listados: MapaPunto[]; seleccionado: number | null; resaltado: number | null
  locale: 'es' | 'en'; sedes: SedeCodigo[]
  /** La lista se pinta dos veces —índice y lámina—, así que los anclas de grupo
   *  necesitan prefijo: dos elementos con el mismo id no se pueden desplazar. */
  idPrefijo: string
  onElegir: (n: number) => void; onResaltar: (n: number | null) => void
}) {
  let sedePrevia: SedeCodigo | null = null
  return (
    <ol className="fp-mapa-ol">
      {listados.map((p, i) => {
        const n = i + 1
        const sel = seleccionado === n
        const { imagen, descriptor } = datosDeTarjeta(p, locale)
        const s = sedeDe(p)
        const abreGrupo = sedes.length > 1 && s !== sedePrevia
        sedePrevia = s
        return (
          <li key={p.id} data-grupo={abreGrupo ? '1' : undefined}>
            {abreGrupo && (
              <p className="fp-mapa-sede-tit" id={`${idPrefijo}-sede-${s}`}>{etiquetaSede(s, locale)}</p>
            )}
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
              {/* Sobre un mapa, una miniatura identifica una obra antes que
                  cualquier fila de texto. Sin foto queda el número, que es el
                  mismo que se pinta en el punto. */}
              <span className="fp-mapa-mini">
                {imagen
                  ? <Img src={imagen} alt="" contexto="miniaturaMapa" />
                  : <span className="fp-mapa-mini-n">{String(n).padStart(2, '0')}</span>}
              </span>
              <span className="fp-mapa-txt">
                <span className="fp-mapa-nombre">{p.nombre}</span>
                {(descriptor || p.anio) && (
                  <span className="fp-mapa-sub">{[descriptor, p.anio].filter(Boolean).join(' · ')}</span>
                )}
              </span>
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

/**
 * Ventana de la obra elegida (escritorio). Va a la derecha, alineada con el menú,
 * mientras el índice se queda a la izquierda alineado con el isotipo: se puede
 * mirar una obra sin perder de vista dónde cae dentro de las demás.
 *
 * Recibe la ref de su caja porque su ancho es lo que le dice a la cámara cuánto
 * lienzo tiene tapado por ese lado. Va como prop con nombre propio y no como
 * `ref`: en React 18 `ref` no es una prop y llegaría vacía.
 */
function Ficha({ punto, locale, indice, total, onMover, onCerrar, refCaja }: {
  punto: MapaPunto; locale: 'es' | 'en'; indice: number; total: number
  onMover: (paso: 1 | -1) => void; onCerrar: () => void
  refCaja: React.RefObject<HTMLDivElement>
}) {
  const { imagen, descriptor, slug } = datosDeTarjeta(punto, locale)
  const meta = [descriptor, punto.anio].filter(Boolean).join(' · ')
  return (
    <div ref={refCaja} className="fp-mapa-ficha" data-sinfoto={imagen ? undefined : '1'}
      aria-label={locale === 'en' ? 'Selected work' : 'Obra seleccionada'}>
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
        <div className="fp-mapa-ficha-nav">
          <button type="button" data-cursor="" onClick={() => onMover(-1)} aria-label={locale === 'en' ? 'Previous' : 'Anterior'}>‹</button>
          <span>{indice} / {total}</span>
          <button type="button" data-cursor="" onClick={() => onMover(1)} aria-label={locale === 'en' ? 'Next' : 'Siguiente'}>›</button>
        </div>
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
/* ── La pantalla ───────────────────────────────────────────────────────────
   El mapa deja de ser una figura dentro de un artículo y pasa a ser la página:
   a sangre, de canto a canto, con el contenido montado encima. Solo cuando el
   mapa está vivo (data-inmersivo): si cae al plano estático, esto no aplica y
   la página vuelve a ser un documento con su scroll y su footer. */
.fp-mapa[data-inmersivo="1"] {
  --fp-tope: 72px;                       /* alto exacto de SiteNav */
  --fp-aire: clamp(14px, 1.8vh, 24px);
  --fp-margen: ${site.gutter};           /* el mismo gutter que el header */
  --fp-hueco: 8px;
  /* Las ventanas nunca tapan la atribución de Mapbox (abajo) ni el control de
     zoom (abajo a la derecha): son requisito de uso y de manejo. */
  --fp-alto-izq: calc(100dvh - var(--fp-tope) - var(--fp-aire) * 2 - 34px);
  --fp-alto-der: calc(100dvh - var(--fp-tope) - var(--fp-aire) * 2 - 116px);

  position: relative;
  height: 100dvh;
  overflow: hidden;
}

/* Pantalla única: ni scroll de documento ni footer. En CSS y no con una clase
   puesta desde un efecto, para que no haya un fotograma de página larga antes de
   la hidratación. */
html:has(.fp-mapa[data-inmersivo="1"])            { overflow: hidden; overscroll-behavior: none; }
.fp-site:has(.fp-mapa[data-inmersivo="1"]) footer { display: none; }

.fp-mapa-lienzo { position: absolute; inset: 0; z-index: 0; }

/* El velo del salto largo. Tapa el MAPA y nada más: el índice y la ficha se quedan
   quietos mientras cambia el suelo. Cruzar un océano con la cámara pedía teselas de
   todo lo sobrevolado y el mapa se veía deshacerse; ahora se funde, se salta y no se
   destapa hasta que el destino está servido. */
.fp-mapa-corte {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: ${site.color.cream};
  opacity: 0; transition: opacity .38s ${site.ease};
}
.fp-mapa-corte[data-visible="1"] { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .fp-mapa-corte { transition: none; }
}

/* El suelo del header. Sin él, el isotipo negro desaparece cuando debajo pasa
   una manzana en sombra. */
.fp-mapa-velo {
  position: absolute; top: 0; left: 0; right: 0; height: 132px; z-index: 1;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(244,243,240,.72), rgba(244,243,240,0));
}

/* Los controles de Mapbox, en la tinta del sitio y sin su cromo de serie. */
.fp-mapa[data-inmersivo="1"] .mapboxgl-ctrl-group {
  background: rgba(244,243,240,.86);
  box-shadow: 0 10px 30px -18px rgba(20,20,20,.6), 0 0 0 1px rgba(20,20,20,.10);
  border-radius: 2px;
}

/* ── Superficie común de las ventanas ──────────────────────────────────────
   Cantos rectos y filete de pelo: el sitio es editorial, no un panel de control.
   El desenfoque hace que el mapa siga estando debajo sin robarle legibilidad al
   texto. */
.fp-mapa-indice, .fp-mapa-ficha {
  position: absolute; z-index: 12;
  top: calc(var(--fp-tope) + var(--fp-aire));
  background: rgba(244,243,240,.86);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid rgba(20,20,20,.10);
  border-radius: 2px;
  box-shadow: 0 26px 60px -34px rgba(20,20,20,.6);
}
/* Sin desenfoque, texto negro sobre la ciudad. El crema opaco no es un adorno. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .fp-mapa-indice, .fp-mapa-ficha { background: ${site.color.cream}; }
}

/* ── Ventana de índice ─────────────────────────────────────────────────────
   Su canto izquierdo cae exactamente bajo el isotipo: las dos piezas usan el
   mismo gutter, así que la alineación no hay que perseguirla. */
.fp-mapa-indice {
  left: var(--fp-margen);
  width: clamp(268px, 21vw, 322px);
  max-height: var(--fp-alto-izq);
  display: flex; flex-direction: column;
  animation: fp-ventana-entra .3s cubic-bezier(.22,1,.36,1) both;
}
.fp-mapa-indice-titulo { flex: none; padding: 18px 18px 0; }
.fp-mapa-eyebrow {
  font-size: 9.5px; letter-spacing: ${site.track.ultra}; text-transform: uppercase;
  color: ${site.color.accent}; margin: 0 0 9px;
}
.fp-mapa-h1 {
  font-size: clamp(1.05rem, 1.5vw, 1.45rem); font-weight: 300; line-height: 1.22;
  letter-spacing: -0.01em; margin: 0;
}
.fp-mapa-intro {
  font-size: 12px; font-weight: 300; line-height: 1.55; opacity: .62; margin: 10px 0 0;
  white-space: pre-wrap;
  /* Cuatro líneas: la ventana es del índice, no del texto de presentación. */
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden;
}
.fp-mapa-barra {
  flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  padding: 14px 18px 12px; border-bottom: 1px solid rgba(20,20,20,.09);
}
.fp-mapa-barra-acc { display: flex; align-items: baseline; gap: 12px; }
.fp-mapa-cuenta {
  font-size: 10px; letter-spacing: ${site.track.wide}; text-transform: uppercase;
  opacity: .45; margin: 0;
}
.fp-mapa-mini-btn {
  background: none; border: none; padding: 0 0 2px; cursor: pointer; font-family: inherit;
  color: inherit; font-size: 10px; letter-spacing: ${site.track.normal};
  text-transform: uppercase; opacity: .55; border-bottom: 1px solid rgba(20,20,20,.30);
  transition: opacity .2s ${site.ease};
}
.fp-mapa-mini-btn:hover, .fp-mapa-mini-btn:focus-visible { opacity: 1; }
.fp-mapa-indice-cuerpo {
  flex: 1; min-height: 0; overflow-y: auto; padding: 4px 18px 14px;
  overscroll-behavior: contain;
}

/* ── Sedes ─────────────────────────────────────────────────────────────── */
.fp-mapa-sedes {
  flex: none; display: flex; flex-wrap: wrap; gap: 4px 14px;
  padding: 10px 18px 11px; border-bottom: 1px solid rgba(20,20,20,.09);
}
.fp-mapa-sedes button {
  background: none; border: none; padding: 0 0 2px; cursor: pointer; font-family: inherit;
  color: inherit; font-size: 9.5px; letter-spacing: ${site.track.normal};
  text-transform: uppercase; opacity: .42; border-bottom: 1px solid transparent;
  transition: opacity .2s ${site.ease};
}
.fp-mapa-sedes button:hover, .fp-mapa-sedes button:focus-visible { opacity: .8; }
.fp-mapa-sedes button[data-activa] { opacity: 1; border-bottom-color: ${site.color.ink}; }

/* Título de grupo. Pegado al scroll: recorriendo 26 obras de Madrid siempre se sabe
   en qué país se está. */
.fp-mapa-sede-tit {
  position: sticky; top: 0; z-index: 1;
  margin: 0 0 2px; padding: 9px 0 6px;
  background: ${site.color.cream};
  font-size: 9.5px; letter-spacing: ${site.track.wide}; text-transform: uppercase;
  opacity: .42;
}
.fp-mapa-ol li[data-grupo] { border-top: none; }
/* Plegada: queda la pastilla del contador. Lo que se pide siempre en cuanto algo
   flota sobre un mapa es poder ver el mapa entero. */
.fp-mapa-indice[data-plegado="1"] { width: auto; }
.fp-mapa-indice[data-plegado="1"] .fp-mapa-indice-titulo,
.fp-mapa-indice[data-plegado="1"] .fp-mapa-sedes,
.fp-mapa-indice[data-plegado="1"] .fp-mapa-indice-cuerpo { display: none; }
/* Con conmutador debajo, el filete de la barra sobra: serían dos rayas juntas. */
.fp-mapa-barra:has(+ .fp-mapa-sedes) { border-bottom: none; }
.fp-mapa-indice[data-plegado="1"] .fp-mapa-barra { border-bottom: none; padding: 13px 16px; }

/* ── Ventana de ficha (escritorio) ─────────────────────────────────────────
   Canto derecho alineado con el menú, por la misma razón que el índice con el
   isotipo. */
.fp-mapa-ficha {
  right: var(--fp-margen);
  width: clamp(280px, 23vw, 344px);
  max-height: var(--fp-alto-der);
  overflow-y: auto; overscroll-behavior: contain;
  animation: fp-ficha-entra .26s cubic-bezier(.22,1,.36,1) both;
}
@keyframes fp-ventana-entra { from { opacity: 0; transform: translateY(8px); } }
@keyframes fp-ficha-entra   { from { opacity: 0; transform: translateX(10px); } }
/* La foto manda su proporción, la ventana se adapta.
   Antes había un 16/10 fijo con object-fit: cover, y eso recortaba cada foto que no
   fuera apaisada — un interior en vertical perdía el techo y el suelo. No hace falta
   medir nada ni esperar al load: <Img> ya emite width/height de la imagen real
   cuando está en el manifiesto, así que el navegador reserva el hueco exacto y no
   hay salto de maquetación.
   El techo de 52vh es solo para que una vertical muy alta no se coma la pantalla;
   ahí object-fit: contain encaja sin recortar, que es de lo que se trata. */
.fp-mapa-ficha-foto { position: relative; width: 100%; overflow: hidden; background: #e7e5df; }
.fp-mapa-ficha-foto img,
.fp-mapa-ficha-foto picture { width: 100%; height: auto; display: block; max-height: 52vh; object-fit: contain; }
.fp-mapa-ficha-txt { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; }
.fp-mapa-ficha-nombre { font-size: 15px; font-weight: 400; margin: 0; letter-spacing: -0.01em; }
.fp-mapa-ficha-meta { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .5; margin: 0; }
.fp-mapa-ficha-dir { font-size: 11.5px; font-weight: 300; opacity: .6; margin: 0; }
.fp-mapa-ficha-link {
  margin-top: 5px; font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase;
  color: inherit; text-decoration: none; align-self: flex-start;
  border-bottom: 1px solid rgba(20,20,20,.20); padding-bottom: 2px;
}
/* Con las dos ventanas a la vista, hojear las obras desde la ficha es el gesto
   natural: el índice va marcando por dónde vas. */
.fp-mapa-ficha-nav {
  display: flex; align-items: center; gap: 12px; margin-top: 12px;
  padding-top: 11px; border-top: 1px solid rgba(20,20,20,.09);
}
.fp-mapa-ficha-nav button {
  width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(20,20,20,.14);
  background: none; font-size: 15px; line-height: 1; color: inherit; cursor: pointer;
  font-family: inherit; transition: background .2s ${site.ease};
}
.fp-mapa-ficha-nav button:hover { background: rgba(20,20,20,.06); }
.fp-mapa-ficha-nav span { font-size: 10px; opacity: .45; font-variant-numeric: tabular-nums; }
.fp-mapa-cerrar {
  position: absolute; top: 6px; right: 8px; z-index: 2; background: none; border: none;
  cursor: pointer; line-height: 1; font-size: 19px; color: ${site.color.cream};
  text-shadow: 0 1px 5px rgba(0,0,0,.5); padding: 4px 6px;
}
.fp-mapa-ficha[data-sinfoto="1"] .fp-mapa-cerrar { color: ${site.color.ink}; text-shadow: none; }

/* ── Lista ─────────────────────────────────────────────────────────────────
   Filas con miniatura también en escritorio: sobre un mapa la foto identifica
   una obra mucho antes que una fila de texto. */
.fp-mapa-ol { list-style: none; margin: 0; padding: 0; }
.fp-mapa-ol li + li { border-top: 1px solid rgba(20,20,20,.08); }
.fp-mapa-ol button {
  display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: center;
  width: 100%; padding: 8px 0; background: none; border: none; cursor: pointer;
  font-family: inherit; color: inherit; text-align: left; opacity: .74;
  transition: opacity .25s ${site.ease};
}
.fp-mapa-ol button:hover, .fp-mapa-ol button[data-res], .fp-mapa-ol button[data-sel] { opacity: 1; }
.fp-mapa-ol button:focus-visible { outline: 1px solid ${site.color.ink}; outline-offset: 2px; }
.fp-mapa-ol button[data-sel] {
  /* Un filete al canto y no un fondo: un fondo compite con las fotos, que es
     justo lo que aquí tiene que mandar. */
  box-shadow: inset 3px 0 0 ${site.color.ink};
  padding-left: 10px; margin-left: -10px;
}
.fp-mapa-mini {
  width: 44px; height: 34px; border-radius: 2px; overflow: hidden; background: #e7e5df;
  display: flex; align-items: center; justify-content: center;
}
.fp-mapa-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fp-mapa-mini-n { font-size: 10px; opacity: .35; font-variant-numeric: tabular-nums; }
.fp-mapa-txt { min-width: 0; }
.fp-mapa-nombre { font-size: 13px; font-weight: 300; display: block; }
.fp-mapa-ol button[data-sel] .fp-mapa-nombre { font-weight: 400; }
.fp-mapa-sub {
  display: block; font-size: 9.5px; letter-spacing: ${site.track.tight};
  text-transform: uppercase; opacity: .45; margin-top: 2px;
}

/* Documento de respaldo (sin WebGL / sin puntos). */
.fp-mapa-doc-lista { margin-top: clamp(34px, 5vh, 60px); max-width: 520px; }
.fp-mapa-doc-lista .fp-mapa-cuenta { margin-bottom: 12px; }

/* ── Lámina (móvil) ────────────────────────────────────────────────────────
   Solo existe en móvil: en escritorio el índice y la ficha son las ventanas. */
.fp-mapa-hoja { display: none; }

@media (max-width: 900px) {
  .fp-mapa-indice, .fp-mapa-ficha { display: none; }

  /* El control de zoom sobra donde se navega con el dedo, pero la atribución NO
     se toca: es requisito de uso de Mapbox. Sube justo por encima de lo que asoma
     la lámina —sea la detención que sea— para que nunca quede debajo. */
  .fp-mapa[data-inmersivo="1"] .mapboxgl-ctrl-group { display: none; }
  .fp-mapa[data-inmersivo="1"] .mapboxgl-ctrl-bottom-left,
  .fp-mapa[data-inmersivo="1"] .mapboxgl-ctrl-bottom-right {
    /* El tope evita que, con la lámina del todo arriba, la atribución se suba
       hasta el isotipo. Ahí queda detrás de la lámina, que es donde tiene que
       estar: el mapa ya no se ve. */
    bottom: min(calc(var(--fp-asomo, 60px) + 6px), calc(100dvh - 150px));
    transition: bottom .34s ${site.ease};
  }

  .fp-mapa-hoja {
    display: flex; flex-direction: column;
    position: absolute; z-index: 12;
    /* Despegada de los cantos: así se lee como ventana y no como un cajón. El
       alto lo fijan top y bottom, y los porcentajes de DETENTES van referidos
       a él — por eso el recorrido de la lámina no depende de ninguna medida
       tomada en JavaScript. */
    top: calc(var(--fp-tope) + var(--fp-aire));
    bottom: var(--fp-hueco); left: var(--fp-hueco); right: var(--fp-hueco);
    background: ${site.color.cream};
    border-radius: 16px;
    box-shadow: 0 -14px 44px -22px rgba(20,20,20,.55), 0 0 0 1px rgba(20,20,20,.08);
    will-change: transform;
  }
  .fp-mapa-asa {
    flex: none; height: 26px; display: flex; align-items: center; justify-content: center;
    cursor: grab;
    /* El asa se queda el gesto vertical. Sin esto el navegador lo interpreta como
       scroll de la página y la lámina no se mueve. */
    touch-action: none;
  }
  .fp-mapa-asa span { width: 38px; height: 4px; border-radius: 2px; background: rgba(20,20,20,.13); display: block; }

  .fp-mapa-hoja-cab {
    flex: none; display: flex; align-items: baseline; justify-content: space-between;
    padding: 0 18px 12px; background: none; border: none; width: 100%;
    font-family: inherit; color: inherit; cursor: pointer;
  }
  .fp-mapa-pista { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .45; }

  .fp-mapa-hoja-lista {
    flex: 1; min-height: 0; overflow-y: auto;
    /* El relleno va DENTRO, en el <ol>, y no aquí. Con la ficha abierta esta caja
       vale exactamente 0 de alto, y una caja de 0 con 20 px de padding sigue
       midiendo 20: por ahí asomaba media miniatura de la lista bajo la ficha. */
    padding: 0;
    /* Que el rebote de la lista no arrastre la página de detrás. */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .fp-mapa-hoja-lista .fp-mapa-ol { padding: 0 18px 20px; }

  /* Filas de dedo, no de puntero. */
  .fp-mapa-hoja-lista .fp-mapa-ol button {
    grid-template-columns: 56px 1fr; gap: 14px; padding: 9px 0; opacity: 1;
  }
  .fp-mapa-hoja-lista .fp-mapa-mini { width: 56px; height: 42px; border-radius: 3px; }
  .fp-mapa-hoja-lista .fp-mapa-nombre { font-size: 15px; font-weight: 400; }
  .fp-mapa-hoja-lista .fp-mapa-sub { font-size: 10px; margin-top: 3px; }

  /* ── Ficha dentro de la lámina ───────────────────────────────────────── */
  .fp-mapa-fc {
    flex: none; position: relative;
    display: grid; grid-template-columns: 128px 1fr; gap: 14px;
    padding: 0 18px 16px;
  }
  /* Misma regla que en escritorio: la foto trae su proporción y aquí no se recorta.
     El techo es más bajo porque la ficha comparte los 200 px de la detención. */
  .fp-mapa-fc-foto {
    width: 128px; border-radius: 3px; overflow: hidden; background: #e7e5df;
    display: flex; align-items: center; justify-content: center;
  }
  .fp-mapa-fc-foto img { width: 100%; height: auto; display: block; max-height: 150px; object-fit: contain; }
  .fp-mapa-fc-sinfoto { font-size: 15px; opacity: .3; font-variant-numeric: tabular-nums; }
  .fp-mapa-fc-txt { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-right: 22px; }
  .fp-mapa-fc-nombre { font-size: 17px; font-weight: 400; margin: 0; letter-spacing: -0.01em; }
  .fp-mapa-fc-meta { font-size: 10px; letter-spacing: ${site.track.normal}; text-transform: uppercase; opacity: .5; margin: 0; }
  .fp-mapa-fc-link {
    margin-top: 4px; align-self: flex-start; background: none; border: none; padding: 0 0 2px;
    font-family: inherit; font-size: 10px; letter-spacing: ${site.track.normal};
    text-transform: uppercase; color: inherit; text-decoration: none; cursor: pointer;
    border-bottom: 1px solid rgba(20,20,20,.20);
  }
  .fp-mapa-fc-nav { display: flex; align-items: center; gap: 14px; margin-top: auto; padding-top: 8px; }
  .fp-mapa-fc-nav button {
    width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(20,20,20,.10);
    background: none; font-size: 17px; line-height: 1; color: inherit; cursor: pointer;
    font-family: inherit;
  }
  .fp-mapa-fc-nav span { font-size: 10.5px; opacity: .45; font-variant-numeric: tabular-nums; }
  .fp-mapa-fc-x {
    position: absolute; top: -4px; right: 12px;
    background: none; border: none; font-size: 20px; line-height: 1; color: ${site.color.ink};
    opacity: .4; cursor: pointer; padding: 4px 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fp-mapa-indice, .fp-mapa-ficha { animation: none; }
  .fp-mapa-hoja { transition: none !important; }
}
`

'use client'

// Lienzo del mapa. Se importa SIEMPRE con next/dynamic({ssr:false}) desde MapaPage:
// mapbox-gl pesa ~250 KB comprimidos y no puede entrar en el paquete común del
// sitio — sería el archivo más pesado de toda la web, servido también a quien no
// abra nunca el mapa.
//
// Es mapbox-gl y no el maplibre-gl que ya estaba instalado porque el estilo del
// estudio importa «Mapbox Standard» como basemap, y Standard solo lo renderiza
// mapbox-gl-js v3.

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { site } from '../theme'
import { CAMARA, SIN_MARGENES, aGeoJSON, limites, tieneCoordenadas, type MapaPunto, type Margenes } from '@/lib/web-mapa'

const FUENTE = 'fp-obras'
/** Zoom al que se aterriza sobre una obra si se venía de más lejos. */
const ZOOM_DETALLE = 16.1
/** Milisegundos por grado de órbita. 250 ≈ una vuelta completa en 90 s: lo bastante
 *  lento para que se lea como la ciudad girando y no como un salvapantallas. */
const DURACION_POR_GRADO = 250

/**
 * Grados por tramo de órbita. TIENE que ser < 180 y no es un capricho de ritmo.
 *
 * `Camera.easeTo` pasa el rumbo objetivo por `_normalizeBearing`, que lo envuelve
 * a [-180, 180] y luego elige el camino más corto. Pedirle `rumbo + 360` se
 * normaliza de vuelta al rumbo actual: la cámara entiende «no gires». La órbita
 * estaba pidiendo exactamente eso y por eso no giraba nada.
 *
 * Con tramos de 90° cada petición es inequívoca y se encadenan al terminar, que
 * además es lo que ya hacía falta para poder cortarla en cualquier momento.
 */
const TRAMO_GRADOS = 90

/** Respiro que se le suma a los márgenes en el encuadre general, para que ningún
 *  punto quede pegado al canto de una ventana flotante. */
const RESPIRO = 48

/**
 * El plano general: el núcleo de obras entero, dentro del hueco que dejan libre
 * las ventanas. Vive fuera del componente porque lo piden dos sitios —el encuadre
 * de entrada, instantáneo, y el botón «Ver todas», con vuelo— y la única
 * diferencia entre los dos es la duración.
 *
 * Devuelve si ha podido encuadrar: sin ningún punto geocodificado no hay caja.
 */
function encuadrarTodo(m: mapboxgl.Map, puntos: MapaPunto[], mg: Margenes, duracion: number) {
  const caja = limites(puntos)
  if (!caja) return false
  m.fitBounds(caja, {
    // El zoom NO es el del estilo (15,25): con puntos de Ferraz a Fuente del Berro
    // no cabe ni la mitad. Se calcula de los datos conservando rumbo y cabeceo.
    padding: {
      top:    mg.top    + RESPIRO,
      right:  mg.right  + RESPIRO,
      bottom: mg.bottom + RESPIRO,
      left:   mg.left   + RESPIRO,
    },
    bearing: CAMARA.rumbo,
    pitch: CAMARA.cabeceo,
    duration: duracion,
    maxZoom: 15,
    essential: true,
  })
  return true
}

/**
 * ¿Puede este navegador con el mapa?
 *
 * Se prueba un contexto WebGL 2 de verdad en vez de preguntárselo a la librería.
 * `mapboxgl.supported()` existía en v2 y DESAPARECIÓ en v3 —el paquete de aquí es
 * el 3.28— así que `mapboxgl.supported?.()` devolvía `undefined`, el `!` lo daba
 * por «no soportado» y la página caía al plano estático SIEMPRE, en cualquier
 * navegador. El mapa interactivo no llegaba a construirse nunca.
 *
 * WebGL 2 y no WebGL 1: es lo que pide mapbox-gl v3 para el basemap Standard.
 */
function soportaMapa() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export default function MapaLienzo({ puntos, resaltado, seleccionado, onResaltar, onSeleccionar, margenes = SIN_MARGENES, reencuadre = 0, onFallo }: {
  puntos: MapaPunto[]
  /**
   * DOS estados y no uno, porque son dos intenciones distintas.
   *  · `resaltado` (pasar el ratón, o el foco de teclado) solo enciende el punto.
   *    La cámara NO se mueve: un gesto sin compromiso no puede tener una
   *    consecuencia con compromiso.
   *  · `seleccionado` (clic) vuela hasta la obra, abre la tarjeta y orbita.
   * Ambos son el índice 1..n, el mismo número que se pinta en el punto y en la
   * lista de al lado.
   */
  resaltado: number | null
  seleccionado: number | null
  onResaltar: (n: number | null) => void
  onSeleccionar: (n: number | null) => void
  /**
   * Píxeles del lienzo tapados por cada lado: el índice a la izquierda, la ficha a
   * la derecha, el header arriba, la lámina abajo. Se los pasamos a Mapbox como
   * `padding` para que centre en el HUECO VISIBLE: sin esto, el punto al que vuelas
   * aterriza debajo de una ventana y parece que no ha pasado nada.
   */
  margenes?: Margenes
  /** Cada incremento pide un vuelo de vuelta al plano general (el botón «Ver
   *  todas»). Un contador y no un booleano: el gesto se puede repetir. */
  reencuadre?: number
  /** Sin WebGL o sin token: la página cae al plano de siempre. */
  onFallo: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<mapboxgl.Map | null>(null)
  const [listo, setListo] = useState(false)

  // ── Montaje ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !contenedor.current) { onFallo(); return }
    if (!soportaMapa()) { onFallo(); return }

    mapboxgl.accessToken = token
    let m: mapboxgl.Map
    try {
      m = new mapboxgl.Map({
        container: contenedor.current,
        style: CAMARA.estilo,
        center: CAMARA.centro,
        zoom: CAMARA.zoomRespaldo,
        bearing: CAMARA.rumbo,
        pitch: CAMARA.cabeceo,
        minZoom: CAMARA.zoomMin,
        maxZoom: CAMARA.zoomMax,
        attributionControl: true,
        // Un dedo mueve el mapa y la rueda hace zoom sin `Ctrl`. Los gestos
        // cooperativos existen para no robarle el scroll a la página; aquí el mapa
        // ES la página y la página no scrollea, así que no hay nada que robar.
        cooperativeGestures: false,
      })
    } catch (e) {
      // El constructor tira si el contexto WebGL se pierde entre la comprobación y
      // aquí (memoria de GPU, pestaña en segundo plano). Sin este `catch` la
      // excepción sube y se lleva por delante la página entera en vez de caer al
      // plano estático, que es justo lo que el respaldo existe para evitar.
      console.error('[mapa]', e)
      onFallo()
      return
    }
    mapa.current = m

    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.on('error', (e) => console.error('[mapa]', e?.error?.message ?? e))
    m.on('load', () => setListo(true))

    return () => { m.remove(); mapa.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El área útil del lienzo. Mapbox la usa en fitBounds y flyTo.
  //
  // Se desestructura en cuatro números en vez de depender del objeto: `margenes`
  // se recalcula en cada render del padre y un objeto nuevo con los mismos valores
  // dispararía este efecto —y con él un reencuadre de cámara— sin que nada haya
  // cambiado de sitio.
  const { top: mTop, right: mRight, bottom: mBottom, left: mLeft } = margenes
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    m.setPadding({ top: mTop, right: mRight, bottom: mBottom, left: mLeft })
  }, [mTop, mRight, mBottom, mLeft, listo])

  // ── Capas ─────────────────────────────────────────────────────────────────
  // Fuente GeoJSON + capas nativas, NO marcadores HTML: en un mapa con 63° de
  // cabeceo, 27 marcadores del DOM se solapan y escalan mal. Las capas resuelven
  // colisión de etiquetas y tamaño por zoom sin que escribamos un solo cálculo.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return

    const datos = aGeoJSON(puntos)
    const existente = m.getSource(FUENTE) as mapboxgl.GeoJSONSource | undefined
    if (existente) { existente.setData(datos as any); return }

    // `generateId` numera las features por su posición en el array. Es lo que
    // hace posible `setFeatureState` para resaltar un punto sin repintar la
    // fuente entera, y el índice coincide con el número de la lista de al lado.
    m.addSource(FUENTE, { type: 'geojson', data: datos as any, generateId: true })

    // El disco se ancla al SUELO: en tres dimensiones un círculo que flota de cara
    // a la cámara se despega del edificio al girar.
    m.addLayer({
      id: 'fp-obra-halo',
      type: 'circle',
      source: FUENTE,
      paint: {
        'circle-pitch-alignment': 'map',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 24],
        'circle-color': site.color.ink,
        // Tres niveles: en reposo se insinúa, al pasar el ratón se marca, y al
        // seleccionar se afirma. El halo es lo único que cambia con el hover:
        // barato de pintar y suficiente para contestar «¿cuál es este?».
        'circle-opacity': ['case',
          ['boolean', ['feature-state', 'sel'], false], 0.16,
          ['boolean', ['feature-state', 'res'], false], 0.11,
          0.06],
      },
    })
    m.addLayer({
      id: 'fp-obra-punto',
      type: 'circle',
      source: FUENTE,
      paint: {
        'circle-pitch-alignment': 'map',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5.5, 16, 11],
        'circle-color': ['case', ['boolean', ['feature-state', 'sel'], false], site.color.ink, site.color.cream],
        'circle-stroke-width': 1.4,
        'circle-stroke-color': site.color.ink,
      },
    })
    // La etiqueta sí se mantiene vertical frente a la cámara: un número tumbado
    // sobre el asfalto no se lee.
    m.addLayer({
      id: 'fp-obra-num',
      type: 'symbol',
      source: FUENTE,
      layout: {
        'text-field': ['to-string', ['get', 'n']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 16, 12],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-allow-overlap': true,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': ['case', ['boolean', ['feature-state', 'sel'], false], site.color.cream, site.color.ink],
      },
    })
    m.addLayer({
      id: 'fp-obra-nombre',
      type: 'symbol',
      source: FUENTE,
      minzoom: 13.4,
      layout: {
        'text-field': ['get', 'nombre'],
        'text-size': 10.5,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-letter-spacing': 0.12,
        'text-transform': 'uppercase',
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
        // AQUÍ está el trabajo que nos ahorra Mapbox: si dos nombres chocan, se
        // esconde el de mayor `sort-key`. Con marcadores del DOM tendríamos que
        // resolver esto a mano en cada frame.
        'text-allow-overlap': false,
        'text-optional': true,
        'symbol-sort-key': ['get', 'n'],
      },
      paint: {
        'text-color': site.color.ink,
        'text-halo-color': site.color.cream,
        'text-halo-width': 1.6,
        'text-opacity': 0.72,
      },
    })

    m.on('mouseenter', 'fp-obra-punto', (e) => {
      m.getCanvas().style.cursor = 'pointer'
      const n = e.features?.[0]?.properties?.n
      if (typeof n === 'number') onResaltar(n)
    })
    m.on('mouseleave', 'fp-obra-punto', () => {
      m.getCanvas().style.cursor = ''
      onResaltar(null)
    })
    m.on('click', 'fp-obra-punto', (e) => {
      const n = e.features?.[0]?.properties?.n
      if (typeof n === 'number') onSeleccionar(n)
    })
  }, [listo, puntos, onResaltar, onSeleccionar])

  // ── Encuadre inicial ──────────────────────────────────────────────────────
  // Con CERROJO. Es inicial por definición: tiene que ocurrir una vez y no volver.
  // Sin él, cualquier render que cambie la identidad del array de puntos vuelve a
  // dispararlo con `duration: 0` y la cámara salta de golpe al encuadre general —
  // que es exactamente lo que se leía como «se reinicia el zoom». Memoizar la
  // lista arregla el síntoma de hoy; este cerrojo impide que vuelva mañana.
  const encuadrado = useRef(false)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || encuadrado.current) return
    if (encuadrarTodo(m, puntos, { top: mTop, right: mRight, bottom: mBottom, left: mLeft }, 0)) {
      encuadrado.current = true
    }
  }, [listo, puntos, mTop, mRight, mBottom, mLeft])

  // ── Volver al plano general ───────────────────────────────────────────────
  // El botón «Ver todas». Deseleccionar y volver a ver la ciudad entera son dos
  // intenciones distintas —seleccionar una obra jamás aleja la cámara— así que
  // esta es la única puerta de vuelta, y llega como contador para poder repetirse.
  const reencuadrePrevio = useRef(reencuadre)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || reencuadre === reencuadrePrevio.current) return
    reencuadrePrevio.current = reencuadre
    m.stop()   // por si venía orbitando
    encuadrarTodo(m, puntos, { top: mTop, right: mRight, bottom: mBottom, left: mLeft }, 1500)
  }, [reencuadre, listo, puntos, mTop, mRight, mBottom, mLeft])

  // ── Resaltado (hover / foco) ──────────────────────────────────────────────
  // Solo pinta. Ni una línea de cámara.
  const resPrevio = useRef<number | null>(null)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || !m.getSource(FUENTE)) return
    if (resPrevio.current != null) m.setFeatureState({ source: FUENTE, id: resPrevio.current - 1 }, { res: false })
    if (resaltado != null) m.setFeatureState({ source: FUENTE, id: resaltado - 1 }, { res: true })
    resPrevio.current = resaltado
  }, [resaltado, listo])

  // ── Selección: el vuelo y la órbita ───────────────────────────────────────
  const selPrevia = useRef<number | null>(null)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || !m.getSource(FUENTE)) return
    const conCoords = puntos.filter(tieneCoordenadas)

    if (selPrevia.current != null) m.setFeatureState({ source: FUENTE, id: selPrevia.current - 1 }, { sel: false })
    selPrevia.current = seleccionado

    // Al deseleccionar se para la órbita pero NO se devuelve la cámara: volver al
    // encuadre general es otra intención y tiene su propio botón en la lista.
    if (seleccionado == null) { m.stop(); return }

    const p = conCoords[seleccionado - 1]
    if (!p) return
    m.setFeatureState({ source: FUENTE, id: seleccionado - 1 }, { sel: true })

    // `flyTo`, no `easeTo`. No son dos maneras de lo mismo: easeTo interpola en
    // línea recta y a zoom alto eso pasa como un borrón. flyTo implementa la curva
    // de Van Wijk y Nuij —se eleva lo justo, recorre, y baja—, que es como el ojo
    // entiende un desplazamiento sobre un territorio. `curve` baja porque las 27
    // obras caben en 2 km y no hace falta subir a la estratosfera.
    //
    // Ni el rumbo ni el cabeceo se tocan: son del visitante. Y el zoom solo sube,
    // nunca baja — seleccionar una obra jamás aleja la cámara.
    m.flyTo({
      center: [p.lng, p.lat],
      zoom: Math.max(m.getZoom(), ZOOM_DETALLE),
      curve: 1.2,
      speed: 0.85,
      essential: true,
    })
  }, [seleccionado, listo, puntos])

  // ── La órbita ─────────────────────────────────────────────────────────────
  // Se engancha al ATERRIZAJE del vuelo (`moveend`), no al clic: si arrancara a la
  // vez, las dos animaciones de cámara se pisarían.
  //
  // Una sola llamada y no un bucle por fotograma: Mapbox ya cancela sus propias
  // animaciones de cámara en cuanto el visitante toca el mapa, así que arrastrar,
  // hacer zoom o rotar interrumpe la órbita al instante y sin escribir nada. La
  // máquina se aparta sola en cuanto alguien quiere conducir.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || seleccionado == null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // En escritorio los tramos se encadenan; en táctil se da uno y se para. Una
    // órbita continua es un mapa 3D repintándose 60 veces por segundo
    // indefinidamente: en un portátil no se nota, en un teléfono se nota en la
    // batería y en el calor del aparato.
    const continua = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    let vivo = true

    const girar = () => {
      if (!vivo) return
      m.easeTo({
        bearing: m.getBearing() + TRAMO_GRADOS,
        duration: TRAMO_GRADOS * DURACION_POR_GRADO,
        easing: (t) => t,   // lineal: una órbita no acelera ni frena
      })
    }

    const alAterrizar = (e: any) => {
      if (!vivo) return
      // `moveend` también se dispara cuando el movimiento lo ha hecho el
      // VISITANTE, y ahí `originalEvent` viene puesto. Sin este filtro, arrastrar
      // el mapa lo dejaba quieto un instante y acto seguido volvía a girar solo:
      // exactamente pelearse con quien está intentando mirar algo. Un gesto suyo
      // retira la órbita hasta que elija otra obra.
      if (e?.originalEvent) { vivo = false; return }
      girar()
      if (!continua) vivo = false   // táctil: un solo tramo
    }

    // Un único registro. Antes había `once` + `on` a la vez y el primer aterrizaje
    // disparaba dos animaciones de cámara compitiendo.
    m.on('moveend', alAterrizar)

    return () => {
      vivo = false
      m.off('moveend', alAterrizar)
      m.stop()
    }
  }, [seleccionado, listo])

  return <div ref={contenedor} className="fp-mapa-lienzo" aria-hidden="true" />
}

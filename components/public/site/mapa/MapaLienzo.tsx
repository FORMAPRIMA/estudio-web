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
import {
  CAMARA, SIN_MARGENES, KM_SALTO, SEDE_CASA, aGeoJSON, kmEntre, limites, limitesDeSede,
  tieneCoordenadas, type MapaPunto, type Margenes, type SedeCodigo,
} from '@/lib/web-mapa'

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

// ── El corte ────────────────────────────────────────────────────────────────
/** Lo que tarda el velo en cerrarse, y en abrirse. */
const FUNDIDO = 380
/**
 * Tope del velo. Es una red de seguridad, no el ritmo previsto: lo normal es que
 * `idle` llegue antes y el velo se retire cuando el destino ya está pintado. Sin
 * este tope, una red que no termina de servir teselas dejaría la pantalla en crema
 * para siempre.
 */
const TOPE_CORTE = 1600

/**
 * El plano general de una caja, dentro del hueco que dejan libre las ventanas.
 * Vive fuera del componente porque lo piden tres sitios —el encuadre de entrada,
 * «Ver todas» y el conmutador de sedes— y entre ellos solo cambian la caja y la
 * duración.
 *
 * Devuelve si ha podido encuadrar: sin caja no hay nada que enseñar.
 */
function encuadrarCaja(m: mapboxgl.Map, caja: ReturnType<typeof limites>, mg: Margenes, duracion: number) {
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

export default function MapaLienzo({ puntos, resaltado, seleccionado, onResaltar, onSeleccionar, margenes = SIN_MARGENES, reencuadre = 0, sedeEncuadre = SEDE_CASA, onFallo }: {
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
  /** Cada incremento pide un encuadre general de `sedeEncuadre` (el botón «Ver
   *  todas» y el conmutador de sedes). Un contador y no un booleano: el gesto se
   *  puede repetir. */
  reencuadre?: number
  /** A qué sede encuadra el contador de arriba. */
  sedeEncuadre?: SedeCodigo
  /** Sin WebGL o sin token: la página cae al plano de siempre. */
  onFallo: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<mapboxgl.Map | null>(null)
  const [listo, setListo] = useState(false)
  /** El encuadre de entrada ya se ha hecho. Es estado y no ref porque la órbita de
   *  entrada tiene que esperarlo: un efecto no despierta con una ref. */
  const [encuadrado, setEncuadrado] = useState(false)
  /** El velo del salto está echado. */
  const [corte, setCorte] = useState(false)
  /**
   * El visitante ha tomado el mando. A partir de ahí la órbita de entrada no
   * vuelve: la máquina se aparta en cuanto alguien quiere conducir, y volver a
   * girarle el mapa debajo sería justo lo contrario.
   */
  const intervenido = useRef(false)
  const relojes = useRef<number[]>([])

  /**
   * El salto largo: fundir a crema, colocar la cámara de golpe y volver.
   *
   * `jumpTo` y no `flyTo` a propósito. Un recorrido de Madrid a Miami pide teselas
   * de todo lo que sobrevuela, y como `zoomMin` impide elevarse las pide a zoom de
   * ciudad: miles que no llegan a tiempo, que es exactamente el mapa deshaciéndose
   * que había que quitar. Un salto no sobrevuela nada.
   */
  const conCorte = (m: mapboxgl.Map, aplicar: () => void) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { aplicar(); return }
    relojes.current.forEach(clearTimeout)
    relojes.current = []
    setCorte(true)
    relojes.current.push(window.setTimeout(() => {
      aplicar()
      let hecho = false
      // El velo NO se retira al saltar, sino cuando el destino está servido. Es el
      // detalle del que depende que esto se vea bien.
      const destapar = () => { if (!hecho) { hecho = true; setCorte(false) } }
      m.once('idle', destapar)
      relojes.current.push(window.setTimeout(destapar, TOPE_CORTE))
    }, FUNDIDO))
  }

  useEffect(() => () => { relojes.current.forEach(clearTimeout) }, [])

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

    // Cualquier gesto sobre el mapa retira la órbita de entrada. `originalEvent`
    // es lo que distingue al visitante de nuestras propias animaciones de cámara:
    // sin ese filtro, la órbita se estaría cancelando a sí misma en cada tramo.
    const alMandar = (e: any) => { if (e?.originalEvent) intervenido.current = true }
    for (const ev of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const) m.on(ev, alMandar)

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
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || encuadrado) return
    if (encuadrarCaja(m, limites(puntos), { top: mTop, right: mRight, bottom: mBottom, left: mLeft }, 0)) {
      setEncuadrado(true)
    }
  }, [listo, puntos, mTop, mRight, mBottom, mLeft, encuadrado])

  // ── Volver al plano general de una sede ───────────────────────────────────
  // El botón «Ver todas» y el conmutador de sedes. Deseleccionar y volver a ver la
  // ciudad entera son dos intenciones distintas —seleccionar una obra jamás aleja
  // la cámara— así que esta es la única puerta de vuelta, y llega como contador
  // para poder repetirse.
  const reencuadrePrevio = useRef(reencuadre)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || reencuadre === reencuadrePrevio.current) return
    reencuadrePrevio.current = reencuadre
    m.stop()   // por si venía orbitando
    const mg = { top: mTop, right: mRight, bottom: mBottom, left: mLeft }
    const caja = limitesDeSede(puntos, sedeEncuadre) ?? limites(puntos)
    if (!caja) return
    // Cambiar de sede es cruzar un océano: se funde. Dentro de la misma, se vuela.
    const centro = m.getCenter()
    const lejos = kmEntre(centro, { lat: (caja[0][1] + caja[1][1]) / 2, lng: (caja[0][0] + caja[1][0]) / 2 }) > KM_SALTO
    if (lejos) conCorte(m, () => encuadrarCaja(m, caja, mg, 0))
    else encuadrarCaja(m, caja, mg, 1500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reencuadre, listo, puntos, sedeEncuadre, mTop, mRight, mBottom, mLeft])

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
    const destino = {
      center: [p.lng, p.lat] as [number, number],
      zoom: Math.max(m.getZoom(), ZOOM_DETALLE),
    }

    // Más allá de KM_SALTO no se vuela, se salta con fundido. La curva de Van Wijk
    // es la manera correcta de recorrer un territorio; cruzar un océano no es
    // recorrer un territorio, y a zoom de ciudad el mapa no llega a dibujarse.
    if (kmEntre(m.getCenter(), p) > KM_SALTO) {
      conCorte(m, () => m.jumpTo({ ...destino, bearing: CAMARA.rumbo, pitch: CAMARA.cabeceo }))
      return
    }

    m.flyTo({ ...destino, curve: 1.2, speed: 0.85, essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!m || !listo) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Sin obra elegida la órbita es la de ENTRADA: la ciudad girando despacio
    // mientras nadie ha tocado nada. Solo puede empezar cuando el encuadre ya está
    // hecho —si no, giraría sobre el centro de respaldo— y no vuelve nunca después
    // de que el visitante haya tomado el mando.
    if (seleccionado == null && (!encuadrado || intervenido.current)) return
    // Mientras el velo está echado no se gira: una animación de cámara en marcha
    // impide que `idle` llegue, y el velo se quedaría hasta el tope.
    if (corte) return

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

    // La órbita de ENTRADA no tiene aterrizaje al que engancharse: el encuadre ya
    // ocurrió, y con `duration: 0` su `moveend` se disparó antes de que este efecto
    // existiera. Así que arranca ella sola.
    if (seleccionado == null) {
      girar()
      if (!continua) vivo = false
    }

    return () => {
      vivo = false
      m.off('moveend', alAterrizar)
      m.stop()
    }
  }, [seleccionado, listo, encuadrado, corte])

  return (
    <>
      <div ref={contenedor} className="fp-mapa-lienzo" aria-hidden="true" />
      {/* El velo del salto. Hermano del lienzo y por encima de él, pero por debajo
          de las ventanas flotantes: el índice y la ficha no parpadean, lo que cambia
          es el suelo — que es lo que de verdad está pasando. */}
      <div className="fp-mapa-corte" data-visible={corte ? '1' : undefined} aria-hidden="true" />
    </>
  )
}

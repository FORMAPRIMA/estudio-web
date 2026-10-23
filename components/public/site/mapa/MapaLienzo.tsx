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
  CAMARA, MUNDO, ZOOM_CIUDAD, SIN_MARGENES, KM_SALTO, aGeoJSON, kmEntre, limites, limitesDeSede,
  tieneCoordenadas, type Caja, type MapaPunto, type Margenes, type SedeCodigo,
} from '@/lib/web-mapa'

const FUENTE = 'fp-obras'
/**
 * La misma serie de obras, AGRUPADA. Es lo que se ve desde el globo: treinta obras
 * de Madrid en el mismo píxel serían una mancha de números, así que por debajo de
 * `ZOOM_CIUDAD` se pinta un disco por ciudad con su recuento.
 *
 * Fuente aparte y no `cluster: true` sobre la de siempre: la de siempre resalta y
 * selecciona con `setFeatureState` sobre el índice de cada obra, y en una fuente
 * agrupada los ids de los grupos se mezclan con los de las obras.
 */
const GRUPOS = 'fp-ciudades'

/** El globo en el ancho de pantalla de ahora. */
function vistaMundo() {
  const movil = window.matchMedia('(max-width: 900px)').matches
  return {
    center: movil ? MUNDO.centroMovil : MUNDO.centro,
    zoom: movil ? MUNDO.zoomMovil : MUNDO.zoom,
    pitch: 0,
    bearing: 0,
  }
}
/** Zoom al que se aterriza sobre una obra si se venía de más lejos. Por encima
 *  del de entrada: elegir una obra siempre acerca, nunca aleja. */
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

/** A partir de esta diagonal la caja es una región y no un barrio: se mira en
 *  planta. Con 63° de cabeceo, medio México quedaría tumbado contra el horizonte. */
const KM_REGION = 60

/**
 * El plano general de una caja, dentro del hueco que dejan libre las ventanas.
 * Vive fuera del componente porque lo piden el conmutador de sedes y el clic en
 * una ciudad del globo, y entre ellos solo cambia la caja.
 *
 * Devuelve si ha podido encuadrar: sin caja no hay nada que enseñar.
 */
function encuadrarCaja(m: mapboxgl.Map, caja: Caja | null, mg: Margenes) {
  if (!caja) return false
  const region = kmEntre({ lng: caja[0][0], lat: caja[0][1] }, { lng: caja[1][0], lat: caja[1][1] }) > KM_REGION
  const opciones = {
    // El zoom NO es el del estilo (15,25): con puntos de Ferraz a Fuente del Berro
    // no cabe ni la mitad. Se calcula de los datos.
    padding: {
      top:    mg.top    + RESPIRO,
      right:  mg.right  + RESPIRO,
      bottom: mg.bottom + RESPIRO,
      left:   mg.left   + RESPIRO,
    },
    bearing: region ? 0 : CAMARA.rumbo,
    pitch: region ? 0 : CAMARA.cabeceo,
    maxZoom: 15,
    essential: true,
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    m.fitBounds(caja, { ...opciones, duration: 0 })
    return true
  }
  // Desde el globo se BAJA: `fitBounds` sin `linear` usa la curva de vuelo, que
  // es la que sabe recorrer un océano sin pedir teselas de ciudad por el camino.
  m.fitBounds(caja, { ...opciones, curve: 1.42, speed: 1.1 })
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

export default function MapaLienzo({ puntos, resaltado, seleccionado, onResaltar, onSeleccionar, margenes = SIN_MARGENES, reencuadre = 0, sedeEncuadre = null, entradaAutomatica = false, onFallo }: {
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
  /** A qué sede encuadra el contador de arriba. null = el globo entero. */
  sedeEncuadre?: SedeCodigo | null
  /**
   * La obra marcada es la de ENTRADA, no una que haya elegido el visitante.
   *
   * Cambia dos cosas: no se vuela hasta ella —la cámara ya está encuadrada ahí, y
   * volar sería deshacer el encuadre de entrada para volver al mismo sitio— y su
   * órbita se comporta como la de entrada: se retira al primer gesto y no vuelve.
   */
  entradaAutomatica?: boolean
  /** Sin WebGL o sin token: la página cae al plano de siempre. */
  onFallo: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<mapboxgl.Map | null>(null)
  const [listo, setListo] = useState(false)
  /**
   * A dónde vuela la cámara AHORA MISMO, o null si no hay vuelo vivo.
   *
   * Existe porque `moveend` no distingue «he llegado» de «me han cortado»: los dos
   * llegan igual. Con el destino a mano, un `moveend` que no deja la cámara encima
   * de la obra se reconoce como lo que es —una animación abortada— y ni arranca la
   * órbita ni cuenta como aterrizaje.
   */
  const destino = useRef<{ lat: number; lng: number } | null>(null)

  // ── Montaje ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !contenedor.current) { onFallo(); return }
    if (!soportaMapa()) { onFallo(); return }

    mapboxgl.accessToken = token
    let m: mapboxgl.Map
    try {
      // Abre en el GLOBO: lo primero que se ve es dónde trabaja el estudio, y desde
      // ahí se baja a la ciudad que se elija.
      const mundo = vistaMundo()
      m = new mapboxgl.Map({
        container: contenedor.current,
        style: CAMARA.estilo,
        projection: 'globe',
        center: mundo.center,
        zoom: mundo.zoom,
        bearing: mundo.bearing,
        pitch: mundo.pitch,
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
    // El espacio alrededor del globo, en el crema del sitio y sin estrellas: el
    // isotipo y el menú son negros y van encima. La niebla del estilo está pensada
    // para la ciudad, no para el planeta.
    m.on('style.load', () => {
      m.setFog({
        color: '#f4f3f0',
        'high-color': '#e4e1da',
        'space-color': '#eceae5',
        'horizon-blend': 0.06,
        'star-intensity': 0,
      })
    })

    // Un gesto del visitante deja sin dueño el vuelo en curso. `originalEvent` es
    // lo que distingue al visitante de nuestras propias animaciones de cámara.
    const alMandar = (e: any) => {
      if (!e?.originalEvent) return
      destino.current = null   // el vuelo ya no es de nadie: manda quien conduce
    }
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
  /** El último hueco visible conocido. Lo leen las llamadas de cámara, que lo pasan
   *  como `padding` en vez de depender de que ya esté aplicado. */
  const margenesRef = useRef<Margenes>(margenes)
  useEffect(() => {
    const p = { top: mTop, right: mRight, bottom: mBottom, left: mLeft }
    margenesRef.current = p
    const m = mapa.current
    if (!m || !listo) return

    /**
     * `setPadding` NO es un ajuste inocuo: por dentro es un `jumpTo`, y `jumpTo`
     * empieza llamando a `stop()`. Aplicarlo con la cámara en vuelo ABORTA el vuelo
     * y encima emite un `moveend` que la órbita leía como aterrizaje.
     *
     * Ahí estaba el fallo de «los primeros clics no viajan»: elegir una obra abre la
     * ficha, la ficha cambia el hueco visible, y ese margen nuevo llegaba aquí un
     * render DESPUÉS de lanzarse el vuelo — o más tarde aún, cuando la foto de la
     * ficha terminaba de cargar y el ResizeObserver volvía a medir. El vuelo moría a
     * los pocos milisegundos y la cámara se quedaba donde estaba. A partir del tercer
     * o cuarto clic las fotos ya estaban en caché, la medida no cambiaba, y entonces
     * sí funcionaba: de ahí que pareciera cosa de los primeros clics.
     *
     * Con la cámara en marcha no se toca nada: el propio movimiento ya lleva el
     * padding nuevo —todas nuestras llamadas lo pasan— y esta reserva lo aplica al
     * parar por si el margen ha cambiado por algo ajeno (plegar el índice, girar el
     * teléfono). El `requestAnimationFrame` saca el `setPadding` de dentro del
     * `moveend`: aplicarlo ahí dispararía otro `moveend` reentrante.
     */
    if (!m.isMoving()) { m.setPadding(p); return }
    const alParar = () => requestAnimationFrame(() => {
      const mm = mapa.current
      if (mm && !mm.isMoving()) mm.setPadding(margenesRef.current)
    })
    m.once('moveend', alParar)
    return () => { m.off('moveend', alParar) }
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
    if (existente) {
      existente.setData(datos as any)
      ;(m.getSource(GRUPOS) as mapboxgl.GeoJSONSource | undefined)?.setData(datos as any)
      return
    }

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
      // Las obras sueltas, solo a escala de ciudad. Desde el globo se ven agrupadas.
      minzoom: ZOOM_CIUDAD,
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
      minzoom: ZOOM_CIUDAD,
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
      minzoom: ZOOM_CIUDAD,
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

    // ── Ciudades (desde el globo) ──
    // `clusterMaxZoom` justo por debajo de `ZOOM_CIUDAD`: el grupo se deshace en el
    // mismo zoom en que aparecen las obras sueltas, ni antes ni después.
    m.addSource(GRUPOS, { type: 'geojson', data: datos as any, cluster: true, clusterRadius: 44, clusterMaxZoom: ZOOM_CIUDAD - 1 })
    m.addLayer({
      id: 'fp-ciudad', type: 'circle', source: GRUPOS, maxzoom: ZOOM_CIUDAD,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': site.color.ink,
        'circle-radius': ['step', ['get', 'point_count'], 13, 5, 16, 15, 20],
        'circle-stroke-width': 5,
        'circle-stroke-color': 'rgba(20,20,20,.14)',
      },
    })
    m.addLayer({
      id: 'fp-ciudad-n', type: 'symbol', source: GRUPOS, maxzoom: ZOOM_CIUDAD,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['to-string', ['get', 'point_count']],
        'text-size': 11,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': site.color.cream },
    })
    // Una obra sola en su ciudad (Samborondón) no es un grupo: se pinta como punto
    // con su nombre, y el clic la elige directamente.
    m.addLayer({
      id: 'fp-ciudad-sola', type: 'circle', source: GRUPOS, maxzoom: ZOOM_CIUDAD,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6,
        'circle-color': site.color.cream,
        'circle-stroke-width': 1.6,
        'circle-stroke-color': site.color.ink,
      },
    })
    m.addLayer({
      id: 'fp-ciudad-sola-nombre', type: 'symbol', source: GRUPOS, maxzoom: ZOOM_CIUDAD,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'nombre'],
        'text-size': 10,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-letter-spacing': 0.12,
        'text-transform': 'uppercase',
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': site.color.ink, 'text-halo-color': site.color.cream, 'text-halo-width': 1.6 },
    })
    for (const capa of ['fp-ciudad', 'fp-ciudad-sola']) {
      m.on('mouseenter', capa, () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', capa, () => { m.getCanvas().style.cursor = '' })
    }
    // Clic en una ciudad: se baja hasta ver todas sus obras. Se encuadran las HOJAS
    // del grupo y no su zoom de expansión: así se aterriza ya con la ciudad entera
    // en pantalla, y no en un paso intermedio que obliga a pinchar otra vez.
    m.on('click', 'fp-ciudad', (e) => {
      const f = e.features?.[0]
      const id = f?.properties?.cluster_id
      if (id == null) return
      ;(m.getSource(GRUPOS) as mapboxgl.GeoJSONSource).getClusterLeaves(id, Infinity, 0, (err, hojas) => {
        if (err || !hojas?.length) return
        let oeste = Infinity, sur = Infinity, este = -Infinity, norte = -Infinity
        for (const h of hojas) {
          const [lng, lat] = (h.geometry as GeoJSON.Point).coordinates
          oeste = Math.min(oeste, lng); este = Math.max(este, lng)
          sur = Math.min(sur, lat);     norte = Math.max(norte, lat)
        }
        destino.current = null
        encuadrarCaja(m, [[oeste, sur], [este, norte]], margenesRef.current)
      })
    })
    m.on('click', 'fp-ciudad-sola', (e) => {
      const n = e.features?.[0]?.properties?.n
      if (typeof n === 'number') onSeleccionar(n)
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

  // ── Volver al plano general ───────────────────────────────────────────────
  // El botón «Ver todas» (el globo) y el conmutador de sedes (un país). Deseleccionar
  // y volver a ver el conjunto son dos intenciones distintas —seleccionar una obra
  // jamás aleja la cámara— así que esta es la única puerta de vuelta, y llega como
  // contador para poder repetirse.
  const reencuadrePrevio = useRef(reencuadre)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || reencuadre === reencuadrePrevio.current) return
    reencuadrePrevio.current = reencuadre
    destino.current = null   // esto no es el vuelo a una obra
    m.stop()   // por si venía orbitando
    const mg = { top: mTop, right: mRight, bottom: mBottom, left: mLeft }
    if (sedeEncuadre == null) {
      const mundo = vistaMundo()
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) m.jumpTo({ ...mundo, padding: mg })
      else m.flyTo({ ...mundo, padding: mg, curve: 1.42, speed: 1.1, essential: true })
      return
    }
    encuadrarCaja(m, limitesDeSede(puntos, sedeEncuadre) ?? limites(puntos), mg)
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

    const cambio = seleccionado !== selPrevia.current
    if (cambio) {
      if (selPrevia.current != null) m.setFeatureState({ source: FUENTE, id: selPrevia.current - 1 }, { sel: false })
      selPrevia.current = seleccionado
    }

    // Al deseleccionar se para la órbita pero NO se devuelve la cámara: volver al
    // encuadre general es otra intención y tiene su propio botón en la lista.
    if (seleccionado == null) { if (cambio) { destino.current = null; m.stop() } return }

    // Los márgenes están en las dependencias a propósito: el hueco visible cambia
    // AL elegir la obra —entra la ficha— y ese número llega un render después del
    // vuelo. Volver a lanzarlo con el padding bueno lo recentra sin que se note: a
    // los pocos milisegundos de despegar, el nuevo vuelo sale prácticamente del
    // mismo sitio. Lo que no puede pasar es que lo relance un margen que llega
    // cuando ya se ha aterrizado, y de eso se encarga el candado de abajo.
    if (!cambio && !destino.current) return

    const p = conCoords[seleccionado - 1]
    if (!p) return
    m.setFeatureState({ source: FUENTE, id: seleccionado - 1 }, { sel: true })

    // La obra de ENTRADA se marca y ya está. La cámara la tiene encuadrada desde
    // el encuadre inicial, así que volar hasta ella sería animar para no ir a
    // ninguna parte — y de paso subir el zoom por encima del que abre la página.
    if (entradaAutomatica) { destino.current = null; return }

    // `flyTo`, no `easeTo`. No son dos maneras de lo mismo: easeTo interpola en
    // línea recta y a zoom alto eso pasa como un borrón. flyTo implementa la curva
    // de Van Wijk y Nuij —se eleva lo justo, recorre, y baja—, que es como el ojo
    // entiende un desplazamiento sobre un territorio.
    //
    // Dentro de la ciudad, ni el rumbo ni el cabeceo se tocan: son del visitante. Si
    // se viene desde el globo o desde otra ciudad, sí: se aterriza con la cámara de
    // la casa, que es la que levanta los edificios. Y el zoom solo sube, nunca baja
    // — seleccionar una obra jamás aleja la cámara.
    // El padding viaja CON el vuelo y no se aplica aparte: `setPadding` es un
    // `jumpTo` por dentro y cortaría este mismo vuelo un instante después.
    const lejos = m.getZoom() < 12 || kmEntre(m.getCenter(), p) > KM_SALTO
    const meta = {
      center: [p.lng, p.lat] as [number, number],
      zoom: Math.max(m.getZoom(), ZOOM_DETALLE),
      padding: margenesRef.current,
      ...(lejos ? { bearing: CAMARA.rumbo, pitch: CAMARA.cabeceo } : {}),
    }
    destino.current = { lat: p.lat, lng: p.lng }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { m.jumpTo(meta); return }
    // Cambiar de ciudad es cruzar un océano: la curva sube más, hasta ver el planeta.
    if (lejos) { m.flyTo({ ...meta, curve: 1.42, speed: 1.1, essential: true }); return }
    m.flyTo({ ...meta, curve: 1.2, speed: 0.85, essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado, listo, puntos, entradaAutomatica, mTop, mRight, mBottom, mLeft])

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
    // Solo se orbita alrededor de una obra elegida. Girar el rumbo con el globo en
    // pantalla no gira el planeta: tuerce el norte, y eso no se lee como nada.
    if (seleccionado == null || entradaAutomatica) return

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
      // Y `moveend` tampoco quiere decir «he llegado»: una animación CORTADA emite
      // el mismo evento. Si hay vuelo vivo y la cámara no ha quedado sobre la obra,
      // esto es un corte y no un aterrizaje — ponerse a orbitar aquí era rematar el
      // vuelo que el padding acababa de abortar, y dejar la cámara girando a medio
      // camino de la obra elegida.
      const meta = destino.current
      if (meta) {
        if (kmEntre(m.getCenter(), meta) > 0.05) return
        destino.current = null   // llegada buena: el vuelo se cierra aquí
      }
      girar()
      if (!continua) vivo = false   // táctil: un solo tramo
    }

    // Un único registro. Antes había `once` + `on` a la vez y el primer aterrizaje
    // disparaba dos animaciones de cámara compitiendo.
    m.on('moveend', alAterrizar)

    // Sin vuelo en el aire no hay aterrizaje al que engancharse, así que arranca
    // ella sola: la obra se ha elegido con la cámara ya encima.
    if (destino.current == null) {
      girar()
      if (!continua) vivo = false
    }

    return () => {
      vivo = false
      m.off('moveend', alAterrizar)
      m.stop()
    }
  }, [seleccionado, listo, entradaAutomatica])

  return <div ref={contenedor} className="fp-mapa-lienzo" aria-hidden="true" />
}

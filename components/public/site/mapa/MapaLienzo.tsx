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
import { CAMARA, aGeoJSON, limites, tieneCoordenadas, type MapaPunto } from '@/lib/web-mapa'

const FUENTE = 'fp-obras'

export default function MapaLienzo({ puntos, activo, onActivo, onFallo }: {
  puntos: MapaPunto[]
  /** Índice (1..n) del punto resaltado, o null. Lo comparte con la lista. */
  activo: number | null
  onActivo: (n: number | null) => void
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
    if (!mapboxgl.supported?.()) { onFallo(); return }

    mapboxgl.accessToken = token
    const m = new mapboxgl.Map({
      container: contenedor.current,
      style: CAMARA.estilo,
      center: CAMARA.centro,
      zoom: CAMARA.zoomRespaldo,
      bearing: CAMARA.rumbo,
      pitch: CAMARA.cabeceo,
      minZoom: CAMARA.zoomMin,
      maxZoom: CAMARA.zoomMax,
      attributionControl: true,
      cooperativeGestures: true, // en móvil, un dedo hace scroll de la página
    })
    mapa.current = m

    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.on('error', (e) => console.error('[mapa]', e?.error?.message ?? e))
    m.on('load', () => setListo(true))

    return () => { m.remove(); mapa.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        'circle-opacity': ['case', ['boolean', ['feature-state', 'activo'], false], 0.14, 0.06],
      },
    })
    m.addLayer({
      id: 'fp-obra-punto',
      type: 'circle',
      source: FUENTE,
      paint: {
        'circle-pitch-alignment': 'map',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5.5, 16, 11],
        'circle-color': ['case', ['boolean', ['feature-state', 'activo'], false], site.color.ink, site.color.cream],
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
        'text-color': ['case', ['boolean', ['feature-state', 'activo'], false], site.color.cream, site.color.ink],
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

    const puntero = (v: string) => () => { m.getCanvas().style.cursor = v }
    m.on('mouseenter', 'fp-obra-punto', puntero('pointer'))
    m.on('mouseleave', 'fp-obra-punto', puntero(''))
    m.on('click', 'fp-obra-punto', (e) => {
      const n = e.features?.[0]?.properties?.n
      if (typeof n === 'number') onActivo(n)
    })
  }, [listo, puntos, onActivo])

  // ── Encuadre inicial ──────────────────────────────────────────────────────
  // El zoom NO es el del estilo (15,25): con puntos de Ferraz a Fuente del Berro
  // no cabe ni la mitad. Se calcula de los datos conservando rumbo y cabeceo.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    const caja = limites(puntos)
    if (!caja) return
    m.fitBounds(caja, {
      padding: { top: 110, bottom: 90, left: 70, right: 70 },
      bearing: CAMARA.rumbo,
      pitch: CAMARA.cabeceo,
      duration: 0,
      maxZoom: 15,
    })
  }, [listo, puntos])

  // ── Punto resaltado ──────────────────────────────────────────────────────
  // El resalte va por `feature-state` y no reconstruyendo el GeoJSON: cambiar la
  // fuente en cada hover obligaría a Mapbox a recalcular colisiones de etiquetas
  // en cada movimiento del ratón.
  const previo = useRef<number | null>(null)
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || !m.getSource(FUENTE)) return
    const conCoords = puntos.filter(tieneCoordenadas)

    if (previo.current != null) {
      m.setFeatureState({ source: FUENTE, id: previo.current - 1 }, { activo: false })
    }
    if (activo != null && conCoords[activo - 1]) {
      m.setFeatureState({ source: FUENTE, id: activo - 1 }, { activo: true })
      const p = conCoords[activo - 1]
      m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15.4), duration: 900 })
    }
    previo.current = activo
  }, [activo, listo, puntos])

  return <div ref={contenedor} className="fp-mapa-lienzo" aria-hidden="true" />
}

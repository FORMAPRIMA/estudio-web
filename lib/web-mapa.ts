// Mapa de Madrid del sitio público: las obras del estudio sobre el estilo propio
// de Mapbox. Es un mapa de TRAYECTORIA — todas las obras — y no el portafolio, que
// es la selección que tiene ficha. Los puntos que sí corresponden a un proyecto
// publicado lo enlazan por `proyecto_slug`.

export interface MapaPunto {
  id: string
  nombre: string
  direccion: string | null
  lat: number | null
  lng: number | null
  anio: string | null
  proyecto_id: string | null
  /** Resuelto al leer: si el proyecto enlazado está publicado, su slug. */
  proyecto_slug: string | null
  orden: number
  activo: boolean
}

/** Un punto solo se puede pintar si tiene las dos coordenadas. */
export function tieneCoordenadas(p: MapaPunto): p is MapaPunto & { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number'
}

// ── Encuadre ────────────────────────────────────────────────────────────────
// El encuadre de partida es el de Jose en Mapbox Studio —rumbo y cabeceo— pero NO
// su zoom: 15,25 no cabe con puntos que van de Ferraz a Fuente del Berro. El zoom
// lo decide `fitBounds` sobre los puntos reales, y a partir de ahí manda el
// visitante.
export const CAMARA = {
  estilo: 'mapbox://styles/forma-prima/cmsyy5vuo009601s0409u7n5t',
  rumbo: -11.2,
  cabeceo: 63,
  /** Centro de respaldo si aún no hay ningún punto geocodificado. */
  centro: [-3.687037, 40.418969] as [number, number],
  zoomRespaldo: 13.2,
  /** Tope de acercamiento: más allá el estilo pierde las extrusiones. */
  zoomMax: 17.6,
  zoomMin: 10.5,
} as const

/** Caja que contiene todos los puntos, para el encuadre inicial. */
export function limites(puntos: MapaPunto[]): [[number, number], [number, number]] | null {
  const con = puntos.filter(tieneCoordenadas)
  if (!con.length) return null
  let oeste = Infinity, sur = Infinity, este = -Infinity, norte = -Infinity
  for (const p of con) {
    oeste = Math.min(oeste, p.lng); este = Math.max(este, p.lng)
    sur = Math.min(sur, p.lat);     norte = Math.max(norte, p.lat)
  }
  return [[oeste, sur], [este, norte]]
}

/** GeoJSON para la fuente del mapa. El número es el que se pinta en el punto y el
 *  que aparece en la lista de al lado: son la misma serie. */
export function aGeoJSON(puntos: MapaPunto[]) {
  return {
    type: 'FeatureCollection' as const,
    features: puntos.filter(tieneCoordenadas).map((p, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        n: i + 1,
        nombre: p.nombre,
        anio: p.anio ?? '',
        slug: p.proyecto_slug ?? '',
      },
    })),
  }
}

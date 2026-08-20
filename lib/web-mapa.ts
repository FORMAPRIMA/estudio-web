// Mapa de Madrid del sitio público: las obras del estudio sobre el estilo propio
// de Mapbox. Es un mapa de TRAYECTORIA — todas las obras — y no el portafolio, que
// es la selección que tiene ficha. Los puntos que sí corresponden a un proyecto
// publicado lo enlazan por `proyecto_slug`.

// ── Uso de la obra ──────────────────────────────────────────────────────────
// Lista CERRADA y no texto libre. Las tipologías que el estudio ya escribe en las
// fichas mezclan dos ejes —«Residencial · Reforma Integral»— y con un campo libre
// convivirían «Residencial», «residencial» y «Vivienda» en seis meses, sin que
// ninguna leyenda ni filtro pudiera agruparlos. Se guarda el CÓDIGO y la etiqueta
// se pinta en el idioma que toque, como el resto del sitio.
//
// Un solo eje, el uso. El segundo (reforma integral / obra nueva / interiorismo)
// será otra columna el día que haga falta: añadirla luego es trivial, nacer con
// dos listas que rellenar 27 veces cada una, no.
export const USOS = [
  { codigo: 'residencial',  es: 'Residencial',  en: 'Residential' },
  { codigo: 'comercial',    es: 'Comercial',    en: 'Retail' },
  { codigo: 'hosteleria',   es: 'Hostelería',   en: 'Hospitality' },
  { codigo: 'oficinas',     es: 'Oficinas',     en: 'Workplace' },
  { codigo: 'equipamiento', es: 'Equipamiento', en: 'Civic' },
  { codigo: 'industrial',   es: 'Industrial',   en: 'Industrial' },
  { codigo: 'otros',        es: 'Otros',        en: 'Other' },
] as const

export type UsoCodigo = (typeof USOS)[number]['codigo']

export function etiquetaUso(codigo: string | null, locale: 'es' | 'en'): string {
  const u = USOS.find((x) => x.codigo === codigo)
  return u ? (locale === 'en' ? u.en : u.es) : ''
}

export interface MapaPunto {
  id: string
  nombre: string
  direccion: string | null
  lat: number | null
  lng: number | null
  anio: string | null
  /** Foto propia del punto. Respaldo de la portada del proyecto enlazado. */
  imagen_url: string | null
  /** Código de USOS. Respaldo de la tipología del proyecto enlazado. */
  uso: string | null
  proyecto_id: string | null
  /** Resuelto al leer: si el proyecto enlazado está publicado, su slug. */
  proyecto_slug: string | null
  /** Resueltos al leer: la ficha publicada manda sobre los campos del punto.
   *  Así no hay que duplicar la información de las obras que ya tienen dossier, y
   *  si mañana cambia la portada del proyecto, la del mapa cambia sola. */
  proyecto_hero_url: string | null
  proyecto_tipologia_es: string | null
  proyecto_tipologia_en: string | null
  orden: number
  activo: boolean
}

/** Lo que la tarjeta enseña de una obra: la ficha publicada primero, y si no la
 *  hay —21 de las 27— lo que se haya cargado en el propio punto del mapa. */
export function datosDeTarjeta(p: MapaPunto, locale: 'es' | 'en') {
  const tipologiaFicha = locale === 'en'
    ? (p.proyecto_tipologia_en || p.proyecto_tipologia_es)
    : p.proyecto_tipologia_es
  return {
    imagen: p.proyecto_hero_url || p.imagen_url,
    descriptor: tipologiaFicha || etiquetaUso(p.uso, locale),
    slug: p.proyecto_slug,
  }
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

/**
 * Píxeles del lienzo que tapan las ventanas flotantes por cada lado.
 *
 * No es una preferencia de encuadre: es la diferencia entre el lienzo y el HUECO
 * VISIBLE. Mapbox centra en el rectángulo que resulta de restarle esto al lienzo,
 * así que sin estos cuatro números el vuelo a una obra la deja debajo del índice
 * o debajo de la ficha y parece que no ha pasado nada.
 */
export type Margenes = { top: number; right: number; bottom: number; left: number }

export const SIN_MARGENES: Margenes = { top: 0, right: 0, bottom: 0, left: 0 }

/** A partir de aquí, un punto está en otra ciudad. El área metropolitana de Madrid
 *  no llega a 50 km, así que 100 es holgado y no necesita afinarse. */
const KM_OTRA_CIUDAD = 100

/**
 * Caja para el encuadre inicial — la del NÚCLEO, no la de todos los puntos.
 *
 * El mapa nació siendo de obras en Madrid, pero en cuanto entra una obra en otro
 * continente (Monterrey) el encuadre que las contiene a todas es medio planeta:
 * se abriría enseñando el Atlántico con dos motas. Se encuadra el grupo denso y
 * las obras lejanas siguen estando a un clic en la lista, que es donde se las
 * busca de todos modos.
 *
 * El centro se calcula con la MEDIANA y no con la media, justamente para que un
 * punto en otro continente no arrastre la referencia.
 */
export function limites(puntos: MapaPunto[]): [[number, number], [number, number]] | null {
  const con = puntos.filter(tieneCoordenadas)
  if (!con.length) return null

  const mediana = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b)
    const m = Math.floor(o.length / 2)
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
  }
  const latC = mediana(con.map((p) => p.lat))
  const lngC = mediana(con.map((p) => p.lng))
  const km = (p: { lat: number; lng: number }) =>
    Math.hypot((p.lat - latC) * 111.3, (p.lng - lngC) * 111.3 * Math.cos((latC * Math.PI) / 180))

  // Si el filtro dejara el mapa casi vacío es que no hay núcleo: se encuadra todo.
  const nucleo = con.filter((p) => km(p) <= KM_OTRA_CIUDAD)
  const usar = nucleo.length >= 2 ? nucleo : con

  let oeste = Infinity, sur = Infinity, este = -Infinity, norte = -Infinity
  for (const p of usar) {
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

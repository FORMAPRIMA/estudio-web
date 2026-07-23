// Utilidades geométricas mínimas (sin dependencias): parseo GML → GeoJSON,
// centroide, bbox y conversión a rings ESRI para las queries ArcGIS.

import type { GeoJSONGeometry, GeoJSONPolygon, GeoJSONMultiPolygon, Position } from './types'

/**
 * Parsea las superficies GML del WFS INSPIRE de Catastro a GeoJSON.
 * Los posList vienen en orden "lat lng" (EPSG:4326 con axis order geográfico);
 * GeoJSON exige [lng, lat].
 */
export function gmlToGeoJSON(xml: string): GeoJSONGeometry | null {
  const surfaces = xml.match(/<gml:Surface[\s\S]*?<\/gml:Surface>/g)
  if (!surfaces || surfaces.length === 0) return null

  const polygons: Position[][][] = []
  for (const surface of surfaces) {
    const rings: Position[][] = []
    const exterior = surface.match(/<gml:exterior>[\s\S]*?<\/gml:exterior>/)
    if (exterior) {
      const ring = parsePosList(exterior[0])
      if (ring) rings.push(ring)
    }
    const interiors = surface.match(/<gml:interior>[\s\S]*?<\/gml:interior>/g) || []
    for (const interior of interiors) {
      const ring = parsePosList(interior)
      if (ring) rings.push(ring)
    }
    if (rings.length > 0) polygons.push(rings)
  }
  if (polygons.length === 0) return null
  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: polygons[0] } satisfies GeoJSONPolygon
  }
  return { type: 'MultiPolygon', coordinates: polygons } satisfies GeoJSONMultiPolygon
}

function parsePosList(fragment: string): Position[] | null {
  const m = fragment.match(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/)
  if (!m) return null
  const nums = m[1].trim().split(/\s+/).map(Number)
  if (nums.length < 6 || nums.some(isNaN)) return null
  const ring: Position[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    ring.push([nums[i + 1], nums[i]]) // lat lng → [lng, lat]
  }
  return ring
}

/** Combina varias geometrías en un MultiPolygon (parcelas de un mismo activo). */
export function combineGeometries(geoms: GeoJSONGeometry[]): GeoJSONGeometry | null {
  const polys: Position[][][] = []
  for (const g of geoms) {
    if (!g) continue
    if (g.type === 'Polygon') polys.push(g.coordinates)
    else polys.push(...g.coordinates)
  }
  if (polys.length === 0) return null
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] }
  return { type: 'MultiPolygon', coordinates: polys }
}

/** Centroide aproximado (media de vértices del anillo exterior mayor). */
export function centroid(geom: GeoJSONGeometry): Position | null {
  const ring = largestExteriorRing(geom)
  if (!ring || ring.length === 0) return null
  let sx = 0, sy = 0
  for (const [x, y] of ring) { sx += x; sy += y }
  return [sx / ring.length, sy / ring.length]
}

export function bbox(geom: GeoJSONGeometry): [number, number, number, number] | null {
  const rings = allRings(geom)
  if (rings.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return [minX, minY, maxX, maxY]
}

function allRings(geom: GeoJSONGeometry): Position[][] {
  if (geom.type === 'Polygon') return geom.coordinates
  return geom.coordinates.flat()
}

function largestExteriorRing(geom: GeoJSONGeometry): Position[] | null {
  const exteriors = geom.type === 'Polygon'
    ? [geom.coordinates[0]]
    : geom.coordinates.map((p) => p[0])
  if (exteriors.length === 0) return null
  let best = exteriors[0]
  let bestArea = 0
  for (const ring of exteriors) {
    const a = Math.abs(planarRingArea(ring))
    if (a >= bestArea) { bestArea = a; best = ring }
  }
  return best
}

function planarRingArea(ring: Position[]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return sum / 2
}

/**
 * Área en m² de la geometría (shoelace con corrección de latitud).
 * Suficientemente precisa para parcelas urbanas; el dato oficial sigue siendo
 * el areaValue de Catastro.
 */
export function areaM2(geom: GeoJSONGeometry): number {
  const R = 6378137
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let total = 0
  for (const rings of polys) {
    rings.forEach((ring, idx) => {
      const latRef = (ring[0]?.[1] ?? 0) * Math.PI / 180
      const kx = R * Math.cos(latRef) * Math.PI / 180
      const ky = R * Math.PI / 180
      let sum = 0
      for (let i = 0; i < ring.length - 1; i++) {
        const x1 = ring[i][0] * kx, y1 = ring[i][1] * ky
        const x2 = ring[i + 1][0] * kx, y2 = ring[i + 1][1] * ky
        sum += x1 * y2 - x2 * y1
      }
      const a = Math.abs(sum / 2)
      total += idx === 0 ? a : -a // interiores restan
    })
  }
  return Math.round(total)
}

/**
 * Test punto-en-geometría (ray casting even-odd, incluye huecos).
 * Para clasificar features puntuales (p. ej. un BIC declarado como punto)
 * respecto a la parcela.
 */
export function pointInGeometry(pt: Position, geom: GeoJSONGeometry): boolean {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const rings of polys) {
    if (rings.length === 0) continue
    if (!pointInRing(pt, rings[0])) continue
    // dentro del exterior: los interiores (huecos) excluyen
    const enHueco = rings.slice(1).some((r) => pointInRing(pt, r))
    if (!enHueco) return true
  }
  return false
}

function pointInRing([px, py]: Position, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Convierte la geometría GeoJSON a rings ESRI (para query espacial ArcGIS). */
export function toEsriRings(geom: GeoJSONGeometry): number[][][] {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  return polys.flat().map((ring) => ring.map(([x, y]) => [x, y]))
}

/**
 * Convierte rings ESRI (respuesta ArcGIS) a GeoJSON respetando la convención
 * ESRI: anillos horarios = exteriores, antihorarios = huecos. Un feature con
 * varios exteriores se convierte en MultiPolygon (antes se interpretaban como
 * huecos y desaparecían piezas).
 */
export function esriRingsToGeoJSON(rings: number[][][]): GeoJSONGeometry | null {
  if (!Array.isArray(rings) || rings.length === 0) return null
  const polys: Position[][][] = []
  let current: Position[][] | null = null
  for (const raw of rings) {
    if (!Array.isArray(raw) || raw.length < 4) continue
    const ring = raw.map(([x, y]) => [x, y] as Position)
    const isOuter = planarRingArea(ring) < 0 // horario (ESRI exterior)
    if (isOuter || !current) {
      current = [ring]
      polys.push(current)
    } else {
      current.push(ring)
    }
  }
  if (polys.length === 0) return null
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] }
  return { type: 'MultiPolygon', coordinates: polys }
}

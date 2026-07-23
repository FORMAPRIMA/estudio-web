// Cliente de las capas urbanísticas del Ayuntamiento de Madrid
// (ArcGIS REST en sigma.madrid.es — servicios verificados el 3 jul 2026).
//
// ⚠️ La información de estos visores CARECE DE VALOR JURÍDICO (lo advierte el
// propio Geoportal). Todos los hits se guardan con legal_value = false y la app
// lo señala en ficha, chat e informe.

import intersect from '@turf/intersect'
import turfArea from '@turf/area'
import { feature, featureCollection } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { toEsriRings, esriRingsToGeoJSON, pointInGeometry } from './geometry'
import type { GeoJSONGeometry, HitCategoria, Position } from './types'

const SIGMA = 'https://sigma.madrid.es/hosted/rest/services'

export interface ServiceConfig {
  service: string          // 'FOLDER/SERVICE'
  categoria: HitCategoria
  label: string
  /** Nombres de capa a excluir (p. ej. 'Término Municipal' intersecta siempre). */
  excludeLayers?: string[]
  /** Si se indica, solo se consultan capas cuyo nombre incluya alguno de estos textos. */
  includeLayers?: string[]
}

// Servicios consultados en cada análisis. Enumeramos las capas de cada
// MapServer dinámicamente (los IDs pueden cambiar; los nombres son estables).
export const GEOPORTAL_SERVICES: ServiceConfig[] = [
  { service: 'DESARROLLO_URBANO_ACTUALIZADO/NORMAS_ZONALES',                  categoria: 'norma_zonal',   label: 'Normas Zonales (vigente)' },
  { service: 'DESARROLLO_URBANO_ACTUALIZADO/EDIFICIOS_PROTEGIDOS_VIGENTE',    categoria: 'proteccion',    label: 'Catálogo de protección (vigente)', excludeLayers: ['Término Municipal', 'Cerca y Arrabal de Felipe II', 'APE.00.01'] },
  // 'Término Municipal' interseca con todo Madrid, y la capa 'Ámbitos
  // Ordenación' devuelve también el polígono de la propia norma zonal
  // (p. ej. '8.1.a'), que NO es un ámbito de planeamiento específico: se
  // filtra después con esAmbitoEspecifico() en red flags / cuadro / checklist.
  { service: 'DESARROLLO_URBANO_ACTUALIZADO/AMBITOS_PLANEAMIENTO_URBANISTICO', categoria: 'ambito',        label: 'Ámbitos de planeamiento (APE/APR/API...)', excludeLayers: ['Término Municipal'] },
  { service: 'DESARROLLO_URBANO_ACTUALIZADO/PLANEAMIENTO_URBANISTICO',        categoria: 'planeamiento',  label: 'Modificaciones y desarrollos del PGOUM', excludeLayers: ['Término Municipal'] },
  { service: 'DESARROLLO_URBANO_ACTUALIZADO/USOS_SUELO',                      categoria: 'uso_suelo',     label: 'Usos del suelo' },
  // 'Linea de Término' es el límite municipal: interseca con cualquier parcela
  // de Madrid y provocaba falsos positivos de afección BIC.
  { service: 'DESARROLLO_URBANO_ACTUALIZADO/BIC',                             categoria: 'bic',           label: 'Bienes de Interés Cultural', excludeLayers: ['Linea de Término', 'Línea de Término', 'Término Municipal'] },
  { service: 'PGOUM97/PG_ORDENACION_SIN_AMBITO',                              categoria: 'norma_zonal',   label: 'PGOUM 97 — Ordenación' },
  { service: 'PGOUM97/PG_CONDICIONES_EDIFICACION',                            categoria: 'condiciones',   label: 'PGOUM 97 — Condiciones de edificación' },
  { service: 'PGOUM97/PG_ANALISIS_EDIFICACION',                               categoria: 'analisis_edificacion', label: 'PGOUM 97 — Análisis de la edificación' },
  { service: 'PGOUM97/AREAS_PROTECCION_ARQUEOLOGICA_PALEONTOLOGICA',          categoria: 'arqueologia',   label: 'Protección arqueológica y paleontológica' },
]

export interface LayerHitRaw {
  categoria: HitCategoria
  service: string
  layer_id: number
  layer_name: string
  attributes: Record<string, unknown>
  source_url: string
}

interface ArcgisLayerInfo {
  id: number
  name: string
  subLayerIds?: number[] | null
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 25000): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { cache: 'no-store', ...init, signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Consulta un servicio completo: enumera capas y lanza la intersección de la
 * parcela contra cada capa hoja. Devuelve los features encontrados.
 */
export async function queryService(
  cfg: ServiceConfig,
  geometry: GeoJSONGeometry
): Promise<LayerHitRaw[]> {
  const base = `${SIGMA}/${cfg.service}/MapServer`
  const meta = await fetchJson(`${base}?f=json`)
  if (!meta || !Array.isArray(meta.layers)) return []

  const layers = (meta.layers as ArcgisLayerInfo[]).filter((l) => {
    if (l.subLayerIds && l.subLayerIds.length > 0) return false // capas grupo
    if (cfg.excludeLayers?.some((x) => l.name === x)) return false
    if (cfg.includeLayers && !cfg.includeLayers.some((x) => l.name.includes(x))) return false
    return true
  })

  const esriGeometry = JSON.stringify({
    rings: toEsriRings(geometry),
    spatialReference: { wkid: 4326 },
  })

  const results = await Promise.allSettled(
    layers.map(async (layer): Promise<LayerHitRaw[]> => {
      const body = new URLSearchParams({
        geometry: esriGeometry,
        geometryType: 'esriGeometryPolygon',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'false',
        f: 'json',
      })
      const url = `${base}/${layer.id}/query`
      const json = await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (!json || json.error || !Array.isArray(json.features)) return []
      return (json.features as { attributes: Record<string, unknown> }[]).map((f) => ({
        categoria: cfg.categoria,
        service: cfg.service,
        layer_id: layer.id,
        layer_name: layer.name,
        attributes: cleanAttributes(f.attributes),
        source_url: url,
      }))
    })
  )

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/** Elimina atributos internos ruidosos (OBJECTID, Shape...) manteniendo el resto. */
function cleanAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (/^(objectid|shape[._]|se_anno|globalid)/i.test(k)) continue
    if (v === null || v === ' ' || v === '') continue
    out[k] = v
  }
  return out
}

// ── BIC: verificación geométrica real (directo vs entorno) ───────────────────
// El servidor puede devolver "intersecta" para capas sin geometría útil o
// features enormes; aquí se re-verifica cada feature contra la parcela con la
// geometría real y se clasifica la afección. Los hits salen anotados en
// attributes: _afeccion ('directa'|'entorno'|'no_verificable'),
// _solape_parcela_pct y _bic_nombre. Los features que NO tocan la parcela se
// descartan (eran falsos positivos).

type TFeat = Feature<Polygon | MultiPolygon>

function safeIntersectGeoms(a: GeoJSONGeometry, b: GeoJSONGeometry): TFeat | null {
  try {
    return intersect(featureCollection([
      feature(a as Polygon | MultiPolygon),
      feature(b as Polygon | MultiPolygon),
    ])) as TFeat | null
  } catch {
    return null
  }
}

function extractNombreBic(attrs: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(attrs)) {
    if (/NOMBRE|DENOMIN|TITULO|TX_DENOM|TX_DESCRIPCION/i.test(k) && typeof v === 'string' && v.trim()) {
      return v.trim()
    }
  }
  return null
}

async function queryBicVerificado(
  cfg: ServiceConfig,
  parcelGeom: GeoJSONGeometry
): Promise<LayerHitRaw[]> {
  const base = `${SIGMA}/${cfg.service}/MapServer`
  const meta = await fetchJson(`${base}?f=json`)
  if (!meta || !Array.isArray(meta.layers)) return []
  const layers = (meta.layers as ArcgisLayerInfo[]).filter((l) => {
    if (l.subLayerIds && l.subLayerIds.length > 0) return false
    if (cfg.excludeLayers?.some((x) => l.name === x)) return false
    return true
  })

  const parcelAreaM2 = turfArea(feature(parcelGeom as Polygon | MultiPolygon))
  const esriGeometry = JSON.stringify({
    rings: toEsriRings(parcelGeom),
    spatialReference: { wkid: 4326 },
  })

  const results = await Promise.allSettled(
    layers.map(async (layer): Promise<LayerHitRaw[]> => {
      const body = new URLSearchParams({
        geometry: esriGeometry,
        geometryType: 'esriGeometryPolygon',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        geometryPrecision: '7',
        f: 'json',
      })
      const url = `${base}/${layer.id}/query`
      const json = await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (!json || json.error || !Array.isArray(json.features)) return []

      const esEntornoCapa = /entorno/i.test(layer.name)
      const out: LayerHitRaw[] = []

      for (const f of json.features as {
        attributes: Record<string, unknown>
        geometry?: { rings?: number[][][]; x?: number; y?: number }
      }[]) {
        const attrs = cleanAttributes(f.attributes)
        const esEntorno = esEntornoCapa
          || Object.entries(attrs).some(([k, v]) =>
            /entorno/i.test(k) || (typeof v === 'string' && /entorno/i.test(v)))

        let afeccion: 'directa' | 'entorno' | 'no_verificable' | null = null
        let solapePct: number | null = null

        if (f.geometry?.rings) {
          const geom = esriRingsToGeoJSON(f.geometry.rings)
          const inter = geom ? safeIntersectGeoms(geom, parcelGeom) : null
          const interArea = inter ? turfArea(inter) : 0
          // >0,5 m² para descartar roces de borde por precisión de digitalización
          if (interArea <= 0.5) continue // falso positivo del servidor: fuera
          afeccion = esEntorno ? 'entorno' : 'directa'
          solapePct = parcelAreaM2 > 0
            ? Math.min(100, Math.round((interArea / parcelAreaM2) * 1000) / 10)
            : null
        } else if (typeof f.geometry?.x === 'number' && typeof f.geometry?.y === 'number') {
          if (!pointInGeometry([f.geometry.x, f.geometry.y] as Position, parcelGeom)) continue
          afeccion = esEntorno ? 'entorno' : 'directa'
        } else {
          // sin geometría en el feature: no se puede verificar → se conserva con aviso
          afeccion = 'no_verificable'
        }

        out.push({
          categoria: cfg.categoria,
          service: cfg.service,
          layer_id: layer.id,
          layer_name: layer.name,
          attributes: {
            ...attrs,
            _afeccion: afeccion,
            ...(solapePct != null ? { _solape_parcela_pct: solapePct } : {}),
            ...(extractNombreBic(attrs) ? { _bic_nombre: extractNombreBic(attrs) } : {}),
          },
          source_url: url,
        })
      }
      return out
    })
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/** Ejecuta todos los servicios en paralelo. */
export async function queryAllServices(geometry: GeoJSONGeometry): Promise<{
  hits: LayerHitRaw[]
  serviciosOk: string[]
  serviciosError: string[]
}> {
  const settled = await Promise.allSettled(
    GEOPORTAL_SERVICES.map((cfg) =>
      cfg.categoria === 'bic' ? queryBicVerificado(cfg, geometry) : queryService(cfg, geometry)
    )
  )
  const hits: LayerHitRaw[] = []
  const serviciosOk: string[] = []
  const serviciosError: string[] = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      hits.push(...r.value)
      serviciosOk.push(GEOPORTAL_SERVICES[i].service)
    } else {
      serviciosError.push(GEOPORTAL_SERVICES[i].service)
    }
  })
  return { hits, serviciosOk, serviciosError }
}

// ── Bandas de fondo con geometría (plano de Condiciones de Edificación) ──────
// Los polígonos de la capa "Condiciones de la Edificación" delimitan cada banda
// con su COEF_Z (nº de plantas). Son la base del volumen capaz.

export interface BandaCondiciones {
  plantas: number | null
  coefZRaw: string
  geometry: GeoJSONGeometry
  attributes: Record<string, unknown>
}

export async function queryCondicionesBandas(geometry: GeoJSONGeometry): Promise<BandaCondiciones[]> {
  const base = `${SIGMA}/PGOUM97/PG_CONDICIONES_EDIFICACION/MapServer`
  const meta = await fetchJson(`${base}?f=json`)
  if (!meta || !Array.isArray(meta.layers)) return []
  const layer = (meta.layers as ArcgisLayerInfo[]).find((l) => /Condiciones de la Edificaci/i.test(l.name))
  if (!layer) return []

  const body = new URLSearchParams({
    geometry: JSON.stringify({ rings: toEsriRings(geometry), spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPolygon',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  })
  const json = await fetchJson(`${base}/${layer.id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!json || json.error || !Array.isArray(json.features)) return []

  const bandas: BandaCondiciones[] = []
  for (const f of json.features as { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }[]) {
    if (!f.geometry?.rings) continue
    const geom = esriRingsToGeoJSON(f.geometry.rings)
    if (!geom) continue
    const coefZ = String(f.attributes.COEF_Z ?? '').trim()
    const nums = coefZ.match(/\d+/g)?.map(Number).filter((n) => n > 0 && n < 30) || []
    bandas.push({
      plantas: nums.length ? Math.max(...nums) : null,
      coefZRaw: coefZ,
      geometry: geom,
      attributes: f.attributes,
    })
  }
  return bandas
}

/**
 * Contexto 3D: edificios con altura real (cartografía base municipal).
 * La capa trocea cada edificio por cambios de altura de cubierta, así que una
 * manzana densa supera fácilmente el millar de piezas: se pagina hasta traer
 * el contexto completo (tope de seguridad ~6000) con geometría a 6 decimales
 * (~10 cm) para aligerar el payload.
 */
export async function queryEdificiosAlturas(
  bboxWgs84: [number, number, number, number],
  maxFeatures = 6000
): Promise<{ geometry: GeoJSONGeometry; alturaM: number }[]> {
  const PAGE = 1000
  const out: { geometry: GeoJSONGeometry; alturaM: number }[] = []

  for (let offset = 0; offset < maxFeatures; offset += PAGE) {
    const body = new URLSearchParams({
      geometry: JSON.stringify({
        xmin: bboxWgs84[0], ymin: bboxWgs84[1], xmax: bboxWgs84[2], ymax: bboxWgs84[3],
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ALTURA',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '6',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: 'json',
    })
    const json = await fetchJson(`${SIGMA}/CARTOGRAFIA/EDIFICIOS_ALTURAS/MapServer/0/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }, 30000)
    if (!json || json.error || !Array.isArray(json.features)) break

    const features = json.features as { attributes: { ALTURA?: number }; geometry?: { rings?: number[][][] } }[]
    for (const f of features) {
      if (!f.geometry?.rings || typeof f.attributes?.ALTURA !== 'number') continue
      const geom = esriRingsToGeoJSON(f.geometry.rings)
      if (geom) out.push({ geometry: geom, alturaM: Math.max(2, f.attributes.ALTURA) })
    }
    // Última página: el servidor devolvió menos del tamaño de página
    if (features.length < PAGE) break
  }
  return out
}

/**
 * Altura real (m) del edificio existente en la parcela según la cartografía
 * municipal de alturas: máximo ALTURA de las piezas que solapan la parcela.
 * Alimenta la columna "estado actual" del cuadro urbanístico.
 */
export async function queryAlturaEdificioEnParcela(
  parcelGeom: GeoJSONGeometry,
  bboxWgs84: [number, number, number, number]
): Promise<number | null> {
  const piezas = await queryEdificiosAlturas(bboxWgs84, 2000)
  let max: number | null = null
  for (const p of piezas) {
    const inter = safeIntersectGeoms(p.geometry, parcelGeom)
    if (!inter || turfArea(inter) <= 1) continue
    if (max == null || p.alturaM > max) max = p.alturaM
  }
  return max != null ? Math.round(max * 10) / 10 : null
}

/** Extrae la norma zonal (etiqueta tipo '1.3' + denominación) de los hits. */
export function extractNormaZonal(hits: LayerHitRaw[]): { etiqueta: string; denominacion: string } | null {
  const nz = hits.find(
    (h) => h.service.endsWith('NORMAS_ZONALES') && typeof h.attributes.AMB_TX_ETIQ === 'string'
  )
  if (!nz) return null
  return {
    etiqueta: String(nz.attributes.AMB_TX_ETIQ).trim(),
    denominacion: String(nz.attributes.AMB_TX_DENOM ?? '').trim(),
  }
}

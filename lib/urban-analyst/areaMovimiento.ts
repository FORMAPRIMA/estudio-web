// Área de movimiento — Fase 3.
//
// La superficie de parcela donde la norma permite posar la edificación:
// parcela − retranqueos diferenciados por tipo de lindero.
//
//  1. Clasificación de linderos: cada arista del perímetro se testea contra
//     las parcelas catastrales vecinas (WFS INSPIRE por bbox). Arista con
//     vecina al otro lado = medianería (lateral/testero); sin vecina = frente
//     a vía pública. El testero es la medianería más alejada del frente.
//  2. Resta geométrica: cada arista genera una franja prohibida (buffer de su
//     retranqueo) que se sustrae de la parcela (turf buffer/union/difference).
//  3. Volumen capaz cruzado: min(coef × parcela, huella máx. × plantas), con
//     huella máx. = min(área de movimiento, ocupación × parcela). Se informa
//     qué restricción vincula.
//
// Todo determinista y etiquetado como HIPÓTESIS: las alineaciones oficiales y
// los fondos edificables no se verifican aquí (visores sin valor jurídico).

import buffer from '@turf/buffer'
import difference from '@turf/difference'
import union from '@turf/union'
import turfArea from '@turf/area'
import { feature, featureCollection, lineString } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { pointInGeometry } from './geometry'
import type { GeoJSONGeometry, Position } from './types'

export type TipoLindero = 'frente' | 'lateral' | 'testero'

/** Arista del perímetro con su clasificación (editable desde el gemelo 3D). */
export interface LinderoInfo {
  key: string          // "ringIdx:edgeIdx" — estable mientras no cambie la geometría
  a: Position
  b: Position
  tipo: TipoLindero
  longitud_m: number
  override: boolean    // true = clasificado manualmente por el usuario
}

export interface AreaMovimientoResult {
  disponible: boolean
  geometry: GeoJSONGeometry | null           // parcela − retranqueos (para extrusión 3D)
  area_movimiento_m2: number | null
  linderos_m: { frente: number; lateral: number; testero: number }   // longitudes clasificadas
  linderos: LinderoInfo[]                    // aristas clasificadas (para el visor 3D)
  retranqueos_aplicados: { frente: number | null; lateral: number | null; testero: number | null }
  params_aplicados: { ocupacion_pct: number | null; coef_edificabilidad: number | null }
  plantas_aplicadas: number | null
  huella_max_m2: number | null               // min(área movimiento, ocupación × parcela)
  volumen_max_m2c: number | null             // min(coef × parcela, huella máx. × plantas)
  restriccion_vinculante: 'edificabilidad' | 'ocupacion' | 'retranqueos' | null
  remanente_vs_construido_m2c: number | null
  advertencias: string[]
}

type TFeat = Feature<Polygon | MultiPolygon>
const toFeat = (g: GeoJSONGeometry): TFeat => feature(g as Polygon | MultiPolygon)

interface Edge {
  key: string
  a: Position
  b: Position
  mid: Position
  longitudM: number
  tipo: TipoLindero
  override: boolean
}

/** Factores locales m→grados (suficiente a escala de parcela). */
function metersFactors(lat: number): { kx: number; ky: number } {
  const ky = 1 / 111320
  const kx = 1 / (111320 * Math.cos((lat * Math.PI) / 180))
  return { kx, ky }
}

function edgeLengthM(a: Position, b: Position): number {
  const { kx, ky } = metersFactors((a[1] + b[1]) / 2)
  const dx = (b[0] - a[0]) / kx
  const dy = (b[1] - a[1]) / ky
  return Math.hypot(dx, dy)
}

function exteriorRings(geom: GeoJSONGeometry): Position[][] {
  return geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0])
}

export function computeAreaMovimiento(params: {
  parcelGeometry: GeoJSONGeometry
  parcelArea: number | null
  vecinos: GeoJSONGeometry[]
  retranqueoFrente: number | null
  retranqueoLateral: number | null
  retranqueoTestero: number | null
  ocupacionPct: number | null
  coefEdificabilidad: number | null
  plantasMax: number | null
  /** Superficie construida que computa a edificabilidad (bruto − garaje/trastero). */
  construidaComputable: number | null
  /** Reclasificaciones manuales de linderos (key → tipo) hechas desde el 3D. */
  overrides?: Record<string, TipoLindero>
}): AreaMovimientoResult {
  const {
    parcelGeometry, parcelArea, vecinos,
    retranqueoFrente, retranqueoLateral, retranqueoTestero,
    ocupacionPct, coefEdificabilidad, plantasMax, construidaComputable, overrides,
  } = params

  const advertencias: string[] = []
  const base: AreaMovimientoResult = {
    disponible: false,
    geometry: null,
    area_movimiento_m2: null,
    linderos_m: { frente: 0, lateral: 0, testero: 0 },
    linderos: [],
    retranqueos_aplicados: { frente: retranqueoFrente, lateral: retranqueoLateral, testero: retranqueoTestero },
    params_aplicados: { ocupacion_pct: ocupacionPct, coef_edificabilidad: coefEdificabilidad },
    plantas_aplicadas: plantasMax,
    huella_max_m2: null,
    volumen_max_m2c: null,
    restriccion_vinculante: null,
    remanente_vs_construido_m2c: null,
    advertencias,
  }

  const hayRetranqueos = retranqueoFrente != null || retranqueoLateral != null || retranqueoTestero != null
  if (!hayRetranqueos) {
    advertencias.push('La norma zonal no tiene retranqueos registrados: no aplica área de movimiento por separaciones (norma de alineación).')
    return base
  }

  // ── 1. Clasificación de aristas ─────────────────────────────────────────────
  const OFFSET_TEST_M = 1.2   // punto de sondeo al otro lado de la arista
  const edges: Edge[] = []

  const rings = exteriorRings(parcelGeometry)
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]
      const b = ring[i + 1]
      const longitudM = edgeLengthM(a, b)
      if (longitudM < 0.5) continue
      const mid: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const { kx, ky } = metersFactors(mid[1])
      // Normal unitaria (en metros) a la arista
      const dxm = (b[0] - a[0]) / kx
      const dym = (b[1] - a[1]) / ky
      const len = Math.hypot(dxm, dym) || 1
      let nx = -dym / len
      let ny = dxm / len
      // Orientar hacia FUERA de la parcela
      const pruebaDentro: Position = [mid[0] + nx * OFFSET_TEST_M * kx, mid[1] + ny * OFFSET_TEST_M * ky]
      if (pointInGeometry(pruebaDentro, parcelGeometry)) { nx = -nx; ny = -ny }
      const puntoFuera: Position = [mid[0] + nx * OFFSET_TEST_M * kx, mid[1] + ny * OFFSET_TEST_M * ky]

      const key = `${r}:${i}`
      const manual = overrides?.[key]
      const tieneVecina = vecinos.some((v) => pointInGeometry(puntoFuera, v))
      edges.push({
        key, a, b, mid, longitudM,
        tipo: manual ?? (tieneVecina ? 'lateral' : 'frente'),
        override: manual != null,
      })
    }
  }

  if (edges.length === 0) return base

  // Con todas las aristas clasificadas a mano no hace falta parcelario vecino
  const todasManuales = edges.every((e) => e.override)
  let sinVecinosInfo = vecinos.length === 0 && !todasManuales

  const frentes = edges.filter((e) => e.tipo === 'frente')
  const medianerias = edges.filter((e) => e.tipo !== 'frente')

  if (frentes.length === 0) {
    advertencias.push('No se detectó frente a vía pública (¿parcela interior o vecinas no descargadas?): se aplica el retranqueo más exigente a todo el perímetro.')
    if (!todasManuales) sinVecinosInfo = true
  }
  if (sinVecinosInfo && vecinos.length === 0) {
    advertencias.push('Sin parcelario vecino disponible: clasificación de linderos no verificada.')
  }

  // Testero: medianerías más alejadas del centroide del frente (heurística);
  // las aristas reclasificadas a mano no se tocan
  if (frentes.length > 0 && medianerias.length > 0) {
    const fx = frentes.reduce((s, e) => s + e.mid[0] * e.longitudM, 0) / frentes.reduce((s, e) => s + e.longitudM, 0)
    const fy = frentes.reduce((s, e) => s + e.mid[1] * e.longitudM, 0) / frentes.reduce((s, e) => s + e.longitudM, 0)
    const dist = (e: Edge) => edgeLengthM([fx, fy], e.mid)
    const dMax = Math.max(...medianerias.map(dist))
    for (const e of medianerias) {
      if (!e.override && dist(e) >= dMax * 0.8) e.tipo = 'testero'
    }
  }

  for (const e of edges) base.linderos_m[e.tipo] += Math.round(e.longitudM)
  base.linderos = edges.map((e) => ({
    key: e.key, a: e.a, b: e.b, tipo: e.tipo,
    longitud_m: Math.round(e.longitudM * 10) / 10, override: e.override,
  }))

  // ── 2. Resta de franjas de retranqueo ───────────────────────────────────────
  const peorRetranqueo = Math.max(retranqueoFrente ?? 0, retranqueoLateral ?? 0, retranqueoTestero ?? 0)
  const retranqueoDe = (e: Edge): number => {
    if (sinVecinosInfo && !e.override) return peorRetranqueo // sin clasificación fiable: conservador
    if (e.tipo === 'frente') return retranqueoFrente ?? 0
    if (e.tipo === 'testero') return retranqueoTestero ?? retranqueoLateral ?? 0
    return retranqueoLateral ?? 0
  }

  let movimiento: TFeat | null = toFeat(parcelGeometry)
  const franjas: TFeat[] = []
  for (const e of edges) {
    const r = retranqueoDe(e)
    if (r <= 0) continue
    try {
      const franja = buffer(lineString([e.a, e.b]), r, { units: 'meters', steps: 4 })
      if (franja) franjas.push(franja as TFeat)
    } catch { /* arista degenerada */ }
  }
  if (franjas.length > 0) {
    try {
      const prohibido = franjas.length === 1 ? franjas[0] : (union(featureCollection(franjas)) as TFeat | null)
      if (prohibido) {
        movimiento = difference(featureCollection([movimiento!, prohibido])) as TFeat | null
      }
    } catch {
      movimiento = null
    }
  }

  const areaMov = movimiento ? Math.round(turfArea(movimiento)) : 0
  base.disponible = true
  base.geometry = movimiento ? (movimiento.geometry as GeoJSONGeometry) : null
  base.area_movimiento_m2 = areaMov

  if (areaMov <= 0) {
    advertencias.push('Los retranqueos consumen la parcela completa: no queda área de movimiento (parcela bajo mínimos para la tipología de la norma).')
  }

  // ── 3. Volumen capaz cruzado (la más restrictiva vincula) ───────────────────
  const restricciones: { clave: AreaMovimientoResult['restriccion_vinculante']; m2c: number }[] = []
  const huellaOcupacion = ocupacionPct != null && parcelArea != null ? (ocupacionPct / 100) * parcelArea : null
  const huellaMax = huellaOcupacion != null ? Math.min(areaMov, huellaOcupacion) : areaMov
  base.huella_max_m2 = Math.round(huellaMax)

  if (coefEdificabilidad != null && parcelArea != null) {
    restricciones.push({ clave: 'edificabilidad', m2c: coefEdificabilidad * parcelArea })
  }
  if (plantasMax != null) {
    if (huellaOcupacion != null && huellaOcupacion < areaMov) {
      restricciones.push({ clave: 'ocupacion', m2c: huellaOcupacion * plantasMax })
    } else {
      restricciones.push({ clave: 'retranqueos', m2c: areaMov * plantasMax })
    }
  }
  if (restricciones.length > 0) {
    const vinculante = restricciones.reduce((min, r) => (r.m2c < min.m2c ? r : min))
    base.volumen_max_m2c = Math.round(vinculante.m2c)
    base.restriccion_vinculante = vinculante.clave
    if (construidaComputable != null) {
      base.remanente_vs_construido_m2c = Math.round(vinculante.m2c - construidaComputable)
    }
  }

  advertencias.push(
    'Área de movimiento estimada por geometría (HIPÓTESIS): la clasificación frente/lateral/testero es heurística, no computa alineaciones oficiales, fondos edificables por tramo, servidumbres ni condiciones de la ficha de catálogo.'
  )
  return base
}

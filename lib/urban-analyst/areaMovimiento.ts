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

export type TipoLindero = 'frente' | 'lateral' | 'testero' | 'custom'

/** Regla de retranqueo que crece con la altura: retranqueo(h) = max(base, factor·h). */
export interface ReglaAltura {
  base_m: number       // retranqueo mínimo (a rasante)
  factor_h: number     // metros de retranqueo por cada metro de altura
}

/** Reclasificación/edición manual de una arista hecha desde el gemelo 3D. */
export interface LinderoOverride {
  tipo: TipoLindero
  nombre?: string | null           // etiqueta del tipo personalizado
  retranqueo_m?: number | null     // override explícito de la distancia (0 = adosado)
  regla_altura?: ReglaAltura | null
}

/** Edición de un lindero enviada desde el 3D al endpoint (parcial). */
export interface LinderoPatch {
  tipo?: TipoLindero
  nombre?: string | null
  retranqueo_m?: number | null
  regla_altura?: ReglaAltura | null
  reset?: boolean
}

/** Tipo de lindero personalizado reutilizable dentro del activo. */
export interface TipoPersonalizado {
  nombre: string
  retranqueo_m: number | null
  regla_altura?: ReglaAltura | null
}

/** Arista del perímetro con su clasificación (editable desde el gemelo 3D). */
export interface LinderoInfo {
  key: string          // "ringIdx:edgeIdx" — estable mientras no cambie la geometría
  a: Position
  b: Position
  tipo: TipoLindero
  nombre?: string | null           // etiqueta cuando tipo = 'custom'
  longitud_m: number
  override: boolean    // true = clasificado/editado manualmente por el usuario
  retranqueo_m?: number | null     // retranqueo efectivo a rasante aplicado a esta arista
  retranqueo_override?: boolean    // true = distancia fijada a mano (no viene de la NZ)
  regla_altura?: ReglaAltura | null
}

/** Huella edificable de una planta (para el volumen escalonado). */
export interface NivelMovimiento {
  planta: number
  base_m: number                   // cota de la base del nivel (m sobre rasante)
  altura_m: number                 // altura del nivel (altura de piso)
  geometry: GeoJSONGeometry | null
  area_m2: number
}

export interface AreaMovimientoResult {
  disponible: boolean
  geometry: GeoJSONGeometry | null           // huella a rasante (parcela − retranqueos base) para 2D/base 3D
  area_movimiento_m2: number | null
  linderos_m: { frente: number; lateral: number; testero: number }   // longitudes clasificadas
  linderos: LinderoInfo[]                    // aristas clasificadas (para el visor 3D)
  retranqueos_aplicados: { frente: number | null; lateral: number | null; testero: number | null }
  factores_altura?: { frente: number | null; lateral: number | null; testero: number | null }
  altura_piso_m?: number | null
  params_aplicados: { ocupacion_pct: number | null; coef_edificabilidad: number | null }
  plantas_aplicadas: number | null
  huella_max_m2: number | null               // min(área movimiento, ocupación × parcela)
  volumen_max_m2c: number | null             // min(coef × parcela, capaz por retranqueos)
  restriccion_vinculante: 'edificabilidad' | 'ocupacion' | 'retranqueos' | null
  remanente_vs_construido_m2c: number | null
  /** Huellas por planta cuando algún retranqueo varía con la altura (volumen escalonado). */
  niveles?: NivelMovimiento[] | null
  /** Tipos de lindero personalizados del activo (paleta reutilizable en el 3D). */
  tipos_personalizados?: TipoPersonalizado[]
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
  nombre?: string | null
  retranqueoManual?: number | null   // distancia fijada a mano (incl. 0 = adosado)
  reglaManual?: ReglaAltura | null   // regla de altura fijada a mano
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
  /** Factores de retranqueo por altura por tipo (NZ): retranqueo(h)=max(base,factor·h). */
  factorAlturaFrente?: number | null
  factorAlturaLateral?: number | null
  factorAlturaTestero?: number | null
  /** Altura de piso (m) para convertir plantas → altura en el escalonado. */
  alturaPisoM?: number | null
  /** Ediciones manuales de linderos (key → override) hechas desde el 3D. */
  overrides?: Record<string, LinderoOverride>
  /** Paleta de tipos personalizados del activo (se conserva en el resultado). */
  tiposPersonalizados?: TipoPersonalizado[]
}): AreaMovimientoResult {
  const {
    parcelGeometry, parcelArea, vecinos,
    retranqueoFrente, retranqueoLateral, retranqueoTestero,
    ocupacionPct, coefEdificabilidad, plantasMax, construidaComputable, overrides,
    factorAlturaFrente = null, factorAlturaLateral = null, factorAlturaTestero = null,
    alturaPisoM = null, tiposPersonalizados = [],
  } = params
  const ALTURA_PISO = alturaPisoM && alturaPisoM > 0 ? alturaPisoM : 3

  const advertencias: string[] = []
  const base: AreaMovimientoResult = {
    disponible: false,
    geometry: null,
    area_movimiento_m2: null,
    linderos_m: { frente: 0, lateral: 0, testero: 0 },
    linderos: [],
    retranqueos_aplicados: { frente: retranqueoFrente, lateral: retranqueoLateral, testero: retranqueoTestero },
    factores_altura: { frente: factorAlturaFrente, lateral: factorAlturaLateral, testero: factorAlturaTestero },
    altura_piso_m: ALTURA_PISO,
    params_aplicados: { ocupacion_pct: ocupacionPct, coef_edificabilidad: coefEdificabilidad },
    plantas_aplicadas: plantasMax,
    huella_max_m2: null,
    volumen_max_m2c: null,
    restriccion_vinculante: null,
    remanente_vs_construido_m2c: null,
    niveles: null,
    tipos_personalizados: tiposPersonalizados,
    advertencias,
  }

  const overridesConRetranqueo = overrides
    ? Object.values(overrides).some((o) => (o.retranqueo_m != null && o.retranqueo_m > 0) || (o.regla_altura != null && o.regla_altura.factor_h > 0))
    : false
  const hayRetranqueos = retranqueoFrente != null || retranqueoLateral != null || retranqueoTestero != null || overridesConRetranqueo
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
        tipo: manual?.tipo ?? (tieneVecina ? 'lateral' : 'frente'),
        override: manual != null,
        nombre: manual?.nombre ?? null,
        retranqueoManual: manual?.retranqueo_m ?? null,
        reglaManual: manual?.regla_altura ?? null,
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
  const medHeur = medianerias.filter((e) => !e.override)
  if (frentes.length > 0 && medHeur.length > 0) {
    const fx = frentes.reduce((s, e) => s + e.mid[0] * e.longitudM, 0) / frentes.reduce((s, e) => s + e.longitudM, 0)
    const fy = frentes.reduce((s, e) => s + e.mid[1] * e.longitudM, 0) / frentes.reduce((s, e) => s + e.longitudM, 0)
    const dist = (e: Edge) => edgeLengthM([fx, fy], e.mid)
    const dMax = Math.max(...medHeur.map(dist))
    for (const e of medHeur) {
      if (dist(e) >= dMax * 0.8) e.tipo = 'testero'
    }
  }

  for (const e of edges) if (e.tipo !== 'custom') base.linderos_m[e.tipo] += Math.round(e.longitudM)

  // ── 2. Retranqueo por arista, con regla por altura ──────────────────────────
  const peorRetranqueo = Math.max(retranqueoFrente ?? 0, retranqueoLateral ?? 0, retranqueoTestero ?? 0)
  // Retranqueo a rasante (base) de cada arista
  const baseRetr = (e: Edge): number => {
    if (e.retranqueoManual != null) return e.retranqueoManual         // incl. 0 = adosado
    if (e.reglaManual != null) return e.reglaManual.base_m
    if (sinVecinosInfo && !e.override) return peorRetranqueo          // sin clasificación fiable: conservador
    if (e.tipo === 'frente') return retranqueoFrente ?? 0
    if (e.tipo === 'testero') return retranqueoTestero ?? retranqueoLateral ?? 0
    if (e.tipo === 'custom') return 0
    return retranqueoLateral ?? 0
  }
  // Factor de crecimiento con la altura (m de retranqueo por m de altura)
  const factorOf = (e: Edge): number => {
    if (e.reglaManual != null) return e.reglaManual.factor_h
    if (e.tipo === 'frente') return factorAlturaFrente ?? 0
    if (e.tipo === 'testero') return factorAlturaTestero ?? factorAlturaLateral ?? 0
    if (e.tipo === 'lateral') return factorAlturaLateral ?? 0
    return 0
  }
  // Retranqueo efectivo a la altura h: max(base, factor·h)
  const retrEnAltura = (e: Edge, h: number): number => {
    const b = baseRetr(e)
    const f = factorOf(e)
    return f > 0 ? Math.max(b, f * h) : b
  }

  // Huella edificable dado un retranqueo por arista (parcela − franjas)
  const huellaPara = (retrDe: (e: Edge) => number): { geom: GeoJSONGeometry | null; area: number } => {
    let mov: TFeat | null = toFeat(parcelGeometry)
    const franjas: TFeat[] = []
    for (const e of edges) {
      const r = retrDe(e)
      if (r <= 0) continue
      try {
        const franja = buffer(lineString([e.a, e.b]), r, { units: 'meters', steps: 4 })
        if (franja) franjas.push(franja as TFeat)
      } catch { /* arista degenerada */ }
    }
    if (franjas.length > 0) {
      try {
        const prohibido = franjas.length === 1 ? franjas[0] : (union(featureCollection(franjas)) as TFeat | null)
        if (prohibido) mov = difference(featureCollection([mov!, prohibido])) as TFeat | null
      } catch { mov = null }
    }
    return { geom: mov ? (mov.geometry as GeoJSONGeometry) : null, area: mov ? Math.round(turfArea(mov)) : 0 }
  }

  // Linderos para el visor 3D (con retranqueo efectivo y regla)
  base.linderos = edges.map((e) => {
    const f = factorOf(e)
    return {
      key: e.key, a: e.a, b: e.b, tipo: e.tipo,
      nombre: e.tipo === 'custom' ? (e.nombre || 'Personalizado') : null,
      longitud_m: Math.round(e.longitudM * 10) / 10,
      override: e.override,
      retranqueo_m: Math.round(baseRetr(e) * 10) / 10,
      retranqueo_override: e.retranqueoManual != null,
      regla_altura: f > 0 ? { base_m: baseRetr(e), factor_h: f } : null,
    }
  })

  // ── 3. Huella a rasante y, si hay regla de altura, huellas por planta ───────
  const hayReglaAltura = edges.some((e) => factorOf(e) > 0)
  const plantas = plantasMax ?? 1
  let areaMov: number
  let capazRetranqueos: number

  if (hayReglaAltura) {
    const niveles: NivelMovimiento[] = []
    capazRetranqueos = 0
    for (let n = 1; n <= plantas; n++) {
      const hTop = n * ALTURA_PISO            // el retranqueo del piso lo gobierna su cota superior
      const { geom, area } = huellaPara((e) => retrEnAltura(e, hTop))
      niveles.push({ planta: n, base_m: Math.round((n - 1) * ALTURA_PISO * 10) / 10, altura_m: Math.round(ALTURA_PISO * 10) / 10, geometry: geom, area_m2: area })
      capazRetranqueos += area
    }
    base.niveles = niveles
    areaMov = niveles[0]?.area_m2 ?? 0
    base.geometry = niveles[0]?.geometry ?? null
    advertencias.push('El área de movimiento se estrecha al subir: uno o más linderos tienen retranqueo que crece con la altura (volumen escalonado). El volumen capaz es la suma de las plantas, no la huella × nº de plantas.')
  } else {
    const { geom, area } = huellaPara(baseRetr)
    base.niveles = null
    areaMov = area
    base.geometry = geom
    capazRetranqueos = area * plantas
  }
  base.disponible = true
  base.area_movimiento_m2 = areaMov

  if (areaMov <= 0) {
    advertencias.push('Los retranqueos consumen la parcela completa: no queda área de movimiento (parcela bajo mínimos para la tipología de la norma).')
  }

  // ── 4. Volumen capaz cruzado (la más restrictiva vincula) ───────────────────
  const restricciones: { clave: AreaMovimientoResult['restriccion_vinculante']; m2c: number }[] = []
  const huellaOcupacion = ocupacionPct != null && parcelArea != null ? (ocupacionPct / 100) * parcelArea : null
  const huellaMax = huellaOcupacion != null ? Math.min(areaMov, huellaOcupacion) : areaMov
  base.huella_max_m2 = Math.round(huellaMax)

  if (coefEdificabilidad != null && parcelArea != null) {
    restricciones.push({ clave: 'edificabilidad', m2c: coefEdificabilidad * parcelArea })
  }
  if (plantasMax != null) {
    restricciones.push({ clave: 'retranqueos', m2c: capazRetranqueos })
    if (huellaOcupacion != null) {
      restricciones.push({ clave: 'ocupacion', m2c: huellaOcupacion * plantasMax })
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

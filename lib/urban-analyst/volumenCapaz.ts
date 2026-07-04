// Motor de volumen capaz — Fase 3D.
//
// Cruza tres geometrías oficiales:
//  · Parcela (Catastro INSPIRE CP)
//  · Partes del edificio existente con plantas por parte (Catastro INSPIRE BU)
//  · Bandas de fondo con COEF_Z = plantas permitidas (plano de Condiciones de
//    Edificación del PGOUM 97, Geoportal Ayto. Madrid)
//
// Volumen capaz por banda  = área(banda ∩ parcela) × plantas de la banda
// Existente por banda      = Σ área(parte ∩ banda ∩ parcela) × plantas de la parte
// Remanente materializable = Σ max(0, capaz_banda − existente_banda)
//
// Todo determinista y trazable. El resultado incluye las geometrías para el
// visor 3D (extrusión) y un resumen sin geometrías para la IA y el informe.

import intersect from '@turf/intersect'
import area from '@turf/area'
import { feature, featureCollection } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { BuildingPart } from './catastro'
import type { BandaCondiciones } from './geoportal'
import type { GeoJSONGeometry } from './types'

export interface VolumenBanda {
  plantas: number | null
  coef_z: string
  area_banda_m2: number            // área de banda ∩ parcela
  capaz_m2c: number | null         // área × plantas
  existente_m2c: number            // partes existentes dentro de la banda
  remanente_m2c: number | null     // capaz − existente (puede ser negativo)
  geometry: GeoJSONGeometry        // banda ∩ parcela (para extrusión 3D)
}

export interface VolumenParte {
  plantas_sobre: number | null
  plantas_bajo: number | null
  area_m2: number
  geometry: GeoJSONGeometry
}

export interface VolumenCapazResult {
  disponible: boolean
  bandas: VolumenBanda[]
  partes: VolumenParte[]
  capaz_total_m2c: number | null
  existente_total_m2c: number | null
  remanente_materializable_m2c: number | null   // Σ max(0, remanente_banda)
  cobertura_bandas_pct: number | null           // % de parcela cubierto por bandas COEF_Z
  advertencias: string[]
  fuentes: string[]
}

type TFeature = Feature<Polygon | MultiPolygon>

function toFeature(geom: GeoJSONGeometry): TFeature {
  return feature(geom as Polygon | MultiPolygon)
}

/** Intersección segura entre dos geometrías (null si no solapan o error). */
function safeIntersect(a: GeoJSONGeometry, b: GeoJSONGeometry): TFeature | null {
  try {
    return intersect(featureCollection([toFeature(a), toFeature(b)])) as TFeature | null
  } catch {
    return null
  }
}

function m2(f: TFeature | null): number {
  if (!f) return 0
  try { return Math.round(area(f)) } catch { return 0 }
}

export function computeVolumenCapaz(params: {
  parcelGeometry: GeoJSONGeometry
  parcelAreaM2: number | null
  partes: BuildingPart[]
  bandas: BandaCondiciones[]
}): VolumenCapazResult {
  const { parcelGeometry, parcelAreaM2, partes, bandas } = params
  const advertencias: string[] = []
  const fuentes = [
    'Parcela y partes de edificio: Catastro INSPIRE (WFS CP/BU) — descriptivo, no acredita legalidad',
    'Bandas COEF_Z: PGOUM97/PG_CONDICIONES_EDIFICACION (Geoportal Ayto. Madrid, sin valor jurídico)',
  ]

  // Partes existentes (recortadas a la parcela)
  const partesOut: VolumenParte[] = []
  for (const p of partes) {
    const clipped = safeIntersect(p.geometry, parcelGeometry)
    const a = m2(clipped)
    if (a < 1) continue
    partesOut.push({
      plantas_sobre: p.floorsAbove,
      plantas_bajo: p.floorsBelow,
      area_m2: a,
      geometry: (clipped!.geometry as GeoJSONGeometry),
    })
  }
  const existenteTotal = partesOut.reduce(
    (s, p) => s + (p.plantas_sobre != null ? p.area_m2 * p.plantas_sobre : 0), 0
  )
  const partesSinPlantas = partesOut.filter((p) => p.plantas_sobre == null).length
  if (partesSinPlantas > 0) {
    advertencias.push(`${partesSinPlantas} parte(s) del edificio sin nº de plantas en Catastro: el volumen existente puede estar infravalorado.`)
  }

  // Bandas COEF_Z recortadas a la parcela
  const bandasOut: VolumenBanda[] = []
  for (const b of bandas) {
    const clipped = safeIntersect(b.geometry, parcelGeometry)
    const areaBanda = m2(clipped)
    if (areaBanda < 1 || !clipped) continue

    // Existente dentro de esta banda
    let existenteBanda = 0
    for (const p of partesOut) {
      if (p.plantas_sobre == null) continue
      const inter = safeIntersect(p.geometry, clipped.geometry as GeoJSONGeometry)
      existenteBanda += m2(inter) * p.plantas_sobre
    }

    const capaz = b.plantas != null ? Math.round(areaBanda * b.plantas) : null
    bandasOut.push({
      plantas: b.plantas,
      coef_z: b.coefZRaw,
      area_banda_m2: areaBanda,
      capaz_m2c: capaz,
      existente_m2c: Math.round(existenteBanda),
      remanente_m2c: capaz != null ? Math.round(capaz - existenteBanda) : null,
      geometry: clipped.geometry as GeoJSONGeometry,
    })
  }

  const conCapaz = bandasOut.filter((b) => b.capaz_m2c != null)
  const capazTotal = conCapaz.length > 0
    ? conCapaz.reduce((s, b) => s + (b.capaz_m2c || 0), 0)
    : null
  const remanenteMat = conCapaz.length > 0
    ? conCapaz.reduce((s, b) => s + Math.max(0, b.remanente_m2c || 0), 0)
    : null
  const areaBandasTotal = bandasOut.reduce((s, b) => s + b.area_banda_m2, 0)
  const cobertura = parcelAreaM2 && parcelAreaM2 > 0
    ? Math.min(100, Math.round((areaBandasTotal / parcelAreaM2) * 100))
    : null

  if (bandasOut.length === 0) {
    advertencias.push('No hay bandas COEF_Z sobre la parcela: la norma zonal probablemente regula por coeficiente (ver pestaña Edificabilidad) o el plano CE no cubre este ámbito.')
  } else {
    if (cobertura != null && cobertura < 85) {
      advertencias.push(`Las bandas COEF_Z cubren ~${cobertura}% de la parcela: el resto puede ser espacio libre/patio obligatorio no edificable o zona sin dato.`)
    }
    advertencias.push('El volumen capaz es una envolvente TEÓRICA por bandas: no computa bajocubierta, retranqueos puntuales, servidumbres ni condiciones de la ficha de catálogo. En edificios protegidos la ficha manda.')
    advertencias.push('Un remanente materializable > 0 solo indica potencial urbanístico teórico: la viabilidad jurídico-registral (vuelo, división horizontal, comunidad) y la técnica se verifican aparte.')
  }

  return {
    disponible: bandasOut.length > 0 || partesOut.length > 0,
    bandas: bandasOut,
    partes: partesOut,
    capaz_total_m2c: capazTotal,
    existente_total_m2c: partesOut.length > 0 ? Math.round(existenteTotal) : null,
    remanente_materializable_m2c: remanenteMat,
    cobertura_bandas_pct: cobertura,
    advertencias,
    fuentes,
  }
}

/** Versión sin geometrías (para el contexto de la IA y el informe). */
export function volumenCapazResumen(v: VolumenCapazResult): Record<string, unknown> {
  return {
    metodo: 'volumen capaz por bandas COEF_Z (intersección geométrica oficial)',
    capaz_total_m2c: v.capaz_total_m2c,
    existente_total_m2c: v.existente_total_m2c,
    remanente_materializable_m2c: v.remanente_materializable_m2c,
    cobertura_bandas_pct: v.cobertura_bandas_pct,
    bandas: v.bandas.map((b) => ({
      coef_z: b.coef_z,
      plantas: b.plantas,
      area_banda_m2: b.area_banda_m2,
      capaz_m2c: b.capaz_m2c,
      existente_m2c: b.existente_m2c,
      remanente_m2c: b.remanente_m2c,
    })),
    partes_edificio: v.partes.map((p) => ({
      plantas_sobre: p.plantas_sobre,
      plantas_bajo: p.plantas_bajo,
      area_m2: p.area_m2,
    })),
    advertencias: v.advertencias,
  }
}

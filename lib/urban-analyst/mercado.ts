// Datos de mercado y demografía por localización — Fase 4 (producto optimizado).
//
// Fuentes:
//  · Renta neta media por hogar/persona: INE Atlas de Distribución de Renta de
//    los Hogares (tabla 31097), snapshot local por sección censal de Madrid
//    capital (lib/urban-analyst/data/rentaSecciones.json).
//  · Sección censal + barrio + demografía: capas ESTADISTICA del Geoportal
//    del Ayuntamiento de Madrid (consulta por punto). Sin valor jurídico.
//
// Solo servidor (el JSON de renta pesa ~107 KB).

import rentaSeccionesJson from './data/rentaSecciones.json'

const SIGMA = 'https://sigma.madrid.es/hosted/rest/services'
const DEMO_SERVICE = `${SIGMA}/ESTADISTICA/INDICADORES_ESTRUCTURA_DEMOGRAFICA/MapServer`

interface RentaSnapshot {
  fuente: string
  datos: Record<string, { h?: number; p?: number; a: number }>
}

const RENTA: RentaSnapshot = rentaSeccionesJson as RentaSnapshot

export interface MercadoZona {
  cusec: string | null               // sección censal INE (28079 + distrito + sección)
  distrito: string | null
  barrio: string | null
  renta_hogar_anual: number | null   // € netos/año (INE)
  renta_persona_anual: number | null
  renta_anio: number | null
  renta_fuente: string
  edad_promedio_barrio: number | null
  edad_promedio_seccion: number | null
  prop_juventud_barrio_pct: number | null       // pob 0-15 / total
  prop_envejecimiento_barrio_pct: number | null // pob 65+ / total
  advertencias: string[]
}

async function queryPunto(
  layerId: number,
  lat: number,
  lng: number,
  timeoutMs = 15000
): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const body = new URLSearchParams({
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
      f: 'json',
    })
    const res = await fetch(`${DEMO_SERVICE}/${layerId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as { features?: { attributes: Record<string, unknown> }[] }
    return json.features?.[0]?.attributes ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Perfil de mercado/demografía del punto. Capas del servicio de indicadores
 * demográficos (verificadas en vivo el 15/07/2026):
 *  41 = Secciones censales (COD_DIS, NOM_DIS, NOM_BAR, COD_SECCION)
 *  22 = Edad promedio por barrio · 43 = Edad promedio por sección
 *  24 = Proporción de juventud por barrio · 25 = Proporción de envejecimiento por barrio
 */
export async function getMercadoZona(lat: number, lng: number): Promise<MercadoZona> {
  const advertencias: string[] = []
  const [seccion, edadBarrio, edadSeccion, juventud, envejecimiento] = await Promise.all([
    queryPunto(41, lat, lng),
    queryPunto(22, lat, lng),
    queryPunto(43, lat, lng),
    queryPunto(24, lat, lng),
    queryPunto(25, lat, lng),
  ])

  let cusec: string | null = null
  const codSeccion = str(seccion?.COD_SECCION)
  if (codSeccion && /^\d{5}$/.test(codSeccion)) {
    cusec = `28079${codSeccion}`
  } else {
    advertencias.push('No se pudo resolver la sección censal en la capa municipal: renta INE no disponible automáticamente.')
  }

  const renta = cusec ? RENTA.datos[cusec] ?? null : null
  if (cusec && !renta) {
    advertencias.push(`La sección censal ${cusec} no está en el snapshot de renta del INE (puede ser sección de nueva creación).`)
  }

  // Proporciones: la capa puede publicar 0-1 o 0-100 — normalizamos a %
  const pct = (v: number | null): number | null =>
    v == null ? null : Math.round((v <= 1 ? v * 100 : v) * 10) / 10

  const propKey = (attrs: Record<string, unknown> | null): number | null => {
    if (!attrs) return null
    for (const [k, v] of Object.entries(attrs)) {
      if (/proporcion|prop_/i.test(k) && typeof v === 'number') return v
    }
    // fallback: primer double que no sea OBJECTID
    for (const [k, v] of Object.entries(attrs)) {
      if (!/objectid|cod_|shape/i.test(k) && typeof v === 'number') return v
    }
    return null
  }

  return {
    cusec,
    distrito: str(seccion?.NOM_DIS),
    barrio: str(seccion?.NOM_BAR),
    renta_hogar_anual: renta?.h ?? null,
    renta_persona_anual: renta?.p ?? null,
    renta_anio: renta?.a ?? null,
    renta_fuente: RENTA.fuente,
    edad_promedio_barrio: num(edadBarrio?.Edad_Promedio),
    edad_promedio_seccion: num(edadSeccion?.Edad_Promedio),
    prop_juventud_barrio_pct: pct(propKey(juventud)),
    prop_envejecimiento_barrio_pct: pct(propKey(envejecimiento)),
    advertencias,
  }
}

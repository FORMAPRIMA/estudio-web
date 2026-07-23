// Clientes de datos catastrales (fuentes oficiales, gratuitas, sin API key):
// - CartoCiudad (IGN): geocodificación dirección → coordenadas + refcat
// - OVC Catastro (SOAP-GET XML): coordenadas ↔ refcat, datos de inmuebles
// - INSPIRE WFS Catastro: geometría de parcela y datos de edificio
//
// Endpoints verificados el 3 jul 2026. Todo el parseo XML es por regex
// (respuestas pequeñas y de esquema estable) para no añadir dependencias.

import { gmlToGeoJSON, areaM2 } from './geometry'
import type { ConstruidaDesglose, GeoJSONGeometry } from './types'

const FETCH_OPTS: RequestInit = {
  cache: 'no-store',
  headers: { 'User-Agent': 'FormaPrima-UrbanAnalyst/1.0' },
}

async function fetchTextOnce(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...FETCH_OPTS, signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url.split('?')[0]}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// Catastro (OVC e INSPIRE) corta conexiones de forma intermitente: un único
// `fetch failed` o timeout no debe tumbar todo el análisis. Reintentamos con
// backoff los fallos de red (no los HTTP 4xx, que son deterministas).
async function fetchText(url: string, timeoutMs = 25000, retries = 2): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchTextOnce(url, timeoutMs)
    } catch (err) {
      lastErr = err
      // Los HTTP 4xx son respuestas válidas del servidor: no tiene sentido reintentar
      const msg = err instanceof Error ? err.message : ''
      if (/^HTTP 4\d\d/.test(msg)) throw err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`))
  return m ? m[1].trim() : null
}

// ── Geocodificación (CartoCiudad) ─────────────────────────────────────────────

export interface GeocodeResult {
  lat: number
  lng: number
  refcat: string | null      // CartoCiudad devuelve la refcat de parcela si hay portal
  direccion: string
  municipio: string | null
  muniCode: string | null    // '28079' = Madrid capital
}

export async function geocodeDireccion(q: string): Promise<GeocodeResult | null> {
  const url = `https://www.cartociudad.es/geocoder/api/geocoder/findJsonp?q=${encodeURIComponent(q)}`
  const raw = await fetchText(url)
  const jsonStr = raw.replace(/^[^(]*\(/, '').replace(/\)\s*;?\s*$/, '')
  let data: Record<string, unknown>
  try { data = JSON.parse(jsonStr) } catch { return null }
  if (data == null || typeof data.lat !== 'number' || typeof data.lng !== 'number') return null
  const tipVia = typeof data.tip_via === 'string' ? data.tip_via : ''
  const address = typeof data.address === 'string' ? data.address : ''
  const portal = data.portalNumber != null ? String(data.portalNumber) : ''
  const municipio = typeof data.muni === 'string' ? data.muni : null
  const via = [tipVia, address, portal].filter(Boolean).join(' ').trim()
  return {
    lat: data.lat,
    lng: data.lng,
    refcat: typeof data.refCatastral === 'string' && data.refCatastral.length >= 14
      ? data.refCatastral.slice(0, 14)
      : null,
    direccion: via ? `${via}${municipio ? `, ${municipio}` : ''}` : q,
    municipio,
    muniCode: typeof data.muniCode === 'string' ? data.muniCode : null,
  }
}

// ── Coordenadas → referencia catastral (OVC) ─────────────────────────────────

export async function refcatFromCoords(lat: number, lng: number): Promise<{ refcat: string; direccion: string } | null> {
  const url = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${lng}&Coordenada_Y=${lat}`
  const xml = await fetchText(url)
  const pc1 = tag(xml, 'pc1')
  const pc2 = tag(xml, 'pc2')
  if (!pc1 || !pc2) return null
  return { refcat: `${pc1}${pc2}`, direccion: tag(xml, 'ldt') || '' }
}

// ── Referencia catastral → coordenadas (OVC) ─────────────────────────────────

export async function coordsFromRefcat(refcat: string): Promise<{ lat: number; lng: number; direccion: string } | null> {
  const url = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_CPMRC?Provincia=&Municipio=&SRS=EPSG:4326&RC=${encodeURIComponent(refcat.slice(0, 14))}`
  const xml = await fetchText(url)
  const x = tag(xml, 'xcen')
  const y = tag(xml, 'ycen')
  if (!x || !y) return null
  return { lat: parseFloat(y), lng: parseFloat(x), direccion: tag(xml, 'ldt') || '' }
}

// ── Geometría de parcela (INSPIRE WFS CP) ────────────────────────────────────

export interface ParcelData {
  geometry: GeoJSONGeometry
  areaValue: number | null   // m² oficial Catastro
  sourceUrl: string
}

export async function getParcelData(refcat: string): Promise<ParcelData | null> {
  const url = `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetParcel&refcat=${encodeURIComponent(refcat.slice(0, 14))}&srsname=EPSG::4326`
  const xml = await fetchText(url, 30000)
  const geometry = gmlToGeoJSON(xml)
  if (!geometry) return null
  const areaStr = xml.match(/<cp:areaValue[^>]*>([\d.]+)<\/cp:areaValue>/)
  return {
    geometry,
    areaValue: areaStr ? parseFloat(areaStr[1]) : null,
    sourceUrl: url,
  }
}

export interface ParcelaVecina {
  refcat: string
  geometry: GeoJSONGeometry
}

/**
 * Parcelas catastrales dentro de un bbox (INSPIRE WFS CP estándar, sin stored
 * query). Se usa para clasificar los linderos de la parcela analizada:
 * arista compartida con una vecina = medianería; arista sin vecina = frente
 * a vía pública. bbox en [minLng, minLat, maxLng, maxLat] (WGS84).
 */
export async function getParcelasVecinas(
  bboxWgs84: [number, number, number, number],
  excludeRefcats: string[] = []
): Promise<ParcelaVecina[]> {
  // El WFS espera el bbox en orden lat,lng con el CRS urn de EPSG:4326
  const bboxParam = `${bboxWgs84[1]},${bboxWgs84[0]},${bboxWgs84[3]},${bboxWgs84[2]},urn:ogc:def:crs:EPSG::4326`
  const url = `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=WFS&version=2.0.0&request=GetFeature&typeNames=cp.cadastralparcel&srsName=urn:ogc:def:crs:EPSG::4326&bbox=${encodeURIComponent(bboxParam)}&count=80`
  let xml: string
  try {
    xml = await fetchText(url, 30000)
  } catch {
    return []
  }
  const exclude = new Set(excludeRefcats.map((r) => r.slice(0, 14).toUpperCase()))
  const out: ParcelaVecina[] = []
  const members = xml.match(/<cp:CadastralParcel[\s\S]*?<\/cp:CadastralParcel>/g) || []
  for (const member of members) {
    const idMatch = member.match(/gml:id="ES\.SDGC\.CP\.([A-Z0-9]{14})"/)
    if (!idMatch) continue
    const refcat = idMatch[1]
    if (exclude.has(refcat)) continue
    const geometry = gmlToGeoJSON(member)
    if (!geometry) continue
    out.push({ refcat, geometry })
  }
  return out
}

// ── Datos de edificio (INSPIRE WFS BU) ───────────────────────────────────────

export interface BuildingData {
  currentUse: string | null          // ej. '1_residential'
  numberOfDwellings: number | null
  numberOfBuildingUnits: number | null
  builtAreaM2: number | null         // mayor OfficialArea declarada (inferido)
  yearBuilt: number | null
  conditionOfConstruction: string | null
  floorsAboveGround: number | null   // plantas existentes sobre rasante
  footprintM2: number | null         // huella del edificio (geometría WFS), inferido
  sourceUrl: string
}

// Los prefijos de namespace del WFS BU pueden variar (bu-ext2d, bu-core2d...):
// todos los matchers son agnósticos al prefijo.
function nsTag(xml: string, local: string): string | null {
  // Admite atributos en el tag (p. ej. xsi:nil="true" → no captura y devuelve null)
  const m = xml.match(new RegExp(`<[\\w-]+:${local}(?:\\s[^>]*)?>([^<]+)<`))
  const val = m ? m[1].trim() : null
  return val || null
}

export async function getBuildingData(refcat: string): Promise<BuildingData | null> {
  const url = `https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetBuildingByParcel&refcat=${encodeURIComponent(refcat.slice(0, 14))}&srsname=EPSG::4326`
  let xml: string
  try {
    xml = await fetchText(url, 30000)
  } catch {
    return null
  }
  if (!/Building/i.test(xml)) return null

  const use = nsTag(xml, 'currentUse')
  const dwellings = nsTag(xml, 'numberOfDwellings')
  const units = nsTag(xml, 'numberOfBuildingUnits')
  const condition = nsTag(xml, 'conditionOfConstruction')
  const floors = nsTag(xml, 'numberOfFloorsAboveGround')

  // Superficies declaradas: nos quedamos con la mayor (suele ser la construida total)
  const areas = Array.from(xml.matchAll(/value uom="m2">([\d.]+)</g)).map((m) => parseFloat(m[1]))
  const builtArea = areas.length > 0 ? Math.max(...areas) : null

  // Año de construcción: elemento beginning / beginLifespanVersion
  const beginning = xml.match(/<[\w-]+:beginning>[\s\S]*?(\d{4})-/) || xml.match(/<[\w-]+:beginning>(\d{4})-/)
  const beginLifespan = xml.match(/<[\w-]+:beginLifespanVersion>(\d{4})-/)

  // Huella del edificio: geometría GML del propio WFS (exterior − patios interiores)
  let footprint: number | null = null
  const geom = gmlToGeoJSON(xml)
  if (geom) {
    const a = areaM2(geom)
    if (a > 0) footprint = a
  }

  return {
    currentUse: use,
    numberOfDwellings: dwellings ? parseInt(dwellings, 10) : null,
    numberOfBuildingUnits: units ? parseInt(units, 10) : null,
    builtAreaM2: builtArea,
    yearBuilt: beginning ? parseInt(beginning[1], 10) : (beginLifespan ? parseInt(beginLifespan[1], 10) : null),
    conditionOfConstruction: condition,
    floorsAboveGround: floors ? parseInt(floors, 10) : null,
    footprintM2: footprint,
    sourceUrl: url,
  }
}

// ── Partes de edificio (INSPIRE WFS BU) — el LOD1 oficial ────────────────────
// Cada parte trae su geometría y sus plantas sobre/bajo rasante: es la base
// del modelo 3D low-poly y del cálculo de volumen existente por bandas.

export interface BuildingPart {
  geometry: GeoJSONGeometry
  floorsAbove: number | null
  floorsBelow: number | null
}

export async function getBuildingParts(refcat: string): Promise<BuildingPart[]> {
  const url = `https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetBuildingPartByParcel&refcat=${encodeURIComponent(refcat.slice(0, 14))}&srsname=EPSG::4326`
  let xml: string
  try {
    xml = await fetchText(url, 30000)
  } catch {
    return []
  }
  const blocks = xml.match(/<bu-[\w]+:BuildingPart[\s\S]*?<\/bu-[\w]+:BuildingPart>/g) || []
  const parts: BuildingPart[] = []
  for (const block of blocks) {
    const geometry = gmlToGeoJSON(block)
    if (!geometry) continue
    const above = block.match(/<[\w-]+:numberOfFloorsAboveGround(?:\s[^>]*)?>(\d+)</)
    const below = block.match(/<[\w-]+:numberOfFloorsBelowGround(?:\s[^>]*)?>(\d+)</)
    parts.push({
      geometry,
      floorsAbove: above ? parseInt(above[1], 10) : null,
      floorsBelow: below ? parseInt(below[1], 10) : null,
    })
  }
  return parts
}

// ── Fallback: detalle por inmueble (suma de superficies y año) ────────────────
// Cuando el WFS BU no devuelve superficie/año, se consulta el detalle DNPRC de
// cada inmueble de la parcela (refcat de 20 chars) y se agregan <sfc> y <ant>.

export interface InmueblesDetalle {
  totalSuperficieM2: number | null
  anioMasAntiguo: number | null
  inmueblesConsultados: number
}

export async function getInmueblesDetalle(refcat: string, maxUnits = 40): Promise<InmueblesDetalle | null> {
  const base = refcat.slice(0, 14)
  const listUrl = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(base)}`
  let listXml: string
  try {
    listXml = await fetchText(listUrl)
  } catch {
    return null
  }

  // Parcela de un solo inmueble: la respuesta ya trae el detalle
  const directSfc = listXml.match(/<sfc>([\d.]+)</)
  const directAnt = listXml.match(/<ant>(\d{4})</)
  if (directSfc || directAnt) {
    return {
      totalSuperficieM2: directSfc ? parseFloat(directSfc[1]) : null,
      anioMasAntiguo: directAnt ? parseInt(directAnt[1], 10) : null,
      inmueblesConsultados: 1,
    }
  }

  // Lista de inmuebles: reconstruir refcats de 20 chars (pc1+pc2+car+cc1+cc2)
  const rcs: string[] = Array.from(
    listXml.matchAll(/<rc>\s*<pc1>([^<]+)<\/pc1>\s*<pc2>([^<]+)<\/pc2>\s*<car>([^<]+)<\/car>\s*<cc1>([^<]+)<\/cc1>\s*<cc2>([^<]+)<\/cc2>/g)
  ).map((m) => `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`)
  if (rcs.length === 0) return null

  const target = rcs.slice(0, maxUnits)
  let total = 0
  let anySfc = false
  let anio: number | null = null

  // Chunks de 8 para no saturar la OVC
  for (let i = 0; i < target.length; i += 8) {
    const chunk = target.slice(i, i + 8)
    const results = await Promise.allSettled(chunk.map(async (rc) => {
      const xml = await fetchText(
        `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`,
        15000
      )
      const sfc = xml.match(/<sfc>([\d.]+)</)
      const ant = xml.match(/<ant>(\d{4})</)
      return { sfc: sfc ? parseFloat(sfc[1]) : null, ant: ant ? parseInt(ant[1], 10) : null }
    }))
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      if (r.value.sfc != null) { total += r.value.sfc; anySfc = true }
      if (r.value.ant != null && (anio == null || r.value.ant < anio)) anio = r.value.ant
    }
  }

  return {
    totalSuperficieM2: anySfc ? Math.round(total) : null,
    anioMasAntiguo: anio,
    inmueblesConsultados: target.length,
  }
}

// ── Desglose de superficie construida por uso (OVC DNPRC) ────────────────────
// Cada inmueble declara sus elementos constructivos <cons> con uso <lcd>,
// planta <pt> y superficie <stl>. Sumando por uso podemos separar lo que
// computa a edificabilidad de lo que no (garaje, trastero/almacén anejo).

interface ConsElement { lcd: string; pt: string; stl: number }

function parseConsElements(xml: string): ConsElement[] {
  const out: ConsElement[] = []
  for (const c of xml.match(/<cons>[\s\S]*?<\/cons>/g) || []) {
    const stlM = c.match(/<stl>([\d.]+)<\/stl>/)
    if (!stlM) continue
    const stl = parseFloat(stlM[1])
    if (!(stl > 0)) continue
    const lcd = (c.match(/<lcd>([^<]*)<\/lcd>/)?.[1] || '').trim().toUpperCase()
    const pt = (c.match(/<pt>([^<]*)<\/pt>/)?.[1] || '').trim()
    out.push({ lcd, pt, stl })
  }
  return out
}

// Clasificación por uso (decisión: descontar solo garaje y trastero/almacén).
type UsoBucket = 'aparcamiento' | 'trastero' | 'almacen' | 'computable'
function clasificaUso(lcd: string): UsoBucket {
  if (/APARCAMIENTO|GARAJE/.test(lcd)) return 'aparcamiento'
  if (/TRASTERO/.test(lcd)) return 'trastero'
  if (/ALMAC[EÉ]N/.test(lcd)) return 'almacen'
  return 'computable'
}

/** Reparte una muestra uniforme de `n` elementos sobre `arr` (evita sesgar el
 *  muestreo hacia el principio de la lista de inmuebles). */
function muestraUniforme<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr
  const step = arr.length / n
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)])
  return out
}

export interface ConstruidaScan {
  desglose: ConstruidaDesglose
  anioMasAntiguo: number | null
}

function buildDesglose(cons: ConsElement[], inmueblesTotales: number, inmueblesMuestreados: number): ConstruidaDesglose {
  let apar = 0, tras = 0, alm = 0, comp = 0
  const porUsoMap = new Map<string, number>()
  for (const c of cons) {
    const bucket = clasificaUso(c.lcd)
    if (bucket === 'aparcamiento') apar += c.stl
    else if (bucket === 'trastero') tras += c.stl
    else if (bucket === 'almacen') alm += c.stl
    else comp += c.stl
    const key = c.lcd || '(sin uso declarado)'
    porUsoMap.set(key, (porUsoMap.get(key) || 0) + c.stl)
  }
  const total = apar + tras + alm + comp
  // Guarda: si "almacén" es el uso dominante, es una nave productiva (su superficie
  // SÍ computa), no un trastero anejo. Evita descontar por error un activo logístico.
  const almacenComputa = total > 0 && alm / total > 0.5
  const noComputable = apar + tras + (almacenComputa ? 0 : alm)
  const computable = total - noComputable
  const porUso = Array.from(porUsoMap.entries())
    .map(([uso, m2]) => ({
      uso,
      m2: Math.round(m2),
      computa: clasificaUso(uso.toUpperCase()) === 'computable' || (clasificaUso(uso.toUpperCase()) === 'almacen' && almacenComputa),
    }))
    .sort((a, b) => b.m2 - a.m2)
  return {
    total_m2: Math.round(total),
    computable_m2: Math.round(computable),
    no_computable_m2: Math.round(noComputable),
    aparcamiento_m2: Math.round(apar),
    trastero_m2: Math.round(tras),
    almacen_m2: Math.round(alm),
    almacen_computa: almacenComputa,
    por_uso: porUso,
    inmuebles_totales: inmueblesTotales,
    inmuebles_muestreados: inmueblesMuestreados,
    incompleto: inmueblesMuestreados < inmueblesTotales,
  }
}

/** Escanea los elementos constructivos de una parcela y devuelve el desglose de
 *  superficie por uso + el año más antiguo (reaprovechando las mismas consultas). */
export async function getConstruidaDesglose(refcat: string, maxUnits = 60): Promise<ConstruidaScan | null> {
  const base = refcat.slice(0, 14)
  let listXml: string
  try {
    listXml = await fetchText(`https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(base)}`)
  } catch {
    return null
  }

  const parseAnt = (xml: string): number | null => {
    let min: number | null = null
    for (const m of Array.from(xml.matchAll(/<ant>(\d{4})</g))) {
      const y = parseInt(m[1], 10)
      if (min == null || y < min) min = y
    }
    return min
  }

  // Parcela de un solo inmueble: la respuesta ya trae los <cons>
  const directCons = parseConsElements(listXml)
  if (directCons.length > 0) {
    return {
      desglose: buildDesglose(directCons, 1, 1),
      anioMasAntiguo: parseAnt(listXml),
    }
  }

  // Lista de inmuebles: reconstruir refcats de 20 chars (pc1+pc2+car+cc1+cc2)
  const rcs: string[] = Array.from(
    listXml.matchAll(/<rc>\s*<pc1>([^<]+)<\/pc1>\s*<pc2>([^<]+)<\/pc2>\s*<car>([^<]+)<\/car>\s*<cc1>([^<]+)<\/cc1>\s*<cc2>([^<]+)<\/cc2>/g)
  ).map((m) => `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`)
  if (rcs.length === 0) return null

  const target = muestraUniforme(rcs, maxUnits)
  const cons: ConsElement[] = []
  let anio: number | null = null

  // Chunks de 8 para no saturar la OVC
  for (let i = 0; i < target.length; i += 8) {
    const chunk = target.slice(i, i + 8)
    const results = await Promise.allSettled(chunk.map(async (rc) => {
      const xml = await fetchText(
        `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`,
        15000
      )
      return { cons: parseConsElements(xml), ant: parseAnt(xml) }
    }))
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      cons.push(...r.value.cons)
      if (r.value.ant != null && (anio == null || r.value.ant < anio)) anio = r.value.ant
    }
  }

  if (cons.length === 0) return null
  return {
    desglose: buildDesglose(cons, rcs.length, target.length),
    anioMasAntiguo: anio,
  }
}

/** Combina los desgloses de varias parcelas (edificio multi-refcat) en uno. */
export function combineDesgloses(scans: (ConstruidaScan | null)[]): ConstruidaScan | null {
  const ok = scans.filter((s): s is ConstruidaScan => Boolean(s))
  if (ok.length === 0) return null
  if (ok.length === 1) return ok[0]
  const cons: ConsElement[] = []
  let totInm = 0, muestra = 0, anio: number | null = null
  // Reconstruimos elementos sintéticos por uso para reagregar con la misma lógica
  for (const s of ok) {
    for (const u of s.desglose.por_uso) cons.push({ lcd: u.uso.toUpperCase(), pt: '', stl: u.m2 })
    totInm += s.desglose.inmuebles_totales ?? 0
    muestra += s.desglose.inmuebles_muestreados
    if (s.anioMasAntiguo != null && (anio == null || s.anioMasAntiguo < anio)) anio = s.anioMasAntiguo
  }
  return {
    desglose: buildDesglose(cons, totInm, muestra),
    anioMasAntiguo: anio,
  }
}

// ── Inmuebles de la parcela (OVC DNPRC) ──────────────────────────────────────

export async function getInmueblesCount(refcat: string): Promise<number | null> {
  const url = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(refcat.slice(0, 14))}`
  try {
    const xml = await fetchText(url)
    const cudnp = tag(xml, 'cudnp')
    if (cudnp) return parseInt(cudnp, 10)
    // Parcela con un único inmueble: la respuesta trae el bien directamente
    if (xml.includes('<bico>') || xml.includes('<rcdnp>')) return 1
    return null
  } catch {
    return null
  }
}

/** Traducción legible del uso INSPIRE de Catastro. */
export function translateCurrentUse(use: string | null): string | null {
  if (!use) return null
  const map: Record<string, string> = {
    '1_residential': 'Residencial',
    '2_agriculture': 'Agrario',
    '3_industrial': 'Industrial',
    '4_1_office': 'Oficinas',
    '4_2_retail': 'Comercial',
    '4_3_publicServices': 'Servicios públicos',
  }
  return map[use] || use
}

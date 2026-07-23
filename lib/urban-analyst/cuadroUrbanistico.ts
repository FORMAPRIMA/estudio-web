// Cuadro urbanístico en formato licencia (el que pide siempre urbanismo):
// una fila por parámetro, columna NORMATIVA (todas las figuras aplicables, con
// la más restrictiva resuelta), columna ESTADO ACTUAL (Catastro/cartografía) y
// columna POTENCIAL DEL ACTIVO (diferencia).
//
// Motor determinista: cada valor lleva su figura de origen, su fuente y su
// etiqueta oficial/inferido/hipótesis. La IA no interviene aquí.

import type { NormaZonal } from './types'

export type SentidoRestriccion = 'max' | 'min'
// 'max': la norma fija un máximo → el valor MÁS BAJO es el más restrictivo
// 'min': la norma fija un mínimo → el valor MÁS ALTO es el más restrictivo

export interface ParametroDef {
  key: string
  label: string
  unidad: string | null
  sentido: SentidoRestriccion | null // null = no comparable numéricamente (usos)
}

export const PARAMETROS_CUADRO: ParametroDef[] = [
  { key: 'edificabilidad',     label: 'Edificabilidad',                    unidad: 'm²c/m²s', sentido: 'max' },
  { key: 'ocupacion',          label: 'Ocupación',                         unidad: '%',       sentido: 'max' },
  { key: 'plantas_sobre',      label: 'Plantas sobre rasante',             unidad: 'ud',      sentido: 'max' },
  { key: 'plantas_bajo',       label: 'Plantas bajo rasante',              unidad: 'ud',      sentido: 'max' },
  { key: 'altura_cornisa',     label: 'Altura de cornisa',                 unidad: 'm',       sentido: 'max' },
  { key: 'altura_maxima',      label: 'Altura máxima total',               unidad: 'm',       sentido: 'max' },
  { key: 'retranqueo_frente',  label: 'Retranqueo a frente / alineación',  unidad: 'm',       sentido: 'min' },
  { key: 'retranqueo_lateral', label: 'Retranqueo a linderos laterales',   unidad: 'm',       sentido: 'min' },
  { key: 'retranqueo_testero', label: 'Retranqueo a testero',              unidad: 'm',       sentido: 'min' },
  { key: 'altura_piso',        label: 'Altura de piso',                    unidad: 'm',       sentido: null },
  { key: 'altura_piso_pb',     label: 'Altura de piso en planta baja',     unidad: 'm',       sentido: 'min' },
  { key: 'altura_libre',       label: 'Altura libre mínima',               unidad: 'm',       sentido: 'min' },
  { key: 'parcela_minima',     label: 'Parcela mínima',                    unidad: 'm²',      sentido: 'min' },
  { key: 'usos',               label: 'Régimen de usos',                   unidad: null,      sentido: null },
]

export interface ValorNormativo {
  figura: string                       // 'PGOUM 97 — NZ 8.1.a', 'Plano CE (COEF_Z)', 'Ficha APE 05.12'...
  valor: string                        // formateado para mostrar
  valor_num: number | null             // para comparar restrictividad
  tipo: 'oficial' | 'inferido' | 'hipotesis'
  fuente: string | null                // ej. 'arts. 8.8.5-8.8.9 NNUU'
  mas_restrictivo: boolean
}

export interface FilaCuadro {
  parametro: string
  label: string
  unidad: string | null
  valores: ValorNormativo[]
  contradiccion: boolean               // ≥2 figuras con valores numéricos distintos
  estado_actual: { valor: string | null; valor_num: number | null; fuente: string | null }
  potencial: string | null
}

export interface CuadroUrbanistico {
  disponible: boolean
  norma_zonal: string | null
  figuras: string[]                    // todas las figuras normativas detectadas
  ambitos_prevalentes: string[]        // APE/APR/PE... cuya ficha desplaza la NZ
  filas: FilaCuadro[]
  /** Snapshot de los inputs escalares para poder recomputar el cuadro después
   *  (p. ej. al leer una ficha de ámbito) sin repetir el pipeline completo. */
  inputs_snapshot?: {
    parcelArea: number | null
    builtArea: number | null
    huellaM2: number | null
    plantasExistentes: number | null
    alturaExistenteM: number | null
    usoCatastral: string | null
    normaZonal: string | null
    normaZonalDenominacion: string | null
    plantasCondiciones: number | null
  }
  sintesis: {
    edificabilidad_max_m2c: number | null
    construida_m2c: number | null
    remanente_m2c: number | null
    ocupacion_max_m2: number | null
    plantas_max: number | null
  }
  advertencias: string[]
  fuentes: string[]
}

export interface CuadroHit {
  categoria: string
  service: string
  layer_name: string | null
  attributes: Record<string, unknown>
}

export interface CuadroInput {
  parcelArea: number | null
  builtArea: number | null
  huellaM2: number | null
  plantasExistentes: number | null
  alturaExistenteM: number | null      // cartografía municipal (EDIFICIOS_ALTURAS)
  usoCatastral: string | null
  normaZonal: string | null
  normaZonalDenominacion: string | null
  nzRow: NormaZonal | null
  plantasCondiciones: number | null    // máx. COEF_Z del plano CE
  hits: CuadroHit[]
  /** Valores aportados por otras figuras (p. ej. ficha de ámbito leída por IA). */
  valoresExternos?: { parametro: string; valor: Omit<ValorNormativo, 'mas_restrictivo'> }[]
}

export function computeCuadroUrbanistico(input: CuadroInput): CuadroUrbanistico {
  const {
    parcelArea, builtArea, huellaM2, plantasExistentes, alturaExistenteM,
    usoCatastral, normaZonal, nzRow, plantasCondiciones, hits, valoresExternos = [],
  } = input

  const advertencias: string[] = []
  const fuentes: string[] = ['Catastro (INSPIRE/OVC)', 'Geoportal Ayto. Madrid (sin valor jurídico)']
  const figuras = new Set<string>()

  // ── Valores normativos por parámetro ────────────────────────────────────────
  const valoresPorParametro = new Map<string, ValorNormativo[]>()
  const addValor = (parametro: string, v: Omit<ValorNormativo, 'mas_restrictivo'>) => {
    const arr = valoresPorParametro.get(parametro) || []
    arr.push({ ...v, mas_restrictivo: false })
    valoresPorParametro.set(parametro, arr)
    figuras.add(v.figura)
  }

  // Figura 1: la norma zonal (tabla interna curada, contrastada con NNUU)
  if (nzRow) {
    const figuraNZ = `PGOUM 97 — NZ ${nzRow.codigo} (${nzRow.nombre})`
    const tipoNZ: ValorNormativo['tipo'] = nzRow.verificado ? 'inferido' : 'hipotesis'
    const fuenteNZ = nzRow.fuente_articulo || 'Compendio NNUU PGOUM 1997'
    const nz = (parametro: string, valorNum: number | null, valor: string | null) => {
      if (valorNum == null && valor == null) return
      addValor(parametro, {
        figura: figuraNZ,
        valor: valor ?? String(valorNum),
        valor_num: valorNum,
        tipo: tipoNZ,
        fuente: fuenteNZ,
      })
    }
    if (nzRow.coef_edificabilidad != null) {
      nz('edificabilidad', nzRow.coef_edificabilidad,
        `${fmtDec(nzRow.coef_edificabilidad)} m²c/m²s${parcelArea != null ? ` → ${fmt(parcelArea * nzRow.coef_edificabilidad)} m²c` : ''}`)
    }
    if (nzRow.ocupacion_pct != null) {
      nz('ocupacion', nzRow.ocupacion_pct,
        `${fmtDec(nzRow.ocupacion_pct)} %${parcelArea != null ? ` → ${fmt(parcelArea * nzRow.ocupacion_pct / 100)} m² de huella` : ''}`)
    }
    if (nzRow.altura_max_plantas != null) nz('plantas_sobre', nzRow.altura_max_plantas, `${nzRow.altura_max_plantas} plantas`)
    if (nzRow.plantas_bajo_rasante != null) nz('plantas_bajo', nzRow.plantas_bajo_rasante, `${nzRow.plantas_bajo_rasante} plantas`)
    if (nzRow.altura_cornisa_m != null) nz('altura_cornisa', nzRow.altura_cornisa_m, `${fmtDec(nzRow.altura_cornisa_m)} m`)
    if (nzRow.altura_max_m != null) nz('altura_maxima', nzRow.altura_max_m, `${fmtDec(nzRow.altura_max_m)} m`)
    if (nzRow.retranqueo_frente_m != null) nz('retranqueo_frente', nzRow.retranqueo_frente_m, `≥ ${fmtDec(nzRow.retranqueo_frente_m)} m`)
    if (nzRow.retranqueo_lateral_m != null) nz('retranqueo_lateral', nzRow.retranqueo_lateral_m, `≥ ${fmtDec(nzRow.retranqueo_lateral_m)} m`)
    if (nzRow.retranqueo_testero_m != null) nz('retranqueo_testero', nzRow.retranqueo_testero_m, `≥ ${fmtDec(nzRow.retranqueo_testero_m)} m`)
    if (nzRow.altura_piso_m != null) nz('altura_piso', nzRow.altura_piso_m, `${fmtDec(nzRow.altura_piso_m)} m`)
    if (nzRow.altura_piso_pb_m != null) nz('altura_piso_pb', nzRow.altura_piso_pb_m, `≥ ${fmtDec(nzRow.altura_piso_pb_m)} m`)
    if (nzRow.altura_libre_min_m != null) nz('altura_libre', nzRow.altura_libre_min_m, `≥ ${fmtDec(nzRow.altura_libre_min_m)} m`)
    if (nzRow.parcela_minima_m2 != null) {
      nz('parcela_minima', nzRow.parcela_minima_m2,
        `≥ ${fmt(nzRow.parcela_minima_m2)} m²${nzRow.frente_minimo_m != null ? ` · frente ≥ ${fmtDec(nzRow.frente_minimo_m)} m` : ''}`)
    }
    const usosTexto = regimenUsosTexto(nzRow)
    if (usosTexto) {
      addValor('usos', { figura: figuraNZ, valor: usosTexto, valor_num: null, tipo: tipoNZ, fuente: fuenteNZ })
    }
    if (!nzRow.verificado) {
      advertencias.push(
        `Los parámetros de la NZ ${nzRow.codigo} de la tabla interna NO están marcados como verificados: tratar como hipótesis hasta contrastar con las NNUU.`
      )
    }
    if (nzRow.fuente_articulo) fuentes.push(`NNUU PGOUM 97 (${nzRow.fuente_articulo})`)
  } else if (normaZonal) {
    advertencias.push(
      `No hay fila en la tabla interna de normas zonales para la NZ ${normaZonal}: añadir el grado/nivel en «Normas zonales» y verificar sus parámetros en las NNUU.`
    )
  }

  // Figura 2: plano de Condiciones de Edificación (COEF_Z = plantas por banda)
  if (plantasCondiciones != null) {
    addValor('plantas_sobre', {
      figura: 'PGOUM 97 — Plano de Condiciones de Edificación (COEF_Z)',
      valor: `${plantasCondiciones} plantas (máx. del tramo; puede variar por banda de fondo)`,
      valor_num: plantasCondiciones,
      tipo: 'inferido',
      fuente: 'Geoportal — capa Condiciones de la Edificación',
    })
  }

  // Valores externos (fichas de ámbito / documentos leídos)
  for (const ve of valoresExternos) {
    addValor(ve.parametro, ve.valor)
  }

  // ── Figuras que prevalecen o condicionan (sin valor numérico propio aún) ────
  const ambitos = hits.filter((h) => h.categoria === 'ambito' && esAmbitoEspecifico(h.attributes))
  const ambitosNombres = Array.from(new Set(
    ambitos.map((h) => nombreDeAttrs(h.attributes)).filter((n): n is string => Boolean(n))
  ))
  if (ambitos.length > 0) {
    const etiqueta = ambitosNombres.length > 0 ? ambitosNombres.join(' · ') : `${ambitos.length} ámbito(s)`
    advertencias.push(
      `La parcela está dentro de un ámbito de planeamiento específico (${etiqueta}): su ficha PREVALECE sobre las condiciones generales de la norma zonal. Los valores de este cuadro son provisionales hasta leer la ficha.`
    )
    figuras.add(`Ámbito de planeamiento: ${etiqueta}`)
  }
  const proteccion = hits.filter((h) => h.categoria === 'proteccion')
  if (proteccion.length > 0) {
    advertencias.push(
      'Existe protección de catálogo: las obras admisibles (y por tanto la materialización de cualquier potencial) quedan condicionadas por la ficha de catálogo.'
    )
    figuras.add('Catálogo de protección (vigente)')
  }
  const bicDirecto = hits.filter((h) => h.categoria === 'bic' && h.attributes._afeccion === 'directa')
  const bicEntorno = hits.filter((h) => h.categoria === 'bic' && h.attributes._afeccion === 'entorno')
  if (bicDirecto.length > 0) figuras.add('BIC — afección directa (Ley 3/2013 CM)')
  if (bicEntorno.length > 0) figuras.add('BIC — entorno de protección (Ley 3/2013 CM)')

  // ── Resolución de la figura más restrictiva por parámetro ───────────────────
  for (const def of PARAMETROS_CUADRO) {
    const valores = valoresPorParametro.get(def.key)
    if (!valores || !def.sentido) continue
    const numericos = valores.filter((v) => v.valor_num != null)
    if (numericos.length === 0) continue
    const objetivo = def.sentido === 'max'
      ? Math.min(...numericos.map((v) => v.valor_num!))
      : Math.max(...numericos.map((v) => v.valor_num!))
    for (const v of valores) {
      if (v.valor_num === objetivo) v.mas_restrictivo = true
    }
  }

  // ── Estado actual y potencial por parámetro ─────────────────────────────────
  const restrictivo = (key: string): number | null => {
    const v = (valoresPorParametro.get(key) || []).find((x) => x.mas_restrictivo)
    return v?.valor_num ?? null
  }

  const coefMax = restrictivo('edificabilidad')
  const ocupMax = restrictivo('ocupacion')
  const plantasMax = restrictivo('plantas_sobre')
  const alturaMax = restrictivo('altura_maxima')
  const parcelaMin = restrictivo('parcela_minima')

  const edificabilidadMaxM2c = coefMax != null && parcelArea != null ? Math.round(coefMax * parcelArea) : null
  const ocupacionMaxM2 = ocupMax != null && parcelArea != null ? Math.round(ocupMax * parcelArea / 100) : null
  const ocupacionActualPct = huellaM2 != null && parcelArea != null && parcelArea > 0
    ? Math.round((huellaM2 / parcelArea) * 1000) / 10
    : null

  const estadoActual: Record<string, FilaCuadro['estado_actual']> = {
    edificabilidad: {
      valor: builtArea != null
        ? `${fmt(builtArea)} m²c${parcelArea ? ` (${fmtDec(builtArea / parcelArea)} m²c/m²s)` : ''}`
        : null,
      valor_num: builtArea != null && parcelArea ? round2(builtArea / parcelArea) : null,
      fuente: 'Catastro (construida, inferido)',
    },
    ocupacion: {
      valor: ocupacionActualPct != null ? `${fmtDec(ocupacionActualPct)} % (${fmt(huellaM2!)} m² de huella)` : null,
      valor_num: ocupacionActualPct,
      fuente: 'Catastro (huella WFS BU, inferido)',
    },
    plantas_sobre: {
      valor: plantasExistentes != null ? `${plantasExistentes} plantas` : null,
      valor_num: plantasExistentes,
      fuente: 'Catastro',
    },
    plantas_bajo: { valor: null, valor_num: null, fuente: null },
    altura_cornisa: { valor: null, valor_num: null, fuente: null },
    altura_maxima: {
      valor: alturaExistenteM != null ? `≈ ${fmtDec(alturaExistenteM)} m` : null,
      valor_num: alturaExistenteM,
      fuente: alturaExistenteM != null ? 'Cartografía municipal (alturas de edificación)' : null,
    },
    usos: {
      valor: usoCatastral,
      valor_num: null,
      fuente: usoCatastral ? 'Catastro (uso principal)' : null,
    },
    parcela_minima: {
      valor: parcelArea != null ? `parcela actual ${fmt(parcelArea)} m²` : null,
      valor_num: parcelArea,
      fuente: 'Catastro (oficial)',
    },
  }

  const potencial: Record<string, string | null> = {}
  if (edificabilidadMaxM2c != null && builtArea != null) {
    const rem = edificabilidadMaxM2c - builtArea
    potencial.edificabilidad = rem >= 0
      ? `+${fmt(rem)} m²c de remanente teórico`
      : `agotada — exceso de ${fmt(Math.abs(rem))} m²c sobre la teórica (posible fuera de ordenación relativa)`
  }
  if (ocupacionMaxM2 != null && huellaM2 != null) {
    const extra = ocupacionMaxM2 - huellaM2
    potencial.ocupacion = extra >= 0
      ? `+${fmt(extra)} m² de huella adicional posible`
      : `ocupación agotada — exceso de ${fmt(Math.abs(extra))} m²`
  }
  if (plantasMax != null && plantasExistentes != null) {
    const extra = plantasMax - plantasExistentes
    potencial.plantas_sobre = extra > 0
      ? `+${extra} planta(s): remonte teórico (verificar catálogo, vuelo y estructura)`
      : extra === 0 ? 'altura agotada' : `supera en ${Math.abs(extra)} planta(s) lo permitido`
  }
  if (alturaMax != null && alturaExistenteM != null) {
    const extra = round2(alturaMax - alturaExistenteM)
    potencial.altura_maxima = extra > 0 ? `margen ≈ ${fmtDec(extra)} m` : 'altura agotada o superada'
  }
  if (parcelaMin != null && parcelArea != null && parcelArea >= parcelaMin * 2) {
    potencial.parcela_minima = `parcela divisible: hasta ${Math.floor(parcelArea / parcelaMin)} parcelas (verificar frente mínimo y forma)`
  }

  // ── Montaje de filas (solo parámetros con algún dato) ───────────────────────
  const filas: FilaCuadro[] = []
  for (const def of PARAMETROS_CUADRO) {
    const valores = valoresPorParametro.get(def.key) || []
    const actual = estadoActual[def.key] || { valor: null, valor_num: null, fuente: null }
    const pot = potencial[def.key] ?? null
    if (valores.length === 0 && actual.valor == null && pot == null) continue
    const distintos = new Set(valores.filter((v) => v.valor_num != null).map((v) => v.valor_num))
    filas.push({
      parametro: def.key,
      label: def.label,
      unidad: def.unidad,
      valores,
      contradiccion: distintos.size > 1,
      estado_actual: actual,
      potencial: pot,
    })
  }

  const disponible = filas.length > 0
  if (disponible) {
    advertencias.push(
      'Cuadro orientativo elaborado con visores oficiales SIN valor jurídico y tabla interna de NNUU: el valor con efectos jurídicos exige consulta urbanística.'
    )
  }

  return {
    disponible,
    norma_zonal: normaZonal,
    figuras: Array.from(figuras),
    ambitos_prevalentes: ambitosNombres,
    filas,
    inputs_snapshot: {
      parcelArea, builtArea, huellaM2, plantasExistentes, alturaExistenteM,
      usoCatastral, normaZonal, normaZonalDenominacion: input.normaZonalDenominacion,
      plantasCondiciones,
    },
    sintesis: {
      edificabilidad_max_m2c: edificabilidadMaxM2c,
      construida_m2c: builtArea != null ? Math.round(builtArea) : null,
      remanente_m2c: edificabilidadMaxM2c != null && builtArea != null
        ? Math.round(edificabilidadMaxM2c - builtArea) : null,
      ocupacion_max_m2: ocupacionMaxM2,
      plantas_max: plantasMax,
    },
    advertencias,
    fuentes,
  }
}

/**
 * ¿El hit es un ámbito de planeamiento ESPECÍFICO (APE/APR/API/UE/PERI...)?
 * La capa 'Ámbitos Ordenación' devuelve también el polígono de la propia norma
 * zonal (etiqueta tipo '8.1.a'), que no es un ámbito: sin este filtro, TODAS
 * las parcelas salían "dentro de ámbito específico".
 */
export function esAmbitoEspecifico(attributes: Record<string, unknown>): boolean {
  const textos = Object.entries(attributes)
    .filter(([k, v]) => /ETIQ|DENOM|NOMBRE|AMBITO|CODIGO/i.test(k) && typeof v === 'string')
    .map(([, v]) => String(v).trim())
  if (textos.length === 0) return false
  // Etiqueta de norma zonal: '8', '8.1', '8.1.a', 'ZONA 8 GRADO 1º - NIVEL a'
  const esEtiquetaNZ = (t: string) =>
    /^\d{1,2}(\.\d{1,2})?(\.[a-z])?$/i.test(t) || /^ZONA\s+\d/i.test(t)
  const esFiguraEspecifica = (t: string) =>
    /^(APE|APR|API|APD|UE|UZP|UZI|PERI|PERI\b|PE\s|ED\s|PP\s)/i.test(t)
  if (textos.some(esFiguraEspecifica)) return true
  // Si todos los textos identificativos son etiquetas de NZ → no es un ámbito real
  return !textos.every(esEtiquetaNZ)
}

/** Candidatos de búsqueda en la tabla interna: '8.1.a' → ['8.1.a','8.1','8']. */
export function nzCandidatos(etiqueta: string): string[] {
  const tokens = etiqueta.toLowerCase().match(/\d+|[a-z]+/g) || []
  const out: string[] = []
  for (let i = tokens.length; i >= 1; i--) {
    out.push(tokens.slice(0, i).join('.'))
  }
  return Array.from(new Set(out))
}

function regimenUsosTexto(nz: NormaZonal): string | null {
  const r = nz.regimen_usos
  const partes: string[] = []
  const cualificado = r?.cualificado || nz.uso_cualificado
  if (cualificado) partes.push(`Cualificado: ${cualificado}`)
  if (r?.compatibles) partes.push(`Compatibles: ${r.compatibles}`)
  if (r?.autorizables) partes.push(`Autorizables: ${r.autorizables}`)
  if (r?.prohibidos) partes.push(`Prohibidos: ${r.prohibidos}`)
  if (r?.texto) partes.push(r.texto)
  return partes.length > 0 ? partes.join(' · ') : null
}

function nombreDeAttrs(attrs: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(attrs)) {
    if (/NOMBRE|DENOMIN|ETIQ|AMBITO/i.test(k) && typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)
}
function fmtDec(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n)
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

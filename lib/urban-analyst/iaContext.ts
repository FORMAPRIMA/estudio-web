// Contexto y reglas compartidas para las llamadas a Claude
// (intérprete de ficha, escenarios y chat contextualizado).

import type { LayerHitRaw } from './geoportal'
import type { EdificabilidadResult, NormaZonal, UrbanAsset, UrbanRedFlag, UrbanDocument } from './types'

export const IA_MODEL = 'claude-opus-4-8'

export const REGLAS_ANALISTA = `Eres el analista urbanístico senior de Forma Prima, un estudio de arquitectura de Madrid. Analizas activos inmobiliarios en Madrid capital para decisiones de inversión, a partir de datos oficiales que te proporciona el sistema (Catastro y capas del Geoportal del Ayuntamiento de Madrid).

REGLAS INNEGOCIABLES:
- NO inventes datos. Trabaja únicamente con la información proporcionada y con el marco normativo general (PGOUM 1997, Ley 9/2001 del Suelo CM, Ordenanza 6/2022 de Licencias).
- Etiqueta cada afirmación relevante como [OFICIAL] (dato de Catastro/capa oficial), [INFERIDO] (deducción razonable de datos oficiales) o [HIPÓTESIS] (supuesto de trabajo pendiente de verificar).
- La información de los visores municipales CARECE DE VALOR JURÍDICO: dilo cuando sea material y recomienda consulta urbanística común o especial cuando la decisión dependa de ello.
- NUNCA des por viable un remonte/ampliación solo porque exista edificabilidad remanente: separa potencial urbanístico teórico, viabilidad jurídico-registral y viabilidad técnico-económica.
- Cuando el cálculo de edificabilidad sea de método "volumetrico" (zonas sin coeficiente: NZ 2/3/4/11, o NZ 1 sin bandas del plano CE), presenta SIEMPRE la edificabilidad como horquilla estimada [HIPÓTESIS] entre envolvente_min y envolvente_max, nunca como cifra única, y recuerda que el COEF_Z son plantas por banda de fondo (no un coeficiente de edificabilidad).
- Cuando el método sea "formula_volumetrica" (NZ 1: E = S × Z × C con S y Z del plano de Condiciones de la Edificación y C del art. 8.1.3), la edificabilidad_teorica es una cifra calculada con datos oficiales [INFERIDO] pero NO un derecho: adviértelo siempre — S se aproxima como banda ∩ parcela catastral (la "parcela edificable" del art. 6.2.9 puede diferir), las alturas las fija caso a caso la CIPHAN y la ficha de catálogo manda sobre cualquier remanente.
- NUNCA des por viable un cambio de uso sin advertir que depende del régimen de usos de la norma zonal, condiciones por planta/acceso, protección y normativa sectorial.
- Si el edificio está protegido o en ámbito específico, ese condicionante va SIEMPRE por delante de cualquier tesis de inversión.
- Este análisis es preliminar y no sustituye informe técnico ni resolución administrativa.
- No uses markdown con asteriscos en los textos (van a PDF): texto plano, guiones para listas.`

export interface ContextoActivo {
  asset: Partial<UrbanAsset>
  normaZonalInfo: NormaZonal | null
  hits: Pick<LayerHitRaw, 'categoria' | 'layer_name' | 'attributes'>[]
  redFlags: Pick<UrbanRedFlag, 'severidad' | 'titulo' | 'descripcion' | 'recomendacion'>[]
  edificabilidad: EdificabilidadResult | null
  documentos: { nombre: string; tipo: string | null; extracto: string | null }[]
}

/** Serializa el contexto completo del activo para el prompt (compacto y estable). */
/** Quita las geometrías del resultado de volumen capaz (para prompts). */
export function stripVolumenGeometrias(content: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!content) return null
  const strip = (arr: unknown) => Array.isArray(arr)
    ? arr.map((x) => {
        if (x && typeof x === 'object') {
          const { geometry: _g, ...rest } = x as Record<string, unknown>
          return rest
        }
        return x
      })
    : arr
  return { ...content, bandas: strip(content.bandas), partes: strip(content.partes) }
}

export function buildContextoActivo(params: {
  asset: UrbanAsset
  nzRow: NormaZonal | null
  hits: { categoria: string; layer_name: string | null; attributes: Record<string, unknown> }[]
  flags: { severidad: string; titulo: string; descripcion: string | null; recomendacion: string | null }[]
  edificabilidad: EdificabilidadResult | null
  cuadroUrbanistico?: Record<string, unknown> | null
  volumenCapaz?: Record<string, unknown> | null
  lecturaDocumentos?: Record<string, unknown> | null
  documentos?: UrbanDocument[]
  /** Checklist determinista de due diligence: hechos verificados por reglas de código (no IA). */
  checklist?: { titulo: string; estado: string; detalle: string }[]
}): string {
  const { asset, nzRow, hits, flags, edificabilidad, cuadroUrbanistico = null, volumenCapaz = null, lecturaDocumentos = null, documentos = [], checklist = [] } = params
  const ctx = {
    activo: {
      nombre: asset.nombre,
      direccion: asset.direccion,
      referencia_catastral: asset.refcat,
      superficie_parcela_m2_oficial: asset.parcel_area,
      superficie_construida_m2_catastro: asset.built_area,
      superficie_construida_computable_m2: asset.built_area_computable,
      desglose_construida: asset.built_area_desglose
        ? {
            computable_m2: asset.built_area_desglose.computable_m2,
            no_computable_m2: asset.built_area_desglose.no_computable_m2,
            aparcamiento_m2: asset.built_area_desglose.aparcamiento_m2,
            trastero_m2: asset.built_area_desglose.trastero_m2,
            almacen_m2: asset.built_area_desglose.almacen_m2,
            nota: 'La superficie computable descuenta garaje y trastero/almacén anejo del bruto catastral (estimación INFERIDO). Usa la computable para hablar de edificabilidad/remanente; menciona el bruto solo como superficie física total.',
          }
        : undefined,
      uso_catastral: asset.cadastral_use,
      anio_construccion: asset.year_built,
      num_inmuebles: asset.num_inmuebles,
      num_viviendas: asset.num_viviendas,
      operacion: {
        tipo: asset.tipo_operacion,
        uso_actual: asset.uso_actual,
        uso_objetivo: asset.uso_objetivo,
        superficie_comercial_declarada_m2: asset.superficie_comercial,
        precio_compra_eur: asset.precio_compra,
        capex_estimado_eur: asset.capex_estimado,
        notas: asset.notas,
      },
    },
    norma_zonal: {
      etiqueta: asset.norma_zonal,
      denominacion: asset.norma_zonal_denominacion,
      info_tabla_interna: nzRow
        ? {
            nombre: nzRow.nombre,
            tipologia: nzRow.tipologia,
            uso_cualificado: nzRow.uso_cualificado,
            coef_edificabilidad: nzRow.coef_edificabilidad,
            altura_max_plantas: nzRow.altura_max_plantas,
            ocupacion_pct: nzRow.ocupacion_pct,
            plantas_bajo_rasante: nzRow.plantas_bajo_rasante,
            altura_cornisa_m: nzRow.altura_cornisa_m,
            altura_max_m: nzRow.altura_max_m,
            retranqueo_frente_m: nzRow.retranqueo_frente_m,
            retranqueo_lateral_m: nzRow.retranqueo_lateral_m,
            retranqueo_testero_m: nzRow.retranqueo_testero_m,
            altura_libre_min_m: nzRow.altura_libre_min_m,
            parcela_minima_m2: nzRow.parcela_minima_m2,
            frente_minimo_m: nzRow.frente_minimo_m,
            regimen_usos: nzRow.regimen_usos,
            fuente_articulo: nzRow.fuente_articulo,
            condiciones: nzRow.condiciones,
            notas: nzRow.notas,
            parametros_verificados: nzRow.verificado,
          }
        : null,
    },
    capas_oficiales_intersectadas: hits.map((h) => ({
      categoria: h.categoria,
      capa: h.layer_name,
      atributos: h.attributes,
    })),
    red_flags_detectadas: flags.map((f) => ({
      severidad: f.severidad,
      titulo: f.titulo,
      descripcion: f.descripcion,
      recomendacion: f.recomendacion,
    })),
    calculo_edificabilidad: edificabilidad,
    cuadro_urbanistico_formato_licencia: cuadroUrbanistico,
    volumen_capaz_por_bandas: volumenCapaz,
    lectura_documentos_oficiales: lecturaDocumentos,
    // Reglas deterministas ya resueltas por código (umbrales normativos como el
    // IEE a los 50 años, necesidad de consulta, etc.): son HECHOS del flujo de
    // due diligence — apóyate en ellos en lugar de dejar la duda abierta.
    checklist_due_diligence: checklist.length > 0
      ? checklist.map((c) => ({ item: c.titulo, estado: c.estado, detalle: c.detalle }))
      : undefined,
    documentos_aportados: documentos.map((d) => ({
      nombre: d.nombre,
      tipo: d.tipo,
      extracto: d.parsed_text ? d.parsed_text.slice(0, 6000) : null,
    })),
    advertencia_fuentes:
      'Capas del Geoportal del Ayuntamiento de Madrid: información SIN valor jurídico. Datos catastrales: descriptivos, no acreditan legalidad urbanística.',
  }
  return JSON.stringify(ctx, null, 1)
}

/** Quita fences de código si el modelo envuelve el JSON. */
export function parseJsonRespuesta(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) as Record<string, unknown> } catch { return null }
    }
    return null
  }
}

// Tipos compartidos de Urban Analyst (análisis urbanístico preliminar, Madrid)

export type UrbanAssetStatus = 'pendiente' | 'analizando' | 'completado' | 'error'

export type PipelineStepStatus = 'pendiente' | 'en_curso' | 'ok' | 'aviso' | 'error'

export interface PipelineStep {
  key: string
  label: string
  status: PipelineStepStatus
  detail?: string
}

export interface UrbanAsset {
  id: string
  nombre: string
  direccion: string | null
  refcat: string | null
  refcats: string[] | null            // referencias adicionales (edificio multi-parcela)
  lat: number | null
  lng: number | null
  parcel_geometry: GeoJSONGeometry | null
  parcel_area: number | null
  built_area: number | null
  cadastral_use: string | null
  year_built: number | null
  num_inmuebles: number | null
  num_viviendas: number | null
  tipo_operacion: string | null
  uso_actual: string | null
  uso_objetivo: string | null
  superficie_comercial: number | null
  precio_compra: number | null
  capex_estimado: number | null
  notas: string | null
  norma_zonal: string | null
  norma_zonal_denominacion: string | null
  status: UrbanAssetStatus
  pipeline: PipelineStep[]
  error_msg: string | null
  analyzed_at: string | null
  created_at: string
}

export type HitCategoria =
  | 'norma_zonal' | 'proteccion' | 'ambito' | 'planeamiento' | 'uso_suelo'
  | 'bic' | 'arqueologia' | 'analisis_edificacion' | 'condiciones' | 'otros'

export interface UrbanLayerHit {
  id: string
  asset_id: string
  categoria: HitCategoria
  service: string
  layer_id: number | null
  layer_name: string | null
  attributes: Record<string, unknown>
  source_url: string | null
  legal_value: boolean
  fetched_at: string
}

export type Severidad = 'baja' | 'media' | 'alta' | 'critica'

export interface UrbanRedFlag {
  id: string
  asset_id: string
  categoria: string
  severidad: Severidad
  titulo: string
  descripcion: string | null
  recomendacion: string | null
  fuente: string | null
}

export interface UrbanAnalysisRow {
  id: string
  asset_id: string
  kind: 'edificabilidad' | 'memo' | 'volumen_capaz' | 'documentos_oficiales'
  content: Record<string, unknown>
  model: string | null
  created_at: string
}

export interface UrbanScenario {
  id: string
  asset_id: string
  nombre: string
  tipo: string
  descripcion: string | null
  resultado: Record<string, unknown> | null
  status: 'pendiente' | 'generando' | 'completado' | 'error'
  created_at: string
}

export interface UrbanChatMessage {
  id: string
  asset_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface UrbanDocument {
  id: string
  asset_id: string
  nombre: string
  tipo: string | null
  file_url: string
  parsed_text: string | null
  created_at: string
}

export interface NormaZonal {
  codigo: string
  nombre: string
  tipologia: string | null
  uso_cualificado: string | null
  coef_edificabilidad: number | null
  altura_max_plantas: number | null
  condiciones: string | null
  notas: string | null
  verificado: boolean
  fuente: string | null
}

// ── GeoJSON mínimo (sin dependencia externa) ─────────────────────────────────
export type Position = [number, number] // [lng, lat]

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon

// ── Resultado del cálculo determinista de edificabilidad ─────────────────────
export type MetodoEdificabilidad = 'coeficiente' | 'volumetrico' | 'no_calculable'

export interface EdificabilidadResult {
  calculable: boolean
  metodo: MetodoEdificabilidad
  coef_utilizado: number | null
  coef_verificado: boolean
  superficie_parcela: number | null           // m² — dato oficial Catastro
  edificabilidad_teorica: number | null       // m²c — parcela × coef (hipótesis si coef no verificado)
  superficie_construida_existente: number | null // m²c — Catastro (inferido: incluye no computables)
  edificabilidad_remanente: number | null
  ratio_agotamiento: number | null            // 0..1+
  // Método volumétrico (zonas sin coeficiente: NZ 1/2/3/4/11)
  envolvente_min: number | null               // m²c — suelo de la horquilla (lo construido consolida)
  envolvente_max: number | null               // m²c — techo: huella × plantas permitidas
  huella_m2: number | null                    // huella del edificio (WFS BU, inferido)
  plantas_existentes: number | null           // Catastro
  plantas_permitidas: number | null           // COEF_Z plano Condiciones de Edificación (máximo del tramo)
  inputs_faltantes: string[]                  // qué falta para poder calcular
  etiquetas: { campo: string; valor: string; tipo: 'oficial' | 'inferido' | 'hipotesis' }[]
  advertencias: string[]
  recomendaciones: string[]
}

export const TIPOS_ESCENARIO: { value: string; label: string }[] = [
  { value: 'reforma',      label: 'Reforma sin cambio de uso' },
  { value: 'cambio_uso',   label: 'Cambio de uso' },
  { value: 'segregacion',  label: 'Segregación / división horizontal' },
  { value: 'remonte',      label: 'Remonte / derechos de vuelo' },
  { value: 'ampliacion',   label: 'Ampliación' },
  { value: 'obra_nueva',   label: 'Demolición y obra nueva' },
  { value: 'hotel',        label: 'Hotel boutique / hospedaje' },
  { value: 'coliving',     label: 'Coliving' },
  { value: 'turistico',    label: 'Alquiler turístico (VUT)' },
  { value: 'terciario',    label: 'Terciario oficinas / retail' },
]

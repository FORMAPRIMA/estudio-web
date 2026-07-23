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
  built_area: number | null                    // m² construidos brutos (Catastro)
  built_area_computable: number | null         // m²c que computan a edificabilidad (bruto − garaje/trastero)
  built_area_desglose: ConstruidaDesglose | null
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

// Desglose de la superficie construida por uso (elementos constructivos de
// Catastro, DNPRC). Base para descontar de la edificabilidad lo que no computa
// (garaje y trastero/almacén anejo). Es una estimación [INFERIDO]: la regla
// jurídica exacta (art. 6.5.3 PGOUM) tiene matices que Catastro no refleja.
export interface ConstruidaDesglose {
  total_m2: number | null                      // suma de elementos leídos (≈ superficie construida)
  computable_m2: number | null                 // total − no computable
  no_computable_m2: number                     // garaje + trastero (+ almacén anejo)
  aparcamiento_m2: number
  trastero_m2: number
  almacen_m2: number
  almacen_computa: boolean                      // true si el almacén es el uso dominante (nave productiva) → computa
  por_uso: { uso: string; m2: number; computa: boolean }[]
  inmuebles_totales: number | null
  inmuebles_muestreados: number
  incompleto: boolean                           // true si se muestreó solo una parte de los inmuebles
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
  kind: 'edificabilidad' | 'memo' | 'volumen_capaz' | 'documentos_oficiales' | 'cuadro_urbanistico' | 'producto'
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
  codigo: string                       // admite grado y nivel: '8', '8.1', '8.1.a'
  nombre: string
  tipologia: string | null
  uso_cualificado: string | null
  coef_edificabilidad: number | null   // m²c/m²s
  formula_c: number | null             // C de E = S × Z × C (NZ 1; Z = COEF_Z del plano CE)
  altura_max_plantas: number | null    // plantas sobre rasante
  // Matriz completa de parámetros (NNUU PGOUM 97) — NULL = sin verificar
  ocupacion_pct: number | null
  plantas_bajo_rasante: number | null
  altura_cornisa_m: number | null
  altura_max_m: number | null
  retranqueo_frente_m: number | null
  retranqueo_lateral_m: number | null
  retranqueo_testero_m: number | null
  altura_piso_m: number | null
  altura_piso_pb_m: number | null      // altura mínima de piso en planta baja (NZ 1: 3,60 m)
  altura_libre_min_m: number | null
  parcela_minima_m2: number | null
  frente_minimo_m: number | null
  regimen_usos: { cualificado?: string; compatibles?: string; autorizables?: string; prohibidos?: string; texto?: string } | null
  fuente_articulo: string | null       // ej. 'arts. 8.8.5-8.8.9 NNUU PGOUM 97'
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
export type MetodoEdificabilidad = 'coeficiente' | 'formula_volumetrica' | 'volumetrico' | 'no_calculable'

export interface EdificabilidadResult {
  calculable: boolean
  metodo: MetodoEdificabilidad
  coef_utilizado: number | null
  coef_verificado: boolean
  superficie_parcela: number | null           // m² — dato oficial Catastro
  edificabilidad_teorica: number | null       // m²c — parcela × coef (hipótesis si coef no verificado)
  superficie_construida_existente: number | null // m²c — Catastro bruto (incluye no computables)
  superficie_construida_computable: number | null // m²c que computan (bruto − garaje/trastero)
  construida_desglose?: ConstruidaDesglose | null // desglose por uso usado en el descuento
  edificabilidad_remanente: number | null
  ratio_agotamiento: number | null            // 0..1+
  // Método fórmula volumétrica (NZ 1: E = S × Z × C, Z del plano CE por banda)
  formula_c?: number | null                   // C aplicado
  formula_desglose?: { coef_z: string; area_m2: number; plantas: number | null; m2c: number | null }[]
  // Método volumétrico (zonas sin coeficiente: NZ 2/3/4/11 y NZ 1 sin bandas)
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

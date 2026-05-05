// Due Diligence Visits — tipos de dominio
// Prefijo Dd* para todos los tipos del módulo

// ─── Enums ────────────────────────────────────────────────────────────────────

export type DdAssetStatus =
  | 'preparacion_documental'
  | 'visita_programada'
  | 'en_visita'
  | 'revision_interna'
  | 'informe_redaccion'
  | 'cerrado'

export type DdVisitStatus =
  | 'programada'
  | 'en_curso'
  | 'finalizada'
  | 'en_revision_interna'
  | 'cerrada'

export type DdCardEstado =
  | 'pendiente'
  | 'revisado_ok'
  | 'incidencia'
  | 'no_accesible'
  | 'no_aplica'
  | 'requiere_aclaracion'

export type DdCardRiesgo =
  | 'sin_riesgo'
  | 'bajo'
  | 'medio'
  | 'alto'

export type DdCardPrioridad =
  | 'alta'
  | 'media'
  | 'baja'

// ─── Entidades (mirrors BD) ───────────────────────────────────────────────────

export interface DdAsset {
  id: string
  nombre: string
  direccion: string | null
  cliente: string | null
  superficie_m2: number | null
  uso_previsto: string | null
  alcance_dd: string | null
  status: DdAssetStatus
  limitaciones_generales: string | null
  disclaimer_texto: string | null
  created_at: string
  updated_at: string
}

export interface DdRole {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  orden: number
  activo: boolean
}

export interface DdVisit {
  id: string
  asset_id: string
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  status: DdVisitStatus
  zonas_previstas: string[] | null
  zonas_inspeccionadas: string[] | null
  zonas_no_accesibles: string[] | null
  observaciones_generales: string | null
  resumen_ejecutivo: string | null
  capex_orientativo_total: string | null
  created_at: string
  updated_at: string
}

export interface DdVisitTeam {
  id: string
  visit_id: string
  rol_id: string
  user_id: string | null
  nombre_display: string
  created_at: string
  rol?: DdRole
}

export interface DdCard {
  id: string
  asset_id: string
  visit_id: string | null
  rol_id: string
  // Guía prellenada
  titulo: string
  especialidad: string | null
  zona_edificio: string | null
  prioridad: DdCardPrioridad
  objetivo_revision: string | null
  que_revisar: string | null
  senales_alerta: string | null
  fotos_recomendadas: string | null
  preguntas_confirmar: string | null
  documentacion_relacionada: string | null
  orden: number
  activo: boolean
  // Captura de campo
  estado: DdCardEstado
  riesgo: DdCardRiesgo | null
  planta: string | null
  zona: string | null
  estancia: string | null
  comentario_tecnico: string | null
  requiere_seguimiento: boolean
  incluir_revision_interna: boolean
  // Backoffice
  diagnostico_interno: string | null
  impacto_potencial: string | null
  recomendacion_preliminar: string | null
  capex_orientativo: string | null
  texto_propuesto_informe: string | null
  texto_aprobado_informe: string | null
  texto_aprobado: boolean
  nivel_criticidad_final: DdCardRiesgo | null
  requiere_aclaracion_propiedad: boolean
  incluir_reporte_final: boolean
  created_at: string
  updated_at: string
}

export interface DdCardMedia {
  id: string
  card_id: string
  asset_id: string
  visit_id: string | null
  tipo: 'foto' | 'video'
  url: string
  storage_path: string | null
  caption: string | null
  user_id: string | null
  created_at: string
}

export interface DdAssetDoc {
  id: string
  asset_id: string
  nombre: string
  tipo: 'recibida' | 'pendiente'
  url: string | null
  notas: string | null
  orden: number
  created_at: string
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateDdAssetInput {
  nombre: string
  direccion?: string
  cliente?: string
  superficie_m2?: number
  uso_previsto?: string
  alcance_dd?: string
}

export interface UpdateDdAssetInput {
  nombre?: string
  direccion?: string | null
  cliente?: string | null
  superficie_m2?: number | null
  uso_previsto?: string | null
  alcance_dd?: string | null
  status?: DdAssetStatus
  limitaciones_generales?: string | null
  disclaimer_texto?: string | null
}

export interface CreateDdVisitInput {
  asset_id: string
  fecha?: string
  hora_inicio?: string
  hora_fin?: string
  zonas_previstas?: string[]
}

export interface UpdateDdVisitInput {
  fecha?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  status?: DdVisitStatus
  zonas_previstas?: string[] | null
  zonas_inspeccionadas?: string[] | null
  zonas_no_accesibles?: string[] | null
  observaciones_generales?: string | null
  resumen_ejecutivo?: string | null
  capex_orientativo_total?: string | null
}

export interface UpdateDdCardFieldInput {
  estado?: DdCardEstado
  riesgo?: DdCardRiesgo | null
  planta?: string | null
  zona?: string | null
  estancia?: string | null
  comentario_tecnico?: string | null
  requiere_seguimiento?: boolean
  incluir_revision_interna?: boolean
}

export interface UpdateDdCardBackofficeInput {
  diagnostico_interno?: string | null
  impacto_potencial?: string | null
  recomendacion_preliminar?: string | null
  capex_orientativo?: string | null
  texto_propuesto_informe?: string | null
  texto_aprobado_informe?: string | null
  texto_aprobado?: boolean
  nivel_criticidad_final?: DdCardRiesgo | null
  requiere_aclaracion_propiedad?: boolean
  incluir_reporte_final?: boolean
}

export interface UpdateDdCardGuideInput {
  titulo?: string
  especialidad?: string | null
  zona_edificio?: string | null
  prioridad?: DdCardPrioridad
  objetivo_revision?: string | null
  que_revisar?: string | null
  senales_alerta?: string | null
  fotos_recomendadas?: string | null
  preguntas_confirmar?: string | null
  documentacion_relacionada?: string | null
}

// ─── Labels y colores para UI ─────────────────────────────────────────────────

export const DD_ASSET_STATUS_LABELS: Record<DdAssetStatus, string> = {
  preparacion_documental: 'Preparación documental',
  visita_programada:      'Visita programada',
  en_visita:              'En visita',
  revision_interna:       'Revisión interna',
  informe_redaccion:      'Informe en redacción',
  cerrado:                'Cerrado',
}

export const DD_ASSET_STATUS_COLORS: Record<DdAssetStatus, string> = {
  preparacion_documental: '#5B7FA6',
  visita_programada:      '#C4A532',
  en_visita:              '#D85A30',
  revision_interna:       '#7A6B8A',
  informe_redaccion:      '#2D7D5A',
  cerrado:                '#888888',
}

export const DD_VISIT_STATUS_LABELS: Record<DdVisitStatus, string> = {
  programada:          'Programada',
  en_curso:            'En curso',
  finalizada:          'Finalizada',
  en_revision_interna: 'En revisión interna',
  cerrada:             'Cerrada',
}

export const DD_VISIT_STATUS_COLORS: Record<DdVisitStatus, string> = {
  programada:          '#5B7FA6',
  en_curso:            '#D85A30',
  finalizada:          '#2D7D5A',
  en_revision_interna: '#7A6B8A',
  cerrada:             '#888888',
}

export const DD_CARD_ESTADO_LABELS: Record<DdCardEstado, string> = {
  pendiente:            'Pendiente',
  revisado_ok:          'Revisado OK',
  incidencia:           'Incidencia',
  no_accesible:         'No accesible',
  no_aplica:            'No aplica',
  requiere_aclaracion:  'Requiere aclaración',
}

export const DD_CARD_ESTADO_COLORS: Record<DdCardEstado, string> = {
  pendiente:            '#888888',
  revisado_ok:          '#2D7D5A',
  incidencia:           '#C0392B',
  no_accesible:         '#E67E22',
  no_aplica:            '#AAAAAA',
  requiere_aclaracion:  '#5B7FA6',
}

export const DD_CARD_RIESGO_LABELS: Record<DdCardRiesgo, string> = {
  sin_riesgo: 'Sin riesgo',
  bajo:       'Bajo',
  medio:      'Medio',
  alto:       'Alto',
}

export const DD_CARD_RIESGO_COLORS: Record<DdCardRiesgo, string> = {
  sin_riesgo: '#2D7D5A',
  bajo:       '#5B7FA6',
  medio:      '#E67E22',
  alto:       '#C0392B',
}

export const DD_CARD_PRIORIDAD_LABELS: Record<DdCardPrioridad, string> = {
  alta:  'Alta',
  media: 'Media',
  baja:  'Baja',
}

export const DD_CARD_PRIORIDAD_COLORS: Record<DdCardPrioridad, string> = {
  alta:  '#C0392B',
  media: '#E67E22',
  baja:  '#5B7FA6',
}

export const DD_DEFAULT_DISCLAIMER = 'La presente revisión tiene carácter visual, no invasivo y no destructivo. No incluye catas, ensayos, pruebas de carga, pruebas de estanqueidad, mediciones instrumentales exhaustivas, auditoría urbanística/legal completa, certificación de cumplimiento normativo ni validación completa de instalaciones ocultas. Las conclusiones se limitan a los elementos accesibles y observables en la fecha de visita.'

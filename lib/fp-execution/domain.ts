// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Domain Types
// Prefix: Fpe* for all types in this module.
// Mirrors fpe_* database tables exactly. No UI logic here.
// ══════════════════════════════════════════════════════════════════════════════

// ── Enums ─────────────────────────────────────────────────────────────────────

export type FpeProjectStatus =
  | 'borrador'
  | 'scope_ready'
  | 'tender_launched'
  | 'awarded'
  | 'contracted'
  | 'archived'

export type FpeTenderStatus =
  | 'draft'
  | 'readiness_check'
  | 'launched'
  | 'closed'
  | 'cancelled'

export type FpeInvitationStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'bid_submitted'
  | 'expired'
  | 'revoked'

export type FpeBidStatus = 'draft' | 'submitted' | 'accepted' | 'rejected'

export type FpeContractStatus = 'draft' | 'sent_to_sign' | 'signed' | 'cancelled'

// ── Template Layer ────────────────────────────────────────────────────────────

export interface FpeTemplateChapter {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
  // joins
  units?: FpeTemplateUnit[]
}

export interface FpeTemplateUnit {
  id: string
  chapter_id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
  // joins
  chapter?: Pick<FpeTemplateChapter, 'id' | 'nombre'>
  line_items?: FpeTemplateLineItem[]
  phases?: FpeTemplatePhase[]
}

export interface FpeTemplateLineItem {
  id: string
  unit_id: string
  nombre: string
  descripcion: string | null
  unidad_medida: string
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
  // joins
  unit?: Pick<FpeTemplateUnit, 'id' | 'nombre'>
}

export interface FpeTemplatePhase {
  id: string
  unit_id: string
  nombre: string
  descripcion: string | null
  orden: number
  lead_time_days: number
  created_at: string
  updated_at: string
  // joins
  unit?: Pick<FpeTemplateUnit, 'id' | 'nombre'>
}

export interface FpeTemplateDependency {
  id: string
  predecessor_phase_id: string
  successor_phase_id: string
  lag_days: number
  created_at: string
}

// Full template tree (used by Template page and Scope Builder)
export interface FpeTemplateTree {
  chapters: (FpeTemplateChapter & {
    units: (FpeTemplateUnit & {
      line_items: FpeTemplateLineItem[]
      phases: FpeTemplatePhase[]
    })[]
  })[]
}

// ── Partners ──────────────────────────────────────────────────────────────────

export interface FpePartner {
  id: string
  nombre: string
  razon_social: string | null
  nif_cif: string | null
  contacto_nombre: string | null
  email_contacto: string | null
  email_notificaciones: string | null
  email_facturacion: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  codigo_postal: string | null
  pais: string
  iban: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
  // joins
  capabilities?: FpePartnerCapability[]
}

export interface FpePartnerCapability {
  id: string
  partner_id: string
  unit_id: string
  created_at: string
  // joins
  unit?: Pick<FpeTemplateUnit, 'id' | 'nombre' | 'chapter_id'>
}

// ── Project Layer ─────────────────────────────────────────────────────────────

export interface FpeProject {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  ciudad: string | null
  linked_proyecto_id: string | null
  status: FpeProjectStatus
  readiness_score: number
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  project_units?: FpeProjectUnit[]
  tenders?: FpeTender[]
}

export interface FpeProjectUnit {
  id: string
  project_id: string
  template_unit_id: string
  notas: string | null
  orden: number
  created_at: string
  // joins
  template_unit?: FpeTemplateUnit & {
    chapter?: Pick<FpeTemplateChapter, 'id' | 'nombre'>
  }
  line_items?: FpeProjectLineItem[]
}

export interface FpeProjectLineItem {
  id: string
  project_unit_id: string
  template_line_item_id: string
  cantidad: number
  notas: string | null
  created_at: string
  updated_at: string
  // joins
  template_line_item?: FpeTemplateLineItem
}

export interface FpeDocument {
  id: string
  project_id: string
  project_unit_id: string | null   // null = general project document
  nombre: string
  storage_path: string             // path inside 'fpe-documents' bucket
  mime_type: string | null
  size_bytes: number | null
  discipline_tags: string[]
  uploaded_by: string | null
  created_at: string
}

// ── Tender Layer ──────────────────────────────────────────────────────────────

export interface FpeTender {
  id: string
  project_id: string
  descripcion: string | null
  fecha_limite: string
  status: FpeTenderStatus
  launched_at: string | null
  closed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  project?: Pick<FpeProject, 'id' | 'nombre'>
  invitations?: FpeTenderInvitation[]
}

export interface FpeTenderInvitation {
  id: string
  tender_id: string
  partner_id: string
  token: string
  token_expires_at: string
  scope_unit_ids: string[]         // fpe_project_unit.id list
  status: FpeInvitationStatus
  sent_at: string | null
  viewed_at: string | null
  bid_submitted_at: string | null
  revoked_at: string | null
  created_at: string
  // joins
  partner?: Pick<FpePartner, 'id' | 'nombre' | 'email_notificaciones' | 'email_contacto'>
  bid?: FpeBid
}

export interface FpeBid {
  id: string
  invitation_id: string
  notas: string | null
  status: FpeBidStatus
  submitted_at: string | null
  created_at: string
  updated_at: string
  // joins
  line_items?: FpeBidLineItem[]
  phase_durations?: FpeBidPhaseDuration[]
}

export interface FpeBidLineItem {
  id: string
  bid_id: string
  project_line_item_id: string
  precio_unitario: number
  notas: string | null
  created_at: string
  // joins
  project_line_item?: FpeProjectLineItem & {
    template_line_item?: FpeTemplateLineItem
  }
}

export interface FpeBidPhaseDuration {
  id: string
  bid_id: string
  project_unit_id: string
  template_phase_id: string
  duracion_dias: number
  notas: string | null
  created_at: string
  // joins
  template_phase?: FpeTemplatePhase
}

export interface FpeQaQuestion {
  id: string
  invitation_id: string
  project_unit_id: string | null
  texto: string
  created_at: string
  // joins
  answer?: FpeQaAnswer
}

export interface FpeQaAnswer {
  id: string
  question_id: string
  texto: string
  publicar_a_todos: boolean
  answered_by: string | null
  created_at: string
}

// ── Award & Contract ──────────────────────────────────────────────────────────

export interface FpeAward {
  id: string
  tender_id: string
  partner_id: string
  bid_id: string
  notas: string | null
  awarded_by: string | null
  awarded_at: string
  created_at: string
  // joins
  partner?: Pick<FpePartner, 'id' | 'nombre' | 'razon_social'>
  bid?: FpeBid
}

export interface FpeContract {
  id: string
  award_id: string
  contenido_json: Record<string, unknown>
  docusign_envelope_id: string | null
  status: FpeContractStatus
  sent_at: string | null
  signed_at: string | null
  created_at: string
  updated_at: string
}

// ── Input / DTO Types (Server Actions + Route Handlers) ───────────────────────

export interface CreateFpeProjectInput {
  nombre: string
  descripcion?: string
  direccion?: string
  ciudad?: string
  linked_proyecto_id?: string
}

export interface UpdateFpeProjectInput {
  nombre?: string
  descripcion?: string
  direccion?: string
  ciudad?: string
  linked_proyecto_id?: string
  status?: FpeProjectStatus
}

export interface CreateFpePartnerInput {
  nombre: string
  razon_social?: string
  nif_cif?: string
  contacto_nombre?: string
  email_contacto?: string
  email_notificaciones?: string
  email_facturacion?: string
  telefono?: string
  direccion?: string
  ciudad?: string
  codigo_postal?: string
  pais?: string
  iban?: string
  notas?: string
  capability_unit_ids?: string[]
}

export interface UpsertProjectUnitInput {
  project_id: string
  template_unit_id: string
  notas?: string
  orden?: number
}

export interface UpsertProjectLineItemInput {
  project_unit_id: string
  template_line_item_id: string
  cantidad: number
  notas?: string
}

export interface CreateTenderInput {
  project_id: string
  descripcion?: string
  fecha_limite: string
}

export interface CreateInvitationInput {
  tender_id: string
  partner_id: string
  scope_unit_ids: string[]
  token_expires_hours?: number   // default: 48
}

export interface SubmitBidInput {
  invitation_token: string       // HMAC token from URL
  notas?: string
  line_items: {
    project_line_item_id: string
    precio_unitario: number
    notas?: string
  }[]
  phase_durations: {
    project_unit_id: string
    template_phase_id: string
    duracion_dias: number
    notas?: string
  }[]
}

export interface SubmitQaQuestionInput {
  invitation_token: string
  project_unit_id?: string
  texto: string
}

// ── Tender Readiness ──────────────────────────────────────────────────────────

export interface FpeTenderReadinessResult {
  score: number             // 0–100
  can_launch: boolean       // all blocking checks must pass
  checks: FpeTenderReadinessCheck[]
}

export interface FpeTenderReadinessCheck {
  key: string
  label: string
  passed: boolean
  blocking: boolean         // if true and !passed → cannot launch
  detail?: string
}

// ── UI helper types ───────────────────────────────────────────────────────────

// Status display metadata
export const FPE_PROJECT_STATUS_LABELS: Record<FpeProjectStatus, string> = {
  borrador:         'Borrador',
  scope_ready:      'Scope listo',
  tender_launched:  'En licitación',
  awarded:          'Adjudicado',
  contracted:       'Contratado',
  archived:         'Archivado',
}

export const FPE_TENDER_STATUS_LABELS: Record<FpeTenderStatus, string> = {
  draft:            'Borrador',
  readiness_check:  'Revisión',
  launched:         'Lanzado',
  closed:           'Cerrado',
  cancelled:        'Cancelado',
}

export const FPE_INVITATION_STATUS_LABELS: Record<FpeInvitationStatus, string> = {
  pending:          'Pendiente',
  sent:             'Enviado',
  viewed:           'Visto',
  bid_submitted:    'Oferta recibida',
  expired:          'Expirado',
  revoked:          'Revocado',
}

export const FPE_BID_STATUS_LABELS: Record<FpeBidStatus, string> = {
  draft:     'Borrador',
  submitted: 'Enviada',
  accepted:  'Aceptada',
  rejected:  'Rechazada',
}

export const FPE_CONTRACT_STATUS_LABELS: Record<FpeContractStatus, string> = {
  draft:         'Borrador',
  sent_to_sign:  'Enviado a firma',
  signed:        'Firmado',
  cancelled:     'Cancelado',
}

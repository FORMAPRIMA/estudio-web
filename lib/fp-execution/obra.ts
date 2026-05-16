// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Gestión de Obra — tipos compartidos
//
// Tipos del módulo de gestión de obra (post-adjudicación). Espejan el shape de
// las tablas fpe_obra_* y se importan tanto desde server actions como desde
// componentes de cliente.
// ══════════════════════════════════════════════════════════════════════════════

export type ObraPhaseStatus = 'pendiente' | 'en_curso' | 'completada' | 'bloqueada'

export interface ObraPhase {
  id:                    string
  project_id:            string
  template_phase_id:     string | null
  chapter_id:            string | null
  nombre:                string
  orden:                 number
  duracion_pct:          number | null
  achieves:              string[]
  requires:              string[]
  partner_ids:           string[]
  planned_start_date:    string | null
  planned_end_date:      string | null
  planned_duration_dias: number | null
  actual_start_date:     string | null
  actual_end_date:       string | null
  actual_duration_dias:  number | null
  pct_avance:            number
  status:                ObraPhaseStatus
  notas:                 string | null
}

export interface ObraMilestone {
  id:                     string
  project_id:             string
  template_milestone_id:  string | null
  nombre:                 string
  orden:                  number
  es_hito_pago:           boolean
  planned_date:           string | null
  actual_date:            string | null
  achieved_at:            string | null
  achieved_by:            string | null
  notas:                  string | null
}

// Mirror del JSONB guardado en fpe_projects.obra_baseline_snapshot.
// Mantener en sync con ObraBaselineSnapshot de app/actions/fpe-obra.ts.
export interface ObraBaselineSnapshot {
  generated_at:    string
  fecha_inicio:    string | null
  m2:              number | null
  duracion_factor: number
  total_days:      number
  chapter_days:    Record<string, number>
  phases: Array<{
    template_phase_id: string
    chapter_id:        string
    nombre:            string
    orden:             number
    duracion_pct:      number
    achieves:          string[]
    requires:          string[]
    partner_ids:       string[]
    start_date:        string
    end_date:          string
    duration_dias:     number
    source:            'awarded' | 'parametric'
  }>
  milestones: Array<{
    template_milestone_id: string
    nombre:                string
    orden:                 number
    es_hito_pago:          boolean
    planned_date:          string | null
  }>
  units: Array<{
    project_unit_id:  string
    template_unit_id: string
    chapter_id:       string
    nombre:           string
    partner_id:       string | null
  }>
}

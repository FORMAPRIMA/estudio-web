// ── Public / shared types ────────────────────────────────────────────────

export interface Proyecto {
  id: string
  nombre: string
  ubicacion: string
  año: number
  tipologia: string
  descripcion: string
  slug: string
  estado: 'activo' | 'finalizado' | 'en_construccion'
  cliente_id: string
  imagen_principal?: string
}

export interface Cliente {
  id: string
  nombre: string
  email: string
  empresa?: string
  telefono?: string
}

export interface Tarea {
  id: string
  titulo: string
  descripcion?: string
  proyecto_id: string
  asignado_a: string
  estado: 'pendiente' | 'en_progreso' | 'completada'
  fecha_limite?: string
}

export interface Documento {
  id: string
  nombre: string
  url: string
  proyecto_id: string
  subido_por: string
  fecha: string
}

export interface Evento {
  id: string
  titulo: string
  fecha: string
  descripcion?: string
  proyecto_id?: string
}

export interface Propiedad {
  id: string
  nombre: string
  ubicacion: string
  precio: number
  descripcion: string
  slug: string
  imagenes: string[]
  disponible: boolean
}

export interface Lead {
  id: string
  nombre: string
  email: string
  telefono?: string
  propiedad_id: string
  mensaje?: string
  fecha: string
}

// ── User / role types ────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  nombre: string
  email: string
  rol: 'cliente' | 'fp_team' | 'fp_manager' | 'fp_partner'
  avatar_url?: string | null
}

export type FpRole = 'fp_team' | 'fp_manager' | 'fp_partner'
export const FP_ROLES: FpRole[] = ['fp_team', 'fp_manager', 'fp_partner']
export const isFpRole = (rol: string): rol is FpRole => FP_ROLES.includes(rol as FpRole)

// ── Proyectos module types ────────────────────────────────────────────────

export type ProyectoStatus = 'activo' | 'on_hold' | 'terminado' | 'archivado'
export type NivelCalidad = 'master_piece' | 'select' | 'functional'

export interface ProyectoInterno {
  id: string
  nombre: string
  codigo: string | null
  direccion: string | null
  imagen_url: string | null
  superficie_diseno: number | null
  superficie_catastral: number | null
  superficie_util: number | null
  cliente_id: string | null
  constructor_id: string | null
  status: ProyectoStatus
  nivel_calidad: NivelCalidad | null
  created_by: string | null
  created_at: string
  // documentation
  renders: { url: string; nombre: string }[] | null
  planos_pdf_url: string | null
  // joined
  clientes?: { id: string; nombre: string } | null
  proyecto_fases?: ProyectoFase[]
}

export interface CatalogoFase {
  id: string
  numero: number
  label: string
  seccion: string
  orden: number
  ratio?: number | null
}

export interface ProyectoFase {
  id: string
  proyecto_id: string
  fase_id: string
  responsables: string[]
  status: 'pendiente' | 'en_progreso' | 'completada' | 'bloqueada'
  horas_objetivo?: number | null
  fase_status?: 'en_espera' | 'iniciada'
  // joined
  catalogo_fases?: CatalogoFase | null
}

export interface PlantillaTask {
  id: string
  fase_id: string
  titulo: string
  descripcion: string | null
  orden: number
  created_at: string
}

export type TaskStatus = 'pendiente' | 'en_progreso' | 'completado' | 'bloqueado'

export interface Task {
  id: string
  codigo: string
  titulo: string
  descripcion: string | null
  proyecto_id: string
  fase_id: string
  responsable_ids: string[]
  status: TaskStatus
  orden_urgencia: number
  prioridad: number
  fecha_limite: string | null
  created_at: string
  // joined
  catalogo_fases?: CatalogoFase | null
}

// ── Time tracker types (legacy — keep for TimeTracker component) ──────────

export interface TimeEntry {
  id: string
  user_id: string
  fecha: string
  hora_inicio: number
  horas: number
  proyecto_id?: string
  fase_id?: string
  categoria_interna?: string
  es_extra: boolean
  notas?: string
}

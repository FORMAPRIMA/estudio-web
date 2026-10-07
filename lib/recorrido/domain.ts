// Recorrido del Open House de Claudio Coello 38 — tipos y catálogos.
// Lo comparten la captura del equipo, el guía y el móvil del invitado.

export const EVENTO_RC = 'cc38'

export interface RcFoto {
  id: string
  detalle_id: string
  url: string
  w: number | null
  h: number | null
  orden: number
}

/** Detalle tal como lo ve el equipo (con notas del guía). */
export interface RcDetalle {
  id: string
  x: number
  y: number
  titulo: string
  estancia: string | null
  categoria: string | null
  texto: string | null
  notas_guia: string | null
  destacado: boolean
  orden: number
  autor_nombre: string | null
  created_at: string
  updated_at: string
  fotos: RcFoto[]
}

/** Lo que llega al móvil del invitado: nunca lleva notas del guía ni autoría. */
export type RcDetallePublico = Omit<RcDetalle, 'notas_guia' | 'autor_nombre' | 'created_at' | 'updated_at'>

export interface RcPlano {
  url: string
  w: number
  h: number
}

export type RcModo = 'inicio' | 'video' | 'recorrido' | 'pregunta' | 'fin'

export interface RcVisita {
  id: string
  slot: string | null
  guia_nombre: string | null
  modo: RcModo
  paso: number
  detalle_id: string | null
  started_at: string
  updated_at: string
  ended_at: string | null
}

/** Estado del directo que viaja por el canal (y se guarda en rc_visitas). */
export interface RcEstado {
  modo: RcModo
  paso: number
  detalle_id: string | null
  /** Foto visible dentro del detalle (solo viaja por el canal, no se guarda). */
  foto?: number
  /** Epoch ms en que arrancó el vídeo de introducción (sincroniza los móviles). */
  desde?: number
  at: number
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

/** Estancias en el orden natural de la visita (entrada → zona de día → noche). */
export const ESTANCIAS = [
  'Hall de entrada',
  'Salón',
  'Comedor',
  'Family room',
  'Cocina',
  'Lavandería',
  'Dormitorio principal',
  'Vestidor principal',
  'Baño principal',
  'Dormitorio 01',
  'Baño 01',
  'Dormitorio 02',
  'Vestidor 02',
  'Baño 02',
  'Aseo de cortesía',
  'Zona de servicio',
  'Toda la casa',
] as const

export const CATEGORIAS = [
  'Mobiliario',
  'Material',
  'Carpintería',
  'Iluminación',
  'Arte y objetos',
  'Textil',
  'Cocina y baño',
  'Detalle constructivo',
  'Instalaciones',
  'Historia de la casa',
] as const

// ─── Recorrido ────────────────────────────────────────────────────────────────

/** Los destacados, en el orden del recorrido. */
export function recorridoDe<T extends { destacado: boolean; orden: number; created_at?: string }>(ds: T[]): T[] {
  return ds
    .filter((d) => d.destacado)
    .sort((a, b) => a.orden - b.orden || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

/** Tramos consecutivos de la misma estancia: las barras de progreso se agrupan así. */
export function capitulosDe<T extends { estancia: string | null }>(ds: T[]): { estancia: string; desde: number; hasta: number }[] {
  const out: { estancia: string; desde: number; hasta: number }[] = []
  ds.forEach((d, i) => {
    const e = d.estancia || 'Detalles'
    const ult = out[out.length - 1]
    if (ult && ult.estancia === e) ult.hasta = i
    else out.push({ estancia: e, desde: i, hasta: i })
  })
  return out
}

export function rangoEstancia(e: string | null): number {
  const i = ESTANCIAS.indexOf((e ?? '') as (typeof ESTANCIAS)[number])
  return i < 0 ? ESTANCIAS.length : i
}

export function aPublico(d: RcDetalle): RcDetallePublico {
  // Lista blanca explícita: si mañana se añade un campo interno, no se cuela solo.
  return {
    id: d.id, x: d.x, y: d.y, titulo: d.titulo, estancia: d.estancia, categoria: d.categoria,
    texto: d.texto, destacado: d.destacado, orden: d.orden, fotos: d.fotos,
  }
}

export function nombrePila(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] || ''
}

// ─── Horarios (Europe/Madrid) ─────────────────────────────────────────────────

export const FECHA_EVENTO = '2026-10-08'

/** Epoch ms de una hora "HH:MM" del día del evento en Madrid (8 oct = CEST, UTC+2). */
export function horaEvento(hhmm: string): number {
  return Date.parse(`${FECHA_EVENTO}T${hhmm}:00+02:00`)
}

export function slotAHora(slot: string): string {
  return `${slot.slice(0, 2)}:${slot.slice(2)}`
}

/** Margen antes del turno en que el QR ya enseña la bienvenida. */
export const ANTES_MIN = 20
/** Tras el final del turno se sigue considerando "en la visita" (las visitas se alargan). */
export const DESPUES_MIN = 40

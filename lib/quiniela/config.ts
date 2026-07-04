// ── La Porra del Mundial — configuración y sistema de puntos ──────────────────

export type QuinielaFase =
  | 'grupos'
  | 'dieciseisavos'
  | 'octavos'
  | 'cuartos'
  | 'semifinal'
  | 'tercer_puesto'
  | 'final'

export type VentanaCampeon = 'apertura' | 'grupos' | 'dieciseisavos' | 'octavos' | 'cuartos'

export interface QuinielaEquipo {
  id: string
  codigo: string
  nombre: string
  bandera: string
  grupo: string
}

export interface QuinielaPartido {
  id: string
  numero: number
  fase: QuinielaFase
  grupo: string | null
  etiqueta_local: string | null
  etiqueta_visitante: string | null
  equipo_local_id: string | null
  equipo_visitante_id: string | null
  fecha_hora: string
  ciudad: string | null
  goles_local: number | null
  goles_visitante: number | null
  equipo_que_pasa_id: string | null
  estado: 'programado' | 'finalizado'
}

export interface QuinielaPrediccion {
  id: string
  jugador_id: string
  partido_id: string
  goles_local: number
  goles_visitante: number
  equipo_que_pasa_id: string | null
  puntos: number | null
}

export interface QuinielaPickCampeon {
  id: string
  jugador_id: string
  ventana: VentanaCampeon
  equipo_id: string
}

export interface QuinielaComentario {
  id: string
  jugador_id: string
  parent_id: string | null
  texto: string
  created_at: string
}

export interface QuinielaReaccion {
  id: string
  comentario_id: string
  jugador_id: string
  emoji: string
}

export const CHAT_EMOJIS = ['⚽', '🔥', '😂', '👏', '😭', '🍺']

// ── La Bolsa (mini-apuestas) ─────────────────────────────────────────────────

export interface QuinielaMercadoOpcion {
  key: string
  label: string
  mult: number
}

export interface QuinielaMercado {
  id: string
  partido_id: string
  pregunta: string
  subtitulo: string | null
  opciones: QuinielaMercadoOpcion[]
  estado: 'abierto' | 'cerrado' | 'liquidado'
  opcion_ganadora: string | null
  auto: boolean
  regla: string | null
}

export interface QuinielaApuesta {
  id: string
  jugador_id: string
  mercado_id: string
  opcion: string
  fichas: number
  payout: number | null
}

/** Importe fijo por apuesta si no hay config `bolsa_stake`. */
export const BOLSA_STAKE_DEFAULT = 5

/** Premio bruto devuelto al acertar (incluye lo apostado). Redondeo al entero. */
export function calcPayout(fichas: number, mult: number): number {
  return Math.round(fichas * mult)
}

export interface QuinielaJugador {
  id: string
  nombre: string
  pagado: boolean
  pichichi: string | null
  user_id: string | null   // vinculado a profiles solo para staff FP; null para externos
}

// Puntos por partido. El exacto INCLUYE el acierto de resultado (no se suman).
export const PUNTOS_PARTIDO: Record<QuinielaFase, { resultado: number; exacto: number }> = {
  grupos:        { resultado: 2, exacto: 5 },
  dieciseisavos: { resultado: 3, exacto: 7 },
  octavos:       { resultado: 3, exacto: 7 },
  cuartos:       { resultado: 4, exacto: 9 },
  semifinal:     { resultado: 5, exacto: 11 },
  tercer_puesto: { resultado: 6, exacto: 13 },
  final:         { resultado: 6, exacto: 13 },
}

// Escalera del campeón: cada ventana es un pick independiente y acumulable.
export const PUNTOS_ESCALERA: Record<VentanaCampeon, number> = {
  apertura:      60,
  grupos:        40,
  dieciseisavos: 28,
  octavos:       18,
  cuartos:       10,
}

export const PUNTOS_PICHICHI = 15

// Escalera del pichichi: como la del campeón, un pick por ventana, en paralelo
// y acumulable, con puntos decrecientes. Se frena en cuartos (no hay ventana
// más allá: en semis/final ya sería demasiado fácil acertar).
export const PUNTOS_PICHICHI_ESCALERA: Record<VentanaCampeon, number> = {
  apertura:      15,
  grupos:        10,
  dieciseisavos: 7,
  octavos:       4,
  cuartos:       2,
}

export interface QuinielaPickPichichi {
  id: string
  jugador_id: string
  ventana: VentanaCampeon
  nombre: string
}

// Las predicciones se cierran 1 hora antes del kickoff
export const BLOQUEO_PREDICCION_MS = 60 * 60 * 1000

export function prediccionBloqueada(fechaHoraIso: string, ahoraMs?: number): boolean {
  return (ahoraMs ?? Date.now()) >= new Date(fechaHoraIso).getTime() - BLOQUEO_PREDICCION_MS
}

/**
 * Cierre de los picks iniciales (campeón de apertura + pichichi).
 * Usa `apertura_deadline` de config; si no existe, el kickoff del primer partido.
 */
export function getAperturaDeadlineMs(
  config: Record<string, string | null>,
  partidos: { fecha_hora: string }[]
): number | null {
  const v = config['apertura_deadline']
  if (v) {
    const t = new Date(v).getTime()
    if (!isNaN(t)) return t
  }
  return partidos.length ? new Date(partidos[0].fecha_hora).getTime() : null
}

/** "2d 4h", "3h 12m", "42 min" — para countdowns de cierre */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'cerrado'
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(m, 1)} min`
}

export const VENTANA_LABELS: Record<VentanaCampeon, string> = {
  apertura:      'Antes del Mundial',
  grupos:        'Tras fase de grupos',
  dieciseisavos: 'Tras dieciseisavos',
  octavos:       'Tras octavos',
  cuartos:       'Tras cuartos',
}

// Ventana → fase cuyos partidos definen los equipos elegibles (null = todos)
export const VENTANA_FASE_ELEGIBLE: Record<VentanaCampeon, QuinielaFase | null> = {
  apertura:      null,
  grupos:        'dieciseisavos',
  dieciseisavos: 'octavos',
  octavos:       'cuartos',
  cuartos:       'semifinal',
}

export const FASE_LABELS: Record<QuinielaFase, string> = {
  grupos:        'Fase de grupos',
  dieciseisavos: 'Dieciseisavos',
  octavos:       'Octavos',
  cuartos:       'Cuartos',
  semifinal:     'Semifinales',
  tercer_puesto: '3er puesto',
  final:         'Final',
}

export const FASES_ORDEN: QuinielaFase[] = [
  'grupos', 'dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final',
]

// ── Scoring ────────────────────────────────────────────────────────────────────

/**
 * Quién pasa según una predicción/resultado: el de más goles, o el
 * equipo_que_pasa explícito si hay empate (eliminatorias, penaltis).
 */
function ganadorDe(
  golesLocal: number,
  golesVisitante: number,
  localId: string | null,
  visitanteId: string | null,
  quePasaId: string | null
): string | null {
  if (golesLocal > golesVisitante) return localId
  if (golesVisitante > golesLocal) return visitanteId
  return quePasaId
}

/**
 * Calcula los puntos de una predicción contra el resultado real de un partido.
 * - Marcador exacto → puntos de exacto (en eliminatorias requiere además acertar
 *   quién pasa si el marcador fue empate).
 * - Resultado (1X2 en grupos / quién pasa en eliminatorias) → puntos de resultado.
 */
export function calcPuntosPrediccion(
  partido: Pick<QuinielaPartido,
    'fase' | 'goles_local' | 'goles_visitante' | 'equipo_local_id' | 'equipo_visitante_id' | 'equipo_que_pasa_id'>,
  prediccion: Pick<QuinielaPrediccion, 'goles_local' | 'goles_visitante' | 'equipo_que_pasa_id'>
): number {
  if (partido.goles_local == null || partido.goles_visitante == null) return 0
  const puntos = PUNTOS_PARTIDO[partido.fase]
  const exacto =
    prediccion.goles_local === partido.goles_local &&
    prediccion.goles_visitante === partido.goles_visitante

  if (partido.fase === 'grupos') {
    if (exacto) return puntos.exacto
    const signoPred = Math.sign(prediccion.goles_local - prediccion.goles_visitante)
    const signoReal = Math.sign(partido.goles_local - partido.goles_visitante)
    return signoPred === signoReal ? puntos.resultado : 0
  }

  // Eliminatorias: el resultado es quién pasa de ronda
  const pasaPred = ganadorDe(
    prediccion.goles_local, prediccion.goles_visitante,
    partido.equipo_local_id, partido.equipo_visitante_id, prediccion.equipo_que_pasa_id
  )
  const pasaReal = ganadorDe(
    partido.goles_local, partido.goles_visitante,
    partido.equipo_local_id, partido.equipo_visitante_id, partido.equipo_que_pasa_id
  )
  const aciertaPase = pasaPred != null && pasaPred === pasaReal
  if (exacto && aciertaPase) return puntos.exacto
  return aciertaPase ? puntos.resultado : 0
}

/** Reparto del bote: [70, 20, 10] (%) */
export function parseReparto(value: string | null): number[] {
  const parts = (value || '70/20/10').split('/').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
  return parts.length ? parts : [70, 20, 10]
}

export function formatFechaPartido(fechaIso: string): { dia: string; hora: string } {
  const d = new Date(fechaIso)
  return {
    dia: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }),
    hora: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }),
  }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Tipos ───────────────────────────────────────────────────────────────────

export type TipoEvento    = 'vacaciones' | 'teletrabajo' | 'hito'
export type AlcanceEvento  = 'personal' | 'equipo'
export type AmbitoFestivo  = 'nacional' | 'autonomico' | 'local'

export interface CalendarioEvento {
  id:              string
  user_id:         string | null
  tipo:            TipoEvento
  alcance:         AlcanceEvento
  titulo:          string | null
  fecha_inicio:    string
  fecha_fin:       string
  nota:            string | null
  visto_bueno:     boolean
  visto_bueno_por: string | null
  autor_nombre:    string
}

export interface CalendarioFestivo {
  id:     string
  fecha:  string
  nombre: string
  ambito: AmbitoFestivo
}

export interface CalendarioMiembro {
  id:         string
  nombre:     string
  avatar_url: string | null
}

export interface CalendarioData {
  eventos:       CalendarioEvento[]
  festivos:      CalendarioFestivo[]
  miembros:      CalendarioMiembro[]
  currentUserId: string
  isPartner:     boolean
}

type ActionResult = { success: true } | { error: string }

// ── Auth ──────────────────────────────────────────────────────────────────────

async function requireFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('id, rol, nombre').eq('id', user.id).single()
  if (!profile || !['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'].includes(profile.rol))
    throw new Error('Sin permisos.')
  return { userId: user.id as string, rol: profile.rol as string, nombre: (profile.nombre as string) ?? '' }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10)

function fmtRango(inicio: string, fin: string) {
  const f = (s: string) => {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y.slice(2)}`
  }
  return inicio === fin ? f(inicio) : `${f(inicio)} – ${f(fin)}`
}

const DIAS_CORTOS  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtRangoLargo(inicio: string, fin: string) {
  const f = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
  }
  return inicio === fin ? f(inicio) : `${f(inicio)} – ${f(fin)}`
}

/** Cuenta días hábiles (lun–vie excluyendo festivos cargados de BD). */
async function contarDiasHabiles(
  admin: ReturnType<typeof createAdminClient>,
  inicio: string, fin: string,
): Promise<number> {
  const { data: festivos } = await admin
    .from('calendario_festivos').select('fecha')
    .gte('fecha', inicio).lte('fecha', fin)
  const festivoSet = new Set((festivos ?? []).map((f: any) => f.fecha))
  let count = 0
  const cur = new Date(inicio + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6 && !festivoSet.has(iso(cur))) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/** Aviso a los socios cuando alguien solicita vacaciones. */
async function avisarSociosVacaciones(
  admin: ReturnType<typeof createAdminClient>,
  nombre: string, inicio: string, fin: string,
) {
  const today = iso(new Date())
  const dias = await contarDiasHabiles(admin, inicio, fin)
  const plural = dias === 1 ? '' : 's'
  const { error } = await admin.from('avisos').insert({
    tipo: 'equipo', autor_id: null,
    titulo:   `Vacaciones por aprobar · ${nombre}`,
    contenido: `${nombre} solicita ${dias} día${plural} hábil${plural === '' ? '' : 'es'} de vacaciones · ${fmtRangoLargo(inicio, fin)}. Da el visto bueno en el calendario del equipo para que sean visibles.`,
    nivel:    'importante',
    fecha_activa:  today,
    visible_roles: ['fp_partner'],
  })
  if (error) console.error('[calendario] avisarSocios:', error.message)
}

/** Aviso al solicitante cuando un socio aprueba sus vacaciones. */
async function avisarVacacionesAprobadas(
  admin: ReturnType<typeof createAdminClient>,
  destinatarioId: string, inicio: string, fin: string,
) {
  const today = iso(new Date())
  const { error } = await admin.from('avisos').insert({
    tipo: 'equipo', autor_id: null,
    titulo:   'Vacaciones aprobadas',
    contenido: `Tus vacaciones (${fmtRango(inicio, fin)}) han recibido el visto bueno y ya son visibles para el equipo.`,
    nivel:    'informativo',
    fecha_activa:    today,
    destinatario_id: destinatarioId,
  })
  if (error) console.error('[calendario] avisarAprobadas:', error.message)
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Devuelve eventos del mes (con margen) + festivos del año + equipo. `month` es 1–12. */
export async function getCalendarioData(year: number, month: number): Promise<CalendarioData> {
  const { userId, rol } = await requireFP()
  const isPartner = rol === 'fp_partner'
  const admin = createAdminClient()

  // Ventana del mes visible ± 7 días (la rejilla muestra días colindantes)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const last  = new Date(Date.UTC(year, month, 0))
  const wStart = new Date(first); wStart.setUTCDate(wStart.getUTCDate() - 7)
  const wEnd   = new Date(last);  wEnd.setUTCDate(wEnd.getUTCDate() + 7)

  const [{ data: eventosRaw }, { data: festivosRaw }, { data: miembrosRaw }] = await Promise.all([
    admin
      .from('calendario_eventos')
      .select('id, user_id, tipo, alcance, titulo, fecha_inicio, fecha_fin, nota, visto_bueno, visto_bueno_por')
      .lte('fecha_inicio', iso(wEnd))
      .gte('fecha_fin', iso(wStart)),
    admin
      .from('calendario_festivos')
      .select('id, fecha, nombre, ambito')
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)
      .order('fecha'),
    admin
      .from('profiles')
      .select('id, nombre, avatar_url')
      .neq('rol', 'cliente')
      .order('nombre'),
  ])

  const miembros: CalendarioMiembro[] = (miembrosRaw ?? []).map((m: any) => ({
    id: m.id, nombre: m.nombre ?? '—', avatar_url: m.avatar_url ?? null,
  }))
  const nombreDe = (id: string | null) =>
    miembros.find(m => m.id === id)?.nombre ?? '—'

  const eventos: CalendarioEvento[] = (eventosRaw ?? [])
    // Vacaciones pendientes de visto bueno: solo visibles para su autor o para socios.
    .filter((e: any) =>
      e.tipo !== 'vacaciones' || e.visto_bueno || isPartner || e.user_id === userId)
    .map((e: any) => ({
      id:              e.id,
      user_id:         e.user_id,
      tipo:            e.tipo,
      alcance:         e.alcance,
      titulo:          e.titulo ?? null,
      fecha_inicio:    e.fecha_inicio,
      fecha_fin:       e.fecha_fin,
      nota:            e.nota ?? null,
      visto_bueno:     e.visto_bueno,
      visto_bueno_por: e.visto_bueno_por ?? null,
      autor_nombre:    nombreDe(e.user_id),
    }))

  const festivos: CalendarioFestivo[] = (festivosRaw ?? []).map((f: any) => ({
    id: f.id, fecha: f.fecha, nombre: f.nombre, ambito: f.ambito,
  }))

  return { eventos, festivos, miembros, currentUserId: userId, isPartner }
}

// ── Write: eventos ──────────────────────────────────────────────────────────

export async function createEventoCalendario(input: {
  tipo:         TipoEvento
  alcance?:     AlcanceEvento
  titulo?:      string
  fecha_inicio: string
  fecha_fin:    string
  nota?:        string
}): Promise<ActionResult> {
  try {
    const { userId, nombre } = await requireFP()

    const { tipo, fecha_inicio, fecha_fin } = input
    if (!fecha_inicio || !fecha_fin) return { error: 'Faltan las fechas.' }
    if (fecha_fin < fecha_inicio)    return { error: 'La fecha de fin no puede ser anterior al inicio.' }

    const esHito  = tipo === 'hito'
    const titulo  = esHito ? (input.titulo ?? '').trim() : null
    const alcance: AlcanceEvento = esHito ? (input.alcance ?? 'personal') : 'personal'
    if (esHito && !titulo) return { error: 'El hito necesita un título.' }

    const admin = createAdminClient()
    const { error } = await admin.from('calendario_eventos').insert({
      user_id:      userId,
      tipo,
      alcance,
      titulo,
      fecha_inicio,
      fecha_fin,
      nota:         input.nota?.trim() || null,
      visto_bueno:  false,
    })
    if (error) return { error: error.message }

    if (tipo === 'vacaciones') {
      await avisarSociosVacaciones(admin, nombre, fecha_inicio, fecha_fin)
    }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteEventoCalendario(id: string): Promise<ActionResult> {
  try {
    const { userId, rol } = await requireFP()
    const admin = createAdminClient()

    const { data: evento } = await admin
      .from('calendario_eventos').select('user_id').eq('id', id).single()
    if (!evento) return { error: 'El evento ya no existe.' }
    if (evento.user_id !== userId && rol !== 'fp_partner')
      return { error: 'Solo puedes borrar tus propios eventos.' }

    const { error } = await admin.from('calendario_eventos').delete().eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Visto bueno de un socio sobre unas vacaciones → pasan a visibles para todos. */
export async function marcarVistoBueno(id: string): Promise<ActionResult> {
  try {
    const { userId, rol } = await requireFP()
    if (rol !== 'fp_partner') return { error: 'Solo un socio puede dar el visto bueno.' }
    const admin = createAdminClient()

    const { data: evento } = await admin
      .from('calendario_eventos')
      .select('user_id, tipo, fecha_inicio, fecha_fin, visto_bueno')
      .eq('id', id).single()
    if (!evento) return { error: 'El evento ya no existe.' }

    const { error } = await admin
      .from('calendario_eventos')
      .update({ visto_bueno: true, visto_bueno_por: userId })
      .eq('id', id)
    if (error) return { error: error.message }

    if (evento.tipo === 'vacaciones' && !evento.visto_bueno && evento.user_id) {
      await avisarVacacionesAprobadas(admin, evento.user_id, evento.fecha_inicio, evento.fecha_fin)
    }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Write: festivos (solo socios) ─────────────────────────────────────────────

export async function createFestivo(input: {
  fecha: string; nombre: string; ambito?: AmbitoFestivo
}): Promise<ActionResult> {
  try {
    const { rol } = await requireFP()
    if (rol !== 'fp_partner') return { error: 'Solo un socio puede editar festivos.' }
    if (!input.fecha || !input.nombre?.trim()) return { error: 'Faltan datos del festivo.' }

    const admin = createAdminClient()
    const { error } = await admin.from('calendario_festivos').upsert({
      fecha:  input.fecha,
      nombre: input.nombre.trim(),
      ambito: input.ambito ?? 'local',
    }, { onConflict: 'fecha' })
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteFestivo(id: string): Promise<ActionResult> {
  try {
    const { rol } = await requireFP()
    if (rol !== 'fp_partner') return { error: 'Solo un socio puede editar festivos.' }
    const admin = createAdminClient()
    const { error } = await admin.from('calendario_festivos').delete().eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

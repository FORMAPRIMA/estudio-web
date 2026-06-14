'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import {
  hashPin, verifyPin, isValidPin,
  setJugadorCookie, clearJugadorCookie, getJugadorIdFromCookie,
} from '@/lib/quiniela/auth'
import {
  prediccionBloqueada,
  getAperturaDeadlineMs,
  PUNTOS_ESCALERA,
  PUNTOS_PICHICHI,
  VENTANA_FASE_ELEGIBLE,
} from '@/lib/quiniela/config'
import { CHAT_EMOJIS } from '@/lib/quiniela/config'
import { finalizarPartido } from '@/lib/quiniela/finalize'
import type {
  QuinielaEquipo,
  QuinielaPartido,
  QuinielaPrediccion,
  QuinielaPickCampeon,
  QuinielaJugador,
  QuinielaComentario,
  QuinielaReaccion,
  VentanaCampeon,
} from '@/lib/quiniela/config'

const PATH_TEAM = '/team/apps/quiniela'
const PATH_PUBLIC = '/quiniela'

function revalidateQuiniela() {
  revalidatePath(PATH_TEAM)
  revalidatePath(PATH_PUBLIC)
}

// ── Identidad: sesión FP (Supabase) o jugador externo (cookie firmada) ───────

async function getSesionFP(): Promise<{ userId: string; nombre: string; esPartner: boolean } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('rol, nombre').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) return null
  return { userId: user.id, nombre: profile.nombre || 'Sin nombre', esPartner: profile.rol === 'fp_partner' }
}

/** Jugador actual: staff FP por su sesión, o externo por cookie. */
async function getJugadorActual(
  admin: ReturnType<typeof createAdminClient>
): Promise<QuinielaJugador | null> {
  const fp = await getSesionFP()
  if (fp) {
    const { data } = await admin
      .from('quiniela_jugadores').select('*').eq('user_id', fp.userId).maybeSingle()
    return (data as QuinielaJugador) ?? null
  }
  const cookieId = getJugadorIdFromCookie()
  if (!cookieId) return null
  const { data } = await admin
    .from('quiniela_jugadores').select('*').eq('id', cookieId).maybeSingle()
  return (data as QuinielaJugador) ?? null
}

async function requirePartner() {
  const fp = await getSesionFP()
  if (!fp?.esPartner) throw new Error('Solo partners pueden administrar la porra.')
  return fp
}

/** Cierre de los picks iniciales: config `apertura_deadline` o, si no, el primer kickoff */
async function getAperturaDeadline(
  admin: ReturnType<typeof createAdminClient>
): Promise<number | null> {
  const { data: cfg } = await admin
    .from('quiniela_config').select('value').eq('key', 'apertura_deadline').maybeSingle()
  if (cfg?.value) {
    const t = new Date(cfg.value).getTime()
    if (!isNaN(t)) return t
  }
  const { data: primero } = await admin
    .from('quiniela_partidos').select('fecha_hora').order('numero').limit(1).maybeSingle()
  return primero ? new Date(primero.fecha_hora).getTime() : null
}

// ── Datos para la página ──────────────────────────────────────────────────────

export interface QuinielaLeaderboardRow {
  jugador_id: string
  nombre: string
  pagado: boolean
  total: number
  puntos_partidos: number
  puntos_escalera: number
  puntos_pichichi: number
  exactos: number
  aciertos_eliminatorias: number
}

export interface QuinielaData {
  equipos: QuinielaEquipo[]
  partidos: QuinielaPartido[]
  jugadores: QuinielaJugador[]
  misPredicciones: QuinielaPrediccion[]
  /** Predicciones de TODOS, solo de partidos ya empezados o finalizados */
  prediccionesReveladas: QuinielaPrediccion[]
  misPicks: QuinielaPickCampeon[]
  /** Picks de campeón de todos, visibles una vez arranca el Mundial */
  picksRevelados: QuinielaPickCampeon[]
  leaderboard: QuinielaLeaderboardRow[]
  config: Record<string, string | null>
  comentarios: QuinielaComentario[]
  reacciones: QuinielaReaccion[]
  /** Marcadores en vivo del cron (id de partido → marcador y minuto) */
  liveScores: Record<string, { gl: number; gv: number; minuto: string }>
  miJugadorId: string | null
  soyParticipante: boolean
  esPartner: boolean
}

export async function getQuinielaData(): Promise<QuinielaData | { error: string }> {
  try {
    const admin = createAdminClient()
    const fp = await getSesionFP()
    const jugador = await getJugadorActual(admin)
    if (!fp && !jugador) return { error: 'SIN_SESION' }

    const [equiposRes, partidosRes, jugadoresRes, prediccionesRes, picksRes, configRes, comentariosRes, reaccionesRes] =
      await Promise.all([
        admin.from('quiniela_equipos').select('*').order('grupo').order('nombre'),
        admin.from('quiniela_partidos').select('*').order('numero'),
        admin.from('quiniela_jugadores').select('*').order('created_at'),
        admin.from('quiniela_predicciones').select('*'),
        admin.from('quiniela_picks_campeon').select('*'),
        admin.from('quiniela_config').select('*'),
        // Chat: tolerante a que las tablas aún no existan (migración pendiente)
        admin.from('quiniela_comentarios').select('*').order('created_at', { ascending: false }).limit(300),
        admin.from('quiniela_reacciones').select('*'),
      ])

    const firstError = equiposRes.error || partidosRes.error || jugadoresRes.error
      || prediccionesRes.error || picksRes.error || configRes.error
    if (firstError) return { error: firstError.message }

    const equipos = (equiposRes.data ?? []) as QuinielaEquipo[]
    const partidos = (partidosRes.data ?? []) as QuinielaPartido[]
    const jugadores = (jugadoresRes.data ?? []) as QuinielaJugador[]
    const predicciones = (prediccionesRes.data ?? []) as QuinielaPrediccion[]
    const picks = (picksRes.data ?? []) as QuinielaPickCampeon[]
    const comentarios = (comentariosRes.error ? [] : comentariosRes.data ?? []) as QuinielaComentario[]
    const reacciones = (reaccionesRes.error ? [] : reaccionesRes.data ?? []) as QuinielaReaccion[]
    const config: Record<string, string | null> = {}
    for (const row of configRes.data ?? []) config[row.key] = row.value

    // Marcadores en vivo (escritos por el cron); se ignoran si tienen más de 15 min
    let liveScores: Record<string, { gl: number; gv: number; minuto: string }> = {}
    try {
      const raw = config['live_scores']
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.ts && Date.now() - new Date(parsed.ts).getTime() < 15 * 60 * 1000) {
          liveScores = parsed.partidos || {}
        }
      }
    } catch { /* JSON corrupto → sin live */ }

    const ahora = Date.now()
    // Las predicciones ajenas se revelan cuando el partido se bloquea (1 h antes del kickoff)
    const bloqueados = new Set(
      partidos
        .filter(p => p.estado === 'finalizado' || prediccionBloqueada(p.fecha_hora, ahora))
        .map(p => p.id)
    )

    const miJugadorId = jugador?.id ?? null
    const misPredicciones = predicciones.filter(p => p.jugador_id === miJugadorId)
    const prediccionesReveladas = predicciones.filter(p => bloqueados.has(p.partido_id))

    const misPicks = picks.filter(p => p.jugador_id === miJugadorId)
    const deadlineApertura = getAperturaDeadlineMs(config, partidos)
    const aperturaAbierta = config['ventana_activa'] === 'apertura'
      && deadlineApertura !== null && ahora < deadlineApertura
    const picksRevelados = aperturaAbierta ? misPicks : picks

    // ── Leaderboard ──
    const campeonId = config['campeon_id']
    const pichichiGanador = (config['pichichi_ganador'] || '').trim().toLowerCase()
    const partidosById = new Map(partidos.map(p => [p.id, p]))

    const leaderboard: QuinielaLeaderboardRow[] = jugadores.map(jug => {
      const prefs = predicciones.filter(p => p.jugador_id === jug.id)
      let puntosPartidos = 0, exactos = 0, aciertosElim = 0
      for (const pred of prefs) {
        if (pred.puntos == null || pred.puntos <= 0) continue
        puntosPartidos += pred.puntos
        const partido = partidosById.get(pred.partido_id)
        if (!partido) continue
        if (pred.goles_local === partido.goles_local && pred.goles_visitante === partido.goles_visitante) exactos++
        if (partido.fase !== 'grupos') aciertosElim++
      }
      let puntosEscalera = 0
      if (campeonId) {
        for (const pick of picks.filter(p => p.jugador_id === jug.id)) {
          if (pick.equipo_id === campeonId) puntosEscalera += PUNTOS_ESCALERA[pick.ventana]
        }
      }
      const puntosPichichi =
        pichichiGanador && (jug.pichichi || '').trim().toLowerCase() === pichichiGanador
          ? PUNTOS_PICHICHI : 0
      return {
        jugador_id: jug.id,
        nombre: jug.nombre,
        pagado: jug.pagado,
        total: puntosPartidos + puntosEscalera + puntosPichichi,
        puntos_partidos: puntosPartidos,
        puntos_escalera: puntosEscalera,
        puntos_pichichi: puntosPichichi,
        exactos,
        aciertos_eliminatorias: aciertosElim,
      }
    })

    // Desempate: total → exactos → aciertos en eliminatorias
    leaderboard.sort((a, b) =>
      b.total - a.total || b.exactos - a.exactos
      || b.aciertos_eliminatorias - a.aciertos_eliminatorias
      || a.nombre.localeCompare(b.nombre)
    )

    return {
      equipos, partidos, jugadores,
      misPredicciones, prediccionesReveladas,
      misPicks, picksRevelados,
      leaderboard, config,
      comentarios, reacciones,
      liveScores,
      miJugadorId,
      soyParticipante: miJugadorId !== null,
      esPartner: fp?.esPartner ?? false,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Registro y acceso de jugadores externos ───────────────────────────────────

export async function registerJugadorExterno(data: {
  nombre: string
  pin: string
}): Promise<{ success: true } | { error: string }> {
  try {
    const nombre = data.nombre.trim()
    if (nombre.length < 2 || nombre.length > 30) {
      return { error: 'El nombre debe tener entre 2 y 30 caracteres.' }
    }
    if (!isValidPin(data.pin)) return { error: 'El PIN debe ser de 4 a 6 dígitos.' }

    const admin = createAdminClient()
    const { data: jugador, error } = await admin
      .from('quiniela_jugadores')
      .insert({ nombre, pin_hash: hashPin(data.pin) })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return { error: 'Ese nombre ya está cogido — elige otro o entra con tu PIN.' }
      return { error: error.message }
    }

    setJugadorCookie(jugador.id)
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function loginJugadorExterno(data: {
  nombre: string
  pin: string
}): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data: jugador } = await admin
      .from('quiniela_jugadores')
      .select('id, pin_hash')
      .ilike('nombre', data.nombre.trim())
      .maybeSingle()

    if (!jugador) return { error: 'No existe nadie con ese nombre.' }
    if (!jugador.pin_hash) {
      return { error: 'Ese nombre es del equipo Forma Prima — entra por la intranet.' }
    }
    if (!verifyPin(data.pin, jugador.pin_hash)) return { error: 'PIN incorrecto.' }

    setJugadorCookie(jugador.id)
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function logoutJugadorExterno(): Promise<{ success: true }> {
  clearJugadorCookie()
  revalidateQuiniela()
  return { success: true }
}

// ── Participación ─────────────────────────────────────────────────────────────

/** Alta del staff FP (los externos se dan de alta al registrarse) */
export async function joinQuiniela(): Promise<{ success: true } | { error: string }> {
  try {
    const fp = await getSesionFP()
    if (!fp) return { error: 'Sin sesión activa.' }
    const admin = createAdminClient()

    // ¿Ya tiene ficha vinculada a su usuario FP? Re-join, nada que hacer.
    const { data: yaVinculada } = await admin
      .from('quiniela_jugadores').select('id').eq('user_id', fp.userId).maybeSingle()
    if (yaVinculada) {
      revalidateQuiniela()
      return { success: true }
    }

    // ¿Existe una ficha con su nombre? Puede ser ella misma habiendo jugado antes
    // como externa: si no tiene dueño, la reclamamos (fusiona su historial).
    const { data: porNombre } = await admin
      .from('quiniela_jugadores').select('id, user_id').ilike('nombre', fp.nombre).maybeSingle()

    if (porNombre && !porNombre.user_id) {
      const { error } = await admin
        .from('quiniela_jugadores').update({ user_id: fp.userId }).eq('id', porNombre.id)
      if (error) return { error: error.message }
      revalidateQuiniela()
      return { success: true }
    }

    // Nombre ya tomado por OTRA persona → sufijo distintivo. Si no, alta normal.
    const nombre = porNombre ? `${fp.nombre} (FP)` : fp.nombre
    const { error } = await admin
      .from('quiniela_jugadores').insert({ user_id: fp.userId, nombre })
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function upsertPrediccion(data: {
  partidoId: string
  golesLocal: number
  golesVisitante: number
  equipoQuePasaId?: string | null
}): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const jugador = await getJugadorActual(admin)
    if (!jugador) return { error: 'No estás dentro de la porra.' }

    if (data.golesLocal < 0 || data.golesVisitante < 0
      || !Number.isInteger(data.golesLocal) || !Number.isInteger(data.golesVisitante)) {
      return { error: 'Marcador inválido.' }
    }

    const { data: partido, error: partidoError } = await admin
      .from('quiniela_partidos').select('*').eq('id', data.partidoId).single()
    if (partidoError || !partido) return { error: 'Partido no encontrado.' }

    if (partido.estado === 'finalizado') return { error: 'El partido ya terminó.' }
    if (prediccionBloqueada(partido.fecha_hora)) {
      return { error: 'Las predicciones se cierran 1 hora antes del partido.' }
    }

    const esEliminatoria = partido.fase !== 'grupos'
    const empate = data.golesLocal === data.golesVisitante
    if (esEliminatoria && empate && !data.equipoQuePasaId) {
      return { error: 'Con empate en eliminatoria tienes que elegir quién pasa.' }
    }

    const { error } = await admin.from('quiniela_predicciones').upsert({
      jugador_id: jugador.id,
      partido_id: data.partidoId,
      goles_local: data.golesLocal,
      goles_visitante: data.golesVisitante,
      equipo_que_pasa_id: esEliminatoria && empate ? data.equipoQuePasaId : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'jugador_id,partido_id' })

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function upsertPickCampeon(data: {
  ventana: VentanaCampeon
  equipoId: string
}): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const jugador = await getJugadorActual(admin)
    if (!jugador) return { error: 'No estás dentro de la porra.' }

    const { data: configRow } = await admin
      .from('quiniela_config').select('value').eq('key', 'ventana_activa').single()
    if (configRow?.value !== data.ventana) {
      return { error: 'Esta ventana de pick no está activa.' }
    }

    // La ventana de apertura se cierra sola en su deadline
    if (data.ventana === 'apertura') {
      const deadline = await getAperturaDeadline(admin)
      if (deadline && deadline <= Date.now()) {
        return { error: 'La ventana para elegir campeón ya está cerrada.' }
      }
    }

    // Elegibilidad: el equipo debe seguir vivo (aparece en la fase siguiente)
    const faseElegible = VENTANA_FASE_ELEGIBLE[data.ventana]
    if (faseElegible) {
      const { data: partidosFase } = await admin
        .from('quiniela_partidos')
        .select('equipo_local_id, equipo_visitante_id')
        .eq('fase', faseElegible)
      const vivos = new Set<string>()
      for (const p of partidosFase ?? []) {
        if (p.equipo_local_id) vivos.add(p.equipo_local_id)
        if (p.equipo_visitante_id) vivos.add(p.equipo_visitante_id)
      }
      if (!vivos.has(data.equipoId)) {
        return { error: 'Ese equipo no está entre los clasificados de esta fase.' }
      }
    }

    const { error } = await admin.from('quiniela_picks_campeon').upsert({
      jugador_id: jugador.id,
      ventana: data.ventana,
      equipo_id: data.equipoId,
    }, { onConflict: 'jugador_id,ventana' })

    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePichichi(nombre: string): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const jugador = await getJugadorActual(admin)
    if (!jugador) return { error: 'No estás dentro de la porra.' }

    // Solo editable mientras la ventana inicial siga abierta
    const deadline = await getAperturaDeadline(admin)
    if (deadline && deadline <= Date.now()) {
      return { error: 'El pick de Pichichi ya está cerrado.' }
    }

    const { error } = await admin
      .from('quiniela_jugadores')
      .update({ pichichi: nombre.trim() || null })
      .eq('id', jugador.id)
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function createComentario(data: {
  texto: string
  parentId?: string | null
}): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const jugador = await getJugadorActual(admin)
    if (!jugador) return { error: 'Apúntate a la porra para comentar.' }

    const texto = data.texto.trim()
    if (!texto) return { error: 'Escribe algo.' }
    if (texto.length > 500) return { error: 'Máximo 500 caracteres.' }

    const { error } = await admin.from('quiniela_comentarios').insert({
      jugador_id: jugador.id,
      parent_id: data.parentId || null,
      texto,
    })
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function toggleReaccion(data: {
  comentarioId: string
  emoji: string
}): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const jugador = await getJugadorActual(admin)
    if (!jugador) return { error: 'Apúntate a la porra para reaccionar.' }
    if (!CHAT_EMOJIS.includes(data.emoji)) return { error: 'Emoji no permitido.' }

    const { data: existente } = await admin
      .from('quiniela_reacciones').select('id')
      .eq('comentario_id', data.comentarioId)
      .eq('jugador_id', jugador.id)
      .eq('emoji', data.emoji)
      .maybeSingle()

    const { error } = existente
      ? await admin.from('quiniela_reacciones').delete().eq('id', existente.id)
      : await admin.from('quiniela_reacciones').insert({
          comentario_id: data.comentarioId, jugador_id: jugador.id, emoji: data.emoji,
        })
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteComentario(
  comentarioId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const jugador = await getJugadorActual(admin)
    const fp = await getSesionFP()
    const { data: comentario } = await admin
      .from('quiniela_comentarios').select('jugador_id').eq('id', comentarioId).maybeSingle()
    if (!comentario) return { error: 'Comentario no encontrado.' }
    const esMio = jugador && comentario.jugador_id === jugador.id
    if (!esMio && !fp?.esPartner) return { error: 'Solo puedes borrar tus comentarios.' }

    const { error } = await admin.from('quiniela_comentarios').delete().eq('id', comentarioId)
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Administración (solo fp_partner) ──────────────────────────────────────────

export async function updateResultado(data: {
  partidoId: string
  golesLocal: number
  golesVisitante: number
  equipoQuePasaId?: string | null
}): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    const { data: partido, error: partidoError } = await admin
      .from('quiniela_partidos').select('*').eq('id', data.partidoId).single()
    if (partidoError || !partido) return { error: 'Partido no encontrado.' }

    const result = await finalizarPartido(
      admin, partido as QuinielaPartido,
      data.golesLocal, data.golesVisitante, data.equipoQuePasaId
    )
    if ('error' in result) return result

    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Rellena los cruces de eliminatorias según se va resolviendo el bracket */
export async function updatePartidoEquipos(data: {
  partidoId: string
  equipoLocalId: string | null
  equipoVisitanteId: string | null
  fechaHora?: string
}): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const update: Record<string, unknown> = {
      equipo_local_id: data.equipoLocalId,
      equipo_visitante_id: data.equipoVisitanteId,
    }
    if (data.fechaHora) update.fecha_hora = data.fechaHora
    const { error } = await admin
      .from('quiniela_partidos').update(update).eq('id', data.partidoId)
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateVentanaActiva(
  ventana: VentanaCampeon | 'cerrada'
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('quiniela_config')
      .upsert({ key: 'ventana_activa', value: ventana }, { onConflict: 'key' })
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePagado(
  jugadorId: string, pagado: boolean
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('quiniela_jugadores').update({ pagado }).eq('id', jugadorId)
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateQuinielaConfig(
  key: 'monto_entrada' | 'reparto' | 'pichichi_ganador' | 'apertura_deadline',
  value: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('quiniela_config')
      .upsert({ key, value: value.trim() || null }, { onConflict: 'key' })
    if (error) return { error: error.message }
    revalidateQuiniela()
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Avance automático de fase de la porra ────────────────────────────────────
// Cuando se finaliza el ÚLTIMO partido de una fase de eliminatorias, resuelve el
// bracket de la fase siguiente (etiquetas W##/L## → equipos), abre la ventana de
// campeón/pichichi que le toca y genera un BORRADOR de apuestas de La Bolsa
// (IA con fallback genérico) para que el partner lo revise. Avisa al partner.
//
// Todo idempotente: se puede llamar en cada tick del cron sin duplicar nada.
// El paso grupos → dieciseisavos NO se automatiza (depende de la clasificación de
// grupos y de los mejores terceros; se hace a mano). La automatización cubre
// dieciseisavos → octavos → cuartos → semifinal → (3er puesto + final).
// Solo servidor.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FASE_LABELS } from '@/lib/quiniela/config'
import type {
  QuinielaFase, VentanaCampeon, QuinielaEquipo, QuinielaMercadoOpcion,
} from '@/lib/quiniela/config'

interface PartidoRow {
  id: string
  numero: number
  fase: QuinielaFase
  etiqueta_local: string | null
  etiqueta_visitante: string | null
  equipo_local_id: string | null
  equipo_visitante_id: string | null
  equipo_que_pasa_id: string | null
  estado: string
  ciudad: string | null
}

interface Propuesta {
  pregunta: string
  subtitulo: string | null
  opciones: QuinielaMercadoOpcion[]
  auto: boolean
  regla: string | null
}

// Fase que se acaba de completar → fases a rellenar + ventana de campeón a abrir.
const AVANCE: { completa: QuinielaFase; rellena: QuinielaFase[]; ventana: VentanaCampeon | 'cerrada' }[] = [
  { completa: 'dieciseisavos', rellena: ['octavos'],                ventana: 'dieciseisavos' },
  { completa: 'octavos',       rellena: ['cuartos'],                ventana: 'octavos' },
  { completa: 'cuartos',       rellena: ['semifinal'],              ventana: 'cuartos' },
  { completa: 'semifinal',     rellena: ['tercer_puesto', 'final'], ventana: 'cerrada' },
]

/** Resuelve una etiqueta de bracket ('W74' = ganador del 74, 'L101' = perdedor) a un equipo_id. */
function resolverEtiqueta(etiqueta: string | null, byNum: Map<number, PartidoRow>): string | null {
  if (!etiqueta) return null
  const m = /^([WL])(\d+)$/.exec(etiqueta.trim())
  if (!m) return null
  const src = byNum.get(parseInt(m[2], 10))
  if (!src || src.estado !== 'finalizado' || !src.equipo_que_pasa_id) return null
  if (m[1] === 'W') return src.equipo_que_pasa_id
  // Perdedor = el equipo que no pasó
  if (src.equipo_local_id && src.equipo_local_id !== src.equipo_que_pasa_id) return src.equipo_local_id
  if (src.equipo_visitante_id && src.equipo_visitante_id !== src.equipo_que_pasa_id) return src.equipo_visitante_id
  return null
}

/**
 * Punto de entrada: recorre las fases de eliminatorias, y por cada una que esté
 * completa cuya siguiente fase aún no tenga equipos, avanza (bracket + ventana +
 * apuestas + aviso). Devuelve un resumen de lo que hizo (vacío si no había nada).
 */
export async function avanzarFasesCompletas(admin: SupabaseClient): Promise<{
  avances: { fase: QuinielaFase; rellenadas: number; ventana: string; apuestas: number; metodoApuestas: string }[]
}> {
  const { data: partidos } = await admin
    .from('quiniela_partidos')
    .select('id,numero,fase,etiqueta_local,etiqueta_visitante,equipo_local_id,equipo_visitante_id,equipo_que_pasa_id,estado,ciudad')
    .order('numero')
  const rows = (partidos ?? []) as PartidoRow[]
  const byNum = new Map(rows.map(p => [p.numero, p]))

  const { data: equipos } = await admin.from('quiniela_equipos').select('id,codigo,nombre,bandera,grupo')
  const equiposById = new Map((equipos ?? []).map((e: QuinielaEquipo) => [e.id, e]))

  const avances: { fase: QuinielaFase; rellenadas: number; ventana: string; apuestas: number; metodoApuestas: string }[] = []

  for (const step of AVANCE) {
    const dela = rows.filter(p => p.fase === step.completa)
    if (dela.length === 0 || !dela.every(p => p.estado === 'finalizado')) continue

    const objetivo = rows.filter(p => step.rellena.includes(p.fase))
    const pendientes = objetivo.filter(p => !p.equipo_local_id || !p.equipo_visitante_id)
    if (pendientes.length === 0) continue // la fase siguiente ya está poblada → ya se avanzó

    // 1) Rellenar el bracket de la fase siguiente
    const recienRellenados: PartidoRow[] = []
    for (const p of pendientes) {
      const loc = p.equipo_local_id ?? resolverEtiqueta(p.etiqueta_local, byNum)
      const vis = p.equipo_visitante_id ?? resolverEtiqueta(p.etiqueta_visitante, byNum)
      if (!loc || !vis) continue // todavía no resoluble
      await admin.from('quiniela_partidos')
        .update({ equipo_local_id: loc, equipo_visitante_id: vis }).eq('id', p.id)
      recienRellenados.push({ ...p, equipo_local_id: loc, equipo_visitante_id: vis })
    }
    if (recienRellenados.length === 0) continue

    // 2) Abrir la ventana de campeón/pichichi (o cerrarla tras semis)
    await admin.from('quiniela_config')
      .upsert({ key: 'ventana_activa', value: step.ventana }, { onConflict: 'key' })

    // 3) Generar borrador de apuestas de La Bolsa (IA + fallback genérico)
    const bolsa = await generarMercadosFase(admin, recienRellenados, equiposById)

    // 4) Avisar al partner para que revise el borrador
    await crearAvisoAvance(admin, step.rellena, recienRellenados.length, bolsa)

    avances.push({
      fase: step.completa,
      rellenadas: recienRellenados.length,
      ventana: step.ventana,
      apuestas: bolsa.creadas,
      metodoApuestas: bolsa.metodo,
    })
  }

  return { avances }
}

/** Crea una apuesta por partido que aún no la tenga. IA personalizada con fallback genérico. */
async function generarMercadosFase(
  admin: SupabaseClient,
  partidos: PartidoRow[],
  equiposById: Map<string, QuinielaEquipo>,
): Promise<{ creadas: number; metodo: string }> {
  const ids = partidos.map(p => p.id)
  const { data: existentes } = await admin
    .from('quiniela_mercados').select('partido_id').in('partido_id', ids)
  const conMercado = new Set((existentes ?? []).map(m => m.partido_id))
  const objetivo = partidos.filter(p => !conMercado.has(p.id))
  if (objetivo.length === 0) return { creadas: 0, metodo: 'ninguno' }

  const matchups = objetivo.map(p => ({
    numero: p.numero,
    local: equiposById.get(p.equipo_local_id!)?.nombre ?? '?',
    visitante: equiposById.get(p.equipo_visitante_id!)?.nombre ?? '?',
    ciudad: p.ciudad ?? '',
    fase: FASE_LABELS[p.fase],
  }))

  let ia = new Map<number, Propuesta>()
  try {
    ia = await generarApuestasIA(matchups)
  } catch {
    ia = new Map()
  }
  const metodo = ia.size === 0 ? 'generico'
    : ia.size === objetivo.length ? 'ia' : 'ia+generico'

  let creadas = 0
  for (let i = 0; i < objetivo.length; i++) {
    const p = objetivo[i]
    const mu = matchups[i]
    const prop = ia.get(p.numero) ?? plantillaGenerica(i, objetivo.length, `${mu.local} vs ${mu.visitante}`)
    const { error } = await admin.from('quiniela_mercados').insert({
      partido_id: p.id,
      pregunta: prop.pregunta,
      subtitulo: prop.subtitulo,
      opciones: prop.opciones,
      auto: prop.auto,
      regla: prop.regla,
    })
    if (!error) creadas++
  }
  return { creadas, metodo }
}

/** Apuesta genérica (no necesita conocer jugadores). El último partido → penaltis auto. */
function plantillaGenerica(indice: number, total: number, contexto: string): Propuesta {
  if (indice === total - 1) {
    return {
      pregunta: '¿Se decide en la tanda de penaltis?', subtitulo: contexto,
      opciones: [{ key: 'si', label: 'Sí', mult: 3.0 }, { key: 'no', label: 'No', mult: 1.15 }],
      auto: true, regla: 'penaltis',
    }
  }
  const plantillas: Propuesta[] = [
    {
      pregunta: 'Goles totales del partido', subtitulo: contexto,
      opciones: [{ key: 'a', label: '0–2 goles', mult: 2.0 }, { key: 'b', label: '3–4 goles', mult: 1.9 }, { key: 'c', label: '5+ goles', mult: 2.8 }],
      auto: false, regla: null,
    },
    {
      pregunta: '¿Habrá prórroga?', subtitulo: contexto,
      opciones: [{ key: 'si', label: 'Sí', mult: 2.5 }, { key: 'no', label: 'No', mult: 1.35 }],
      auto: false, regla: null,
    },
    {
      pregunta: 'Tarjetas amarillas totales', subtitulo: contexto,
      opciones: [{ key: 'a', label: '0–3', mult: 2.0 }, { key: 'b', label: '4–6', mult: 1.7 }, { key: 'c', label: '7+', mult: 2.6 }],
      auto: false, regla: null,
    },
  ]
  return plantillas[indice % plantillas.length]
}

/** Pide a Claude una apuesta personalizada por partido. Devuelve un mapa numero→propuesta validada. */
async function generarApuestasIA(
  matchups: { numero: number; local: string; visitante: string; ciudad: string; fase: string }[],
): Promise<Map<number, Propuesta>> {
  if (!process.env.ANTHROPIC_API_KEY) return new Map()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const fase = matchups[0]?.fase ?? 'Eliminatorias'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `Eres el creador de apuestas de "La Bolsa", una porra del Mundial 2026 entre amigos.
Para cada partido de eliminatorias propones UNA apuesta divertida y personalizada al partido:
que la estrella marque, cuántos goles marca un crack, goles totales, tarjetas, prórroga…
Devuelve SOLO un array JSON válido, sin markdown, sin explicaciones fuera del JSON.`,
    messages: [{
      role: 'user',
      content: `Fase: ${fase}. Partidos:\n${matchups.map(m => `#${m.numero} ${m.local} vs ${m.visitante} (${m.ciudad})`).join('\n')}

Devuelve un array con un objeto por partido, exactamente en este formato:
[{"numero":${matchups[0]?.numero ?? 0},"pregunta":"...","subtitulo":"Jugador · Selección o contexto del partido","opciones":[{"key":"si","label":"Sí","mult":1.8},{"key":"no","label":"No","mult":1.7}]}]

Reglas:
- 2 o 3 opciones por apuesta. Para sí/no usa keys "si"/"no"; para 3 opciones usa "a"/"b"/"c".
- Multiplicadores realistas: favorito ~1.2–1.8, difícil ~2.0–3.2. Nunca menor a 1.1 ni mayor a 3.2.
- Pregunta en español, tono desenfadado.
- Solo puedes nombrar a un jugador si estás COMPLETAMENTE seguro de que juega con una de las DOS
  selecciones de ESE partido (nombre exacto y real). Ante la mínima duda, no nombres a nadie y haz
  una pregunta de acta: goles totales, ambos equipos marcan, prórroga, tarjetas.
- La pregunta debe poder resolverse con el acta oficial del partido (marcador, goleadores,
  tarjetas, prórroga, penaltis). Nada subjetivo ni imposible de comprobar.
- Un objeto por CADA partido de la lista, con su "numero" correcto.`,
    }],
  })

  const text = message.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('')
  const ini = text.indexOf('[')
  const fin = text.lastIndexOf(']')
  if (ini === -1 || fin === -1 || fin < ini) return new Map()

  let arr: unknown
  try {
    arr = JSON.parse(text.slice(ini, fin + 1))
  } catch {
    return new Map()
  }
  if (!Array.isArray(arr)) return new Map()

  const map = new Map<number, Propuesta>()
  for (const it of arr) {
    const prop = validarPropuesta(it)
    if (prop && typeof (it as { numero?: unknown }).numero === 'number') {
      map.set((it as { numero: number }).numero, prop)
    }
  }
  return verificarApuestasIA(client, matchups, map)
}

/**
 * Segundo pase: un verificador independiente intenta refutar cada propuesta
 * (jugador inexistente o de otra selección, pregunta no resoluble con el acta).
 * Las que no pasan (o todas, si la verificación falla) caen a la plantilla genérica.
 */
async function verificarApuestasIA(
  client: Anthropic,
  matchups: { numero: number; local: string; visitante: string }[],
  map: Map<number, Propuesta>,
): Promise<Map<number, Propuesta>> {
  if (map.size === 0) return map
  const byNum = new Map(matchups.map(m => [m.numero, m]))
  const listado = Array.from(map.entries()).map(([num, prop]) => {
    const mu = byNum.get(num)
    return `#${num} PARTIDO: ${mu?.local ?? '?'} vs ${mu?.visitante ?? '?'}
   Pregunta: ${prop.pregunta}${prop.subtitulo ? `\n   Subtítulo: ${prop.subtitulo}` : ''}
   Opciones: ${prop.opciones.map(o => o.label).join(' / ')}`
  }).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Eres un verificador escéptico de datos de fútbol. Tu trabajo es REFUTAR apuestas mal construidas.
Devuelve SOLO un array JSON válido, sin markdown ni texto fuera del JSON.`,
      messages: [{
        role: 'user',
        content: `Mundial 2026. Verifica cada apuesta:\n${listado}

Marca ok=false si ocurre CUALQUIERA de estas cosas:
- Se nombra a un jugador que no existe, cuyo nombre está mal escrito o que NO juega con una de las dos selecciones de ESE partido.
- La pregunta no puede resolverse objetivamente con el acta oficial del partido (marcador, goleadores, tarjetas, prórroga, penaltis).
Si tienes cualquier duda, ok=false.

Responde exactamente: [{"numero":97,"ok":true}]`,
      }],
    })
    const text = message.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('')
    const ini = text.indexOf('[')
    const fin = text.lastIndexOf(']')
    if (ini === -1 || fin === -1 || fin < ini) return new Map()
    const arr = JSON.parse(text.slice(ini, fin + 1))
    if (!Array.isArray(arr)) return new Map()

    const ok = new Set<number>()
    for (const it of arr) {
      const o = it as Record<string, unknown>
      if (typeof o.numero === 'number' && o.ok === true) ok.add(o.numero)
    }
    const filtrado = new Map<number, Propuesta>()
    map.forEach((prop, num) => { if (ok.has(num)) filtrado.set(num, prop) })
    return filtrado
  } catch {
    return new Map() // sin verificación no nos fiamos: todo a plantilla genérica
  }
}

/** Valida y normaliza una propuesta de la IA. auto/regla se fuerzan a false/null (las revisa el admin). */
function validarPropuesta(it: unknown): Propuesta | null {
  if (!it || typeof it !== 'object') return null
  const o = it as Record<string, unknown>
  if (typeof o.pregunta !== 'string' || !o.pregunta.trim()) return null
  if (!Array.isArray(o.opciones) || o.opciones.length < 2 || o.opciones.length > 3) return null

  const opciones: QuinielaMercadoOpcion[] = []
  const keys = new Set<string>()
  for (const op of o.opciones) {
    if (!op || typeof op !== 'object') return null
    const oo = op as Record<string, unknown>
    if (typeof oo.key !== 'string' || typeof oo.label !== 'string') return null
    if (typeof oo.mult !== 'number' || oo.mult < 1.05 || oo.mult > 5) return null
    if (keys.has(oo.key)) return null
    keys.add(oo.key)
    opciones.push({ key: oo.key, label: oo.label, mult: Math.round(oo.mult * 100) / 100 })
  }

  return {
    pregunta: o.pregunta.trim(),
    subtitulo: typeof o.subtitulo === 'string' && o.subtitulo.trim() ? o.subtitulo.trim() : null,
    opciones,
    auto: false,
    regla: null,
  }
}

/** Aviso al partner de que hay una nueva fase con apuestas en borrador por revisar. */
async function crearAvisoAvance(
  admin: SupabaseClient,
  fases: QuinielaFase[],
  partidos: number,
  bolsa: { creadas: number; metodo: string },
): Promise<void> {
  const faseTxt = fases.map(f => FASE_LABELS[f]).join(' y ')
  const metodoTxt = bolsa.metodo === 'ia' ? 'con IA (borrador)'
    : bolsa.metodo === 'ia+generico' ? 'con IA + plantilla (borrador)'
    : bolsa.metodo === 'generico' ? 'con plantilla genérica (borrador)'
    : ''
  const today = new Date().toISOString().split('T')[0]
  const { error } = await admin.from('avisos').insert({
    tipo: 'equipo', autor_id: null,
    titulo: `⚽ Porra: arranca ${faseTxt}`,
    contenido: `Se resolvió el bracket (${partidos} partidos), se abrió la ventana de campeón/pichichi y se generaron ${bolsa.creadas} apuestas ${metodoTxt}. Revísalas y ajústalas en la porra antes de que abran los partidos.`,
    nivel: 'importante',
    fecha_activa: today,
    visible_roles: ['fp_partner'],
    linkeable_type: null, linkeable_id: null, link_label: null,
  })
  if (error) console.error('[quiniela] crearAvisoAvance:', error.message)
}

// ── La Bolsa: liquidación de apuestas y saldo del jugador ────────────────────
// Solo servidor. Usado por las actions de admin y por el cierre de partidos.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calcPayout, PUNTOS_ESCALERA, PUNTOS_PICHICHI_ESCALERA,
  type QuinielaMercadoOpcion, type VentanaCampeon,
} from '@/lib/quiniela/config'

/**
 * Liquida un mercado: a cada apuesta le asigna su premio (fichas × multiplicador
 * de la opción ganadora) o 0 si falló. Recalcula desde cero, así que es
 * idempotente y sirve también para corregir una liquidación errónea.
 */
export async function liquidarMercado(
  admin: SupabaseClient,
  mercadoId: string,
  opcionGanadora: string
): Promise<{ success: true } | { error: string }> {
  const { data: mercado, error } = await admin
    .from('quiniela_mercados').select('*').eq('id', mercadoId).single()
  if (error || !mercado) return { error: 'Mercado no encontrado.' }

  const opciones = (mercado.opciones ?? []) as QuinielaMercadoOpcion[]
  const opt = opciones.find(o => o.key === opcionGanadora)
  if (!opt) return { error: 'Opción ganadora no válida para este mercado.' }

  const { data: apuestas } = await admin
    .from('quiniela_apuestas').select('id, opcion, fichas').eq('mercado_id', mercadoId)
  for (const a of apuestas ?? []) {
    const payout = a.opcion === opcionGanadora ? calcPayout(a.fichas, opt.mult) : 0
    await admin.from('quiniela_apuestas')
      .update({ payout, updated_at: new Date().toISOString() }).eq('id', a.id)
  }

  await admin.from('quiniela_mercados')
    .update({ estado: 'liquidado', opcion_ganadora: opcionGanadora }).eq('id', mercadoId)
  return { success: true }
}

/**
 * Liquida automáticamente los mercados `auto` de un partido al cerrarlo.
 * Por ahora solo la regla 'penaltis': en eliminatorias, empate al final del
 * tiempo reglamentario/prórroga (gl === gv) ⇒ se decidió en penaltis.
 */
export async function liquidarMercadosAuto(
  admin: SupabaseClient,
  partidoId: string,
  golesLocal: number,
  golesVisitante: number
): Promise<void> {
  const { data: mercados } = await admin
    .from('quiniela_mercados').select('id, regla')
    .eq('partido_id', partidoId).eq('auto', true).neq('estado', 'liquidado')
  for (const m of mercados ?? []) {
    if (m.regla === 'penaltis') {
      await liquidarMercado(admin, m.id, golesLocal === golesVisitante ? 'si' : 'no')
    }
  }
}

/**
 * Saldo disponible para apostar de un jugador:
 * puntos realizados (predicciones + escalera + pichichi + apuestas liquidadas)
 * menos las fichas comprometidas en apuestas aún sin resolver.
 */
export async function calcSaldoJugador(
  admin: SupabaseClient,
  jugadorId: string
): Promise<number> {
  const [predsR, picksR, pichichiR, cfgR, apsR] = await Promise.all([
    admin.from('quiniela_predicciones').select('puntos').eq('jugador_id', jugadorId),
    admin.from('quiniela_picks_campeon').select('ventana, equipo_id').eq('jugador_id', jugadorId),
    admin.from('quiniela_picks_pichichi').select('ventana, nombre').eq('jugador_id', jugadorId),
    admin.from('quiniela_config').select('key, value').in('key', ['campeon_id', 'pichichi_ganador']),
    admin.from('quiniela_apuestas').select('mercado_id, fichas, payout').eq('jugador_id', jugadorId),
  ])

  let core = 0
  for (const p of predsR.data ?? []) core += Math.max(0, p.puntos ?? 0)

  const cfg: Record<string, string | null> = {}
  for (const r of cfgR.data ?? []) cfg[r.key] = r.value

  const campeonId = cfg['campeon_id']
  if (campeonId) {
    for (const pk of picksR.data ?? []) {
      if (pk.equipo_id === campeonId) core += PUNTOS_ESCALERA[pk.ventana as VentanaCampeon]
    }
  }
  const pichichiGanador = (cfg['pichichi_ganador'] || '').trim().toLowerCase()
  if (pichichiGanador) {
    for (const pk of pichichiR.data ?? []) {
      if ((pk.nombre || '').trim().toLowerCase() === pichichiGanador) {
        core += PUNTOS_PICHICHI_ESCALERA[pk.ventana as VentanaCampeon]
      }
    }
  }

  // Apuestas: liquidadas suman/restan neto; abiertas reservan su importe
  const apuestas = apsR.data ?? []
  const mercadoIds = Array.from(new Set(apuestas.map(a => a.mercado_id)))
  const estados = new Map<string, string>()
  if (mercadoIds.length) {
    const { data: ms } = await admin
      .from('quiniela_mercados').select('id, estado').in('id', mercadoIds)
    for (const m of ms ?? []) estados.set(m.id, m.estado)
  }

  let neto = 0
  for (const a of apuestas) {
    if (estados.get(a.mercado_id) === 'liquidado') neto += (a.payout ?? 0) - a.fichas
    else neto -= a.fichas // fichas comprometidas en apuestas vivas
  }

  return core + neto
}

// ── Adaptador ESPN para resultados del Mundial 2026 ──────────────────────────
// Endpoint público sin clave: site.api.espn.com (scoreboard de fifa.world).
// Solo servidor (lo usa el cron de resultados).

import type { QuinielaEquipo, QuinielaPartido } from '@/lib/quiniela/config'

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

export interface EspnEvento {
  fechaUtc: string
  estado: 'pre' | 'in' | 'post'
  completado: boolean
  statusName: string
  minuto: string
  equipos: {
    codigo: string
    goles: number
    penales: number | null
    ganador: boolean
  }[]
}

// Alias por si ESPN usa una abreviatura distinta a nuestro código FIFA
const ALIAS: Record<string, string> = {
  CUR: 'CUW', // Curazao
  SA: 'KSA',  // Arabia Saudita
  CV: 'CPV',  // Cabo Verde
}

function normalizaCodigo(abbr: string): string {
  const up = (abbr || '').toUpperCase()
  return ALIAS[up] || up
}

export async function fetchEspnScoreboard(fechasYYYYMMDD: string[]): Promise<EspnEvento[]> {
  const eventos: EspnEvento[] = []
  for (const fecha of fechasYYYYMMDD) {
    const res = await fetch(`${SCOREBOARD_URL}?dates=${fecha}`, { cache: 'no-store' })
    if (!res.ok) continue
    const json = await res.json()
    for (const event of json?.events ?? []) {
      const comp = event?.competitions?.[0]
      const competitors = comp?.competitors
      if (!competitors || competitors.length !== 2) continue
      eventos.push({
        fechaUtc: event.date || comp.date,
        estado: (event?.status?.type?.state as 'pre' | 'in' | 'post') || 'pre',
        completado: !!event?.status?.type?.completed,
        statusName: event?.status?.type?.name || '',
        minuto: event?.status?.displayClock || '',
        equipos: competitors.map((c: any) => ({
          codigo: normalizaCodigo(c?.team?.abbreviation),
          goles: parseInt(c?.score, 10) || 0,
          penales: c?.shootoutScore != null ? parseInt(c.shootoutScore, 10) : null,
          ganador: !!c?.winner,
        })),
      })
    }
  }
  return eventos
}

export interface PartidoEnVivo {
  golesLocal: number
  golesVisitante: number
  minuto: string
  statusName: string
  completado: boolean
  /** id de quiniela_equipos del que pasa de ronda (solo si ESPN marca winner) */
  ganadorEquipoId: string | null
}

/**
 * Empareja un partido nuestro con un evento ESPN: ambos equipos por código FIFA
 * y kickoff a menos de 3 h de distancia. Los goles se asignan POR CÓDIGO de
 * equipo (no por posición home/away, que puede venir invertida).
 */
export function matchEvento(
  partido: QuinielaPartido,
  equiposById: Map<string, QuinielaEquipo>,
  eventos: EspnEvento[]
): PartidoEnVivo | null {
  const local = partido.equipo_local_id ? equiposById.get(partido.equipo_local_id) : null
  const visitante = partido.equipo_visitante_id ? equiposById.get(partido.equipo_visitante_id) : null
  if (!local || !visitante) return null

  const kickoff = new Date(partido.fecha_hora).getTime()
  for (const ev of eventos) {
    const codigos = ev.equipos.map(e => e.codigo)
    if (!codigos.includes(local.codigo) || !codigos.includes(visitante.codigo)) continue
    if (Math.abs(new Date(ev.fechaUtc).getTime() - kickoff) > 3 * 3600 * 1000) continue

    const evLocal = ev.equipos.find(e => e.codigo === local.codigo)!
    const evVisitante = ev.equipos.find(e => e.codigo === visitante.codigo)!
    const ganador = ev.equipos.find(e => e.ganador)
    const ganadorEquipoId = ganador
      ? (ganador.codigo === local.codigo ? local.id : visitante.id)
      : null

    return {
      golesLocal: evLocal.goles,
      golesVisitante: evVisitante.goles,
      minuto: ev.minuto,
      statusName: ev.statusName,
      completado: ev.estado === 'post' && ev.completado,
      ganadorEquipoId,
    }
  }
  return null
}

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEspnScoreboard, matchEvento } from '@/lib/quiniela/espn'
import { finalizarPartido } from '@/lib/quiniela/finalize'
import { avanzarFasesCompletas } from '@/lib/quiniela/advance'
import type { QuinielaEquipo, QuinielaPartido } from '@/lib/quiniela/config'

// Vercel Cron — cada 2 min (vercel.json). Marcadores en vivo + cierre automático
// de partidos de la porra del Mundial usando el scoreboard público de ESPN.
// El marcador en vivo se guarda como JSON en quiniela_config['live_scores'].

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.nextUrl.searchParams.get('secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const ahora = Date.now()

  // Candidatos: partidos no finalizados con kickoff entre hace 8 h y dentro de 10 min
  const { data: candidatos, error } = await admin
    .from('quiniela_partidos')
    .select('*')
    .neq('estado', 'finalizado')
    .gte('fecha_hora', new Date(ahora - 8 * 3600 * 1000).toISOString())
    .lte('fecha_hora', new Date(ahora + 10 * 60 * 1000).toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!candidatos || candidatos.length === 0) {
    // Nada en juego: limpiar marcadores en vivo si quedaron
    await admin.from('quiniela_config')
      .upsert({ key: 'live_scores', value: null }, { onConflict: 'key' })
    return NextResponse.json({ ok: true, candidatos: 0 })
  }

  const { data: equipos } = await admin.from('quiniela_equipos').select('*')
  const equiposById = new Map((equipos ?? []).map((e: QuinielaEquipo) => [e.id, e]))

  // Fechas YYYYMMDD a consultar en ESPN. ESPN archiva cada partido bajo su fecha
  // LOCAL de EE. UU., no UTC: un kickoff de madrugada/UTC (ej. 01:00Z) cae en el
  // día anterior de ESPN. Por eso pedimos, por cada candidato, su fecha y los días
  // adyacentes (±1) — así el evento siempre está en la respuesta. El emparejamiento
  // real lo afina matchEvento por código de equipo + ventana de ±3 h.
  const fechasSet = new Set<string>()
  for (const p of candidatos as QuinielaPartido[]) {
    const base = new Date(p.fecha_hora).getTime()
    for (const offset of [-1, 0, 1]) {
      fechasSet.add(
        new Date(base + offset * 24 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
      )
    }
  }
  const fechas = Array.from(fechasSet)

  let eventos
  try {
    eventos = await fetchEspnScoreboard(fechas)
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: `ESPN no disponible: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 502 })
  }

  const live: Record<string, { gl: number; gv: number; minuto: string }> = {}
  const resumen = { enVivo: 0, finalizados: 0, sinMatch: 0, errores: [] as string[] }

  for (const partido of candidatos as QuinielaPartido[]) {
    const estado = matchEvento(partido, equiposById, eventos)
    if (!estado) { resumen.sinMatch++; continue }

    if (estado.completado) {
      const result = await finalizarPartido(
        admin, partido,
        estado.golesLocal, estado.golesVisitante,
        estado.ganadorEquipoId
      )
      if ('error' in result) {
        resumen.errores.push(`#${partido.numero}: ${result.error}`)
      } else {
        resumen.finalizados++
      }
    } else if (new Date(partido.fecha_hora).getTime() <= ahora) {
      live[partido.id] = {
        gl: estado.golesLocal,
        gv: estado.golesVisitante,
        minuto: estado.minuto,
      }
      resumen.enVivo++
    }
  }

  await admin.from('quiniela_config').upsert({
    key: 'live_scores',
    value: resumen.enVivo > 0
      ? JSON.stringify({ ts: new Date().toISOString(), partidos: live })
      : null,
  }, { onConflict: 'key' })

  // Si se cerró algún partido, comprobar si con ello se completó una fase y, en
  // tal caso, avanzar automáticamente a la siguiente (bracket + ventana de
  // campeón/pichichi + borrador de apuestas de La Bolsa + aviso al partner).
  let avances: Awaited<ReturnType<typeof avanzarFasesCompletas>>['avances'] = []
  if (resumen.finalizados > 0) {
    try {
      avances = (await avanzarFasesCompletas(admin)).avances
    } catch (err) {
      resumen.errores.push(`avance de fase: ${err instanceof Error ? err.message : 'desconocido'}`)
    }
    revalidatePath('/quiniela')
    revalidatePath('/team/apps/quiniela')
  }

  return NextResponse.json({ ok: true, candidatos: candidatos.length, ...resumen, avances })
}

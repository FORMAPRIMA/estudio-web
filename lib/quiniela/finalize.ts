// ── Cierre de un partido: resultado + recálculo de puntos ────────────────────
// Usado por la action de admin (updateResultado) y por el cron de resultados.
// Solo servidor.

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcPuntosPrediccion } from '@/lib/quiniela/config'
import type { QuinielaPartido } from '@/lib/quiniela/config'
import { liquidarMercadosAuto } from '@/lib/quiniela/bolsa'

export async function finalizarPartido(
  admin: SupabaseClient,
  partido: QuinielaPartido,
  golesLocal: number,
  golesVisitante: number,
  equipoQuePasaIdExterno?: string | null
): Promise<{ success: true } | { error: string }> {
  const esEliminatoria = partido.fase !== 'grupos'
  const empate = golesLocal === golesVisitante
  if (esEliminatoria && empate && !equipoQuePasaIdExterno) {
    return { error: 'Con empate hay que indicar quién pasó (penaltis).' }
  }

  const equipoQuePasaId = esEliminatoria
    ? (empate
        ? equipoQuePasaIdExterno
        : (golesLocal > golesVisitante ? partido.equipo_local_id : partido.equipo_visitante_id))
    : null

  const { error: updateError } = await admin.from('quiniela_partidos').update({
    goles_local: golesLocal,
    goles_visitante: golesVisitante,
    equipo_que_pasa_id: equipoQuePasaId,
    estado: 'finalizado',
  }).eq('id', partido.id)
  if (updateError) return { error: updateError.message }

  // Recalcular puntos de todas las predicciones del partido
  const partidoFinal = {
    ...partido,
    goles_local: golesLocal,
    goles_visitante: golesVisitante,
    equipo_que_pasa_id: equipoQuePasaId ?? null,
  }
  const { data: predicciones } = await admin
    .from('quiniela_predicciones').select('*').eq('partido_id', partido.id)
  for (const pred of predicciones ?? []) {
    const puntos = calcPuntosPrediccion(partidoFinal, pred)
    await admin.from('quiniela_predicciones').update({ puntos }).eq('id', pred.id)
  }

  // Si es la final, el ganador es el campeón del Mundial
  if (partido.fase === 'final' && equipoQuePasaId) {
    await admin.from('quiniela_config')
      .upsert({ key: 'campeon_id', value: equipoQuePasaId }, { onConflict: 'key' })
  }

  // La Bolsa: liquidar mercados de auto-liquidación de este partido (penaltis…)
  await liquidarMercadosAuto(admin, partido.id, golesLocal, golesVisitante)

  return { success: true }
}

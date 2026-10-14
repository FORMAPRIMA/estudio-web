import type { SupabaseClient } from '@supabase/supabase-js'
import { tipoCambioBCE } from '@/lib/facturas/tipoCambioBCE'
import type { Moneda } from '@/lib/facturasUtils'

/**
 * Cobros por proyecto en moneda extranjera aún sin emitir: su `monto` en euros
 * es solo una estimación y se recalcula al último cambio BCE publicado. Al
 * emitir la factura el cambio queda fijado y la fila ya no se toca.
 *
 * Lo llaman el cron diario y la ficha de facturación del proyecto (así un
 * refresco enseña el cambio del día aunque el cron no haya pasado).
 * Devuelve los importes actualizados por id.
 */
export async function actualizarContravalores(
  admin: SupabaseClient,
  opts: { proyectoId?: string } = {},
): Promise<Map<string, number>> {
  let q = admin
    .from('facturas')
    .select('id, monto, moneda, monto_moneda')
    .neq('moneda', 'EUR')
    .is('factura_emitida_id', null)
  if (opts.proyectoId) q = q.eq('proyecto_id', opts.proyectoId)
  const { data: filas, error } = await q
  const cambios = new Map<string, number>()
  if (error || !filas?.length) return cambios

  const hoy = new Date().toISOString().split('T')[0]
  const tipos = new Map<Moneda, number>()
  for (const f of filas) {
    const moneda = f.moneda as Exclude<Moneda, 'EUR'>
    if (!tipos.has(moneda)) {
      try { tipos.set(moneda, (await tipoCambioBCE(hoy, moneda)).tipo) } catch { continue }
    }
    const tipo = tipos.get(moneda)!
    const monto = Math.round((Number(f.monto_moneda ?? 0) / tipo) * 100) / 100
    if (monto === Number(f.monto)) continue
    const { error: upErr } = await admin.from('facturas').update({ monto }).eq('id', f.id)
    if (!upErr) cambios.set(f.id, monto)
  }
  return cambios
}

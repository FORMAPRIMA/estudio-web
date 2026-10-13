/**
 * Una factura de contrato se emite UNA vez. Si ya tiene una emitida que no está
 * anulada, emitir de nuevo crea un segundo número correlativo para el mismo cobro.
 *
 * Pasaba al fallar el correo: la factura quedaba creada, el modal seguía abierto y
 * el segundo clic emitía otra. Para reenviar una ya emitida está "Guardar y reenviar".
 */

type AdminClient = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function buscarEmitidaVigente(
  admin: AdminClient,
  facturaOrigenId: string | null | undefined,
): Promise<{ id: string; numero_completo: string } | null> {
  if (!facturaOrigenId) return null
  const { data } = await admin
    .from('facturas_emitidas')
    .select('id, numero_completo')
    .eq('factura_origen_id', facturaOrigenId)
    .neq('estado', 'anulada')
    .limit(1)
    .maybeSingle()
  return (data as { id: string; numero_completo: string } | null) ?? null
}

export function mensajeYaEmitida(numero: string): string {
  return `Esta factura ya se emitió como ${numero}. Para enviarla, ábrela en Facturas emitidas → Editar → Guardar y reenviar.`
}

import { SECCION_CONSTRUCTORA } from './costs'

type AdminClient = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ProveedorDestino {
  id:      string
  nombre:  string
  email:   string | null
  emailCc: string | null
}

/**
 * Resuelve el PROVEEDOR al que debe facturarse/enviarse una factura de sección privada:
 *  - "Margen prorrateado de obra" → constructora del proyecto (proyectos.constructor_id),
 *     o el proveedor de la factura si está fijado.
 *  - "Margen de mobiliario"       → proveedor de la factura (facturas.proveedor_id).
 * Devuelve null si no hay proveedor asignado.
 */
export async function resolveProveedorDestino(
  admin: AdminClient,
  opts: { facturaOrigenId: string | null; proyectoId: string | null; seccion: string | null },
): Promise<ProveedorDestino | null> {
  let provId: string | null = null

  if (opts.facturaOrigenId) {
    const { data: fc } = await admin
      .from('facturas').select('proveedor_id').eq('id', opts.facturaOrigenId).maybeSingle()
    provId = (fc?.proveedor_id as string | null) ?? null
  }

  if (opts.seccion === SECCION_CONSTRUCTORA && !provId && opts.proyectoId) {
    const { data: p } = await admin
      .from('proyectos').select('constructor_id').eq('id', opts.proyectoId).maybeSingle()
    provId = (p?.constructor_id as string | null) ?? null
  }

  if (!provId) return null

  const { data: prov } = await admin
    .from('proveedores')
    .select('id, nombre, razon_social, email, email_cc')
    .eq('id', provId)
    .maybeSingle()
  if (!prov) return null

  return {
    id:      prov.id as string,
    nombre:  (prov.razon_social as string | null) ?? (prov.nombre as string),
    email:   (prov.email as string | null) ?? null,
    emailCc: (prov.email_cc as string | null) ?? null,
  }
}

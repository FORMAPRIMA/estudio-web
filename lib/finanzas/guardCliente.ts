/**
 * Última línea de defensa antes de enviar una factura por email.
 *
 * Toda factura dirigida a un proveedor (margen de obra a la constructora, rappel o
 * descuento de un proveedor de mobiliario) contiene información que el cliente del
 * proyecto NO debe ver: muchas veces no sabe que el estudio recibe un margen por su
 * compra. Que uno de esos correos le llegue es un incidente de confianza, no un bug
 * cosmético, y no tiene vuelta atrás una vez enviado.
 *
 * Arriba, en cada endpoint, ya se decide el destinatario con `esFacturaNoCliente()`.
 * Esta función NO sustituye esa lógica: la comprueba. Cruza la lista final de
 * destinatarios contra todos los emails conocidos de los clientes del proyecto y
 * aborta si hay cualquier coincidencia. Si un refactor futuro rompe el guard de
 * arriba, este lo para igual.
 */

type AdminClient = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

const norm = (e: string) => e.trim().toLowerCase()

/** Todos los emails (principal + CC) de los clientes vinculados a un proyecto. */
export async function getEmailsClientesProyecto(
  admin: AdminClient,
  proyectoId: string | null,
): Promise<Set<string>> {
  const emails = new Set<string>()
  if (!proyectoId) return emails

  const [{ data: proyecto }, { data: vinculos }] = await Promise.all([
    admin
      .from('proyectos')
      .select('clientes!cliente_id(email, email_cc)')
      .eq('id', proyectoId)
      .maybeSingle(),
    admin
      .from('proyecto_clientes')
      .select('clientes(email, email_cc)')
      .eq('proyecto_id', proyectoId),
  ])

  type Row = { email: string | null; email_cc: string | null } | null
  const push = (c: Row | Row[]) => {
    for (const r of (Array.isArray(c) ? c : [c])) {
      if (!r) continue
      if (r.email?.trim())    emails.add(norm(r.email))
      if (r.email_cc?.trim()) emails.add(norm(r.email_cc))
    }
  }

  push((proyecto as { clientes?: Row | Row[] } | null)?.clientes ?? null)
  for (const v of (vinculos ?? []) as { clientes: Row | Row[] }[]) push(v.clientes)

  return emails
}

export class ClienteEnDestinatariosError extends Error {
  constructor(public readonly coincidencias: string[]) {
    super(
      `Envío bloqueado: esta factura va dirigida a un proveedor y ${coincidencias.length === 1 ? 'el destinatario' : 'los destinatarios'} ` +
      `${coincidencias.join(', ')} ${coincidencias.length === 1 ? 'pertenece' : 'pertenecen'} al cliente del proyecto. ` +
      `Las facturas a proveedor (márgenes, rappels y descuentos) nunca deben llegar al cliente.`,
    )
    this.name = 'ClienteEnDestinatariosError'
  }
}

/**
 * Lanza `ClienteEnDestinatariosError` si algún destinatario es un cliente del
 * proyecto. Llamar SIEMPRE justo antes de `sendEmail` en facturas a proveedor.
 */
export async function assertSinClientesEnDestinatarios(
  admin: AdminClient,
  opts: { proyectoId: string | null; to: string[]; cc?: string[]; bcc?: string[] },
): Promise<void> {
  const emailsCliente = await getEmailsClientesProyecto(admin, opts.proyectoId)
  if (emailsCliente.size === 0) return

  const destinatarios = [...opts.to, ...(opts.cc ?? []), ...(opts.bcc ?? [])]
    .filter(Boolean)
    .map(norm)

  const coincidencias = Array.from(new Set(destinatarios.filter(e => emailsCliente.has(e))))
  if (coincidencias.length > 0) {
    console.error('[guardCliente] envío bloqueado', {
      proyectoId: opts.proyectoId,
      coincidencias,
    })
    throw new ClienteEnDestinatariosError(coincidencias)
  }
}

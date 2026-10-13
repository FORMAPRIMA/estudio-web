/**
 * Reglas puras de reparto de destinatarios. Sin imports de servidor a propósito:
 * las usa el servidor para enviar y el formulario para enseñar, en la revisión
 * final, la lista exacta que llegará a Resend. Una sola función para las dos
 * cosas es lo que garantiza que lo que ves es lo que se envía.
 */

const norm = (e: string) => e.trim().toLowerCase()

/**
 * Limpia las tres listas de un envío antes de entregarlas a Resend:
 *  - quita vacíos y espacios sobrantes,
 *  - elimina repetidos dentro de cada lista,
 *  - y aplica prioridad TO > CC > BCC: quien ya está en una lista desaparece de
 *    las de menor prioridad.
 *
 * El motivo no es cosmético. Sin esto un cliente que también es contacto de copia
 * recibe el mismo correo dos veces, y un socio que además es el destinatario
 * aparece duplicado en la cabecera del mensaje que ve el cliente.
 */
export function repartirDestinatarios(opts: {
  to:   (string | null | undefined)[]
  cc?:  (string | null | undefined)[]
  bcc?: (string | null | undefined)[]
}): { to: string[]; cc: string[]; bcc: string[] } {
  const vistos = new Set<string>()

  const limpiar = (lista: (string | null | undefined)[] = []): string[] => {
    const salida: string[] = []
    for (const bruto of lista) {
      const email = bruto?.trim()
      if (!email) continue
      const clave = norm(email)
      if (vistos.has(clave)) continue
      vistos.add(clave)
      salida.push(email)
    }
    return salida
  }

  // El orden de las llamadas ES la prioridad: `to` reserva primero.
  const to  = limpiar(opts.to)
  const cc  = limpiar(opts.cc)
  const bcc = limpiar(opts.bcc)
  return { to, cc, bcc }
}

// ── Factura ───────────────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Destinatarios de un correo de factura (emitir y reenviar).
 *
 *  - Los socios van SIEMPRE en copia, también en las facturas a proveedor.
 *  - Los otros clientes del proyecto solo entran si la factura va a cliente: en una
 *    factura a proveedor se descartan aunque lleguen en la petición.
 *  - Los correos añadidos a mano (Para/CC/CCO) se respetan en los dos casos. Lo que
 *    impide que un cliente reciba una factura a proveedor es `guardCliente`, que
 *    corre después sobre esta misma lista.
 */
export function destinatariosFactura(o: {
  principal:        string
  esParaProveedor:  boolean
  partners:         string[]
  extras?:          { email: string; tipo: 'to' | 'cc' | 'bcc' }[]
  clientesAdicionales?: { email: string | null; email_cc: string | null }[]
}): { to: string[]; cc: string[]; bcc: string[] } {
  const extras = (o.extras ?? []).filter(e => e.email?.trim())
  const de = (tipo: 'to' | 'cc' | 'bcc') => extras.filter(e => e.tipo === tipo).map(e => e.email.trim())
  const adicionales = o.esParaProveedor ? [] : (o.clientesAdicionales ?? [])

  return repartirDestinatarios({
    to:  [o.principal, ...de('to'),  ...adicionales.map(c => c.email)],
    cc:  [...o.partners, ...de('cc'), ...adicionales.map(c => c.email_cc)],
    bcc: de('bcc'),
  })
}

/** Emails mal escritos de una lista, para rechazar el envío antes de llamar a Resend. */
export function emailsInvalidos(emails: (string | null | undefined)[]): string[] {
  return emails.map(e => e?.trim() ?? '').filter(e => e && !EMAIL_RE.test(e))
}

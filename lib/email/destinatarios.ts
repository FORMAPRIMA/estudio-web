/**
 * Quién recibe qué. Un solo sitio para las reglas de destinatarios internos.
 *
 * Antes cada endpoint resolvía su propia copia a socios con una consulta inline, y
 * ninguna copia era igual: unas deduplicaban contra los destinatarios, otras no;
 * unas añadían al remitente, otras no. Cuando alguien entra o sale del estudio, o
 * cuando cambia la regla, el sitio donde se toca es este.
 *
 * Solo servidor: importa el cliente admin de Supabase.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// Las reglas puras de reparto viven en `reparto.ts` para que el navegador pueda
// usarlas (la revisión final enseña exactamente lo que se enviará). Se reexportan
// aquí para que los endpoints sigan importando de un solo sitio.
export { repartirDestinatarios, destinatariosFactura, emailsInvalidos, EMAIL_RE } from './reparto'

// ── Buzones fijos ─────────────────────────────────────────────────────────────

/** Leads de la web: los atiende Ana (biz dev); contacto@ queda como buzón del estudio. */
export const LEADS_TO = ['aalban@formaprima.es', 'contacto@formaprima.es']

/** Buzón general del estudio, para avisos que no tienen un responsable concreto. */
export const TEAM_EMAIL = 'contacto@formaprima.es'

// ── Socios ────────────────────────────────────────────────────────────────────

export interface PartnerCC {
  nombre: string
  email:  string
}

/**
 * Socios (`fp_partner`) con nombre y email. La versión con nombre la usa la UI para
 * enseñar de antemano quién va a ir en copia.
 *
 * Solo `fp_partner` a propósito: facturación y propuestas llevan información
 * sensible que no debe llegar a managers ni al resto del equipo.
 */
export async function getPartnersCCDetallado(): Promise<PartnerCC[]> {
  try {
    const admin = createAdminClient()
    // Ojo: la columna es `apellido` (singular). Con `apellidos` la consulta fallaba,
    // el catch devolvía [] y ningún correo llevaba a los socios en copia (17 sep – 13 oct 2026).
    const { data, error } = await admin
      .from('profiles')
      .select('nombre, apellido, email')
      .eq('rol', 'fp_partner')
    if (error) {
      console.error('[destinatarios] no se pudieron leer los socios', error.message)
      return []
    }
    return (data ?? [])
      .filter((p: { email: string | null }) => !!p.email)
      .map((p: { nombre: string | null; apellido: string | null; email: string }) => ({
        nombre: [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || p.email,
        email:  p.email,
      }))
  } catch (err) {
    console.error('[destinatarios] no se pudieron leer los socios', err)
    return []
  }
}

/**
 * Para correos de factura: los socios van SIEMPRE en copia. Si no se pueden leer,
 * no se envía (mejor un error visible que una factura que sale sin ellos).
 */
export const SIN_SOCIOS_ERROR = 'No se han podido cargar los socios para ponerlos en copia. No se ha enviado nada; inténtalo de nuevo.'

/** Emails de los socios, para poner en copia lo que sale del estudio. */
export async function getPartnersCC(): Promise<string[]> {
  return (await getPartnersCCDetallado()).map(p => p.email)
}

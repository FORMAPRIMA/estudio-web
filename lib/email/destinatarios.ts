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
    const { data } = await admin
      .from('profiles')
      .select('nombre, apellidos, email')
      .eq('rol', 'fp_partner')
    return (data ?? [])
      .filter((p: { email: string | null }) => !!p.email)
      .map((p: { nombre: string | null; apellidos: string | null; email: string }) => ({
        nombre: [p.nombre, p.apellidos].filter(Boolean).join(' ').trim() || p.email,
        email:  p.email,
      }))
  } catch {
    return []
  }
}

/** Emails de los socios, para poner en copia lo que sale del estudio. */
export async function getPartnersCC(): Promise<string[]> {
  return (await getPartnersCCDetallado()).map(p => p.email)
}

// ── Reglas de reparto ─────────────────────────────────────────────────────────

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

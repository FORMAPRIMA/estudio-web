// Lectura de un Espacio por su token y comprobación de acceso. Solo servidor y
// a propósito FUERA de un fichero 'use server': todo lo exportado desde uno es
// un endpoint público. Aquí van el pin_hash y la regla del PIN.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { requierePin, type Etapa } from '@/lib/espacio/theme'
import {
  generateEspacioCookieToken,
  espacioCookieName,
  generatePresentationCookieToken,
  presentationCookieName,
} from '@/lib/espacio/access'
import type { EspacioRow } from '@/app/actions/espacios'

export async function leerEspacioPorToken(token: string): Promise<EspacioRow | null> {
  if (!token || token.length < 16) return null
  try {
    const { data, error } = await createAdminClient().from('espacios').select('*').eq('token', token).single()
    if (error || !data) return null
    return data as unknown as EspacioRow
  } catch {
    return null
  }
}

/**
 * El Espacio, si quien pregunta tiene derecho a verlo: sin PIN en las etapas que
 * no lo piden (bienvenida); a partir de la propuesta, con la cookie del cliente
 * o la de modo presentación de ESTE Espacio. Si no, null.
 */
export async function accesoEspacio(token: string): Promise<EspacioRow | null> {
  const e = await leerEspacioPorToken(token)
  if (!e) return null
  if (!requierePin((e.etapa ?? 'bienvenida') as Etapa)) return e
  const c = cookies()
  const cliente = c.get(espacioCookieName(token))?.value === generateEspacioCookieToken(token)
  const presentacion = c.get(presentationCookieName(token))?.value === generatePresentationCookieToken(token)
  return cliente || presentacion ? e : null
}

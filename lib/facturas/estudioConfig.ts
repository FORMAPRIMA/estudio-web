// Datos fiscales y bancarios del estudio (IBAN, SWIFT, NIF). Lectura interna
// de servidor —fuera de 'use server'— para rutas y generadores de PDF que ya
// han comprobado quién pide (incluido el portal del gestor, que va por token).
// La acción pública getEstudioConfig exige ser socio.

import { createAdminClient } from '@/lib/supabase/admin'
import type { EstudioConfig } from '@/app/actions/facturasEmitidas'

export async function leerEstudioConfig(): Promise<EstudioConfig | null> {
  const { data } = await createAdminClient().from('estudio_config').select('*').eq('id', 1).single()
  return data as EstudioConfig | null
}

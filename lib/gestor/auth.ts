import type { SupabaseClient } from '@supabase/supabase-js'

export interface GestorTokenRow {
  id: string
  token: string
  label: string | null
  created_at: string
  revoked_at: string | null
  last_access: string | null
}

/** Valida un token del portal del gestor. Devuelve la fila si es válido y no está revocado. */
export async function validateGestorToken(
  admin: SupabaseClient,
  token: string
): Promise<GestorTokenRow | null> {
  if (!token || token.length < 20) return null
  const { data } = await admin
    .from('gestor_tokens')
    .select('*')
    .eq('token', token)
    .is('revoked_at', null)
    .single()
  if (!data) return null

  // Registrar último acceso (best-effort)
  admin.from('gestor_tokens')
    .update({ last_access: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {})

  return data as GestorTokenRow
}

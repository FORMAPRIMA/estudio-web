import type { SupabaseClient } from '@supabase/supabase-js'
import type { RepasoToken } from './domain'

/**
 * Valida un token de acceso externo a los repasos de un proyecto.
 * Devuelve la fila si existe y no está revocado. Registra el acceso (best-effort).
 */
export async function validateRepasoToken(
  admin: SupabaseClient,
  token: string
): Promise<RepasoToken | null> {
  if (!token || token.length < 20) return null

  const { data } = await admin
    .from('repaso_tokens')
    .select('*')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle()

  if (!data) return null

  admin
    .from('repaso_tokens')
    .update({
      last_access: new Date().toISOString(),
      access_count: (data.access_count ?? 0) + 1,
    })
    .eq('id', data.id)
    .then(() => {}, () => {})

  return data as RepasoToken
}

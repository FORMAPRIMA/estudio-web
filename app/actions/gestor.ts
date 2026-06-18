'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const PATH = '/team/finanzas/gestor'

export interface GestorToken {
  id: string
  token: string
  label: string | null
  created_at: string
  revoked_at: string | null
  last_access: string | null
}

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Solo partners pueden acceder.')
  return user
}

// ── createGestorToken ─────────────────────────────────────────────────────────

export async function createGestorToken(
  label: string
): Promise<{ token: GestorToken } | { error: string }> {
  try {
    const user = await requirePartner()
    const admin = createAdminClient()

    const token = randomBytes(24).toString('base64url')
    const { data, error } = await admin
      .from('gestor_tokens')
      .insert({ token, label: label.trim() || null, created_by: user.id })
      .select('*')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { token: data as GestorToken }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── revokeGestorToken ─────────────────────────────────────────────────────────

export async function revokeGestorToken(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('gestor_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── getGestorTokens ───────────────────────────────────────────────────────────

export async function getGestorTokens(): Promise<GestorToken[] | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('gestor_tokens')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { error: error.message }
    return (data ?? []) as GestorToken[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

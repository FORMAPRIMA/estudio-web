'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/fp-execution/partners'

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    throw new Error('Sin permisos.')
}

// ── Partners ──────────────────────────────────────────────────────────────────

export async function createPartner(data: {
  nombre: string
  razon_social?: string | null
  nif_cif?: string | null
  contacto_nombre?: string | null
  email_contacto?: string | null
  email_notificaciones?: string | null
  email_facturacion?: string | null
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  codigo_postal?: string | null
  pais?: string
  iban?: string | null
  notas?: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('fpe_partners')
      .insert({ ...data, pais: data.pais ?? 'España' })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePartner(
  id: string,
  data: {
    nombre?: string
    razon_social?: string | null
    nif_cif?: string | null
    contacto_nombre?: string | null
    email_contacto?: string | null
    email_notificaciones?: string | null
    email_facturacion?: string | null
    telefono?: string | null
    direccion?: string | null
    ciudad?: string | null
    codigo_postal?: string | null
    pais?: string
    iban?: string | null
    notas?: string | null
    activo?: boolean
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_partners')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deletePartner(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('fpe_partners').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Capabilities ──────────────────────────────────────────────────────────────
// Replaces the full capabilities set for a partner (delete-all + re-insert)

export async function setPartnerCapabilities(
  partner_id: string,
  unit_ids: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Delete all existing capabilities for this partner
    const { error: delErr } = await admin
      .from('fpe_partner_capabilities')
      .delete()
      .eq('partner_id', partner_id)
    if (delErr) return { error: delErr.message }

    // Re-insert the new set
    if (unit_ids.length > 0) {
      const rows = unit_ids.map(unit_id => ({ partner_id, unit_id }))
      const { error: insErr } = await admin.from('fpe_partner_capabilities').insert(rows)
      if (insErr) return { error: insErr.message }
    }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CreateDdAssetInput, UpdateDdAssetInput,
  CreateDdVisitInput, UpdateDdVisitInput,
  UpdateDdCardFieldInput, UpdateDdCardBackofficeInput,
  UpdateDdCardGuideInput,
} from '@/lib/dd-visits/domain'

const BASE = '/team/apps/dd-visits'

// ─── Guards ───────────────────────────────────────────────────────────────────

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  const FP_ROLES = ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev']
  if (!profile || !FP_ROLES.includes(profile.rol)) throw new Error('Sin permisos.')
  return { user, rol: profile.rol as string }
}

async function requireManagerOrPartner() {
  const { user, rol } = await requireAnyFP()
  if (!['fp_partner', 'fp_manager'].includes(rol)) throw new Error('Sin permisos suficientes.')
  return { user, rol }
}

// ─── Activos ──────────────────────────────────────────────────────────────────

export async function createDdAsset(input: CreateDdAssetInput): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin.from('dd_assets').insert(input).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(BASE)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateDdAsset(id: string, input: UpdateDdAssetInput): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_assets')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(BASE)
    revalidatePath(`${BASE}/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteDdAsset(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_assets').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(BASE)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Visitas ──────────────────────────────────────────────────────────────────

export async function createDdVisit(input: CreateDdVisitInput): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin.from('dd_visits').insert(input).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${input.asset_id}`)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateDdVisit(
  id: string,
  assetId: string,
  input: UpdateDdVisitInput,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_visits')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}`)
    revalidatePath(`${BASE}/${assetId}/visita/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Equipo de visita ─────────────────────────────────────────────────────────

export async function addDdVisitTeamMember(
  visitId: string,
  assetId: string,
  rolId: string,
  nombreDisplay: string,
  userId?: string,
): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin.from('dd_visit_team').insert({
      visit_id: visitId,
      rol_id: rolId,
      nombre_display: nombreDisplay,
      user_id: userId ?? null,
    }).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}/visita/${visitId}`)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function removeDdVisitTeamMember(
  memberId: string,
  visitId: string,
  assetId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_visit_team').delete().eq('id', memberId)
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}/visita/${visitId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Cards — campo ────────────────────────────────────────────────────────────

export async function updateDdCardField(
  cardId: string,
  assetId: string,
  visitId: string,
  input: UpdateDdCardFieldInput,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_cards')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', cardId)
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}/visita/${visitId}/mi-revision`)
    revalidatePath(`${BASE}/${assetId}/visita/${visitId}/mi-revision/${cardId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Cards — backoffice ───────────────────────────────────────────────────────

export async function updateDdCardBackoffice(
  cardId: string,
  assetId: string,
  input: UpdateDdCardBackofficeInput,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_cards')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', cardId)
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}/revision-interna`)
    revalidatePath(`${BASE}/${assetId}/report`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Cards — guía (admin) ─────────────────────────────────────────────────────

export async function updateDdCardGuide(
  cardId: string,
  assetId: string,
  input: UpdateDdCardGuideInput,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_cards')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', cardId)
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function createDdCard(
  assetId: string,
  visitId: string,
  rolId: string,
  titulo: string,
  orden: number,
): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin.from('dd_cards').insert({
      asset_id: assetId,
      visit_id: visitId,
      rol_id: rolId,
      titulo,
      orden,
    }).select('id').single()
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}/visita/${visitId}`)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Media ────────────────────────────────────────────────────────────────────

export async function addDdCardMedia(
  cardId: string,
  assetId: string,
  visitId: string | null,
  tipo: 'foto' | 'video',
  url: string,
  storagePath: string,
  caption?: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const { user } = await requireAnyFP()
    const admin = createAdminClient()
    const { data, error } = await admin.from('dd_card_media').insert({
      card_id: cardId,
      asset_id: assetId,
      visit_id: visitId,
      tipo,
      url,
      storage_path: storagePath,
      caption: caption ?? null,
      user_id: user.id,
    }).select('id').single()
    if (error) return { error: error.message }
    if (visitId) {
      revalidatePath(`${BASE}/${assetId}/visita/${visitId}/mi-revision/${cardId}`)
    }
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteDdCardMedia(
  mediaId: string,
  assetId: string,
  visitId: string | null,
  cardId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { data: media } = await admin.from('dd_card_media').select('storage_path').eq('id', mediaId).single()
    if (media?.storage_path) {
      await admin.storage.from('dd-visits').remove([media.storage_path])
    }
    const { error } = await admin.from('dd_card_media').delete().eq('id', mediaId)
    if (error) return { error: error.message }
    if (visitId) {
      revalidatePath(`${BASE}/${assetId}/visita/${visitId}/mi-revision/${cardId}`)
    }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Documentación del activo ─────────────────────────────────────────────────

export async function addDdAssetDoc(
  assetId: string,
  nombre: string,
  tipo: 'recibida' | 'pendiente',
  notas?: string,
): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin.from('dd_asset_docs')
      .insert({ asset_id: assetId, nombre, tipo, notas: notas ?? null })
      .select('id').single()
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}`)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteDdAssetDoc(
  docId: string,
  assetId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('dd_asset_docs').delete().eq('id', docId)
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${assetId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

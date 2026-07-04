'use server'

// Server Actions de Urban Analyst (/team/apps/urban-analyst) — solo fp_partner.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  UrbanAsset, UrbanLayerHit, UrbanRedFlag, UrbanAnalysisRow,
  UrbanScenario, UrbanChatMessage, UrbanDocument, NormaZonal,
} from '@/lib/urban-analyst/types'

async function requirePartner(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return user.id
}

const BASE_PATH = '/team/apps/urban-analyst'

// ── Activos ──────────────────────────────────────────────────────────────────

export interface CreateUrbanAssetInput {
  nombre?: string
  direccion?: string
  refcat?: string
  refcats?: string[]          // referencias adicionales (edificio multi-parcela)
  tipo_operacion?: string
  uso_actual?: string
  uso_objetivo?: string
  superficie_comercial?: number | null
  precio_compra?: number | null
  capex_estimado?: number | null
  notas?: string
}

export async function createUrbanAsset(input: CreateUrbanAssetInput): Promise<{ id: string }> {
  const userId = await requirePartner()
  if (!input.direccion?.trim() && !input.refcat?.trim()) {
    throw new Error('Indica al menos una dirección o una referencia catastral.')
  }
  // El nombre es opcional: se deriva de la dirección o la refcat
  const nombre = input.nombre?.trim()
    || input.direccion?.trim()
    || `RC ${input.refcat?.trim().toUpperCase().slice(0, 14)}`
  const admin = createAdminClient()
  const row: Record<string, unknown> = {
      nombre,
      direccion: input.direccion?.trim() || null,
      refcat: input.refcat?.trim().toUpperCase().slice(0, 14) || null,
      refcats: (input.refcats || []).map((r) => r.trim().toUpperCase().slice(0, 14)).filter(Boolean),
      tipo_operacion: input.tipo_operacion || null,
      uso_actual: input.uso_actual || null,
      uso_objetivo: input.uso_objetivo || null,
      superficie_comercial: input.superficie_comercial ?? null,
      precio_compra: input.precio_compra ?? null,
      capex_estimado: input.capex_estimado ?? null,
      notas: input.notas?.trim() || null,
      created_by: userId,
  }

  let res = await admin.from('urban_assets').insert(row).select('id').single()
  // Compatibilidad: si la migración de refcats aún no se ha ejecutado,
  // reintentar sin esa columna (el multi-parcela queda desactivado)
  if (res.error && /refcats/i.test(res.error.message)) {
    const { refcats: _r, ...sinRefcats } = row
    res = await admin.from('urban_assets').insert(sinRefcats).select('id').single()
  }
  if (res.error || !res.data) throw new Error(`No se pudo crear el activo: ${res.error?.message}`)
  revalidatePath(BASE_PATH)
  return { id: res.data.id as string }
}

export async function updateUrbanAsset(id: string, patch: Partial<CreateUrbanAssetInput>): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  let { error } = await admin.from('urban_assets').update(patch).eq('id', id)
  if (error && /refcats/i.test(error.message) && 'refcats' in patch) {
    const { refcats: _r, ...sinRefcats } = patch
    ;({ error } = await admin.from('urban_assets').update(sinRefcats).eq('id', id))
  }
  if (error) throw new Error(error.message)
  revalidatePath(`${BASE_PATH}/${id}`)
}

export async function deleteUrbanAsset(id: string): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin.from('urban_assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(BASE_PATH)
}

export async function getUrbanAssets(): Promise<UrbanAsset[]> {
  await requirePartner()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('urban_assets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []) as UrbanAsset[]
}

export interface UrbanAssetFull {
  asset: UrbanAsset
  hits: UrbanLayerHit[]
  redFlags: UrbanRedFlag[]
  analysis: UrbanAnalysisRow[]
  scenarios: UrbanScenario[]
  chat: UrbanChatMessage[]
  documents: UrbanDocument[]
}

export async function getUrbanAssetFull(id: string): Promise<UrbanAssetFull | null> {
  await requirePartner()
  const admin = createAdminClient()
  const { data: asset, error } = await admin.from('urban_assets').select('*').eq('id', id).single()
  if (error || !asset) return null

  const [hits, flags, analysis, scenarios, chat, documents] = await Promise.all([
    admin.from('urban_layer_hits').select('*').eq('asset_id', id).order('fetched_at'),
    admin.from('urban_red_flags').select('*').eq('asset_id', id).order('created_at'),
    admin.from('urban_analysis').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
    admin.from('urban_scenarios').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
    admin.from('urban_chat_messages').select('*').eq('asset_id', id).order('created_at'),
    admin.from('urban_documents').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
  ])

  return {
    asset: asset as UrbanAsset,
    hits: (hits.data || []) as UrbanLayerHit[],
    redFlags: (flags.data || []) as UrbanRedFlag[],
    analysis: (analysis.data || []) as UrbanAnalysisRow[],
    scenarios: (scenarios.data || []) as UrbanScenario[],
    chat: (chat.data || []) as UrbanChatMessage[],
    documents: (documents.data || []) as UrbanDocument[],
  }
}

/** Estado ligero para el polling del pipeline mientras se analiza. */
export async function getUrbanAssetStatus(id: string): Promise<Pick<UrbanAsset, 'id' | 'status' | 'pipeline' | 'error_msg'> | null> {
  await requirePartner()
  const admin = createAdminClient()
  const { data } = await admin
    .from('urban_assets')
    .select('id, status, pipeline, error_msg')
    .eq('id', id)
    .single()
  return (data as Pick<UrbanAsset, 'id' | 'status' | 'pipeline' | 'error_msg'>) || null
}

// ── Documentos ───────────────────────────────────────────────────────────────

export async function createUrbanDocument(input: {
  asset_id: string
  nombre: string
  tipo?: string
  file_url: string
  parsed_text?: string | null
}): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin.from('urban_documents').insert({
    asset_id: input.asset_id,
    nombre: input.nombre,
    tipo: input.tipo || 'otro',
    file_url: input.file_url,
    parsed_text: input.parsed_text || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`${BASE_PATH}/${input.asset_id}`)
}

export async function deleteUrbanDocument(id: string, assetId: string): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin.from('urban_documents').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`${BASE_PATH}/${assetId}`)
}

// ── Escenarios ───────────────────────────────────────────────────────────────

export async function createUrbanScenario(input: {
  asset_id: string
  nombre: string
  tipo: string
  descripcion?: string
}): Promise<{ id: string }> {
  await requirePartner()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('urban_scenarios')
    .insert({
      asset_id: input.asset_id,
      nombre: input.nombre,
      tipo: input.tipo,
      descripcion: input.descripcion || null,
      status: 'pendiente',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}

export async function deleteUrbanScenario(id: string, assetId: string): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin.from('urban_scenarios').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`${BASE_PATH}/${assetId}`)
}

// ── Normas zonales (tabla curada editable) ───────────────────────────────────

export async function getNormasZonales(): Promise<NormaZonal[]> {
  await requirePartner()
  const admin = createAdminClient()
  const { data, error } = await admin.from('urban_normas_zonales').select('*').order('codigo')
  if (error) throw new Error(error.message)
  return (data || []) as NormaZonal[]
}

export async function updateNormaZonal(codigo: string, patch: {
  coef_edificabilidad?: number | null
  altura_max_plantas?: number | null
  uso_cualificado?: string | null
  condiciones?: string | null
  notas?: string | null
  verificado?: boolean
}): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('urban_normas_zonales')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('codigo', codigo)
  if (error) throw new Error(error.message)
}

/** Crea un grado específico (p. ej. '5.2') heredando de la norma base. */
export async function createNormaZonalGrado(codigo: string, nombre: string): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin.from('urban_normas_zonales').insert({ codigo, nombre })
  if (error) throw new Error(error.message)
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export async function clearUrbanChat(assetId: string): Promise<void> {
  await requirePartner()
  const admin = createAdminClient()
  const { error } = await admin.from('urban_chat_messages').delete().eq('asset_id', assetId)
  if (error) throw new Error(error.message)
  revalidatePath(`${BASE_PATH}/${assetId}`)
}

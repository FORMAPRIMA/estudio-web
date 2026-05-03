'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/memorias-calidad/warehouse'

export type NivelCalidadWarehouse = 'functional' | 'select' | 'master_piece'

export interface WarehouseItem {
  id: string
  template_line_item_id: string
  nombre: string
  nivel_calidad: NivelCalidadWarehouse
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  imagen_principal_url: string | null
  imagen_lifestyle_url: string | null
  imagenes_adicionales: string[]
  ficha_tecnica_url: string | null
  precio_referencia: number | null
  moneda: string
  proveedor_preferente_id: string | null
  acabados: string[]
  dimensiones: Record<string, unknown>
  data: Record<string, unknown>
  tags: string[]
  incluir_en_plantilla: boolean
  activo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WarehouseItemInput {
  template_line_item_id: string
  nombre: string
  nivel_calidad: NivelCalidadWarehouse
  marca?: string | null
  modelo?: string | null
  referencia?: string | null
  descripcion?: string | null
  imagen_principal_url?: string | null
  imagen_lifestyle_url?: string | null
  imagenes_adicionales?: string[]
  ficha_tecnica_url?: string | null
  precio_referencia?: number | null
  moneda?: string
  proveedor_preferente_id?: string | null
  acabados?: string[]
  dimensiones?: Record<string, unknown>
  data?: Record<string, unknown>
  tags?: string[]
  incluir_en_plantilla?: boolean
  activo?: boolean
}

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

async function requireFpStaff(): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) throw new Error('Sin permisos.')
  return { userId: user.id }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createWarehouseItem(
  input: WarehouseItemInput
): Promise<{ id: string } | { error: string }> {
  try {
    const { userId } = await requireFpStaff()
    if (!input.nombre?.trim()) return { error: 'El nombre es obligatorio.' }
    if (!input.template_line_item_id) return { error: 'La partida es obligatoria.' }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('warehouse_items')
      .insert({
        template_line_item_id: input.template_line_item_id,
        nombre: input.nombre.trim(),
        nivel_calidad: input.nivel_calidad,
        marca: input.marca?.trim() || null,
        modelo: input.modelo?.trim() || null,
        referencia: input.referencia?.trim() || null,
        descripcion: input.descripcion?.trim() || null,
        imagen_principal_url: input.imagen_principal_url || null,
        imagen_lifestyle_url: input.imagen_lifestyle_url || null,
        imagenes_adicionales: input.imagenes_adicionales ?? [],
        ficha_tecnica_url: input.ficha_tecnica_url || null,
        precio_referencia: input.precio_referencia ?? null,
        moneda: input.moneda ?? 'EUR',
        proveedor_preferente_id: input.proveedor_preferente_id ?? null,
        acabados: input.acabados ?? [],
        dimensiones: input.dimensiones ?? {},
        data: input.data ?? {},
        tags: input.tags ?? [],
        incluir_en_plantilla: input.incluir_en_plantilla ?? true,
        activo: input.activo ?? true,
        created_by: userId,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateWarehouseItem(
  id: string,
  input: Partial<WarehouseItemInput>
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.template_line_item_id !== undefined) patch.template_line_item_id = input.template_line_item_id
    if (input.nombre !== undefined) patch.nombre = input.nombre.trim()
    if (input.nivel_calidad !== undefined) patch.nivel_calidad = input.nivel_calidad
    if (input.marca !== undefined) patch.marca = input.marca?.trim() || null
    if (input.modelo !== undefined) patch.modelo = input.modelo?.trim() || null
    if (input.referencia !== undefined) patch.referencia = input.referencia?.trim() || null
    if (input.descripcion !== undefined) patch.descripcion = input.descripcion?.trim() || null
    if (input.imagen_principal_url !== undefined) patch.imagen_principal_url = input.imagen_principal_url || null
    if (input.imagen_lifestyle_url !== undefined) patch.imagen_lifestyle_url = input.imagen_lifestyle_url || null
    if (input.imagenes_adicionales !== undefined) patch.imagenes_adicionales = input.imagenes_adicionales
    if (input.ficha_tecnica_url !== undefined) patch.ficha_tecnica_url = input.ficha_tecnica_url || null
    if (input.precio_referencia !== undefined) patch.precio_referencia = input.precio_referencia
    if (input.moneda !== undefined) patch.moneda = input.moneda
    if (input.proveedor_preferente_id !== undefined) patch.proveedor_preferente_id = input.proveedor_preferente_id
    if (input.acabados !== undefined) patch.acabados = input.acabados
    if (input.dimensiones !== undefined) patch.dimensiones = input.dimensiones
    if (input.data !== undefined) patch.data = input.data
    if (input.tags !== undefined) patch.tags = input.tags
    if (input.incluir_en_plantilla !== undefined) patch.incluir_en_plantilla = input.incluir_en_plantilla
    if (input.activo !== undefined) patch.activo = input.activo

    const { error } = await admin.from('warehouse_items').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteWarehouseItem(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    const { error } = await admin.from('warehouse_items').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

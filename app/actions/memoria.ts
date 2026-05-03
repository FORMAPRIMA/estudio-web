'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/memorias-calidad/proyectos'

export type EstadoDefinicion = 'orientativo' | 'confirmado' | 'descartado'
export type EstadoCompra = 'pendiente' | 'pedido' | 'en_transito' | 'recibido' | 'instalado'

export interface MemoriaItem {
  id: string
  proyecto_id: string
  warehouse_item_id: string | null
  template_line_item_id: string
  nombre: string
  nivel_calidad: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  imagen_principal_url: string | null
  imagen_lifestyle_url: string | null
  precio_referencia: number | null
  moneda: string
  proveedor_preferente_id: string | null
  acabados: string[]
  estado_definicion: EstadoDefinicion
  notas: string | null
  // ejecutivo fields
  cantidad: number | null
  ubicaciones: string[]
  acabado_seleccionado: string | null
  orden: number
  activo: boolean
  estado_compra: EstadoCompra
  url_producto: string | null
  created_at: string
  updated_at: string
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

// ── Init ───────────────────────────────────────────────────────────────────────

export async function initMemoriaFromWarehouse(
  proyecto_id: string
): Promise<{ count: number } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const { data: proyecto } = await admin
      .from('proyectos')
      .select('nivel_calidad')
      .eq('id', proyecto_id)
      .single()

    if (!proyecto?.nivel_calidad)
      return { error: 'El proyecto no tiene nivel de calidad asignado.' }

    const { count: existing } = await admin
      .from('proyecto_memoria_items')
      .select('id', { count: 'exact', head: true })
      .eq('proyecto_id', proyecto_id)
      .eq('activo', true)

    if (existing && existing > 0)
      return { error: 'La memoria ya está inicializada. Usa "Sincronizar" para añadir items nuevos.' }

    const { data: items } = await admin
      .from('warehouse_items')
      .select('*')
      .eq('nivel_calidad', proyecto.nivel_calidad)
      .eq('incluir_en_plantilla', true)
      .eq('activo', true)
      .order('orden', { ascending: true })

    if (!items || items.length === 0)
      return { error: 'No hay items en el warehouse para este nivel de calidad.' }

    const inserts = items.map((item, i) => ({
      proyecto_id,
      warehouse_item_id: item.id,
      template_line_item_id: item.template_line_item_id,
      nombre: item.nombre,
      nivel_calidad: item.nivel_calidad,
      marca: item.marca,
      modelo: item.modelo,
      referencia: item.referencia,
      descripcion: item.descripcion,
      imagen_principal_url: item.imagen_principal_url,
      imagen_lifestyle_url: item.imagen_lifestyle_url,
      precio_referencia: item.precio_referencia,
      moneda: item.moneda ?? 'EUR',
      proveedor_preferente_id: item.proveedor_preferente_id,
      acabados: item.acabados ?? [],
      estado_definicion: 'orientativo' as const,
      orden: i,
    }))

    const { error } = await admin.from('proyecto_memoria_items').insert(inserts)
    if (error) return { error: error.message }

    revalidatePath(`${PATH}/${proyecto_id}`)
    return { count: inserts.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Sync: adds warehouse items that aren't yet in the memoria (doesn't touch existing ones)
export async function syncMemoriaFromWarehouse(
  proyecto_id: string
): Promise<{ added: number } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const { data: proyecto } = await admin
      .from('proyectos')
      .select('nivel_calidad')
      .eq('id', proyecto_id)
      .single()

    if (!proyecto?.nivel_calidad) return { error: 'El proyecto no tiene nivel de calidad.' }

    const [{ data: warehouseItems }, { data: existing }] = await Promise.all([
      admin
        .from('warehouse_items')
        .select('*')
        .eq('nivel_calidad', proyecto.nivel_calidad)
        .eq('incluir_en_plantilla', true)
        .eq('activo', true),
      admin
        .from('proyecto_memoria_items')
        .select('warehouse_item_id')
        .eq('proyecto_id', proyecto_id),
    ])

    const existingIds = new Set((existing ?? []).map(e => e.warehouse_item_id).filter(Boolean))
    const newItems = (warehouseItems ?? []).filter(w => !existingIds.has(w.id))

    if (newItems.length === 0) return { added: 0 }

    const inserts = newItems.map((item, i) => ({
      proyecto_id,
      warehouse_item_id: item.id,
      template_line_item_id: item.template_line_item_id,
      nombre: item.nombre,
      nivel_calidad: item.nivel_calidad,
      marca: item.marca,
      modelo: item.modelo,
      referencia: item.referencia,
      descripcion: item.descripcion,
      imagen_principal_url: item.imagen_principal_url,
      imagen_lifestyle_url: item.imagen_lifestyle_url,
      precio_referencia: item.precio_referencia,
      moneda: item.moneda ?? 'EUR',
      proveedor_preferente_id: item.proveedor_preferente_id,
      acabados: item.acabados ?? [],
      estado_definicion: 'orientativo' as const,
      orden: 9000 + i,
    }))

    const { error } = await admin.from('proyecto_memoria_items').insert(inserts)
    if (error) return { error: error.message }

    revalidatePath(`${PATH}/${proyecto_id}`)
    return { added: inserts.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function updateMemoriaItem(
  id: string,
  data: {
    estado_definicion?: EstadoDefinicion
    notas?: string | null
    nombre?: string
    descripcion?: string | null
    marca?: string | null
    modelo?: string | null
    referencia?: string | null
    precio_referencia?: number | null
    imagen_principal_url?: string | null
    imagen_lifestyle_url?: string | null
    // ejecutivo fields
    cantidad?: number | null
    ubicaciones?: string[]
    acabado_seleccionado?: string | null
    // compra fields
    estado_compra?: EstadoCompra
    // F7
    url_producto?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyecto_memoria_items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteMemoriaItem(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyecto_memoria_items')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── FPE Bridge ─────────────────────────────────────────────────────────────────

export async function syncMemoriaToFpe(
  proyecto_id: string
): Promise<{ fpe_project_id: string; units_created: number; items_synced: number } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    // Confirmed items with cantidad
    const { data: items } = await admin
      .from('proyecto_memoria_items')
      .select('id, template_line_item_id, cantidad')
      .eq('proyecto_id', proyecto_id)
      .eq('estado_definicion', 'confirmado')
      .eq('activo', true)

    if (!items || items.length === 0)
      return { error: 'No hay productos confirmados para exportar.' }

    // template_line_item_id → unit_id
    const lineItemIds = Array.from(new Set(items.map(i => i.template_line_item_id)))
    const { data: templateItems } = await admin
      .from('fpe_template_line_items')
      .select('id, unit_id')
      .in('id', lineItemIds)

    const lineItemUnitMap: Record<string, string> = {}
    for (const ti of templateItems ?? []) lineItemUnitMap[ti.id] = ti.unit_id

    // Get proyecto name for fpe_project creation
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('nombre')
      .eq('id', proyecto_id)
      .single()

    // Get or create linked fpe_project
    const { data: existingFpe } = await admin
      .from('fpe_projects')
      .select('id')
      .eq('linked_proyecto_id', proyecto_id)
      .maybeSingle()

    let fpe_project_id: string
    if (existingFpe) {
      fpe_project_id = existingFpe.id
    } else {
      const { data: newFpe, error: createErr } = await admin
        .from('fpe_projects')
        .insert({ nombre: proyecto?.nombre ?? 'Proyecto', linked_proyecto_id: proyecto_id })
        .select('id')
        .single()
      if (createErr || !newFpe) return { error: createErr?.message ?? 'Error creando proyecto FPE.' }
      fpe_project_id = newFpe.id
    }

    // Ensure fpe_project_units exist for each relevant template unit
    const unitIds = Array.from(new Set(Object.values(lineItemUnitMap)))
    const { data: existingUnits } = await admin
      .from('fpe_project_units')
      .select('id, template_unit_id')
      .eq('project_id', fpe_project_id)
      .in('template_unit_id', unitIds)

    const unitMap: Record<string, string> = {}
    for (const pu of existingUnits ?? []) unitMap[pu.template_unit_id] = pu.id

    let units_created = 0
    for (const unitId of unitIds) {
      if (!unitMap[unitId]) {
        const { data: newUnit, error: unitErr } = await admin
          .from('fpe_project_units')
          .insert({ project_id: fpe_project_id, template_unit_id: unitId, orden: 0 })
          .select('id')
          .single()
        if (unitErr || !newUnit) return { error: unitErr?.message ?? 'Error creando unidad FPE.' }
        unitMap[unitId] = newUnit.id
        units_created++
      }
    }

    // Upsert line items with source_memoria = true
    let items_synced = 0
    for (const item of items) {
      const unit_id = lineItemUnitMap[item.template_line_item_id]
      if (!unit_id) continue
      const project_unit_id = unitMap[unit_id]
      if (!project_unit_id) continue

      const { error: liErr } = await admin
        .from('fpe_project_line_items')
        .upsert(
          {
            project_unit_id,
            template_line_item_id: item.template_line_item_id,
            cantidad: item.cantidad ?? 1,
            source_memoria: true,
          },
          { onConflict: 'project_unit_id,template_line_item_id' }
        )
      if (liErr) return { error: liErr.message }
      items_synced++
    }

    revalidatePath(`${PATH}/${proyecto_id}`)
    revalidatePath(`/team/fp-execution/projects/${fpe_project_id}`)
    return { fpe_project_id, units_created, items_synced }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { NivelCalidad, WarehouseItemInput } from '@/lib/memorias/domain'

const PATH = '/team/memorias-calidad/warehouse'

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

// ── Items del warehouse ───────────────────────────────────────────────────────

export async function createWarehouseItem(
  input: WarehouseItemInput
): Promise<{ id: string } | { error: string }> {
  try {
    const { userId } = await requireFpStaff()
    if (!input.nombre?.trim()) return { error: 'El nombre es obligatorio.' }
    if (!input.subcapitulo_id) return { error: 'El subcapítulo es obligatorio.' }

    const admin = createAdminClient()

    // El favorito es único por subcapítulo × nivel: liberamos el anterior antes de insertar
    if (input.es_favorito) {
      const { error: freeErr } = await liberarFavorito(admin, input.subcapitulo_id, input.nivel_calidad)
      if (freeErr) return { error: freeErr }
    }

    const { data, error } = await admin
      .from('warehouse_items')
      .insert({
        subcapitulo_id: input.subcapitulo_id,
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
        url_producto: input.url_producto?.trim() || null,
        precio_pvp: input.precio_pvp ?? null,
        precio_coste: input.precio_coste ?? null,
        moneda: input.moneda ?? 'EUR',
        proveedor_preferente_id: input.proveedor_preferente_id ?? null,
        acabados: input.acabados ?? [],
        dimensiones: input.dimensiones ?? {},
        data: input.data ?? {},
        tags: input.tags ?? [],
        es_favorito: input.es_favorito ?? false,
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

    // Si pasa a favorito (o cambia de subcapítulo/nivel siendo favorito), liberamos el hueco
    if (input.es_favorito) {
      const { data: actual } = await admin
        .from('warehouse_items')
        .select('subcapitulo_id, nivel_calidad')
        .eq('id', id)
        .single()
      const subcapituloId = input.subcapitulo_id ?? actual?.subcapitulo_id
      const nivel = (input.nivel_calidad ?? actual?.nivel_calidad) as NivelCalidad | undefined
      if (subcapituloId && nivel) {
        const { error: freeErr } = await liberarFavorito(admin, subcapituloId, nivel, id)
        if (freeErr) return { error: freeErr }
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.subcapitulo_id !== undefined) patch.subcapitulo_id = input.subcapitulo_id
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
    if (input.url_producto !== undefined) patch.url_producto = input.url_producto?.trim() || null
    if (input.precio_pvp !== undefined) patch.precio_pvp = input.precio_pvp
    if (input.precio_coste !== undefined) patch.precio_coste = input.precio_coste
    if (input.moneda !== undefined) patch.moneda = input.moneda
    if (input.proveedor_preferente_id !== undefined) patch.proveedor_preferente_id = input.proveedor_preferente_id
    if (input.acabados !== undefined) patch.acabados = input.acabados
    if (input.dimensiones !== undefined) patch.dimensiones = input.dimensiones
    if (input.data !== undefined) patch.data = input.data
    if (input.tags !== undefined) patch.tags = input.tags
    if (input.es_favorito !== undefined) patch.es_favorito = input.es_favorito
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

// ── Favorito FP ───────────────────────────────────────────────────────────────

/**
 * Desmarca el favorito que ocupe ese hueco (subcapítulo × nivel). El índice único
 * parcial de BD garantiza que nunca haya dos, así que hay que liberar antes de marcar.
 */
async function liberarFavorito(
  admin: ReturnType<typeof createAdminClient>,
  subcapituloId: string,
  nivel: NivelCalidad,
  exceptoId?: string
): Promise<{ error?: string }> {
  let query = admin
    .from('warehouse_items')
    .update({ es_favorito: false, updated_at: new Date().toISOString() })
    .eq('subcapitulo_id', subcapituloId)
    .eq('nivel_calidad', nivel)
    .eq('es_favorito', true)
  if (exceptoId) query = query.neq('id', exceptoId)
  const { error } = await query
  return error ? { error: error.message } : {}
}

export async function setFavorito(
  id: string,
  favorito: boolean
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const { data: item } = await admin
      .from('warehouse_items')
      .select('subcapitulo_id, nivel_calidad')
      .eq('id', id)
      .single()
    if (!item) return { error: 'Item no encontrado.' }

    if (favorito) {
      const { error: freeErr } = await liberarFavorito(admin, item.subcapitulo_id, item.nivel_calidad, id)
      if (freeErr) return { error: freeErr }
    }

    const { error } = await admin
      .from('warehouse_items')
      .update({ es_favorito: favorito, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Estructura presupuestaria (capítulos / subcapítulos) ──────────────────────

export async function createSubcapitulo(
  capitulo_id: string,
  nombre: string,
  codigo?: string
): Promise<{ id: string } | { error: string }> {
  try {
    await requireFpStaff()
    if (!nombre.trim()) return { error: 'El nombre es obligatorio.' }
    const admin = createAdminClient()

    const { data: capitulo } = await admin
      .from('presupuesto_capitulos')
      .select('numero')
      .eq('id', capitulo_id)
      .single()
    if (!capitulo) return { error: 'Capítulo no encontrado.' }

    // Código automático tipo "6_INST_10" si no se indica uno
    let finalCodigo = codigo?.trim()
    if (!finalCodigo) {
      const { data: hermanos } = await admin
        .from('presupuesto_subcapitulos')
        .select('codigo')
        .eq('capitulo_id', capitulo_id)
      const prefijos = (hermanos ?? [])
        .map(h => h.codigo.match(/^(\d+_[A-Z]+)_(\d+)$/))
        .filter(Boolean) as RegExpMatchArray[]
      const prefijo = prefijos[0]?.[1] ?? `${capitulo.numero}_SUB`
      const maxNum = prefijos.reduce((max, m) => Math.max(max, parseInt(m[2], 10)), 0)
      finalCodigo = `${prefijo}_${String(maxNum + 1).padStart(2, '0')}`
    }

    const { data: ordenRows } = await admin
      .from('presupuesto_subcapitulos')
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
    const orden = (ordenRows?.[0]?.orden ?? 0) + 1

    const { data, error } = await admin
      .from('presupuesto_subcapitulos')
      .insert({ capitulo_id, codigo: finalCodigo, nombre: nombre.trim(), orden })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateSubcapitulo(
  id: string,
  data: { nombre?: string; activo?: boolean }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (data.nombre !== undefined) {
      if (!data.nombre.trim()) return { error: 'El nombre no puede quedar vacío.' }
      patch.nombre = data.nombre.trim()
    }
    if (data.activo !== undefined) patch.activo = data.activo
    if (Object.keys(patch).length === 0) return { success: true }

    const { error } = await admin.from('presupuesto_subcapitulos').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

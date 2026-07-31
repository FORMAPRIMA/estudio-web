'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { IVA_DEFAULT, NIVELES, type NivelCalidad, type WarehouseItemInput } from '@/lib/memorias/domain'

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
    const nivelesError = validarNiveles(input.niveles_calidad)
    if (nivelesError) return { error: nivelesError }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('warehouse_items')
      .insert({
        subcapitulo_id: input.subcapitulo_id,
        nombre: input.nombre.trim(),
        niveles_calidad: input.niveles_calidad,
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
        precio_pvp_con_iva: input.precio_pvp_con_iva ?? null,
        iva_pct: input.iva_pct ?? IVA_DEFAULT,
        precio_coste: input.precio_coste ?? null,
        moneda: input.moneda ?? 'EUR',
        proveedor_preferente_id: input.proveedor_preferente_id ?? null,
        acabados: input.acabados ?? [],
        dimensiones: input.dimensiones ?? {},
        data: input.data ?? {},
        tags: input.tags ?? [],
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

    if (input.niveles_calidad !== undefined) {
      const nivelesError = validarNiveles(input.niveles_calidad)
      if (nivelesError) return { error: nivelesError }
    }

    const { data: actual } = await admin
      .from('warehouse_items')
      .select('subcapitulo_id, niveles_calidad')
      .eq('id', id)
      .single()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.subcapitulo_id !== undefined) patch.subcapitulo_id = input.subcapitulo_id
    if (input.nombre !== undefined) patch.nombre = input.nombre.trim()
    if (input.niveles_calidad !== undefined) patch.niveles_calidad = input.niveles_calidad
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
    if (input.precio_pvp_con_iva !== undefined) patch.precio_pvp_con_iva = input.precio_pvp_con_iva
    if (input.iva_pct !== undefined) patch.iva_pct = input.iva_pct
    if (input.precio_coste !== undefined) patch.precio_coste = input.precio_coste
    if (input.moneda !== undefined) patch.moneda = input.moneda
    if (input.proveedor_preferente_id !== undefined) patch.proveedor_preferente_id = input.proveedor_preferente_id
    if (input.acabados !== undefined) patch.acabados = input.acabados
    if (input.dimensiones !== undefined) patch.dimensiones = input.dimensiones
    if (input.data !== undefined) patch.data = input.data
    if (input.tags !== undefined) patch.tags = input.tags
    if (input.activo !== undefined) patch.activo = input.activo

    const { error } = await admin.from('warehouse_items').update(patch).eq('id', id)
    if (error) return { error: error.message }

    // Si se mueve de subcapítulo, sus favoritos se llevan al hueco nuevo; si ya está
    // ocupado, se pierden (el hueco tiene dueño y no lo desalojamos por la espalda).
    if (input.subcapitulo_id && actual && input.subcapitulo_id !== actual.subcapitulo_id) {
      const { data: propios } = await admin
        .from('warehouse_favoritos')
        .select('nivel_calidad')
        .eq('item_id', id)
      await admin.from('warehouse_favoritos').delete().eq('item_id', id)
      for (const fila of propios ?? []) {
        await admin
          .from('warehouse_favoritos')
          .insert({ subcapitulo_id: input.subcapitulo_id, nivel_calidad: fila.nivel_calidad, item_id: id })
      }
    }

    // Un nivel que ya no cubre no puede seguir siendo su favorito
    if (input.niveles_calidad !== undefined) {
      const fuera = NIVELES.map(n => n.value).filter(n => !input.niveles_calidad!.includes(n))
      if (fuera.length > 0) {
        await admin.from('warehouse_favoritos').delete().eq('item_id', id).in('nivel_calidad', fuera)
      }
    }

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

function validarNiveles(niveles: NivelCalidad[] | undefined): string | null {
  if (!niveles || niveles.length === 0) return 'Marca al menos un nivel de calidad.'
  const validos = NIVELES.map(n => n.value)
  if (niveles.some(n => !validos.includes(n))) return 'Nivel de calidad no válido.'
  return null
}

/**
 * Define en qué niveles este producto es el Favorito FP de su subcapítulo.
 * `warehouse_favoritos` tiene PK (subcapitulo_id, nivel_calidad), así que el upsert
 * desaloja al que ocupara el hueco: un nivel solo puede tener un favorito.
 */
export async function setFavoritos(
  id: string,
  niveles: NivelCalidad[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const { data: item } = await admin
      .from('warehouse_items')
      .select('subcapitulo_id, niveles_calidad')
      .eq('id', id)
      .single()
    if (!item) return { error: 'Producto no encontrado.' }

    const fueraDeAlcance = niveles.filter(n => !(item.niveles_calidad ?? []).includes(n))
    if (fueraDeAlcance.length > 0) {
      return { error: 'No puede ser favorito de un nivel que el producto no cubre.' }
    }

    // Quita los niveles que deja de ocupar
    const sobran = NIVELES.map(n => n.value).filter(n => !niveles.includes(n))
    if (sobran.length > 0) {
      const { error: delErr } = await admin
        .from('warehouse_favoritos')
        .delete()
        .eq('item_id', id)
        .in('nivel_calidad', sobran)
      if (delErr) return { error: delErr.message }
    }

    if (niveles.length > 0) {
      const { error: upErr } = await admin
        .from('warehouse_favoritos')
        .upsert(
          niveles.map(nivel => ({ subcapitulo_id: item.subcapitulo_id, nivel_calidad: nivel, item_id: id })),
          { onConflict: 'subcapitulo_id,nivel_calidad' }
        )
      if (upErr) return { error: upErr.message }
    }

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

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { autoPvp, conIva, IVA_DEFAULT, type EstadoCompra, type NivelCalidad } from '@/lib/memorias/domain'

const PATH = '/team/memorias-calidad/proyectos'

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

function revalidateProyecto(proyecto_id: string) {
  revalidatePath(`${PATH}/${proyecto_id}`)
}

// ── Estancias ─────────────────────────────────────────────────────────────────

export async function createEstancia(
  proyecto_id: string,
  nombre: string
): Promise<{ id: string } | { error: string }> {
  try {
    await requireFpStaff()
    if (!nombre.trim()) return { error: 'El nombre de la estancia es obligatorio.' }
    const admin = createAdminClient()

    const { data: last } = await admin
      .from('memoria_estancias')
      .select('orden')
      .eq('proyecto_id', proyecto_id)
      .order('orden', { ascending: false })
      .limit(1)

    const { data, error } = await admin
      .from('memoria_estancias')
      .insert({ proyecto_id, nombre: nombre.trim(), orden: (last?.[0]?.orden ?? 0) + 1 })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidateProyecto(proyecto_id)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateEstancia(
  id: string,
  data: { nombre?: string; orden?: number }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.nombre !== undefined) {
      if (!data.nombre.trim()) return { error: 'El nombre no puede quedar vacío.' }
      patch.nombre = data.nombre.trim()
    }
    if (data.orden !== undefined) patch.orden = data.orden

    const { data: row, error } = await admin
      .from('memoria_estancias')
      .update(patch)
      .eq('id', id)
      .select('proyecto_id')
      .single()

    if (error) return { error: error.message }
    revalidateProyecto(row.proyecto_id)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteEstancia(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const { data: estancia } = await admin
      .from('memoria_estancias')
      .select('proyecto_id')
      .eq('id', id)
      .single()

    const { error } = await admin.from('memoria_estancias').delete().eq('id', id)
    if (error) return { error: error.message }
    if (estancia) revalidateProyecto(estancia.proyecto_id)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Copia la estancia y todos sus items (tres baños iguales en un clic). */
export async function duplicarEstancia(
  id: string,
  nombre?: string
): Promise<{ id: string } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const { data: origen } = await admin
      .from('memoria_estancias')
      .select('proyecto_id, nombre, orden')
      .eq('id', id)
      .single()
    if (!origen) return { error: 'Estancia no encontrada.' }

    const { data: last } = await admin
      .from('memoria_estancias')
      .select('orden')
      .eq('proyecto_id', origen.proyecto_id)
      .order('orden', { ascending: false })
      .limit(1)

    const { data: nueva, error: createErr } = await admin
      .from('memoria_estancias')
      .insert({
        proyecto_id: origen.proyecto_id,
        nombre: nombre?.trim() || `${origen.nombre} (copia)`,
        orden: (last?.[0]?.orden ?? 0) + 1,
      })
      .select('id')
      .single()
    if (createErr || !nueva) return { error: createErr?.message ?? 'Error creando la estancia.' }

    const { data: items } = await admin
      .from('memoria_estancia_items')
      .select('*')
      .eq('estancia_id', id)
      .order('orden', { ascending: true })

    if (items && items.length > 0) {
      const copias = items.map(({ id: _id, estancia_id: _e, created_at: _c, updated_at: _u, ...resto }) => ({
        ...resto,
        estancia_id: nueva.id,
      }))
      const { error: insErr } = await admin.from('memoria_estancia_items').insert(copias)
      if (insErr) return { error: insErr.message }
    }

    revalidateProyecto(origen.proyecto_id)
    return { id: nueva.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function reordenarEstancias(
  proyecto_id: string,
  ids: string[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    for (let i = 0; i < ids.length; i++) {
      const { error } = await admin
        .from('memoria_estancias')
        .update({ orden: i + 1, updated_at: new Date().toISOString() })
        .eq('id', ids[i])
        .eq('proyecto_id', proyecto_id)
      if (error) return { error: error.message }
    }
    revalidateProyecto(proyecto_id)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Items de estancia ─────────────────────────────────────────────────────────

async function siguienteOrden(
  admin: ReturnType<typeof createAdminClient>,
  estancia_id: string
): Promise<number> {
  const { data } = await admin
    .from('memoria_estancia_items')
    .select('orden')
    .eq('estancia_id', estancia_id)
    .order('orden', { ascending: false })
    .limit(1)
  return (data?.[0]?.orden ?? 0) + 1
}

/**
 * Añade un producto del warehouse a una estancia copiando sus datos (snapshot):
 * si mañana cambia el precio del catálogo, la memoria del proyecto no se mueve.
 */
export async function addItemFromWarehouse(
  estancia_id: string,
  warehouse_item_id: string,
  cantidad = 1
): Promise<{ id: string } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const [{ data: wh }, { data: estancia }] = await Promise.all([
      admin.from('warehouse_items').select('*').eq('id', warehouse_item_id).single(),
      admin.from('memoria_estancias').select('proyecto_id').eq('id', estancia_id).single(),
    ])
    if (!wh) return { error: 'Producto no encontrado en el warehouse.' }
    if (!estancia) return { error: 'Estancia no encontrada.' }

    const { data, error } = await admin
      .from('memoria_estancia_items')
      .insert({
        estancia_id,
        warehouse_item_id: wh.id,
        subcapitulo_id: wh.subcapitulo_id,
        nombre: wh.nombre,
        niveles_calidad: wh.niveles_calidad ?? [],
        marca: wh.marca,
        modelo: wh.modelo,
        referencia: wh.referencia,
        descripcion: wh.descripcion,
        imagen_principal_url: wh.imagen_principal_url,
        imagen_lifestyle_url: wh.imagen_lifestyle_url,
        ficha_tecnica_url: wh.ficha_tecnica_url,
        url_producto: wh.url_producto,
        acabados: wh.acabados ?? [],
        acabado_seleccionado: (wh.acabados ?? []).length === 1 ? wh.acabados[0] : null,
        cantidad,
        proveedor_id: wh.proveedor_preferente_id,
        precio_coste: wh.precio_coste,
        precio_pvp: wh.precio_pvp ?? autoPvp(wh.precio_coste),
        precio_pvp_con_iva: wh.precio_pvp_con_iva ?? conIva(wh.precio_pvp ?? autoPvp(wh.precio_coste), wh.iva_pct ?? IVA_DEFAULT),
        iva_pct: wh.iva_pct ?? IVA_DEFAULT,
        moneda: wh.moneda ?? 'EUR',
        orden: await siguienteOrden(admin, estancia_id),
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidateProyecto(estancia.proyecto_id)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export interface ItemLibreInput {
  subcapitulo_id: string
  nombre: string
  niveles_calidad?: NivelCalidad[]
  marca?: string | null
  modelo?: string | null
  referencia?: string | null
  descripcion?: string | null
  imagen_principal_url?: string | null
  imagen_lifestyle_url?: string | null
  url_producto?: string | null
  acabados?: string[]
  acabado_seleccionado?: string | null
  cantidad?: number
  proveedor_id?: string | null
  precio_pvp?: number | null
  precio_coste?: number | null
  notas?: string | null
}

/** Item que no está en catálogo (one-off de proyecto). */
export async function addItemLibre(
  estancia_id: string,
  input: ItemLibreInput
): Promise<{ id: string } | { error: string }> {
  try {
    await requireFpStaff()
    if (!input.nombre?.trim()) return { error: 'El nombre es obligatorio.' }
    if (!input.subcapitulo_id) return { error: 'El subcapítulo es obligatorio.' }
    const admin = createAdminClient()

    const { data: estancia } = await admin
      .from('memoria_estancias')
      .select('proyecto_id')
      .eq('id', estancia_id)
      .single()
    if (!estancia) return { error: 'Estancia no encontrada.' }

    const { data, error } = await admin
      .from('memoria_estancia_items')
      .insert({
        estancia_id,
        warehouse_item_id: null,
        subcapitulo_id: input.subcapitulo_id,
        nombre: input.nombre.trim(),
        niveles_calidad: input.niveles_calidad ?? [],
        marca: input.marca?.trim() || null,
        modelo: input.modelo?.trim() || null,
        referencia: input.referencia?.trim() || null,
        descripcion: input.descripcion?.trim() || null,
        imagen_principal_url: input.imagen_principal_url || null,
        imagen_lifestyle_url: input.imagen_lifestyle_url || null,
        url_producto: input.url_producto?.trim() || null,
        acabados: input.acabados ?? [],
        acabado_seleccionado: input.acabado_seleccionado || null,
        cantidad: input.cantidad ?? 1,
        proveedor_id: input.proveedor_id || null,
        precio_coste: input.precio_coste ?? null,
        precio_pvp: input.precio_pvp ?? autoPvp(input.precio_coste ?? null),
        precio_pvp_con_iva: conIva(input.precio_pvp ?? autoPvp(input.precio_coste ?? null)),
        notas: input.notas?.trim() || null,
        orden: await siguienteOrden(admin, estancia_id),
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidateProyecto(estancia.proyecto_id)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateEstanciaItem(
  id: string,
  data: {
    nombre?: string
    marca?: string | null
    modelo?: string | null
    referencia?: string | null
    descripcion?: string | null
    acabado_seleccionado?: string | null
    cantidad?: number
    proveedor_id?: string | null
    precio_pvp?: number | null
    precio_pvp_con_iva?: number | null
    iva_pct?: number
    precio_coste?: number | null
    notas?: string | null
    estado_compra?: EstadoCompra
    url_producto?: string | null
    imagen_principal_url?: string | null
    imagen_lifestyle_url?: string | null
    subcapitulo_id?: string
    niveles_calidad?: NivelCalidad[]
    orden?: number
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.nombre !== undefined) {
      if (!data.nombre.trim()) return { error: 'El nombre no puede quedar vacío.' }
      patch.nombre = data.nombre.trim()
    }
    if (data.marca !== undefined) patch.marca = data.marca?.trim() || null
    if (data.modelo !== undefined) patch.modelo = data.modelo?.trim() || null
    if (data.referencia !== undefined) patch.referencia = data.referencia?.trim() || null
    if (data.descripcion !== undefined) patch.descripcion = data.descripcion?.trim() || null
    if (data.acabado_seleccionado !== undefined) patch.acabado_seleccionado = data.acabado_seleccionado?.trim() || null
    if (data.cantidad !== undefined) patch.cantidad = data.cantidad
    if (data.proveedor_id !== undefined) patch.proveedor_id = data.proveedor_id || null
    if (data.precio_pvp !== undefined) patch.precio_pvp = data.precio_pvp
    if (data.precio_pvp_con_iva !== undefined) patch.precio_pvp_con_iva = data.precio_pvp_con_iva
    if (data.iva_pct !== undefined) patch.iva_pct = data.iva_pct
    if (data.precio_coste !== undefined) patch.precio_coste = data.precio_coste
    if (data.notas !== undefined) patch.notas = data.notas?.trim() || null
    if (data.estado_compra !== undefined) patch.estado_compra = data.estado_compra
    if (data.url_producto !== undefined) patch.url_producto = data.url_producto?.trim() || null
    if (data.imagen_principal_url !== undefined) patch.imagen_principal_url = data.imagen_principal_url || null
    if (data.imagen_lifestyle_url !== undefined) patch.imagen_lifestyle_url = data.imagen_lifestyle_url || null
    if (data.subcapitulo_id !== undefined) patch.subcapitulo_id = data.subcapitulo_id
    if (data.niveles_calidad !== undefined) patch.niveles_calidad = data.niveles_calidad
    if (data.orden !== undefined) patch.orden = data.orden

    const { error } = await admin
      .from('memoria_estancia_items')
      .update(patch)
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath(PATH, 'layout')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteEstanciaItem(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    const { error } = await admin.from('memoria_estancia_items').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH, 'layout')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function moveEstanciaItem(
  id: string,
  estancia_destino_id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireFpStaff()
    const admin = createAdminClient()
    const { error } = await admin
      .from('memoria_estancia_items')
      .update({
        estancia_id: estancia_destino_id,
        orden: await siguienteOrden(admin, estancia_destino_id),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH, 'layout')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/**
 * Sube al catálogo un item que se dio de alta libre en un proyecto,
 * para que el warehouse crezca con el uso real.
 */
export async function guardarItemEnWarehouse(
  item_id: string,
  niveles_calidad: NivelCalidad[]
): Promise<{ id: string } | { error: string }> {
  try {
    const { userId } = await requireFpStaff()
    const admin = createAdminClient()

    const { data: item } = await admin
      .from('memoria_estancia_items')
      .select('*')
      .eq('id', item_id)
      .single()
    if (!item) return { error: 'Item no encontrado.' }
    if (item.warehouse_item_id) return { error: 'Este item ya viene del warehouse.' }
    if (!niveles_calidad || niveles_calidad.length === 0) return { error: 'Marca al menos un nivel de calidad.' }

    const { data: nuevo, error } = await admin
      .from('warehouse_items')
      .insert({
        subcapitulo_id: item.subcapitulo_id,
        nombre: item.nombre,
        niveles_calidad,
        marca: item.marca,
        modelo: item.modelo,
        referencia: item.referencia,
        descripcion: item.descripcion,
        imagen_principal_url: item.imagen_principal_url,
        imagen_lifestyle_url: item.imagen_lifestyle_url,
        ficha_tecnica_url: item.ficha_tecnica_url,
        url_producto: item.url_producto,
        precio_pvp: item.precio_pvp,
        precio_pvp_con_iva: item.precio_pvp_con_iva,
        iva_pct: item.iva_pct ?? IVA_DEFAULT,
        precio_coste: item.precio_coste,
        moneda: item.moneda,
        proveedor_preferente_id: item.proveedor_id,
        acabados: item.acabados ?? [],
        created_by: userId,
      })
      .select('id')
      .single()
    if (error || !nuevo) return { error: error?.message ?? 'Error creando el producto.' }

    await admin
      .from('memoria_estancia_items')
      .update({ warehouse_item_id: nuevo.id, niveles_calidad, updated_at: new Date().toISOString() })
      .eq('id', item_id)

    revalidatePath(PATH, 'layout')
    revalidatePath('/team/memorias-calidad/warehouse')
    return { id: nuevo.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

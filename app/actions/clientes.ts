'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH_BD      = '/team/clientes/base-datos'
const PATH_INTERNA = '/team/clientes/plataforma/interna'

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

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, id')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_team'].includes(profile.rol))
    throw new Error('Sin permisos.')
  return profile
}

// ── Clientes CRUD ──────────────────────────────────────────────────────────

export async function addCliente(): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('clientes')
      .insert({ nombre: 'Nuevo cliente' })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH_BD)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateCliente(
  id: string,
  data: {
    nombre?:                string
    apellidos?:             string | null
    documento_identidad?:   string | null
    direccion?:             string | null
    ciudad?:                string | null
    codigo_postal?:         string | null
    pais?:                  string | null
    email?:                 string | null
    email_cc?:              string | null
    telefono?:              string | null
    telefono_alt?:          string | null
    tipo_facturacion?:      string | null
    empresa?:               string | null
    nif_cif?:               string | null
    direccion_facturacion?: string | null
    notas_facturacion?:     string | null
    notas?:                 string | null
    fecha_nacimiento?:      string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('clientes').update(data).eq('id', id)
    if (error) {
      if (error.code === '23505' && error.message.includes('email')) {
        return { error: 'Este email ya está registrado en otro cliente.' }
      }
      return { error: error.message }
    }
    revalidatePath(PATH_BD)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteCliente(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('clientes').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH_BD)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Plataforma de obras — actualizaciones ──────────────────────────────────

export async function addActualizacion(data: {
  proyecto_id:     string
  tipo:            string
  titulo:          string
  contenido?:      string | null
  fecha:           string
  visible_cliente: boolean
}): Promise<{ id: string } | { error: string }> {
  try {
    const profile = await requireAnyFP()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('proyecto_actualizaciones')
      .insert({ ...data, created_by: profile.id })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH_INTERNA)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateActualizacion(
  id: string,
  proyectoId: string,
  data: {
    tipo?:            string
    titulo?:          string
    contenido?:       string | null
    fecha?:           string
    visible_cliente?: boolean
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyecto_actualizaciones')
      .update(data)
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteActualizacion(
  id: string,
  proyectoId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyecto_actualizaciones')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Portal (Floorfy + PDF proyecto) ───────────────────────────────────────────

export async function upsertPortal(
  proyectoId: string,
  data: { floorfy_url?: string | null; pdf_proyecto_url?: string | null; portal_cliente_ids?: string[] }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyecto_portal')
      .upsert(
        { proyecto_id: proyectoId, ...data, updated_at: new Date().toISOString() },
        { onConflict: 'proyecto_id' }
      )
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Renders ───────────────────────────────────────────────────────────────────

export async function addRender(
  proyectoId: string,
  url: string,
  nombre: string | null
): Promise<{ id: string } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('proyecto_renders')
      .insert({ proyecto_id: proyectoId, url, nombre })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteRender(
  id: string,
  proyectoId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('proyecto_renders').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Visitas de obra ───────────────────────────────────────────────────────────

export async function addVisita(data: {
  proyecto_id: string
  fecha: string
  titulo?: string | null
  asistentes?: string | null
  notas?: string | null
  acta_url?: string | null
  floorfy_url?: string | null
  visible_cliente?: boolean
}): Promise<{ id: string } | { error: string }> {
  try {
    const profile = await requireAnyFP()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('visitas_obra')
      .insert({ ...data, created_by: profile.id })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${data.proyecto_id}`)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateVisita(
  id: string,
  proyectoId: string,
  data: Partial<{
    fecha: string; titulo: string | null; asistentes: string | null
    notas: string | null; acta_url: string | null; floorfy_url: string | null; visible_cliente: boolean
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('visitas_obra').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteVisita(
  id: string,
  proyectoId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('visitas_obra').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Cronograma de obra ────────────────────────────────────────────────────────

export async function addPartida(data: {
  proyecto_id: string
  nombre: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  color?: string
  orden?: number
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('cronograma_partidas')
      .insert(data)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${data.proyecto_id}`)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePartida(
  id: string,
  proyectoId: string,
  data: Partial<{
    nombre: string; fecha_inicio: string | null; fecha_fin: string | null
    color: string; completado: boolean; orden: number
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('cronograma_partidas').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deletePartida(
  id: string,
  proyectoId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('cronograma_partidas').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Contratos ─────────────────────────────────────────────────────────────────

export async function upsertContratos(
  proyectoId: string,
  data: {
    contrato_arquitectura_url?: string | null
    contrato_obra_url?: string | null
    pdf_presupuesto_url?: string | null
    notas?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('contratos_proyecto')
      .upsert(
        { proyecto_id: proyectoId, ...data, updated_at: new Date().toISOString() },
        { onConflict: 'proyecto_id' }
      )
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Constructor del proyecto ──────────────────────────────────────────────────

export async function setConstructorProyecto(
  proyectoId: string,
  constructorId: string | null
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyectos')
      .update({ constructor_id: constructorId })
      .eq('id', proyectoId)
    if (error) return { error: error.message }
    revalidatePath(`${PATH_INTERNA}/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

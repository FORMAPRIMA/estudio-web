'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface FaseInput {
  id: string
  numero: number
}

interface CreateProyectoInput {
  nombre: string
  codigo: string
  direccion: string
  imagen_url: string | null
  superficie_diseno: number | null
  superficie_catastral: number | null
  superficie_util: number | null
  cliente_ids: string[]
  selectedFases: FaseInput[]
  fasesResponsables: Record<string, string[]>
}

// ── Image upload: client uploads directly to Supabase Storage via signed URL ─
// The server action only generates the signed URL (small request, no binary data).
// The client then PUTs the file directly to Storage, bypassing Server Action limits.

export async function getProyectoImageUploadToken(
  fileName: string,
): Promise<{ token: string; path: string; publicUrl: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa.' }

    const ext = fileName.split('.').pop() ?? 'jpg'
    const storagePath = `${user.id}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('proyecto-imagenes')
      .createSignedUploadUrl(storagePath)

    if (error || !data) return { error: error?.message ?? 'Error al generar token de subida.' }

    const { data: { publicUrl } } = supabase.storage
      .from('proyecto-imagenes')
      .getPublicUrl(storagePath)

    return { token: data.token, path: storagePath, publicUrl }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Create project ───────────────────────────────────────────────────────────

export async function createProyecto(input: CreateProyectoInput) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa. Recarga la página.' }

    const slug = `${input.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`

    const { data: proyecto, error: e1 } = await supabase
      .from('proyectos')
      .insert({
        nombre: input.nombre,
        codigo: input.codigo.toUpperCase(),
        direccion: input.direccion || null,
        imagen_url: input.imagen_url,
        superficie_diseno: input.superficie_diseno,
        superficie_catastral: input.superficie_catastral,
        superficie_util: input.superficie_util,
        cliente_id: input.cliente_ids[0] ?? null,
        status: 'activo',
        created_by: user.id,
        ubicacion: input.direccion || '-',
        año: new Date().getFullYear(),
        tipologia: '-',
        slug,
        estado: 'activo',
        origen: 'post_plataforma',
      })
      .select('id, nombre, codigo')
      .single()

    if (e1) return { error: `[proyectos] ${e1.message}` }

    // Insert all selected clients into the junction table
    if (input.cliente_ids.length > 0) {
      await supabase
        .from('proyecto_clientes')
        .insert(
          input.cliente_ids.map((cliente_id, i) => ({
            proyecto_id: proyecto.id,
            cliente_id,
            rol: i === 0 ? 'titular' : 'cotitular',
          }))
        )
    }

    // Fetch ratios for all selected fases
    const { data: catalogoConRatios } = await supabase
      .from('catalogo_fases')
      .select('id, ratio')
      .in('id', input.selectedFases.map(f => f.id))

    const ratioMap: Record<string, number> = {}
    for (const cf of catalogoConRatios ?? []) ratioMap[cf.id] = cf.ratio ?? 0

    for (const fase of input.selectedFases) {
      const ratio = ratioMap[fase.id] ?? 0
      const horas_objetivo = ratio > 0 && input.superficie_diseno
        ? Math.round(ratio * input.superficie_diseno * 100) / 100
        : null
      const { error: e2 } = await supabase.from('proyecto_fases').insert({
        proyecto_id: proyecto.id,
        fase_id: fase.id,
        responsables: input.fasesResponsables[fase.id] ?? [],
        horas_objetivo,
        fase_status: 'en_espera',
        origen: 'post_plataforma',
      })
      if (e2) return { error: `[proyecto_fases F${fase.numero}] ${e2.message}` }
    }

    revalidatePath('/team/proyectos')
    return { success: true }
  } catch (err: unknown) {
    return { error: `Error inesperado: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ── Update project status only (for drag & drop) ────────────────────────────

export async function updateProyectoStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    return { error: 'Sin permisos.' }
  }

  const { error } = await supabase.from('proyectos').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/team/proyectos')
  revalidatePath(`/team/proyectos/${id}`)
  return { success: true }
}

// ── Update project info ──────────────────────────────────────────────────────

export async function updateProyecto(
  id: string,
  data: {
    nombre: string
    codigo?: string
    direccion: string
    superficie_diseno: number | null
    superficie_catastral: number | null
    superficie_util: number | null
    cliente_id: string | null
    constructor_id?: string | null
    status: string
    imagen_url?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    return { error: 'Sin permisos.' }
  }

  const updatePayload: Record<string, unknown> = {
    nombre: data.nombre,
    direccion: data.direccion || null,
    superficie_diseno: data.superficie_diseno,
    superficie_catastral: data.superficie_catastral,
    superficie_util: data.superficie_util,
    cliente_id: data.cliente_id || null,
    status: data.status,
    ubicacion: data.direccion || '-',
  }
  // Only update imagen_url if explicitly provided (undefined = don't touch it)
  if (data.imagen_url !== undefined) updatePayload.imagen_url = data.imagen_url
  if (data.constructor_id !== undefined) updatePayload.constructor_id = data.constructor_id || null
  if (data.codigo !== undefined) updatePayload.codigo = data.codigo.toUpperCase()

  const { error } = await supabase.from('proyectos').update(updatePayload).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/team/proyectos/${id}`)
  revalidatePath('/team/proyectos')
  return { success: true }
}

// ── Add a new contracted phase to an existing project ───────────────────────

export async function addProyectoFase(
  proyectoId: string,
  faseId: string,
  responsables: string[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    return { error: 'Sin permisos.' }
  }

  // Get proyecto superficie + fase ratio to compute horas_objetivo
  const { data: proyecto, error: eProyecto } = await supabase
    .from('proyectos')
    .select('nombre, codigo, superficie_diseno')
    .eq('id', proyectoId)
    .single()

  const { data: catalogoFase } = await supabase
    .from('catalogo_fases')
    .select('numero, ratio')
    .eq('id', faseId)
    .single()

  const ratio = catalogoFase?.ratio ?? 0
  const horas_objetivo = ratio > 0 && proyecto?.superficie_diseno
    ? Math.round(ratio * proyecto.superficie_diseno * 100) / 100
    : null

  const { data: pf, error: e1 } = await supabase
    .from('proyecto_fases')
    .insert({ proyecto_id: proyectoId, fase_id: faseId, responsables, horas_objetivo, fase_status: 'en_espera', origen: 'post_plataforma' })
    .select('id, horas_objetivo')
    .single()

  if (e1) return { error: e1.message }

  revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true, pfId: pf.id, horas_objetivo: pf.horas_objetivo ?? null }
}

// ── Delete contracted fase ────────────────────────────────────────────────────

export async function deleteProyectoFase(pfId: string, proyectoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    return { error: 'Sin permisos para eliminar fases.' }
  }

  // Get the fase_id to also delete its tasks
  const { data: pf } = await supabase
    .from('proyecto_fases')
    .select('fase_id')
    .eq('id', pfId)
    .single()

  if (!pf) return { error: 'Fase no encontrada.' }

  const { error: e1 } = await supabase
    .from('tasks')
    .delete()
    .eq('proyecto_id', proyectoId)
    .eq('fase_id', pf.fase_id)

  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('proyecto_fases')
    .delete()
    .eq('id', pfId)

  if (e2) return { error: e2.message }

  revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}

// ── Iniciar fase (triggers task creation from plantilla) ─────────────────────

export async function iniciarFase(pfId: string, proyectoId: string, faseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  // Fetch proyecto, fase info, and responsables in parallel
  const [{ data: proyecto }, { data: catalogoFase }, { data: pf }] = await Promise.all([
    supabase.from('proyectos').select('nombre, codigo').eq('id', proyectoId).single(),
    supabase.from('catalogo_fases').select('numero').eq('id', faseId).single(),
    supabase.from('proyecto_fases').select('responsables').eq('id', pfId).single(),
  ])

  if (!proyecto || !catalogoFase || !pf) return { error: 'Datos no encontrados.' }

  // Mark fase as iniciada
  const { error: e1 } = await supabase
    .from('proyecto_fases')
    .update({ fase_status: 'iniciada' })
    .eq('id', pfId)

  if (e1) return { error: e1.message }

  // Create tasks from plantilla
  const { data: plantillas } = await supabase
    .from('plantilla_tasks')
    .select('*')
    .eq('fase_id', faseId)
    .order('orden')

  if (!plantillas || plantillas.length === 0) {
    revalidatePath(`/team/proyectos/${proyectoId}`)
    return { success: true, tasks: [] }
  }

  // Count existing tasks for this fase to avoid codigo collisions
  const { count: existingCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', proyectoId)
    .eq('fase_id', faseId)

  const offset = existingCount ?? 0
  const proyCodigo = proyecto.codigo || proyecto.nombre.slice(0, 5).toUpperCase()
  const tasksToInsert = plantillas.map((pt, i) => ({
    codigo: `${proyCodigo}-F${catalogoFase.numero}-${String(offset + i + 1).padStart(3, '0')}`,
    titulo: pt.titulo,
    descripcion: pt.descripcion,
    proyecto_id: proyectoId,
    fase_id: faseId,
    responsable_ids: pf.responsables,
    orden_urgencia: pt.orden,
    prioridad: 0,
    origen: 'post_plataforma',
  }))

  const { data: insertedTasks, error: e2 } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select('id, codigo, titulo, descripcion, proyecto_id, fase_id, responsable_ids, status, orden_urgencia, prioridad, created_at')

  if (e2) return { error: e2.message }

  revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true, tasks: insertedTasks ?? [] }
}

// ── Delete project ────────────────────────────────────────────────────────────

export async function deleteProyecto(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  // Verify caller is manager or partner
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    return { error: 'Sin permisos para eliminar proyectos.' }
  }

  // Delete in dependency order
  const { error: e1 } = await supabase.from('tasks').delete().eq('proyecto_id', id)
  if (e1) return { error: `[tasks] ${e1.message}` }

  const { error: e2 } = await supabase.from('proyecto_fases').delete().eq('proyecto_id', id)
  if (e2) return { error: `[proyecto_fases] ${e2.message}` }

  const { error: e4 } = await supabase.from('facturas').delete().eq('proyecto_id', id)
  if (e4) return { error: `[facturas] ${e4.message}` }

  const { error: e3 } = await supabase.from('proyectos').delete().eq('id', id)
  if (e3) return { error: `[proyectos] ${e3.message}` }

  revalidatePath('/team/proyectos')
  return { success: true }
}

// ── Titulares (proyecto_clientes) ────────────────────────────────────────────

export async function addProyectoCliente(
  proyectoId: string,
  clienteId:  string,
  rol:        string
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa.' }

    const { error } = await supabase
      .from('proyecto_clientes')
      .insert({ proyecto_id: proyectoId, cliente_id: clienteId, rol })

    if (error) return { error: error.message }
    revalidatePath(`/team/proyectos/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function removeProyectoCliente(
  proyectoId: string,
  clienteId:  string
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa.' }

    const { error } = await supabase
      .from('proyecto_clientes')
      .delete()
      .eq('proyecto_id', proyectoId)
      .eq('cliente_id',  clienteId)

    if (error) return { error: error.message }
    revalidatePath(`/team/proyectos/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateProyectoClienteRol(
  proyectoId: string,
  clienteId:  string,
  rol:        string
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa.' }

    const { error } = await supabase
      .from('proyecto_clientes')
      .update({ rol })
      .eq('proyecto_id', proyectoId)
      .eq('cliente_id',  clienteId)

    if (error) return { error: error.message }
    revalidatePath(`/team/proyectos/${proyectoId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

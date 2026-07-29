'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import {
  nextCodigo,
  estadoLabel,
  visibilidadLabel,
  oficioLabel,
} from '@/lib/repasos/domain'
import type {
  Repaso,
  RepasoAudiencia,
  RepasoEstado,
  RepasoEvento,
  RepasoFoto,
  RepasoFotoTipo,
  RepasoPlano,
  RepasoProyecto,
  RepasoProyectoResumen,
  RepasoToken,
  RepasoVisibilidad,
  CreateRepasoInput,
  CreateRepasoProyectoInput,
  UpdateRepasoInput,
} from '@/lib/repasos/domain'

const BASE = '/team/apps/repasos'

// ─── Guard ────────────────────────────────────────────────────────────────────
// Todos los roles FP tienen acceso completo a la app (decisión de producto).

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) throw new Error('Sin permisos.')
  return { user, rol: profile.rol as FpRole, nombre: (profile.nombre as string) ?? 'Equipo FP' }
}

// ─── Lecturas ─────────────────────────────────────────────────────────────────

export async function getRepasoProyectos(): Promise<RepasoProyectoResumen[]> {
  await requireAnyFP()
  const admin = createAdminClient()

  const { data: proyectos } = await admin
    .from('repaso_proyectos')
    .select('*')
    .order('created_at', { ascending: false })

  if (!proyectos?.length) return []

  const ids = proyectos.map((p) => p.id)

  const [{ data: planos }, { data: repasos }] = await Promise.all([
    admin.from('repaso_planos').select('proyecto_id, img_url, orden').in('proyecto_id', ids).order('orden'),
    admin.from('repasos').select('proyecto_id, estado').in('proyecto_id', ids),
  ])

  return (proyectos as RepasoProyecto[]).map((p) => {
    const misPlanos = (planos ?? []).filter((pl) => pl.proyecto_id === p.id)
    const misRepasos = (repasos ?? []).filter((r) => r.proyecto_id === p.id)
    return {
      ...p,
      plano_portada: misPlanos[0]?.img_url ?? null,
      planos_count: misPlanos.length,
      detectados: misRepasos.filter((r) => r.estado === 'detectado').length,
      programados: misRepasos.filter((r) => r.estado === 'programado').length,
      resueltos: misRepasos.filter((r) => r.estado === 'resuelto').length,
    }
  })
}

export async function getProyectoTokens(proyectoId: string): Promise<RepasoToken[]> {
  await requireAnyFP()
  const admin = createAdminClient()
  const { data } = await admin
    .from('repaso_tokens')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
  return (data ?? []) as RepasoToken[]
}

// ─── Proyectos ────────────────────────────────────────────────────────────────

export async function createRepasoProyecto(
  input: CreateRepasoProyectoInput
): Promise<{ id: string } | { error: string }> {
  try {
    const { user } = await requireAnyFP()
    const admin = createAdminClient()

    if (!input.nombre?.trim()) return { error: 'El nombre del proyecto es obligatorio.' }
    if (!input.plano?.img_url) return { error: 'Falta el plano del proyecto.' }

    const { data: proyecto, error } = await admin
      .from('repaso_proyectos')
      .insert({
        nombre: input.nombre.trim(),
        direccion: input.direccion?.trim() || null,
        cliente: input.cliente?.trim() || null,
        constructora: input.constructora?.trim() || null,
        referencia: input.referencia?.trim() || null,
        notas: input.notas?.trim() || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }

    const { error: planoError } = await admin.from('repaso_planos').insert({
      proyecto_id: proyecto.id,
      nombre: input.plano.nombre?.trim() || 'Planta general',
      orden: 0,
      img_url: input.plano.img_url,
      pdf_url: input.plano.pdf_url ?? null,
      width: input.plano.width ?? null,
      height: input.plano.height ?? null,
    })

    if (planoError) {
      // Sin plano el proyecto no sirve de nada: deshacemos el alta.
      await admin.from('repaso_proyectos').delete().eq('id', proyecto.id)
      return { error: planoError.message }
    }

    revalidatePath(BASE)
    return { id: proyecto.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateRepasoProyecto(
  id: string,
  input: Partial<Omit<RepasoProyecto, 'id' | 'created_at' | 'updated_at' | 'created_by'>>
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin
      .from('repaso_proyectos')
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

export async function deleteRepasoProyecto(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('repaso_proyectos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(BASE)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Planos ───────────────────────────────────────────────────────────────────

export async function createRepasoPlano(
  proyectoId: string,
  plano: CreateRepasoProyectoInput['plano']
): Promise<{ plano: RepasoPlano } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    const { count } = await admin
      .from('repaso_planos')
      .select('id', { count: 'exact', head: true })
      .eq('proyecto_id', proyectoId)

    const { data, error } = await admin
      .from('repaso_planos')
      .insert({
        proyecto_id: proyectoId,
        nombre: plano.nombre?.trim() || `Plano ${(count ?? 0) + 1}`,
        orden: count ?? 0,
        img_url: plano.img_url,
        pdf_url: plano.pdf_url ?? null,
        width: plano.width ?? null,
        height: plano.height ?? null,
      })
      .select('*')
      .single()

    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${proyectoId}`)
    return { plano: data as RepasoPlano }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateRepasoPlano(
  id: string,
  input: { nombre?: string; orden?: number }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('repaso_planos').update(input).eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteRepasoPlano(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { error } = await admin.from('repaso_planos').delete().eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Repasos ──────────────────────────────────────────────────────────────────

async function logEvento(
  admin: ReturnType<typeof createAdminClient>,
  repasoId: string,
  tipo: string,
  detalle: string | null,
  autor: { id: string; nombre: string }
) {
  await admin.from('repaso_eventos').insert({
    repaso_id: repasoId,
    tipo,
    detalle,
    autor_id: autor.id,
    autor_nombre: autor.nombre,
  })
}

export async function createRepaso(
  input: CreateRepasoInput
): Promise<{ repaso: Repaso } | { error: string }> {
  try {
    const { user, nombre } = await requireAnyFP()
    const admin = createAdminClient()

    const { data: existentes } = await admin
      .from('repasos')
      .select('codigo')
      .eq('proyecto_id', input.proyecto_id)

    const codigo = nextCodigo((existentes ?? []).map((r) => r.codigo as string))
    const resuelto = input.estado === 'resuelto'

    const { data, error } = await admin
      .from('repasos')
      .insert({
        proyecto_id: input.proyecto_id,
        plano_id: input.plano_id,
        codigo,
        x: input.x,
        y: input.y,
        oficio: input.oficio,
        descripcion: input.descripcion?.trim() || null,
        estado: input.estado,
        visibilidad: input.visibilidad,
        prioridad: input.prioridad,
        fecha_objetivo: input.fecha_objetivo || null,
        responsable: input.responsable?.trim() || null,
        autor_id: user.id,
        autor_nombre: nombre,
        resuelto_at: resuelto ? new Date().toISOString() : null,
        resuelto_por: resuelto ? nombre : null,
      })
      .select('*')
      .single()

    if (error) return { error: error.message }

    let fotos: RepasoFoto[] = []
    if (input.fotos?.length) {
      const { data: fotosData } = await admin
        .from('repaso_fotos')
        .insert(
          input.fotos.map((f, i) => ({
            repaso_id: data.id,
            url: f.url,
            tipo: f.tipo,
            orden: i,
          }))
        )
        .select('*')
      fotos = (fotosData ?? []) as RepasoFoto[]
    }

    await logEvento(
      admin,
      data.id,
      'creado',
      `${oficioLabel(input.oficio)} · ${estadoLabel(input.estado)} · ${visibilidadLabel(input.visibilidad)}`,
      { id: user.id, nombre }
    )

    const { data: eventos } = await admin
      .from('repaso_eventos')
      .select('*')
      .eq('repaso_id', data.id)
      .order('created_at')

    revalidatePath(`${BASE}/${input.proyecto_id}`)
    revalidatePath(BASE)

    return {
      repaso: {
        ...(data as Omit<Repaso, 'fotos' | 'eventos'>),
        x: Number(data.x),
        y: Number(data.y),
        fotos,
        eventos: (eventos ?? []) as RepasoEvento[],
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateRepaso(
  id: string,
  input: UpdateRepasoInput
): Promise<{ repaso: Repaso } | { error: string }> {
  try {
    const { user, nombre } = await requireAnyFP()
    const admin = createAdminClient()

    const { data: previo } = await admin.from('repasos').select('*').eq('id', id).single()
    if (!previo) return { error: 'El repaso ya no existe.' }

    const patch: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    }

    // Sello de resolución: se pone al pasar a resuelto y se limpia al reabrir.
    if (input.estado && input.estado !== previo.estado) {
      if (input.estado === 'resuelto') {
        patch.resuelto_at = new Date().toISOString()
        patch.resuelto_por = nombre
      } else {
        patch.resuelto_at = null
        patch.resuelto_por = null
      }
    }

    const { data, error } = await admin
      .from('repasos')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return { error: error.message }

    const autor = { id: user.id, nombre }

    if (input.estado && input.estado !== previo.estado) {
      await logEvento(
        admin, id, 'estado',
        `${estadoLabel(previo.estado as RepasoEstado)} → ${estadoLabel(input.estado)}`,
        autor
      )
    }
    if (input.visibilidad && input.visibilidad !== previo.visibilidad) {
      await logEvento(
        admin, id, 'visibilidad',
        `${visibilidadLabel(previo.visibilidad as RepasoVisibilidad)} → ${visibilidadLabel(input.visibilidad)}`,
        autor
      )
    }
    if (input.oficio && input.oficio !== previo.oficio) {
      await logEvento(
        admin, id, 'editado',
        `Oficio: ${oficioLabel(previo.oficio as string)} → ${oficioLabel(input.oficio)}`,
        autor
      )
    }
    if (input.descripcion !== undefined && (input.descripcion ?? '') !== (previo.descripcion ?? '')) {
      await logEvento(admin, id, 'editado', 'Descripción actualizada', autor)
    }

    const [{ data: fotos }, { data: eventos }] = await Promise.all([
      admin.from('repaso_fotos').select('*').eq('repaso_id', id).order('orden'),
      admin.from('repaso_eventos').select('*').eq('repaso_id', id).order('created_at'),
    ])

    revalidatePath(`${BASE}/${previo.proyecto_id}`)
    revalidatePath(BASE)

    return {
      repaso: {
        ...(data as Omit<Repaso, 'fotos' | 'eventos'>),
        x: Number(data.x),
        y: Number(data.y),
        fotos: (fotos ?? []) as RepasoFoto[],
        eventos: (eventos ?? []) as RepasoEvento[],
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function moveRepaso(
  id: string,
  x: number,
  y: number,
  planoId?: string
): Promise<{ success: true } | { error: string }> {
  try {
    const { user, nombre } = await requireAnyFP()
    const admin = createAdminClient()

    const patch: Record<string, unknown> = { x, y, updated_at: new Date().toISOString() }
    if (planoId) patch.plano_id = planoId

    const { data, error } = await admin
      .from('repasos')
      .update(patch)
      .eq('id', id)
      .select('proyecto_id')
      .single()

    if (error) return { error: error.message }

    await logEvento(admin, id, 'movido', null, { id: user.id, nombre })
    revalidatePath(`${BASE}/${data.proyecto_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteRepaso(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { data } = await admin.from('repasos').select('proyecto_id').eq('id', id).maybeSingle()
    const { error } = await admin.from('repasos').delete().eq('id', id)
    if (error) return { error: error.message }
    if (data) revalidatePath(`${BASE}/${data.proyecto_id}`)
    revalidatePath(BASE)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

export async function createRepasoFoto(
  repasoId: string,
  url: string,
  tipo: RepasoFotoTipo
): Promise<{ foto: RepasoFoto } | { error: string }> {
  try {
    const { user, nombre } = await requireAnyFP()
    const admin = createAdminClient()

    const { count } = await admin
      .from('repaso_fotos')
      .select('id', { count: 'exact', head: true })
      .eq('repaso_id', repasoId)

    const { data, error } = await admin
      .from('repaso_fotos')
      .insert({ repaso_id: repasoId, url, tipo, orden: count ?? 0 })
      .select('*')
      .single()

    if (error) return { error: error.message }
    await logEvento(admin, repasoId, 'foto', tipo, { id: user.id, nombre })
    return { foto: data as RepasoFoto }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteRepasoFoto(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    const { user, nombre } = await requireAnyFP()
    const admin = createAdminClient()
    const { data } = await admin.from('repaso_fotos').select('repaso_id').eq('id', id).maybeSingle()
    const { error } = await admin.from('repaso_fotos').delete().eq('id', id)
    if (error) return { error: error.message }
    if (data) await logEvento(admin, data.repaso_id, 'foto_borrada', null, { id: user.id, nombre })
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ─── Tokens de acceso externo ─────────────────────────────────────────────────

export async function createRepasoToken(
  proyectoId: string,
  audiencia: RepasoAudiencia,
  label: string
): Promise<{ token: RepasoToken } | { error: string }> {
  try {
    const { user } = await requireAnyFP()
    const admin = createAdminClient()

    const token = randomBytes(24).toString('base64url')
    const { data, error } = await admin
      .from('repaso_tokens')
      .insert({
        proyecto_id: proyectoId,
        audiencia,
        token,
        label: label?.trim() || null,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${proyectoId}`)
    return { token: data as RepasoToken }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function revokeRepasoToken(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('repaso_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .select('proyecto_id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${BASE}/${data.proyecto_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

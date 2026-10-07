'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { EVENTO_RC } from '@/lib/recorrido/domain'
import type { RcDetalle, RcEstado, RcVisita } from '@/lib/recorrido/domain'
import { leerAsistentes, leerDetalles, leerPresencia, leerVisitasActivas } from '@/lib/recorrido/data'
import type { InvitadoVisita } from '@/lib/recorrido/data'

// ─── Guard ────────────────────────────────────────────────────────────────────
// Todo el equipo puede subir, ordenar y guiar.

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol, nombre').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) throw new Error('Sin permisos.')
  return { user, nombre: (profile.nombre as string) ?? 'Equipo FP' }
}

type R<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

async function intentar<T>(fn: () => Promise<T>): Promise<R<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}

function texto(v: unknown, max = 4000): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t || null
}

function coord(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error('Posición no válida.')
  return Math.min(1, Math.max(0, n))
}

// ─── Lecturas ─────────────────────────────────────────────────────────────────

export async function getDetalles(): Promise<R<RcDetalle[]>> {
  return intentar(async () => { await requireAnyFP(); return leerDetalles() })
}

// ─── Detalles ─────────────────────────────────────────────────────────────────

export interface DetalleInput {
  x: number
  y: number
  titulo?: string
  estancia?: string | null
  categoria?: string | null
  texto?: string | null
  notas_guia?: string | null
  destacado?: boolean
  fotos?: { url: string; w?: number | null; h?: number | null }[]
}

export async function createDetalle(input: DetalleInput): Promise<R<{ id: string }>> {
  return intentar(async () => {
    const { user, nombre } = await requireAnyFP()
    const admin = createAdminClient()
    let orden = 0
    if (input.destacado) {
      const { data } = await admin.from('rc_detalles').select('orden').eq('evento', EVENTO_RC).eq('destacado', true)
        .order('orden', { ascending: false }).limit(1)
      orden = ((data?.[0]?.orden as number) ?? 0) + 10
    }
    const { data, error } = await admin.from('rc_detalles').insert({
      evento: EVENTO_RC,
      x: coord(input.x), y: coord(input.y),
      titulo: texto(input.titulo, 140) ?? '',
      estancia: texto(input.estancia, 60), categoria: texto(input.categoria, 60),
      texto: texto(input.texto), notas_guia: texto(input.notas_guia),
      destacado: !!input.destacado, orden,
      autor_id: user.id, autor_nombre: nombre,
    }).select('id').single()
    if (error) throw new Error(error.message)
    const id = data.id as string
    const fotos = (input.fotos ?? []).filter((f) => typeof f.url === 'string' && f.url.startsWith('https://'))
    if (fotos.length) {
      const { error: e2 } = await admin.from('rc_fotos').insert(
        fotos.map((f, i) => ({ detalle_id: id, url: f.url, w: f.w ?? null, h: f.h ?? null, orden: i }))
      )
      if (e2) throw new Error(e2.message)
    }
    return { id }
  })
}

export async function updateDetalle(id: string, input: Partial<DetalleInput>): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.x !== undefined) patch.x = coord(input.x)
    if (input.y !== undefined) patch.y = coord(input.y)
    if (input.titulo !== undefined) patch.titulo = texto(input.titulo, 140) ?? ''
    if (input.estancia !== undefined) patch.estancia = texto(input.estancia, 60)
    if (input.categoria !== undefined) patch.categoria = texto(input.categoria, 60)
    if (input.texto !== undefined) patch.texto = texto(input.texto)
    if (input.notas_guia !== undefined) patch.notas_guia = texto(input.notas_guia)
    if (input.destacado !== undefined) {
      patch.destacado = !!input.destacado
      if (input.destacado) {
        // Al entrar al recorrido va al final; luego se reordena en Selección.
        const { data: actual } = await admin.from('rc_detalles').select('destacado').eq('id', id).single()
        if (!actual?.destacado) {
          const { data } = await admin.from('rc_detalles').select('orden').eq('evento', EVENTO_RC).eq('destacado', true)
            .order('orden', { ascending: false }).limit(1)
          patch.orden = ((data?.[0]?.orden as number) ?? 0) + 10
        }
      }
    }
    const { error } = await admin.from('rc_detalles').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
    if (input.fotos) {
      // Las fotos se reescriben enteras: así el orden que se ve es el que queda.
      const fotos = input.fotos.filter((f) => typeof f.url === 'string' && f.url.startsWith('https://'))
      await admin.from('rc_fotos').delete().eq('detalle_id', id)
      if (fotos.length) {
        const { error: e2 } = await admin.from('rc_fotos').insert(
          fotos.map((f, i) => ({ detalle_id: id, url: f.url, w: f.w ?? null, h: f.h ?? null, orden: i }))
        )
        if (e2) throw new Error(e2.message)
      }
    }
    return undefined
  })
}

export async function deleteDetalle(id: string): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    const { error } = await createAdminClient().from('rc_detalles').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return undefined
  })
}

/** Une un duplicado en otro: sus fotos pasan al destino y el duplicado desaparece. */
export async function mergeDetalle(origenId: string, destinoId: string): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    if (origenId === destinoId) throw new Error('Es el mismo detalle.')
    const admin = createAdminClient()
    const [{ data: o }, { data: d }, { data: fd }] = await Promise.all([
      admin.from('rc_detalles').select('*').eq('id', origenId).single(),
      admin.from('rc_detalles').select('*').eq('id', destinoId).single(),
      admin.from('rc_fotos').select('orden').eq('detalle_id', destinoId).order('orden', { ascending: false }).limit(1),
    ])
    if (!o || !d) throw new Error('No se encontró el detalle.')
    const base = ((fd?.[0]?.orden as number) ?? -1) + 1
    const { data: fo } = await admin.from('rc_fotos').select('id, orden').eq('detalle_id', origenId).order('orden')
    await Promise.all((fo ?? []).map((f, i) =>
      admin.from('rc_fotos').update({ detalle_id: destinoId, orden: base + i }).eq('id', f.id)))
    // Si el destino no tenía texto o notas, hereda las del duplicado; si las dos tienen, se suman.
    const unir = (a: string | null, b: string | null) => (!a ? b : !b ? a : a === b ? a : `${a}\n\n${b}`)
    await admin.from('rc_detalles').update({
      titulo: d.titulo || o.titulo,
      estancia: d.estancia || o.estancia,
      categoria: d.categoria || o.categoria,
      texto: unir(d.texto, o.texto),
      notas_guia: unir(d.notas_guia, o.notas_guia),
      destacado: d.destacado || o.destacado,
      updated_at: new Date().toISOString(),
    }).eq('id', destinoId)
    await admin.from('rc_detalles').delete().eq('id', origenId)
    return undefined
  })
}

/** Fija el orden del recorrido: ids de los destacados, en orden. */
export async function setOrdenRecorrido(ids: string[]): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('rc_detalles').update({ orden: (i + 1) * 10, destacado: true }).eq('id', id)))
    return undefined
  })
}

export async function setPlano(p: { url: string; w: number; h: number }): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    if (!p.url?.startsWith('https://')) throw new Error('URL no válida.')
    const { error } = await createAdminClient().from('rc_config').upsert({
      evento: EVENTO_RC, plano_url: p.url, plano_w: Math.round(p.w), plano_h: Math.round(p.h), updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return undefined
  })
}

// ─── Visitas (el directo) ─────────────────────────────────────────────────────

export interface PanelGuia {
  visitas: RcVisita[]
  asistentes: InvitadoVisita[]
  presencia: Record<string, string>
}

export async function getPanelGuia(): Promise<R<PanelGuia>> {
  return intentar(async () => {
    await requireAnyFP()
    const [visitas, asistentes, presencia] = await Promise.all([leerVisitasActivas(), leerAsistentes(), leerPresencia()])
    return { visitas, asistentes, presencia }
  })
}

export async function startVisita(slot: string | null): Promise<R<RcVisita>> {
  return intentar(async () => {
    const { user, nombre } = await requireAnyFP()
    const { data, error } = await createAdminClient().from('rc_visitas').insert({
      evento: EVENTO_RC, slot: slot && /^\d{4}$/.test(slot) ? slot : null,
      guia_id: user.id, guia_nombre: nombre, modo: 'inicio', paso: 0,
    }).select('*').single()
    if (error) throw new Error(error.message)
    return data as RcVisita
  })
}

export async function updateVisita(id: string, e: RcEstado): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    const modo = ['inicio', 'recorrido', 'pregunta', 'fin'].includes(e.modo) ? e.modo : 'recorrido'
    const { error } = await createAdminClient().from('rc_visitas').update({
      modo, paso: Math.max(0, Math.floor(Number(e.paso) || 0)), detalle_id: e.detalle_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) throw new Error(error.message)
    return undefined
  })
}

export async function endVisita(id: string): Promise<R> {
  return intentar(async () => {
    await requireAnyFP()
    const now = new Date().toISOString()
    const { error } = await createAdminClient().from('rc_visitas')
      .update({ modo: 'fin', ended_at: now, updated_at: now }).eq('id', id)
    if (error) throw new Error(error.message)
    return undefined
  })
}

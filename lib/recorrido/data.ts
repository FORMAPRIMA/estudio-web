// Lecturas del recorrido (solo servidor). NO es 'use server' a propósito: si
// fuera Server Action, cualquiera podría pedir los detalles con notas del guía.

import { createAdminClient } from '@/lib/supabase/admin'
import { EVENTO } from '@/lib/open-house/evento'
import { EVENTO_RC } from './domain'
import type { RcDetalle, RcFoto, RcPlano, RcVisita } from './domain'

// Plano de partida: el de Claudio Coello 38 en Repasos, hasta que se suba el bueno.
const PLANO_POR_DEFECTO: RcPlano = {
  url: 'https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/repasos/1787059201135-fc762zvabh.jpg',
  w: 1079,
  h: 927,
}

export async function leerPlano(): Promise<RcPlano> {
  const { data } = await createAdminClient().from('rc_config').select('*').eq('evento', EVENTO_RC).maybeSingle()
  if (data?.plano_url) return { url: data.plano_url, w: data.plano_w ?? 0, h: data.plano_h ?? 0 }
  return PLANO_POR_DEFECTO
}

export async function leerDetalles(): Promise<RcDetalle[]> {
  const admin = createAdminClient()
  const { data: ds, error } = await admin
    .from('rc_detalles')
    .select('*')
    .eq('evento', EVENTO_RC)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const ids = (ds ?? []).map((d) => d.id as string)
  const fotos: RcFoto[] = []
  if (ids.length) {
    const { data: fs } = await admin.from('rc_fotos').select('*').in('detalle_id', ids).order('orden', { ascending: true })
    fotos.push(...((fs ?? []) as RcFoto[]))
  }
  const porDetalle = new Map<string, RcFoto[]>()
  fotos.forEach((f) => { const l = porDetalle.get(f.detalle_id) ?? []; l.push(f); porDetalle.set(f.detalle_id, l) })
  return (ds ?? []).map((d) => ({
    id: d.id, x: d.x, y: d.y, titulo: d.titulo ?? '', estancia: d.estancia, categoria: d.categoria,
    texto: d.texto, notas_guia: d.notas_guia, destacado: !!d.destacado, orden: d.orden ?? 0,
    autor_nombre: d.autor_nombre, created_at: d.created_at, updated_at: d.updated_at,
    fotos: porDetalle.get(d.id) ?? [],
  }))
}

export async function leerVisitasActivas(): Promise<RcVisita[]> {
  const { data } = await createAdminClient()
    .from('rc_visitas')
    .select('*')
    .eq('evento', EVENTO_RC)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
  return (data ?? []) as RcVisita[]
}

export async function leerVisita(id: string): Promise<RcVisita | null> {
  const { data } = await createAdminClient().from('rc_visitas').select('*').eq('id', id).maybeSingle()
  return (data as RcVisita) ?? null
}

// ─── Invitados (de las tablas del Open House) ────────────────────────────────

export interface InvitadoVisita {
  token: string
  nombre: string
  grupo: string
  slot: string | null       // turno al que asiste (null = sin reserva o no incluido)
  exclusiva: boolean
}

type FilaInv = { id: string; grupo_id: string; nombre: string; token: string }
type FilaGrupo = { id: string; nombre: string; exclusiva: boolean; reserva_slot: string | null; reserva_asistentes: string[] }

export async function leerAsistentes(): Promise<InvitadoVisita[]> {
  const admin = createAdminClient()
  const [{ data: gs }, { data: is }] = await Promise.all([
    admin.from('oh_grupos').select('id,nombre,exclusiva,reserva_slot,reserva_asistentes').eq('evento', EVENTO.slug),
    admin.from('oh_invitados').select('id,grupo_id,nombre,token').order('orden', { ascending: true }),
  ])
  const grupos = new Map(((gs ?? []) as FilaGrupo[]).map((g) => [g.id, g]))
  return ((is ?? []) as FilaInv[])
    .filter((i) => grupos.has(i.grupo_id))
    .map((i) => {
      const g = grupos.get(i.grupo_id)!
      const va = !!g.reserva_slot && (g.reserva_asistentes ?? []).includes(i.id)
      return { token: i.token, nombre: i.nombre, grupo: g.nombre, slot: va ? g.reserva_slot : null, exclusiva: g.exclusiva }
    })
}

export async function leerInvitado(token: string): Promise<InvitadoVisita | null> {
  const todos = await leerAsistentes()
  return todos.find((i) => i.token === token) ?? null
}

export async function leerPresencia(): Promise<Record<string, string>> {
  const { data } = await createAdminClient().from('rc_presencia').select('token, ultima')
  const out: Record<string, string> = {}
  ;(data ?? []).forEach((p) => { out[p.token as string] = p.ultima as string })
  return out
}

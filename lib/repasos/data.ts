// Lecturas de repasos de obra.
//
// OJO: esto NO es un fichero 'use server'. Es a propósito: si `loadProyectoData`
// fuese una Server Action, cualquiera con su action id podría invocarla con un
// proyecto_id y recibir los repasos internos. Al vivir aquí solo se puede llamar
// desde Server Components / API routes, que son los que aplican el guard o
// validan el token de la audiencia externa.

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  Repaso,
  RepasoAudiencia,
  RepasoEvento,
  RepasoFoto,
  RepasoPlano,
  RepasoProyecto,
  RepasoVisibilidad,
} from './domain'

export interface ProyectoData {
  proyecto: RepasoProyecto
  planos: RepasoPlano[]
  repasos: Repaso[]
}

/**
 * Carga un proyecto con sus planos y repasos (fotos y, en interno, historial).
 * `audiencia` filtra por visibilidad en la propia query: lo que una audiencia
 * externa no debe ver nunca llega al payload del navegador.
 */
export async function loadProyectoData(
  proyectoId: string,
  audiencia?: RepasoAudiencia
): Promise<ProyectoData | null> {
  const admin = createAdminClient()

  const { data: proyecto } = await admin
    .from('repaso_proyectos')
    .select('*')
    .eq('id', proyectoId)
    .maybeSingle()

  if (!proyecto) return null

  const { data: planos } = await admin
    .from('repaso_planos')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('orden')

  let query = admin
    .from('repasos')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('created_at')

  if (audiencia) {
    const visibles: RepasoVisibilidad[] =
      audiencia === 'cliente' ? ['cliente'] : ['cliente', 'constructora']
    query = query.in('visibilidad', visibles)
  }

  const { data: repasos } = await query

  const repasoIds = (repasos ?? []).map((r) => r.id)
  let fotos: RepasoFoto[] = []
  let eventos: RepasoEvento[] = []

  if (repasoIds.length) {
    const { data: f } = await admin
      .from('repaso_fotos')
      .select('*')
      .in('repaso_id', repasoIds)
      .order('orden')
    fotos = (f ?? []) as RepasoFoto[]

    // El historial es información interna: no viaja a los portales externos.
    if (!audiencia) {
      const { data: e } = await admin
        .from('repaso_eventos')
        .select('*')
        .in('repaso_id', repasoIds)
        .order('created_at')
      eventos = (e ?? []) as RepasoEvento[]
    }
  }

  return {
    proyecto: proyecto as RepasoProyecto,
    planos: (planos ?? []) as RepasoPlano[],
    repasos: (repasos ?? []).map((r) => ({
      ...(r as Omit<Repaso, 'fotos' | 'eventos' | 'x' | 'y'>),
      x: Number(r.x),
      y: Number(r.y),
      fotos: fotos.filter((ft) => ft.repaso_id === r.id),
      eventos: eventos.filter((ev) => ev.repaso_id === r.id),
    })),
  }
}

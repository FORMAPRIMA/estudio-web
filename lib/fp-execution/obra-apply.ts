// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Obra: helpers de aplicación de change_log
//
// Lógica compartida entre:
//   - app/actions/fpe-obra-presupuesto.ts (closeObraChangeSession)
//   - app/api/webhooks/docusign/route.ts  (al firmar acta cliente)
//
// Se importan desde un módulo "regular" (sin 'use server') para evitar que la
// firma con parámetros no serializables (admin client) entre en el catálogo
// de Server Actions de Next.js.
// ══════════════════════════════════════════════════════════════════════════════

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

const PROJECT_PATH = '/team/fp-execution/projects'

export type LogRow = {
  id: string; change_type: string; target_kind: string
  target_id: string | null; parent_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  categoria: string; sub_categoria: string | null
  destino_acta: 'cliente' | 'interna'
  razon: string; delta_monto: number
  created_at: string; created_by: string | null
  applied_at?:   string | null
  cancelled_at?: string | null
  session_id?:   string
  project_id?:   string
}

// ── Apply a single log entry to the live presupuesto ────────────────────────

export async function applyOneLog(
  admin:      Admin,
  log:        LogRow,
  project_id: string,
  session_id: string,
): Promise<string | null> {
  if (log.change_type === 'edit_partida' && log.target_id) {
    const nv = log.new_value as { cantidad: number; precio_unitario: number }
    const { error } = await admin
      .from('fpe_obra_line_items')
      .update({
        cantidad:                   nv.cantidad,
        precio_unitario_adjudicado: nv.precio_unitario,
      })
      .eq('id', log.target_id)
    if (error) throw new Error(`edit_partida ${log.target_id}: ${error.message}`)
    return log.target_id
  }
  if (log.change_type === 'new_partida') {
    const nv = log.new_value as { nombre: string; unidad_medida: string; cantidad: number; precio_unitario: number; obra_unit_id: string }
    const { data: inserted, error } = await admin
      .from('fpe_obra_line_items')
      .insert({
        obra_unit_id:                nv.obra_unit_id,
        custom_nombre:               nv.nombre,
        custom_unidad_medida:        nv.unidad_medida,
        cantidad_inicial:            nv.cantidad,
        cantidad:                    nv.cantidad,
        precio_unitario_adjudicado:  nv.precio_unitario,
        created_in_session_id:       session_id,
      })
      .select('id')
      .single()
    if (error) throw new Error(`new_partida: ${error.message}`)
    await admin.from('fpe_obra_change_log').update({ target_id: inserted.id }).eq('id', log.id)
    return inserted.id
  }
  if (log.change_type === 'new_unit') {
    const nv = log.new_value as { nombre: string; descripcion: string | null; chapter_id: string; partner_id: string }
    const { data: inserted, error: e1 } = await admin
      .from('fpe_obra_units')
      .insert({
        project_id,
        custom_nombre:         nv.nombre,
        custom_descripcion:    nv.descripcion,
        chapter_id:            nv.chapter_id,
        orden:                 9999,
        created_in_session_id: session_id,
      })
      .select('id')
      .single()
    if (e1) throw new Error(`new_unit: ${e1.message}`)
    const { error: e2 } = await admin
      .from('fpe_obra_unit_partners')
      .insert({ obra_unit_id: inserted.id, partner_id: nv.partner_id })
    if (e2) throw new Error(`new_unit partner: ${e2.message}`)
    await admin.from('fpe_obra_change_log').update({ target_id: inserted.id }).eq('id', log.id)
    return inserted.id
  }
  if (log.change_type === 'delete_partida' && log.target_id) {
    const { error } = await admin.from('fpe_obra_line_items').delete().eq('id', log.target_id)
    if (error) throw new Error(`delete_partida: ${error.message}`)
    return log.target_id
  }
  if (log.change_type === 'delete_unit' && log.target_id) {
    const { error } = await admin.from('fpe_obra_units').delete().eq('id', log.target_id)
    if (error) throw new Error(`delete_unit: ${error.message}`)
    return log.target_id
  }
  throw new Error(`Tipo de cambio no soportado o target_id ausente: ${log.change_type}`)
}

// ── Build snapshot (UI + acta) for a group of logs ──────────────────────────

export async function buildLogsSnapshot(admin: Admin, logs: LogRow[]) {
  const partidaIds = Array.from(new Set(
    logs.filter(l => l.target_kind === 'partida' && l.target_id).map(l => l.target_id as string)
  ))
  const unitIdsFromUnits = logs.filter(l => l.target_kind === 'unit' && l.target_id).map(l => l.target_id as string)
  const unitIdsFromPartidas = logs
    .filter(l => l.target_kind === 'partida' && l.parent_id)
    .map(l => l.parent_id as string)
  const unitIds = Array.from(new Set([...unitIdsFromUnits, ...unitIdsFromPartidas]))

  type LiInfo = { id: string; obra_unit_id: string; custom_nombre: string | null; template_line_item_id: string | null; custom_unidad_medida: string | null }
  const { data: lisRaw } = partidaIds.length > 0
    ? await admin.from('fpe_obra_line_items')
        .select('id, obra_unit_id, custom_nombre, template_line_item_id, custom_unidad_medida')
        .in('id', partidaIds)
    : { data: [] as LiInfo[] }
  const liInfoById: Record<string, LiInfo> = {}
  for (const li of (lisRaw ?? []) as LiInfo[]) liInfoById[li.id] = li

  const tplLiIds = ((lisRaw ?? []) as LiInfo[]).map(l => l.template_line_item_id).filter((x): x is string => !!x)
  type TplLi = { id: string; nombre: string; unidad_medida: string }
  const { data: tplLisRaw } = tplLiIds.length > 0
    ? await admin.from('fpe_template_line_items').select('id, nombre, unidad_medida').in('id', tplLiIds)
    : { data: [] as TplLi[] }
  const tplLiById: Record<string, TplLi> = {}
  for (const t of (tplLisRaw ?? []) as TplLi[]) tplLiById[t.id] = t

  type UnitInfo = { id: string; chapter_id: string | null; custom_nombre: string | null; template_unit_id: string | null }
  const { data: unitsRaw } = unitIds.length > 0
    ? await admin.from('fpe_obra_units')
        .select('id, chapter_id, custom_nombre, template_unit_id')
        .in('id', unitIds)
    : { data: [] as UnitInfo[] }
  const unitInfoById: Record<string, UnitInfo> = {}
  for (const u of (unitsRaw ?? []) as UnitInfo[]) unitInfoById[u.id] = u

  const tplUnitIds = ((unitsRaw ?? []) as UnitInfo[]).map(u => u.template_unit_id).filter((x): x is string => !!x)
  type TplU = { id: string; nombre: string }
  const { data: tplUsRaw } = tplUnitIds.length > 0
    ? await admin.from('fpe_template_units').select('id, nombre').in('id', tplUnitIds)
    : { data: [] as TplU[] }
  const tplUnitById: Record<string, TplU> = {}
  for (const t of (tplUsRaw ?? []) as TplU[]) tplUnitById[t.id] = t

  const chapterIds = Array.from(new Set([
    ...((unitsRaw ?? []) as UnitInfo[]).map(u => u.chapter_id).filter((x): x is string => !!x),
    ...logs.filter(l => l.change_type === 'new_unit').map(l => (l.new_value as { chapter_id?: string } | null)?.chapter_id).filter((x): x is string => !!x),
  ]))
  type Ch = { id: string; nombre: string }
  const { data: chsRaw } = chapterIds.length > 0
    ? await admin.from('fpe_template_chapters').select('id, nombre').in('id', chapterIds)
    : { data: [] as Ch[] }
  const chByIdLocal: Record<string, Ch> = {}
  for (const c of (chsRaw ?? []) as Ch[]) chByIdLocal[c.id] = c

  return logs.map(l => {
    const isPartida = l.target_kind === 'partida'
    const isUnit    = l.target_kind === 'unit'

    let unitNombre = '—'
    let chapterId: string | null = null
    if (isPartida) {
      const parentId = l.parent_id
      if (parentId) {
        const u = unitInfoById[parentId]
        if (u) {
          unitNombre = u.custom_nombre ?? (u.template_unit_id ? tplUnitById[u.template_unit_id]?.nombre : null) ?? '—'
          chapterId  = u.chapter_id
        }
      }
    } else if (isUnit) {
      if (l.target_id) {
        const u = unitInfoById[l.target_id]
        if (u) {
          unitNombre = u.custom_nombre ?? (u.template_unit_id ? tplUnitById[u.template_unit_id]?.nombre : null) ?? '—'
          chapterId  = u.chapter_id
        }
      } else {
        const nv = l.new_value as { nombre?: string; chapter_id?: string } | null
        unitNombre = nv?.nombre ?? '—'
        chapterId  = nv?.chapter_id ?? null
      }
    }

    let partidaNombre: string | null = null
    let unidadMedida: string | null  = null
    if (isPartida) {
      if (l.target_id) {
        const li = liInfoById[l.target_id]
        if (li) {
          partidaNombre = li.custom_nombre ?? (li.template_line_item_id ? tplLiById[li.template_line_item_id]?.nombre : null) ?? '—'
          unidadMedida  = li.custom_unidad_medida ?? (li.template_line_item_id ? tplLiById[li.template_line_item_id]?.unidad_medida : null) ?? null
        }
      } else {
        const nv = l.new_value as { nombre?: string; unidad_medida?: string } | null
        partidaNombre = nv?.nombre ?? '—'
        unidadMedida  = nv?.unidad_medida ?? null
      }
    }

    return {
      id:              l.id,
      change_type:     l.change_type,
      categoria:       l.categoria,
      sub_categoria:   l.sub_categoria,
      razon:           l.razon,
      delta_monto:     Number(l.delta_monto),
      created_at:      l.created_at,
      old_value:       l.old_value,
      new_value:       l.new_value,
      capitulo_nombre: chapterId ? (chByIdLocal[chapterId]?.nombre ?? '—') : '—',
      unidad_nombre:   unitNombre,
      partida_nombre:  partidaNombre,
      unidad_medida:   unidadMedida,
    }
  })
}

// ── Apply pending cliente changes when the acta is signed ────────────────────

export async function applyClienteChangesForActa(acta_id: string): Promise<{ applied: number } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data: acta } = await admin
      .from('fpe_obra_actas')
      .select('id, project_id, session_id, kind')
      .eq('id', acta_id)
      .single()
    if (!acta) return { error: 'Acta no encontrada.' }
    if (acta.kind !== 'cliente') return { applied: 0 }

    const { data: logsRaw } = await admin
      .from('fpe_obra_change_log')
      .select('*')
      .eq('session_id', acta.session_id)
      .eq('destino_acta', 'cliente')
      .is('applied_at', null)
      .is('cancelled_at', null)
      .order('created_at', { ascending: true })

    const logs = (logsRaw ?? []) as LogRow[]
    if (logs.length === 0) return { applied: 0 }

    const nowIso = new Date().toISOString()
    let count = 0
    for (const log of logs) {
      try {
        await applyOneLog(admin, log, acta.project_id, acta.session_id)
        await admin.from('fpe_obra_change_log').update({ applied_at: nowIso }).eq('id', log.id)
        count++
      } catch (err) {
        console.error(`[applyClienteChangesForActa] log ${log.id}:`, err)
      }
    }

    revalidatePath(`${PROJECT_PATH}/${acta.project_id}`)
    return { applied: count }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error aplicando cambios cliente.' }
  }
}

export async function cancelClienteChangesForActa(acta_id: string): Promise<{ cancelled: number } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data: acta } = await admin
      .from('fpe_obra_actas')
      .select('id, project_id, session_id, kind')
      .eq('id', acta_id)
      .single()
    if (!acta) return { error: 'Acta no encontrada.' }
    if (acta.kind !== 'cliente') return { cancelled: 0 }

    const { data: updRaw, error } = await admin
      .from('fpe_obra_change_log')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('session_id', acta.session_id)
      .eq('destino_acta', 'cliente')
      .is('applied_at', null)
      .is('cancelled_at', null)
      .select('id')
    if (error) return { error: error.message }

    revalidatePath(`${PROJECT_PATH}/${acta.project_id}`)
    return { cancelled: (updRaw ?? []).length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error cancelando cambios.' }
  }
}

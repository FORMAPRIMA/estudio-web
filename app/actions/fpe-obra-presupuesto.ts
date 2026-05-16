'use server'

// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Gestión de Obra — Presupuesto
//
// Sesiones de cambios sobre el presupuesto vivo (fpe_obra_line_items / units).
// Patrón:
//   1. openSession crea una sesión abierta.
//   2. addChangeLog_* registran cambios pendientes (no tocan obra_*).
//   3. closeSession aplica todos los cambios y genera 0/1/2 actas.
//
// Cancelar una sesión descarta todos los pending changes sin tocar nada.
// ══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PROJECT_PATH = '/team/fp-execution/projects'

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    throw new Error('Sin permisos.')
  return user
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ChangeCategoria    = 'a_peticion_cliente' | 'imprevisto' | 'ajuste'
export type ChangeSubCategoria = 'trasladable_cliente' | 'costo_empresa' | null
export type DestinoActa        = 'cliente' | 'interna'

function computeDestino(cat: ChangeCategoria, sub: ChangeSubCategoria): DestinoActa {
  if (cat === 'a_peticion_cliente')     return 'cliente'
  if (sub === 'trasladable_cliente')    return 'cliente'
  return 'interna'
}

function validateRazon(razon: string): string | null {
  if (!razon || razon.trim().length < 40) {
    return 'La razón debe tener al menos 40 caracteres.'
  }
  if (razon.length > 2000) {
    return 'La razón no puede superar 2000 caracteres.'
  }
  return null
}

function validateCategorization(cat: ChangeCategoria, sub: ChangeSubCategoria): string | null {
  if (cat === 'a_peticion_cliente' && sub !== null) {
    return '"A petición de cliente" no puede llevar sub-categoría.'
  }
  if ((cat === 'imprevisto' || cat === 'ajuste') && sub === null) {
    return 'Imprevisto/ajuste requieren sub-categoría (trasladable al cliente o a costo de empresa).'
  }
  return null
}

// ══════════════════════════════════════════════════════════════════════════════
// Sesiones
// ══════════════════════════════════════════════════════════════════════════════

export async function openObraChangeSession(
  project_id: string,
): Promise<{ session_id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    // Idempotency: si ya hay una abierta, devolver esa
    const { data: existing } = await admin
      .from('fpe_obra_change_sessions')
      .select('id')
      .eq('project_id', project_id)
      .eq('status', 'open')
      .maybeSingle()
    if (existing) return { session_id: existing.id }

    const { data: row, error } = await admin
      .from('fpe_obra_change_sessions')
      .insert({ project_id, opened_by: user.id })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${project_id}`)
    return { session_id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function cancelObraChangeSession(
  session_id: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: session, error: sErr } = await admin
      .from('fpe_obra_change_sessions')
      .select('id, project_id, status')
      .eq('id', session_id)
      .single()
    if (sErr || !session) return { error: 'Sesión no encontrada.' }
    if (session.status !== 'open') return { error: 'Sólo se pueden cancelar sesiones abiertas.' }

    const { error } = await admin
      .from('fpe_obra_change_sessions')
      .update({
        status:     'cancelled',
        closed_at:  new Date().toISOString(),
        closed_by:  user.id,
      })
      .eq('id', session_id)
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Change log: 5 tipos de cambio
// ══════════════════════════════════════════════════════════════════════════════

interface BaseChangeArgs {
  session_id:    string
  categoria:     ChangeCategoria
  sub_categoria: ChangeSubCategoria
  razon:         string
}

async function ensureSessionOpen(admin: ReturnType<typeof createAdminClient>, session_id: string) {
  const { data: s } = await admin
    .from('fpe_obra_change_sessions')
    .select('id, project_id, status')
    .eq('id', session_id)
    .single()
  if (!s) throw new Error('Sesión no encontrada.')
  if (s.status !== 'open') throw new Error('La sesión no está abierta.')
  return s as { id: string; project_id: string; status: string }
}

// ── edit_partida ────────────────────────────────────────────────────────────

export async function logEditPartida(args: BaseChangeArgs & {
  partida_id:  string
  new_cantidad: number
  new_precio:   number
}): Promise<{ log_id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const session = await ensureSessionOpen(admin, args.session_id)

    const validErr = validateCategorization(args.categoria, args.sub_categoria)
                  || validateRazon(args.razon)
    if (validErr) return { error: validErr }

    if (!Number.isFinite(args.new_cantidad) || args.new_cantidad < 0) return { error: 'Cantidad inválida.' }
    if (!Number.isFinite(args.new_precio)   || args.new_precio   < 0) return { error: 'Precio inválido.' }

    const { data: part } = await admin
      .from('fpe_obra_line_items')
      .select('id, obra_unit_id, cantidad, precio_unitario_adjudicado')
      .eq('id', args.partida_id)
      .single()
    if (!part) return { error: 'Partida no encontrada.' }

    const oldTotal = (Number(part.cantidad) || 0) * (Number(part.precio_unitario_adjudicado) || 0)
    const newTotal = args.new_cantidad * args.new_precio
    const delta    = newTotal - oldTotal

    if (Number(part.cantidad) === args.new_cantidad && Number(part.precio_unitario_adjudicado) === args.new_precio) {
      return { error: 'No hay cambios respecto al valor actual.' }
    }

    const destino = computeDestino(args.categoria, args.sub_categoria)
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:    args.session_id,
        project_id:    session.project_id,
        change_type:   'edit_partida',
        target_kind:   'partida',
        target_id:     args.partida_id,
        parent_id:     part.obra_unit_id,
        old_value:     { cantidad: part.cantidad, precio_unitario: part.precio_unitario_adjudicado },
        new_value:     { cantidad: args.new_cantidad, precio_unitario: args.new_precio },
        categoria:     args.categoria,
        sub_categoria: args.sub_categoria,
        destino_acta:  destino,
        razon:         args.razon,
        delta_monto:   delta,
        created_by:    user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { log_id: log.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── new_partida (en UE existente) ───────────────────────────────────────────

export async function logNewPartida(args: BaseChangeArgs & {
  obra_unit_id:   string
  nombre:         string
  unidad_medida:  string
  cantidad:       number
  precio:         number
}): Promise<{ log_id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const session = await ensureSessionOpen(admin, args.session_id)

    const validErr = validateCategorization(args.categoria, args.sub_categoria)
                  || validateRazon(args.razon)
    if (validErr) return { error: validErr }

    if (!args.nombre || args.nombre.trim().length < 3) return { error: 'Nombre demasiado corto.' }
    if (!args.unidad_medida)                            return { error: 'Falta unidad de medida.' }
    if (!Number.isFinite(args.cantidad) || args.cantidad < 0) return { error: 'Cantidad inválida.' }
    if (!Number.isFinite(args.precio)   || args.precio   < 0) return { error: 'Precio inválido.' }

    const { data: unit } = await admin
      .from('fpe_obra_units').select('id, project_id').eq('id', args.obra_unit_id).single()
    if (!unit) return { error: 'UE no encontrada.' }
    if (unit.project_id !== session.project_id) return { error: 'UE no pertenece al proyecto.' }

    const destino = computeDestino(args.categoria, args.sub_categoria)
    const delta   = args.cantidad * args.precio
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:    args.session_id,
        project_id:    session.project_id,
        change_type:   'new_partida',
        target_kind:   'partida',
        target_id:     null,
        parent_id:     args.obra_unit_id,
        old_value:     null,
        new_value:     {
          nombre:         args.nombre.trim(),
          unidad_medida:  args.unidad_medida.trim(),
          cantidad:       args.cantidad,
          precio_unitario: args.precio,
          obra_unit_id:   args.obra_unit_id,
        },
        categoria:     args.categoria,
        sub_categoria: args.sub_categoria,
        destino_acta:  destino,
        razon:         args.razon,
        delta_monto:   delta,
        created_by:    user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { log_id: log.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── new_unit (UE en capítulo existente) ─────────────────────────────────────

export async function logNewUnit(args: BaseChangeArgs & {
  chapter_id:  string
  nombre:      string
  descripcion: string | null
  partner_id:  string
}): Promise<{ log_id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const session = await ensureSessionOpen(admin, args.session_id)

    const validErr = validateCategorization(args.categoria, args.sub_categoria)
                  || validateRazon(args.razon)
    if (validErr) return { error: validErr }

    if (!args.nombre || args.nombre.trim().length < 3) return { error: 'Nombre demasiado corto.' }
    if (!args.chapter_id) return { error: 'Falta capítulo.' }
    if (!args.partner_id) return { error: 'Falta partner adjudicado.' }

    const destino = computeDestino(args.categoria, args.sub_categoria)
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:    args.session_id,
        project_id:    session.project_id,
        change_type:   'new_unit',
        target_kind:   'unit',
        target_id:     null,
        parent_id:     args.chapter_id,
        old_value:     null,
        new_value:     {
          nombre:      args.nombre.trim(),
          descripcion: args.descripcion?.trim() ?? null,
          chapter_id:  args.chapter_id,
          partner_id:  args.partner_id,
        },
        categoria:     args.categoria,
        sub_categoria: args.sub_categoria,
        destino_acta:  destino,
        razon:         args.razon,
        delta_monto:   0,
        created_by:    user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { log_id: log.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── delete_partida / delete_unit (siempre interna) ──────────────────────────

export async function logDeletePartida(args: {
  session_id: string
  partida_id: string
  razon:      string
}): Promise<{ log_id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const session = await ensureSessionOpen(admin, args.session_id)
    const validErr = validateRazon(args.razon)
    if (validErr) return { error: validErr }

    const { data: part } = await admin
      .from('fpe_obra_line_items')
      .select('id, obra_unit_id, cantidad, precio_unitario_adjudicado, template_line_item_id, custom_nombre, custom_unidad_medida')
      .eq('id', args.partida_id)
      .single()
    if (!part) return { error: 'Partida no encontrada.' }

    const delta = -((Number(part.cantidad) || 0) * (Number(part.precio_unitario_adjudicado) || 0))
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:    args.session_id,
        project_id:    session.project_id,
        change_type:   'delete_partida',
        target_kind:   'partida',
        target_id:     args.partida_id,
        parent_id:     part.obra_unit_id,
        old_value:     part as unknown,
        new_value:     null,
        categoria:     'ajuste',
        sub_categoria: 'costo_empresa',
        destino_acta:  'interna',
        razon:         args.razon,
        delta_monto:   delta,
        created_by:    user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { log_id: log.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function logDeleteUnit(args: {
  session_id: string
  unit_id:    string
  razon:      string
}): Promise<{ log_id: string } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const session = await ensureSessionOpen(admin, args.session_id)
    const validErr = validateRazon(args.razon)
    if (validErr) return { error: validErr }

    const { data: unit } = await admin
      .from('fpe_obra_units')
      .select('id, project_id, template_unit_id, custom_nombre, chapter_id')
      .eq('id', args.unit_id)
      .single()
    if (!unit || unit.project_id !== session.project_id) return { error: 'UE no encontrada.' }

    const { data: lis } = await admin
      .from('fpe_obra_line_items')
      .select('cantidad, precio_unitario_adjudicado')
      .eq('obra_unit_id', args.unit_id)
    type LI = { cantidad: number; precio_unitario_adjudicado: number | null }
    const total = (lis ?? []).reduce((a, li: LI) =>
      a + (Number(li.cantidad) || 0) * (Number(li.precio_unitario_adjudicado) || 0), 0)

    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:    args.session_id,
        project_id:    session.project_id,
        change_type:   'delete_unit',
        target_kind:   'unit',
        target_id:     args.unit_id,
        parent_id:     unit.chapter_id,
        old_value:     unit as unknown,
        new_value:     null,
        categoria:     'ajuste',
        sub_categoria: 'costo_empresa',
        destino_acta:  'interna',
        razon:         args.razon,
        delta_monto:   -total,
        created_by:    user.id,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { log_id: log.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── remove a pending log entry (undo) ───────────────────────────────────────

export async function removeChangeLog(
  log_id: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: log } = await admin
      .from('fpe_obra_change_log')
      .select('id, session_id, project_id, session:fpe_obra_change_sessions(status)')
      .eq('id', log_id)
      .single()
    if (!log) return { error: 'Cambio no encontrado.' }
    const session = (log as unknown as { session: { status: string } | null }).session
    if (!session || session.status !== 'open') return { error: 'La sesión ya no está abierta.' }

    const { error } = await admin.from('fpe_obra_change_log').delete().eq('id', log_id)
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${log.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// closeObraChangeSession
// Aplica todos los logs en orden, genera 0/1/2 actas, marca sesión closed.
// ══════════════════════════════════════════════════════════════════════════════

export async function closeObraChangeSession(
  session_id: string,
): Promise<
  | { success: true; acta_ids: string[]; acta_cliente_id: string | null; acta_interna_id: string | null }
  | { error: string }
> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const session = await ensureSessionOpen(admin, session_id)

    const { data: logsRaw } = await admin
      .from('fpe_obra_change_log')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    type LogRow = {
      id: string; change_type: string; target_kind: string
      target_id: string | null; parent_id: string | null
      old_value: Record<string, unknown> | null
      new_value: Record<string, unknown> | null
      categoria: string; sub_categoria: string | null; destino_acta: 'cliente' | 'interna'
      razon: string; delta_monto: number
      created_at: string; created_by: string | null
    }
    const logs = (logsRaw ?? []) as LogRow[]

    if (logs.length === 0) {
      return { error: 'No hay cambios registrados. Cancela la sesión si no vas a aplicar nada.' }
    }

    // ── Apply each change atomically ────────────────────────────────────────
    // Strategy: apply sequentially. If any fails, roll back manually by
    // reverting prior changes (best-effort). For now: stop at first error
    // and surface; admin can re-open by hand.

    type AppliedChange = LogRow & { applied_target_id: string | null }
    const applied: AppliedChange[] = []

    for (const log of logs) {
      try {
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
          applied.push({ ...log, applied_target_id: log.target_id })
        }
        else if (log.change_type === 'new_partida') {
          const nv = log.new_value as {
            nombre: string; unidad_medida: string; cantidad: number; precio_unitario: number; obra_unit_id: string
          }
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
          // Update target_id in log
          await admin.from('fpe_obra_change_log').update({ target_id: inserted.id }).eq('id', log.id)
          applied.push({ ...log, applied_target_id: inserted.id })
        }
        else if (log.change_type === 'new_unit') {
          const nv = log.new_value as { nombre: string; descripcion: string | null; chapter_id: string; partner_id: string }
          const { data: inserted, error: e1 } = await admin
            .from('fpe_obra_units')
            .insert({
              project_id:            session.project_id,
              custom_nombre:         nv.nombre,
              custom_descripcion:    nv.descripcion,
              chapter_id:            nv.chapter_id,
              orden:                 9999,
              created_in_session_id: session_id,
            })
            .select('id')
            .single()
          if (e1) throw new Error(`new_unit: ${e1.message}`)
          // Insert partner assignment
          const { error: e2 } = await admin
            .from('fpe_obra_unit_partners')
            .insert({
              obra_unit_id: inserted.id,
              partner_id:   nv.partner_id,
            })
          if (e2) throw new Error(`new_unit partner: ${e2.message}`)
          await admin.from('fpe_obra_change_log').update({ target_id: inserted.id }).eq('id', log.id)
          applied.push({ ...log, applied_target_id: inserted.id })
        }
        else if (log.change_type === 'delete_partida' && log.target_id) {
          const { error } = await admin.from('fpe_obra_line_items').delete().eq('id', log.target_id)
          if (error) throw new Error(`delete_partida: ${error.message}`)
          applied.push({ ...log, applied_target_id: log.target_id })
        }
        else if (log.change_type === 'delete_unit' && log.target_id) {
          const { error } = await admin.from('fpe_obra_units').delete().eq('id', log.target_id)
          if (error) throw new Error(`delete_unit: ${error.message}`)
          applied.push({ ...log, applied_target_id: log.target_id })
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error aplicando cambio.' }
      }
    }

    // ── Group by destino ────────────────────────────────────────────────────
    const clienteLogs = applied.filter(l => l.destino_acta === 'cliente')
    const internaLogs = applied.filter(l => l.destino_acta === 'interna')

    const year = new Date().getUTCFullYear()
    const createdActaIds: string[] = []
    let actaClienteId: string | null = null
    let actaInternaId: string | null = null

    // Helper: next numero per (project, kind, year)
    const nextNumero = async (kind: 'cliente' | 'interna'): Promise<number> => {
      const { data: maxRow } = await admin
        .from('fpe_obra_actas')
        .select('numero')
        .eq('project_id', session.project_id)
        .eq('kind', kind)
        .eq('year', year)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle()
      return ((maxRow?.numero as number | undefined) ?? 0) + 1
    }

    const buildSnapshot = async (group: AppliedChange[]) => {
      // Capítulos / partners por contexto: pre-fetch
      const partidaIds = group.filter(l => l.target_kind === 'partida' && l.applied_target_id).map(l => l.applied_target_id as string)
      const unitIds    = Array.from(new Set([
        ...group.filter(l => l.target_kind === 'unit' && l.applied_target_id).map(l => l.applied_target_id as string),
        ...group.filter(l => l.target_kind === 'partida' && l.parent_id).map(l => l.parent_id as string),
      ]))
      type LiInfo = { id: string; obra_unit_id: string; custom_nombre: string | null; template_line_item_id: string | null; custom_unidad_medida: string | null }
      const { data: lisRaw } = partidaIds.length > 0
        ? await admin.from('fpe_obra_line_items')
            .select('id, obra_unit_id, custom_nombre, template_line_item_id, custom_unidad_medida')
            .in('id', partidaIds)
        : { data: [] as LiInfo[] }
      const liInfoById: Record<string, LiInfo> = {}
      for (const li of (lisRaw ?? []) as LiInfo[]) liInfoById[li.id] = li

      // Resolve template names for partidas (those without custom_nombre)
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

      const chapterIds = Array.from(new Set(((unitsRaw ?? []) as UnitInfo[]).map(u => u.chapter_id).filter((x): x is string => !!x)))
      type Ch = { id: string; nombre: string }
      const { data: chsRaw } = chapterIds.length > 0
        ? await admin.from('fpe_template_chapters').select('id, nombre').in('id', chapterIds)
        : { data: [] as Ch[] }
      const chByIdLocal: Record<string, Ch> = {}
      for (const c of (chsRaw ?? []) as Ch[]) chByIdLocal[c.id] = c

      const resolveUnitNombre = (uid: string | null): string => {
        if (!uid) return '—'
        const u = unitInfoById[uid]
        if (!u) return '—'
        if (u.custom_nombre) return u.custom_nombre
        if (u.template_unit_id) return tplUnitById[u.template_unit_id]?.nombre ?? '—'
        return '—'
      }
      const resolveChapterNombre = (chid: string | null): string => {
        if (!chid) return '—'
        return chByIdLocal[chid]?.nombre ?? '—'
      }
      const resolvePartidaNombre = (lid: string | null): { nombre: string; unidad_medida: string } => {
        if (!lid) return { nombre: '—', unidad_medida: '—' }
        const li = liInfoById[lid]
        if (!li) return { nombre: '—', unidad_medida: '—' }
        if (li.custom_nombre) return { nombre: li.custom_nombre, unidad_medida: li.custom_unidad_medida ?? '—' }
        if (li.template_line_item_id) {
          const t = tplLiById[li.template_line_item_id]
          return { nombre: t?.nombre ?? '—', unidad_medida: t?.unidad_medida ?? '—' }
        }
        return { nombre: '—', unidad_medida: '—' }
      }

      return group.map(l => {
        const unitId   = l.target_kind === 'unit' ? l.applied_target_id : l.parent_id
        const partidaId = l.target_kind === 'partida' ? l.applied_target_id : null
        const u  = unitId ? unitInfoById[unitId] : null
        const p  = partidaId ? resolvePartidaNombre(partidaId) : null
        return {
          id:             l.id,
          change_type:    l.change_type,
          categoria:      l.categoria,
          sub_categoria:  l.sub_categoria,
          razon:          l.razon,
          delta_monto:    Number(l.delta_monto),
          created_at:     l.created_at,
          old_value:      l.old_value,
          new_value:      l.new_value,
          capitulo_nombre: resolveChapterNombre(u?.chapter_id ?? null),
          unidad_nombre:   resolveUnitNombre(unitId),
          partida_nombre:  p?.nombre ?? null,
          unidad_medida:   p?.unidad_medida ?? null,
        }
      })
    }

    if (clienteLogs.length > 0) {
      const numero  = await nextNumero('cliente')
      const codigo  = `AC-${year}-${String(numero).padStart(3, '0')}`
      const total   = clienteLogs.reduce((a, l) => a + Number(l.delta_monto), 0)
      const detalle = await buildSnapshot(clienteLogs)
      const snapshot = {
        kind: 'cliente' as const,
        codigo,
        year,
        numero,
        generated_at: new Date().toISOString(),
        total_delta: total,
        changes: detalle,
      }
      const { data: acta, error } = await admin
        .from('fpe_obra_actas')
        .insert({
          project_id:        session.project_id,
          session_id,
          kind:              'cliente',
          year,
          numero,
          codigo,
          snapshot,
          total_delta_monto: total,
          generated_by:      user.id,
        })
        .select('id')
        .single()
      if (error) return { error: `acta cliente: ${error.message}` }
      actaClienteId = acta.id
      createdActaIds.push(acta.id)
    }

    if (internaLogs.length > 0) {
      const numero  = await nextNumero('interna')
      const codigo  = `AI-${year}-${String(numero).padStart(3, '0')}`
      const total   = internaLogs.reduce((a, l) => a + Number(l.delta_monto), 0)
      const detalle = await buildSnapshot(internaLogs)
      const snapshot = {
        kind: 'interna' as const,
        codigo,
        year,
        numero,
        generated_at: new Date().toISOString(),
        total_delta: total,
        changes: detalle,
      }
      const { data: acta, error } = await admin
        .from('fpe_obra_actas')
        .insert({
          project_id:        session.project_id,
          session_id,
          kind:              'interna',
          year,
          numero,
          codigo,
          snapshot,
          total_delta_monto: total,
          generated_by:      user.id,
        })
        .select('id')
        .single()
      if (error) return { error: `acta interna: ${error.message}` }
      actaInternaId = acta.id
      createdActaIds.push(acta.id)
    }

    // ── Mark session closed ─────────────────────────────────────────────────
    const { error: closeErr } = await admin
      .from('fpe_obra_change_sessions')
      .update({
        status:    'closed',
        closed_at: new Date().toISOString(),
        closed_by: user.id,
      })
      .eq('id', session_id)
    if (closeErr) return { error: closeErr.message }

    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return { success: true, acta_ids: createdActaIds, acta_cliente_id: actaClienteId, acta_interna_id: actaInternaId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

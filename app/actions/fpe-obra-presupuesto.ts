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
import {
  applyOneLog,
  applyReflectToPartner,
  buildLogsSnapshot,
  recomputeObraSchedule,
  type LogRow,
} from '@/lib/fp-execution/obra-apply'

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

// Resuelve el partner adjudicado a una UE. Si la UE no tiene partner asignado,
// devuelve null (ej. UEs custom recién creadas en otra sesión sin completarse).
async function partnerOfUnit(
  admin: ReturnType<typeof createAdminClient>,
  obra_unit_id: string,
): Promise<string | null> {
  const { data } = await admin
    .from('fpe_obra_unit_partners')
    .select('partner_id')
    .eq('obra_unit_id', obra_unit_id)
    .limit(1)
    .maybeSingle()
  return (data?.partner_id as string | undefined) ?? null
}

// ── edit_partida ────────────────────────────────────────────────────────────

export async function logEditPartida(args: BaseChangeArgs & {
  partida_id:          string
  new_cantidad:        number
  new_precio:          number
  reflect_to_partner?: boolean
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

    const destino  = computeDestino(args.categoria, args.sub_categoria)
    const partner  = await partnerOfUnit(admin, part.obra_unit_id)
    const reflect  = !!args.reflect_to_partner && !!partner

    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:           args.session_id,
        project_id:           session.project_id,
        change_type:          'edit_partida',
        target_kind:          'partida',
        target_id:            args.partida_id,
        parent_id:            part.obra_unit_id,
        old_value:            { cantidad: part.cantidad, precio_unitario: part.precio_unitario_adjudicado },
        new_value:            { cantidad: args.new_cantidad, precio_unitario: args.new_precio },
        categoria:            args.categoria,
        sub_categoria:        args.sub_categoria,
        destino_acta:         destino,
        razon:                args.razon,
        delta_monto:          delta,
        reflect_to_partner:   reflect,
        effective_partner_id: partner,
        created_by:           user.id,
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
  obra_unit_id:        string
  nombre:              string
  unidad_medida:       string
  cantidad:            number
  precio:              number
  reflect_to_partner?: boolean
  add_to_template?:    boolean
  descripcion?:        string | null
  discipline_id?:      string | null
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
      .from('fpe_obra_units').select('id, project_id, template_unit_id').eq('id', args.obra_unit_id).single()
    if (!unit) return { error: 'UE no encontrada.' }
    if (unit.project_id !== session.project_id) return { error: 'UE no pertenece al proyecto.' }

    if (args.add_to_template && !unit.template_unit_id) {
      return { error: 'No se puede promover esta partida al template porque la UE parent es custom. Promueve antes la UE al template.' }
    }

    const destino = computeDestino(args.categoria, args.sub_categoria)
    const delta   = args.cantidad * args.precio
    const partner = await partnerOfUnit(admin, args.obra_unit_id)
    const reflect = !!args.reflect_to_partner && !!partner

    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:           args.session_id,
        project_id:           session.project_id,
        change_type:          'new_partida',
        target_kind:          'partida',
        target_id:            null,
        parent_id:            args.obra_unit_id,
        old_value:            null,
        new_value:            {
          nombre:         args.nombre.trim(),
          unidad_medida:  args.unidad_medida.trim(),
          cantidad:       args.cantidad,
          precio_unitario: args.precio,
          obra_unit_id:   args.obra_unit_id,
          descripcion:    args.descripcion?.trim() || null,
          discipline_id:  args.discipline_id ?? null,
        },
        categoria:            args.categoria,
        sub_categoria:        args.sub_categoria,
        destino_acta:         destino,
        razon:                args.razon,
        delta_monto:          delta,
        reflect_to_partner:   reflect,
        effective_partner_id: partner,
        add_to_template:      !!args.add_to_template,
        created_by:           user.id,
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
  chapter_id:              string
  nombre:                  string
  descripcion:             string | null
  partner_id:              string
  reflect_to_partner?:     boolean
  add_to_template?:        boolean
  principal_discipline_id?: string | null
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
    const reflect = !!args.reflect_to_partner
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:           args.session_id,
        project_id:           session.project_id,
        change_type:          'new_unit',
        target_kind:          'unit',
        target_id:            null,
        parent_id:            args.chapter_id,
        old_value:            null,
        new_value:            {
          nombre:                  args.nombre.trim(),
          descripcion:             args.descripcion?.trim() ?? null,
          chapter_id:              args.chapter_id,
          partner_id:              args.partner_id,
          principal_discipline_id: args.principal_discipline_id ?? null,
        },
        categoria:            args.categoria,
        sub_categoria:        args.sub_categoria,
        destino_acta:         destino,
        razon:                args.razon,
        delta_monto:          0,
        reflect_to_partner:   reflect,
        effective_partner_id: args.partner_id,
        add_to_template:      !!args.add_to_template,
        created_by:           user.id,
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
    const partner = await partnerOfUnit(admin, part.obra_unit_id)
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:           args.session_id,
        project_id:           session.project_id,
        change_type:          'delete_partida',
        target_kind:          'partida',
        target_id:            args.partida_id,
        parent_id:            part.obra_unit_id,
        old_value:            part as unknown,
        new_value:            null,
        categoria:            'ajuste',
        sub_categoria:        'costo_empresa',
        destino_acta:         'interna',
        razon:                args.razon,
        delta_monto:          delta,
        effective_partner_id: partner,
        created_by:           user.id,
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

    const partner = await partnerOfUnit(admin, args.unit_id)
    const { data: log, error } = await admin
      .from('fpe_obra_change_log')
      .insert({
        session_id:           args.session_id,
        project_id:           session.project_id,
        change_type:          'delete_unit',
        target_kind:          'unit',
        target_id:            args.unit_id,
        parent_id:            unit.chapter_id,
        old_value:            unit as unknown,
        new_value:            null,
        categoria:            'ajuste',
        sub_categoria:        'costo_empresa',
        destino_acta:         'interna',
        razon:                args.razon,
        delta_monto:          -total,
        effective_partner_id: partner,
        created_by:           user.id,
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
//
// Aplica SÓLO los logs interna; los cliente quedan pendientes hasta que el
// cliente firme el acta (DocuSign webhook → applyClienteChangesAfterSign).
// Genera 0/1/2 actas. La acta cliente nace en estado 'generada' y debe
// enviarse a DocuSign explícitamente desde el botón "Cerrar y enviar a firma".
// ══════════════════════════════════════════════════════════════════════════════

export interface PhaseImpactInput {
  obra_phase_id: string
  extra_dias:    number
}

export async function closeObraChangeSession(
  session_id: string,
  phase_impacts: PhaseImpactInput[] = [],
): Promise<
  | { success: true; acta_ids: string[]; acta_cliente_id: string | null; acta_interna_id: string | null; pending_cliente_changes: number }
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

    const logs = (logsRaw ?? []) as LogRow[]
    if (logs.length === 0) {
      return { error: 'No hay cambios registrados. Cancela la sesión si no vas a aplicar nada.' }
    }

    // ── Aplicar SÓLO interna; cliente quedan pendientes ─────────────────────
    const nowIso = new Date().toISOString()
    for (const log of logs) {
      if (log.destino_acta !== 'interna') continue
      try {
        await applyOneLog(admin, log, session.project_id, session_id)
        await admin.from('fpe_obra_change_log').update({ applied_at: nowIso }).eq('id', log.id)
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error aplicando cambio interno.' }
      }
    }

    // ── Refetch logs para tener target_id actualizados de new_* aplicados ───
    const { data: refreshedLogsRaw } = await admin
      .from('fpe_obra_change_log')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
    const refreshedLogs = (refreshedLogsRaw ?? []) as LogRow[]

    const clienteLogs = refreshedLogs.filter(l => l.destino_acta === 'cliente')
    const internaLogs = refreshedLogs.filter(l => l.destino_acta === 'interna')

    const year = new Date().getUTCFullYear()
    const createdActaIds: string[] = []
    let actaClienteId: string | null = null
    let actaInternaId: string | null = null

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

    if (clienteLogs.length > 0) {
      const numero  = await nextNumero('cliente')
      const codigo  = `AC-${year}-${String(numero).padStart(3, '0')}`
      const total   = clienteLogs.reduce((a, l) => a + Number(l.delta_monto), 0)
      const detalle = await buildLogsSnapshot(admin, clienteLogs)
      const snapshot = {
        kind: 'cliente' as const,
        codigo, year, numero,
        generated_at: new Date().toISOString(),
        total_delta:  total,
        changes:      detalle,
      }
      const { data: acta, error } = await admin
        .from('fpe_obra_actas')
        .insert({
          project_id: session.project_id, session_id,
          kind: 'cliente', year, numero, codigo,
          snapshot, total_delta_monto: total, generated_by: user.id,
        })
        .select('id').single()
      if (error) return { error: `acta cliente: ${error.message}` }
      actaClienteId = acta.id
      createdActaIds.push(acta.id)
    }

    if (internaLogs.length > 0) {
      const numero  = await nextNumero('interna')
      const codigo  = `AI-${year}-${String(numero).padStart(3, '0')}`
      const total   = internaLogs.reduce((a, l) => a + Number(l.delta_monto), 0)
      const detalle = await buildLogsSnapshot(admin, internaLogs)
      const snapshot = {
        kind: 'interna' as const,
        codigo, year, numero,
        generated_at: new Date().toISOString(),
        total_delta:  total,
        changes:      detalle,
      }
      const { data: acta, error } = await admin
        .from('fpe_obra_actas')
        .insert({
          project_id: session.project_id, session_id,
          kind: 'interna', year, numero, codigo,
          snapshot, total_delta_monto: total, generated_by: user.id,
        })
        .select('id').single()
      if (error) return { error: `acta interna: ${error.message}` }
      actaInternaId = acta.id
      createdActaIds.push(acta.id)
    }

    // ── Reflejar al EP los logs marcados reflect_to_partner=true ────────────
    // (Tanto cliente como interna: cliente queda pending_aprobacion hasta firma)
    for (const log of refreshedLogs) {
      if (!log.reflect_to_partner) continue
      try {
        await applyReflectToPartner(admin, log, session.project_id)
      } catch (err) {
        console.error('[closeObraChangeSession] applyReflectToPartner:', err)
      }
    }

    // ── Persistir phase_impacts vinculados al acta correspondiente ──────────
    // Si hay acta cliente → impactos cuelgan de ella (esperan firma).
    // Si solo interna   → impactos cuelgan de la interna (aplican inmediato).
    const impactsTargetActaId = actaClienteId ?? actaInternaId
    const cleanImpacts = phase_impacts.filter(im =>
      !!im.obra_phase_id && Number.isFinite(im.extra_dias) && im.extra_dias !== 0,
    )
    if (impactsTargetActaId && cleanImpacts.length > 0) {
      const { error: impErr } = await admin
        .from('fpe_obra_acta_phase_impacts')
        .insert(cleanImpacts.map(im => ({
          acta_id:       impactsTargetActaId,
          obra_phase_id: im.obra_phase_id,
          extra_dias:    Math.trunc(im.extra_dias),
        })))
      if (impErr) console.error('[closeObraChangeSession] phase_impacts insert:', impErr)
    }

    const { error: closeErr } = await admin
      .from('fpe_obra_change_sessions')
      .update({
        status:    'closed',
        closed_at: new Date().toISOString(),
        closed_by: user.id,
      })
      .eq('id', session_id)
    if (closeErr) return { error: closeErr.message }

    // Si la sesión es SOLO interna (sin acta cliente), aplicar phase_impacts
    // ya mismo al cronograma vivo y recomputar.
    if (!actaClienteId && actaInternaId && cleanImpacts.length > 0) {
      for (const im of cleanImpacts) {
        const { data: phase } = await admin
          .from('fpe_obra_phases')
          .select('id, planned_duration_dias')
          .eq('id', im.obra_phase_id)
          .single()
        if (!phase) continue
        const current = Number(phase.planned_duration_dias ?? 0)
        const next    = Math.max(0, current + Math.trunc(im.extra_dias))
        await admin
          .from('fpe_obra_phases')
          .update({ planned_duration_dias: next })
          .eq('id', phase.id)
      }
      await recomputeObraSchedule(session.project_id)
    }

    revalidatePath(`${PROJECT_PATH}/${session.project_id}`)
    return {
      success: true,
      acta_ids: createdActaIds,
      acta_cliente_id: actaClienteId,
      acta_interna_id: actaInternaId,
      pending_cliente_changes: clienteLogs.length,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}


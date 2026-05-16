'use server'

// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Gestión de Obra
//
// Acciones del módulo post-adjudicación. Trabaja sobre las tablas espejo
// fpe_obra_*. La activación clona los datos relevantes de licitación y los
// independiza de ahí en adelante (flujo unidireccional: licitación → obra).
// ══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { loadProjectScheduleInputs } from '@/lib/fp-execution/loadProjectSchedule'
import {
  computeAwardedSchedule,
  type AwardedPhaseDuration,
  type ProjectUnitChapterMap,
} from '@/lib/fp-execution/schedule'
import type { ObraPhaseStatus } from '@/lib/fp-execution/obra'
import { recomputeObraSchedule } from '@/lib/fp-execution/obra-apply'

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

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)

// ── Tipos del baseline snapshot ───────────────────────────────────────────────
// JSONB inmutable que se escribe una vez al activar gestión de obra. Lo lee el
// Gantt vivo para dibujar la "sombra" del plan original superpuesta al actual.

export interface ObraBaselineSnapshot {
  generated_at:      string                              // ISO timestamp
  fecha_inicio:      string | null                      // YYYY-MM-DD
  m2:                number | null
  duracion_factor:   number
  total_days:        number
  chapter_days:      Record<string, number>             // chapter_id → días
  phases: Array<{
    template_phase_id: string
    chapter_id:        string
    nombre:            string
    orden:             number
    duracion_pct:      number
    achieves:          string[]                          // milestone_ids
    requires:          string[]                          // milestone_ids
    partner_ids:       string[]
    start_date:        string                            // YYYY-MM-DD
    end_date:          string                            // YYYY-MM-DD
    duration_dias:     number
    source:            'awarded' | 'parametric'
  }>
  milestones: Array<{
    template_milestone_id: string
    nombre:                string
    orden:                 number
    es_hito_pago:          boolean
    planned_date:          string | null               // YYYY-MM-DD
  }>
  units: Array<{
    project_unit_id:  string
    template_unit_id: string
    chapter_id:       string
    nombre:           string
    partner_id:       string | null
  }>
}

// ══════════════════════════════════════════════════════════════════════════════
// startObraManagement
// Activa la plataforma de gestión de obra de un proyecto FPE.
// Clona tablas relevantes a sus espejos fpe_obra_* y materializa el cronograma
// vivo a partir del cronograma adjudicado (Dream Team).
// Es idempotente: si ya fue activado, devuelve { alreadyStarted: true }.
// ══════════════════════════════════════════════════════════════════════════════

export async function startObraManagement(
  project_id: string,
): Promise<
  | { success: true; alreadyStarted?: boolean }
  | { error: string }
> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    // ── 0. Idempotencia ────────────────────────────────────────────────────
    const { data: projectRow, error: projErr } = await admin
      .from('fpe_projects')
      .select('id, obra_management_started_at, m2_construccion, duracion_factor, fecha_inicio_obra, obra_start_date_override')
      .eq('id', project_id)
      .single()
    if (projErr || !projectRow) return { error: 'Proyecto no encontrado.' }
    if (projectRow.obra_management_started_at) {
      return { success: true, alreadyStarted: true }
    }

    // ── 1. Cargar inputs del cronograma + adjudicaciones ───────────────────
    const inputs = await loadProjectScheduleInputs(admin, project_id)
    if (!inputs || inputs.scheduleChapters.length === 0) {
      return { error: 'No hay scope adjudicado para iniciar gestión de obra.' }
    }
    if (!inputs.fechaInicio) {
      return { error: 'Falta fecha de inicio de obra. Configúrala en Dream Team antes de activar gestión.' }
    }

    const { data: awardsRaw, error: awardsErr } = await admin
      .from('fpe_project_unit_awards')
      .select('id, project_unit_id, partner_id, bid_id')
      .eq('project_id', project_id)
    if (awardsErr) return { error: awardsErr.message }
    if (!awardsRaw || awardsRaw.length === 0) {
      return { error: 'No hay UEs adjudicadas. Cierra el Dream Team antes de activar gestión de obra.' }
    }

    type AwardRow = { id: string; project_unit_id: string; partner_id: string; bid_id: string }
    const awards = awardsRaw as AwardRow[]
    const awardedUnitIds = awards.map(a => a.project_unit_id)
    const awardedBidIds  = Array.from(new Set(awards.map(a => a.bid_id)))

    // ── 2. project_units + project_line_items del scope adjudicado ─────────
    const { data: unitsRaw, error: unitsErr } = await admin
      .from('fpe_project_units')
      .select(`
        id, template_unit_id, notas, orden,
        template_unit:fpe_template_units ( id, chapter_id, nombre ),
        line_items:fpe_project_line_items (
          id, template_line_item_id, cantidad, notas
        )
      `)
      .in('id', awardedUnitIds)
    if (unitsErr) return { error: unitsErr.message }

    type UnitRow = {
      id: string; template_unit_id: string; notas: string | null; orden: number
      template_unit: { id: string; chapter_id: string; nombre: string } | null
      line_items: { id: string; template_line_item_id: string; cantidad: number; notas: string | null }[]
    }
    const units = (unitsRaw ?? []) as unknown as UnitRow[]

    const unitById: Record<string, UnitRow> = {}
    for (const u of units) unitById[u.id] = u
    const partnerByUnit: Record<string, string> = {}
    for (const a of awards) partnerByUnit[a.project_unit_id] = a.partner_id
    const awardByUnit: Record<string, AwardRow> = {}
    for (const a of awards) awardByUnit[a.project_unit_id] = a

    // ── 3. Precios adjudicados por partida (bid_line_items del bid ganador) ─
    const { data: bliRaw } = await admin
      .from('fpe_bid_line_items')
      .select('bid_id, project_line_item_id, precio_unitario')
      .in('bid_id', awardedBidIds)
    type BliRow = { bid_id: string; project_line_item_id: string; precio_unitario: number }
    const priceByPli: Record<string, number> = {}
    for (const r of (bliRaw ?? []) as BliRow[]) priceByPli[r.project_line_item_id] = r.precio_unitario

    // ── 4. Phase durations adjudicadas (para el cronograma vivo) ───────────
    const { data: durRaw } = await admin
      .from('fpe_bid_phase_durations')
      .select('bid_id, template_phase_id, duracion_dias')
      .in('bid_id', awardedBidIds)
    type DurRow = { bid_id: string; template_phase_id: string; duracion_dias: number }
    const bidIdToAward: Record<string, AwardRow[]> = {}
    for (const a of awards) bidIdToAward[a.bid_id] = [...(bidIdToAward[a.bid_id] ?? []), a]

    const awardedDurations: AwardedPhaseDuration[] = []
    const unitChapters:     ProjectUnitChapterMap[] = []
    for (const u of units) {
      const chId = u.template_unit?.chapter_id
      if (chId) unitChapters.push({ project_unit_id: u.id, chapter_id: chId })
    }
    for (const d of (durRaw ?? []) as DurRow[]) {
      const matchingAwards = bidIdToAward[d.bid_id] ?? []
      for (const a of matchingAwards) {
        awardedDurations.push({
          template_phase_id: d.template_phase_id,
          project_unit_id:   a.project_unit_id,
          partner_id:        a.partner_id,
          duracion_dias:     d.duracion_dias,
        })
      }
    }

    // ── 5. Calcular cronograma baseline ────────────────────────────────────
    const startDate = new Date(inputs.fechaInicio)
    if (Number.isNaN(startDate.getTime())) {
      return { error: 'Fecha de inicio inválida.' }
    }
    const schedule = computeAwardedSchedule(
      inputs.scheduleChapters,
      startDate,
      inputs.m2,
      inputs.chapterDaysOverrides,
      inputs.duracionFactor,
      awardedDurations,
      unitChapters,
    )

    // ── 6. Milestones template (sólo los alcanzables desde fases del scope) ─
    const reachableMilestoneIds = new Set<string>()
    for (const ch of inputs.scheduleChapters) {
      for (const ph of ch.phases) {
        for (const mid of ph.achieves) reachableMilestoneIds.add(mid)
        for (const mid of ph.requires) reachableMilestoneIds.add(mid)
      }
    }
    const milestoneIdsArr = Array.from(reachableMilestoneIds)
    const { data: milestonesRaw } = milestoneIdsArr.length > 0
      ? await admin
          .from('fpe_template_milestones')
          .select('id, nombre, orden, es_hito_pago')
          .in('id', milestoneIdsArr)
          .order('orden', { ascending: true })
      : { data: [] as { id: string; nombre: string; orden: number; es_hito_pago: boolean }[] }
    type MilestoneRow = { id: string; nombre: string; orden: number; es_hito_pago: boolean }
    const milestoneRows = (milestonesRaw ?? []) as MilestoneRow[]

    // ── 7. project_chapter_settings (overrides por proyecto) ───────────────
    const { data: chapterSettingsRaw } = await admin
      .from('fpe_project_chapter_settings')
      .select('chapter_id, principal_discipline_id, duracion_dias_override')
      .eq('project_id', project_id)
    type ChSet = { chapter_id: string; principal_discipline_id: string | null; duracion_dias_override: number | null }
    const chapterSettings = (chapterSettingsRaw ?? []) as ChSet[]

    // ── 8. Documentos del scope adjudicado ────────────────────────────────
    const { data: docsRaw } = await admin
      .from('fpe_documents')
      .select('id, project_unit_id, nombre, storage_path, mime_type, size_bytes, discipline_tags')
      .eq('project_id', project_id)
      .in('project_unit_id', awardedUnitIds)
    type DocRow = { id: string; project_unit_id: string | null; nombre: string; storage_path: string; mime_type: string | null; size_bytes: number | null; discipline_tags: string[] | null }
    const docs = (docsRaw ?? []) as DocRow[]

    // ── 9. Contratos del proyecto y sus payment schedules ──────────────────
    const partnerIds = Array.from(new Set(awards.map(a => a.partner_id)))
    const { data: tendersRaw } = await admin
      .from('fpe_tenders')
      .select('id')
      .eq('project_id', project_id)
    const tenderIds = ((tendersRaw ?? []) as { id: string }[]).map(t => t.id)

    const { data: contractsRaw } = tenderIds.length > 0
      ? await admin
          .from('fpe_awards')
          .select('partner_id, contract:fpe_contracts(id)')
          .in('tender_id', tenderIds)
          .in('partner_id', partnerIds)
      : { data: [] as { partner_id: string; contract: { id: string } | null }[] }
    type ContractWithPartner = { partner_id: string; contract: { id: string } | null }
    const contractByPartner: Record<string, string> = {}
    for (const a of (contractsRaw ?? []) as unknown as ContractWithPartner[]) {
      if (a.contract?.id) contractByPartner[a.partner_id] = a.contract.id
    }
    const contractIds = Object.values(contractByPartner)
    const contractPartner: Record<string, string> = {}
    for (const [pid, cid] of Object.entries(contractByPartner)) contractPartner[cid] = pid

    type PsRow = { id: string; contract_id: string; nombre: string; pct: number; monto: number; milestone_id: string | null; status: string; fecha_estimada: string | null; fecha_pago: string | null; orden: number }
    const { data: psRaw } = contractIds.length > 0
      ? await admin
          .from('fpe_contract_payment_schedule')
          .select('id, contract_id, nombre, pct, monto, milestone_id, status, fecha_estimada, fecha_pago, orden')
          .in('contract_id', contractIds)
          .order('orden', { ascending: true })
      : { data: [] as PsRow[] }
    const psRows = (psRaw ?? []) as PsRow[]

    // ── 10. Build baseline snapshot (JSONB) ───────────────────────────────
    const snapshotUnits: ObraBaselineSnapshot['units'] = units.map(u => ({
      project_unit_id:  u.id,
      template_unit_id: u.template_unit_id,
      chapter_id:       u.template_unit?.chapter_id ?? '',
      nombre:           u.template_unit?.nombre ?? '',
      partner_id:       partnerByUnit[u.id] ?? null,
    }))

    const snapshotPhases: ObraBaselineSnapshot['phases'] = []
    for (const ch of inputs.scheduleChapters) {
      for (const ph of ch.phases) {
        const entry = schedule.phases[ph.id]
        if (!entry) continue
        snapshotPhases.push({
          template_phase_id: ph.id,
          chapter_id:        ch.id,
          nombre:            ph.nombre,
          orden:             ph.orden,
          duracion_pct:      ph.duracion_pct,
          achieves:          ph.achieves,
          requires:          ph.requires,
          partner_ids:       schedule.phasePartners[ph.id] ?? [],
          start_date:        toIsoDate(entry.startDate),
          end_date:          toIsoDate(entry.endDate),
          duration_dias:     Math.max(0, Math.round(entry.durationDays)),
          source:            schedule.phaseSource[ph.id] ?? 'parametric',
        })
      }
    }

    const snapshotMilestones: ObraBaselineSnapshot['milestones'] = milestoneRows.map(m => {
      const dt = schedule.milestoneDates[m.id]
      return {
        template_milestone_id: m.id,
        nombre:                m.nombre,
        orden:                 m.orden,
        es_hito_pago:          m.es_hito_pago,
        planned_date:          dt ? toIsoDate(dt) : null,
      }
    })

    const snapshot: ObraBaselineSnapshot = {
      generated_at:    new Date().toISOString(),
      fecha_inicio:    inputs.fechaInicio,
      m2:              inputs.m2,
      duracion_factor: inputs.duracionFactor,
      total_days:      Math.round(schedule.totalDays),
      chapter_days:    schedule.chapterDays,
      phases:          snapshotPhases,
      milestones:      snapshotMilestones,
      units:           snapshotUnits,
    }

    // ── 11. INSERTS ────────────────────────────────────────────────────────
    // (Supabase client no expone transacciones multi-tabla; ejecutamos
    // secuencial y abortamos al primer error. La columna obra_management_started_at
    // se setea al final, por lo que un fallo intermedio deja datos parciales
    // pero el proyecto NO queda marcado como iniciado y se puede reintentar
    // tras limpiar — la action es idempotente por marca.)

    // 11.a fpe_obra_units
    const obraUnitsInsert = units.map(u => ({
      project_id:             project_id,
      source_project_unit_id: u.id,
      template_unit_id:       u.template_unit_id,
      notas:                  u.notas,
      orden:                  u.orden,
    }))
    const { data: insertedUnits, error: insUnitsErr } = await admin
      .from('fpe_obra_units')
      .insert(obraUnitsInsert)
      .select('id, source_project_unit_id')
    if (insUnitsErr) return { error: `obra_units: ${insUnitsErr.message}` }
    type InsertedUnit = { id: string; source_project_unit_id: string }
    const obraUnitIdByProjectUnitId: Record<string, string> = {}
    for (const r of (insertedUnits ?? []) as InsertedUnit[]) {
      obraUnitIdByProjectUnitId[r.source_project_unit_id] = r.id
    }

    // 11.b fpe_obra_line_items
    const liInserts: Array<{
      obra_unit_id: string
      source_project_line_item_id: string
      template_line_item_id: string
      cantidad_inicial: number
      cantidad: number
      precio_unitario_adjudicado: number | null
      notas: string | null
    }> = []
    for (const u of units) {
      const obraUnitId = obraUnitIdByProjectUnitId[u.id]
      if (!obraUnitId) continue
      for (const li of u.line_items) {
        liInserts.push({
          obra_unit_id:                obraUnitId,
          source_project_line_item_id: li.id,
          template_line_item_id:       li.template_line_item_id,
          cantidad_inicial:            li.cantidad,
          cantidad:                    li.cantidad,
          precio_unitario_adjudicado:  priceByPli[li.id] ?? null,
          notas:                       li.notas,
        })
      }
    }
    if (liInserts.length > 0) {
      const { error: insLiErr } = await admin.from('fpe_obra_line_items').insert(liInserts)
      if (insLiErr) return { error: `obra_line_items: ${insLiErr.message}` }
    }

    // 11.c fpe_obra_unit_partners
    const upInserts = awards
      .map(a => {
        const obraUnitId = obraUnitIdByProjectUnitId[a.project_unit_id]
        if (!obraUnitId) return null
        return {
          obra_unit_id:       obraUnitId,
          partner_id:         a.partner_id,
          source_award_id:    a.id,
          source_bid_id:      a.bid_id,
          source_contract_id: contractByPartner[a.partner_id] ?? null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    if (upInserts.length > 0) {
      const { error: insUpErr } = await admin.from('fpe_obra_unit_partners').insert(upInserts)
      if (insUpErr) return { error: `obra_unit_partners: ${insUpErr.message}` }
    }

    // 11.d fpe_obra_chapter_settings
    if (chapterSettings.length > 0) {
      const csInserts = chapterSettings.map(cs => ({
        project_id,
        chapter_id:              cs.chapter_id,
        principal_discipline_id: cs.principal_discipline_id,
        duracion_dias_override:  cs.duracion_dias_override,
      }))
      const { error: insCsErr } = await admin.from('fpe_obra_chapter_settings').insert(csInserts)
      if (insCsErr) return { error: `obra_chapter_settings: ${insCsErr.message}` }
    }

    // 11.e fpe_obra_milestones (insertamos ANTES de payment_schedule para
    //      poder mapear obra_milestone_id por template_milestone_id)
    const obraMilestoneIdByTemplate: Record<string, string> = {}
    if (milestoneRows.length > 0) {
      const msInserts = milestoneRows.map(m => {
        const dt = schedule.milestoneDates[m.id]
        return {
          project_id,
          template_milestone_id: m.id,
          nombre:                m.nombre,
          orden:                 m.orden,
          es_hito_pago:          m.es_hito_pago,
          planned_date:          dt ? toIsoDate(dt) : null,
        }
      })
      const { data: insMs, error: insMsErr } = await admin
        .from('fpe_obra_milestones')
        .insert(msInserts)
        .select('id, template_milestone_id')
      if (insMsErr) return { error: `obra_milestones: ${insMsErr.message}` }
      for (const r of (insMs ?? []) as { id: string; template_milestone_id: string }[]) {
        obraMilestoneIdByTemplate[r.template_milestone_id] = r.id
      }
    }

    // 11.f fpe_obra_phases
    const phasesInsert = snapshotPhases.map(p => ({
      project_id,
      template_phase_id:     p.template_phase_id,
      chapter_id:            p.chapter_id,
      nombre:                p.nombre,
      orden:                 p.orden,
      duracion_pct:          p.duracion_pct,
      achieves:              p.achieves,
      requires:              p.requires,
      partner_ids:           p.partner_ids,
      planned_start_date:    p.start_date,
      planned_end_date:      p.end_date,
      planned_duration_dias: p.duration_dias,
    }))
    if (phasesInsert.length > 0) {
      const { error: insPhErr } = await admin.from('fpe_obra_phases').insert(phasesInsert)
      if (insPhErr) return { error: `obra_phases: ${insPhErr.message}` }
    }

    // 11.g fpe_obra_payment_schedule (espejo vivo de los pagos)
    if (psRows.length > 0) {
      const psInserts = psRows.map(ps => ({
        project_id,
        contract_id:                ps.contract_id,
        source_payment_schedule_id: ps.id,
        obra_milestone_id:          ps.milestone_id ? (obraMilestoneIdByTemplate[ps.milestone_id] ?? null) : null,
        partner_id:                 contractPartner[ps.contract_id] ?? '',
        nombre:                     ps.nombre,
        pct:                        ps.pct,
        monto:                      ps.monto,
        status:                     ps.status,
        fecha_estimada:             ps.fecha_estimada,
        fecha_pago:                 ps.fecha_pago,
        orden:                      ps.orden,
      })).filter(r => r.partner_id !== '')
      if (psInserts.length > 0) {
        const { error: insPsErr } = await admin.from('fpe_obra_payment_schedule').insert(psInserts)
        if (insPsErr) return { error: `obra_payment_schedule: ${insPsErr.message}` }
      }
    }

    // 11.h fpe_obra_documents
    if (docs.length > 0) {
      const docInserts = docs.map(d => ({
        project_id,
        obra_unit_id:       d.project_unit_id ? (obraUnitIdByProjectUnitId[d.project_unit_id] ?? null) : null,
        source_document_id: d.id,
        nombre:             d.nombre,
        storage_path:       d.storage_path,
        mime_type:          d.mime_type,
        size_bytes:         d.size_bytes,
        discipline_tags:    d.discipline_tags ?? [],
        doc_kind:           'original' as const,
      }))
      const { error: insDocErr } = await admin.from('fpe_obra_documents').insert(docInserts)
      if (insDocErr) return { error: `obra_documents: ${insDocErr.message}` }
    }

    // ── 12. Marcar proyecto como obra iniciada ────────────────────────────
    const { error: updErr } = await admin
      .from('fpe_projects')
      .update({
        obra_management_started_at: new Date().toISOString(),
        obra_management_started_by: user.id,
        obra_baseline_snapshot:     snapshot,
        obra_m2:                    inputs.m2,
        obra_duracion_factor:       inputs.duracionFactor,
        obra_fecha_inicio:          inputs.fechaInicio,
        updated_at:                 new Date().toISOString(),
      })
      .eq('id', project_id)
    if (updErr) return { error: `flag activación: ${updErr.message}` }

    revalidatePath(`${PROJECT_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Ciclo de vida de la obra
// - setObraFechaInicio: cambia la fecha planificada de inicio de obra. Aplica
//   un shift de calendario al planned_*_date de TODAS las fases y al
//   planned_date de TODOS los hitos para que el cronograma se desplace en bloque.
// - marcarObraIniciada / revertirObraIniciada: marca el arranque físico.
// ══════════════════════════════════════════════════════════════════════════════

function isoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function setObraFechaInicio(
  project_id: string,
  fecha:      string,
): Promise<{ success: true; deltaDays: number } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    if (!isoDateOnly(fecha)) return { error: 'Formato de fecha inválido. Esperado YYYY-MM-DD.' }

    const { data: project, error: pErr } = await admin
      .from('fpe_projects')
      .select('id, obra_fecha_inicio, obra_management_started_at')
      .eq('id', project_id)
      .single()
    if (pErr || !project) return { error: 'Proyecto no encontrado.' }
    if (!project.obra_management_started_at) return { error: 'La gestión de obra no está activada.' }
    if (!project.obra_fecha_inicio)         return { error: 'No hay fecha base; reinicia la activación de obra.' }

    const oldDate = new Date(project.obra_fecha_inicio + 'T00:00:00Z')
    const newDate = new Date(fecha + 'T00:00:00Z')
    const deltaDays = Math.round((newDate.getTime() - oldDate.getTime()) / 86400000)

    if (deltaDays === 0) {
      return { success: true, deltaDays: 0 }
    }

    // Update anchor del proyecto
    const { error: updErr } = await admin
      .from('fpe_projects')
      .update({ obra_fecha_inicio: fecha, updated_at: new Date().toISOString() })
      .eq('id', project_id)
    if (updErr) return { error: updErr.message }

    // Recomputar cronograma desde el nuevo anchor. Esto respeta actual_*_date
    // (hechos) y propaga la nueva fecha de inicio a todas las planned_*_date.
    const rec = await recomputeObraSchedule(project_id)
    if ('error' in rec) return { error: rec.error }

    revalidatePath(`${PROJECT_PATH}/${project_id}`)
    return { success: true, deltaDays }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function marcarObraIniciada(
  project_id: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({
        obra_iniciada_at: new Date().toISOString(),
        obra_iniciada_by: user.id,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', project_id)
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function revertirObraIniciada(
  project_id: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('fpe_projects')
      .update({
        obra_iniciada_at: null,
        obra_iniciada_by: null,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', project_id)
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Mutaciones del Gantt vivo
// Cada action edita una sola fila de fpe_obra_phases o fpe_obra_milestones.
// Solo escriben en tablas fpe_obra_*, nunca en las de licitación.
// ══════════════════════════════════════════════════════════════════════════════

export async function updateObraPhase(args: {
  phase_id:              string
  status?:               ObraPhaseStatus
  pct_avance?:           number
  actual_start_date?:    string | null
  actual_end_date?:      string | null
  actual_duration_dias?: number | null
  notas?:                string | null
}): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // Validate dates
    for (const f of ['actual_start_date', 'actual_end_date'] as const) {
      const v = args[f]
      if (v !== undefined && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return { error: `Formato de fecha inválido en ${f}.` }
      }
    }
    if (args.pct_avance !== undefined && (args.pct_avance < 0 || args.pct_avance > 100)) {
      return { error: 'pct_avance fuera de rango [0, 100].' }
    }
    if (args.actual_duration_dias !== undefined && args.actual_duration_dias !== null && args.actual_duration_dias < 0) {
      return { error: 'Duración real no puede ser negativa.' }
    }

    // Build patch (only set keys that were passed)
    const patch: Record<string, unknown> = {}
    if (args.status               !== undefined) patch.status               = args.status
    if (args.pct_avance           !== undefined) patch.pct_avance           = args.pct_avance
    if (args.actual_start_date    !== undefined) patch.actual_start_date    = args.actual_start_date
    if (args.actual_end_date      !== undefined) patch.actual_end_date      = args.actual_end_date
    if (args.actual_duration_dias !== undefined) patch.actual_duration_dias = args.actual_duration_dias
    if (args.notas                !== undefined) patch.notas                = args.notas

    if (Object.keys(patch).length === 0) return { success: true }

    const { data: phaseRow, error: selErr } = await admin
      .from('fpe_obra_phases')
      .update(patch)
      .eq('id', args.phase_id)
      .select('project_id')
      .single()

    if (selErr) return { error: selErr.message }

    // Si cambió algún input del cronograma, recomputar la cascada de planned_*.
    const affectsSchedule =
      args.actual_start_date    !== undefined ||
      args.actual_end_date      !== undefined ||
      args.actual_duration_dias !== undefined
    if (affectsSchedule) {
      await recomputeObraSchedule(phaseRow.project_id)
    }

    revalidatePath(`${PROJECT_PATH}/${phaseRow.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function achieveObraMilestone(args: {
  milestone_id: string
  actual_date:  string | null    // YYYY-MM-DD or null para revertir
}): Promise<{ success: true } | { error: string }> {
  try {
    const user = await requireManagerOrPartner()
    const admin = createAdminClient()

    if (args.actual_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(args.actual_date)) {
      return { error: 'Formato de fecha inválido. Esperado YYYY-MM-DD.' }
    }

    const patch = args.actual_date
      ? { actual_date: args.actual_date, achieved_at: new Date().toISOString(), achieved_by: user.id }
      : { actual_date: null,             achieved_at: null,                     achieved_by: null }

    const { data: msRow, error } = await admin
      .from('fpe_obra_milestones')
      .update(patch)
      .eq('id', args.milestone_id)
      .select('project_id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(`${PROJECT_PATH}/${msRow.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// pushUnitToObra
// Flujo unidireccional: licitación → obra. Copia una UE adjudicada (tarde) al
// espacio de obra. Soporta el caso "la UE pertenece a un capítulo que ya está
// presente en obra" (caso más común post-arranque).
//
// Para UEs de capítulos completamente nuevos en obra: devuelve error explícito.
// El usuario debe gestionar manualmente esa situación (recalibrar cronograma).
// ══════════════════════════════════════════════════════════════════════════════

export async function pushUnitToObra(
  project_unit_id: string,
): Promise<{ success: true; obra_unit_id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    // 1. Fetch project_unit + verify project has obra started
    const { data: unitRaw, error: uErr } = await admin
      .from('fpe_project_units')
      .select(`
        id, project_id, template_unit_id, notas, orden,
        template_unit:fpe_template_units(id, chapter_id, nombre),
        line_items:fpe_project_line_items(id, template_line_item_id, cantidad, notas)
      `)
      .eq('id', project_unit_id)
      .single()
    if (uErr || !unitRaw) return { error: 'UE no encontrada.' }

    type UnitRow = {
      id: string; project_id: string; template_unit_id: string; notas: string | null; orden: number
      template_unit: { id: string; chapter_id: string; nombre: string } | null
      line_items: { id: string; template_line_item_id: string; cantidad: number; notas: string | null }[]
    }
    const unit = unitRaw as unknown as UnitRow

    const { data: project } = await admin
      .from('fpe_projects')
      .select('id, obra_management_started_at')
      .eq('id', unit.project_id)
      .single()
    if (!project?.obra_management_started_at) {
      return { error: 'La gestión de obra no está activada en este proyecto.' }
    }

    // 2. Idempotency: skip if obra_unit already exists for this UE
    const { data: existing } = await admin
      .from('fpe_obra_units')
      .select('id')
      .eq('source_project_unit_id', project_unit_id)
      .maybeSingle()
    if (existing) return { success: true, obra_unit_id: existing.id }

    // 3. Verify award exists
    const { data: award } = await admin
      .from('fpe_project_unit_awards')
      .select('id, partner_id, bid_id, project_id')
      .eq('project_unit_id', project_unit_id)
      .maybeSingle()
    if (!award) return { error: 'La UE aún no está adjudicada.' }

    // 4. Verify chapter already exists in obra (at least one phase for it)
    const chapterId = unit.template_unit?.chapter_id
    if (!chapterId) return { error: 'La UE no tiene capítulo asociado.' }
    const { data: phasesInChapter } = await admin
      .from('fpe_obra_phases')
      .select('id')
      .eq('project_id', unit.project_id)
      .eq('chapter_id', chapterId)
      .limit(1)
    if (!phasesInChapter || phasesInChapter.length === 0) {
      return { error: 'Este capítulo no existe aún en obra. Recalibrar cronograma manualmente.' }
    }

    // 5. Fetch bid_line_items prices for the awarded bid
    const { data: bliRaw } = await admin
      .from('fpe_bid_line_items')
      .select('project_line_item_id, precio_unitario')
      .eq('bid_id', award.bid_id)
    type BliRow = { project_line_item_id: string; precio_unitario: number }
    const priceByPli: Record<string, number> = {}
    for (const r of (bliRaw ?? []) as BliRow[]) priceByPli[r.project_line_item_id] = r.precio_unitario

    // 6. Find the contract linked to this partner in this project
    const { data: tendersRaw } = await admin
      .from('fpe_tenders').select('id').eq('project_id', unit.project_id)
    const tenderIds = ((tendersRaw ?? []) as { id: string }[]).map(t => t.id)
    let contractId: string | null = null
    if (tenderIds.length > 0) {
      const { data: awardsContract } = await admin
        .from('fpe_awards')
        .select('partner_id, contract:fpe_contracts(id)')
        .in('tender_id', tenderIds)
        .eq('partner_id', award.partner_id)
      type AC = { partner_id: string; contract: { id: string } | null }
      const aw = ((awardsContract ?? []) as unknown as AC[]).find(a => a.partner_id === award.partner_id)
      contractId = aw?.contract?.id ?? null
    }

    // 7. Insert obra_unit
    const { data: insUnit, error: insUnitErr } = await admin
      .from('fpe_obra_units')
      .insert({
        project_id:             unit.project_id,
        source_project_unit_id: unit.id,
        template_unit_id:       unit.template_unit_id,
        notas:                  unit.notas,
        orden:                  unit.orden,
      })
      .select('id')
      .single()
    if (insUnitErr) return { error: `obra_units: ${insUnitErr.message}` }
    const obraUnitId = insUnit.id

    // 8. Insert obra_line_items
    if (unit.line_items.length > 0) {
      const liInserts = unit.line_items.map(li => ({
        obra_unit_id:                obraUnitId,
        source_project_line_item_id: li.id,
        template_line_item_id:       li.template_line_item_id,
        cantidad_inicial:            li.cantidad,
        cantidad:                    li.cantidad,
        precio_unitario_adjudicado:  priceByPli[li.id] ?? null,
        notas:                       li.notas,
      }))
      const { error: insLiErr } = await admin.from('fpe_obra_line_items').insert(liInserts)
      if (insLiErr) return { error: `obra_line_items: ${insLiErr.message}` }
    }

    // 9. Insert obra_unit_partner
    const { error: insUpErr } = await admin
      .from('fpe_obra_unit_partners')
      .insert({
        obra_unit_id:       obraUnitId,
        partner_id:         award.partner_id,
        source_award_id:    award.id,
        source_bid_id:      award.bid_id,
        source_contract_id: contractId,
      })
    if (insUpErr) return { error: `obra_unit_partners: ${insUpErr.message}` }

    // 10. Update partner_ids[] on existing obra_phases of this chapter
    //     to include the new partner.
    const { data: chapterPhasesRaw } = await admin
      .from('fpe_obra_phases')
      .select('id, partner_ids')
      .eq('project_id', unit.project_id)
      .eq('chapter_id', chapterId)
    type CPRow = { id: string; partner_ids: string[] }
    for (const ph of (chapterPhasesRaw ?? []) as CPRow[]) {
      if (ph.partner_ids.includes(award.partner_id)) continue
      const updated = [...ph.partner_ids, award.partner_id]
      const { error } = await admin
        .from('fpe_obra_phases')
        .update({ partner_ids: updated })
        .eq('id', ph.id)
      if (error) return { error: `obra_phases partner_ids: ${error.message}` }
    }

    // 11. Documents linked to this UE
    const { data: docsRaw } = await admin
      .from('fpe_documents')
      .select('id, nombre, storage_path, mime_type, size_bytes, discipline_tags')
      .eq('project_unit_id', project_unit_id)
    type DocRow = { id: string; nombre: string; storage_path: string; mime_type: string | null; size_bytes: number | null; discipline_tags: string[] | null }
    const docs = (docsRaw ?? []) as DocRow[]
    if (docs.length > 0) {
      const docInserts = docs.map(d => ({
        project_id:         unit.project_id,
        obra_unit_id:       obraUnitId,
        source_document_id: d.id,
        nombre:             d.nombre,
        storage_path:       d.storage_path,
        mime_type:          d.mime_type,
        size_bytes:         d.size_bytes,
        discipline_tags:    d.discipline_tags ?? [],
        doc_kind:           'original' as const,
      }))
      const { error: insDocErr } = await admin.from('fpe_obra_documents').insert(docInserts)
      if (insDocErr) return { error: `obra_documents: ${insDocErr.message}` }
    }

    // 12. Copy contract payment schedule if not already in obra
    if (contractId) {
      const { data: alreadyPs } = await admin
        .from('fpe_obra_payment_schedule')
        .select('id')
        .eq('contract_id', contractId)
        .limit(1)
      if (!alreadyPs || alreadyPs.length === 0) {
        const { data: psRaw } = await admin
          .from('fpe_contract_payment_schedule')
          .select('id, contract_id, nombre, pct, monto, milestone_id, status, fecha_estimada, fecha_pago, orden')
          .eq('contract_id', contractId)
          .order('orden', { ascending: true })
        type PsRow = { id: string; contract_id: string; nombre: string; pct: number; monto: number; milestone_id: string | null; status: string; fecha_estimada: string | null; fecha_pago: string | null; orden: number }
        const psRows = (psRaw ?? []) as PsRow[]
        if (psRows.length > 0) {
          // Resolve obra_milestone_id from template_milestone_id
          const tmIds = Array.from(new Set(psRows.map(p => p.milestone_id).filter((x): x is string => !!x)))
          const obraMsByTm: Record<string, string> = {}
          if (tmIds.length > 0) {
            const { data: msRows } = await admin
              .from('fpe_obra_milestones')
              .select('id, template_milestone_id')
              .eq('project_id', unit.project_id)
              .in('template_milestone_id', tmIds)
            for (const r of (msRows ?? []) as { id: string; template_milestone_id: string }[]) {
              obraMsByTm[r.template_milestone_id] = r.id
            }
          }
          const psInserts = psRows.map(ps => ({
            project_id:                 unit.project_id,
            contract_id:                ps.contract_id,
            source_payment_schedule_id: ps.id,
            obra_milestone_id:          ps.milestone_id ? (obraMsByTm[ps.milestone_id] ?? null) : null,
            partner_id:                 award.partner_id,
            nombre:                     ps.nombre,
            pct:                        ps.pct,
            monto:                      ps.monto,
            status:                     ps.status,
            fecha_estimada:             ps.fecha_estimada,
            fecha_pago:                 ps.fecha_pago,
            orden:                      ps.orden,
          }))
          const { error: insPsErr } = await admin.from('fpe_obra_payment_schedule').insert(psInserts)
          if (insPsErr) return { error: `obra_payment_schedule: ${insPsErr.message}` }
        }
      }
    }

    revalidatePath(`${PROJECT_PATH}/${unit.project_id}`)
    return { success: true, obra_unit_id: obraUnitId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateObraPhaseDuration(args: {
  phase_id:              string
  planned_duration_dias?: number | null
  planned_start_date?:    string | null
  planned_end_date?:      string | null
}): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()

    for (const f of ['planned_start_date', 'planned_end_date'] as const) {
      const v = args[f]
      if (v !== undefined && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return { error: `Formato de fecha inválido en ${f}.` }
      }
    }

    const patch: Record<string, unknown> = {}
    if (args.planned_duration_dias !== undefined) patch.planned_duration_dias = args.planned_duration_dias
    // planned_start_date / planned_end_date son output del recompute; los
    // ignoramos como inputs para evitar inconsistencias. La duración es el
    // único input editable; las fechas se derivan del CPM.

    if (Object.keys(patch).length === 0) return { success: true }

    const { data: phaseRow, error } = await admin
      .from('fpe_obra_phases')
      .update(patch)
      .eq('id', args.phase_id)
      .select('project_id')
      .single()
    if (error) return { error: error.message }

    // Recomputar siempre — cualquier cambio de planned_duration_dias cascadea.
    await recomputeObraSchedule(phaseRow.project_id)

    revalidatePath(`${PROJECT_PATH}/${phaseRow.project_id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

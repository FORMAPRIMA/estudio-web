// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Tipos del presupuesto vivo de obra
// ══════════════════════════════════════════════════════════════════════════════

export type ChangeCategoria    = 'a_peticion_cliente' | 'imprevisto' | 'ajuste'
export type ChangeSubCategoria = 'trasladable_cliente' | 'costo_empresa' | null
export type DestinoActa        = 'cliente' | 'interna'

export type ChangeType = 'edit_partida' | 'new_partida' | 'new_unit' | 'delete_partida' | 'delete_unit'

export interface ObraUnitRaw {
  id:                       string
  project_id:               string
  source_project_unit_id:   string | null
  template_unit_id:         string | null
  chapter_id:               string | null
  custom_nombre:            string | null
  custom_descripcion:       string | null
  notas:                    string | null
  orden:                    number
  template_unit: { id: string; nombre: string; chapter_id: string } | null
}

export interface ObraLineItemRaw {
  id:                          string
  obra_unit_id:                string
  source_project_line_item_id: string | null
  template_line_item_id:       string | null
  custom_nombre:               string | null
  custom_unidad_medida:        string | null
  cantidad_inicial:            number
  cantidad:                    number
  precio_unitario_adjudicado:  number | null
  notas:                       string | null
  template_line_item: { id: string; nombre: string; unidad_medida: string } | null
}

export interface ObraChangeLogRow {
  id:             string
  change_type:    ChangeType
  target_kind:    'partida' | 'unit'
  target_id:      string | null
  parent_id:      string | null
  old_value:      Record<string, unknown> | null
  new_value:      Record<string, unknown> | null
  categoria:      ChangeCategoria
  sub_categoria:  ChangeSubCategoria
  destino_acta:   DestinoActa
  razon:          string
  delta_monto:    number
  created_at:     string
  created_by:     string | null
}

export interface ObraChangeSession {
  id:         string
  project_id: string
  status:     'open' | 'closed' | 'cancelled'
  opened_at:  string
  opened_by:  string | null
  notas:      string | null
  log:        ObraChangeLogRow[]
}

export interface ObraActaRow {
  id:                   string
  kind:                 'cliente' | 'interna'
  year:                 number
  numero:               number
  codigo:               string
  total_delta_monto:    number
  status:               'generada' | 'sent_to_sign' | 'signed' | 'received' | 'anulada'
  generated_at:         string
  docusign_envelope_id: string | null
  sent_at:              string | null
  signed_at:            string | null
  pdf_signed_path:      string | null
}

// ── Modelo derivado para la UI (committed + pending overlay) ─────────────────

export interface UIPartida {
  id:                  string
  obra_unit_id:        string
  nombre:              string
  unidad_medida:       string
  cantidad:            number
  precio_unitario:     number
  is_new:              boolean
  is_deleted:          boolean
  pending_log_id?:     string
  original?:           { cantidad: number; precio_unitario: number }
}

export interface UIUnit {
  id:              string
  chapter_id:      string
  nombre:          string
  descripcion:     string | null
  partner_id:      string | null
  partner_nombre:  string | null
  is_new:          boolean
  is_deleted:      boolean
  pending_log_id?: string
  partidas:        UIPartida[]
}

export interface UIChapter {
  id:     string
  nombre: string
  orden:  number
  units:  UIUnit[]
}

// ── Helper: dado raw + pending changes, construir la vista efectiva ──────────

function lineItemNombre(li: ObraLineItemRaw): string {
  if (li.custom_nombre) return li.custom_nombre
  return li.template_line_item?.nombre ?? '—'
}
function lineItemUM(li: ObraLineItemRaw): string {
  if (li.custom_unidad_medida) return li.custom_unidad_medida
  return li.template_line_item?.unidad_medida ?? '—'
}
function unitNombre(u: ObraUnitRaw): string {
  if (u.custom_nombre) return u.custom_nombre
  return u.template_unit?.nombre ?? '—'
}
function unitChapterId(u: ObraUnitRaw): string | null {
  if (u.chapter_id) return u.chapter_id
  return u.template_unit?.chapter_id ?? null
}

export interface BuildPresupuestoArgs {
  units:         ObraUnitRaw[]
  lineItems:     ObraLineItemRaw[]
  unitPartners:  Array<{ obra_unit_id: string; partner_id: string }>
  partnerNames:  Record<string, string>
  chapters:      Array<{ id: string; nombre: string; orden: number }>
  pendingChanges: ObraChangeLogRow[]   // [] si no hay sesión abierta
}

export function buildPresupuestoView(args: BuildPresupuestoArgs): UIChapter[] {
  const { units, lineItems, unitPartners, partnerNames, chapters, pendingChanges } = args

  // ── Index committed data ────────────────────────────────────────────────
  const partnerByUnit: Record<string, string | null> = {}
  for (const up of unitPartners) {
    if (!partnerByUnit[up.obra_unit_id]) partnerByUnit[up.obra_unit_id] = up.partner_id
  }

  const liByUnit: Record<string, UIPartida[]> = {}
  for (const li of lineItems) {
    const arr = liByUnit[li.obra_unit_id] ?? []
    arr.push({
      id:              li.id,
      obra_unit_id:    li.obra_unit_id,
      nombre:          lineItemNombre(li),
      unidad_medida:   lineItemUM(li),
      cantidad:        Number(li.cantidad) || 0,
      precio_unitario: Number(li.precio_unitario_adjudicado) || 0,
      is_new:          false,
      is_deleted:      false,
    })
    liByUnit[li.obra_unit_id] = arr
  }

  const baseUnits: Record<string, UIUnit> = {}
  for (const u of units) {
    const chId = unitChapterId(u)
    if (!chId) continue
    const partnerId = partnerByUnit[u.id] ?? null
    baseUnits[u.id] = {
      id:             u.id,
      chapter_id:     chId,
      nombre:         unitNombre(u),
      descripcion:    u.custom_descripcion ?? null,
      partner_id:     partnerId,
      partner_nombre: partnerId ? (partnerNames[partnerId] ?? null) : null,
      is_new:         false,
      is_deleted:     false,
      partidas:       liByUnit[u.id] ?? [],
    }
  }

  // ── Apply pending changes overlay ───────────────────────────────────────
  for (const log of pendingChanges) {
    if (log.change_type === 'edit_partida' && log.target_id) {
      // Find partida and overlay new values
      for (const u of Object.values(baseUnits)) {
        const idx = u.partidas.findIndex(p => p.id === log.target_id)
        if (idx >= 0) {
          const p = u.partidas[idx]
          const nv = log.new_value as { cantidad: number; precio_unitario: number }
          u.partidas[idx] = {
            ...p,
            pending_log_id:  log.id,
            original:        { cantidad: p.cantidad, precio_unitario: p.precio_unitario },
            cantidad:        nv.cantidad,
            precio_unitario: nv.precio_unitario,
          }
          break
        }
      }
    }
    else if (log.change_type === 'new_partida' && log.parent_id) {
      const u = baseUnits[log.parent_id]
      if (u) {
        const nv = log.new_value as { nombre: string; unidad_medida: string; cantidad: number; precio_unitario: number }
        u.partidas.push({
          id:              `pending:${log.id}`,
          obra_unit_id:    log.parent_id,
          nombre:          nv.nombre,
          unidad_medida:   nv.unidad_medida,
          cantidad:        nv.cantidad,
          precio_unitario: nv.precio_unitario,
          is_new:          true,
          is_deleted:      false,
          pending_log_id:  log.id,
        })
      }
    }
    else if (log.change_type === 'new_unit' && log.parent_id) {
      const nv = log.new_value as { nombre: string; descripcion: string | null; chapter_id: string; partner_id: string }
      baseUnits[`pending:${log.id}`] = {
        id:             `pending:${log.id}`,
        chapter_id:     nv.chapter_id,
        nombre:         nv.nombre,
        descripcion:    nv.descripcion,
        partner_id:     nv.partner_id,
        partner_nombre: partnerNames[nv.partner_id] ?? null,
        is_new:         true,
        is_deleted:     false,
        pending_log_id: log.id,
        partidas:       [],
      }
    }
    else if (log.change_type === 'delete_partida' && log.target_id) {
      for (const u of Object.values(baseUnits)) {
        const idx = u.partidas.findIndex(p => p.id === log.target_id)
        if (idx >= 0) {
          u.partidas[idx] = { ...u.partidas[idx], is_deleted: true, pending_log_id: log.id }
          break
        }
      }
    }
    else if (log.change_type === 'delete_unit' && log.target_id) {
      const u = baseUnits[log.target_id]
      if (u) {
        u.is_deleted = true
        u.pending_log_id = log.id
      }
    }
  }

  // ── Group by chapter ────────────────────────────────────────────────────
  const chapterById: Record<string, UIChapter> = {}
  for (const c of chapters) {
    chapterById[c.id] = { id: c.id, nombre: c.nombre, orden: c.orden, units: [] }
  }
  for (const u of Object.values(baseUnits)) {
    const ch = chapterById[u.chapter_id]
    if (ch) ch.units.push(u)
  }

  return Object.values(chapterById)
    .filter(ch => ch.units.length > 0)
    .sort((a, b) => a.orden - b.orden)
}

export function presupuestoTotals(view: UIChapter[]) {
  let grand = 0
  const perChapter: Record<string, number> = {}
  for (const ch of view) {
    let chTotal = 0
    for (const u of ch.units) {
      if (u.is_deleted) continue
      for (const p of u.partidas) {
        if (p.is_deleted) continue
        chTotal += p.cantidad * p.precio_unitario
      }
    }
    perChapter[ch.id] = chTotal
    grand += chTotal
  }
  return { perChapter, grand }
}

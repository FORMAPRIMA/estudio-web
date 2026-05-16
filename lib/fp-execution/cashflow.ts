// ── Cash Flow Calculator ──────────────────────────────────────────────────────
// Toma los packs de partners adjudicados (con sus hitos de pago) + el Gantt
// awarded (con fechas de hitos de obra) y materializa cuándo se cobra cada
// hito de pago de cada partner, agregándolo por semana.

import type { AwardedScheduleResult } from './schedule'
import { addBusinessDays } from './businessDays'

// ── Constants ────────────────────────────────────────────────────────────────
// Días hábiles de anticipación para los triggers anclados a un evento. Hardcoded
// a propósito: el equipo quiere comportamiento estándar y predecible, no
// configurable por hito.
//  · 'pre_start'         → 10 días hábiles antes del INICIO del partner en obra.
//  · 'pre_project_start' → 10 días hábiles antes del INICIO de la obra completa
//                          (para materiales con lead time desde día cero).
const PRE_START_LEAD_BUSINESS_DAYS         = 10
const PRE_PROJECT_START_LEAD_BUSINESS_DAYS = 10

export interface CashFlowInputPartner {
  partner_id:        string
  partner_nombre:    string
  total:             number
  payment_milestones: {
    nombre:       string
    pct:          number
    monto:        number
    trigger_type: string                       // 'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start'
    milestone_id: string | null
  }[]
}

export interface PaymentEvent {
  partner_id:       string
  partner_nombre:   string
  milestone_nombre: string
  trigger_type:     string
  date:             Date | null                // null si no se pudo determinar fecha
  monto:            number
  fallback_reason?: 'milestone_unreached' | 'partner_not_scheduled'  // origen del fallback de fecha
}

export interface CashFlowWeekEntry {
  weekStart:  Date                             // lunes de la semana ISO
  weekLabel:  string                           // 'S23 · 1 jun'
  byPartner:  Record<string, number>           // partner_id → monto
  total:      number
  cumulative: number
}

export interface CashFlowResult {
  events:     PaymentEvent[]                   // ordenados por fecha (incluye fallback)
  weeks:      CashFlowWeekEntry[]              // semanas desde la primera fecha hasta la última
  undated:    PaymentEvent[]                   // eventos sin fecha (no se pudieron ubicar)
  fallbacks:  PaymentEvent[]                   // eventos plotados con fecha estimada por fallback
  grandTotal: number
}

// ── Helpers de semana ────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0=domingo, 1=lunes...
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function weekKey(d: Date): string {
  return startOfWeek(d).toISOString().slice(0, 10)
}

function isoWeekNumber(d: Date): number {
  // ISO-8601 week number
  const target = new Date(d.valueOf())
  const dayNr  = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

function fmtWeekLabel(monday: Date): string {
  const w = isoWeekNumber(monday)
  const dm = monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `S${w} · ${dm}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function computeCashFlow(
  partners: CashFlowInputPartner[],
  schedule: AwardedScheduleResult,
  projectStartDate: Date,
  contractDateByPartner: Record<string, Date | null> = {},
): CashFlowResult {
  const events:    PaymentEvent[] = []
  const undated:   PaymentEvent[] = []
  const fallbacks: PaymentEvent[] = []

  // Fecha de "delivery" = última fecha del Gantt
  let projectEnd: Date | null = null
  for (const entry of Object.values(schedule.phases)) {
    if (!projectEnd || entry.endDate > projectEnd) projectEnd = entry.endDate
  }

  // Primer y último día de obra de cada partner = min/max(startDate/endDate)
  // entre fases donde participa. Sirven para:
  //  · partnerLastEnd → fallback cuando un milestone_achieved no se alcanza.
  //  · partnerFirstStart → calcular el anticipo 'pre_start' (10 días hábiles antes).
  const partnerLastEnd:    Record<string, Date> = {}
  const partnerFirstStart: Record<string, Date> = {}
  for (const [phaseId, entry] of Object.entries(schedule.phases)) {
    const partnersInPhase = schedule.phasePartners[phaseId] ?? []
    for (const pid of partnersInPhase) {
      const curEnd = partnerLastEnd[pid]
      if (!curEnd || entry.endDate > curEnd) partnerLastEnd[pid] = entry.endDate
      const curStart = partnerFirstStart[pid]
      if (!curStart || entry.startDate < curStart) partnerFirstStart[pid] = entry.startDate
    }
  }

  for (const p of partners) {
    for (const m of p.payment_milestones) {
      let date: Date | null = null
      let fallback: 'milestone_unreached' | 'partner_not_scheduled' | undefined
      switch (m.trigger_type) {
        case 'contract_signed':
          date = contractDateByPartner[p.partner_id] ?? projectStartDate
          break
        case 'milestone_achieved':
          if (m.milestone_id) {
            date = schedule.milestoneDates[m.milestone_id] ?? null
          }
          // Fallback: hito de obra sin fecha (capítulo no en scope, fase sin
          // achiever, etc.). Plotamos al cierre de la obra del partner para
          // no perder el pago. El último día de proyecto es el último recurso.
          if (!date) {
            date = partnerLastEnd[p.partner_id] ?? projectEnd
            if (date) fallback = 'milestone_unreached'
          }
          break
        case 'pre_start': {
          // 10 días hábiles antes del primer día del partner en obra. Si el
          // partner no tiene fases programadas (capítulo no en scope, etc.),
          // cae a la fecha de firma del contrato.
          const start = partnerFirstStart[p.partner_id]
          if (start) {
            date = addBusinessDays(start, -PRE_START_LEAD_BUSINESS_DAYS)
          } else {
            date = contractDateByPartner[p.partner_id] ?? projectStartDate
            if (date) fallback = 'partner_not_scheduled'
          }
          break
        }
        case 'pre_project_start':
          // 10 días hábiles antes del inicio del proyecto (no del partner).
          // Para materiales con lead time desde día cero.
          date = addBusinessDays(projectStartDate, -PRE_PROJECT_START_LEAD_BUSINESS_DAYS)
          break
        case 'delivery':
          date = projectEnd
          break
        default:
          date = null
      }
      const ev: PaymentEvent = {
        partner_id:       p.partner_id,
        partner_nombre:   p.partner_nombre,
        milestone_nombre: m.nombre,
        trigger_type:     m.trigger_type,
        date,
        monto:            m.monto,
        ...(fallback ? { fallback_reason: fallback } : {}),
      }
      if (date) {
        events.push(ev)
        if (fallback) fallbacks.push(ev)
      } else {
        undated.push(ev)
      }
    }
  }

  events.sort((a, b) => (a.date!.getTime() - b.date!.getTime()))

  const grandTotal = events.reduce((a, e) => a + e.monto, 0) + undated.reduce((a, e) => a + e.monto, 0)

  // Agregar por semana
  const weekMap: Map<string, CashFlowWeekEntry> = new Map()
  for (const ev of events) {
    const key = weekKey(ev.date!)
    const monday = startOfWeek(ev.date!)
    let w = weekMap.get(key)
    if (!w) {
      w = { weekStart: monday, weekLabel: fmtWeekLabel(monday), byPartner: {}, total: 0, cumulative: 0 }
      weekMap.set(key, w)
    }
    w.byPartner[ev.partner_id] = (w.byPartner[ev.partner_id] ?? 0) + ev.monto
    w.total += ev.monto
  }

  // Rellenar gaps entre primera y última semana (para Gantt visual coherente)
  let weeks: CashFlowWeekEntry[] = Array.from(weekMap.values())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())

  if (weeks.length > 1) {
    const firstMonday = weeks[0].weekStart
    const lastMonday  = weeks[weeks.length - 1].weekStart
    const filled: CashFlowWeekEntry[] = []
    let cursor = new Date(firstMonday)
    while (cursor <= lastMonday) {
      const key = cursor.toISOString().slice(0, 10)
      const existing = weekMap.get(key)
      if (existing) filled.push(existing)
      else filled.push({ weekStart: new Date(cursor), weekLabel: fmtWeekLabel(cursor), byPartner: {}, total: 0, cumulative: 0 })
      cursor = addDays(cursor, 7)
    }
    weeks = filled
  }

  // Acumulado
  let cum = 0
  for (const w of weeks) {
    cum += w.total
    w.cumulative = cum
  }

  return { events, weeks, undated, fallbacks, grandTotal }
}

// Lógica de composición del plan de pago materializado por invitación.
// Toma como input los hitos de pago "de mercado" definidos por disciplina
// (fpe_discipline_payment_milestones) y produce un plan unificado para una
// invitación cuyo scope puede cruzar varias disciplinas.

import type { FpeDisciplinePaymentMilestone, PaymentPlanSeedStrategy } from './domain'

export interface PaymentPlanSeedItem {
  nombre: string
  pct: number
  trigger_type: 'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start'
  milestone_id: string | null
  source_discipline_id: string | null
  orden: number
}

export interface DisciplineWeight {
  discipline_id: string
  weight: number  // nº UEs del partner en esa disciplina
  milestones: FpeDisciplinePaymentMilestone[]
}

// "Dominante": copia el plan de la disciplina con mayor peso.
// Si hay empate, se queda con la primera por id (estable).
function seedDominant(disciplines: DisciplineWeight[]): PaymentPlanSeedItem[] {
  if (disciplines.length === 0) return []
  const sorted = [...disciplines].sort((a, b) => b.weight - a.weight || a.discipline_id.localeCompare(b.discipline_id))
  const winner = sorted[0]
  return winner.milestones
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((m, i) => ({
      nombre: m.nombre,
      pct: Number(m.pct),
      trigger_type: m.trigger_type,
      milestone_id: m.milestone_id,
      source_discipline_id: winner.discipline_id,
      orden: i,
    }))
}

// "Mezcla ponderada": agrupa hitos por clave (trigger + milestone_id + nombre)
// y promedia el pct ponderado por peso de cada disciplina. Hitos que no aparecen
// en todas las disciplinas se incluyen con pct proporcional al peso de las
// disciplinas que sí los tienen.
function seedBlended(disciplines: DisciplineWeight[]): PaymentPlanSeedItem[] {
  if (disciplines.length === 0) return []
  const totalWeight = disciplines.reduce((s, d) => s + d.weight, 0) || 1

  type Bucket = { key: string; nombre: string; trigger_type: 'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start'; milestone_id: string | null; pctSum: number; sources: Set<string>; minOrden: number }
  const buckets = new Map<string, Bucket>()

  for (const d of disciplines) {
    const w = d.weight / totalWeight
    for (const m of d.milestones) {
      const key = `${m.trigger_type}|${m.milestone_id ?? ''}|${m.nombre.toLowerCase().trim()}`
      const existing = buckets.get(key)
      if (existing) {
        existing.pctSum += Number(m.pct) * w
        existing.sources.add(d.discipline_id)
        existing.minOrden = Math.min(existing.minOrden, m.orden)
      } else {
        buckets.set(key, {
          key,
          nombre: m.nombre,
          trigger_type: m.trigger_type,
          milestone_id: m.milestone_id,
          pctSum: Number(m.pct) * w,
          sources: new Set([d.discipline_id]),
          minOrden: m.orden,
        })
      }
    }
  }

  const items = Array.from(buckets.values())
    .sort((a, b) => a.minOrden - b.minOrden || a.nombre.localeCompare(b.nombre))
    .map((b, i): PaymentPlanSeedItem => ({
      nombre: b.nombre,
      pct: Math.round(b.pctSum * 100) / 100,
      trigger_type: b.trigger_type,
      milestone_id: b.milestone_id,
      source_discipline_id: b.sources.size === 1 ? Array.from(b.sources)[0] : null,
      orden: i,
    }))

  return normalizeTo100(items)
}

// "Concatenado": lista los hitos de cada disciplina escalados por su peso.
// El resultado puede tener muchos hitos (uno por hito por disciplina).
function seedConcatenated(disciplines: DisciplineWeight[]): PaymentPlanSeedItem[] {
  if (disciplines.length === 0) return []
  const totalWeight = disciplines.reduce((s, d) => s + d.weight, 0) || 1
  const items: PaymentPlanSeedItem[] = []
  let orden = 0
  const sortedDisc = [...disciplines].sort((a, b) => b.weight - a.weight)
  for (const d of sortedDisc) {
    const scale = d.weight / totalWeight
    const dMilestones = d.milestones.slice().sort((a, b) => a.orden - b.orden)
    for (const m of dMilestones) {
      items.push({
        nombre: m.nombre,
        pct: Math.round(Number(m.pct) * scale * 100) / 100,
        trigger_type: m.trigger_type,
        milestone_id: m.milestone_id,
        source_discipline_id: d.discipline_id,
        orden: orden++,
      })
    }
  }
  return normalizeTo100(items)
}

// Si por redondeos la suma no es 100, ajusta el último hito para cerrar.
function normalizeTo100(items: PaymentPlanSeedItem[]): PaymentPlanSeedItem[] {
  if (items.length === 0) return items
  const sum = items.reduce((s, it) => s + it.pct, 0)
  const diff = Math.round((100 - sum) * 100) / 100
  if (Math.abs(diff) < 0.01) return items
  const last = items[items.length - 1]
  last.pct = Math.round((last.pct + diff) * 100) / 100
  return items
}

export function buildPaymentPlanSeed(
  strategy: PaymentPlanSeedStrategy,
  disciplines: DisciplineWeight[],
): PaymentPlanSeedItem[] {
  switch (strategy) {
    case 'dominant':     return seedDominant(disciplines)
    case 'blended':      return seedBlended(disciplines)
    case 'concatenated': return seedConcatenated(disciplines)
  }
}

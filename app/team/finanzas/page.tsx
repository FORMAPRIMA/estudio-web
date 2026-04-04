import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FinanzasDashboard from '@/components/team/finanzas/FinanzasDashboard'
import { SECCION_ORDER } from '@/lib/finanzas/costs'

export const metadata = { title: 'Dashboard · Finanzas' }
export const dynamic = 'force-dynamic'

const IVA_RATE = 0.21

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()
  const year  = new Date().getFullYear()

  const [
    { data: facturas },
    { data: members },
    { data: costosFijos },
    { data: costosVariables },
    { data: configRows },
    { data: allTimeEntries },
    { data: allProjFases },
    { data: allFacturasKPI },
  ] = await Promise.all([
    // Billing chart — current year ± 1
    admin
      .from('facturas')
      .select('monto, fecha_pago_acordada, status')
      .not('fecha_pago_acordada', 'is', null)
      .gte('fecha_pago_acordada', `${year - 1}-01-01`)
      .lte('fecha_pago_acordada', `${year + 1}-12-31`)
      .order('fecha_pago_acordada'),
    // Cost data
    admin
      .from('profiles')
      .select('salario_mensual, horas_mensuales, blocked')
      .in('rol', ['fp_team', 'fp_manager', 'fp_partner']),
    admin
      .from('costos_fijos')
      .select('monto'),
    admin
      .from('costos_variables')
      .select('mes, monto')
      .eq('año', year),
    admin
      .from('finanzas_config')
      .select('key, value')
      .eq('key', 'minoracion_no_facturable'),
    // KPI: time entries (all-time, for margin analysis)
    admin
      .from('time_entries')
      .select('user_id, proyecto_id, fase_id, horas')
      .not('proyecto_id', 'is', null),
    // KPI: fase → seccion lookup
    admin
      .from('proyecto_fases')
      .select('id, proyecto_id, catalogo_fases(seccion)'),
    // KPI: billing by project + section (all-time, all statuses)
    admin
      .from('facturas')
      .select('proyecto_id, seccion, monto'),
  ])

  // ── Monthly costs (for billing vs cost chart) ────────────────────────────────

  const minoracion       = configRows?.[0]?.value ?? 0
  const teamCostMonthly  = (members ?? [])
    .filter(m => !m.blocked)
    .reduce((s, m) => s + (m.salario_mensual ?? 0), 0)
  const fixedCostMonthly = (costosFijos ?? [])
    .reduce((s, c) => s + c.monto * (1 + IVA_RATE), 0)

  const varByMonth: Record<number, number> = {}
  for (const v of costosVariables ?? []) {
    const idx = v.mes - 1
    varByMonth[idx] = (varByMonth[idx] ?? 0) + v.monto
  }

  const monthlyCosts: Record<number, number> = {}
  for (let m = 0; m < 12; m++) {
    monthlyCosts[m] = teamCostMonthly + fixedCostMonthly + (varByMonth[m] ?? 0)
  }

  // ── KPI: margin analysis ─────────────────────────────────────────────────────

  // Average cost per hour (simplified: current rates, not historical)
  const totalHrs        = (members ?? []).filter(m => !m.blocked).reduce((s, m) => s + (m.horas_mensuales ?? 0), 0)
  const hrsEfectivas    = totalHrs * (1 - minoracion / 100)
  const repercusion     = hrsEfectivas > 0 ? fixedCostMonthly / hrsEfectivas : 0
  const avgWagePerHour  = totalHrs > 0 ? teamCostMonthly / totalHrs : 0
  const avgCostPerHour  = avgWagePerHour + repercusion

  // fase_id → { proyecto_id, seccion }
  type PFRow = { id: string; proyecto_id: string; catalogo_fases: { seccion: string } | null }
  const faseLookup = new Map<string, { proyecto_id: string; seccion: string }>()
  for (const pf of (allProjFases ?? []) as unknown as PFRow[]) {
    if (pf.catalogo_fases?.seccion) {
      faseLookup.set(pf.id, { proyecto_id: pf.proyecto_id, seccion: pf.catalogo_fases.seccion })
    }
  }

  // Aggregate cost per project + per section
  const costByProject  = new Map<string, number>()
  const costBySection  = new Map<string, number>()

  for (const e of allTimeEntries ?? []) {
    if (!e.proyecto_id) continue
    const cost = (e.horas ?? 0) * avgCostPerHour

    costByProject.set(e.proyecto_id, (costByProject.get(e.proyecto_id) ?? 0) + cost)

    if (e.fase_id) {
      const info = faseLookup.get(e.fase_id)
      if (info?.seccion) {
        costBySection.set(info.seccion, (costBySection.get(info.seccion) ?? 0) + cost)
      }
    }
  }

  // Aggregate billing per project + per section (all-time)
  const billingByProject = new Map<string, number>()
  const billingBySection = new Map<string, number>()

  for (const f of allFacturasKPI ?? []) {
    billingByProject.set(f.proyecto_id, (billingByProject.get(f.proyecto_id) ?? 0) + f.monto)
    billingBySection.set(f.seccion, (billingBySection.get(f.seccion) ?? 0) + f.monto)
  }

  // Per-project margins (only projects with both billing > 0 and cost > 0)
  const projectMargins: number[] = []
  for (const [proyId, billing] of Array.from(billingByProject)) {
    const cost = costByProject.get(proyId) ?? 0
    if (billing > 0 && cost > 0) {
      projectMargins.push((billing - cost) / billing * 100)
    }
  }

  const avgProjectMargin = projectMargins.length > 0
    ? projectMargins.reduce((s, m) => s + m, 0) / projectMargins.length
    : null

  // Per-section margins
  const sectionMargins = SECCION_ORDER.map(sec => {
    const billing = billingBySection.get(sec) ?? 0
    const cost    = costBySection.get(sec)    ?? 0
    return {
      seccion:      sec,
      billingTotal: billing,
      costTotal:    cost,
      margin:       billing > 0 && cost > 0 ? (billing - cost) / billing * 100 : null,
    }
  })

  return (
    <FinanzasDashboard
      facturas={(facturas ?? []).map(f => ({
        monto:               f.monto,
        fecha_pago_acordada: f.fecha_pago_acordada ?? null,
        status:              f.status,
      }))}
      year={year}
      monthlyCosts={monthlyCosts}
      kpis={{
        avgProjectMargin,
        projectCount: projectMargins.length,
        sectionMargins,
      }}
    />
  )
}

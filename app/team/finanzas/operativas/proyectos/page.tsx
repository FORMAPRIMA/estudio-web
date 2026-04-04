import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProyectosAnalisisPage from '@/components/team/finanzas/ProyectosAnalisisPage'
import { historicalCostPerHour } from '@/lib/finanzas/salaryHistory'
import type { SalaryRecord } from '@/lib/finanzas/salaryHistory'
import { repercusionAt } from '@/lib/finanzas/fixedCostHistory'
import type { FixedCostRecord } from '@/lib/finanzas/fixedCostHistory'
import { calcRepercusion } from '@/lib/finanzas/costs'

export const metadata = { title: 'Análisis de proyectos · Finanzas operativas' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()

  const [
    { data: proyectos },
    { data: members },
    { data: timeEntries },
    { data: costosFijos },
    { data: fixedCostHistory },
    { data: configRows },
    { data: facturas },
    { data: salaryHistory },
  ] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, imagen_url, status, clientes!cliente_id(id, nombre)')
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id, salario_mensual, horas_mensuales')
      .in('rol', ['fp_team', 'fp_manager', 'fp_partner']),
    admin
      .from('time_entries')
      .select('user_id, proyecto_id, horas, fecha')
      .not('proyecto_id', 'is', null),
    admin
      .from('costos_fijos')
      .select('monto'),
    admin
      .from('costos_fijos_historia')
      .select('concepto, monto, valid_from, valid_to'),
    admin
      .from('finanzas_config')
      .select('key, value')
      .eq('key', 'minoracion_no_facturable'),
    admin
      .from('facturas')
      .select('proyecto_id, monto, status'),
    admin
      .from('salarios_historia')
      .select('user_id, salario_mensual, horas_mensuales, valid_from, valid_to'),
  ])

  // Current repercusión (used as fallback for entries without full history coverage)
  const minoracion  = configRows?.[0]?.value ?? 0
  const repercusion = calcRepercusion(costosFijos ?? [], members ?? [], minoracion)

  // Current cost/hour per member (used as fallback when no salary history covers the date)
  const memberCostMap = new Map<string, number>()
  for (const m of (members ?? [])) {
    const base = m.salario_mensual && m.horas_mensuales
      ? m.salario_mensual / m.horas_mensuales
      : 0
    memberCostMap.set(m.id, base + repercusion)
  }

  const salHist      = (salaryHistory     ?? []) as SalaryRecord[]
  const fixedHistory = (fixedCostHistory  ?? []) as FixedCostRecord[]

  // Cache repercusion per date — many entries share the same fecha
  const repercusionCache = new Map<string, number>()

  // Aggregate hours + cost per project using fully historical rates
  const aggr = new Map<string, { horas: number; costo: number }>()
  for (const e of (timeEntries ?? [])) {
    if (!e.proyecto_id || !e.fecha) continue

    let rep = repercusionCache.get(e.fecha)
    if (rep === undefined) {
      rep = repercusionAt(fixedHistory, salHist, e.fecha, minoracion, repercusion)
      repercusionCache.set(e.fecha, rep)
    }

    const prev     = aggr.get(e.proyecto_id) ?? { horas: 0, costo: 0 }
    const fallback = memberCostMap.get(e.user_id) ?? repercusion
    const chTotal  = historicalCostPerHour(salHist, e.user_id, e.fecha, fallback, rep)
    aggr.set(e.proyecto_id, {
      horas: prev.horas + e.horas,
      costo: prev.costo + e.horas * chTotal,
    })
  }

  // Aggregate billing per project
  const billing = new Map<string, { acordado: number; cobrado: number }>()
  for (const f of (facturas ?? [])) {
    const prev = billing.get(f.proyecto_id) ?? { acordado: 0, cobrado: 0 }
    billing.set(f.proyecto_id, {
      acordado: prev.acordado + f.monto,
      cobrado:  prev.cobrado  + (f.status === 'pagada' ? f.monto : 0),
    })
  }

  const cards = (proyectos ?? []).map(p => {
    const s       = aggr.get(p.id) ?? { horas: 0, costo: 0 }
    const b       = billing.get(p.id) ?? { acordado: 0, cobrado: 0 }
    const cliente = p.clientes as { nombre: string } | null
    return {
      id:            p.id,
      nombre:        p.nombre,
      codigo:        p.codigo     ?? null,
      imagen_url:    p.imagen_url ?? null,
      status:        p.status     as string,
      cliente:       cliente?.nombre ?? null,
      totalHoras:    s.horas,
      totalCosto:    s.costo,
      totalAcordado: b.acordado,
      totalCobrado:  b.cobrado,
    }
  })

  return <ProyectosAnalisisPage cards={cards} />
}

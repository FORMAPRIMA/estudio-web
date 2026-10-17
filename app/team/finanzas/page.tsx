import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FinanzasDashboard from '@/components/team/finanzas/FinanzasDashboard'
import { SECCION_ORDER, SECCION_MOBILIARIO } from '@/lib/finanzas/costs'
import { salaryAt } from '@/lib/finanzas/salaryHistory'
import type { SalaryRecord } from '@/lib/finanzas/salaryHistory'
import { totalFixedCostsAt } from '@/lib/finanzas/fixedCostHistory'
import type { FixedCostRecord } from '@/lib/finanzas/fixedCostHistory'
import {
  crearCosteHora, ingresosProyecto, comprasMobiliarioPorProyecto, esSuplido,
} from '@/lib/finanzas/rentabilidad'
import type { FacturaIngreso } from '@/lib/finanzas/rentabilidad'
import { selectTodo } from '@/lib/supabase/select-todo'

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
    allTimeEntries,
    { data: allProjFases },
    { data: allFacturasKPI },
    { data: facturasDetalle },
    { data: proyectosInfo },
    { data: salaryHistory },
    { data: fixedCostHistory },
    { data: costosVariablesProyecto },
    { data: bizDev },
    { data: emitidasIva },
  ] = await Promise.all([
    // Billing chart — current year ± 1, por fecha acordada o de cobro (una
    // factura cobrada se pinta en el mes en que entró el dinero)
    admin
      .from('facturas')
      .select('monto, moneda, seccion, proveedor_id, margen_estimado_pct, fecha_pago_acordada, fecha_cobro, status, factura_emitida_id')
      .or(`and(fecha_pago_acordada.gte.${year - 1}-01-01,fecha_pago_acordada.lte.${year + 1}-12-31),and(fecha_cobro.gte.${year - 1}-01-01,fecha_cobro.lte.${year + 1}-12-31)`)
      .order('fecha_pago_acordada'),
    // Cost data
    admin
      .from('profiles')
      .select('id, salario_mensual, horas_mensuales, blocked')
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
    // Paginado: son miles de filas y PostgREST corta en 1000 sin avisar.
    selectTodo<{ user_id: string; proyecto_id: string; fase_id: string | null; horas: number; fecha: string }>((desde, hasta) => admin
      .from('time_entries')
      .select('user_id, proyecto_id, fase_id, horas, fecha')
      .not('proyecto_id', 'is', null)
      .order('id')
      .range(desde, hasta)),
    // KPI: fase → seccion lookup
    admin
      .from('proyecto_fases')
      .select('id, proyecto_id, catalogo_fases(seccion)'),
    // KPI: billing by project + section (all-time, all statuses)
    admin
      .from('facturas')
      .select('proyecto_id, seccion, monto, status, proveedor_id, margen_estimado_pct'),
    // Breakdown: facturas of current year + facturas with no date
    admin
      .from('facturas')
      .select('id, proyecto_id, seccion, concepto, numero_factura, factura_emitida_id, monto, fecha_pago_acordada, fecha_emision, fecha_cobro, status')
      .or(`and(fecha_pago_acordada.gte.${year}-01-01,fecha_pago_acordada.lte.${year}-12-31),and(fecha_cobro.gte.${year}-01-01,fecha_cobro.lte.${year}-12-31),fecha_pago_acordada.is.null`),
    // Project lookup for breakdown rows
    admin
      .from('proyectos')
      .select('id, nombre, codigo, mobiliario_liquidado'),
    admin
      .from('salarios_historia')
      .select('user_id, salario_mensual, horas_mensuales, valid_from, valid_to'),
    admin
      .from('costos_fijos_historia')
      .select('concepto, monto, valid_from, valid_to'),
    admin
      .from('costos_variables')
      .select('proyecto_id, categoria, monto')
      .not('proyecto_id', 'is', null),
    admin
      .from('profiles')
      .select('id')
      .eq('rol', 'fp_biz_dev'),
    // IVA real de las facturas ya emitidas (base y cuota siempre en euros)
    admin
      .from('facturas_emitidas')
      .select('id, base_imponible, cuota_iva'),
  ])

  // ── Monthly costs (for billing vs cost chart) ────────────────────────────────
  // Nóminas y costes fijos vigentes a mitad de cada mes según los históricos; si
  // el histórico no cubre el mes, los valores actuales.

  const minoracion   = configRows?.[0]?.value ?? 0
  const salHist      = (salaryHistory    ?? []) as SalaryRecord[]
  const fixedHistory = (fixedCostHistory ?? []) as FixedCostRecord[]
  const activos      = (members ?? []).filter(m => !m.blocked)
  const fixedActual  = (costosFijos ?? []).reduce((s, c) => s + c.monto * (1 + IVA_RATE), 0)
  const histUserIds  = Array.from(new Set(salHist.map(r => r.user_id)))

  const varByMonth: Record<number, number> = {}
  for (const v of costosVariables ?? []) {
    const idx = v.mes - 1
    varByMonth[idx] = (varByMonth[idx] ?? 0) + v.monto
  }

  const monthlyCosts: Record<number, number> = {}
  for (let m = 0; m < 12; m++) {
    const fecha = `${year}-${String(m + 1).padStart(2, '0')}-15`
    const sinHistoria = activos.filter(p => !histUserIds.includes(p.id))
    const nominas =
      histUserIds.reduce((s, uid) => s + (salaryAt(salHist, uid, fecha)?.salario_mensual ?? 0), 0) +
      sinHistoria.reduce((s, p) => s + (p.salario_mensual ?? 0), 0)
    const fijosHist = totalFixedCostsAt(fixedHistory, fecha) * (1 + IVA_RATE)
    monthlyCosts[m] = nominas + (fijosHist > 0 ? fijosHist : fixedActual) + (varByMonth[m] ?? 0)
  }

  // ── KPI: margin analysis ─────────────────────────────────────────────────────
  // Mismas cuentas que la ficha P&L de cada proyecto (lib/finanzas/rentabilidad).

  const { costeHora } = crearCosteHora({
    members:     members ?? [],
    costosFijos: costosFijos ?? [],
    minoracion,
    salHist,
    fixedHistory,
    excluirDelReparto: (bizDev ?? []).map(p => p.id),
  })

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

  for (const e of allTimeEntries) {
    if (!e.proyecto_id) continue
    const cost = (e.horas ?? 0) * costeHora(e.user_id, e.fecha)

    costByProject.set(e.proyecto_id, (costByProject.get(e.proyecto_id) ?? 0) + cost)

    if (e.fase_id) {
      const info = faseLookup.get(e.fase_id)
      if (info?.seccion) {
        costBySection.set(info.seccion, (costBySection.get(info.seccion) ?? 0) + cost)
      }
    }
  }

  // Billing per project + per section (all-time) — mobiliario a margen neto
  const facturasPorProyecto = new Map<string, FacturaIngreso[]>()
  const billingBySection    = new Map<string, number>()
  for (const f of allFacturasKPI ?? []) {
    const arr = facturasPorProyecto.get(f.proyecto_id) ?? []
    arr.push(f)
    facturasPorProyecto.set(f.proyecto_id, arr)
    if (f.seccion !== SECCION_MOBILIARIO) {
      billingBySection.set(f.seccion, (billingBySection.get(f.seccion) ?? 0) + f.monto)
    }
  }

  const comprasMob   = comprasMobiliarioPorProyecto(costosVariablesProyecto ?? [])
  const liquidadoMap = new Map((proyectosInfo ?? []).map(p => [p.id, Boolean(p.mobiliario_liquidado)]))
  const billingByProject = new Map<string, number>()
  for (const [proyId, fs] of Array.from(facturasPorProyecto)) {
    const ing = ingresosProyecto(fs, {
      comprasMobiliario:   comprasMob.get(proyId) ?? 0,
      mobiliarioLiquidado: liquidadoMap.get(proyId) ?? false,
    })
    billingByProject.set(proyId, ing.acordado)
    if (fs.some(f => f.seccion === SECCION_MOBILIARIO)) {
      billingBySection.set(SECCION_MOBILIARIO, (billingBySection.get(SECCION_MOBILIARIO) ?? 0) + ing.mobEfectivo)
    }
  }

  // Margen ponderado por facturación sobre todos los proyectos con horas o
  // facturas: un proyecto pequeño no pesa lo mismo que uno grande, y uno con
  // coste pero aún sin facturar también cuenta.
  const proyectosConDatos = new Set([...Array.from(billingByProject.keys()), ...Array.from(costByProject.keys())])
  let sumBilling = 0
  let sumCost    = 0
  for (const proyId of Array.from(proyectosConDatos)) {
    sumBilling += billingByProject.get(proyId) ?? 0
    sumCost    += costByProject.get(proyId)    ?? 0
  }
  const avgProjectMargin = sumBilling > 0 ? (sumBilling - sumCost) / sumBilling * 100 : null

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

  // % de IVA por factura: el de la emitida si existe; si no, 21 % (0 % en USD, clientes de EE. UU.)
  const ivaEmitida = new Map((emitidasIva ?? []).map(e => [
    e.id as string,
    Number(e.base_imponible) > 0 ? Number(e.cuota_iva ?? 0) / Number(e.base_imponible) : null,
  ]))
  const ivaPct = (f: { moneda?: string | null; factura_emitida_id?: string | null }) =>
    (f.factura_emitida_id ? ivaEmitida.get(f.factura_emitida_id) : null)
      ?? (f.moneda && f.moneda !== 'EUR' ? 0 : IVA_RATE)

  return (
    <FinanzasDashboard
      facturas={(facturas ?? []).map(f => ({
        monto:               f.monto,
        suplido:             esSuplido(f),
        iva_pct:             ivaPct(f),
        fecha_pago_acordada: f.fecha_pago_acordada ?? null,
        fecha_cobro:         f.fecha_cobro ?? null,
        status:              f.status,
      }))}
      year={year}
      monthlyCosts={monthlyCosts}
      kpis={{
        avgProjectMargin,
        projectCount: proyectosConDatos.size,
        sectionMargins,
      }}
      facturasDetalle={(facturasDetalle ?? []).map(f => ({
        id:                  f.id,
        proyecto_id:         f.proyecto_id,
        seccion:             f.seccion,
        concepto:            f.concepto ?? null,
        numero_factura:      f.numero_factura ?? null,
        factura_emitida_id:  f.factura_emitida_id ?? null,
        monto:               f.monto,
        fecha_pago_acordada: f.fecha_pago_acordada ?? null,
        fecha_emision:       f.fecha_emision ?? null,
        fecha_cobro:         f.fecha_cobro ?? null,
        status:              f.status,
      }))}
      proyectos={(proyectosInfo ?? []).map(p => ({
        id:     p.id,
        nombre: p.nombre,
        codigo: p.codigo ?? null,
      }))}
    />
  )
}

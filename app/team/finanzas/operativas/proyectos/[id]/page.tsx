import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProyectoFinanzasDetalle, { type CostoVariableRow } from '@/components/team/finanzas/ProyectoFinanzasDetalle'
import type { SalaryRecord } from '@/lib/finanzas/salaryHistory'
import type { FixedCostRecord } from '@/lib/finanzas/fixedCostHistory'
import { SECCION_ORDER, SECCION_MOBILIARIO } from '@/lib/finanzas/costs'
import { crearCosteHora, ingresosProyecto, comprasMobiliarioPorProyecto } from '@/lib/finanzas/rentabilidad'
import { selectTodo } from '@/lib/supabase/select-todo'

export default async function Page({ params }: { params: { id: string } }) {
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

  const { data: proyecto } = await admin
    .from('proyectos')
    .select(`
      id, nombre, codigo, imagen_url, status, created_at,
      clientes!cliente_id(id, nombre),
      proyecto_fases(
        id, fase_id,
        catalogo_fases(id, numero, label, seccion)
      )
    `)
    .eq('id', params.id)
    .single()

  if (!proyecto) notFound()

  const [
    { data: members },
    timeEntries,
    { data: costosFijos },
    { data: configRows },
    { data: salaryHistory },
    { data: facturas },
    { data: fixedCostHistory },
    { data: costosVariablesProyecto },
    { data: bizDev },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, nombre, apellido, avatar_url, salario_mensual, horas_mensuales')
      .in('rol', ['fp_team', 'fp_manager', 'fp_partner']),
    selectTodo<{ id: string; user_id: string; fase_id: string | null; horas: number; fecha: string; notas: string | null }>((desde, hasta) => admin
      .from('time_entries')
      .select('id, user_id, fase_id, horas, fecha, notas')
      .eq('proyecto_id', params.id)
      .order('fecha', { ascending: false })
      .order('id')
      .range(desde, hasta)),
    admin
      .from('costos_fijos')
      .select('monto'),
    admin
      .from('finanzas_config')
      .select('key, value')
      .eq('key', 'minoracion_no_facturable'),
    admin
      .from('salarios_historia')
      .select('user_id, salario_mensual, horas_mensuales, valid_from, valid_to'),
    admin
      .from('facturas')
      .select('id, seccion, concepto, monto, status, proveedor_id, margen_estimado_pct')
      .eq('proyecto_id', params.id)
      .order('created_at'),
    admin
      .from('costos_fijos_historia')
      .select('concepto, monto, valid_from, valid_to'),
    admin
      .from('costos_variables')
      .select('id, año, mes, categoria, concepto, monto, notas')
      .eq('proyecto_id', params.id)
      .order('año', { ascending: false })
      .order('mes', { ascending: false }),
    admin
      .from('profiles')
      .select('id')
      .eq('rol', 'fp_biz_dev'),
  ])

  const { costeHora, repercusionActual: repercusion } = crearCosteHora({
    members:      members ?? [],
    costosFijos:  costosFijos ?? [],
    minoracion:   configRows?.[0]?.value ?? 0,
    salHist:      (salaryHistory    ?? []) as SalaryRecord[],
    fixedHistory: (fixedCostHistory ?? []) as FixedCostRecord[],
    excluirDelReparto: (bizDev ?? []).map(p => p.id),
  })

  type MemberInfo = { nombre: string; apellido: string | null; avatar_url: string | null }
  const memberMap = new Map<string, MemberInfo>()
  for (const m of (members ?? [])) {
    memberMap.set(m.id, {
      nombre:     m.nombre,
      apellido:   m.apellido  ?? null,
      avatar_url: m.avatar_url ?? null,
    })
  }

  // fase_id (proyecto_fases.id) → { label, seccion }
  type PFRow = {
    id: string
    catalogo_fases: { numero: number; label: string; seccion: string } | null
  }
  type FaseInfo = { label: string; seccion: string }
  const faseInfoMap = new Map<string, FaseInfo>()
  for (const pf of (proyecto.proyecto_fases as unknown as PFRow[] ?? [])) {
    if (pf.catalogo_fases) {
      faseInfoMap.set(pf.id, {
        label:   `${pf.catalogo_fases.numero}. ${pf.catalogo_fases.label}`,
        seccion: pf.catalogo_fases.seccion,
      })
    }
  }

  // Aggregations — costs use both the salary AND the fixed costs active on each entry's fecha
  type EmpStats     = { nombre: string; apellido: string | null; avatar_url: string | null; costeHora: number; horas: number; costo: number }
  type FaseStats    = { label: string; horas: number; costo: number }
  type SeccionCost  = { horas: number; costo: number }

  const byEmployee = new Map<string, EmpStats>()
  const byFase     = new Map<string, FaseStats>()
  const bySeccion  = new Map<string, SeccionCost>()

  let totalHoras = 0
  let totalCosto = 0

  for (const e of timeEntries) {
    const mi = memberMap.get(e.user_id)

    // Salario + repercusión de costes fijos vigentes en la fecha de la entrada
    const costo    = e.horas * costeHora(e.user_id, e.fecha)
    totalHoras    += e.horas
    totalCosto    += costo

    // By employee — costeHora shown is the effective average rate (total cost / total hours)
    const prev = byEmployee.get(e.user_id)
    const newHoras = (prev?.horas ?? 0) + e.horas
    const newCosto = (prev?.costo ?? 0) + costo
    byEmployee.set(e.user_id, {
      nombre:     mi?.nombre     ?? 'Desconocido',
      apellido:   mi?.apellido   ?? null,
      avatar_url: mi?.avatar_url ?? null,
      costeHora:  newHoras > 0 ? newCosto / newHoras : 0, // effective avg rate
      horas:      newHoras,
      costo:      newCosto,
    })

    // By fase + by section
    if (e.fase_id) {
      const info      = faseInfoMap.get(e.fase_id)
      const faseLabel = info?.label ?? 'Sin fase asignada'
      const prevF     = byFase.get(e.fase_id)
      byFase.set(e.fase_id, {
        label: faseLabel,
        horas: (prevF?.horas ?? 0) + e.horas,
        costo: (prevF?.costo ?? 0) + costo,
      })
      if (info?.seccion) {
        const prevS = bySeccion.get(info.seccion)
        bySeccion.set(info.seccion, {
          horas: (prevS?.horas ?? 0) + e.horas,
          costo: (prevS?.costo ?? 0) + costo,
        })
      }
    }
  }

  // ── Mobiliario: pass-through con margen ──────────────────────────────────────
  // El suplido bruto NO es ingreso del estudio; solo cuenta el margen (estimado
  // mientras no se liquide, real al liquidar). La regla vive en rentabilidad.ts.
  const { data: liqRow } = await admin
    .from('proyectos').select('mobiliario_liquidado').eq('id', params.id).maybeSingle()
  const mobiliarioLiquidado = Boolean((liqRow as { mobiliario_liquidado?: boolean } | null)?.mobiliario_liquidado)

  const ingresos = ingresosProyecto(facturas ?? [], {
    comprasMobiliario: comprasMobiliarioPorProyecto(
      ((costosVariablesProyecto ?? []) as unknown as { categoria: string; monto: number }[])
        .map((c) => ({ ...c, proyecto_id: params.id }))
    ).get(params.id) ?? 0,
    mobiliarioLiquidado,
  })

  // Aggregate billing by section
  const STATUS_ORDER = ['acordada_contrato', 'cobrable', 'enviada', 'pagada', 'impagada']
  type SeccionStats = { seccion: string; monto: number; cobrado: number; count: number; statuses: string[] }
  const bySectionMap = new Map<string, SeccionStats>()
  for (const f of (facturas ?? [])) {
    const prev = bySectionMap.get(f.seccion) ?? { seccion: f.seccion, monto: 0, cobrado: 0, count: 0, statuses: [] }
    bySectionMap.set(f.seccion, {
      seccion:  f.seccion,
      monto:    prev.monto   + f.monto,
      cobrado:  prev.cobrado + (f.status === 'pagada' ? f.monto : 0),
      count:    prev.count   + 1,
      statuses: [...prev.statuses, f.status],
    })
  }
  // El mobiliario aporta su margen neto, no el suplido bruto
  const mobStats = bySectionMap.get(SECCION_MOBILIARIO)
  if (mobStats) {
    bySectionMap.set(SECCION_MOBILIARIO, { ...mobStats, monto: ingresos.mobEfectivo, cobrado: ingresos.mobEfectivoCobrado })
  }

  const billingBySec = Array.from(bySectionMap.values()).sort((a, b) => {
    const ia = SECCION_ORDER.indexOf(a.seccion as never)
    const ib = SECCION_ORDER.indexOf(b.seccion as never)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const totalAcordado = ingresos.acordado
  const totalCobrado  = ingresos.cobrado

  const costBySec = Array.from(bySeccion.entries())
    .map(([seccion, s]) => ({ seccion, horas: s.horas, costo: s.costo }))
    .sort((a, b) => {
      const ia = SECCION_ORDER.indexOf(a.seccion as never)
      const ib = SECCION_ORDER.indexOf(b.seccion as never)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

  const cliente = proyecto.clientes as unknown as { nombre: string } | null

  return (
    <ProyectoFinanzasDetalle
      proyecto={{
        id:      proyecto.id,
        nombre:  proyecto.nombre,
        codigo:  proyecto.codigo  ?? null,
        status:  proyecto.status  as string,
        cliente: cliente?.nombre  ?? null,
      }}
      totalHoras={totalHoras}
      totalCosto={totalCosto}
      totalAcordado={totalAcordado}
      totalCobrado={totalCobrado}
      billingBySec={billingBySec}
      costBySec={costBySec}
      repercusionHora={repercusion}
      byEmployee={Array.from(byEmployee.values()).sort((a, b) => b.costo - a.costo)}
      byFase={Array.from(byFase.values()).sort((a, b) => b.horas - a.horas)}
      costosVariables={(costosVariablesProyecto ?? []) as unknown as CostoVariableRow[]}
    />
  )
}

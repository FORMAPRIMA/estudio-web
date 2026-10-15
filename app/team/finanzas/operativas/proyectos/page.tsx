import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProyectosAnalisisPage from '@/components/team/finanzas/ProyectosAnalisisPage'
import type { SalaryRecord } from '@/lib/finanzas/salaryHistory'
import type { FixedCostRecord } from '@/lib/finanzas/fixedCostHistory'
import { crearCosteHora, ingresosProyecto, comprasMobiliarioPorProyecto } from '@/lib/finanzas/rentabilidad'
import type { FacturaIngreso } from '@/lib/finanzas/rentabilidad'
import { selectTodo } from '@/lib/supabase/select-todo'

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
    timeEntries,
    { data: costosFijos },
    { data: fixedCostHistory },
    { data: configRows },
    { data: facturas },
    { data: salaryHistory },
    { data: costosVariables },
    { data: bizDev },
  ] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, imagen_url, status, mobiliario_liquidado, clientes!cliente_id(id, nombre)')
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id, salario_mensual, horas_mensuales')
      .in('rol', ['fp_team', 'fp_manager', 'fp_partner']),
    // Paginado: son miles de filas y PostgREST corta en 1000 sin avisar.
    selectTodo<{ user_id: string; proyecto_id: string; horas: number; fecha: string }>((desde, hasta) => admin
      .from('time_entries')
      .select('user_id, proyecto_id, horas, fecha')
      .not('proyecto_id', 'is', null)
      .order('id')
      .range(desde, hasta)),
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
      .select('proyecto_id, seccion, monto, status, proveedor_id, margen_estimado_pct'),
    admin
      .from('salarios_historia')
      .select('user_id, salario_mensual, horas_mensuales, valid_from, valid_to'),
    admin
      .from('costos_variables')
      .select('proyecto_id, categoria, monto')
      .not('proyecto_id', 'is', null),
    admin
      .from('profiles')
      .select('id')
      .eq('rol', 'fp_biz_dev'),
  ])

  const { costeHora } = crearCosteHora({
    members:      members ?? [],
    costosFijos:  costosFijos ?? [],
    minoracion:   configRows?.[0]?.value ?? 0,
    salHist:      (salaryHistory    ?? []) as SalaryRecord[],
    fixedHistory: (fixedCostHistory ?? []) as FixedCostRecord[],
    excluirDelReparto: (bizDev ?? []).map(p => p.id),
  })

  // Aggregate hours + cost per project using fully historical rates
  const aggr = new Map<string, { horas: number; costo: number }>()
  for (const e of timeEntries) {
    if (!e.proyecto_id || !e.fecha) continue
    const prev = aggr.get(e.proyecto_id) ?? { horas: 0, costo: 0 }
    aggr.set(e.proyecto_id, {
      horas: prev.horas + e.horas,
      costo: prev.costo + e.horas * costeHora(e.user_id, e.fecha),
    })
  }

  // Billing per project — mobiliario a margen neto, igual que la ficha
  const facturasPorProyecto = new Map<string, FacturaIngreso[]>()
  for (const f of (facturas ?? [])) {
    const arr = facturasPorProyecto.get(f.proyecto_id) ?? []
    arr.push(f)
    facturasPorProyecto.set(f.proyecto_id, arr)
  }
  const comprasMob = comprasMobiliarioPorProyecto(costosVariables ?? [])

  const cards = (proyectos ?? []).map(p => {
    const s       = aggr.get(p.id) ?? { horas: 0, costo: 0 }
    const b       = ingresosProyecto(facturasPorProyecto.get(p.id) ?? [], {
      comprasMobiliario:   comprasMob.get(p.id) ?? 0,
      mobiliarioLiquidado: Boolean(p.mobiliario_liquidado),
    })
    const cliente = p.clientes as unknown as { nombre: string } | null
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

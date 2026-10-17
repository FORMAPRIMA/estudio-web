/**
 * Rentabilidad de proyecto — la única fuente de las cuentas que comparten la
 * ficha P&L, las cards de análisis de proyectos y el dashboard de finanzas.
 *
 * Antes cada pantalla lo calculaba a su manera (tarifa plana en el dashboard,
 * suplidos de mobiliario como ingreso bruto en las cards…) y la card y la ficha
 * del mismo proyecto no cuadraban. Si cambia una regla, se cambia aquí.
 */

import { historicalCostPerHour } from './salaryHistory'
import type { SalaryRecord } from './salaryHistory'
import { repercusionAt } from './fixedCostHistory'
import type { FixedCostRecord } from './fixedCostHistory'
import { calcRepercusion, SECCION_MOBILIARIO, CATEGORIA_MOBILIARIO } from './costs'

// ── Coste de la hora ──────────────────────────────────────────────────────────

export interface CosteHoraInput {
  members:      { id: string; salario_mensual: number | null; horas_mensuales: number | null }[]
  costosFijos:  { monto: number }[]
  minoracion:   number
  salHist:      SalaryRecord[]
  fixedHistory: FixedCostRecord[]
  /**
   * Personas cuyas horas NO reparten costes fijos (fp_biz_dev): no trabajan en
   * proyectos de cliente, así que contar sus horas abarataría la hora de proyecto.
   * Su sueldo sí es coste del estudio, pero se ve aparte (Marketing → Horas).
   */
  excluirDelReparto?: string[]
}

/**
 * Devuelve `costeHora(userId, fecha)`: salario histórico de esa persona en esa
 * fecha + repercusión de costes fijos histórica de esa fecha. Cuando el histórico
 * no cubre la fecha, cae al salario y la repercusión actuales.
 */
export function crearCosteHora({ members, costosFijos, minoracion, salHist, fixedHistory, excluirDelReparto = [] }: CosteHoraInput) {
  const salHistReparto = salHist.filter((r) => !excluirDelReparto.includes(r.user_id))
  const repercusionActual = calcRepercusion(costosFijos, members, minoracion)

  const actualPorMiembro = new Map<string, number>()
  for (const m of members) {
    const base = m.salario_mensual && m.horas_mensuales ? m.salario_mensual / m.horas_mensuales : 0
    actualPorMiembro.set(m.id, base + repercusionActual)
  }

  // Muchas entradas comparten fecha: la repercusión se calcula una vez por día.
  const repercusionCache = new Map<string, number>()
  const repercusionDe = (fecha: string) => {
    let rep = repercusionCache.get(fecha)
    if (rep === undefined) {
      rep = repercusionAt(fixedHistory, salHistReparto, fecha, minoracion, repercusionActual)
      repercusionCache.set(fecha, rep)
    }
    return rep
  }

  const costeHora = (userId: string, fecha: string) => {
    const fallback = actualPorMiembro.get(userId) ?? repercusionActual
    return historicalCostPerHour(salHist, userId, fecha, fallback, repercusionDe(fecha))
  }

  return { costeHora, repercusionActual, costeHoraActual: actualPorMiembro }
}

// ── Ingresos ──────────────────────────────────────────────────────────────────

export interface FacturaIngreso {
  seccion:              string
  monto:                number
  status:               string
  proveedor_id?:        string | null
  margen_estimado_pct?: number | null
}

/**
 * "Compra de mobiliario" mezcla dos naturalezas:
 *  · Suplido (sin proveedor): lo paga el cliente y alimenta el depósito. No es
 *    ingreso del estudio; solo cuenta su margen.
 *  · Rappel / descuento (con proveedor): margen íntegro.
 */
export const esSuplido = (f: Pick<FacturaIngreso, 'seccion' | 'proveedor_id'>) => f.seccion === SECCION_MOBILIARIO && !f.proveedor_id

/**
 * Lo que una factura aporta como ingreso del estudio, a margen estimado: el
 * suplido cuenta solo su `margen_estimado_pct`. Sirve para series por fecha
 * (gráfico mensual), donde no se puede repartir el margen real liquidado.
 */
export function ingresoNetoEstimado(f: FacturaIngreso): number {
  if (!esSuplido(f)) return f.monto
  return f.monto * (Number(f.margen_estimado_pct ?? 0) / 100)
}

/**
 * Acordado y cobrado de un proyecto con el mobiliario a margen neto: estimado
 * mientras no se liquida, real (suplidos − compras + rappels) al liquidar.
 */
export function ingresosProyecto(
  facturas: FacturaIngreso[],
  opts: { comprasMobiliario: number; mobiliarioLiquidado: boolean }
) {
  const pagada = (f: FacturaIngreso) => f.status === 'pagada'
  const suma = (fs: FacturaIngreso[], fn: (f: FacturaIngreso) => number = (f) => f.monto) =>
    fs.reduce((s, f) => s + fn(f), 0)

  const resto     = facturas.filter((f) => f.seccion !== SECCION_MOBILIARIO)
  const mob       = facturas.filter((f) => f.seccion === SECCION_MOBILIARIO)
  const suplidos  = mob.filter(esSuplido)
  const rappels   = mob.filter((f) => !esSuplido(f))

  const rappel         = suma(rappels)
  const rappelCobrado  = suma(rappels.filter(pagada))
  const suplido        = suma(suplidos)
  const suplidoCobrado = suma(suplidos.filter(pagada))

  const mobEstimado        = suma(suplidos, ingresoNetoEstimado) + rappel
  const mobEstimadoCobrado = suma(suplidos.filter(pagada), ingresoNetoEstimado) + rappelCobrado
  const mobReal            = suplido - opts.comprasMobiliario + rappel
  const mobRealCobrado     = Math.max(0, suplidoCobrado - opts.comprasMobiliario) + rappelCobrado

  const mobEfectivo        = opts.mobiliarioLiquidado ? mobReal : mobEstimado
  const mobEfectivoCobrado = opts.mobiliarioLiquidado ? mobRealCobrado : mobEstimadoCobrado

  return {
    acordado: suma(resto) + mobEfectivo,
    cobrado:  suma(resto.filter(pagada)) + mobEfectivoCobrado,
    mobEfectivo,
    mobEfectivoCobrado,
  }
}

/** Compras de mobiliario por proyecto (costos_variables de esa categoría). */
export function comprasMobiliarioPorProyecto(
  costosVariables: { proyecto_id: string | null; categoria: string | null; monto: number | null }[]
) {
  const map = new Map<string, number>()
  for (const c of costosVariables) {
    if (!c.proyecto_id || c.categoria !== CATEGORIA_MOBILIARIO) continue
    map.set(c.proyecto_id, (map.get(c.proyecto_id) ?? 0) + Number(c.monto ?? 0))
  }
  return map
}

// ── Coste de sueldo (sin repercusión) ─────────────────────────────────────────

/** Sueldo por hora de una persona en un tramo de fechas. `hasta` null = vigente. */
export interface TarifaHora {
  user_id: string
  desde:   string | null   // null = sin histórico: tarifa actual, vale para cualquier fecha
  hasta:   string | null
  eurHora: number
}

/** Tramos de sueldo/hora desde salarios_historia, con el sueldo actual de respaldo. */
export function tarifasDeSueldo(
  salHist: SalaryRecord[],
  perfiles: { id: string; salario_mensual: number | null; horas_mensuales: number | null }[]
): TarifaHora[] {
  const tarifas: TarifaHora[] = salHist
    .filter((r) => r.horas_mensuales > 0)
    .map((r) => ({ user_id: r.user_id, desde: r.valid_from, hasta: r.valid_to, eurHora: r.salario_mensual / r.horas_mensuales }))
  for (const p of perfiles) {
    if (p.salario_mensual && p.horas_mensuales) {
      tarifas.push({ user_id: p.id, desde: null, hasta: null, eurHora: p.salario_mensual / p.horas_mensuales })
    }
  }
  return tarifas
}

/** €/h de sueldo de esa persona en esa fecha (tramo histórico o, si no hay, el actual). */
export function sueldoHoraEn(tarifas: TarifaHora[], userId: string, fecha: string): number {
  const propias = tarifas.filter((t) => t.user_id === userId)
  const tramo = propias.find((t) => t.desde !== null && t.desde <= fecha && (t.hasta === null || t.hasta >= fecha))
  return (tramo ?? propias.find((t) => t.desde === null))?.eurHora ?? 0
}

// Retribución variable de business development — reglas del plan y cálculo.
// Lógica pura (sin BD) compartida por /team/marketing/retribucion y su página
// explicativa. Si cambian los tramos o coeficientes, se cambian aquí y la guía
// se actualiza sola porque lee estas mismas constantes.

export type OrigenId = 'orig' | 'react' | 'repeat' | 'funnel' | 'house'

export interface Origen {
  id: OrigenId
  nombre: string
  corto: string      // descripción de una línea para selects y tablas
  ejemplo: string    // para la guía
  coef: number
}

export const ORIGENES: Origen[] = [
  { id: 'orig',   nombre: 'Captación propia', corto: 'Cliente nuevo captado directamente',                       ejemplo: 'Un contacto de tu red o de un evento que acaba firmando con el estudio.', coef: 1 },
  { id: 'react',  nombre: 'Reactivación',     corto: 'Cliente inactivo más de 12 meses que se recupera',     ejemplo: 'Un cliente de 2023 que vuelve porque le propones una nueva fase.', coef: 0.5 },
  { id: 'repeat', nombre: 'Repetición',       corto: 'Nuevo encargo, en 12 meses, de un cliente de captación propia',   ejemplo: 'Un cliente que captaste tú encarga otra vivienda a los 8 meses.', coef: 0.5 },
  { id: 'funnel', nombre: 'Inbound',          corto: 'Llega por la web, redes u otros canales del estudio', ejemplo: 'Un formulario de la web que atiendes y conviertes en contrato.', coef: 0.35 },
  { id: 'house',  nombre: 'Cuenta del estudio', corto: 'Cliente recurrente o de la red de los socios',  ejemplo: 'Un promotor con el que el estudio ya trabaja.', coef: 0 },
]

export const origenDe = (id: string) => ORIGENES.find((o) => o.id === id) ?? ORIGENES[ORIGENES.length - 1]

export interface Tramo { desde: number; hasta: number; pct: number }

export const PLAN = {
  tramos: [
    { desde: 0,      hasta: 25000,  pct: 0.05 },
    { desde: 25000,  hasta: 75000,  pct: 0.03 },
    { desde: 75000,  hasta: 200000, pct: 0.015 },
  ] as Tramo[],
  tope: 200000,              // la base por encima no comisiona
  minimo: 20000,             // por debajo de esta base el proyecto no comisiona, sea cual sea su origen
  penalizacionDescuento: 0.5, // × si hay descuento por encima del límite sin autorización
  mesesLiquidacion: 3,        // trimestral: se paga en la nómina del mes siguiente al cierre
  margenObraDefecto: 5,
}

// ── Calendario de cobros ────────────────────────────────────────────────────
// Mes como 'AAAA-MM'. Internamente se trabaja con un índice (año*12 + mes0).

export interface Cobro { mes: string; pct: number }

export const mesIdx = (s: string | null | undefined): number | null => {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(s ?? '').trim())
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null
}
export const mesStr = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const mesCorto = (i: number) => `${MES[i % 12]} ${String(Math.floor(i / 12)).slice(2)}`
export const mesLargo = (i: number) => `${MES_L[i % 12]} ${Math.floor(i / 12)}`

export const r2 = (v: number) => Math.round(v * 100) / 100

/** n cobros iguales consecutivos desde `inicio`; el último absorbe el redondeo. */
export function cobrosIguales(n: number, inicio: number): Cobro[] {
  const k = Math.max(1, Math.min(36, Math.round(n) || 1))
  const base = Math.floor(10000 / k) / 100
  return Array.from({ length: k }, (_, j) => ({
    mes: mesStr(inicio + j),
    pct: j === k - 1 ? r2(100 - base * (k - 1)) : base,
  }))
}

export const sumaPct = (c: Cobro[]) => r2(c.reduce((a, x) => a + (Number(x.pct) || 0), 0))

/** Un calendario es «uniforme» si se puede describir solo con nº de cobros + mes de inicio. */
export function esUniforme(c: Cobro[]): boolean {
  if (!c.length) return true
  const ini = mesIdx(c[0].mes)
  if (ini === null) return false
  const ref = cobrosIguales(c.length, ini)
  return c.every((x, j) => x.mes === ref[j].mes && Math.abs(x.pct - ref[j].pct) < 0.01)
}

// ── Proyecto ────────────────────────────────────────────────────────────────

export interface ProyectoInput {
  nombre: string
  origen: OrigenId
  firma: string            // 'AAAA-MM'
  honorarios: number       // € sin IVA
  obra: number             // presupuesto de obra previsto, € sin IVA
  margenPct: number        // % de margen del estudio sobre la obra
  descuento: boolean       // descuento por encima del límite sin autorización de socios
  cobrosHonorarios: Cobro[]
  cobrosObra: Cobro[]
  notas?: string
}

export interface Proyecto extends ProyectoInput {
  id: string
  beneficiarioId: string
  createdAt: string
  updatedAt: string
}

export interface Calculo {
  honorarios: number
  margenObra: number
  baseBruta: number
  base: number          // topada
  exceso: number
  tramos: (Tramo & { importe: number; comision: number })[]
  escala: number        // comisión antes de coeficientes
  coef: number
  total: number
  porHonorarios: number
  porObra: number
  efectivo: number      // % sobre baseBruta
  bajoMinimo: boolean   // base < PLAN.minimo → comisión 0
}

export function calcular(p: Pick<ProyectoInput, 'honorarios' | 'obra' | 'margenPct' | 'origen' | 'descuento'>): Calculo {
  const honorarios = Math.max(0, Number(p.honorarios) || 0)
  const margenObra = Math.max(0, Number(p.obra) || 0) * Math.max(0, Number(p.margenPct) || 0) / 100
  const baseBruta = honorarios + margenObra
  const base = Math.min(baseBruta, PLAN.tope)
  const tramos = PLAN.tramos.map((t) => {
    const importe = Math.max(0, Math.min(base, t.hasta) - t.desde)
    return { ...t, importe, comision: importe * t.pct }
  })
  const escala = tramos.reduce((a, t) => a + t.comision, 0)
  const coef = origenDe(p.origen).coef
  const bajoMinimo = baseBruta > 0 && baseBruta < PLAN.minimo
  const total = bajoMinimo ? 0 : escala * coef * (p.descuento ? PLAN.penalizacionDescuento : 1)
  const shareH = baseBruta ? honorarios / baseBruta : 0
  return {
    honorarios, margenObra, baseBruta, base, exceso: Math.max(0, baseBruta - PLAN.tope),
    tramos, escala, coef, total, bajoMinimo,
    porHonorarios: total * shareH,
    porObra: total * (1 - shareH),
    efectivo: baseBruta ? (total / baseBruta) * 100 : 0,
  }
}

/** Problemas que impiden registrar; lista vacía = válido. */
export function validar(p: ProyectoInput): string[] {
  const c = calcular(p)
  const errs: string[] = []
  if (!p.nombre.trim()) errs.push('Ponle un nombre al proyecto.')
  if (mesIdx(p.firma) === null) errs.push('Indica el mes de firma.')
  if (c.honorarios <= 0 && c.margenObra <= 0) errs.push('Introduce honorarios o un margen de obra.')
  const bloques: [string, number, Cobro[]][] = [
    ['honorarios', c.honorarios, p.cobrosHonorarios],
    ['margen de obra', c.margenObra, p.cobrosObra],
  ]
  for (const [lab, importe, cobros] of bloques) {
    if (importe <= 0) continue
    if (!cobros.length) errs.push(`Añade al menos un cobro de ${lab}.`)
    else if (sumaPct(cobros) !== 100) errs.push(`Los cobros de ${lab} suman ${sumaPct(cobros)} %; deben sumar 100 %.`)
    if (cobros.some((x) => mesIdx(x.mes) === null)) errs.push(`Falta el mes de algún cobro de ${lab}.`)
  }
  return errs
}

/** Comisión devengada por mes (índice de mes → €). */
export function devengoMensual(p: ProyectoInput): Record<number, number> {
  const c = calcular(p)
  const out: Record<number, number> = {}
  const add = (cobros: Cobro[], com: number) => {
    if (com <= 0) return
    for (const x of cobros) {
      const m = mesIdx(x.mes)
      if (m === null) continue
      out[m] = (out[m] ?? 0) + com * (Number(x.pct) || 0) / 100
    }
  }
  add(p.cobrosHonorarios, c.porHonorarios)
  add(p.cobrosObra, c.porObra)
  return out
}

// ── Liquidaciones ───────────────────────────────────────────────────────────

export interface Liquidacion {
  inicio: number      // primer mes del periodo
  importe: number
  pago: number        // mes de la nómina en que se paga
  etiqueta: string    // 'T1 27 (ene–mar)'
}

export const inicioPeriodo = (m: number, liq = PLAN.mesesLiquidacion) => m - ((m % 12) % liq)

export function etiquetaPeriodo(inicio: number, liq = PLAN.mesesLiquidacion) {
  const y = String(Math.floor(inicio / 12)).slice(2)
  const m = inicio % 12
  if (liq === 1) return mesCorto(inicio)
  if (liq === 3) return `T${Math.floor(m / 3) + 1} ${y} (${MES[m]}–${MES[m + 2]})`
  return `S${Math.floor(m / 6) + 1} ${y} (${MES[m]}–${MES[m + 5]})`
}

export function liquidaciones(proyectos: ProyectoInput[], liq = PLAN.mesesLiquidacion): Liquidacion[] {
  const porPeriodo: Record<number, number> = {}
  for (const p of proyectos) {
    for (const [m, v] of Object.entries(devengoMensual(p))) {
      const ini = inicioPeriodo(Number(m), liq)
      porPeriodo[ini] = (porPeriodo[ini] ?? 0) + v
    }
  }
  return Object.keys(porPeriodo).map(Number).sort((a, b) => a - b).map((inicio) => ({
    inicio, importe: porPeriodo[inicio], pago: inicio + liq, etiqueta: etiquetaPeriodo(inicio, liq),
  }))
}

export const mesActual = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth() }

// ── Plan del beneficiario (salario fijo) ────────────────────────────────────

export interface PlanBeneficiario {
  beneficiarioId: string
  nombre: string
  salarioBase: number   // bruto anual
  ssPct: number         // Seguridad Social a cargo de la empresa
}

// ── Formato ─────────────────────────────────────────────────────────────────

export const eur = (v: number, dec = false) =>
  v.toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR', useGrouping: true,
    minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0,
  })
export const pct = (v: number) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`

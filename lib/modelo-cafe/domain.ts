// Modelo Café Goya — dominio y motor de cálculo
// Modelo financiero del quiosco → café de especialidad to-go (Calle Goya 63, Madrid).
// Financiación: entrada + aplazamiento del traspaso (vendedor) + préstamo bancario.

export type ModeloInputs = {
  // Operativa
  dias: number
  // Café
  cafe_p: number
  cafe_ud: number
  cafe_c: number
  // Otras bebidas
  beb_ud: number
  beb_p: number
  beb_c: number
  // Bollería y alimentos
  bol_ud: number
  bol_p: number
  bol_c: number
  // Prensa · publicidad · pagos
  prensa_v: number
  prensa_m: number
  pub: number
  tar_pct: number
  tar_com: number
  // Costes fijos mensuales
  personal: number
  autonomo: number
  canon: number
  luz: number
  gest: number
  seg: number
  mant: number
  soft: number
  mkt: number
  otros: number
  // Inversión
  traspaso: number
  reforma: number
  equipo: number
  licencias: number
  mobiliario: number
  stock: number
  fondo: number
  // Financiación del traspaso (vendedor)
  entrada: number
  plazo: number
  interes: number
  // Préstamo bancario
  banco_pct: number
  banco_tin: number
  banco_plazo: number
  banco_comision: number
  // Amortización / impuestos / objetivo
  amort_t: number
  amort_a: number
  tax: number
  obj: number
}

export const BASE_INPUTS: ModeloInputs = {
  dias: 26,
  cafe_p: 2.0, cafe_ud: 150, cafe_c: 0.5,
  beb_ud: 30, beb_p: 2.5, beb_c: 0.35,
  bol_ud: 60, bol_p: 2.0, bol_c: 0.5,
  prensa_v: 2500, prensa_m: 0.25,
  pub: 600,
  tar_pct: 0.7, tar_com: 0.012,
  personal: 4300, autonomo: 350, canon: 300, luz: 350, gest: 150,
  seg: 80, mant: 150, soft: 100, mkt: 150, otros: 150,
  traspaso: 70000, reforma: 20000, equipo: 12000, licencias: 4000,
  mobiliario: 6000, stock: 3000, fondo: 15000,
  entrada: 35000, plazo: 24, interes: 0,
  banco_pct: 0.65, banco_tin: 0.065, banco_plazo: 60, banco_comision: 0.01,
  amort_t: 10, amort_a: 7, tax: 0.2, obj: 3000,
}

export type Escenario = {
  id: string
  nombre: string
  notas: string | null
  es_base: boolean
  inputs: ModeloInputs
  created_at: string
  updated_at: string
}

/** Sanea inputs venidos de BD/cliente: completa claves ausentes con el base y descarta no-numéricos. */
export function normalizeInputs(raw: unknown): ModeloInputs {
  const out: ModeloInputs = { ...BASE_INPUTS }
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(BASE_INPUTS) as (keyof ModeloInputs)[]) {
      const val = (raw as Record<string, unknown>)[k]
      if (typeof val === 'number' && Number.isFinite(val)) out[k] = val
    }
  }
  return out
}

/** Cuota constante (sistema francés). iMens = interés mensual en tanto por uno. */
export function cuotaFrancesa(capital: number, iMens: number, meses: number): number {
  if (capital <= 0 || meses <= 0) return 0
  return iMens === 0 ? capital / meses : (capital * iMens) / (1 - Math.pow(1 + iMens, -meses))
}

export type ModeloResults = ReturnType<typeof computeModelo>

export function computeModelo(v: ModeloInputs) {
  const cafeIng = v.cafe_p * v.cafe_ud * v.dias
  const bebIng = v.beb_ud * v.beb_p * v.dias
  const bolIng = v.bol_ud * v.bol_p * v.dias
  const prensaIng = v.prensa_v
  const pubIng = v.pub
  const fact = cafeIng + bebIng + bolIng + prensaIng + pubIng

  const cafeCoste = v.cafe_c * v.cafe_ud * v.dias
  const bebCoste = bebIng * v.beb_c
  const bolCoste = bolIng * v.bol_c
  const prensaCoste = prensaIng * (1 - v.prensa_m)
  const comis = (cafeIng + bebIng + bolIng + prensaIng) * v.tar_pct * v.tar_com
  const cv = cafeCoste + bebCoste + bolCoste + prensaCoste + comis
  const mb = fact - cv

  const cf = v.personal + v.autonomo + v.canon + v.luz + v.gest +
    v.seg + v.mant + v.soft + v.mkt + v.otros
  const ebitda = mb - cf
  const amortAnual = (v.amort_t > 0 ? v.traspaso / v.amort_t : 0) +
    (v.amort_a > 0 ? (v.reforma + v.equipo + v.mobiliario) / v.amort_a : 0)
  const amortMes = amortAnual / 12

  // Traspaso: entrada + aplazamiento al vendedor
  const entrada = Math.min(v.entrada, v.traspaso)
  const aplazado = Math.max(0, v.traspaso - entrada)
  const plazoT = Math.max(0, Math.round(v.plazo))
  const cuotaT = cuotaFrancesa(aplazado, v.interes / 12, plazoT)
  const interesTotalT = Math.max(0, cuotaT * plazoT - aplazado)
  const interesTMes = plazoT > 0 ? interesTotalT / plazoT : 0

  // Inversión / desembolso inicial
  const restoInv = v.reforma + v.equipo + v.licencias + v.mobiliario + v.stock + v.fondo
  const desembInicial = entrada + restoInv // caja necesaria el día 1 (antes del banco)
  const invEconomica = v.traspaso + restoInv

  // Préstamo bancario (% del desembolso inicial)
  const prestamo = Math.max(0, v.banco_pct * desembInicial)
  const plazoB = Math.max(0, Math.round(v.banco_plazo))
  const cuotaB = cuotaFrancesa(prestamo, v.banco_tin / 12, plazoB)
  const interesTotalB = Math.max(0, cuotaB * plazoB - prestamo)
  const interesBMes = plazoB > 0 ? interesTotalB / plazoB : 0
  const comisionApertura = prestamo * v.banco_comision

  // Capital propio real aportado el día 1
  const capitalPropio = desembInicial - prestamo + comisionApertura
  const costeFinanciero = interesTotalT + interesTotalB + comisionApertura

  // P&L: los intereses (banco + aplazamiento) son gasto financiero
  const gastoFin = interesTMes + interesBMes
  const bai = ebitda - amortMes - gastoFin
  const impuesto = bai > 0 ? bai * v.tax : 0
  const neto = bai - impuesto
  const margenNeto = fact ? neto / fact : 0

  // Caja mensual por fases
  const cashOperativa = ebitda - impuesto // antes de cuotas de financiación
  const cashArranque = cashOperativa - cuotaT - cuotaB // pagando banco + traspaso
  const cashSoloBanco = cashOperativa - cuotaB // traspaso pagado, banco sigue
  const cashLibre = cashOperativa // sin cuotas

  // ── Puntos de equilibrio (cafés/día) ───────────────────────────────
  // El café es la palanca: EBITDA(x) = contribCafeMes·x − deficitFijo, donde
  // deficitFijo = costes fijos − contribución de las OTRAS líneas (bollería,
  // bebidas, prensa y publicidad, netas de coste y comisiones). Como todo es
  // lineal en x, cada umbral se resuelve despejando el EBITDA necesario.
  const cmCafe = v.cafe_p - v.cafe_c - v.cafe_p * v.tar_pct * v.tar_com   // margen de contribución por café
  const contribResto = (bebIng - bebCoste) + (bolIng - bolCoste) +
    (prensaIng * v.prensa_m) + pubIng -
    (bebIng + bolIng + prensaIng) * v.tar_pct * v.tar_com
  const mbPct = fact ? mb / fact : 0
  const factMin = mbPct ? cf / mbPct : 0

  const contribCafeMes = cmCafe * v.dias          // € de margen/mes que aporta 1 café/día
  const deficitFijo = cf - contribResto           // lo que el café debe cubrir para EBITDA 0
  const okBE = contribCafeMes > 0
  const tasa = v.tax < 1 ? v.tax : 0
  // cafés/día para alcanzar un EBITDA objetivo dado
  const cafesParaEbitda = (ebitdaObjetivo: number) =>
    okBE ? Math.max(0, (deficitFijo + ebitdaObjetivo) / contribCafeMes) : 0

  // 1) Operativo: EBITDA = 0 (NO cubre amortización, intereses ni cuotas).
  const cafesBE = cafesParaEbitda(0)
  // 2) Contable: beneficio neto = 0 → EBITDA cubre amortización + intereses.
  const cafesNeto0 = cafesParaEbitda(amortMes + gastoFin)
  // 3) Caja del arranque = 0 → cubre gastos y las cuotas reales de banco +
  //    vendedor. Despeje con impuesto: (EBITDA − impuesto) = cuotas, con
  //    impuesto = (EBITDA − amort − intereses)·tasa.
  const ebitdaCaja = (cuotaT + cuotaB - (amortMes + gastoFin) * tasa) / (1 - tasa)
  const cafesCaja0 = cafesParaEbitda(ebitdaCaja)
  // 4) Objetivo: beneficio neto = objetivo (tras amortización e intereses).
  const cafesObj = cafesParaEbitda(amortMes + gastoFin + v.obj / (1 - tasa))

  const netoAnual = neto * 12
  const ebitdaAnual = ebitda * 12

  // Payback sobre el capital propio (la caja cambia al terminar cada financiación)
  let acc = 0
  let paybackMes = 0
  for (let m = 1; m <= 360; m++) {
    let c = cashOperativa
    if (m <= plazoT) c -= cuotaT
    if (m <= plazoB) c -= cuotaB
    acc += c
    if (acc >= capitalPropio) { paybackMes = m; break }
  }
  const payback = paybackMes ? paybackMes / 12 : 0
  const roiPropio = capitalPropio > 0 ? netoAnual / capitalPropio : 0
  const roiEcon = invEconomica ? netoAnual / invEconomica : 0

  return {
    cafeIng, bebIng, bolIng, prensaIng, pubIng, fact,
    cv, mb, cf, ebitda, amortMes, amortAnual, interesTMes, interesBMes, gastoFin,
    bai, impuesto, neto, margenNeto,
    cmCafe, contribResto, factMin, cafesBE, cafesNeto0, cafesCaja0, cafesObj,
    entrada, aplazado, plazoT, cuotaT, interesTotalT,
    prestamo, plazoB, cuotaB, interesTotalB, comisionApertura,
    desembInicial, invEconomica, capitalPropio, costeFinanciero,
    cashOperativa, cashArranque, cashSoloBanco, cashLibre,
    netoAnual, ebitdaAnual, payback, paybackMes, roiPropio, roiEcon,
  }
}

export function esViable(v: ModeloInputs, r: ModeloResults): boolean {
  return r.neto > 0 && r.payback > 0 && r.payback <= 6 &&
    v.cafe_ud >= r.cafesCaja0 && r.cashArranque > 0
}

// ── Formateadores ───────────────────────────────────────────────────

export const eur = (n: number) =>
  (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('es-ES') + ' €'

export const pct = (n: number) =>
  (n * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' %'

export const num = (n: number, d = 0) =>
  n.toLocaleString('es-ES', { maximumFractionDigits: d })

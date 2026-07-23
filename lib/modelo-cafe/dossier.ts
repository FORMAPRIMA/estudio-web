// Modelo Café Goya — motor del dossier de financiación.
// Toma un escenario CONSERVADOR (inputs del modelo) y deriva un pesimista y un
// optimista variando solo los cafés/día (la palanca crítica del negocio), igual
// que el dossier original (70/100/140 alrededor de 100). Los % son ajustables.
// Fuente única de verdad para la preview de la tab y para el PDF del dossier.

import { computeModelo, type ModeloInputs, type ModeloResults } from './domain'

export type EscenarioClave = 'pesimista' | 'conservador' | 'optimista'

export type EscenarioDossier = {
  clave: EscenarioClave
  nombre: string
  cafesDia: number
  facturacionMes: number
  facturacionAnual: number
  margenBrutoPct: number
  ebitdaAnual: number
  netoAnual: number
  margenNeto: number
  cajaArranque: number        // caja/mes tras TODAS las cuotas (años 1-2)
  cajaEstable: number         // caja/mes tras cuotas cuando ya no se paga al vendedor
  dscrArranque: number        // cobertura del servicio de deuda, arranque
  dscrEstable: number         // cobertura del servicio de deuda, fase estable
  paybackMeses: number
  r: ModeloResults
}

const dscr = (cashOperativa: number, servicio: number) =>
  servicio > 0 ? cashOperativa / servicio : 0

function construir(clave: EscenarioClave, nombre: string, inputs: ModeloInputs): EscenarioDossier {
  const r = computeModelo(inputs)
  const servicioArranque = r.cuotaT + r.cuotaB
  const servicioEstable = r.cuotaB
  return {
    clave,
    nombre,
    cafesDia: inputs.cafe_ud,
    facturacionMes: r.fact,
    facturacionAnual: r.fact * 12,
    margenBrutoPct: r.fact ? r.mb / r.fact : 0,
    ebitdaAnual: r.ebitdaAnual,
    netoAnual: r.netoAnual,
    margenNeto: r.margenNeto,
    cajaArranque: r.cashArranque,
    cajaEstable: r.cashSoloBanco,
    dscrArranque: dscr(r.cashOperativa, servicioArranque),
    dscrEstable: dscr(r.cashOperativa, servicioEstable),
    paybackMeses: r.paybackMes,
    r,
  }
}

/**
 * Deriva los tres escenarios del dossier a partir del conservador.
 * @param base       inputs del escenario elegido como CONSERVADOR
 * @param pesimistaPct  variación de cafés/día del pesimista (p.ej. -0.30)
 * @param optimistaPct  variación de cafés/día del optimista (p.ej. +0.40)
 */
export function derivarEscenarios(
  base: ModeloInputs,
  pesimistaPct: number,
  optimistaPct: number
): EscenarioDossier[] {
  const cafesCons = base.cafe_ud
  const cafesPes = Math.max(0, Math.round(cafesCons * (1 + pesimistaPct)))
  const cafesOpt = Math.max(0, Math.round(cafesCons * (1 + optimistaPct)))
  return [
    construir('pesimista', 'Pesimista', { ...base, cafe_ud: cafesPes }),
    construir('conservador', 'Conservador', { ...base, cafe_ud: cafesCons }),
    construir('optimista', 'Optimista', { ...base, cafe_ud: cafesOpt }),
  ]
}

// ── Estructura de la inversión (usos y fuentes) ─────────────────────

export type LineaImporte = { label: string; importe: number; pct?: number }

export type EstructuraInversion = {
  usos: LineaImporte[]
  usosTotal: number
  fuentes: { label: string; importe: number; pct: number }[]
  fuentesTotal: number
}

export function estructuraInversion(v: ModeloInputs): EstructuraInversion {
  const r = computeModelo(v)
  const usos: LineaImporte[] = [
    { label: 'Traspaso del quiosco (concesión municipal)', importe: v.traspaso },
    { label: 'Equipamiento profesional de café', importe: v.equipo },
    { label: 'Reforma y adecuación del quiosco', importe: v.reforma },
    { label: 'Licencias y trámites', importe: v.licencias },
    { label: 'Mobiliario e imagen', importe: v.mobiliario },
    { label: 'Stock inicial', importe: v.stock },
    { label: 'Fondo de maniobra', importe: v.fondo },
  ].filter((u) => u.importe > 0)
  const usosTotal = usos.reduce((a, u) => a + u.importe, 0)

  const fuentesRaw: LineaImporte[] = [
    { label: 'Capital propio de los socios (día 1)', importe: r.capitalPropio },
    { label: `Préstamo bancario solicitado (${r.plazoB} meses)`, importe: r.prestamo },
    { label: `Financiación del vendedor (${r.plazoT} meses)`, importe: r.aplazado },
  ].filter((f) => f.importe > 0)
  const fuentesTotal = fuentesRaw.reduce((a, f) => a + f.importe, 0)
  const fuentes = fuentesRaw.map((f) => ({ ...f, pct: fuentesTotal ? f.importe / fuentesTotal : 0 }))

  return { usos, usosTotal, fuentes, fuentesTotal }
}

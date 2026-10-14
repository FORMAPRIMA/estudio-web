import type { FacturaItem } from '@/app/actions/facturasEmitidas'

export function calcTotals(
  items: FacturaItem[],
  tipoIva: number,
  tipoIrpf?: number | null
) {
  const base      = items.reduce((s, i) => s + i.subtotal, 0)
  const cuotaIva  = Math.round(base * tipoIva) / 100
  const cuotaIrpf = tipoIrpf ? Math.round(base * tipoIrpf) / 100 : 0
  const total     = Math.round((base + cuotaIva - cuotaIrpf) * 100) / 100
  return { base_imponible: base, cuota_iva: cuotaIva, cuota_irpf: cuotaIrpf, total }
}

export function formatNumeroCompleto(serie: string, _año: number, numero: number) {
  return `${serie}-${numero}`
}

// ── Moneda ────────────────────────────────────────────────────────────────────
// Una factura puede ir en dólares (clientes de EE. UU.). Las líneas se escriben
// en esa moneda, pero base_imponible / cuota_iva / cuota_irpf / total de
// facturas_emitidas siguen SIEMPRE en euros: es lo que lee la contabilidad, el
// portal del gestor y el 303. La cuota de IVA tiene que expresarse en euros
// (art. 10 del Reglamento de facturación) al cambio de referencia del BCE.

export type Moneda = 'EUR' | 'USD'

/** Datos de cobro en dólares (cuenta USD de Wise), de estudio_config.usd_* */
export interface PagoUSD {
  titular:     string | null
  banco:       string | null
  routing:     string
  cuenta:      string
  tipo_cuenta: string | null
  swift:       string | null
  direccion:   string | null
}

export function pagoUsdDesdeConfig(c: {
  usd_titular?: string | null; usd_banco?: string | null; usd_routing?: string | null
  usd_cuenta?: string | null; usd_tipo_cuenta?: string | null; usd_swift?: string | null
  usd_direccion?: string | null
} | null | undefined): PagoUSD | null {
  if (!c?.usd_routing || !c.usd_cuenta) return null
  return {
    titular:     c.usd_titular     ?? null,
    banco:       c.usd_banco       ?? null,
    routing:     c.usd_routing,
    cuenta:      c.usd_cuenta,
    tipo_cuenta: c.usd_tipo_cuenta ?? null,
    swift:       c.usd_swift       ?? null,
    direccion:   c.usd_direccion   ?? null,
  }
}
export const MONEDAS: Moneda[] = ['EUR', 'USD']

export function fmtMoneda(n: number, moneda: Moneda = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda }).format(n)
}

/**
 * Totales de una factura en su moneda y en euros.
 * `tipoCambio` sigue la convención del BCE: unidades de la moneda por 1 €
 * (1 € = 1,1195 $). Con EUR se ignora.
 */
export function calcTotalsMoneda(
  items: FacturaItem[],
  tipoIva: number,
  tipoIrpf: number | null | undefined,
  moneda: Moneda,
  tipoCambio: number | null,
) {
  const enMoneda = calcTotals(items, tipoIva, tipoIrpf)
  if (moneda === 'EUR') return { enMoneda, eur: enMoneda }
  if (!tipoCambio || tipoCambio <= 0) throw new Error('Falta el tipo de cambio del BCE.')

  // Se convierte la base y sobre ella se calculan los impuestos en euros, que es
  // como se declaran. El total en euros puede diferir en un céntimo de
  // total/tipo_cambio: manda este.
  const base      = Math.round((enMoneda.base_imponible / tipoCambio) * 100) / 100
  const cuotaIva  = Math.round(base * tipoIva) / 100
  const cuotaIrpf = tipoIrpf ? Math.round(base * tipoIrpf) / 100 : 0
  const total     = Math.round((base + cuotaIva - cuotaIrpf) * 100) / 100
  return {
    enMoneda,
    eur: { base_imponible: base, cuota_iva: cuotaIva, cuota_irpf: cuotaIrpf, total },
  }
}

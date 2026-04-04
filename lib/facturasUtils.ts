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

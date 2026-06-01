// View-model de una propuesta para renderizarla fuera del PDF (vista web del
// Espacio). Reusa exactamente el cálculo de importes del PDF (calcPropuesta +
// honorarios_override) para que la cifra que ve el cliente cuadre con el PDF.

import {
  SERVICIOS_CONFIG, SERVICIO_IDS, calcPropuesta,
} from '@/lib/propuestas/config'
import type { ServicioId, ServicioEntry } from '@/lib/propuestas/config'

export interface PropuestaVMServicio {
  id: string
  label: string
  texto: string
  entregables: { grupo: string; items: string[] }[]
  semanas: string
  pago: { label: string; pct: number; importe: number }[]
  importe: number
}

export interface PropuestaVM {
  numero: string
  titulo: string | null
  fecha: string | null
  m2: number
  costoM2: number
  pem: number
  hasPem: boolean
  servicios: PropuestaVMServicio[]
  total: number
  totalIva: number
  notas: string | null
}

export interface PropuestaRowLike {
  numero: string
  titulo: string | null
  fecha_propuesta: string | null
  notas: string | null
  servicios: string[] | null
  m2_diseno: number | null
  costo_m2_objetivo: number | null
  porcentaje_pem: number | null
  pct_junior: number | null
  pct_senior: number | null
  pct_partner: number | null
  semanas: Record<string, string> | null
  honorarios_override: Record<string, number> | null
}

function sortServicios(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ia = SERVICIO_IDS.indexOf(a as ServicioId)
    const ib = SERVICIO_IDS.indexOf(b as ServicioId)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

export function buildPropuestaVM(
  p: PropuestaRowLike,
  serviciosPlantilla: ServicioEntry[],
  ratios: { label: string; servicio: ServicioId | null; ratio: number }[],
): PropuestaVM {
  const m2      = p.m2_diseno ?? 0
  const costoM2 = p.costo_m2_objetivo ?? 0
  const sorted  = sortServicios(p.servicios ?? [])
  const baseServicios = sorted.filter(sid => sid in SERVICIOS_CONFIG) as ServicioId[]

  const { pem, breakdown: autoBreakdown } = calcPropuesta({
    m2,
    costoM2,
    porcentajePem: p.porcentaje_pem ?? 10,
    servicios:     baseServicios,
    pctJunior:     p.pct_junior ?? 0,
    pctSenior:     p.pct_senior ?? 70,
    pctPartner:    p.pct_partner ?? 30,
    ratios,
  })

  const breakdown: Record<string, number> = { ...autoBreakdown }
  for (const [sid, amount] of Object.entries(p.honorarios_override ?? {})) {
    breakdown[sid] = amount
  }
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0)

  const servicios: PropuestaVMServicio[] = sorted.map(sid => {
    const entry = serviciosPlantilla.find(e => e.id === sid)
    const cfg   = SERVICIOS_CONFIG[sid as ServicioId]
    const importe = breakdown[sid] ?? 0
    const pago = (entry?.pago ?? (cfg?.pago as unknown as { label: string; pct: number }[]) ?? [])
      .map(pg => ({ label: pg.label, pct: pg.pct, importe: importe * pg.pct / 100 }))
    return {
      id: sid,
      label:       entry?.label   ?? cfg?.label ?? sid,
      texto:       entry?.texto   ?? cfg?.texto ?? '',
      entregables: entry?.entregables ?? (cfg?.entregables as unknown as { grupo: string; items: string[] }[]) ?? [],
      semanas:     (p.semanas?.[sid]) ?? entry?.semanas_default ?? cfg?.semanas_default ?? '',
      pago,
      importe,
    }
  })

  return {
    numero: p.numero,
    titulo: p.titulo,
    fecha:  p.fecha_propuesta,
    m2,
    costoM2,
    pem,
    hasPem: baseServicios.some(sid => SERVICIOS_CONFIG[sid].tipo === 'pem'),
    servicios,
    total,
    totalIva: total * 1.21,
    notas: p.notas,
  }
}

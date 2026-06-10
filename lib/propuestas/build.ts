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

// ── Fuente ÚNICA de los ratios para calcPropuesta ────────────────────────────
// El editor, el portal del cliente y el PDF DEBEN derivar sus ratios de aquí para
// que los importes coincidan. La fase de "Gestión de interiorismo" se imputa al
// servicio `gestion_interiorismo`; el resto de fases de Interiorismo, a `interiorismo`.
// (Antes el portal y el PDF metían todas las fases en `interiorismo`, descuadrando
// montos por servicio y el total cuando se ofertaba interiorismo sin gestión.)
export function mapInteriorismoRatios(
  rows: { label: string | null; seccion: string | null; ratio: number | null }[],
): { label: string; servicio: ServicioId; ratio: number }[] {
  return rows
    .filter(r => (r.seccion ?? '').toLowerCase().includes('interiorismo'))
    .map(r => ({
      label:    r.label ?? '',
      servicio: ((r.label ?? '').toLowerCase().includes('gesti')
        ? 'gestion_interiorismo'
        : 'interiorismo') as ServicioId,
      ratio:    r.ratio ?? 0,
    }))
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
  // Solo cuentan los servicios ofertados: un override "huérfano" de un servicio
  // deseleccionado no debe inflar el total (igual que el editor, que suma sobre
  // los servicios seleccionados).
  const total = sorted.reduce((s, sid) => s + (breakdown[sid] ?? 0), 0)

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

// Métricas de una sala a partir de sesiones, vistas y eventos. Puro: lo usan
// el panel (cliente) y el CSV (servidor).

import type { DatosSala, EventoRow, LeadRow, SesionRow, VistaRow } from './panel'

export const VIVO_MS = 2 * 60_000   // «viendo ahora» si la sesión latió hace < 2 min

export interface SlideCalor {
  slide: number
  etiqueta: string
  sesiones: number      // sesiones que llegaron a verla
  alcance: number       // 0..1 sobre el total de sesiones con diapositivas
  msTotal: number
  msMedio: number       // por sesión que la vio
}

/** Mapa de calor: alcance y tiempo medio por diapositiva. */
export function calor(sesiones: SesionRow[], vistas: VistaRow[], etiquetas: string[] = []): SlideCalor[] {
  const validas = new Set(sesiones.filter((s) => s.totalSlides > 0).map((s) => s.id))
  const total = Math.max(1, validas.size)
  const porSlide = new Map<number, { etiqueta: string; ses: Set<string>; ms: number }>()
  for (const v of vistas) {
    if (!validas.has(v.sesionId)) continue
    const c = porSlide.get(v.slide) ?? { etiqueta: '', ses: new Set<string>(), ms: 0 }
    if (v.etiqueta) c.etiqueta = v.etiqueta
    c.ses.add(v.sesionId)
    c.ms += v.ms
    porSlide.set(v.slide, c)
  }
  // Alcance real: una sesión que llegó a la 8 pasó por las anteriores aunque no
  // se parara (al saltar desde el índice, por ejemplo).
  const llegaron = (i: number) => sesiones.filter((s) => validas.has(s.id) && s.maxSlide >= i).length
  const n = Math.max(etiquetas.length, ...sesiones.map((s) => s.totalSlides))
  return Array.from({ length: n }, (_, i) => {
    const c = porSlide.get(i)
    const vistas = c?.ses.size ?? 0
    return {
      slide: i,
      etiqueta: c?.etiqueta || etiquetas[i] || `Diapositiva ${i + 1}`,
      sesiones: vistas,
      alcance: Math.max(vistas, llegaron(i)) / total,
      msTotal: c?.ms ?? 0,
      msMedio: vistas ? (c!.ms / vistas) : 0,
    }
  })
}

export interface ResumenLead {
  lead: LeadRow
  visitas: number
  dias: number
  ultima: string | null
  activoMs: number
  mejor: number          // 0..1 la diapositiva más lejana alcanzada
  final: boolean
  lugares: string[]
  dispositivos: string[]
  viendoAhora: boolean
  interes: boolean       // pulsó «Me interesa» o dejó sus datos
  temperatura: Temperatura
  reenvio: Reenvio
}

// ── Temperatura del lead ────────────────────────────────────────────────────
// Puntuación 0–100 con señales que un comercial reconocería: lo reciente de la
// última visita, cuántas veces y en cuántos días distintos vuelve, cuánto
// tiempo de verdad pasa dentro, hasta dónde llega y si ha pedido que le llamen.

export type NivelTemperatura = 'sin_abrir' | 'frio' | 'tibio' | 'caliente'
export interface Temperatura { nivel: NivelTemperatura; puntos: number; motivos: string[] }

export const NOMBRE_TEMPERATURA: Record<NivelTemperatura, string> = {
  sin_abrir: 'Sin abrir', frio: 'Frío', tibio: 'Tibio', caliente: 'Caliente',
}

export function temperatura(x: { visitas: number; dias: number; ultima: string | null; activoMs: number; mejor: number; final: boolean; interes: boolean }, ahora = Date.now()): Temperatura {
  if (!x.visitas) return { nivel: 'sin_abrir', puntos: 0, motivos: ['Aún no ha abierto el dossier con su PIN'] }
  const motivos: string[] = []
  let p = 0
  const dias = x.ultima ? (ahora - Date.parse(x.ultima)) / 864e5 : 99
  if (dias < 1) { p += 25; motivos.push('Visita en las últimas 24 h') }
  else if (dias < 3) { p += 18; motivos.push('Visita en los últimos 3 días') }
  else if (dias < 7) { p += 10; motivos.push('Visita esta semana') }
  else if (dias < 14) p += 4
  p += Math.min(x.visitas, 5) * 4
  if (x.visitas >= 3) motivos.push(`${x.visitas} visitas`)
  if (x.dias >= 3) { p += 15; motivos.push(`Ha vuelto en ${x.dias} días distintos`) }
  else if (x.dias === 2) { p += 10; motivos.push('Ha vuelto otro día') }
  const min = x.activoMs / 60_000
  p += Math.min(min, 10) * 1.5
  if (min >= 5) motivos.push(`${Math.round(min)} min de lectura activa`)
  p += x.mejor * 10
  if (x.final) { p += 5; motivos.push('Llegó al final') }
  if (x.interes) { p += 25; motivos.push('Pidió que le contactemos') }
  const puntos = Math.round(Math.min(100, p))
  return { nivel: puntos >= 60 ? 'caliente' : puntos >= 30 ? 'tibio' : 'frio', puntos, motivos }
}

// ── PIN reenviado ───────────────────────────────────────────────────────────
// El mismo PIN desde sitios o equipos distintos: lo más probable es que lo
// haya compartido (con su pareja, un socio, un asesor). Es una señal comercial,
// no un problema: hay más gente mirando el piso.

export interface Reenvio { probable: boolean; motivo: string | null }

export function reenvio(ss: Pick<SesionRow, 'ciudad' | 'pais' | 'dispositivo' | 'ipTrunc' | 'inicio'>[], ahora = Date.now()): Reenvio {
  const recientes = ss.filter((s) => ahora - Date.parse(s.inicio) < 30 * 864e5)
  const ciudades = new Set(recientes.map((s) => [s.ciudad, s.pais].filter(Boolean).join(', ')).filter(Boolean))
  const equipos = new Set(recientes.map((s) => s.dispositivo).filter(Boolean))
  const redes = new Set(recientes.map((s) => s.ipTrunc).filter(Boolean))
  if (ciudades.size >= 2 && equipos.size >= 2) {
    return { probable: true, motivo: `Abierto desde ${ciudades.size} ciudades (${Array.from(ciudades).slice(0, 3).join(' · ')}) y ${equipos.size} dispositivos distintos` }
  }
  if (redes.size >= 3 && equipos.size >= 2) {
    return { probable: true, motivo: `Abierto desde ${redes.size} conexiones y ${equipos.size} dispositivos distintos` }
  }
  return { probable: false, motivo: null }
}

export const lugarDe = (s: Pick<SesionRow, 'ciudad' | 'pais'>) => [s.ciudad, s.pais].filter(Boolean).join(', ')

export function resumenLeads(d: DatosSala, ahora = Date.now()): ResumenLead[] {
  const porLead = new Map<string, SesionRow[]>()
  for (const s of d.sesiones) if (s.leadId) porLead.set(s.leadId, [...(porLead.get(s.leadId) ?? []), s])
  const conInteres = new Set(d.eventos.filter((e) => e.tipo === 'interes').map((e) => e.sesionId))
  return d.leads.map((lead) => {
    const ss = porLead.get(lead.id) ?? []
    const base = {
      lead,
      visitas: ss.length,
      dias: new Set(ss.map((s) => s.inicio.slice(0, 10))).size,
      ultima: ss.length ? ss.reduce((a, s) => (s.ultima > a ? s.ultima : a), ss[0].ultima) : null,
      activoMs: ss.reduce((a, s) => a + s.activoMs, 0),
      mejor: Math.max(0, ...ss.map((s) => (s.totalSlides ? (s.maxSlide + 1) / s.totalSlides : 0))),
      final: ss.some((s) => s.final),
      lugares: Array.from(new Set(ss.map(lugarDe).filter(Boolean))),
      dispositivos: Array.from(new Set(ss.map((s) => s.dispositivo || '').filter(Boolean))),
      viendoAhora: ss.some((s) => ahora - Date.parse(s.ultima) < VIVO_MS),
      interes: !!lead.leadCaptacionId || ss.some((s) => conInteres.has(s.id)),
    }
    return { ...base, temperatura: temperatura(base, ahora), reenvio: reenvio(ss, ahora) }
  })
}

export interface Kpis {
  leads: number
  leadsActivos: number     // con al menos una visita
  sesiones: number
  anonimas: number
  tiempoMedioMs: number    // por sesión
  alFinal: number          // 0..1 de las sesiones
  viendoAhora: number
}

export function kpis(d: DatosSala, ahora = Date.now()): Kpis {
  const ses = d.sesiones.filter((s) => s.totalSlides > 0)
  const conVisita = new Set(ses.map((s) => s.leadId).filter(Boolean))
  return {
    leads: d.leads.length,
    leadsActivos: conVisita.size,
    sesiones: ses.length,
    anonimas: ses.filter((s) => !s.leadId).length,
    tiempoMedioMs: ses.length ? ses.reduce((a, s) => a + s.activoMs, 0) / ses.length : 0,
    alFinal: ses.length ? ses.filter((s) => s.final).length / ses.length : 0,
    viendoAhora: ses.filter((s) => ahora - Date.parse(s.ultima) < VIVO_MS).length,
  }
}

export const NOMBRE_EVENTO: Record<string, string> = {
  video: 'Reprodujo un vídeo',
  idioma: 'Cambió de idioma',
  interes: 'Pulsó «Me interesa»',
  final: 'Llegó al final',
  '3d': 'Exploró una maqueta 3D',
  enlace: 'Abrió un enlace',
}

export function eventosDe(eventos: EventoRow[], sesionId: string) {
  return eventos.filter((e) => e.sesionId === sesionId && e.tipo !== 'final' && !e.tipo.startsWith('aviso_'))
}

export const duracion = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60), r = s % 60
  return m < 60 ? `${m} min${r ? ` ${r} s` : ''}` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function hace(iso: string | null, ahora = Date.now()) {
  if (!iso) return 'Nunca'
  const m = Math.round((ahora - Date.parse(iso)) / 60_000)
  if (m < 2) return 'Ahora'
  if (m < 60) return `Hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `Hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'Ayer' : `Hace ${d} días`
}

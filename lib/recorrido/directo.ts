// Canal del directo (navegador). El guía emite cada cambio por Supabase
// Realtime (broadcast: instantáneo, sin tocar tablas) y además lo guarda en
// rc_visitas; los móviles escuchan el canal y, por si el wifi del piso falla o
// el canal se cae, preguntan cada pocos segundos a /api/recorrido/directo.

import { createClient } from '@/lib/supabase/client'
import type { RcEstado } from './domain'

type Canal = ReturnType<ReturnType<typeof createClient>['channel']>

export function abrirCanal(visitaId: string, onEstado?: (e: RcEstado) => void): { enviar: (e: RcEstado) => void; cerrar: () => void } {
  const supabase = createClient()
  const canal: Canal = supabase.channel(`rc-visita-${visitaId}`, { config: { broadcast: { self: false } } })
  if (onEstado) canal.on('broadcast', { event: 'estado' }, ({ payload }) => onEstado(payload as RcEstado))
  canal.subscribe()
  return {
    enviar(e) { canal.send({ type: 'broadcast', event: 'estado', payload: e }) },
    cerrar() { supabase.removeChannel(canal) },
  }
}

export interface VisitaPublica {
  id: string
  slot: string | null
  guia: string
  modo: RcEstado['modo']
  paso: number
  detalle_id: string | null
  at: number
  terminada: boolean
}

export async function pedirVisitas(): Promise<VisitaPublica[]> {
  const r = await fetch('/api/recorrido/directo', { cache: 'no-store' })
  if (!r.ok) return []
  return ((await r.json()).visitas ?? []) as VisitaPublica[]
}

export async function pedirVisita(id: string): Promise<VisitaPublica | null> {
  const r = await fetch(`/api/recorrido/directo?visita=${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (!r.ok) return null
  return ((await r.json()).visita ?? null) as VisitaPublica | null
}

export function avisar(token: string, tipo: 'presencia' | 'vista', extra: { detalle_id?: string; visita_id?: string | null } = {}) {
  if (!token) return
  const body = JSON.stringify({ token, tipo, ...extra })
  try {
    // keepalive: que la marca llegue aunque el invitado cierre la pestaña.
    fetch('/api/recorrido/directo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch { /* sin red */ }
}

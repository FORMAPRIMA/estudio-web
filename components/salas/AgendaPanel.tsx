'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { guardarAgendaMiembro } from '@/app/actions/salas'
import type { Agenda } from '@/lib/para/agenda'
import { cuandoMadrid } from './Prospeccion'
import { Etiqueta } from './SalaPanel'
import { S, btn, card, eyebrow } from './theme'

export interface ReunionAgenda {
  id: string; slug: string; leadId: string; empresa: string; contacto: string; con: string | null
  inicio: string | null; minutos: number; estado: string; email: string | null; nota: string | null; zonaLead: string | null
}

// Candidatas: de 8:00 a 20:30 cada media hora (en la zona elegida).
const CANDIDATAS = Array.from({ length: 26 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const ZONAS = [['Europe/Madrid', 'Madrid'], ['America/Mexico_City', 'Ciudad de México'], ['America/New_York', 'Miami · Nueva York'], ['America/Guayaquil', 'Guayaquil']] as const
// Cómo ve cada franja alguien de América (para elegir con cabeza).
const verEn = (hora: string, zona: string, destino: string) => {
  const hoy = new Date().toISOString().slice(0, 10)
  const ingenuo = Date.parse(`${hoy}T${hora}:00Z`)
  const off = (z: string) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ingenuo)).map((x) => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ingenuo }
  return new Intl.DateTimeFormat('es-ES', { timeZone: destino, hour: '2-digit', minute: '2-digit' }).format(new Date(ingenuo - off(zona)))
}

export default function AgendaPanel({ agenda, reuniones, verTodas }: { agenda: Agenda; reuniones: ReunionAgenda[]; verTodas: boolean }) {
  const router = useRouter()
  const [a, setA] = useState<Agenda>(agenda)
  const [estado, setEstado] = useState<'' | 'guardando' | 'ok' | string>('')
  const cambiado = JSON.stringify(a) !== JSON.stringify(agenda)
  const guardar = async () => {
    setEstado('guardando')
    const r = await guardarAgendaMiembro(a)
    if (!r.ok) { setEstado(r.error); return }
    setEstado('ok'); router.refresh()
  }
  const alterna = (h: string) => setA({ ...a, franjas: a.franjas.includes(h) ? a.franjas.filter((x) => x !== h) : [...a.franjas, h].sort() })

  return (
    <>
      <p style={eyebrow}>Agenda</p>
      <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Llamadas del dossier</h1>
      <p style={{ fontSize: 13, color: S.soft, margin: '0 0 24px', maxWidth: 640, lineHeight: 1.5 }}>
        Tus enlaces de prospección ofrecen estas franjas en los días laborables 6 a 10 contados desde el día en que el lead mira el dossier (sin fines de semana ni festivos de Madrid). Cada visitante las ve en su hora y solo las que le caen entre las 8:00 y las 20:00.
      </p>

      <section style={{ ...card, padding: '18px 20px', marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 14px' }}>Mis franjas</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: S.soft }}>Zona</span>
          {ZONAS.map(([z, n]) => <button key={z} onClick={() => setA({ ...a, zona: z })} style={{ ...btn(a.zona === z ? 'primary' : 'ghost'), padding: '7px 12px' }}>{n}</button>)}
          <span style={{ fontSize: 12, color: S.soft, marginLeft: 12 }}>Duración</span>
          {[20, 30, 45, 60].map((n) => <button key={n} onClick={() => setA({ ...a, minutos: n })} style={{ ...btn(a.minutos === n ? 'primary' : 'ghost'), padding: '7px 12px' }}>{n} min</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8 }}>
          {CANDIDATAS.map((h) => {
            const on = a.franjas.includes(h)
            return (
              <button key={h} onClick={() => alterna(h)} title={`Ciudad de México ${verEn(h, a.zona, 'America/Mexico_City')} · Miami ${verEn(h, a.zona, 'America/New_York')}`}
                style={{ ...btn(on ? 'primary' : 'ghost'), padding: '9px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{h}</span>
                <span style={{ fontSize: 10.5, opacity: 0.65, fontWeight: 400 }}>CDMX {verEn(h, a.zona, 'America/Mexico_City')}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button disabled={!cambiado || estado === 'guardando'} onClick={guardar} style={{ ...btn(), opacity: cambiado ? 1 : 0.5 }}>{estado === 'guardando' ? 'Guardando…' : 'Guardar franjas'}</button>
          <span style={{ fontSize: 12.5, color: estado && estado !== 'ok' && estado !== 'guardando' ? S.red : S.soft }}>
            {estado === 'ok' ? 'Guardado: se aplica a todos tus enlaces al instante.' : estado !== 'guardando' ? estado : ''}
          </span>
        </div>
        <p style={{ fontSize: 12, color: S.faint, margin: '12px 0 0' }}>Consejo: con leads en América, deja franjas de tarde en Madrid (16:00 en Madrid son las 9:00 en Ciudad de México).</p>
      </section>

      <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 10px' }}>Próximas llamadas{verTodas ? ' · todo el equipo' : ''}</h2>
      <div style={{ ...card, padding: 0 }}>
        {reuniones.map((r, i) => (
          <Link key={r.id} href={`/${r.slug}/lead/${r.leadId}`} className="salas-fila" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '14px 18px', borderTop: i ? `1px solid ${S.lineSoft}` : 0, textDecoration: 'none', color: S.ink }}>
            <span style={{ minWidth: 240, fontSize: 14, textTransform: 'capitalize', fontWeight: 500 }}>{r.inicio ? cuandoMadrid(r.inicio) : 'Otra fecha · por cerrar'}</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{r.empresa}<span style={{ color: S.faint }}> · {r.contacto}{verTodas && r.con ? ` · con ${r.con}` : ''}</span></span>
            {r.estado === 'confirmada' ? <Etiqueta tono="vivo">confirmada</Etiqueta> : r.inicio ? <Etiqueta tono="acento">por confirmar</Etiqueta> : <Etiqueta>propone fecha</Etiqueta>}
          </Link>
        ))}
        {!reuniones.length && <p style={{ padding: '16px 18px', margin: 0, fontSize: 13, color: S.soft }}>Todavía no hay llamadas reservadas.</p>}
      </div>
    </>
  )
}

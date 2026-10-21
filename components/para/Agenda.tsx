'use client'

// Agenda viva del cierre. Los días se calculan con la fecha de HOY (la del que
// mira), así que el dossier nunca ofrece fechas pasadas: se saltan los 5 días
// laborables siguientes y se ofrecen los días 6 a 10. Las horas, en la zona de
// quien mira; solo las que le caen entre las 8:00 y las 20:00.

import { useEffect, useMemo, useState } from 'react'
import { reservarReunionPara } from '@/app/actions/para'
import { diasOfrecidos, horaRazonable, huecos, type Agenda as AgendaT } from '@/lib/para/agenda'
import type { Idioma, LeadPara, Textos } from '@/lib/para/textos'
import type { AlEvento } from './Pantallas'

export interface EstadoAgendaCliente {
  agenda: AgendaT
  ocupadas: string[]
  reunion: { inicio: string | null; minutos: number; estado: string } | null
}

const CIUDADES: Record<string, [string, string]> = {
  'America/Mexico_City': ['Ciudad de México', 'Mexico City'], 'America/New_York': ['Nueva York · Miami', 'New York · Miami'],
  'Europe/Madrid': ['Madrid', 'Madrid'], 'America/Guayaquil': ['Guayaquil', 'Guayaquil'], 'America/Bogota': ['Bogotá', 'Bogotá'],
  'America/Monterrey': ['Monterrey', 'Monterrey'], 'Europe/Lisbon': ['Lisboa', 'Lisbon'], 'Atlantic/Canary': ['Canarias', 'Canary Islands'],
}
const ciudad = (zona: string, en: boolean) => CIUDADES[zona]?.[en ? 1 : 0] ?? zona.split('/').pop()!.replace(/_/g, ' ')

export default function Agenda({ t, idioma, lead, estado, token, alEvento }: {
  t: Textos; idioma: Idioma; lead: LeadPara; estado: EstadoAgendaCliente; token: string | null; alEvento: AlEvento
}) {
  const loc = idioma === 'en' ? 'en-US' : 'es-ES'
  const [zona, setZona] = useState<string | null>(null)
  const [ahora, setAhora] = useState<Date | null>(null)
  useEffect(() => { setZona(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'); setAhora(new Date()) }, [])

  const [dia, setDia] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [otra, setOtra] = useState(false)
  const [email, setEmail] = useState('')
  const [nota, setNota] = useState('')
  const [isEnviando, setIsEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState<{ inicio: string | null } | null>(estado.reunion && estado.reunion.estado !== 'cancelada' ? { inicio: estado.reunion.inicio } : null)

  // Días ofrecidos HOY con sus huecos en la hora de quien mira.
  const porDia = useMemo(() => {
    if (!ahora || !zona) return []
    const hs = huecos(ahora, estado.agenda, estado.ocupadas).filter((h) => horaRazonable(h.inicio, zona) && Date.parse(h.inicio) > ahora.getTime())
    return diasOfrecidos(ahora, estado.agenda.zona)
      .map((f) => ({ fecha: f, huecos: hs.filter((h) => h.fecha === f) }))
      .filter((d) => d.huecos.length)
  }, [ahora, zona, estado])
  useEffect(() => { if (!dia && porDia.length) setDia(porDia[0].fecha) }, [porDia, dia])

  const fDia = (f: string) => new Intl.DateTimeFormat(loc, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${f}T12:00:00Z`))
  const fHora = (iso: string) => new Intl.DateTimeFormat(loc, { timeZone: zona ?? 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const fLargo = (iso: string) => new Intl.DateTimeFormat(loc, { timeZone: zona ?? 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const quien = lead.contacto.nombre.split(' ')[0]

  const enviar = async (inicio: string | null) => {
    if (!token) { setError(t.agendaMuestra); return }
    setError(''); setIsEnviando(true)
    const r = await reservarReunionPara(token, { inicio, email, nota, zona: zona ?? undefined })
    setIsEnviando(false)
    if (!r.ok) { setError(r.error); return }
    // la reserva ya avisa al equipo con su propio correo: no se manda también «Me interesa»
    alEvento('agenda', inicio ?? 'otra')
    setHecho({ inicio: r.inicio })
  }

  if (hecho) {
    return (
      <div className="p-agenda p-agenda-hecho">
        <p className="p-agenda-ok">{hecho.inicio ? t.agendaHecho : t.agendaPropuesta}</p>
        {hecho.inicio && <p className="p-agenda-cuando">{fLargo(hecho.inicio)}</p>}
        <p className="p-agenda-sub">{hecho.inicio ? t.agendaHechoTexto(quien) : t.agendaPropuestaTexto(quien)}</p>
        <div className="p-agenda-acciones">
          {hecho.inicio && token && <a className="p-boton" href={`/para/${token}/reunion.ics`}>{t.agendaCalendario}</a>}
          <button type="button" className="p-agenda-enlace" onClick={() => { setHecho(null); setSel(null); setOtra(false) }}>{t.agendaCambiar}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-agenda">
      <div className="p-agenda-cab">
        <p className="p-agenda-titulo">{t.agendaTitulo}</p>
        {zona && <p className="p-agenda-zona">{t.agendaZona(ciudad(zona, idioma === 'en'))} · {t.agendaMin(estado.agenda.minutos)}</p>}
      </div>

      {otra ? (
        <div className="p-agenda-form">
          <label><span>{t.agendaOtra}</span><textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
          <label><span>{t.agendaEmail}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.agendaEmailPh} /></label>
          {error && <p className="p-agenda-error" role="alert">{error}</p>}
          <div className="p-agenda-acciones">
            <button type="button" className="p-boton" disabled={isEnviando || !nota.trim()} onClick={() => enviar(null)}>{isEnviando ? t.agendaReservando : t.agendaEnviar}</button>
            <button type="button" className="p-agenda-enlace" onClick={() => { setOtra(false); setError('') }}>{t.agendaVolver}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="p-agenda-dias" role="tablist">
            {(porDia.length ? porDia : Array.from({ length: 5 }, (_, i) => ({ fecha: `x${i}`, huecos: [] }))).map((d) => (
              <button key={d.fecha} type="button" role="tab" aria-selected={dia === d.fecha} className={dia === d.fecha ? 'on' : ''}
                disabled={!porDia.length} onClick={() => { setDia(d.fecha); setSel(null) }}>
                {d.fecha.startsWith('x') ? ' ' : fDia(d.fecha)}
              </button>
            ))}
          </div>
          <div className="p-agenda-horas">
            {porDia.find((d) => d.fecha === dia)?.huecos.map((h) => (
              <button key={h.inicio} type="button" className={sel === h.inicio ? 'on' : ''} onClick={() => setSel(h.inicio)}>{fHora(h.inicio)}</button>
            ))}
          </div>
          {sel ? (
            <div className="p-agenda-form">
              <p className="p-agenda-cuando">{fLargo(sel)}</p>
              <label><span>{t.agendaEmail}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.agendaEmailPh} /></label>
              <label><span>{t.agendaNota}</span><input value={nota} onChange={(e) => setNota(e.target.value)} /></label>
              {error && <p className="p-agenda-error" role="alert">{error}</p>}
              <div className="p-agenda-acciones">
                <button type="button" className="p-boton" disabled={isEnviando} onClick={() => enviar(sel)}>{isEnviando ? t.agendaReservando : t.agendaReservar}</button>
                <button type="button" className="p-agenda-enlace" onClick={() => setOtra(true)}>{t.agendaNinguna}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="p-agenda-enlace" onClick={() => setOtra(true)}>{t.agendaNinguna}</button>
          )}
        </>
      )}
    </div>
  )
}

export const CSS_AGENDA = `
.p-agenda{display:flex;flex-direction:column;gap:16px;padding-top:26px;border-top:1px solid rgba(251,251,250,.14);}
.p-agenda-titulo{font-size:clamp(18px,1rem + .4vw,22px);font-weight:300;}
.p-agenda-zona{font-size:12.5px;color:rgba(251,251,250,.55);margin-top:4px!important;}
.p-agenda-dias{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 calc(var(--p-gutter) * -1);padding:0 var(--p-gutter);}
.p-agenda-dias::-webkit-scrollbar{display:none;}
.p-agenda-dias button,.p-agenda-horas button{flex:none;min-height:46px;padding:0 16px;border:1px solid rgba(251,251,250,.22);background:transparent;color:var(--p-blanco);
  font-size:14px;text-transform:capitalize;transition:background .25s,color .25s,border-color .25s;}
.p-agenda-dias button:hover,.p-agenda-horas button:hover{border-color:rgba(251,251,250,.5);}
.p-agenda-dias button.on,.p-agenda-horas button.on{background:var(--p-blanco);color:var(--p-negro);border-color:var(--p-blanco);}
.p-agenda-horas{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;min-height:46px;}
.p-agenda-horas button{font-variant-numeric:tabular-nums;}
.p-agenda-form{display:flex;flex-direction:column;gap:12px;animation:p-sube .5s var(--p-curva);}
.p-agenda-form label{display:flex;flex-direction:column;gap:6px;}
.p-agenda-form label span{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(251,251,250,.55);font-weight:500;}
.p-agenda-form input,.p-agenda-form textarea{font:inherit;font-size:16px;color:var(--p-blanco);background:rgba(251,251,250,.06);border:1px solid rgba(251,251,250,.18);
  padding:12px 14px;border-radius:0;outline:none;resize:vertical;}
.p-agenda-form input:focus,.p-agenda-form textarea:focus{border-color:var(--p-salvia);}
.p-agenda-cuando{font-size:clamp(18px,1rem + .5vw,24px);font-weight:300;color:var(--p-blanco);}
.p-agenda-cuando::first-letter{text-transform:uppercase;}
.p-agenda-acciones{display:flex;flex-wrap:wrap;gap:14px 20px;align-items:center;}
.p-agenda-enlace{background:none;border:0;padding:6px 0;color:var(--p-salvia);font-size:13px;text-decoration:underline;text-underline-offset:4px;align-self:flex-start;}
.p-agenda-error{font-size:13px;color:#e8a598;}
.p-agenda-hecho .p-agenda-ok{font-size:clamp(24px,1.2rem + 1vw,34px);font-weight:200;}
.p-agenda-sub{font-size:14px;color:rgba(251,251,250,.66);}
.p-boton:disabled{opacity:.5;}
@keyframes p-sube{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
`

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { DatosSala } from '@/lib/salas/panel'
import { NOMBRE_EVENTO, NOMBRE_TEMPERATURA, calor, duracion, eventosDe, fecha, hace, kpis, lugarDe, resumenLeads, type ResumenLead, type Temperatura } from '@/lib/salas/metricas'
import Calor from './Calor'
import { LeadForm, PinListo, enlacePersonal } from './LeadForm'
import { S, btn, card, eyebrow, input } from './theme'

type Tab = 'leads' | 'calor' | 'actividad'

export default function SalaPanel({ slug, nombre, proyecto, accesoAnonimo, datos, etiquetas }: {
  etiquetas: string[]
  slug: string
  nombre: string
  proyecto: string
  accesoAnonimo: boolean
  datos: DatosSala
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('leads')
  const [nuevo, setNuevo] = useState(false)
  const [listo, setListo] = useState<{ nombre: string; pin: string } | null>(null)
  const [busca, setBusca] = useState('')
  const [ahora, setAhora] = useState(() => Date.now())

  // «Viendo ahora» y las cifras se refrescan solas cada 30 s.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') { router.refresh(); setAhora(Date.now()) } }, 30_000)
    return () => clearInterval(t)
  }, [router])

  const k = useMemo(() => kpis(datos, ahora), [datos, ahora])
  const leads = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return resumenLeads(datos, ahora)
      .filter((r) => !q || [r.lead.nombre, r.lead.empresa, r.lead.canal, r.lead.pin].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.viendoAhora) - Number(a.viendoAhora) || b.temperatura.puntos - a.temperatura.puntos || (b.ultima ?? b.lead.createdAt).localeCompare(a.ultima ?? a.lead.createdAt))
  }, [datos, ahora, busca])
  const calientes = useMemo(() => resumenLeads(datos, ahora).filter((r) => r.temperatura.nivel === 'caliente' && r.lead.estado === 'activo').length, [datos, ahora])
  const mapa = useMemo(() => calor(datos.sesiones, datos.vistas, etiquetas), [datos, etiquetas])
  const nombres = useMemo(() => new Map(datos.leads.map((l) => [l.id, l.nombre])), [datos])

  return (
    <>
      <Link href="/" style={{ fontSize: 12, color: S.soft, textDecoration: 'none' }}>← Dossiers</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', margin: '14px 0 24px' }}>
        <div>
          <p style={eyebrow}>Dossier</p>
          <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 0' }}>{nombre}</h1>
          <p style={{ fontSize: 12, color: S.soft, margin: '6px 0 0' }}>
            {accesoAnonimo ? 'Enlace general abierto: las visitas sin PIN cuentan como anónimas.' : 'Solo se entra con PIN personal.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={`https://formaprima.es/propuesta/${slug}`} target="_blank" rel="noopener" style={{ ...btn('ghost'), textDecoration: 'none' }}>Ver dossier ↗</a>
          <a href={`/${slug}/csv`} style={{ ...btn('ghost'), textDecoration: 'none' }}>Exportar CSV</a>
          <button onClick={() => setNuevo(true)} style={btn()}>+ Nuevo lead</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Kpi titulo="Viendo ahora" valor={String(k.viendoAhora)} pie={k.viendoAhora ? 'en este momento' : 'nadie ahora mismo'} vivo={k.viendoAhora > 0} />
        <Kpi titulo="Leads" valor={String(k.leads)} pie={`${k.leadsActivos} ya lo han abierto`} />
        <Kpi titulo="Calientes" valor={String(calientes)} pie="leads con más señales de interés" />
        <Kpi titulo="Visitas" valor={String(k.sesiones)} pie={`${k.anonimas} anónimas`} />
        <Kpi titulo="Tiempo medio" valor={k.sesiones ? duracion(k.tiempoMedioMs) : '—'} pie="por visita, solo tiempo activo" />
        <Kpi titulo="Llegan al final" valor={k.sesiones ? `${Math.round(k.alFinal * 100)} %` : '—'} pie="de las visitas" />
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${S.line}`, marginBottom: 20 }}>
        {([['leads', `Leads (${datos.leads.length})`], ['calor', 'Mapa de calor'], ['actividad', 'Actividad']] as [Tab, string][]).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{
            fontFamily: 'inherit', fontSize: 13, padding: '10px 14px', background: 'none', border: 0, cursor: 'pointer', marginBottom: -1,
            borderBottom: `2px solid ${tab === id ? S.ink : 'transparent'}`, color: tab === id ? S.ink : S.soft, fontWeight: tab === id ? 500 : 400,
          }}>{l}</button>
        ))}
      </div>

      {tab === 'leads' && (
        datos.leads.length === 0 ? (
          <div style={{ ...card, padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 300, margin: '0 0 6px' }}>Todavía no hay leads en esta sala.</p>
            <p style={{ fontSize: 13, color: S.soft, margin: '0 0 20px' }}>Crea uno: te damos su PIN y los mensajes listos para enviárselo.</p>
            <button onClick={() => setNuevo(true)} style={btn()}>+ Crear el primero</button>
          </div>
        ) : (
          <>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre, empresa, canal o PIN" aria-label="Buscar" style={{ ...input, maxWidth: 360, marginBottom: 12, background: S.panel }} />
            <div style={{ ...card, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 940 }}>
                <thead>
                  <tr style={{ color: S.soft, fontSize: 11, textAlign: 'left' }}>
                    <Th>Lead</Th><Th>Temperatura</Th><Th>Estado</Th><Th>Última visita</Th><Th right>Visitas</Th><Th right>Tiempo</Th><Th>Hasta dónde</Th><Th>Desde</Th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((r) => <FilaLead key={r.lead.id} r={r} slug={slug} />)}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {tab === 'calor' && (
        <div style={{ ...card, padding: '20px 22px' }}>
          <Calor datos={mapa} />
        </div>
      )}

      {tab === 'actividad' && (
        <div style={{ ...card, padding: 0 }}>
          {datos.sesiones.filter((s) => s.totalSlides > 0).slice(0, 80).map((s) => {
            const evs = eventosDe(datos.eventos, s.id)
            const vivo = ahora - Date.parse(s.ultima) < 120_000
            return (
              <div key={s.id} style={{ padding: '14px 20px', borderTop: `1px solid ${S.lineSoft}`, display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
                  {s.leadId
                    ? <Link href={`/${slug}/lead/${s.leadId}`} style={{ fontSize: 14, fontWeight: 500, color: S.ink }}>{nombres.get(s.leadId) ?? 'Lead'}</Link>
                    : <span style={{ fontSize: 14, color: S.soft }}>Visita anónima</span>}
                  {vivo && <Etiqueta tono="vivo">viendo ahora</Etiqueta>}
                  {s.final && <Etiqueta>llegó al final</Etiqueta>}
                  <span style={{ fontSize: 12, color: S.faint, marginLeft: 'auto' }}>{fecha(s.inicio)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: S.soft }}>
                  {[lugarDe(s), s.dispositivo, `${duracion(s.activoMs)} activo`, `hasta la ${s.maxSlide + 1} de ${s.totalSlides}`].filter(Boolean).join(' · ')}
                </div>
                {evs.length > 0 && (
                  <div style={{ fontSize: 12, color: S.soft }}>{Array.from(new Set(evs.map((e) => NOMBRE_EVENTO[e.tipo] ?? e.tipo))).join(' · ')}</div>
                )}
              </div>
            )
          })}
          {!datos.sesiones.some((s) => s.totalSlides > 0) && <p style={{ padding: 24, margin: 0, fontSize: 13, color: S.soft }}>Aún no hay visitas.</p>}
        </div>
      )}

      {nuevo && (
        <LeadForm
          slug={slug}
          onCerrar={() => setNuevo(false)}
          onHecho={(r) => { setNuevo(false); if (r.pin) setListo({ nombre: r.nombre, pin: r.pin }); router.refresh() }}
        />
      )}
      {listo && <PinListo slug={slug} proyecto={proyecto} nombre={listo.nombre} pin={listo.pin} onCerrar={() => setListo(null)} />}
      <p style={{ fontSize: 11.5, color: S.faint, marginTop: 28 }}>Enlace personal de los leads: {enlacePersonal(slug)}</p>
    </>
  )
}

function Kpi({ titulo, valor, pie, vivo }: { titulo: string; valor: string; pie: string; vivo?: boolean }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <p style={{ ...eyebrow, display: 'flex', alignItems: 'center', gap: 6 }}>
        {vivo && <span style={{ width: 7, height: 7, borderRadius: '50%', background: S.green }} />}{titulo}
      </p>
      <p style={{ fontSize: 26, fontWeight: 300, margin: '8px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
      <p style={{ fontSize: 11.5, color: S.faint, margin: 0 }}>{pie}</p>
    </div>
  )
}

export function Etiqueta({ children, tono = 'neutro' }: { children: React.ReactNode; tono?: 'neutro' | 'vivo' | 'rojo' | 'acento' }) {
  const t = {
    neutro: { background: S.lineSoft, color: S.ink },
    vivo: { background: S.greenSoft, color: S.green },
    rojo: { background: S.redSoft, color: S.red },
    acento: { background: S.accentSoft, color: S.accent },
  }[tono]
  return <span style={{ ...t, fontSize: 11, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', fontWeight: 500 }}>{children}</span>
}

/** Temperatura: el nivel escrito y una barra corta de 0 a 100. Los motivos, al pasar por encima. */
export function Termometro({ t, grande }: { t: Temperatura; grande?: boolean }) {
  const color = t.nivel === 'caliente' ? S.accent : t.nivel === 'tibio' ? '#D85A3099' : '#1A1A1A33'
  return (
    <span title={t.motivos.join(' · ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: grande ? 0 : 110 }}>
      <span style={{ width: grande ? 120 : 44, height: grande ? 8 : 6, background: S.lineSoft, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(t.puntos, t.nivel === 'sin_abrir' ? 0 : 4)}%`, background: color, borderRadius: 3 }} />
      </span>
      <span style={{ fontSize: grande ? 15 : 12.5, fontWeight: t.nivel === 'caliente' ? 600 : 400, color: t.nivel === 'sin_abrir' ? S.faint : S.ink, whiteSpace: 'nowrap' }}>
        {NOMBRE_TEMPERATURA[t.nivel]}{grande && t.nivel !== 'sin_abrir' ? ` · ${t.puntos}/100` : ''}
      </span>
    </span>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '12px 16px', fontWeight: 500, letterSpacing: '0.04em', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '12px 16px', textAlign: right ? 'right' : 'left', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}>{children}</td>
}

function FilaLead({ r, slug }: { r: ResumenLead; slug: string }) {
  const router = useRouter()
  const ir = () => router.push(`/${slug}/lead/${r.lead.id}`)
  const caducado = !!r.lead.caducaEn && Date.parse(r.lead.caducaEn) < Date.now()
  return (
    <tr className="salas-fila" tabIndex={0} onClick={ir} onKeyDown={(e) => { if (e.key === 'Enter') ir() }} style={{ borderTop: `1px solid ${S.lineSoft}`, cursor: 'pointer' }}>
      <Td>
        <div style={{ fontWeight: 500 }}>{r.lead.nombre}</div>
        <div style={{ fontSize: 11.5, color: S.faint }}>{[r.lead.empresa, r.lead.canal].filter(Boolean).join(' · ') || `PIN ${r.lead.pin}`}</div>
      </Td>
      <Td><Termometro t={r.temperatura} /></Td>
      <Td>
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
          {r.lead.estado === 'revocado' ? <Etiqueta tono="rojo">revocado</Etiqueta>
            : caducado ? <Etiqueta tono="rojo">caducado</Etiqueta>
            : r.viendoAhora ? <Etiqueta tono="vivo">viendo ahora</Etiqueta>
            : r.visitas === 0 ? <Etiqueta>sin abrir</Etiqueta> : null}
          {r.interes && <Etiqueta tono="acento">interesado</Etiqueta>}
          {r.reenvio.probable && <span title={r.reenvio.motivo ?? ''}><Etiqueta tono="acento">PIN compartido</Etiqueta></span>}
        </span>
      </Td>
      <Td>{hace(r.ultima)}</Td>
      <Td right>{r.visitas || '—'}</Td>
      <Td right>{r.activoMs ? duracion(r.activoMs) : '—'}</Td>
      <Td>
        {r.visitas ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
            <span style={{ flex: 1, height: 6, background: S.lineSoft, borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${r.mejor * 100}%`, background: S.accent, borderRadius: 3 }} />
            </span>
            <span style={{ fontSize: 11.5, color: S.soft, minWidth: 38 }}>{r.final ? 'final' : `${Math.round(r.mejor * 100)} %`}</span>
          </span>
        ) : <span style={{ color: S.faint }}>—</span>}
      </Td>
      <Td><span style={{ fontSize: 12.5, color: S.soft }}>{r.lugares.slice(0, 2).join(' · ') || '—'}{r.lugares.length > 2 ? ` +${r.lugares.length - 2}` : ''}</span></Td>
    </tr>
  )
}

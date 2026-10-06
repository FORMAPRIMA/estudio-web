'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { DatosSala } from '@/lib/salas/panel'
import { NOMBRE_EVENTO, calor, duracion, eventosDe, fecha, hace, lugarDe, resumenLeads } from '@/lib/salas/metricas'
import { estadoLeadSala, renovarPinSala } from '@/app/actions/salas'
import Calor from './Calor'
import { LeadForm, PinListo } from './LeadForm'
import { Etiqueta } from './SalaPanel'
import { S, btn, card, eyebrow } from './theme'

export default function LeadFicha({ slug, sala, proyecto, datos, etiquetas }: { slug: string; sala: string; proyecto: string; datos: DatosSala; etiquetas: string[] }) {
  const router = useRouter()
  const r = useMemo(() => resumenLeads(datos)[0], [datos])
  const mapa = useMemo(() => calor(datos.sesiones, datos.vistas, etiquetas), [datos, etiquetas])
  const [editar, setEditar] = useState(false)
  const [pinNuevo, setPinNuevo] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<'renovar' | 'revocar' | null>(null)
  const [error, setError] = useState('')
  const [isOcupado, setIsOcupado] = useState(false)
  const l = r.lead
  const caducado = !!l.caducaEn && Date.parse(l.caducaEn) < Date.now()

  const ejecutar = async (accion: 'renovar' | 'revocar' | 'reactivar') => {
    setError(''); setIsOcupado(true)
    const res = accion === 'renovar' ? await renovarPinSala(l.id) : await estadoLeadSala(l.id, accion === 'revocar' ? 'revocado' : 'activo')
    setIsOcupado(false); setConfirmar(null)
    if (!res.ok) { setError(res.error); return }
    if (accion === 'renovar') setPinNuevo((res as unknown as { pin: string }).pin)
    router.refresh()
  }

  const sesiones = datos.sesiones.filter((s) => s.totalSlides > 0)

  return (
    <>
      <Link href={`/${slug}`} style={{ fontSize: 12, color: S.soft, textDecoration: 'none' }}>← {sala}</Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', margin: '14px 0 24px' }}>
        <div>
          <p style={eyebrow}>Lead</p>
          <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 8px' }}>{l.nombre}</h1>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {l.estado === 'revocado' ? <Etiqueta tono="rojo">PIN revocado</Etiqueta> : caducado ? <Etiqueta tono="rojo">PIN caducado</Etiqueta> : <Etiqueta>PIN activo</Etiqueta>}
            {r.viendoAhora && <Etiqueta tono="vivo">viendo ahora</Etiqueta>}
            {r.interes && <Etiqueta tono="acento">interesado</Etiqueta>}
            {r.final && <Etiqueta>llegó al final</Etiqueta>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setEditar(true)} style={btn('ghost')}>Editar</button>
          <button onClick={() => setConfirmar('renovar')} style={btn('ghost')}>Nuevo PIN</button>
          {l.estado === 'activo'
            ? <button onClick={() => setConfirmar('revocar')} style={btn('danger')}>Revocar</button>
            : <button onClick={() => ejecutar('reactivar')} disabled={isOcupado} style={btn('ghost')}>Reactivar</button>}
        </div>
      </div>

      {confirmar && (
        <div style={{ ...card, padding: '14px 18px', marginBottom: 20, borderColor: confirmar === 'revocar' ? '#B03A2E55' : S.line, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, flex: '1 1 300px' }}>
            {confirmar === 'revocar'
              ? `¿Revocar el PIN de ${l.nombre}? Dejará de identificarse; si la sala es cerrada, perderá el acceso.`
              : `¿Generar un PIN nuevo para ${l.nombre}? El actual (${l.pin}) dejará de valer al momento.`}
          </span>
          <button onClick={() => setConfirmar(null)} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => ejecutar(confirmar)} disabled={isOcupado} style={confirmar === 'revocar' ? { ...btn('danger'), background: S.red, color: '#fff' } : btn()}>
            {isOcupado ? '…' : confirmar === 'revocar' ? 'Sí, revocar' : 'Sí, nuevo PIN'}
          </button>
        </div>
      )}
      {error && <p role="alert" style={{ color: S.red, fontSize: 13 }}>{error}</p>}

      <div className="salas-ficha" style={{ display: 'grid', gap: 20 }}>
        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={{ ...card, padding: '16px 18px' }}>
            <Dato k="PIN" v={<span style={{ fontSize: 20, letterSpacing: '0.16em', fontWeight: 300 }}>{l.pin}</span>} />
            <Dato k="Empresa" v={l.empresa} />
            <Dato k="Email" v={l.email && <a href={`mailto:${l.email}`} style={{ color: S.ink }}>{l.email}</a>} />
            <Dato k="Teléfono" v={l.telefono && <a href={`tel:${l.telefono}`} style={{ color: S.ink }}>{l.telefono}</a>} />
            <Dato k="Canal" v={l.canal} />
            <Dato k="Alta" v={`${fecha(l.createdAt)}${datos.miembros[l.creadoPor ?? ''] ? ` · ${datos.miembros[l.creadoPor ?? '']}` : ''}`} />
            <Dato k="Caduca" v={l.caducaEn ? fecha(l.caducaEn) : 'No caduca'} />
            {l.leadCaptacionId && <Dato k="Contacto" v="Dejó sus datos al final del dossier" />}
            {l.notas && <p style={{ fontSize: 12.5, color: S.soft, margin: '12px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l.notas}</p>}
          </div>
          <div style={{ ...card, padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Cifra v={String(r.visitas)} l="Visitas" />
            <Cifra v={String(r.dias)} l="Días distintos" />
            <Cifra v={r.activoMs ? duracion(r.activoMs) : '—'} l="Tiempo activo" />
            <Cifra v={r.visitas ? (r.final ? 'Final' : `${Math.round(r.mejor * 100)} %`) : '—'} l="Hasta dónde" />
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: S.soft }}>
              Última visita: <b style={{ color: S.ink, fontWeight: 500 }}>{hace(r.ultima)}</b>
              {r.lugares.length > 0 && <><br />Desde: {r.lugares.join(' · ')}</>}
              {r.dispositivos.length > 0 && <><br />Con: {r.dispositivos.join(' · ')}</>}
            </div>
          </div>
        </aside>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start', minWidth: 0 }}>
          <section style={{ ...card, padding: '18px 20px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 14px' }}>Qué le interesa</h2>
            <Calor datos={mapa} vacio="Aún no ha abierto el dossier con su PIN." />
          </section>
          <section style={{ ...card, padding: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, padding: '18px 20px 6px' }}>Visitas</h2>
            {sesiones.map((s) => {
              const evs = eventosDe(datos.eventos, s.id)
              return (
                <div key={s.id} style={{ padding: '12px 20px', borderTop: `1px solid ${S.lineSoft}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 500 }}>{fecha(s.inicio)}</span>
                    <span style={{ color: S.soft }}>{duracion(s.activoMs)} activo</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: S.soft, marginTop: 2 }}>
                    {[lugarDe(s), s.dispositivo, s.final ? 'hasta el final' : `hasta la ${s.maxSlide + 1} de ${s.totalSlides}`].filter(Boolean).join(' · ')}
                  </div>
                  {evs.length > 0 && <div style={{ fontSize: 12, color: S.soft, marginTop: 2 }}>{Array.from(new Set(evs.map((e) => NOMBRE_EVENTO[e.tipo] ?? e.tipo))).join(' · ')}</div>}
                </div>
              )
            })}
            {!sesiones.length && <p style={{ padding: '6px 20px 20px', margin: 0, fontSize: 13, color: S.soft }}>Sin visitas todavía.</p>}
          </section>
        </div>
      </div>

      {editar && (
        <LeadForm
          slug={slug}
          leadId={l.id}
          inicial={{ nombre: l.nombre, empresa: l.empresa ?? '', email: l.email ?? '', telefono: l.telefono ?? '', canal: l.canal ?? '', notas: l.notas ?? '', caducaEn: l.caducaEn ? new Date(l.caducaEn).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }) : '' }}
          onCerrar={() => setEditar(false)}
          onHecho={() => { setEditar(false); router.refresh() }}
        />
      )}
      {pinNuevo && <PinListo slug={slug} proyecto={proyecto} nombre={l.nombre} pin={pinNuevo} onCerrar={() => setPinNuevo(null)} />}
    </>
  )
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  if (!v) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${S.lineSoft}`, fontSize: 13 }}>
      <span style={{ color: S.soft }}>{k}</span><span style={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

function Cifra({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 11, color: S.faint }}>{l}</div>
    </div>
  )
}

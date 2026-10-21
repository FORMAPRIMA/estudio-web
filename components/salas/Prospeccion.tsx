'use client'

// Salas · prospección. Una sala de prospección no tiene propuesta: cada lead es
// una empresa a la que business development envía el dossier del estudio
// personalizado (formaprima.es/para/<token>). Aquí se da de alta, se sube su
// logo, se copia el correo y se sigue el embudo: preparado → enviado → abierto
// → interesado (o descartado).

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DatosSala, LeadRow } from '@/lib/salas/panel'
import { NOMBRE_EVENTO, calor, duracion, eventosDe, fecha, hace, lugarDe, resumenLeads, type ResumenLead } from '@/lib/salas/metricas'
import {
  actualizarProspecto, crearProspecto, estadoLeadSala, marcarProspecto, modoLogoProspecto, quitarLogoProspecto, subirLogoProspecto,
  type ProspectoInput,
} from '@/app/actions/salas'
import { correoPresentacion, enlacePara } from '@/lib/para/correo'
import Calor from './Calor'
import { Modal } from './LeadForm'
import { Etiqueta, Termometro } from './SalaPanel'
import { S, btn, card, eyebrow, input } from './theme'

const PERFIL = { developer: 'Developers', constructora: 'Constructoras' } as const
const PAISES = ['España', 'México', 'Estados Unidos', 'Ecuador', 'Colombia', 'Panamá', 'República Dominicana', 'Portugal']
const DIAS_SIN_ABRIR = 5

type Etapa = 'preparado' | 'enviado' | 'sin_abrir' | 'abierto' | 'interesado' | 'descartado' | 'revocado'
const NOMBRE_ETAPA: Record<Etapa, string> = {
  preparado: 'Preparado', enviado: 'Enviado', sin_abrir: 'Enviado · sin abrir', abierto: 'Abierto', interesado: 'Interesado',
  descartado: 'Descartado', revocado: 'Enlace revocado',
}

export function etapaDe(r: ResumenLead, ahora = Date.now()): Etapa {
  const l = r.lead
  if (l.estado === 'revocado') return 'revocado'
  if (l.descartadoEn) return 'descartado'
  if (r.interes) return 'interesado'
  if (r.visitas > 0) return 'abierto'
  if (l.enviadoEn) return ahora - Date.parse(l.enviadoEn) > DIAS_SIN_ABRIR * 864e5 ? 'sin_abrir' : 'enviado'
  return 'preparado'
}

function EtiquetaEtapa({ e }: { e: Etapa }) {
  const tono = e === 'interesado' ? 'acento' : e === 'abierto' ? 'vivo' : e === 'sin_abrir' || e === 'revocado' ? 'rojo' : 'neutro'
  return <Etiqueta tono={tono}>{NOMBRE_ETAPA[e]}</Etiqueta>
}

const logoUrl = (slug: string, l: Pick<LeadRow, 'id' | 'logoPath'>, modo: 'blanco' | 'original') =>
  `/${slug}/lead/${l.id}/logo?modo=${modo}&v=${encodeURIComponent(l.logoPath ?? '')}`

function correoDe(l: LeadRow, perfil: 'developer' | 'constructora', firma: string) {
  return correoPresentacion({
    nombre: l.nombre.trim().split(/\s+/)[0], empresa: l.empresa || l.nombre, perfil, idioma: l.idioma, tratamiento: l.tratamiento,
    enlace: enlacePara(l.token ?? ''), mensaje: l.mensaje, firma, espana: !l.pais || /españa|spain/i.test(l.pais),
  })
}

// ── Panel de la sala ─────────────────────────────────────────────────────────

export default function ProspeccionPanel({ slug, nombre, perfil, firma, datos }: {
  slug: string; nombre: string; perfil: 'developer' | 'constructora'; firma: string; datos: DatosSala
}) {
  const router = useRouter()
  const [nuevo, setNuevo] = useState(false)
  const [listo, setListo] = useState<string | null>(null)   // id del lead recién creado
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Etapa | 'todos'>('todos')
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') { router.refresh(); setAhora(Date.now()) } }, 30_000)
    return () => clearInterval(t)
  }, [router])

  const filas = useMemo(() => resumenLeads(datos, ahora).map((r) => ({ r, e: etapaDe(r, ahora) })), [datos, ahora])
  const cuenta = (es: Etapa[]) => filas.filter((f) => es.includes(f.e)).length
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const orden: Etapa[] = ['interesado', 'abierto', 'sin_abrir', 'enviado', 'preparado', 'descartado', 'revocado']
    return filas
      .filter((f) => filtro === 'todos' || f.e === filtro || (filtro === 'enviado' && f.e === 'sin_abrir'))
      .filter((f) => !q || [f.r.lead.nombre, f.r.lead.empresa, f.r.lead.cargo, f.r.lead.pais].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.r.viendoAhora) - Number(a.r.viendoAhora) || orden.indexOf(a.e) - orden.indexOf(b.e) || b.r.lead.createdAt.localeCompare(a.r.lead.createdAt))
  }, [filas, filtro, busca])
  const recien = listo ? datos.leads.find((l) => l.id === listo) : null

  const embudo: { e: Etapa | 'todos'; t: string; v: number; pie: string }[] = [
    { e: 'preparado', t: 'Preparados', v: cuenta(['preparado']), pie: 'listos para enviar' },
    { e: 'enviado', t: 'Enviados', v: cuenta(['enviado', 'sin_abrir']), pie: `${cuenta(['sin_abrir'])} sin abrir tras ${DIAS_SIN_ABRIR} días` },
    { e: 'abierto', t: 'Abiertos', v: cuenta(['abierto']), pie: 'han visto el dossier' },
    { e: 'interesado', t: 'Interesados', v: cuenta(['interesado']), pie: 'piden hablar' },
    { e: 'descartado', t: 'Descartados', v: cuenta(['descartado']), pie: 'fuera del embudo' },
  ]

  return (
    <>
      <Link href="/" style={{ fontSize: 12, color: S.soft, textDecoration: 'none' }}>← Dossiers</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', margin: '14px 0 24px' }}>
        <div>
          <p style={eyebrow}>Prospección · {PERFIL[perfil]}</p>
          <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 0' }}>{nombre}</h1>
          <p style={{ fontSize: 12, color: S.soft, margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>
            Cada empresa recibe su propio enlace a la presentación del estudio, con su nombre y su logo. Sin PIN: el enlace es la llave, y se puede revocar.
          </p>
        </div>
        <button onClick={() => setNuevo(true)} style={btn()}>+ Nuevo lead</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {embudo.map((k) => (
          <button key={k.e} onClick={() => setFiltro(filtro === k.e ? 'todos' : k.e)} style={{
            ...card, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: S.ink,
            borderColor: filtro === k.e ? S.ink : S.line,
          }}>
            <p style={eyebrow}>{k.t}</p>
            <p style={{ fontSize: 26, fontWeight: 300, margin: '8px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{k.v}</p>
            <p style={{ fontSize: 11.5, color: k.e === 'enviado' && cuenta(['sin_abrir']) ? S.red : S.faint, margin: 0 }}>{k.pie}</p>
          </button>
        ))}
      </div>

      {datos.leads.length === 0 ? (
        <div style={{ ...card, padding: '44px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 300, margin: '0 0 6px' }}>Todavía no hay empresas en esta sala.</p>
          <p style={{ fontSize: 13, color: S.soft, margin: '0 0 20px' }}>Da de alta la primera: te preparamos su enlace y el correo para enviárselo.</p>
          <button onClick={() => setNuevo(true)} style={btn()}>+ Crear la primera</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por empresa, contacto, cargo o país" aria-label="Buscar" style={{ ...input, maxWidth: 360, background: S.panel }} />
            {filtro !== 'todos' && <button onClick={() => setFiltro('todos')} style={{ ...btn('ghost'), padding: '6px 12px' }}>{NOMBRE_ETAPA[filtro as Etapa]} · quitar filtro ×</button>}
          </div>
          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
              <thead>
                <tr style={{ color: S.soft, fontSize: 11, textAlign: 'left' }}>
                  {['Empresa', 'Etapa', 'Temperatura', 'Última visita', 'Visitas', 'Tiempo', 'País'].map((h) => <th key={h} style={{ padding: '12px 16px', fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ r, e }) => (
                  <tr key={r.lead.id} className="salas-fila" tabIndex={0} onClick={() => router.push(`/${slug}/lead/${r.lead.id}`)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') router.push(`/${slug}/lead/${r.lead.id}`) }}
                    style={{ borderTop: `1px solid ${S.lineSoft}`, cursor: 'pointer', opacity: e === 'descartado' || e === 'revocado' ? 0.55 : 1 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 44, height: 30, borderRadius: 4, background: '#141414', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {r.lead.logoPath
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={logoUrl(slug, r.lead, r.lead.logoModo)} alt="" style={{ maxWidth: 36, maxHeight: 20, objectFit: 'contain' }} />
                            : <span style={{ fontSize: 11, color: '#fbfbfa', fontWeight: 600 }}>{(r.lead.empresa || r.lead.nombre).slice(0, 2).toUpperCase()}</span>}
                        </span>
                        <span>
                          <span style={{ display: 'block', fontWeight: 500 }}>{r.lead.empresa || '—'}</span>
                          <span style={{ fontSize: 11.5, color: S.faint }}>{[r.lead.nombre, r.lead.cargo].filter(Boolean).join(' · ')}</span>
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><span style={{ display: 'inline-flex', gap: 4 }}><EtiquetaEtapa e={e} />{r.viendoAhora && <Etiqueta tono="vivo">viendo ahora</Etiqueta>}</span></td>
                    <td style={{ padding: '12px 16px' }}><Termometro t={r.temperatura} /></td>
                    <td style={{ padding: '12px 16px' }}>{hace(r.ultima)}</td>
                    <td style={{ padding: '12px 16px', fontVariantNumeric: 'tabular-nums' }}>{r.visitas || '—'}</td>
                    <td style={{ padding: '12px 16px', fontVariantNumeric: 'tabular-nums' }}>{r.activoMs ? duracion(r.activoMs) : '—'}</td>
                    <td style={{ padding: '12px 16px', color: S.soft }}>{r.lead.pais || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibles.length && <p style={{ padding: 20, margin: 0, fontSize: 13, color: S.soft }}>Nada con este filtro.</p>}
          </div>
        </>
      )}

      {nuevo && (
        <ProspectoForm slug={slug} onCerrar={() => setNuevo(false)} onHecho={(id) => { setNuevo(false); setListo(id); router.refresh() }} />
      )}
      {listo && recien && (
        <Modal titulo={`Listo · ${recien.empresa}`} onCerrar={() => setListo(null)} ancho={680}>
          <EnvioProspecto slug={slug} l={recien} perfil={perfil} firma={firma} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button onClick={() => setListo(null)} style={btn()}>Hecho</button></div>
        </Modal>
      )}
      {listo && !recien && <Modal titulo="Preparando…" onCerrar={() => setListo(null)}><p style={{ fontSize: 13, color: S.soft, margin: 0 }}>Un momento…</p></Modal>}
    </>
  )
}

// ── Alta / edición ───────────────────────────────────────────────────────────

function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.soft, marginBottom: 5 }}><span>{label}</span>{hint && <span style={{ color: S.faint }}>{hint}</span>}</span>
      {children}
    </label>
  )
}

function Opciones<T extends string>({ valor, opciones, onCambio }: { valor: T; opciones: [T, string][]; onCambio: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opciones.map(([v, t]) => (
        <button key={v} type="button" onClick={() => onCambio(v)} style={{ ...btn(valor === v ? 'primary' : 'ghost'), padding: '9px 14px', flex: 1 }}>{t}</button>
      ))}
    </div>
  )
}

export function ProspectoForm({ slug, leadId, inicial, onHecho, onCerrar }: {
  slug: string; leadId?: string; inicial?: ProspectoInput; onHecho: (id: string) => void; onCerrar: () => void
}) {
  const [d, setD] = useState<ProspectoInput>(inicial ?? {
    nombre: '', empresa: '', cargo: '', email: '', telefono: '', pais: '', idioma: 'es', tratamiento: 'tu', mensaje: '', notas: '', caducaEn: '',
  })
  const [error, setError] = useState('')
  const [isGuardando, setIsGuardando] = useState(false)
  const set = (k: keyof ProspectoInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }))
  // Latinoamérica: «usted» por defecto al elegir el país (se puede cambiar)
  const ponPais = (pais: string) => setD((x) => ({ ...x, pais, ...(!leadId && pais && !/españa|spain/i.test(pais) && x.idioma === 'es' ? { tratamiento: 'usted' as const } : {}) }))

  const guardar = async () => {
    setError(''); setIsGuardando(true)
    const r = leadId ? await actualizarProspecto(leadId, d) : await crearProspecto(slug, d)
    setIsGuardando(false)
    if (!r.ok) { setError(r.error); return }
    onHecho(leadId ?? (r as unknown as { id: string }).id)
  }

  return (
    <Modal titulo={leadId ? 'Editar lead' : 'Nuevo lead'} onCerrar={onCerrar} ancho={620}>
      <form onSubmit={(e) => { e.preventDefault(); guardar() }} style={{ display: 'grid', gap: 14 }}>
        <Campo label="Empresa"><input autoFocus value={d.empresa ?? ''} onChange={set('empresa')} placeholder="p. ej. Be Grand" style={input} /></Campo>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <Campo label="Contacto"><input value={d.nombre} onChange={set('nombre')} placeholder="Nombre y apellido" style={input} /></Campo>
          <Campo label="Cargo" hint="opcional"><input value={d.cargo ?? ''} onChange={set('cargo')} placeholder="Director de desarrollo" style={input} /></Campo>
        </div>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <Campo label="Email" hint="opcional"><input type="email" value={d.email ?? ''} onChange={set('email')} style={input} /></Campo>
          <Campo label="País" hint="opcional"><input value={d.pais ?? ''} onChange={(e) => ponPais(e.target.value)} list="salas-paises" style={input} /></Campo>
        </div>
        <datalist id="salas-paises">{PAISES.map((p) => <option key={p} value={p} />)}</datalist>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <Campo label="Idioma del dossier"><Opciones valor={d.idioma} opciones={[['es', 'Español'], ['en', 'English']]} onCambio={(idioma) => setD({ ...d, idioma })} /></Campo>
          {d.idioma === 'es'
            ? <Campo label="Trato en el correo"><Opciones valor={d.tratamiento} opciones={[['tu', 'Tú'], ['usted', 'Usted']]} onCambio={(tratamiento) => setD({ ...d, tratamiento })} /></Campo>
            : <span />}
        </div>
        <Campo label="Línea personal" hint="opcional · abre el correo">
          <textarea rows={2} value={d.mensaje ?? ''} onChange={set('mensaje')} placeholder="Vimos vuestra torre en Polanco y nos encantó cómo resolvisteis las terrazas." style={{ ...input, resize: 'vertical' }} />
        </Campo>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <Campo label="Teléfono" hint="opcional"><input type="tel" value={d.telefono ?? ''} onChange={set('telefono')} style={input} /></Campo>
          <Campo label="El enlace caduca el" hint="opcional"><input type="date" value={d.caducaEn ?? ''} onChange={set('caducaEn')} style={input} /></Campo>
        </div>
        <Campo label="Notas" hint="opcional · solo las ve el equipo"><textarea rows={2} value={d.notas ?? ''} onChange={set('notas')} style={{ ...input, resize: 'vertical' }} /></Campo>
        {error && <p role="alert" style={{ color: S.red, fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onCerrar} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={isGuardando} style={{ ...btn(), opacity: isGuardando ? 0.6 : 1 }}>{isGuardando ? 'Guardando…' : leadId ? 'Guardar' : 'Crear enlace'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Logo, enlace y correo (en el «listo» y en la ficha) ──────────────────────

function Copiable({ titulo, texto, mono }: { titulo: string; texto: string; mono?: boolean }) {
  const [ok, setOk] = useState(false)
  return (
    <div style={{ border: `1px solid ${S.line}`, borderRadius: 8, padding: '12px 14px', background: S.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: S.soft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{titulo}</span>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1600) } catch { /* sin permiso */ } }} style={{ ...btn('ghost'), padding: '5px 10px', fontSize: 11 }}>
          {ok ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 13.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55, fontFamily: mono ? 'ui-monospace, Menlo, monospace' : 'inherit' }}>{texto}</div>
    </div>
  )
}

export function LogoProspecto({ slug, l }: { slug: string; l: LeadRow }) {
  const router = useRouter()
  const ref = useRef<HTMLInputElement>(null)
  const [isSubiendo, setIsSubiendo] = useState(false)
  const [error, setError] = useState('')
  const subir = async (f: File | undefined) => {
    if (!f) return
    setError(''); setIsSubiendo(true)
    const fd = new FormData(); fd.append('logo', f)
    const r = await subirLogoProspecto(l.id, fd)
    setIsSubiendo(false)
    if (ref.current) ref.current.value = ''
    if (!r.ok) { setError(r.error); return }
    router.refresh()
  }
  const modo = async (m: 'blanco' | 'original') => { await modoLogoProspecto(l.id, m); router.refresh() }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* así se verá en la portada del dossier */}
      <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 78 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/propuestas/logo-fp.png" alt="Forma Prima" style={{ height: 13, width: "auto" }} />
        <span style={{ color: '#fbfbfa80', fontSize: 18, fontWeight: 200 }}>×</span>
        {l.logoPath
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logoUrl(slug, l, l.logoModo)} alt={l.empresa ?? ''} style={{ maxHeight: 30, maxWidth: 160, objectFit: 'contain' }} />
          : <span style={{ color: '#fbfbfa', fontSize: 13, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>{l.empresa}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => subir(e.target.files?.[0])} />
        <button type="button" onClick={() => ref.current?.click()} disabled={isSubiendo} style={btn('ghost')}>{isSubiendo ? 'Procesando…' : l.logoPath ? 'Cambiar logo' : 'Subir logo'}</button>
        {l.logoPath && (
          <>
            <button type="button" onClick={() => modo('blanco')} style={{ ...btn(l.logoModo === 'blanco' ? 'primary' : 'ghost'), padding: '9px 12px' }}>En blanco</button>
            <button type="button" onClick={() => modo('original')} style={{ ...btn(l.logoModo === 'original' ? 'primary' : 'ghost'), padding: '9px 12px' }}>Colores originales</button>
            <button type="button" onClick={async () => { await quitarLogoProspecto(l.id); router.refresh() }} style={{ ...btn('ghost'), padding: '9px 12px', color: S.soft }}>Quitar</button>
          </>
        )}
      </div>
      <p style={{ fontSize: 12, color: S.faint, margin: 0, lineHeight: 1.5 }}>
        PNG, JPG, WebP o SVG. Se recorta solo y, si tiene fondo blanco, se le quita. Sin logo, la portada lleva el nombre de la empresa.
      </p>
      {error && <p role="alert" style={{ color: S.red, fontSize: 13, margin: 0 }}>{error}</p>}
    </div>
  )
}

export function EnvioProspecto({ slug, l, perfil, firma }: { slug: string; l: LeadRow; perfil: 'developer' | 'constructora'; firma: string }) {
  const router = useRouter()
  const enlace = enlacePara(l.token ?? '')
  const c = correoDe(l, perfil, firma)
  const [isMarcando, setIsMarcando] = useState(false)
  // en local, el dossier se abre en el propio servidor de desarrollo
  const [base, setBase] = useState('https://formaprima.es')
  useEffect(() => { if (window.location.host.includes('localhost')) setBase(`http://localhost:${window.location.port || '3000'}`) }, [])
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <LogoProspecto slug={slug} l={l} />
      <Copiable titulo="Enlace personal" texto={enlace} mono />
      <Copiable titulo="Asunto" texto={c.asunto} />
      <Copiable titulo="Correo" texto={c.cuerpo} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a href={`${base}/para/${l.token}?equipo=${l.firmaEquipo ?? ''}`} target="_blank" rel="noopener" style={{ ...btn('ghost'), textDecoration: 'none' }}>Ver su dossier ↗</a>
        {l.email && <a href={`mailto:${l.email}?subject=${encodeURIComponent(c.asunto)}&body=${encodeURIComponent(c.cuerpo)}`} style={{ ...btn('ghost'), textDecoration: 'none' }}>Abrir en mi correo</a>}
        <button type="button" disabled={isMarcando} onClick={async () => { setIsMarcando(true); await marcarProspecto(l.id, 'enviado', !l.enviadoEn); setIsMarcando(false); router.refresh() }}
          style={{ ...btn(l.enviadoEn ? 'ghost' : 'primary'), marginLeft: 'auto' }}>
          {l.enviadoEn ? `Enviado el ${fecha(l.enviadoEn)} · deshacer` : 'Marcar como enviado'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: S.faint, margin: 0, lineHeight: 1.5 }}>
        Envíalo desde tu correo: llega de una persona, no de una plataforma. Ábrelo con «Ver su dossier»: así tus visitas no cuentan como suyas.
      </p>
    </div>
  )
}

// ── Ficha de un lead ─────────────────────────────────────────────────────────

export function ProspectoFicha({ slug, sala, perfil, firma, datos, etiquetas }: {
  slug: string; sala: string; perfil: 'developer' | 'constructora'; firma: string; datos: DatosSala; etiquetas: string[]
}) {
  const router = useRouter()
  const r = useMemo(() => resumenLeads(datos)[0], [datos])
  const mapa = useMemo(() => calor(datos.sesiones, datos.vistas, etiquetas), [datos, etiquetas])
  const [editar, setEditar] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [isOcupado, setIsOcupado] = useState(false)
  const l = r.lead
  const e = etapaDe(r)
  const sesiones = datos.sesiones.filter((s) => s.totalSlides > 0)

  const accion = async (f: () => Promise<unknown>) => { setIsOcupado(true); await f(); setIsOcupado(false); setConfirmar(false); router.refresh() }

  return (
    <>
      <Link href={`/${slug}`} style={{ fontSize: 12, color: S.soft, textDecoration: 'none' }}>← {sala}</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', margin: '14px 0 24px' }}>
        <div>
          <p style={eyebrow}>Prospección · {PERFIL[perfil]}</p>
          <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>{l.empresa}</h1>
          <p style={{ fontSize: 13.5, color: S.soft, margin: '0 0 10px' }}>{[l.nombre, l.cargo, l.pais].filter(Boolean).join(' · ')}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <EtiquetaEtapa e={e} />
            {r.viendoAhora && <Etiqueta tono="vivo">viendo ahora</Etiqueta>}
            {r.final && <Etiqueta>llegó al final</Etiqueta>}
            <Etiqueta>{l.idioma === 'en' ? 'English' : l.tratamiento === 'usted' ? 'Español · usted' : 'Español · tú'}</Etiqueta>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setEditar(true)} style={btn('ghost')}>Editar</button>
          <button disabled={isOcupado} onClick={() => accion(() => marcarProspecto(l.id, 'descartado', !l.descartadoEn))} style={btn('ghost')}>{l.descartadoEn ? 'Recuperar' : 'Descartar'}</button>
          {l.estado === 'activo'
            ? <button onClick={() => setConfirmar(true)} style={btn('danger')}>Revocar enlace</button>
            : <button disabled={isOcupado} onClick={() => accion(() => estadoLeadSala(l.id, 'activo'))} style={btn('ghost')}>Reactivar enlace</button>}
        </div>
      </div>

      {confirmar && (
        <div style={{ ...card, padding: '14px 18px', marginBottom: 20, borderColor: '#B03A2E55', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, flex: '1 1 300px' }}>¿Revocar el enlace de {l.empresa}? Quien lo abra verá «Este enlace ya no está disponible». Se puede reactivar.</span>
          <button onClick={() => setConfirmar(false)} style={btn('ghost')}>Cancelar</button>
          <button disabled={isOcupado} onClick={() => accion(() => estadoLeadSala(l.id, 'revocado'))} style={{ ...btn('danger'), background: S.red, color: '#fff' }}>Sí, revocar</button>
        </div>
      )}

      <div className="salas-ficha" style={{ display: 'grid', gap: 20 }}>
        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={{ ...card, padding: '16px 18px' }}>
            <p style={{ ...eyebrow, marginBottom: 12 }}>Temperatura</p>
            <Termometro t={r.temperatura} grande />
            {r.temperatura.motivos.length > 0 && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 16, fontSize: 12.5, color: S.soft, lineHeight: 1.6 }}>{r.temperatura.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
            )}
          </div>
          <div style={{ ...card, padding: '16px 18px', fontSize: 13 }}>
            {[['Email', l.email], ['Teléfono', l.telefono], ['Alta', `${fecha(l.createdAt)}${datos.miembros[l.creadoPor ?? ''] ? ` · ${datos.miembros[l.creadoPor ?? '']}` : ''}`],
              ['Enviado', l.enviadoEn ? fecha(l.enviadoEn) : 'Aún no'], ['Caduca', l.caducaEn ? fecha(l.caducaEn) : 'No caduca'],
              ['Visitas', String(r.visitas)], ['Tiempo activo', r.activoMs ? duracion(r.activoMs) : '—'], ['Última visita', hace(r.ultima)]].map(([k, v]) => v ? (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${S.lineSoft}` }}>
                <span style={{ color: S.soft }}>{k}</span><span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
              </div>
            ) : null)}
            {l.notas && <p style={{ fontSize: 12.5, color: S.soft, margin: '12px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l.notas}</p>}
          </div>
        </aside>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start', minWidth: 0 }}>
          <section style={{ ...card, padding: '18px 20px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 14px' }}>Envío</h2>
            <EnvioProspecto slug={slug} l={l} perfil={perfil} firma={firma} />
          </section>
          <section style={{ ...card, padding: '18px 20px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 14px' }}>Qué le interesa</h2>
            <Calor datos={mapa} vacio="Aún no ha abierto su dossier." />
          </section>
          <section style={{ ...card, padding: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, padding: '18px 20px 6px' }}>Visitas</h2>
            {sesiones.map((s) => {
              const evs = eventosDe(datos.eventos, s.id)
              return (
                <div key={s.id} style={{ padding: '12px 20px', borderTop: `1px solid ${S.lineSoft}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 500 }}>{fecha(s.inicio)}</span><span style={{ color: S.soft }}>{duracion(s.activoMs)} activo</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: S.soft, marginTop: 2 }}>{[lugarDe(s), s.dispositivo, s.final ? 'hasta el final' : `hasta la ${s.maxSlide + 1} de ${s.totalSlides}`].filter(Boolean).join(' · ')}</div>
                  {evs.length > 0 && <div style={{ fontSize: 12, color: S.soft, marginTop: 2 }}>{Array.from(new Set(evs.map((x) => NOMBRE_EVENTO[x.tipo] ?? x.tipo))).join(' · ')}</div>}
                </div>
              )
            })}
            {!sesiones.length && <p style={{ padding: '6px 20px 20px', margin: 0, fontSize: 13, color: S.soft }}>Sin visitas todavía.</p>}
          </section>
        </div>
      </div>

      {editar && (
        <ProspectoForm
          slug={slug} leadId={l.id}
          inicial={{
            nombre: l.nombre, empresa: l.empresa ?? '', cargo: l.cargo ?? '', email: l.email ?? '', telefono: l.telefono ?? '', pais: l.pais ?? '',
            idioma: l.idioma, tratamiento: l.tratamiento, mensaje: l.mensaje ?? '', notas: l.notas ?? '',
            caducaEn: l.caducaEn ? new Date(l.caducaEn).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }) : '',
          }}
          onCerrar={() => setEditar(false)}
          onHecho={() => { setEditar(false); router.refresh() }}
        />
      )}
    </>
  )
}

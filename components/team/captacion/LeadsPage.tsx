'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLead, deleteLead } from '@/app/actions/leads'
import { createPropuesta } from '@/app/actions/propuestas'
import { createEspacio } from '@/app/actions/espacios'
import { ETAPA_LABEL, type Etapa } from '@/lib/espacio/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccesoEntry {
  ts:          string
  ip:          string
  dispositivo: string
  etapa?:      string
}

const ETAPA_SEQ = ['bienvenida', 'propuesta', 'formalizacion', 'contrato', 'proyecto']

export interface EventoEntry {
  tipo: string
  ts:   string
  meta?: unknown
}

export interface EspacioLite {
  id:            string
  token:         string
  nombre:        string
  email:         string | null
  idioma:        string | null
  etapa:         string
  nota_interna:  string | null
  created_at:    string
  lead_id:       string | null
  cliente_id:    string | null
  primer_acceso: string | null
  num_accesos:   number | null
  accesos:       AccesoEntry[] | null
  eventos:       EventoEntry[] | null
}

export interface PropuestaLite {
  id:         string
  numero:     string | null
  status:     string | null
  titulo:     string | null
  lead_id:    string | null
  cliente_id: string | null
  created_at: string
}

export interface ContratoLite {
  id:          string
  numero:      string | null
  status:      string | null
  lead_id:     string | null
  cliente_id:  string | null
  propuesta_id:string | null
  fecha_envio: string | null
  fecha_firma: string | null
  created_at:  string
}

interface Lead {
  id: string
  nombre: string
  apellidos: string | null
  empresa: string | null
  email: string | null
  email_cc: string | null
  telefono: string | null
  telefono_alt: string | null
  nif_cif: string | null
  documento_identidad: string | null
  direccion: string | null
  ciudad: string | null
  codigo_postal: string | null
  pais: string | null
  direccion_facturacion: string | null
  notas_facturacion: string | null
  tipo_facturacion: string | null
  notas: string | null
  fecha_nacimiento: string | null
  origen: string | null
  estado_lead: string | null
  interes: string | null
  presupuesto_estimado: number | null
}

type Columna = 'leads' | 'propuestas' | 'contratos' | 'ganados'

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: { key: Columna; label: string; accent: string }[] = [
  { key: 'leads',      label: 'Leads',                   accent: '#888888' },
  { key: 'propuestas', label: 'Propuestas de honorarios', accent: '#E8913A' },
  { key: 'contratos',  label: 'Contratos',               accent: '#378ADD' },
  { key: 'ganados',    label: 'Ganados',                 accent: '#1D9E75' },
]

const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:        { label: 'Nuevo',        color: '#888',    bg: '#F0EEE8' },
  contactado:   { label: 'Contactado',   color: '#378ADD', bg: '#EEF4FD' },
  propuesta:    { label: 'Propuesta',    color: '#E8913A', bg: '#FDF3EE' },
  negociacion:  { label: 'Negociación',  color: '#9B59B6', bg: '#F5EEFB' },
  ganado:       { label: 'Ganado',       color: '#1D9E75', bg: '#EEF8F4' },
  perdido:      { label: 'Perdido',      color: '#E53E3E', bg: '#FEF2F2' },
}

const ESTADO_ORDER = ['nuevo', 'contactado', 'propuesta', 'negociacion', 'ganado', 'perdido']
const ORIGENES = ['Referido', 'Web', 'Instagram', 'LinkedIn', 'Google', 'Evento', 'Otro']

const PROP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: '#888',    bg: '#F0EEE8' },
  enviada:  { label: 'Enviada',  color: '#378ADD', bg: '#EEF4FD' },
  aceptada: { label: 'Aceptada', color: '#1D9E75', bg: '#EEF8F4' },
  rechazada:{ label: 'Rechazada',color: '#E53E3E', bg: '#FEF2F2' },
}

const CONTRATO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  borrador:   { label: 'Pendiente de enviar', color: '#888',    bg: '#F0EEE8' },
  enviado:    { label: 'Enviado',             color: '#378ADD', bg: '#EEF4FD' },
  negociacion:{ label: 'En negociación',      color: '#9B59B6', bg: '#F5EEFB' },
  firmado:    { label: 'Firmado',             color: '#1D9E75', bg: '#EEF8F4' },
  cancelado:  { label: 'Cancelado',           color: '#E53E3E', bg: '#FEF2F2' },
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FIELD: React.CSSProperties = {
  background: '#FFF8F0', border: '1px solid #E8913A',
  borderRadius: 4, padding: '4px 8px', fontSize: 16,
  color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', width: '100%',
}

const CARD_BTN: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 4,
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function presupuestoLabel(n: number | null) {
  if (!n) return null
  return `€ ${new Intl.NumberFormat('es-ES').format(n)}`
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// Accesos de la etapa ACTUAL del espacio (los registros sin etiqueta se tratan
// como 'bienvenida', por compatibilidad con accesos previos al etiquetado).
function accesosEtapaActual(esp: EspacioLite | undefined): AccesoEntry[] {
  if (!esp) return []
  return (esp.accesos ?? []).filter(a => (a.etapa ?? 'bienvenida') === esp.etapa)
}

// Termómetro de interés: cuenta SOLO la etapa actual (visitas reales del cliente;
// el modo presentación con PIN maestro no cuenta). Se "reinicia" al avanzar de
// etapa porque filtra por la etapa vigente; el histórico se ve en el modal.
function termometro(esp: EspacioLite | undefined): { label: string; color: string; bg: string; dot: string } {
  const n = accesosEtapaActual(esp).length
  if (!esp || n === 0) return { label: 'Sin abrir', color: '#AAA', bg: '#F4F3EF', dot: '#CCC' }
  if (n >= 3) return { label: `Caliente · ${n}×`, color: '#C0392B', bg: '#FDECEA', dot: '#E74C3C' }
  return { label: `Visto ${n}×`, color: '#B45309', bg: '#FDF6EE', dot: '#D97706' }
}

// ── Modal de accesos (etapa actual + histórico por etapa) ──────────────────────

function AccesosModal({ espacio, onClose }: { espacio: EspacioLite; onClose: () => void }) {
  const accesos = (espacio.accesos ?? []).slice().sort((a, b) => b.ts.localeCompare(a.ts))
  const byEtapa = new Map<string, AccesoEntry[]>()
  for (const a of accesos) {
    const et = a.etapa ?? 'bienvenida'
    if (!byEtapa.has(et)) byEtapa.set(et, [])
    byEtapa.get(et)!.push(a)
  }
  const actual = espacio.etapa
  const otras = Array.from(byEtapa.keys())
    .filter(e => e !== actual)
    .sort((a, b) => ETAPA_SEQ.indexOf(b) - ETAPA_SEQ.indexOf(a))
  const orden = [actual, ...otras]

  const Grupo = ({ etapa, esActual }: { etapa: string; esActual: boolean }) => {
    const items = byEtapa.get(etapa) ?? []
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: esActual ? '#D85A30' : '#888' }}>
            {ETAPA_LABEL[etapa as Etapa] ?? etapa}
          </span>
          {esActual && <span style={{ fontSize: 9, fontWeight: 700, color: '#D85A30', background: '#FDF3EE', padding: '1px 7px', borderRadius: 8 }}>Etapa actual</span>}
          <span style={{ fontSize: 11, color: '#AAA', marginLeft: 'auto' }}>{items.length} {items.length === 1 ? 'acceso' : 'accesos'}</span>
        </div>
        {items.length === 0 ? (
          <p style={{ fontSize: 12, color: '#BBB', margin: 0 }}>Aún sin accesos en esta etapa.</p>
        ) : (
          <div style={{ border: '1px solid #F0EEE8', borderRadius: 6, overflow: 'hidden' }}>
            {items.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', fontSize: 12, color: '#555', background: i % 2 ? '#FAFAF8' : '#fff' }}>
                <span style={{ width: 18, color: '#CCC', fontSize: 11 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{fmtDateTime(a.ts)}</span>
                <span style={{ color: '#888' }}>{a.dispositivo}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#BBB' }}>{a.ip}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', zIndex: 110, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 26, width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 17, fontWeight: 400, margin: 0 }}>Accesos · {espacio.nombre}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 18px' }}>
          Visitas reales del cliente. Las del equipo en modo presentación (PIN maestro) no se registran.
        </p>
        {accesos.length === 0 && <p style={{ fontSize: 13, color: '#AAA' }}>Este espacio aún no se ha abierto.</p>}
        {orden.map(et => <Grupo key={et} etapa={et} esActual={et === actual} />)}
      </div>
    </div>
  )
}

function tieneEvento(esp: EspacioLite | undefined, tipo: string): boolean {
  return !!esp?.eventos?.some(e => e.tipo === tipo)
}

// ── Lead edit form (reutilizado del CRM, sin cambios de fondo) ─────────────────

function LF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 4px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function LeadEditForm({
  lead,
  onUpdate,
  onClose,
}: {
  lead: Lead
  onUpdate: (field: string, value: unknown) => void
  onClose: () => void
}) {
  const [nombre,      setNombre]      = useState(lead.nombre ?? '')
  const [apellidos,   setApellidos]   = useState(lead.apellidos ?? '')
  const [empresa,     setEmpresa]     = useState(lead.empresa ?? '')
  const [nif,         setNif]         = useState(lead.nif_cif ?? '')
  const [email,       setEmail]       = useState(lead.email ?? '')
  const [emailCc,     setEmailCc]     = useState(lead.email_cc ?? '')
  const [telefono,    setTelefono]    = useState(lead.telefono ?? '')
  const [telefonoAlt, setTelefonoAlt] = useState(lead.telefono_alt ?? '')
  const [direccion,   setDireccion]   = useState(lead.direccion ?? '')
  const [ciudad,      setCiudad]      = useState(lead.ciudad ?? '')
  const [cp,          setCp]          = useState(lead.codigo_postal ?? '')
  const [pais,        setPais]        = useState(lead.pais ?? '')
  const [dirFac,      setDirFac]      = useState(lead.direccion_facturacion ?? '')
  const [tipoFac,     setTipoFac]     = useState(lead.tipo_facturacion ?? '')
  const [fechaNac,    setFechaNac]    = useState(lead.fecha_nacimiento ?? '')
  const [interes,     setInteres]     = useState(lead.interes ?? '')
  const [presupuesto, setPresupuesto] = useState(lead.presupuesto_estimado != null ? String(lead.presupuesto_estimado) : '')
  const [estadoLead,  setEstadoLead]  = useState(lead.estado_lead ?? 'nuevo')
  const [origen,      setOrigen]      = useState(lead.origen ?? '')
  const [notas,       setNotas]       = useState(lead.notas ?? '')

  const save = (field: string, value: unknown) => onUpdate(field, value)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 20px' }}>
      <LF label="Estado">
        <select value={estadoLead} onChange={e => { setEstadoLead(e.target.value); save('estado_lead', e.target.value) }} style={FIELD}>
          {ESTADO_ORDER.map(e => <option key={e} value={e}>{ESTADO_META[e].label}</option>)}
        </select>
      </LF>
      <LF label="Origen">
        <select value={origen} onChange={e => { setOrigen(e.target.value); save('origen', e.target.value || null) }} style={FIELD}>
          <option value="">—</option>
          {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </LF>
      <LF label="Tipo de proyecto / Interés">
        <input value={interes} onChange={e => setInteres(e.target.value)} onBlur={e => save('interes', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Presupuesto estimado (sin IVA)">
        <input type="number" min={0} value={presupuesto} onChange={e => setPresupuesto(e.target.value)} onBlur={e => save('presupuesto_estimado', e.target.value ? parseFloat(e.target.value) : null)} style={FIELD} />
      </LF>
      <LF label="Nombre">
        <input value={nombre} onChange={e => setNombre(e.target.value)} onBlur={e => save('nombre', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Apellidos">
        <input value={apellidos} onChange={e => setApellidos(e.target.value)} onBlur={e => save('apellidos', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Empresa">
        <input value={empresa} onChange={e => setEmpresa(e.target.value)} onBlur={e => save('empresa', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="NIF / CIF">
        <input value={nif} onChange={e => setNif(e.target.value)} onBlur={e => save('nif_cif', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Email">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => save('email', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Email CC">
        <input type="email" value={emailCc} onChange={e => setEmailCc(e.target.value)} onBlur={e => save('email_cc', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Teléfono">
        <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} onBlur={e => save('telefono', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Teléfono alternativo">
        <input type="tel" value={telefonoAlt} onChange={e => setTelefonoAlt(e.target.value)} onBlur={e => save('telefono_alt', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Dirección">
        <input value={direccion} onChange={e => setDireccion(e.target.value)} onBlur={e => save('direccion', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Ciudad">
        <input value={ciudad} onChange={e => setCiudad(e.target.value)} onBlur={e => save('ciudad', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Código postal">
        <input value={cp} onChange={e => setCp(e.target.value)} onBlur={e => save('codigo_postal', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="País">
        <input value={pais} onChange={e => setPais(e.target.value)} onBlur={e => save('pais', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Dirección de facturación">
        <input value={dirFac} onChange={e => setDirFac(e.target.value)} onBlur={e => save('direccion_facturacion', e.target.value || null)} style={FIELD} />
      </LF>
      <LF label="Tipo de facturación">
        <select value={tipoFac} onChange={e => { setTipoFac(e.target.value); save('tipo_facturacion', e.target.value || null) }} style={FIELD}>
          <option value="">—</option>
          <option value="particular">Particular</option>
          <option value="empresa">Empresa</option>
          <option value="autonomo">Autónomo</option>
        </select>
      </LF>
      <LF label="Fecha de nacimiento">
        <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} onBlur={e => save('fecha_nacimiento', e.target.value || null)} style={FIELD} />
      </LF>
      <div style={{ gridColumn: '1 / -1' }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 4px' }}>Notas</p>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} onBlur={e => save('notas', e.target.value || null)} rows={3} style={{ ...FIELD, resize: 'vertical', padding: '8px' }} />
      </div>
      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
        <button
          onClick={onClose}
          style={{ height: 34, padding: '0 18px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────

interface CardData {
  lead:       Lead
  espacio?:   EspacioLite
  propuesta?: PropuestaLite
  contrato?:  ContratoLite
}

function LeadCard({
  data,
  onOpenLead,
  onVerPortal,
  onCrearEspacio,
  onCrearPropuesta,
  onEnviarPropuesta,
  onAbrirPropuesta,
  onAbrirContrato,
  onMarcarPerdido,
  onVerLogs,
  busy,
}: {
  data: CardData
  onOpenLead: () => void
  onVerPortal: () => void
  onCrearEspacio: () => void
  onCrearPropuesta: () => void
  onEnviarPropuesta: () => void
  onAbrirPropuesta: () => void
  onAbrirContrato: () => void
  onMarcarPerdido: () => void
  onVerLogs: () => void
  busy: boolean
}) {
  const { lead, espacio, propuesta, contrato } = data
  const nombre = [lead.nombre, lead.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
  const term = termometro(espacio)
  const formularioOk = !!(lead.telefono || lead.interes)
  const datosFiscales = tieneEvento(espacio, 'datos_completados')

  return (
    <div
      style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {/* Cabecera */}
      <div style={{ cursor: 'pointer' }} onClick={onOpenLead}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{nombre}</div>
        {lead.empresa && <div style={{ fontSize: 11, color: '#888' }}>{lead.empresa}</div>}
        {lead.email && <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{lead.email}</div>}
      </div>

      {/* Chips de estado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <button
          type="button"
          onClick={espacio ? onVerLogs : undefined}
          disabled={!espacio}
          title={espacio ? 'Ver accesos y histórico por etapa' : 'Sin espacio'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: term.bg, border: 'none', cursor: espacio ? 'pointer' : 'default', fontFamily: 'inherit' }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: term.dot }} />
          <span style={{ fontSize: 9, fontWeight: 600, color: term.color }}>{term.label}</span>
        </button>
        {formularioOk && (
          <span style={{ fontSize: 9, fontWeight: 600, color: '#1D9E75', background: '#EEF8F4', padding: '2px 7px', borderRadius: 10 }}>
            Formulario ✓
          </span>
        )}
        {datosFiscales && (
          <span style={{ fontSize: 9, fontWeight: 600, color: '#9B59B6', background: '#F5EEFB', padding: '2px 7px', borderRadius: 10 }}>
            Datos fiscales ✓
          </span>
        )}
        {lead.presupuesto_estimado ? (
          <span style={{ fontSize: 9, fontWeight: 600, color: '#666', background: '#F4F3EF', padding: '2px 7px', borderRadius: 10 }}>
            {presupuestoLabel(lead.presupuesto_estimado)}
          </span>
        ) : null}
      </div>

      {/* Artefacto (propuesta / contrato) */}
      {propuesta && (
        <div style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
          <strong style={{ fontWeight: 600 }}>{propuesta.numero && propuesta.numero !== 'BORRADOR' ? propuesta.numero : 'Propuesta'}</strong>
          {(() => { const m = PROP_STATUS[propuesta.status ?? 'borrador'] ?? PROP_STATUS.borrador; return (
            <span style={{ fontSize: 9, fontWeight: 600, color: m.color, background: m.bg, padding: '1px 6px', borderRadius: 8 }}>{m.label}</span>
          ) })()}
        </div>
      )}
      {contrato && (
        <div style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
          <strong style={{ fontWeight: 600 }}>{contrato.numero ?? 'Contrato'}</strong>
          {(() => { const m = CONTRATO_STATUS[contrato.status ?? 'borrador'] ?? CONTRATO_STATUS.borrador; return (
            <span style={{ fontSize: 9, fontWeight: 600, color: m.color, background: m.bg, padding: '1px 6px', borderRadius: 8 }}>{m.label}</span>
          ) })()}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {!propuesta && !contrato && (
          <button onClick={onCrearPropuesta} disabled={busy} style={{ ...CARD_BTN, background: '#E8913A', color: '#fff' }}>
            + Propuesta
          </button>
        )}
        {propuesta && !contrato && (
          <>
            <button onClick={onAbrirPropuesta} style={{ ...CARD_BTN, background: '#F0EEE8', color: '#555' }}>Editar</button>
            {propuesta.status === 'borrador' && (
              <button onClick={onEnviarPropuesta} disabled={busy} style={{ ...CARD_BTN, background: '#378ADD', color: '#fff' }}>
                {busy ? 'Enviando…' : 'Enviar'}
              </button>
            )}
          </>
        )}
        {contrato && (
          <button onClick={onAbrirContrato} style={{ ...CARD_BTN, background: '#F0EEE8', color: '#555' }}>Contrato</button>
        )}
        {espacio ? (
          <button onClick={onVerPortal} style={{ ...CARD_BTN, background: '#1A1A1A', color: '#fff' }}>Ver portal</button>
        ) : (
          <button onClick={onCrearEspacio} disabled={busy} style={{ ...CARD_BTN, background: '#F0EEE8', color: '#555' }}>Crear espacio</button>
        )}
        <button onClick={onMarcarPerdido} disabled={busy} style={{ ...CARD_BTN, background: 'transparent', color: '#C0392B', marginLeft: 'auto' }} title="Marcar como perdido">
          Perdido
        </button>
      </div>
    </div>
  )
}

// ── Página principal (Kanban) ───────────────────────────────────────────────────

export default function LeadsPage({
  leads,
  espacios = [],
  propuestas = [],
  contratos = [],
}: {
  leads: Lead[]
  espacios?: EspacioLite[]
  propuestas?: PropuestaLite[]
  contratos?: ContratoLite[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showPerdidos, setShowPerdidos] = useState(false)

  // Modales
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [logEspacio, setLogEspacio] = useState<EspacioLite | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoNota, setNuevoNota] = useState('')
  const [nuevoIdioma, setNuevoIdioma] = useState<'es' | 'en'>('es')
  const [creatingProceso, setCreatingProceso] = useState(false)
  const [nuevoError, setNuevoError] = useState('')

  // Índices por lead_id
  const espacioByLead = useMemo(() => {
    const m = new Map<string, EspacioLite>()
    for (const e of espacios) if (e.lead_id && !m.has(e.lead_id)) m.set(e.lead_id, e)
    return m
  }, [espacios])

  const propuestaByLead = useMemo(() => {
    const m = new Map<string, PropuestaLite>()
    for (const p of propuestas) if (p.lead_id && !m.has(p.lead_id)) m.set(p.lead_id, p) // primera = más reciente (orden desc)
    return m
  }, [propuestas])

  const contratoByLead = useMemo(() => {
    const m = new Map<string, ContratoLite>()
    for (const c of contratos) if (c.lead_id && !m.has(c.lead_id)) m.set(c.lead_id, c)
    return m
  }, [contratos])

  const columna = (lead: Lead): Columna => {
    const c = contratoByLead.get(lead.id)
    const p = propuestaByLead.get(lead.id)
    if (lead.estado_lead === 'ganado' || c?.status === 'firmado') return 'ganados'
    if (c) return 'contratos'
    if (p) return 'propuestas'
    return 'leads'
  }

  const visibles = leads.filter(l => showPerdidos ? l.estado_lead === 'perdido' : l.estado_lead !== 'perdido')
  const perdidosCount = leads.filter(l => l.estado_lead === 'perdido').length

  const cardsByColumn: Record<Columna, CardData[]> = { leads: [], propuestas: [], contratos: [], ganados: [] }
  for (const lead of visibles) {
    const data: CardData = {
      lead,
      espacio:   espacioByLead.get(lead.id),
      propuesta: propuestaByLead.get(lead.id),
      contrato:  contratoByLead.get(lead.id),
    }
    cardsByColumn[columna(lead)].push(data)
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  const refresh = () => startTransition(() => router.refresh())

  const handleUpdateLead = async (id: string, field: string, value: unknown) => {
    await updateLead(id, { [field]: value } as Parameters<typeof updateLead>[1])
    refresh()
  }

  const handleMarcarPerdido = async (lead: Lead) => {
    if (!confirm(`¿Marcar "${lead.nombre}" como perdido? Saldrá del tablero (podrás recuperarlo con "Ver perdidos").`)) return
    setBusyId(lead.id)
    await updateLead(lead.id, { estado_lead: 'perdido' } as Parameters<typeof updateLead>[1])
    setBusyId(null)
    refresh()
  }

  const handleRecuperar = async (lead: Lead) => {
    setBusyId(lead.id)
    await updateLead(lead.id, { estado_lead: 'nuevo' } as Parameters<typeof updateLead>[1])
    setBusyId(null)
    refresh()
  }

  const handleCrearPropuesta = async (lead: Lead) => {
    setBusyId(lead.id)
    const res = await createPropuesta(lead.id, 'lead')
    setBusyId(null)
    if ('id' in res) router.push(`/team/captacion/propuestas/${res.id}`)
    else alert(res.error)
  }

  const handleEnviarPropuesta = async (propuestaId: string, leadId: string) => {
    setBusyId(leadId)
    try {
      const res = await fetch(`/api/propuestas/${propuestaId}/enviar`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) alert(json.error ?? 'No se pudo enviar la propuesta.')
    } finally {
      setBusyId(null)
      refresh()
    }
  }

  const handleCrearEspacio = async (lead: Lead) => {
    const nombre = [lead.nombre, lead.apellidos].filter(Boolean).join(' ') || lead.nombre
    setBusyId(lead.id)
    const res = await createEspacio(nombre, lead.email ?? '', lead.notas ?? '', 'es')
    setBusyId(null)
    if ('error' in res) alert(res.error)
    else refresh()
  }

  const handleNuevoProceso = async () => {
    if (!nuevoNombre.trim()) { setNuevoError('El nombre es obligatorio.'); return }
    setCreatingProceso(true)
    setNuevoError('')
    const res = await createEspacio(nuevoNombre.trim(), nuevoEmail.trim(), nuevoNota.trim(), nuevoIdioma)
    setCreatingProceso(false)
    if ('error' in res) { setNuevoError(res.error); return }
    setShowNuevo(false)
    setNuevoNombre(''); setNuevoEmail(''); setNuevoNota(''); setNuevoIdioma('es')
    refresh()
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 40px 18px', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
            El proceso completo de captación en un tablero: del primer contacto al contrato firmado.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowPerdidos(v => !v)}
            style={{ fontSize: 11, padding: '8px 14px', background: showPerdidos ? '#E53E3E' : '#F0EEE8', color: showPerdidos ? '#fff' : '#666', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
          >
            {showPerdidos ? '← Volver al tablero' : `Ver perdidos${perdidosCount ? ` (${perdidosCount})` : ''}`}
          </button>
          {!showPerdidos && (
            <button
              onClick={() => setShowNuevo(true)}
              style={{ fontSize: 12, padding: '9px 18px', background: '#D85A30', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            >
              + Nuevo proceso de cliente
            </button>
          )}
        </div>
      </div>

      {/* Vista perdidos */}
      {showPerdidos ? (
        <div style={{ padding: '0 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {visibles.length === 0 && <p style={{ color: '#AAA', fontSize: 13 }}>No hay leads perdidos.</p>}
          {visibles.map(lead => (
            <div key={lead.id} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: 12, opacity: 0.85 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{[lead.nombre, lead.apellidos].filter(Boolean).join(' ')}</div>
              {lead.empresa && <div style={{ fontSize: 11, color: '#888' }}>{lead.empresa}</div>}
              {lead.email && <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{lead.email}</div>}
              <button
                onClick={() => handleRecuperar(lead)}
                disabled={busyId === lead.id}
                style={{ ...CARD_BTN, background: '#1D9E75', color: '#fff', marginTop: 10 }}
              >
                Recuperar
              </button>
            </div>
          ))}
        </div>
      ) : (
        // Tablero Kanban
        <div style={{ display: 'flex', gap: 14, padding: '0 40px', overflowX: 'auto', alignItems: 'flex-start' }}>
          {COLUMNS.map(col => {
            const cards = cardsByColumn[col.key]
            return (
              <div key={col.key} style={{ flex: '1 1 0', minWidth: 270, background: '#F8F7F4', borderRadius: 10, padding: 12, border: '1px solid #EFEDE7' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${col.accent}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#444' }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: col.accent }}>{cards.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cards.length === 0 && (
                    <p style={{ fontSize: 11, color: '#BBB', textAlign: 'center', padding: '16px 0', margin: 0 }}>—</p>
                  )}
                  {cards.map(data => (
                    <LeadCard
                      key={data.lead.id}
                      data={data}
                      busy={busyId === data.lead.id || pending}
                      onOpenLead={() => setEditLead(data.lead)}
                      onVerPortal={() => data.espacio && window.open(`/espacio/${data.espacio.token}`, '_blank')}
                      onCrearEspacio={() => handleCrearEspacio(data.lead)}
                      onCrearPropuesta={() => handleCrearPropuesta(data.lead)}
                      onEnviarPropuesta={() => data.propuesta && handleEnviarPropuesta(data.propuesta.id, data.lead.id)}
                      onAbrirPropuesta={() => data.propuesta && router.push(`/team/captacion/propuestas/${data.propuesta.id}`)}
                      onAbrirContrato={() => data.contrato && router.push(`/team/captacion/contratos/${data.contrato.id}`)}
                      onMarcarPerdido={() => handleMarcarPerdido(data.lead)}
                      onVerLogs={() => data.espacio && setLogEspacio(data.espacio)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: accesos (etapa actual + histórico) */}
      {logEspacio && <AccesosModal espacio={logEspacio} onClose={() => setLogEspacio(null)} />}

      {/* Modal: editar lead */}
      {editLead && (
        <div onClick={() => setEditLead(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', zIndex: 100, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 28, width: '100%', maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 400, margin: 0 }}>{[editLead.nombre, editLead.apellidos].filter(Boolean).join(' ') || 'Lead'}</h2>
              <button
                onClick={async () => {
                  if (!confirm('¿Eliminar este lead definitivamente?')) return
                  await deleteLead(editLead.id)
                  setEditLead(null)
                  refresh()
                }}
                style={{ fontSize: 11, color: '#E53E3E', background: 'transparent', border: '1px solid #FCA5A5', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Eliminar
              </button>
            </div>
            <LeadEditForm
              lead={editLead}
              onUpdate={(field, value) => handleUpdateLead(editLead.id, field, value)}
              onClose={() => setEditLead(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: nuevo proceso de cliente */}
      {showNuevo && (
        <div onClick={() => setShowNuevo(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 28, width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 400, margin: '0 0 6px' }}>Nuevo proceso de cliente</h2>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 18px' }}>Crea el lead y su espacio único, y envía el correo de bienvenida.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="Nombre del cliente *" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} style={{ ...FIELD, fontSize: 14 }} />
              <input type="email" placeholder="Email (para enviarle el espacio)" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} style={{ ...FIELD, fontSize: 14 }} />
              <textarea placeholder="Nota interna (opcional)" value={nuevoNota} onChange={e => setNuevoNota(e.target.value)} rows={2} style={{ ...FIELD, fontSize: 14, resize: 'vertical', padding: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                {(['es', 'en'] as const).map(l => (
                  <button key={l} onClick={() => setNuevoIdioma(l)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: nuevoIdioma === l ? '1px solid #D85A30' : '1px solid #E5E2DA', background: nuevoIdioma === l ? '#FDF3EE' : '#fff', color: nuevoIdioma === l ? '#D85A30' : '#888', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
                    {l === 'es' ? 'Español' : 'English'}
                  </button>
                ))}
              </div>
              {nuevoError && <p style={{ fontSize: 12, color: '#E53E3E', margin: 0 }}>{nuevoError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowNuevo(false)} style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #E5E2DA', background: '#fff', color: '#888', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancelar</button>
                <button onClick={handleNuevoProceso} disabled={creatingProceso} style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: '#D85A30', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                  {creatingProceso ? 'Creando…' : 'Crear y enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

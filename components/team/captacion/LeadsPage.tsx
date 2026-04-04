'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addLead, updateLead, deleteLead } from '@/app/actions/leads'
import { createContrato } from '@/app/actions/contratos'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  // Lead-specific
  origen: string | null
  estado_lead: string | null
  interes: string | null
  presupuesto_estimado: number | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '10px 16px', fontSize: 9, fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA',
  textAlign: 'left', borderBottom: '1px solid #E8E6E0', whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '12px 16px', fontSize: 12, color: '#2A2A2A',
  verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8',
}

const FIELD: React.CSSProperties = {
  background: '#FFF8F0', border: '1px solid #E8913A',
  borderRadius: 4, padding: '4px 8px', fontSize: 12,
  color: '#1A1A1A', fontFamily: 'inherit', outline: 'none', width: '100%',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function presupuestoLabel(n: number | null) {
  if (!n) return null
  return `€ ${new Intl.NumberFormat('es-ES').format(n)}`
}

function leadLabel(l: Lead) {
  const nombre = [l.nombre, l.apellidos].filter(Boolean).join(' ')
  return l.empresa ? `${nombre} · ${l.empresa}` : nombre
}

// ── Lead edit form (controlled, defined at module level to avoid remount) ──────

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
  const [nombre,               setNombre]               = useState(lead.nombre ?? '')
  const [apellidos,            setApellidos]            = useState(lead.apellidos ?? '')
  const [empresa,              setEmpresa]              = useState(lead.empresa ?? '')
  const [nif,                  setNif]                  = useState(lead.nif_cif ?? '')
  const [email,                setEmail]                = useState(lead.email ?? '')
  const [emailCc,              setEmailCc]              = useState(lead.email_cc ?? '')
  const [telefono,             setTelefono]             = useState(lead.telefono ?? '')
  const [telefonoAlt,          setTelefonoAlt]          = useState(lead.telefono_alt ?? '')
  const [direccion,            setDireccion]            = useState(lead.direccion ?? '')
  const [ciudad,               setCiudad]               = useState(lead.ciudad ?? '')
  const [cp,                   setCp]                   = useState(lead.codigo_postal ?? '')
  const [pais,                 setPais]                 = useState(lead.pais ?? '')
  const [dirFac,               setDirFac]               = useState(lead.direccion_facturacion ?? '')
  const [tipoFac,              setTipoFac]              = useState(lead.tipo_facturacion ?? '')
  const [fechaNac,             setFechaNac]             = useState(lead.fecha_nacimiento ?? '')
  const [interes,              setInteres]              = useState(lead.interes ?? '')
  const [presupuesto,          setPresupuesto]          = useState(lead.presupuesto_estimado != null ? String(lead.presupuesto_estimado) : '')
  const [estadoLead,           setEstadoLead]           = useState(lead.estado_lead ?? 'nuevo')
  const [origen,               setOrigen]               = useState(lead.origen ?? '')
  const [notas,                setNotas]                = useState(lead.notas ?? '')

  const save = (field: string, value: unknown) => onUpdate(field, value)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px 28px' }}>

      {/* Lead info */}
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

      <LF label="Presupuesto estimado (€)">
        <input type="number" min={0} value={presupuesto} onChange={e => setPresupuesto(e.target.value)} onBlur={e => save('presupuesto_estimado', e.target.value ? parseFloat(e.target.value) : null)} style={FIELD} />
      </LF>

      {/* Datos personales */}
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

      {/* Contacto */}
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

      {/* Dirección */}
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

      {/* Facturación */}
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
      <div />

      {/* Notas */}
      <div style={{ gridColumn: '1 / -1' }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 4px' }}>Notas</p>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} onBlur={e => save('notas', e.target.value || null)} rows={3} style={{ ...FIELD, resize: 'vertical', padding: '8px' }} />
      </div>

      {/* Actions */}
      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
        <button
          onClick={onClose}
          style={{ height: 32, padding: '0 16px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#333' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  lead: Lead
  expanded: boolean
  onToggle: () => void
  onUpdate: (field: string, value: unknown) => void
  onDelete: () => void
}) {
  const meta = ESTADO_META[lead.estado_lead ?? 'nuevo'] ?? ESTADO_META.nuevo

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <td style={{ ...TD, paddingLeft: 12 }}>
          <span style={{ fontSize: 10, color: '#AAA', marginRight: 8 }}>{expanded ? '▾' : '▸'}</span>
        </td>
        <td style={TD}>
          <div style={{ fontWeight: 500 }}>{lead.nombre} {lead.apellidos}</div>
          {lead.empresa && <div style={{ fontSize: 11, color: '#888' }}>{lead.empresa}</div>}
        </td>
        <td style={TD}>{lead.email ?? <span style={{ color: '#CCC' }}>—</span>}</td>
        <td style={TD}>{lead.telefono ?? <span style={{ color: '#CCC' }}>—</span>}</td>
        <td style={TD}>{lead.ciudad ?? <span style={{ color: '#CCC' }}>—</span>}</td>
        <td style={TD}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 3 }}>
            {meta.label}
          </span>
        </td>
        <td style={TD}>{lead.origen ?? <span style={{ color: '#CCC' }}>—</span>}</td>
        <td style={TD}>{presupuestoLabel(lead.presupuesto_estimado) ?? <span style={{ color: '#CCC' }}>—</span>}</td>
        <td style={{ ...TD, padding: '0 8px' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DDD', fontSize: 15, padding: '4px 6px', borderRadius: 3 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}
          >×</button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: '20px 24px 24px 40px', background: '#FAFAF8', borderBottom: '2px solid #E8E6E0' }}>
            <LeadEditForm lead={lead} onUpdate={onUpdate} onClose={onToggle} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LeadsPage({ leads: initial }: { leads: Lead[] }) {
  const router = useRouter()
  const [leads, setLeads] = useState(initial)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [, startTransition] = useTransition()

  const handleAdd = async () => {
    setAdding(true)
    setAddError(null)
    const res = await addLead()
    setAdding(false)
    if ('error' in res) {
      setAddError(res.error)
      return
    }
    setLeads(prev => [{
      id: res.id, nombre: 'Nuevo lead', apellidos: null, empresa: null,
      email: null, email_cc: null, telefono: null, telefono_alt: null,
      nif_cif: null, documento_identidad: null, direccion: null,
      ciudad: null, codigo_postal: null, pais: null,
      direccion_facturacion: null, notas_facturacion: null, tipo_facturacion: null,
      notas: null, fecha_nacimiento: null, origen: null,
      estado_lead: 'nuevo', interes: null, presupuesto_estimado: null,
    }, ...prev])
    setExpandedId(res.id)
  }

  const handleUpdate = (id: string, field: string, value: unknown) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    startTransition(async () => {
      const res = await updateLead(id, { [field]: value } as Parameters<typeof updateLead>[1])
      if ('error' in res) {
        alert(`Error al guardar: ${res.error}`)
      }
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este lead?')) return
    setLeads(prev => prev.filter(l => l.id !== id))
    startTransition(async () => {
      await deleteLead(id)
      router.refresh()
    })
  }

  const handleCreateContrato = (leadId: string) => {
    startTransition(async () => {
      const res = await createContrato(leadId)
      if ('id' in res) {
        router.push(`/team/captacion/contratos/${res.id}`)
      }
    })
  }

  const filtered = leads.filter(l => {
    const text = query.toLowerCase()
    const matchText = !text || leadLabel(l).toLowerCase().includes(text) ||
      l.email?.toLowerCase().includes(text) || l.ciudad?.toLowerCase().includes(text)
    const matchEstado = !estadoFilter || l.estado_lead === estadoFilter
    return matchText && matchEstado
  })

  const countsByEstado = ESTADO_ORDER.reduce((acc, e) => {
    acc[e] = leads.filter(l => (l.estado_lead ?? 'nuevo') === e).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 24px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Captación
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Leads
          </h1>
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{ height: 36, padding: '0 20px', background: adding ? '#888' : '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, cursor: adding ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: adding ? 0.7 : 1 }}
            onMouseEnter={e => { if (!adding) (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
            onMouseLeave={e => { if (!adding) (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
          >
            {adding ? 'Creando…' : '+ Nuevo lead'}
          </button>
        </div>

        {addError && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span><strong>Error:</strong> {addError}</span>
            <button onClick={() => setAddError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Estado pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setEstadoFilter('')}
            style={{
              fontSize: 10, fontWeight: estadoFilter === '' ? 700 : 400,
              background: estadoFilter === '' ? '#1A1A1A' : '#F0EEE8',
              color: estadoFilter === '' ? '#fff' : '#888',
              border: 'none', borderRadius: 12, padding: '4px 12px', cursor: 'pointer',
            }}
          >
            Todos ({leads.length})
          </button>
          {ESTADO_ORDER.map(e => {
            const meta = ESTADO_META[e]
            const active = estadoFilter === e
            return (
              <button key={e}
                onClick={() => setEstadoFilter(active ? '' : e)}
                style={{
                  fontSize: 10, fontWeight: active ? 700 : 400,
                  background: active ? meta.color : meta.bg,
                  color: active ? '#fff' : meta.color,
                  border: 'none', borderRadius: 12, padding: '4px 12px', cursor: 'pointer',
                }}
              >
                {meta.label} ({countsByEstado[e] ?? 0})
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '16px 40px', background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
        <input
          type="search"
          placeholder="Buscar por nombre, email, ciudad…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, height: 34, padding: '0 12px',
            fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 4,
            background: '#fff', fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ padding: '24px 40px' }}>
        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F7F4' }}>
                <th style={{ ...TH, width: 28 }} />
                <th style={TH}>Nombre / Empresa</th>
                <th style={TH}>Email</th>
                <th style={TH}>Teléfono</th>
                <th style={TH}>Ciudad</th>
                <th style={TH}>Estado</th>
                <th style={TH}>Origen</th>
                <th style={TH}>Presupuesto</th>
                <th style={{ ...TH, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...TD, textAlign: 'center', color: '#CCC', fontStyle: 'italic', padding: '40px 0', borderBottom: 'none' }}>
                    {leads.length === 0 ? 'No hay leads todavía. Pulsa "+ Nuevo lead" para empezar.' : 'Sin resultados para la búsqueda actual.'}
                  </td>
                </tr>
              )}
              {filtered.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  expanded={expandedId === lead.id}
                  onToggle={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                  onUpdate={(field, value) => handleUpdate(lead.id, field, value)}
                  onDelete={() => handleDelete(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 10, color: '#CCC', marginTop: 12, textAlign: 'right' }}>
          {filtered.length} de {leads.length} leads
        </p>
      </div>
    </div>
  )
}

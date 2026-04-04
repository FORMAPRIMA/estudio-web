'use client'

import React, { useState, useTransition, useMemo, useEffect } from 'react'
import { addCliente, updateCliente, deleteCliente } from '@/app/actions/clientes'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProyectoMin {
  id:     string
  nombre: string
  codigo: string | null
  status: string
}

interface Cliente {
  id:                    string
  nombre:                string
  apellidos:             string | null
  documento_identidad:   string | null
  direccion:             string | null
  ciudad:                string | null
  codigo_postal:         string | null
  pais:                  string | null
  email:                 string | null
  email_cc:              string | null
  telefono:              string | null
  telefono_alt:          string | null
  tipo_facturacion:      string | null
  empresa:               string | null
  nif_cif:               string | null
  direccion_facturacion: string | null
  notas_facturacion:     string | null
  notas:                 string | null
  fecha_nacimiento:      string | null
  created_at:            string
  proyectos:             ProyectoMin[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  activo:    '#D85A30',
  on_hold:   '#378ADD',
  terminado: '#1D9E75',
  archivado: '#999',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '10px 16px', fontSize: 9, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.07)', textAlign: 'left',
}
const TD: React.CSSProperties = {
  padding: '13px 16px', fontSize: 12, color: '#2A2A2A',
  verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8',
}

// ── FieldInput — purely presentational, state lives in parent ─────────────────

function FieldInput({
  label, value, onChange, type = 'text', placeholder,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  type?:        string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  // Keep draft in sync when parent resets value (e.g. after save)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    onChange(draft)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B8B4AC', margin: '0 0 3px' }}>
          {label}
        </p>
      )}
      {editing ? (
        type === 'textarea' ? (
          <textarea
            autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            rows={3}
            style={{ width: '100%', fontSize: 12, color: '#1A1A1A', border: '1px solid #D85A30', borderRadius: 3, padding: '5px 8px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', background: '#fff', boxSizing: 'border-box' }}
          />
        ) : (
          <input
            autoFocus type={type} value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') { setDraft(value); setEditing(false) }
            }}
            style={{ width: '100%', fontSize: 12, color: '#1A1A1A', border: '1px solid #D85A30', borderRadius: 3, padding: '5px 8px', outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
          />
        )
      ) : (
        <p
          onClick={() => { setDraft(value); setEditing(true) }}
          style={{ fontSize: 12, color: value ? '#1A1A1A' : '#CCC', margin: 0, cursor: 'text', padding: '3px 0', borderBottom: '1px dashed transparent', minHeight: 21 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = '#DDD' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent' }}
        >
          {value || (placeholder ?? '—')}
        </p>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #EDE9E3' }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D85A30', margin: 0 }}>
        {label}
      </p>
      {right}
    </div>
  )
}

// ── TipoToggle ─────────────────────────────────────────────────────────────────

function TipoToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', border: '1px solid #E8E6E0', borderRadius: 4, overflow: 'hidden' }}>
      {[['fisica', 'Persona física'], ['juridica', 'Persona jurídica']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            flex: 1, padding: '4px 10px', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
            border: 'none', transition: 'all 0.15s',
            background: value === key ? '#1A1A1A' : 'transparent',
            color:      value === key ? '#fff'    : '#AAA',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── ClienteRow ────────────────────────────────────────────────────────────────

type FieldDraft = {
  nombre:                string
  apellidos:             string
  documento_identidad:   string
  direccion:             string
  ciudad:                string
  codigo_postal:         string
  pais:                  string
  email:                 string
  email_cc:              string
  telefono:              string
  telefono_alt:          string
  tipo_facturacion:      string
  empresa:               string
  nif_cif:               string
  direccion_facturacion: string
  notas_facturacion:     string
  notas:                 string
  fecha_nacimiento:      string
}

function toNullable(v: string): string | null {
  return v.trim() === '' ? null : v.trim()
}

function ClienteRow({ cliente, isExpanded, onToggle }: {
  cliente:    Cliente
  isExpanded: boolean
  onToggle:   () => void
}) {
  const [, startTransition] = useTransition()

  // All field values live here — single source of truth for this row
  const [fields, setFields] = useState<FieldDraft>({
    nombre:                cliente.nombre,
    apellidos:             cliente.apellidos             ?? '',
    documento_identidad:   cliente.documento_identidad   ?? '',
    direccion:             cliente.direccion              ?? '',
    ciudad:                cliente.ciudad                ?? '',
    codigo_postal:         cliente.codigo_postal         ?? '',
    pais:                  cliente.pais                  ?? '',
    email:                 cliente.email                 ?? '',
    email_cc:              cliente.email_cc              ?? '',
    telefono:              cliente.telefono              ?? '',
    telefono_alt:          cliente.telefono_alt          ?? '',
    tipo_facturacion:      cliente.tipo_facturacion      ?? 'fisica',
    empresa:               cliente.empresa               ?? '',
    nif_cif:               cliente.nif_cif               ?? '',
    direccion_facturacion: cliente.direccion_facturacion ?? '',
    notas_facturacion:     cliente.notas_facturacion     ?? '',
    notas:                 cliente.notas                 ?? '',
    fecha_nacimiento:      cliente.fecha_nacimiento       ?? '',
  })

  const set = (key: keyof FieldDraft) => (v: string) =>
    setFields(prev => ({ ...prev, [key]: v }))

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaveState('saving')
    setSaveError(null)
    let result: { success: true } | { error: string }
    try {
      result = await updateCliente(cliente.id, {
        nombre:                fields.nombre.trim() || 'Nuevo cliente',
        apellidos:             toNullable(fields.apellidos),
        documento_identidad:   toNullable(fields.documento_identidad),
        direccion:             toNullable(fields.direccion),
        ciudad:                toNullable(fields.ciudad),
        codigo_postal:         toNullable(fields.codigo_postal),
        pais:                  toNullable(fields.pais),
        email:                 toNullable(fields.email),
        email_cc:              toNullable(fields.email_cc),
        telefono:              toNullable(fields.telefono),
        telefono_alt:          toNullable(fields.telefono_alt),
        tipo_facturacion:      fields.tipo_facturacion,
        empresa:               toNullable(fields.empresa),
        nif_cif:               toNullable(fields.nif_cif),
        direccion_facturacion: toNullable(fields.direccion_facturacion),
        notas_facturacion:     toNullable(fields.notas_facturacion),
        notas:                 toNullable(fields.notas),
        fecha_nacimiento:      toNullable(fields.fecha_nacimiento),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[handleSave] excepción no capturada:', msg)
      setSaveState('error')
      setSaveError(msg)
      window.alert(`Error al guardar: ${msg}`)
      return
    }
    if ('error' in result) {
      console.error('[handleSave] error del servidor:', result.error)
      setSaveState('error')
      setSaveError(result.error)
      window.alert(`Error al guardar: ${result.error}`)
      return
    }
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2500)
  }

  const handleDelete = () => {
    if (!confirm(`¿Eliminar a ${fields.nombre || cliente.nombre}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => { await deleteCliente(cliente.id) })
  }

  const displayName = [fields.nombre, fields.apellidos].filter(Boolean).join(' ')

  return (
    <>
      {/* Main row */}
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', background: isExpanded ? '#FAFAF8' : 'transparent' }}
        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <td style={{ ...TD, paddingLeft: 8, width: 32 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#D85A30', transition: 'transform 0.15s', transform: isExpanded ? 'scale(1.4)' : 'scale(1)' }} />
        </td>
        <td style={{ ...TD }}>
          <div>
            <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{displayName || 'Nuevo cliente'}</span>
            {fields.empresa && (
              <span style={{ fontSize: 10, color: '#AAA', marginLeft: 8 }}>{fields.empresa}</span>
            )}
          </div>
        </td>
        <td style={{ ...TD, color: '#666' }}>{fields.nif_cif || '—'}</td>
        <td style={{ ...TD }}>
          {fields.email
            ? <a href={`mailto:${fields.email}`} onClick={e => e.stopPropagation()} style={{ color: '#378ADD', textDecoration: 'none', fontSize: 11 }}>{fields.email}</a>
            : <span style={{ color: '#CCC' }}>—</span>}
        </td>
        <td style={{ ...TD, color: '#666' }}>{fields.telefono || '—'}</td>
        <td style={{ ...TD, textAlign: 'center' }}>
          {cliente.proyectos.length > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 600, background: '#F0EEE8', color: '#888', padding: '2px 8px', borderRadius: 10 }}>
              {cliente.proyectos.length}
            </span>
          ) : (
            <span style={{ color: '#DDD', fontSize: 10 }}>—</span>
          )}
        </td>
        <td style={{ ...TD, textAlign: 'right' }}>
          <button
            onClick={e => { e.stopPropagation(); handleDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#CCC', padding: '0 4px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
            title="Eliminar cliente"
          >×</button>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0, borderBottom: '2px solid #E8E6E0' }}>
            <div style={{ background: '#FAFAF8' }}>

              {/* ── Personal | Contacto ───────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

                <div style={{ padding: '20px 24px', borderRight: '1px solid #EDEBE7', borderBottom: '1px solid #EDEBE7' }}>
                  <SectionHeader label="Datos personales" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <div>
                      <FieldInput label="Nombre" value={fields.nombre} onChange={set('nombre')} />
                      <FieldInput label="Apellidos" value={fields.apellidos} onChange={set('apellidos')} placeholder="Sin apellidos" />
                      <FieldInput label="Pasaporte / DNI / NIE" value={fields.documento_identidad} onChange={set('documento_identidad')} placeholder="Sin documento" />
                      <FieldInput label="Fecha de nacimiento" value={fields.fecha_nacimiento} onChange={set('fecha_nacimiento')} type="date" placeholder="" />
                    </div>
                    <div>
                      <FieldInput label="Dirección residencial" value={fields.direccion} onChange={set('direccion')} placeholder="Sin dirección" />
                      <FieldInput label="Ciudad" value={fields.ciudad} onChange={set('ciudad')} placeholder="Sin ciudad" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                        <FieldInput label="Código postal" value={fields.codigo_postal} onChange={set('codigo_postal')} placeholder="CP" />
                        <FieldInput label="País" value={fields.pais} onChange={set('pais')} placeholder="España" />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDEBE7' }}>
                  <SectionHeader label="Contacto" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <div>
                      <FieldInput label="Email principal" value={fields.email} onChange={set('email')} type="email" placeholder="Sin email" />
                      <FieldInput label="Email secundario" value={fields.email_cc} onChange={set('email_cc')} type="email" placeholder="Sin email CC" />
                    </div>
                    <div>
                      <FieldInput label="Teléfono principal" value={fields.telefono} onChange={set('telefono')} type="tel" placeholder="Sin teléfono" />
                      <FieldInput label="Teléfono alternativo" value={fields.telefono_alt} onChange={set('telefono_alt')} type="tel" placeholder="Sin teléfono alt." />
                    </div>
                  </div>
                </div>

              </div>

              {/* ── Facturación ───────────────────────────────────────────── */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDEBE7' }}>
                <SectionHeader
                  label="Facturación"
                  right={<TipoToggle value={fields.tipo_facturacion} onChange={set('tipo_facturacion')} />}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div>
                    <FieldInput
                      label={fields.tipo_facturacion === 'juridica' ? 'Razón social / Empresa' : 'Nombre para facturación'}
                      value={fields.empresa}
                      onChange={set('empresa')}
                      placeholder={fields.tipo_facturacion === 'juridica' ? 'Nombre de la empresa' : 'Nombre y apellidos completos'}
                    />
                    <FieldInput
                      label={fields.tipo_facturacion === 'juridica' ? 'CIF' : 'NIF / NIE'}
                      value={fields.nif_cif}
                      onChange={set('nif_cif')}
                      placeholder="Sin NIF/CIF"
                    />
                  </div>
                  <div>
                    <FieldInput
                      label="Dirección fiscal"
                      value={fields.direccion_facturacion}
                      onChange={set('direccion_facturacion')}
                      placeholder="Si difiere de la residencial"
                    />
                    <FieldInput
                      label="Notas de facturación"
                      value={fields.notas_facturacion}
                      onChange={set('notas_facturacion')}
                      type="textarea"
                      placeholder="Condiciones especiales, forma de pago…"
                    />
                  </div>
                </div>
              </div>

              {/* ── Notas + Proyectos + Guardar ───────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: cliente.proyectos.length > 0 ? '1fr 1fr' : '1fr', gap: 0 }}>

                <div style={{ padding: '20px 24px', borderRight: cliente.proyectos.length > 0 ? '1px solid #EDEBE7' : 'none' }}>
                  <SectionHeader label="Notas generales" />
                  <FieldInput
                    label=""
                    value={fields.notas}
                    onChange={set('notas')}
                    type="textarea"
                    placeholder="Observaciones, preferencias, historial relevante…"
                  />
                </div>

                {cliente.proyectos.length > 0 && (
                  <div style={{ padding: '20px 24px' }}>
                    <SectionHeader label="Proyectos asociados" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {cliente.proyectos.map(p => (
                        <span key={p.id} style={{
                          fontSize: 10, padding: '4px 10px',
                          background: `${STATUS_COLOR[p.status] ?? '#999'}14`,
                          color: STATUS_COLOR[p.status] ?? '#999',
                          border: `1px solid ${STATUS_COLOR[p.status] ?? '#999'}2A`,
                          fontWeight: 500, borderRadius: 3,
                        }}>
                          {p.codigo ? `${p.codigo} · ` : ''}{p.nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer: save button ───────────────────────────────────── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
                padding: '14px 24px', borderTop: '1px solid #EDEBE7', background: '#F5F3EF',
              }}>
                {saveState === 'error' && saveError && (
                  <span style={{ fontSize: 11, color: '#E53E3E', flex: 1 }}>
                    Error: {saveError}
                  </span>
                )}
                {saveState === 'saved' && (
                  <span style={{ fontSize: 11, color: '#1D9E75', flex: 1 }}>
                    ✓ Cambios guardados
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  style={{
                    height: 34, padding: '0 20px',
                    background: saveState === 'saved' ? '#1D9E75' : '#1A1A1A',
                    color: '#fff', border: 'none', borderRadius: 5, cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                    opacity: saveState === 'saving' ? 0.6 : 1, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (saveState !== 'saving') (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = saveState === 'saved' ? '#1D9E75' : '#1A1A1A' }}
                >
                  {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? '✓ Guardado' : 'Guardar ficha'}
                </button>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ClientesBDPage({ clientes: initial }: { clientes: Cliente[] }) {
  const [clientes,  setClientes]  = useState(initial)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [query,     setQuery]     = useState('')
  const [adding,    setAdding]    = useState(false)
  const [addError,  setAddError]  = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter(c =>
      [c.nombre, c.apellidos, c.empresa, c.email, c.telefono, c.nif_cif]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [clientes, query])

  const handleAdd = async () => {
    if (adding) return
    setAdding(true)
    setAddError(null)
    const res = await addCliente()
    setAdding(false)
    if ('error' in res) { setAddError(res.error); return }
    const newCliente: Cliente = {
      id: res.id, nombre: 'Nuevo cliente', apellidos: null,
      documento_identidad: null, direccion: null, ciudad: null,
      codigo_postal: null, pais: null,
      email: null, email_cc: null, telefono: null, telefono_alt: null,
      tipo_facturacion: 'fisica', empresa: null, nif_cif: null,
      direccion_facturacion: null, notas_facturacion: null, notas: null,
      fecha_nacimiento: null,
      created_at: new Date().toISOString(), proyectos: [],
    }
    startTransition(() => {
      setClientes(prev => [newCliente, ...prev])
      setExpanded(res.id)
    })
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Clientes
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Base de datos
          </h1>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            placeholder="Buscar por nombre, empresa, email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, height: 36, padding: '0 14px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A', background: '#fff' }}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{
              height: 36, padding: '0 18px', background: adding ? '#888' : '#1A1A1A', color: '#fff',
              border: 'none', borderRadius: 6, cursor: adding ? 'not-allowed' : 'pointer',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: adding ? 0.7 : 1, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!adding) (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
            onMouseLeave={e => { if (!adding) (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
          >
            {adding ? 'Creando…' : '+ Nuevo cliente'}
          </button>
        </div>
        {addError && (
          <p style={{ marginTop: 10, fontSize: 11, color: '#E53E3E', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 4, padding: '6px 12px' }}>
            Error: {addError}
          </p>
        )}
      </div>

      {/* Table */}
      <div style={{ padding: '28px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#CCC', fontSize: 13 }}>
            {query ? 'Sin resultados para esa búsqueda' : 'No hay clientes — pulsa "Nuevo cliente" para empezar'}
          </div>
        ) : (
          <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  <th style={{ ...TH, width: 32, paddingLeft: 8 }} />
                  <th style={{ ...TH }}>Nombre / Empresa</th>
                  <th style={{ ...TH, width: 130 }}>NIF / CIF</th>
                  <th style={{ ...TH, width: 220 }}>Email</th>
                  <th style={{ ...TH, width: 150 }}>Teléfono</th>
                  <th style={{ ...TH, textAlign: 'center', width: 90 }}>Proyectos</th>
                  <th style={{ ...TH, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <ClienteRow
                    key={c.id}
                    cliente={c}
                    isExpanded={expanded === c.id}
                    onToggle={() => setExpanded(prev => prev === c.id ? null : c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

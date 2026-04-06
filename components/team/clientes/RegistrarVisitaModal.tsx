'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getContactosParaVisita, crearActaVisita, compartirActaPorEmail } from '@/app/actions/actas'
import type { ContactosParaVisita, AsistenteInput } from '@/app/actions/actas'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitaCreated {
  id: string
  fecha: string
  titulo: string | null
  asistentes: string | null
  notas: string | null
  acta_url: string
  floorfy_url: string | null
  visible_cliente: boolean
}

interface Props {
  proyecto: {
    id: string
    nombre: string
    codigo: string | null
    direccion: string | null
  }
  constructor: { id: string; nombre: string } | null
  onClose: () => void
  onCreated: (visita: VisitaCreated) => void
}

type TipoAsistente = 'equipo' | 'cliente' | 'proveedor' | 'externo'

interface EmailRecipient {
  id: string
  nombre: string
  email: string | null
  grupo: 'cliente_proyecto' | 'constructor' | 'asistente'
  preChecked: boolean
}

interface AsistenteSeleccionado {
  id: string
  nombre: string
  tipo: TipoAsistente
}

// ── Color palette ─────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<TipoAsistente, string> = {
  equipo:    '#378ADD',
  cliente:   '#D85A30',
  proveedor: '#1D9E75',
  externo:   '#888888',
}

const TIPO_BG: Record<TipoAsistente, string> = {
  equipo:    '#EEF4FD',
  cliente:   '#FDF3EE',
  proveedor: '#EEF8F4',
  externo:   '#F4F4F4',
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fmtDateEs(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  const mes = MESES_ES[parseInt(m, 10) - 1] ?? m
  return `${parseInt(day, 10)} de ${mes} de ${y}`
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const S = {
  label:      { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:      { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const },
  textarea:   { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const },
  btnPrimary: { padding: '9px 20px', background: '#D85A30', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 as const },
  btnGhost:   { padding: '8px 16px', background: 'none', color: '#888', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  btnDark:    { padding: '9px 20px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 as const },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegistrarVisitaModal({ proyecto, constructor: proyectoConstructor, onClose, onCreated }: Props) {
  const today = new Date().toISOString().split('T')[0]

  // Step
  const [step, setStep] = useState<'form' | 'preview' | 'emails'>('form')

  // Form state
  const [fecha, setFecha] = useState(today)
  const [titulo, setTitulo] = useState(`Visita de obra — ${proyecto.nombre}`)
  const [estadoObras, setEstadoObras] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [floorfyUrl, setFloorfyUrl] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [compartirCliente, setCompartirCliente] = useState(true)
  const [compartirConstructor, setCompartirConstructor] = useState(true)

  // Asistentes
  const [asistentesSeleccionados, setAsistentesSeleccionados] = useState<AsistenteSeleccionado[]>([])
  const [busquedaAsistente, setBusquedaAsistente] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Contacts
  const [contacts, setContacts] = useState<ContactosParaVisita | null>(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Email recipients step
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([])

  // Load contacts on mount
  useEffect(() => {
    getContactosParaVisita(proyecto.id).then(res => {
      if (!('error' in res)) setContacts(res)
    })
  }, [proyecto.id])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectedIds = new Set(asistentesSeleccionados.map(a => a.id))

  const allContacts: Array<{ id: string; nombre: string; tipo: TipoAsistente }> = [
    ...(contacts?.equipo ?? []).map(e => ({
      id: e.id,
      nombre: `${e.nombre}${e.apellido ? ' ' + e.apellido : ''}`,
      tipo: 'equipo' as const,
    })),
    ...(contacts?.clientes ?? []).map(c => ({
      id: c.id,
      nombre: `${c.nombre}${c.apellidos ? ' ' + c.apellidos : ''}`,
      tipo: 'cliente' as const,
    })),
    ...(contacts?.proveedores ?? []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      tipo: 'proveedor' as const,
    })),
  ]

  const query = busquedaAsistente.trim().toLowerCase()
  const filteredContacts = query
    ? allContacts.filter(c => c.nombre.toLowerCase().includes(query) && !selectedIds.has(c.id))
    : allContacts.filter(c => !selectedIds.has(c.id))

  const showAddExterno = query.length > 0 && !allContacts.some(c => c.nombre.toLowerCase() === query)

  const addAsistente = (contact: { id: string; nombre: string; tipo: TipoAsistente }) => {
    setAsistentesSeleccionados(prev => [...prev, contact])
    setBusquedaAsistente('')
    inputRef.current?.focus()
  }

  const addExterno = () => {
    const nombre = busquedaAsistente.trim()
    if (!nombre) return
    setAsistentesSeleccionados(prev => [...prev, {
      id: `externo-${Date.now()}-${Math.random()}`,
      nombre,
      tipo: 'externo',
    }])
    setBusquedaAsistente('')
    inputRef.current?.focus()
  }

  const removeAsistente = (id: string) => {
    setAsistentesSeleccionados(prev => prev.filter(a => a.id !== id))
  }

  // ── Build email recipient list ────────────────────────────────────────────

  const buildRecipients = (): EmailRecipient[] => {
    const seen = new Set<string>()
    const list: EmailRecipient[] = []

    const add = (r: EmailRecipient) => {
      // Allow null-email entries (shown as disabled/warning in UI)
      if (r.email && seen.has(r.email.toLowerCase())) return
      if (r.email) seen.add(r.email.toLowerCase())
      list.push(r)
    }

    // 1 — Project clients (if compartirCliente)
    if (compartirCliente && contacts) {
      contacts.clientes.forEach(c => {
        if (!c.email) return
        const nombre = `${c.nombre}${c.apellidos ? ' ' + c.apellidos : ''}`
        add({
          id: `cli-${c.id}`,
          nombre,
          email: c.email,
          grupo: 'cliente_proyecto',
          preChecked: true,
        })
        // Secondary email (CC) — always pre-checked when present
        if (c.email_cc) {
          add({
            id: `cli-cc-${c.id}`,
            nombre: `${nombre} (CC)`,
            email: c.email_cc,
            grupo: 'cliente_proyecto',
            preChecked: true,
          })
        }
      })
    }

    // 2 — Constructor (if compartirConstructor, always show; email may be null)
    if (compartirConstructor && proyectoConstructor) {
      const provEmail = contacts?.proveedores.find(p => p.id === proyectoConstructor.id)?.email ?? null
      add({
        id: `cons-${proyectoConstructor.id}`,
        nombre: proyectoConstructor.nombre,
        email: provEmail,
        grupo: 'constructor',
        preChecked: !!provEmail,
      })
    }

    // 3 — Selected attendees with emails
    if (contacts) {
      asistentesSeleccionados.forEach(a => {
        if (a.tipo === 'equipo') {
          const m = contacts.equipo.find(e => e.id === a.id)
          if (m?.email) add({ id: `eq-${m.id}`, nombre: a.nombre, email: m.email, grupo: 'asistente', preChecked: true })
        } else if (a.tipo === 'cliente') {
          const c = contacts.clientes.find(x => x.id === a.id)
          if (c?.email) add({ id: `cli-asist-${c.id}`, nombre: a.nombre, email: c.email, grupo: 'asistente', preChecked: true })
          if (c?.email_cc) add({ id: `cli-asist-cc-${c.id}`, nombre: `${a.nombre} (CC)`, email: c.email_cc, grupo: 'asistente', preChecked: true })
        } else if (a.tipo === 'proveedor') {
          const p = contacts.proveedores.find(x => x.id === a.id)
          if (p?.email) add({ id: `prov-${p.id}`, nombre: a.nombre, email: p.email, grupo: 'asistente', preChecked: true })
        }
      })
    }

    return list
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)

    const asistentesInput: AsistenteInput[] = asistentesSeleccionados.map(a => ({
      nombre: a.nombre,
      tipo: a.tipo,
    }))

    // 1 — Create acta + generate PDF
    const res = await crearActaVisita({
      proyecto_id:        proyecto.id,
      fecha,
      titulo,
      asistentes:         asistentesInput,
      estado_obras:       estadoObras,
      instrucciones,
      floorfy_url:        floorfyUrl.trim() || null,
      visible_cliente:    compartirCliente,
      proyecto_nombre:    proyecto.nombre,
      proyecto_codigo:    proyecto.codigo,
      proyecto_direccion: proyecto.direccion,
    })

    if (!res || 'error' in res) {
      setSaving(false)
      setError(res?.error ?? 'Error inesperado al generar el acta.')
      return
    }

    // 2 — Send emails to checked recipients
    const checkedRecipients = emailRecipients.filter(r => r.preChecked && r.email)
    const checkedEmails = checkedRecipients.map(r => r.email as string)

    // Client names for greeting — primary entries only (exclude "(CC)" duplicates)
    const clienteNombres = checkedRecipients
      .filter(r => r.grupo === 'cliente_proyecto' && !r.id.startsWith('cli-cc-'))
      .map(r => r.nombre.split(' ')[0]) // first name only
      .filter(Boolean)

    if (checkedEmails.length > 0) {
      const asistenteStr = asistentesSeleccionados.map(a => a.nombre).join(', ')
      await compartirActaPorEmail({
        emails:          checkedEmails,
        clienteNombres,
        proyecto_id:     proyecto.id,
        proyecto_nombre: proyecto.nombre,
        proyecto_codigo: proyecto.codigo,
        fecha,
        titulo,
        acta_url:        res.acta_url,
        asistentes:      asistenteStr || null,
        estado_obras:    estadoObras,
        instrucciones,
        floorfy_url:     floorfyUrl.trim() || null,
      })
    }

    setSaving(false)

    // 3 — Notify parent
    const asistenteStr = asistentesSeleccionados.map(a => a.nombre).join(', ')
    const notas = ['ESTADO DE OBRAS', estadoObras, '', 'INSTRUCCIONES', instrucciones].join('\n')

    onCreated({
      id:              res.id,
      fecha,
      titulo:          titulo || null,
      asistentes:      asistenteStr || null,
      notas:           notas || null,
      acta_url:        res.acta_url,
      floorfy_url:     res.floorfy_url,
      visible_cliente: compartirCliente,
    })

    onClose()
  }

  // ── Grouped contacts for dropdown ─────────────────────────────────────────

  const equipo    = filteredContacts.filter(c => c.tipo === 'equipo')
  const clientes  = filteredContacts.filter(c => c.tipo === 'cliente')
  const proveedores = filteredContacts.filter(c => c.tipo === 'proveedor')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 12,
        maxWidth: 640,
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>

        {/* ── FORM STEP ─────────────────────────────────────────────────── */}
        {step === 'form' && (
          <>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #E8E6E0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: '#1A1A1A' }}>
                    Registrar visita de obra
                  </h2>
                  <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                    {proyecto.nombre}
                    {proyecto.codigo && <span style={{ marginLeft: 6, color: '#CCC', fontFamily: 'monospace' }}>{proyecto.codigo}</span>}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1A1A' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Fecha + Título */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16 }}>
                <div>
                  <label style={S.label}>Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    style={{ ...S.input, width: 'auto' }}
                  />
                </div>
                <div>
                  <label style={S.label}>Título</label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Título de la visita…"
                    style={S.input}
                  />
                </div>
              </div>

              {/* Asistentes */}
              <div>
                <label style={S.label}>Asistentes</label>

                {/* Chips */}
                {asistentesSeleccionados.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {asistentesSeleccionados.map(a => (
                      <span
                        key={a.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 8px 3px 10px',
                          borderRadius: 20,
                          background: TIPO_BG[a.tipo],
                          border: `1px solid ${TIPO_COLOR[a.tipo]}40`,
                          fontSize: 11, color: TIPO_COLOR[a.tipo], fontWeight: 600,
                        }}
                      >
                        {a.nombre}
                        <button
                          onClick={() => removeAsistente(a.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: TIPO_COLOR[a.tipo], lineHeight: 1, padding: 0, opacity: 0.7 }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input + dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <input
                    ref={inputRef}
                    value={busquedaAsistente}
                    onChange={e => { setBusquedaAsistente(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setShowDropdown(false)}
                    placeholder="Buscar por nombre…"
                    style={S.input}
                  />

                  {showDropdown && (equipo.length > 0 || clientes.length > 0 || proveedores.length > 0 || showAddExterno) && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      marginTop: 4, maxHeight: 260, overflow: 'auto',
                    }}>
                      {equipo.length > 0 && (
                        <>
                          <div style={{ padding: '8px 12px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>Equipo</div>
                          {equipo.map(c => (
                            <button
                              key={c.id}
                              onMouseDown={e => { e.preventDefault(); addAsistente(c) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1A1A1A' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                            >
                              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TIPO_COLOR.equipo, marginRight: 8 }} />
                              {c.nombre}
                            </button>
                          ))}
                        </>
                      )}
                      {clientes.length > 0 && (
                        <>
                          <div style={{ padding: '8px 12px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>Clientes</div>
                          {clientes.map(c => (
                            <button
                              key={c.id}
                              onMouseDown={e => { e.preventDefault(); addAsistente(c) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1A1A1A' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                            >
                              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TIPO_COLOR.cliente, marginRight: 8 }} />
                              {c.nombre}
                            </button>
                          ))}
                        </>
                      )}
                      {proveedores.length > 0 && (
                        <>
                          <div style={{ padding: '8px 12px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>Proveedores</div>
                          {proveedores.map(c => (
                            <button
                              key={c.id}
                              onMouseDown={e => { e.preventDefault(); addAsistente(c) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1A1A1A' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                            >
                              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TIPO_COLOR.proveedor, marginRight: 8 }} />
                              {c.nombre}
                            </button>
                          ))}
                        </>
                      )}
                      {showAddExterno && (
                        <>
                          <div style={{ height: 1, background: '#F0EEE8', margin: '4px 0' }} />
                          <button
                            onMouseDown={e => { e.preventDefault(); addExterno() }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                          >
                            + Añadir como externo: <strong style={{ color: '#1A1A1A' }}>{busquedaAsistente.trim()}</strong>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Estado de obras */}
              <div>
                <label style={S.label}>
                  Estado de obras{' '}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#BBB' }}>
                    (Describe qué capítulos se están ejecutando)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={estadoObras}
                  onChange={e => setEstadoObras(e.target.value)}
                  placeholder="Describe el estado actual de las obras…"
                  style={S.textarea}
                />
              </div>

              {/* Instrucciones */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ ...S.label, marginBottom: 0 }}>Instrucciones</label>
                  <button
                    type="button"
                    disabled={aiLoading || !instrucciones.trim()}
                    onClick={async () => {
                      setAiLoading(true)
                      try {
                        const res = await fetch('/api/profesionalizar-instrucciones', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notas: instrucciones }),
                        })
                        const data = await res.json() as { texto?: string; error?: string }
                        if (data.texto) setInstrucciones(data.texto)
                      } finally {
                        setAiLoading(false)
                      }
                    }}
                    style={{
                      fontSize: 10, fontWeight: 600, padding: '4px 10px',
                      background: aiLoading ? '#F0EDE8' : '#1A1A1A',
                      color: aiLoading ? '#AAA' : '#fff',
                      border: 'none', borderRadius: 4, cursor: aiLoading ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'background 0.15s',
                    }}
                  >
                    {aiLoading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid #CCC', borderTopColor: '#888', animation: 'spin 0.7s linear infinite' }} />
                        Procesando…
                      </>
                    ) : (
                      <>✦ Profesionalizar con IA</>
                    )}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={instrucciones}
                  onChange={e => setInstrucciones(e.target.value)}
                  placeholder="Escribe aquí las instrucciones de la visita…"
                  style={S.textarea}
                />
              </div>

              {/* Floorfy URL */}
              <div>
                <label style={S.label}>URL Floorfy <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#CCC' }}>(opcional)</span></label>
                <input
                  value={floorfyUrl}
                  onChange={e => setFloorfyUrl(e.target.value)}
                  placeholder="https://my.floorfy.com/tour/…"
                  style={S.input}
                />
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
              <button
                onClick={() => setStep('preview')}
                style={S.btnPrimary}
                disabled={!fecha || !titulo.trim()}
              >
                Ver previsualización →
              </button>
            </div>
          </>
        )}

        {/* ── PREVIEW STEP ──────────────────────────────────────────────── */}
        {step === 'preview' && (
          <>
            {/* Header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setStep('form')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1A1A' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888' }}
              >
                ← Editar
              </button>
              <span style={{ fontSize: 10, color: '#CCC' }}>|</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Previsualización del acta</span>
            </div>

            {/* Preview document */}
            <div style={{ padding: '20px 28px' }}>
              <div style={{
                border: '1px solid #E8E6E0',
                borderRadius: 8,
                overflow: 'hidden',
                fontFamily: 'Helvetica, Arial, sans-serif',
              }}>

                {/* Dark header */}
                <div style={{ background: '#1A1A1A', padding: '28px 32px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/FORMA_PRIMA_BLANCO.png"
                        alt="Forma Prima"
                        style={{ height: 28, objectFit: 'contain', display: 'block', marginBottom: 10 }}
                      />
                      <span style={{ fontSize: 9, color: '#D85A30', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        Acta de visita de obra
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, color: '#F0EDE8', lineHeight: 1.6 }}>
                        {fmtDateEs(fecha)}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 2, background: '#D85A30' }} />
                </div>

                {/* Project info */}
                <div style={{ background: '#F8F7F4', padding: '16px 32px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 6 }}>
                    Proyecto
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{proyecto.nombre}</span>
                    {proyecto.codigo && <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{proyecto.codigo}</span>}
                  </div>
                  {proyecto.direccion && (
                    <div style={{ fontSize: 11, color: '#7A7A7A' }}>{proyecto.direccion}</div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Asistentes */}
                  {asistentesSeleccionados.length > 0 && (
                    <div>
                      <div style={{ height: 1, background: '#E6E4DF', marginBottom: 14 }} />
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 10 }}>
                        Asistentes
                      </div>
                      {(['equipo', 'cliente', 'proveedor', 'externo'] as TipoAsistente[]).map(tipo => {
                        const lista = asistentesSeleccionados.filter(a => a.tipo === tipo)
                        if (!lista.length) return null
                        const labels: Record<TipoAsistente, string> = { equipo: 'Equipo', cliente: 'Clientes', proveedor: 'Proveedores', externo: 'Externos' }
                        return (
                          <div key={tipo} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAAAAA', marginBottom: 3 }}>
                              {labels[tipo]}
                            </div>
                            <div style={{ fontSize: 11, color: '#3A3A3A' }}>
                              {lista.map(a => a.nombre).join('  ·  ')}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Estado de obras */}
                  {estadoObras && (
                    <div>
                      <div style={{ height: 1, background: '#E6E4DF', marginBottom: 14 }} />
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 8 }}>
                        Estado de obras
                      </div>
                      <p style={{ fontSize: 11, color: '#3A3A3A', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{estadoObras}</p>
                    </div>
                  )}

                  {/* Instrucciones */}
                  {instrucciones.trim().length > 0 && (
                    <div>
                      <div style={{ height: 1, background: '#E6E4DF', marginBottom: 14 }} />
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 8 }}>
                        Instrucciones
                      </div>
                      <p style={{ fontSize: 11, color: '#3A3A3A', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{instrucciones}</p>
                    </div>
                  )}

                  {/* Floorfy */}
                  {floorfyUrl.trim() && (
                    <div>
                      <div style={{ height: 1, background: '#E6E4DF', marginBottom: 14 }} />
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 8 }}>
                        Recorrido virtual actualizado de visita de obra
                      </div>
                      <p style={{ fontSize: 11, color: '#D85A30', margin: 0, wordBreak: 'break-all' }}>{floorfyUrl.trim()}</p>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div style={{ padding: '10px 32px', borderTop: '2px solid #D85A30', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#AAAAAA' }}>Forma Prima Arquitectura</span>
                  <span style={{ fontSize: 9, color: '#AAAAAA' }}>formaprima.es</span>
                </div>

              </div>

              {/* Sharing options */}
              <div style={{ marginTop: 16, padding: '14px 16px', background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#1A1A1A' }}>
                  <input
                    type="checkbox"
                    checked={compartirCliente}
                    onChange={e => setCompartirCliente(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: '#1D9E75', flexShrink: 0 }}
                  />
                  <span>Compartir con el cliente <span style={{ color: '#888' }}>(visible en el portal)</span></span>
                </label>
                {proyectoConstructor && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#1A1A1A' }}>
                    <input
                      type="checkbox"
                      checked={compartirConstructor}
                      onChange={e => setCompartirConstructor(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: '#1D9E75', flexShrink: 0 }}
                    />
                    <span>Compartir con el constructor <span style={{ color: '#888' }}>({proyectoConstructor.nombre})</span></span>
                  </label>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
                  {error}
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
              <button
                onClick={() => {
                  setEmailRecipients(buildRecipients().map(r => ({ ...r })))
                  setStep('emails')
                }}
                style={S.btnDark}
              >
                Verificar destinatarios →
              </button>
            </div>
          </>
        )}

        {/* ── EMAILS STEP ───────────────────────────────────────────────── */}
        {step === 'emails' && (
          <>
            {/* Header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setStep('preview')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1A1A' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888' }}
              >
                ← Previsualización
              </button>
              <span style={{ fontSize: 10, color: '#CCC' }}>|</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Destinatarios del acta</span>
            </div>

            {/* Recipients list */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {emailRecipients.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                  No hay destinatarios con correo electrónico disponible. Se generará el acta sin enviar emails.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
                    El acta en PDF se enviará a los correos seleccionados.
                  </p>

                  {/* Clientes del proyecto */}
                  {emailRecipients.filter(r => r.grupo === 'cliente_proyecto').length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6 }}>
                        Cliente del proyecto
                      </div>
                      {emailRecipients.filter(r => r.grupo === 'cliente_proyecto').map(r => (
                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8F7F4', borderRadius: 6, marginBottom: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={r.preChecked}
                            onChange={e => setEmailRecipients(prev => prev.map(x => x.id === r.id ? { ...x, preChecked: e.target.checked } : x))}
                            style={{ width: 14, height: 14, accentColor: '#D85A30', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: 12, color: '#1A1A1A' }}>{r.nombre}</span>
                          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{r.email}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Constructor */}
                  {emailRecipients.filter(r => r.grupo === 'constructor').length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6 }}>
                        Constructor
                      </div>
                      {emailRecipients.filter(r => r.grupo === 'constructor').map(r => (
                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8F7F4', borderRadius: 6, marginBottom: 4, cursor: r.email ? 'pointer' : 'default', opacity: r.email ? 1 : 0.6 }}>
                          <input
                            type="checkbox"
                            checked={r.preChecked}
                            disabled={!r.email}
                            onChange={e => setEmailRecipients(prev => prev.map(x => x.id === r.id ? { ...x, preChecked: e.target.checked } : x))}
                            style={{ width: 14, height: 14, accentColor: '#1D9E75', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: 12, color: '#1A1A1A' }}>{r.nombre}</span>
                          {r.email
                            ? <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{r.email}</span>
                            : <span style={{ fontSize: 10, color: '#C9A227', fontStyle: 'italic' }}>Sin email — añadir en proveedores</span>
                          }
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Asistentes */}
                  {emailRecipients.filter(r => r.grupo === 'asistente').length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6 }}>
                        Asistentes
                      </div>
                      {emailRecipients.filter(r => r.grupo === 'asistente').map(r => (
                        <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8F7F4', borderRadius: 6, marginBottom: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={r.preChecked}
                            onChange={e => setEmailRecipients(prev => prev.map(x => x.id === r.id ? { ...x, preChecked: e.target.checked } : x))}
                            style={{ width: 14, height: 14, accentColor: '#378ADD', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: 12, color: '#1A1A1A' }}>{r.nombre}</span>
                          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{r.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Error message */}
              {error && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
              <button
                onClick={handleGuardar}
                disabled={saving}
                style={{ ...S.btnDark, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Generando acta…' : emailRecipients.some(r => r.preChecked) ? 'Generar acta y enviar' : 'Generar acta'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}



'use client'

import React, { useState, useTransition, useMemo } from 'react'
import {
  createProveedor, updateProveedor, deleteProveedor,
  addProveedorContacto, updateProveedorContacto, deleteProveedorContacto,
} from '@/app/actions/proveedores'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProveedorContacto {
  id: string
  nombre: string
  cargo: string | null
  email: string | null
  telefono: string | null
}

interface Proveedor {
  id: string
  nombre: string
  tipo: string | null
  contacto_nombre: string | null
  email: string | null
  email_cc: string | null
  telefono: string | null
  web: string | null
  direccion: string | null
  notas: string | null
  nif_cif: string | null
  razon_social: string | null
  direccion_fiscal: string | null
  iban: string | null
  forma_pago: string | null
  condiciones_pago: string | null
  created_at: string
  proveedor_contactos: ProveedorContacto[]
}

type FormData = Omit<Proveedor, 'id' | 'created_at' | 'proveedor_contactos'>

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS = ['Constructor', 'Arquitecto', 'Instalador', 'Paisajismo', 'Interiorismo', 'Fontanería', 'Electricidad', 'Carpintería', 'Otro']

const TIPO_COLOR: Record<string, string> = {
  'Constructor':  '#D85A30',
  'Arquitecto':   '#378ADD',
  'Instalador':   '#1D9E75',
  'Paisajismo':   '#3DAA4A',
  'Interiorismo': '#C9A227',
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

const S = {
  label:    { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:    { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  select:   { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
}

// ── ProveedorModal ────────────────────────────────────────────────────────────

function ProveedorModal({
  initial, onClose, onSaved,
}: {
  initial: Proveedor | null
  onClose: () => void
  onSaved: (p: Proveedor) => void
}) {
  const empty: FormData = { nombre: '', tipo: null, contacto_nombre: null, email: null, email_cc: null, telefono: null, web: null, direccion: null, notas: null, nif_cif: null, razon_social: null, direccion_fiscal: null, iban: null, forma_pago: null, condiciones_pago: null }
  const [form, setForm] = useState<FormData>(
    initial
      ? { nombre: initial.nombre, tipo: initial.tipo, contacto_nombre: initial.contacto_nombre, email: initial.email, email_cc: initial.email_cc, telefono: initial.telefono, web: initial.web, direccion: initial.direccion, notas: initial.notas, nif_cif: initial.nif_cif, razon_social: initial.razon_social, direccion_fiscal: initial.direccion_fiscal, iban: initial.iban, forma_pago: initial.forma_pago, condiciones_pago: initial.condiciones_pago }
      : empty
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v || null }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)
    if (initial) {
      const res = await updateProveedor(initial.id, form)
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, ...form })
    } else {
      const res = await createProveedor(form)
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ id: res.id, ...form, created_at: new Date().toISOString(), proveedor_contactos: [] })
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>
            {initial ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1, padding: '2px 4px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1A1A' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
          >×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Nombre + Tipo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14 }}>
              <div>
                <label style={S.label}>Nombre / Empresa *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre de la empresa…" style={S.input} autoFocus />
              </div>
              <div>
                <label style={S.label}>Tipo</label>
                <select value={form.tipo ?? ''} onChange={e => set('tipo', e.target.value)} style={S.select}>
                  <option value="">Sin tipo</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Contacto principal */}
            <div>
              <label style={S.label}>Contacto principal <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(facturación)</span></label>
              <input value={form.contacto_nombre ?? ''} onChange={e => set('contacto_nombre', e.target.value)} placeholder="Nombre del contacto de facturación…" style={S.input} />
            </div>

            {/* Emails */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Email principal</label>
                <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="correo@empresa.com" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Email CC</label>
                <input type="email" value={form.email_cc ?? ''} onChange={e => set('email_cc', e.target.value)} placeholder="cc@empresa.com" style={S.input} />
              </div>
            </div>

            {/* Teléfono + Web */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Teléfono</label>
                <input type="tel" value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value)} placeholder="+34 600 000 000" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Web</label>
                <input value={form.web ?? ''} onChange={e => set('web', e.target.value)} placeholder="https://…" style={S.input} />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label style={S.label}>Dirección</label>
              <input value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value)} placeholder="Calle, ciudad…" style={S.input} />
            </div>

            {/* ── Facturación ── */}
            <div style={{ borderTop: '1px solid #E8E6E0', paddingTop: 16, marginTop: 4 }}>
              <p style={{ ...S.label, marginBottom: 14, fontSize: 10, color: '#888' }}>Datos de facturación</p>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>NIF / CIF</label>
                  <input value={form.nif_cif ?? ''} onChange={e => set('nif_cif', e.target.value)} placeholder="B12345678" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Razón social</label>
                  <input value={form.razon_social ?? ''} onChange={e => set('razon_social', e.target.value)} placeholder="Nombre fiscal completo…" style={S.input} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Dirección fiscal</label>
                <input value={form.direccion_fiscal ?? ''} onChange={e => set('direccion_fiscal', e.target.value)} placeholder="Igual que dirección o diferente…" style={S.input} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>IBAN</label>
                <input value={form.iban ?? ''} onChange={e => set('iban', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" style={{ ...S.input, fontFamily: 'monospace', letterSpacing: '0.04em' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.label}>Forma de pago</label>
                  <select value={form.forma_pago ?? ''} onChange={e => set('forma_pago', e.target.value)} style={S.select}>
                    <option value="">Sin especificar</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Domiciliación">Domiciliación</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Pagaré">Pagaré</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Condiciones de pago</label>
                  <input value={form.condiciones_pago ?? ''} onChange={e => set('condiciones_pago', e.target.value)} placeholder="30 días, a 60 días…" style={S.input} />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label style={S.label}>Notas</label>
              <textarea rows={3} value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} placeholder="Notas adicionales…" style={S.textarea} />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'none', color: '#888', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: '9px 22px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ProveedorRow ──────────────────────────────────────────────────────────────

function ProveedorRow({ proveedor, isExpanded, onToggle, onEdit }: {
  proveedor: Proveedor; isExpanded: boolean; onToggle: () => void; onEdit: () => void
}) {
  const [, startTransition] = useTransition()

  // ── Contacts state ───────────────────────────────────────────────────────
  const [contactos, setContactos] = useState<ProveedorContacto[]>(proveedor.proveedor_contactos ?? [])
  const [showForm,  setShowForm]  = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [contactoForm,     setContactoForm]     = useState({ nombre: '', cargo: '', email: '', telefono: '' })
  const [isSavingContacto,   setIsSavingContacto]   = useState(false)
  const [contactoError,    setContactoError]    = useState<string | null>(null)

  const openAdd = () => {
    setEditingId(null)
    setContactoForm({ nombre: '', cargo: '', email: '', telefono: '' })
    setShowForm(true)
    setContactoError(null)
  }

  const openEdit = (c: ProveedorContacto) => {
    setEditingId(c.id)
    setContactoForm({ nombre: c.nombre, cargo: c.cargo ?? '', email: c.email ?? '', telefono: c.telefono ?? '' })
    setShowForm(true)
    setContactoError(null)
  }

  const cancelForm = () => { setShowForm(false); setEditingId(null); setContactoError(null) }

  const handleSaveContact = async () => {
    if (!contactoForm.nombre.trim()) { setContactoError('El nombre es obligatorio.'); return }
    setIsSavingContacto(true); setContactoError(null)
    if (editingId) {
      const res = await updateProveedorContacto(editingId, {
        nombre: contactoForm.nombre,
        cargo:    contactoForm.cargo    || null,
        email:    contactoForm.email    || null,
        telefono: contactoForm.telefono || null,
      })
      setIsSavingContacto(false)
      if ('error' in res) { setContactoError(res.error); return }
      setContactos(prev => prev.map(c =>
        c.id === editingId
          ? { ...c, nombre: contactoForm.nombre, cargo: contactoForm.cargo || null, email: contactoForm.email || null, telefono: contactoForm.telefono || null }
          : c
      ))
    } else {
      const res = await addProveedorContacto(proveedor.id, {
        nombre:   contactoForm.nombre,
        cargo:    contactoForm.cargo    || null,
        email:    contactoForm.email    || null,
        telefono: contactoForm.telefono || null,
      })
      setIsSavingContacto(false)
      if ('error' in res) { setContactoError(res.error); return }
      setContactos(prev => [...prev, {
        id:       res.id,
        nombre:   contactoForm.nombre,
        cargo:    contactoForm.cargo    || null,
        email:    contactoForm.email    || null,
        telefono: contactoForm.telefono || null,
      }])
    }
    setShowForm(false)
    setEditingId(null)
  }

  const handleDeleteContact = (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return
    startTransition(async () => {
      const res = await deleteProveedorContacto(id)
      if ('success' in res) setContactos(prev => prev.filter(c => c.id !== id))
    })
  }

  const handleDeleteProveedor = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`¿Eliminar a ${proveedor.nombre}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => { await deleteProveedor(proveedor.id) })
  }

  const btnSm = (color = '#AAA', hoverColor = '#1A1A1A'): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color, padding: '2px 7px', borderRadius: 4,
    letterSpacing: '0.04em', fontFamily: 'inherit',
  })

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', background: isExpanded ? '#FAFAF8' : 'transparent' }}
        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <td style={{ ...TD, paddingLeft: 8, width: 32 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#378ADD', transition: 'transform 0.15s', transform: isExpanded ? 'scale(1.4)' : 'scale(1)' }} />
        </td>
        <td style={{ ...TD, fontWeight: 500, color: '#1A1A1A' }}>
          {proveedor.nombre}
          {contactos.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: '#D85A30', background: '#FDF0EC', padding: '1px 6px', borderRadius: 10 }}>
              {contactos.length} contacto{contactos.length !== 1 ? 's' : ''}
            </span>
          )}
        </td>
        <td style={{ ...TD }}>
          {proveedor.tipo ? (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: TIPO_COLOR[proveedor.tipo] ?? '#888', background: `${TIPO_COLOR[proveedor.tipo] ?? '#888'}18`, padding: '2px 7px', borderRadius: 3 }}>
              {proveedor.tipo}
            </span>
          ) : <span style={{ color: '#CCC' }}>—</span>}
        </td>
        <td style={{ ...TD, color: '#666' }}>{proveedor.contacto_nombre ?? '—'}</td>
        <td style={{ ...TD }}>
          {proveedor.email
            ? <a href={`mailto:${proveedor.email}`} onClick={e => e.stopPropagation()} style={{ color: '#378ADD', textDecoration: 'none', fontSize: 11 }}>{proveedor.email}</a>
            : <span style={{ color: '#CCC' }}>—</span>}
        </td>
        <td style={{ ...TD, color: '#666' }}>{proveedor.telefono ?? '—'}</td>
        <td style={{ ...TD, textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              style={btnSm()}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1A1A'; (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA'; (e.currentTarget as HTMLElement).style.background = 'none' }}
              title="Editar datos principales"
            >Editar</button>
            <button
              onClick={handleDeleteProveedor}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#CCC', padding: '0 4px' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
              title="Eliminar"
            >×</button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0, borderBottom: '2px solid #E8E6E0' }}>

            {/* ── Main details grid ─────────────────────────────────── */}
            <div style={{ padding: '16px 24px 20px', background: '#FAFAF8', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 24 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 8px' }}>Identificación</p>
                {proveedor.contacto_nombre && <p style={{ fontSize: 11, color: '#555', margin: '0 0 4px' }}>{proveedor.contacto_nombre} <span style={{ color: '#AAA', fontSize: 10 }}>(facturación)</span></p>}
                {proveedor.web && <a href={proveedor.web} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#378ADD', textDecoration: 'none' }}>{proveedor.web}</a>}
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 8px' }}>Contacto principal</p>
                {proveedor.email    && <p style={{ fontSize: 11, color: '#555', margin: '0 0 4px' }}>{proveedor.email}</p>}
                {proveedor.email_cc && <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px' }}>CC: {proveedor.email_cc}</p>}
                {proveedor.telefono && <p style={{ fontSize: 11, color: '#555', margin: 0 }}>{proveedor.telefono}</p>}
              </div>
              <div>
                {proveedor.direccion && (
                  <>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 8px' }}>Dirección</p>
                    <p style={{ fontSize: 11, color: '#555', margin: 0 }}>{proveedor.direccion}</p>
                  </>
                )}
              </div>
              {(proveedor.nif_cif || proveedor.iban || proveedor.forma_pago || proveedor.condiciones_pago || proveedor.razon_social) && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 8px' }}>Facturación</p>
                  {proveedor.razon_social  && <p style={{ fontSize: 11, color: '#555', margin: '0 0 3px', fontWeight: 500 }}>{proveedor.razon_social}</p>}
                  {proveedor.nif_cif       && <p style={{ fontSize: 11, color: '#888', margin: '0 0 3px', fontFamily: 'monospace' }}>{proveedor.nif_cif}</p>}
                  {proveedor.iban          && <p style={{ fontSize: 11, color: '#555', margin: '0 0 3px', fontFamily: 'monospace' }}>{proveedor.iban}</p>}
                  {proveedor.forma_pago    && <p style={{ fontSize: 11, color: '#888', margin: '0 0 3px' }}>{proveedor.forma_pago}{proveedor.condiciones_pago ? ` · ${proveedor.condiciones_pago}` : ''}</p>}
                </div>
              )}
            </div>

            {/* ── Personas de contacto ──────────────────────────────── */}
            <div style={{ padding: '14px 24px 18px', background: '#FAFAF8', borderTop: '1px solid #EDEAE4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: contactos.length > 0 || showForm ? 12 : 0 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30', margin: 0 }}>
                  Personas de contacto
                  <span style={{ fontWeight: 400, color: '#AAA', marginLeft: 6, letterSpacing: 0, textTransform: 'none', fontSize: 9 }}>
                    (para actas de obra, project managers, aparejadores…)
                  </span>
                </p>
                {!showForm && (
                  <button
                    onClick={e => { e.stopPropagation(); openAdd() }}
                    style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', background: 'none', border: '1px dashed #D0CEC9', padding: '4px 12px', cursor: 'pointer', borderRadius: 4, fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D85A30'; (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D0CEC9'; (e.currentTarget as HTMLElement).style.color = '#888' }}
                  >
                    + Añadir persona
                  </button>
                )}
              </div>

              {/* Empty state */}
              {contactos.length === 0 && !showForm && (
                <p style={{ fontSize: 11, color: '#CCC', margin: '8px 0 0', fontStyle: 'italic' }}>
                  Sin personas adicionales — añade project managers, aparejadores u otros contactos de obra.
                </p>
              )}

              {/* Contact list */}
              {contactos.map(c => (
                editingId === c.id && showForm ? null : (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 0', borderBottom: '1px solid #F0EEE8' }}>
                    <span style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 500, minWidth: 160 }}>{c.nombre}</span>
                    {c.cargo
                      ? <span style={{ fontSize: 11, color: '#888', minWidth: 140 }}>{c.cargo}</span>
                      : <span style={{ minWidth: 140 }} />
                    }
                    {c.email
                      ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#378ADD', textDecoration: 'none', flex: 1 }}>{c.email}</a>
                      : <span style={{ flex: 1 }} />
                    }
                    {c.telefono && (
                      <span style={{ fontSize: 11, color: '#555', marginRight: 16, whiteSpace: 'nowrap' }}>{c.telefono}</span>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(c) }}
                        style={btnSm()}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1A1A'; (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA'; (e.currentTarget as HTMLElement).style.background = 'none' }}
                      >Editar</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteContact(c.id, c.nombre) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#CCC', padding: '0 4px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
                      >×</button>
                    </div>
                  </div>
                )
              ))}

              {/* Inline add / edit form */}
              {showForm && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ marginTop: 12, background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '16px 18px' }}
                >
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30', margin: '0 0 12px' }}>
                    {editingId ? 'Editar persona' : 'Nueva persona de contacto'}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={S.label}>Nombre *</label>
                      <input
                        value={contactoForm.nombre}
                        onChange={e => setContactoForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Juan García"
                        style={S.input}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveContact() } if (e.key === 'Escape') cancelForm() }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Cargo</label>
                      <input
                        value={contactoForm.cargo}
                        onChange={e => setContactoForm(f => ({ ...f, cargo: e.target.value }))}
                        placeholder="Project Manager"
                        style={S.input}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveContact() } if (e.key === 'Escape') cancelForm() }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Email</label>
                      <input
                        type="email"
                        value={contactoForm.email}
                        onChange={e => setContactoForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="juan@empresa.com"
                        style={S.input}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveContact() } if (e.key === 'Escape') cancelForm() }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Teléfono</label>
                      <input
                        value={contactoForm.telefono}
                        onChange={e => setContactoForm(f => ({ ...f, telefono: e.target.value }))}
                        placeholder="+34 600 000 000"
                        style={S.input}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveContact() } if (e.key === 'Escape') cancelForm() }}
                      />
                    </div>
                  </div>
                  {contactoError && (
                    <p style={{ fontSize: 11, color: '#DC2626', margin: '0 0 10px' }}>{contactoError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={cancelForm}
                      style={{ padding: '7px 14px', background: 'none', color: '#888', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveContact}
                      disabled={isSavingContacto}
                      style={{ padding: '7px 18px', background: isSavingContacto ? '#888' : '#1A1A1A', color: '#fff', border: 'none', borderRadius: 5, cursor: isSavingContacto ? 'default' : 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', opacity: isSavingContacto ? 0.7 : 1 }}
                      onMouseEnter={e => { if (!isSavingContacto) (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
                      onMouseLeave={e => { if (!isSavingContacto) (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
                    >
                      {isSavingContacto ? 'Guardando…' : editingId ? 'Actualizar' : 'Añadir'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Notas / dirección fiscal ──────────────────────────── */}
            {(proveedor.notas || proveedor.direccion_fiscal) && (
              <div style={{ padding: '12px 24px 16px', background: '#FAFAF8', display: 'grid', gridTemplateColumns: proveedor.direccion_fiscal && proveedor.notas ? '1fr 1fr' : '1fr', gap: 24, borderTop: '1px solid #E8E6E0' }}>
                {proveedor.direccion_fiscal && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 6px' }}>Dirección fiscal</p>
                    <p style={{ fontSize: 11, color: '#555', margin: 0 }}>{proveedor.direccion_fiscal}</p>
                  </div>
                )}
                {proveedor.notas && (
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 6px' }}>Notas</p>
                    <p style={{ fontSize: 11, color: '#555', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{proveedor.notas}</p>
                  </div>
                )}
              </div>
            )}

          </td>
        </tr>
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProveedoresPage({ proveedores: initial }: { proveedores: Proveedor[] }) {
  const [proveedores,    setProveedores]    = useState(initial)
  const [expanded,       setExpanded]       = useState<string | null>(null)
  const [query,          setQuery]          = useState('')
  const [modalProveedor, setModalProveedor] = useState<Proveedor | null | 'new'>()

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return proveedores
    return proveedores.filter(p =>
      [p.nombre, p.tipo, p.contacto_nombre, p.email, p.telefono]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [proveedores, query])

  const handleSaved = (saved: Proveedor) => {
    setProveedores(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        // Preserve existing contactos when editing main data
        next[idx] = { ...saved, proveedor_contactos: prev[idx].proveedor_contactos }
        return next
      }
      return [saved, ...prev]
    })
    setModalProveedor(undefined)
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {modalProveedor !== undefined && (
        <ProveedorModal
          initial={modalProveedor === 'new' ? null : modalProveedor}
          onClose={() => setModalProveedor(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
              Base de datos
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Proveedores</h1>
          </div>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>{proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            placeholder="Buscar por nombre, tipo, email…"
            value={query} onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, height: 36, padding: '0 14px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A', background: '#fff' }}
          />
          <button
            onClick={() => setModalProveedor('new')}
            style={{ height: 36, padding: '0 18px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#378ADD' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
          >
            + Nuevo proveedor
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '28px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#CCC', fontSize: 13 }}>
            {query ? 'Sin resultados' : 'No hay proveedores — pulsa "Nuevo proveedor" para empezar'}
          </div>
        ) : (
          <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  <th style={{ ...TH, width: 32, paddingLeft: 8 }} />
                  <th style={TH}>Nombre / Empresa</th>
                  <th style={{ ...TH, width: 140 }}>Tipo</th>
                  <th style={{ ...TH, width: 160 }}>Contacto facturación</th>
                  <th style={{ ...TH, width: 220 }}>Email</th>
                  <th style={{ ...TH, width: 140 }}>Teléfono</th>
                  <th style={{ ...TH, width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <ProveedorRow
                    key={p.id}
                    proveedor={p}
                    isExpanded={expanded === p.id}
                    onToggle={() => setExpanded(prev => prev === p.id ? null : p.id)}
                    onEdit={() => setModalProveedor(p)}
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

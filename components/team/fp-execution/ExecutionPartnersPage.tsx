'use client'

import { useState, useMemo, useEffect } from 'react'
import { TEMPLATE_DEFAULT } from '@/app/team/fp-execution/template/templateData'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecutionPartner {
  id: string
  nombre: string
  razon_social: string
  nif_cif: string
  contacto_nombre: string
  email_contacto: string
  email_notificaciones: string
  telefono: string
  direccion: string
  ciudad: string
  codigo_postal: string
  pais: string
  iban: string
  email_facturacion: string
  notas: string
  especialidades: string[] // subcapítulo IDs
  created_at: string
}

const EMPTY_FORM: Omit<ExecutionPartner, 'id' | 'created_at'> = {
  nombre: '',
  razon_social: '',
  nif_cif: '',
  contacto_nombre: '',
  email_contacto: '',
  email_notificaciones: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  codigo_postal: '',
  pais: 'España',
  iban: '',
  email_facturacion: '',
  notas: '',
  especialidades: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getChapterState(capitulo: typeof TEMPLATE_DEFAULT[0], selected: Set<string>): 'all' | 'some' | 'none' {
  const total = capitulo.subcapitulos.length
  const count = capitulo.subcapitulos.filter(s => selected.has(s.id)).length
  if (count === 0) return 'none'
  if (count === total) return 'all'
  return 'some'
}

function especialidadesLabel(especialidades: string[]): string {
  if (especialidades.length === 0) return '—'
  const selected = new Set(especialidades)
  const labels: string[] = []
  for (const cap of TEMPLATE_DEFAULT) {
    const state = getChapterState(cap, selected)
    if (state === 'all') {
      labels.push(cap.nombre)
    } else if (state === 'some') {
      const subs = cap.subcapitulos.filter(s => selected.has(s.id)).map(s => s.nombre)
      labels.push(...subs)
    }
  }
  if (labels.length === 0) return '—'
  if (labels.length <= 2) return labels.join(', ')
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} más`
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function TemplateChecklist({
  selected,
  onChange,
}: {
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())

  const toggleChapter = (id: string) =>
    setOpenChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleChapter = (cap: typeof TEMPLATE_DEFAULT[0]) => {
    const state = getChapterState(cap, selected)
    const n = new Set(selected)
    if (state === 'all') {
      cap.subcapitulos.forEach(s => n.delete(s.id))
    } else {
      cap.subcapitulos.forEach(s => n.add(s.id))
    }
    onChange(n)
  }

  const handleSub = (subId: string) => {
    const n = new Set(selected)
    n.has(subId) ? n.delete(subId) : n.add(subId)
    onChange(n)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {TEMPLATE_DEFAULT.map(cap => {
        const state = getChapterState(cap, selected)
        const isOpen = openChapters.has(cap.id)
        return (
          <div key={cap.id} style={{ border: '1px solid #E8E6E0', borderRadius: 4, overflow: 'hidden' }}>
            {/* Chapter row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: isOpen ? '#FAFAF8' : '#fff' }}>
              <input
                type="checkbox"
                checked={state === 'all'}
                ref={el => { if (el) el.indeterminate = state === 'some' }}
                onChange={() => handleChapter(cap)}
                style={{ marginRight: 10, cursor: 'pointer', width: 14, height: 14, accentColor: '#1A1A1A' }}
              />
              <span
                style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#1A1A1A', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleChapter(cap.id)}
              >
                {cap.numero}. {cap.nombre.toUpperCase()}
              </span>
              <span
                style={{ fontSize: 10, color: '#BBB', cursor: 'pointer', paddingLeft: 10 }}
                onClick={() => toggleChapter(cap.id)}
              >
                {isOpen ? '▲' : '▼'}
              </span>
            </div>

            {/* Subcapítulos */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #F0EEE8' }}>
                {cap.subcapitulos.map(sub => (
                  <label
                    key={sub.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 14px 8px 38px',
                      borderBottom: '1px solid #F8F7F4',
                      cursor: 'pointer',
                      background: selected.has(sub.id) ? '#F8F7F4' : '#fff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(sub.id)}
                      onChange={() => handleSub(sub.id)}
                      style={{ marginRight: 10, cursor: 'pointer', width: 13, height: 13, accentColor: '#1A1A1A' }}
                    />
                    <span style={{ fontSize: 12, color: '#444', fontWeight: 400 }}>{sub.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Form modal ───────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 12 }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 5, letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E8E6E0',
  background: '#fff',
  padding: '9px 12px',
  fontSize: 13,
  color: '#1A1A1A',
  fontWeight: 300,
  outline: 'none',
  borderRadius: 3,
  boxSizing: 'border-box',
}

function PartnerModal({
  partner,
  onSave,
  onClose,
}: {
  partner: Omit<ExecutionPartner, 'id' | 'created_at'>
  onSave: (p: Omit<ExecutionPartner, 'id' | 'created_at'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(partner)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(partner.especialidades))
  const [activeSection, setActiveSection] = useState<'datos' | 'especialidades'>('datos')

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSave = () => {
    if (!form.nombre.trim()) return
    onSave({ ...form, especialidades: Array.from(selectedIds) })
  }

  const tabs: { key: 'datos' | 'especialidades'; label: string }[] = [
    { key: 'datos', label: 'Datos del partner' },
    { key: 'especialidades', label: `Especialidades (${selectedIds.size})` },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: 'min(680px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Modal header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E8E6E0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 200, color: '#1A1A1A', margin: 0 }}>
              {partner.nombre || 'Nuevo Execution Partner'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#AAA', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeSection === tab.key ? '2px solid #1A1A1A' : '2px solid transparent',
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: activeSection === tab.key ? 500 : 400,
                  color: activeSection === tab.key ? '#1A1A1A' : '#AAA',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {activeSection === 'datos' && (
            <>
              <FieldGroup label="Empresa">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Nombre empresa *">
                    <input style={inputStyle} value={form.nombre} onChange={set('nombre')} placeholder="Empresa SL" />
                  </Field>
                  <Field label="Razón social">
                    <input style={inputStyle} value={form.razon_social} onChange={set('razon_social')} placeholder="Empresa, S.L." />
                  </Field>
                  <Field label="NIF / CIF">
                    <input style={inputStyle} value={form.nif_cif} onChange={set('nif_cif')} placeholder="B12345678" />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup label="Dirección">
                <Field label="Dirección">
                  <input style={inputStyle} value={form.direccion} onChange={set('direccion')} placeholder="Calle, número, piso" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Ciudad">
                    <input style={inputStyle} value={form.ciudad} onChange={set('ciudad')} placeholder="Madrid" />
                  </Field>
                  <Field label="Código postal">
                    <input style={inputStyle} value={form.codigo_postal} onChange={set('codigo_postal')} placeholder="28001" />
                  </Field>
                  <Field label="País">
                    <input style={inputStyle} value={form.pais} onChange={set('pais')} placeholder="España" />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup label="Contacto">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Nombre contacto">
                    <input style={inputStyle} value={form.contacto_nombre} onChange={set('contacto_nombre')} placeholder="Nombre Apellidos" />
                  </Field>
                  <Field label="Teléfono">
                    <input style={inputStyle} value={form.telefono} onChange={set('telefono')} placeholder="+34 600 000 000" />
                  </Field>
                  <Field label="Email de contacto">
                    <input style={inputStyle} type="email" value={form.email_contacto} onChange={set('email_contacto')} placeholder="contacto@empresa.com" />
                  </Field>
                  <Field label="Email de notificaciones">
                    <input style={inputStyle} type="email" value={form.email_notificaciones} onChange={set('email_notificaciones')} placeholder="notificaciones@empresa.com" />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup label="Facturación">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="IBAN">
                    <input style={inputStyle} value={form.iban} onChange={set('iban')} placeholder="ES00 0000 0000 0000 0000 0000" />
                  </Field>
                  <Field label="Email de facturación">
                    <input style={inputStyle} type="email" value={form.email_facturacion} onChange={set('email_facturacion')} placeholder="facturacion@empresa.com" />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup label="Notas">
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  value={form.notas}
                  onChange={set('notas')}
                  placeholder="Observaciones sobre este partner…"
                />
              </FieldGroup>
            </>
          )}

          {activeSection === 'especialidades' && (
            <>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
                Selecciona los capítulos y subcapítulos que este partner está capacitado para ejecutar.
                Puedes marcar un capítulo completo o solo los subcapítulos concretos.
              </p>
              <TemplateChecklist
                selected={selectedIds}
                onChange={setSelectedIds}
              />
            </>
          )}
        </div>

        {/* Modal footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ fontSize: 12, padding: '9px 20px', border: '1px solid #E8E6E0', background: '#fff', color: '#666', cursor: 'pointer', borderRadius: 4 }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.nombre.trim()}
            style={{ fontSize: 12, padding: '9px 20px', border: 'none', background: '#1A1A1A', color: '#fff', cursor: 'pointer', borderRadius: 4, opacity: form.nombre.trim() ? 1 : 0.4 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExecutionPartnersPage() {
  const supabase = createClient()
  const [partners, setPartners] = useState<ExecutionPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<ExecutionPartner | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('execution_partners').select('*').order('nombre')
      .then(({ data }) => {
        if (data) setPartners(data as ExecutionPartner[])
        setLoading(false)
      })
  }, [])

  const openNew = () => {
    setEditingPartner(null)
    setModalOpen(true)
  }

  const openEdit = (p: ExecutionPartner) => {
    setEditingPartner(p)
    setModalOpen(true)
  }

  const handleSave = async (form: Omit<ExecutionPartner, 'id' | 'created_at'>) => {
    if (editingPartner) {
      const { data } = await supabase
        .from('execution_partners')
        .update(form)
        .eq('id', editingPartner.id)
        .select()
        .single()
      if (data) setPartners(prev => prev.map(p => p.id === editingPartner.id ? data as ExecutionPartner : p))
    } else {
      const { data } = await supabase
        .from('execution_partners')
        .insert(form)
        .select()
        .single()
      if (data) setPartners(prev => [...prev, data as ExecutionPartner].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    }
    setModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('execution_partners').delete().eq('id', id)
    setPartners(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const totalSubcapitulos = useMemo(() =>
    TEMPLATE_DEFAULT.reduce((acc, c) => acc + c.subcapitulos.length, 0), [])

  return (
    <div style={{ background: '#F8F7F4', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '40px 40px 28px', background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 500, marginBottom: 6 }}>
          FP Execution
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', letterSpacing: '-0.01em', margin: 0 }}>
            Execution Partners
          </h1>
          <button
            onClick={openNew}
            style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 500, padding: '10px 20px', background: '#1A1A1A', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}
          >
            + Nuevo partner
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '28px 40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#CCC' }}>
            <p style={{ fontSize: 13, fontWeight: 300 }}>Cargando…</p>
          </div>
        ) : partners.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#AAA' }}>
            <p style={{ fontSize: 14, fontWeight: 300, marginBottom: 8 }}>Sin execution partners todavía</p>
            <p style={{ fontSize: 12, fontWeight: 300 }}>Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
                  {['Empresa', 'Contacto', 'Email contacto', 'Especialidades', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F0EEE8' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontWeight: 400, color: '#1A1A1A', margin: 0 }}>{p.nombre}</p>
                      {p.nif_cif && <p style={{ fontSize: 11, color: '#AAA', margin: '2px 0 0' }}>{p.nif_cif}</p>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#555' }}>{p.contacto_nombre || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#555' }}>{p.email_contacto || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#555' }}>{especialidadesLabel(p.especialidades)}</span>
                        {p.especialidades.length > 0 && (
                          <span style={{ fontSize: 10, background: '#F0EEE8', color: '#888', padding: '2px 7px', borderRadius: 10, fontWeight: 500 }}>
                            {p.especialidades.length}/{totalSubcapitulos}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => openEdit(p)}
                          style={{ fontSize: 11, padding: '6px 12px', border: '1px solid #E8E6E0', background: '#fff', color: '#555', cursor: 'pointer', borderRadius: 4 }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p.id)}
                          style={{ fontSize: 11, padding: '6px 12px', border: '1px solid #FDD', background: '#fff', color: '#C0392B', cursor: 'pointer', borderRadius: 4 }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Partner form modal */}
      {modalOpen && (
        <PartnerModal
          partner={editingPartner ?? EMPTY_FORM}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 28, borderRadius: 6, width: 'min(380px, 90vw)', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', marginBottom: 10 }}>¿Eliminar partner?</h3>
            <p style={{ fontSize: 13, color: '#888', fontWeight: 300, marginBottom: 20 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 12, padding: '8px 16px', border: '1px solid #E8E6E0', background: '#fff', color: '#666', cursor: 'pointer', borderRadius: 4 }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ fontSize: 12, padding: '8px 16px', border: 'none', background: '#C0392B', color: '#fff', cursor: 'pointer', borderRadius: 4 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

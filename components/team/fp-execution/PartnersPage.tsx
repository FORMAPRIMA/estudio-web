'use client'

import React, { useState, useMemo } from 'react'
import { createPartner, updatePartner, deletePartner, setPartnerCapabilities } from '@/app/actions/fpe-partners'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Capability { unit_id: string }

interface Partner {
  id: string
  nombre: string
  razon_social: string | null
  nif_cif: string | null
  contacto_nombre: string | null
  email_contacto: string | null
  email_notificaciones: string | null
  email_facturacion: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  codigo_postal: string | null
  pais: string
  iban: string | null
  notas: string | null
  activo: boolean
  capabilities: Capability[]
}

interface Unit { id: string; nombre: string; orden: number; activo: boolean }

interface Chapter { id: string; nombre: string; orden: number; units: Unit[] }

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
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8',
    color: primary ? '#fff' : '#555',
  }),
  btnSm: (): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: '#F0EEE8', color: '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

// ── Partner Modal ─────────────────────────────────────────────────────────────

type FormData = Omit<Partner, 'id' | 'activo' | 'capabilities'>

function PartnerModal({
  initial,
  chapters,
  onClose,
  onSaved,
}: {
  initial: Partner | null
  chapters: Chapter[]
  onClose: () => void
  onSaved: (p: Partner) => void
}) {
  const empty: FormData = {
    nombre: '', razon_social: null, nif_cif: null, contacto_nombre: null,
    email_contacto: null, email_notificaciones: null, email_facturacion: null,
    telefono: null, direccion: null, ciudad: null, codigo_postal: null,
    pais: 'España', iban: null, notas: null,
  }

  const [form, setForm] = useState<FormData>(
    initial
      ? { nombre: initial.nombre, razon_social: initial.razon_social, nif_cif: initial.nif_cif, contacto_nombre: initial.contacto_nombre, email_contacto: initial.email_contacto, email_notificaciones: initial.email_notificaciones, email_facturacion: initial.email_facturacion, telefono: initial.telefono, direccion: initial.direccion, ciudad: initial.ciudad, codigo_postal: initial.codigo_postal, pais: initial.pais, iban: initial.iban, notas: initial.notas }
      : empty
  )

  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(
    new Set(initial?.capabilities.map(c => c.unit_id) ?? [])
  )

  const [tab, setTab] = useState<'datos' | 'capacidades'>('datos')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v || null }))

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    const unitIds = Array.from(selectedUnitIds)

    if (initial) {
      const [updateRes, capRes] = await Promise.all([
        updatePartner(initial.id, form),
        setPartnerCapabilities(initial.id, unitIds),
      ])
      setSaving(false)
      if ('error' in updateRes) { setError(updateRes.error); return }
      if ('error' in capRes) { setError(capRes.error); return }
      onSaved({ ...initial, ...form, capabilities: unitIds.map(unit_id => ({ unit_id })) })
    } else {
      const res = await createPartner(form)
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      // Set capabilities for new partner
      if (unitIds.length > 0) {
        const capRes = await setPartnerCapabilities(res.id, unitIds)
        if ('error' in capRes) { setError(capRes.error); return }
      }
      onSaved({ id: res.id, ...form, activo: true, capabilities: unitIds.map(unit_id => ({ unit_id })) })
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
    background: 'none', borderBottom: active ? '2px solid #1A1A1A' : '2px solid transparent',
    color: active ? '#1A1A1A' : '#AAA', fontFamily: 'inherit',
  })

  const allUnits = chapters.flatMap(c => c.units)
  const capCount = selectedUnitIds.size

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E8E6E0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
              {initial ? 'Editar partner' : 'Nuevo partner'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <button style={tabStyle(tab === 'datos')} onClick={() => setTab('datos')}>Datos</button>
            <button style={tabStyle(tab === 'capacidades')} onClick={() => setTab('capacidades')}>
              Capacidades {capCount > 0 && <span style={{ marginLeft: 4, background: '#1A1A1A', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{capCount}</span>}
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Datos tab ── */}
            {tab === 'datos' && (
              <>
                {/* Nombre */}
                <div>
                  <label style={S.label}>Nombre / Empresa *</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del partner…" style={S.input} autoFocus />
                </div>

                {/* Contacto */}
                <div>
                  <label style={S.label}>Persona de contacto</label>
                  <input value={form.contacto_nombre ?? ''} onChange={e => set('contacto_nombre', e.target.value)} placeholder="Nombre del contacto…" style={S.input} />
                </div>

                {/* Emails */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={S.label}>Email contacto</label>
                    <input type="email" value={form.email_contacto ?? ''} onChange={e => set('email_contacto', e.target.value)} placeholder="contacto@empresa.com" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Email notificaciones</label>
                    <input type="email" value={form.email_notificaciones ?? ''} onChange={e => set('email_notificaciones', e.target.value)} placeholder="avisos@empresa.com" style={S.input} />
                  </div>
                </div>
                <div>
                  <label style={S.label}>Email facturación</label>
                  <input type="email" value={form.email_facturacion ?? ''} onChange={e => set('email_facturacion', e.target.value)} placeholder="facturas@empresa.com" style={S.input} />
                </div>

                {/* Teléfono */}
                <div>
                  <label style={S.label}>Teléfono</label>
                  <input type="tel" value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value)} placeholder="+34 600 000 000" style={S.input} />
                </div>

                {/* Dirección */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px', gap: 14 }}>
                  <div>
                    <label style={S.label}>Dirección</label>
                    <input value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value)} placeholder="Calle y número…" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Ciudad</label>
                    <input value={form.ciudad ?? ''} onChange={e => set('ciudad', e.target.value)} placeholder="Madrid" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>CP</label>
                    <input value={form.codigo_postal ?? ''} onChange={e => set('codigo_postal', e.target.value)} placeholder="28001" style={S.input} />
                  </div>
                </div>

                {/* Facturación */}
                <div style={{ borderTop: '1px solid #E8E6E0', paddingTop: 14, marginTop: 4 }}>
                  <p style={{ ...S.label, fontSize: 10, color: '#888', marginBottom: 14 }}>Datos de facturación</p>
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
                  <div>
                    <label style={S.label}>IBAN</label>
                    <input value={form.iban ?? ''} onChange={e => set('iban', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" style={{ ...S.input, fontFamily: 'monospace', letterSpacing: '0.04em' }} />
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label style={S.label}>Notas</label>
                  <textarea rows={3} value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} placeholder="Notas adicionales…" style={S.textarea} />
                </div>
              </>
            )}

            {/* ── Capacidades tab ── */}
            {tab === 'capacidades' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#666' }}>
                  Selecciona las unidades de ejecución que este partner puede ejecutar. Esto define en qué licitaciones puede ser invitado.
                </p>

                {allUnits.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#BBB', textAlign: 'center', padding: '24px 0' }}>
                    No hay unidades en el template. Crea primero el template.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Select all / none */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        style={S.btnSm()}
                        onClick={() => setSelectedUnitIds(new Set(allUnits.map(u => u.id)))}
                      >Seleccionar todo</button>
                      <button
                        type="button"
                        style={S.btnSm()}
                        onClick={() => setSelectedUnitIds(new Set())}
                      >Limpiar</button>
                    </div>

                    {chapters.map(chapter => (
                      <div key={chapter.id}>
                        <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
                          {chapter.nombre}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {chapter.units.map(unit => (
                            <label
                              key={unit.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, border: `1px solid ${selectedUnitIds.has(unit.id) ? '#378ADD' : '#E8E6E0'}`, background: selectedUnitIds.has(unit.id) ? '#EBF5FF' : '#fff', cursor: 'pointer', transition: 'all 0.1s' }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUnitIds.has(unit.id)}
                                onChange={() => toggleUnit(unit.id)}
                                style={{ width: 14, height: 14, accentColor: '#378ADD', flexShrink: 0 }}
                              />
                              <span style={{ fontSize: 12, color: selectedUnitIds.has(unit.id) ? '#1A5CA8' : '#333', fontWeight: selectedUnitIds.has(unit.id) ? 600 : 400 }}>
                                {unit.nombre}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Confirm delete ────────────────────────────────────────────────────────────

function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '24px 24px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar partner?</p>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Se eliminará <strong>{label}</strong> y todas sus capacidades. Esta acción no se puede deshacer.</p>
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={S.btn()}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...S.btn(), background: '#DC2626', color: '#fff' }}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PartnersPage({
  initialPartners,
  chapters,
}: {
  initialPartners: Partner[]
  chapters: Chapter[]
}) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; partner: Partner } | null>(null)
  const [deleting, setDeleting] = useState<Partner | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return partners.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.contacto_nombre ?? '').toLowerCase().includes(q) ||
      (p.email_contacto ?? '').toLowerCase().includes(q) ||
      (p.ciudad ?? '').toLowerCase().includes(q)
    )
  }, [partners, search])

  const handleSaved = (saved: Partner) => {
    const exists = partners.find(p => p.id === saved.id)
    if (exists) setPartners(prev => prev.map(p => p.id === saved.id ? saved : p))
    else setPartners(prev => [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setModal(null)
  }

  const handleDelete = async (partner: Partner) => {
    const res = await deletePartner(partner.id)
    if ('error' in res) { alert(res.error); return }
    setPartners(prev => prev.filter(p => p.id !== partner.id))
    setDeleting(null)
  }

  // Build a unit name lookup
  const unitNames: Record<string, string> = {}
  for (const ch of chapters) for (const u of ch.units) unitNames[u.id] = u.nombre

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>FP Execution</p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Execution Partners</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>{partners.length} partners registrados</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          style={{ ...S.btn(true), padding: '9px 18px', fontSize: 13 }}
        >+ Nuevo partner</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, contacto, email o ciudad…"
          style={{ ...S.input, maxWidth: 380, fontSize: 13 }}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#BBB' }}>
          {search ? (
            <p style={{ fontSize: 13 }}>Sin resultados para «{search}».</p>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#888' }}>Sin partners</p>
              <p style={{ fontSize: 13, marginBottom: 20 }}>Añade el primer execution partner para poder lanzar licitaciones.</p>
              <button onClick={() => setModal({ mode: 'create' })} style={S.btn(true)}>+ Nuevo partner</button>
            </>
          )}
        </div>
      ) : (
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1A1A1A' }}>
                <th style={TH}>Empresa</th>
                <th style={TH}>Contacto</th>
                <th style={TH}>Email</th>
                <th style={TH}>Ciudad</th>
                <th style={TH}>Capacidades</th>
                <th style={TH}>Estado</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner, i) => (
                <tr
                  key={partner.id}
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', cursor: 'pointer' }}
                  onClick={() => setModal({ mode: 'edit', partner })}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F4EF' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? '#fff' : '#FAFAF8' }}
                >
                  <td style={TD}>
                    <div style={{ fontWeight: 600, color: '#1A1A1A' }}>{partner.nombre}</div>
                    {partner.razon_social && partner.razon_social !== partner.nombre && (
                      <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{partner.razon_social}</div>
                    )}
                  </td>
                  <td style={TD}>{partner.contacto_nombre ?? <span style={{ color: '#CCC' }}>—</span>}</td>
                  <td style={TD}>{partner.email_contacto ?? <span style={{ color: '#CCC' }}>—</span>}</td>
                  <td style={TD}>{partner.ciudad ?? <span style={{ color: '#CCC' }}>—</span>}</td>
                  <td style={TD}>
                    {partner.capabilities.length === 0 ? (
                      <span style={{ color: '#CCC', fontSize: 11 }}>Sin asignar</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {partner.capabilities.slice(0, 3).map(c => (
                          <span key={c.unit_id} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: '#EBF5FF', color: '#378ADD' }}>
                            {unitNames[c.unit_id] ?? c.unit_id.slice(0, 8)}
                          </span>
                        ))}
                        {partner.capabilities.length > 3 && (
                          <span style={{ fontSize: 10, color: '#AAA' }}>+{partner.capabilities.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={TD}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 7px', borderRadius: 3,
                      background: partner.activo ? '#ECFDF5' : '#F9FAFB',
                      color: partner.activo ? '#059669' : '#9CA3AF',
                    }}>
                      {partner.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', partner }) }}
                      style={{ ...S.btnSm(), marginRight: 4 }}
                    >Editar</button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleting(partner) }}
                      style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#FEE2E2', color: '#DC2626', fontFamily: 'inherit', fontWeight: 600 }}
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal && (
        <PartnerModal
          initial={modal.mode === 'edit' ? modal.partner : null}
          chapters={chapters}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <ConfirmDelete
          label={deleting.nombre}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

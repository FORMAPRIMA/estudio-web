'use client'

import React, { useState, useMemo } from 'react'
import { getDocumentSignedUrl } from '@/app/actions/fpe-documents'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  nombre: string
  contacto_nombre: string | null
  email_contacto:  string | null
}

interface Project {
  id: string
  nombre: string
  descripcion: string | null
  direccion:   string | null
  ciudad:      string | null
}

interface Tender {
  id: string
  descripcion: string | null
  fecha_limite: string
  status: string
}

interface TemplateLineItem {
  id: string
  nombre: string
  unidad_medida: string
}

interface ProjectLineItem {
  id: string
  cantidad: number
  notas: string | null
  template_line_item: TemplateLineItem | null
}

interface ProjectUnit {
  id: string
  template_unit_id: string
  notas: string | null
  template_unit: {
    id: string
    nombre: string
    descripcion: string | null
  } | null
  line_items: ProjectLineItem[]
}

interface PortalDoc {
  id: string
  nombre: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  discipline_tags: string[]
  created_at: string
  project_unit_id: string | null
}

interface BidLineItem {
  id: string
  project_line_item_id: string
  precio_unitario: number
  notas: string | null
}

interface ExistingBid {
  id: string
  notas: string | null
  status: string
  submitted_at: string | null
  line_items: BidLineItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function fileLabel(mime: string | null, nombre: string): { label: string; bg: string; color: string } {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('image/') || ['jpg','jpeg','png','webp','svg'].includes(ext))
    return { label: 'IMG', bg: '#FEF3C7', color: '#92400E' }
  if (ext === 'pdf' || mime === 'application/pdf')
    return { label: 'PDF', bg: '#FEE2E2', color: '#991B1B' }
  if (['dwg','dxf','rvt','ifc'].includes(ext))
    return { label: ext.toUpperCase(), bg: '#EDE9FE', color: '#5B21B6' }
  return { label: ext.toUpperCase() || 'FILE', bg: '#F3F4F6', color: '#374151' }
}

function countdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return 'Plazo finalizado'
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h restantes`
  return `${hours}h restantes`
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  sectionTitle: { fontSize: 10, fontWeight: 700 as const, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#AAA', margin: '0 0 14px' },
  input:  { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '10px 20px', fontSize: 13, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
    background: primary ? '#1A1A1A' : '#F0EEE8', color: primary ? '#fff' : '#555',
  }),
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc }: { doc: PortalDoc }) {
  const [downloading, setDownloading] = useState(false)
  const badge = fileLabel(doc.mime_type, doc.nombre)

  const handleDownload = async () => {
    setDownloading(true)
    const res = await getDocumentSignedUrl(doc.storage_path)
    setDownloading(false)
    if ('error' in res) { alert(res.error); return }
    window.open(res.url, '_blank')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 6, border: '1px solid #E8E6E0', background: '#fff' }}>
      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '3px 7px', borderRadius: 4, background: badge.bg, color: badge.color }}>
        {badge.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nombre}</p>
        {doc.discipline_tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {doc.discipline_tags.map(t => (
              <span key={t} style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: '#F3F4F6', color: '#6B7280' }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: '#AAA', flexShrink: 0 }}>{formatBytes(doc.size_bytes)}</span>
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{ flexShrink: 0, padding: '6px 14px', fontSize: 12, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#1A1A1A', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}
      >{downloading ? '…' : 'Descargar'}</button>
    </div>
  )
}

// ── Main Portal ───────────────────────────────────────────────────────────────

export default function PortalPage({
  token,
  partner,
  project,
  tender,
  projectUnits,
  documents,
  existingBid,
  isReadOnly,
}: {
  token: string
  partner: Partner
  project: Project
  tender: Tender
  projectUnits: ProjectUnit[]
  documents: PortalDoc[]
  existingBid: ExistingBid | null
  isReadOnly: boolean
}) {
  // ── Bid state ─────────────────────────────────────────────────────────────
  const initPrices = (): Record<string, number> => {
    const m: Record<string, number> = {}
    for (const unit of projectUnits) {
      for (const li of unit.line_items) {
        const existing = existingBid?.line_items.find(b => b.project_line_item_id === li.id)
        m[li.id] = existing?.precio_unitario ?? 0
      }
    }
    return m
  }

  const [prices, setPrices]         = useState<Record<string, number>>(initPrices)
  const [bidNotas, setBidNotas]     = useState(existingBid?.notas ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(existingBid?.status === 'submitted' || existingBid?.status === 'accepted')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [activeTab, setActiveTab]   = useState<'scope' | 'docs' | 'bid'>('scope')

  // ── Computed total ────────────────────────────────────────────────────────
  const total = useMemo(() => {
    let sum = 0
    for (const unit of projectUnits) {
      for (const li of unit.line_items) {
        sum += (prices[li.id] ?? 0) * li.cantidad
      }
    }
    return sum
  }, [prices, projectUnits])

  const generalDocs = documents.filter(d => !d.project_unit_id)
  const unitDocs    = documents.filter(d => !!d.project_unit_id)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'none',
    borderBottom: active ? '2px solid #1A1A1A' : '2px solid transparent',
    color: active ? '#1A1A1A' : '#AAA', fontFamily: 'inherit',
  })

  // ── Submit bid ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true); setSubmitError(null)

    const line_items = projectUnits
      .flatMap(u => u.line_items)
      .filter(li => (prices[li.id] ?? 0) > 0)
      .map(li => ({
        project_line_item_id: li.id,
        precio_unitario:      prices[li.id],
        notas:                null,
      }))

    if (line_items.length === 0) {
      setSubmitError('Introduce al menos un precio antes de enviar la oferta.')
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/fpe-portal/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, notas: bidNotas || null, line_items }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok || json.error) { setSubmitError(json.error ?? 'Error enviando la oferta.'); return }
    setSubmitted(true)
  }

  const deadline = tender.fecha_limite
  const deadlinePassed = new Date(deadline) < new Date()

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: '#1A1A1A', padding: '0 0 0' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 32px 0' }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            Portal de Licitación · Forma Prima
          </p>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
            {project.nombre}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            {project.ciudad && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{project.ciudad}</span>}
            {project.descripcion && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{project.descripcion}</span>}
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: deadlinePassed ? 'rgba(220,38,38,0.2)' : 'rgba(55,138,221,0.2)', color: deadlinePassed ? '#FCA5A5' : '#93C5FD', fontWeight: 600 }}>
              {countdown(deadline)}
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['scope', 'docs', 'bid'] as const).map(tab => (
              <button
                key={tab}
                style={{
                  padding: '10px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'none', fontFamily: 'inherit',
                  borderBottom: activeTab === tab ? '2px solid #fff' : '2px solid transparent',
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'scope' ? 'Scope' : tab === 'docs' ? `Documentación (${documents.length})` : submitted ? '✓ Oferta enviada' : 'Mi oferta'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Info bar ── */}
      <div style={{ background: '#F0EEE8', borderBottom: '1px solid #E8E6E0', padding: '10px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: '#666' }}>Invitado como: <strong>{partner.nombre}</strong></span>
          <span style={{ fontSize: 12, color: '#AAA' }}>·</span>
          <span style={{ fontSize: 12, color: '#666' }}>
            Fecha límite: <strong>{new Date(deadline).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          </span>
          {(isReadOnly || submitted) && (
            <>
              <span style={{ fontSize: 12, color: '#AAA' }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#D1FAE5', color: '#065F46' }}>
                Oferta enviada
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 32px' }}>

        {/* ── Scope tab ── */}
        {activeTab === 'scope' && (
          <div>
            <p style={S.sectionTitle}>Unidades de ejecución incluidas en esta licitación</p>
            {projectUnits.length === 0 ? (
              <p style={{ fontSize: 13, color: '#AAA' }}>No hay unidades de ejecución en este scope.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projectUnits.map(unit => (
                  <div key={unit.id} style={{ borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', background: '#fff' }}>
                    <div style={{ background: '#1A1A1A', padding: '12px 16px' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {unit.template_unit?.nombre ?? 'Unidad'}
                      </p>
                      {unit.template_unit?.descripcion && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{unit.template_unit.descripcion}</p>
                      )}
                    </div>
                    {unit.line_items.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0EEE8' }}>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 100 }}>Cantidad</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', width: 60 }}>Ud.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.line_items.map((li, i) => (
                            <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: '#333' }}>{li.template_line_item?.nombre ?? '—'}</td>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: '#555', textAlign: 'right', fontFamily: 'monospace' }}>{li.cantidad}</td>
                              <td style={{ padding: '10px 14px', fontSize: 11, color: '#888', fontWeight: 600 }}>{li.template_line_item?.unidad_medida ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ margin: 0, padding: '12px 16px', fontSize: 12, color: '#CCC' }}>Sin partidas definidas.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Docs tab ── */}
        {activeTab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {documents.length === 0 ? (
              <p style={{ fontSize: 13, color: '#AAA', textAlign: 'center', padding: '40px 0' }}>
                No hay documentación disponible por el momento.
              </p>
            ) : (
              <>
                {generalDocs.length > 0 && (
                  <div>
                    <p style={S.sectionTitle}>Documentación general del proyecto</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {generalDocs.map(d => <DocRow key={d.id} doc={d} />)}
                    </div>
                  </div>
                )}
                {unitDocs.length > 0 && (
                  <div>
                    <p style={S.sectionTitle}>Documentación por unidad</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {unitDocs.map(d => <DocRow key={d.id} doc={d} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Bid tab ── */}
        {activeTab === 'bid' && (
          <div>
            {submitted || isReadOnly ? (
              /* ── Submitted / read-only view ── */
              <div>
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#065F46' }}>✓ Oferta enviada</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#059669' }}>
                    {existingBid?.submitted_at
                      ? `Enviada el ${new Date(existingBid.submitted_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : 'Oferta registrada.'}
                  </p>
                </div>
                <p style={S.sectionTitle}>Detalle de la oferta</p>
                {projectUnits.map(unit => (
                  <div key={unit.id} style={{ marginBottom: 16 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#555' }}>{unit.template_unit?.nombre}</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #E8E6E0' }}>
                          <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                          <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right' }}>Ud.</th>
                          <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right' }}>P/Ud</th>
                          <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unit.line_items.map((li, i) => {
                          const p = prices[li.id] ?? 0
                          return (
                            <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                              <td style={{ padding: '9px 12px', fontSize: 12, color: '#333' }}>{li.template_line_item?.nombre}</td>
                              <td style={{ padding: '9px 12px', fontSize: 12, color: '#888', textAlign: 'right' }}>{li.cantidad} {li.template_line_item?.unidad_medida}</td>
                              <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace' }}>{formatEur(p)}</td>
                              <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{formatEur(p * li.cantidad)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
                <div style={{ textAlign: 'right', padding: '14px 0', borderTop: '2px solid #1A1A1A', marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: '#AAA', marginRight: 16 }}>Total oferta</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace' }}>{formatEur(total)}</span>
                </div>
              </div>
            ) : (
              /* ── Editable bid form ── */
              <div>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                  Introduce el precio unitario para cada partida. El total se calcula automáticamente.
                  Puedes guardar y volver antes de la fecha límite.
                </p>

                {projectUnits.map(unit => (
                  <div key={unit.id} style={{ marginBottom: 24 }}>
                    <div style={{ background: '#1A1A1A', padding: '10px 16px', borderRadius: '6px 6px 0 0' }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>{unit.template_unit?.nombre}</p>
                    </div>
                    <div style={{ border: '1px solid #E8E6E0', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #E8E6E0' }}>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 80 }}>Cant.</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', width: 50 }}>Ud.</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 140 }}>Precio/ud (€)</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 120 }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.line_items.map((li, i) => {
                            const p = prices[li.id] ?? 0
                            return (
                              <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: '#333' }}>{li.template_line_item?.nombre}</td>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: '#555', textAlign: 'right', fontFamily: 'monospace' }}>{li.cantidad}</td>
                                <td style={{ padding: '10px 14px', fontSize: 11, color: '#888', fontWeight: 600 }}>{li.template_line_item?.unidad_medida}</td>
                                <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={p || ''}
                                      placeholder="0,00"
                                      onChange={e => setPrices(prev => ({ ...prev, [li.id]: parseFloat(e.target.value) || 0 }))}
                                      style={{
                                        width: 110, padding: '6px 8px', fontSize: 13,
                                        border: `1px solid ${p > 0 ? '#378ADD' : '#E8E6E0'}`,
                                        borderRadius: 5, fontFamily: 'monospace', color: '#1A1A1A',
                                        background: p > 0 ? '#F0F7FF' : '#fff', outline: 'none', textAlign: 'right',
                                      }}
                                    />
                                    <span style={{ fontSize: 11, color: '#AAA' }}>€</span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right', fontWeight: 600, color: p > 0 ? '#1A1A1A' : '#DDD', fontFamily: 'monospace' }}>
                                  {p > 0 ? formatEur(p * li.cantidad) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Total + notes + submit */}
                <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '20px 24px', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>Total estimado de la oferta</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: total > 0 ? '#1A1A1A' : '#DDD', fontFamily: 'monospace' }}>{formatEur(total)}</span>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block', marginBottom: 6 }}>
                      Notas o condicionantes de la oferta
                    </label>
                    <textarea
                      rows={3}
                      value={bidNotas}
                      onChange={e => setBidNotas(e.target.value)}
                      placeholder="Condicionantes, exclusiones, plazos especiales…"
                      style={S.textarea}
                    />
                  </div>
                  {submitError && (
                    <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
                      {submitError}
                    </div>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || deadlinePassed}
                    style={{ ...S.btn(true), width: '100%', padding: '12px', fontSize: 14 }}
                  >
                    {submitting ? 'Enviando oferta…' : deadlinePassed ? 'Plazo finalizado' : 'Enviar oferta'}
                  </button>
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: '#AAA', textAlign: 'center' }}>
                    Podrás actualizar tu oferta hasta la fecha límite.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

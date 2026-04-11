'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { contractProject } from '@/app/actions/fpe-projects'
import {
  createTender,
  updateTender,
  launchTender,
  closeTender,
  createInvitation,
  sendInvitation,
  revokeInvitation,
} from '@/app/actions/fpe-tenders'
import BidComparison from '@/components/team/fp-execution/BidComparison'
import QAPanel from '@/components/team/fp-execution/QAPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TenderStatus     = 'draft' | 'launched' | 'closed' | 'cancelled'
export type InvitationStatus = 'pending' | 'sent' | 'viewed' | 'bid_submitted' | 'revoked' | 'expired'

export interface FpeInvitation {
  id: string
  token: string
  status: InvitationStatus
  scope_unit_ids: string[]
  token_expires_at: string
  sent_at: string | null
  viewed_at: string | null
  bid_submitted_at: string | null
  partner: {
    id: string
    nombre: string
    email_contacto: string | null
  }
}

export interface FpeTender {
  id: string
  descripcion: string | null
  fecha_limite: string
  status: TenderStatus
  launched_at: string | null
  closed_at: string | null
  created_at: string
  invitations: FpeInvitation[]
}

export interface FpePartnerSummary {
  id: string
  nombre: string
  email_contacto: string | null
}

export interface TenderProjectUnit {
  id: string
  template_unit_id: string
  nombre?: string
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  label: {
    fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4,
  },
  input: {
    padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5,
    fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', outline: 'none',
    width: '100%', boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0',
    borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff',
    resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none',
  },
  btn: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 500,
    background: danger ? '#FEF2F2' : primary ? '#1A1A1A' : '#F0EEE8',
    color: danger ? '#DC2626' : primary ? '#fff' : '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

// ── Status maps ───────────────────────────────────────────────────────────────

const TENDER_STATUS_MAP: Record<TenderStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Borrador',   bg: '#F3F4F6', color: '#6B7280' },
  launched:  { label: 'Lanzada',    bg: '#FEF3C7', color: '#D97706' },
  closed:    { label: 'Cerrada',    bg: '#ECFDF5', color: '#059669' },
  cancelled: { label: 'Cancelada',  bg: '#FEF2F2', color: '#DC2626' },
}

const INV_STATUS_MAP: Record<InvitationStatus, { label: string; bg: string; color: string }> = {
  pending:       { label: 'Pendiente',       bg: '#F3F4F6', color: '#6B7280' },
  sent:          { label: 'Enviada',         bg: '#EBF5FF', color: '#378ADD' },
  viewed:        { label: 'Vista',           bg: '#FEF3C7', color: '#D97706' },
  bid_submitted: { label: 'Oferta recibida', bg: '#ECFDF5', color: '#059669' },
  revoked:       { label: 'Revocada',        bg: '#FEF2F2', color: '#DC2626' },
  expired:       { label: 'Expirada',        bg: '#F9FAFB', color: '#9CA3AF' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Create / Edit Tender Modal ────────────────────────────────────────────────

function TenderModal({
  projectId,
  tender,
  onClose,
  onSaved,
}: {
  projectId: string
  tender: FpeTender | null
  onClose: () => void
  onSaved: (t: FpeTender) => void
}) {
  const [descripcion, setDescripcion] = useState(tender?.descripcion ?? '')
  const [fechaLimite, setFechaLimite] = useState(
    tender ? tender.fecha_limite.split('T')[0] : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fechaLimite) { setError('La fecha límite es obligatoria.'); return }
    setSaving(true); setError(null)

    if (tender) {
      const res = await updateTender(tender.id, {
        descripcion: descripcion.trim() || null,
        fecha_limite: fechaLimite,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...tender, descripcion: descripcion.trim() || null, fecha_limite: fechaLimite })
    } else {
      const res = await createTender({
        project_id:  projectId,
        descripcion: descripcion.trim() || null,
        fecha_limite: fechaLimite,
      })
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({
        id: res.id, descripcion: descripcion.trim() || null, fecha_limite: fechaLimite,
        status: 'draft', launched_at: null, closed_at: null,
        created_at: new Date().toISOString(), invitations: [],
      })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
            {tender ? 'Editar licitación' : 'Crear licitación'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Descripción (opcional)</label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej. Paquete estructura + albañilería"
                style={S.textarea}
              />
            </div>
            <div>
              <label style={S.label}>Fecha límite de ofertas *</label>
              <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} style={S.input} required />
            </div>
            {error && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>
            )}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>
              {saving ? 'Guardando…' : tender ? 'Guardar' : 'Crear licitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Invite Partner Modal ──────────────────────────────────────────────────────

function InviteModal({
  tenderId,
  projectId,
  projectUnits,
  partners,
  existingPartnerIds,
  onClose,
  onInvited,
}: {
  tenderId: string
  projectId: string
  projectUnits: TenderProjectUnit[]
  partners: FpePartnerSummary[]
  existingPartnerIds: string[]
  onClose: () => void
  onInvited: (inv: FpeInvitation) => void
}) {
  const [partnerId, setPartnerId]       = useState('')
  const [selectedIds, setSelectedIds]   = useState<string[]>(projectUnits.map(u => u.id))
  const [expiryDays, setExpiryDays]     = useState(14)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const available = partners.filter(p => !existingPartnerIds.includes(p.id))

  const toggleUnit = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partnerId)          { setError('Selecciona un partner.'); return }
    if (selectedIds.length === 0) { setError('Selecciona al menos una unidad.'); return }
    setSaving(true); setError(null)

    const res = await createInvitation({
      tender_id:              tenderId,
      partner_id:             partnerId,
      scope_project_unit_ids: selectedIds,
      token_expires_days:     expiryDays,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }

    const partner = partners.find(p => p.id === partnerId)!
    const expires = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()

    onInvited({
      id: res.id, token: res.token, status: 'pending',
      scope_unit_ids: selectedIds, token_expires_at: expires,
      sent_at: null, viewed_at: null, bid_submitted_at: null,
      partner: { id: partnerId, nombre: partner.nombre, email_contacto: partner.email_contacto },
    })
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Invitar partner</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Partner */}
            <div>
              <label style={S.label}>Partner *</label>
              {available.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                  Todos los partners ya tienen una invitación activa.
                </p>
              ) : (
                <select value={partnerId} onChange={e => setPartnerId(e.target.value)} style={S.input}>
                  <option value="">Seleccionar partner…</option>
                  {available.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.email_contacto ? ` — ${p.email_contacto}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Units */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>Unidades del scope *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setSelectedIds(projectUnits.map(u => u.id))} style={{ ...S.btn(), padding: '3px 8px', fontSize: 10 }}>Todas</button>
                  <button type="button" onClick={() => setSelectedIds([])} style={{ ...S.btn(), padding: '3px 8px', fontSize: 10 }}>Ninguna</button>
                </div>
              </div>
              <div style={{ border: '1px solid #E8E6E0', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
                {projectUnits.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#888', padding: '12px 14px', margin: 0 }}>
                    El proyecto no tiene unidades de scope definidas.
                  </p>
                ) : (
                  projectUnits.map((unit, i) => (
                    <label
                      key={unit.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                        cursor: 'pointer', fontSize: 12, color: '#1A1A1A',
                        borderBottom: i < projectUnits.length - 1 ? '1px solid #F0EEE8' : 'none',
                        background: selectedIds.includes(unit.id) ? '#F0F7FF' : '#fff',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(unit.id)}
                        onChange={() => toggleUnit(unit.id)}
                        style={{ accentColor: '#378ADD' }}
                      />
                      {unit.nombre ?? unit.id.slice(0, 8)}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label style={S.label}>Validez del enlace (días)</label>
              <input
                type="number" min={1} max={90} value={expiryDays}
                onChange={e => setExpiryDays(parseInt(e.target.value) || 14)}
                style={{ ...S.input, width: 100 }}
              />
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>
            )}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving || available.length === 0} style={S.btn(true)}>
              {saving ? 'Creando…' : 'Crear invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Invitation Row ────────────────────────────────────────────────────────────

function InvitationRow({
  invitation,
  projectId,
  tenderStatus,
  projectUnits,
  onStatusChange,
}: {
  invitation: FpeInvitation
  projectId: string
  tenderStatus: TenderStatus
  projectUnits: TenderProjectUnit[]
  onStatusChange: (invId: string, newStatus: InvitationStatus) => void
}) {
  const [loading, setLoading] = useState<'send' | 'revoke' | null>(null)
  const [copied, setCopied]   = useState(false)

  const inv = invitation
  const s   = INV_STATUS_MAP[inv.status]

  const unitNames = inv.scope_unit_ids.map(id => projectUnits.find(u => u.id === id)?.nombre).filter(Boolean) as string[]

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/execution-portal/${inv.token}`
    : `/execution-portal/${inv.token}`

  const canSend   = inv.status === 'pending' && tenderStatus === 'launched'
  const canCopy   = ['sent', 'viewed', 'bid_submitted'].includes(inv.status)
  const canRevoke = !['revoked', 'expired', 'bid_submitted'].includes(inv.status) && tenderStatus !== 'closed'

  const handleSend = async () => {
    setLoading('send')
    const res = await sendInvitation(inv.id, projectId)
    setLoading(null)
    if ('success' in res) onStatusChange(inv.id, 'sent')
  }

  const handleRevoke = async () => {
    if (!confirm('¿Revocar esta invitación? El partner perderá el acceso al portal.')) return
    setLoading('revoke')
    const res = await revokeInvitation(inv.id, projectId)
    setLoading(null)
    if ('success' in res) onStatusChange(inv.id, 'revoked')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <tr style={{ borderBottom: '1px solid #F0EEE8' }}>
      {/* Partner */}
      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{inv.partner.nombre}</div>
        {inv.partner.email_contacto && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{inv.partner.email_contacto}</div>
        )}
      </td>

      {/* Scope units */}
      <td style={{ padding: '12px 16px', verticalAlign: 'top', maxWidth: 220 }}>
        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
          {unitNames.length > 0
            ? unitNames.slice(0, 3).join(', ') + (unitNames.length > 3 ? ` +${unitNames.length - 3}` : '')
            : `${inv.scope_unit_ids.length} ud.`}
        </div>
      </td>

      {/* Status */}
      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: s.bg, color: s.color }}>
          {s.label}
        </span>
        {inv.bid_submitted_at && (
          <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>{fmtDate(inv.bid_submitted_at)}</div>
        )}
        {!inv.bid_submitted_at && inv.viewed_at && (
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Vista {fmtDate(inv.viewed_at)}</div>
        )}
        {!inv.bid_submitted_at && !inv.viewed_at && inv.sent_at && (
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Enviada {fmtDate(inv.sent_at)}</div>
        )}
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {canSend && (
            <button onClick={handleSend} disabled={!!loading} style={{ ...S.btn(true), padding: '5px 10px', fontSize: 11 }}>
              {loading === 'send' ? 'Enviando…' : 'Enviar'}
            </button>
          )}
          {canCopy && (
            <button onClick={handleCopy} style={{ ...S.btn(), padding: '5px 10px', fontSize: 11 }}>
              {copied ? '¡Copiado!' : 'Copiar enlace'}
            </button>
          )}
          {canRevoke && (
            <button onClick={handleRevoke} disabled={!!loading} style={{ ...S.btn(false, true), padding: '5px 10px', fontSize: 11 }}>
              {loading === 'revoke' ? '…' : 'Revocar'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main TenderPanel ──────────────────────────────────────────────────────────

export default function TenderPanel({
  projectId,
  projectUnits,
  initialTender,
  partners,
  initialProjectStatus,
}: {
  projectId:            string
  projectUnits:         TenderProjectUnit[]
  initialTender:        FpeTender | null
  partners:             FpePartnerSummary[]
  initialProjectStatus: string
}) {
  const router = useRouter()

  const [tender, setTender]             = useState<FpeTender | null>(initialTender)
  const [projectStatus, setProjStatus]  = useState(initialProjectStatus)
  const [showTenderModal, setShowTM]    = useState(false)
  const [showInviteModal, setShowIM]    = useState(false)
  const [showComparison, setShowComp]   = useState(false)
  const [showQA, setShowQA]             = useState(false)
  const [launching, setLaunching]       = useState(false)
  const [closing, setClosing]           = useState(false)
  const [contracting, setContracting]   = useState(false)
  const [msg, setMsg]                   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const handleLaunch = async () => {
    if (!tender) return
    if (!confirm('¿Lanzar la licitación? Una vez lanzada, podrás enviar invitaciones a partners.')) return
    setLaunching(true)
    const res = await launchTender(tender.id, projectId)
    setLaunching(false)
    if ('error' in res) { flash('err', res.error); return }
    setTender(t => t ? { ...t, status: 'launched', launched_at: new Date().toISOString() } : t)
    flash('ok', 'Licitación lanzada.')
  }

  const handleClose = async () => {
    if (!tender) return
    if (!confirm('¿Cerrar la licitación? No se aceptarán más ofertas.')) return
    setClosing(true)
    const res = await closeTender(tender.id, projectId)
    setClosing(false)
    if ('error' in res) { flash('err', res.error); return }
    setTender(t => t ? { ...t, status: 'closed', closed_at: new Date().toISOString() } : t)
    flash('ok', 'Licitación cerrada.')
  }

  const handleContract = async () => {
    if (!confirm('¿Marcar este proyecto como Contratado?\n\nSe actualizará el estado del proyecto.')) return
    setContracting(true)
    const res = await contractProject(projectId)
    setContracting(false)
    if ('error' in res) { flash('err', res.error); return }
    setProjStatus('contracted')
    flash('ok', 'Proyecto marcado como contratado.')
    router.refresh()
  }

  const handleInvitationStatus = (invId: string, newStatus: InvitationStatus) => {
    setTender(t => {
      if (!t) return t
      return {
        ...t,
        invitations: t.invitations.map(inv =>
          inv.id === invId
            ? { ...inv, status: newStatus, sent_at: newStatus === 'sent' ? new Date().toISOString() : inv.sent_at }
            : inv
        ),
      }
    })
  }

  // Partners that already have an active (non-revoked/expired) invitation
  const existingPartnerIds = (tender?.invitations ?? [])
    .filter(inv => !['revoked', 'expired'].includes(inv.status))
    .map(inv => inv.partner.id)

  // ── No tender yet ─────────────────────────────────────────────────────────

  if (!tender) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Licitación</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
              Crea una licitación para invitar a partners a presentar ofertas.
            </p>
          </div>
          <button onClick={() => setShowTM(true)} style={{ ...S.btn(true), padding: '9px 20px', fontSize: 13, flexShrink: 0 }}>
            Crear licitación
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '20px 24px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#555' }}>
            Recomendaciones antes de lanzar:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Scope del proyecto definido', ok: projectUnits.length > 0 },
              { label: 'Partners registrados en el sistema', ok: partners.length > 0 },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: item.ok ? '#059669' : '#D97706', lineHeight: 1 }}>
                  {item.ok ? '✓' : '○'}
                </span>
                <span style={{ fontSize: 12, color: item.ok ? '#333' : '#888' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {showTenderModal && (
          <TenderModal
            projectId={projectId} tender={null}
            onClose={() => setShowTM(false)}
            onSaved={t => { setTender(t); setShowTM(false) }}
          />
        )}
      </div>
    )
  }

  // ── Tender exists ─────────────────────────────────────────────────────────

  const ts         = TENDER_STATUS_MAP[tender.status]
  const canEdit    = ['draft', 'launched'].includes(tender.status)
  const canLaunch  = tender.status === 'draft'
  const canClose   = tender.status === 'launched'
  const canInvite  = tender.status === 'launched'
  const canContract = projectStatus === 'awarded'

  return (
    <div>
      {/* Tender header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Licitación</h2>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: ts.bg, color: ts.color }}>
              {ts.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#555' }}>
              <span style={{ color: '#AAA', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 5 }}>Límite</span>
              {fmtDate(tender.fecha_limite)}
            </span>
            {tender.descripcion && (
              <span style={{ fontSize: 12, color: '#888' }}>{tender.descripcion}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.type === 'ok' ? '#059669' : '#DC2626', fontWeight: 500 }}>
              {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
            </span>
          )}
          {canEdit && (
            <button onClick={() => setShowTM(true)} style={{ ...S.btn(), padding: '7px 14px' }}>
              Editar
            </button>
          )}
          {canLaunch && (
            <button onClick={handleLaunch} disabled={launching} style={{ ...S.btn(true), padding: '7px 14px' }}>
              {launching ? 'Lanzando…' : 'Lanzar licitación'}
            </button>
          )}
          {canClose && (
            <button onClick={handleClose} disabled={closing} style={{ ...S.btn(false, true), padding: '7px 14px' }}>
              {closing ? 'Cerrando…' : 'Cerrar licitación'}
            </button>
          )}
          {canContract && (
            <button onClick={handleContract} disabled={contracting} style={{ ...S.btn(true), padding: '7px 14px', background: '#065F46' }}>
              {contracting ? 'Guardando…' : 'Marcar como contratado'}
            </button>
          )}
        </div>
      </div>

      {/* Invitations table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E8E6E0' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
            Invitaciones ({tender.invitations.length})
          </span>
          {canInvite && (
            <button onClick={() => setShowIM(true)} style={{ ...S.btn(true), padding: '6px 12px', fontSize: 11 }}>
              + Invitar partner
            </button>
          )}
        </div>

        {tender.invitations.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              {tender.status === 'draft'
                ? 'Lanza la licitación para poder invitar partners.'
                : 'No hay invitaciones todavía.'}
            </p>
            {canInvite && (
              <button onClick={() => setShowIM(true)} style={{ ...S.btn(true), padding: '9px 20px', fontSize: 13 }}>
                Invitar primer partner
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F7F4' }}>
                {['Partner', 'Scope', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tender.invitations.map(inv => (
                <InvitationRow
                  key={inv.id}
                  invitation={inv}
                  projectId={projectId}
                  tenderStatus={tender.status}
                  projectUnits={projectUnits}
                  onStatusChange={handleInvitationStatus}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Bid comparison ──────────────────────────────────────────────── */}
      {(() => {
        const submittedCount = tender.invitations.filter(i => ['bid_submitted', 'awarded'].includes(i.status)).length
        if (submittedCount === 0) return null
        return (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                  Comparativa de ofertas
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#888' }}>
                  {submittedCount} oferta{submittedCount !== 1 ? 's' : ''} recibida{submittedCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowComp(v => !v)}
                style={{ ...S.btn(true), padding: '7px 16px' }}
              >
                {showComparison ? 'Ocultar' : 'Ver comparativa'}
              </button>
            </div>
            {showComparison && (
              <BidComparison tenderId={tender.id} projectId={projectId} />
            )}
          </div>
        )
      })()}

      {/* ── Q&A ─────────────────────────────────────────────────────────────── */}
      {tender.status !== 'draft' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
              Preguntas y respuestas
            </h3>
            <button
              onClick={() => setShowQA(v => !v)}
              style={{ ...S.btn(), padding: '7px 14px' }}
            >
              {showQA ? 'Ocultar' : 'Ver Q&A'}
            </button>
          </div>
          {showQA && (
            <QAPanel tenderId={tender.id} projectId={projectId} />
          )}
        </div>
      )}

      {/* Modals */}
      {showTenderModal && (
        <TenderModal
          projectId={projectId} tender={tender}
          onClose={() => setShowTM(false)}
          onSaved={t => { setTender(t); setShowTM(false) }}
        />
      )}
      {showInviteModal && (
        <InviteModal
          tenderId={tender.id} projectId={projectId}
          projectUnits={projectUnits} partners={partners}
          existingPartnerIds={existingPartnerIds}
          onClose={() => setShowIM(false)}
          onInvited={inv => {
            setTender(t => t ? { ...t, invitations: [inv, ...t.invitations] } : t)
            setShowIM(false)
          }}
        />
      )}
    </div>
  )
}

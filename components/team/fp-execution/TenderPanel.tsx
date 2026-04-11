'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { contractProject } from '@/app/actions/fpe-projects'
import {
  closeTender,
  createInvitation,
  sendInvitation,
  revokeInvitation,
  createAndSendAllInvitations,
} from '@/app/actions/fpe-tenders'
import BidComparison from '@/components/team/fp-execution/BidComparison'
import QAPanel from '@/components/team/fp-execution/QAPanel'
import type { ScopedChapter } from '@/components/team/fp-execution/DocumentHub'

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
  telefono: string | null
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
  pending:       { label: 'Enviando…',      bg: '#F3F4F6', color: '#6B7280' },
  sent:          { label: 'Enviada',         bg: '#EBF5FF', color: '#378ADD' },
  viewed:        { label: 'Vista',           bg: '#FEF3C7', color: '#D97706' },
  bid_submitted: { label: 'Oferta recibida', bg: '#ECFDF5', color: '#059669' },
  revoked:       { label: 'Revocada',        bg: '#FEF2F2', color: '#DC2626' },
  expired:       { label: 'Expirada',        bg: '#F9FAFB', color: '#9CA3AF' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Package card (one per partner in the review view) ─────────────────────────

interface PackageChapter {
  chapter_nombre: string
  unit_nombres:   string[]
}

interface PackageDef {
  partner_id:     string
  partner_nombre: string
  email:          string | null
  telefono:       string | null
  chapters:       PackageChapter[]
}

function PackageCard({ pkg }: { pkg: PackageDef }) {
  const totalUnits = pkg.chapters.reduce((s, c) => s + c.unit_nombres.length, 0)

  return (
    <div style={{ borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#1A1A1A', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{pkg.partner_nombre}</div>
            {pkg.email && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{pkg.email}</div>
            )}
            {pkg.telefono && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{pkg.telefono}</div>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', flexShrink: 0, marginTop: 2 }}>
            {totalUnits} UE{totalUnits !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Body: UEs grouped by chapter */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pkg.chapters.map(ch => (
          <div key={ch.chapter_nombre}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>
              {ch.chapter_nombre}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {ch.unit_nombres.map(u => (
                <div key={u} style={{ fontSize: 12, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#D85A30', fontSize: 10 }}>›</span>
                  {u}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Invite Partner Modal (for manual add after bulk send) ─────────────────────

function InviteModal({
  tenderId,
  projectId,
  projectUnits,
  partners,
  existingPartnerIds,
  onClose,
  onInvited,
}: {
  tenderId:            string
  projectId:           string
  projectUnits:        TenderProjectUnit[]
  partners:            FpePartnerSummary[]
  existingPartnerIds:  string[]
  onClose:             () => void
  onInvited:           (inv: FpeInvitation) => void
}) {
  const [partnerId, setPartnerId]     = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(projectUnits.map(u => u.id))
  const [expiryDays, setExpiryDays]   = useState(21)
  const [saving, setSaving]           = useState(false)
  const [sending, setSending]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const available = partners.filter(p => !existingPartnerIds.includes(p.id))
  const toggleUnit = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partnerId)            { setError('Selecciona un partner.'); return }
    if (selectedIds.length === 0) { setError('Selecciona al menos una unidad.'); return }
    setSaving(true); setError(null)

    const res = await createInvitation({ tender_id: tenderId, partner_id: partnerId, scope_project_unit_ids: selectedIds, token_expires_days: expiryDays })
    if ('error' in res) { setSaving(false); setError(res.error); return }

    // Immediately send the email
    setSending(true)
    await sendInvitation(res.id, projectId)
    setSending(false); setSaving(false)

    const partner = partners.find(p => p.id === partnerId)!
    const expires = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    onInvited({
      id: res.id, token: res.token, status: 'sent',
      scope_unit_ids: selectedIds, token_expires_at: expires,
      sent_at: new Date().toISOString(), viewed_at: null, bid_submitted_at: null,
      partner: { id: partnerId, nombre: partner.nombre, email_contacto: partner.email_contacto },
    })
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Invitar partner adicional</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={S.label}>Partner *</label>
              {available.length === 0
                ? <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Todos los partners ya tienen invitación.</p>
                : (
                  <select value={partnerId} onChange={e => setPartnerId(e.target.value)} style={S.input}>
                    <option value="">Seleccionar partner…</option>
                    {available.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}{p.email_contacto ? ` — ${p.email_contacto}` : ''}</option>
                    ))}
                  </select>
                )
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>Unidades *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setSelectedIds(projectUnits.map(u => u.id))} style={{ ...S.btn(), padding: '3px 8px', fontSize: 10 }}>Todas</button>
                  <button type="button" onClick={() => setSelectedIds([])} style={{ ...S.btn(), padding: '3px 8px', fontSize: 10 }}>Ninguna</button>
                </div>
              </div>
              <div style={{ border: '1px solid #E8E6E0', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
                {projectUnits.map((unit, i) => (
                  <label key={unit.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 12, color: '#1A1A1A', borderBottom: i < projectUnits.length - 1 ? '1px solid #F0EEE8' : 'none', background: selectedIds.includes(unit.id) ? '#F0F7FF' : '#fff' }}>
                    <input type="checkbox" checked={selectedIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} style={{ accentColor: '#378ADD' }} />
                    {unit.nombre ?? unit.id.slice(0, 8)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={S.label}>Validez (días)</label>
              <input type="number" min={1} max={90} value={expiryDays} onChange={e => setExpiryDays(parseInt(e.target.value) || 21)} style={{ ...S.input, width: 100 }} />
            </div>
            {error && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving || sending || available.length === 0} style={S.btn(true)}>
              {saving ? 'Creando…' : sending ? 'Enviando…' : 'Invitar y enviar'}
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
  invitation:    FpeInvitation
  projectId:     string
  tenderStatus:  TenderStatus
  projectUnits:  TenderProjectUnit[]
  onStatusChange:(invId: string, newStatus: InvitationStatus) => void
}) {
  const [loading, setLoading] = useState<'revoke' | null>(null)
  const [copied, setCopied]   = useState(false)

  const inv = invitation
  const s   = INV_STATUS_MAP[inv.status]

  const unitNames = inv.scope_unit_ids
    .map(id => projectUnits.find(u => u.id === id)?.nombre)
    .filter(Boolean) as string[]

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/execution-portal/${inv.token}`
    : `/execution-portal/${inv.token}`

  const canCopy   = ['sent', 'viewed', 'bid_submitted'].includes(inv.status)
  const canRevoke = !['revoked', 'expired', 'bid_submitted'].includes(inv.status) && tenderStatus !== 'closed'

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
      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{inv.partner.nombre}</div>
        {inv.partner.email_contacto && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{inv.partner.email_contacto}</div>
        )}
      </td>
      <td style={{ padding: '12px 16px', verticalAlign: 'top', maxWidth: 220 }}>
        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
          {unitNames.length > 0
            ? unitNames.slice(0, 3).join(', ') + (unitNames.length > 3 ? ` +${unitNames.length - 3}` : '')
            : `${inv.scope_unit_ids.length} ud.`}
        </div>
      </td>
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
      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
  scopedChapters,
  unitPartnersMap,
}: {
  projectId:            string
  projectUnits:         TenderProjectUnit[]
  initialTender:        FpeTender | null
  partners:             FpePartnerSummary[]
  initialProjectStatus: string
  scopedChapters:       ScopedChapter[]
  unitPartnersMap:      Record<string, string[]>  // project_unit_id → partner_ids[]
}) {
  const router = useRouter()

  const [tender, setTender]           = useState<FpeTender | null>(initialTender)
  const [projectStatus, setProjStatus] = useState(initialProjectStatus)
  const [showInviteModal, setShowIM]  = useState(false)
  const [showComparison, setShowComp] = useState(false)
  const [showQA, setShowQA]           = useState(false)
  const [closing, setClosing]         = useState(false)
  const [contracting, setContracting] = useState(false)
  const [sending, setSending]         = useState(false)
  const [fechaLimite, setFechaLimite] = useState('')
  const [msg, setMsg]                 = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  // ── Compute packages from unit-partner assignments ────────────────────────

  const packages: PackageDef[] = useMemo(() => {
    const partnerMap = new Map(partners.map(p => [p.id, p]))
    const pkgMap: Map<string, PackageDef> = new Map()

    for (const chapter of scopedChapters) {
      for (const unit of chapter.units) {
        const partnerIds = unitPartnersMap[unit.project_unit_id] ?? []
        for (const pid of partnerIds) {
          if (!pkgMap.has(pid)) {
            const p = partnerMap.get(pid)
            if (!p) continue
            pkgMap.set(pid, { partner_id: pid, partner_nombre: p.nombre, email: p.email_contacto, telefono: p.telefono, chapters: [] })
          }
          const pkg = pkgMap.get(pid)!
          let chEntry = pkg.chapters.find(c => c.chapter_nombre === chapter.nombre)
          if (!chEntry) {
            chEntry = { chapter_nombre: chapter.nombre, unit_nombres: [] }
            pkg.chapters.push(chEntry)
          }
          if (!chEntry.unit_nombres.includes(unit.nombre)) {
            chEntry.unit_nombres.push(unit.nombre)
          }
        }
      }
    }

    return Array.from(pkgMap.values()).sort((a, b) => a.partner_nombre.localeCompare(b.partner_nombre, 'es'))
  }, [scopedChapters, unitPartnersMap, partners])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSendAll = async () => {
    if (!fechaLimite) { flash('err', 'Introduce la fecha límite de ofertas.'); return }
    if (!confirm(`¿Enviar ${packages.length} invitaciones de licitación? Se enviará un correo a cada execution partner.`)) return

    setSending(true)
    const map: Record<string, string[]> = {}
    for (const [unitId, pids] of Object.entries(unitPartnersMap)) {
      map[unitId] = pids
    }
    const res = await createAndSendAllInvitations(projectId, fechaLimite, map)
    setSending(false)

    if ('error' in res) { flash('err', res.error); return }

    flash('ok', `${res.sent} de ${res.total} invitaciones enviadas.`)
    setProjStatus('tender_launched')
    // Reload to fetch fresh tender + invitation data
    router.refresh()
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
    if (!confirm('¿Marcar este proyecto como Contratado?')) return
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

  const existingPartnerIds = (tender?.invitations ?? [])
    .filter(inv => !['revoked', 'expired'].includes(inv.status))
    .map(inv => inv.partner.id)

  const canContract = projectStatus === 'awarded'
  const canClose    = tender?.status === 'launched'

  // ── View A: Packages review (no tender or draft) ──────────────────────────

  const showReview = !tender || tender.status === 'draft' || tender.status === 'cancelled'

  if (showReview) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Lanzar licitación</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            Revisa los paquetes de envío y establece la fecha límite de ofertas antes de enviar.
          </p>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 6, background: msg.type === 'ok' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${msg.type === 'ok' ? '#A7F3D0' : '#FECACA'}`, fontSize: 12, color: msg.type === 'ok' ? '#065F46' : '#DC2626', fontWeight: 500 }}>
            {msg.text}
          </div>
        )}

        {packages.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#888' }}>Sin paquetes de envío</p>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#BBB' }}>
              Asigna execution partners a las unidades de ejecución en la pestaña Documentos antes de lanzar la licitación.
            </p>
          </div>
        ) : (
          <>
            {/* Package cards */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
                  {packages.length} paquete{packages.length !== 1 ? 's' : ''} de licitación
                </span>
                <span style={{ fontSize: 11, color: '#AAA' }}>— un correo por partner</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {packages.map(pkg => (
                  <PackageCard key={pkg.partner_id} pkg={pkg} />
                ))}
              </div>
            </div>

            {/* Send controls */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '20px 24px', display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={S.label}>Fecha límite de ofertas *</label>
                <input
                  type="date"
                  value={fechaLimite}
                  onChange={e => setFechaLimite(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={S.input}
                />
              </div>
              <button
                onClick={handleSendAll}
                disabled={sending || !fechaLimite}
                style={{
                  ...S.btn(true),
                  padding: '9px 24px', fontSize: 13, flexShrink: 0,
                  opacity: !fechaLimite ? 0.5 : 1,
                  background: '#D85A30',
                }}
              >
                {sending ? 'Enviando invitaciones…' : `Enviar ${packages.length} invitación${packages.length !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── View B: Tender launched / closed ─────────────────────────────────────

  const ts = TENDER_STATUS_MAP[tender.status]
  const submittedCount = tender.invitations.filter(i => ['bid_submitted'].includes(i.status)).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Licitación</h2>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: ts.bg, color: ts.color }}>
              {ts.label}
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#555' }}>
            <span style={{ color: '#AAA', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginRight: 5 }}>Límite</span>
            {fmtDate(tender.fecha_limite)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.type === 'ok' ? '#059669' : '#DC2626', fontWeight: 500 }}>
              {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
            </span>
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
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E8E6E0' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
            Invitaciones ({tender.invitations.length})
          </span>
          {tender.status === 'launched' && (
            <button onClick={() => setShowIM(true)} style={{ ...S.btn(true), padding: '6px 12px', fontSize: 11 }}>
              + Añadir partner
            </button>
          )}
        </div>

        {tender.invitations.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#888' }}>No hay invitaciones todavía.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F7F4' }}>
                {['Partner', 'Scope', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', textAlign: 'left' }}>
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

      {/* Bid comparison */}
      {submittedCount > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Comparativa de ofertas</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#888' }}>
                {submittedCount} oferta{submittedCount !== 1 ? 's' : ''} recibida{submittedCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => setShowComp(v => !v)} style={{ ...S.btn(true), padding: '7px 16px' }}>
              {showComparison ? 'Ocultar' : 'Ver comparativa'}
            </button>
          </div>
          {showComparison && <BidComparison tenderId={tender.id} projectId={projectId} />}
        </div>
      )}

      {/* Q&A */}
      {tender.status !== 'draft' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Preguntas y respuestas</h3>
            <button onClick={() => setShowQA(v => !v)} style={{ ...S.btn(), padding: '7px 14px' }}>
              {showQA ? 'Ocultar' : 'Ver Q&A'}
            </button>
          </div>
          {showQA && <QAPanel tenderId={tender.id} projectId={projectId} />}
        </div>
      )}

      {/* Manual invite modal */}
      {showInviteModal && tender && (
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

'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { contractProject, saveUnitPartners } from '@/app/actions/fpe-projects'
import {
  closeTender,
  revokeInvitation,
  createAndSendDisciplineInvitations,
  upsertTenderFechaLimite,
} from '@/app/actions/fpe-tenders'
import PartnerPaymentPlanModal from '@/components/team/fp-execution/PartnerPaymentPlanModal'
import {
  getInvitationPaymentPlan,
  previewPaymentPlanForPartner,
  createPendingInvitationForPartner,
} from '@/app/actions/fpe-payment'
import type { FpeInvitationPaymentPlanItem, FpeDisciplinePaymentMilestone } from '@/lib/fp-execution/domain'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TenderStatus     = 'draft' | 'launched' | 'closed' | 'cancelled'
export type InvitationStatus = 'pending' | 'sent' | 'viewed' | 'bid_submitted' | 'revoked' | 'expired'

export interface FpeDiscipline {
  id: string
  nombre: string
  color: string
  orden: number
}

export interface FpeInvitation {
  id: string
  token: string
  status: InvitationStatus
  scope_unit_ids: string[]
  discipline_ids: string[]
  governing_discipline_id: string | null
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
  disciplines: { id: string; nombre: string; color: string }[]
}

export interface TenderProjectUnit {
  id: string                              // project_unit_id
  template_unit_id: string
  nombre: string
  chapter_id: string
  chapter_nombre: string
  chapter_orden: number
  principal_discipline_id: string | null
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
  btn: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 500,
    background: danger ? '#FEF2F2' : primary ? '#1A1A1A' : '#F0EEE8',
    color: danger ? '#DC2626' : primary ? '#fff' : '#555',
  }),
}

// ── Status maps ───────────────────────────────────────────────────────────────

const TENDER_STATUS_MAP: Record<TenderStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Borrador',  bg: '#F3F4F6', color: '#6B7280' },
  launched:  { label: 'Lanzada',   bg: '#FEF3C7', color: '#D97706' },
  closed:    { label: 'Cerrada',   bg: '#ECFDF5', color: '#059669' },
  cancelled: { label: 'Cancelada', bg: '#FEF2F2', color: '#DC2626' },
}

const INV_STATUS_MAP: Record<InvitationStatus, { label: string; short: string; bg: string; color: string }> = {
  pending:       { label: 'Pendiente envío',  short: 'pend.',  bg: '#F3F4F6', color: '#6B7280' },
  sent:          { label: 'Enviada',          short: 'env.',   bg: '#EBF5FF', color: '#378ADD' },
  viewed:        { label: 'Vista',            short: 'vista',  bg: '#FEF3C7', color: '#D97706' },
  bid_submitted: { label: 'Oferta recibida',  short: 'bid',    bg: '#ECFDF5', color: '#059669' },
  revoked:       { label: 'Revocada',         short: 'rev.',   bg: '#FEF2F2', color: '#DC2626' },
  expired:       { label: 'Expirada',         short: 'exp.',   bg: '#F9FAFB', color: '#9CA3AF' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Partner editor popover (used in both views for in-place editing) ──────────

function PartnerEditorPopover({
  unit,
  allPartners,
  currentPartnerIds,
  projectId,
  disabled,
  invByPartnerId,
  onSaved,
  onClose,
}: {
  unit: TenderProjectUnit
  allPartners: FpePartnerSummary[]
  currentPartnerIds: string[]
  projectId: string
  disabled: boolean
  invByPartnerId: Record<string, FpeInvitation>
  onSaved: (newPartnerIds: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentPartnerIds))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Filter partners by unit discipline
  const relevant = unit.principal_discipline_id
    ? allPartners.filter(p => p.disciplines.some(d => d.id === unit.principal_discipline_id))
    : []

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  const toggle = (pid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid); else next.add(pid)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    const res = await saveUnitPartners(projectId, unit.id, Array.from(selected))
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved(Array.from(selected))
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 50,
        width: 320, maxHeight: 380, overflowY: 'auto',
        background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)', padding: 12,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>{unit.nombre}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: '#888' }}>
          Selecciona los partners invitados a licitar esta UE
        </p>
      </div>

      {!unit.principal_discipline_id ? (
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#D97706' }}>
          Esta UE no tiene disciplina asignada en el template.
        </p>
      ) : relevant.length === 0 ? (
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>
          Ningún partner registrado tiene esta disciplina.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {relevant.map(p => {
            const isSel = selected.has(p.id)
            const inv   = invByPartnerId[p.id]
            const isLocked = disabled && currentPartnerIds.includes(p.id)
              && inv && ['sent', 'viewed', 'bid_submitted'].includes(inv.status)
            return (
              <label
                key={p.id}
                title={isLocked ? 'No se puede quitar: invitación activa. Revoca primero.' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  borderRadius: 5, border: '1px solid',
                  borderColor: isSel ? '#378ADD' : '#E8E6E0',
                  background:  isSel ? '#EBF5FF' : '#fff',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  disabled={isLocked}
                  onChange={() => toggle(p.id)}
                  style={{ accentColor: '#378ADD', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 12, color: '#333', fontWeight: isSel ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.nombre}
                </span>
                {inv && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: INV_STATUS_MAP[inv.status].bg, color: INV_STATUS_MAP[inv.status].color }}>
                    {INV_STATUS_MAP[inv.status].short}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, fontSize: 11, color: '#DC2626', marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={S.btn()}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} style={S.btn(true)}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Partner chip (used in both views) ─────────────────────────────────────────

function PartnerChip({
  nombre,
  inv,
}: {
  nombre: string
  inv: FpeInvitation | undefined
}) {
  const sm = inv ? INV_STATUS_MAP[inv.status] : null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', borderRadius: 12,
      background: sm ? sm.bg : '#F0EEE8',
      color:      sm ? sm.color : '#555',
      fontSize: 11, fontWeight: 600,
    }}>
      {nombre}
      {sm && (
        <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7 }}>
          · {sm.short}
        </span>
      )}
    </span>
  )
}

// ── By-Unit view ──────────────────────────────────────────────────────────────

function ByUnitView({
  units,
  partners,
  unitPartnersMap,
  invByPartnerId,
  projectId,
  editingDisabled,
  onUnitPartnersChange,
  partnersById,
}: {
  units: TenderProjectUnit[]
  partners: FpePartnerSummary[]
  unitPartnersMap: Record<string, string[]>
  invByPartnerId: Record<string, FpeInvitation>
  projectId: string
  editingDisabled: boolean
  onUnitPartnersChange: (project_unit_id: string, partner_ids: string[]) => void
  partnersById: Record<string, FpePartnerSummary>
}) {
  const [editing, setEditing] = useState<string | null>(null)

  // Group units by chapter
  const grouped = useMemo(() => {
    const m: Record<string, { chapter_nombre: string; chapter_orden: number; units: TenderProjectUnit[] }> = {}
    for (const u of units) {
      if (!m[u.chapter_id]) m[u.chapter_id] = { chapter_nombre: u.chapter_nombre, chapter_orden: u.chapter_orden, units: [] }
      m[u.chapter_id].units.push(u)
    }
    return Object.entries(m).sort((a, b) => a[1].chapter_orden - b[1].chapter_orden)
  }, [units])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {grouped.map(([chId, ch]) => (
        <div key={chId} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'visible' }}>
          <div style={{ padding: '10px 16px', background: '#F8F7F4', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{ch.chapter_nombre}</span>
            <span style={{ fontSize: 10, color: '#999' }}>{ch.units.length} UE{ch.units.length !== 1 ? 's' : ''}</span>
          </div>
          <div>
            {ch.units.map(u => {
              const partnerIds = unitPartnersMap[u.id] ?? []
              const isEmpty = partnerIds.length === 0
              const isOpen = editing === u.id
              return (
                <div key={u.id} style={{ padding: '10px 16px', borderTop: '1px solid #F0EEE8', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#1A1A1A', marginBottom: 6 }}>{u.nombre}</div>
                    {isEmpty ? (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 10, background: '#FEE2E2', color: '#991B1B' }}>
                        SIN PARTNERS
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {partnerIds.map(pid => (
                          <PartnerChip
                            key={pid}
                            nombre={partnersById[pid]?.nombre ?? pid}
                            inv={invByPartnerId[pid]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, position: 'relative' }}>
                    <button
                      onClick={() => setEditing(isOpen ? null : u.id)}
                      style={{ ...S.btn(), padding: '5px 10px', fontSize: 11 }}
                    >
                      {isOpen ? 'Cerrar' : 'Editar'}
                    </button>
                    {isOpen && (
                      <PartnerEditorPopover
                        unit={u}
                        allPartners={partners}
                        currentPartnerIds={partnerIds}
                        projectId={projectId}
                        disabled={editingDisabled}
                        invByPartnerId={invByPartnerId}
                        onClose={() => setEditing(null)}
                        onSaved={ids => onUnitPartnersChange(u.id, ids)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── By-Partner view ───────────────────────────────────────────────────────────

function ByPartnerView({
  units,
  partnerPacks,
  partnersById,
  invByPartnerId,
  projectId,
  editingDisabled,
  onRevoke,
  fechaLimite,
  onInvitationCreated,
}: {
  units: TenderProjectUnit[]
  partnerPacks: Record<string, string[]>     // partner_id → project_unit_ids[]
  partnersById: Record<string, FpePartnerSummary>
  invByPartnerId: Record<string, FpeInvitation>
  projectId: string
  editingDisabled: boolean
  onRevoke: (invId: string) => Promise<void>
  fechaLimite: string
  onInvitationCreated: (partnerId: string, invId: string) => void
}) {
  const unitsById: Record<string, TenderProjectUnit> = useMemo(() => {
    const m: Record<string, TenderProjectUnit> = {}
    for (const u of units) m[u.id] = u
    return m
  }, [units])

  const packEntries = Object.entries(partnerPacks)
    .filter(([, unitIds]) => unitIds.length > 0)
    .sort(([a], [b]) => (partnersById[a]?.nombre ?? '').localeCompare(partnersById[b]?.nombre ?? '', 'es'))

  if (packEntries.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0' }}>
        <p style={{ fontSize: 12, color: '#888' }}>
          Ningún partner tiene UEs asignadas todavía. Asígnalos en la vista por UE o desde la pestaña de Documentación.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {packEntries.map(([pid, unitIds]) => {
        const partner = partnersById[pid]
        const inv     = invByPartnerId[pid]
        const sm      = inv ? INV_STATUS_MAP[inv.status] : null

        // Group these UEs by chapter
        const byChapter: Record<string, { nombre: string; orden: number; unitNames: string[] }> = {}
        for (const uid of unitIds) {
          const u = unitsById[uid]
          if (!u) continue
          if (!byChapter[u.chapter_id]) byChapter[u.chapter_id] = { nombre: u.chapter_nombre, orden: u.chapter_orden, unitNames: [] }
          byChapter[u.chapter_id].unitNames.push(u.nombre)
        }
        const chList = Object.values(byChapter).sort((a, b) => a.orden - b.orden)
        const chCount = chList.length

        // Derive pack discipline distribution
        const discCount: Record<string, { nombre: string; color: string; count: number }> = {}
        for (const uid of unitIds) {
          const u = unitsById[uid]
          if (!u?.principal_discipline_id) continue
          const d = partner?.disciplines.find(d => d.id === u.principal_discipline_id)
          if (!d) continue
          if (!discCount[d.id]) discCount[d.id] = { nombre: d.nombre, color: d.color, count: 0 }
          discCount[d.id].count++
        }
        const discList = Object.values(discCount).sort((a, b) => b.count - a.count)

        // Revocar siempre disponible para invitaciones activas (incluso tras
        // lanzar): el caso de uso principal es retirar una invitación ya
        // enviada que ya no aplica.
        const canRevoke = inv && ['pending', 'sent', 'viewed'].includes(inv.status)

        return (
          <div key={pid} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' }}>
            {/* Card header */}
            <div style={{ padding: '14px 20px', background: '#1A1A1A', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{partner?.nombre ?? pid}</div>
                {partner?.email_contacto && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{partner.email_contacto}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {sm && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 10, background: sm.bg, color: sm.color }}>
                    {sm.label}
                  </span>
                )}
                {!sm && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                    Sin invitar
                  </span>
                )}
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Disciplines summary */}
              {discList.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {discList.map(d => (
                    <span key={d.nombre} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: d.color + '20', color: d.color }}>
                      {d.nombre} · {d.count} UE{d.count !== 1 ? 's' : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Chapters + units */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={S.label}>Pack: {unitIds.length} UEs en {chCount} capítulo{chCount !== 1 ? 's' : ''}</span>
                {chList.map(ch => (
                  <div key={ch.nombre} style={{ padding: '8px 10px', background: '#FAFAF8', borderRadius: 6, border: '1px solid #F0EEE8' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 3 }}>{ch.nombre}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {ch.unitNames.map(n => (
                        <span key={n} style={{ fontSize: 11, color: '#777' }}>— {n}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment plan — siempre visible: preview si aún no hay invitación,
                  plan persistido si ya existe. */}
              <PartnerPaymentSummary
                invitationId={inv?.id ?? null}
                partnerId={pid}
                projectId={projectId}
                partnerNombre={partner?.nombre ?? pid}
                fechaLimiteDefault={fechaLimite}
                onInvitationCreated={(invId) => onInvitationCreated(pid, invId)}
              />

              {/* Invitation meta */}
              {inv && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#888', paddingTop: 8, borderTop: '1px solid #F0EEE8' }}>
                  {inv.sent_at         && <span>Enviada: {fmtDate(inv.sent_at)}</span>}
                  {inv.viewed_at       && <span>Vista: {fmtDate(inv.viewed_at)}</span>}
                  {inv.bid_submitted_at && <span style={{ color: '#059669', fontWeight: 600 }}>Oferta: {fmtDate(inv.bid_submitted_at)}</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {['sent', 'viewed', 'bid_submitted'].includes(inv.status) && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/execution-portal/${inv.token}`
                          navigator.clipboard.writeText(url)
                        }}
                        style={{ ...S.btn(), padding: '4px 10px', fontSize: 10 }}
                      >
                        Copiar enlace
                      </button>
                    )}
                    {canRevoke && (
                      <button
                        onClick={() => {
                          if (confirm(`¿Revocar la invitación de ${partner?.nombre}?`)) onRevoke(inv.id)
                        }}
                        style={{ ...S.btn(false, true), padding: '4px 10px', fontSize: 10 }}
                      >
                        Revocar
                      </button>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Partner Payment Summary (resumen del plan en la card) ────────────────────

const TRIGGER_SHORT: Record<'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start', string> = {
  contract_signed:    'Firma',
  milestone_achieved: 'Hito ejec.',
  delivery:           'Entrega',
  pre_start:          'Pre-inicio partner',
  pre_project_start:  'Pre-inicio obra',
}

interface PreviewItem {
  nombre: string
  pct: number
  trigger_type: 'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start'
  milestone_id: string | null
}

interface RefBlock {
  discipline_id: string
  nombre: string
  color: string
  weight: number
  milestones: FpeDisciplinePaymentMilestone[]
}

function PartnerPaymentSummary({
  invitationId,
  partnerId,
  projectId,
  partnerNombre,
  fechaLimiteDefault,
  onInvitationCreated,
}: {
  invitationId: string | null
  partnerId: string
  projectId: string
  partnerNombre: string
  fechaLimiteDefault: string
  onInvitationCreated: (invId: string) => void
}) {
  const [persistedPlan, setPersistedPlan]    = useState<FpeInvitationPaymentPlanItem[] | null>(null)
  const [previewPlan, setPreviewPlan]        = useState<PreviewItem[] | null>(null)
  const [reference, setReference]            = useState<RefBlock[]>([])
  const [milestoneNames, setMilestoneNames]  = useState<Record<string, string>>({})
  const [loading, setLoading]                = useState(true)
  const [openModal, setOpenModal]            = useState(false)
  const [showRef, setShowRef]                = useState(false)
  const [creating, setCreating]              = useState(false)
  const [err, setErr]                        = useState<string | null>(null)
  // Si "Personalizar plan" crea una invitación pending, guardamos su id
  // localmente para poder abrir el modal sin esperar al refresh del padre.
  const [pendingInvId, setPendingInvId]      = useState<string | null>(null)
  const effectiveInvId = invitationId ?? pendingInvId

  const load = async () => {
    setLoading(true); setErr(null)
    if (effectiveInvId) {
      const res = await getInvitationPaymentPlan(effectiveInvId)
      setLoading(false)
      if ('error' in res) { setPersistedPlan([]); return }
      setPersistedPlan(res.plan)
      setReference(res.reference.map(r => ({
        discipline_id: r.discipline_id,
        nombre:        r.nombre,
        color:         r.color,
        weight:        res.disciplines.find(d => d.id === r.discipline_id)?.weight ?? 0,
        milestones:    r.milestones,
      })))
      const map: Record<string, string> = {}
      for (const m of res.availableMilestones) map[m.id] = m.nombre
      setMilestoneNames(map)
    } else {
      const res = await previewPaymentPlanForPartner(projectId, partnerId)
      setLoading(false)
      if ('error' in res) { setErr(res.error); setPreviewPlan([]); return }
      setPreviewPlan(res.preview.map(p => ({
        nombre: p.nombre, pct: Number(p.pct), trigger_type: p.trigger_type, milestone_id: p.milestone_id,
      })))
      setReference(res.reference.map(r => ({
        discipline_id: r.discipline_id,
        nombre:        r.nombre,
        color:         r.color,
        weight:        res.disciplines.find(d => d.id === r.discipline_id)?.weight ?? 0,
        milestones:    r.milestones,
      })))
      const map: Record<string, string> = {}
      for (const m of res.availableMilestones) map[m.id] = m.nombre
      setMilestoneNames(map)
    }
  }

  useEffect(() => { void load() /* eslint-disable-next-line */ }, [effectiveInvId, partnerId, projectId])

  const handlePersonalize = async () => {
    if (!fechaLimiteDefault) {
      setErr('Define primero la fecha límite de ofertas arriba.')
      return
    }
    setCreating(true); setErr(null)
    const res = await createPendingInvitationForPartner(projectId, partnerId, fechaLimiteDefault)
    setCreating(false)
    if ('error' in res) { setErr(res.error); return }
    setPendingInvId(res.invitation_id)
    onInvitationCreated(res.invitation_id)
    setOpenModal(true)
  }

  const isPreview = !effectiveInvId
  const items: { nombre: string; pct: number; trigger_type: 'contract_signed' | 'milestone_achieved' | 'delivery' | 'pre_start' | 'pre_project_start'; milestone_id: string | null }[] =
    isPreview
      ? (previewPlan ?? [])
      : (persistedPlan ?? []).map(p => ({ nombre: p.nombre, pct: Number(p.pct), trigger_type: p.trigger_type, milestone_id: p.milestone_id }))

  const total = items.reduce((s, p) => s + p.pct, 0)
  const totalOk = Math.abs(total - 100) < 0.01
  const refsWithMilestones = reference.filter(r => r.milestones.length > 0)
  const hasMultipleDisciplines = reference.filter(r => r.weight > 0).length > 1

  return (
    <>
      <div style={{ paddingTop: 10, borderTop: '1px solid #F0EEE8' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.label}>{isPreview ? 'Plan de pago (preview)' : 'Plan de pago propuesto'}</span>
            {items.length > 0 && (
              <span style={{ fontSize: 10, color: totalOk ? '#059669' : '#DC2626', fontWeight: 600 }}>
                {items.length} hito{items.length !== 1 ? 's' : ''} · {total.toFixed(0)}%
              </span>
            )}
            {isPreview && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 8, background: '#FEF3C7', color: '#92400E' }}>
                PREVIEW
              </span>
            )}
            {hasMultipleDisciplines && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: '#DBEAFE', color: '#1E40AF' }}>
                Cruza disciplinas · revisar
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {refsWithMilestones.length > 0 && (
              <button onClick={() => setShowRef(v => !v)} style={miniLinkBtn}>
                {showRef ? 'Ocultar referencia' : `Ver referencia (${refsWithMilestones.length})`}
              </button>
            )}
            {isPreview ? (
              <button onClick={handlePersonalize} disabled={creating} style={{ ...miniLinkBtn, background: '#1A1A1A', color: '#fff', border: '1px solid #1A1A1A' }}>
                {creating ? 'Creando…' : 'Personalizar plan'}
              </button>
            ) : (
              <button onClick={() => setOpenModal(true)} style={miniLinkBtn}>
                Editar plan
              </button>
            )}
          </div>
        </div>

        {/* Plan items */}
        {loading ? (
          <span style={{ fontSize: 11, color: '#BBB', fontStyle: 'italic' }}>Cargando plan…</span>
        ) : items.length === 0 ? (
          <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>
            {isPreview
              ? 'No hay hitos de pago configurados para las disciplinas de este pack. Define los hitos estándar en /team/fp-execution/template antes de lanzar.'
              : 'Sin hitos de pago. Pulsa "Editar plan" para configurarlos.'}
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {items.map((p, i) => {
              const milestoneLabel =
                p.trigger_type === 'milestone_achieved'
                  ? (p.milestone_id ? (milestoneNames[p.milestone_id] ?? '—') : 'Sin hito asociado')
                  : null
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 60px 180px', gap: 8, padding: '5px 8px', background: '#FAFAF8', borderRadius: 4, fontSize: 11, color: '#555', alignItems: 'center' }}>
                  <span style={{ color: '#999' }}>{i + 1}</span>
                  <span style={{ color: '#1A1A1A' }}>{p.nombre}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1A1A1A' }}>{p.pct.toFixed(2)}%</span>
                  <span style={{ fontSize: 10, color: '#888', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {TRIGGER_SHORT[p.trigger_type]}
                    {milestoneLabel && (
                      <span style={{ marginLeft: 4, color: p.milestone_id ? '#1A1A1A' : '#DC2626' }}>
                        · {milestoneLabel}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Reference (estándar de mercado por disciplina) */}
        {showRef && refsWithMilestones.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff', border: '1px dashed #E8E6E0', borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Estándar de mercado por disciplina del pack
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {refsWithMilestones.map(r => (
                <div key={r.discipline_id} style={{ padding: '6px 8px', background: '#FAFAF8', borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: r.color }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>{r.nombre}</span>
                    <span style={{ fontSize: 10, color: '#888' }}>· {r.weight} UE</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.milestones.map(m => (
                      <span key={m.id} style={{ fontSize: 10, padding: '2px 6px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, color: '#555' }}>
                        {m.nombre} · {Number(m.pct).toFixed(0)}% · {TRIGGER_SHORT[m.trigger_type]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {err && <div style={{ marginTop: 6, fontSize: 11, color: '#DC2626' }}>✗ {err}</div>}
      </div>

      {openModal && effectiveInvId && (
        <PartnerPaymentPlanModal
          invitationId={effectiveInvId}
          partnerNombre={partnerNombre}
          onClose={() => setOpenModal(false)}
          onSaved={() => { void load() }}
        />
      )}
    </>
  )
}

const miniLinkBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 10, fontWeight: 600,
  background: '#fff', color: '#1A1A1A', border: '1px solid #E8E6E0',
  borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
}

// ── Main TenderPanel ──────────────────────────────────────────────────────────

export default function TenderPanel({
  projectId,
  projectUnits,
  initialUnitPartners,
  initialTender,
  partners,
  initialProjectStatus,
  onNavigateToBidding,
}: {
  projectId:            string
  projectUnits:         TenderProjectUnit[]
  initialUnitPartners:  Record<string, string[]>
  initialTender:        FpeTender | null
  partners:             FpePartnerSummary[]
  initialProjectStatus: string
  onNavigateToBidding?: () => void
}) {
  const router = useRouter()

  const [tender, setTender]               = useState<FpeTender | null>(initialTender)
  const [unitPartnersMap, setUPM]         = useState<Record<string, string[]>>(initialUnitPartners)
  const [projectStatus, setProjStatus]     = useState(initialProjectStatus)
  const [view, setView]                   = useState<'by_unit' | 'by_partner'>('by_partner')
  // Inicializa desde el tender existente; el autosave persiste cualquier cambio.
  // fpe_tenders.fecha_limite es timestamptz → llega como ISO con tz; <input type="date">
  // necesita YYYY-MM-DD exacto o se queda vacío.
  const [fechaLimite, setFechaLimite]     = useState((initialTender?.fecha_limite ?? '').slice(0, 10))
  const [fechaStatus, setFechaStatus]     = useState<'idle' | 'saving' | 'saved' | 'err'>('idle')
  const [sending, setSending]             = useState(false)
  const [closing, setClosing]             = useState(false)
  const [contracting, setContracting]     = useState(false)
  const [msg, setMsg]                     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4500)
  }

  // Autosave de la fecha límite (debounced 700ms). Reusa o crea tender draft.
  const fechaTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstFecha  = useRef(true)
  useEffect(() => {
    if (isFirstFecha.current) { isFirstFecha.current = false; return }
    if (!fechaLimite) return
    if (fechaTimer.current) clearTimeout(fechaTimer.current)
    fechaTimer.current = setTimeout(async () => {
      setFechaStatus('saving')
      const res = await upsertTenderFechaLimite(projectId, fechaLimite)
      if ('error' in res) { setFechaStatus('err'); return }
      setFechaStatus('saved')
      setTimeout(() => setFechaStatus('idle'), 2000)
    }, 700)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaLimite])

  // ── Derived data ──────────────────────────────────────────────────────────

  const partnersById: Record<string, FpePartnerSummary> = useMemo(() => {
    const m: Record<string, FpePartnerSummary> = {}
    for (const p of partners) m[p.id] = p
    return m
  }, [partners])

  // partner_id → project_unit_ids[]  (the "pack")
  const partnerPacks = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const [unitId, partnerIds] of Object.entries(unitPartnersMap)) {
      for (const pid of partnerIds) {
        if (!m[pid]) m[pid] = []
        m[pid].push(unitId)
      }
    }
    return m
  }, [unitPartnersMap])

  // partner_id → discipline_ids[] derivado de las UEs asignadas. Solo partners
  // con al menos una UE de disciplina principal definida. Esta es la fuente
  // de verdad para "cuántas invitaciones enviar" y "qué disciplinas lleva
  // cada partner en su invitación".
  const partnerDisciplinesByPartner = useMemo(() => {
    const unitById: Record<string, TenderProjectUnit> = {}
    for (const u of projectUnits) unitById[u.id] = u
    const m: Record<string, string[]> = {}
    for (const [pid, unitIds] of Object.entries(partnerPacks)) {
      const discSet = new Set<string>()
      for (const uid of unitIds) {
        const did = unitById[uid]?.principal_discipline_id
        if (did) discSet.add(did)
      }
      if (discSet.size > 0) m[pid] = Array.from(discSet)
    }
    return m
  }, [partnerPacks, projectUnits])

  const partnerLaunchCount = Object.keys(partnerDisciplinesByPartner).length

  // partner_id → invitation
  const invByPartnerId = useMemo(() => {
    const m: Record<string, FpeInvitation> = {}
    for (const inv of (tender?.invitations ?? [])) {
      // Keep most relevant invitation (skip revoked if there's a newer non-revoked)
      const existing = m[inv.partner.id]
      if (!existing || inv.status !== 'revoked') m[inv.partner.id] = inv
    }
    return m
  }, [tender])

  // UEs without partners
  const unassignedUnits = useMemo(
    () => projectUnits.filter(u => (unitPartnersMap[u.id] ?? []).length === 0),
    [projectUnits, unitPartnersMap]
  )

  const submittedCount = (tender?.invitations ?? []).filter(i => i.status === 'bid_submitted').length

  const isLaunched = tender?.status === 'launched' || tender?.status === 'closed'
  const canLaunch  = unassignedUnits.length === 0 && projectUnits.length > 0
  const canSendMore = isLaunched && Object.keys(partnerPacks).some(pid => !invByPartnerId[pid] || invByPartnerId[pid].status === 'revoked')
  const canContract = projectStatus === 'awarded'

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleUnitPartnersChange = (project_unit_id: string, partner_ids: string[]) => {
    setUPM(prev => ({ ...prev, [project_unit_id]: partner_ids }))
  }

  // Bulk send. Construye el map partner-céntrico: por cada partner con UEs
  // asignadas, recolecta las disciplinas principales de esas UEs (NO el subset
  // de disciplinas declaradas en el perfil del partner — eso lo filtra después
  // el portal). De este modo dos partners que comparten una misma disciplina
  // principal generan dos invitaciones distintas.
  const handleLaunch = async () => {
    if (!fechaLimite) { flash('err', 'Introduce la fecha límite de ofertas.'); return }
    if (!canLaunch) { flash('err', `Faltan ${unassignedUnits.length} UE(s) sin partner asignado.`); return }

    if (partnerLaunchCount === 0) {
      flash('err', 'No se pudo derivar la asignación de partners. Revisa las disciplinas principales de las UEs.')
      return
    }

    if (!confirm(`¿Enviar ${partnerLaunchCount} invitaciones de licitación? Se enviará un correo a cada execution partner.`)) return

    setSending(true)
    const res = await createAndSendDisciplineInvitations(projectId, fechaLimite, partnerDisciplinesByPartner)
    setSending(false)

    if ('error' in res) { flash('err', res.error); return }

    flash('ok', `${res.sent} de ${res.total} invitaciones enviadas.`)
    setProjStatus('tender_launched')
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

  // Al pulsar "Personalizar plan" en una card sin invitación todavía, el modal
  // crea una invitación pending. Refrescamos para que la card pase del modo
  // "preview" al modo "plan persistido".
  const handlePendingInvitationCreated = (_partnerId: string, _invId: string) => {
    router.refresh()
  }

  const handleRevoke = async (invId: string) => {
    const res = await revokeInvitation(invId, projectId)
    if ('error' in res) { flash('err', res.error); return }
    setTender(t => t ? {
      ...t,
      invitations: t.invitations.map(inv =>
        inv.id === invId ? { ...inv, status: 'revoked' } : inv
      ),
    } : t)
    flash('ok', 'Invitación revocada.')
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const ts = tender ? TENDER_STATUS_MAP[tender.status] : null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Licitación</h2>
            {ts && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: ts.bg, color: ts.color }}>
                {ts.label}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            Asigna y revisa qué partners participan en cada UE. Los packs por partner se calculan automáticamente.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.type === 'ok' ? '#059669' : '#DC2626', fontWeight: 500 }}>
              {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
            </span>
          )}
          {tender?.status === 'launched' && (
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

      {/* Bloqueo duro: UEs sin partner */}
      {unassignedUnits.length > 0 && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: '#FEE2E2', color: '#991B1B' }}>
              {unassignedUnits.length} UE{unassignedUnits.length !== 1 ? 's' : ''} sin partner
            </span>
            <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
              No se puede lanzar la licitación hasta que todas las UEs tengan al menos un partner asignado.
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, maxHeight: 160, overflowY: 'auto' }}>
            {unassignedUnits.map(u => (
              <div key={u.id} style={{ fontSize: 11, color: '#7F1D1D' }}>
                — <strong>{u.chapter_nombre}</strong> · {u.nombre}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Launch / send controls (visible when not yet launched OR when there are pack changes) */}
      {(!isLaunched || canSendMore) && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '16px 20px', display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={S.label}>Fecha límite de ofertas *</span>
              {fechaStatus !== 'idle' && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: fechaStatus === 'err' ? '#DC2626' : fechaStatus === 'saved' ? '#059669' : '#888',
                }}>
                  {fechaStatus === 'saving' ? 'Guardando…' : fechaStatus === 'saved' ? '✓ Guardado' : '✗ Error'}
                </span>
              )}
            </div>
            <input
              type="date"
              value={fechaLimite}
              onChange={e => setFechaLimite(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={S.input}
            />
          </div>
          <button
            onClick={handleLaunch}
            disabled={sending || !canLaunch || !fechaLimite}
            style={{
              ...S.btn(true),
              padding: '9px 22px', fontSize: 13, flexShrink: 0,
              opacity: (!canLaunch || !fechaLimite) ? 0.45 : 1,
              background: '#D85A30',
              cursor: (!canLaunch || !fechaLimite) ? 'not-allowed' : 'pointer',
            }}
          >
            {sending
              ? 'Enviando invitaciones…'
              : isLaunched
                ? 'Enviar invitaciones pendientes'
                : `Enviar ${partnerLaunchCount} invitación${partnerLaunchCount !== 1 ? 'es' : ''}`}
          </button>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F0EEE8', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        <button
          onClick={() => setView('by_unit')}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: view === 'by_unit' ? '#fff' : 'transparent',
            color:      view === 'by_unit' ? '#1A1A1A' : '#888',
            boxShadow:  view === 'by_unit' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          Por UE ({projectUnits.length})
        </button>
        <button
          onClick={() => setView('by_partner')}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: view === 'by_partner' ? '#fff' : 'transparent',
            color:      view === 'by_partner' ? '#1A1A1A' : '#888',
            boxShadow:  view === 'by_partner' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          Por partner ({Object.keys(partnerPacks).length})
        </button>
      </div>

      {/* Active view */}
      {view === 'by_unit' && (
        <ByUnitView
          units={projectUnits}
          partners={partners}
          unitPartnersMap={unitPartnersMap}
          invByPartnerId={invByPartnerId}
          projectId={projectId}
          editingDisabled={isLaunched}
          onUnitPartnersChange={handleUnitPartnersChange}
          partnersById={partnersById}
        />
      )}
      {view === 'by_partner' && (
        <ByPartnerView
          units={projectUnits}
          partnerPacks={partnerPacks}
          partnersById={partnersById}
          invByPartnerId={invByPartnerId}
          projectId={projectId}
          editingDisabled={isLaunched}
          onRevoke={handleRevoke}
          fechaLimite={fechaLimite}
          onInvitationCreated={handlePendingInvitationCreated}
        />
      )}

      {/* CTA to bidding tab when offers start arriving */}
      {tender && submittedCount > 0 && onNavigateToBidding && (
        <div style={{
          marginTop: 24, padding: '14px 18px', borderRadius: 10,
          background: '#ECFDF5', border: '1px solid #6EE7B7',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
              {submittedCount} oferta{submittedCount !== 1 ? 's' : ''} recibida{submittedCount !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11, color: '#047857', marginTop: 3 }}>
              Compara precios, plazos y adjudica desde la pestaña de Licitación.
            </div>
          </div>
          <button
            onClick={onNavigateToBidding}
            style={{
              padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#059669', color: '#fff',
            }}
          >
            Ir a Licitación →
          </button>
        </div>
      )}
    </div>
  )
}

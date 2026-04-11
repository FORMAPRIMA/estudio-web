'use client'

import React, { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Partner {
  id:              string
  nombre:          string
  contacto_nombre: string | null
  email_contacto:  string | null
}

interface BidLineItem {
  bid_id:              string
  project_line_item_id: string
  precio_unitario:     number
  project_line_item: {
    id:      string
    cantidad: number
    template_line_item: { nombre: string; unidad_medida: string } | null
    project_unit: { id: string; template_unit: { nombre: string } | null } | null
  } | null
}

interface PhaseDuration {
  bid_id:            string
  template_phase_id: string
  project_unit_id:   string
  duracion_dias:     number
  phase:             { nombre: string; orden: number } | null
}

interface Contract {
  id:                   string
  award_id:             string
  status:               string
  sent_at:              string | null
  signed_at:            string | null
  docusign_envelope_id: string | null
  contenido_json:       Record<string, unknown>
}

export interface EnrichedAward {
  id:              string
  awarded_at:      string
  notas:           string | null
  partner:         Partner | null
  contract:        Contract | null
  line_items:      BidLineItem[]
  phase_durations: PhaseDuration[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

const CONTRACT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Borrador',        bg: '#F3F4F6', color: '#6B7280' },
  sent_to_sign: { label: 'Pendiente firma', bg: '#FEF3C7', color: '#92400E' },
  signed:       { label: 'Firmado',         bg: '#D1FAE5', color: '#065F46' },
  cancelled:    { label: 'Cancelado',       bg: '#FEE2E2', color: '#991B1B' },
}

// ── Partner Card ──────────────────────────────────────────────────────────────

function PartnerCard({ award }: { award: EnrichedAward }) {
  const [expanded, setExpanded] = useState(false)
  const { partner, contract, line_items, phase_durations } = award

  if (!partner) return null

  // Group line items by unit
  const unitGroups = new Map<string, { items: { nombre: string; unidad: string; cantidad: number; precio: number; total: number }[] }>()
  for (const li of line_items) {
    const proj      = li.project_line_item
    const unitName  = proj?.project_unit?.template_unit?.nombre ?? 'General'
    if (!unitGroups.has(unitName)) unitGroups.set(unitName, { items: [] })
    unitGroups.get(unitName)!.items.push({
      nombre:   proj?.template_line_item?.nombre ?? '—',
      unidad:   proj?.template_line_item?.unidad_medida ?? '',
      cantidad: proj?.cantidad ?? 0,
      precio:   li.precio_unitario,
      total:    (proj?.cantidad ?? 0) * li.precio_unitario,
    })
  }

  const totalImporte = line_items.reduce((s, li) => s + (li.project_line_item?.cantidad ?? 0) * li.precio_unitario, 0)
  const totalDays    = phase_durations.reduce((s, pd) => s + pd.duracion_dias, 0)

  // Group phase durations by unit
  const phasesByUnit = new Map<string, PhaseDuration[]>()
  for (const pd of phase_durations) {
    const matchLi  = line_items.find(li => li.project_line_item?.project_unit?.id === pd.project_unit_id)
    const unitName = matchLi?.project_line_item?.project_unit?.template_unit?.nombre ?? pd.project_unit_id
    if (!phasesByUnit.has(unitName)) phasesByUnit.set(unitName, [])
    phasesByUnit.get(unitName)!.push(pd)
  }

  const cStatus = contract ? (CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.draft) : null

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#1A1A1A', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{partner.nombre}</div>
            {partner.email_contacto && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{partner.email_contacto}</div>
            )}
            {partner.contacto_nombre && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{partner.contacto_nombre}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#D85A30', fontFamily: 'monospace' }}>
              {fmtEur(totalImporte)}
            </div>
            {totalDays > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {totalDays} días laborales totales
              </div>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              Adjudicado {fmtDate(award.awarded_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Contract status */}
      {contract && cStatus && (
        <div style={{ padding: '10px 24px', background: '#F8F7F4', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA' }}>Contrato</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: cStatus.bg, color: cStatus.color }}>
              {cStatus.label}
            </span>
            {contract.sent_at && (
              <span style={{ fontSize: 11, color: '#888' }}>Enviado {fmtDate(contract.sent_at)}</span>
            )}
            {contract.signed_at && (
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>· Firmado {fmtDate(contract.signed_at)}</span>
            )}
          </div>
          {contract.docusign_envelope_id && (
            <span style={{ fontSize: 10, color: '#BBB', fontFamily: 'monospace' }}>
              DS: {contract.docusign_envelope_id.slice(0, 14)}…
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '16px 24px' }}>
        {/* Unit badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
          {Array.from(unitGroups.keys()).map(uName => (
            <span key={uName} style={{ fontSize: 11, padding: '4px 10px', background: '#F0EEE8', borderRadius: 20, color: '#555', fontWeight: 500 }}>
              {uName}
            </span>
          ))}
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {expanded ? '▲ Ocultar detalle' : '▶ Ver partidas y plazos'}
        </button>

        {expanded && (
          <div style={{ marginTop: 16 }}>
            {Array.from(unitGroups.entries()).map(([unitNombre, { items }]) => {
              const unitTotal  = items.reduce((s, i) => s + i.total, 0)
              const unitPhases = phasesByUnit.get(unitNombre) ?? []

              return (
                <div key={unitNombre} style={{ marginBottom: 20 }}>
                  <div style={{ padding: '8px 12px', background: '#F5F4F0', borderRadius: '6px 6px 0 0', borderBottom: '1px solid #E8E6E0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                        {unitNombre}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#555', fontFamily: 'monospace' }}>
                        {fmtEur(unitTotal)}
                      </span>
                    </div>
                    {unitPhases.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 6 }}>
                        {[...unitPhases].sort((a, b) => (a.phase?.orden ?? 0) - (b.phase?.orden ?? 0)).map(pd => (
                          <span key={pd.template_phase_id} style={{ fontSize: 10, padding: '2px 7px', background: '#EFF6FF', borderRadius: 20, color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                            {pd.phase?.nombre ?? '—'}: <strong>{pd.duracion_dias}d</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E8E6E0', borderTop: 'none' }}>
                    <thead>
                      <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0EEE8' }}>
                        {['Partida','Ud.','Cant.','P/Ud','Total'].map(h => (
                          <th key={h} style={{ padding: '6px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#AAA', textAlign: h === 'Partida' ? 'left' : 'right' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F0EEE8', background: idx % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: '#333' }}>{item.nombre}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#888', textAlign: 'right' }}>{item.unidad}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: '#555', textAlign: 'right', fontFamily: 'monospace' }}>{item.cantidad}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: '#555', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEur(item.precio)}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#1A1A1A', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEur(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DreamTeamClient({ awards }: { awards: EnrichedAward[] }) {
  const totalContracted = awards.reduce((s, a) =>
    s + a.line_items.reduce((ls, li) => ls + (li.project_line_item?.cantidad ?? 0) * li.precio_unitario, 0)
  , 0)

  const signedCount = awards.filter(a => a.contract?.status === 'signed').length

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '18px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#AAA', marginBottom: 8 }}>
            Partners adjudicados
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A' }}>{awards.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '18px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#AAA', marginBottom: 8 }}>
            Total contratado
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#D85A30', fontFamily: 'monospace' }}>
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(totalContracted)}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '18px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#AAA', marginBottom: 8 }}>
            Contratos firmados
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: signedCount === awards.length && awards.length > 0 ? '#059669' : '#1A1A1A' }}>
            {signedCount} / {awards.length}
          </div>
        </div>
      </div>

      {/* Partner cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {awards.map(award => (
          <PartnerCard key={award.id} award={award} />
        ))}
      </div>
    </div>
  )
}

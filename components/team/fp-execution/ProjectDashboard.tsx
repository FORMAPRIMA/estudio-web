'use client'

import React, { useState } from 'react'
import type { FpeDoc, ScopedChapter, ReadinessCheck } from './DocumentHub'
import type { FpeTender, FpeInvitation } from './TenderPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardProject {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  ciudad: string | null
  status: string
  readiness_score: number
  created_at: string
}

export interface ProjectDashboardProps {
  project: DashboardProject
  renderUrls: string[]
  initialChecks: ReadinessCheck[]
  initialTender: FpeTender | null
  initialDocs: FpeDoc[]
  scopedChapters: ScopedChapter[]
  linkedProyectoNombre: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  borrador:        'Borrador',
  scope_ready:     'Scope listo',
  tender_launched: 'En licitación',
  awarded:         'Adjudicado',
  contracted:      'Contratado',
  archived:        'Archivado',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  borrador:        { bg: 'rgba(255,255,255,0.15)', color: '#fff' },
  scope_ready:     { bg: 'rgba(55,138,221,0.25)', color: '#93C5FD' },
  tender_launched: { bg: 'rgba(217,119,6,0.3)',   color: '#FCD34D' },
  awarded:         { bg: 'rgba(5,150,105,0.3)',   color: '#6EE7B7' },
  contracted:      { bg: 'rgba(6,95,70,0.3)',     color: '#34D399' },
  archived:        { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' },
}

const INV_STEPS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'sent',      label: 'Enviada',   statuses: ['sent', 'pending'] },
  { key: 'viewed',    label: 'Vista',     statuses: ['viewed'] },
  { key: 'submitted', label: 'Oferta',    statuses: ['bid_submitted'] },
]

// ── SVG Circular Gauge ────────────────────────────────────────────────────────

function CircleGauge({
  value, max = 100, size = 80, stroke = 7, color,
  label, sublabel,
}: {
  value: number; max?: number; size?: number; stroke?: number; color: string
  label: string; sublabel: string
}) {
  const r     = (size - stroke * 2) / 2
  const circ  = 2 * Math.PI * r
  const pct   = Math.min(value / max, 1)
  const dash  = pct * circ
  const cx    = size / 2
  const cy    = size / 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0EEE8" strokeWidth={stroke} />
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
            {value}
          </span>
          {max !== 100 && (
            <span style={{ fontSize: 9, color: '#AAA', marginTop: 1 }}>/{max}</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#333' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#AAA', marginTop: 1 }}>{sublabel}</div>
      </div>
    </div>
  )
}

// ── Hero Gallery ──────────────────────────────────────────────────────────────

function HeroGallery({
  renderUrls, project,
}: {
  renderUrls: string[]
  project: DashboardProject
}) {
  const [active, setActive] = useState(0)
  const statusC  = STATUS_COLORS[project.status] ?? STATUS_COLORS.borrador
  const statusL  = STATUS_LABELS[project.status] ?? project.status
  const hasImage = renderUrls.length > 0

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
      {/* Main image / gradient background */}
      <div style={{ height: 380, position: 'relative', background: '#1A1A1A' }}>
        {hasImage ? (
          <img
            src={renderUrls[active]}
            alt="Render del proyecto"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 50%, #1A1A1A 100%)',
          }} />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
        }} />

        {/* Project info overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '28px 32px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px',
              borderRadius: 4, background: statusC.bg, color: statusC.color,
              display: 'inline-block', marginBottom: 10, backdropFilter: 'blur(4px)',
            }}>
              {statusL}
            </span>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {project.nombre}
            </h1>
            {(project.direccion || project.ciudad) && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>📍</span>
                {[project.direccion, project.ciudad].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Thumbnail dots / nav */}
          {renderUrls.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              {renderUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  style={{
                    width: i === active ? 24 : 8, height: 8,
                    borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0,
                    background: i === active ? '#fff' : 'rgba(255,255,255,0.35)',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail strip (if >1 image) */}
      {renderUrls.length > 1 && (
        <div style={{
          display: 'flex', gap: 4, padding: '4px',
          background: '#0D0D0D',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {renderUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                flexShrink: 0, width: 72, height: 48,
                padding: 0, border: 'none', cursor: 'pointer',
                borderRadius: 4, overflow: 'hidden',
                outline: i === active ? '2px solid #D85A30' : '2px solid transparent',
                transition: 'outline 0.15s',
              }}
            >
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Info + Map row ────────────────────────────────────────────────────────────

function InfoAndMap({
  project, linkedProyectoNombre, totalDocs,
}: {
  project: DashboardProject
  linkedProyectoNombre: string | null
  totalDocs: number
}) {
  const mapQuery = [project.direccion, project.ciudad, 'España'].filter(Boolean).join(', ')
  const hasLocation = !!(project.direccion || project.ciudad)

  const created = new Date(project.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      {/* Project details card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
          Información del proyecto
        </div>

        {project.descripcion && (
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6 }}>{project.descripcion}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {project.direccion && (
            <Row icon="📍" label="Dirección" value={project.direccion} />
          )}
          {project.ciudad && (
            <Row icon="🏙" label="Ciudad" value={project.ciudad} />
          )}
          {linkedProyectoNombre && (
            <Row icon="🔗" label="Proyecto FP" value={linkedProyectoNombre} />
          )}
          <Row icon="📅" label="Creado" value={created} />
          <Row icon="📄" label="Documentos" value={`${totalDocs} archivo${totalDocs !== 1 ? 's' : ''}`} />
        </div>
      </div>

      {/* Map card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', overflow: 'hidden', minHeight: 280 }}>
        {hasLocation ? (
          <iframe
            title="Localización"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&hl=es&z=16`}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block', minHeight: 280 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 280, gap: 8 }}>
            <span style={{ fontSize: 32 }}>🗺</span>
            <p style={{ margin: 0, fontSize: 12, color: '#BBB' }}>Sin dirección asignada</p>
            <p style={{ margin: 0, fontSize: 11, color: '#CCC' }}>Edita el proyecto para añadir una ubicación</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#333' }}>{value}</div>
      </div>
    </div>
  )
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({
  project, checks, scopedChapters, initialDocs, initialTender,
}: {
  project: DashboardProject
  checks: ReadinessCheck[]
  scopedChapters: ScopedChapter[]
  initialDocs: FpeDoc[]
  initialTender: FpeTender | null
}) {
  const totalUnitsInScope = scopedChapters.reduce((s, c) => s + c.units.length, 0)
  const unitsWithQty = scopedChapters.reduce((s, c) =>
    s + c.units.filter(u => u.line_items.every(li => li.cantidad > 0) && u.line_items.length > 0).length, 0
  )
  const docCount   = initialDocs.length
  const imgCount   = initialDocs.filter(d => d.mime_type?.startsWith('image/') || ['jpg','jpeg','png','webp'].some(e => d.nombre.toLowerCase().endsWith(`.${e}`))).length
  const vidCount   = initialDocs.filter(d => d.mime_type?.startsWith('video/') || ['mp4','webm','mov'].some(e => d.nombre.toLowerCase().endsWith(`.${e}`))).length
  const pdfCount   = initialDocs.filter(d => d.mime_type === 'application/pdf' || d.nombre.toLowerCase().endsWith('.pdf')).length
  const cadCount   = initialDocs.filter(d => ['dwg','dxf','rvt','ifc'].some(e => d.nombre.toLowerCase().endsWith(`.${e}`))).length

  const invCount   = initialTender?.invitations?.length ?? 0
  const submitted  = initialTender?.invitations?.filter(i => i.status === 'bid_submitted').length ?? 0

  const gaugeColor = (score: number) =>
    score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626'

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '28px 32px', marginBottom: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 24 }}>
        KPIs del proyecto
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 32, justifyItems: 'center' }}>

        <CircleGauge
          value={project.readiness_score}
          color={gaugeColor(project.readiness_score)}
          label="Readiness"
          sublabel="Preparación general"
        />

        <CircleGauge
          value={totalUnitsInScope}
          max={Math.max(totalUnitsInScope, 1)}
          color="#378ADD"
          label="Scope"
          sublabel={`${unitsWithQty} con cantidades`}
        />

        <CircleGauge
          value={docCount}
          max={Math.max(docCount, 1)}
          color="#6D28D9"
          label="Documentos"
          sublabel={[imgCount && `${imgCount} img`, pdfCount && `${pdfCount} pdf`, vidCount && `${vidCount} vid`, cadCount && `${cadCount} cad`].filter(Boolean).join(' · ') || 'Sin archivos'}
        />

        {initialTender ? (
          <CircleGauge
            value={submitted}
            max={Math.max(invCount, 1)}
            color={submitted === invCount && invCount > 0 ? '#059669' : '#D85A30'}
            label="Ofertas"
            sublabel={`de ${invCount} invitado${invCount !== 1 ? 's' : ''}`}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              border: '7px solid #F0EEE8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 24 }}>🏷</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#333' }}>Licitación</div>
              <div style={{ fontSize: 10, color: '#AAA', marginTop: 1 }}>Sin lanzar</div>
            </div>
          </div>
        )}
      </div>

      {/* Readiness check bars */}
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checks.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: c.passed ? '#ECFDF5' : '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10,
            }}>
              {c.passed ? '✓' : '○'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: c.passed ? '#059669' : '#D97706' }}>{c.pts} pts</span>
              </div>
              <div style={{ height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: c.passed ? '#059669' : '#F0EEE8',
                  width: c.passed ? '100%' : '0%',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Licitación Panel ──────────────────────────────────────────────────────────

function LicitacionPanel({ tender }: { tender: FpeTender }) {
  const invitations = tender.invitations ?? []
  const sent        = invitations.filter(i => ['sent','viewed','bid_submitted'].includes(i.status)).length
  const viewed      = invitations.filter(i => ['viewed','bid_submitted'].includes(i.status)).length
  const submitted   = invitations.filter(i => i.status === 'bid_submitted').length

  const deadline    = new Date(tender.fecha_limite)
  const isExpired   = deadline < new Date()
  const daysLeft    = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const deadlineFmt = deadline.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  const TENDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
    draft:     { label: 'Borrador',  bg: '#F3F4F6', color: '#6B7280' },
    launched:  { label: 'Activa',    bg: '#FEF3C7', color: '#D97706' },
    closed:    { label: 'Cerrada',   bg: '#ECFDF5', color: '#059669' },
    cancelled: { label: 'Cancelada', bg: '#FEF2F2', color: '#DC2626' },
  }
  const ts = TENDER_STATUS[tender.status] ?? TENDER_STATUS.draft

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '28px 32px', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6 }}>
            Licitación
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: ts.bg, color: ts.color }}>
              {ts.label}
            </span>
            <span style={{ fontSize: 12, color: '#555' }}>
              Límite: <strong>{deadlineFmt}</strong>
              {!isExpired && daysLeft >= 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, color: daysLeft <= 3 ? '#DC2626' : '#888' }}>
                  ({daysLeft}d restantes)
                </span>
              )}
              {isExpired && <span style={{ marginLeft: 6, fontSize: 11, color: '#DC2626' }}>(Plazo vencido)</span>}
            </span>
          </div>
        </div>

        {/* Funnel summary */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[
            { n: invitations.length, label: 'Invitadas', color: '#6B7280' },
            { n: sent,     label: 'Enviadas',  color: '#378ADD' },
            { n: viewed,   label: 'Vistas',    color: '#D97706' },
            { n: submitted,label: 'Ofertas',   color: '#059669' },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div style={{ textAlign: 'center', minWidth: 52 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: step.color, lineHeight: 1 }}>{step.n}</div>
                <div style={{ fontSize: 9, color: '#AAA', marginTop: 2, fontWeight: 600 }}>{step.label}</div>
              </div>
              {i < arr.length - 1 && (
                <span style={{ fontSize: 14, color: '#DDD', margin: '0 2px', marginBottom: 12 }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Partner cards */}
      {invitations.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#AAA', textAlign: 'center', padding: '20px 0' }}>
          No hay invitaciones en esta licitación.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invitations.map(inv => (
            <InvitationCard key={inv.id} invitation={inv} />
          ))}
        </div>
      )}
    </div>
  )
}

function InvitationCard({ invitation: inv }: { invitation: FpeInvitation }) {
  const steps = [
    { label: 'Enviada',   done: ['sent','viewed','bid_submitted'].includes(inv.status), date: inv.sent_at },
    { label: 'Vista',     done: ['viewed','bid_submitted'].includes(inv.status),        date: inv.viewed_at },
    { label: 'Oferta',    done: inv.status === 'bid_submitted',                         date: inv.bid_submitted_at },
  ]

  const isRevoked  = inv.status === 'revoked'
  const isExpired  = inv.status === 'expired'
  const isPending  = inv.status === 'pending'

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
      borderRadius: 8, border: '1px solid #E8E6E0',
      background: isRevoked || isExpired ? '#FAFAFA' : '#fff',
      opacity: isRevoked || isExpired ? 0.55 : 1,
    }}>
      {/* Partner info */}
      <div style={{ minWidth: 160, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{inv.partner.nombre}</div>
        {inv.partner.email_contacto && (
          <div style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>{inv.partner.email_contacto}</div>
        )}
      </div>

      {/* Progress steps */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {isRevoked ? (
          <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>Revocada</span>
        ) : isExpired ? (
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Expirada</span>
        ) : isPending ? (
          <span style={{ fontSize: 11, color: '#6B7280' }}>Enviando…</span>
        ) : (
          steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: step.done ? '#059669' : '#F0EEE8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: step.done ? '#fff' : '#CCC', fontWeight: 700,
                  transition: 'background 0.2s',
                }}>
                  {step.done ? '✓' : (i + 1)}
                </div>
                <div style={{ fontSize: 9, color: step.done ? '#059669' : '#CCC', fontWeight: 600, textAlign: 'center' }}>
                  {step.label}
                </div>
                {fmtDate(step.date) && (
                  <div style={{ fontSize: 9, color: '#AAA', textAlign: 'center' }}>{fmtDate(step.date)}</div>
                )}
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: steps[i + 1].done ? '#059669' : '#E8E6E0', maxWidth: 32, borderRadius: 1, marginBottom: 16 }} />
              )}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Status pill */}
      <div style={{ flexShrink: 0 }}>
        {inv.status === 'bid_submitted' && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 10, background: '#ECFDF5', color: '#059669' }}>
            Oferta recibida
          </span>
        )}
        {inv.status === 'viewed' && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 10, background: '#FEF3C7', color: '#D97706' }}>
            Revisando…
          </span>
        )}
        {inv.status === 'sent' && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 10, background: '#EBF5FF', color: '#378ADD' }}>
            Enviada
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ProjectDashboard({
  project,
  renderUrls,
  initialChecks,
  initialTender,
  initialDocs,
  scopedChapters,
  linkedProyectoNombre,
}: ProjectDashboardProps) {
  return (
    <div>
      <HeroGallery renderUrls={renderUrls} project={project} />

      <InfoAndMap
        project={project}
        linkedProyectoNombre={linkedProyectoNombre}
        totalDocs={initialDocs.length}
      />

      <KpiStrip
        project={project}
        checks={initialChecks}
        scopedChapters={scopedChapters}
        initialDocs={initialDocs}
        initialTender={initialTender}
      />

      {initialTender && initialTender.status !== 'draft' && (
        <LicitacionPanel tender={initialTender} />
      )}
    </div>
  )
}

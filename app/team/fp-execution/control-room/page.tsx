import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Inv  = { id: string; status: string }
type Q    = { id: string; respuesta: string | null }
type Proj = { id: string; nombre: string; ciudad: string | null; status: string }
type TRow = {
  id: string; status: string; fecha_limite: string; created_at: string
  project: Proj; invitations: Inv[]; questions: Q[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deadlineDisplay(isoDate: string, tenderStatus: string): { label: string; color: string; bg: string } {
  if (tenderStatus === 'closed')    return { label: 'Cerrada',   color: '#059669', bg: '#ECFDF5' }
  if (tenderStatus === 'cancelled') return { label: 'Cancelada', color: '#DC2626', bg: '#FEF2F2' }
  if (tenderStatus === 'draft')     return { label: 'Borrador',  color: '#6B7280', bg: '#F3F4F6' }

  const days = Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const date = new Date(isoDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  if (days < 0)  return { label: `${date} — vencido`,  color: '#DC2626', bg: '#FEF2F2' }
  if (days === 0) return { label: `${date} — hoy`,     color: '#DC2626', bg: '#FEF2F2' }
  if (days === 1) return { label: `${date} — mañana`,  color: '#D97706', bg: '#FEF3C7' }
  if (days <= 3)  return { label: `${date} — ${days}d`, color: '#D97706', bg: '#FEF3C7' }
  return              { label: `${date} — ${days}d`,  color: '#555',    bg: '#F3F4F6' }
}

const PROJ_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  borrador:        { label: 'Borrador',      bg: '#F3F4F6', color: '#6B7280' },
  scope_ready:     { label: 'Scope listo',   bg: '#EBF5FF', color: '#378ADD' },
  tender_launched: { label: 'En licitación', bg: '#FEF3C7', color: '#D97706' },
  awarded:         { label: 'Adjudicado',    bg: '#ECFDF5', color: '#059669' },
  contracted:      { label: 'Contratado',    bg: '#D1FAE5', color: '#065F46' },
  archived:        { label: 'Archivado',     bg: '#F9FAFB', color: '#9CA3AF' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ControlRoomPage() {
  const admin = createAdminClient()

  const { data: rawTenders } = await admin
    .from('fpe_tenders')
    .select(`
      id, status, fecha_limite, created_at,
      project:fpe_projects ( id, nombre, ciudad, status ),
      invitations:fpe_tender_invitations ( id, status ),
      questions:fpe_tender_questions ( id, respuesta )
    `)
    .order('created_at', { ascending: false })

  const tenders = ((rawTenders ?? []) as unknown as TRow[]).filter(t => t.project.status !== 'archived').sort((a, b) => {
    const ord = (s: string) => s === 'launched' ? 0 : s === 'draft' ? 1 : 2
    const d = ord(a.status) - ord(b.status)
    if (d !== 0) return d
    if (a.status === 'launched')
      return new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime()
    return 0
  })

  // ── Global stats ───────────────────────────────────────────────────────────
  const allTenders     = (rawTenders ?? []) as unknown as TRow[]
  const archivedCount  = allTenders.filter(t => t.project.status === 'archived').length
  const activeLaunched = tenders.filter(t => t.status === 'launched').length
  const totalBids      = tenders.reduce((s, t) =>
    s + t.invitations.filter(i => ['bid_submitted', 'awarded'].includes(i.status)).length, 0)
  const pendingQA      = tenders.reduce((s, t) =>
    s + t.questions.filter(q => !q.respuesta).length, 0)
  const awardedCount   = tenders.filter(t =>
    ['awarded', 'contracted'].includes(t.project.status)).length

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* ── Header ── */}
      <div style={{ background: '#1A1A1A', padding: '0' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px 0' }}>
          <div style={{ marginBottom: 10 }}>
            <Link href="/team/fp-execution/projects" style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
              ← Proyectos
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                FP Execution
              </p>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                Control Room
              </h1>
            </div>
            <Link
              href="/team/fp-execution/projects"
              style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', padding: '7px 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}
            >
              + Nuevo proyecto
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 32px' }}>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'En licitación',    value: activeLaunched, accent: '#D97706' },
            { label: 'Ofertas recibidas', value: totalBids,      accent: '#059669' },
            { label: 'Q&A sin responder', value: pendingQA,      accent: pendingQA > 0 ? '#DC2626' : '#059669' },
            { label: 'Adjudicados',       value: awardedCount,   accent: '#378ADD' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '16px 20px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
                {stat.label}
              </p>
              <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: stat.accent, lineHeight: 1, fontFamily: 'monospace' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Tenders table ── */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1A1A1A' }}>
                {['Proyecto', 'Estado', 'Plazo / Licitación', 'Invitaciones · Bids', 'Q&A', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '52px 16px', textAlign: 'center', color: '#BBB', fontSize: 13 }}>
                    No hay licitaciones todavía.{' '}
                    <Link href="/team/fp-execution/projects" style={{ color: '#1A1A1A', fontWeight: 600 }}>
                      Crea un proyecto →
                    </Link>
                  </td>
                </tr>
              )}
              {tenders.map((t, idx) => {
                const ps       = PROJ_STATUS[t.project.status] ?? PROJ_STATUS['borrador']
                const dl       = deadlineDisplay(t.fecha_limite, t.status)
                const activeInv = t.invitations.filter(i => !['revoked', 'expired'].includes(i.status)).length
                const bidCount  = t.invitations.filter(i => ['bid_submitted', 'awarded'].includes(i.status)).length
                const qaPending = t.questions.filter(q => !q.respuesta).length

                return (
                  <tr key={t.id} style={{ borderBottom: idx < tenders.length - 1 ? '1px solid #F0EEE8' : 'none', background: idx % 2 === 0 ? '#fff' : '#FAFAF8' }}>

                    {/* Project */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{t.project.nombre}</div>
                      {t.project.ciudad && (
                        <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{t.project.ciudad}</div>
                      )}
                    </td>

                    {/* Project status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: ps.bg, color: ps.color }}>
                        {ps.label}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4, background: dl.bg, color: dl.color }}>
                        {dl.label}
                      </span>
                    </td>

                    {/* Invitations + bids */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, color: '#555' }}>{activeInv} inv.</span>
                      {bidCount > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginLeft: 8 }}>
                          · {bidCount} {bidCount === 1 ? 'oferta' : 'ofertas'}
                        </span>
                      )}
                    </td>

                    {/* Q&A */}
                    <td style={{ padding: '14px 16px' }}>
                      {qaPending > 0 ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#FEF3C7', color: '#D97706' }}>
                          {qaPending} pendiente{qaPending !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#DDD' }}>—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Link
                        href={`/team/fp-execution/projects/${t.project.id}`}
                        style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', textDecoration: 'none', padding: '6px 12px', borderRadius: 5, border: '1px solid #E8E6E0', background: '#fff', whiteSpace: 'nowrap' }}
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Archived note */}
        {archivedCount > 0 && (
          <p style={{ margin: '16px 0 0', fontSize: 11, color: '#BBB', textAlign: 'right' }}>
            {archivedCount} proyecto{archivedCount !== 1 ? 's' : ''} archivado{archivedCount !== 1 ? 's' : ''} oculto{archivedCount !== 1 ? 's' : ''} · ver en{' '}
            <a href="/team/fp-execution/projects" style={{ color: '#AAA', textDecoration: 'underline' }}>Proyectos</a>
          </p>
        )}
      </div>
    </div>
  )
}

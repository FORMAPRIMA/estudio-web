'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { updateDdVisit, addDdVisitTeamMember, removeDdVisitTeamMember } from '@/app/actions/dd-visits'
import type { DdAsset, DdVisit, DdCard, DdRole, DdVisitTeam } from '@/lib/dd-visits/domain'
import {
  DD_VISIT_STATUS_LABELS, DD_VISIT_STATUS_COLORS,
  DD_CARD_ESTADO_LABELS, DD_CARD_ESTADO_COLORS,
  DD_CARD_RIESGO_COLORS, DD_CARD_RIESGO_LABELS,
} from '@/lib/dd-visits/domain'

interface Props {
  asset: DdAsset
  visit: DdVisit
  cards: DdCard[]
  roles: DdRole[]
  team: DdVisitTeam[]
  isAdmin: boolean
}

export default function DdVisitPage({ asset, visit: initialVisit, cards, roles, team: initialTeam, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [visit, setVisit] = useState(initialVisit)
  const [team, setTeam] = useState(initialTeam)
  const [error, setError] = useState<string | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamForm, setTeamForm] = useState({ nombre: '', rolId: roles[0]?.id ?? '' })
  const [expandedRol, setExpandedRol] = useState<string | null>(null)

  const statusColor = DD_VISIT_STATUS_COLORS[visit.status]

  const cardsByRol = useMemo(() => {
    return roles.map(rol => {
      const rolCards = cards.filter(c => c.rol_id === rol.id)
      const total = rolCards.length
      const done = rolCards.filter(c => c.estado !== 'pendiente').length
      const incidencias = rolCards.filter(c => c.estado === 'incidencia').length
      const noAccesibles = rolCards.filter(c => c.estado === 'no_accesible').length
      return { rol, cards: rolCards, total, done, incidencias, noAccesibles, progress: total > 0 ? Math.round((done / total) * 100) : 0 }
    }).filter(g => g.total > 0)
  }, [roles, cards])

  const totalCards = cards.length
  const doneCards = cards.filter(c => c.estado !== 'pendiente').length
  const overallProgress = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0

  function handleStatusChange(status: DdVisit['status']) {
    startTransition(async () => {
      const result = await updateDdVisit(visit.id, asset.id, { status })
      if ('error' in result) { setError(result.error); return }
      setVisit(prev => ({ ...prev, status }))
    })
  }

  function handleAddTeamMember() {
    if (!teamForm.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const result = await addDdVisitTeamMember(visit.id, asset.id, teamForm.rolId, teamForm.nombre.trim())
      if ('error' in result) { setError(result.error); return }
      const rol = roles.find(r => r.id === teamForm.rolId)
      setTeam(prev => [...prev, {
        id: result.id, visit_id: visit.id, rol_id: teamForm.rolId,
        user_id: null, nombre_display: teamForm.nombre.trim(),
        created_at: new Date().toISOString(), rol,
      }])
      setShowTeamModal(false)
      setTeamForm({ nombre: '', rolId: roles[0]?.id ?? '' })
    })
  }

  function handleRemoveTeamMember(memberId: string) {
    startTransition(async () => {
      const result = await removeDdVisitTeamMember(memberId, visit.id, asset.id)
      if ('error' in result) { setError(result.error); return }
      setTeam(prev => prev.filter(m => m.id !== memberId))
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0DDD8', borderRadius: 3,
    padding: '8px 10px', fontSize: 13, color: '#1A1A1A',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#1A1A1A60', marginBottom: 5, display: 'block',
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 960 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => router.push('/team/apps/dd-visits')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A40', padding: 0 }}>
          DD Técnica
        </button>
        <span style={{ color: '#1A1A1A30', fontSize: 11 }}>/</span>
        <button onClick={() => router.push(`/team/apps/dd-visits/${asset.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A40', padding: 0 }}>
          {asset.nombre}
        </button>
        <span style={{ color: '#1A1A1A30', fontSize: 11 }}>/</span>
        <span style={{ fontSize: 11, color: '#1A1A1A70' }}>Visita</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 4 }}>
            {visit.fecha
              ? new Date(visit.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : 'Fecha pendiente'}
          </h1>
          <p style={{ fontSize: 12, color: '#1A1A1A50' }}>{asset.nombre} · {asset.direccion}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && (
            <select
              value={visit.status}
              onChange={e => handleStatusChange(e.target.value as DdVisit['status'])}
              style={{ ...inputStyle, width: 'auto', fontSize: 11, padding: '6px 10px' }}
            >
              {Object.entries(DD_VISIT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/visita/${visit.id}/mi-revision`)}
            style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            Entrar a revisión →
          </button>
        </div>
      </div>

      {/* Progress global */}
      <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#1A1A1A60', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Progreso general</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{doneCards}/{totalCards} cards · {overallProgress}%</span>
        </div>
        <div style={{ background: '#F0EEE8', borderRadius: 20, height: 6, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#1A1A1A', height: '100%', width: `${overallProgress}%`, borderRadius: 20, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {['revisado_ok', 'incidencia', 'no_accesible', 'requiere_aclaracion'].map(estado => {
            const count = cards.filter(c => c.estado === estado).length
            if (!count) return null
            const color = DD_CARD_ESTADO_COLORS[estado as keyof typeof DD_CARD_ESTADO_COLORS]
            return (
              <div key={estado} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color }}>{count} {DD_CARD_ESTADO_LABELS[estado as keyof typeof DD_CARD_ESTADO_LABELS]}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Cards por rol */}
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A50', marginBottom: 14 }}>
            Progreso por especialidad
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cardsByRol.map(({ rol, cards: rolCards, total, done, incidencias, noAccesibles, progress }) => (
              <div key={rol.id} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedRol(expandedRol === rol.id ? null : rol.id)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '14px 16px', textAlign: 'left', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: rol.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{rol.nombre}</span>
                    {incidencias > 0 && (
                      <span style={{ fontSize: 10, color: '#C0392B', background: '#FDF2F2', padding: '1px 6px', borderRadius: 10 }}>
                        {incidencias} incidencia{incidencias !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#1A1A1A60' }}>{done}/{total} · {progress}%</span>
                    <span style={{ fontSize: 12, color: '#1A1A1A40', transform: expandedRol === rol.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                  </div>
                </button>
                <div style={{ padding: '0 16px 2px', marginTop: -6, paddingBottom: 12 }}>
                  <div style={{ background: '#F0EEE8', borderRadius: 20, height: 3, overflow: 'hidden' }}>
                    <div style={{ background: rol.color, height: '100%', width: `${progress}%`, borderRadius: 20, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {expandedRol === rol.id && (
                  <div style={{ borderTop: '1px solid #F0EEE8', padding: '10px 16px 14px' }}>
                    {rolCards.map(card => {
                      const estadoColor = DD_CARD_ESTADO_COLORS[card.estado]
                      return (
                        <button
                          key={card.id}
                          onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/visita/${visit.id}/mi-revision/${card.id}`)}
                          style={{
                            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 0', borderBottom: '1px solid #F8F7F4',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 12, color: '#1A1A1A' }}>{card.titulo}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {card.riesgo && (
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: DD_CARD_RIESGO_COLORS[card.riesgo], display: 'inline-block' }} />
                            )}
                            <span style={{ fontSize: 9, color: estadoColor, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                              {DD_CARD_ESTADO_LABELS[card.estado]}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Equipo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A50' }}>
              Equipo
            </p>
            {isAdmin && (
              <button onClick={() => setShowTeamModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A50' }}>
                + Añadir
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {team.length === 0 ? (
              <p style={{ fontSize: 12, color: '#1A1A1A30' }}>Sin equipo asignado</p>
            ) : (
              team.map(member => {
                const rol = roles.find(r => r.id === member.rol_id)
                return (
                  <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: 4, border: '1px solid #E8E6E0' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 2 }}>{member.nombre_display}</p>
                      {rol && <p style={{ fontSize: 10, color: rol.color }}>{rol.nombre}</p>}
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleRemoveTeamMember(member.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#1A1A1A30', padding: '0 4px' }}>×</button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Zonas */}
          {(visit.zonas_previstas?.length ?? 0) > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A50', marginBottom: 10 }}>Zonas previstas</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {visit.zonas_previstas!.map(zona => (
                  <span key={zona} style={{ fontSize: 10, color: '#1A1A1A60', background: '#F0EEE8', padding: '3px 8px', borderRadius: 20 }}>
                    {zona}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal equipo */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowTeamModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 4, width: '100%', maxWidth: 400, padding: '24px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Añadir miembro al equipo</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nombre</label>
              <input value={teamForm.nombre} onChange={e => setTeamForm(prev => ({ ...prev, nombre: e.target.value }))} style={inputStyle} placeholder="Nombre del técnico" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Especialidad</label>
              <select value={teamForm.rolId} onChange={e => setTeamForm(prev => ({ ...prev, rolId: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            {error && <p style={{ fontSize: 11, color: '#C0392B', marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTeamModal(false)} style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleAddTeamMember} disabled={isPending} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

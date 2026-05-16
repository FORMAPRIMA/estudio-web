'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { getTenderQuestions, answerQuestion, type TenderQuestion } from '@/app/actions/fpe-qa'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

type FilterTab = 'pending' | 'all' | 'answered'

export default function QAPanel({
  tenderId,
  projectId,
}: {
  tenderId:  string
  projectId: string
}) {
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [questions, setQuestions] = useState<TenderQuestion[]>([])
  const [drafts, setDrafts]       = useState<Record<string, string>>({})
  const [saving, setSaving]       = useState<string | null>(null)
  const [saveErr, setSaveErr]     = useState<Record<string, string>>({})
  const [filter, setFilter]       = useState<FilterTab>('pending')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getTenderQuestions(tenderId).then(res => {
      setLoading(false)
      if ('error' in res) { setError(res.error); return }
      setQuestions(res)
    })
  }, [tenderId])

  const handleAnswer = async (q: TenderQuestion) => {
    const respuesta = drafts[q.id]?.trim()
    if (!respuesta) return
    setSaving(q.id)
    const res = await answerQuestion({
      question_id:  q.id,
      tender_id:    tenderId,
      project_id:   projectId,
      respuesta,
    })
    setSaving(null)
    if ('error' in res) {
      setSaveErr(prev => ({ ...prev, [q.id]: res.error }))
      return
    }
    setQuestions(prev => prev.map(item =>
      item.id === q.id
        ? { ...item, respuesta, answered_at: new Date().toISOString() }
        : item
    ))
    setDrafts(prev => { const n = { ...prev }; delete n[q.id]; return n })
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const totalCount    = questions.length
  const pendingCount  = questions.filter(q => !q.respuesta).length
  const answeredCount = totalCount - pendingCount
  const responseRate  = totalCount === 0 ? 0 : Math.round((answeredCount / totalCount) * 100)

  // Group by partner — pending first inside group, then by oldest
  const groupedByPartner = useMemo(() => {
    type Group = { partnerName: string; questions: TenderQuestion[]; pending: number }
    const groupsMap: Record<string, Group> = {}
    for (const q of questions) {
      const g = groupsMap[q.partner_nombre] ?? { partnerName: q.partner_nombre, questions: [], pending: 0 }
      g.questions.push(q)
      if (!q.respuesta) g.pending += 1
      groupsMap[q.partner_nombre] = g
    }
    const list = Object.values(groupsMap)
    for (const g of list) {
      g.questions.sort((a: TenderQuestion, b: TenderQuestion) => {
        if (!a.respuesta && b.respuesta) return -1
        if (a.respuesta && !b.respuesta) return 1
        return new Date(a.asked_at).getTime() - new Date(b.asked_at).getTime()
      })
    }
    return list.sort((a, b) => {
      if (a.pending !== b.pending) return b.pending - a.pending
      return a.partnerName.localeCompare(b.partnerName)
    })
  }, [questions])

  const isCollapsed = (partner: string, pending: number) => {
    if (partner in collapsed) return collapsed[partner]
    return pending === 0 && filter !== 'all'
  }

  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groupedByPartner
    return groupedByPartner
      .map(g => ({
        ...g,
        questions: g.questions.filter(q => filter === 'pending' ? !q.respuesta : !!q.respuesta),
      }))
      .filter(g => g.questions.length > 0)
  }, [groupedByPartner, filter])

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#AAA', fontSize: 13 }}>
      Cargando preguntas…
    </div>
  )
  if (error) return (
    <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
      {error}
    </div>
  )

  if (totalCount === 0) {
    return (
      <div style={{
        padding: '60px 20px', textAlign: 'center', color: '#888', fontSize: 13,
        background: '#fff', border: '1px dashed #E8E6E0', borderRadius: 10,
      }}>
        Aún no hay consultas. Los partners pueden enviar preguntas desde su portal de ejecución.
      </div>
    )
  }

  return (
    <div>
      {/* Stats banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        padding: '14px 18px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10,
        marginBottom: 14,
      }}>
        <StatChip label="Pendientes"  value={pendingCount}  color={pendingCount > 0 ? '#D97706' : '#1A1A1A'} />
        <Sep />
        <StatChip label="Respondidas" value={answeredCount} color="#1A1A1A" />
        <Sep />
        <StatChip label="Total"       value={totalCount}    color="#1A1A1A" />
        <div style={{ marginLeft: 'auto', minWidth: 180 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 5 }}>
            Tasa de respuesta · {responseRate}%
          </div>
          <div style={{ width: '100%', height: 6, background: '#F0EEE8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${responseRate}%`, height: '100%', background: responseRate === 100 ? '#059669' : '#D85A30', borderRadius: 3, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#F0EEE8', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        <FilterPill label={`Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}`} active={filter === 'pending'}  onClick={() => setFilter('pending')} dot={pendingCount > 0} />
        <FilterPill label="Todas"        active={filter === 'all'}      onClick={() => setFilter('all')} />
        <FilterPill label="Respondidas" active={filter === 'answered'} onClick={() => setFilter('answered')} />
      </div>

      {/* Visible groups */}
      {visibleGroups.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
          {filter === 'pending'
            ? '✓ No hay consultas pendientes de respuesta.'
            : 'No hay consultas en esta vista.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleGroups.map(group => {
            const collapsedNow = isCollapsed(group.partnerName, group.pending)
            return (
              <div key={group.partnerName} style={{
                background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden',
              }}>
                {/* Partner header */}
                <button
                  onClick={() => setCollapsed(prev => ({ ...prev, [group.partnerName]: !collapsedNow }))}
                  style={{
                    width: '100%', padding: '12px 16px', display: 'flex',
                    alignItems: 'center', gap: 10, background: '#F8F7F4',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    borderBottom: collapsedNow ? 'none' : '1px solid #E8E6E0',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#AAA' }}>{collapsedNow ? '▶' : '▼'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', flex: 1, textAlign: 'left' }}>
                    {group.partnerName}
                  </span>
                  <span style={{ fontSize: 11, color: '#888' }}>
                    {group.questions.length} consulta{group.questions.length !== 1 ? 's' : ''}
                  </span>
                  {group.pending > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                      padding: '3px 8px', borderRadius: 10, background: '#D97706', color: '#fff',
                    }}>
                      {group.pending} PENDIENTE{group.pending !== 1 ? 'S' : ''}
                    </span>
                  )}
                </button>

                {/* Questions */}
                {!collapsedNow && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.questions.map((q, idx) => (
                      <div key={q.id} style={{
                        padding: '14px 16px',
                        borderTop: idx === 0 ? 'none' : '1px solid #F0EEE8',
                        background: !q.respuesta ? '#FFFBEB' : '#fff',
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: '#BBB' }}>{fmtDateTime(q.asked_at)}</span>
                          {!q.respuesta && (
                            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4, background: '#FEF3C7', color: '#D97706' }}>
                              SIN RESPONDER
                            </span>
                          )}
                          {q.respuesta && (
                            <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4, background: '#ECFDF5', color: '#059669' }}>
                              ✓ RESPONDIDA
                            </span>
                          )}
                        </div>

                        {/* Question text */}
                        <p style={{ margin: 0, fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>{q.pregunta}</p>

                        {/* Answer or form */}
                        {q.respuesta ? (
                          <div style={{ marginTop: 10, padding: '10px 12px', background: '#F8F7F4', borderRadius: 6, borderLeft: '3px solid #059669' }}>
                            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA' }}>
                              Respuesta
                              {q.answered_by_name ? ` — ${q.answered_by_name}` : ''}
                              {q.answered_at ? ` · ${fmtDateTime(q.answered_at)}` : ''}
                            </p>
                            <p style={{ margin: 0, fontSize: 13, color: '#333', lineHeight: 1.5 }}>{q.respuesta}</p>
                          </div>
                        ) : (
                          <div style={{ marginTop: 10 }}>
                            <textarea
                              rows={2}
                              value={drafts[q.id] ?? ''}
                              onChange={e => setDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Escribe la respuesta (visible para todos los partners invitados)…"
                              style={{
                                width: '100%', padding: '8px 10px', fontSize: 12,
                                border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit',
                                color: '#1A1A1A', background: '#fff', resize: 'vertical',
                                boxSizing: 'border-box', outline: 'none', marginBottom: 8,
                              }}
                            />
                            {saveErr[q.id] && (
                              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#DC2626' }}>{saveErr[q.id]}</p>
                            )}
                            <button
                              onClick={() => handleAnswer(q)}
                              disabled={!drafts[q.id]?.trim() || saving === q.id}
                              style={{
                                padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none',
                                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                                background: '#1A1A1A', color: '#fff',
                                opacity: !drafts[q.id]?.trim() ? 0.4 : 1,
                              }}
                            >
                              {saving === q.id ? 'Enviando…' : 'Responder'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 32, background: '#E8E6E0' }} />
}

function FilterPill({ label, active, onClick, dot }: { label: string; active: boolean; onClick: () => void; dot?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 600,
        borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? '#fff' : 'transparent',
        color:      active ? '#1A1A1A' : '#888',
        boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {dot && !active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706' }} />}
      {label}
    </button>
  )
}

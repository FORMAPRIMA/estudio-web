'use client'

import React, { useState, useEffect } from 'react'
import { getTenderQuestions, answerQuestion, type TenderQuestion } from '@/app/actions/fpe-qa'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

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

  const unanswered = questions.filter(q => !q.respuesta).length

  return (
    <div>
      {unanswered > 0 && (
        <div style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 16 }}>
          {unanswered} consulta{unanswered !== 1 ? 's' : ''} pendiente{unanswered !== 1 ? 's' : ''} de respuesta.
          Las respuestas son visibles para todos los partners invitados.
        </div>
      )}

      {questions.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
          No hay consultas todavía. Los partners pueden enviar preguntas desde su portal.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.map(q => (
            <div
              key={q.id}
              style={{
                background: '#fff',
                border: `1px solid ${q.respuesta ? '#E8E6E0' : '#FDE68A'}`,
                borderRadius: 10, overflow: 'hidden',
              }}
            >
              {/* Question header */}
              <div style={{ padding: '12px 16px', background: q.respuesta ? '#F8F7F4' : '#FFFBEB', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>{q.partner_nombre}</span>
                    <span style={{ fontSize: 10, color: '#BBB' }}>{fmtDateTime(q.asked_at)}</span>
                    {!q.respuesta && (
                      <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4, background: '#FEF3C7', color: '#D97706' }}>
                        SIN RESPONDER
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>{q.pregunta}</p>
                </div>
              </div>

              {/* Answer or form */}
              {q.respuesta ? (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #E8E6E0' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA' }}>
                    Respuesta
                    {q.answered_by_name ? ` — ${q.answered_by_name}` : ''}
                    {q.answered_at ? ` · ${fmtDateTime(q.answered_at)}` : ''}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: '#333', lineHeight: 1.5 }}>{q.respuesta}</p>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #FDE68A' }}>
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
}

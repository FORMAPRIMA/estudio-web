'use client'

import { useState } from 'react'
import { createComentario, toggleReaccion, deleteComentario } from '@/app/actions/quiniela'
import { CHAT_EMOJIS } from '@/lib/quiniela/config'
import type { QuinielaComentario, QuinielaReaccion } from '@/lib/quiniela/config'

const C = { ink: '#1A1A1A', cream: '#F8F7F4', accent: '#D85A30', border: '#F0EEE8', green: '#3D8B5F' }
const VISIBLES_COLAPSADO = 3

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

export default function QuinielaChat({
  comentarios, reacciones, nombresById, miJugadorId, esPartner, onChanged,
}: {
  comentarios: QuinielaComentario[]
  reacciones: QuinielaReaccion[]
  nombresById: Map<string, string>
  miJugadorId: string | null
  esPartner: boolean
  onChanged: () => void
}) {
  const [texto, setTexto] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [error, setError] = useState('')

  // comentarios llega ordenado desc por created_at
  const principales = comentarios.filter(c => !c.parent_id)
  const visibles = expandido ? principales : principales.slice(0, VISIBLES_COLAPSADO)
  const ocultos = principales.length - VISIBLES_COLAPSADO

  async function handleEnviar() {
    const t = texto.trim()
    if (!t || isSending) return
    setIsSending(true)
    setError('')
    const result = await createComentario({ texto: t })
    setIsSending(false)
    if ('error' in result) setError(result.error)
    else { setTexto(''); onChanged() }
  }

  return (
    <div style={{
      marginTop: 24, background: '#fff', borderRadius: 4,
      border: `1px solid ${C.border}`, padding: '18px 20px',
    }}>
      <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 12 }}>
        💬 El bar de la porra
      </p>

      {/* Composer */}
      {miJugadorId ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: principales.length ? 16 : 0 }}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEnviar() }}
            placeholder="Di algo… (presume, vacila, llora)"
            maxLength={500}
            style={{
              flex: 1, border: '1px solid #E5E2DA', borderRadius: 20, padding: '9px 16px',
              fontSize: 13, outline: 'none', color: C.ink, background: '#FDFDFC',
            }}
          />
          <button
            onClick={handleEnviar}
            disabled={isSending || !texto.trim()}
            style={{
              background: texto.trim() ? C.accent : '#fff',
              color: texto.trim() ? '#fff' : '#1A1A1A40',
              border: texto.trim() ? 'none' : `1px solid ${C.border}`,
              borderRadius: 20, padding: '9px 18px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {isSending ? '…' : 'Enviar'}
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#1A1A1A50', marginBottom: principales.length ? 16 : 0 }}>
          Apúntate a la porra para comentar.
        </p>
      )}
      {error && <p style={{ fontSize: 11, color: C.accent, marginBottom: 10 }}>{error}</p>}

      {/* Comentarios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibles.map(c => (
          <Comentario
            key={c.id}
            comentario={c}
            replies={comentarios.filter(r => r.parent_id === c.id).slice().reverse()}
            reacciones={reacciones}
            nombresById={nombresById}
            miJugadorId={miJugadorId}
            esPartner={esPartner}
            onChanged={onChanged}
          />
        ))}
      </div>

      {ocultos > 0 && (
        <button
          onClick={() => setExpandido(v => !v)}
          style={{
            marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: C.accent, fontWeight: 500, padding: 0,
          }}
        >
          {expandido ? '▴ Ver menos' : `▾ Ver todos los comentarios (${principales.length})`}
        </button>
      )}
    </div>
  )
}

function Comentario({ comentario, replies, reacciones, nombresById, miJugadorId, esPartner, onChanged, esReply = false }: {
  comentario: QuinielaComentario
  replies: QuinielaComentario[]
  reacciones: QuinielaReaccion[]
  nombresById: Map<string, string>
  miJugadorId: string | null
  esPartner: boolean
  onChanged: () => void
  esReply?: boolean
}) {
  const [verEmojis, setVerEmojis] = useState(false)
  const [respondiendo, setRespondiendo] = useState(false)
  const [verReplies, setVerReplies] = useState(false)
  const [replyTexto, setReplyTexto] = useState('')
  const [isSending, setIsSending] = useState(false)

  const esMio = comentario.jugador_id === miJugadorId
  const misReacciones = reacciones.filter(r => r.comentario_id === comentario.id)
  // Agrupar reacciones por emoji
  const grupos = new Map<string, { count: number; mia: boolean }>()
  for (const r of misReacciones) {
    const g = grupos.get(r.emoji) || { count: 0, mia: false }
    g.count++
    if (r.jugador_id === miJugadorId) g.mia = true
    grupos.set(r.emoji, g)
  }

  async function handleReaccion(emoji: string) {
    setVerEmojis(false)
    if (!miJugadorId) return
    await toggleReaccion({ comentarioId: comentario.id, emoji })
    onChanged()
  }

  async function handleReply() {
    const t = replyTexto.trim()
    if (!t || isSending) return
    setIsSending(true)
    const result = await createComentario({ texto: t, parentId: comentario.id })
    setIsSending(false)
    if ('success' in result) {
      setReplyTexto('')
      setRespondiendo(false)
      setVerReplies(true)
      onChanged()
    }
  }

  async function handleDelete() {
    await deleteComentario(comentario.id)
    onChanged()
  }

  return (
    <div style={{
      background: esReply ? 'transparent' : C.cream,
      borderRadius: 4, padding: esReply ? '8px 0 0 0' : '10px 14px',
    }}>
      <p style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600 }}>{nombresById.get(comentario.jugador_id) || '—'}</strong>
        <span style={{ fontSize: 10, color: '#1A1A1A40', marginLeft: 8 }}>{timeAgo(comentario.created_at)}</span>
        {(esMio || esPartner) && (
          <button
            onClick={handleDelete}
            title="Borrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A1A1A30', fontSize: 10, marginLeft: 8, padding: 0 }}
          >
            ✕
          </button>
        )}
        <br />
        {comentario.texto}
      </p>

      {/* Reacciones + acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {Array.from(grupos.entries()).map(([emoji, g]) => (
          <button
            key={emoji}
            onClick={() => handleReaccion(emoji)}
            style={{
              background: g.mia ? '#D85A3015' : '#fff',
              border: `1px solid ${g.mia ? '#D85A3040' : C.border}`,
              borderRadius: 20, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: C.ink,
            }}
          >
            {emoji} {g.count}
          </button>
        ))}
        {miJugadorId && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setVerEmojis(v => !v)}
              style={{
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20,
                padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#1A1A1A60',
              }}
            >
              {verEmojis ? '✕' : '+ 😊'}
            </button>
            {verEmojis && (
              <div style={{
                position: 'absolute', bottom: '110%', left: 0, zIndex: 10,
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20,
                padding: '6px 10px', display: 'flex', gap: 6, boxShadow: '0 2px 12px #1A1A1A15',
              }}>
                {CHAT_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => handleReaccion(e)}
                    style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0 }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {miJugadorId && !esReply && (
          <button
            onClick={() => setRespondiendo(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A60', padding: 0 }}
          >
            Responder
          </button>
        )}
        {!esReply && replies.length > 0 && (
          <button
            onClick={() => setVerReplies(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accent, padding: 0 }}
          >
            {verReplies ? '▴ ocultar' : `▾ ${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'}`}
          </button>
        )}
      </div>

      {/* Composer de reply */}
      {respondiendo && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={replyTexto}
            onChange={e => setReplyTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleReply() }}
            placeholder={`Responder a ${nombresById.get(comentario.jugador_id) || ''}…`}
            maxLength={500}
            autoFocus
            style={{
              flex: 1, border: '1px solid #E5E2DA', borderRadius: 20, padding: '6px 12px',
              fontSize: 12, outline: 'none', color: C.ink, background: '#fff',
            }}
          />
          <button
            onClick={handleReply}
            disabled={isSending || !replyTexto.trim()}
            style={{
              background: C.ink, color: '#fff', border: 'none', borderRadius: 20,
              padding: '6px 14px', fontSize: 11, cursor: 'pointer',
            }}
          >
            {isSending ? '…' : '→'}
          </button>
        </div>
      )}

      {/* Replies anidados */}
      {!esReply && verReplies && replies.length > 0 && (
        <div style={{ marginLeft: 16, marginTop: 4, borderLeft: `2px solid ${C.border}`, paddingLeft: 12 }}>
          {replies.map(r => (
            <Comentario
              key={r.id}
              comentario={r}
              replies={[]}
              reacciones={reacciones}
              nombresById={nombresById}
              miJugadorId={miJugadorId}
              esPartner={esPartner}
              onChanged={onChanged}
              esReply
            />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createComentario, toggleReaccion, deleteComentario } from '@/app/actions/quiniela'
import { CHAT_EMOJIS } from '@/lib/quiniela/config'
import type { QuinielaComentario, QuinielaReaccion } from '@/lib/quiniela/config'
import { Q, FONT, pixelStyle, avatarColor, iniciales } from '@/components/team/quiniela/theme'

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
  const [error, setError] = useState('')

  // comentarios llega ordenado desc por created_at → para el chat lo mostramos asc
  const principales = comentarios.filter(c => !c.parent_id).slice().reverse()

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
    <div style={{ animation: 'q-slideUp .35s ease both' }}>
      <div style={{ ...pixelStyle, fontSize: 11, color: Q.green, margin: '4px 2px 4px', textShadow: '0 0 12px rgba(54,245,154,.4)' }}>💬 EL BAR DE LA PORRA</div>
      <p style={{ fontSize: 11, color: Q.textMid, margin: '0 2px 16px' }}>Presume, vacila, llora.</p>

      {/* Mensajes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {principales.length === 0 && (
          <p style={{ fontSize: 12, color: Q.textDim, padding: '20px 0', textAlign: 'center' }}>
            Todavía no ha hablado nadie. Rompe el hielo. 🍺
          </p>
        )}
        {principales.map(c => (
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

      {/* Composer */}
      {miJugadorId ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, position: 'sticky', bottom: 0 }}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEnviar() }}
            placeholder="Di algo…"
            maxLength={500}
            style={{
              flex: 1, background: Q.cardHi, border: `1px solid ${Q.borderHi}`, borderRadius: 11,
              padding: '11px 13px', color: Q.text, fontSize: 13, fontFamily: FONT.body, outline: 'none',
            }}
          />
          <button
            onClick={handleEnviar}
            disabled={isSending || !texto.trim()}
            style={{
              border: 0, cursor: 'pointer', borderRadius: 11, padding: '0 16px', ...pixelStyle, fontSize: 10,
              color: '#06210f', background: texto.trim() ? 'linear-gradient(180deg,#48ffa6,#23d985)' : Q.cardHi,
              boxShadow: texto.trim() ? '0 3px 0 #128a52' : 'none', opacity: texto.trim() ? 1 : 0.5,
            }}
          >
            {isSending ? '…' : '▸'}
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: Q.textDim, marginTop: 16 }}>
          Apúntate a la porra para comentar.
        </p>
      )}
      {error && <p style={{ fontSize: 11, color: Q.pink, marginTop: 10 }}>{error}</p>}
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
  const nombre = nombresById.get(comentario.jugador_id) || '—'
  // Color de avatar estable por jugador
  const idxColor = Math.abs(Array.from(comentario.jugador_id).reduce((a, c) => a + c.charCodeAt(0), 0))
  const avColor = esMio ? Q.textSoft : avatarColor(idxColor)

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
    <div style={{ marginBottom: esReply ? 8 : 13 }}>
      <div style={{ display: 'flex', gap: 9, flexDirection: esMio ? 'row-reverse' : 'row' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...pixelStyle, fontSize: 9, color: '#0a0e1c', background: avColor,
        }}>
          {iniciales(nombre)}
        </div>
        <div style={{ maxWidth: '80%' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3, flexDirection: esMio ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: Q.textSoft }}>{nombre}</span>
            <span style={{ fontSize: 9, color: Q.textDim }}>{timeAgo(comentario.created_at)}</span>
            {(esMio || esPartner) && (
              <button onClick={handleDelete} title="Borrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: Q.textDim, fontSize: 10, padding: 0 }}>✕</button>
            )}
          </div>
          <div style={{
            background: esMio ? 'rgba(54,245,154,.12)' : Q.cardHi,
            border: `1px solid ${esMio ? 'rgba(54,245,154,.3)' : Q.border}`,
            borderRadius: 13, padding: '9px 12px', fontSize: 13, color: Q.text, lineHeight: 1.4,
          }}>
            {comentario.texto}
          </div>

          {/* Reacciones + acciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap', flexDirection: esMio ? 'row-reverse' : 'row' }}>
            {Array.from(grupos.entries()).map(([emoji, g]) => (
              <button
                key={emoji}
                onClick={() => handleReaccion(emoji)}
                style={{
                  background: g.mia ? 'rgba(54,245,154,.12)' : 'rgba(255,255,255,.07)',
                  border: `1px solid ${g.mia ? 'rgba(54,245,154,.4)' : Q.borderHi}`,
                  borderRadius: 999, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: Q.textSoft,
                }}
              >
                {emoji} {g.count}
              </button>
            ))}
            {miJugadorId && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setVerEmojis(v => !v)}
                  style={{ background: 'rgba(255,255,255,.07)', border: `1px solid ${Q.borderHi}`, borderRadius: 999, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: Q.textMid }}
                >
                  {verEmojis ? '✕' : '+ 😊'}
                </button>
                {verEmojis && (
                  <div style={{
                    position: 'absolute', bottom: '110%', left: 0, zIndex: 10,
                    background: Q.cardHi, border: `1px solid ${Q.borderHi}`, borderRadius: 999,
                    padding: '6px 10px', display: 'flex', gap: 6, boxShadow: '0 4px 16px rgba(0,0,0,.5)',
                  }}>
                    {CHAT_EMOJIS.map(e => (
                      <button key={e} onClick={() => handleReaccion(e)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0 }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {miJugadorId && !esReply && (
              <button onClick={() => setRespondiendo(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: Q.textMid, padding: 0 }}>Responder</button>
            )}
            {!esReply && replies.length > 0 && (
              <button onClick={() => setVerReplies(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: Q.cyan, padding: 0 }}>
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
                placeholder={`Responder a ${nombre}…`}
                maxLength={500}
                autoFocus
                style={{ flex: 1, background: Q.cardHi, border: `1px solid ${Q.borderHi}`, borderRadius: 11, padding: '6px 12px', fontSize: 12, outline: 'none', color: Q.text, fontFamily: FONT.body }}
              />
              <button
                onClick={handleReply}
                disabled={isSending || !replyTexto.trim()}
                style={{ background: Q.green, color: '#06210f', border: 'none', borderRadius: 11, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}
              >
                {isSending ? '…' : '→'}
              </button>
            </div>
          )}

          {/* Replies anidados */}
          {!esReply && verReplies && replies.length > 0 && (
            <div style={{ marginTop: 8, borderLeft: `2px solid ${Q.border}`, paddingLeft: 12 }}>
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
      </div>
    </div>
  )
}

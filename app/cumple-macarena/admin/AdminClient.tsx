'use client'

import { useState, useTransition } from 'react'
import { deleteFormRsvp } from '../actions'

type Rsvp = {
  id: string
  nombre_nino: string
  asiste: boolean
  menu_opcion: string | null
  created_at: string
}

type Props = {
  rsvps: Rsvp[]
  invitacionUrl: string
  adminKey: string
}

const MENU_LABELS: Record<string, string> = {
  pizza: '🍕 Pizza + 🎂 Tarta + 🍬 Chuches',
  perrito: '🌭 Perrito + 🎂 Tarta + 🍬 Chuches',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminClient({ rsvps, invitacionUrl, adminKey }: Props) {
  const [, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const confirmed = rsvps.filter(r => r.asiste).length
  const declined = rsvps.filter(r => !r.asiste).length
  const pizza = rsvps.filter(r => r.menu_opcion === 'pizza').length
  const perrito = rsvps.filter(r => r.menu_opcion === 'perrito').length

  function copyLink() {
    navigator.clipboard.writeText(invitacionUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la respuesta de ${nombre}?`)) return
    startTransition(() => deleteFormRsvp(id))
  }

  function badgeStyle(color: string, bg: string): React.CSSProperties {
    return { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color, background: bg, border: `2px solid ${color}`, whiteSpace: 'nowrap' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b1736', fontFamily: "'Fredoka', system-ui, sans-serif", padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ fontFamily: "'Bowlby One', sans-serif", fontSize: 28, color: '#FFD93B', marginBottom: 4, WebkitTextStroke: '1px #13316E', textShadow: '0 3px 0 #13316E' }}>
          Dashboard 🎂
        </div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 20 }}>
          Cumpleaños Macarena · 13 junio 2026 · Urban Planet Madrid
        </div>

        {/* LINK DE INVITACIÓN */}
        <div style={{ background: 'rgba(255,217,59,.08)', border: '2px solid rgba(255,217,59,.25)', borderRadius: 16, padding: '14px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#FFD93B', fontWeight: 600, marginBottom: 4 }}>
              Link de invitación (comparte este link)
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {invitacionUrl}
            </div>
          </div>
          <button
            onClick={copyLink}
            style={{ background: '#FFD93B', color: '#13316E', border: '3px solid #13316E', borderRadius: 12, padding: '8px 16px', fontFamily: "'Bowlby One', sans-serif", fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 0 #F4B400', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {copied ? '✓ Copiado' : '🔗 Copiar'}
          </button>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { num: rsvps.length, label: 'Respuestas', color: '#FFD93B' },
            { num: confirmed, label: '✅ Vienen', color: '#5BB36B' },
            { num: declined, label: '❌ No vienen', color: '#E94B3C' },
            { num: pizza, label: '🍕 Pizza', color: '#FF7AA8' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.06)', border: '2px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bowlby One', sans-serif", fontSize: 28, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* PERRITO stat extra */}
        {perrito > 0 && (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, color: 'rgba(255,255,255,.6)' }}>
            🌭 <strong style={{ color: '#FFD93B' }}>{perrito}</strong> perrito · 🍕 <strong style={{ color: '#FFD93B' }}>{pizza}</strong> pizza
          </div>
        )}

        {/* LISTA DE RSVPs */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '2px solid rgba(255,255,255,.1)', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 32px', gap: 8, padding: '10px 16px', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            <div>Niño/a</div>
            <div>Estado</div>
            <div>Menú</div>
            <div />
          </div>

          {rsvps.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 14 }}>
              Aún no hay respuestas 🕐
            </div>
          )}

          {rsvps.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 32px', gap: 8, padding: '12px 16px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{r.nombre_nino}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{formatDate(r.created_at)}</div>
              </div>

              <div>
                {r.asiste
                  ? <span style={badgeStyle('#5BB36B', 'rgba(91,179,107,.12)')}>✅ Viene</span>
                  : <span style={badgeStyle('#E94B3C', 'rgba(233,75,60,.12)')}>❌ No</span>
                }
              </div>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.4 }}>
                {r.menu_opcion ? MENU_LABELS[r.menu_opcion] ?? r.menu_opcion : '—'}
              </div>

              <button
                onClick={() => handleDelete(r.id, r.nombre_nino)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.35, lineHeight: 1 }}
                title="Eliminar respuesta"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 12, marginTop: 16 }}>
          <a href={`/cumple-macarena/admin?key=${adminKey}`} style={{ color: 'inherit' }}>
            Recargar para ver nuevas respuestas
          </a>
        </div>
      </div>
    </div>
  )
}

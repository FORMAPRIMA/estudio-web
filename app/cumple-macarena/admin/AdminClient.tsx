'use client'

import { useState, useTransition } from 'react'
import { createInvitado, deleteInvitado } from '../actions'

type Row = {
  id: string
  nombre: string
  token: string
  created_at: string
  rsvp: { asiste: boolean; menu_opcion: string | null; updated_at: string } | null
}

type Props = {
  rows: Row[]
  siteUrl: string
  adminKey: string
}

const MENU_LABELS: Record<string, string> = {
  menu_a: '🍗 Menú A',
  menu_b: '🍝 Menú B',
  menu_c: '🥗 Menú C',
}

export default function AdminClient({ rows, siteUrl, adminKey }: Props) {
  const [nombre, setNombre] = useState('')
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState<string | null>(null)

  const confirmed = rows.filter(r => r.rsvp?.asiste === true).length
  const declined = rows.filter(r => r.rsvp?.asiste === false).length
  const pending = rows.filter(r => !r.rsvp).length

  function getLink(token: string) {
    return `${siteUrl}/cumple-macarena/${token}`
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(getLink(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    startTransition(async () => {
      await createInvitado(nombre)
      setNombre('')
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name}?`)) return
    startTransition(() => deleteInvitado(id))
  }

  function badge(color: string, bg: string): React.CSSProperties {
    return { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color, background: bg, border: `2px solid ${color}` }
  }

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#0b1736', fontFamily: "'Fredoka', system-ui, sans-serif", padding: '24px 16px' },
    container: { maxWidth: 640, margin: '0 auto' },
    title: { fontFamily: "'Bowlby One', sans-serif", fontSize: 28, color: '#FFD93B', marginBottom: 4, WebkitTextStroke: '1px #13316E', textShadow: '0 3px 0 #13316E' },
    sub: { color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 24 },
    statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 },
    statCard: { background: 'rgba(255,255,255,.07)', border: '2px solid rgba(255,255,255,.12)', borderRadius: 16, padding: '14px 12px', textAlign: 'center' as const },
    statNum: { fontFamily: "'Bowlby One', sans-serif", fontSize: 32, display: 'block' },
    statLabel: { fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.55)', marginTop: 4 },
    addCard: { background: 'rgba(255,255,255,.06)', border: '2px solid rgba(255,255,255,.12)', borderRadius: 18, padding: '16px 16px 18px', marginBottom: 24 },
    addTitle: { color: '#fff', fontWeight: 600, fontSize: 13, letterSpacing: '.15em', textTransform: 'uppercase' as const, marginBottom: 10 },
    addRow: { display: 'flex', gap: 8 },
    input: { flex: 1, background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.2)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 16, fontFamily: "'Fredoka', sans-serif", outline: 'none' },
    btnAdd: { background: '#FFD93B', color: '#13316E', border: '3px solid #13316E', borderRadius: 12, padding: '10px 18px', fontFamily: "'Bowlby One', sans-serif", fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 0 #F4B400', whiteSpace: 'nowrap' as const },
    listCard: { background: 'rgba(255,255,255,.04)', border: '2px solid rgba(255,255,255,.1)', borderRadius: 18, overflow: 'hidden' },
    listHeader: { display: 'grid', gridTemplateColumns: '1fr 90px 90px 40px', gap: 8, padding: '10px 16px', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' as const },
    row: { display: 'grid', gridTemplateColumns: '1fr 90px 90px 40px', gap: 8, padding: '12px 16px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,.06)' },
    nombre: { color: '#fff', fontWeight: 600, fontSize: 15 },
    badge: {} as React.CSSProperties,
    copyBtn: { background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '4px 10px', color: '#FFD93B', fontSize: 12, cursor: 'pointer', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, whiteSpace: 'nowrap' as const },
    deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.4, lineHeight: 1 },
    nameRow: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
    link: { fontSize: 10, color: 'rgba(255,255,255,.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 180 },
    actionCol: { display: 'flex', gap: 4, alignItems: 'center' },
    refreshNote: { textAlign: 'center' as const, color: 'rgba(255,255,255,.3)', fontSize: 12, marginTop: 16 },
    adminLink: { textAlign: 'center' as const, marginTop: 12 },
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.title}>Dashboard 🎂</div>
        <div style={s.sub}>Cumpleaños Macarena · 13 junio 2026 · Las Rejas</div>

        {/* STATS */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#5BB36B' }}>{confirmed}</span>
            <div style={s.statLabel}>✅ Confirmados</div>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#FFD93B' }}>{pending}</span>
            <div style={s.statLabel}>⏳ Pendientes</div>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: '#E94B3C' }}>{declined}</span>
            <div style={s.statLabel}>❌ No vienen</div>
          </div>
        </div>

        {/* ADD INVITADO */}
        <div style={s.addCard}>
          <div style={s.addTitle}>Añadir invitado/a</div>
          <form onSubmit={handleAdd} style={s.addRow}>
            <input
              style={s.input}
              placeholder="Nombre del invitado/a"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              disabled={isPending}
            />
            <button type="submit" style={s.btnAdd} disabled={isPending || !nombre.trim()}>
              + Añadir
            </button>
          </form>
        </div>

        {/* LIST */}
        <div style={s.listCard}>
          <div style={s.listHeader}>
            <div>Invitado/a</div>
            <div>RSVP</div>
            <div>Menú</div>
            <div />
          </div>

          {rows.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 14 }}>
              Aún no hay invitados
            </div>
          )}

          {rows.map(row => (
            <div key={row.id} style={s.row}>
              <div style={s.nameRow}>
                <div style={s.nombre}>{row.nombre}</div>
                <div style={s.link}>{getLink(row.token)}</div>
              </div>

              <div>
                {!row.rsvp && <span style={badge('rgba(255,255,255,.5)', 'rgba(255,255,255,.06)')}>Pendiente</span>}
                {row.rsvp?.asiste === true && <span style={badge('#5BB36B', 'rgba(91,179,107,.12)')}>✅ Viene</span>}
                {row.rsvp?.asiste === false && <span style={badge('#E94B3C', 'rgba(233,75,60,.12)')}>❌ No viene</span>}
              </div>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                {row.rsvp?.menu_opcion ? MENU_LABELS[row.rsvp.menu_opcion] ?? row.rsvp.menu_opcion : '—'}
              </div>

              <div style={s.actionCol}>
                <button
                  style={s.copyBtn}
                  onClick={() => copyLink(row.token)}
                  title="Copiar link personalizado"
                >
                  {copied === row.token ? '✓' : '🔗'}
                </button>
                <button
                  style={s.deleteBtn}
                  onClick={() => handleDelete(row.id, row.nombre)}
                  title="Eliminar"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={s.refreshNote}>
          Recarga la página para actualizar los RSVPs en tiempo real
        </div>

        <div style={{ ...s.adminLink, marginTop: 24 }}>
          <a
            href={`/cumple-macarena/admin?key=${adminKey}`}
            style={{ color: 'rgba(255,255,255,.25)', fontSize: 12 }}
          >
            Recargar dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

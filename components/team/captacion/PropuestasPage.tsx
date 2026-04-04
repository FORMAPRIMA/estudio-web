'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPropuesta, deletePropuesta } from '@/app/actions/propuestas'

type Lead = { id: string; nombre: string; apellidos: string | null; empresa: string | null }
type Propuesta = {
  id: string
  numero: string
  status: string
  titulo: string | null
  fecha_propuesta: string | null
  lead_id: string | null
  leads: { nombre: string; apellidos: string; empresa: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  borrador:  'Borrador',
  enviada:   'Enviada',
  aceptada:  'Aceptada',
  rechazada: 'Rechazada',
}

const STATUS_COLOR: Record<string, string> = {
  borrador:  '#AAA',
  enviada:   '#378ADD',
  aceptada:  '#4CAF50',
  rechazada: '#E57373',
}

export default function PropuestasPage({
  propuestas,
  leads,
}: {
  propuestas: Propuesta[]
  leads: Lead[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = propuestas.filter(p =>
    filterStatus === 'all' ? true : p.status === filterStatus
  )

  function handleNew() {
    setShowLeadModal(true)
  }

  async function handleCreate(leadId?: string) {
    setShowLeadModal(false)
    startTransition(async () => {
      const result = await createPropuesta(leadId ?? null)
      if ('id' in result) {
        router.push(`/team/captacion/propuestas/${result.id}`)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta propuesta?')) return
    setDeletingId(id)
    await deletePropuesta(id)
    setDeletingId(null)
    router.refresh()
  }

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase()
    return (
      l.nombre.toLowerCase().includes(q) ||
      (l.apellidos ?? '').toLowerCase().includes(q) ||
      (l.empresa ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Header */}
      <div style={{ padding: '40px 40px 32px', borderBottom: '1px solid #E8E6E0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Captación
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Propuestas de honorarios
          </h1>
        </div>
        <button
          onClick={handleNew}
          disabled={isPending}
          style={{
            padding: '10px 20px', background: '#1A1A1A', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 500,
            cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Creando…' : '+ Nueva propuesta'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '20px 40px', display: 'flex', gap: 8 }}>
        {['all', 'borrador', 'enviada', 'aceptada', 'rechazada'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: '1px solid',
              borderColor: filterStatus === s ? '#1A1A1A' : '#E8E6E0',
              background: filterStatus === s ? '#1A1A1A' : '#fff',
              color: filterStatus === s ? '#fff' : '#666',
              cursor: 'pointer',
            }}
          >
            {s === 'all' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ padding: '0 40px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#AAA', fontSize: 14 }}>
            No hay propuestas{filterStatus !== 'all' ? ` en estado "${STATUS_LABEL[filterStatus]}"` : ''}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
                  {['Nº', 'Título', 'Cliente', 'Fecha', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/team/captacion/propuestas/${p.id}`)}
                    style={{ borderBottom: '1px solid #F0EEE8', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: p.numero === 'BORRADOR' ? '#CCC' : '#AAA', fontStyle: p.numero === 'BORRADOR' ? 'italic' : 'normal' }}>
                      {p.numero === 'BORRADOR' ? 'Sin número' : p.numero}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#1A1A1A', fontWeight: 400 }}>
                      {p.titulo ?? <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin título</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#555' }}>
                      {p.leads
                        ? [p.leads.nombre, p.leads.apellidos].filter(Boolean).join(' ') + (p.leads.empresa ? ` · ${p.leads.empresa}` : '')
                        : <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin cliente</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#888', whiteSpace: 'nowrap' }}>
                      {p.fecha_propuesta
                        ? new Date(p.fecha_propuesta).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${STATUS_COLOR[p.status]}18`,
                        color: STATUS_COLOR[p.status],
                      }}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                        disabled={deletingId === p.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, padding: '2px 6px' }}
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead selector modal */}
      {showLeadModal && (
        <div
          onClick={() => setShowLeadModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ padding: '24px 24px 0' }}>
              <h3 style={{ fontSize: 16, fontWeight: 400, margin: '0 0 4px', color: '#1A1A1A' }}>Nueva propuesta</h3>
              <p style={{ fontSize: 13, color: '#AAA', margin: '0 0 16px' }}>Selecciona un lead o crea la propuesta sin cliente.</p>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar lead…"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E8E6E0', borderRadius: 4, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              <button
                onClick={() => handleCreate(undefined)}
                style={{ width: '100%', padding: '12px 24px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#AAA', fontStyle: 'italic', borderBottom: '1px solid #F0EEE8' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Sin cliente
              </button>
              {filteredLeads.map(l => (
                <button
                  key={l.id}
                  onClick={() => handleCreate(l.id)}
                  style={{ width: '100%', padding: '12px 24px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #F0EEE8', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ color: '#1A1A1A' }}>{[l.nombre, l.apellidos].filter(Boolean).join(' ')}</span>
                  {l.empresa && <span style={{ color: '#AAA', marginLeft: 8 }}>· {l.empresa}</span>}
                </button>
              ))}
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid #E8E6E0' }}>
              <button
                onClick={() => setShowLeadModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#AAA' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

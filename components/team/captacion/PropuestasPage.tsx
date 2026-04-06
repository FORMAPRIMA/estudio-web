'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPropuesta, deletePropuesta } from '@/app/actions/propuestas'

type ContactoItem = { id: string; nombre: string; apellidos: string | null; empresa: string | null; source: 'lead' | 'cliente' }
type Propuesta = {
  id: string
  numero: string
  status: string
  titulo: string | null
  fecha_propuesta: string | null
  lead_id: string | null
  cliente_id: string | null
  leads: { nombre: string; apellidos: string; empresa: string | null } | null
  clientes: { nombre: string; apellidos: string | null; empresa: string | null } | null
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
  contactos,
}: {
  propuestas: Propuesta[]
  contactos: ContactoItem[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [localPropuestas, setLocalPropuestas] = useState(propuestas)

  const filtered = localPropuestas.filter(p =>
    filterStatus === 'all' ? true : p.status === filterStatus
  )

  function handleNew() {
    setShowLeadModal(true)
  }

  async function handleCreate(contactoId?: string, source?: 'lead' | 'cliente') {
    setShowLeadModal(false)
    startTransition(async () => {
      const result = await createPropuesta(contactoId ?? null, source ?? 'lead')
      if ('id' in result) {
        router.push(`/team/captacion/propuestas/${result.id}`)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta propuesta?')) return
    setLocalPropuestas(prev => prev.filter(p => p.id !== id))
    await deletePropuesta(id)
  }

  const filteredContactos = contactos.filter(c => {
    const q = search.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.apellidos ?? '').toLowerCase().includes(q) ||
      (c.empresa ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Header */}
      <div className="captacion-header" style={{ padding: '40px 40px 32px', borderBottom: '1px solid #E8E6E0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
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
      <div className="captacion-filters" style={{ padding: '20px 40px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      <div className="captacion-table-section" style={{ padding: '0 40px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#AAA', fontSize: 14 }}>
            No hay propuestas{filterStatus !== 'all' ? ` en estado "${STATUS_LABEL[filterStatus]}"` : ''}
          </div>
        ) : (
          <div className="fp-table-wrap" style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Nº</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Título</th>
                  <th className="captacion-col-hide" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Cliente</th>
                  <th className="captacion-col-hide" style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Fecha</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Estado</th>
                  <th className="captacion-col-hide" style={{ padding: '12px 16px' }} />
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
                      {p.numero === 'BORRADOR' ? 'Sin nº' : p.numero}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#1A1A1A', fontWeight: 400 }}>
                      <div>{p.titulo ?? <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin título</span>}</div>
                      {(p.leads || p.clientes) && (
                        <div className="captacion-col-show-mobile" style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          {p.leads
                            ? [p.leads.nombre, p.leads.apellidos].filter(Boolean).join(' ') + (p.leads.empresa ? ` · ${p.leads.empresa}` : '')
                            : [p.clientes!.nombre, p.clientes!.apellidos].filter(Boolean).join(' ') + (p.clientes!.empresa ? ` · ${p.clientes!.empresa}` : '')}
                        </div>
                      )}
                    </td>
                    <td className="captacion-col-hide" style={{ padding: '14px 16px', color: '#555' }}>
                      {p.leads
                        ? [p.leads.nombre, p.leads.apellidos].filter(Boolean).join(' ') + (p.leads.empresa ? ` · ${p.leads.empresa}` : '')
                        : p.clientes
                          ? [p.clientes.nombre, p.clientes.apellidos].filter(Boolean).join(' ') + (p.clientes.empresa ? ` · ${p.clientes.empresa}` : '')
                          : <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin cliente</span>}
                    </td>
                    <td className="captacion-col-hide" style={{ padding: '14px 16px', color: '#888', whiteSpace: 'nowrap' }}>
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
                    <td className="captacion-col-hide" style={{ padding: '14px 16px', textAlign: 'right' }}>
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
          className="captacion-modal-overlay"
          onClick={() => setShowLeadModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="captacion-modal-box"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: 'min(480px, 92vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ padding: '20px 20px 0' }}>
              <h3 style={{ fontSize: 16, fontWeight: 400, margin: '0 0 4px', color: '#1A1A1A' }}>Nueva propuesta</h3>
              <p style={{ fontSize: 13, color: '#AAA', margin: '0 0 14px' }}>Selecciona un lead o cliente existente.</p>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o empresa…"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E6E0', borderRadius: 4, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              <button
                onClick={() => handleCreate(undefined)}
                style={{ width: '100%', padding: '14px 20px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#AAA', fontStyle: 'italic', borderBottom: '1px solid #F0EEE8' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                Sin cliente
              </button>
              {filteredContactos.map(c => (
                <button
                  key={`${c.source}-${c.id}`}
                  onClick={() => handleCreate(c.id, c.source)}
                  style={{ width: '100%', padding: '12px 20px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #F0EEE8', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span>
                    <span style={{ color: '#1A1A1A' }}>{[c.nombre, c.apellidos].filter(Boolean).join(' ')}</span>
                    {c.empresa && <span style={{ color: '#AAA', marginLeft: 8 }}>· {c.empresa}</span>}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '2px 7px', borderRadius: 3, flexShrink: 0,
                    background: c.source === 'cliente' ? '#E8F4EF' : '#EEF4FF',
                    color: c.source === 'cliente' ? '#1D9E75' : '#378ADD',
                  }}>
                    {c.source === 'cliente' ? 'Cliente' : 'Lead'}
                  </span>
                </button>
              ))}
            </div>
            <div className="captacion-modal-actions" style={{ padding: '12px 20px', borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                onClick={() => setShowLeadModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#AAA', padding: '8px 0' }}
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

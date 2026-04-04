'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createContrato, deleteContrato, createContratoFromPropuesta } from '@/app/actions/contratos'

interface ContratoRow {
  id: string
  numero: string | null
  status: string
  cliente_nombre: string | null
  cliente_empresa: string | null
  proyecto_nombre: string | null
  proyecto_direccion: string | null
  fecha_envio: string | null
  fecha_firma: string | null
  honorarios: { importe: number }[]
  lead_id: string | null
  proyecto_id: string | null
  created_at: string
}

interface Lead {
  id: string
  nombre: string
  apellidos: string | null
  empresa: string | null
}

interface PropuestaRow {
  id:     string
  numero: string
  titulo: string | null
  status: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  borrador:    { label: 'Borrador',    color: '#888',    bg: '#F0EEE8' },
  enviado:     { label: 'Enviado',     color: '#378ADD', bg: '#EEF4FD' },
  negociacion: { label: 'Negociación', color: '#9B59B6', bg: '#F5EEFB' },
  firmado:     { label: 'Firmado',     color: '#1D9E75', bg: '#EEF8F4' },
  cancelado:   { label: 'Cancelado',   color: '#E53E3E', bg: '#FEF2F2' },
}

const STATUS_ORDER = ['borrador', 'enviado', 'negociacion', 'firmado', 'cancelado']

function eur(n: number) {
  return `€ ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(n)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function totalHonorarios(honorarios: { importe: number }[]) {
  return (honorarios ?? []).reduce((s, h) => s + (h.importe ?? 0), 0)
}

export default function ContratosPage({
  contratos: initial,
  leads,
  propuestas,
}: {
  contratos:  ContratoRow[]
  leads:      Lead[]
  propuestas: PropuestaRow[]
}) {
  const router = useRouter()
  const [contratos, setContratos] = useState(initial)
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [newLeadId, setNewLeadId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedPropuesta, setSelectedPropuesta] = useState('')
  const [tipoCliente, setTipoCliente] = useState<'fisica' | 'juridica'>('fisica')
  const [creating, startTransition] = useTransition()

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createContrato(newLeadId || null)
      if ('id' in res) router.push(`/team/captacion/contratos/${res.id}`)
    })
  }

  const handleCreateFromPropuesta = () => {
    if (!selectedPropuesta) return
    startTransition(async () => {
      const res = await createContratoFromPropuesta(selectedPropuesta, tipoCliente)
      if ('id' in res) {
        setShowModal(false)
        router.push(`/team/captacion/contratos/${res.id}`)
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este contrato?')) return
    setContratos(prev => prev.filter(c => c.id !== id))
    startTransition(async () => {
      await deleteContrato(id)
      router.refresh()
    })
  }

  const filtered = contratos.filter(c => {
    const text = query.toLowerCase()
    const matchText = !text ||
      c.numero?.toLowerCase().includes(text) ||
      c.cliente_nombre?.toLowerCase().includes(text) ||
      c.cliente_empresa?.toLowerCase().includes(text) ||
      c.proyecto_nombre?.toLowerCase().includes(text)
    const matchStatus = !statusFilter || c.status === statusFilter
    return matchText && matchStatus
  })

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = contratos.filter(c => c.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <>
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 24px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Captación
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Contratos de servicios
          </h1>

          {/* New contrato */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{ height: 36, padding: '0 20px', background: '#D85A30', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
            >
              + Desde propuesta
            </button>
            <select
              value={newLeadId}
              onChange={e => setNewLeadId(e.target.value)}
              style={{ height: 36, padding: '0 10px', fontSize: 11, border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff', fontFamily: 'inherit', color: newLeadId ? '#1A1A1A' : '#AAA', outline: 'none' }}
            >
              <option value="">Sin lead asociado</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>
                  {[l.nombre, l.apellidos].filter(Boolean).join(' ')}{l.empresa ? ` · ${l.empresa}` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              style={{ height: 36, padding: '0 20px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#333' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
            >
              + En blanco
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setStatusFilter('')}
            style={{ fontSize: 10, fontWeight: statusFilter === '' ? 700 : 400, background: statusFilter === '' ? '#1A1A1A' : '#F0EEE8', color: statusFilter === '' ? '#fff' : '#888', border: 'none', borderRadius: 12, padding: '4px 12px', cursor: 'pointer' }}
          >
            Todos ({contratos.length})
          </button>
          {STATUS_ORDER.map(s => {
            const meta = STATUS_META[s]
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(active ? '' : s)}
                style={{ fontSize: 10, fontWeight: active ? 700 : 400, background: active ? meta.color : meta.bg, color: active ? '#fff' : meta.color, border: 'none', borderRadius: 12, padding: '4px 12px', cursor: 'pointer' }}
              >
                {meta.label} ({counts[s] ?? 0})
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '16px 40px', background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
        <input
          type="search"
          placeholder="Buscar por número, cliente, proyecto…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', maxWidth: 400, height: 34, padding: '0 12px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff', fontFamily: 'inherit', outline: 'none' }}
        />
      </div>

      {/* List */}
      <div style={{ padding: '24px 40px' }}>
        <div className="fp-table-wrap" style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F7F4' }}>
                {(['N.º Contrato', 'Cliente', 'Proyecto', 'Total honorarios', 'Estado', 'F. envío', 'F. firma', ''] as string[]).map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left', borderBottom: '1px solid #E8E6E0', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: '#CCC', fontStyle: 'italic', borderBottom: 'none' }}>
                    {contratos.length === 0 ? 'No hay contratos. Crea el primero.' : 'Sin resultados.'}
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const meta = STATUS_META[c.status] ?? STATUS_META.borrador
                const total = totalHonorarios(c.honorarios)
                const clienteLabel = c.cliente_empresa
                  ? `${c.cliente_nombre ?? ''} · ${c.cliente_empresa}`
                  : c.cliente_nombre ?? '—'

                return (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/team/captacion/contratos/${c.id}`)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 12, verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8', fontFamily: 'monospace', fontWeight: 600 }}>
                      {c.numero ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8' }}>
                      {clienteLabel}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8' }}>
                      <div>{c.proyecto_nombre ?? <span style={{ color: '#CCC' }}>—</span>}</div>
                      {c.proyecto_direccion && <div style={{ fontSize: 10, color: '#AAA' }}>{c.proyecto_direccion}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8', fontWeight: total > 0 ? 500 : 400, color: total > 0 ? '#1A1A1A' : '#CCC' }}>
                      {total > 0 ? eur(total) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 3 }}>
                        {meta.label}
                      </span>
                      {c.proyecto_id && (
                        <div style={{ fontSize: 9, color: '#1D9E75', marginTop: 3 }}>✓ Proyecto creado</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#888', verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8' }}>
                      {fmtDate(c.fecha_envio)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: '#888', verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8' }}>
                      {fmtDate(c.fecha_firma)}
                    </td>
                    <td style={{ padding: '0 8px', verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DDD', fontSize: 15, padding: '4px 6px', borderRadius: 3 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}
                      >×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ── Modal: crear contrato desde propuesta ── */}
    {showModal && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }} onClick={() => setShowModal(false)}>
        <div style={{
          background: '#fff', borderRadius: 8, padding: '32px 36px', width: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: '0 0 6px' }}>
            Crear contrato desde propuesta
          </h2>
          <p style={{ fontSize: 12, color: '#AAA', margin: '0 0 24px', lineHeight: 1.5 }}>
            Selecciona una propuesta de honorarios. El contrato se pre-rellenará automáticamente con los datos del cliente, servicios contratados, honorarios e hitos de pago.
          </p>

          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>
            Propuesta
          </label>
          <select
            value={selectedPropuesta}
            onChange={e => setSelectedPropuesta(e.target.value)}
            style={{ width: '100%', height: 40, padding: '0 12px', fontSize: 13, border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff', fontFamily: 'inherit', color: selectedPropuesta ? '#1A1A1A' : '#AAA', outline: 'none', marginBottom: 24 }}
          >
            <option value="">Seleccionar propuesta…</option>
            {propuestas.map(p => (
              <option key={p.id} value={p.id}>
                {p.numero} · {p.titulo ?? 'Sin título'} · {p.status}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>
            Tipo de cliente
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {(['fisica', 'juridica'] as const).map(tipo => (
              <button
                key={tipo}
                onClick={() => setTipoCliente(tipo)}
                style={{
                  flex: 1, height: 38, border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  borderColor: tipoCliente === tipo ? '#1A1A1A' : '#E8E6E0',
                  background: tipoCliente === tipo ? '#1A1A1A' : '#fff',
                  color: tipoCliente === tipo ? '#fff' : '#888',
                }}
              >
                {tipo === 'fisica' ? 'Persona física' : 'Persona jurídica'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowModal(false)}
              style={{ height: 36, padding: '0 20px', background: '#F0EEE8', color: '#888', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateFromPropuesta}
              disabled={!selectedPropuesta || creating}
              style={{
                height: 36, padding: '0 24px', background: !selectedPropuesta || creating ? '#CCC' : '#D85A30',
                color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: !selectedPropuesta || creating ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Creando…' : 'Crear contrato'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

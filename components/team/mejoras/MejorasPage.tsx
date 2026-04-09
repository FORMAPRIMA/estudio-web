'use client'

import { useState } from 'react'
import { addMejora, updateMejoraStatus, seedMejoras } from '@/app/actions/mejoras'

// ── Types ─────────────────────────────────────────────────────────────────────

type MejoraStatus = 'pendiente' | 'en_proceso' | 'implementada' | 'descartada'
type MejoraTipo   = 'mejora' | 'bug'

interface Mejora {
  id: string
  tipo: MejoraTipo
  titulo: string
  descripcion: string | null
  status: MejoraStatus
  autor_id: string
  created_at: string
  autor: { nombre: string; rol: string } | null
}

interface Props {
  mejoras: Mejora[]
  currentUserId: string
  currentUserRole: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MejoraStatus, { label: string; bg: string; color: string }> = {
  pendiente:    { label: 'Pendiente',    bg: '#FEF3C7', color: '#92400E' },
  en_proceso:   { label: 'En proceso',   bg: '#DBEAFE', color: '#1E40AF' },
  implementada: { label: 'Implementada', bg: '#D1FAE5', color: '#065F46' },
  descartada:   { label: 'Descartada',   bg: '#F3F4F6', color: '#6B7280' },
}

const TIPO_CONFIG: Record<MejoraTipo, { label: string; bg: string; color: string }> = {
  mejora: { label: 'Mejora', bg: '#EDE9FE', color: '#5B21B6' },
  bug:    { label: 'Bug',    bg: '#FEE2E2', color: '#991B1B' },
}

const STATUS_ORDER: MejoraStatus[] = ['pendiente', 'en_proceso', 'implementada', 'descartada']

const CAN_MANAGE = ['fp_manager', 'fp_partner']

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      className="inline-block text-[8px] tracking-widest uppercase font-medium px-2 py-0.5 shrink-0"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MejorasPage({ mejoras: initialMejoras, currentUserId, currentUserRole }: Props) {
  const [mejoras, setMejoras] = useState<Mejora[]>(initialMejoras)
  const [filter, setFilter] = useState<MejoraStatus | 'todas'>('todas')
  const [showForm, setShowForm] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const canManage = CAN_MANAGE.includes(currentUserRole)
  const isPartner = currentUserRole === 'fp_partner'

  const filtered = filter === 'todas'
    ? mejoras
    : mejoras.filter(m => m.status === filter)

  const counts: Record<string, number> = {
    todas:       mejoras.length,
    pendiente:   mejoras.filter(m => m.status === 'pendiente').length,
    en_proceso:  mejoras.filter(m => m.status === 'en_proceso').length,
    implementada: mejoras.filter(m => m.status === 'implementada').length,
    descartada:  mejoras.filter(m => m.status === 'descartada').length,
  }

  const handleStatusChange = async (id: string, newStatus: MejoraStatus) => {
    // Optimistic update
    setMejoras(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m))
    const result = await updateMejoraStatus(id, newStatus)
    if ('error' in result) {
      // Rollback
      setMejoras(prev => prev.map(m => m.id === id ? { ...m, status: mejoras.find(x => x.id === id)!.status } : m))
      alert(`Error: ${result.error}`)
    }
  }

  const handleSeed = async () => {
    if (!confirm(`¿Cargar las ${27} peticiones recogidas en las reuniones de equipo?`)) return
    setSeeding(true)
    const result = await seedMejoras()
    setSeeding(false)
    if ('error' in result) { alert(`Error: ${result.error}`); return }
    window.location.reload()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[13px] tracking-widest uppercase font-light text-ink">
            Peticiones de mejora
          </h1>
          <p className="text-[11px] font-light text-meta/60 mt-1">
            Comparte ideas para mejorar la plataforma o reporta un bug
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-[9px] tracking-widest uppercase font-medium px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors shrink-0"
        >
          + Nueva petición
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 border-b border-ink/10 pb-4">
        {(['todas', ...STATUS_ORDER] as const).map(s => {
          const active = filter === s
          const cfg = s === 'todas' ? null : STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[9px] tracking-widest uppercase font-medium px-3 py-1.5 transition-colors border ${
                active
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-transparent text-meta/50 border-ink/15 hover:border-ink/30 hover:text-ink'
              }`}
            >
              {s === 'todas' ? 'Todas' : cfg!.label}
              <span className={`ml-1.5 ${active ? 'text-cream/60' : 'text-meta/40'}`}>
                {counts[s]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[11px] font-light text-meta/40 tracking-wide">
            {filter === 'todas' ? 'No hay peticiones todavía.' : `No hay peticiones con estado "${STATUS_CONFIG[filter].label}".`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ink/8 border border-ink/10">
          {filtered.map(m => {
            const tipo = TIPO_CONFIG[m.tipo]
            const status = STATUS_CONFIG[m.status]
            const date = new Date(m.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={m.id} className="px-4 py-4 hover:bg-ink/[0.015] transition-colors">
                <div className="flex items-start gap-3">
                  {/* Tipo badge */}
                  <div className="pt-0.5 shrink-0">
                    <Badge bg={tipo.bg} color={tipo.color} label={tipo.label} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[12px] font-light text-ink leading-snug">{m.titulo}</p>
                    {m.descripcion && (
                      <p className="text-[11px] font-light text-meta/60 leading-relaxed">{m.descripcion}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                      <span className="text-[10px] font-light text-meta/40">{m.autor?.nombre ?? '—'}</span>
                      <span className="text-meta/20">·</span>
                      <span className="text-[10px] font-light text-meta/40">{date}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {canManage ? (
                      <select
                        value={m.status}
                        onChange={e => handleStatusChange(m.id, e.target.value as MejoraStatus)}
                        className="text-[9px] tracking-widest uppercase font-medium px-2 py-1 border border-ink/15 bg-white text-ink/70 hover:border-ink/30 focus:outline-none cursor-pointer"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {STATUS_ORDER.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge bg={status.bg} color={status.color} label={status.label} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Seed button (partner only, first time) ──────────────────────── */}
      {isPartner && mejoras.length === 0 && (
        <div className="text-center pt-4">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="text-[9px] tracking-widest uppercase font-light text-meta/40 hover:text-meta transition-colors disabled:opacity-40 border border-dashed border-ink/15 hover:border-ink/30 px-4 py-2"
          >
            {seeding ? 'Cargando…' : 'Cargar peticiones de las reuniones'}
          </button>
        </div>
      )}

      {/* ── Nueva petición modal ────────────────────────────────────────── */}
      {showForm && (
        <NuevaPeticionModal
          onClose={() => setShowForm(false)}
          onAdded={(m) => {
            setMejoras(prev => [m, ...prev])
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

// ── Nueva petición modal ──────────────────────────────────────────────────────

function NuevaPeticionModal({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: (m: Mejora) => void
}) {
  const [tipo, setTipo] = useState<MejoraTipo>('mejora')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    setSaving(true)
    const result = await addMejora({ tipo, titulo, descripcion: descripcion || undefined })
    setSaving(false)
    if ('error' in result) { alert(`Error: ${result.error}`); return }
    // Reload to get the full record with autor info
    window.location.reload()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
            <p className="text-[10px] tracking-widest uppercase font-light text-ink">Nueva petición</p>
            <button onClick={onClose} className="text-meta/40 hover:text-ink transition-colors text-lg leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            {/* Tipo toggle */}
            <div>
              <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 mb-2">Tipo</p>
              <div className="flex gap-2">
                {(['mejora', 'bug'] as const).map(t => {
                  const cfg = TIPO_CONFIG[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      className={`text-[9px] tracking-widest uppercase font-medium px-3 py-1.5 transition-colors border ${
                        tipo === t ? 'border-transparent' : 'border-ink/15 text-meta/50 bg-transparent hover:border-ink/30'
                      }`}
                      style={tipo === t ? { background: cfg.bg, color: cfg.color } : {}}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="text-[9px] tracking-widest uppercase font-light text-meta/50 block mb-1.5">
                Título <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Describe brevemente la mejora o el bug…"
                className="w-full text-[11px] font-light text-ink border border-ink/15 px-3 py-2 focus:outline-none focus:border-ink/40 bg-cream/30 placeholder:text-meta/30"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="text-[9px] tracking-widest uppercase font-light text-meta/50 block mb-1.5">
                Descripción <span className="text-meta/30">(opcional)</span>
              </label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Contexto adicional, pasos para reproducir el bug, etc."
                rows={4}
                className="w-full text-[11px] font-light text-ink border border-ink/15 px-3 py-2 focus:outline-none focus:border-ink/40 bg-cream/30 placeholder:text-meta/30 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-[9px] tracking-widest uppercase font-light text-meta/50 hover:text-ink transition-colors px-3 py-1.5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !titulo.trim()}
                className="text-[9px] tracking-widest uppercase font-medium px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-40"
              >
                {saving ? 'Enviando…' : 'Enviar petición'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

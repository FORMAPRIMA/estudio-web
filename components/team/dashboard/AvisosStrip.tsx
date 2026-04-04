'use client'

import { useState } from 'react'
import { addAviso, archivarAviso } from '@/app/actions/avisos'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NivelAviso = 'informativo' | 'recordatorio' | 'importante' | 'urgente'

export interface Aviso {
  id:              string
  tipo:            'equipo' | 'sistema' | 'personal'
  nivel:           NivelAviso
  titulo:          string
  contenido:       string | null
  fecha_activa:    string
  fecha_caducidad: string | null
  autor_nombre:    string | null
}

interface Props {
  avisos: Aviso[]
}

// ── Nivel config ──────────────────────────────────────────────────────────────

const NIVEL: Record<NivelAviso, {
  label:     string
  color:     string          // accent / text
  bgRgba:    string          // card tint
  barColor:  string          // left bar
  badgeBg:   string
  showBadge: boolean
}> = {
  informativo: {
    label:     'Informativo',
    color:     '#4B7FCC',
    bgRgba:    'rgba(75,127,204,0.03)',
    barColor:  '#4B7FCC',
    badgeBg:   'rgba(75,127,204,0.08)',
    showBadge: false,
  },
  recordatorio: {
    label:     'Recordatorio',
    color:     '#B45309',
    bgRgba:    'rgba(180,83,9,0.04)',
    barColor:  '#D97706',
    badgeBg:   'rgba(217,119,6,0.09)',
    showBadge: true,
  },
  importante: {
    label:     'Importante',
    color:     '#C2410C',
    bgRgba:    'rgba(194,65,12,0.05)',
    barColor:  '#EA580C',
    badgeBg:   'rgba(234,88,12,0.09)',
    showBadge: true,
  },
  urgente: {
    label:     'Urgente',
    color:     '#B91C1C',
    bgRgba:    'rgba(185,28,28,0.05)',
    barColor:  '#DC2626',
    badgeBg:   'rgba(220,38,38,0.09)',
    showBadge: true,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(nombre: string) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

// ── Single aviso card (full-width) ────────────────────────────────────────────

function AvisoCard({ aviso, onArchivar }: { aviso: Aviso; onArchivar: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = NIVEL[aviso.nivel] ?? NIVEL.informativo

  return (
    <div
      className="relative flex items-center gap-4 px-8 lg:px-14 py-4 border-b border-ink/[0.05] group transition-colors"
      style={{ background: cfg.bgRgba }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: cfg.barColor }}
      />

      {/* Author circle */}
      {aviso.autor_nombre ? (
        <div
          className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-semibold text-white select-none"
          style={{ background: cfg.barColor, opacity: 0.75 }}
          title={aviso.autor_nombre}
        >
          {initials(aviso.autor_nombre)}
        </div>
      ) : (
        /* System icon */
        <div
          className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px]"
          style={{ background: cfg.bgRgba, border: `1px solid ${cfg.barColor}33` }}
        >
          <span style={{ color: cfg.barColor }}>⚙</span>
        </div>
      )}

      {/* Title + expandable content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => aviso.contenido && setExpanded(v => !v)}
          className={`block w-full text-left ${aviso.contenido ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex items-center gap-2">
            {/* Pulsing dot for urgente */}
            {aviso.nivel === 'urgente' && (
              <span
                className="shrink-0 w-[7px] h-[7px] rounded-full animate-pulse"
                style={{ background: cfg.barColor }}
              />
            )}
            <p className="text-[13px] font-light text-ink/80 leading-snug truncate">
              {aviso.titulo}
            </p>
            {aviso.contenido && (
              <span
                className="shrink-0 text-[10px] transition-transform duration-150"
                style={{
                  color: 'rgba(0,0,0,0.2)',
                  transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              >
                ▾
              </span>
            )}
          </div>
          {expanded && aviso.contenido && (
            <p className="mt-1.5 text-[12px] font-light leading-relaxed text-ink/55">
              {aviso.contenido}
            </p>
          )}
        </button>
      </div>

      {/* Right metadata */}
      <div className="shrink-0 flex items-center gap-3">
        {/* Nivel badge */}
        {cfg.showBadge && (
          <span
            className="text-[8px] tracking-widest uppercase font-medium px-2 py-[3px]"
            style={{ color: cfg.color, background: cfg.badgeBg }}
          >
            {cfg.label}
          </span>
        )}

        {/* Author first name */}
        {aviso.autor_nombre && (
          <span className="hidden md:block text-[10px] font-light text-ink/30">
            {aviso.autor_nombre.split(' ')[0]}
          </span>
        )}

        {/* Caducidad */}
        {aviso.fecha_caducidad && (
          <span className="hidden sm:block text-[9px] text-ink/28">
            hasta {fmtDate(aviso.fecha_caducidad)}
          </span>
        )}
      </div>

      {/* Archive button */}
      <button
        onClick={onArchivar}
        title="Archivar"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-ink/20 hover:text-ink/55 hover:bg-ink/5 transition-colors text-base leading-none opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  )
}

// ── Add aviso modal ───────────────────────────────────────────────────────────

const NIVELES: NivelAviso[] = ['informativo', 'recordatorio', 'importante', 'urgente']

function AddAvisoModal({ onClose }: { onClose: () => void }) {
  const today = todayIso()
  const [titulo,         setTitulo]         = useState('')
  const [contenido,      setContenido]      = useState('')
  const [nivel,          setNivel]          = useState<NivelAviso>('informativo')
  const [fechaActiva,    setFechaActiva]    = useState(today)
  const [fechaCaducidad, setFechaCaducidad] = useState('')
  const [pending,        setPending]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || pending) return
    setPending(true)
    setError(null)
    const result = await addAviso({
      titulo,
      contenido:       contenido || undefined,
      nivel,
      fecha_activa:    fechaActiva,
      fecha_caducidad: fechaCaducidad || undefined,
    })
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.08]">
          <p className="text-[10px] tracking-widest uppercase font-medium text-ink/50">
            Notificación al equipo
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/30 hover:text-ink/60 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Nivel selector */}
          <div>
            <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-2.5">
              Nivel de importancia
            </label>
            <div className="grid grid-cols-4 gap-2">
              {NIVELES.map(n => {
                const cfg   = NIVEL[n]
                const active = nivel === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNivel(n)}
                    className="flex flex-col items-center gap-1.5 py-2.5 px-1 border transition-all duration-150"
                    style={{
                      borderColor: active ? cfg.barColor : 'rgba(0,0,0,0.1)',
                      background:  active ? cfg.bgRgba   : 'transparent',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: cfg.barColor, opacity: active ? 1 : 0.35 }}
                    />
                    <span
                      className="text-[8px] tracking-widest uppercase font-medium"
                      style={{ color: active ? cfg.color : 'rgba(0,0,0,0.3)' }}
                    >
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
              Mensaje <span className="text-ink/25">*</span>
            </label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              required
              autoFocus
              placeholder="Ej. Reunión de equipo el martes a las 10 h"
              className="w-full border border-ink/20 px-3 py-2.5 text-[13px] text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/50 transition-colors"
            />
          </div>

          {/* Contenido */}
          <div>
            <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
              Detalle <span className="text-ink/25">opcional</span>
            </label>
            <textarea
              value={contenido}
              onChange={e => setContenido(e.target.value)}
              rows={2}
              placeholder="Información adicional que aparece al expandir el aviso…"
              className="w-full border border-ink/20 px-3 py-2.5 text-[13px] text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/50 transition-colors resize-none"
            />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
                Activa desde
              </label>
              <input
                type="date"
                value={fechaActiva}
                onChange={e => setFechaActiva(e.target.value)}
                className="w-full border border-ink/20 px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
                Caduca <span className="text-ink/25">opcional</span>
              </label>
              <input
                type="date"
                value={fechaCaducidad}
                min={fechaActiva}
                onChange={e => setFechaCaducidad(e.target.value)}
                className="w-full border border-ink/20 px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink/50 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="text-[9px] tracking-widest uppercase font-medium text-ink/40 hover:text-ink/70 transition-colors px-3 py-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || !titulo.trim()}
            className="text-[9px] tracking-widest uppercase font-medium text-white bg-ink px-5 py-2.5 hover:bg-ink/80 transition-colors disabled:opacity-30"
          >
            {pending ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── AvisosStrip ───────────────────────────────────────────────────────────────

export default function AvisosStrip({ avisos }: Props) {
  const [hidden,   setHidden]   = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)

  const visible = avisos.filter(a => !hidden.has(a.id))

  const handleArchivar = (id: string) => {
    setHidden(prev => new Set([...Array.from(prev), id]))
    archivarAviso(id) // fire-and-forget
  }

  return (
    <>
      <div className="border-b border-ink/[0.06]">

        {/* Aviso cards — one per row, section grows naturally */}
        {visible.map(a => (
          <AvisoCard
            key={a.id}
            aviso={a}
            onArchivar={() => handleArchivar(a.id)}
          />
        ))}

        {/* Control bar — always visible, thinner when no avisos */}
        <div className="flex items-center gap-3 px-8 lg:px-14 py-[10px]">
          <span className="text-[9px] tracking-widest uppercase font-medium text-ink/28 select-none">
            Avisos
          </span>

          {visible.length === 0 && (
            <>
              <span className="w-px h-3 bg-ink/10 shrink-0" />
              <span className="text-[10px] text-ink/20 italic font-light">
                Sin avisos activos
              </span>
            </>
          )}

          <div className="flex-1" />

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-[9px] tracking-widest uppercase font-medium text-ink/35 hover:text-ink/65 transition-colors group"
          >
            <span className="w-[18px] h-[18px] border border-ink/15 group-hover:border-ink/35 flex items-center justify-center text-[14px] leading-none transition-colors">
              +
            </span>
            <span className="hidden sm:inline">Nueva notificación</span>
          </button>
        </div>
      </div>

      {showForm && <AddAvisoModal onClose={() => setShowForm(false)} />}
    </>
  )
}

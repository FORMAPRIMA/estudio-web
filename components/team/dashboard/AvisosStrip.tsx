'use client'

import { useState, useEffect, useRef } from 'react'
import { addAviso, archivarAviso } from '@/app/actions/avisos'

// Module-level: tracks which aviso IDs have already played their entrance animation
// this session. Resets on full page reload.
const animatedIds = new Set<string>()

const ATTENTION_CSS = `
@keyframes aviso-pop {
  0%   { transform: scaleX(1)     scaleY(1);     opacity: 0.8; }
  28%  { transform: scaleX(1.012) scaleY(1.022); opacity: 1;   box-shadow: 0 8px 28px rgba(0,0,0,0.09); }
  52%  { transform: scaleX(0.997) scaleY(0.997);               box-shadow: 0 3px 10px rgba(0,0,0,0.04); }
  72%  { transform: scaleX(1.005) scaleY(1.009);               box-shadow: 0 5px 16px rgba(0,0,0,0.06); }
  100% { transform: scaleX(1)     scaleY(1);     opacity: 1;   box-shadow: none; }
}
.aviso-pop {
  animation: aviso-pop 0.75s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}`

// ── Types ─────────────────────────────────────────────────────────────────────

export type NivelAviso = 'informativo' | 'recordatorio' | 'importante' | 'urgente'

export interface Aviso {
  id:              string
  tipo:            'equipo' | 'sistema' | 'personal'
  nivel:           NivelAviso
  titulo:          string
  contenido:       string | null
  fecha_activa:    string
  hora_activa:     string | null
  fecha_caducidad: string | null
  autor_nombre:    string | null
}

export interface FacturaPendiente {
  id:               string
  numero_completo:  string
  cliente_nombre:   string
  cliente_contacto: string | null
  cliente_email:    string | null
  cliente_email_cc: string | null
  proyecto_nombre:  string | null
  total:            number
  fecha_emision:    string
  dias_pendiente:   number
}

interface Props {
  avisos:             Aviso[]
  facturasPendientes?: FacturaPendiente[]
}

// ── Nivel config ──────────────────────────────────────────────────────────────

const NIVEL: Record<NivelAviso, {
  label:     string
  color:     string
  bgRgba:    string
  barColor:  string
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

function fmtEuros(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

// ── Single aviso card (full-width) ────────────────────────────────────────────

function AvisoCard({ aviso, onArchivar, isNew, animDelay }: {
  aviso: Aviso
  onArchivar: () => void
  isNew?: boolean
  animDelay?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = NIVEL[aviso.nivel] ?? NIVEL.informativo

  return (
    <div
      className={`relative flex items-center gap-4 px-8 lg:px-14 py-4 border-b border-ink/[0.05] group transition-colors${isNew ? ' aviso-pop' : ''}`}
      style={{
        background: cfg.bgRgba,
        ...(isNew && animDelay ? { animationDelay: `${animDelay}ms` } : {}),
      }}
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
        {cfg.showBadge && (
          <span
            className="text-[8px] tracking-widest uppercase font-medium px-2 py-[3px]"
            style={{ color: cfg.color, background: cfg.badgeBg }}
          >
            {cfg.label}
          </span>
        )}

        {aviso.autor_nombre && (
          <span className="hidden md:block text-[10px] font-light text-ink/30">
            {aviso.autor_nombre.split(' ')[0]}
          </span>
        )}

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

// ── Follow-up reminder modal ──────────────────────────────────────────────────

function RecordatorioModal({
  factura,
  onClose,
  onSent,
}: {
  factura:  FacturaPendiente
  onClose:  () => void
  onSent:   () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSend = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/facturas-emitidas/${factura.id}/recordatorio`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al enviar.'); setLoading(false); return }
      onSent()
    } catch {
      setError('Error de red.')
      setLoading(false)
    }
  }

  const recipientName = factura.cliente_contacto || factura.cliente_nombre

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.08]">
          <p className="text-[10px] tracking-widest uppercase font-medium text-ink/50">
            Recordatorio de pago
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/30 hover:text-ink/60 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Invoice summary */}
          <div className="bg-ink/[0.02] border border-ink/[0.07] px-4 py-3 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-ink/70">{factura.numero_completo}</span>
              <span className="text-[13px] font-light text-ink">{fmtEuros(factura.total)}</span>
            </div>
            {factura.proyecto_nombre && (
              <p className="text-[11px] text-ink/45 font-light">{factura.proyecto_nombre}</p>
            )}
            <p className="text-[10px] text-amber-700 font-medium">
              Pendiente desde {fmtDate(factura.fecha_emision)} · {factura.dias_pendiente} días
            </p>
          </div>

          {/* Recipient */}
          <div>
            <p className="text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">Destinatario</p>
            <p className="text-[13px] text-ink font-light">{recipientName}</p>
            {factura.cliente_email ? (
              <p className="text-[11px] text-ink/45 mt-0.5">{factura.cliente_email}</p>
            ) : (
              <p className="text-[11px] text-red-500 mt-0.5">Sin email registrado</p>
            )}
            {factura.cliente_email_cc && (
              <p className="text-[10px] text-ink/35 mt-0.5">CC: {factura.cliente_email_cc}</p>
            )}
          </div>

          {/* Email preview hint */}
          <p className="text-[11px] text-ink/40 font-light leading-relaxed">
            Se enviará un correo cordial recordando el pago de la factura
            {factura.proyecto_nombre ? ` del proyecto ${factura.proyecto_nombre}` : ''}.
          </p>

          {error && <p className="text-[11px] text-red-500">{error}</p>}
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
            type="button"
            onClick={handleSend}
            disabled={loading || !factura.cliente_email}
            className="text-[9px] tracking-widest uppercase font-medium text-white bg-ink px-5 py-2.5 hover:bg-ink/80 transition-colors disabled:opacity-30"
          >
            {loading ? 'Enviando…' : 'Enviar recordatorio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Factura pendiente card ────────────────────────────────────────────────────

function FacturaPendienteCard({
  factura,
  onDismiss,
}: {
  factura:   FacturaPendiente
  onDismiss: () => void
}) {
  const [showModal,  setShowModal]  = useState(false)
  const [sent,       setSent]       = useState(false)

  const isUrgent = factura.dias_pendiente >= 30
  const barColor  = isUrgent ? '#DC2626' : '#D97706'
  const bgRgba    = isUrgent ? 'rgba(220,38,38,0.04)' : 'rgba(217,119,6,0.04)'
  const badgeColor = isUrgent ? '#B91C1C' : '#B45309'
  const badgeBg    = isUrgent ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)'

  return (
    <>
      <div
        className="relative flex items-center gap-4 px-8 lg:px-14 py-4 border-b border-ink/[0.05] group transition-colors"
        style={{ background: bgRgba }}
      >
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: barColor }} />

        {/* Icon */}
        <div
          className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px]"
          style={{ background: bgRgba, border: `1px solid ${barColor}44` }}
        >
          <span style={{ color: barColor }}>€</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-light text-ink/80 leading-snug truncate">
            {factura.numero_completo}
            {' · '}
            <span className="font-normal">{fmtEuros(factura.total)}</span>
            {' — '}
            {factura.cliente_contacto || factura.cliente_nombre}
          </p>
          {factura.proyecto_nombre && (
            <p className="text-[10px] text-ink/40 font-light mt-0.5 truncate">{factura.proyecto_nombre}</p>
          )}
        </div>

        {/* Right: days badge + send button */}
        <div className="shrink-0 flex items-center gap-3">
          <span
            className="text-[8px] tracking-widest uppercase font-medium px-2 py-[3px]"
            style={{ color: badgeColor, background: badgeBg }}
          >
            {factura.dias_pendiente}d pendiente
          </span>

          {sent ? (
            <span className="text-[9px] tracking-widest uppercase font-medium text-green-600">
              ✓ Enviado
            </span>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="text-[9px] tracking-widest uppercase font-medium px-3 py-1.5 border transition-colors"
              style={{ borderColor: barColor + '55', color: barColor }}
            >
              Recordatorio
            </button>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          title="Ignorar esta sesión"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-ink/20 hover:text-ink/55 hover:bg-ink/5 transition-colors text-base leading-none opacity-0 group-hover:opacity-100"
        >
          ×
        </button>
      </div>

      {showModal && (
        <RecordatorioModal
          factura={factura}
          onClose={() => setShowModal(false)}
          onSent={() => { setShowModal(false); setSent(true) }}
        />
      )}
    </>
  )
}

// ── Add aviso modal ───────────────────────────────────────────────────────────

const NIVELES: NivelAviso[] = ['informativo', 'recordatorio', 'importante', 'urgente']

function AddAvisoModal({ onClose }: { onClose: () => void }) {
  const today = todayIso()
  const [scope,          setScope]          = useState<'equipo' | 'personal'>('equipo')
  const [titulo,         setTitulo]         = useState('')
  const [contenido,      setContenido]      = useState('')
  const [nivel,          setNivel]          = useState<NivelAviso>('informativo')
  const [fechaActiva,    setFechaActiva]    = useState(today)
  const [horaActiva,     setHoraActiva]     = useState('')
  const [fechaCaducidad, setFechaCaducidad] = useState('')
  const [pending,        setPending]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const isPersonal = scope === 'personal'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || pending) return
    setPending(true)
    setError(null)
    const result = await addAviso({
      titulo,
      contenido:       contenido || undefined,
      nivel:           isPersonal ? 'recordatorio' : nivel,
      tipo:            scope,
      hora_activa:     isPersonal && horaActiva ? horaActiva : null,
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
            {isPersonal ? 'Recordatorio personal' : 'Notificación al equipo'}
          </p>
          <button type="button" onClick={onClose}
            className="text-ink/30 hover:text-ink/60 transition-colors text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Scope toggle */}
          <div className="grid grid-cols-2 gap-0 border border-ink/15 overflow-hidden">
            {(['equipo', 'personal'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className="py-2.5 text-[10px] tracking-widest uppercase font-medium transition-colors"
                style={{
                  background: scope === s ? '#1A1A1A' : 'transparent',
                  color:      scope === s ? '#F2F2F0' : 'rgba(0,0,0,0.35)',
                }}
              >
                {s === 'equipo' ? '↑ Para el equipo' : '⏰ Solo para mí'}
              </button>
            ))}
          </div>

          {/* Nivel selector — only for team */}
          {!isPersonal && (
            <div>
              <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-2.5">
                Nivel de importancia
              </label>
              <div className="grid grid-cols-4 gap-2">
                {NIVELES.map(n => {
                  const cfg    = NIVEL[n]
                  const active = nivel === n
                  return (
                    <button key={n} type="button" onClick={() => setNivel(n)}
                      className="flex flex-col items-center gap-1.5 py-2.5 px-1 border transition-all duration-150"
                      style={{
                        borderColor: active ? cfg.barColor : 'rgba(0,0,0,0.1)',
                        background:  active ? cfg.bgRgba   : 'transparent',
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full"
                        style={{ background: cfg.barColor, opacity: active ? 1 : 0.35 }} />
                      <span className="text-[8px] tracking-widest uppercase font-medium"
                        style={{ color: active ? cfg.color : 'rgba(0,0,0,0.3)' }}>
                        {cfg.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
              {isPersonal ? 'Recordatorio' : 'Mensaje'} <span className="text-ink/25">*</span>
            </label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              required
              autoFocus
              placeholder={isPersonal ? 'Ej. Llamar a proveedor sobre entrega' : 'Ej. Reunión de equipo el martes a las 10 h'}
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
              placeholder="Notas adicionales que aparecen al expandir…"
              className="w-full border border-ink/20 px-3 py-2.5 text-[13px] text-ink placeholder:text-ink/25 focus:outline-none focus:border-ink/50 transition-colors resize-none"
            />
          </div>

          {/* Fechas — date + optional time for personal, date + expiry for team */}
          <div className="grid gap-3" style={{ gridTemplateColumns: isPersonal ? '1fr 1fr' : '1fr 1fr' }}>
            <div>
              <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
                {isPersonal ? 'Día' : 'Activa desde'}
              </label>
              <input type="date" value={fechaActiva} onChange={e => setFechaActiva(e.target.value)}
                className="w-full border border-ink/20 px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink/50 transition-colors" />
            </div>
            {isPersonal ? (
              <div>
                <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
                  Hora <span className="text-ink/25">opcional</span>
                </label>
                <input type="time" value={horaActiva} onChange={e => setHoraActiva(e.target.value)}
                  className="w-full border border-ink/20 px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink/50 transition-colors" />
              </div>
            ) : (
              <div>
                <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
                  Caduca <span className="text-ink/25">opcional</span>
                </label>
                <input type="date" value={fechaCaducidad} min={fechaActiva}
                  onChange={e => setFechaCaducidad(e.target.value)}
                  className="w-full border border-ink/20 px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink/50 transition-colors" />
              </div>
            )}
          </div>

          {/* Expiry for personal too */}
          {isPersonal && (
            <div>
              <label className="block text-[9px] tracking-widest uppercase text-ink/40 mb-1.5">
                Archivar automáticamente <span className="text-ink/25">opcional</span>
              </label>
              <input type="date" value={fechaCaducidad} min={fechaActiva}
                onChange={e => setFechaCaducidad(e.target.value)}
                className="w-full border border-ink/20 px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink/50 transition-colors" />
            </div>
          )}

          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink/[0.08]">
          <button type="button" onClick={onClose}
            className="text-[9px] tracking-widest uppercase font-medium text-ink/40 hover:text-ink/70 transition-colors px-3 py-2">
            Cancelar
          </button>
          <button type="submit" disabled={pending || !titulo.trim()}
            className="text-[9px] tracking-widest uppercase font-medium text-white bg-ink px-5 py-2.5 hover:bg-ink/80 transition-colors disabled:opacity-30">
            {pending ? 'Guardando…' : isPersonal ? 'Crear recordatorio' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── AvisosStrip ───────────────────────────────────────────────────────────────

export default function AvisosStrip({ avisos, facturasPendientes = [] }: Props) {
  const [hidden,           setHidden]           = useState<Set<string>>(new Set())
  const [hiddenFacturas,   setHiddenFacturas]   = useState<Set<string>>(new Set())
  const [showForm,         setShowForm]         = useState(false)

  // Determine which avisos are "new" this session and compute their stagger delays
  const newAvisoData = useRef<Map<string, number>>((() => {
    const map = new Map<string, number>()
    let delay = 80
    for (const a of avisos) {
      if (!animatedIds.has(a.id)) {
        map.set(a.id, delay)
        delay += 180
        animatedIds.add(a.id)
      }
    }
    return map
  })())

  const visible         = avisos.filter(a => !hidden.has(a.id))
  const visibleFacturas = facturasPendientes.filter(f => !hiddenFacturas.has(f.id))

  const handleArchivar = (id: string) => {
    setHidden(prev => new Set([...Array.from(prev), id]))
    archivarAviso(id)
  }

  const handleDismissFactura = (id: string) => {
    setHiddenFacturas(prev => new Set([...Array.from(prev), id]))
  }

  const hasContent = visible.length > 0 || visibleFacturas.length > 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ATTENTION_CSS }} />
      <div className="border-b border-ink/[0.06]">

        {/* Factura pendiente cards — shown before regular avisos */}
        {visibleFacturas.map(f => (
          <FacturaPendienteCard
            key={f.id}
            factura={f}
            onDismiss={() => handleDismissFactura(f.id)}
          />
        ))}

        {/* Regular aviso cards */}
        {visible.map(a => (
          <AvisoCard
            key={a.id}
            aviso={a}
            onArchivar={() => handleArchivar(a.id)}
            isNew={newAvisoData.current.has(a.id)}
            animDelay={newAvisoData.current.get(a.id)}
          />
        ))}

        {/* Control bar */}
        <div className="flex items-center gap-3 px-8 lg:px-14 py-[10px]">
          <span className="text-[9px] tracking-widest uppercase font-medium text-ink/28 select-none">
            Avisos
          </span>

          {!hasContent && (
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

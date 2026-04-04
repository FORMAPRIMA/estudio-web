'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export interface DashboardProyecto {
  id: string
  nombre: string
  codigo: string | null
  direccion: string | null
  imagen_url: string | null
  superficie_diseno: number | null
  status: string
  fases: { id: string; numero: number }[]
  progress: number
  horasObjetivo: number
  horasIniciadas: number
}

const STATUS_OPTIONS = [
  { value: 'activo',    label: 'Activos' },
  { value: 'on_hold',  label: 'On Hold' },
  { value: 'terminado', label: 'Terminados' },
]

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function ProyectoCard({ proyecto }: { proyecto: DashboardProyecto }) {
  return (
    <Link
      href={`/team/proyectos/${proyecto.id}`}
      className="block border border-ink/10 hover:border-ink/30 transition-colors bg-white group shrink-0 w-64"
    >
      {/* Image */}
      <div className="w-full h-32 bg-ink/5 overflow-hidden flex items-center justify-center relative">
        {proyecto.imagen_url ? (
          <img
            src={proyecto.imagen_url}
            alt={proyecto.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span className="text-2xl font-light text-ink/20 tracking-wider">
            {getInitials(proyecto.nombre)}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        <h3 className="text-sm font-light text-ink leading-snug">{proyecto.nombre}</h3>

        {proyecto.direccion && (
          <p className="text-[10px] text-meta font-light leading-snug">{proyecto.direccion}</p>
        )}

        {proyecto.superficie_diseno && (
          <p className="text-[10px] text-meta font-light">
            {proyecto.superficie_diseno.toLocaleString('es-MX')} m² diseño
          </p>
        )}

        {proyecto.fases.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {proyecto.fases.map(f => (
              <span
                key={f.id}
                className="text-[9px] tracking-widest uppercase font-light px-1.5 py-0.5 border border-ink/15 text-meta"
              >
                F{f.numero}
              </span>
            ))}
          </div>
        )}

        <div className="pt-2 space-y-1.5">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[2px] bg-ink/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink/40 rounded-full transition-all duration-500"
                style={{ width: `${proyecto.progress}%` }}
              />
            </div>
            <span className="text-[9px] font-light text-ink tabular-nums shrink-0">{proyecto.progress}%</span>
          </div>

          {/* Hours */}
          {proyecto.horasIniciadas > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-light text-meta/40">Iniciadas</span>
              <p className="text-[10px] font-light tabular-nums">
                <span className="text-meta/50">0 hrs.</span>
                <span className="text-meta/30 mx-1">/</span>
                <span className="text-ink">{Math.round(proyecto.horasIniciadas * 10) / 10} hrs.</span>
              </p>
            </div>
          )}
          {proyecto.horasObjetivo > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-light text-meta/40">Total</span>
              <p className="text-[10px] font-light tabular-nums">
                <span className="text-meta/50">0 hrs.</span>
                <span className="text-meta/30 mx-1">/</span>
                <span className="text-ink">{Math.round(proyecto.horasObjetivo * 10) / 10} hrs.</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

interface Props {
  proyectos: DashboardProyecto[]
}

export default function ProyectosCarrusel({ proyectos }: Props) {
  const [activeStatuses, setActiveStatuses] = useState<string[]>(['activo'])

  const toggle = (status: string) =>
    setActiveStatuses(prev =>
      prev.includes(status)
        ? prev.length === 1 ? prev // keep at least one selected
          : prev.filter(s => s !== status)
        : [...prev, status]
    )

  const visible = useMemo(
    () => proyectos.filter(p => activeStatuses.includes(p.status)),
    [proyectos, activeStatuses]
  )

  // Only show status toggles for statuses that actually have projects
  const availableStatuses = STATUS_OPTIONS.filter(opt =>
    proyectos.some(p => p.status === opt.value)
  )

  return (
    <div>
      {/* Header + filter */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-[11px] tracking-widest uppercase font-medium text-ink/60">
          Mis proyectos
        </p>
        <div className="flex items-center gap-1.5">
          {availableStatuses.map(opt => {
            const active = activeStatuses.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={`text-[9px] tracking-wider uppercase font-medium px-2.5 py-1 border transition-colors ${
                  active
                    ? 'bg-ink text-cream border-ink'
                    : 'border-ink/20 text-ink/50 hover:border-ink/40 hover:text-ink/70'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Carousel */}
      {visible.length === 0 ? (
        <p className="text-sm text-ink/40 font-light py-6">Sin proyectos para el filtro seleccionado.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 -mb-2">
          {visible.map(p => (
            <ProyectoCard key={p.id} proyecto={p} />
          ))}
        </div>
      )}
    </div>
  )
}

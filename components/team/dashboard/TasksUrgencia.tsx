'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { updateTaskStatus } from '@/app/actions/tasks'
import type { TaskStatus } from '@/lib/types'

export interface DashboardTask {
  id: string
  codigo: string
  titulo: string
  status: string
  prioridad: number
  orden_urgencia: number
  urgency_score: number
  proyecto_id: string
  proyecto_nombre: string
  proyecto_codigo: string | null
  proyecto_status: string
  fase_label: string
  fase_numero: number
  responsables: { id: string; nombre: string; initials: string; avatar_url?: string | null }[]
  fecha_limite: string | null
}

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  pendiente:   { label: 'Pendiente',   dot: 'bg-ink/30',    badge: 'text-ink/60 bg-ink/8 border border-ink/15' },
  en_progreso: { label: 'En progreso', dot: 'bg-blue-500',  badge: 'text-blue-700 bg-blue-100 border border-blue-200' },
  bloqueado:   { label: 'Bloqueado',   dot: 'bg-red-500',   badge: 'text-red-600 bg-red-100 border border-red-200' },
  completado:  { label: 'Completado',  dot: 'bg-green-500', badge: 'text-green-700 bg-green-100 border border-green-200' },
}

const PRIORIDAD_META: Record<number, { label: string; color: string }> = {
  0: { label: 'Normal',  color: 'text-ink/30' },
  1: { label: 'Media',   color: 'text-amber-600' },
  2: { label: 'Alta',    color: 'text-orange-600' },
  3: { label: 'Crítica', color: 'text-red-600 font-semibold' },
}

const STATUS_OPTIONS = [
  { value: 'pendiente',   label: 'Pendiente' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'bloqueado',   label: 'Bloqueado' },
  { value: 'completado',  label: 'Completado' },
]

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, avatarUrl }: { nombre: string; avatarUrl?: string | null }) {
  const parts = nombre.trim().split(/\s+/)
  const init = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : nombre.slice(0, 2).toUpperCase()
  return (
    <div
      title={nombre}
      className="w-7 h-7 rounded-full overflow-hidden border-2 border-cream shrink-0 bg-ink/10"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={nombre} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-ink/15 flex items-center justify-center">
          <span className="text-[9px] font-semibold text-ink/60 leading-none">{init}</span>
        </div>
      )}
    </div>
  )
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (vals: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])

  const summary =
    selected.length === 0 || selected.length === options.length
      ? 'Todos'
      : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selec.`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-[9px] tracking-wider uppercase font-medium px-3 py-1.5 border border-ink/20 text-ink/60 hover:border-ink/40 hover:text-ink/80 transition-colors bg-white"
      >
        <span className="text-ink/35">{label}</span>
        <span className={selected.length > 0 && selected.length < options.length ? 'text-ink' : ''}>
          {summary}
        </span>
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-ink/15 shadow-md z-30 min-w-[170px]">
          {options.map(opt => {
            const checked = selected.includes(opt.value)
            const sm = STATUS_META[opt.value]
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-ink/[0.04] transition-colors text-left"
              >
                {/* Custom checkbox */}
                <div className={`w-3.5 h-3.5 border shrink-0 flex items-center justify-center transition-colors ${
                  checked ? 'bg-ink border-ink' : 'border-ink/30'
                }`}>
                  {checked && (
                    <svg className="w-2 h-2 text-cream" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {sm && <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />}
                <span className="text-[10px] tracking-wider uppercase font-medium text-ink/70">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Inline status editor (portal-based) ──────────────────────────────────────

function StatusBadge({
  task,
  onUpdate,
}: {
  task: DashboardTask
  onUpdate: (id: string, status: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const sm = STATUS_META[task.status] ?? STATUS_META.pendiente

  useEffect(() => { setMounted(true) }, [])

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  const handleSelect = (e: React.MouseEvent, status: string) => {
    e.preventDefault()
    e.stopPropagation()
    onUpdate(task.id, status as TaskStatus)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`text-[9px] tracking-wider uppercase font-medium px-2.5 py-1 shrink-0 rounded-sm cursor-pointer hover:opacity-75 transition-opacity ${sm.badge}`}
      >
        {sm.label}
      </button>

      {mounted && open && rect && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
          />
          <div
            className="fixed z-50 bg-white border border-ink/15 shadow-lg min-w-[150px]"
            style={{ top: rect.bottom + 4, left: rect.left }}
          >
            {STATUS_OPTIONS.map(opt => {
              const meta = STATUS_META[opt.value]
              const active = task.status === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={(e) => handleSelect(e, opt.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink/[0.04] transition-colors text-left ${active ? 'bg-ink/[0.04]' : ''}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  <span className="text-[10px] tracking-wider uppercase font-medium text-ink/70">{opt.label}</span>
                  {active && (
                    <svg className="w-2.5 h-2.5 text-ink/40 ml-auto" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  tasks: DashboardTask[]
}

export default function TasksUrgencia({ tasks: initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)

  // Default: show only pendiente + en_progreso
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['pendiente', 'en_progreso'])
  const [filterProyectos, setFilterProyectos] = useState<string[]>([])
  const [filterFases, setFilterFases] = useState<string[]>([])
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  // Unique project options (exclude archivado projects)
  const proyectoOptions = useMemo(() => {
    const seen = new Set<string>()
    return tasks
      .filter(t => t.proyecto_status !== 'archivado')
      .map(t => ({ value: t.proyecto_codigo ?? t.proyecto_nombre, label: t.proyecto_codigo ?? t.proyecto_nombre }))
      .filter(p => { if (seen.has(p.value)) return false; seen.add(p.value); return true })
  }, [tasks])

  // Unique fase options
  const faseOptions = useMemo(() => {
    const seen = new Set<string>()
    return tasks
      .map(t => ({ value: `F${t.fase_numero}`, label: `F${t.fase_numero} · ${t.fase_label}` }))
      .filter(f => { if (seen.has(f.value)) return false; seen.add(f.value); return true })
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [tasks])

  const filtered = useMemo(() => {
    let result = tasks
      // Never show archived project tasks
      .filter(t => t.proyecto_status !== 'archivado')
      // Status filter
      .filter(t => filterStatuses.length === 0 || filterStatuses.includes(t.status))
      // Project filter
      .filter(t => filterProyectos.length === 0 || filterProyectos.includes(t.proyecto_codigo ?? t.proyecto_nombre))
      // Fase filter
      .filter(t => filterFases.length === 0 || filterFases.includes(`F${t.fase_numero}`))

    result = [...result].sort((a, b) =>
      sortDir === 'desc'
        ? b.urgency_score - a.urgency_score
        : a.urgency_score - b.urgency_score
    )

    return result
  }, [tasks, filterStatuses, filterProyectos, filterFases, sortDir])

  const handleStatusUpdate = (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    updateTaskStatus(id, status)
  }

  if (tasks.filter(t => t.proyecto_status !== 'archivado').length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <p className="text-[10px] tracking-widest uppercase font-medium text-meta/60 mb-2">Sin pendientes</p>
        <p className="text-sm text-ink/50">No tienes tasks asignados por ahora.</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-ink/10 bg-ink/[0.02]">
        <MultiSelectDropdown
          label="Estado"
          options={STATUS_OPTIONS}
          selected={filterStatuses}
          onChange={setFilterStatuses}
        />
        {proyectoOptions.length > 1 && (
          <MultiSelectDropdown
            label="Proyecto"
            options={proyectoOptions}
            selected={filterProyectos}
            onChange={setFilterProyectos}
          />
        )}
        {faseOptions.length > 1 && (
          <MultiSelectDropdown
            label="Fase"
            options={faseOptions}
            selected={filterFases}
            onChange={setFilterFases}
          />
        )}

        {/* Sort toggle */}
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="ml-auto flex items-center gap-1.5 text-[9px] tracking-wider uppercase font-medium px-3 py-1.5 border border-ink/20 text-ink/60 hover:border-ink/40 hover:text-ink/80 transition-colors"
        >
          {sortDir === 'desc' ? '↓' : '↑'}
          <span>Urgencia</span>
        </button>
      </div>

      {/* ── Task list ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-ink/40">Sin resultados para este filtro.</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[432px] divide-y divide-ink/10">
          {filtered.map((task, i) => {
            const pm = PRIORIDAD_META[task.prioridad] ?? PRIORIDAD_META[0]
            const raw = task.proyecto_codigo ?? task.proyecto_nombre.slice(0, 6).toUpperCase()
            const lettersMatch = raw.match(/^([A-Z]+)/)
            const letters = lettersMatch ? lettersMatch[1] : raw
            const rest = raw.slice(letters.length).replace(/^[-_]/, '')

            return (
              <div
                key={task.id}
                className="flex items-stretch group hover:bg-ink/[0.03] transition-colors"
              >
                {/* ── Project code strip ──────────────────────────── */}
                <div
                  className="w-14 shrink-0 bg-ink/[0.06] flex items-center justify-center border-r border-ink/10 gap-0.5"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  <span className="text-xs tracking-widest font-bold text-ink/60 select-none leading-none">
                    {letters}
                  </span>
                  {rest && (
                    <span className="text-xs tracking-widest font-semibold text-ink/40 select-none leading-none">
                      {rest}
                    </span>
                  )}
                </div>

                {/* ── Clickable area ──────────────────────────────── */}
                <Link
                  href={`/team/proyectos/${task.proyecto_id}`}
                  className="flex-1 flex items-center gap-5 px-5 py-4 min-w-0"
                >
                  <span className="text-xs font-medium text-ink/30 tabular-nums w-4 shrink-0">
                    {i + 1}
                  </span>

                  <span className="text-[10px] tracking-wider font-medium text-ink/50 shrink-0 hidden sm:block w-28 truncate">
                    {task.codigo}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-normal text-ink leading-snug truncate group-hover:text-ink/70 transition-colors">
                      {task.titulo}
                    </p>
                    <p className="text-[10px] tracking-wider uppercase font-medium text-meta/60 mt-0.5">
                      F{task.fase_numero} · {task.fase_label}
                    </p>
                  </div>

                  {/* Responsables with photos */}
                  <div className="flex items-center -space-x-2 shrink-0">
                    {task.responsables.slice(0, 5).map(r => (
                      <Avatar key={r.id} nombre={r.nombre} avatarUrl={r.avatar_url} />
                    ))}
                    {task.responsables.length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-ink/15 border-2 border-cream flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-semibold text-ink/60">+{task.responsables.length - 5}</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* ── Non-clickable right section ─────────────────── */}
                <div className="flex items-center gap-3 pr-5 shrink-0">
                  {task.fecha_limite && (
                    <span className="text-[9px] tabular-nums text-ink/40 shrink-0 hidden md:block">
                      {fmtDate(task.fecha_limite)}
                    </span>
                  )}
                  <StatusBadge task={task} onUpdate={handleStatusUpdate} />
                  <span className={`text-[9px] tracking-wider uppercase w-14 text-right shrink-0 ${task.prioridad > 0 ? pm.color : 'text-transparent select-none'}`}>
                    {task.prioridad > 0 ? pm.label : '·'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

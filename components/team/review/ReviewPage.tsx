'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { updateTaskStatus, updateTaskResponsables } from '@/app/actions/tasks'

// ── Types ──────────────────────────────────────────────────────────────────

interface Proyecto {
  id: string
  nombre: string
  codigo: string | null
  imagen_url: string | null
  status: string
}

interface Task {
  id: string
  codigo: string
  titulo: string
  proyecto_id: string
  fase_id: string
  responsable_ids: string[]
  status: 'pendiente' | 'en_progreso' | 'completado' | 'bloqueado'
  orden_urgencia: number
  prioridad: number
  created_at: string
  fecha_limite: string | null
  catalogo_fases?: { numero: number; label: string; seccion: string } | null
}

interface Member {
  id: string
  nombre: string
  apellido: string | null
  avatar_url: string | null
  rol: string
}

interface Props {
  proyectos: Proyecto[]
  tasks: Task[]
  members: Member[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pendiente:   '#C8C5BE',
  en_progreso: '#378ADD',
  completado:  '#1D9E75',
  bloqueado:   '#D85A30',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente:   'Pendiente',
  en_progreso: 'En curso',
  completado:  'Completado',
  bloqueado:   'Bloqueado',
}

const STATUS_CYCLE: Task['status'][] = ['pendiente', 'en_progreso', 'completado', 'bloqueado']
const SECTION_BG: Record<string, string> = {
  'Anteproyecto':           '#EAF3DE',
  'Proyecto de ejecución':  '#FBEAF0',
  'Obra':                   '#E1F5EE',
  'Interiorismo':           '#E6F1FB',
  'Post venta':             '#FAEEDA',
}
const SECTION_TC: Record<string, string> = {
  'Anteproyecto':           '#27500A',
  'Proyecto de ejecución':  '#4B1528',
  'Obra':                   '#085041',
  'Interiorismo':           '#042C53',
  'Post venta':             '#633806',
}

const AVATAR_COLORS = ['#D85A30','#E8913A','#C9A227','#E6B820','#B8860B','#D4622A','#F0A500','#C07020']

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const mkInitials = (nombre: string, apellido?: string | null) => {
  const f = nombre.trim()[0]?.toUpperCase() ?? ''
  const l = (apellido ?? '').trim()[0]?.toUpperCase() ?? ''
  return f + l || f
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MemberAvatar({ member, size = 22, idx }: { member: Member; size?: number; idx: number }) {
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', border: '1.5px solid #fff',
    }}>
      {member.avatar_url
        ? <img src={member.avatar_url} alt={member.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 700 }}>{mkInitials(member.nombre, member.apellido)}</span>
      }
    </div>
  )
}

function FaseBadge({ fase }: { fase?: { numero: number; label: string; seccion: string } | null }) {
  if (!fase) return null
  const bg = SECTION_BG[fase.seccion] ?? '#F1EFE8'
  const tc = SECTION_TC[fase.seccion] ?? '#666'
  const clean = fase.label.replace(/^FASE\s*\d+\s*[–\-]\s*/i, '').trim()
  return (
    <span style={{
      fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 3,
      background: bg, color: tc, whiteSpace: 'nowrap', letterSpacing: '0.02em',
      border: `1px solid ${tc}22`,
    }}>
      F{fase.numero} · {clean.length > 18 ? clean.slice(0, 17) + '…' : clean}
    </span>
  )
}

// ── Responsable Picker ─────────────────────────────────────────────────────

function ResponsablePicker({
  taskId, proyectoId, currentIds, members, allMembers,
  onUpdate, onClose, anchorRef,
}: {
  taskId: string
  proyectoId: string
  currentIds: string[]
  members: Member[]
  allMembers: Member[]
  onUpdate: (ids: string[]) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLDivElement | null>
}) {
  const [selected, setSelected] = useState<string[]>(currentIds)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const save = () => {
    startTransition(async () => {
      await updateTaskResponsables(taskId, selected, proyectoId)
      onUpdate(selected)
      onClose()
    })
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4,
      background: '#fff', border: '1px solid #E0DED8', borderRadius: 6,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
      minWidth: 200, padding: '8px 0',
    }}>
      <div style={{ padding: '4px 12px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', borderBottom: '1px solid #F0EEE8' }}>
        Responsables
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {allMembers.map((m, idx) => {
          const isChecked = selected.includes(m.id)
          return (
            <div
              key={m.id}
              onClick={() => toggle(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px', cursor: 'pointer',
                background: isChecked ? '#F8F6F1' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!isChecked) (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8' }}
              onMouseLeave={(e) => { if (!isChecked) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <MemberAvatar member={m} size={22} idx={idx} />
              <span style={{ fontSize: 12, color: '#333', flex: 1 }}>
                {m.nombre}{m.apellido ? ` ${m.apellido[0]}.` : ''}
              </span>
              {isChecked && <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 700 }}>✓</span>}
            </div>
          )
        })}
      </div>
      <div style={{ padding: '8px 12px 4px', borderTop: '1px solid #F0EEE8' }}>
        <button
          onClick={save}
          disabled={isPending}
          style={{
            width: '100%', background: '#222', color: '#fff', border: 'none',
            borderRadius: 4, padding: '6px 0', fontSize: 11, cursor: 'pointer',
            fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Task Row ───────────────────────────────────────────────────────────────

function StatusDropdown({ task, proyectoId, onStatusChange }: {
  task: Task
  proyectoId: string
  onStatusChange: (id: string, status: Task['status']) => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (status: Task['status']) => {
    setOpen(false)
    startTransition(async () => {
      await updateTaskStatus(task.id, status, proyectoId)
      onStatusChange(task.id, status)
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, marginTop: 3 }}>
      <button
        onClick={() => setOpen((s) => !s)}
        title="Cambiar estado"
        style={{
          width: 12, height: 12, borderRadius: '50%', padding: 0, border: 'none',
          background: STATUS_COLORS[task.status] ?? '#ccc',
          cursor: 'pointer', opacity: isPending ? 0.4 : 1,
          transition: 'transform 0.1s, opacity 0.15s',
          outline: open ? `2px solid ${STATUS_COLORS[task.status]}44` : 'none',
          outlineOffset: 2,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.3)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          background: '#fff', border: '1px solid #E0DED8', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 60,
          minWidth: 150, padding: '4px 0', overflow: 'hidden',
        }}>
          {STATUS_CYCLE.map((s) => (
            <div
              key={s}
              onClick={() => select(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 12px', cursor: 'pointer',
                background: task.status === s ? '#F8F6F1' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (task.status !== s) (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8' }}
              onMouseLeave={(e) => { if (task.status !== s) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[s], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#333', fontWeight: task.status === s ? 600 : 400 }}>
                {STATUS_LABELS[s]}
              </span>
              {task.status === s && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#AAA' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({
  task, allMembers, memberMap, proyectoId, onStatusChange, onResponsableChange, completed,
}: {
  task: Task
  allMembers: Member[]
  memberMap: Map<string, Member>
  proyectoId: string
  onStatusChange: (id: string, status: Task['status']) => void
  onResponsableChange: (id: string, ids: string[]) => void
  completed?: boolean
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [isPending] = useTransition()
  const anchorRef = useRef<HTMLDivElement>(null)

  const responsables = task.responsable_ids
    .map((id) => memberMap.get(id))
    .filter(Boolean) as Member[]

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid #F5F3EE',
      opacity: isPending ? 0.5 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Status dropdown */}
      <StatusDropdown task={task} proyectoId={proyectoId} onStatusChange={onStatusChange} />

      {/* Task info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, color: completed ? '#AAA' : '#1A1A1A', fontWeight: 500,
            textDecoration: completed ? 'line-through' : 'none',
            lineHeight: 1.4,
          }}>
            {task.titulo}
          </span>
          <FaseBadge fase={task.catalogo_fases} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: '#CCC', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {task.codigo}
          </span>
          {task.fecha_limite && (
            <span style={{ fontSize: 9, color: '#AAAAAA', letterSpacing: '0.03em' }}>
              · límite {fmtDate(task.fecha_limite)}
            </span>
          )}
        </div>
      </div>

      {/* Responsables */}
      <div ref={anchorRef} style={{ position: 'relative', flexShrink: 0 }}>
        <div
          onClick={() => setShowPicker((s) => !s)}
          style={{ display: 'flex', cursor: 'pointer', paddingTop: 2 }}
        >
          {responsables.length > 0
            ? responsables.slice(0, 3).map((m, i) => (
                <div key={m.id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                  <MemberAvatar member={m} size={20} idx={allMembers.findIndex(x => x.id === m.id)} />
                </div>
              ))
            : <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#EDEBE5',
                border: '1.5px dashed #CCC', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10, color: '#CCC' }}>+</span>
              </div>
          }
        </div>
        {showPicker && (
          <ResponsablePicker
            taskId={task.id}
            proyectoId={proyectoId}
            currentIds={task.responsable_ids}
            members={responsables}
            allMembers={allMembers}
            onUpdate={(ids) => onResponsableChange(task.id, ids)}
            onClose={() => setShowPicker(false)}
            anchorRef={anchorRef}
          />
        )}
      </div>
    </div>
  )
}

// ── Project Card ───────────────────────────────────────────────────────────

function ProjectCard({
  proyecto, tasks, allMembers, memberMap,
  onStatusChange, onResponsableChange,
}: {
  proyecto: Proyecto
  tasks: Task[]
  allMembers: Member[]
  memberMap: Map<string, Member>
  onStatusChange: (id: string, status: Task['status']) => void
  onResponsableChange: (id: string, ids: string[]) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const completed = tasks
    .filter((t) => t.status === 'completado')
    .slice(0, 5)

  const active = tasks
    .filter((t) => t.status !== 'completado')
    .sort((a, b) => {
      const order: Record<string, number> = { bloqueado: 0, en_progreso: 1, pendiente: 2 }
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3)
      if (diff !== 0) return diff
      return (b.prioridad - a.prioridad) || (a.orden_urgencia - b.orden_urgencia)
    })

  const hasContent = completed.length > 0 || active.length > 0
  const blocked = active.filter(t => t.status === 'bloqueado').length

  return (
    <div style={{
      background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0',
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      breakInside: 'avoid', marginBottom: 20,
    }}>
      {/* Image header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ position: 'relative', height: expanded ? 160 : 56, overflow: 'hidden', background: '#1A1A1A', cursor: 'pointer', transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {proyecto.imagen_url
          ? <img
              src={proyecto.imagen_url}
              alt={proyecto.nombre}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
            />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)' }} />
        }
        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: expanded
            ? 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 60%)'
            : 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: expanded ? 16 : 13, fontWeight: 600, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'font-size 0.2s' }}>
                {proyecto.nombre}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {!expanded && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {active.length > 0 && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                      {active.length} pendiente{active.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {blocked > 0 && (
                    <span style={{ fontSize: 10, color: '#D85A30', fontWeight: 700 }}>· {blocked} bloqueado{blocked !== 1 ? 's' : ''}</span>
                  )}
                  {completed.length > 0 && (
                    <span style={{ fontSize: 10, color: '#1D9E75', fontWeight: 500 }}>· {completed.length} ✓</span>
                  )}
                </div>
              )}
              {proyecto.codigo && expanded && (
                <span style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  {proyecto.codigo}
                </span>
              )}
              {proyecto.status === 'on_hold' && expanded && (
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E6B820', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 3 }}>
                  En pausa
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1, transition: 'transform 0.25s', display: 'inline-block', transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                ↑
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      {expanded && <div style={{ padding: '16px 18px' }}>
        {!hasContent && (
          <p style={{ fontSize: 12, color: '#CCC', textAlign: 'center', padding: '20px 0' }}>Sin tareas activas</p>
        )}

        {/* Active tasks */}
        {active.length > 0 && (
          <div style={{ marginBottom: completed.length > 0 ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
                En curso · {active.length}
              </span>
            </div>
            {active.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                allMembers={allMembers}
                memberMap={memberMap}
                proyectoId={proyecto.id}
                onStatusChange={onStatusChange}
                onResponsableChange={onResponsableChange}
              />
            ))}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <div style={{ marginBottom: 4, marginTop: active.length > 0 ? 12 : 0 }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#CCC' }}>
                Terminados recientemente · {completed.length}
              </span>
            </div>
            {completed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                allMembers={allMembers}
                memberMap={memberMap}
                proyectoId={proyecto.id}
                onStatusChange={onStatusChange}
                onResponsableChange={onResponsableChange}
                completed
              />
            ))}
          </div>
        )}
      </div>}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ReviewPage({ proyectos, tasks: initialTasks, members }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  const memberMap = new Map(members.map((m, i) => [m.id, m]))

  const handleStatusChange = (id: string, status: Task['status']) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t))
  }

  const handleResponsableChange = (id: string, ids: string[]) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, responsable_ids: ids } : t))
  }

  // Split projects into two columns (alternating)
  const left = proyectos.filter((_, i) => i % 2 === 0)
  const right = proyectos.filter((_, i) => i % 2 === 1)

  const cardProps = { allMembers: members, memberMap, onStatusChange: handleStatusChange, onResponsableChange: handleResponsableChange }

  const tasksByProject = (proyectoId: string) =>
    tasks.filter((t) => t.proyecto_id === proyectoId)

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#F8F7F4', minHeight: '100vh', color: '#222' }}>

      {/* Header */}
      <div style={{ padding: '40px 32px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Brief semanal
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Review
          </h1>
          <div style={{ fontSize: 12, color: '#AAA', paddingBottom: 4 }}>
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} activo{proyectos.length !== 1 ? 's' : ''} ·{' '}
            {tasks.filter(t => t.status !== 'completado').length} tareas pendientes
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[key], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: '#BBB', marginLeft: 8 }}>· click en punto para cambiar estado</span>
        </div>
      </div>

      {/* Two-column grid */}
      {proyectos.length === 0 ? (
        <div style={{ padding: '80px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, color: '#DDD', marginBottom: 12, fontWeight: 200 }}>—</div>
          <div style={{ fontSize: 13, color: '#BBB' }}>No hay proyectos activos</div>
        </div>
      ) : (
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left column */}
          <div>
            {left.map((p) => (
              <ProjectCard key={p.id} proyecto={p} tasks={tasksByProject(p.id)} {...cardProps} />
            ))}
          </div>
          {/* Right column */}
          <div>
            {right.map((p) => (
              <ProjectCard key={p.id} proyecto={p} tasks={tasksByProject(p.id)} {...cardProps} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

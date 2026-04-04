'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateProyecto, addProyectoFase, getProyectoImageUploadToken, updateProyectoStatus, deleteProyecto, deleteProyectoFase, iniciarFase } from '@/app/actions/proyectos'
import TitularesSection from '@/components/team/proyectos/TitularesSection'
import type { Titular, ClienteOption } from '@/components/team/proyectos/TitularesSection'
import { updateTaskStatus, updateTaskResponsables, updateTaskPrioridad, updateTaskTitulo, updateTaskFechaLimite, deleteTask } from '@/app/actions/tasks'
import type { ProyectoInterno, ProyectoFase, Task, TaskStatus, CatalogoFase, UserProfile, ProyectoStatus } from '@/lib/types'

interface Props {
  proyecto: ProyectoInterno
  tasks: Task[]
  catalogoFases: CatalogoFase[]
  teamMembers: UserProfile[]
  clientes: ClienteOption[]
  titulares: Titular[]
  proveedores: { id: string; nombre: string }[]
  currentUserRole: string
}

const ROLE_COLORS: Record<string, string> = {
  fp_team: '#1D9E75',
  fp_manager: '#378ADD',
  fp_partner: '#D85A30',
}

const STATUS_TRACK = [
  { key: 'pendiente' as TaskStatus,   color: '#9CA3AF', label: 'Pendiente' },
  { key: 'en_progreso' as TaskStatus, color: '#3B82F6', label: 'En progreso' },
  { key: 'bloqueado' as TaskStatus,   color: '#EF4444', label: 'Bloqueado' },
  { key: 'completado' as TaskStatus,  color: '#22C55E', label: 'Completado' },
]

const URGENCIA_LEVELS = [
  { value: 0, label: 'Normal',   color: '#9CA3AF' },
  { value: 1, label: 'Media',    color: '#F59E0B' },
  { value: 2, label: 'Alta',     color: '#EF4444' },
  { value: 3, label: 'Crítica',  color: '#7C3AED' },
]

const PROYECTO_STATUS_LABELS: Record<ProyectoStatus, string> = {
  activo: 'Activo',
  on_hold: 'On Hold',
  terminado: 'Terminado',
  archivado: 'Archivado',
}

const DESIGN_SECTION_ORDER = ['Anteproyecto', 'Proyecto de ejecución', 'Obra', 'Interiorismo', 'Post venta']

const TASK_SCORE: Record<string, number> = {
  pendiente:   0,
  en_progreso: 0.5,
  bloqueado:   0.25,
  completado:  1,
}

const PRIORITY_BONUS: Record<number, number> = { 0: 0, 1: 15, 2: 30, 3: 2000 }

function urgencyScore(task: Pick<Task, 'created_at' | 'prioridad' | 'orden_urgencia'>): number {
  const days = Math.floor((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))
  return days + (PRIORITY_BONUS[task.prioridad] ?? 0) - task.orden_urgencia * 0.0001
}

function calcProgress(taskList: Task[]): number {
  if (taskList.length === 0) return 0
  const sum = taskList.reduce((acc, t) => acc + (TASK_SCORE[t.status] ?? 0), 0)
  return Math.round((sum / taskList.length) * 100)
}

// ── Pequeños sub-componentes ─────────────────────────────────────────────────

function ResponsablesDropdown({
  teamMembers, selected, onChange,
}: { teamMembers: UserProfile[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const label = selected.length === 0
    ? 'Sin asignar'
    : teamMembers.filter(m => selected.includes(m.id)).map(m => m.nombre.split(' ')[0]).join(', ')

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="text-[11px] font-light text-ink/70 border border-ink/15 px-3 py-1.5 hover:border-ink/40 transition-colors min-w-[160px] text-left flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        <span className="text-meta shrink-0">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-ink/15 shadow-lg min-w-[200px] max-h-48 overflow-y-auto">
            {teamMembers.map(m => (
              <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-cream cursor-pointer">
                <input type="checkbox" checked={selected.includes(m.id)}
                  onChange={e => { if (e.target.checked) onChange([...selected, m.id]); else onChange(selected.filter(id => id !== m.id)) }}
                  className="shrink-0" />
                <div>
                  <p className="text-[11px] font-light text-ink">{m.nombre}</p>
                  <p className="text-[9px] text-meta uppercase tracking-widest">{m.rol.replace('fp_', '')}</p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Status track ─────────────────────────────────────────────────────────────

function StatusTrack({ status, canEdit, onChange }: {
  status: TaskStatus; canEdit: boolean; onChange: (s: TaskStatus) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const currentIdx = STATUS_TRACK.findIndex(s => s.key === status)
  const displayIdx = dragIdx ?? currentIdx
  const activeColor = STATUS_TRACK[displayIdx].color

  const handleBallMouseDown = (e: React.MouseEvent) => {
    if (!canEdit) return
    e.preventDefault()
    e.stopPropagation()
    const track = trackRef.current
    if (!track) return

    const calc = (clientX: number) => {
      const rect = track.getBoundingClientRect()
      const pct = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1))
      return Math.round(pct * 3)
    }

    const onMove = (e: MouseEvent) => setDragIdx(calc(e.clientX))
    const onUp = (e: MouseEvent) => {
      const idx = calc(e.clientX)
      onChange(STATUS_TRACK[idx].key)
      setDragIdx(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div
        ref={trackRef}
        className="relative flex items-center"
        style={{ width: 80, minWidth: 80, height: 24 }}
      >
        {/* Track line background */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-ink/12" />
        {/* Colored progress */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px transition-all duration-150"
          style={{ left: 0, width: `${(displayIdx / 3) * 100}%`, background: activeColor }}
        />

        {/* Dots with tooltip */}
        {STATUS_TRACK.map((s, i) => (
          <div
            key={s.key}
            onClick={() => canEdit && onChange(s.key)}
            title={s.label}
            className="absolute group/dot"
            style={{ left: `${(i / 3) * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 1, cursor: canEdit ? 'pointer' : 'default' }}
          >
            <div
              className="w-[5px] h-[5px] rounded-full transition-all duration-150 group-hover/dot:scale-150"
              style={{ background: i <= displayIdx ? activeColor : '#D1D5DB' }}
            />
          </div>
        ))}

        {/* Draggable ball */}
        <div
          className="absolute"
          style={{
            left: `${(displayIdx / 3) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            cursor: canEdit ? (dragIdx !== null ? 'grabbing' : 'grab') : 'default',
          }}
          onMouseDown={handleBallMouseDown}
        >
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all duration-150"
            style={{ background: activeColor }}
          />
        </div>
      </div>
      {/* Status label */}
      <span className="text-[9px] tracking-widest uppercase font-light truncate" style={{ color: activeColor }}>
        {STATUS_TRACK[displayIdx].label}
      </span>
    </div>
  )
}

// ── Responsable avatar ────────────────────────────────────────────────────────

function MemberAvatar({ member, size = 7 }: { member: UserProfile; size?: number }) {
  const initials = member.nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  const bgColor = ROLE_COLORS[member.rol] ?? '#888'
  const px = size * 4
  return member.avatar_url ? (
    <img
      src={member.avatar_url}
      alt={member.nombre}
      className="rounded-full object-cover ring-2 ring-white shrink-0"
      style={{ width: px, height: px }}
    />
  ) : (
    <span
      className="rounded-full flex items-center justify-center text-white font-medium ring-2 ring-white shrink-0"
      style={{ width: px, height: px, background: bgColor, fontSize: Math.max(8, px * 0.3) }}
    >
      {initials}
    </span>
  )
}

const AV = 28          // avatar diameter px
const AV_STEP = Math.round(AV * 0.8) // 20% overlap → each avatar shifts 80% of diameter

function ResponsableAvatars({ responsableIds, teamMembers, canEdit, onChange }: {
  responsableIds: string[]; teamMembers: UserProfile[]
  canEdit: boolean; onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const members = responsableIds
    .map(id => teamMembers.find(m => m.id === id))
    .filter((m): m is UserProfile => Boolean(m))

  const stackWidth = members.length === 0 ? 0 : (members.length - 1) * AV_STEP + AV
  const toggle = (id: string) =>
    onChange(responsableIds.includes(id) ? responsableIds.filter(x => x !== id) : [...responsableIds, id])

  const handleOpen = () => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left })
    setOpen(o => !o)
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Avatar stack — solo display */}
      {members.length > 0 && (
        <div className="relative shrink-0" style={{ width: stackWidth, height: AV }}>
          {members.map((m, i) => (
            <div
              key={m.id}
              title={m.nombre}
              className="absolute top-0 rounded-full overflow-hidden ring-2 ring-white"
              style={{
                left: i * AV_STEP,
                width: AV,
                height: AV,
                zIndex: members.length - i,
                background: m.avatar_url ? 'transparent' : (ROLE_COLORS[m.rol] ?? '#888'),
              }}
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.nombre} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-white font-medium" style={{ fontSize: 9 }}>
                  {m.nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botón "+" — abre el popup */}
      {canEdit && (
        <button
          ref={btnRef}
          type="button"
          onClick={handleOpen}
          title="Editar responsables"
          className="w-5 h-5 rounded-full bg-ink/8 hover:bg-ink/15 flex items-center justify-center text-[11px] text-meta/70 hover:text-ink transition-all shrink-0"
        >
          +
        </button>
      )}

      {/* Popup via portal — escapa transforms y stacking contexts */}
      {open && mounted && canEdit && createPortal(
        <>
          <div className="fixed inset-0 z-[500]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[501] bg-white border border-ink/15 shadow-xl py-1"
            style={{ top: dropPos.top, left: dropPos.left, minWidth: 200 }}
          >
            <p className="text-[8px] tracking-widest uppercase font-light text-meta/50 px-3 pt-1.5 pb-2 border-b border-ink/8">
              Responsables
            </p>
            {teamMembers.map(m => (
              <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-cream cursor-pointer">
                <input
                  type="checkbox"
                  checked={responsableIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="shrink-0"
                />
                <MemberAvatar member={m} size={4} />
                <span className="text-[11px] font-light text-ink">{m.nombre}</span>
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ── Urgencia control ─────────────────────────────────────────────────────────

function UrgenciaControl({ prioridad, canEdit, onChange }: {
  prioridad: number; canEdit: boolean; onChange: (v: number) => void
}) {
  const level = URGENCIA_LEVELS[Math.min(prioridad, 3)] ?? URGENCIA_LEVELS[0]
  const next = (prioridad + 1) % 4

  return (
    <button
      type="button"
      title={canEdit ? `Urgencia: ${level.label} — clic para cambiar` : `Urgencia: ${level.label}`}
      onClick={() => canEdit && onChange(next)}
      className="inline-flex items-center gap-2 group/urg"
      style={{ cursor: canEdit ? 'pointer' : 'default' }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover/urg:scale-125"
        style={{ background: level.color }}
      />
      <span className="text-[9px] tracking-widest uppercase font-light" style={{ color: level.color }}>
        {level.label}
      </span>
    </button>
  )
}

// ── Task row ─────────────────────────────────────────────────────────────────

// Viewport-absolute centres: sidebar(256) + p-10(40) = 296px row-left
// Fecha: ~780px | Responsable: ~954px | Status: ~1104px | Urgencia: ~1304px
const COL = { fecha: 780, resp: 954, status: 1104, urg: 1304 }

function fmtDate(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function TaskRow({ task, teamMembers, canEdit, proyectoId, onUpdate, onDelete }: {
  task: Task; teamMembers: UserProfile[]; canEdit: boolean; proyectoId: string
  onUpdate: (id: string, data: Partial<Task>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ titulo: task.titulo, descripcion: task.descripcion ?? '', fecha_limite: task.fecha_limite ?? '' })

  const saveStatus = async (newStatus: TaskStatus) => {
    onUpdate(task.id, { status: newStatus })
    const result = await updateTaskStatus(task.id, newStatus, proyectoId)
    if (result.error) { onUpdate(task.id, { status: task.status }); alert(`Error: ${result.error}`) }
  }

  const saveResponsables = async (ids: string[]) => {
    onUpdate(task.id, { responsable_ids: ids })
    const result = await updateTaskResponsables(task.id, ids, proyectoId)
    if (result.error) { onUpdate(task.id, { responsable_ids: task.responsable_ids }); alert(`Error al guardar responsables: ${result.error}`) }
  }

  const savePrioridad = async (v: number) => {
    onUpdate(task.id, { prioridad: v })
    const result = await updateTaskPrioridad(task.id, v, proyectoId)
    if (result.error) { onUpdate(task.id, { prioridad: task.prioridad }); alert(`Error: ${result.error}`) }
  }

  const save = async () => {
    const titulo = form.titulo.trim()
    const descripcion = form.descripcion.trim() || null
    const fecha_limite = form.fecha_limite || null
    onUpdate(task.id, { titulo, descripcion, fecha_limite })
    setEditing(false)
    const [r1, r2] = await Promise.all([
      updateTaskTitulo(task.id, titulo, descripcion, proyectoId),
      updateTaskFechaLimite(task.id, fecha_limite, proyectoId),
    ])
    if (r1.error) alert(`Error al guardar: ${r1.error}`)
    if (r2.error) alert(`Error al guardar fecha límite: ${r2.error}`)
  }

  const remove = async () => {
    onDelete(task.id)
    const result = await deleteTask(task.id, proyectoId)
    if (result.error) alert(`Error al eliminar: ${result.error}`)
  }

  if (editing) {
    return (
      <div className="px-4 py-3 border-b border-ink/8 bg-ink/[0.02] space-y-2">
        <p className="text-[9px] tracking-widest uppercase font-light text-meta/50">{task.codigo}</p>
        <input autoFocus value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          className="w-full text-sm font-light text-ink border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40" />
        <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción (opcional)"
          className="w-full text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40" />
        <div className="flex items-center gap-2">
          <label className="text-[9px] tracking-widest uppercase font-light text-meta/50 shrink-0">Fecha límite</label>
          <input type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
            className="text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40" />
          {form.fecha_limite && (
            <button type="button" onClick={() => setForm(f => ({ ...f, fecha_limite: '' }))}
              className="text-[9px] text-meta hover:text-red-500 transition-colors">✕</button>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={save} className="text-[10px] tracking-widest uppercase font-light text-ink hover:opacity-60">Guardar</button>
          <button onClick={() => setEditing(false)} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink">Cancelar</button>
          <button onClick={remove} className="ml-auto text-[10px] tracking-widest uppercase font-light text-meta hover:text-red-600">Eliminar</button>
        </div>
      </div>
    )
  }

  const urgLevel = URGENCIA_LEVELS[Math.min(task.prioridad ?? 0, 3)]
  const statusItem = STATUS_TRACK.find(s => s.key === task.status) ?? STATUS_TRACK[0]

  return (
    <div className="relative border-b border-ink/8">
      {/* ── Desktop row (lg+): title + absolute blocks ─────────────────── */}
      <div className="hidden lg:block relative px-4 py-3.5" style={{ minHeight: 52 }}>
        {/* Title — clickable para editar */}
        <div
          style={{ maxWidth: COL.fecha - 60, cursor: canEdit ? 'pointer' : 'default' }}
          onClick={() => canEdit && setEditing(true)}
          title={canEdit ? 'Clic para editar' : undefined}
        >
          <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 mb-0.5 truncate">{task.codigo}</p>
          <p className="text-[13px] text-ink leading-snug truncate hover:text-ink/60 transition-colors">{task.titulo}</p>
        </div>

        {/* Fecha límite — centrado antes de responsable */}
        <div className="absolute top-1/2" style={{ left: COL.fecha, transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          {task.fecha_limite ? (
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: '#D85A30' }}>
              {fmtDate(task.fecha_limite)}
            </span>
          ) : (
            <span className="text-[11px] text-ink/15">—</span>
          )}
        </div>

        {/* Responsable — centrado en 1250px viewport */}
        <div className="absolute top-1/2" style={{ left: COL.resp, transform: 'translate(-50%, -50%)' }}>
          <ResponsableAvatars responsableIds={task.responsable_ids ?? []} teamMembers={teamMembers} canEdit={canEdit} onChange={saveResponsables} />
        </div>

        {/* Status — centrado en 1400px viewport */}
        <div className="absolute top-1/2" style={{ left: COL.status, transform: 'translate(-50%, -50%)' }}>
          <StatusTrack status={task.status} canEdit={canEdit} onChange={saveStatus} />
        </div>

        {/* Urgencia — centrado en 1600px viewport */}
        <div className="absolute top-1/2" style={{ left: COL.urg, transform: 'translate(-50%, -50%)' }}>
          <UrgenciaControl prioridad={task.prioridad ?? 0} canEdit={canEdit} onChange={savePrioridad} />
        </div>
      </div>

      {/* ── Móvil row: layout compacto apilado ─────────────────────────── */}
      <div className="lg:hidden px-4 pt-3 pb-2.5">
        {/* Título clickable */}
        <div onClick={() => canEdit && setEditing(true)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
          <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 mb-0.5">{task.codigo}</p>
          <p className="text-[13px] text-ink leading-snug">{task.titulo}</p>
        </div>

        {/* Chips: fecha · responsable · status · urgencia */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {task.fecha_limite && (
            <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: '#D85A30' }}>
              {fmtDate(task.fecha_limite)}
            </span>
          )}
          <ResponsableAvatars responsableIds={task.responsable_ids ?? []} teamMembers={teamMembers} canEdit={canEdit} onChange={saveResponsables} />

          {/* Status chip */}
          <button
            onClick={() => {
              const idx = STATUS_TRACK.findIndex(s => s.key === task.status)
              saveStatus(STATUS_TRACK[(idx + 1) % STATUS_TRACK.length].key)
            }}
            disabled={!canEdit}
            className="flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusItem.color }} />
            <span className="text-[9px] tracking-widest uppercase font-light" style={{ color: statusItem.color }}>
              {statusItem.label}
            </span>
          </button>

          {/* Urgencia chip */}
          <button
            onClick={() => canEdit && savePrioridad(((task.prioridad ?? 0) + 1) % 4)}
            disabled={!canEdit}
            className="flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: urgLevel.color }} />
            <span className="text-[9px] tracking-widest uppercase font-light" style={{ color: urgLevel.color }}>
              {urgLevel.label}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add task inline form ─────────────────────────────────────────────────────

function AddTaskForm({ proyectoId, faseId, faseNumero, existingCount, proyectoCodigo, teamMembers, onAdded, onCancel }: {
  proyectoId: string; faseId: string; faseNumero: number; existingCount: number
  proyectoCodigo: string; teamMembers: UserProfile[]
  onAdded: (task: Task) => void; onCancel: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [responsableIds, setResponsableIds] = useState<string[]>([])
  const [respOpen, setRespOpen] = useState(false)
  const [prioridad, setPrioridad] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const codigo = `${proyectoCodigo}-F${faseNumero}-${String(existingCount + 1).padStart(3, '0')}`

  const toggleResp = (id: string) =>
    setResponsableIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    setLoading(true)
    setError(null)
    const { data, error: insertError } = await supabase.from('tasks')
      .insert({ codigo, titulo: titulo.trim(), descripcion: descripcion.trim() || null, fecha_limite: fechaLimite || null, proyecto_id: proyectoId, fase_id: faseId, responsable_ids: responsableIds, orden_urgencia: existingCount, prioridad })
      .select('id, codigo, titulo, descripcion, proyecto_id, fase_id, responsable_ids, status, orden_urgencia, prioridad, created_at, fecha_limite, catalogo_fases(id, numero, label, seccion, orden)')
      .single()
    if (insertError) { setError(insertError.message); setLoading(false); return }
    if (data) onAdded(data as unknown as Task)
    setLoading(false)
  }

  const urgLevel = URGENCIA_LEVELS[prioridad]
  const respLabel = responsableIds.length === 0
    ? 'Sin responsable'
    : teamMembers.filter(m => responsableIds.includes(m.id)).map(m => m.nombre.split(' ')[0]).join(', ')

  return (
    <form onSubmit={submit} className="px-4 py-3 bg-ink/[0.02] border-t border-ink/8 space-y-2">
      <p className="text-[9px] text-meta font-light tracking-widest uppercase">Código: {codigo}</p>
      <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título del task *"
        className="w-full text-sm font-light text-ink border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40" />
      <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción (opcional)"
        className="w-full text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40" />
      <div className="flex items-center gap-2">
        <label className="text-[9px] tracking-widest uppercase font-light text-meta/50 shrink-0">Fecha límite</label>
        <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)}
          className="text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40" />
        {fechaLimite && (
          <button type="button" onClick={() => setFechaLimite('')} className="text-[9px] text-meta hover:text-red-500 transition-colors">✕</button>
        )}
      </div>
      <div className="flex gap-3 items-center">
        {/* Responsables multi-select */}
        <div className="relative flex-1">
          <button type="button" onClick={() => setRespOpen(o => !o)}
            className="w-full text-left text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white flex items-center justify-between gap-2">
            <span className="truncate">{respLabel}</span>
            <span className="text-meta shrink-0 text-[9px]">▾</span>
          </button>
          {respOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setRespOpen(false)} />
              <div className="absolute left-0 top-full mt-0.5 z-30 bg-white border border-ink/15 shadow-lg min-w-[180px] max-h-48 overflow-y-auto py-1">
                {teamMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-cream cursor-pointer">
                    <input type="checkbox" checked={responsableIds.includes(m.id)} onChange={() => toggleResp(m.id)} className="shrink-0" />
                    <MemberAvatar member={m} size={4} />
                    <span className="text-[11px] font-light text-ink">{m.nombre}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <select value={prioridad} onChange={e => setPrioridad(Number(e.target.value))}
          className="text-[11px] font-light border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40"
          style={{ color: urgLevel.color }}>
          {URGENCIA_LEVELS.map(l => <option key={l.value} value={l.value} style={{ color: l.color }}>{l.label}</option>)}
        </select>
      </div>
      {error && <p className="text-[10px] text-red-500 font-light">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading || !titulo.trim()} className="text-[10px] tracking-widest uppercase font-light text-ink hover:opacity-60 disabled:opacity-30">Agregar</button>
        <button type="button" onClick={onCancel} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink">Cancelar</button>
      </div>
    </form>
  )
}

// ── Add fase panel ────────────────────────────────────────────────────────────

function AddFasePanel({ proyectoId, availableFases, teamMembers, onAdded, onCancel }: {
  proyectoId: string
  availableFases: CatalogoFase[]
  teamMembers: UserProfile[]
  onAdded: (pf: { id: string; fase_id: string; responsables: string[]; status: 'pendiente'; horas_objetivo: number | null; fase_status: 'en_espera'; catalogo_fases: CatalogoFase }) => void
  onCancel: () => void
}) {
  const [faseId, setFaseId] = useState('')
  const [responsables, setResponsables] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = availableFases.find(f => f.id === faseId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faseId) return
    setLoading(true)
    setError(null)
    const result = await addProyectoFase(proyectoId, faseId, responsables)
    if (result.error) { setError(result.error); setLoading(false); return }
    if (result.success && selected) {
      onAdded({ id: result.pfId!, fase_id: faseId, responsables, status: 'pendiente', horas_objetivo: result.horas_objetivo ?? null, fase_status: 'en_espera', catalogo_fases: selected })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="border border-dashed border-ink/20 p-5 mt-4 space-y-4">
      <p className="text-[10px] tracking-widest uppercase font-light text-meta">Nueva fase contratada</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Fase</label>
          <select value={faseId} onChange={e => setFaseId(e.target.value)} required
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-white focus:outline-none focus:border-ink/40">
            <option value="">Seleccionar fase…</option>
            {DESIGN_SECTION_ORDER.map(sec => {
              const fases = availableFases.filter(f => f.seccion === sec)
              if (!fases.length) return null
              return (
                <optgroup key={sec} label={sec}>
                  {fases.map(f => <option key={f.id} value={f.id}>F{f.numero} — {f.label}</option>)}
                </optgroup>
              )
            })}
          </select>
        </div>

        {faseId && (
          <div>
            <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Responsables</label>
            <ResponsablesDropdown teamMembers={teamMembers} selected={responsables} onChange={setResponsables} />
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-red-600 font-light">{error}</p>}

      <div className="flex gap-4">
        <button type="submit" disabled={loading || !faseId}
          className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-50">
          {loading ? 'Guardando…' : 'Agregar fase'}
        </button>
        <button type="button" onClick={onCancel} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink">Cancelar</button>
      </div>
    </form>
  )
}

// ── Edit project info panel ───────────────────────────────────────────────────

function EditProyectoPanel({ proyecto, proveedores, onSaved, onCancel, onDeleted }: {
  proyecto: ProyectoInterno
  proveedores: { id: string; nombre: string }[]
  onSaved: (data: Partial<ProyectoInterno>) => void
  onCancel: () => void
  onDeleted: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    nombre: proyecto.nombre,
    codigo: proyecto.codigo ?? '',
    direccion: proyecto.direccion ?? '',
    superficie_diseno: proyecto.superficie_diseno?.toString() ?? '',
    superficie_catastral: proyecto.superficie_catastral?.toString() ?? '',
    superficie_util: proyecto.superficie_util?.toString() ?? '',
    constructor_id: proyecto.constructor_id ?? '',
    status: proyecto.status ?? 'activo',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(proyecto.imagen_url ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Delete flow
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteProyecto(proyecto.id)
    if (result.error) { setDeleteError(result.error); setDeleting(false); return }
    onDeleted()
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true)
    setError(null)

    let imagen_url: string | null | undefined = undefined // undefined = don't change
    if (imageFile) {
      const tokenResult = await getProyectoImageUploadToken(imageFile.name)
      if ('error' in tokenResult) { setError(tokenResult.error); setLoading(false); return }
      const { error: uploadError } = await createClient().storage
        .from('proyecto-imagenes')
        .uploadToSignedUrl(tokenResult.path, tokenResult.token, imageFile, { upsert: true })
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      imagen_url = tokenResult.publicUrl
    }

    const result = await updateProyecto(proyecto.id, {
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim() || undefined,
      direccion: form.direccion.trim(),
      superficie_diseno: form.superficie_diseno ? Number(form.superficie_diseno) : null,
      superficie_catastral: form.superficie_catastral ? Number(form.superficie_catastral) : null,
      superficie_util: form.superficie_util ? Number(form.superficie_util) : null,
      cliente_id: proyecto.cliente_id,
      constructor_id: form.constructor_id || null,
      status: form.status,
      imagen_url,
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    onSaved({
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim() ? form.codigo.trim().toUpperCase() : proyecto.codigo,
      direccion: form.direccion.trim() || null,
      superficie_diseno: form.superficie_diseno ? Number(form.superficie_diseno) : null,
      superficie_catastral: form.superficie_catastral ? Number(form.superficie_catastral) : null,
      superficie_util: form.superficie_util ? Number(form.superficie_util) : null,
      constructor_id: form.constructor_id || null,
      status: form.status as ProyectoStatus,
      imagen_url: imagen_url !== undefined ? imagen_url : proyecto.imagen_url,
    })
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="border border-ink/15 p-6 space-y-4 bg-white">
      <p className="text-[10px] tracking-widest uppercase font-light text-meta">Editar proyecto</p>

      {/* Image */}
      <div>
        <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Imagen de referencia</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-ink/20 hover:border-ink/40 transition-colors cursor-pointer flex items-center justify-center overflow-hidden"
          style={{ height: imagePreview ? 'auto' : 100 }}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-full max-h-52 object-cover" />
          ) : (
            <p className="text-[11px] text-meta font-light">Haz clic para subir imagen</p>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        {imagePreview && (
          <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
            className="mt-1 text-[10px] tracking-widest uppercase font-light text-meta hover:text-red-600 transition-colors">
            Quitar imagen
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Nombre *</label>
          <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40" />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Código</label>
          <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) }))}
            placeholder="Ej. CAS42"
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Dirección</label>
          <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40" />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Diseño (m²)</label>
          <input type="number" value={form.superficie_diseno} onChange={e => setForm(f => ({ ...f, superficie_diseno: e.target.value }))} min={0}
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40" />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Catastral (m²)</label>
          <input type="number" value={form.superficie_catastral} onChange={e => setForm(f => ({ ...f, superficie_catastral: e.target.value }))} min={0}
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40" />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Útil (m²)</label>
          <input type="number" value={form.superficie_util} onChange={e => setForm(f => ({ ...f, superficie_util: e.target.value }))} min={0}
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40" />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Estado</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProyectoStatus }))}
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40">
            {Object.entries(PROYECTO_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">Constructor <span className="normal-case tracking-normal font-light text-meta/60">(opcional)</span></label>
          <select value={form.constructor_id} onChange={e => setForm(f => ({ ...f, constructor_id: e.target.value }))}
            className="w-full text-sm font-light text-ink border border-ink/15 px-3 py-2 bg-cream focus:outline-none focus:border-ink/40">
            <option value="">Sin constructor asignado</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-[11px] text-red-600 font-light">{error}</p>}

      <div className="flex gap-4 pt-1">
        <button type="submit" disabled={loading}
          className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 disabled:opacity-50">
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={onCancel} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink">Cancelar</button>
      </div>

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-red-100">
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-[10px] tracking-widest uppercase font-light text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar proyecto
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] tracking-widest uppercase font-light text-red-500">Zona de peligro</p>
            <p className="text-[11px] font-light text-ink/70">
              Esta acción es <strong className="font-normal text-ink">irreversible</strong>. Se eliminarán el proyecto, todas sus fases y todos sus tasks.
            </p>
            <p className="text-[11px] font-light text-ink/70">
              Para confirmar, escribe el nombre del proyecto: <span className="font-normal text-ink">{proyecto.nombre}</span>
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={proyecto.nombre}
              className="w-full border border-red-200 focus:border-red-400 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none"
            />
            {deleteError && <p className="text-[11px] text-red-600 font-light">{deleteError}</p>}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== proyecto.nombre}
                className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {deleting ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDelete(false); setDeleteConfirm('') }}
                className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}

// ── Fase row ──────────────────────────────────────────────────────────────────

function FaseRow({ pf, catalogo, faseTasks, faseProgress, responsableNames, canEditProject, canEdit, addingFaseId, teamMembers, proyecto, onAddTask, onSetAddingFaseId, onUpdateTask, onDeleteTask, onDeleteFase, onIniciar }: {
  pf: ProyectoFase
  catalogo: CatalogoFase
  faseTasks: Task[]
  faseProgress: number
  responsableNames: string[]
  canEditProject: boolean
  canEdit: boolean
  addingFaseId: string | null
  teamMembers: UserProfile[]
  proyecto: ProyectoInterno
  onAddTask: (t: Task) => void
  onSetAddingFaseId: (id: string | null) => void
  onUpdateTask: (id: string, data: Partial<Task>) => void
  onDeleteTask: (id: string) => void
  onDeleteFase: (pfId: string, faseId: string) => void
  onIniciar: (pfId: string, faseId: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [starting, setStarting] = useState(false)

  const faseStatus = pf.fase_status ?? 'en_espera'

  const handleDelete = async () => {
    setDeleting(true)
    await onDeleteFase(pf.id, catalogo.id)
    setDeleting(false)
  }

  const handleIniciar = async () => {
    setStarting(true)
    await onIniciar(pf.id, catalogo.id)
    setStarting(false)
  }

  return (
    <div className="border border-ink/10">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink/8 bg-ink/[0.015]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] tracking-widest uppercase font-light text-meta shrink-0">F{catalogo.numero}</span>
          <span className="text-[11px] font-light text-ink">{catalogo.label}</span>
          {responsableNames.length > 0 && (
            <span className="text-[9px] text-meta/60 font-light truncate">· {responsableNames.join(', ')}</span>
          )}
          {/* Fase status badge */}
          <span className={`text-[8px] tracking-widest uppercase font-medium px-2 py-0.5 shrink-0 ${
            faseStatus === 'iniciada'
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-amber-50 text-amber-600 border border-amber-200'
          }`}>
            {faseStatus === 'iniciada' ? 'Iniciada' : 'En espera'}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Horas — only when iniciada */}
          {faseStatus === 'iniciada' && pf.horas_objetivo != null && (
            <span className="text-[11px] font-light text-ink tabular-nums whitespace-nowrap">
              <span className="text-meta/50">0 hrs.</span>
              <span className="text-meta/30 mx-1">/</span>
              {pf.horas_objetivo} hrs.
            </span>
          )}
          {/* Progreso — only when iniciada */}
          {faseStatus === 'iniciada' && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-[2px] bg-ink/10 rounded-full overflow-hidden">
                <div className="h-full bg-ink/40 rounded-full transition-all duration-500" style={{ width: `${faseProgress}%` }} />
              </div>
              <span className="text-[11px] font-light text-ink tabular-nums w-8 text-right">{faseProgress}%</span>
            </div>
          )}
          {/* Iniciar fase button — only when en_espera and canEdit */}
          {faseStatus === 'en_espera' && canEdit && (
            <button
              onClick={handleIniciar}
              disabled={starting}
              className="text-[9px] tracking-widest uppercase font-medium px-3 py-1.5 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-40"
            >
              {starting ? 'Iniciando…' : 'Iniciar fase →'}
            </button>
          )}
          {/* Eliminar fase */}
          {canEditProject && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-red-500 font-light">¿Eliminar fase y sus tasks?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[9px] tracking-widest uppercase font-light text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  {deleting ? '…' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[9px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[9px] tracking-widest uppercase font-light text-meta/40 hover:text-red-500 transition-colors"
              >
                Eliminar
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Body — only shown when fase is iniciada ───────────────────── */}
      {faseStatus === 'en_espera' ? (
        <div className="px-4 py-5 text-center">
          <p className="text-[10px] tracking-widest uppercase font-light text-meta/40">
            Fase contratada · en espera de inicio
          </p>
          <p className="text-[11px] font-light text-ink/40 mt-1">
            Cuando inicies la fase se crearán automáticamente los tasks desde la plantilla.
          </p>
        </div>
      ) : (
        <>
          {faseTasks.length > 0 && (
            <div className="relative border-b border-ink/8 bg-ink/[0.01] hidden lg:block" style={{ height: 28 }}>
              <p className="absolute text-[8px] tracking-widest uppercase font-light whitespace-nowrap"
                style={{ left: COL.fecha, top: '50%', transform: 'translate(-50%, -50%)', color: '#D85A30', opacity: 0.6 }}>Fecha límite</p>
              <p className="absolute text-[8px] tracking-widest uppercase font-light text-meta/40 whitespace-nowrap"
                style={{ left: COL.resp, top: '50%', transform: 'translate(-50%, -50%)' }}>Responsable</p>
              <p className="absolute text-[8px] tracking-widest uppercase font-light text-meta/40 whitespace-nowrap"
                style={{ left: COL.status, top: '50%', transform: 'translate(-50%, -50%)' }}>Status</p>
              <p className="absolute text-[8px] tracking-widest uppercase font-light text-meta/40 whitespace-nowrap"
                style={{ left: COL.urg, top: '50%', transform: 'translate(-50%, -50%)' }}>Urgencia</p>
            </div>
          )}

          {faseTasks.map(task => (
            <TaskRow key={task.id} task={task} teamMembers={teamMembers}
              canEdit={canEdit} proyectoId={proyecto.id} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
          ))}

          {faseTasks.length === 0 && addingFaseId !== catalogo.id && (
            <p className="px-4 py-3 text-[10px] text-meta/40 font-light">Sin tasks</p>
          )}

          {canEdit && addingFaseId === catalogo.id ? (
            <AddTaskForm proyectoId={proyecto.id} faseId={catalogo.id} faseNumero={catalogo.numero}
              existingCount={faseTasks.length} proyectoCodigo={proyecto.codigo || proyecto.nombre.slice(0, 5).toUpperCase()}
              teamMembers={teamMembers} onAdded={onAddTask} onCancel={() => onSetAddingFaseId(null)} />
          ) : canEdit ? (
            <button onClick={() => onSetAddingFaseId(catalogo.id)}
              className="w-full text-left px-4 py-2.5 text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors">
              + Agregar task
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProyectoDetalle({ proyecto: initialProyecto, tasks: initialTasks, catalogoFases, teamMembers, clientes, titulares, proveedores, currentUserRole }: Props) {
  const router = useRouter()
  const [proyecto, setProyecto] = useState<ProyectoInterno>(initialProyecto)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [fases, setFases] = useState(initialProyecto.proyecto_fases ?? [])
  const [editingProyecto, setEditingProyecto] = useState(false)
  const [addingFaseId, setAddingFaseId] = useState<string | null>(null)
  const [showAddFase, setShowAddFase] = useState(false)

  // Editar info del proyecto, fases, status — solo manager/partner
  const canEditProject = currentUserRole === 'fp_manager' || currentUserRole === 'fp_partner'
  // Agregar, editar y eliminar tasks — todos los roles del equipo
  const canEdit = currentUserRole === 'fp_team' || currentUserRole === 'fp_manager' || currentUserRole === 'fp_partner'

  const updateTask = (id: string, data: Partial<Task>) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id))
  const addTask = (task: Task) => { setTasks(prev => [...prev, task]); setAddingFaseId(null) }

  const handleDeleteFase = async (pfId: string, faseId: string) => {
    const result = await deleteProyectoFase(pfId, proyecto.id)
    if (result.error) return
    setFases(prev => prev.filter(f => f.id !== pfId))
    setTasks(prev => prev.filter(t => t.fase_id !== faseId))
  }

  const handleIniciarFase = async (pfId: string, faseId: string) => {
    const result = await iniciarFase(pfId, proyecto.id, faseId)
    if (result.error) {
      alert(`Error al iniciar fase: ${result.error}`)
      return
    }
    setFases(prev => prev.map(f => f.id === pfId ? { ...f, fase_status: 'iniciada' } : f))
    if (result.tasks && result.tasks.length > 0)
      setTasks(prev => [...prev, ...result.tasks as unknown as Task[]])
    router.refresh()
  }

  const contractedFaseIds = new Set(fases.map(f => f.fase_id))
  const availableFases = catalogoFases.filter(f => !contractedFaseIds.has(f.id))

  const fasesEnriched = fases
    .map(pf => ({ pf, catalogo: catalogoFases.find(cf => cf.id === pf.fase_id) }))
    .filter(({ catalogo }) => catalogo)
    .sort((a, b) => a.catalogo!.orden - b.catalogo!.orden)

  // Build section order dynamically: known design sections first, then any custom sections
  const allSections = Array.from(new Set(fasesEnriched.map(({ catalogo }) => catalogo!.seccion)))
  const orderedSections = [
    ...DESIGN_SECTION_ORDER.filter(s => allSections.includes(s)),
    ...allSections.filter(s => !DESIGN_SECTION_ORDER.includes(s)),
  ]
  const fasesBySection = orderedSections.map(sec => ({
    seccion: sec,
    items: fasesEnriched.filter(({ catalogo }) => catalogo!.seccion === sec),
  })).filter(g => g.items.length > 0)

  const tasksForFase = (faseId: string) =>
    tasks
      .filter(t => t.fase_id === faseId)
      .sort((a, b) => urgencyScore(b) - urgencyScore(a))

  const proyectoProgress = calcProgress(
    fasesEnriched.flatMap(({ catalogo }) => tasksForFase(catalogo!.id))
  )

  const totalHorasObjetivo = fases.reduce((acc, pf) => acc + (pf.horas_objetivo ?? 0), 0)
  const horasIniciadas = fases
    .filter(pf => (pf.fase_status ?? 'en_espera') === 'iniciada')
    .reduce((acc, pf) => acc + (pf.horas_objetivo ?? 0), 0)

  const handleStatusChange = async (newStatus: ProyectoStatus) => {
    setProyecto(p => ({ ...p, status: newStatus }))
    await updateProyectoStatus(proyecto.id, newStatus)
  }

  return (
    <div>
      {/* ── Banner ────────────────────────────────────────────────────────── */}
      <div className="relative w-full h-72 lg:h-[480px] bg-ink/5 overflow-hidden flex items-center justify-center">
        {proyecto.imagen_url ? (
          <img src={proyecto.imagen_url} alt={proyecto.nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-6xl font-light text-ink/10 tracking-wider">
            {proyecto.nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
          </span>
        )}
        {/* Back button */}
        <button onClick={() => router.push('/team/proyectos')}
          className="absolute top-4 left-6 text-[10px] tracking-widest uppercase font-light text-white/80 hover:text-white transition-colors drop-shadow-sm">
          ← Proyectos
        </button>
        {/* Gradient fade to cream at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-48" style={{ background: 'linear-gradient(to top, #F2F2F0 0%, transparent 100%)' }} />
      </div>

      {/* Content overlaps banner */}
      <div className="relative z-10 p-4 sm:p-8 lg:p-10">
      {/* ── Project info ──────────────────────────────────────────────────── */}
      {editingProyecto ? (
        <div className="mb-10 space-y-6">
          <EditProyectoPanel
            proyecto={proyecto}
            proveedores={proveedores}
            onSaved={data => { setProyecto(p => ({ ...p, ...data })); setEditingProyecto(false) }}
            onCancel={() => setEditingProyecto(false)}
            onDeleted={() => router.push('/team/proyectos')}
          />
          <div className="border border-ink/15 p-6 bg-white">
            <TitularesSection
              proyectoId={proyecto.id}
              titulares={titulares}
              clientes={clientes}
              canEdit={['fp_partner', 'fp_manager'].includes(currentUserRole)}
            />
          </div>
        </div>
      ) : (
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                {canEditProject ? (
                  <select
                    value={proyecto.status ?? 'activo'}
                    onChange={e => handleStatusChange(e.target.value as ProyectoStatus)}
                    className="text-[9px] tracking-widest uppercase font-light text-meta bg-transparent border-none focus:outline-none cursor-pointer hover:text-ink transition-colors"
                  >
                    {Object.entries(PROYECTO_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <p className="text-[10px] tracking-widest uppercase font-light text-meta">
                    {PROYECTO_STATUS_LABELS[proyecto.status ?? 'activo']}
                  </p>
                )}
              </div>
              <h1 className="text-3xl font-light text-ink tracking-tight mb-1">{proyecto.nombre}</h1>
              {proyecto.direccion && <p className="text-sm font-light text-meta">{proyecto.direccion}</p>}
            </div>
            {canEditProject && (
              <button onClick={() => setEditingProyecto(true)}
                className="shrink-0 text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink border border-ink/15 px-3 py-1.5 hover:border-ink/40 transition-colors">
                Editar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-6 mt-4">
            {proyecto.superficie_diseno != null && (
              <div>
                <p className="text-[9px] tracking-widest uppercase font-light text-meta">Diseño</p>
                <p className="text-sm font-light text-ink">{proyecto.superficie_diseno.toLocaleString('es-MX')} m²</p>
              </div>
            )}
            {proyecto.superficie_catastral != null && (
              <div>
                <p className="text-[9px] tracking-widest uppercase font-light text-meta">Catastral</p>
                <p className="text-sm font-light text-ink">{proyecto.superficie_catastral.toLocaleString('es-MX')} m²</p>
              </div>
            )}
            {proyecto.superficie_util != null && (
              <div>
                <p className="text-[9px] tracking-widest uppercase font-light text-meta">Útil</p>
                <p className="text-sm font-light text-ink">{proyecto.superficie_util.toLocaleString('es-MX')} m²</p>
              </div>
            )}
            <div className="w-full mt-2">
              <TitularesSection
                proyectoId={proyecto.id}
                titulares={titulares}
                clientes={clientes}
                canEdit={['fp_partner', 'fp_manager'].includes(currentUserRole)}
              />
            </div>
          </div>

          {/* ── Barra de avance del proyecto ──────────────────────────── */}
          {fasesEnriched.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[3px] bg-ink/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink/50 rounded-full transition-all duration-700"
                    style={{ width: `${proyectoProgress}%` }}
                  />
                </div>
                <span className="text-xs font-light text-ink tabular-nums shrink-0 w-9 text-right">
                  {proyectoProgress}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[8px] tracking-widest uppercase font-light text-meta/40">
                  Avance del proyecto
                </p>
                <div className="flex items-center gap-4">
                  {horasIniciadas > 0 && (
                    <div className="text-right">
                      <p className="text-[8px] tracking-widest uppercase font-light text-meta/40 mb-0.5">
                        Fases iniciadas
                      </p>
                      <p className="text-[11px] font-light tabular-nums">
                        <span className="text-meta/50">0 hrs.</span>
                        <span className="text-meta/30 mx-1">/</span>
                        <span className="text-ink">{horasIniciadas} hrs.</span>
                      </p>
                    </div>
                  )}
                  {totalHorasObjetivo > 0 && (
                    <div className="text-right">
                      <p className="text-[8px] tracking-widest uppercase font-light text-meta/40 mb-0.5">
                        Total contratado
                      </p>
                      <p className="text-[11px] font-light tabular-nums">
                        <span className="text-meta/50">0 hrs.</span>
                        <span className="text-meta/30 mx-1">/</span>
                        <span className="text-ink">{totalHorasObjetivo} hrs.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fases + tasks ─────────────────────────────────────────────────── */}
      <div className="space-y-8">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta">Fases y tasks</p>

        {fasesEnriched.length === 0 && (
          <p className="text-sm font-light text-meta">No hay fases contratadas en este proyecto.</p>
        )}

        {fasesBySection.map(group => (
          <div key={group.seccion}>
            <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 mb-3">{group.seccion}</p>
            <div className="space-y-3">
              {group.items.map(({ pf, catalogo }) => {
                const faseTasks = tasksForFase(catalogo!.id)
                const responsableNames = pf.responsables
                  .map(uid => teamMembers.find(m => m.id === uid)?.nombre).filter(Boolean)

                const faseProgress = calcProgress(faseTasks)

                return (
                  <FaseRow
                    key={pf.id}
                    pf={pf}
                    catalogo={catalogo!}
                    faseTasks={faseTasks}
                    faseProgress={faseProgress}
                    responsableNames={responsableNames as string[]}
                    canEditProject={canEditProject}
                    canEdit={canEdit}
                    addingFaseId={addingFaseId}
                    teamMembers={teamMembers}
                    proyecto={proyecto}
                    onAddTask={addTask}
                    onSetAddingFaseId={setAddingFaseId}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onDeleteFase={handleDeleteFase}
                    onIniciar={handleIniciarFase}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* ── Agregar fase ────────────────────────────────────────────────── */}
        {canEditProject && (
          <div>
            {showAddFase ? (
              <AddFasePanel
                proyectoId={proyecto.id}
                availableFases={availableFases}
                teamMembers={teamMembers}
                onAdded={(pf) => {
                  setFases(prev => [...prev, pf as unknown as typeof prev[0]])
                  setShowAddFase(false)
                }}
                onCancel={() => setShowAddFase(false)}
              />
            ) : availableFases.length > 0 ? (
              <button onClick={() => setShowAddFase(true)}
                className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink border border-dashed border-ink/20 hover:border-ink/40 px-4 py-3 w-full text-center transition-colors">
                + Agregar fase contratada
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  </div>
  )
}

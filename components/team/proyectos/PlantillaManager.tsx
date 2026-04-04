'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CatalogoFase, PlantillaTask } from '@/lib/types'

interface Props {
  catalogoFases: CatalogoFase[]
  initialTasks:  PlantillaTask[]
}

// ── Task row (edit / delete) ──────────────────────────────────────────────────

function TaskRow({
  task, onUpdate, onDelete,
}: {
  task:     PlantillaTask
  onUpdate: (id: string, data: Partial<PlantillaTask>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ titulo: task.titulo, descripcion: task.descripcion ?? '' })
  const supabase = createClient()

  const save = async () => {
    const { error } = await supabase
      .from('plantilla_tasks')
      .update({ titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null })
      .eq('id', task.id)
    if (!error) {
      onUpdate(task.id, { titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null })
      setEditing(false)
    }
  }

  const remove = async () => {
    const { error } = await supabase.from('plantilla_tasks').delete().eq('id', task.id)
    if (!error) onDelete(task.id)
  }

  if (editing) {
    return (
      <div className="px-4 py-3 border-b border-ink/8 bg-ink/[0.02] space-y-2">
        <input
          autoFocus
          value={form.titulo}
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          className="w-full text-sm font-light text-ink border border-ink/20 px-2 py-1 bg-white focus:outline-none focus:border-ink/40"
        />
        <input
          value={form.descripcion}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          placeholder="Descripción (opcional)"
          className="w-full text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40"
        />
        <div className="flex gap-3">
          <button onClick={save} className="text-[10px] tracking-widest uppercase font-light text-ink hover:opacity-60 transition-opacity">
            Guardar
          </button>
          <button onClick={() => setEditing(false)} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between px-4 py-3 border-b border-ink/8 group">
      <div className="min-w-0">
        <p className="text-[11px] font-light text-ink">{task.titulo}</p>
        {task.descripcion && (
          <p className="text-[10px] text-meta font-light mt-0.5">{task.descripcion}</p>
        )}
      </div>
      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4">
        <button onClick={() => setEditing(true)} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors">
          Editar
        </button>
        <button onClick={remove} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-red-600 transition-colors">
          Eliminar
        </button>
      </div>
    </div>
  )
}

// ── Add task form ─────────────────────────────────────────────────────────────

function AddTaskForm({ faseId, nextOrden, onAdded }: {
  faseId:    string
  nextOrden: number
  onAdded:   (task: PlantillaTask) => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '' })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('plantilla_tasks')
      .insert({ fase_id: faseId, titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null, orden: nextOrden })
      .select()
      .single()
    if (!error && data) {
      onAdded(data as PlantillaTask)
      setForm({ titulo: '', descripcion: '' })
      setOpen(false)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-left px-4 py-2.5 text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors">
        + Agregar task
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="px-4 py-3 bg-ink/[0.02] space-y-2">
      <input
        autoFocus
        value={form.titulo}
        onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
        placeholder="Título del task *"
        className="w-full text-sm font-light text-ink border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40"
      />
      <input
        value={form.descripcion}
        onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
        placeholder="Descripción (opcional)"
        className="w-full text-[11px] font-light text-ink/70 border border-ink/15 px-2 py-1 bg-white focus:outline-none focus:border-ink/40"
      />
      <div className="flex gap-3">
        <button type="submit" disabled={loading || !form.titulo.trim()} className="text-[10px] tracking-widest uppercase font-light text-ink hover:opacity-60 transition-opacity disabled:opacity-30">
          Agregar
        </button>
        <button type="button" onClick={() => { setOpen(false); setForm({ titulo: '', descripcion: '' }) }} className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Fase row (reorder + rename + delete) ─────────────────────────────────────

function FaseRow({
  fase, tasks, isFirst, isLast, isExpanded,
  onToggle, onMoveUp, onMoveDown, onRename, onDelete,
  onUpdateTask, onDeleteTask, onAddTask,
}: {
  fase:        CatalogoFase
  tasks:       PlantillaTask[]
  isFirst:     boolean
  isLast:      boolean
  isExpanded:  boolean
  onToggle:    () => void
  onMoveUp:    () => void
  onMoveDown:  () => void
  onRename:    (label: string) => void
  onDelete:    () => void
  onUpdateTask: (id: string, data: Partial<PlantillaTask>) => void
  onDeleteTask: (id: string) => void
  onAddTask:    (task: PlantillaTask) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [newLabel, setNewLabel] = useState(fase.label)
  const supabase = createClient()

  const saveRename = async () => {
    const trimmed = newLabel.trim()
    if (!trimmed || trimmed === fase.label) { setRenaming(false); return }
    const { error } = await supabase
      .from('catalogo_fases')
      .update({ label: trimmed })
      .eq('id', fase.id)
    if (!error) { onRename(trimmed); setRenaming(false) }
  }

  return (
    <div className="border border-ink/10">
      {renaming ? (
        /* ── Rename mode ── */
        <div className="flex items-center gap-3 px-4 py-2.5 bg-ink/[0.02]">
          <span className="text-[10px] tracking-widest uppercase font-light text-meta/60 w-6 shrink-0">
            F{fase.numero}
          </span>
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  saveRename()
              if (e.key === 'Escape') { setRenaming(false); setNewLabel(fase.label) }
            }}
            className="flex-1 text-sm font-light text-ink border border-ink/30 px-2 py-1 bg-white focus:outline-none focus:border-ink/60"
          />
          <button onClick={saveRename} className="text-[10px] tracking-widest uppercase font-light text-ink hover:opacity-60 transition-opacity">
            Guardar
          </button>
          <button
            onClick={() => { setRenaming(false); setNewLabel(fase.label) }}
            className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        /* ── Normal mode ── */
        <div className="flex items-stretch group">

          {/* ↑↓ reorder arrows — visible on hover */}
          <div className="flex flex-col justify-center shrink-0 border-r border-ink/8 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onMoveUp() }}
              disabled={isFirst}
              title="Mover arriba"
              className="px-2.5 py-1 text-[9px] text-meta hover:text-ink hover:bg-ink/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors leading-none"
            >
              ▲
            </button>
            <button
              onClick={e => { e.stopPropagation(); onMoveDown() }}
              disabled={isLast}
              title="Mover abajo"
              className="px-2.5 py-1 text-[9px] text-meta hover:text-ink hover:bg-ink/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors leading-none"
            >
              ▼
            </button>
          </div>

          {/* Main row — click to expand tasks */}
          <button
            onClick={onToggle}
            className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-ink/[0.02] transition-colors min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] tracking-widest uppercase font-light text-meta/60 w-6 shrink-0">
                F{fase.numero}
              </span>
              <span className="text-[11px] font-light text-ink text-left truncate">{fase.label}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <span className="text-[10px] text-meta font-light">{tasks.length} tasks</span>
              <span className="text-meta text-xs">{isExpanded ? '▲' : '▼'}</span>
            </div>
          </button>

          {/* Rename / delete — visible on hover */}
          <div className="flex items-center gap-2 pr-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setRenaming(true); setNewLabel(fase.label) }}
              className="text-[9px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
            >
              Renombrar
            </button>
            <span className="text-meta/30 select-none">·</span>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-[9px] tracking-widest uppercase font-light text-meta hover:text-red-500 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Tasks panel */}
      {isExpanded && (
        <div className="border-t border-ink/10">
          {tasks.length === 0 ? (
            <p className="px-4 py-3 text-[10px] text-meta/50 font-light">Sin tasks en esta fase</p>
          ) : (
            tasks.map(task => (
              <TaskRow key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
            ))
          )}
          <AddTaskForm faseId={fase.id} nextOrden={tasks.length} onAdded={onAddTask} />
        </div>
      )}
    </div>
  )
}

// ── Add fase form ─────────────────────────────────────────────────────────────

function AddFaseForm({
  existingSecciones, nextNumero, onAdded, onCancel,
}: {
  existingSecciones: string[]
  nextNumero:        number
  onAdded:           (fase: CatalogoFase) => void
  onCancel:          () => void
}) {
  const [label, setLabel]               = useState('')
  const [seccionSelect, setSeccionSelect] = useState(existingSecciones[0] ?? '')
  const [seccionNueva, setSeccionNueva]  = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const supabase = createClient()

  const isNueva    = seccionSelect === '__nueva__'
  const seccionFinal = isNueva ? seccionNueva.trim() : seccionSelect

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !seccionFinal) return
    setLoading(true)
    setError(null)

    // Insert with nextNumero (guaranteed unique); parent will reassign correct values via applyOrder
    const { data, error: err } = await supabase
      .from('catalogo_fases')
      .insert({ label: label.trim(), seccion: seccionFinal, numero: nextNumero, orden: nextNumero })
      .select('id, numero, label, seccion, orden')
      .single()

    if (err) { setError(err.message); setLoading(false); return }
    if (data) onAdded(data as CatalogoFase)
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="mt-4 border border-ink/15 bg-ink/[0.02] p-4 space-y-3">
      <p className="text-[10px] tracking-widest uppercase font-light text-meta">Nueva fase</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[9px] tracking-widest uppercase font-light text-meta/60 mb-1">
            Nombre de la fase *
          </label>
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej. Estrategia de marca"
            className="w-full text-sm font-light text-ink border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40"
          />
        </div>
        <div>
          <label className="block text-[9px] tracking-widest uppercase font-light text-meta/60 mb-1">
            Sección *
          </label>
          <select
            value={seccionSelect}
            onChange={e => setSeccionSelect(e.target.value)}
            className="w-full text-[11px] font-light text-ink border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40"
          >
            {existingSecciones.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__nueva__">+ Nueva sección…</option>
          </select>
        </div>
      </div>

      {isNueva && (
        <div>
          <label className="block text-[9px] tracking-widest uppercase font-light text-meta/60 mb-1">
            Nombre de la nueva sección *
          </label>
          <input
            autoFocus
            value={seccionNueva}
            onChange={e => setSeccionNueva(e.target.value)}
            placeholder="Ej. Marketing"
            className="w-full text-sm font-light text-ink border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40"
          />
        </div>
      )}

      {error && <p className="text-[10px] text-red-500">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading || !label.trim() || !seccionFinal}
          className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-30"
        >
          {loading ? 'Guardando…' : 'Agregar fase'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlantillaManager({ catalogoFases, initialTasks }: Props) {
  const [localFases, setLocalFases]       = useState<CatalogoFase[]>(catalogoFases)
  const [tasks, setTasks]                 = useState<PlantillaTask[]>(initialTasks)
  const [expandedFases, setExpandedFases] = useState<string[]>([])
  const [showAddFase, setShowAddFase]     = useState(false)
  const [saving, setSaving]               = useState(false)
  const supabase = createClient()

  // Global sort by orden
  const sortedFases = useMemo(
    () => [...localFases].sort((a, b) => a.orden - b.orden),
    [localFases],
  )

  // Sections ordered by their first fase's position
  const secciones = useMemo(() => {
    const seen = new Set<string>()
    for (const f of sortedFases) {
      if (!seen.has(f.seccion)) seen.add(f.seccion)
    }
    return Array.from(seen)
  }, [sortedFases])

  // ── Task helpers ──────────────────────────────────────────────────────────
  const updateTask = (id: string, data: Partial<PlantillaTask>) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  const deleteTask = (id: string) =>
    setTasks(prev => prev.filter(t => t.id !== id))
  const addTask = (task: PlantillaTask) =>
    setTasks(prev => [...prev, task])

  // ── Order helpers ─────────────────────────────────────────────────────────

  /**
   * Given a desired order of fases, assign sequential orden (1..N) and numero (1..N),
   * persist only the rows that changed, and update local state.
   */
  const applyOrder = async (orderedFases: CatalogoFase[]) => {
    setSaving(true)
    const reassigned = orderedFases.map((f, i) => ({ ...f, orden: i + 1, numero: i + 1 }))
    const changed = reassigned.filter(f => {
      const orig = localFases.find(x => x.id === f.id)
      return !orig || orig.orden !== f.orden || orig.numero !== f.numero
    })
    if (changed.length > 0) {
      await supabase
        .from('catalogo_fases')
        .upsert(changed.map(f => ({ id: f.id, orden: f.orden, numero: f.numero })))
    }
    setLocalFases(reassigned)
    setSaving(false)
  }

  // Move fase up within its section (swaps with previous sibling)
  const moveFaseUp = async (faseId: string) => {
    const fase = localFases.find(f => f.id === faseId)
    if (!fase) return
    const siblings = sortedFases.filter(f => f.seccion === fase.seccion)
    const idx = siblings.findIndex(f => f.id === faseId)
    if (idx <= 0) return
    const prev = siblings[idx - 1]
    const newSorted = [...sortedFases]
    const gi = newSorted.findIndex(f => f.id === faseId)
    const gp = newSorted.findIndex(f => f.id === prev.id)
    ;[newSorted[gi], newSorted[gp]] = [newSorted[gp], newSorted[gi]]
    await applyOrder(newSorted)
  }

  // Move fase down within its section (swaps with next sibling)
  const moveFaseDown = async (faseId: string) => {
    const fase = localFases.find(f => f.id === faseId)
    if (!fase) return
    const siblings = sortedFases.filter(f => f.seccion === fase.seccion)
    const idx = siblings.findIndex(f => f.id === faseId)
    if (idx >= siblings.length - 1) return
    const next = siblings[idx + 1]
    const newSorted = [...sortedFases]
    const gi = newSorted.findIndex(f => f.id === faseId)
    const gn = newSorted.findIndex(f => f.id === next.id)
    ;[newSorted[gi], newSorted[gn]] = [newSorted[gn], newSorted[gi]]
    await applyOrder(newSorted)
  }

  // Rename: only updates label — all data links via fase_id (UUID), not the label
  const renameFase = (faseId: string, newLabel: string) =>
    setLocalFases(prev => prev.map(f => f.id === faseId ? { ...f, label: newLabel } : f))

  // Delete fase + its plantilla_tasks
  const deleteFase = async (faseId: string) => {
    const tasksInFase = tasks.filter(t => t.fase_id === faseId)
    if (
      tasksInFase.length > 0 &&
      !confirm(`Esta fase tiene ${tasksInFase.length} task(s) en la plantilla. ¿Eliminar igualmente?`)
    ) return

    if (tasksInFase.length > 0) {
      await supabase.from('plantilla_tasks').delete().eq('fase_id', faseId)
    }
    const { error } = await supabase.from('catalogo_fases').delete().eq('id', faseId)
    if (error) return

    const remaining = sortedFases.filter(f => f.id !== faseId)
    await applyOrder(remaining)
    setTasks(prev => prev.filter(t => t.fase_id !== faseId))
    setExpandedFases(prev => prev.filter(id => id !== faseId))
  }

  // Add fase: insert after the last existing fase of the same section, then renumber
  const addFase = async (fase: CatalogoFase) => {
    const lastIdx = sortedFases.reduce<number>(
      (last, f, i) => (f.seccion === fase.seccion ? i : last),
      -1,
    )
    const insertAt = lastIdx + 1
    const newSorted = [
      ...sortedFases.slice(0, insertAt),
      fase,
      ...sortedFases.slice(insertAt),
    ]
    await applyOrder(newSorted)
    setShowAddFase(false)
    setExpandedFases(prev => [...prev, fase.id])
  }

  const toggleFase = (faseId: string) =>
    setExpandedFases(prev =>
      prev.includes(faseId) ? prev.filter(id => id !== faseId) : [...prev, faseId]
    )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-2">
          Proyectos · Configuración
        </p>
        <h1 className="text-3xl font-light text-ink tracking-tight mb-2">Plantilla de tasks</h1>
        <p className="text-sm font-light text-meta">
          Tasks genéricos por fase. Se copian automáticamente al iniciar cada fase en un proyecto.
        </p>
      </div>

      <div className="max-w-2xl">
        {secciones.map(seccion => {
          const fases = sortedFases.filter(f => f.seccion === seccion)
          if (fases.length === 0) return null
          return (
            <div key={seccion} className="mb-6">
              <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 mb-2">
                {seccion}
              </p>
              <div className="space-y-2">
                {fases.map((fase, idx) => (
                  <FaseRow
                    key={fase.id}
                    fase={fase}
                    tasks={tasks.filter(t => t.fase_id === fase.id)}
                    isFirst={idx === 0}
                    isLast={idx === fases.length - 1}
                    isExpanded={expandedFases.includes(fase.id)}
                    onToggle={() => toggleFase(fase.id)}
                    onMoveUp={() => moveFaseUp(fase.id)}
                    onMoveDown={() => moveFaseDown(fase.id)}
                    onRename={label => renameFase(fase.id, label)}
                    onDelete={() => deleteFase(fase.id)}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onAddTask={addTask}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {showAddFase ? (
          <AddFaseForm
            existingSecciones={secciones}
            nextNumero={Math.max(0, ...localFases.map(f => f.numero)) + 1}
            onAdded={addFase}
            onCancel={() => setShowAddFase(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddFase(true)}
            className="mt-2 text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors border border-dashed border-ink/20 hover:border-ink/40 px-4 py-3 w-full text-center"
          >
            + Agregar fase
          </button>
        )}

        {saving && (
          <p className="mt-3 text-[9px] tracking-widest uppercase font-light text-meta/50 animate-pulse">
            Guardando orden…
          </p>
        )}
      </div>
    </div>
  )
}

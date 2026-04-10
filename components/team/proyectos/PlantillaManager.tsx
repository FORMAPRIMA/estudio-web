'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CatalogoFase, PlantillaTask } from '@/lib/types'

// ── New exported types ────────────────────────────────────────────────────────

export interface ProyectoNegocio {
  id: string
  nombre: string
  activo: boolean
  orden: number
  visible_para: string[] | null
}

export interface SeccionNegocio {
  id: string
  proyecto_id: string
  nombre: string
  orden: number
}

export interface FaseNegocio {
  id: string
  seccion_id: string
  nombre: string
  orden: number
}

export interface OfertaFP {
  id: string
  nombre: string
  cliente_potencial: string | null
  activo: boolean
  orden: number
  visible_para: string[] | null
}

export interface TeamMemberSimple {
  id: string
  nombre: string
  initials: string
  color: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  catalogoFases:    CatalogoFase[]
  initialTasks:     PlantillaTask[]
  proyectosNegocio: ProyectoNegocio[]
  seccionesNegocio: SeccionNegocio[]
  fasesNegocio:     FaseNegocio[]
  ofertasFP:        OfertaFP[]
  teamMembers:      TeamMemberSimple[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing sub-components (PLANTILLA TAB)
// ─────────────────────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-3 px-4 py-2.5 bg-ink/[0.02]">
          <span className="text-[10px] tracking-widest uppercase font-light text-meta/60 w-6 shrink-0">
            F{fase.numero}
          </span>
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveRename()
              if (e.key === 'Escape') { setRenaming(false); setNewLabel(fase.label) }
            }}
            className="flex-1 text-sm font-light text-ink border border-ink/20 px-2 py-0.5 bg-white focus:outline-none focus:border-ink/40"
          />
          <button onClick={saveRename} className="text-[10px] tracking-widest uppercase font-light text-ink hover:opacity-60">Guardar</button>
          <button onClick={() => { setRenaming(false); setNewLabel(fase.label) }} className="text-[10px] tracking-widest uppercase font-light text-meta">Cancelar</button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-ink/[0.02] transition-colors group"
        >
          <span className="text-[10px] tracking-widest uppercase font-light text-meta/60 w-6 shrink-0">
            F{fase.numero}
          </span>
          <span className="text-sm font-light text-ink flex-1">{fase.label}</span>
          <span className="text-[10px] text-meta/40">{tasks.length} tasks</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2" onClick={e => e.stopPropagation()}>
            <button onClick={onMoveUp} disabled={isFirst} className="px-1.5 py-0.5 text-[10px] text-meta/60 hover:text-ink disabled:opacity-20">↑</button>
            <button onClick={onMoveDown} disabled={isLast} className="px-1.5 py-0.5 text-[10px] text-meta/60 hover:text-ink disabled:opacity-20">↓</button>
            <button onClick={() => setRenaming(true)} className="px-1.5 py-0.5 text-[10px] text-meta/60 hover:text-ink">renombrar</button>
            <button onClick={onDelete} className="px-1.5 py-0.5 text-[10px] text-meta/60 hover:text-red-600">eliminar</button>
          </div>
          <span className="text-meta/40 text-xs ml-1">{isExpanded ? '▴' : '▾'}</span>
        </button>
      )}

      {isExpanded && (
        <div className="border-t border-ink/8">
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
          ))}
          <AddTaskForm
            faseId={fase.id}
            nextOrden={tasks.length + 1}
            onAdded={onAddTask}
          />
        </div>
      )}
    </div>
  )
}

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

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE PICKER — visibility per proyecto / oferta
// ─────────────────────────────────────────────────────────────────────────────

function PeoplePickerField({
  teamMembers, visiblePara, onChange,
}: {
  teamMembers: TeamMemberSimple[]
  visiblePara: string[] | null
  onChange:    (val: string[] | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isTodos = !visiblePara || visiblePara.length === 0
  const selected = teamMembers.filter(m => !isTodos && visiblePara.includes(m.id))

  const toggle = (id: string) => {
    if (isTodos) {
      onChange([id])
    } else {
      const next = visiblePara!.includes(id)
        ? visiblePara!.filter(x => x !== id)
        : [...visiblePara!, id]
      onChange(next.length === 0 ? null : next)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 group/pp"
        title="Configurar visibilidad en Time Tracker"
      >
        {isTodos ? (
          <span className="text-[9px] tracking-widest uppercase font-light text-meta/40 border border-ink/10 px-2 py-0.5 rounded-sm group-hover/pp:border-ink/30 group-hover/pp:text-meta/70 transition-colors">
            Todos
          </span>
        ) : (
          <div className="flex items-center gap-0.5">
            {selected.map(m => (
              <span
                key={m.id}
                style={{ background: m.color }}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white font-bold"
                title={m.nombre}
              >
                {m.initials}
              </span>
            ))}
          </div>
        )}
        <span className="text-[9px] text-meta/30 group-hover/pp:text-meta/60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-ink/15 shadow-lg z-50 min-w-[200px] py-1">
          <p className="px-3 py-1.5 text-[9px] tracking-widest uppercase font-light text-meta/50 border-b border-ink/8">
            Visible en Time Tracker para
          </p>
          <div
            className="flex items-center gap-2 px-3 py-2 hover:bg-ink/5 cursor-pointer"
            onClick={() => { onChange(null); setOpen(false) }}
          >
            <span className="w-4 h-4 rounded-sm border border-ink/20 flex items-center justify-center text-[8px] text-ink/60 shrink-0">
              {isTodos ? '✓' : ''}
            </span>
            <span className={`text-[11px] font-light ${isTodos ? 'text-ink' : 'text-meta'}`}>
              Todo el equipo
            </span>
          </div>
          <div className="border-t border-ink/8" />
          {teamMembers.map(m => {
            const isSelected = !isTodos && visiblePara!.includes(m.id)
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-ink/5 cursor-pointer"
                onClick={() => toggle(m.id)}
              >
                <span
                  style={{ background: isSelected ? m.color : 'transparent', borderColor: isSelected ? m.color : undefined }}
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white font-bold shrink-0 border ${isSelected ? '' : 'border-ink/20'}`}
                >
                  {isSelected ? m.initials : ''}
                </span>
                <span className={`text-[11px] font-light ${isSelected ? 'text-ink' : 'text-meta'}`}>
                  {m.nombre}
                </span>
                {isSelected && <span className="text-[9px] text-ink/30 ml-auto">✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROYECTOS INTERNOS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ProyectosInternosTab({
  initialProyectos, initialSecciones, initialFases, teamMembers,
}: {
  initialProyectos: ProyectoNegocio[]
  initialSecciones: SeccionNegocio[]
  initialFases:     FaseNegocio[]
  teamMembers:      TeamMemberSimple[]
}) {
  const [proyectos, setProyectos] = useState(initialProyectos)
  const [secciones, setSecciones] = useState(initialSecciones)
  const [fases, setFases]         = useState(initialFases)
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())

  // Adding state
  const [addingProyecto, setAddingProyecto]     = useState(false)
  const [newProyectoNombre, setNewProyectoNombre] = useState('')
  const [addingSeccion, setAddingSeccion]         = useState<string | null>(null)
  const [newSeccionNombre, setNewSeccionNombre]   = useState('')
  const [addingFase, setAddingFase]               = useState<string | null>(null)
  const [newFaseNombre, setNewFaseNombre]         = useState('')

  const supabase = createClient()

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // ── CRUD proyectos ────────────────────────────────────────────────────────

  const addProyecto = async () => {
    const nombre = newProyectoNombre.trim()
    if (!nombre) return
    const { data, error } = await supabase
      .from('proyectos_internos')
      .insert({ nombre, orden: proyectos.length })
      .select('id, nombre, activo, orden')
      .single()
    if (!error && data) {
      setProyectos(prev => [...prev, data as ProyectoNegocio])
      setNewProyectoNombre('')
      setAddingProyecto(false)
      setExpanded(prev => new Set(prev).add(data.id))
    }
  }

  const deleteProyecto = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto y todas sus secciones y fases? Los registros de horas existentes no se borran.')) return
    const { error } = await supabase.from('proyectos_internos').delete().eq('id', id)
    if (!error) {
      const sectIds = secciones.filter(s => s.proyecto_id === id).map(s => s.id)
      setProyectos(prev => prev.filter(p => p.id !== id))
      setSecciones(prev => prev.filter(s => s.proyecto_id !== id))
      setFases(prev => prev.filter(f => !sectIds.includes(f.seccion_id)))
    }
  }

  const updateVisibleParaProyecto = async (id: string, visiblePara: string[] | null) => {
    const { error } = await supabase
      .from('proyectos_internos')
      .update({ visible_para: visiblePara })
      .eq('id', id)
    if (!error) setProyectos(prev => prev.map(p => p.id === id ? { ...p, visible_para: visiblePara } : p))
  }

  // ── CRUD secciones ────────────────────────────────────────────────────────

  const addSeccion = async (proyectoId: string) => {
    const nombre = newSeccionNombre.trim()
    if (!nombre) return
    const orden = secciones.filter(s => s.proyecto_id === proyectoId).length
    const { data, error } = await supabase
      .from('proyectos_internos_secciones')
      .insert({ proyecto_id: proyectoId, nombre, orden })
      .select('id, proyecto_id, nombre, orden')
      .single()
    if (!error && data) {
      setSecciones(prev => [...prev, data as SeccionNegocio])
      setNewSeccionNombre('')
      setAddingSeccion(null)
      setExpanded(prev => new Set(prev).add(data.id))
    }
  }

  const deleteSeccion = async (id: string) => {
    if (!confirm('¿Eliminar esta sección y sus fases?')) return
    const { error } = await supabase.from('proyectos_internos_secciones').delete().eq('id', id)
    if (!error) {
      setSecciones(prev => prev.filter(s => s.id !== id))
      setFases(prev => prev.filter(f => f.seccion_id !== id))
    }
  }

  // ── CRUD fases ────────────────────────────────────────────────────────────

  const addFase = async (seccionId: string) => {
    const nombre = newFaseNombre.trim()
    if (!nombre) return
    const orden = fases.filter(f => f.seccion_id === seccionId).length
    const { data, error } = await supabase
      .from('proyectos_internos_fases')
      .insert({ seccion_id: seccionId, nombre, orden })
      .select('id, seccion_id, nombre, orden')
      .single()
    if (!error && data) {
      setFases(prev => [...prev, data as FaseNegocio])
      setNewFaseNombre('')
      setAddingFase(null)
    }
  }

  const deleteFase = async (id: string) => {
    const { error } = await supabase.from('proyectos_internos_fases').delete().eq('id', id)
    if (!error) setFases(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-light text-meta mb-6">
        Proyectos de negocio internos: marketing, producto, formación, etc.
        Aparecen en el Time Tracker para registrar las horas invertidas.
      </p>

      {proyectos.map(proyecto => {
        const proySecciones = secciones.filter(s => s.proyecto_id === proyecto.id)
        const totalFases    = proySecciones.reduce((acc, s) => acc + fases.filter(f => f.seccion_id === s.id).length, 0)
        const isOpen        = expanded.has(proyecto.id)

        return (
          <div key={proyecto.id} className="mb-3 border border-ink/10">
            {/* Proyecto header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-ink/[0.02] group">
              <button onClick={() => toggle(proyecto.id)} className="text-meta/60 text-xs w-4 shrink-0 text-left">
                {isOpen ? '▾' : '▸'}
              </button>
              <span className="text-sm font-light text-ink flex-1">{proyecto.nombre}</span>
              <span className="text-[10px] text-meta/40">
                {proySecciones.length} secciones · {totalFases} fases
              </span>
              <div className="mx-2" onClick={e => e.stopPropagation()}>
                <PeoplePickerField
                  teamMembers={teamMembers}
                  visiblePara={proyecto.visible_para}
                  onChange={val => updateVisibleParaProyecto(proyecto.id, val)}
                />
              </div>
              <button
                onClick={() => deleteProyecto(proyecto.id)}
                className="text-[10px] tracking-widest uppercase font-light text-meta/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                Eliminar
              </button>
            </div>

            {isOpen && (
              <div>
                {proySecciones.map(seccion => {
                  const secFases    = fases.filter(f => f.seccion_id === seccion.id)
                  const isSecOpen   = expanded.has(seccion.id)

                  return (
                    <div key={seccion.id} className="border-t border-ink/5">
                      {/* Sección header */}
                      <div className="flex items-center gap-2 px-8 py-2 group/sec">
                        <button onClick={() => toggle(seccion.id)} className="text-meta/40 text-xs w-4 shrink-0 text-left">
                          {isSecOpen ? '▾' : '▸'}
                        </button>
                        <span className="text-xs font-light text-ink/80 flex-1 uppercase tracking-widest">{seccion.nombre}</span>
                        <span className="text-[10px] text-meta/40 mr-2">{secFases.length} fases</span>
                        <button
                          onClick={() => deleteSeccion(seccion.id)}
                          className="text-[10px] text-meta/30 hover:text-red-500 transition-colors opacity-0 group-hover/sec:opacity-100"
                        >
                          Eliminar
                        </button>
                      </div>

                      {isSecOpen && (
                        <div className="pb-1">
                          {secFases.map(fase => (
                            <div key={fase.id} className="flex items-center gap-2 px-14 py-1.5 border-t border-ink/5 group/fase">
                              <span className="text-[11px] font-light text-soft flex-1">{fase.nombre}</span>
                              <button
                                onClick={() => deleteFase(fase.id)}
                                className="text-[11px] text-meta/30 hover:text-red-500 opacity-0 group-hover/fase:opacity-100"
                              >×</button>
                            </div>
                          ))}

                          {addingFase === seccion.id ? (
                            <div className="flex items-center gap-2 px-14 py-2 border-t border-ink/5">
                              <input
                                autoFocus
                                value={newFaseNombre}
                                onChange={e => setNewFaseNombre(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') addFase(seccion.id)
                                  if (e.key === 'Escape') { setAddingFase(null); setNewFaseNombre('') }
                                }}
                                placeholder="Nombre de la fase…"
                                className="flex-1 text-xs font-light border border-ink/20 px-2 py-1 focus:outline-none bg-white"
                              />
                              <button onClick={() => addFase(seccion.id)} className="text-[10px] text-ink hover:opacity-60">Agregar</button>
                              <button onClick={() => { setAddingFase(null); setNewFaseNombre('') }} className="text-[10px] text-meta">Cancelar</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingFase(seccion.id); setNewFaseNombre('') }}
                              className="w-full text-left px-14 py-2 text-[10px] tracking-widest uppercase font-light text-meta/40 hover:text-meta border-t border-ink/5"
                            >
                              + Agregar fase
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add sección */}
                {addingSeccion === proyecto.id ? (
                  <div className="flex items-center gap-2 px-8 py-2 border-t border-ink/10">
                    <input
                      autoFocus
                      value={newSeccionNombre}
                      onChange={e => setNewSeccionNombre(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addSeccion(proyecto.id)
                        if (e.key === 'Escape') { setAddingSeccion(null); setNewSeccionNombre('') }
                      }}
                      placeholder="Nombre de la sección…"
                      className="flex-1 text-xs font-light border border-ink/20 px-2 py-1 focus:outline-none bg-white"
                    />
                    <button onClick={() => addSeccion(proyecto.id)} className="text-[10px] text-ink hover:opacity-60">Agregar</button>
                    <button onClick={() => { setAddingSeccion(null); setNewSeccionNombre('') }} className="text-[10px] text-meta">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingSeccion(proyecto.id); setNewSeccionNombre('') }}
                    className="w-full text-left px-8 py-2 text-[10px] tracking-widest uppercase font-light text-meta/40 hover:text-meta border-t border-ink/10"
                  >
                    + Agregar sección
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add proyecto */}
      {addingProyecto ? (
        <div className="border border-dashed border-ink/30 p-4 mt-3">
          <input
            autoFocus
            value={newProyectoNombre}
            onChange={e => setNewProyectoNombre(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addProyecto()
              if (e.key === 'Escape') { setAddingProyecto(false); setNewProyectoNombre('') }
            }}
            placeholder="Nombre del proyecto (ej. Marketing, Producto, Formación…)"
            className="w-full text-sm font-light border border-ink/20 px-3 py-2 mb-3 focus:outline-none bg-white"
          />
          <div className="flex gap-3">
            <button
              onClick={addProyecto}
              disabled={!newProyectoNombre.trim()}
              className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 disabled:opacity-30"
            >
              Crear proyecto
            </button>
            <button
              onClick={() => { setAddingProyecto(false); setNewProyectoNombre('') }}
              className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingProyecto(true)}
          className="mt-3 text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors border border-dashed border-ink/20 hover:border-ink/40 px-4 py-3 w-full text-center"
        >
          + Nuevo proyecto interno
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OFERTAS TAB
// ─────────────────────────────────────────────────────────────────────────────

function OfertasTab({ initialOfertas, teamMembers }: { initialOfertas: OfertaFP[]; teamMembers: TeamMemberSimple[] }) {
  const [ofertas, setOfertas] = useState(initialOfertas)
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ nombre: '', cliente_potencial: '' })
  const supabase = createClient()

  const addOferta = async () => {
    const nombre = form.nombre.trim()
    if (!nombre) return
    const { data, error } = await supabase
      .from('ofertas_fp')
      .insert({ nombre, cliente_potencial: form.cliente_potencial.trim() || null, orden: ofertas.length })
      .select('id, nombre, cliente_potencial, activo, orden')
      .single()
    if (!error && data) {
      setOfertas(prev => [...prev, data as OfertaFP])
      setForm({ nombre: '', cliente_potencial: '' })
      setAdding(false)
    }
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    const { error } = await supabase.from('ofertas_fp').update({ activo }).eq('id', id)
    if (!error) setOfertas(prev => prev.map(o => o.id === id ? { ...o, activo } : o))
  }

  const deleteOferta = async (id: string) => {
    if (!confirm('¿Eliminar esta oferta? Los registros de horas existentes no se borran.')) return
    const { error } = await supabase.from('ofertas_fp').delete().eq('id', id)
    if (!error) setOfertas(prev => prev.filter(o => o.id !== id))
  }

  const updateVisibleParaOferta = async (id: string, visiblePara: string[] | null) => {
    const { error } = await supabase.from('ofertas_fp').update({ visible_para: visiblePara }).eq('id', id)
    if (!error) setOfertas(prev => prev.map(o => o.id === id ? { ...o, visible_para: visiblePara } : o))
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-light text-meta mb-6">
        Proyectos en negociación. Registra las horas invertidas en ofertas antes de que se conviertan en proyectos contratados.
        Las ofertas marcadas como cerradas dejan de aparecer en el Time Tracker.
      </p>

      {ofertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {ofertas.map(oferta => (
            <div key={oferta.id} className="flex items-center gap-3 px-4 py-3 border border-ink/10 group">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-light ${oferta.activo ? 'text-ink' : 'text-meta/50 line-through'}`}>
                  {oferta.nombre}
                </p>
                {oferta.cliente_potencial && (
                  <p className="text-[10px] text-meta font-light mt-0.5">{oferta.cliente_potencial}</p>
                )}
              </div>
              <PeoplePickerField
                teamMembers={teamMembers}
                visiblePara={oferta.visible_para}
                onChange={val => updateVisibleParaOferta(oferta.id, val)}
              />
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={oferta.activo}
                  onChange={e => toggleActivo(oferta.id, e.target.checked)}
                  className="accent-ink"
                />
                <span className="text-[10px] tracking-widest uppercase font-light text-meta">
                  {oferta.activo ? 'Activa' : 'Cerrada'}
                </span>
              </label>
              <button
                onClick={() => deleteOferta(oferta.id)}
                className="text-[10px] tracking-widest uppercase font-light text-meta/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="border border-dashed border-ink/30 p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[9px] tracking-widest uppercase font-light text-meta/60 mb-1">
                Nombre del proyecto *
              </label>
              <input
                autoFocus
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') addOferta()
                  if (e.key === 'Escape') { setAdding(false); setForm({ nombre: '', cliente_potencial: '' }) }
                }}
                placeholder="Ej. Villa García"
                className="w-full text-sm font-light border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40"
              />
            </div>
            <div>
              <label className="block text-[9px] tracking-widest uppercase font-light text-meta/60 mb-1">
                Cliente potencial
              </label>
              <input
                value={form.cliente_potencial}
                onChange={e => setForm(f => ({ ...f, cliente_potencial: e.target.value }))}
                placeholder="Nombre del cliente"
                className="w-full text-sm font-light border border-ink/20 px-2 py-1.5 bg-white focus:outline-none focus:border-ink/40"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={addOferta}
              disabled={!form.nombre.trim()}
              className="text-[10px] tracking-widest uppercase font-light px-4 py-2 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-30"
            >
              Agregar oferta
            </button>
            <button
              onClick={() => { setAdding(false); setForm({ nombre: '', cliente_potencial: '' }) }}
              className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors border border-dashed border-ink/20 hover:border-ink/40 px-4 py-3 w-full text-center"
        >
          + Agregar oferta
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PlantillaManager({
  catalogoFases, initialTasks, proyectosNegocio, seccionesNegocio, fasesNegocio, ofertasFP, teamMembers,
}: Props) {
  const [activeTab, setActiveTab]         = useState<'plantilla' | 'internos' | 'ofertas'>('plantilla')
  const [localFases, setLocalFases]       = useState<CatalogoFase[]>(catalogoFases)
  const [tasks, setTasks]                 = useState<PlantillaTask[]>(initialTasks)
  const [expandedFases, setExpandedFases] = useState<string[]>([])
  const [showAddFase, setShowAddFase]     = useState(false)
  const [saving, setSaving]               = useState(false)
  const supabase = createClient()

  const sortedFases = useMemo(
    () => [...localFases].sort((a, b) => a.orden - b.orden),
    [localFases],
  )

  const secciones = useMemo(() => {
    const seen = new Set<string>()
    for (const f of sortedFases) {
      if (!seen.has(f.seccion)) seen.add(f.seccion)
    }
    return Array.from(seen)
  }, [sortedFases])

  const updateTask = (id: string, data: Partial<PlantillaTask>) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  const deleteTask = (id: string) =>
    setTasks(prev => prev.filter(t => t.id !== id))
  const addTask = (task: PlantillaTask) =>
    setTasks(prev => [...prev, task])

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

  const renameFase = (faseId: string, newLabel: string) =>
    setLocalFases(prev => prev.map(f => f.id === faseId ? { ...f, label: newLabel } : f))

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

  const TABS = [
    { id: 'plantilla' as const, label: 'Plantilla de tasks' },
    { id: 'internos'  as const, label: 'Proyectos internos' },
    { id: 'ofertas'   as const, label: 'Ofertas' },
  ]

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-2">
          Proyectos · Configuración
        </p>
        <h1 className="text-3xl font-light text-ink tracking-tight mb-2">Plantilla y recursos</h1>
        <p className="text-sm font-light text-meta">
          Gestiona la plantilla de tasks, proyectos internos y ofertas activas para el Time Tracker.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-ink/10 mb-8">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-[10px] tracking-widest uppercase font-light transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-ink border-ink'
                : 'text-meta border-transparent hover:text-ink hover:border-ink/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Plantilla */}
      {activeTab === 'plantilla' && (
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
      )}

      {/* Tab: Proyectos Internos */}
      {activeTab === 'internos' && (
        <ProyectosInternosTab
          initialProyectos={proyectosNegocio}
          initialSecciones={seccionesNegocio}
          initialFases={fasesNegocio}
          teamMembers={teamMembers}
        />
      )}

      {/* Tab: Ofertas */}
      {activeTab === 'ofertas' && (
        <OfertasTab initialOfertas={ofertasFP} teamMembers={teamMembers} />
      )}
    </div>
  )
}

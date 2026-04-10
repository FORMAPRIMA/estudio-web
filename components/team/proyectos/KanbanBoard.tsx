'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateProyectoStatus } from '@/app/actions/proyectos'
import type { ProyectoInterno, ProyectoStatus, CatalogoFase, UserProfile } from '@/lib/types'
import ProyectoModal from './ProyectoModal'

interface Props {
  proyectos: ProyectoInterno[]
  catalogoFases: CatalogoFase[]
  clientes: { id: string; nombre: string; apellidos: string | null; empresa: string | null }[]
  teamMembers: UserProfile[]
  currentUserId: string
  currentUserRole: string
  progressByProject: Record<string, number>
  horasByProject: Record<string, number>
  horasIniciadasByProject: Record<string, number>
  horasEjecutadasByProject: Record<string, number>
  completedFaseKeys: Set<string>
}

const COLUMNS: { status: ProyectoStatus; label: string }[] = [
  { status: 'activo',    label: 'Activos' },
  { status: 'on_hold',   label: 'On Hold' },
  { status: 'terminado', label: 'Terminados' },
  { status: 'archivado', label: 'Archivados' },
]

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function ProyectoCard({
  proyecto,
  progress,
  horasObjetivo,
  horasIniciadas,
  horasEjecutadas,
  completedFaseKeys,
  canDrag,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  proyecto: ProyectoInterno
  progress: number
  horasObjetivo: number
  horasIniciadas: number
  horasEjecutadas: number
  completedFaseKeys: Set<string>
  canDrag: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const fases = [...(proyecto.proyecto_fases ?? [])].sort(
    (a, b) => (a.catalogo_fases?.orden ?? 0) - (b.catalogo_fases?.orden ?? 0)
  )

  return (
    <div
      draggable={canDrag}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(proyecto.id) }}
      onDragEnd={onDragEnd}
      className={`transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <Link
        href={`/team/proyectos/${proyecto.id}`}
        draggable={false}
        className="block border border-ink/10 hover:border-ink/30 transition-colors bg-white group"
      >
        {/* Image */}
        <div className="w-full h-32 bg-ink/5 overflow-hidden flex items-center justify-center relative">
          {proyecto.imagen_url ? (
            <img
              src={proyecto.imagen_url}
              alt={proyecto.nombre}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              draggable={false}
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

          {proyecto.nivel_calidad && (
            <span className={`inline-block text-[8px] tracking-widest uppercase font-medium px-2 py-0.5 border ${
              proyecto.nivel_calidad === 'master_piece' ? 'bg-amber-50 border-amber-300 text-amber-700' :
              proyecto.nivel_calidad === 'select'       ? 'bg-indigo-50 border-indigo-200 text-indigo-600' :
              'bg-ink/5 border-ink/20 text-meta'
            }`}>
              {proyecto.nivel_calidad === 'master_piece' ? 'Master Piece' :
               proyecto.nivel_calidad === 'select'       ? 'Select' : 'Functional'}
            </span>
          )}

          {fases.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {fases.map(pf => {
                const done    = completedFaseKeys.has(`${proyecto.id}__${pf.fase_id}`)
                const started = pf.fase_status === 'iniciada' && !done
                return (
                  <span
                    key={pf.id}
                    className={`text-[9px] tracking-widest uppercase font-light px-1.5 py-0.5 border ${
                      done
                        ? 'bg-green-600 border-green-600 text-white'
                        : started
                          ? 'bg-ink/70 border-ink/70 text-white'
                          : 'border-ink/15 text-meta'
                    }`}
                  >
                    F{pf.catalogo_fases?.numero}
                  </span>
                )
              })}
            </div>
          )}

          <div className="pt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-[2px] bg-ink/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink/40 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[9px] font-light text-ink tabular-nums shrink-0">{progress}%</span>
            </div>
            {horasIniciadas > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-light text-meta/40 tracking-wide">Iniciadas</span>
                <p className="text-[10px] font-light tabular-nums">
                  <span className={horasEjecutadas > horasIniciadas ? 'text-amber-500' : 'text-meta/50'}>{Math.round(horasEjecutadas * 10) / 10} hrs.</span>
                  <span className="text-meta/30 mx-1">/</span>
                  <span className="text-ink">{Math.round(horasIniciadas * 10) / 10} hrs.</span>
                </p>
              </div>
            )}
            {horasObjetivo > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-light text-meta/40 tracking-wide">Total</span>
                <p className="text-[10px] font-light tabular-nums">
                  <span className={horasEjecutadas > horasObjetivo ? 'text-amber-500' : 'text-meta/50'}>{Math.round(horasEjecutadas * 10) / 10} hrs.</span>
                  <span className="text-meta/30 mx-1">/</span>
                  <span className="text-ink">{Math.round(horasObjetivo * 10) / 10} hrs.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}

function KanbanColumn({
  status,
  label,
  proyectos,
  progressByProject,
  horasByProject,
  horasIniciadasByProject,
  horasEjecutadasByProject,
  completedFaseKeys,
  canDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  draggedId,
  canDrag,
  onDragStart,
  onDragEnd,
}: {
  status: ProyectoStatus
  label: string
  proyectos: ProyectoInterno[]
  progressByProject: Record<string, number>
  horasByProject: Record<string, number>
  horasIniciadasByProject: Record<string, number>
  horasEjecutadasByProject: Record<string, number>
  completedFaseKeys: Set<string>
  canDrop: boolean
  isDragOver: boolean
  onDragOver: (status: ProyectoStatus) => void
  onDragLeave: () => void
  onDrop: (status: ProyectoStatus) => void
  draggedId: string | null
  canDrag: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
}) {
  return (
    <div
      className={`flex flex-col shrink-0 w-72 lg:w-auto lg:min-w-0 transition-colors rounded-sm ${isDragOver && canDrop ? 'bg-ink/[0.03] ring-1 ring-ink/20' : ''}`}
      onDragOver={e => { if (canDrop) { e.preventDefault(); onDragOver(status) } }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); if (canDrop) onDrop(status) }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta">{label}</p>
        <span className="text-[9px] text-meta/60 font-light">{proyectos.length}</span>
      </div>
      <div className={`space-y-3 flex-1 min-h-[80px] p-1 ${isDragOver && canDrop ? 'ring-1 ring-dashed ring-ink/20' : ''}`}>
        {proyectos.map(p => (
          <ProyectoCard
            key={p.id}
            proyecto={p}
            progress={progressByProject[p.id] ?? 0}
            horasObjetivo={horasByProject[p.id] ?? 0}
            horasIniciadas={horasIniciadasByProject[p.id] ?? 0}
            horasEjecutadas={horasEjecutadasByProject[p.id] ?? 0}
            completedFaseKeys={completedFaseKeys}
            canDrag={canDrag}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedId === p.id}
          />
        ))}
        {proyectos.length === 0 && (
          <div className={`border border-dashed px-4 py-6 text-center transition-colors ${isDragOver && canDrop ? 'border-ink/30 bg-ink/[0.02]' : 'border-ink/10'}`}>
            <p className="text-[10px] text-meta/50 font-light">{isDragOver && canDrop ? 'Soltar aquí' : 'Sin proyectos'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({
  proyectos: initialProyectos,
  catalogoFases,
  clientes,
  teamMembers,
  currentUserId,
  currentUserRole,
  progressByProject,
  horasByProject,
  horasIniciadasByProject,
  horasEjecutadasByProject,
  completedFaseKeys,
}: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [localProyectos, setLocalProyectos] = useState<ProyectoInterno[]>(initialProyectos)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ProyectoStatus | null>(null)
  const [mobileFilter, setMobileFilter] = useState<ProyectoStatus>('activo')
  const draggedFromStatus = useRef<ProyectoStatus | null>(null)

  const canEdit = currentUserRole === 'fp_partner' || currentUserRole === 'fp_manager'

  // Sync local state when server sends fresh data (after router.refresh())
  useEffect(() => {
    if (!draggedId) setLocalProyectos(initialProyectos)
  }, [initialProyectos])

  const byStatus = (status: ProyectoStatus) =>
    localProyectos.filter(p => (p.status ?? 'activo') === status)

  const handleDragStart = (id: string) => {
    setDraggedId(id)
    const p = localProyectos.find(p => p.id === id)
    draggedFromStatus.current = (p?.status ?? 'activo') as ProyectoStatus
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverCol(null)
    draggedFromStatus.current = null
  }

  const handleDrop = async (targetStatus: ProyectoStatus) => {
    if (!draggedId) return
    const currentStatus = draggedFromStatus.current
    setDraggedId(null)
    setDragOverCol(null)
    draggedFromStatus.current = null

    if (currentStatus === targetStatus) return

    // Optimistic update
    setLocalProyectos(prev =>
      prev.map(p => p.id === draggedId ? { ...p, status: targetStatus } : p)
    )

    const result = await updateProyectoStatus(draggedId, targetStatus)
    if (result.error) {
      // Revert on error
      setLocalProyectos(prev =>
        prev.map(p => p.id === draggedId ? { ...p, status: currentStatus ?? 'activo' } : p)
      )
    }
  }

  return (
    <>
      <div className="p-8 lg:p-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-2">
              Área interna
            </p>
            <h1 className="text-3xl font-light text-ink tracking-tight">Proyectos</h1>
          </div>
          {canEdit && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-[10px] tracking-widest uppercase font-light px-4 py-2.5 border border-ink/30 text-ink hover:bg-ink hover:text-cream transition-colors"
            >
              + Agregar proyecto
            </button>
          )}
        </div>

        {canEdit && (
          <p className="hidden sm:block text-[9px] text-meta/40 font-light tracking-widest uppercase mb-6">
            Arrastra las tarjetas para cambiar su estado
          </p>
        )}

        {/* Mobile: status filter tabs */}
        <div className="flex sm:hidden gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {COLUMNS.map(col => {
            const count = byStatus(col.status).length
            const active = mobileFilter === col.status
            return (
              <button
                key={col.status}
                onClick={() => setMobileFilter(col.status)}
                style={{
                  flexShrink: 0,
                  padding: '7px 16px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: active ? '#1A1A1A' : 'rgba(26,26,26,0.15)',
                  background: active ? '#1A1A1A' : '#fff',
                  color: active ? '#fff' : '#888',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.02em',
                }}
              >
                {col.label}{count > 0 ? ` · ${count}` : ''}
              </button>
            )
          })}
        </div>

        {/* Mobile: single column view */}
        <div className="block sm:hidden">
          {(() => {
            const col = COLUMNS.find(c => c.status === mobileFilter)!
            return (
              <KanbanColumn
                status={col.status}
                label={col.label}
                proyectos={byStatus(col.status)}
                progressByProject={progressByProject}
                horasByProject={horasByProject}
                horasIniciadasByProject={horasIniciadasByProject}
                horasEjecutadasByProject={horasEjecutadasByProject}
                completedFaseKeys={completedFaseKeys}
                canDrop={false}
                isDragOver={false}
                onDragOver={() => {}}
                onDragLeave={() => {}}
                onDrop={() => {}}
                draggedId={null}
                canDrag={false}
                onDragStart={() => {}}
                onDragEnd={() => {}}
              />
            )
          })()}
        </div>

        {/* Desktop: horizontal scroll / 4-col grid */}
        <div className="hidden sm:flex gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pb-0">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              proyectos={byStatus(col.status)}
              progressByProject={progressByProject}
              horasByProject={horasByProject}
              horasIniciadasByProject={horasIniciadasByProject}
              horasEjecutadasByProject={horasEjecutadasByProject}
              completedFaseKeys={completedFaseKeys}
              canDrop={canEdit && !!draggedId && draggedFromStatus.current !== col.status}
              isDragOver={dragOverCol === col.status}
              onDragOver={setDragOverCol}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={handleDrop}
              draggedId={draggedId}
              canDrag={canEdit}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </div>

      {modalOpen && (
        <ProyectoModal
          catalogoFases={catalogoFases}
          clientes={clientes}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          onCreated={() => { router.refresh(); setModalOpen(false) }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

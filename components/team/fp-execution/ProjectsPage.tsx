'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { createProject, updateProject, deleteProject } from '@/app/actions/fpe-projects'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectStatus = 'borrador' | 'scope_ready' | 'tender_launched' | 'awarded' | 'contracted' | 'archived'

interface Project {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  ciudad: string | null
  linked_proyecto_id: string | null
  status: ProjectStatus
  readiness_score: number
  created_at: string
}

interface LinkedProyecto { id: string; nombre: string; codigo: string | null }

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  borrador:        'Borrador',
  scope_ready:     'Scope listo',
  tender_launched: 'En licitación',
  awarded:         'Adjudicado',
  contracted:      'Contratado',
  archived:        'Archivado',
}

const STATUS_COLORS: Record<ProjectStatus, { bg: string; color: string }> = {
  borrador:        { bg: '#F3F4F6', color: '#6B7280' },
  scope_ready:     { bg: '#EBF5FF', color: '#378ADD' },
  tender_launched: { bg: '#FEF3C7', color: '#D97706' },
  awarded:         { bg: '#ECFDF5', color: '#059669' },
  contracted:      { bg: '#D1FAE5', color: '#065F46' },
  archived:        { bg: '#F9FAFB', color: '#9CA3AF' },
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '10px 16px', fontSize: 9, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.07)', textAlign: 'left',
}
const TD: React.CSSProperties = {
  padding: '13px 16px', fontSize: 12, color: '#2A2A2A',
  verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8',
}

const S = {
  label:    { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:    { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  select:   { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8',
    color: primary ? '#fff' : '#555',
  }),
  btnSm: (): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: '#F0EEE8', color: '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

// ── Project Modal ─────────────────────────────────────────────────────────────

function ProjectModal({
  initial,
  linkedProyectos,
  onClose,
  onSaved,
}: {
  initial: Project | null
  linkedProyectos: LinkedProyecto[]
  onClose: () => void
  onSaved: (p: Project) => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [direccion, setDireccion] = useState(initial?.direccion ?? '')
  const [ciudad, setCiudad] = useState(initial?.ciudad ?? '')
  const [linkedId, setLinkedId] = useState(initial?.linked_proyecto_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError(null)

    const payload = {
      nombre:             nombre.trim(),
      descripcion:        descripcion.trim() || null,
      direccion:          direccion.trim() || null,
      ciudad:             ciudad.trim() || null,
      linked_proyecto_id: linkedId || null,
    }

    if (initial) {
      const res = await updateProject(initial.id, payload)
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({ ...initial, ...payload })
    } else {
      const res = await createProject(payload)
      setSaving(false)
      if ('error' in res) { setError(res.error); return }
      onSaved({
        id: res.id,
        ...payload,
        status: 'borrador',
        readiness_score: 0,
        created_at: new Date().toISOString(),
      })
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del proyecto…" style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Breve descripción…" style={S.textarea} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14 }}>
              <div>
                <label style={S.label}>Dirección</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle y número…" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Ciudad</label>
                <input value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Madrid" style={S.input} />
              </div>
            </div>
            {linkedProyectos.length > 0 && (
              <div>
                <label style={S.label}>Proyecto FP interno (opcional)</label>
                <select value={linkedId} onChange={e => setLinkedId(e.target.value)} style={S.select}>
                  <option value="">Sin vincular</option>
                  {linkedProyectos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
                {error}
              </div>
            )}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '24px 24px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>¿Eliminar proyecto?</p>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Se eliminará <strong>{label}</strong> incluyendo su scope, documentos y licitaciones. Esta acción no se puede deshacer.</p>
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={S.btn()}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...S.btn(), background: '#DC2626', color: '#fff' }}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 4, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Readiness Bar ─────────────────────────────────────────────────────────────

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? '#059669' : score >= 50 ? '#378ADD' : score >= 20 ? '#D97706' : '#E8E6E0'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, color: '#999', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{score}%</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage({
  initialProjects,
  linkedProyectos,
}: {
  initialProjects: Project[]
  linkedProyectos: LinkedProyecto[]
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('')
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; project: Project } | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const filtered = useMemo(() => {
    let list = projects
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.ciudad ?? '').toLowerCase().includes(q) ||
        (p.descripcion ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter)
    return list
  }, [projects, search, statusFilter])

  const linkedMap: Record<string, LinkedProyecto> = {}
  for (const lp of linkedProyectos) linkedMap[lp.id] = lp

  const handleSaved = (saved: Project) => {
    const exists = projects.find(p => p.id === saved.id)
    if (exists) setProjects(prev => prev.map(p => p.id === saved.id ? saved : p))
    else setProjects(prev => [saved, ...prev])
    setModal(null)
  }

  const handleDelete = async (project: Project) => {
    const res = await deleteProject(project.id)
    if ('error' in res) { alert(res.error); return }
    setProjects(prev => prev.filter(p => p.id !== project.id))
    setDeleting(null)
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>FP Execution</p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Proyectos</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>{projects.length} proyectos</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} style={{ ...S.btn(true), padding: '9px 18px', fontSize: 13 }}>
          + Nuevo proyecto
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, ciudad…"
          style={{ ...S.input, maxWidth: 300, fontSize: 13 }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ProjectStatus | '')} style={{ ...S.select, width: 'auto', fontSize: 13 }}>
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#BBB' }}>
          {search || statusFilter ? (
            <p style={{ fontSize: 13 }}>Sin resultados para los filtros actuales.</p>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#888' }}>Sin proyectos</p>
              <p style={{ fontSize: 13, marginBottom: 20 }}>Crea el primer proyecto para empezar a definir el scope.</p>
              <button onClick={() => setModal({ mode: 'create' })} style={S.btn(true)}>+ Nuevo proyecto</button>
            </>
          )}
        </div>
      ) : (
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1A1A1A' }}>
                <th style={TH}>Proyecto</th>
                <th style={TH}>Ciudad</th>
                <th style={TH}>Estado</th>
                <th style={{ ...TH, minWidth: 140 }}>Readiness</th>
                <th style={TH}>Proyecto FP</th>
                <th style={TH}>Creado</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((project, i) => (
                <tr
                  key={project.id}
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F4EF' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? '#fff' : '#FAFAF8' }}
                >
                  <td style={TD}>
                    <Link
                      href={`/team/fp-execution/projects/${project.id}`}
                      style={{ textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ fontWeight: 600, color: '#1A1A1A' }}>{project.nombre}</div>
                      {project.descripcion && (
                        <div style={{ fontSize: 11, color: '#AAA', marginTop: 2, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.descripcion}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td style={{ ...TD, color: '#666' }}>{project.ciudad ?? <span style={{ color: '#CCC' }}>—</span>}</td>
                  <td style={TD}><StatusBadge status={project.status} /></td>
                  <td style={{ ...TD, minWidth: 140 }}><ReadinessBar score={project.readiness_score} /></td>
                  <td style={{ ...TD, fontSize: 11, color: '#888' }}>
                    {project.linked_proyecto_id && linkedMap[project.linked_proyecto_id]
                      ? linkedMap[project.linked_proyecto_id].nombre
                      : <span style={{ color: '#DDD' }}>—</span>
                    }
                  </td>
                  <td style={{ ...TD, color: '#999', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(project.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link
                      href={`/team/fp-execution/projects/${project.id}`}
                      style={{ ...S.btnSm(), textDecoration: 'none', display: 'inline-block', marginRight: 4 }}
                      onClick={e => e.stopPropagation()}
                    >
                      Scope →
                    </Link>
                    <button
                      onClick={e => { e.stopPropagation(); setModal({ mode: 'edit', project }) }}
                      style={{ ...S.btnSm(), marginRight: 4 }}
                    >Editar</button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleting(project) }}
                      style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#FEE2E2', color: '#DC2626', fontFamily: 'inherit', fontWeight: 600 }}
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal && (
        <ProjectModal
          initial={modal.mode === 'edit' ? modal.project : null}
          linkedProyectos={linkedProyectos}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <ConfirmDelete
          label={deleting.nombre}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

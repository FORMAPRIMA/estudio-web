'use client'

import React, { useState, useRef } from 'react'
import { deleteDocument, getDocumentSignedUrl } from '@/app/actions/fpe-documents'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FpeDoc {
  id: string
  project_id: string
  project_unit_id: string | null
  nombre: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  discipline_tags: string[]
  uploaded_by: string | null
  created_at: string
}

interface ProjectUnit {
  id: string
  template_unit_id: string
  nombre?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCIPLINE_TAGS = [
  'Arquitectura', 'Estructura', 'Instalaciones', 'MEP',
  'Interiorismo', 'Paisajismo', 'Normativa', 'Otros',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeBadge(mime: string | null, nombre: string): { label: string; bg: string; color: string } {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext))
    return { label: 'IMG', bg: '#FEF3C7', color: '#92400E' }
  if (mime === 'application/pdf' || ext === 'pdf')
    return { label: 'PDF', bg: '#FEE2E2', color: '#991B1B' }
  if (['dwg','dxf','rvt','ifc'].includes(ext))
    return { label: ext.toUpperCase(), bg: '#EDE9FE', color: '#5B21B6' }
  if (['xlsx','xls','csv'].includes(ext))
    return { label: 'XLS', bg: '#D1FAE5', color: '#065F46' }
  if (['docx','doc'].includes(ext))
    return { label: 'DOC', bg: '#DBEAFE', color: '#1E40AF' }
  return { label: ext.toUpperCase() || 'FILE', bg: '#F3F4F6', color: '#374151' }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  label:  { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  select: { padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8', color: primary ? '#fff' : '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  projectId,
  projectUnits,
  onClose,
  onUploaded,
}: {
  projectId: string
  projectUnits: ProjectUnit[]
  onClose: () => void
  onUploaded: (doc: FpeDoc) => void
}) {
  const fileRef      = useRef<HTMLInputElement>(null)
  const [file, setFile]         = useState<File | null>(null)
  const [unitId, setUnitId]     = useState<string>('')
  const [tags, setTags]         = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const toggleTag = (t: string) => setTags(prev => {
    const next = new Set(prev)
    if (next.has(t)) next.delete(t); else next.add(t)
    return next
  })

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) { setError('Selecciona un archivo.'); return }
    setUploading(true); setError(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('project_id', projectId)
    if (unitId) fd.append('project_unit_id', unitId)
    fd.append('discipline_tags', JSON.stringify(Array.from(tags)))

    const res = await fetch('/api/fpe-documents/upload', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (!res.ok || json.error) { setError(json.error ?? 'Error subiendo el archivo.'); return }
    onUploaded(json.doc as FpeDoc)
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Subir documento</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? '#378ADD' : '#D1D5DB'}`,
              borderRadius: 8,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? '#EBF5FF' : '#FAFAFA',
              transition: 'all 0.15s',
            }}
          >
            {file ? (
              <>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A5CA8' }}>{file.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888' }}>{formatBytes(file.size)}</p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Arrastra el archivo aquí</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#AAA' }}>o haz clic para seleccionar · Máx. 50 MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }}
            />
          </div>

          {/* Unit selector */}
          {projectUnits.length > 0 && (
            <div>
              <label style={S.label}>Asociar a unidad de ejecución</label>
              <select value={unitId} onChange={e => setUnitId(e.target.value)} style={S.select}>
                <option value="">Documento general del proyecto</option>
                {projectUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre ?? u.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Discipline tags */}
          <div>
            <label style={S.label}>Tags de disciplina</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DISCIPLINE_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 500,
                    background: tags.has(t) ? '#1A1A1A' : '#F0EEE8',
                    color: tags.has(t) ? '#fff' : '#555',
                    transition: 'all 0.1s',
                  }}
                >{t}</button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn()}>Cancelar</button>
          <button onClick={handleUpload} disabled={uploading || !file} style={S.btn(true)}>
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Document Row ──────────────────────────────────────────────────────────────

function DocRow({
  doc,
  onDeleted,
}: {
  doc: FpeDoc
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const badge = fileTypeBadge(doc.mime_type, doc.nombre)

  const handleDownload = async () => {
    setDownloading(true)
    const res = await getDocumentSignedUrl(doc.storage_path)
    setDownloading(false)
    if ('error' in res) { alert(res.error); return }
    window.open(res.url, '_blank')
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    setDeleting(true)
    const res = await deleteDocument(doc.id, doc.storage_path, doc.project_id)
    setDeleting(false)
    if ('error' in res) { alert(res.error); return }
    onDeleted(doc.id)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 6, border: '1px solid #E8E6E0', background: '#fff' }}>
      {/* File type badge */}
      <div style={{ flexShrink: 0, padding: '3px 7px', borderRadius: 4, background: badge.bg, color: badge.color, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em' }}>
        {badge.label}
      </div>

      {/* Name + tags */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.nombre}
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
          {doc.discipline_tags.map(t => (
            <span key={t} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '1px 5px', borderRadius: 3, background: '#F3F4F6', color: '#6B7280' }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Size + date */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 11, color: '#AAA' }}>{formatBytes(doc.size_bytes)}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: '#CCC' }}>
          {new Date(doc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{ padding: '5px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#EBF5FF', color: '#378ADD', fontFamily: 'inherit', fontWeight: 500 }}
        >{downloading ? '…' : 'Ver'}</button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ padding: '5px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#FEE2E2', color: '#DC2626', fontFamily: 'inherit', fontWeight: 600 }}
        >{deleting ? '…' : '×'}</button>
      </div>
    </div>
  )
}

// ── Readiness Panel ───────────────────────────────────────────────────────────

export interface ReadinessCheck {
  key: string
  label: string
  passed: boolean
  pts: number
  blocking: boolean
}

function ReadinessPanel({ score, checks }: { score: number; checks: ReadinessCheck[] }) {
  const canLaunch = checks.filter(c => c.blocking).every(c => c.passed)
  const barColor = score >= 80 ? '#059669' : score >= 50 ? '#378ADD' : score >= 20 ? '#D97706' : '#E8E6E0'

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
          Readiness
        </p>
        <span style={{ fontSize: 14, fontWeight: 700, color: barColor }}>{score}%</span>
      </div>
      {/* Bar */}
      <div style={{ height: 6, background: '#F0EEE8', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${score}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      {/* Checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checks.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{c.passed ? '✓' : '○'}</span>
            <span style={{ fontSize: 12, color: c.passed ? '#1A1A1A' : '#AAA', flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 10, color: c.passed ? barColor : '#DDD', fontWeight: 700 }}>+{c.pts}pts</span>
          </div>
        ))}
      </div>
      {/* Launch status */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E8E6E0' }}>
        {canLaunch ? (
          <p style={{ margin: 0, fontSize: 11, color: '#059669', fontWeight: 600 }}>
            ✓ Listo para lanzar licitación
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: '#AAA' }}>
            Completa los pasos obligatorios para poder lanzar la licitación.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main DocumentHub ──────────────────────────────────────────────────────────

export default function DocumentHub({
  projectId,
  projectUnits,
  initialDocs,
  initialScore,
  initialChecks,
}: {
  projectId: string
  projectUnits: ProjectUnit[]
  initialDocs: FpeDoc[]
  initialScore: number
  initialChecks: ReadinessCheck[]
}) {
  const [docs, setDocs]         = useState<FpeDoc[]>(initialDocs)
  const [score, setScore]       = useState(initialScore)
  const [checks, setChecks]     = useState<ReadinessCheck[]>(initialChecks)
  const [uploading, setUploading] = useState(false)

  const generalDocs = docs.filter(d => !d.project_unit_id)
  const unitDocs    = docs.filter(d => !!d.project_unit_id)

  // Build unit names map
  const unitNames: Record<string, string> = {}
  for (const u of projectUnits) unitNames[u.id] = u.nombre ?? u.id

  // Group unit docs by unit_id
  const docsByUnit: Record<string, FpeDoc[]> = {}
  for (const d of unitDocs) {
    const key = d.project_unit_id!
    if (!docsByUnit[key]) docsByUnit[key] = []
    docsByUnit[key].push(d)
  }

  const handleUploaded = (doc: FpeDoc) => {
    setDocs(prev => [doc, ...prev])
    // Bump score heuristically (re-fetch would be more accurate but adds latency)
    if (!docs.some(d => !d.project_unit_id)) {
      // First general doc → score gains 30pts
      setScore(prev => Math.min(100, prev + 30))
      setChecks(prev => prev.map(c => c.key === 'docs' ? { ...c, passed: true } : c))
    }
    setUploading(false)
  }

  const handleDeleted = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 24, alignItems: 'start' }}>

      {/* ── Left: document lists ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Upload button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Documentación</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{docs.length} archivos subidos</p>
          </div>
          <button onClick={() => setUploading(true)} style={{ ...S.btn(true), padding: '9px 18px', fontSize: 13 }}>
            + Subir documento
          </button>
        </div>

        {/* General docs section */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
            Documentación general del proyecto
          </p>
          {generalDocs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed #E8E6E0', borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#CCC' }}>Sin documentos generales</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#DDD' }}>Sube renders, planos generales, memoria descriptiva…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {generalDocs.map(d => (
                <DocRow key={d.id} doc={d} onDeleted={handleDeleted} />
              ))}
            </div>
          )}
        </div>

        {/* Per-unit docs */}
        {projectUnits.length > 0 && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
              Documentación por unidad de ejecución
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projectUnits.map(u => {
                const uDocs = docsByUnit[u.id] ?? []
                return (
                  <div key={u.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{u.nombre ?? 'Unidad'}</span>
                      <span style={{ fontSize: 10, color: '#CCC' }}>({uDocs.length})</span>
                    </div>
                    {uDocs.length === 0 ? (
                      <div style={{ padding: '10px 14px', border: '1px dashed #E8E6E0', borderRadius: 6 }}>
                        <p style={{ margin: 0, fontSize: 11, color: '#CCC' }}>Sin documentos para esta unidad</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {uDocs.map(d => <DocRow key={d.id} doc={d} onDeleted={handleDeleted} />)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: readiness panel ── */}
      <div style={{ position: 'sticky', top: 24 }}>
        <ReadinessPanel score={score} checks={checks} />
      </div>

      {/* Upload modal */}
      {uploading && (
        <UploadModal
          projectId={projectId}
          projectUnits={projectUnits}
          onClose={() => setUploading(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  )
}

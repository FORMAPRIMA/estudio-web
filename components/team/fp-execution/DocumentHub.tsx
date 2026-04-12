'use client'

import React, { useState, useRef, useCallback } from 'react'
import { deleteDocument, getDocumentSignedUrl, getReadinessChecks } from '@/app/actions/fpe-documents'
import { saveUnitQuantities, saveUnitPartners } from '@/app/actions/fpe-projects'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FpeDoc {
  id: string
  project_id: string
  project_unit_id: string | null
  chapter_id: string | null
  nombre: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  discipline_tags: string[]
  uploaded_by: string | null
  created_at: string
}

export interface ScopedLineItem {
  template_line_item_id: string
  nombre: string
  unidad_medida: string
  cantidad: number
}

export interface ScopedUnit {
  project_unit_id: string
  template_unit_id: string
  chapter_id: string
  nombre: string
  line_items: ScopedLineItem[]
}

export interface ScopedChapter {
  id: string
  nombre: string
  units: ScopedUnit[]
}

export interface PartnerForDocs {
  id: string
  nombre: string
  unit_ids: string[]
}

export interface ReadinessCheck {
  key: string
  label: string
  passed: boolean
  pts: number
  blocking: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeBadge(mime: string | null, nombre: string): { label: string; bg: string; color: string } {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (mime?.startsWith('video/') || ['mp4','webm','mov','avi','wmv','mkv'].includes(ext))
    return { label: 'VID', bg: '#F3E8FF', color: '#6D28D9' }
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

function isVideo(mime: string | null, nombre: string): boolean {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  return !!(mime?.startsWith('video/') || ['mp4','webm','mov','avi','wmv','mkv'].includes(ext))
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 4,
}

function btn(primary?: boolean, danger?: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', fontSize: 11, borderRadius: 5, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
    background: danger ? '#FEE2E2' : primary ? '#1A1A1A' : '#F0EEE8',
    color: danger ? '#DC2626' : primary ? '#fff' : '#555',
  }
}

// ── Doc Row ───────────────────────────────────────────────────────────────────

function DocRow({ doc, onDeleted }: { doc: FpeDoc; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting]       = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showPlayer, setShowPlayer]   = useState(false)
  const [videoUrl, setVideoUrl]       = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl]   = useState(false)
  const badge   = fileTypeBadge(doc.mime_type, doc.nombre)
  const video   = isVideo(doc.mime_type, doc.nombre)

  const handleOpen = async () => {
    setDownloading(true)
    const res = await getDocumentSignedUrl(doc.storage_path)
    setDownloading(false)
    if ('error' in res) { alert(res.error); return }
    window.open(res.url, '_blank')
  }

  const handleTogglePlayer = async () => {
    if (showPlayer) { setShowPlayer(false); return }
    if (videoUrl) { setShowPlayer(true); return }
    setLoadingUrl(true)
    const res = await getDocumentSignedUrl(doc.storage_path)
    setLoadingUrl(false)
    if ('error' in res) { alert(res.error); return }
    setVideoUrl(res.url)
    setShowPlayer(true)
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
    <div style={{ borderRadius: 6, border: '1px solid #E8E6E0', background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
        <div style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 3, background: badge.bg, color: badge.color, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em' }}>
          {badge.label}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.nombre}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#AAA' }}>{formatBytes(doc.size_bytes)}</p>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {video ? (
            <button onClick={handleTogglePlayer} disabled={loadingUrl} style={btn()}>
              {loadingUrl ? '…' : showPlayer ? '▼ Cerrar' : '▶ Reproducir'}
            </button>
          ) : (
            <button onClick={handleOpen} disabled={downloading} style={btn()}>
              {downloading ? '…' : 'Ver'}
            </button>
          )}
          <button onClick={handleDelete} disabled={deleting} style={btn(false, true)}>
            {deleting ? '…' : '×'}
          </button>
        </div>
      </div>
      {showPlayer && videoUrl && (
        <div style={{ padding: '0 12px 12px' }}>
          <video
            src={videoUrl}
            controls
            style={{ width: '100%', borderRadius: 4, maxHeight: 400, background: '#000', display: 'block' }}
          />
        </div>
      )}
    </div>
  )
}

// ── Direct-upload helper ──────────────────────────────────────────────────────
// 1. Server generates a signed URL (no file bytes through Vercel)
// 2. Browser uploads directly to Supabase Storage via PUT
// 3. Server registers the metadata in DB

async function directUpload(
  file: File,
  projectId: string,
  opts: { chapterId?: string; projectUnitId?: string } = {},
): Promise<FpeDoc> {
  // Step 1: get signed URL
  const urlRes = await fetch('/api/fpe-documents/upload-url', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      project_id:      projectId,
      filename:        file.name,
      size_bytes:      file.size,
      chapter_id:      opts.chapterId      ?? null,
      project_unit_id: opts.projectUnitId  ?? null,
    }),
  })
  const urlData = await urlRes.json()
  if (!urlRes.ok || urlData.error) throw new Error(urlData.error ?? 'Error generando URL.')

  // Step 2: upload file directly to Supabase Storage (no Vercel function involved)
  const putRes = await fetch(urlData.signed_url, {
    method:  'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body:    file,
  })
  if (!putRes.ok) throw new Error(`Error subiendo al storage (${putRes.status}).`)

  // Step 3: register in DB
  const regRes = await fetch('/api/fpe-documents/upload', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      project_id:      projectId,
      storage_path:    urlData.storage_path,
      filename:        file.name,
      mime_type:       file.type || null,
      size_bytes:      file.size,
      chapter_id:      opts.chapterId      ?? null,
      project_unit_id: opts.projectUnitId  ?? null,
    }),
  })
  const regData = await regRes.json()
  if (!regRes.ok || regData.error) throw new Error(regData.error ?? 'Error registrando.')
  return regData.doc as FpeDoc
}

// ── General Upload Zone (no chapter_id, no project_unit_id) ──────────────────
// Files here are sent to ALL partners in ALL packages.

function GeneralUploadZone({
  projectId,
  generalDocs,
  onUploaded,
  onDeleted,
}: {
  projectId:   string
  generalDocs: FpeDoc[]
  onUploaded:  (doc: FpeDoc) => void
  onDeleted:   (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const upload = async (file: File) => {
    setUploading(true); setError(null)
    try {
      const doc = await directUpload(file, projectId)
      onUploaded(doc)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error subiendo.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) upload(f)
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ ...SL, fontSize: 10, color: '#D85A30' }}>
          Planimetría general · fotografías · renders · videos
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>
          Estos archivos se incluyen en <strong>todos los paquetes de envío</strong>, independientemente del capítulo.
        </p>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: '1.5px dashed #D85A30', borderRadius: 6, padding: '16px 20px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: '#FFFBF8', display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: generalDocs.length > 0 || error ? 10 : 0,
          opacity: uploading ? 0.7 : 1,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
        />
        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 6, background: '#FDE8DE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D85A30" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#555', fontWeight: 500 }}>
            {uploading ? 'Subiendo…' : 'Arrastra o haz clic — PDF, DWG, DXF, imágenes, vídeos'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#AAA' }}>Máx. 50 MB por archivo</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, fontSize: 11, color: '#DC2626', marginBottom: 8 }}>
          {error}
        </div>
      )}

      {generalDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {generalDocs.map(d => (
            <DocRow key={d.id} doc={d} onDeleted={onDeleted} />
          ))}
        </div>
      )}

      {generalDocs.length === 0 && !uploading && (
        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#CCC', textAlign: 'center' }}>
          Todavía no hay archivos generales subidos.
        </p>
      )}
    </div>
  )
}

// ── Chapter Upload Zone ───────────────────────────────────────────────────────

function ChapterUploadZone({
  projectId,
  chapterId,
  chapterDocs,
  onUploaded,
  onDeleted,
}: {
  projectId: string
  chapterId: string
  chapterDocs: FpeDoc[]
  onUploaded: (doc: FpeDoc) => void
  onDeleted: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const upload = async (file: File) => {
    setUploading(true); setError(null)
    try {
      const doc = await directUpload(file, projectId, { chapterId })
      onUploaded(doc)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error subiendo.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) upload(f)
  }

  return (
    <div>
      <p style={SL}>Planimetría / Docs del capítulo</p>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: '1.5px dashed #D1D5DB', borderRadius: 6, padding: '14px 16px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: '#FAFAF8', display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: chapterDocs.length > 0 || error ? 8 : 0,
          opacity: uploading ? 0.7 : 1,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
        />
        <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 5, background: '#E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#555', fontWeight: 500 }}>
            {uploading ? 'Subiendo…' : 'Arrastra o haz clic para subir'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#AAA' }}>
            Planos, renders, normativa · Máx. 50 MB
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, fontSize: 11, color: '#DC2626', marginBottom: 6 }}>
          {error}
        </div>
      )}

      {chapterDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {chapterDocs.map(d => (
            <DocRow key={d.id} doc={d} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── UE Card ───────────────────────────────────────────────────────────────────

function UeCard({
  projectId,
  unit,
  partners,
  initialPartnerIds,
  onSaved,
}: {
  projectId: string
  unit: ScopedUnit
  partners: PartnerForDocs[]
  initialPartnerIds: string[]
  onSaved: () => Promise<void>
}) {
  const relevantPartners = partners.filter(p => p.unit_ids.includes(unit.template_unit_id))

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {}
    for (const li of unit.line_items) q[li.template_line_item_id] = li.cantidad
    return q
  })
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set(initialPartnerIds))
  const [savingQty, setSavingQty] = useState(false)
  const [savingPt, setSavingPt]   = useState(false)
  const [qtyMsg, setQtyMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [ptMsg, setPtMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const saveQty = async () => {
    setSavingQty(true); setQtyMsg(null)
    const line_items = unit.line_items
      .filter(li => (quantities[li.template_line_item_id] ?? 0) > 0)
      .map(li => ({
        template_line_item_id: li.template_line_item_id,
        cantidad: quantities[li.template_line_item_id],
      }))
    const res = await saveUnitQuantities(projectId, unit.project_unit_id, line_items)
    setSavingQty(false)
    if ('error' in res) { setQtyMsg({ type: 'err', text: res.error }); return }
    setQtyMsg({ type: 'ok', text: 'Guardado' })
    setTimeout(() => setQtyMsg(null), 2500)
    await onSaved()
  }

  const savePt = async () => {
    setSavingPt(true); setPtMsg(null)
    const res = await saveUnitPartners(projectId, unit.project_unit_id, Array.from(selectedPartners))
    setSavingPt(false)
    if ('error' in res) { setPtMsg({ type: 'err', text: res.error }); return }
    setPtMsg({ type: 'ok', text: 'Guardado' })
    setTimeout(() => setPtMsg(null), 2500)
    await onSaved()
  }

  const togglePartner = (id: string) => setSelectedPartners(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  return (
    <div style={{ border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px', background: '#F8F7F4', borderBottom: '1px solid #E8E6E0' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{unit.nombre}</span>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Line items */}
        {unit.line_items.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={SL}>Cantidades</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {qtyMsg && (
                  <span style={{ fontSize: 11, color: qtyMsg.type === 'ok' ? '#059669' : '#DC2626', fontWeight: 600 }}>
                    {qtyMsg.type === 'ok' ? '✓' : '✗'} {qtyMsg.text}
                  </span>
                )}
                <button onClick={saveQty} disabled={savingQty} style={btn(true)}>
                  {savingQty ? 'Guardando…' : 'Guardar cantidades'}
                </button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '5px 8px 5px 0', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                  <th style={{ padding: '5px 8px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 100 }}>Cantidad</th>
                  <th style={{ padding: '5px 0 5px 8px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', width: 50 }}>Ud.</th>
                </tr>
              </thead>
              <tbody>
                {unit.line_items.map(li => {
                  const qty = quantities[li.template_line_item_id] ?? 0
                  return (
                    <tr key={li.template_line_item_id}>
                      <td style={{ padding: '4px 8px 4px 0', fontSize: 12, color: '#333' }}>{li.nombre}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={qty || ''}
                          placeholder="0"
                          onChange={e => setQuantities(prev => ({
                            ...prev,
                            [li.template_line_item_id]: parseFloat(e.target.value) || 0,
                          }))}
                          style={{
                            width: 80, textAlign: 'right', padding: '4px 6px', fontSize: 12,
                            border: `1px solid ${qty > 0 ? '#378ADD' : '#E8E6E0'}`,
                            borderRadius: 4, background: qty > 0 ? '#F0F7FF' : '#FAFAF8',
                            fontFamily: 'monospace', outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '4px 0 4px 8px', fontSize: 11, color: '#888', fontWeight: 600 }}>
                        {li.unidad_medida}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Partner selector */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={SL}>
              Partners asignados
            </span>
            {relevantPartners.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ptMsg && (
                  <span style={{ fontSize: 11, color: ptMsg.type === 'ok' ? '#059669' : '#DC2626', fontWeight: 600 }}>
                    {ptMsg.type === 'ok' ? '✓' : '✗'} {ptMsg.text}
                  </span>
                )}
                <button onClick={savePt} disabled={savingPt} style={btn(true)}>
                  {savingPt ? 'Guardando…' : 'Guardar partners'}
                </button>
              </div>
            )}
          </div>

          {relevantPartners.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>
              Ningún partner tiene capacidad registrada para esta unidad.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {relevantPartners.map(p => {
                const selected = selectedPartners.has(p.id)
                return (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      padding: '6px 10px', borderRadius: 5, border: '1px solid',
                      borderColor: selected ? '#378ADD' : '#E8E6E0',
                      background: selected ? '#EBF5FF' : '#fff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePartner(p.id)}
                      style={{ accentColor: '#378ADD', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: '#333', fontWeight: selected ? 600 : 400 }}>
                      {p.nombre}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Readiness Panel ───────────────────────────────────────────────────────────

export function ReadinessPanel({ score, checks }: { score: number; checks: ReadinessCheck[] }) {
  const canLaunch = checks.filter(c => c.blocking).every(c => c.passed)
  const barColor  = score >= 80 ? '#059669' : score >= 50 ? '#378ADD' : score >= 20 ? '#D97706' : '#E8E6E0'

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
          Readiness
        </p>
        <span style={{ fontSize: 14, fontWeight: 700, color: barColor }}>{score}%</span>
      </div>
      <div style={{ height: 6, background: '#F0EEE8', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${score}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checks.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{c.passed ? '✓' : '○'}</span>
            <span style={{ fontSize: 12, color: c.passed ? '#1A1A1A' : '#AAA', flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 10, color: c.passed ? barColor : '#DDD', fontWeight: 700 }}>+{c.pts}pts</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E8E6E0' }}>
        {canLaunch ? (
          <p style={{ margin: 0, fontSize: 11, color: '#059669', fontWeight: 600 }}>
            ✓ Listo para lanzar licitación
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: '#AAA' }}>
            Completa los pasos obligatorios para lanzar la licitación.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main DocumentHub ──────────────────────────────────────────────────────────

export default function DocumentHub({
  projectId,
  scopedChapters,
  partners,
  initialUnitPartners,
  initialDocs,
  initialScore,
  initialChecks,
}: {
  projectId: string
  scopedChapters: ScopedChapter[]
  partners: PartnerForDocs[]
  initialUnitPartners: Record<string, string[]>
  initialDocs: FpeDoc[]
  initialScore: number
  initialChecks: ReadinessCheck[]
}) {
  const [docs, setDocs]           = useState<FpeDoc[]>(initialDocs)
  const [score, setScore]         = useState(initialScore)
  const [checks, setChecks]       = useState<ReadinessCheck[]>(initialChecks)
  const [activeChapterId, setActiveChapterId] = useState<string>('__general__')

  const refreshReadiness = useCallback(async () => {
    const res = await getReadinessChecks(projectId)
    if ('error' in res) return
    setScore(res.score)
    setChecks(res.checks)
  }, [projectId])

  const handleDocUploaded = (doc: FpeDoc) => {
    setDocs(prev => [doc, ...prev])
    refreshReadiness()
  }

  const handleDocDeleted = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id))
    refreshReadiness()
  }

  // Empty state: no units in scope yet
  if (scopedChapters.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 8 }}>Sin unidades en scope</p>
        <p style={{ fontSize: 13, color: '#BBB' }}>
          Selecciona y guarda las unidades de ejecución en la pestaña Scope antes de gestionar documentación.
        </p>
      </div>
    )
  }

  const isGeneral     = activeChapterId === '__general__'
  const activeChapter = isGeneral ? null : (scopedChapters.find(ch => ch.id === activeChapterId) ?? scopedChapters[0])
  const chapterDocs   = isGeneral
    ? docs.filter(d => d.chapter_id === null && d.project_unit_id === null)
    : docs.filter(d => d.chapter_id === activeChapter?.id)
  const generalDocCount = docs.filter(d => d.chapter_id === null && d.project_unit_id === null).length

  return (
    <div>
      {/* Tab bar: Planimetría General + chapter tabs */}
      <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #E8E6E0', overflowX: 'auto' }}>

        {/* General tab — always first */}
        <button
          onClick={() => setActiveChapterId('__general__')}
          style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none',
            cursor: 'pointer', background: 'none', fontFamily: 'inherit',
            whiteSpace: 'nowrap', flexShrink: 0,
            borderBottom: isGeneral ? '2px solid #D85A30' : '2px solid transparent',
            color: isGeneral ? '#D85A30' : '#888',
          }}
        >
          Planimetría General
          {generalDocCount > 0 && (
            <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#FEF3C7', color: '#92400E' }}>
              {generalDocCount}
            </span>
          )}
        </button>

        {/* Separator */}
        <div style={{ width: 1, background: '#E8E6E0', margin: '8px 4px', flexShrink: 0 }} />

        {/* Chapter tabs */}
        {scopedChapters.map(ch => {
          const active   = !isGeneral && ch.id === activeChapter?.id
          const docCount = docs.filter(d => d.chapter_id === ch.id).length
          return (
            <button
              key={ch.id}
              onClick={() => setActiveChapterId(ch.id)}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none',
                cursor: 'pointer', background: 'none', fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0,
                borderBottom: active ? '2px solid #1A1A1A' : '2px solid transparent',
                color: active ? '#1A1A1A' : '#888',
              }}
            >
              {ch.nombre}
              {docCount > 0 && (
                <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#EBF5FF', color: '#378ADD' }}>
                  {docCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Two-column: content + readiness */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 24, alignItems: 'start' }}>

        {/* Left: active section content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Planimetría General ── */}
          {isGeneral && (
            <GeneralUploadZone
              projectId={projectId}
              generalDocs={chapterDocs}
              onUploaded={handleDocUploaded}
              onDeleted={handleDocDeleted}
            />
          )}

          {/* ── Chapter tab ── */}
          {!isGeneral && activeChapter && (
            <>
              <ChapterUploadZone
                projectId={projectId}
                chapterId={activeChapter.id}
                chapterDocs={chapterDocs}
                onUploaded={handleDocUploaded}
                onDeleted={handleDocDeleted}
              />

              {activeChapter.units.length > 0 && (
                <div style={{ borderTop: '1px solid #E8E6E0' }} />
              )}

              {activeChapter.units.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed #E8E6E0', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#CCC' }}>
                    Sin unidades de ejecución seleccionadas en este capítulo.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeChapter.units.map(unit => (
                    <UeCard
                      key={unit.project_unit_id}
                      projectId={projectId}
                      unit={unit}
                      partners={partners}
                      initialPartnerIds={initialUnitPartners[unit.project_unit_id] ?? []}
                      onSaved={refreshReadiness}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: readiness panel, sticky */}
        <div style={{ position: 'sticky', top: 24 }}>
          <ReadinessPanel score={score} checks={checks} />
        </div>
      </div>
    </div>
  )
}

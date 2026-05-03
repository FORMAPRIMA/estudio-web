'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MarketingPost, MarketingPostComentario, PostStatus, RedSocial } from '@/lib/marketing'
import {
  POST_STATUSES, TIPOS_INSTAGRAM, TIPOS_LINKEDIN,
  getStatusInfo, getTransitions,
} from '@/lib/marketing'
import {
  createMarketingPost, updateMarketingPost, updatePostStatus,
  replacePostMedia, addComentario, deleteMarketingPost,
} from '@/app/actions/marketing-posts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  instagramPosts: MarketingPost[]
  linkedinPosts:  MarketingPost[]
  currentUserId:   string
  currentUserRol:  string
  currentUserNombre: string
}

interface PendingMedia {
  file:    File
  preview: string
  tipo:    'image' | 'video'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isVideo(url: string) {
  const path = url.split('?')[0].toLowerCase()
  return /\.(mp4|mov|webm|avi|m4v|3gp|mkv|ogv)$/.test(path)
}

async function uploadToStorage(file: File, bucket: string): Promise<string> {
  const supabase = createClient()
  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

function VideoThumb({ url, size = 80 }: { url: string; size?: number }) {
  const ref = useRef<HTMLVideoElement>(null)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <video
        ref={ref}
        src={url}
        preload="metadata"
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 2 }}
        onLoadedMetadata={() => { if (ref.current) ref.current.currentTime = 0.1 }}
      />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.25)', borderRadius: 2,
      }}>
        <span style={{ fontSize: 14, color: '#fff' }}>▶</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: PostStatus }) {
  const info = getStatusInfo(status)
  return (
    <span style={{
      fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 20,
      background: info.color + '22', color: info.color,
      border: `1px solid ${info.color}55`, whiteSpace: 'nowrap',
    }}>
      {info.label}
    </span>
  )
}

// ── HashtagInput ──────────────────────────────────────────────────────────────

function HashtagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const raw = input.trim().replace(/^#+/, '')
    if (!raw || value.includes(raw)) { setInput(''); return }
    onChange([...value, raw])
    setInput('')
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px',
      border: '1px solid #E0DDD8', borderRadius: 3, minHeight: 36,
      background: '#fff', cursor: 'text',
    }} onClick={() => (document.getElementById('hashtag-input') as HTMLInputElement)?.focus()}>
      {value.map(tag => (
        <span key={tag} style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: '#F0EEE8', color: '#1A1A1A80', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          #{tag}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(value.filter(t => t !== tag)) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A1A1A60', padding: 0, fontSize: 12, lineHeight: 1 }}
          >×</button>
        </span>
      ))}
      <input
        id="hashtag-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={value.length ? '' : '#hashtag'}
        style={{ flex: 1, minWidth: 100, border: 'none', outline: 'none', fontSize: 12, background: 'transparent', color: '#1A1A1A' }}
      />
    </div>
  )
}

// ── MediaUploader (shared) ────────────────────────────────────────────────────

function MediaUploader({
  pending, onAdd, onRemove, onReorder,
  existingUrls = [], onRemoveExisting,
  uploading, uploadProgress,
}: {
  pending: PendingMedia[]
  onAdd: (files: FileList) => void
  onRemove: (i: number) => void
  onReorder: (i: number, dir: -1 | 1) => void
  existingUrls?: string[]
  onRemoveExisting?: (url: string) => void
  uploading?: boolean
  uploadProgress?: string
}) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const camRef   = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => camRef.current?.click()} style={btnStyle}>
          📷 Cámara
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} style={btnStyle}>
          🖼 Galería
        </button>
        <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) { onAdd(e.target.files); e.target.value = '' } }} />
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) { onAdd(e.target.files); e.target.value = '' } }} />
      </div>

      {uploading && (
        <p style={{ fontSize: 11, color: '#D85A30', marginBottom: 6 }}>{uploadProgress}</p>
      )}

      {existingUrls.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 10, color: '#1A1A1A60', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Media guardada
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {existingUrls.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {isVideo(url)
                  ? <VideoThumb url={url} size={64} />
                  : <img src={url} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 2, display: 'block' }} alt="" />
                }
                {onRemoveExisting && (
                  <button type="button" onClick={() => onRemoveExisting(url)} style={{
                    position: 'absolute', top: -4, right: -4, width: 16, height: 16,
                    borderRadius: '50%', background: '#D85A30', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: '16px', textAlign: 'center', padding: 0,
                  }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: '#1A1A1A60', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Por subir ({pending.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pending.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 6px', background: '#F8F7F4', borderRadius: 3,
              }}>
                {m.tipo === 'video'
                  ? <VideoThumb url={m.preview} size={40} />
                  : <img src={m.preview} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} alt="" />
                }
                <span style={{ fontSize: 11, color: '#1A1A1A80', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.file.name}
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button type="button" disabled={i === 0} onClick={() => onReorder(i, -1)} style={arrowBtn}>↑</button>
                  <button type="button" disabled={i === pending.length - 1} onClick={() => onReorder(i, 1)} style={arrowBtn}>↓</button>
                  <button type="button" onClick={() => onRemove(i)} style={{ ...arrowBtn, color: '#D85A30' }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── NewPostModal ──────────────────────────────────────────────────────────────

function NewPostModal({
  redSocial, onClose, onCreated,
}: {
  redSocial: RedSocial
  onClose: () => void
  onCreated: () => void
}) {
  const [titulo,           setTitulo]           = useState('')
  const [tipoPost,         setTipoPost]         = useState('')
  const [caption,          setCaption]          = useState('')
  const [hashtags,         setHashtags]         = useState<string[]>([])
  const [location,         setLocation]         = useState('')
  const [fechaProgramada,  setFechaProgramada]  = useState('')
  const [pending,          setPending]          = useState<PendingMedia[]>([])
  const [saving,           setSaving]           = useState(false)
  const [err,              setErr]              = useState('')
  const [uploadProgress,   setUploadProgress]   = useState('')

  const tipos = redSocial === 'instagram' ? TIPOS_INSTAGRAM : TIPOS_LINKEDIN

  function addFiles(files: FileList) {
    const items: PendingMedia[] = []
    for (const f of Array.from(files)) {
      const tipo: 'image' | 'video' = f.type.startsWith('video/') ? 'video' : 'image'
      items.push({ file: f, preview: URL.createObjectURL(f), tipo })
    }
    setPending(prev => [...prev, ...items])
  }

  function removePending(i: number) {
    setPending(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i) })
  }

  function reorder(i: number, dir: -1 | 1) {
    setPending(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) { setErr('El título es obligatorio.'); return }
    setSaving(true); setErr('')
    try {
      const uploadedMedia: { url: string; tipo: 'image' | 'video'; orden: number }[] = []
      for (let i = 0; i < pending.length; i++) {
        setUploadProgress(`Subiendo ${i + 1}/${pending.length}…`)
        const url = await uploadToStorage(pending[i].file, 'marketing')
        uploadedMedia.push({ url, tipo: pending[i].tipo, orden: i })
      }
      setUploadProgress('')

      const res = await createMarketingPost({
        red_social:       redSocial,
        tipo_post:        tipoPost || undefined,
        titulo,
        caption:          caption || undefined,
        hashtags,
        location:         location || undefined,
        fecha_programada: fechaProgramada || undefined,
        media:            uploadedMedia.length ? uploadedMedia : undefined,
      })
      if ('error' in res) { setErr(res.error); setSaving(false); return }
      pending.forEach(m => URL.revokeObjectURL(m.preview))
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error inesperado.')
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalStyle, width: 540, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <p style={labelStyle}>{redSocial === 'instagram' ? 'Instagram' : 'LinkedIn'}</p>
            <h2 style={{ fontSize: 18, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Nuevo post</h2>
          </div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Tipo</label>
            <select value={tipoPost} onChange={e => setTipoPost(e.target.value)} style={inputStyle}>
              <option value="">— Sin tipo —</option>
              {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Título <span style={{ color: '#D85A30' }}>*</span></label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} style={inputStyle} placeholder="Título del post…" />
          </div>

          <div>
            <label style={fieldLabel}>Caption</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Texto del post…" />
          </div>

          <div>
            <label style={fieldLabel}>Hashtags</label>
            <HashtagInput value={hashtags} onChange={setHashtags} />
          </div>

          {redSocial === 'instagram' && (
            <div>
              <label style={fieldLabel}>Ubicación</label>
              <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} placeholder="Madrid, España…" />
            </div>
          )}

          <div>
            <label style={fieldLabel}>Fecha programada</label>
            <input type="datetime-local" value={fechaProgramada} onChange={e => setFechaProgramada(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={fieldLabel}>Media</label>
            <MediaUploader
              pending={pending}
              onAdd={addFiles}
              onRemove={removePending}
              onReorder={reorder}
              uploading={saving && !!uploadProgress}
              uploadProgress={uploadProgress}
            />
          </div>

          {err && <p style={{ fontSize: 12, color: '#D85A30' }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>Cancelar</button>
            <button type="submit" disabled={saving} style={primaryBtn}>
              {saving ? (uploadProgress || 'Creando…') : 'Crear post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PostDetailModal ───────────────────────────────────────────────────────────

function PostDetailModal({
  post, currentUserId, currentUserRol, currentUserNombre,
  onClose, onUpdated,
}: {
  post:               MarketingPost
  currentUserId:      string
  currentUserRol:     string
  currentUserNombre:  string
  onClose:            () => void
  onUpdated:          () => void
}) {
  const [titulo,          setTitulo]          = useState(post.titulo)
  const [tipoPost,        setTipoPost]        = useState(post.tipo_post ?? '')
  const [caption,         setCaption]         = useState(post.caption ?? '')
  const [hashtags,        setHashtags]        = useState<string[]>(post.hashtags)
  const [location,        setLocation]        = useState(post.location ?? '')
  const [fechaProgramada, setFechaProgramada] = useState(
    post.fecha_programada ? post.fecha_programada.slice(0, 16) : ''
  )
  const [existingUrls, setExistingUrls] = useState(post.media.map(m => m.url))
  const [pending,      setPending]      = useState<PendingMedia[]>([])
  const [comentarios,  setComentarios]  = useState<MarketingPostComentario[]>(post.comentarios)
  const [newComment,   setNewComment]   = useState('')
  const [status,       setStatus]       = useState<PostStatus>(post.status)

  const [savingFields,   setSavingFields]   = useState(false)
  const [savingStatus,   setSavingStatus]   = useState(false)
  const [savingMedia,    setSavingMedia]    = useState(false)
  const [savingComment,  setSavingComment]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [err,            setErr]            = useState('')
  const [lightboxUrl,    setLightboxUrl]    = useState<string | null>(null)

  const tipos = post.red_social === 'instagram' ? TIPOS_INSTAGRAM : TIPOS_LINKEDIN
  const transitions = getTransitions(status, currentUserRol)
  const canEdit = currentUserRol === 'fp_partner' || currentUserRol === 'fp_biz_dev'
  const canDelete = currentUserRol === 'fp_partner' || post.created_by === currentUserId

  function addFiles(files: FileList) {
    const items: PendingMedia[] = []
    for (const f of Array.from(files)) {
      const tipo: 'image' | 'video' = f.type.startsWith('video/') ? 'video' : 'image'
      items.push({ file: f, preview: URL.createObjectURL(f), tipo })
    }
    setPending(prev => [...prev, ...items])
  }
  function removePending(i: number) {
    setPending(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i) })
  }
  function reorderPending(i: number, dir: -1 | 1) {
    setPending(prev => {
      const next = [...prev]; const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function removeExisting(url: string) {
    setExistingUrls(prev => prev.filter(u => u !== url))
  }

  async function saveFields() {
    setSavingFields(true); setErr('')
    const res = await updateMarketingPost(post.id, {
      tipo_post:        tipoPost || null,
      titulo:           titulo.trim(),
      caption:          caption.trim() || null,
      hashtags,
      location:         location.trim() || null,
      fecha_programada: fechaProgramada || null,
    })
    setSavingFields(false)
    if ('error' in res) { setErr(res.error); return }
    onUpdated()
  }

  async function saveMedia() {
    setSavingMedia(true); setErr('')
    try {
      const uploaded: { url: string; tipo: 'image' | 'video'; orden: number }[] = []
      for (let i = 0; i < pending.length; i++) {
        setUploadProgress(`Subiendo ${i + 1}/${pending.length}…`)
        const url = await uploadToStorage(pending[i].file, 'marketing')
        uploaded.push({ url, tipo: pending[i].tipo, orden: existingUrls.length + i })
      }
      setUploadProgress('')

      const allMedia = [
        ...existingUrls.map((url, i) => ({
          url,
          tipo: (isVideo(url) ? 'video' : 'image') as 'image' | 'video',
          orden: i,
        })),
        ...uploaded,
      ]
      const res = await replacePostMedia(post.id, allMedia)
      if ('error' in res) { setErr(res.error); setSavingMedia(false); return }
      pending.forEach(m => URL.revokeObjectURL(m.preview))
      setPending([])
      setExistingUrls(allMedia.map(m => m.url))
      onUpdated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error inesperado.')
    }
    setSavingMedia(false)
  }

  async function changeStatus(to: PostStatus) {
    setSavingStatus(true); setErr('')
    const res = await updatePostStatus(post.id, to)
    setSavingStatus(false)
    if ('error' in res) { setErr(res.error); return }
    setStatus(to)
    onUpdated()
  }

  async function submitComment() {
    if (!newComment.trim()) return
    setSavingComment(true); setErr('')
    const res = await addComentario(post.id, newComment.trim())
    setSavingComment(false)
    if ('error' in res) { setErr(res.error); return }
    setComentarios(prev => [...prev, res.comentario])
    if (res.newStatus) setStatus(res.newStatus)
    setNewComment('')
    onUpdated()
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este post?')) return
    setDeleting(true)
    const res = await deleteMarketingPost(post.id)
    if ('error' in res) { setErr(res.error); setDeleting(false); return }
    onClose(); onUpdated()
  }

  const allMedia = [
    ...existingUrls.map((url, i) => ({ url, tipo: (isVideo(url) ? 'video' : 'image') as 'image' | 'video', orden: i })),
  ]

  return (
    <>
      <div style={{ ...overlayStyle, zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={{
          background: '#fff', borderRadius: 4, width: '92vw', maxWidth: 920,
          maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 8px 48px rgba(0,0,0,0.14)',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid #F0EEE8',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <p style={labelStyle}>{post.red_social === 'instagram' ? 'Instagram' : 'LinkedIn'} · {post.autor_nombre}</p>
                <h2 style={{ fontSize: 16, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>{post.titulo}</h2>
              </div>
              <StatusBadge status={status} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {canDelete && (
                <button onClick={handleDelete} disabled={deleting} style={{ ...secondaryBtn, color: '#D85A30', borderColor: '#D85A3044' }}>
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              )}
              <button onClick={onClose} style={closeBtn}>×</button>
            </div>
          </div>

          {/* Body — two columns */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left: media + status */}
            <div style={{
              width: 340, flexShrink: 0, borderRight: '1px solid #F0EEE8',
              padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              {/* Media preview */}
              {allMedia.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allMedia.map((m, i) => (
                    m.tipo === 'video'
                      ? <video key={i} src={m.url} controls style={{ width: '100%', borderRadius: 3, display: 'block' }} />
                      : <img key={i} src={m.url} alt="" onClick={() => setLightboxUrl(m.url)}
                          style={{ width: '100%', borderRadius: 3, display: 'block', cursor: 'zoom-in' }} />
                  ))}
                </div>
              )}

              {/* Status transitions */}
              {transitions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={fieldLabel}>Cambiar estado</p>
                  {transitions.map(t => (
                    <button
                      key={t.to} disabled={savingStatus}
                      onClick={() => changeStatus(t.to)}
                      style={{
                        ...primaryBtn,
                        background: t.to === 'aprobado' ? '#2D7D5A' : t.to === 'borrador' ? '#D85A30' : '#1A1A1A',
                        opacity: savingStatus ? 0.6 : 1,
                        justifyContent: 'center',
                      }}
                    >
                      {savingStatus ? 'Actualizando…' : t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Update media */}
              {canEdit && (
                <div>
                  <p style={fieldLabel}>Media</p>
                  <MediaUploader
                    pending={pending}
                    onAdd={addFiles}
                    onRemove={removePending}
                    onReorder={reorderPending}
                    existingUrls={existingUrls}
                    onRemoveExisting={removeExisting}
                    uploading={savingMedia && !!uploadProgress}
                    uploadProgress={uploadProgress}
                  />
                  {(pending.length > 0 || existingUrls.length !== post.media.length) && (
                    <button onClick={saveMedia} disabled={savingMedia} style={{ ...primaryBtn, marginTop: 8 }}>
                      {savingMedia ? (uploadProgress || 'Guardando…') : 'Guardar media'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: fields + comments */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {canEdit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ ...fieldLabel, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Editar contenido
                  </p>

                  <div>
                    <label style={fieldLabel}>Tipo</label>
                    <select value={tipoPost} onChange={e => setTipoPost(e.target.value)} style={inputStyle}>
                      <option value="">— Sin tipo —</option>
                      {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabel}>Título</label>
                    <input value={titulo} onChange={e => setTitulo(e.target.value)} style={inputStyle} />
                  </div>

                  <div>
                    <label style={fieldLabel}>Caption</label>
                    <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>

                  <div>
                    <label style={fieldLabel}>Hashtags</label>
                    <HashtagInput value={hashtags} onChange={setHashtags} />
                  </div>

                  {post.red_social === 'instagram' && (
                    <div>
                      <label style={fieldLabel}>Ubicación</label>
                      <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} />
                    </div>
                  )}

                  <div>
                    <label style={fieldLabel}>Fecha programada</label>
                    <input type="datetime-local" value={fechaProgramada}
                      onChange={e => setFechaProgramada(e.target.value)} style={inputStyle} />
                  </div>

                  <button onClick={saveFields} disabled={savingFields} style={primaryBtn}>
                    {savingFields ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              )}

              {/* Divider */}
              <div style={{ borderTop: '1px solid #F0EEE8', paddingTop: 16 }}>
                <p style={{ ...fieldLabel, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Comentarios ({comentarios.length})
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {comentarios.map(c => (
                    <div key={c.id} style={{
                      padding: '8px 10px', borderRadius: 3, background: '#F8F7F4',
                      borderLeft: `3px solid ${c.autor_id === currentUserId ? '#D85A30' : '#E0DDD8'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#1A1A1A80' }}>{c.autor_nombre}</span>
                        <span style={{ fontSize: 10, color: '#1A1A1A40' }}>
                          {new Date(c.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#1A1A1A', margin: 0, whiteSpace: 'pre-wrap' }}>{c.contenido}</p>
                    </div>
                  ))}
                  {comentarios.length === 0 && (
                    <p style={{ fontSize: 12, color: '#1A1A1A40', fontStyle: 'italic' }}>Sin comentarios.</p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <textarea
                    value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment() }}
                    placeholder="Añadir comentario… (⌘ + Enter para enviar)"
                    rows={2}
                    style={{ ...inputStyle, flex: 1, resize: 'none' }}
                  />
                  <button onClick={submitComment} disabled={savingComment || !newComment.trim()} style={{ ...primaryBtn, alignSelf: 'flex-end' }}>
                    {savingComment ? '…' : 'Enviar'}
                  </button>
                </div>
              </div>

              {err && <p style={{ fontSize: 12, color: '#D85A30' }}>{err}</p>}
            </div>
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div
          style={{ ...overlayStyle, zIndex: 2000, background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain', borderRadius: 3 }} />
        </div>
      )}
    </>
  )
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function CardThumb({ url, extraCount }: { url: string; extraCount: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isVid = isVideo(url)
  return (
    <div style={{ position: 'relative', height: 140, overflow: 'hidden', background: '#F0EEE8', flexShrink: 0 }}>
      {isVid ? (
        <video
          ref={videoRef}
          src={url}
          preload="metadata"
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onLoadedMetadata={() => { if (videoRef.current) videoRef.current.currentTime = 0.1 }}
        />
      ) : (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      {isVid && (
        <div style={{
          position: 'absolute', bottom: 6, left: 8,
          background: 'rgba(0,0,0,0.55)', borderRadius: 3,
          padding: '2px 7px', fontSize: 9, color: '#fff', letterSpacing: '0.06em',
        }}>▶ VIDEO</div>
      )}
      {extraCount > 0 && (
        <div style={{
          position: 'absolute', top: 7, right: 8,
          background: 'rgba(0,0,0,0.55)', borderRadius: 3,
          padding: '2px 7px', fontSize: 10, color: '#fff', fontWeight: 500,
        }}>+{extraCount}</div>
      )}
    </div>
  )
}

function PostCard({ post, onClick }: { post: MarketingPost; onClick: () => void }) {
  const thumb = post.media[0]
  const dateLabel = post.fecha_programada
    ? new Date(post.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    : new Date(post.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #E0DDD8', borderRadius: 4,
        overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s',
        marginBottom: 8,
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {thumb && <CardThumb url={thumb.url} extraCount={post.media.length - 1} />}

      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <StatusBadge status={post.status} />
          <span style={{ fontSize: 10, color: '#1A1A1A40' }}>{dateLabel}</span>
        </div>

        {post.tipo_post && (
          <p style={{ fontSize: 9, color: '#1A1A1A50', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
            {post.tipo_post}
          </p>
        )}

        <p style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 400, marginBottom: 4, lineHeight: 1.4 }}>
          {post.titulo}
        </p>

        {post.caption && (
          <p style={{
            fontSize: 11, color: '#1A1A1A60', marginBottom: 4, lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}>
            {post.caption}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#1A1A1A40' }}>
          {post.media.length > 0 && <span>{post.media.length} media</span>}
          {post.comentarios.length > 0 && <span>{post.comentarios.length} comentarios</span>}
          <span style={{ marginLeft: 'auto' }}>{post.autor_nombre}</span>
        </div>
      </div>
    </div>
  )
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

function KanbanBoard({
  posts, currentUserId, currentUserRol, currentUserNombre, onRefresh,
}: {
  posts:              MarketingPost[]
  currentUserId:      string
  currentUserRol:     string
  currentUserNombre:  string
  onRefresh:          () => void
}) {
  const [selectedPost, setSelectedPost] = useState<MarketingPost | null>(null)

  const columns = POST_STATUSES.map(s => ({
    status: s.value,
    label:  s.label,
    color:  s.color,
    posts:  posts.filter(p => p.status === s.value),
  }))

  return (
    <>
      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16,
        alignItems: 'flex-start',
      }}>
        {columns.map(col => (
          <div key={col.status} style={{ flexShrink: 0, width: 220 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
              paddingBottom: 8, borderBottom: `2px solid ${col.color}33`,
            }}>
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: col.color, fontWeight: 500 }}>
                {col.label}
              </span>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 20,
                background: col.color + '22', color: col.color,
              }}>
                {col.posts.length}
              </span>
            </div>

            <div>
              {col.posts.map(p => (
                <PostCard key={p.id} post={p} onClick={() => setSelectedPost(p)} />
              ))}
              {col.posts.length === 0 && (
                <div style={{
                  padding: '20px 12px', borderRadius: 3, border: '1.5px dashed #E0DDD8',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: 11, color: '#1A1A1A30', margin: 0 }}>Sin posts</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          currentUserId={currentUserId}
          currentUserRol={currentUserRol}
          currentUserNombre={currentUserNombre}
          onClose={() => setSelectedPost(null)}
          onUpdated={() => { setSelectedPost(null); onRefresh() }}
        />
      )}
    </>
  )
}

// ── PostManagerPage ───────────────────────────────────────────────────────────

export function PostManagerPage({
  instagramPosts: initialInstagram,
  linkedinPosts:  initialLinkedin,
  currentUserId,
  currentUserRol,
  currentUserNombre,
}: Props) {
  const router = useRouter()
  const [activeTab,      setActiveTab]      = useState<RedSocial>('instagram')
  const [instagramPosts, setInstagramPosts] = useState(initialInstagram)
  const [linkedinPosts,  setLinkedinPosts]  = useState(initialLinkedin)
  const [showNewModal,   setShowNewModal]   = useState(false)

  useEffect(() => { setInstagramPosts(initialInstagram) }, [initialInstagram])
  useEffect(() => { setLinkedinPosts(initialLinkedin)   }, [initialLinkedin])

  const posts = activeTab === 'instagram' ? instagramPosts : linkedinPosts

  function handleRefresh() {
    router.refresh()
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <p style={labelStyle}>Marketing</p>
          <h1 style={{ fontSize: 28, fontWeight: 300, color: '#1A1A1A', marginBottom: 4, letterSpacing: '-0.02em' }}>
            Post Manager
          </h1>
          <p style={{ fontSize: 13, color: '#1A1A1A60', fontWeight: 300 }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} en {activeTab === 'instagram' ? 'Instagram' : 'LinkedIn'}
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)} style={primaryBtn}>
          + Nuevo post
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 28,
        borderBottom: '1px solid #E0DDD8',
      }}>
        {(['instagram', 'linkedin'] as RedSocial[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, letterSpacing: '0.08em',
              color: activeTab === tab ? '#1A1A1A' : '#1A1A1A60',
              borderBottom: activeTab === tab ? '2px solid #1A1A1A' : '2px solid transparent',
              marginBottom: -1, textTransform: 'capitalize',
              transition: 'color 0.15s',
            }}
          >
            {tab === 'instagram' ? 'Instagram' : 'LinkedIn'}
            <span style={{
              marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 10,
              background: '#F0EEE8', color: '#1A1A1A60',
            }}>
              {tab === 'instagram' ? instagramPosts.length : linkedinPosts.length}
            </span>
          </button>
        ))}
      </div>

      {/* Kanban */}
      <KanbanBoard
        posts={posts}
        currentUserId={currentUserId}
        currentUserRol={currentUserRol}
        currentUserNombre={currentUserNombre}
        onRefresh={handleRefresh}
      />

      {showNewModal && (
        <NewPostModal
          redSocial={activeTab}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); handleRefresh() }}
        />
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
  color: '#1A1A1A99', marginBottom: 4,
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#1A1A1A80',
  marginBottom: 4, letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #E0DDD8', borderRadius: 3, outline: 'none',
  color: '#1A1A1A', background: '#fff', boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: '#1A1A1A', color: '#fff',
  border: 'none', borderRadius: 3, cursor: 'pointer',
  fontSize: 12, letterSpacing: '0.04em', whiteSpace: 'nowrap',
}

const secondaryBtn: React.CSSProperties = {
  padding: '7px 14px', background: '#F8F7F4', color: '#1A1A1A80',
  border: '1px solid #E0DDD8', borderRadius: 3, cursor: 'pointer',
  fontSize: 12, letterSpacing: '0.04em',
}

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 22, color: '#1A1A1A60', lineHeight: 1, padding: 4,
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 500, padding: 16,
}

const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 4,
  boxShadow: '0 8px 48px rgba(0,0,0,0.14)',
  padding: '28px 28px 24px',
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11, background: '#F8F7F4',
  border: '1px solid #E0DDD8', borderRadius: 3, cursor: 'pointer',
  color: '#1A1A1A80', letterSpacing: '0.04em',
}

const arrowBtn: React.CSSProperties = {
  padding: '2px 6px', fontSize: 12, background: '#F0EEE8',
  border: 'none', borderRadius: 2, cursor: 'pointer', color: '#1A1A1A60',
}

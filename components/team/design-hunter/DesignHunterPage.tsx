'use client'

import { useState, useEffect, useTransition, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createDesignHunterEntry,
  updateDesignHunterEntry,
  deleteDesignHunterEntry,
  createDesignHunterViaje,
} from '@/app/actions/design-hunter'
import { DESIGN_HUNTER_CATEGORIES, getCategoryLabel, isVideoUrl } from '@/lib/design-hunter'
import type { DesignHunterEntry, DesignHunterViaje } from '@/lib/design-hunter'

const BUCKET = 'design-hunter'
const MAX_SIZE_MB = 100

async function uploadMedia(file: File): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function categoryColor(cat: string | null) {
  const map: Record<string, string> = {
    materials: '#8B7355', furniture: '#5B7FA6', color: '#D85A30',
    spatial: '#2D7D5A',  lighting: '#C4A532', texture: '#7A6B8A',
    facade: '#4A6741',   detail: '#8A4A4A',   landscape: '#3D7A6E',
    retail: '#6B6B8A',   other: '#888',
  }
  return map[cat ?? ''] ?? '#888'
}

function getEntryMedia(entry: DesignHunterEntry): string[] {
  if (entry.media_urls?.length > 0) return entry.media_urls
  if (entry.foto_url) return [entry.foto_url]
  return []
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  entries: DesignHunterEntry[]
  viajes: DesignHunterViaje[]
  currentUserId: string
}

interface MediaPreview {
  objectUrl: string
  isVideo: boolean
  name: string
}

// ── Video thumbnail — captures first frame ────────────────────────────────────

function VideoFrame({ src, style }: { src: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null)
  return (
    <video
      ref={ref}
      src={src}
      preload="metadata"
      muted
      playsInline
      onLoadedMetadata={() => { if (ref.current) ref.current.currentTime = 0.1 }}
      style={{ objectFit: 'cover', display: 'block', ...style }}
    />
  )
}

// ── Media Thumbnail (modal previews) ─────────────────────────────────────────

function MediaThumb({ url, size = 80, onRemove }: { url: string; size?: number; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {isVideoUrl(url) ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <VideoFrame src={url} style={{ width: '100%', height: '100%', borderRadius: 3, border: '1px solid #E0DDD8' }} />
          <div style={{
            position: 'absolute', bottom: 3, right: 3,
            background: 'rgba(0,0,0,0.55)', borderRadius: '50%',
            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, color: '#fff',
          }}>▶</div>
        </div>
      ) : (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3, border: '1px solid #E0DDD8', display: 'block' }} />
      )}
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: -6, right: -6,
          background: '#1A1A1A', border: 'none', borderRadius: '50%',
          width: 18, height: 18, color: '#fff', fontSize: 12,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1,
        }}>×</button>
      )}
    </div>
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, cursor: 'zoom-out',
      }}
    >
      <img
        src={url}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain', display: 'block', cursor: 'default' }}
      />
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 20,
        background: 'none', border: 'none', color: '#fff',
        fontSize: 30, cursor: 'pointer', lineHeight: 1, padding: 0,
      }}>×</button>
    </div>
  )
}

// ── Stories Overlay ───────────────────────────────────────────────────────────

interface StoriesSlide {
  entry: DesignHunterEntry
  mediaUrl: string | null
  isVideo: boolean
}

function StoriesOverlay({ entries, onClose }: { entries: DesignHunterEntry[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const touchStart = useRef(0)

  const slides = useMemo<StoriesSlide[]>(() =>
    entries.map(e => {
      const url = e.media_urls?.[0] || e.foto_url || null
      return { entry: e, mediaUrl: url, isVideo: url ? isVideoUrl(url) : false }
    }),
    [entries]
  )

  const goNext = useCallback(() => {
    if (idx >= slides.length - 1) onClose()
    else setIdx(idx + 1)
  }, [idx, slides.length, onClose])

  const goPrev = useCallback(() => {
    if (idx > 0) setIdx(idx - 1)
  }, [idx])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, onClose])

  if (!slides.length) return null
  const { entry, mediaUrl, isVideo } = slides[idx]
  const allMedia = getEntryMedia(entry)
  const progress = (idx + 1) / slides.length

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#0A0A0A', zIndex: 200, display: 'flex', flexDirection: 'column', userSelect: 'none' }}
      onTouchStart={e => { touchStart.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        const diff = e.changedTouches[0].clientX - touchStart.current
        if (diff < -50) goNext()
        else if (diff > 50) goPrev()
      }}
    >
      {/* Progress line */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.15)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
        <div style={{ height: '100%', background: '#fff', width: `${progress * 100}%`, transition: 'width 0.25s ease' }} />
      </div>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 2, left: 0, right: 0, zIndex: 10,
        padding: '16px 20px 12px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {entry.categoria && (
            <span style={{
              fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
              padding: '3px 9px', borderRadius: 20,
              background: categoryColor(entry.categoria) + '28',
              color: '#fff', border: `1px solid ${categoryColor(entry.categoria)}55`,
            }}>
              {getCategoryLabel(entry.categoria)}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
            {idx + 1} / {slides.length}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 32, height: 32, color: '#fff', fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1,
        }}>×</button>
      </div>

      {/* Media */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {mediaUrl ? (
          isVideo ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              style={{ maxWidth: '100%', maxHeight: '100vh', display: 'block', outline: 'none' }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img
              key={mediaUrl}
              src={mediaUrl}
              alt={entry.titulo}
              style={{ maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain', display: 'block' }}
            />
          )
        ) : (
          <div style={{
            width: 160, height: 160, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 52, opacity: 0.25,
          }}>
            {entry.categoria === 'color' ? '🎨' : entry.categoria === 'lighting' ? '💡' : entry.categoria === 'furniture' ? '🪑' : '📷'}
          </div>
        )}

        {/* Tap areas */}
        <div onClick={goPrev} style={{ position: 'absolute', left: 0, top: 0, width: '28%', height: '100%', cursor: 'pointer' }} />
        <div onClick={goNext} style={{ position: 'absolute', right: 0, top: 0, width: '28%', height: '100%', cursor: 'pointer' }} />
      </div>

      {/* Bottom overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)',
        padding: '60px 24px 36px',
        pointerEvents: 'none',
      }}>
        {entry.viaje_nombre && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8, letterSpacing: '0.02em' }}>
            📍 {entry.viaje_nombre}
          </p>
        )}
        <h2 style={{
          fontSize: 22, fontWeight: 300, color: '#fff',
          marginBottom: entry.descripcion ? 10 : 0, lineHeight: 1.3,
          letterSpacing: '-0.02em',
        }}>
          {entry.titulo}
        </h2>
        {entry.descripcion && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.65, fontWeight: 300, marginBottom: 12,
            maxHeight: '4.95em', overflow: 'hidden',
          }}>
            {entry.descripcion}
          </p>
        )}
        {entry.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {entry.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: '3px 9px',
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.55)', borderRadius: 20,
              }}>{tag}</span>
            ))}
          </div>
        )}
        {allMedia.length > 1 && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 10 }}>
            {allMedia.length} archivos en este registro
          </p>
        )}
      </div>

      {/* Nav arrows */}
      <div style={{
        position: 'absolute', bottom: '50%', left: 0, right: 0, transform: 'translateY(50%)',
        display: 'flex', justifyContent: 'space-between', padding: '0 10px', pointerEvents: 'none',
      }}>
        <button onClick={goPrev} disabled={idx === 0} style={{
          background: idx === 0 ? 'transparent' : 'rgba(255,255,255,0.1)',
          border: 'none', borderRadius: '50%', width: 42, height: 42,
          color: idx === 0 ? 'transparent' : 'rgba(255,255,255,0.7)',
          fontSize: 22, cursor: idx === 0 ? 'default' : 'pointer',
          pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>‹</button>
        <button onClick={goNext} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 42, height: 42, color: 'rgba(255,255,255,0.7)',
          fontSize: idx < slides.length - 1 ? 22 : 16, cursor: 'pointer',
          pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>{idx < slides.length - 1 ? '›' : '✕'}</button>
      </div>
    </div>
  )
}

// ── New Entry Modal ───────────────────────────────────────────────────────────

function NewEntryModal({
  viajes,
  onClose,
  onCreated,
}: {
  viajes: DesignHunterViaje[]
  onClose: () => void
  onCreated: (entry: Partial<DesignHunterEntry>) => void
}) {
  const [titulo, setTitulo]           = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria]     = useState('')
  const [tagsInput, setTagsInput]     = useState('')
  const [viajeId, setViajeId]         = useState('')
  const [visibleEquipo, setVisible]   = useState(true)
  const [newViajeName, setNewViaje]   = useState('')
  const [showNewViaje, setShowNew]    = useState(false)
  const [urlInput, setUrlInput]       = useState('')
  const [mediaFiles, setMediaFiles]   = useState<File[]>([])
  const [previews, setPreviews]       = useState<MediaPreview[]>([])
  const [uploading, setUploading]     = useState(false)
  const [uploadStep, setUploadStep]   = useState(0)
  const [error, setError]             = useState('')
  const [isPending, startTransition]  = useTransition()
  const cameraRef                     = useRef<HTMLInputElement>(null)
  const galleryRef                    = useRef<HTMLInputElement>(null)

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    const oversized = arr.find(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (oversized) { setError(`"${oversized.name}" supera el límite de ${MAX_SIZE_MB} MB.`); return }
    setPreviews(prev => [...prev, ...arr.map(f => ({
      objectUrl: URL.createObjectURL(f),
      isVideo: f.type.startsWith('video/'),
      name: f.name,
    }))])
    setMediaFiles(prev => [...prev, ...arr])
    setError('')
  }

  const removeMedia = (idx: number) => {
    URL.revokeObjectURL(previews[idx].objectUrl)
    setMediaFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    if (!titulo.trim()) { setError('El título es obligatorio.'); return }
    setError('')
    startTransition(async () => {
      const uploadedUrls: string[] = []
      let firstImageUrl: string | undefined

      if (mediaFiles.length > 0) {
        setUploading(true)
        for (let i = 0; i < mediaFiles.length; i++) {
          setUploadStep(i + 1)
          const result = await uploadMedia(mediaFiles[i])
          if ('error' in result) {
            setUploading(false)
            setError(`Error al subir "${mediaFiles[i].name}": ${result.error}`)
            return
          }
          uploadedUrls.push(result.url)
          if (!firstImageUrl && !previews[i].isVideo) firstImageUrl = result.url
        }
        setUploading(false)
        setUploadStep(0)
      }

      if (urlInput.trim()) {
        uploadedUrls.push(urlInput.trim())
        if (!firstImageUrl) firstImageUrl = urlInput.trim()
      }

      const fotoUrl = firstImageUrl || uploadedUrls[0] || undefined

      let resolvedViajeId = viajeId
      if (showNewViaje && newViajeName.trim()) {
        const res = await createDesignHunterViaje({ nombre: newViajeName.trim() })
        if ('error' in res) { setError(res.error); return }
        resolvedViajeId = res.id
      }

      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const res = await createDesignHunterEntry({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        foto_url: fotoUrl,
        media_urls: uploadedUrls,
        categoria: categoria || undefined,
        tags,
        viaje_id: resolvedViajeId || undefined,
        visible_equipo: visibleEquipo,
      })
      if ('error' in res) { setError(res.error); return }
      onCreated({
        id: res.id, titulo: titulo.trim(), descripcion: descripcion || null,
        foto_url: fotoUrl ?? null, media_urls: uploadedUrls,
        categoria: categoria || null, tags,
        viaje_id: resolvedViajeId || null, visible_equipo: visibleEquipo,
        user_id: '', created_at: new Date().toISOString(),
      })
      onClose()
    })
  }

  const busy = isPending || uploading
  const btnLabel = uploading
    ? `Subiendo ${uploadStep}/${mediaFiles.length}…`
    : isPending ? 'Guardando…' : 'Guardar'

  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#1A1A1A80', marginBottom: 6, display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0DDD8', borderRadius: 3,
    padding: '8px 10px', fontSize: 13, color: '#1A1A1A',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 4, width: '100%', maxWidth: 520,
        maxHeight: '92vh', overflowY: 'auto', padding: '28px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>Nueva captura</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#1A1A1A60', lineHeight: 1 }}>×</button>
        </div>

        {/* Título */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Título *</label>
          <input style={inputStyle} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Qué has visto…" autoFocus />
        </div>

        {/* Media */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Fotos / Vídeos</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: previews.length > 0 ? 10 : 8 }}>
            <button type="button" onClick={() => cameraRef.current?.click()} style={{
              flex: 1, padding: '12px 0', border: 'none', borderRadius: 3,
              background: '#1A1A1A', color: '#fff', fontSize: 12,
              letterSpacing: '0.04em', cursor: 'pointer',
            }}>
              📷 Cámara
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} style={{
              flex: 1, padding: '12px 0', border: '1px solid #E0DDD8', borderRadius: 3,
              background: '#F8F7F4', color: '#1A1A1A80', fontSize: 12, cursor: 'pointer',
            }}>
              Galería
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment"
            style={{ display: 'none' }} onChange={e => { handleAddFiles(e.target.files); e.target.value = '' }} />
          <input ref={galleryRef} type="file" accept="image/*,video/*" multiple
            style={{ display: 'none' }} onChange={e => { handleAddFiles(e.target.files); e.target.value = '' }} />

          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {previews.map((p, i) => (
                <MediaThumb key={i} url={p.objectUrl} size={80} onRemove={() => removeMedia(i)} />
              ))}
            </div>
          )}

          <input
            style={{ ...inputStyle, fontSize: 11, color: '#1A1A1A60', marginTop: 4 }}
            value={urlInput} onChange={e => setUrlInput(e.target.value)}
            placeholder="O pega una URL de imagen o vídeo…"
          />
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Descripción</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 68 }}
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Dónde lo viste, qué te inspiró…"
          />
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Categoría</label>
          <select style={inputStyle} value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Sin categoría</option>
            {DESIGN_HUNTER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tags (separados por coma)</label>
          <input style={inputStyle} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="madera, tono tierra, minimalista…" />
        </div>

        {/* Viaje */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Viaje</label>
          {!showNewViaje ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={viajeId} onChange={e => setViajeId(e.target.value)}>
                <option value="">Sin viaje</option>
                {viajes.map(v => <option key={v.id} value={v.id}>{v.nombre}{v.ubicacion ? ` · ${v.ubicacion}` : ''}</option>)}
              </select>
              <button type="button" onClick={() => setShowNew(true)} style={{
                padding: '8px 12px', border: '1px solid #E0DDD8', borderRadius: 3,
                background: '#F8F7F4', fontSize: 11, color: '#1A1A1A80', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>+ Nuevo</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={newViajeName} onChange={e => setNewViaje(e.target.value)} placeholder="Nombre del viaje…" autoFocus />
              <button type="button" onClick={() => { setShowNew(false); setNewViaje('') }} style={{
                padding: '8px 12px', border: '1px solid #E0DDD8', borderRadius: 3,
                background: '#F8F7F4', fontSize: 11, color: '#1A1A1A80', cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          )}
        </div>

        {/* Visibilidad */}
        <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="visible" checked={visibleEquipo} onChange={e => setVisible(e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
          <label htmlFor="visible" style={{ fontSize: 12, color: '#1A1A1A80', cursor: 'pointer' }}>Visible para el equipo</label>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 16, padding: '8px 12px', background: '#FDF2F2', borderRadius: 3 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', border: '1px solid #E0DDD8', borderRadius: 3,
            background: '#F8F7F4', fontSize: 12, color: '#1A1A1A80', cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={busy} style={{
            padding: '9px 20px', border: 'none', borderRadius: 3,
            background: busy ? '#ccc' : '#1A1A1A', fontSize: 12,
            color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
            letterSpacing: '0.05em', minWidth: 130,
          }}>
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  entry,
  isOwner,
  viajes,
  onUpdated,
  onDeleted,
  onClose,
}: {
  entry: DesignHunterEntry
  isOwner: boolean
  viajes: DesignHunterViaje[]
  onUpdated: (updated: DesignHunterEntry) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const [editing, setEditing]           = useState(false)
  const [titulo, setTitulo]             = useState(entry.titulo)
  const [descripcion, setDescripcion]   = useState(entry.descripcion ?? '')
  const [categoria, setCategoria]       = useState(entry.categoria ?? '')
  const [tagsInput, setTagsInput]       = useState(entry.tags.join(', '))
  const [visibleEquipo, setVisible]     = useState(entry.visible_equipo)
  const [viajeId, setViajeId]           = useState(entry.viaje_id ?? '')
  const [existingUrls, setExistingUrls] = useState<string[]>(getEntryMedia(entry))
  const [newFiles, setNewFiles]         = useState<File[]>([])
  const [newPreviews, setNewPreviews]   = useState<MediaPreview[]>([])
  const [uploading, setUploading]       = useState(false)
  const [uploadStep, setUploadStep]     = useState(0)
  const [error, setError]               = useState('')
  const [isPending, startTransition]    = useTransition()
  const [confirmDelete, setConfirmDel]  = useState(false)
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null)
  const cameraRef                       = useRef<HTMLInputElement>(null)
  const galleryRef                      = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitulo(entry.titulo)
    setDescripcion(entry.descripcion ?? '')
    setCategoria(entry.categoria ?? '')
    setTagsInput(entry.tags.join(', '))
    setVisible(entry.visible_equipo)
    setViajeId(entry.viaje_id ?? '')
    setExistingUrls(getEntryMedia(entry))
    setNewFiles([]); setNewPreviews([])
    setEditing(false); setError('')
  }, [entry.id])

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    const oversized = arr.find(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (oversized) { setError(`"${oversized.name}" supera ${MAX_SIZE_MB} MB.`); return }
    setNewFiles(prev => [...prev, ...arr])
    setNewPreviews(prev => [...prev, ...arr.map(f => ({
      objectUrl: URL.createObjectURL(f),
      isVideo: f.type.startsWith('video/'),
      name: f.name,
    }))])
    setError('')
  }

  const removeExisting = (idx: number) => setExistingUrls(prev => prev.filter((_, i) => i !== idx))
  const removeNew = (idx: number) => {
    URL.revokeObjectURL(newPreviews[idx].objectUrl)
    setNewFiles(prev => prev.filter((_, i) => i !== idx))
    setNewPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!titulo.trim()) { setError('El título es obligatorio.'); return }
    setError('')
    startTransition(async () => {
      const uploadedUrls: string[] = []
      if (newFiles.length > 0) {
        setUploading(true)
        for (let i = 0; i < newFiles.length; i++) {
          setUploadStep(i + 1)
          const result = await uploadMedia(newFiles[i])
          if ('error' in result) {
            setUploading(false)
            setError(`Error al subir "${newFiles[i].name}": ${result.error}`)
            return
          }
          uploadedUrls.push(result.url)
        }
        setUploading(false); setUploadStep(0)
      }

      const allUrls = [...existingUrls, ...uploadedUrls]
      const firstImage = allUrls.find(u => !isVideoUrl(u))
      const fotoUrl = firstImage || allUrls[0] || null

      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const res = await updateDesignHunterEntry(entry.id, {
        titulo: titulo.trim(), descripcion: descripcion.trim() || null,
        foto_url: fotoUrl, media_urls: allUrls, categoria: categoria || null,
        tags, visible_equipo: visibleEquipo, viaje_id: viajeId || null,
      })
      if ('error' in res) { setError(res.error); return }
      setNewFiles([]); setNewPreviews([])
      setEditing(false)
      onUpdated({
        ...entry, titulo: titulo.trim(), descripcion: descripcion || null,
        foto_url: fotoUrl, media_urls: allUrls, categoria: categoria || null,
        tags, visible_equipo: visibleEquipo, viaje_id: viajeId || null,
        viaje_nombre: viajes.find(v => v.id === viajeId)?.nombre ?? null,
      })
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteDesignHunterEntry(entry.id)
      if ('error' in res) { setError(res.error); return }
      onDeleted(entry.id); onClose()
    })
  }

  const busy = isPending || uploading
  const allMedia = getEntryMedia(entry)

  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#1A1A1A60', marginBottom: 4, display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0DDD8', borderRadius: 3,
    padding: '7px 10px', fontSize: 12, color: '#1A1A1A',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '24px 20px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16,
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#1A1A1A50', lineHeight: 1,
      }}>×</button>

      {!editing ? (
        <>
          {/* Media gallery — full natural size, images open lightbox */}
          {allMedia.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {allMedia.map((url, i) => (
                isVideoUrl(url) ? (
                  <video
                    key={i} src={url} controls playsInline
                    style={{ width: '100%', borderRadius: 3, marginBottom: 6, background: '#000', display: 'block' }}
                  />
                ) : (
                  <img
                    key={i} src={url} alt={entry.titulo}
                    onClick={() => setLightboxUrl(url)}
                    style={{ width: '100%', borderRadius: 3, marginBottom: 6, display: 'block', cursor: 'zoom-in' }}
                  />
                )
              ))}
            </div>
          )}

          {entry.categoria && (
            <span style={{
              fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 20,
              background: categoryColor(entry.categoria) + '18',
              color: categoryColor(entry.categoria), marginBottom: 10, display: 'inline-block',
            }}>
              {getCategoryLabel(entry.categoria)}
            </span>
          )}

          <h2 style={{ fontSize: 17, fontWeight: 400, color: '#1A1A1A', marginBottom: 8, lineHeight: 1.3, marginTop: entry.categoria ? 8 : 0 }}>
            {entry.titulo}
          </h2>

          {entry.descripcion && (
            <p style={{ fontSize: 12, color: '#1A1A1A80', lineHeight: 1.6, marginBottom: 16, fontWeight: 300 }}>
              {entry.descripcion}
            </p>
          )}

          {entry.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
              {entry.tags.map(tag => (
                <span key={tag} style={{ fontSize: 10, padding: '3px 8px', background: '#F0EEE8', color: '#1A1A1A70', borderRadius: 20 }}>{tag}</span>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#1A1A1A50', lineHeight: 2 }}>
            {entry.viaje_nombre && <p>📍 {entry.viaje_nombre}</p>}
            <p>📅 {fmtDate(entry.created_at)}</p>
            <p>{entry.visible_equipo ? '👁 Visible para el equipo' : '🔒 Solo para mí'}</p>
          </div>

          {isOwner && (
            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(true)} style={{
                padding: '7px 16px', border: '1px solid #E0DDD8', borderRadius: 3,
                background: '#F8F7F4', fontSize: 11, color: '#1A1A1A80', cursor: 'pointer',
              }}>Editar</button>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDel(true)} style={{
                  padding: '7px 16px', border: '1px solid #FCC', borderRadius: 3,
                  background: '#FFF5F5', fontSize: 11, color: '#C0392B', cursor: 'pointer',
                }}>Eliminar</button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#C0392B' }}>¿Confirmar?</span>
                  <button onClick={handleDelete} disabled={isPending} style={{
                    padding: '6px 12px', border: 'none', background: '#C0392B',
                    color: '#fff', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                  }}>Sí, eliminar</button>
                  <button onClick={() => setConfirmDel(false)} style={{
                    padding: '6px 10px', border: '1px solid #E0DDD8', background: '#fff',
                    fontSize: 11, borderRadius: 3, cursor: 'pointer', color: '#1A1A1A80',
                  }}>No</button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Título *</label>
            <input style={inputStyle} value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Fotos / Vídeos</label>
            {existingUrls.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {existingUrls.map((url, i) => <MediaThumb key={i} url={url} size={72} onRemove={() => removeExisting(i)} />)}
              </div>
            )}
            {newPreviews.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {newPreviews.map((p, i) => <MediaThumb key={i} url={p.objectUrl} size={72} onRemove={() => removeNew(i)} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 3,
                background: '#1A1A1A', color: '#fff', fontSize: 11, cursor: 'pointer',
              }}>📷 Cámara</button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                flex: 1, padding: '8px 0', border: '1px solid #E0DDD8', borderRadius: 3,
                background: '#F8F7F4', color: '#1A1A1A80', fontSize: 11, cursor: 'pointer',
              }}>Galería</button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment"
              style={{ display: 'none' }} onChange={e => { handleAddFiles(e.target.files); e.target.value = '' }} />
            <input ref={galleryRef} type="file" accept="image/*,video/*" multiple
              style={{ display: 'none' }} onChange={e => { handleAddFiles(e.target.files); e.target.value = '' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Descripción</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Categoría</label>
            <select style={inputStyle} value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="">Sin categoría</option>
              {DESIGN_HUNTER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tags</label>
            <input style={inputStyle} value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Viaje</label>
            <select style={inputStyle} value={viajeId} onChange={e => setViajeId(e.target.value)}>
              <option value="">Sin viaje</option>
              {viajes.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="vis-edit" checked={visibleEquipo} onChange={e => setVisible(e.target.checked)} style={{ width: 13, height: 13, cursor: 'pointer' }} />
            <label htmlFor="vis-edit" style={{ fontSize: 11, color: '#1A1A1A70', cursor: 'pointer' }}>Visible para el equipo</label>
          </div>

          {error && <p style={{ fontSize: 11, color: '#C0392B', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{
              padding: '7px 14px', border: '1px solid #E0DDD8', borderRadius: 3,
              background: '#F8F7F4', fontSize: 11, color: '#1A1A1A80', cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSave} disabled={busy} style={{
              padding: '7px 14px', border: 'none', borderRadius: 3,
              background: busy ? '#ccc' : '#1A1A1A',
              fontSize: 11, color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', minWidth: 100,
            }}>
              {uploading ? `Subiendo ${uploadStep}/${newFiles.length}…` : isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DesignHunterPage({ entries: initialEntries, viajes: initialViajes, currentUserId }: Props) {
  const router                          = useRouter()
  const [entries, setEntries]           = useState<DesignHunterEntry[]>(initialEntries)
  const [viajes, setViajes]             = useState<DesignHunterViaje[]>(initialViajes)

  useEffect(() => { setEntries(initialEntries) }, [initialEntries])
  useEffect(() => { setViajes(initialViajes) }, [initialViajes])

  const [selected, setSelected]         = useState<DesignHunterEntry | null>(null)
  const [showModal, setShowModal]       = useState(false)
  const [showStories, setShowStories]   = useState(false)
  const [filterCategoria, setFilterCat] = useState('')
  const [filterViaje, setFilterViaje]   = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [soloMias, setSoloMias]         = useState(false)

  const filtered = useMemo(() => entries.filter(e => {
    if (filterCategoria && e.categoria !== filterCategoria) return false
    if (filterViaje && e.viaje_id !== filterViaje) return false
    if (soloMias && e.user_id !== currentUserId) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      return (
        e.titulo.toLowerCase().includes(q) ||
        e.descripcion?.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)) ||
        e.viaje_nombre?.toLowerCase().includes(q)
      )
    }
    return true
  }), [entries, filterCategoria, filterViaje, filterSearch, soloMias, currentUserId])

  const clearFilters = () => { setFilterCat(''); setFilterViaje(''); setFilterSearch(''); setSoloMias(false) }
  const hasFilters = !!(filterCategoria || filterViaje || filterSearch || soloMias)

  const handleCreated = (partial: Partial<DesignHunterEntry>) => {
    router.refresh()
    setEntries(prev => [partial as DesignHunterEntry, ...prev])
  }
  const handleUpdated = (updated: DesignHunterEntry) => {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
    setSelected(updated)
  }
  const handleDeleted = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
    setSelected(null)
  }

  const selectStyle: React.CSSProperties = {
    border: '1px solid #E0DDD8', borderRadius: 3, padding: '6px 10px',
    fontSize: 11, color: '#1A1A1A', background: '#FAFAF8', outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        padding: '28px 32px 20px', borderBottom: '1px solid #E8E6E0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 4 }}>Apps</p>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Design Hunter</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => entries.length > 0 && setShowStories(true)}
            disabled={entries.length === 0}
            style={{
              padding: '9px 18px',
              border: '1px solid #1A1A1A',
              borderRadius: 3,
              background: '#fff',
              color: entries.length === 0 ? '#1A1A1A30' : '#1A1A1A',
              fontSize: 11,
              letterSpacing: '0.07em',
              cursor: entries.length === 0 ? 'default' : 'pointer',
            }}
          >
            ✦ Collection
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 20px', background: '#1A1A1A', border: 'none', borderRadius: 3,
              color: '#fff', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            + Nueva captura
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        padding: '12px 32px', borderBottom: '1px solid #E8E6E0',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#FAFAF8',
      }}>
        <input
          value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
          placeholder="Buscar..." style={{ ...selectStyle, minWidth: 160, padding: '6px 10px' }}
        />
        <select style={selectStyle} value={filterCategoria} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {DESIGN_HUNTER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select style={selectStyle} value={filterViaje} onChange={e => setFilterViaje(e.target.value)}>
          <option value="">Todos los viajes</option>
          {viajes.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
        <label style={{ fontSize: 11, color: '#1A1A1A70', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloMias} onChange={e => setSoloMias(e.target.checked)} style={{ cursor: 'pointer' }} />
          Solo mías
        </label>
        {hasFilters && (
          <button onClick={clearFilters} style={{
            padding: '5px 12px', border: '1px solid #E0DDD8', borderRadius: 3,
            background: 'transparent', fontSize: 10, color: '#1A1A1A80', cursor: 'pointer',
          }}>Limpiar</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#1A1A1A50' }}>
          {filtered.length} {filtered.length === 1 ? 'captura' : 'capturas'}
        </span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Gallery grid */}
        <div style={{ flex: selected ? '0 0 60%' : '1 1 100%', overflowY: 'auto', padding: 24, transition: 'flex 0.2s ease' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#1A1A1A50' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
              <p style={{ fontSize: 14, marginBottom: 6 }}>
                {entries.length === 0 ? 'Aún no hay capturas' : 'Sin resultados para estos filtros'}
              </p>
              <p style={{ fontSize: 12, color: '#1A1A1A40' }}>
                {entries.length === 0
                  ? 'Pulsa "+ Nueva captura" para empezar.'
                  : 'Prueba a cambiar los filtros o limpiarlos.'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: selected
                ? 'repeat(auto-fill, minmax(160px, 1fr))'
                : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {filtered.map(entry => {
                const thumb = entry.foto_url || entry.media_urls?.[0] || null
                const thumbIsVideo = thumb ? isVideoUrl(thumb) : false
                const mediaCount = entry.media_urls?.length || (entry.foto_url ? 1 : 0)
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    style={{
                      border: selected?.id === entry.id ? '2px solid #1A1A1A' : '1px solid #E8E6E0',
                      borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                      background: '#fff', transition: 'border-color 0.12s',
                    }}
                    onMouseOver={e => { if (selected?.id !== entry.id) e.currentTarget.style.borderColor = '#AAA' }}
                    onMouseOut={e => { if (selected?.id !== entry.id) e.currentTarget.style.borderColor = '#E8E6E0' }}
                  >
                    {thumb ? (
                      thumbIsVideo ? (
                        <div style={{ position: 'relative', width: '100%', height: 130 }}>
                          <VideoFrame src={thumb} style={{ width: '100%', height: '100%' }} />
                          <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <div style={{
                              background: 'rgba(0,0,0,0.45)', borderRadius: '50%',
                              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, color: '#fff',
                            }}>▶</div>
                          </div>
                        </div>
                      ) : (
                        <img src={thumb} alt={entry.titulo} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                      )
                    ) : (
                      <div style={{
                        width: '100%', height: 100, background: '#F0EEE8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, color: '#1A1A1A30',
                      }}>
                        {entry.categoria === 'color' ? '🎨' : entry.categoria === 'lighting' ? '💡' : entry.categoria === 'furniture' ? '🪑' : '📷'}
                      </div>
                    )}
                    <div style={{ padding: '10px 12px' }}>
                      {entry.categoria && (
                        <span style={{
                          fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                          color: categoryColor(entry.categoria), fontWeight: 500, display: 'block', marginBottom: 4,
                        }}>{getCategoryLabel(entry.categoria)}</span>
                      )}
                      <p style={{
                        fontSize: 12, color: '#1A1A1A', fontWeight: 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
                      }}>{entry.titulo}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                        {entry.viaje_nombre ? (
                          <p style={{ fontSize: 10, color: '#1A1A1A50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {entry.viaje_nombre}
                          </p>
                        ) : <span />}
                        {mediaCount > 1 && (
                          <span style={{ fontSize: 9, color: '#1A1A1A40', flexShrink: 0 }}>{mediaCount} archivos</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ flex: '0 0 40%', borderLeft: '1px solid #E8E6E0', overflowY: 'auto', background: '#fff' }}>
            <DetailPanel
              entry={selected}
              isOwner={selected.user_id === currentUserId}
              viajes={viajes}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      {showModal && (
        <NewEntryModal
          viajes={viajes}
          onClose={() => setShowModal(false)}
          onCreated={partial => { handleCreated(partial); router.refresh() }}
        />
      )}

      {showStories && entries.length > 0 && (
        <StoriesOverlay entries={entries} onClose={() => setShowStories(false)} />
      )}
    </div>
  )
}

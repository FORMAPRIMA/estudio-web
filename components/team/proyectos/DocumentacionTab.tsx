'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDocUploadToken, addProyectoRender, deleteProyectoRender, updateProyectoPlanos } from '@/app/actions/proyectos'

interface Render { url: string; nombre: string }

interface Props {
  proyectoId:   string
  renders:      Render[]
  planosPdfUrl: string | null
  canEdit:      boolean
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ renders, index, onClose }: { renders: Render[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index)
  const prev = () => setCurrent(i => (i - 1 + renders.length) % renders.length)
  const next = () => setCurrent(i => (i + 1) % renders.length)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={e => { e.stopPropagation(); prev() }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl font-light w-12 h-12 flex items-center justify-center"
      >
        ‹
      </button>
      <img
        src={renders[current].url}
        alt={renders[current].nombre}
        className="max-h-[88vh] max-w-[90vw] object-contain"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={e => { e.stopPropagation(); next() }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl font-light w-12 h-12 flex items-center justify-center"
      >
        ›
      </button>
      <button
        onClick={onClose}
        className="absolute top-4 right-6 text-white/60 hover:text-white text-2xl"
      >
        ×
      </button>
      <p className="absolute bottom-6 left-0 right-0 text-center text-white/40 text-xs tracking-widest uppercase">
        {current + 1} / {renders.length}
      </p>
    </div>
  )
}

// ── Upload zone (shared) ──────────────────────────────────────────────────────

function DropZone({
  accept, label, sublabel, loading, onFiles,
}: {
  accept: string
  label: string
  sublabel: string
  loading: boolean
  onFiles: (files: File[]) => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }, [onFiles])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`
        relative border border-dashed transition-colors cursor-pointer
        flex flex-col items-center justify-center gap-2 py-10 px-6 text-center
        ${dragging ? 'border-ink/50 bg-ink/5' : 'border-ink/20 hover:border-ink/40 hover:bg-ink/[0.02]'}
        ${loading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={accept.includes('image')}
        className="sr-only"
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      {loading ? (
        <p className="text-[11px] text-meta animate-pulse tracking-widest uppercase">Subiendo…</p>
      ) : (
        <>
          <p className="text-[10px] tracking-widest uppercase font-light text-meta">{label}</p>
          <p className="text-xs font-light text-meta/50">{sublabel}</p>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentacionTab({ proyectoId, renders: initialRenders, planosPdfUrl: initialPlanos, canEdit }: Props) {
  const supabase = createClient()

  const [renders,      setRenders]     = useState<Render[]>(initialRenders ?? [])
  const [planos,       setPlanos]      = useState<string | null>(initialPlanos)
  const [lightboxIdx,  setLightboxIdx] = useState<number | null>(null)
  const [carouselIdx,  setCarouselIdx] = useState(0)
  const [uploading,    setUploading]   = useState(false)
  const [uploadingPl,  setUploadingPl] = useState(false)
  const [error,        setError]       = useState<string | null>(null)

  // ── Upload renders ──────────────────────────────────────────────────────────
  const handleRenderFiles = async (files: File[]) => {
    setUploading(true)
    setError(null)
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const tokenResult = await getDocUploadToken(proyectoId, file.name, 'render')
      if ('error' in tokenResult) { setError(tokenResult.error); continue }

      const { token, path, publicUrl } = tokenResult
      const { error: upErr } = await supabase.storage
        .from('proyecto-renders')
        .uploadToSignedUrl(path, token, file, { contentType: file.type })

      if (upErr) { setError(upErr.message); continue }

      const res = await addProyectoRender(proyectoId, publicUrl, file.name)
      if ('error' in res) { setError(res.error); continue }

      setRenders(prev => [...prev, { url: publicUrl, nombre: file.name }])
    }
    setUploading(false)
  }

  // ── Delete render ───────────────────────────────────────────────────────────
  const handleDeleteRender = async (url: string) => {
    if (!confirm('¿Eliminar este render?')) return
    const res = await deleteProyectoRender(proyectoId, url)
    if ('error' in res) { setError(res.error); return }
    setRenders(prev => {
      const next = prev.filter(r => r.url !== url)
      setCarouselIdx(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  // ── Upload planos PDF ───────────────────────────────────────────────────────
  const handlePlanosFile = async (files: File[]) => {
    const file = files[0]
    if (!file || file.type !== 'application/pdf') { setError('Solo se admite PDF para los planos.'); return }
    setUploadingPl(true)
    setError(null)

    const tokenResult = await getDocUploadToken(proyectoId, file.name, 'planos')
    if ('error' in tokenResult) { setError(tokenResult.error); setUploadingPl(false); return }

    const { token, path, publicUrl } = tokenResult
    const { error: upErr } = await supabase.storage
      .from('proyecto-planos')
      .uploadToSignedUrl(path, token, file, { contentType: 'application/pdf' })

    if (upErr) { setError(upErr.message); setUploadingPl(false); return }

    const res = await updateProyectoPlanos(proyectoId, publicUrl)
    if ('error' in res) { setError(res.error); setUploadingPl(false); return }

    setPlanos(publicUrl)
    setUploadingPl(false)
  }

  const prev = () => setCarouselIdx(i => (i - 1 + renders.length) % renders.length)
  const next = () => setCarouselIdx(i => (i + 1) % renders.length)

  return (
    <div className="space-y-12">

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* ── Renders section ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-6">
          Renders finales
        </p>

        {renders.length > 0 ? (
          <div className="space-y-4">
            {/* Carousel */}
            <div className="relative aspect-[16/9] bg-ink/5 overflow-hidden group">
              <img
                src={renders[carouselIdx].url}
                alt={renders[carouselIdx].nombre}
                className="w-full h-full object-cover cursor-zoom-in transition-opacity duration-300"
                onClick={() => setLightboxIdx(carouselIdx)}
              />
              {renders.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-xl font-light opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ‹
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-xl font-light opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ›
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {renders.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCarouselIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === carouselIdx ? 'bg-white' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Delete button — only for canEdit */}
              {canEdit && (
                <button
                  onClick={() => handleDeleteRender(renders[carouselIdx].url)}
                  className="absolute top-3 right-3 w-7 h-7 bg-black/40 hover:bg-red-600/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  title="Eliminar render"
                >
                  ×
                </button>
              )}
            </div>

            {/* Thumbnail strip */}
            {renders.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {renders.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIdx(i)}
                    className={`shrink-0 w-16 h-16 overflow-hidden border-2 transition-colors ${i === carouselIdx ? 'border-ink/60' : 'border-transparent hover:border-ink/20'}`}
                  >
                    <img src={r.url} alt={r.nombre} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Upload more */}
            {canEdit && (
              <DropZone
                accept="image/*"
                label="+ Agregar renders"
                sublabel="JPG, PNG, WebP"
                loading={uploading}
                onFiles={handleRenderFiles}
              />
            )}
          </div>
        ) : (
          canEdit ? (
            <DropZone
              accept="image/*"
              label="Arrastra los renders aquí o haz clic para seleccionar"
              sublabel="JPG, PNG, WebP — puedes subir varios a la vez"
              loading={uploading}
              onFiles={handleRenderFiles}
            />
          ) : (
            <p className="text-sm font-light text-meta/50 italic">Sin renders subidos todavía.</p>
          )
        )}
      </div>

      {/* ── Planos PDF section ────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-6">
          Planos actualizados
        </p>

        {planos ? (
          <div className="border border-ink/10 p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-10 h-10 bg-ink/5 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/40">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink truncate">Planos actualizados</p>
                <p className="text-[10px] text-meta/60 mt-0.5 tracking-widest uppercase">PDF</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={planos}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] tracking-widest uppercase font-light text-ink/60 hover:text-ink border border-ink/20 hover:border-ink/40 px-3 py-1.5 transition-colors"
              >
                Ver PDF
              </a>
              {canEdit && (
                <DropZone
                  accept="application/pdf"
                  label="Reemplazar"
                  sublabel=""
                  loading={uploadingPl}
                  onFiles={handlePlanosFile}
                />
              )}
            </div>
          </div>
        ) : (
          canEdit ? (
            <DropZone
              accept="application/pdf"
              label="Arrastra el PDF de planos aquí o haz clic para seleccionar"
              sublabel="Solo PDF — se reemplazará al subir uno nuevo"
              loading={uploadingPl}
              onFiles={handlePlanosFile}
            />
          ) : (
            <p className="text-sm font-light text-meta/50 italic">Sin planos subidos todavía.</p>
          )
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox renders={renders} index={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  )
}

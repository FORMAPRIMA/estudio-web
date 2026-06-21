'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createModelo3D, deleteModelo3D } from '@/app/actions/showroom-3d'
import { LIGHTING_PRESETS, DEFAULT_PRESET, fmtFileSize } from '@/lib/showroom'
import type { Modelo3D } from '@/lib/showroom'

// <model-viewer> es un custom element: lo declaramos para JSX.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any
    }
  }
}

const BUCKET = 'modelos-3d'
const MAX_SIZE_MB = 75
const ACCENT = '#D85A30'

// Carga única del módulo en cliente (registra el custom element)
let mvPromise: Promise<unknown> | null = null
function ensureModelViewer() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!mvPromise) mvPromise = import('@google/model-viewer')
  return mvPromise
}

function useModelViewerReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    ensureModelViewer().then(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])
  return ready
}

async function uploadGlb(file: File): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'glb'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: ext === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary',
  })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

// ────────────────────────────────────────────────────────────────────────────

export default function Showroom3DPage({ modelos }: { modelos: Modelo3D[] }) {
  const ready = useModelViewerReady()
  const [active, setActive] = useState<Modelo3D | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  // Bloquear scroll del body cuando hay overlay
  useEffect(() => {
    const open = active || uploadOpen
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [active, uploadOpen])

  return (
    <div style={{ minHeight: '100%', background: '#F8F7F4' }}>
      <style>{styles}</style>

      <div style={{ padding: '40px 48px', maxWidth: 1180, margin: '0 auto' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1A1A1A80', marginBottom: 10 }}>
              Forma Prima · Showroom
            </p>
            <h1 style={{ fontSize: 34, fontWeight: 300, color: '#1A1A1A', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>
              Maquetas
            </h1>
            <p style={{ fontSize: 13, color: '#1A1A1A70', marginTop: 12, fontWeight: 300, maxWidth: 460, lineHeight: 1.6 }}>
              Explora las maquetas del estudio en 3D. Gira, acerca y descubre cada proyecto desde cualquier ángulo.
            </p>
          </div>
          <button onClick={() => setUploadOpen(true)} className="sr-btn-primary">
            + Subir maqueta
          </button>
        </div>

        {/* Galería */}
        {modelos.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} />
        ) : (
          <div className="sr-grid">
            {modelos.map((m, i) => (
              <ModelCard key={m.id} modelo={m} ready={ready} index={i} onOpen={() => setActive(m)} />
            ))}
          </div>
        )}
      </div>

      {active && (
        <ImmersiveViewer modelo={active} ready={ready} onClose={() => setActive(null)} />
      )}
      {uploadOpen && (
        <UploadModal onClose={() => setUploadOpen(false)} />
      )}
    </div>
  )
}

// ── Tarjeta de la galería ───────────────────────────────────────────────────

function ModelCard({ modelo, ready, index, onOpen }: { modelo: Modelo3D; ready: boolean; index: number; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="sr-card"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="sr-card-stage">
        {ready ? (
          <model-viewer
            src={modelo.glb_url}
            poster={modelo.poster_url || undefined}
            disable-zoom=""
            interaction-prompt="none"
            shadow-intensity="0.65"
            shadow-softness="1"
            exposure="1.1"
            tone-mapping="neutral"
            camera-orbit="-22deg 76deg auto"
            field-of-view="32deg"
            loading="lazy"
            reveal="auto"
            {...(hover ? { 'auto-rotate': true, 'rotation-per-second': '24deg' } : {})}
            style={{ width: '100%', height: '100%', backgroundColor: 'transparent', '--poster-color': 'transparent' } as any}
          >
            <div slot="progress-bar" />
          </model-viewer>
        ) : (
          <div className="sr-shimmer" />
        )}
        <div className="sr-card-hint" style={{ opacity: hover ? 1 : 0 }}>Ver maqueta →</div>
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        {modelo.proyecto && (
          <p style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, fontWeight: 600, marginBottom: 6 }}>
            {modelo.proyecto}
          </p>
        )}
        <p style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          {modelo.nombre}
        </p>
        {modelo.descripcion && (
          <p style={{ fontSize: 12, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {modelo.descripcion}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Visor inmersivo a pantalla completa ───────────────────────────────────────

function ImmersiveViewer({ modelo, ready, onClose }: { modelo: Modelo3D; ready: boolean; onClose: () => void }) {
  const router = useRouter()
  const mvRef = useRef<any>(null)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id)
  const [autoRotate, setAutoRotate] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const preset = LIGHTING_PRESETS.find(p => p.id === presetId) ?? DEFAULT_PRESET

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const resetView = useCallback(() => {
    const el = mvRef.current
    if (!el) return
    el.cameraOrbit = '-22deg 76deg auto'
    el.fieldOfView = 'auto'
    el.jumpCameraToGoal?.()
  }, [])

  function handleDelete() {
    if (!confirm(`¿Eliminar la maqueta "${modelo.nombre}"?`)) return
    startTransition(async () => {
      const res = await deleteModelo3D(modelo.id)
      if ('error' in res) { alert(res.error); return }
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="sr-overlay" onClick={onClose}>
      <div className="sr-viewer-shell" onClick={e => e.stopPropagation()}>
        {ready ? (
          <model-viewer
            ref={mvRef}
            src={modelo.glb_url}
            camera-controls=""
            interaction-prompt="none"
            touch-action="none"
            shadow-intensity={String(preset.shadowIntensity)}
            shadow-softness="1"
            exposure={String(preset.exposure)}
            tone-mapping="neutral"
            camera-orbit="-22deg 76deg auto"
            min-field-of-view="12deg"
            max-field-of-view="55deg"
            field-of-view="40deg"
            {...(preset.environmentImage ? { 'environment-image': preset.environmentImage } : {})}
            {...(autoRotate ? { 'auto-rotate': true, 'rotation-per-second': '18deg', 'auto-rotate-delay': '0' } : {})}
            onLoad={() => setLoaded(true)}
            style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF', '--poster-color': '#FFFFFF' } as any}
          >
            <div slot="progress-bar" className="sr-progress">
              <div className="sr-progress-track"><div className="sr-progress-bar" /></div>
              <span>Cargando maqueta…</span>
            </div>
            <div slot="interaction-prompt" />
          </model-viewer>
        ) : (
          <div className="sr-shimmer" style={{ width: '100%', height: '100%' }} />
        )}

        {/* Top bar */}
        <div className="sr-topbar">
          <div>
            {modelo.proyecto && (
              <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 600 }}>
                {modelo.proyecto}
              </span>
            )}
            <div style={{ fontSize: 17, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.01em', marginTop: 2 }}>
              {modelo.nombre}
            </div>
          </div>
          <button onClick={onClose} className="sr-close" aria-label="Cerrar">✕</button>
        </div>

        {/* Controles flotantes */}
        <div className="sr-controls">
          <div className="sr-seg">
            {LIGHTING_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className={`sr-seg-btn ${p.id === presetId ? 'is-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="sr-divider" />
          <button onClick={() => setAutoRotate(v => !v)} className={`sr-icon-btn ${autoRotate ? 'is-active' : ''}`} title="Giro automático">
            ⟳
          </button>
          <button onClick={resetView} className="sr-icon-btn" title="Centrar vista">⊹</button>
        </div>

        {!loaded && ready && <div className="sr-loading-veil" />}

        <button onClick={handleDelete} disabled={isPending} className="sr-delete" title="Eliminar maqueta">
          {isPending ? '…' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}

// ── Modal de subida ───────────────────────────────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [proyecto, setProyecto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null) {
    setError('')
    if (!f) return
    if (!/\.(glb|gltf)$/i.test(f.name)) { setError('El archivo debe ser .glb o .gltf'); return }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) { setError(`Máximo ${MAX_SIZE_MB} MB.`); return }
    setFile(f)
    if (!nombre) setNombre(f.name.replace(/\.(glb|gltf)$/i, '').replace(/[-_]/g, ' '))
  }

  async function handleSave() {
    setError('')
    if (!nombre.trim()) { setError('Pon un nombre a la maqueta.'); return }
    if (!file) { setError('Selecciona un archivo .glb'); return }
    setBusy(true)
    try {
      const up = await uploadGlb(file)
      if ('error' in up) { setError(up.error); setBusy(false); return }
      const res = await createModelo3D({
        nombre, proyecto: proyecto || undefined, descripcion: descripcion || undefined,
        glb_url: up.url, file_size: file.size,
      })
      if ('error' in res) { setError(res.error); setBusy(false); return }
      onClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setBusy(false)
    }
  }

  return (
    <div className="sr-overlay sr-overlay-dim" onClick={busy ? undefined : onClose}>
      <div className="sr-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.01em', margin: 0 }}>Subir maqueta</h2>
          {!busy && <button onClick={onClose} className="sr-close" style={{ position: 'static' }}>✕</button>}
        </div>

        <div
          className={`sr-drop ${dragging ? 'is-drag' : ''} ${file ? 'has-file' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] ?? null) }}
        >
          <input ref={inputRef} type="file" accept=".glb,.gltf,model/gltf-binary" hidden
            onChange={e => pickFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <>
              <div style={{ fontSize: 22, marginBottom: 8 }}>📦</div>
              <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{file.name}</p>
              <p style={{ fontSize: 11, color: '#1A1A1A70', marginTop: 4 }}>{fmtFileSize(file.size)} · pulsa para cambiar</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, marginBottom: 8 }}>⬆</div>
              <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>Arrastra tu archivo .glb aquí</p>
              <p style={{ fontSize: 11, color: '#1A1A1A70', marginTop: 4 }}>o pulsa para seleccionar · máx {MAX_SIZE_MB} MB</p>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
          <Field label="Nombre">
            <input className="sr-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Maqueta — Villa Bardala" />
          </Field>
          <Field label="Proyecto (opcional)">
            <input className="sr-input" value={proyecto} onChange={e => setProyecto(e.target.value)} placeholder="Bardala 20" />
          </Field>
          <Field label="Descripción (opcional)">
            <textarea className="sr-input" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Volumen general, escala 1:100…" style={{ resize: 'vertical' }} />
          </Field>
        </div>

        {error && <p style={{ color: '#C0392B', fontSize: 12, marginTop: 14 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          {!busy && <button onClick={onClose} className="sr-btn-ghost">Cancelar</button>}
          <button onClick={handleSave} disabled={busy} className="sr-btn-primary">
            {busy ? 'Subiendo…' : 'Guardar maqueta'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A80', display: 'block', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div onClick={onUpload} className="sr-empty">
      <div style={{ fontSize: 30, marginBottom: 14, opacity: 0.5 }}>◳</div>
      <p style={{ fontSize: 15, color: '#1A1A1A', fontWeight: 400, marginBottom: 6 }}>Aún no hay maquetas</p>
      <p style={{ fontSize: 12.5, color: '#1A1A1A70', fontWeight: 300 }}>Sube tu primer modelo .glb exportado de Blender para empezar.</p>
    </div>
  )
}

// ── Estilos (hover/animaciones que el inline no permite) ──────────────────────

const styles = `
.sr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 22px; }
.sr-card {
  background: #fff; border-radius: 10px; overflow: hidden; cursor: pointer;
  border: 1px solid #ECEAE3; transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s ease;
  opacity: 0; transform: translateY(14px); animation: sr-rise .55s cubic-bezier(.2,.7,.2,1) forwards;
}
.sr-card:hover { transform: translateY(-6px); box-shadow: 0 24px 50px -28px rgba(26,26,26,.4); }
.sr-card-stage {
  position: relative; aspect-ratio: 4 / 3;
  background: radial-gradient(120% 120% at 50% 18%, #FFFFFF 0%, #F4F2EC 100%);
}
.sr-card-hint {
  position: absolute; bottom: 12px; right: 14px; font-size: 10px; letter-spacing: .12em;
  text-transform: uppercase; color: #1A1A1A; background: rgba(255,255,255,.82);
  backdrop-filter: blur(6px); padding: 6px 10px; border-radius: 100px; transition: opacity .3s ease; font-weight: 600;
}
@keyframes sr-rise { to { opacity: 1; transform: translateY(0); } }

.sr-shimmer { width: 100%; height: 100%; background: linear-gradient(100deg, #F4F2EC 30%, #FBFAF7 50%, #F4F2EC 70%); background-size: 200% 100%; animation: sr-shim 1.4s infinite; }
@keyframes sr-shim { to { background-position: -200% 0; } }

.sr-btn-primary {
  background: ${ACCENT}; color: #fff; border: none; border-radius: 100px; padding: 11px 22px;
  font-size: 12.5px; font-weight: 500; letter-spacing: .01em; cursor: pointer;
  transition: filter .2s ease, transform .2s ease; box-shadow: 0 8px 20px -10px ${ACCENT};
}
.sr-btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); }
.sr-btn-primary:disabled { opacity: .6; cursor: default; transform: none; }
.sr-btn-ghost { background: transparent; color: #1A1A1A90; border: 1px solid #DDD9D0; border-radius: 100px; padding: 11px 20px; font-size: 12.5px; cursor: pointer; }
.sr-btn-ghost:hover { background: #F0EEE8; }

.sr-empty {
  border: 1.5px dashed #D8D4CA; border-radius: 12px; padding: 70px 24px; text-align: center;
  cursor: pointer; transition: border-color .25s ease, background .25s ease; background: #FCFBF9;
}
.sr-empty:hover { border-color: ${ACCENT}; background: #fff; }

.sr-overlay {
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
  background: rgba(248,247,244,.94); backdrop-filter: blur(10px); animation: sr-fade .3s ease;
}
.sr-overlay-dim { background: rgba(26,26,26,.42); }
@keyframes sr-fade { from { opacity: 0; } to { opacity: 1; } }

.sr-viewer-shell {
  position: relative; width: 100%; height: 100%; max-width: 100vw; max-height: 100vh; background: #fff;
  animation: sr-zoom .4s cubic-bezier(.2,.7,.2,1);
}
@keyframes sr-zoom { from { opacity: 0; transform: scale(.985); } to { opacity: 1; transform: scale(1); } }

.sr-topbar { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-start; padding: 26px 30px; pointer-events: none; }
.sr-topbar > * { pointer-events: auto; }
.sr-close {
  width: 38px; height: 38px; border-radius: 50%; border: 1px solid #EAE7DF; background: rgba(255,255,255,.7);
  backdrop-filter: blur(8px); color: #1A1A1A; font-size: 14px; cursor: pointer; transition: background .2s, transform .2s; line-height: 1;
}
.sr-close:hover { background: #fff; transform: rotate(90deg); }

.sr-controls {
  position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 100px;
  background: rgba(255,255,255,.72); backdrop-filter: blur(14px); border: 1px solid #EAE7DF;
  box-shadow: 0 16px 40px -20px rgba(26,26,26,.45); z-index: 5;
}
.sr-seg { display: flex; gap: 2px; }
.sr-seg-btn { border: none; background: transparent; color: #1A1A1A80; font-size: 11.5px; padding: 8px 14px; border-radius: 100px; cursor: pointer; transition: all .2s ease; white-space: nowrap; }
.sr-seg-btn:hover { color: #1A1A1A; }
.sr-seg-btn.is-active { background: #1A1A1A; color: #fff; }
.sr-divider { width: 1px; height: 22px; background: #E2DED4; }
.sr-icon-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; color: #1A1A1A70; font-size: 17px; cursor: pointer; transition: all .2s ease; line-height: 1; }
.sr-icon-btn:hover { background: #F0EEE8; color: #1A1A1A; }
.sr-icon-btn.is-active { background: ${ACCENT}; color: #fff; }

.sr-delete { position: absolute; bottom: 30px; right: 30px; background: transparent; border: 1px solid #EAE7DF; color: #1A1A1A60; font-size: 11px; padding: 9px 16px; border-radius: 100px; cursor: pointer; transition: all .2s; z-index: 5; }
.sr-delete:hover { color: #C0392B; border-color: #E5B5AC; background: rgba(255,255,255,.6); }

.sr-progress { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.sr-progress span { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #1A1A1A70; }
.sr-progress-track { width: 160px; height: 2px; background: #E8E4DA; border-radius: 2px; overflow: hidden; }
.sr-progress-bar { width: 40%; height: 100%; background: ${ACCENT}; border-radius: 2px; animation: sr-indet 1.1s ease-in-out infinite; }
@keyframes sr-indet { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
.sr-loading-veil { position: absolute; inset: 0; pointer-events: none; }

.sr-modal { background: #fff; border-radius: 14px; padding: 32px; width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto; animation: sr-zoom .35s cubic-bezier(.2,.7,.2,1); }
.sr-drop { border: 1.5px dashed #D8D4CA; border-radius: 10px; padding: 32px 20px; text-align: center; cursor: pointer; transition: all .2s ease; background: #FCFBF9; }
.sr-drop:hover, .sr-drop.is-drag { border-color: ${ACCENT}; background: #fff; }
.sr-drop.has-file { border-style: solid; border-color: #D8D4CA; }
.sr-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E2DED4; border-radius: 8px; font-size: 13px; color: #1A1A1A; background: #FCFBF9; font-family: inherit; outline: none; transition: border-color .2s; }
.sr-input:focus { border-color: ${ACCENT}; background: #fff; }
`

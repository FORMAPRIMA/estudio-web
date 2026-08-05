'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createWebProyecto,
  updateWebProyecto,
  deleteWebProyecto,
  reorderWebProyectos,
} from '@/app/actions/web-publica'
import { esVideoUrl, slugifyProyecto, type WebProyecto, type ProyectoMedia, type ProyectoMediaTipo } from '@/lib/web-publica'

const BUCKET = 'web-publica'
const ORANGE = '#D85A30'
const INK = '#1A1A1A'
const BORDER = '#F0EEE8'

async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

async function traducir(texto: string): Promise<string | null> {
  try {
    const res = await fetch('/api/web-publica/traducir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })
    if (!res.ok) return null
    const j = await res.json()
    return typeof j.traduccion === 'string' ? j.traduccion : null
  } catch { return null }
}

const labelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: 5, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none' }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', lineHeight: 1.5 }

export function ProyectosEditor({ proyectos }: { proyectos: WebProyecto[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const ids = proyectos.map((p) => p.id)

  const move = (id: string, dir: -1 | 1) => {
    const idx = ids.indexOf(id); const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]; [next[idx], next[swap]] = [next[swap], next[idx]]
    startTransition(async () => { await reorderWebProyectos(next); router.refresh() })
  }

  const addProyecto = () => {
    setCreating(true)
    startTransition(async () => { await createWebProyecto({ nombre: 'Nuevo proyecto' }); setCreating(false); router.refresh() })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: `${INK}60`, marginBottom: 28, fontWeight: 300, maxWidth: 640, lineHeight: 1.5 }}>
        Proyectos del sitio. Los campos básicos (nombre, foto principal, galería) alimentan el grid y los fondos de la Home.
        Despliega <strong style={{ fontWeight: 500 }}>«Página de proyecto»</strong> para la ficha completa (descripción, tipología,
        fotos, renders y planos). El orden aquí es el orden en la web.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {proyectos.map((p, i) => (
          <ProyectoCard key={p.id} proyecto={p} index={i} total={proyectos.length} onMove={move} busy={isPending} />
        ))}
      </div>

      <button onClick={addProyecto} disabled={isPending || creating}
        style={{ marginTop: 20, padding: '12px 22px', background: INK, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer', opacity: isPending || creating ? 0.5 : 1 }}>
        {creating ? 'Añadiendo…' : '+ Añadir proyecto'}
      </button>
    </div>
  )
}

/** Borrador editable a partir de la fila guardada. Fuente única para inicializar
 *  el formulario y para saber si hay cambios sin guardar. */
function draftOf(p: WebProyecto) {
  return {
    nombre: p.nombre,
    ubicacion: p.ubicacion ?? '',
    anio: p.anio ?? '',
    nota: p.nota ?? '',
    hero_url: p.hero_url,
    hero_mobile_url: p.hero_mobile_url,
    galeria: p.galeria,
    activo: p.activo,
    descripcion_es: p.descripcion_es ?? '',
    descripcion_en: p.descripcion_en ?? '',
    tipologia_es: p.tipologia_es ?? '',
    tipologia_en: p.tipologia_en ?? '',
    superficie: p.superficie ?? '',
    media: p.media ?? [],
    glb_url: p.glb_url,
  }
}

function ProyectoCard({ proyecto, index, total, onMove, busy }: {
  proyecto: WebProyecto; index: number; total: number; onMove: (id: string, dir: -1 | 1) => void; busy: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(draftOf(proyecto))
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const heroInput = useRef<HTMLInputElement>(null)
  const heroMobileInput = useRef<HTMLInputElement>(null)
  const galInput = useRef<HTMLInputElement>(null)
  const mediaInput = useRef<HTMLInputElement>(null)
  const glbInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => { setDraft((d) => ({ ...d, [k]: v })); setSaved(false) }

  // Cambios sin guardar. Importante con las fotos: la imagen sube al bucket al
  // instante, pero el proyecto no la enseña hasta que se pulsa Guardar; sin este
  // aviso parece que se guardó sola y al recargar no está.
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(proyecto))
  useEffect(() => {
    if (!dirty) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [dirty])

  const uploadInto = async (key: 'hero' | 'heroMobile', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(key); setError(null)
    const res = await uploadImage(file); setUploading(null)
    if ('error' in res) { setError(res.error); return }
    set(key === 'hero' ? 'hero_url' : 'hero_mobile_url', res.url)
  }

  const onGalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return
    setUploading('gal'); setError(null)
    const urls: string[] = []
    for (const f of files.slice(0, 3 - draft.galeria.length)) {
      const res = await uploadImage(f)
      if ('error' in res) { setError(res.error); setUploading(null); return }
      urls.push(res.url)
    }
    setUploading(null); set('galeria', [...draft.galeria, ...urls].slice(0, 3))
  }

  const onMediaFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return
    setUploading('media'); setError(null)
    const nuevos: ProyectoMedia[] = []
    for (const f of files) {
      const res = await uploadImage(f)
      if ('error' in res) { setError(res.error); setUploading(null); return }
      // Vídeo → tipo 'maqueta' por defecto (la mayoría de vídeos son la maqueta orbital); imagen → 'foto'.
      nuevos.push({ url: res.url, tipo: f.type.startsWith('video') ? 'maqueta' : 'foto' })
    }
    setUploading(null); set('media', [...draft.media, ...nuevos])
  }

  const setMedia = (i: number, patch: Partial<ProyectoMedia>) => set('media', draft.media.map((m, j) => j === i ? { ...m, ...patch } : m))
  const removeMedia = (i: number) => set('media', draft.media.filter((_, j) => j !== i))
  const moveMedia = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= draft.media.length) return
    const next = [...draft.media]; [next[i], next[j]] = [next[j], next[i]]; set('media', next)
  }

  const onGlb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading('glb'); setError(null)
    const res = await uploadImage(file); setUploading(null)
    if ('error' in res) { setError(res.error); return }
    set('glb_url', res.url)
  }

  const translateDesc = async () => {
    if (!draft.descripcion_es.trim()) return
    setUploading('trad'); const t = await traducir(draft.descripcion_es); setUploading(null)
    if (t == null) { setError('No se pudo traducir.'); return }
    set('descripcion_en', t)
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateWebProyecto(proyecto.id, {
        nombre: draft.nombre, ubicacion: draft.ubicacion, anio: draft.anio, nota: draft.nota,
        hero_url: draft.hero_url, hero_mobile_url: draft.hero_mobile_url, galeria: draft.galeria, activo: draft.activo,
        descripcion_es: draft.descripcion_es || null, descripcion_en: draft.descripcion_en || null,
        tipologia_es: draft.tipologia_es || null, tipologia_en: draft.tipologia_en || null,
        superficie: draft.superficie || null, media: draft.media, glb_url: draft.glb_url,
        regenerarSlug: !proyecto.slug,
      })
      if ('error' in res) { setError(res.error); return }
      setSaved(true); router.refresh()
    })
  }

  const regenerarUrl = () => {
    if (!confirm(`La URL pública pasará a derivarse de "${draft.nombre}". Cualquier enlace al anterior dejará de funcionar. ¿Continuar?`)) return
    setError(null)
    startTransition(async () => {
      const res = await updateWebProyecto(proyecto.id, { nombre: draft.nombre, regenerarSlug: true })
      if ('error' in res) { setError(res.error); return }
      router.refresh()
    })
  }

  const remove = () => {
    if (!confirm(`¿Eliminar "${proyecto.nombre}" de la web?`)) return
    startTransition(async () => { await deleteWebProyecto(proyecto.id); router.refresh() })
  }

  const anyBusy = busy || isPending || uploading !== null

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 20, opacity: draft.activo ? 1 : 0.6 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
          <button onClick={() => onMove(proyecto.id, -1)} disabled={index === 0 || anyBusy} style={arrowBtn(index === 0 || anyBusy)}>▲</button>
          <span style={{ fontSize: 11, color: `${INK}70`, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <button onClick={() => onMove(proyecto.id, 1)} disabled={index === total - 1 || anyBusy} style={arrowBtn(index === total - 1 || anyBusy)}>▼</button>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 12 }}>
          <div><label style={labelStyle}>Nombre</label><input value={draft.nombre} onChange={(e) => set('nombre', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Ubicación</label><input value={draft.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Año</label><input value={draft.anio} onChange={(e) => set('anio', e.target.value)} style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nota / tipo (grid)</label><input value={draft.nota} onChange={(e) => set('nota', e.target.value)} style={inputStyle} placeholder="Vivienda unifamiliar, Reforma integral…" /></div>
        </div>
      </div>

      {/* Imágenes de grid / Home */}
      <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Foto principal</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Thumb url={draft.hero_url} onRemove={draft.hero_url ? () => set('hero_url', null) : undefined} />
            <button onClick={() => heroInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{uploading === 'hero' ? 'Subiendo…' : draft.hero_url ? 'Cambiar' : 'Subir'}</button>
            <input ref={heroInput} type="file" accept="image/*" hidden onChange={(e) => uploadInto('hero', e)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Foto vertical (móvil)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Thumb url={draft.hero_mobile_url} portrait onRemove={draft.hero_mobile_url ? () => set('hero_mobile_url', null) : undefined} />
            <button onClick={() => heroMobileInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{uploading === 'heroMobile' ? 'Subiendo…' : draft.hero_mobile_url ? 'Cambiar' : 'Subir'}</button>
            <input ref={heroMobileInput} type="file" accept="image/*" hidden onChange={(e) => uploadInto('heroMobile', e)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Galería teaser (hasta 3)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {draft.galeria.map((url) => <Thumb key={url} url={url} onRemove={() => set('galeria', draft.galeria.filter((u) => u !== url))} />)}
            {draft.galeria.length < 3 && <button onClick={() => galInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{uploading === 'gal' ? 'Subiendo…' : '+ Añadir'}</button>}
            <input ref={galInput} type="file" accept="image/*" multiple hidden onChange={onGalFiles} />
          </div>
        </div>
      </div>

      {/* Sección desplegable: Página de proyecto */}
      <button onClick={() => setExpanded((v) => !v)}
        style={{ marginTop: 18, background: 'none', border: 'none', color: ORANGE, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {expanded ? '▾' : '▸'} Página de proyecto (web)
        <span style={{ color: `${INK}45`, fontWeight: 400 }}>· descripción, tipología, fotos, renders, planos, maquetas</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16, paddingLeft: 14, borderLeft: `2px solid ${ORANGE}44`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Tipología (ES)</label><input value={draft.tipologia_es} onChange={(e) => set('tipologia_es', e.target.value)} style={inputStyle} placeholder="Vivienda, Comercial…" /></div>
            <div><label style={labelStyle}>Tipología (EN)</label><input value={draft.tipologia_en} onChange={(e) => set('tipologia_en', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Superficie</label><input value={draft.superficie} onChange={(e) => set('superficie', e.target.value)} style={inputStyle} placeholder="220 m²" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Descripción (ES)</label>
              <textarea value={draft.descripcion_es} onChange={(e) => set('descripcion_es', e.target.value)} rows={5} style={textareaStyle} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Descripción (EN)</label>
                <button onClick={translateDesc} disabled={anyBusy || !draft.descripcion_es.trim()} style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: draft.descripcion_es.trim() ? ORANGE : `${INK}35`, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{uploading === 'trad' ? 'Traduciendo…' : '↳ Traducir con IA'}</button>
              </div>
              <textarea value={draft.descripcion_en} onChange={(e) => set('descripcion_en', e.target.value)} rows={5} style={textareaStyle} />
            </div>
          </div>

          {/* Media tipada */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={labelStyle}>Galería de la página — fotos, renders, planos, maquetas, vídeos</label>
              <button onClick={() => mediaInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{uploading === 'media' ? 'Subiendo…' : '+ Añadir imágenes / vídeos'}</button>
              <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={onMediaFiles} />
            </div>
            {draft.media.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {draft.media.map((m, i) => (
                  <div key={m.url + i} style={{ display: 'flex', gap: 12, alignItems: 'center', border: `1px solid ${BORDER}`, borderRadius: 4, padding: 8 }}>
                    <Thumb url={m.url} />
                    <select value={m.tipo} onChange={(e) => setMedia(i, { tipo: e.target.value as ProyectoMediaTipo })} style={{ ...inputStyle, width: 120, padding: '6px 8px' }}>
                      <option value="foto">Foto</option>
                      <option value="render">Render</option>
                      <option value="plano">Plano</option>
                      <option value="maqueta">Maqueta</option>
                      <option value="video">Vídeo</option>
                    </select>
                    <input value={m.caption_es ?? ''} onChange={(e) => setMedia(i, { caption_es: e.target.value })} placeholder="Pie de foto (ES)" style={{ ...inputStyle, flex: 1, padding: '6px 8px' }} />
                    <input value={m.caption_en ?? ''} onChange={(e) => setMedia(i, { caption_en: e.target.value })} placeholder="Caption (EN)" style={{ ...inputStyle, flex: 1, padding: '6px 8px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button onClick={() => moveMedia(i, -1)} disabled={i === 0} style={arrowBtn(i === 0)}>▲</button>
                      <button onClick={() => moveMedia(i, 1)} disabled={i === draft.media.length - 1} style={arrowBtn(i === draft.media.length - 1)}>▼</button>
                    </div>
                    <button onClick={() => removeMedia(i)} style={{ background: 'none', border: 'none', color: `${INK}70`, fontSize: 14, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maqueta 3D interactiva (GLB) */}
          <div>
            <label style={labelStyle}>Maqueta 3D interactiva (GLB) — opcional</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => glbInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{uploading === 'glb' ? 'Subiendo…' : draft.glb_url ? 'Cambiar GLB' : 'Subir GLB'}</button>
              {draft.glb_url && <span style={{ fontSize: 12, color: '#2e7d32' }}>Archivo cargado ✓</span>}
              {draft.glb_url && <button onClick={() => set('glb_url', null)} style={{ background: 'none', border: 'none', color: `${INK}60`, fontSize: 12, cursor: 'pointer' }}>Quitar</button>}
              <input ref={glbInput} type="file" accept=".glb,.gltf" hidden onChange={onGlb} />
            </div>
            <p style={{ fontSize: 11, color: `${INK}45`, margin: '6px 0 0' }}>Si subes un GLB, la página muestra un visor 3D girable. Si no, se usan las fotos/renders y el vídeo de maqueta.</p>
          </div>

        </div>
      )}

      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 12 }}>{error}</p>}

      {/* URL pública: siempre a la vista. El slug NO se regenera al renombrar (los
          enlaces ya compartidos dejarían de funcionar), así que se ofrece a mano. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 11, color: `${INK}45`, flexWrap: 'wrap' }}>
        {proyecto.slug ? (
          <>
            <span>URL: <code style={{ color: `${INK}70` }}>/proyectos/{proyecto.slug}</code></span>
            {slugifyProyecto(draft.nombre || '') !== proyecto.slug && (
              <button onClick={regenerarUrl} disabled={anyBusy}
                style={{ background: 'none', border: 'none', padding: 0, color: ORANGE, fontSize: 11, cursor: anyBusy ? 'default' : 'pointer', textDecoration: 'underline' }}>
                actualizar URL al nombre nuevo
              </button>
            )}
          </>
        ) : (
          <span>Sin URL pública todavía: se genera al guardar (y hasta entonces el proyecto no tiene página propia).</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: `${INK}90`, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.activo} onChange={(e) => set('activo', e.target.checked)} />
          Visible en la web
        </label>
        {dirty && (
          <span style={{ fontSize: 11, color: '#8a5a00', background: '#FFF6E5', border: '1px solid #F0E0BC', borderRadius: 99, padding: '3px 10px' }}>
            cambios sin guardar
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={remove} disabled={anyBusy} style={{ background: 'none', border: 'none', color: `${INK}70`, fontSize: 12, cursor: anyBusy ? 'default' : 'pointer' }}>Eliminar</button>
        <button onClick={save} disabled={anyBusy}
          style={{ padding: '9px 20px', background: saved ? '#2e7d32' : ORANGE, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', cursor: anyBusy ? 'default' : 'pointer', opacity: anyBusy ? 0.6 : 1 }}>
          {isPending ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function Thumb({ url, onRemove, portrait }: { url: string | null; onRemove?: () => void; portrait?: boolean }) {
  return (
    <div style={{ position: 'relative', width: portrait ? 48 : 64, height: 64, borderRadius: 4, overflow: 'hidden', background: '#F8F7F4', border: `1px solid ${BORDER}`, flex: 'none' }}>
      {url ? (
        esVideoUrl(url)
          // eslint-disable-next-line jsx-a11y/media-has-caption
          ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${INK}30`, fontSize: 18 }}>+</div>
      )}
      {url && onRemove && (
        <button onClick={onRemove} aria-label="Quitar" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      )}
    </div>
  )
}

const arrowBtn = (disabled: boolean): React.CSSProperties => ({ background: 'none', border: 'none', color: disabled ? '#1A1A1A30' : '#1A1A1A80', fontSize: 9, cursor: disabled ? 'default' : 'pointer', padding: 2, lineHeight: 1 })
const uploadBtn = (disabled: boolean): React.CSSProperties => ({ padding: '7px 14px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, color: INK, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap' })

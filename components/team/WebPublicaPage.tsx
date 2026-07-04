'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createWebProyecto,
  updateWebProyecto,
  deleteWebProyecto,
  reorderWebProyectos,
} from '@/app/actions/web-publica'
import type { WebProyecto } from '@/lib/web-publica'

const BUCKET = 'web-publica'
const ORANGE = '#D85A30'
const INK = '#1A1A1A'
const BORDER = '#F0EEE8'

async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: 5, display: 'block',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 4,
  fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none',
}

export function WebPublicaPage({ proyectos }: { proyectos: WebProyecto[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)

  const ids = proyectos.map((p) => p.id)

  const move = (id: string, dir: -1 | 1) => {
    const idx = ids.indexOf(id)
    const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    startTransition(async () => {
      await reorderWebProyectos(next)
      router.refresh()
    })
  }

  const addProyecto = () => {
    setCreating(true)
    startTransition(async () => {
      await createWebProyecto({ nombre: 'Nuevo proyecto' })
      setCreating(false)
      router.refresh()
    })
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 960 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: `${INK}99`, marginBottom: 8 }}>
        Marketing · Forma Prima
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: INK, letterSpacing: '-0.02em', margin: 0 }}>
          Web pública
        </h1>
        <a
          href="/wip"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE, fontWeight: 500, textDecoration: 'none' }}
        >
          Ver teaser ↗
        </a>
      </div>
      <p style={{ fontSize: 13, color: `${INK}60`, marginBottom: 32, fontWeight: 300, maxWidth: 560, lineHeight: 1.5 }}>
        Proyectos e imágenes que aparecen en el teaser de <strong style={{ fontWeight: 500 }}>formaprima.es</strong>.
        El orden aquí es el orden en la web. Desactiva un proyecto para ocultarlo sin borrarlo.
        La <strong style={{ fontWeight: 500 }}>foto vertical</strong> sustituye a la principal cuando la web se ve desde el móvil (si no la pones, se usa la principal).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {proyectos.map((p, i) => (
          <ProyectoCard
            key={p.id}
            proyecto={p}
            index={i}
            total={proyectos.length}
            onMove={move}
            busy={isPending}
          />
        ))}
      </div>

      <button
        onClick={addProyecto}
        disabled={isPending || creating}
        style={{
          marginTop: 20, padding: '12px 22px', background: INK, color: '#fff', border: 'none', borderRadius: 4,
          fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', cursor: isPending ? 'default' : 'pointer',
          opacity: isPending || creating ? 0.5 : 1,
        }}
      >
        {creating ? 'Añadiendo…' : '+ Añadir proyecto'}
      </button>
    </div>
  )
}

function ProyectoCard({
  proyecto, index, total, onMove, busy,
}: {
  proyecto: WebProyecto
  index: number
  total: number
  onMove: (id: string, dir: -1 | 1) => void
  busy: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState({
    nombre: proyecto.nombre,
    ubicacion: proyecto.ubicacion ?? '',
    anio: proyecto.anio ?? '',
    nota: proyecto.nota ?? '',
    hero_url: proyecto.hero_url,
    hero_mobile_url: proyecto.hero_mobile_url,
    galeria: proyecto.galeria,
    activo: proyecto.activo,
  })
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const heroInput = useRef<HTMLInputElement>(null)
  const heroMobileInput = useRef<HTMLInputElement>(null)
  const galInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setSaved(false)
  }

  const onHeroFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('hero'); setError(null)
    const res = await uploadImage(file)
    setUploading(null)
    if ('error' in res) { setError(res.error); return }
    set('hero_url', res.url)
  }

  const onMobileHeroFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('heroMobile'); setError(null)
    const res = await uploadImage(file)
    setUploading(null)
    if ('error' in res) { setError(res.error); return }
    set('hero_mobile_url', res.url)
  }

  const onGalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading('gal'); setError(null)
    const urls: string[] = []
    for (const f of files.slice(0, 3 - draft.galeria.length)) {
      const res = await uploadImage(f)
      if ('error' in res) { setError(res.error); setUploading(null); return }
      urls.push(res.url)
    }
    setUploading(null)
    set('galeria', [...draft.galeria, ...urls].slice(0, 3))
  }

  const removeGal = (url: string) => set('galeria', draft.galeria.filter((u) => u !== url))

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateWebProyecto(proyecto.id, {
        nombre: draft.nombre,
        ubicacion: draft.ubicacion,
        anio: draft.anio,
        nota: draft.nota,
        hero_url: draft.hero_url,
        hero_mobile_url: draft.hero_mobile_url,
        galeria: draft.galeria,
        activo: draft.activo,
      })
      if ('error' in res) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  const remove = () => {
    if (!confirm(`¿Eliminar "${proyecto.nombre}" de la web?`)) return
    startTransition(async () => {
      await deleteWebProyecto(proyecto.id)
      router.refresh()
    })
  }

  const anyBusy = busy || isPending || uploading !== null

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 20, opacity: draft.activo ? 1 : 0.6 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Orden */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
          <button onClick={() => onMove(proyecto.id, -1)} disabled={index === 0 || anyBusy}
            style={arrowBtn(index === 0 || anyBusy)}>▲</button>
          <span style={{ fontSize: 11, color: `${INK}70`, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <button onClick={() => onMove(proyecto.id, 1)} disabled={index === total - 1 || anyBusy}
            style={arrowBtn(index === total - 1 || anyBusy)}>▼</button>
        </div>

        {/* Campos */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nombre</label>
            <input value={draft.nombre} onChange={(e) => set('nombre', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ubicación</label>
            <input value={draft.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Año</label>
            <input value={draft.anio} onChange={(e) => set('anio', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Nota / tipo</label>
            <input value={draft.nota} onChange={(e) => set('nota', e.target.value)} style={inputStyle} placeholder="Vivienda unifamiliar, Reforma integral…" />
          </div>
        </div>
      </div>

      {/* Imágenes */}
      <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
        {/* Hero */}
        <div>
          <label style={labelStyle}>Foto principal</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Thumb url={draft.hero_url} onRemove={draft.hero_url ? () => set('hero_url', null) : undefined} />
            <button onClick={() => heroInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>
              {uploading === 'hero' ? 'Subiendo…' : draft.hero_url ? 'Cambiar' : 'Subir'}
            </button>
            <input ref={heroInput} type="file" accept="image/*" hidden onChange={onHeroFile} />
          </div>
        </div>

        {/* Hero vertical (móvil) */}
        <div>
          <label style={labelStyle}>Foto vertical (móvil)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Thumb url={draft.hero_mobile_url} portrait onRemove={draft.hero_mobile_url ? () => set('hero_mobile_url', null) : undefined} />
            <button onClick={() => heroMobileInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>
              {uploading === 'heroMobile' ? 'Subiendo…' : draft.hero_mobile_url ? 'Cambiar' : 'Subir'}
            </button>
            <input ref={heroMobileInput} type="file" accept="image/*" hidden onChange={onMobileHeroFile} />
          </div>
        </div>

        {/* Galería */}
        <div>
          <label style={labelStyle}>Galería (hasta 3)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {draft.galeria.map((url) => (
              <Thumb key={url} url={url} onRemove={() => removeGal(url)} />
            ))}
            {draft.galeria.length < 3 && (
              <button onClick={() => galInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>
                {uploading === 'gal' ? 'Subiendo…' : '+ Añadir'}
              </button>
            )}
            <input ref={galInput} type="file" accept="image/*" multiple hidden onChange={onGalFiles} />
          </div>
        </div>
      </div>

      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 12 }}>{error}</p>}

      {/* Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: `${INK}90`, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.activo} onChange={(e) => set('activo', e.target.checked)} />
          Visible en la web
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={remove} disabled={anyBusy}
          style={{ background: 'none', border: 'none', color: `${INK}70`, fontSize: 12, cursor: anyBusy ? 'default' : 'pointer' }}>
          Eliminar
        </button>
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${INK}30`, fontSize: 18 }}>+</div>
      )}
      {url && onRemove && (
        <button onClick={onRemove} aria-label="Quitar"
          style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      )}
    </div>
  )
}

const arrowBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'none', border: 'none', color: disabled ? '#1A1A1A30' : '#1A1A1A80',
  fontSize: 9, cursor: disabled ? 'default' : 'pointer', padding: 2, lineHeight: 1,
})
const uploadBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '7px 14px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4,
  fontSize: 11, color: INK, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
})

'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { subirArchivo } from '@/lib/web-publica/subida'
import { createPropiedad, updatePropiedad, deletePropiedad, reorderPropiedades } from '@/app/actions/web-propiedades'
import type { WebPropiedad } from '@/lib/web-propiedades'

const ORANGE = '#D85A30', INK = '#1A1A1A', BORDER = '#F0EEE8'

// Delega en el helper compartido: sube el original intacto y genera la escalera
// de variantes (ver lib/web-publica/subida.ts). Antes cada editor tenía su
// propia copia de esto y ninguna comprimía.
async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const res = await subirArchivo(file, 'propiedades')
  if ('error' in res) return { error: res.error }
  if (res.aviso) console.warn('[web-publica] subida sin optimizar:', res.aviso)
  return { url: res.url }
}
async function traducir(texto: string): Promise<string | null> {
  try {
    const res = await fetch('/api/web-publica/traducir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })
    if (!res.ok) return null
    const j = await res.json(); return typeof j.traduccion === 'string' ? j.traduccion : null
  } catch { return null }
}

export function PropiedadesEditor({ propiedades }: { propiedades: WebPropiedad[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const ids = propiedades.map((p) => p.id)
  const move = (id: string, dir: -1 | 1) => {
    const idx = ids.indexOf(id); const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]; [next[idx], next[swap]] = [next[swap], next[idx]]
    startTransition(async () => { await reorderPropiedades(next); router.refresh() })
  }
  const add = () => startTransition(async () => { await createPropiedad(); router.refresh() })

  return (
    <div>
      <p style={{ fontSize: 13, color: `${INK}60`, marginBottom: 28, fontWeight: 300, maxWidth: 620, lineHeight: 1.5 }}>
        Propiedades en venta. Marca «Disponible» para el badge; desactiva para ocultarla sin borrarla. El orden aquí es el orden en la web.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {propiedades.map((p, i) => <PropCard key={p.id} propiedad={p} index={i} total={propiedades.length} onMove={move} busy={isPending} />)}
      </div>
      <button onClick={add} disabled={isPending} style={{ marginTop: 20, padding: '12px 22px', background: INK, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}>+ Añadir propiedad</button>
    </div>
  )
}

function PropCard({ propiedad, index, total, onMove, busy }: { propiedad: WebPropiedad; index: number; total: number; onMove: (id: string, dir: -1 | 1) => void; busy: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [d, setD] = useState({
    nombre: propiedad.nombre, ubicacion: propiedad.ubicacion ?? '', precio: propiedad.precio ?? '',
    descripcion_es: propiedad.descripcion_es ?? '', descripcion_en: propiedad.descripcion_en ?? '',
    hero_url: propiedad.hero_url, galeria: propiedad.galeria, disponible: propiedad.disponible, activo: propiedad.activo,
  })
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heroInput = useRef<HTMLInputElement>(null)
  const galInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((p) => ({ ...p, [k]: v })); setSaved(false) }

  const onHero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusyKey('hero'); setError(null); const res = await uploadImage(file); setBusyKey(null)
    if ('error' in res) { setError(res.error); return }; set('hero_url', res.url)
  }
  const onGal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return
    setBusyKey('gal'); setError(null); const urls: string[] = []
    for (const f of files) { const res = await uploadImage(f); if ('error' in res) { setError(res.error); setBusyKey(null); return }; urls.push(res.url) }
    setBusyKey(null); set('galeria', [...d.galeria, ...urls])
  }
  const trDesc = async () => { if (!d.descripcion_es.trim()) return; setBusyKey('trad'); const t = await traducir(d.descripcion_es); setBusyKey(null); if (t == null) { setError('No se pudo traducir.'); return }; set('descripcion_en', t) }
  const save = () => startTransition(async () => {
    setError(null)
    const res = await updatePropiedad(propiedad.id, {
      nombre: d.nombre, ubicacion: d.ubicacion || null, precio: d.precio || null,
      descripcion_es: d.descripcion_es || null, descripcion_en: d.descripcion_en || null,
      hero_url: d.hero_url, galeria: d.galeria, disponible: d.disponible, activo: d.activo,
      regenerarSlug: !propiedad.slug,
    })
    if ('error' in res) { setError(res.error); return }; setSaved(true); router.refresh()
  })
  const remove = () => { if (!confirm(`¿Eliminar "${propiedad.nombre}"?`)) return; startTransition(async () => { await deletePropiedad(propiedad.id); router.refresh() }) }
  const anyBusy = busy || isPending || busyKey !== null

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 20, opacity: d.activo ? 1 : 0.6 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
          <button onClick={() => onMove(propiedad.id, -1)} disabled={index === 0 || anyBusy} style={arrowBtn(index === 0 || anyBusy)}>▲</button>
          <span style={{ fontSize: 11, color: `${INK}70`, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <button onClick={() => onMove(propiedad.id, 1)} disabled={index === total - 1 || anyBusy} style={arrowBtn(index === total - 1 || anyBusy)}>▼</button>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Nombre</label><input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Ubicación</label><input value={d.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Precio</label><input value={d.precio} onChange={(e) => set('precio', e.target.value)} style={inp} placeholder="1.850.000 € / Consultar" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div><label style={lbl}>Descripción (ES)</label><textarea value={d.descripcion_es} onChange={(e) => set('descripcion_es', e.target.value)} rows={4} style={ta} /></div>
            <div>
              <div style={row}><label style={lbl}>Descripción (EN)</label><button onClick={trDesc} disabled={anyBusy || !d.descripcion_es.trim()} style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: d.descripcion_es.trim() ? ORANGE : `${INK}35`, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{busyKey === 'trad' ? 'Traduciendo…' : '↳ IA'}</button></div>
              <textarea value={d.descripcion_en} onChange={(e) => set('descripcion_en', e.target.value)} rows={4} style={ta} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Foto principal</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Thumb url={d.hero_url} onRemove={d.hero_url ? () => set('hero_url', null) : undefined} />
                <button onClick={() => heroInput.current?.click()} disabled={anyBusy} style={up(anyBusy)}>{busyKey === 'hero' ? 'Subiendo…' : d.hero_url ? 'Cambiar' : 'Subir'}</button>
                <input ref={heroInput} type="file" accept="image/*" hidden onChange={onHero} />
              </div>
            </div>
            <div>
              <label style={lbl}>Galería</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {d.galeria.map((url) => <Thumb key={url} url={url} onRemove={() => set('galeria', d.galeria.filter((u) => u !== url))} />)}
                <button onClick={() => galInput.current?.click()} disabled={anyBusy} style={up(anyBusy)}>{busyKey === 'gal' ? 'Subiendo…' : '+ Añadir'}</button>
                <input ref={galInput} type="file" accept="image/*" multiple hidden onChange={onGal} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: `${INK}90`, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.disponible} onChange={(e) => set('disponible', e.target.checked)} /> Disponible
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: `${INK}90`, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.activo} onChange={(e) => set('activo', e.target.checked)} /> Visible en la web
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={remove} disabled={anyBusy} style={{ background: 'none', border: 'none', color: `${INK}70`, fontSize: 12, cursor: 'pointer' }}>Eliminar</button>
        <button onClick={save} disabled={anyBusy} style={{ padding: '9px 20px', background: saved ? '#2e7d32' : ORANGE, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', cursor: 'pointer', opacity: anyBusy ? 0.6 : 1 }}>{isPending ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}</button>
      </div>
    </div>
  )
}

function Thumb({ url, onRemove }: { url: string | null; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 4, overflow: 'hidden', background: '#F8F7F4', border: `1px solid ${BORDER}`, flex: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${INK}30`, fontSize: 18 }}>+</div>}
      {url && onRemove && <button onClick={onRemove} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>}
    </div>
  )
}
const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: 5, display: 'block' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none' }
const ta: React.CSSProperties = { ...inp, resize: 'vertical', lineHeight: 1.5 }
const arrowBtn = (dis: boolean): React.CSSProperties => ({ background: 'none', border: 'none', color: dis ? '#1A1A1A30' : '#1A1A1A80', fontSize: 9, cursor: dis ? 'default' : 'pointer', padding: 2, lineHeight: 1 })
const up = (dis: boolean): React.CSSProperties => ({ padding: '7px 14px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, color: INK, cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.6 : 1, whiteSpace: 'nowrap' })

'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { subirArchivo } from '@/lib/web-publica/subida'
import { createWebEquipo, updateWebEquipo, deleteWebEquipo, reorderWebEquipo } from '@/app/actions/web-equipo'
import type { WebEquipo } from '@/lib/web-equipo'

const ORANGE = '#D85A30'
const INK = '#1A1A1A'
const BORDER = '#F0EEE8'

// Delega en el helper compartido: sube el original intacto y genera la escalera
// de variantes (ver lib/web-publica/subida.ts). Antes cada editor tenía su
// propia copia de esto y ninguna comprimía.
async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const res = await subirArchivo(file, 'equipo')
  if ('error' in res) return { error: res.error }
  if (res.aviso) console.warn('[web-publica] subida sin optimizar:', res.aviso)
  return { url: res.url }
}

async function traducir(texto: string): Promise<string | null> {
  try {
    const res = await fetch('/api/web-publica/traducir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })
    if (!res.ok) return null
    const j = await res.json()
    return typeof j.traduccion === 'string' ? j.traduccion : null
  } catch { return null }
}

export function EquipoEditor({ equipo }: { equipo: WebEquipo[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const ids = equipo.map((m) => m.id)

  const move = (id: string, dir: -1 | 1) => {
    const idx = ids.indexOf(id); const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]; [next[idx], next[swap]] = [next[swap], next[idx]]
    startTransition(async () => { await reorderWebEquipo(next); router.refresh() })
  }

  const add = () => {
    setCreating(true)
    startTransition(async () => { await createWebEquipo(); setCreating(false); router.refresh() })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: `${INK}60`, marginBottom: 28, fontWeight: 300, maxWidth: 620, lineHeight: 1.5 }}>
        Integrantes del estudio. En la web se muestran en un grid; al hacer <strong style={{ fontWeight: 500 }}>hover</strong> aparece
        el CV corto y al hacer clic se abre su página con el CV extenso y la segunda foto. El orden aquí es el orden en la web.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {equipo.map((m, i) => (
          <MiembroCard key={m.id} miembro={m} index={i} total={equipo.length} onMove={move} busy={isPending} />
        ))}
      </div>

      <button onClick={add} disabled={isPending || creating}
        style={{ marginTop: 20, padding: '12px 22px', background: INK, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer', opacity: isPending || creating ? 0.5 : 1 }}>
        {creating ? 'Añadiendo…' : '+ Añadir miembro'}
      </button>
    </div>
  )
}

function MiembroCard({ miembro, index, total, onMove, busy }: {
  miembro: WebEquipo; index: number; total: number; onMove: (id: string, dir: -1 | 1) => void; busy: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [d, setD] = useState({
    nombre: miembro.nombre,
    rol_es: miembro.rol_es ?? '', rol_en: miembro.rol_en ?? '',
    foto_url: miembro.foto_url, foto_detalle_url: miembro.foto_detalle_url,
    cv_corto_es: miembro.cv_corto_es ?? '', cv_corto_en: miembro.cv_corto_en ?? '',
    cv_largo_es: miembro.cv_largo_es ?? '', cv_largo_en: miembro.cv_largo_en ?? '',
    activo: miembro.activo,
  })
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fotoInput = useRef<HTMLInputElement>(null)
  const detalleInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((p) => ({ ...p, [k]: v })); setSaved(false) }

  const onFile = async (which: 'foto_url' | 'foto_detalle_url', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusyKey(which); setError(null)
    const res = await uploadImage(file); setBusyKey(null)
    if ('error' in res) { setError(res.error); return }
    set(which, res.url)
  }

  const onTranslate = async (from: 'rol_es' | 'cv_corto_es' | 'cv_largo_es', to: 'rol_en' | 'cv_corto_en' | 'cv_largo_en') => {
    if (!d[from].trim()) return
    setBusyKey(to); const t = await traducir(d[from]); setBusyKey(null)
    if (t == null) { setError('No se pudo traducir.'); return }
    set(to, t)
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateWebEquipo(miembro.id, {
        nombre: d.nombre, rol_es: d.rol_es, rol_en: d.rol_en,
        foto_url: d.foto_url, foto_detalle_url: d.foto_detalle_url,
        cv_corto_es: d.cv_corto_es, cv_corto_en: d.cv_corto_en,
        cv_largo_es: d.cv_largo_es, cv_largo_en: d.cv_largo_en,
        activo: d.activo,
        // Genera el slug automáticamente mientras siga siendo el de por defecto.
        regenerarSlug: miembro.slug.startsWith('nuevo-miembro'),
      })
      if ('error' in res) { setError(res.error); return }
      setSaved(true); router.refresh()
    })
  }

  const remove = () => {
    if (!confirm(`¿Eliminar a "${miembro.nombre}" del equipo?`)) return
    startTransition(async () => { await deleteWebEquipo(miembro.id); router.refresh() })
  }

  const anyBusy = busy || isPending || busyKey !== null

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 20, opacity: d.activo ? 1 : 0.6 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
          <button onClick={() => onMove(miembro.id, -1)} disabled={index === 0 || anyBusy} style={arrowBtn(index === 0 || anyBusy)}>▲</button>
          <span style={{ fontSize: 11, color: `${INK}70`, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <button onClick={() => onMove(miembro.id, 1)} disabled={index === total - 1 || anyBusy} style={arrowBtn(index === total - 1 || anyBusy)}>▼</button>
        </div>

        <div style={{ flex: 1 }}>
          {/* Nombre + rol */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Rol (ES)</label>
              <input value={d.rol_es} onChange={(e) => set('rol_es', e.target.value)} style={inputStyle} placeholder="Arquitecto, Socia fundadora…" />
            </div>
            <div>
              <div style={langHeader}>
                <label style={labelStyle}>Rol (EN)</label>
                <TransBtn on={() => onTranslate('rol_es', 'rol_en')} busy={busyKey === 'rol_en'} disabled={!d.rol_es.trim()} />
              </div>
              <input value={d.rol_en} onChange={(e) => set('rol_en', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* CV corto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>CV corto — hover (ES)</label>
              <textarea value={d.cv_corto_es} onChange={(e) => set('cv_corto_es', e.target.value)} rows={2} style={textareaStyle} />
            </div>
            <div>
              <div style={langHeader}>
                <label style={labelStyle}>CV corto (EN)</label>
                <TransBtn on={() => onTranslate('cv_corto_es', 'cv_corto_en')} busy={busyKey === 'cv_corto_en'} disabled={!d.cv_corto_es.trim()} />
              </div>
              <textarea value={d.cv_corto_en} onChange={(e) => set('cv_corto_en', e.target.value)} rows={2} style={textareaStyle} />
            </div>
          </div>

          {/* CV largo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>CV extenso — página (ES)</label>
              <textarea value={d.cv_largo_es} onChange={(e) => set('cv_largo_es', e.target.value)} rows={5} style={textareaStyle} />
            </div>
            <div>
              <div style={langHeader}>
                <label style={labelStyle}>CV extenso (EN)</label>
                <TransBtn on={() => onTranslate('cv_largo_es', 'cv_largo_en')} busy={busyKey === 'cv_largo_en'} disabled={!d.cv_largo_es.trim()} />
              </div>
              <textarea value={d.cv_largo_en} onChange={(e) => set('cv_largo_en', e.target.value)} rows={5} style={textareaStyle} />
            </div>
          </div>

          {/* Fotos */}
          <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>Foto principal (grid)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Thumb url={d.foto_url} portrait onRemove={d.foto_url ? () => set('foto_url', null) : undefined} />
                <button onClick={() => fotoInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{busyKey === 'foto_url' ? 'Subiendo…' : d.foto_url ? 'Cambiar' : 'Subir'}</button>
                <input ref={fotoInput} type="file" accept="image/*" hidden onChange={(e) => onFile('foto_url', e)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Foto de detalle (página)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Thumb url={d.foto_detalle_url} portrait onRemove={d.foto_detalle_url ? () => set('foto_detalle_url', null) : undefined} />
                <button onClick={() => detalleInput.current?.click()} disabled={anyBusy} style={uploadBtn(anyBusy)}>{busyKey === 'foto_detalle_url' ? 'Subiendo…' : d.foto_detalle_url ? 'Cambiar' : 'Subir'}</button>
                <input ref={detalleInput} type="file" accept="image/*" hidden onChange={(e) => onFile('foto_detalle_url', e)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: `${INK}90`, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.activo} onChange={(e) => set('activo', e.target.checked)} />
          Visible en la web
        </label>
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

function TransBtn({ on, busy, disabled }: { on: () => void; busy: boolean; disabled: boolean }) {
  return (
    <button onClick={on} disabled={busy || disabled}
      style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: disabled ? `${INK}35` : ORANGE, background: 'none', border: 'none', cursor: disabled || busy ? 'default' : 'pointer', padding: 0 }}>
      {busy ? 'Traduciendo…' : '↳ IA'}
    </button>
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
        <button onClick={onRemove} aria-label="Quitar" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: 5, display: 'block' }
const langHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none' }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', lineHeight: 1.5 }
const arrowBtn = (disabled: boolean): React.CSSProperties => ({ background: 'none', border: 'none', color: disabled ? '#1A1A1A30' : '#1A1A1A80', fontSize: 9, cursor: disabled ? 'default' : 'pointer', padding: 2, lineHeight: 1 })
const uploadBtn = (disabled: boolean): React.CSSProperties => ({ padding: '7px 14px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, color: INK, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap' })

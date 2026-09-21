'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { subirArchivo } from '@/lib/web-publica/subida'
import { createFpTool, updateFpTool, deleteFpTool, reorderFpTools, renombrarSlugFpTool } from '@/app/actions/web-fp-tools'
import type { WebFpTool } from '@/lib/web-fp-tools'
import { FpToolBloquesEditor } from './FpToolBloquesEditor'
// La base del sitio público se importa, no se copia: así este enlace sigue a
// SITE_BASE si el sitio vuelve a montarse bajo un prefijo.
import { SITE_BASE } from '@/components/public/site/SiteProvider'

const ORANGE = '#D85A30', INK = '#1A1A1A', BORDER = '#F0EEE8'

// Delega en el helper compartido: sube el original intacto y genera la escalera
// de variantes (ver lib/web-publica/subida.ts). Antes cada editor tenía su
// propia copia de esto y ninguna comprimía.
async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  const res = await subirArchivo(file, 'fp-tools')
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

export function FpToolsEditor({ tools }: { tools: WebFpTool[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const ids = tools.map((t) => t.id)
  const move = (id: string, dir: -1 | 1) => {
    const idx = ids.indexOf(id); const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]; [next[idx], next[swap]] = [next[swap], next[idx]]
    startTransition(async () => { await reorderFpTools(next); router.refresh() })
  }
  const add = () => startTransition(async () => { await createFpTool(); router.refresh() })

  return (
    <div>
      <p style={{ fontSize: 13, color: `${INK}60`, marginBottom: 28, fontWeight: 300, maxWidth: 620, lineHeight: 1.5 }}>
        Capacidades que os diferencian del arquitecto tradicional (Visual Lab, presupuestos paramétricos, portal de
        cliente, Urban Analyst…). Se muestran como escaparate comercial. El orden aquí es el orden en la web.
        Cada capacidad tiene además su propia página, que abre con su vídeo explicativo: se monta desde
        «Subpágina», abajo en cada ficha.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tools.map((t, i) => <ToolCard key={t.id} tool={t} index={i} total={tools.length} onMove={move} busy={isPending} />)}
      </div>
      <button onClick={add} disabled={isPending} style={{ marginTop: 20, padding: '12px 22px', background: INK, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}>+ Añadir capacidad</button>
    </div>
  )
}

function ToolCard({ tool, index, total, onMove, busy }: { tool: WebFpTool; index: number; total: number; onMove: (id: string, dir: -1 | 1) => void; busy: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [d, setD] = useState({
    nombre: tool.nombre,
    tagline_es: tool.tagline_es ?? '', tagline_en: tool.tagline_en ?? '',
    descripcion_es: tool.descripcion_es ?? '', descripcion_en: tool.descripcion_en ?? '',
    imagen_url: tool.imagen_url,
    video_url: tool.video_url, video_poster_url: tool.video_poster_url,
    cta_label_es: tool.cta_label_es ?? '', cta_label_en: tool.cta_label_en ?? '', cta_url: tool.cta_url ?? '',
    activo: tool.activo,
  })
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState(false)
  const imgInput = useRef<HTMLInputElement>(null)
  const vidInput = useRef<HTMLInputElement>(null)
  const posInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((p) => ({ ...p, [k]: v })); setSaved(false) }

  const onImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusyKey('img'); setError(null); const res = await uploadImage(file); setBusyKey(null)
    if ('error' in res) { setError(res.error); return }; set('imagen_url', res.url)
  }
  /**
   * El vídeo sube TAL CUAL: `subirArchivo` solo genera escalera de variantes para
   * mapas de bits, y no hay transcodificación en el servidor. Así que lo que se
   * suba aquí es exactamente lo que descargará el visitante — conviene que salga
   * de la exportación ya comprimida, no del máster.
   */
  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusyKey('video'); setError(null)
    const res = await subirArchivo(file, 'fp-tools')
    setBusyKey(null)
    if ('error' in res) { setError(res.error); return }
    set('video_url', res.url)
  }
  const onPoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBusyKey('poster'); setError(null); const res = await uploadImage(file); setBusyKey(null)
    if ('error' in res) { setError(res.error); return }; set('video_poster_url', res.url)
  }
  const rehacerSlug = () => startTransition(async () => {
    setError(null)
    const res = await renombrarSlugFpTool(tool.id)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
  })
  const tr = async (from: 'tagline_es' | 'descripcion_es' | 'cta_label_es', to: 'tagline_en' | 'descripcion_en' | 'cta_label_en') => {
    if (!d[from].trim()) return
    setBusyKey(to); const t = await traducir(d[from]); setBusyKey(null)
    if (t == null) { setError('No se pudo traducir.'); return }; set(to, t)
  }
  const save = () => startTransition(async () => {
    setError(null)
    const res = await updateFpTool(tool.id, {
      nombre: d.nombre, tagline_es: d.tagline_es || null, tagline_en: d.tagline_en || null,
      descripcion_es: d.descripcion_es || null, descripcion_en: d.descripcion_en || null,
      imagen_url: d.imagen_url, video_url: d.video_url, video_poster_url: d.video_poster_url,
      cta_label_es: d.cta_label_es || null, cta_label_en: d.cta_label_en || null, cta_url: d.cta_url || null, activo: d.activo,
    })
    if ('error' in res) { setError(res.error); return }; setSaved(true); router.refresh()
  })
  const remove = () => { if (!confirm(`¿Eliminar "${tool.nombre}"?`)) return; startTransition(async () => { await deleteFpTool(tool.id); router.refresh() }) }
  const anyBusy = busy || isPending || busyKey !== null

  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 20, opacity: d.activo ? 1 : 0.6 }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2 }}>
          <button onClick={() => onMove(tool.id, -1)} disabled={index === 0 || anyBusy} style={arrowBtn(index === 0 || anyBusy)}>▲</button>
          <span style={{ fontSize: 11, color: `${INK}70`, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <button onClick={() => onMove(tool.id, 1)} disabled={index === total - 1 || anyBusy} style={arrowBtn(index === total - 1 || anyBusy)}>▼</button>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Nombre</label><input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} placeholder="Visual Lab, Urban Analyst…" /></div>
            <div><label style={lbl}>Tagline (ES)</label><input value={d.tagline_es} onChange={(e) => set('tagline_es', e.target.value)} style={inp} /></div>
            <div>
              <div style={row}><label style={lbl}>Tagline (EN)</label><Tr on={() => tr('tagline_es', 'tagline_en')} busy={busyKey === 'tagline_en'} disabled={!d.tagline_es.trim()} /></div>
              <input value={d.tagline_en} onChange={(e) => set('tagline_en', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div><label style={lbl}>Descripción (ES)</label><textarea value={d.descripcion_es} onChange={(e) => set('descripcion_es', e.target.value)} rows={4} style={ta} /></div>
            <div>
              <div style={row}><label style={lbl}>Descripción (EN)</label><Tr on={() => tr('descripcion_es', 'descripcion_en')} busy={busyKey === 'descripcion_en'} disabled={!d.descripcion_es.trim()} /></div>
              <textarea value={d.descripcion_en} onChange={(e) => set('descripcion_en', e.target.value)} rows={4} style={ta} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={lbl}>Imagen</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Thumb url={d.imagen_url} onRemove={d.imagen_url ? () => set('imagen_url', null) : undefined} />
                <button onClick={() => imgInput.current?.click()} disabled={anyBusy} style={up(anyBusy)}>{busyKey === 'img' ? 'Subiendo…' : d.imagen_url ? 'Cambiar' : 'Subir'}</button>
                <input ref={imgInput} type="file" accept="image/*" hidden onChange={onImg} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>CTA — texto (ES)</label>
              <input value={d.cta_label_es} onChange={(e) => set('cta_label_es', e.target.value)} style={inp} placeholder="Descúbrelo" />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={row}><label style={lbl}>CTA — texto (EN)</label><Tr on={() => tr('cta_label_es', 'cta_label_en')} busy={busyKey === 'cta_label_en'} disabled={!d.cta_label_es.trim()} /></div>
              <input value={d.cta_label_en} onChange={(e) => set('cta_label_en', e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>CTA — enlace</label>
              <input value={d.cta_url} onChange={(e) => set('cta_url', e.target.value)} style={inp} placeholder="/contacto o https://…" />
            </div>
          </div>
        </div>
      </div>
      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 12 }}>{error}</p>}

      {/* ── Subpágina ──────────────────────────────────────────────────────
          Plegada por defecto. La ficha ya es larga y esto solo se toca cuando hay
          una pieza nueva que colgar; abierta siempre, la lista de capacidades
          dejaría de poder leerse de un vistazo. */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setAbierta((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .2s', fontSize: 9, opacity: 0.6 }}>▶</span>
            Subpágina, vídeo y bloques
          </button>
          {tool.slug && (
            <a href={`${SITE_BASE}/fp-tools/${tool.slug}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: `${INK}70`, textDecoration: 'none', borderBottom: `1px solid ${INK}25`, paddingBottom: 1 }}>
              /fp-tools/{tool.slug} ↗
            </a>
          )}
          {!tool.slug && <span style={{ fontSize: 11, color: '#b3261e' }}>Sin URL — guarda la capacidad para generarla.</span>}
          <div style={{ flex: 1 }} />
          {d.video_url
            ? <span style={{ fontSize: 11, color: '#2e7d32' }}>Vídeo cargado</span>
            : <span style={{ fontSize: 11, color: `${INK}45` }}>Sin vídeo</span>}
        </div>

        {abierta && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 250 }}>
                <label style={lbl}>Vídeo explicativo (MP4)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => vidInput.current?.click()} disabled={anyBusy} style={up(anyBusy)}>
                    {busyKey === 'video' ? 'Subiendo…' : d.video_url ? 'Cambiar vídeo' : 'Subir vídeo'}
                  </button>
                  {d.video_url && (
                    <>
                      <a href={d.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: `${INK}70` }}>Ver ↗</a>
                      <button onClick={() => set('video_url', null)} style={{ background: 'none', border: 'none', color: `${INK}60`, fontSize: 11, cursor: 'pointer' }}>Quitar</button>
                    </>
                  )}
                  <input ref={vidInput} type="file" accept="video/mp4,video/*" hidden onChange={onVideo} />
                </div>
                <p style={{ fontSize: 10.5, color: `${INK}50`, margin: '7px 0 0', lineHeight: 1.5, maxWidth: 300 }}>
                  Se sirve tal cual: sin recompresión. Exporta ya comprimido (H.264, ~1080p) o el visitante se
                  descargará el máster entero.
                </p>
              </div>
              <div>
                <label style={lbl}>Póster del vídeo</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Thumb url={d.video_poster_url} onRemove={d.video_poster_url ? () => set('video_poster_url', null) : undefined} />
                  <button onClick={() => posInput.current?.click()} disabled={anyBusy} style={up(anyBusy)}>
                    {busyKey === 'poster' ? 'Subiendo…' : d.video_poster_url ? 'Cambiar' : 'Subir'}
                  </button>
                  <input ref={posInput} type="file" accept="image/*" hidden onChange={onPoster} />
                </div>
                <p style={{ fontSize: 10.5, color: `${INK}50`, margin: '7px 0 0', lineHeight: 1.5, maxWidth: 230 }}>
                  Es la primera pantalla. Sin él se usa la imagen de la ficha.
                </p>
              </div>
              {tool.slug && (
                <div>
                  <label style={lbl}>URL</label>
                  <button onClick={rehacerSlug} disabled={anyBusy} style={up(anyBusy)}>Rehacer desde el nombre</button>
                  <p style={{ fontSize: 10.5, color: `${INK}50`, margin: '7px 0 0', lineHeight: 1.5, maxWidth: 230 }}>
                    Ojo: rompe cualquier enlace que ya se haya compartido.
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
              <label style={lbl}>Bloques de la subpágina</label>
              <FpToolBloquesEditor toolId={tool.id} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
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

function Tr({ on, busy, disabled }: { on: () => void; busy: boolean; disabled: boolean }) {
  return <button onClick={on} disabled={busy || disabled} style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: disabled ? `${INK}35` : ORANGE, background: 'none', border: 'none', cursor: disabled || busy ? 'default' : 'pointer', padding: 0 }}>{busy ? 'Traduciendo…' : '↳ IA'}</button>
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

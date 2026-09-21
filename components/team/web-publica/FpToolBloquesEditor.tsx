'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { subirArchivo } from '@/lib/web-publica/subida'
import {
  getFpToolBloquesAdmin, createFpToolBloque, updateFpToolBloque,
  deleteFpToolBloque, reorderFpToolBloques,
} from '@/app/actions/web-fp-tools'
import { BLOQUE_TIPOS, type BloqueTipo, type WebFpToolBloque } from '@/lib/web-fp-tools'

const ORANGE = '#D85A30', INK = '#1A1A1A', BORDER = '#F0EEE8'

/**
 * Bloques de la subpágina de una capacidad.
 *
 * Se cargan al ABRIR el panel y no con la página: el editor de la web pública ya
 * trae seis pestañas de datos, y sumarle los bloques de todas las capacidades
 * sería pagar en cada visita algo que casi nunca se mira.
 *
 * El estado vive aquí y no en el servidor entre pulsación y pulsación: se edita
 * en local y se guarda bloque a bloque. Guardar en cada tecla contra Supabase
 * convertiría escribir un párrafo en cien peticiones.
 */
export function FpToolBloquesEditor({ toolId }: { toolId: string }) {
  const [bloques, setBloques] = useState<WebFpToolBloque[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const recargar = async () => {
    try { setBloques(await getFpToolBloquesAdmin(toolId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los bloques.') }
  }

  useEffect(() => { recargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [toolId])

  const añadir = (tipo: BloqueTipo) => startTransition(async () => {
    setError(null)
    const res = await createFpToolBloque(toolId, tipo)
    if ('error' in res) { setError(res.error); return }
    await recargar()
  })

  const mover = (id: string, dir: -1 | 1) => {
    if (!bloques) return
    const ids = bloques.map((b) => b.id)
    const i = ids.indexOf(id); const j = i + dir
    if (j < 0 || j >= ids.length) return
    const next = [...ids]; [next[i], next[j]] = [next[j], next[i]]
    // Optimista: reordenar es instantáneo de leer y esperar al servidor para
    // mover una fila se siente roto.
    setBloques(next.map((x) => bloques.find((b) => b.id === x)!))
    startTransition(async () => { await reorderFpToolBloques(next); await recargar() })
  }

  const borrar = (b: WebFpToolBloque) => {
    if (!confirm('¿Eliminar este bloque?')) return
    startTransition(async () => { await deleteFpToolBloque(b.id); await recargar() })
  }

  if (bloques === null) return <p style={{ fontSize: 12, color: `${INK}60`, margin: '14px 0 0' }}>Cargando bloques…</p>

  return (
    <div style={{ marginTop: 16 }}>
      {bloques.length === 0 && (
        <p style={{ fontSize: 12, color: `${INK}60`, margin: '0 0 14px', lineHeight: 1.6, maxWidth: 560 }}>
          Sin bloques, la subpágina abre con el vídeo y sigue con la descripción corta. Añade bloques para
          contar la capacidad con más detalle: se pintan en este orden, debajo del vídeo.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bloques.map((b, i) => (
          <BloqueCard key={b.id} bloque={b} index={i} total={bloques.length}
            onMover={mover} onBorrar={() => borrar(b)} onGuardado={recargar} busy={isPending} />
        ))}
      </div>

      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}70` }}>Añadir</span>
        {BLOQUE_TIPOS.map((t) => (
          <button key={t.codigo} onClick={() => añadir(t.codigo)} disabled={isPending}
            style={{ padding: '7px 13px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, color: INK, cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1 }}>
            + {t.es}
          </button>
        ))}
      </div>
    </div>
  )
}

function BloqueCard({ bloque, index, total, onMover, onBorrar, onGuardado, busy }: {
  bloque: WebFpToolBloque; index: number; total: number
  onMover: (id: string, dir: -1 | 1) => void; onBorrar: () => void; onGuardado: () => Promise<void>; busy: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [d, setD] = useState({
    tipo: bloque.tipo,
    titulo_es: bloque.titulo_es ?? '', titulo_en: bloque.titulo_en ?? '',
    cuerpo_es: bloque.cuerpo_es ?? '', cuerpo_en: bloque.cuerpo_en ?? '',
    imagen_url: bloque.imagen_url, pie_es: bloque.pie_es ?? '', pie_en: bloque.pie_en ?? '',
    invertido: bloque.invertido,
  })
  const [subiendo, setSubiendo] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((p) => ({ ...p, [k]: v })); setSaved(false) }

  const conImagen = d.tipo === 'imagen' || d.tipo === 'dueto'
  const conTexto = d.tipo !== 'imagen'

  const onImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setSubiendo(true); setError(null)
    const res = await subirArchivo(file, 'fp-tools')
    setSubiendo(false)
    if ('error' in res) { setError(res.error); return }
    set('imagen_url', res.url)
  }

  const guardar = () => startTransition(async () => {
    setError(null)
    const res = await updateFpToolBloque(bloque.id, {
      tipo: d.tipo,
      titulo_es: d.titulo_es || null, titulo_en: d.titulo_en || null,
      cuerpo_es: d.cuerpo_es || null, cuerpo_en: d.cuerpo_en || null,
      imagen_url: d.imagen_url, pie_es: d.pie_es || null, pie_en: d.pie_en || null,
      invertido: d.invertido,
    })
    if ('error' in res) { setError(res.error); return }
    setSaved(true); await onGuardado()
  })

  const anyBusy = busy || isPending || subiendo

  return (
    <div style={{ background: '#FBFAF8', border: `1px solid ${BORDER}`, borderRadius: 5, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => onMover(bloque.id, -1)} disabled={index === 0 || anyBusy} style={arrowBtn(index === 0 || anyBusy)}>▲</button>
          <span style={{ fontSize: 11, color: `${INK}70`, fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
          <button onClick={() => onMover(bloque.id, 1)} disabled={index === total - 1 || anyBusy} style={arrowBtn(index === total - 1 || anyBusy)}>▼</button>
        </div>
        <select value={d.tipo} onChange={(e) => set('tipo', e.target.value as BloqueTipo)} style={{ ...inp, width: 'auto', padding: '6px 8px' }}>
          {BLOQUE_TIPOS.map((t) => <option key={t.codigo} value={t.codigo}>{t.es}</option>)}
        </select>
        {d.tipo === 'dueto' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: `${INK}90`, cursor: 'pointer' }}>
            <input type="checkbox" checked={d.invertido} onChange={(e) => set('invertido', e.target.checked)} /> Imagen a la derecha
          </label>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onBorrar} disabled={anyBusy} style={{ background: 'none', border: 'none', color: `${INK}70`, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
        <button onClick={guardar} disabled={anyBusy} style={{ padding: '7px 16px', background: saved ? '#2e7d32' : ORANGE, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: anyBusy ? 0.6 : 1 }}>
          {isPending ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>

      {conTexto && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>{d.tipo === 'cita' ? 'Atribución (ES)' : 'Título (ES)'}</label>
              <input value={d.titulo_es} onChange={(e) => set('titulo_es', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{d.tipo === 'cita' ? 'Atribución (EN)' : 'Título (EN)'}</label>
              <input value={d.titulo_en} onChange={(e) => set('titulo_en', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <label style={lbl}>{d.tipo === 'cita' ? 'Frase (ES)' : 'Texto (ES)'}</label>
              <textarea value={d.cuerpo_es} onChange={(e) => set('cuerpo_es', e.target.value)} rows={d.tipo === 'cita' ? 2 : 4} style={ta} />
            </div>
            <div>
              <label style={lbl}>{d.tipo === 'cita' ? 'Frase (EN)' : 'Texto (EN)'}</label>
              <textarea value={d.cuerpo_en} onChange={(e) => set('cuerpo_en', e.target.value)} rows={d.tipo === 'cita' ? 2 : 4} style={ta} />
            </div>
          </div>
        </>
      )}

      {conImagen && (
        <div style={{ display: 'flex', gap: 18, marginTop: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>Imagen</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Thumb url={d.imagen_url} onRemove={d.imagen_url ? () => set('imagen_url', null) : undefined} />
              <button onClick={() => fileInput.current?.click()} disabled={anyBusy} style={up(anyBusy)}>
                {subiendo ? 'Subiendo…' : d.imagen_url ? 'Cambiar' : 'Subir'}
              </button>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={onImg} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 170 }}>
            <label style={lbl}>Pie (ES)</label>
            <input value={d.pie_es} onChange={(e) => set('pie_es', e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1, minWidth: 170 }}>
            <label style={lbl}>Pie (EN)</label>
            <input value={d.pie_en} onChange={(e) => set('pie_en', e.target.value)} style={inp} />
          </div>
        </div>
      )}

      {error && <p style={{ color: '#b3261e', fontSize: 12, marginTop: 10 }}>{error}</p>}
    </div>
  )
}

function Thumb({ url, onRemove }: { url: string | null; onRemove?: () => void }) {
  return (
    <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 4, overflow: 'hidden', background: '#F8F7F4', border: `1px solid ${BORDER}`, flex: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${INK}30`, fontSize: 16 }}>+</div>}
      {url && onRemove && <button onClick={onRemove} style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>✕</button>}
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${INK}80`, marginBottom: 5, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, color: INK, background: '#fff', fontFamily: 'inherit', outline: 'none' }
const ta: React.CSSProperties = { ...inp, resize: 'vertical', lineHeight: 1.5 }
const arrowBtn = (dis: boolean): React.CSSProperties => ({ background: 'none', border: 'none', color: dis ? '#1A1A1A30' : '#1A1A1A80', fontSize: 9, cursor: dis ? 'default' : 'pointer', padding: 2, lineHeight: 1 })
const up = (dis: boolean): React.CSSProperties => ({ padding: '7px 14px', background: '#F8F7F4', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11, color: INK, cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.6 : 1, whiteSpace: 'nowrap' })

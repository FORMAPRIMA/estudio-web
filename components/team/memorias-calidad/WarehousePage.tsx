'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
  setFavorito,
  createSubcapitulo,
} from '@/app/actions/warehouse'
import {
  NIVELES,
  agruparEstructura,
  autoPvp,
  ceilCent,
  formatEur,
  nivelMeta,
  type Capitulo,
  type NivelCalidad,
  type Proveedor,
  type Subcapitulo,
  type WarehouseItem,
  type WarehouseItemInput,
} from '@/lib/memorias/domain'
import VistaToggle, { useVistaModo } from './VistaToggle'

const BUCKET = 'warehouse'

interface Props {
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  items: WarehouseItem[]
  proveedores: Proveedor[]
  migracionPendiente?: boolean
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  label:    { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:    { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8', color: primary ? '#fff' : '#555',
  }),
  btnSm: (color?: string): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: color ?? '#F0EEE8', color: color ? '#fff' : '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const modalCard: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 760,
  maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadFile(file: File, prefix: string): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

/** Trae una imagen remota a nuestro bucket (las URLs de CDN de tienda caducan). */
async function importarImagen(url: string, prefijo: string): Promise<{ url: string } | { error: string }> {
  const res = await fetch('/api/warehouse/importar-imagen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, prefijo }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { error: json.error ?? 'No se pudo importar la imagen.' }
  return { url: json.url }
}

function parseNumero(v: string): number | null {
  const limpio = v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  if (!limpio.trim()) return null
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : null
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
      {msg}
    </div>
  )
}

function Estrella({ activa, onClick, title }: { activa: boolean; onClick?: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: 2,
        fontSize: 14, lineHeight: 1, color: activa ? '#D8A22F' : '#D5D3CE',
      }}
    >
      {activa ? '★' : '☆'}
    </button>
  )
}

// ── Campos de subida ──────────────────────────────────────────────────────────

function ImageField({
  label, value, onChange, prefix,
}: {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  prefix: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    const res = await uploadFile(file, prefix)
    setUploading(false)
    if ('error' in res) { setError(res.error); return }
    onChange(res.url)
    e.target.value = ''
  }

  return (
    <div>
      <label style={S.label}>{label}</label>
      {value ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <img src={value} alt="" style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 6, border: '1px solid #E8E6E0' }} />
          <button type="button" onClick={() => onChange(null)} style={S.btnSm()}>Quitar</button>
        </div>
      ) : (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8F7F4', border: '1px dashed #D5D3CE', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#666' }}>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </label>
      )}
      {error && <div style={{ marginTop: 6 }}><ErrorBanner msg={error} /></div>}
    </div>
  )
}

function PdfUpload({ label, value, onChange }: { label: string; value: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(null)
    const res = await uploadFile(file, 'fichas')
    setUploading(false)
    if ('error' in res) { setError(res.error); return }
    onChange(res.url)
    e.target.value = ''
  }

  return (
    <div>
      <label style={S.label}>{label}</label>
      {value ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#378ADD', textDecoration: 'underline' }}>Ver ficha</a>
          <button type="button" onClick={() => onChange(null)} style={S.btnSm()}>Quitar</button>
        </div>
      ) : (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8F7F4', border: '1px dashed #D5D3CE', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#666' }}>
          <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
          {uploading ? 'Subiendo…' : 'Subir PDF'}
        </label>
      )}
      {error && <div style={{ marginTop: 6 }}><ErrorBanner msg={error} /></div>}
    </div>
  )
}

// ── Analizador de URL con IA ──────────────────────────────────────────────────

interface FichaIA {
  nombre: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  acabados: string[]
  tags: string[]
  nivel_calidad: NivelCalidad | null
  subcapitulo_id: string | null
  precio_pvp: number | null
  precio_coste: number | null
  moneda: string
  url_producto: string
  imagen_producto_url: string | null
  imagen_ambiente_url: string | null
  notas_ia: string | null
}

function AnalizadorUrl({
  onFicha,
}: {
  onFicha: (ficha: FichaIA, candidatas: string[]) => void
}) {
  const [url, setUrl] = useState('')
  const [estado, setEstado] = useState<'idle' | 'analizando' | 'ok'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notas, setNotas] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const analizar = async () => {
    if (!url.trim()) return
    setEstado('analizando'); setError(null); setNotas(null); setAviso(null)
    try {
      const res = await fetch('/api/warehouse/analizar-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo analizar la URL.')
      setEstado('ok')
      setNotas(json.ficha?.notas_ia ?? null)
      if (json.fuente === 'web_fetch') {
        setAviso('La web bloqueó la lectura directa: la ha leído la IA y no hay imágenes candidatas. Súbelas a mano.')
      }
      onFicha(json.ficha as FichaIA, (json.candidatas ?? []) as string[])
    } catch (err) {
      setEstado('idle')
      setError(err instanceof Error ? err.message : 'Error analizando la URL.')
    }
  }

  return (
    <div style={{ background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 8, padding: 14 }}>
      <label style={{ ...S.label, color: '#888' }}>Rellenar desde la web del producto</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); analizar() } }}
          placeholder="https://www.marca.com/producto…"
          style={{ ...S.input, flex: 1 }}
          disabled={estado === 'analizando'}
        />
        <button type="button" onClick={analizar} disabled={estado === 'analizando' || !url.trim()} style={{ ...S.btn(true), whiteSpace: 'nowrap', opacity: estado === 'analizando' ? 0.6 : 1 }}>
          {estado === 'analizando' ? 'Analizando…' : 'Analizar'}
        </button>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#AAA', lineHeight: 1.5 }}>
        {estado === 'analizando'
          ? 'Leyendo la página y redactando la ficha. Puede tardar unos segundos.'
          : 'La IA rellena lo que encuentre y lo deja todo editable. Revisa siempre referencia y precio.'}
      </p>
      {aviso && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#D97706', lineHeight: 1.5 }}>{aviso}</p>}
      {notas && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#666', lineHeight: 1.5, fontStyle: 'italic' }}>
          Nota de la IA: {notas}
        </p>
      )}
      {error && <div style={{ marginTop: 8 }}><ErrorBanner msg={error} /></div>}
    </div>
  )
}

// ── Modal de item ─────────────────────────────────────────────────────────────

function ItemModal({
  initial, capitulos, subcapitulos, proveedores, onClose, onSaved,
}: {
  initial: WarehouseItem | null
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  proveedores: Proveedor[]
  onClose: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [subcapituloId,   setSubcapituloId]   = useState(initial?.subcapitulo_id ?? '')
  const [nombre,          setNombre]          = useState(initial?.nombre ?? '')
  const [nivel,           setNivel]           = useState<NivelCalidad>(initial?.nivel_calidad ?? 'select')
  const [marca,           setMarca]           = useState(initial?.marca ?? '')
  const [modelo,          setModelo]          = useState(initial?.modelo ?? '')
  const [referencia,      setReferencia]      = useState(initial?.referencia ?? '')
  const [descripcion,     setDescripcion]     = useState(initial?.descripcion ?? '')
  const [imagenProducto,  setImagenProducto]  = useState<string | null>(initial?.imagen_principal_url ?? null)
  const [imagenAmbiente,  setImagenAmbiente]  = useState<string | null>(initial?.imagen_lifestyle_url ?? null)
  const [fichaTecnica,    setFichaTecnica]    = useState<string | null>(initial?.ficha_tecnica_url ?? null)
  const [urlProducto,     setUrlProducto]     = useState(initial?.url_producto ?? '')
  const [pvp,             setPvp]             = useState(initial?.precio_pvp != null ? String(initial.precio_pvp) : '')
  const [coste,           setCoste]           = useState(initial?.precio_coste != null ? String(initial.precio_coste) : '')
  const [moneda,          setMoneda]          = useState(initial?.moneda ?? 'EUR')
  const [proveedorId,     setProveedorId]     = useState(initial?.proveedor_preferente_id ?? '')
  const [acabadosTxt,     setAcabadosTxt]     = useState((initial?.acabados ?? []).join(', '))
  const [tagsTxt,         setTagsTxt]         = useState((initial?.tags ?? []).join(', '))
  const [esFavorito,      setEsFavorito]      = useState(initial?.es_favorito ?? false)

  const [candidatas, setCandidatas] = useState<string[]>([])
  const [importando, setImportando] = useState<string | null>(null)
  const [sugeridos, setSugeridos] = useState<Set<string>>(new Set())
  const [nuevoSub, setNuevoSub] = useState<{ capitulo_id: string; nombre: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estructura = useMemo(() => agruparEstructura(capitulos, subcapitulos), [capitulos, subcapitulos])
  const marcaSugerido = (campo: string) => sugeridos.has(campo) ? { borderColor: '#C7A2F0', background: '#FCFAFF' } : null

  const aplicarFicha = async (ficha: FichaIA, nuevasCandidatas: string[]) => {
    const tocados = new Set<string>()
    const set = <T,>(campo: string, valor: T, setter: (v: T) => void, vacio: boolean) => {
      if (vacio) return
      setter(valor); tocados.add(campo)
    }
    set('nombre', ficha.nombre ?? '', setNombre, !ficha.nombre)
    set('marca', ficha.marca ?? '', setMarca, !ficha.marca)
    set('modelo', ficha.modelo ?? '', setModelo, !ficha.modelo)
    set('referencia', ficha.referencia ?? '', setReferencia, !ficha.referencia)
    set('descripcion', ficha.descripcion ?? '', setDescripcion, !ficha.descripcion)
    set('acabados', (ficha.acabados ?? []).join(', '), setAcabadosTxt, !(ficha.acabados?.length))
    set('tags', (ficha.tags ?? []).join(', '), setTagsTxt, !(ficha.tags?.length))
    set('pvp', ficha.precio_pvp != null ? String(ficha.precio_pvp) : '', setPvp, ficha.precio_pvp == null)
    set('coste', ficha.precio_coste != null ? String(ficha.precio_coste) : '', setCoste, ficha.precio_coste == null)
    set('moneda', ficha.moneda ?? 'EUR', setMoneda, !ficha.moneda)
    set('url', ficha.url_producto ?? '', setUrlProducto, !ficha.url_producto)
    if (ficha.nivel_calidad) { setNivel(ficha.nivel_calidad); tocados.add('nivel') }
    if (ficha.subcapitulo_id) { setSubcapituloId(ficha.subcapitulo_id); tocados.add('subcapitulo') }
    setSugeridos(tocados)
    setCandidatas(nuevasCandidatas)

    // Las imágenes elegidas por la IA se traen a nuestro bucket
    if (ficha.imagen_producto_url) {
      setImportando('producto')
      const res = await importarImagen(ficha.imagen_producto_url, 'principal')
      if (!('error' in res)) setImagenProducto(res.url)
      setImportando(null)
    }
    if (ficha.imagen_ambiente_url) {
      setImportando('ambiente')
      const res = await importarImagen(ficha.imagen_ambiente_url, 'lifestyle')
      if (!('error' in res)) setImagenAmbiente(res.url)
      setImportando(null)
    }
  }

  const usarCandidata = async (url: string, destino: 'producto' | 'ambiente') => {
    setImportando(destino)
    const res = await importarImagen(url, destino === 'producto' ? 'principal' : 'lifestyle')
    setImportando(null)
    if ('error' in res) { setError(res.error); return }
    if (destino === 'producto') setImagenProducto(res.url)
    else setImagenAmbiente(res.url)
  }

  const crearSubcapitulo = async () => {
    if (!nuevoSub || !nuevoSub.nombre.trim()) return
    const res = await createSubcapitulo(nuevoSub.capitulo_id, nuevoSub.nombre)
    if ('error' in res) { setError(res.error); return }
    setSubcapituloId(res.id)
    setNuevoSub(null)
    router.refresh()
  }

  const costeNum = parseNumero(coste)
  const pvpNum = parseNumero(pvp)
  const margen = pvpNum != null && costeNum != null ? ceilCent(pvpNum - costeNum) : null
  const margenPct = margen != null && pvpNum ? (margen / pvpNum) * 100 : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!subcapituloId) { setError('Selecciona el subcapítulo de presupuesto.'); return }
    setSaving(true); setError(null)

    const payload: WarehouseItemInput = {
      subcapitulo_id: subcapituloId,
      nombre: nombre.trim(),
      nivel_calidad: nivel,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      referencia: referencia.trim() || null,
      descripcion: descripcion.trim() || null,
      imagen_principal_url: imagenProducto,
      imagen_lifestyle_url: imagenAmbiente,
      ficha_tecnica_url: fichaTecnica,
      url_producto: urlProducto.trim() || null,
      precio_pvp: pvpNum,
      precio_coste: costeNum,
      moneda: moneda.trim().toUpperCase() || 'EUR',
      proveedor_preferente_id: proveedorId || null,
      acabados: acabadosTxt.split(',').map(s => s.trim()).filter(Boolean),
      tags: tagsTxt.split(',').map(s => s.trim()).filter(Boolean),
      es_favorito: esFavorito,
    }

    const res = initial
      ? await updateWarehouseItem(initial.id, payload)
      : await createWarehouseItem(payload)

    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved()
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCard}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {!initial && <AnalizadorUrl onFicha={aplicarFicha} />}

            {sugeridos.size > 0 && (
              <p style={{ margin: 0, fontSize: 11, color: '#8B5CF6' }}>
                Los campos con borde violeta los ha rellenado la IA. Revísalos antes de guardar.
              </p>
            )}

            {/* Clasificación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 14 }}>
              <div>
                <label style={S.label}>Subcapítulo de presupuesto *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={subcapituloId}
                    onChange={e => setSubcapituloId(e.target.value)}
                    style={{ ...S.input, ...(marcaSugerido('subcapitulo') ?? {}) }}
                  >
                    <option value="">— Selecciona subcapítulo —</option>
                    {estructura.map(c => (
                      <optgroup key={c.id} label={`${c.numero}. ${c.nombre}`}>
                        {c.subcapitulos.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setNuevoSub({ capitulo_id: capitulos[0]?.id ?? '', nombre: '' })}
                    style={{ ...S.btnSm(), whiteSpace: 'nowrap' }}
                    title="Crear un subcapítulo nuevo"
                  >
                    + Nuevo
                  </button>
                </div>
                {nuevoSub && (
                  <div style={{ marginTop: 8, padding: 10, background: '#F8F7F4', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      value={nuevoSub.capitulo_id}
                      onChange={e => setNuevoSub({ ...nuevoSub, capitulo_id: e.target.value })}
                      style={{ ...S.input, flex: '0 0 190px', fontSize: 11 }}
                    >
                      {capitulos.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
                    </select>
                    <input
                      autoFocus
                      value={nuevoSub.nombre}
                      onChange={e => setNuevoSub({ ...nuevoSub, nombre: e.target.value })}
                      placeholder="Nombre del subcapítulo"
                      style={{ ...S.input, flex: 1, fontSize: 11 }}
                    />
                    <button type="button" onClick={crearSubcapitulo} style={S.btnSm('#1A1A1A')}>Crear</button>
                    <button type="button" onClick={() => setNuevoSub(null)} style={S.btnSm()}>×</button>
                  </div>
                )}
              </div>
              <div>
                <label style={S.label}>Nivel de calidad *</label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value as NivelCalidad)}
                  style={{ ...S.input, ...(marcaSugerido('nivel') ?? {}) }}
                >
                  {NIVELES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
            </div>

            {/* Identidad */}
            <div>
              <label style={S.label}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Inodoro suspendido In-Wash Inspira" style={{ ...S.input, ...(marcaSugerido('nombre') ?? {}) }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Marca</label>
                <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Roca" style={{ ...S.input, ...(marcaSugerido('marca') ?? {}) }} />
              </div>
              <div>
                <label style={S.label}>Modelo</label>
                <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="In-Wash Inspira" style={{ ...S.input, ...(marcaSugerido('modelo') ?? {}) }} />
              </div>
              <div>
                <label style={S.label}>Referencia</label>
                <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="A803060001" style={{ ...S.input, ...(marcaSugerido('referencia') ?? {}) }} />
              </div>
            </div>

            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Material, acabado y característica técnica relevante…" style={{ ...S.textarea, ...(marcaSugerido('descripcion') ?? {}) }} />
            </div>

            {/* Imágenes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <ImageField label="Foto de producto" value={imagenProducto} onChange={setImagenProducto} prefix="principal" />
                {importando === 'producto' && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#AAA' }}>Importando imagen…</p>}
              </div>
              <div>
                <ImageField label="Foto de ambiente" value={imagenAmbiente} onChange={setImagenAmbiente} prefix="lifestyle" />
                {importando === 'ambiente' && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#AAA' }}>Importando imagen…</p>}
              </div>
            </div>

            {candidatas.length > 0 && (
              <div>
                <label style={S.label}>Imágenes encontradas en la web</label>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                  {candidatas.map(url => (
                    <div key={url} style={{ flexShrink: 0, width: 84 }}>
                      <img src={url} alt="" style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 5, border: '1px solid #E8E6E0', display: 'block', background: '#F8F7F4' }} />
                      <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                        <button type="button" onClick={() => usarCandidata(url, 'producto')} style={{ ...S.btnSm(), flex: 1, fontSize: 9, padding: '3px 0' }} title="Usar como foto de producto">Prod.</button>
                        <button type="button" onClick={() => usarCandidata(url, 'ambiente')} style={{ ...S.btnSm(), flex: 1, fontSize: 9, padding: '3px 0' }} title="Usar como foto de ambiente">Amb.</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PdfUpload label="Ficha técnica (PDF)" value={fichaTecnica} onChange={setFichaTecnica} />

            <div>
              <label style={S.label}>URL del producto</label>
              <input value={urlProducto} onChange={e => setUrlProducto(e.target.value)} placeholder="https://…" style={{ ...S.input, ...(marcaSugerido('url') ?? {}) }} />
            </div>

            {/* Económico */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 14, alignItems: 'end' }}>
              <div>
                <label style={S.label}>Coste (nosotros)</label>
                <input
                  value={coste}
                  onChange={e => setCoste(e.target.value)}
                  onBlur={() => {
                    const c = parseNumero(coste)
                    if (c != null && !pvp.trim()) setPvp(String(autoPvp(c)))
                  }}
                  placeholder="480,00"
                  style={{ ...S.input, ...(marcaSugerido('coste') ?? {}) }}
                />
              </div>
              <div>
                <label style={S.label}>PVP (cliente)</label>
                <input value={pvp} onChange={e => setPvp(e.target.value)} placeholder="580,00" style={{ ...S.input, ...(marcaSugerido('pvp') ?? {}) }} />
              </div>
              <div>
                <label style={S.label}>Moneda</label>
                <input value={moneda} onChange={e => setMoneda(e.target.value)} maxLength={3} style={S.input} />
              </div>
            </div>
            {margen != null && (
              <p style={{ margin: '-6px 0 0', fontSize: 11, color: margen >= 0 ? '#1D9E75' : '#DC2626' }}>
                Margen unitario {formatEur(margen)}{margenPct != null ? ` · ${margenPct.toFixed(1)}%` : ''}
                {!coste.trim() ? '' : ' · al dejar el PVP vacío se calcula solo con el 16%'}
              </p>
            )}

            <div>
              <label style={S.label}>Proveedor preferente</label>
              <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} style={S.input}>
                <option value="">— Sin asignar —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Acabados (separados por coma)</label>
                <input value={acabadosTxt} onChange={e => setAcabadosTxt(e.target.value)} placeholder="Blanco mate, Cromo, Negro" style={{ ...S.input, ...(marcaSugerido('acabados') ?? {}) }} />
              </div>
              <div>
                <label style={S.label}>Tags (separados por coma)</label>
                <input value={tagsTxt} onChange={e => setTagsTxt(e.target.value)} placeholder="suspendido, soft-close" style={{ ...S.input, ...(marcaSugerido('tags') ?? {}) }} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer', background: esFavorito ? '#FFFBEB' : '#F8F7F4', padding: '10px 12px', borderRadius: 6, border: `1px solid ${esFavorito ? '#F0D89B' : '#E8E6E0'}` }}>
              <input type="checkbox" checked={esFavorito} onChange={e => setEsFavorito(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                <strong>Favorito FP</strong> de este subcapítulo en nivel {nivelMeta(nivel).label}.
                <span style={{ display: 'block', fontSize: 11, color: '#888', marginTop: 2 }}>
                  Es el que sale en la memoria de anteproyecto. Solo puede haber uno por subcapítulo y nivel: si ya hay otro, se sustituye.
                </span>
              </span>
            </label>

            {error && <ErrorBanner msg={error} />}
          </div>

          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Vista tarjetas ────────────────────────────────────────────────────────────

function ItemCard({
  item, onEdit, onDelete, onToggleFavorito,
}: {
  item: WarehouseItem
  onEdit: () => void
  onDelete: () => void
  onToggleFavorito: () => void
}) {
  const meta = nivelMeta(item.nivel_calidad)
  const subtitulo = [item.marca, item.modelo].filter(Boolean).join(' · ')

  return (
    <div style={{ background: '#fff', border: `1px solid ${item.es_favorito ? '#F0D89B' : '#E8E6E0'}`, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#F8F7F4' }}>
        {item.imagen_principal_url ? (
          <img src={item.imagen_principal_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CCC', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Sin imagen
          </div>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: meta.color, color: '#fff', borderRadius: 3 }}>
          {meta.label}
        </span>
        <div style={{ position: 'absolute', top: 4, right: 6 }}>
          <Estrella activa={item.es_favorito} onClick={onToggleFavorito} title={item.es_favorito ? 'Quitar de Favoritos FP' : 'Marcar como Favorito FP'} />
        </div>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{item.nombre}</div>
        {subtitulo && <div style={{ fontSize: 11, color: '#888' }}>{subtitulo}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 11 }}>
          {item.precio_pvp != null && <span style={{ color: '#1A1A1A', fontWeight: 600 }}>{formatEur(item.precio_pvp, 0)}</span>}
          {item.precio_coste != null && <span style={{ color: '#AAA' }}>coste {formatEur(item.precio_coste, 0)}</span>}
        </div>
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EEE8', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {item.url_producto && (
          <a href={item.url_producto} target="_blank" rel="noreferrer" style={{ ...S.btnSm(), textDecoration: 'none', display: 'inline-block' }}>Web ↗</a>
        )}
        <button onClick={onEdit} style={S.btnSm()}>Editar</button>
        <button onClick={onDelete} style={S.btnSm('#DC2626')}>Eliminar</button>
      </div>
    </div>
  )
}

// ── Vista listado desplegable ─────────────────────────────────────────────────

function ItemRow({
  item, proveedores, onEdit, onDelete, onToggleFavorito,
}: {
  item: WarehouseItem
  proveedores: Proveedor[]
  onEdit: () => void
  onDelete: () => void
  onToggleFavorito: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const meta = nivelMeta(item.nivel_calidad)
  const proveedor = proveedores.find(p => p.id === item.proveedor_preferente_id)
  const margen = item.precio_pvp != null && item.precio_coste != null ? ceilCent(item.precio_pvp - item.precio_coste) : null

  return (
    <div style={{ borderBottom: '1px solid #F0EEE8', background: item.es_favorito ? '#FFFDF6' : '#fff' }}>
      <div
        onClick={() => setAbierto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 10, color: '#CCC', width: 10, flexShrink: 0 }}>{abierto ? '▾' : '▸'}</span>

        <div style={{ width: 34, height: 26, borderRadius: 3, background: '#F8F7F4', overflow: 'hidden', flexShrink: 0 }}>
          {item.imagen_principal_url && <img src={item.imagen_principal_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>

        <div onClick={e => { e.stopPropagation(); onToggleFavorito() }} style={{ flexShrink: 0, display: 'flex' }}>
          <Estrella activa={item.es_favorito} onClick={onToggleFavorito} title={item.es_favorito ? 'Quitar de Favoritos FP' : 'Marcar como Favorito FP'} />
        </div>

        <div style={{ flex: 2, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
          {(item.marca || item.modelo) && (
            <div style={{ fontSize: 10.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[item.marca, item.modelo].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: meta.bg, color: meta.color }}>
          {meta.label}
        </span>

        <div style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: '#AAA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
          {proveedor?.nombre ?? ''}
        </div>

        <div style={{ width: 84, textAlign: 'right', flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: '#1A1A1A' }}>
          {item.precio_pvp != null ? formatEur(item.precio_pvp, 0) : '—'}
        </div>
        <div style={{ width: 78, textAlign: 'right', flexShrink: 0, fontSize: 11, color: '#AAA' }}>
          {item.precio_coste != null ? formatEur(item.precio_coste, 0) : '—'}
        </div>
        <div style={{ width: 70, textAlign: 'right', flexShrink: 0, fontSize: 11, color: margen == null ? '#DDD' : margen >= 0 ? '#1D9E75' : '#DC2626' }}>
          {margen != null ? formatEur(margen, 0) : '—'}
        </div>
      </div>

      {abierto && (
        <div style={{ padding: '4px 12px 14px 66px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {item.imagen_lifestyle_url && (
            <img src={item.imagen_lifestyle_url} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 5, border: '1px solid #E8E6E0', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {item.descripcion && <p style={{ margin: 0, fontSize: 11.5, color: '#555', lineHeight: 1.5 }}>{item.descripcion}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 10.5, color: '#888' }}>
              {item.referencia && <span>Ref. <span style={{ fontFamily: 'monospace', color: '#555' }}>{item.referencia}</span></span>}
              {item.acabados.length > 0 && <span>Acabados: {item.acabados.join(', ')}</span>}
              {item.tags.length > 0 && <span>Tags: {item.tags.join(', ')}</span>}
              {item.ficha_tecnica_url && <a href={item.ficha_tecnica_url} target="_blank" rel="noreferrer" style={{ color: '#378ADD' }}>Ficha técnica ↗</a>}
              {item.url_producto && <a href={item.url_producto} target="_blank" rel="noreferrer" style={{ color: '#378ADD' }}>Web del producto ↗</a>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <button onClick={onEdit} style={S.btnSm()}>Editar</button>
              <button onClick={onDelete} style={S.btnSm('#DC2626')}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function WarehousePage({ capitulos, subcapitulos, items, proveedores, migracionPendiente }: Props) {
  const router = useRouter()
  const [vista, setVista] = useVistaModo('cards')
  const [filterNivel, setFilterNivel] = useState<NivelCalidad | 'all'>('all')
  const [filterCapitulo, setFilterCapitulo] = useState<string>('all')
  const [soloFavoritos, setSoloFavoritos] = useState(false)
  const [mostrarVacios, setMostrarVacios] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [editing, setEditing] = useState<WarehouseItem | null>(null)
  const [creating, setCreating] = useState(false)

  const estructura = useMemo(() => agruparEstructura(capitulos, subcapitulos), [capitulos, subcapitulos])

  const filtrados = useMemo(() => {
    const texto = filterText.trim().toLowerCase()
    return items.filter(it => {
      if (filterNivel !== 'all' && it.nivel_calidad !== filterNivel) return false
      if (soloFavoritos && !it.es_favorito) return false
      if (!texto) return true
      const heno = [it.nombre, it.marca, it.modelo, it.referencia, it.descripcion, ...(it.tags ?? [])]
        .filter(Boolean).join(' ').toLowerCase()
      return heno.includes(texto)
    })
  }, [items, filterNivel, filterText, soloFavoritos])

  const porSubcapitulo = useMemo(() => {
    const map = new Map<string, WarehouseItem[]>()
    for (const it of filtrados) {
      if (!map.has(it.subcapitulo_id)) map.set(it.subcapitulo_id, [])
      map.get(it.subcapitulo_id)!.push(it)
    }
    map.forEach(lista => {
      lista.sort((a, b) =>
        Number(b.es_favorito) - Number(a.es_favorito) ||
        NIVELES.findIndex(n => n.value === a.nivel_calidad) - NIVELES.findIndex(n => n.value === b.nivel_calidad) ||
        (a.marca ?? '').localeCompare(b.marca ?? '') ||
        a.nombre.localeCompare(b.nombre)
      )
    })
    return map
  }, [filtrados])

  // Favoritos por subcapítulo × nivel (sobre todos los items, no sobre el filtro)
  const favoritos = useMemo(() => {
    const map = new Map<string, Set<NivelCalidad>>()
    for (const it of items) {
      if (!it.es_favorito) continue
      if (!map.has(it.subcapitulo_id)) map.set(it.subcapitulo_id, new Set())
      map.get(it.subcapitulo_id)!.add(it.nivel_calidad)
    }
    return map
  }, [items])

  const handleSaved = () => { setEditing(null); setCreating(false); router.refresh() }

  const handleDelete = async (item: WarehouseItem) => {
    if (!confirm(`¿Eliminar "${item.nombre}" del warehouse?`)) return
    const res = await deleteWarehouseItem(item.id)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const handleFavorito = async (item: WarehouseItem) => {
    const res = await setFavorito(item.id, !item.es_favorito)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const totalFavoritos = items.filter(i => i.es_favorito).length
  const huecos = subcapitulos.length * NIVELES.length - totalFavoritos

  const capitulosVisibles = estructura.filter(c => filterCapitulo === 'all' || c.id === filterCapitulo)

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888' }}>
            Memorias de calidades
          </p>
          <h1 style={{ margin: '4px 0 6px', fontSize: 26, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            Warehouse
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#888', maxWidth: 660, lineHeight: 1.5 }}>
            Catálogo de productos colgado de los subcapítulos de nuestro presupuesto de obra.
            La estrella marca el <strong>Favorito FP</strong> de cada subcapítulo por nivel: es lo que sale en la memoria de anteproyecto.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <VistaToggle vista={vista} onChange={setVista} />
          <button onClick={() => setCreating(true)} style={S.btn(true)}>+ Nuevo producto</button>
        </div>
      </div>

      {migracionPendiente && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FFF8EB', border: '1px solid #F0D89B', borderRadius: 8, fontSize: 12, color: '#92400E' }}>
          Falta ejecutar <code>supabase/migrations/memorias_calidad_v2.sql</code>: sin la estructura de capítulos y
          subcapítulos no se pueden dar de alta productos.
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: '#fff', padding: 3, borderRadius: 6, border: '1px solid #E8E6E0' }}>
          {([{ value: 'all', label: 'Todos', color: '#1A1A1A' }, ...NIVELES] as { value: string; label: string; color: string }[]).map(n => (
            <button
              key={n.value}
              onClick={() => setFilterNivel(n.value as NivelCalidad | 'all')}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
                background: filterNivel === n.value ? n.color : 'transparent',
                color: filterNivel === n.value ? '#fff' : '#666',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {n.label}
            </button>
          ))}
        </div>

        <select value={filterCapitulo} onChange={e => setFilterCapitulo(e.target.value)} style={{ ...S.input, width: 'auto', minWidth: 210 }}>
          <option value="all">Todos los capítulos</option>
          {estructura.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
        </select>

        <input
          type="text"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Buscar por nombre, marca, modelo, referencia…"
          style={{ ...S.input, maxWidth: 320 }}
        />

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', cursor: 'pointer' }}>
          <input type="checkbox" checked={soloFavoritos} onChange={e => setSoloFavoritos(e.target.checked)} />
          Solo favoritos
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarVacios} onChange={e => setMostrarVacios(e.target.checked)} />
          Ver subcapítulos vacíos
        </label>

        <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
          {filtrados.length} de {items.length} productos · {totalFavoritos} favoritos ({huecos} huecos)
        </span>
      </div>

      {items.length === 0 && !migracionPendiente && (
        <div style={{ background: '#fff', border: '1px dashed #D5D3CE', borderRadius: 8, padding: 40, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>El warehouse está vacío.</p>
          <p style={{ margin: '0 0 20px', fontSize: 11, color: '#999', lineHeight: 1.6 }}>
            Pega la URL de un producto y la IA rellena la ficha: nombre, marca, descripción, acabados,
            precio, subcapítulo e imágenes.
          </p>
          <button onClick={() => setCreating(true)} style={S.btn(true)}>+ Dar de alta el primero</button>
        </div>
      )}

      {/* Árbol capítulo › subcapítulo */}
      {capitulosVisibles.map(capitulo => {
        const subsConItems = capitulo.subcapitulos.filter(s => mostrarVacios || (porSubcapitulo.get(s.id)?.length ?? 0) > 0)
        if (subsConItems.length === 0) return null
        const totalCapitulo = capitulo.subcapitulos.reduce((n, s) => n + (porSubcapitulo.get(s.id)?.length ?? 0), 0)

        return (
          <section key={capitulo.id} style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #E8E6E0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.1em' }}>
                {String(capitulo.numero).padStart(2, '0')}
              </span>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 400, color: '#1A1A1A' }}>{capitulo.nombre}</h2>
              <span style={{ fontSize: 11, color: '#AAA' }}>· {totalCapitulo} producto{totalCapitulo !== 1 ? 's' : ''}</span>
            </div>

            {subsConItems.map(sub => {
              const subItems = porSubcapitulo.get(sub.id) ?? []
              const favs = favoritos.get(sub.id) ?? new Set<NivelCalidad>()

              return (
                <div key={sub.id} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#1A1A1A', fontWeight: 500 }}>{sub.nombre}</p>
                    <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: '#CCC' }}>{sub.codigo}</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} title="Favoritos FP por nivel">
                      {NIVELES.map(n => (
                        <span
                          key={n.value}
                          title={`${n.label}: ${favs.has(n.value) ? 'favorito definido' : 'sin favorito'}`}
                          style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: favs.has(n.value) ? n.color : 'transparent',
                            border: `1px solid ${favs.has(n.value) ? n.color : '#DDD'}`,
                          }}
                        />
                      ))}
                    </div>
                    {subItems.length === 0 && <span style={{ fontSize: 10.5, color: '#CCC', fontStyle: 'italic' }}>sin productos</span>}
                  </div>

                  {subItems.length > 0 && (
                    vista === 'cards' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 14 }}>
                        {subItems.map(it => (
                          <ItemCard
                            key={it.id}
                            item={it}
                            onEdit={() => setEditing(it)}
                            onDelete={() => handleDelete(it)}
                            onToggleFavorito={() => handleFavorito(it)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: '#FAFAF8', borderBottom: '1px solid #E8E6E0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>
                          <span style={{ width: 10, flexShrink: 0 }} />
                          <span style={{ width: 34, flexShrink: 0 }} />
                          <span style={{ width: 22, flexShrink: 0 }} />
                          <span style={{ flex: 2 }}>Producto</span>
                          <span style={{ flexShrink: 0, width: 74 }}>Nivel</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>Proveedor</span>
                          <span style={{ width: 84, textAlign: 'right', flexShrink: 0 }}>PVP</span>
                          <span style={{ width: 78, textAlign: 'right', flexShrink: 0 }}>Coste</span>
                          <span style={{ width: 70, textAlign: 'right', flexShrink: 0 }}>Margen</span>
                        </div>
                        {subItems.map(it => (
                          <ItemRow
                            key={it.id}
                            item={it}
                            proveedores={proveedores}
                            onEdit={() => setEditing(it)}
                            onDelete={() => handleDelete(it)}
                            onToggleFavorito={() => handleFavorito(it)}
                          />
                        ))}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

      {(creating || editing) && (
        <ItemModal
          initial={editing}
          capitulos={capitulos}
          subcapitulos={subcapitulos}
          proveedores={proveedores}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

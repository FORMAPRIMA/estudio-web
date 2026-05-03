'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
  type WarehouseItem,
  type NivelCalidadWarehouse,
} from '@/app/actions/warehouse'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  unit_id: string
  nombre: string
  descripcion: string | null
  unidad_medida: string
  orden: number
  activo: boolean
}

interface Unit {
  id: string
  chapter_id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  line_items: LineItem[]
}

interface Chapter {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  activo: boolean
  units: Unit[]
}

interface Proveedor {
  id: string
  nombre: string
}

interface Props {
  initialChapters: Chapter[]
  initialItems: WarehouseItem[]
  proveedores: Proveedor[]
}

const NIVELES: { value: NivelCalidadWarehouse; label: string; color: string }[] = [
  { value: 'functional',  label: 'Functional',  color: '#1D9E75' },
  { value: 'select',      label: 'Select',      color: '#378ADD' },
  { value: 'master_piece', label: 'Masterpiece', color: '#D85A30' },
]

const BUCKET = 'warehouse'

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  label:    { fontSize: 9,  fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input:    { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  select:   { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8',
    color: primary ? '#fff' : '#555',
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
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720,
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

function nivelMeta(nivel: string) {
  return NIVELES.find(n => n.value === nivel) ?? { label: nivel, color: '#888' }
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626', marginTop: 8 }}>
      {msg}
    </div>
  )
}

// ── Image upload field ────────────────────────────────────────────────────────

function ImageUpload({
  label,
  value,
  onChange,
  prefix,
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
          <img src={value} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #E8E6E0' }} />
          <button type="button" onClick={() => onChange(null)} style={S.btnSm()}>Quitar</button>
        </div>
      ) : (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8F7F4', border: '1px dashed #D5D3CE', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#666' }}>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </label>
      )}
      {error && <ErrorBanner msg={error} />}
    </div>
  )
}

// ── PDF upload (ficha técnica) ────────────────────────────────────────────────

function PdfUpload({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (url: string | null) => void
}) {
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
      {error && <ErrorBanner msg={error} />}
    </div>
  )
}

// ── Item Modal ────────────────────────────────────────────────────────────────

function ItemModal({
  initial,
  chapters,
  proveedores,
  onClose,
  onSaved,
}: {
  initial: WarehouseItem | null
  chapters: Chapter[]
  proveedores: Proveedor[]
  onClose: () => void
  onSaved: () => void
}) {
  const [templateLineItemId, setTemplateLineItemId] = useState(initial?.template_line_item_id ?? '')
  const [nombre,             setNombre]             = useState(initial?.nombre ?? '')
  const [nivel,              setNivel]              = useState<NivelCalidadWarehouse>(initial?.nivel_calidad ?? 'select')
  const [marca,              setMarca]              = useState(initial?.marca ?? '')
  const [modelo,             setModelo]             = useState(initial?.modelo ?? '')
  const [referencia,         setReferencia]         = useState(initial?.referencia ?? '')
  const [descripcion,        setDescripcion]        = useState(initial?.descripcion ?? '')
  const [imagenPrincipal,    setImagenPrincipal]    = useState<string | null>(initial?.imagen_principal_url ?? null)
  const [imagenLifestyle,    setImagenLifestyle]    = useState<string | null>(initial?.imagen_lifestyle_url ?? null)
  const [fichaTecnica,       setFichaTecnica]       = useState<string | null>(initial?.ficha_tecnica_url ?? null)
  const [precio,             setPrecio]             = useState(initial?.precio_referencia != null ? String(initial.precio_referencia) : '')
  const [moneda,             setMoneda]             = useState(initial?.moneda ?? 'EUR')
  const [proveedorId,        setProveedorId]        = useState<string>(initial?.proveedor_preferente_id ?? '')
  const [acabadosTxt,        setAcabadosTxt]        = useState((initial?.acabados ?? []).join(', '))
  const [tagsTxt,            setTagsTxt]            = useState((initial?.tags ?? []).join(', '))
  const [incluirEnPlantilla, setIncluirEnPlantilla] = useState(initial?.incluir_en_plantilla ?? true)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!templateLineItemId) { setError('Selecciona una partida FPE.'); return }
    setSaving(true); setError(null)

    const payload = {
      template_line_item_id: templateLineItemId,
      nombre: nombre.trim(),
      nivel_calidad: nivel,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      referencia: referencia.trim() || null,
      descripcion: descripcion.trim() || null,
      imagen_principal_url: imagenPrincipal,
      imagen_lifestyle_url: imagenLifestyle,
      ficha_tecnica_url: fichaTecnica,
      precio_referencia: precio.trim() ? parseFloat(precio.replace(',', '.')) : null,
      moneda: moneda.trim() || 'EUR',
      proveedor_preferente_id: proveedorId || null,
      acabados: acabadosTxt.split(',').map(s => s.trim()).filter(Boolean),
      tags: tagsTxt.split(',').map(s => s.trim()).filter(Boolean),
      incluir_en_plantilla: incluirEnPlantilla,
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
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{initial ? 'Editar item' : 'Agregar item'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Partida FPE */}
            <div>
              <label style={S.label}>Partida FPE *</label>
              <select value={templateLineItemId} onChange={e => setTemplateLineItemId(e.target.value)} style={S.select} autoFocus>
                <option value="">— Selecciona partida —</option>
                {chapters.map(ch => (
                  <optgroup key={ch.id} label={`${ch.orden}. ${ch.nombre}`}>
                    {ch.units.map(u => u.line_items.map(li => (
                      <option key={li.id} value={li.id}>
                        {ch.orden}.{u.orden} {u.nombre} · {li.nombre} ({li.unidad_medida})
                      </option>
                    )))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Nivel + Nombre */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Nivel de calidad *</label>
                <select value={nivel} onChange={e => setNivel(e.target.value as NivelCalidadWarehouse)} style={S.select}>
                  {NIVELES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Nombre *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder='Ej: Inodoro suspendido In-Wash Inspira' style={S.input} />
              </div>
            </div>

            {/* Marca / Modelo / Referencia */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Marca</label>
                <input value={marca} onChange={e => setMarca(e.target.value)} placeholder='Roca, Duravit…' style={S.input} />
              </div>
              <div>
                <label style={S.label}>Modelo</label>
                <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder='In-Wash Inspira' style={S.input} />
              </div>
              <div>
                <label style={S.label}>Referencia</label>
                <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder='A803060001' style={S.input} />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder='Texto narrativo para el cliente…' style={S.textarea} />
            </div>

            {/* Imágenes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <ImageUpload label='Imagen principal (producto)' value={imagenPrincipal} onChange={setImagenPrincipal} prefix='principal' />
              <ImageUpload label='Imagen lifestyle (ambiente)' value={imagenLifestyle} onChange={setImagenLifestyle} prefix='lifestyle' />
            </div>

            <PdfUpload label='Ficha técnica (PDF)' value={fichaTecnica} onChange={setFichaTecnica} />

            {/* Precio + moneda + proveedor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Precio referencia</label>
                <input value={precio} onChange={e => setPrecio(e.target.value)} placeholder='580.00' style={S.input} />
              </div>
              <div>
                <label style={S.label}>Moneda</label>
                <input value={moneda} onChange={e => setMoneda(e.target.value)} maxLength={3} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Proveedor preferente</label>
                <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} style={S.select}>
                  <option value=''>— Sin asignar —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Acabados + Tags */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={S.label}>Acabados (separados por coma)</label>
                <input value={acabadosTxt} onChange={e => setAcabadosTxt(e.target.value)} placeholder='Blanco mate, Cromo, Negro mate' style={S.input} />
              </div>
              <div>
                <label style={S.label}>Tags (separados por coma)</label>
                <input value={tagsTxt} onChange={e => setTagsTxt(e.target.value)} placeholder='suspendido, soft-close' style={S.input} />
              </div>
            </div>

            {/* Flags */}
            <div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', cursor: 'pointer' }}>
                <input type='checkbox' checked={incluirEnPlantilla} onChange={e => setIncluirEnPlantilla(e.target.checked)} />
                Incluir en plantilla por defecto del nivel <strong>{nivelMeta(nivel).label}</strong>
              </label>
            </div>

            {error && <ErrorBanner msg={error} />}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type='button' onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type='submit' disabled={saving} style={S.btn(true)}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: WarehouseItem
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = nivelMeta(item.nivel_calidad)
  const subtitle = [item.marca, item.modelo].filter(Boolean).join(' · ')

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#F8F7F4' }}>
        {item.imagen_principal_url ? (
          <img src={item.imagen_principal_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CCC', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Sin imagen
          </div>
        )}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          padding: '3px 8px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          background: meta.color, color: '#fff', borderRadius: 3,
        }}>
          {meta.label}
        </span>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{item.nombre}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#888', lineHeight: 1.3 }}>{subtitle}</div>}
        {item.precio_referencia != null && (
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
            {item.precio_referencia.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {item.moneda}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EEE8', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onEdit} style={S.btnSm()}>Editar</button>
        <button onClick={onDelete} style={S.btnSm('#DC2626')}>Eliminar</button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WarehousePage({ initialChapters, initialItems, proveedores }: Props) {
  const router = useRouter()
  const [items] = useState<WarehouseItem[]>(initialItems)
  const [chapters] = useState<Chapter[]>(initialChapters)
  const [filterNivel, setFilterNivel] = useState<NivelCalidadWarehouse | 'all'>('all')
  const [filterText, setFilterText] = useState('')
  const [editing, setEditing] = useState<WarehouseItem | null>(null)
  const [creating, setCreating] = useState(false)

  // Index: line_item_id → { chapter, unit, line_item }
  const lineItemContext = useMemo(() => {
    const map = new Map<string, { chapter: Chapter; unit: Unit; lineItem: LineItem }>()
    for (const ch of chapters) {
      for (const u of ch.units) {
        for (const li of u.line_items) {
          map.set(li.id, { chapter: ch, unit: u, lineItem: li })
        }
      }
    }
    return map
  }, [chapters])

  // Filter + group items by chapter
  const grouped = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    const filtered = items.filter(it => {
      if (filterNivel !== 'all' && it.nivel_calidad !== filterNivel) return false
      if (!text) return true
      const haystack = [
        it.nombre, it.marca, it.modelo, it.referencia, it.descripcion,
        ...(it.tags ?? []),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(text)
    })

    const byChapter = new Map<string, { chapter: Chapter; items: WarehouseItem[] }>()
    for (const it of filtered) {
      const ctx = lineItemContext.get(it.template_line_item_id)
      if (!ctx) continue
      const key = ctx.chapter.id
      if (!byChapter.has(key)) byChapter.set(key, { chapter: ctx.chapter, items: [] })
      byChapter.get(key)!.items.push(it)
    }
    return Array.from(byChapter.values()).sort((a, b) => a.chapter.orden - b.chapter.orden)
  }, [items, filterNivel, filterText, lineItemContext])

  const handleSaved = () => {
    setEditing(null)
    setCreating(false)
    router.refresh()
  }

  const handleDelete = async (item: WarehouseItem) => {
    if (!confirm(`¿Eliminar "${item.nombre}"?`)) return
    const res = await deleteWarehouseItem(item.id)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const totalCount = items.length
  const filteredCount = grouped.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888' }}>
            Memorias de calidad
          </p>
          <h1 style={{ margin: '4px 0 6px', fontSize: 26, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            Warehouse
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#888', maxWidth: 640, lineHeight: 1.5 }}>
            Catálogo global de productos clasificados por capítulo de FP Execution y nivel de calidad.
            Cada item alimenta las plantillas de memoria correspondientes a su nivel.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={S.btn(true)}>+ Agregar item</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 6, border: '1px solid #E8E6E0' }}>
          <button
            onClick={() => setFilterNivel('all')}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
              background: filterNivel === 'all' ? '#1A1A1A' : 'transparent',
              color: filterNivel === 'all' ? '#fff' : '#666',
              border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >
            Todos
          </button>
          {NIVELES.map(n => (
            <button
              key={n.value}
              onClick={() => setFilterNivel(n.value)}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
                background: filterNivel === n.value ? n.color : 'transparent',
                color: filterNivel === n.value ? '#fff' : '#666',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              {n.label}
            </button>
          ))}
        </div>
        <input
          type='text'
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder='Buscar por nombre, marca, modelo, tags…'
          style={{ ...S.input, maxWidth: 380 }}
        />
        <span style={{ fontSize: 11, color: '#999' }}>
          {filteredCount} de {totalCount} items
        </span>
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #D5D3CE', borderRadius: 8, padding: 40, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>
            Aún no hay items en el warehouse.
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 11, color: '#999' }}>
            Empieza dando de alta los productos con su marca, foto y nivel de calidad.
          </p>
          <button onClick={() => setCreating(true)} style={S.btn(true)}>+ Agregar primer item</button>
        </div>
      )}

      {totalCount > 0 && filteredCount === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: 24, textAlign: 'center', fontSize: 12, color: '#888' }}>
          Sin resultados con los filtros actuales.
        </div>
      )}

      {/* Groups */}
      {grouped.map(({ chapter, items: chItems }) => {
        // Group within chapter by partida
        const byLineItem = new Map<string, { lineItem: LineItem; unit: Unit; items: WarehouseItem[] }>()
        for (const it of chItems) {
          const ctx = lineItemContext.get(it.template_line_item_id)
          if (!ctx) continue
          const key = ctx.lineItem.id
          if (!byLineItem.has(key)) byLineItem.set(key, { lineItem: ctx.lineItem, unit: ctx.unit, items: [] })
          byLineItem.get(key)!.items.push(it)
        }
        const lineItemGroups = Array.from(byLineItem.values()).sort((a, b) => {
          if (a.unit.orden !== b.unit.orden) return a.unit.orden - b.unit.orden
          return a.lineItem.orden - b.lineItem.orden
        })

        return (
          <section key={chapter.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #E8E6E0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.1em' }}>0{chapter.orden}</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.005em' }}>{chapter.nombre}</h2>
              <span style={{ fontSize: 11, color: '#AAA' }}>· {chItems.length} items</span>
            </div>

            {lineItemGroups.map(({ lineItem, unit, items: liItems }) => (
              <div key={lineItem.id} style={{ marginBottom: 22 }}>
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {chapter.orden}.{unit.orden} {unit.nombre}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#1A1A1A' }}>
                    {lineItem.nombre} <span style={{ color: '#AAA', fontSize: 11 }}>({lineItem.unidad_medida})</span>
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  {liItems.map(it => (
                    <ItemCard
                      key={it.id}
                      item={it}
                      onEdit={() => setEditing(it)}
                      onDelete={() => handleDelete(it)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )
      })}

      {/* Modals */}
      {creating && (
        <ItemModal
          initial={null}
          chapters={chapters}
          proveedores={proveedores}
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      )}
      {editing && (
        <ItemModal
          initial={editing}
          chapters={chapters}
          proveedores={proveedores}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  initMemoriaFromWarehouse,
  syncMemoriaFromWarehouse,
  updateMemoriaItem,
  syncMemoriaToFpe,
  type MemoriaItem,
  type EstadoDefinicion,
  type EstadoCompra,
} from '@/app/actions/memoria'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItemDef { id: string; unit_id: string; nombre: string; orden: number }
interface UnitDef {
  id: string; chapter_id: string; nombre: string
  label_cliente: string | null; descripcion_cliente: string | null; imagen_portada_url: string | null
  orden: number; line_items: LineItemDef[]
}
interface ChapterDef {
  id: string; nombre: string
  label_cliente: string | null; descripcion_cliente: string | null; imagen_portada_url: string | null
  orden: number; units: UnitDef[]
}
type NivelCalidad = 'functional' | 'select' | 'master_piece'
interface Proyecto { id: string; nombre: string; codigo: string | null; nivel_calidad: NivelCalidad | null; status: string }
interface Proveedor { id: string; nombre: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const NIVEL_META: Record<NivelCalidad, { label: string; color: string; bg: string }> = {
  functional:   { label: 'Functional',  color: '#1D9E75', bg: '#E8F7F2' },
  select:       { label: 'Select',      color: '#378ADD', bg: '#EBF5FF' },
  master_piece: { label: 'Masterpiece', color: '#D85A30', bg: '#FFF3EF' },
}

const ESTADO_META: Record<EstadoDefinicion, { label: string; color: string; bg: string }> = {
  orientativo: { label: 'Orientativo', color: '#888',    bg: '#F5F4F0' },
  confirmado:  { label: 'Confirmado',  color: '#1D9E75', bg: '#E8F7F2' },
  descartado:  { label: 'Descartado',  color: '#CCC',    bg: '#F5F4F0' },
}

const S = {
  fieldLabel: { margin: '0 0 2px', fontSize: 8, fontWeight: 700 as const, color: '#AAA', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  input: { width: '100%', padding: '5px 7px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 4, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: '#1A1A1A' },
  btnSm: (bg?: string, color?: string): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 10, borderRadius: 4, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', background: bg ?? '#F0EEE8', color: color ?? '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

// ── Notes Modal ───────────────────────────────────────────────────────────────

function NotesModal({ item, onClose, onSaved }: { item: MemoriaItem; onClose: () => void; onSaved: (id: string, notas: string | null) => void }) {
  const [notas, setNotas] = useState(item.notas ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const res = await updateMemoriaItem(item.id, { notas: notas.trim() || null })
    setSaving(false)
    if ('error' in res) { alert(res.error); return }
    onSaved(item.id, notas.trim() || null)
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Notas del proyecto</p>
            <h3 style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{item.marca ? `${item.marca} — ` : ''}{item.nombre}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <textarea rows={5} value={notas} onChange={e => setNotas(e.target.value)} autoFocus
            placeholder="Observaciones, variantes, instrucciones especiales…"
            style={{ ...S.input, resize: 'vertical', padding: '8px 10px' }} />
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#F0EEE8', color: '#555' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#1A1A1A', color: '#fff', fontWeight: 500 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Item Card (Anteproyecto) ──────────────────────────────────────────────────

function ItemCard({ item, proveedores, onEstadoChange, onNotesChange }: {
  item: MemoriaItem; proveedores: Proveedor[]
  onEstadoChange: (id: string, estado: EstadoDefinicion) => void
  onNotesChange: (id: string, notas: string | null) => void
}) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const estado = ESTADO_META[item.estado_definicion]
  const img = item.imagen_lifestyle_url || item.imagen_principal_url
  const proveedor = proveedores.find(p => p.id === item.proveedor_preferente_id)
  const isDescartado = item.estado_definicion === 'descartado'

  const handleEstado = (next: EstadoDefinicion) => {
    startTransition(async () => {
      const res = await updateMemoriaItem(item.id, { estado_definicion: next })
      if ('error' in res) { alert(res.error); return }
      onEstadoChange(item.id, next)
    })
  }

  return (
    <>
      <div style={{ borderRadius: 8, border: `1px solid ${isDescartado ? '#F0EEE8' : '#E8E6E0'}`, background: isDescartado ? '#FAFAF8' : '#fff', overflow: 'hidden', opacity: isDescartado ? 0.5 : 1, display: 'flex', flexDirection: 'column', minWidth: 180, maxWidth: 220, flexShrink: 0 }}>
        {/* Image */}
        <div style={{ width: '100%', height: 120, background: '#F5F4F0', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          {img
            ? <img src={img} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 24, color: '#DDD' }}>□</span></div>
          }
          <div style={{ position: 'absolute', top: 6, right: 6 }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', padding: '2px 5px', borderRadius: 3, background: estado.bg, color: estado.color }}>
              {estado.label.toUpperCase()}
            </span>
          </div>
        </div>
        {/* Content */}
        <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {item.marca && <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#888' }}>{item.marca}</p>}
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{item.nombre}</p>
          {item.modelo && <p style={{ margin: 0, fontSize: 11, color: '#AAA' }}>{item.modelo}</p>}
          {item.precio_referencia != null && (
            <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: '#555' }}>
              {item.precio_referencia.toLocaleString('es-ES', { minimumFractionDigits: 0 })} {item.moneda}
            </p>
          )}
          {proveedor && <p style={{ margin: 0, fontSize: 10, color: '#BBB' }}>{proveedor.nombre}</p>}
          {item.notas && (
            <p style={{ margin: '4px 0 0', fontSize: 10, color: '#D85A30', fontStyle: 'italic', lineHeight: 1.3 }}>
              {item.notas.length > 60 ? item.notas.slice(0, 60) + '…' : item.notas}
            </p>
          )}
        </div>
        {/* Actions */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EEE8', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setNotesOpen(true)} style={{ ...S.btnSm(), border: '1px solid #E8E6E0' }}>
            {item.notas ? '✎ Nota' : '+ Nota'}
          </button>
          {item.estado_definicion === 'orientativo' && (
            <button onClick={() => handleEstado('confirmado')} disabled={isPending} style={S.btnSm('#1D9E75', '#fff')}>
              Confirmar
            </button>
          )}
          {item.estado_definicion === 'confirmado' && (
            <button onClick={() => handleEstado('orientativo')} disabled={isPending} style={{ ...S.btnSm(), border: '1px solid #E8E6E0' }}>
              Desconfirmar
            </button>
          )}
          {item.estado_definicion !== 'descartado' ? (
            <button onClick={() => handleEstado('descartado')} disabled={isPending} style={S.btnSm('#FEE2E2', '#DC2626')}>
              ×
            </button>
          ) : (
            <button onClick={() => handleEstado('orientativo')} disabled={isPending} style={{ ...S.btnSm(), border: '1px solid #E8E6E0' }}>
              Restaurar
            </button>
          )}
        </div>
      </div>
      {notesOpen && (
        <NotesModal item={item} onClose={() => setNotesOpen(false)}
          onSaved={(id, notas) => { onNotesChange(id, notas); setNotesOpen(false) }} />
      )}
    </>
  )
}

// ── Ejecutivo Item Row ────────────────────────────────────────────────────────

function EjecutivoItemRow({ item, proveedores, onEstadoChange, onItemUpdate }: {
  item: MemoriaItem; proveedores: Proveedor[]
  onEstadoChange: (id: string, estado: EstadoDefinicion) => void
  onItemUpdate: (id: string, patch: Partial<MemoriaItem>) => void
}) {
  const [cantidad, setCantidad] = useState(item.cantidad != null ? String(item.cantidad) : '')
  const [ubicaciones, setUbicaciones] = useState((item.ubicaciones ?? []).join(', '))
  const [acabado, setAcabado] = useState(item.acabado_seleccionado ?? '')
  const [urlProducto, setUrlProducto] = useState(item.url_producto ?? '')
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  const img = item.imagen_lifestyle_url || item.imagen_principal_url
  const proveedor = proveedores.find(p => p.id === item.proveedor_preferente_id)

  const handleBlur = async () => {
    const parsedCantidad = cantidad.trim() ? parseFloat(cantidad) || null : null
    const parsedUbicaciones = ubicaciones.split(',').map(s => s.trim()).filter(Boolean)
    const parsedAcabado = acabado.trim() || null
    const parsedUrl = urlProducto.trim() || null
    setSaving(true)
    const res = await updateMemoriaItem(item.id, {
      cantidad: parsedCantidad,
      ubicaciones: parsedUbicaciones,
      acabado_seleccionado: parsedAcabado,
      url_producto: parsedUrl,
    })
    setSaving(false)
    if ('error' in res) { alert(res.error); return }
    onItemUpdate(item.id, { cantidad: parsedCantidad, ubicaciones: parsedUbicaciones, acabado_seleccionado: parsedAcabado, url_producto: parsedUrl })
  }

  const handleDesconfirmar = () => {
    startTransition(async () => {
      const res = await updateMemoriaItem(item.id, { estado_definicion: 'orientativo' })
      if ('error' in res) { alert(res.error); return }
      onEstadoChange(item.id, 'orientativo')
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0EEE8' }}>
      {/* Thumbnail */}
      <div style={{ width: 52, height: 38, background: '#F5F4F0', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
        {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>

      {/* Identity */}
      <div style={{ flex: 1.5, minWidth: 0 }}>
        {item.marca && <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.marca}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
          {item.url_producto && (
            <a href={item.url_producto} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: '#378ADD', textDecoration: 'none', flexShrink: 0 }} title="Ver producto">↗</a>
          )}
        </div>
        {item.modelo && <p style={{ margin: 0, fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.modelo}</p>}
        {item.referencia && <p style={{ margin: 0, fontSize: 10, color: '#BBB', fontFamily: 'monospace' }}>{item.referencia}</p>}
        {proveedor && <p style={{ margin: 0, fontSize: 9, color: '#CCC' }}>{proveedor.nombre}</p>}
      </div>

      {/* Cantidad */}
      <div style={{ flexShrink: 0, width: 80 }}>
        <p style={S.fieldLabel}>Cantidad</p>
        <input type="number" min={0} step={0.01} value={cantidad}
          onChange={e => setCantidad(e.target.value)} onBlur={handleBlur}
          placeholder="—" style={S.input} />
      </div>

      {/* Ubicaciones */}
      <div style={{ flex: 1.5, minWidth: 130 }}>
        <p style={S.fieldLabel}>Ubicaciones</p>
        <input type="text" value={ubicaciones}
          onChange={e => setUbicaciones(e.target.value)} onBlur={handleBlur}
          placeholder="Salón, hab. 1…" style={S.input} />
      </div>

      {/* Acabado */}
      <div style={{ flex: 1, minWidth: 100 }}>
        <p style={S.fieldLabel}>Acabado</p>
        {(item.acabados ?? []).length > 0 ? (
          <select value={acabado} onChange={e => setAcabado(e.target.value)} onBlur={handleBlur}
            style={{ ...S.input, padding: '5px 6px' }}>
            <option value="">— —</option>
            {item.acabados.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        ) : (
          <input type="text" value={acabado}
            onChange={e => setAcabado(e.target.value)} onBlur={handleBlur}
            placeholder="—" style={S.input} />
        )}
      </div>

      {/* URL */}
      <div style={{ flex: 1, minWidth: 90 }}>
        <p style={S.fieldLabel}>URL compra</p>
        <input type="url" value={urlProducto}
          onChange={e => setUrlProducto(e.target.value)} onBlur={handleBlur}
          placeholder="https://…" style={{ ...S.input, fontSize: 10 }} />
      </div>

      {/* Price */}
      {item.precio_referencia != null && (
        <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 72 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#555' }}>
            {item.precio_referencia.toLocaleString('es-ES')} {item.moneda}
          </p>
          {item.cantidad != null && (
            <p style={{ margin: 0, fontSize: 10, color: '#AAA' }}>
              = {(item.precio_referencia * item.cantidad).toLocaleString('es-ES')} {item.moneda}
            </p>
          )}
        </div>
      )}

      {saving && <span style={{ fontSize: 9, color: '#AAA', flexShrink: 0 }}>↑</span>}

      <button onClick={handleDesconfirmar} disabled={isPending}
        style={{ ...S.btnSm(), border: '1px solid #E8E6E0', flexShrink: 0 }}>
        Desconfirmar
      </button>
    </div>
  )
}

// ── Helpers: grouped rendering ────────────────────────────────────────────────

function GroupedItems({
  chapters,
  itemsByPartida,
  renderItems,
}: {
  chapters: ChapterDef[]
  itemsByPartida: Record<string, MemoriaItem[]>
  renderItems: (items: MemoriaItem[]) => React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {[...chapters].sort((a, b) => a.orden - b.orden).map(chapter => {
        const chapterHasItems = chapter.units.some(u => u.line_items.some(li => (itemsByPartida[li.id] ?? []).length > 0))
        if (!chapterHasItems) return null
        const chapterLabel = chapter.label_cliente || chapter.nombre

        return (
          <div key={chapter.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#1A1A1A', borderRadius: '8px 8px 0 0' }}>
              {chapter.imagen_portada_url && (
                <img src={chapter.imagen_portada_url} alt="" style={{ width: 32, height: 22, objectFit: 'cover', borderRadius: 3, opacity: 0.8, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{chapterLabel}</span>
              {chapter.label_cliente && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{chapter.nombre}</span>}
            </div>
            <div style={{ border: '1px solid #E8E6E0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
              {[...chapter.units].sort((a, b) => a.orden - b.orden).map(unit => {
                const unitHasItems = unit.line_items.some(li => (itemsByPartida[li.id] ?? []).length > 0)
                if (!unitHasItems) return null
                const unitLabel = unit.label_cliente || unit.nombre
                return (
                  <div key={unit.id} style={{ borderBottom: '1px solid #F0EEE8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: '#F8F7F4' }}>
                      {unit.imagen_portada_url && (
                        <img src={unit.imagen_portada_url} alt="" style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#555', flex: 1 }}>{unitLabel}</span>
                      {unit.label_cliente && <span style={{ fontSize: 9, color: '#CCC' }}>{unit.nombre}</span>}
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[...unit.line_items].sort((a, b) => a.orden - b.orden).map(li => {
                        const liItems = itemsByPartida[li.id] ?? []
                        if (liItems.length === 0) return null
                        return (
                          <div key={li.id}>
                            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#AAA' }}>
                              {li.nombre}
                            </p>
                            {renderItems(liItems)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Anteproyecto Tab ──────────────────────────────────────────────────────────

function AnteproyectoTab({ proyecto, items, chapters, proveedores, onEstadoChange, onNotesChange, onInit, onSync }: {
  proyecto: Proyecto; items: MemoriaItem[]; chapters: ChapterDef[]; proveedores: Proveedor[]
  onEstadoChange: (id: string, estado: EstadoDefinicion) => void
  onNotesChange: (id: string, notas: string | null) => void
  onInit: () => void; onSync: () => void
  }) {
  const [isPending, startTransition] = useTransition()
  const [filterEstado, setFilterEstado] = useState<EstadoDefinicion | 'all'>('all')

  const handleInit = () => startTransition(async () => {
    const res = await initMemoriaFromWarehouse(proyecto.id)
    if ('error' in res) { alert(res.error); return }
    alert(`Memoria inicializada con ${res.count} items.`)
    onInit()
  })

  const handleSync = () => startTransition(async () => {
    const res = await syncMemoriaFromWarehouse(proyecto.id)
    if ('error' in res) { alert(res.error); return }
    if (res.added === 0) alert('No hay items nuevos en el warehouse para añadir.')
    else { alert(`${res.added} items nuevos añadidos.`); onSync() }
  })

  const displayItems = filterEstado === 'all' ? items : items.filter(i => i.estado_definicion === filterEstado)

  const itemsByPartida: Record<string, MemoriaItem[]> = {}
  for (const item of displayItems) {
    if (!itemsByPartida[item.template_line_item_id]) itemsByPartida[item.template_line_item_id] = []
    itemsByPartida[item.template_line_item_id].push(item)
  }

  const orientativo = items.filter(i => i.estado_definicion === 'orientativo').length
  const confirmado  = items.filter(i => i.estado_definicion === 'confirmado').length
  const descartado  = items.filter(i => i.estado_definicion === 'descartado').length

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flex: 1 }}>
            {[
              { label: 'Total', value: items.length, color: '#888' },
              { label: 'Orientativos', value: orientativo, color: '#888' },
              { label: 'Confirmados', value: confirmado, color: '#1D9E75' },
              { label: 'Descartados', value: descartado, color: '#CCC' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
                <p style={{ margin: '2px 0 0', fontSize: 9, color: '#BBB', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {items.length > 0 && (
            <a href={`/api/memoria/${proyecto.id}/anteproyecto-pdf`} target="_blank" rel="noopener noreferrer"
              style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #E8E6E0', cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#555', textDecoration: 'none' }}>
              ↓ PDF Lookbook
            </a>
          )}
          {items.length === 0 ? (
            <button onClick={handleInit} disabled={isPending || !proyecto.nivel_calidad}
              style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#1A1A1A', color: '#fff' }}>
              {isPending ? 'Inicializando…' : 'Inicializar desde Warehouse'}
            </button>
          ) : (
            <button onClick={handleSync} disabled={isPending}
              style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #E8E6E0', cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#555' }}>
              {isPending ? 'Sincronizando…' : 'Sincronizar con Warehouse'}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #E8E6E0' }}>
          {(['all', 'orientativo', 'confirmado', 'descartado'] as const).map(k => (
            <button key={k} onClick={() => setFilterEstado(k)}
              style={{ padding: '7px 14px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: filterEstado === k ? 700 : 400, background: 'none', color: filterEstado === k ? '#1A1A1A' : '#888', borderBottom: filterEstado === k ? '2px solid #1A1A1A' : '2px solid transparent', marginBottom: -1 }}>
              {k === 'all' ? 'Todos' : k.charAt(0).toUpperCase() + k.slice(1) + 's'}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12, color: '#BBB' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>Memoria sin inicializar</p>
          <p style={{ fontSize: 13 }}>
            {proyecto.nivel_calidad
              ? `Items disponibles en warehouse para nivel ${NIVEL_META[proyecto.nivel_calidad].label}.`
              : 'Asigna un nivel de calidad al proyecto.'}
          </p>
        </div>
      ) : (
        <GroupedItems
          chapters={chapters}
          itemsByPartida={itemsByPartida}
          renderItems={liItems => (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {liItems.map(item => (
                <ItemCard key={item.id} item={item} proveedores={proveedores}
                  onEstadoChange={onEstadoChange} onNotesChange={onNotesChange} />
              ))}
            </div>
          )}
        />
      )}
    </div>
  )
}

// ── Ejecutivo Tab ─────────────────────────────────────────────────────────────

function EjecutivoTab({ proyecto_id, items, chapters, proveedores, onEstadoChange, onItemUpdate }: {
  proyecto_id: string; items: MemoriaItem[]; chapters: ChapterDef[]; proveedores: Proveedor[]
  onEstadoChange: (id: string, estado: EstadoDefinicion) => void
  onItemUpdate: (id: string, patch: Partial<MemoriaItem>) => void
}) {
  const confirmed = items.filter(i => i.estado_definicion === 'confirmado')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ fpe_project_id: string; units_created: number; items_synced: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const itemsByPartida: Record<string, MemoriaItem[]> = {}
  for (const item of confirmed) {
    if (!itemsByPartida[item.template_line_item_id]) itemsByPartida[item.template_line_item_id] = []
    itemsByPartida[item.template_line_item_id].push(item)
  }

  // Running total
  const totalConPrecio = confirmed.filter(i => i.precio_referencia != null && i.cantidad != null)
  const total = totalConPrecio.reduce((acc, i) => acc + (i.precio_referencia ?? 0) * (i.cantidad ?? 0), 0)

  const handleSyncFpe = async () => {
    setSyncing(true)
    setSyncError(null)
    const res = await syncMemoriaToFpe(proyecto_id)
    setSyncing(false)
    if ('error' in res) { setSyncError(res.error); return }
    setSyncResult(res)
  }

  if (confirmed.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12, color: '#BBB' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>Sin productos confirmados</p>
        <p style={{ fontSize: 13 }}>Confirma productos en la pestaña Anteproyecto para verlos aquí y asignarles cantidad y ubicación.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '12px 16px', background: '#F8F7F4', borderRadius: 8, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1D9E75', lineHeight: 1 }}>{confirmed.length}</p>
          <p style={{ margin: '2px 0 0', fontSize: 9, fontWeight: 700, color: '#BBB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmados</p>
        </div>
        {total > 0 && (
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
              {total.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 9, fontWeight: 700, color: '#BBB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total ref. (con cantidad)</p>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#BBB' }}>Auto-save al salir del campo</p>
          <a href={`/api/memoria/${proyecto_id}/ejecutivo-pdf`} target="_blank" rel="noopener noreferrer"
            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 5, border: '1px solid #E8E6E0', fontFamily: 'inherit', background: '#fff', color: '#555', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ↓ PDF Ejecutivo
          </a>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 8px', borderBottom: '2px solid #1A1A1A', marginBottom: 4 }}>
        <div style={{ width: 52, flexShrink: 0 }} />
        <div style={{ flex: 1.5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Producto</span>
        </div>
        <div style={{ width: 80, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ud.</span>
        </div>
        <div style={{ flex: 1.5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ubicaciones</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acabado</span>
        </div>
        <div style={{ minWidth: 72, flexShrink: 0 }} />
        <div style={{ width: 8, flexShrink: 0 }} />
        <div style={{ width: 90, flexShrink: 0 }} />
      </div>

      <GroupedItems
        chapters={chapters}
        itemsByPartida={itemsByPartida}
        renderItems={liItems => (
          <div>
            {liItems.map(item => (
              <EjecutivoItemRow key={item.id} item={item} proveedores={proveedores}
                onEstadoChange={onEstadoChange} onItemUpdate={onItemUpdate} />
            ))}
          </div>
        )}
      />

      {/* FPE Export */}
      <div style={{ marginTop: 32, padding: '16px 20px', border: '1px solid #E8E6E0', borderRadius: 8, background: '#FAFAF8' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>FP Execution</p>
            <p style={{ margin: 0, fontSize: 12, color: '#555' }}>
              Exporta los {confirmed.length} productos confirmados con sus cantidades al proyecto FPE vinculado.
            </p>
            {syncResult && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#1D9E75' }}>
                Sincronizado — {syncResult.items_synced} partidas · {syncResult.units_created} nuevas unidades ·{' '}
                <Link href={`/team/fp-execution/projects/${syncResult.fpe_project_id}`} style={{ color: '#378ADD', textDecoration: 'underline' }}>
                  Ver proyecto FPE
                </Link>
              </p>
            )}
            {syncError && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626' }}>{syncError}</p>
            )}
          </div>
          <button
            onClick={handleSyncFpe}
            disabled={syncing}
            style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: '#1A1A1A', color: '#fff', flexShrink: 0, opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? 'Exportando…' : syncResult ? 'Re-sincronizar' : '→ Exportar a FPE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shopping List Tab ─────────────────────────────────────────────────────────

const ESTADO_COMPRA_META: Record<EstadoCompra, { label: string; color: string; bg: string }> = {
  pendiente:   { label: 'Pendiente',   color: '#888',    bg: '#F5F4F0' },
  pedido:      { label: 'Pedido',      color: '#378ADD', bg: '#EBF5FF' },
  en_transito: { label: 'En tránsito', color: '#D97706', bg: '#FFF8EB' },
  recibido:    { label: 'Recibido',    color: '#059669', bg: '#ECFDF5' },
  instalado:   { label: 'Instalado',   color: '#1D9E75', bg: '#E8F7F2' },
}

const ESTADOS_COMPRA_ORDER: EstadoCompra[] = ['pendiente', 'pedido', 'en_transito', 'recibido', 'instalado']

function ShoppingListTab({ items, proveedores, onItemUpdate }: {
  items: MemoriaItem[]
  proveedores: Proveedor[]
  onItemUpdate: (id: string, patch: Partial<MemoriaItem>) => void
}) {
  const confirmed = items.filter(i => i.estado_definicion === 'confirmado')
  const [view, setView] = useState<'ubicacion' | 'estado'>('ubicacion')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const proveedorMap = Object.fromEntries(proveedores.map(p => [p.id, p]))

  const handleEstadoCompra = async (item: MemoriaItem, estado: EstadoCompra) => {
    setUpdatingId(item.id)
    onItemUpdate(item.id, { estado_compra: estado })
    await updateMemoriaItem(item.id, { estado_compra: estado })
    setUpdatingId(null)
  }

  // Counts per estado
  const counts = ESTADOS_COMPRA_ORDER.reduce((acc, e) => {
    acc[e] = confirmed.filter(i => i.estado_compra === e).length
    return acc
  }, {} as Record<EstadoCompra, number>)

  if (confirmed.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>Sin productos confirmados</p>
        <p style={{ fontSize: 13, color: '#BBB' }}>Confirma productos en Anteproyecto para gestionar su compra aquí.</p>
      </div>
    )
  }

  const renderItemRow = (item: MemoriaItem) => {
    const img = item.imagen_principal_url ?? item.imagen_lifestyle_url
    const proveedor = item.proveedor_preferente_id ? proveedorMap[item.proveedor_preferente_id] : null
    const isUpdating = updatingId === item.id
    return (
      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0EEE8' }}>
        {/* Thumbnail */}
        <div style={{ width: 44, height: 32, background: '#F5F4F0', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
          {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>

        {/* Identity */}
        <div style={{ flex: 2, minWidth: 0 }}>
          {item.marca && <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.marca}</p>}
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
          {item.modelo && <p style={{ margin: 0, fontSize: 10, color: '#888' }}>{item.modelo}</p>}
          {item.referencia && <p style={{ margin: 0, fontSize: 9, color: '#BBB', fontFamily: 'monospace' }}>{item.referencia}</p>}
        </div>

        {/* Cantidad + Acabado */}
        <div style={{ flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
          {item.cantidad != null && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{item.cantidad}</p>
          )}
          {item.acabado_seleccionado && (
            <p style={{ margin: '1px 0 0', fontSize: 9, color: '#888' }}>{item.acabado_seleccionado}</p>
          )}
        </div>

        {/* Proveedor */}
        <div style={{ flexShrink: 0, minWidth: 100, textAlign: 'right' }}>
          {proveedor && <p style={{ margin: 0, fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proveedor.nombre}</p>}
          {item.precio_referencia != null && (
            <p style={{ margin: '1px 0 0', fontSize: 10, color: '#AAA' }}>
              {(item.precio_referencia * (item.cantidad ?? 1)).toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
            </p>
          )}
        </div>

        {/* Estado select */}
        <div style={{ flexShrink: 0 }}>
          <select
            value={item.estado_compra}
            disabled={isUpdating}
            onChange={e => handleEstadoCompra(item, e.target.value as EstadoCompra)}
            style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, border: '1px solid #E8E6E0', fontFamily: 'inherit', cursor: 'pointer', background: ESTADO_COMPRA_META[item.estado_compra].bg, color: ESTADO_COMPRA_META[item.estado_compra].color, appearance: 'auto', opacity: isUpdating ? 0.5 : 1 }}
          >
            {ESTADOS_COMPRA_ORDER.map(e => (
              <option key={e} value={e}>{ESTADO_COMPRA_META[e].label}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  // ── By ubicación ──────────────────────────────────────────────────────────

  const byUbicacion = () => {
    const ubicacionMap: Record<string, MemoriaItem[]> = {}
    const noUbicacion: MemoriaItem[] = []
    for (const item of confirmed) {
      if (!item.ubicaciones || item.ubicaciones.length === 0) {
        noUbicacion.push(item)
      } else {
        for (const ub of item.ubicaciones) {
          if (!ubicacionMap[ub]) ubicacionMap[ub] = []
          ubicacionMap[ub].push(item)
        }
      }
    }
    const sections = Object.entries(ubicacionMap).sort((a, b) => a[0].localeCompare(b[0]))
    if (noUbicacion.length > 0) sections.push(['Sin ubicación', noUbicacion])

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map(([ub, ubItems]) => (
          <div key={ub} style={{ border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#F5F4F0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{ub}</span>
              <span style={{ fontSize: 10, color: '#AAA' }}>{ubItems.length} producto{ubItems.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ padding: '4px 16px' }}>
              {ubItems.map(renderItemRow)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── By estado ─────────────────────────────────────────────────────────────

  const byEstado = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ESTADOS_COMPRA_ORDER.map(estado => {
        const estadoItems = confirmed.filter(i => i.estado_compra === estado)
        if (estadoItems.length === 0) return null
        const m = ESTADO_COMPRA_META[estado]
        return (
          <div key={estado} style={{ border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: m.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: m.color, opacity: 0.7 }}>· {estadoItems.length}</span>
            </div>
            <div style={{ padding: '4px 16px' }}>
              {estadoItems.map(renderItemRow)}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#F8F7F4', borderRadius: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {ESTADOS_COMPRA_ORDER.map(e => (
          <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_COMPRA_META[e].color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: counts[e] > 0 ? '#1A1A1A' : '#CCC', fontWeight: counts[e] > 0 ? 600 : 400 }}>
              {counts[e]} {ESTADO_COMPRA_META[e].label.toLowerCase()}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['ubicacion', 'estado'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: view === v ? '#1A1A1A' : '#F0EEE8', color: view === v ? '#fff' : '#555' }}>
              {v === 'ubicacion' ? 'Por estancia' : 'Por estado'}
            </button>
          ))}
        </div>
      </div>

      {view === 'ubicacion' ? byUbicacion() : byEstado()}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MemoriaDetallePage({ proyecto, initialItems, chapters, proveedores }: {
  proyecto: Proyecto; initialItems: MemoriaItem[]; chapters: ChapterDef[]; proveedores: Proveedor[]
}) {
  const [items, setItems] = useState<MemoriaItem[]>(initialItems)
  const [tab, setTab] = useState<'anteproyecto' | 'ejecutivo' | 'shopping'>('anteproyecto')

  const nivel = proyecto.nivel_calidad ? NIVEL_META[proyecto.nivel_calidad] : null

  const handleEstadoChange = (id: string, estado: EstadoDefinicion) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, estado_definicion: estado } : i))
  }
  const handleNotesChange = (id: string, notas: string | null) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, notas } : i))
  }
  const handleItemUpdate = (id: string, patch: Partial<MemoriaItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }
  const handleRefresh = () => { if (typeof window !== 'undefined') window.location.reload() }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: '#AAA' }}>
        <Link href="/team/memorias-calidad/proyectos" style={{ color: '#AAA', textDecoration: 'none' }}>Memorias de Calidad</Link>
        <span>/</span>
        <span style={{ color: '#1A1A1A' }}>{proyecto.nombre}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{proyecto.nombre}</h1>
          {proyecto.codigo && <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#AAA' }}>{proyecto.codigo}</span>}
        </div>
        {nivel && (
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: nivel.bg, color: nivel.color }}>
            {nivel.label}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid #E8E6E0' }}>
        {([
          { key: 'anteproyecto', label: 'Anteproyecto' },
          { key: 'ejecutivo',    label: 'Ejecutivo' },
          { key: 'shopping',     label: 'Shopping List' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '9px 16px', fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === key ? 700 : 400, background: 'none', color: tab === key ? '#1A1A1A' : '#888', borderBottom: tab === key ? '2px solid #1A1A1A' : '2px solid transparent', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'anteproyecto' && (
        <AnteproyectoTab proyecto={proyecto} items={items} chapters={chapters} proveedores={proveedores}
          onEstadoChange={handleEstadoChange} onNotesChange={handleNotesChange}
          onInit={handleRefresh} onSync={handleRefresh} />
      )}
      {tab === 'ejecutivo' && (
        <EjecutivoTab proyecto_id={proyecto.id} items={items} chapters={chapters} proveedores={proveedores}
          onEstadoChange={handleEstadoChange} onItemUpdate={handleItemUpdate} />
      )}
      {tab === 'shopping' && (
        <ShoppingListTab items={items} proveedores={proveedores} onItemUpdate={handleItemUpdate} />
      )}
    </div>
  )
}

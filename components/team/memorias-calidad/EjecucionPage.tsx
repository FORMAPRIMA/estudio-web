'use client'

import React, { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  addItemFromWarehouse,
  addItemLibre,
  createEstancia,
  deleteEstancia,
  deleteEstanciaItem,
  duplicarEstancia,
  guardarItemEnWarehouse,
  moveEstanciaItem,
  updateEstancia,
  updateEstanciaItem,
} from '@/app/actions/memorias'
import {
  ESTADOS_COMPRA,
  NIVELES,
  agruparEstructura,
  autoPvp,
  ceilCent,
  estadoCompraMeta,
  formatCantidad,
  formatEur,
  nivelMeta,
  totales,
  type Capitulo,
  type Estancia,
  type EstadoCompra,
  type EstanciaItem,
  type NivelCalidad,
  type Proveedor,
  type ProyectoMemoria,
  type Subcapitulo,
  type WarehouseItem,
} from '@/lib/memorias/domain'
import VistaToggle, { useVistaModo } from './VistaToggle'

interface Props {
  proyecto: ProyectoMemoria
  estancias: Estancia[]
  items: EstanciaItem[]
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  warehouse: WarehouseItem[]
  proveedores: Proveedor[]
}

const S = {
  label: { fontSize: 8.5, fontWeight: 700 as const, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 3 },
  input: { width: '100%', padding: '5px 7px', fontSize: 11.5, border: '1px solid #E8E6E0', borderRadius: 4, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  inputBig: { width: '100%', padding: '7px 10px', fontSize: 12.5, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: primary ? '#1A1A1A' : '#F0EEE8', color: primary ? '#fff' : '#555',
  }),
  btnSm: (color?: string): React.CSSProperties => ({
    padding: '4px 9px', fontSize: 10.5, borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: color ?? '#F0EEE8', color: color ? '#fff' : '#555',
  }),
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

function parseNumero(v: string): number | null {
  const limpio = v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  if (!limpio.trim()) return null
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : null
}

// ── Selector de producto (warehouse o libre) ──────────────────────────────────

function SelectorProducto({
  estancia, capitulos, subcapitulos, warehouse, onClose, onAdded,
}: {
  estancia: Estancia
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  warehouse: WarehouseItem[]
  onClose: () => void
  onAdded: () => void
}) {
  const [tab, setTab] = useState<'catalogo' | 'libre'>('catalogo')
  const [texto, setTexto] = useState('')
  const [capituloId, setCapituloId] = useState('all')
  const [nivelFiltro, setNivelFiltro] = useState<NivelCalidad | 'all'>('all')
  const [añadiendo, setAñadiendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Item libre
  const [libreNombre, setLibreNombre] = useState('')
  const [libreSub, setLibreSub] = useState('')
  const [libreMarca, setLibreMarca] = useState('')
  const [libreCantidad, setLibreCantidad] = useState('1')
  const [libreCoste, setLibreCoste] = useState('')
  const [librePvp, setLibrePvp] = useState('')
  const [guardando, setGuardando] = useState(false)

  const estructura = useMemo(() => agruparEstructura(capitulos, subcapitulos), [capitulos, subcapitulos])
  const subPorId = useMemo(() => new Map(subcapitulos.map(s => [s.id, s])), [subcapitulos])
  const capPorId = useMemo(() => new Map(capitulos.map(c => [c.id, c])), [capitulos])

  const resultados = useMemo(() => {
    const t = texto.trim().toLowerCase()
    return warehouse
      .filter(w => {
        if (nivelFiltro !== 'all' && w.nivel_calidad !== nivelFiltro) return false
        if (capituloId !== 'all') {
          const sub = subPorId.get(w.subcapitulo_id)
          if (!sub || sub.capitulo_id !== capituloId) return false
        }
        if (!t) return true
        const heno = [w.nombre, w.marca, w.modelo, w.referencia, ...(w.tags ?? [])].filter(Boolean).join(' ').toLowerCase()
        return heno.includes(t)
      })
      .slice(0, 120)
  }, [warehouse, texto, capituloId, nivelFiltro, subPorId])

  const añadir = async (item: WarehouseItem) => {
    setAñadiendo(item.id); setError(null)
    const res = await addItemFromWarehouse(estancia.id, item.id)
    setAñadiendo(null)
    if ('error' in res) { setError(res.error); return }
    onAdded()
  }

  const crearLibre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!libreNombre.trim() || !libreSub) { setError('Nombre y subcapítulo son obligatorios.'); return }
    setGuardando(true); setError(null)
    const coste = parseNumero(libreCoste)
    const res = await addItemLibre(estancia.id, {
      subcapitulo_id: libreSub,
      nombre: libreNombre,
      marca: libreMarca || null,
      cantidad: parseNumero(libreCantidad) ?? 1,
      precio_coste: coste,
      precio_pvp: parseNumero(librePvp) ?? autoPvp(coste),
    })
    setGuardando(false)
    if ('error' in res) { setError(res.error); return }
    onAdded()
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Añadir a</p>
            <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{estancia.nombre}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '10px 22px 0' }}>
          {([['catalogo', 'Del warehouse'], ['libre', 'Item libre']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: '7px 14px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: tab === k ? 700 : 400, background: 'none', color: tab === k ? '#1A1A1A' : '#999',
                borderBottom: tab === k ? '2px solid #1A1A1A' : '2px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'catalogo' ? (
          <>
            <div style={{ padding: '14px 22px', display: 'flex', gap: 8, borderBottom: '1px solid #F0EEE8' }}>
              <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar producto…" style={{ ...S.inputBig, flex: 1 }} />
              <select value={capituloId} onChange={e => setCapituloId(e.target.value)} style={{ ...S.inputBig, width: 'auto', maxWidth: 200 }}>
                <option value="all">Todos los capítulos</option>
                {estructura.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
              </select>
              <select value={nivelFiltro} onChange={e => setNivelFiltro(e.target.value as NivelCalidad | 'all')} style={{ ...S.inputBig, width: 'auto' }}>
                <option value="all">Todos los niveles</option>
                {NIVELES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 220 }}>
              {resultados.length === 0 && (
                <p style={{ padding: '30px 22px', textAlign: 'center', fontSize: 12, color: '#AAA' }}>
                  {warehouse.length === 0 ? 'El warehouse está vacío todavía.' : 'Sin resultados.'}
                </p>
              )}
              {resultados.map(item => {
                const sub = subPorId.get(item.subcapitulo_id)
                const cap = sub ? capPorId.get(sub.capitulo_id) : null
                const meta = nivelMeta(item.nivel_calidad)
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 22px', borderBottom: '1px solid #F5F4F0' }}>
                    <div style={{ width: 38, height: 30, borderRadius: 3, background: '#F8F7F4', overflow: 'hidden', flexShrink: 0 }}>
                      {item.imagen_principal_url && <img src={item.imagen_principal_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[item.marca, item.nombre].filter(Boolean).join(' · ')}
                      </div>
                      <div style={{ fontSize: 10, color: '#AAA' }}>
                        {cap?.nombre} › {sub?.nombre}{item.es_favorito ? ' · ★ Favorito FP' : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                    <span style={{ width: 74, textAlign: 'right', fontSize: 11.5, color: '#555', flexShrink: 0 }}>
                      {item.precio_pvp != null ? formatEur(item.precio_pvp, 0) : '—'}
                    </span>
                    <button onClick={() => añadir(item)} disabled={añadiendo === item.id} style={{ ...S.btnSm('#1A1A1A'), flexShrink: 0 }}>
                      {añadiendo === item.id ? '…' : 'Añadir'}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <form onSubmit={crearLibre} style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#888', lineHeight: 1.5 }}>
              Para piezas que no están en catálogo. Después puedes subirla al warehouse desde la propia ficha.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Nombre *</label>
                <input autoFocus value={libreNombre} onChange={e => setLibreNombre(e.target.value)} style={S.inputBig} />
              </div>
              <div>
                <label style={S.label}>Marca</label>
                <input value={libreMarca} onChange={e => setLibreMarca(e.target.value)} style={S.inputBig} />
              </div>
            </div>
            <div>
              <label style={S.label}>Subcapítulo *</label>
              <select value={libreSub} onChange={e => setLibreSub(e.target.value)} style={S.inputBig}>
                <option value="">— Selecciona —</option>
                {estructura.map(c => (
                  <optgroup key={c.id} label={`${c.numero}. ${c.nombre}`}>
                    {c.subcapitulos.map(sub => <option key={sub.id} value={sub.id}>{sub.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Cantidad</label>
                <input value={libreCantidad} onChange={e => setLibreCantidad(e.target.value)} style={S.inputBig} />
              </div>
              <div>
                <label style={S.label}>Coste ud.</label>
                <input value={libreCoste} onChange={e => setLibreCoste(e.target.value)} placeholder="0,00" style={S.inputBig} />
              </div>
              <div>
                <label style={S.label}>PVP ud.</label>
                <input value={librePvp} onChange={e => setLibrePvp(e.target.value)} placeholder="se calcula con el 16%" style={S.inputBig} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
              <button type="submit" disabled={guardando} style={S.btn(true)}>{guardando ? 'Añadiendo…' : 'Añadir'}</button>
            </div>
          </form>
        )}

        {error && (
          <div style={{ margin: '0 22px 16px', padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ficha de item (edición completa) ──────────────────────────────────────────

function ItemFicha({
  item, estancias, proveedores, onClose, onSaved,
}: {
  item: EstanciaItem
  estancias: Estancia[]
  proveedores: Proveedor[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(item.nombre)
  const [marca, setMarca] = useState(item.marca ?? '')
  const [modelo, setModelo] = useState(item.modelo ?? '')
  const [referencia, setReferencia] = useState(item.referencia ?? '')
  const [descripcion, setDescripcion] = useState(item.descripcion ?? '')
  const [acabado, setAcabado] = useState(item.acabado_seleccionado ?? '')
  const [cantidad, setCantidad] = useState(String(item.cantidad))
  const [proveedorId, setProveedorId] = useState(item.proveedor_id ?? '')
  const [coste, setCoste] = useState(item.precio_coste != null ? String(item.precio_coste) : '')
  const [pvp, setPvp] = useState(item.precio_pvp != null ? String(item.precio_pvp) : '')
  const [notas, setNotas] = useState(item.notas ?? '')
  const [estado, setEstado] = useState<EstadoCompra>(item.estado_compra)
  const [urlProducto, setUrlProducto] = useState(item.url_producto ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const costeNum = parseNumero(coste)
  const pvpNum = parseNumero(pvp)
  const cant = parseNumero(cantidad) ?? 0
  const margen = pvpNum != null && costeNum != null ? ceilCent((pvpNum - costeNum) * cant) : null

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true); setError(null)
    const res = await updateEstanciaItem(item.id, {
      nombre, marca, modelo, referencia, descripcion,
      acabado_seleccionado: acabado,
      cantidad: cant,
      proveedor_id: proveedorId || null,
      precio_coste: costeNum,
      precio_pvp: pvpNum,
      notas, estado_compra: estado, url_producto: urlProducto,
    })
    setGuardando(false)
    if ('error' in res) { setError(res.error); return }
    onSaved()
  }

  const mover = async (destino: string) => {
    if (!destino || destino === item.estancia_id) return
    const res = await moveEstanciaItem(item.id, destino)
    if ('error' in res) { setError(res.error); return }
    onSaved()
  }

  const subirAlWarehouse = async () => {
    const nivel = (window.prompt('¿A qué nivel lo subimos? functional / select / master_piece', 'select') ?? '').trim()
    if (!NIVELES.some(n => n.value === nivel)) return
    const res = await guardarItemEnWarehouse(item.id, nivel as NivelCalidad)
    if ('error' in res) { setError(res.error); return }
    onSaved()
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Ficha del item</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#CCC' }}>×</button>
        </div>

        <form onSubmit={guardar}>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(item.imagen_principal_url || item.imagen_lifestyle_url) && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[item.imagen_principal_url, item.imagen_lifestyle_url].filter(Boolean).map(url => (
                  <img key={url} src={url as string} alt="" style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 5, border: '1px solid #E8E6E0' }} />
                ))}
              </div>
            )}

            <div>
              <label style={S.label}>Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} style={S.inputBig} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={S.label}>Marca</label><input value={marca} onChange={e => setMarca(e.target.value)} style={S.inputBig} /></div>
              <div><label style={S.label}>Modelo</label><input value={modelo} onChange={e => setModelo(e.target.value)} style={S.inputBig} /></div>
              <div><label style={S.label}>Referencia</label><input value={referencia} onChange={e => setReferencia(e.target.value)} style={S.inputBig} /></div>
            </div>

            <div>
              <label style={S.label}>Descripción</label>
              <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} style={{ ...S.inputBig, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Acabado elegido</label>
                {item.acabados.length > 0 ? (
                  <select value={acabado} onChange={e => setAcabado(e.target.value)} style={S.inputBig}>
                    <option value="">— Sin definir —</option>
                    {item.acabados.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                ) : (
                  <input value={acabado} onChange={e => setAcabado(e.target.value)} style={S.inputBig} />
                )}
              </div>
              <div>
                <label style={S.label}>Estado de compra</label>
                <select value={estado} onChange={e => setEstado(e.target.value as EstadoCompra)} style={S.inputBig}>
                  {ESTADOS_COMPRA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', gap: 12 }}>
              <div><label style={S.label}>Cantidad</label><input value={cantidad} onChange={e => setCantidad(e.target.value)} style={S.inputBig} /></div>
              <div>
                <label style={S.label}>Coste ud.</label>
                <input
                  value={coste}
                  onChange={e => setCoste(e.target.value)}
                  onBlur={() => { const c = parseNumero(coste); if (c != null && !pvp.trim()) setPvp(String(autoPvp(c))) }}
                  style={S.inputBig}
                />
              </div>
              <div><label style={S.label}>PVP ud.</label><input value={pvp} onChange={e => setPvp(e.target.value)} style={S.inputBig} /></div>
              <div>
                <label style={S.label}>Proveedor</label>
                <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} style={S.inputBig}>
                  <option value="">— Sin asignar —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: '#666' }}>
              <span>Importe PVP <strong style={{ color: '#1A1A1A' }}>{formatEur(pvpNum != null ? ceilCent(pvpNum * cant) : null)}</strong></span>
              <span>Importe coste <strong style={{ color: '#1A1A1A' }}>{formatEur(costeNum != null ? ceilCent(costeNum * cant) : null)}</strong></span>
              {margen != null && <span>Margen <strong style={{ color: margen >= 0 ? '#1D9E75' : '#DC2626' }}>{formatEur(margen)}</strong></span>}
            </div>

            <div>
              <label style={S.label}>URL del producto</label>
              <input value={urlProducto} onChange={e => setUrlProducto(e.target.value)} placeholder="https://…" style={S.inputBig} />
            </div>

            <div>
              <label style={S.label}>Notas internas</label>
              <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} style={{ ...S.inputBig, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4, borderTop: '1px solid #F0EEE8', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: '#888' }}>Mover a</label>
              <select defaultValue="" onChange={e => mover(e.target.value)} style={{ ...S.input, width: 'auto', minWidth: 150 }}>
                <option value="">— Otra estancia —</option>
                {estancias.filter(e => e.id !== item.estancia_id).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              {!item.warehouse_item_id && (
                <button type="button" onClick={subirAlWarehouse} style={S.btnSm()}>Subir al warehouse</button>
              )}
              {item.url_producto && (
                <a href={item.url_producto} target="_blank" rel="noreferrer" style={{ ...S.btnSm(), textDecoration: 'none' }}>Ver en la web</a>
              )}
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{error}</div>
            )}
          </div>

          <div style={{ padding: '14px 22px', borderTop: '1px solid #E8E6E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btn()}>Cancelar</button>
            <button type="submit" disabled={guardando} style={S.btn(true)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Fila de item (listado desplegable) ────────────────────────────────────────

function ItemRow({
  item, proveedores, verEconomia, onEdit, onDelete, onPatch,
}: {
  item: EstanciaItem
  proveedores: Proveedor[]
  verEconomia: boolean
  onEdit: () => void
  onDelete: () => void
  onPatch: (patch: Partial<EstanciaItem>) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [cantidad, setCantidad] = useState(String(item.cantidad))
  const [coste, setCoste] = useState(item.precio_coste != null ? String(item.precio_coste) : '')
  const [pvp, setPvp] = useState(item.precio_pvp != null ? String(item.precio_pvp) : '')
  const [guardando, setGuardando] = useState(false)

  const guardarCampos = async () => {
    const cant = parseNumero(cantidad) ?? 1
    const costeNum = parseNumero(coste)
    const pvpNum = parseNumero(pvp)
    if (cant === item.cantidad && costeNum === item.precio_coste && pvpNum === item.precio_pvp) return
    setGuardando(true)
    const res = await updateEstanciaItem(item.id, { cantidad: cant, precio_coste: costeNum, precio_pvp: pvpNum })
    setGuardando(false)
    if ('error' in res) { alert(res.error); return }
    onPatch({ cantidad: cant, precio_coste: costeNum, precio_pvp: pvpNum })
  }

  const cambiarProveedor = async (proveedor_id: string) => {
    const res = await updateEstanciaItem(item.id, { proveedor_id: proveedor_id || null })
    if ('error' in res) { alert(res.error); return }
    onPatch({ proveedor_id: proveedor_id || null })
  }

  const cambiarEstado = async (estado_compra: EstadoCompra) => {
    const res = await updateEstanciaItem(item.id, { estado_compra })
    if ('error' in res) { alert(res.error); return }
    onPatch({ estado_compra })
  }

  const meta = estadoCompraMeta(item.estado_compra)
  const cant = parseNumero(cantidad) ?? 0
  const importePvp = item.precio_pvp != null ? ceilCent(item.precio_pvp * item.cantidad) : null

  return (
    <div style={{ borderBottom: '1px solid #F0EEE8', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px' }}>
        <span onClick={() => setAbierto(a => !a)} style={{ fontSize: 10, color: '#CCC', width: 10, cursor: 'pointer', flexShrink: 0 }}>
          {abierto ? '▾' : '▸'}
        </span>
        <div onClick={() => setAbierto(a => !a)} style={{ width: 34, height: 26, borderRadius: 3, background: '#F8F7F4', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
          {item.imagen_principal_url && <img src={item.imagen_principal_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>

        <div onClick={() => setAbierto(a => !a)} style={{ flex: 2, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[item.marca, item.nombre].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 10, color: '#AAA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.acabado_seleccionado ?? item.modelo ?? ''}
          </div>
        </div>

        <input
          value={cantidad}
          onChange={e => setCantidad(e.target.value)}
          onBlur={guardarCampos}
          style={{ ...S.input, width: 52, flexShrink: 0, textAlign: 'right' }}
          title="Cantidad"
        />

        <select
          value={item.proveedor_id ?? ''}
          onChange={e => cambiarProveedor(e.target.value)}
          style={{ ...S.input, width: 130, flexShrink: 0 }}
          title="Proveedor asignado"
        >
          <option value="">— proveedor —</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        {verEconomia && (
          <input
            value={coste}
            onChange={e => setCoste(e.target.value)}
            onBlur={guardarCampos}
            placeholder="coste"
            style={{ ...S.input, width: 68, flexShrink: 0, textAlign: 'right' }}
            title="Coste unitario"
          />
        )}
        <input
          value={pvp}
          onChange={e => setPvp(e.target.value)}
          onBlur={guardarCampos}
          placeholder="PVP"
          style={{ ...S.input, width: 74, flexShrink: 0, textAlign: 'right' }}
          title="PVP unitario"
        />
        <span style={{ width: 84, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: '#1A1A1A', flexShrink: 0 }}>
          {formatEur(importePvp, 0)}
        </span>

        <select
          value={item.estado_compra}
          onChange={e => cambiarEstado(e.target.value as EstadoCompra)}
          style={{ padding: '3px 6px', fontSize: 10, fontWeight: 600, borderRadius: 4, border: '1px solid #E8E6E0', fontFamily: 'inherit', cursor: 'pointer', background: meta.bg, color: meta.color, flexShrink: 0 }}
        >
          {ESTADOS_COMPRA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>

        <span style={{ width: 12, fontSize: 9, color: '#CCC', flexShrink: 0 }}>{guardando ? '↑' : ''}</span>
      </div>

      {abierto && (
        <div style={{ padding: '2px 12px 12px 65px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#777', lineHeight: 1.55 }}>
            {item.descripcion && <p style={{ margin: '0 0 4px' }}>{item.descripcion}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 10.5, color: '#999' }}>
              {item.referencia && <span>Ref. <span style={{ fontFamily: 'monospace', color: '#666' }}>{item.referencia}</span></span>}
              {item.nivel_calidad && <span>{nivelMeta(item.nivel_calidad).label}</span>}
              {!item.warehouse_item_id && <span style={{ color: '#D97706' }}>Item libre (no está en el warehouse)</span>}
              {item.notas && <span style={{ color: '#D85A30', fontStyle: 'italic' }}>{item.notas}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={onEdit} style={S.btnSm()}>Ficha completa</button>
              <button onClick={onDelete} style={S.btnSm('#DC2626')}>Quitar</button>
            </div>
          </div>
          {cant !== item.cantidad && <span style={{ fontSize: 10, color: '#D97706' }}>Sin guardar</span>}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de item ───────────────────────────────────────────────────────────

function ItemCard({
  item, proveedores, verEconomia, onEdit, onDelete,
}: {
  item: EstanciaItem
  proveedores: Proveedor[]
  verEconomia: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const proveedor = proveedores.find(p => p.id === item.proveedor_id)
  const meta = estadoCompraMeta(item.estado_compra)
  const importePvp = item.precio_pvp != null ? ceilCent(item.precio_pvp * item.cantidad) : null
  const importeCoste = item.precio_coste != null ? ceilCent(item.precio_coste * item.cantidad) : null

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#F8F7F4' }}>
        {item.imagen_principal_url ? (
          <img src={item.imagen_principal_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#CCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Sin imagen
          </div>
        )}
        <span style={{ position: 'absolute', top: 7, left: 7, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: meta.bg, color: meta.color }}>
          {meta.label}
        </span>
        <span style={{ position: 'absolute', top: 7, right: 7, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: 'rgba(26,26,26,0.85)', color: '#fff' }}>
          ×{formatCantidad(item.cantidad)}
        </span>
      </div>
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {item.marca && <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#999' }}>{item.marca}</p>}
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{item.nombre}</p>
        {item.acabado_seleccionado && <p style={{ margin: 0, fontSize: 10.5, color: '#888' }}>{item.acabado_seleccionado}</p>}
        {proveedor && <p style={{ margin: '2px 0 0', fontSize: 10, color: '#BBB' }}>{proveedor.nombre}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 11 }}>
          <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{formatEur(importePvp, 0)}</span>
          {verEconomia && importeCoste != null && <span style={{ color: '#AAA' }}>coste {formatEur(importeCoste, 0)}</span>}
        </div>
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EEE8', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onEdit} style={S.btnSm()}>Editar</button>
        <button onClick={onDelete} style={S.btnSm('#DC2626')}>Quitar</button>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function EjecucionPage({
  proyecto, estancias, items: initialItems, capitulos, subcapitulos, warehouse, proveedores,
}: Props) {
  const router = useRouter()
  const [vista, setVista] = useVistaModo('lista')
  const [items, setItems] = useState<EstanciaItem[]>(initialItems)
  const [verEconomia, setVerEconomia] = useState(true)
  const [añadiendoA, setAñadiendoA] = useState<Estancia | null>(null)
  const [fichaItem, setFichaItem] = useState<EstanciaItem | null>(null)
  const [nuevaEstancia, setNuevaEstancia] = useState('')
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null)
  const [proveedorPdf, setProveedorPdf] = useState('')
  const [isPending, startTransition] = useTransition()

  const refrescar = () => { setAñadiendoA(null); setFichaItem(null); router.refresh() }
  const patch = (id: string, p: Partial<EstanciaItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i))

  const porEstancia = useMemo(() => {
    const map = new Map<string, EstanciaItem[]>()
    for (const it of items) {
      if (!map.has(it.estancia_id)) map.set(it.estancia_id, [])
      map.get(it.estancia_id)!.push(it)
    }
    map.forEach(lista => lista.sort((a, b) => a.orden - b.orden))
    return map
  }, [items])

  const total = useMemo(() => totales(items), [items])

  // Proveedores que realmente tienen items en este proyecto
  const proveedoresConItems = useMemo(() => {
    const ids = new Set(items.map(i => i.proveedor_id).filter(Boolean) as string[])
    return proveedores.filter(p => ids.has(p.id))
  }, [items, proveedores])

  const crear = () => {
    if (!nuevaEstancia.trim()) return
    startTransition(async () => {
      const res = await createEstancia(proyecto.id, nuevaEstancia)
      if ('error' in res) { alert(res.error); return }
      setNuevaEstancia('')
      router.refresh()
    })
  }

  const renombrar = async () => {
    if (!renombrando) return
    const res = await updateEstancia(renombrando.id, { nombre: renombrando.nombre })
    if ('error' in res) { alert(res.error); return }
    setRenombrando(null)
    router.refresh()
  }

  const borrarEstancia = async (estancia: Estancia) => {
    const n = porEstancia.get(estancia.id)?.length ?? 0
    if (!confirm(`¿Eliminar "${estancia.nombre}"${n > 0 ? ` y sus ${n} items` : ''}?`)) return
    const res = await deleteEstancia(estancia.id)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const duplicar = async (estancia: Estancia) => {
    const res = await duplicarEstancia(estancia.id)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const quitarItem = async (item: EstanciaItem) => {
    if (!confirm(`¿Quitar "${item.nombre}" de la memoria?`)) return
    const res = await deleteEstanciaItem(item.id)
    if ('error' in res) { alert(res.error); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const nivel = proyecto.nivel_calidad ? nivelMeta(proyecto.nivel_calidad) : null
  const base = `/api/memorias/${proyecto.id}/ejecutivo/pdf`

  return (
    <div style={{ padding: '28px 36px', minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Migas + cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 11.5, color: '#AAA' }}>
        <Link href="/team/memorias-calidad/proyectos" style={{ color: '#AAA', textDecoration: 'none' }}>Memorias de calidades</Link>
        <span>/</span>
        <span style={{ color: '#1A1A1A' }}>{proyecto.nombre}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{proyecto.nombre}</h1>
            {proyecto.codigo && <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#AAA' }}>{proyecto.codigo}</span>}
            {nivel && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: nivel.bg, color: nivel.color }}>
                {nivel.label}
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#888' }}>
            Memoria de calidades de ejecución · selección por estancia con cantidades, proveedor y control económico
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <VistaToggle vista={vista} onChange={setVista} />
          <a href={base} target="_blank" rel="noopener noreferrer" style={{ ...S.btn(), textDecoration: 'none' }}>PDF cliente</a>
          <a href={`${base}?costes=1`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn(), textDecoration: 'none' }}>PDF interno</a>
          <select
            value={proveedorPdf}
            onChange={e => {
              const id = e.target.value
              setProveedorPdf('')
              if (id) window.open(`${base}?proveedor_id=${id}`, '_blank')
            }}
            style={{ ...S.input, width: 'auto', minWidth: 150, padding: '7px 9px' }}
            disabled={proveedoresConItems.length === 0}
          >
            <option value="">Pedido por proveedor…</option>
            {proveedoresConItems.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Totales */}
      <div style={{ display: 'flex', gap: 26, alignItems: 'center', padding: '14px 18px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{formatEur(total.pvp, 0)}</p>
          <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>PVP cliente</p>
        </div>
        {verEconomia && (
          <>
            <div>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#777', lineHeight: 1 }}>{formatEur(total.coste, 0)}</p>
              <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>Coste</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: total.margen >= 0 ? '#1D9E75' : '#DC2626', lineHeight: 1 }}>
                {formatEur(total.margen, 0)}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>
                Margen{total.margenPct != null ? ` · ${total.margenPct.toFixed(1)}%` : ''}
              </p>
            </div>
          </>
        )}
        <div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{estancias.length}</p>
          <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>Estancias</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{items.length}</p>
          <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>Items</p>
        </div>
        <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#666', cursor: 'pointer' }}>
          <input type="checkbox" checked={verEconomia} onChange={e => setVerEconomia(e.target.checked)} />
          Ver coste y margen
        </label>
      </div>

      {/* Estancias */}
      {estancias.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #D5D3CE', borderRadius: 8, padding: 36, textAlign: 'center', marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>Empieza configurando las estancias.</p>
          <p style={{ margin: 0, fontSize: 11.5, color: '#999', lineHeight: 1.6 }}>
            Salón, Cocina, Baño principal, Dormitorio 1… Cada estancia es una carpeta a la que luego cuelgas productos de cualquier capítulo.
          </p>
        </div>
      )}

      {estancias.map(estancia => {
        const propios = porEstancia.get(estancia.id) ?? []
        const t = totales(propios)

        return (
          <section key={estancia.id} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1A1A1A', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
              {renombrando?.id === estancia.id ? (
                <>
                  <input
                    autoFocus
                    value={renombrando.nombre}
                    onChange={e => setRenombrando({ ...renombrando, nombre: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') renombrar(); if (e.key === 'Escape') setRenombrando(null) }}
                    style={{ ...S.input, width: 220 }}
                  />
                  <button onClick={renombrar} style={S.btnSm('#1D9E75')}>Guardar</button>
                  <button onClick={() => setRenombrando(null)} style={S.btnSm()}>×</button>
                </>
              ) : (
                <>
                  <h2
                    onDoubleClick={() => setRenombrando({ id: estancia.id, nombre: estancia.nombre })}
                    title="Doble clic para renombrar"
                    style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'text' }}
                  >
                    {estancia.nombre}
                  </h2>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    {propios.length} item{propios.length !== 1 ? 's' : ''} · {formatEur(t.pvp, 0)}
                    {verEconomia && t.coste > 0 ? ` · margen ${formatEur(t.margen, 0)}` : ''}
                  </span>
                </>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => setAñadiendoA(estancia)} style={S.btnSm('#D85A30')}>+ Producto</button>
                <button onClick={() => setRenombrando({ id: estancia.id, nombre: estancia.nombre })} style={{ ...S.btnSm(), background: 'rgba(255,255,255,0.12)', color: '#EEE' }}>Renombrar</button>
                <button onClick={() => duplicar(estancia)} style={{ ...S.btnSm(), background: 'rgba(255,255,255,0.12)', color: '#EEE' }}>Duplicar</button>
                <button onClick={() => borrarEstancia(estancia)} style={{ ...S.btnSm(), background: 'rgba(255,255,255,0.12)', color: '#F5A3A3' }}>Eliminar</button>
              </div>
            </div>

            <div style={{ border: '1px solid #E8E6E0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', background: '#fff' }}>
              {propios.length === 0 ? (
                <p style={{ margin: 0, padding: '20px 14px', fontSize: 11.5, color: '#BBB', textAlign: 'center' }}>
                  Sin productos todavía.
                </p>
              ) : vista === 'lista' ? (
                propios.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    proveedores={proveedores}
                    verEconomia={verEconomia}
                    onEdit={() => setFichaItem(item)}
                    onDelete={() => quitarItem(item)}
                    onPatch={p => patch(item.id, p)}
                  />
                ))
              ) : (
                <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
                  {propios.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      proveedores={proveedores}
                      verEconomia={verEconomia}
                      onEdit={() => setFichaItem(item)}
                      onDelete={() => quitarItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}

      {/* Nueva estancia */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <input
          value={nuevaEstancia}
          onChange={e => setNuevaEstancia(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') crear() }}
          placeholder="Nombre de la estancia (Salón, Baño principal…)"
          style={{ ...S.inputBig, maxWidth: 320 }}
        />
        <button onClick={crear} disabled={isPending || !nuevaEstancia.trim()} style={S.btn(true)}>
          {isPending ? 'Creando…' : '+ Añadir estancia'}
        </button>
      </div>

      {añadiendoA && (
        <SelectorProducto
          estancia={añadiendoA}
          capitulos={capitulos}
          subcapitulos={subcapitulos}
          warehouse={warehouse}
          onClose={() => setAñadiendoA(null)}
          onAdded={refrescar}
        />
      )}

      {fichaItem && (
        <ItemFicha
          item={fichaItem}
          estancias={estancias}
          proveedores={proveedores}
          onClose={() => setFichaItem(null)}
          onSaved={refrescar}
        />
      )}
    </div>
  )
}

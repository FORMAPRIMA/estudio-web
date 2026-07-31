'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
  setFavoritos,
  createSubcapitulo,
} from '@/app/actions/warehouse'
import {
  IVA_DEFAULT,
  NIVELES,
  agruparEstructura,
  autoPvp,
  ceilCent,
  conIva,
  etiquetaPrecio,
  formatEur,
  indexarFavoritos,
  nivelMeta,
  nivelesLabel,
  sinIva,
  type Capitulo,
  type Favorito,
  type NivelCalidad,
  type Proveedor,
  type Subcapitulo,
  type WarehouseItem,
  type WarehouseItemInput,
} from '@/lib/memorias/domain'
import VistaToggle, { useVistaModo } from './VistaToggle'
import ModoClienteToggle, { useModoCliente } from './ModoClienteToggle'

const BUCKET = 'warehouse'

interface Props {
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  items: WarehouseItem[]
  favoritos: Favorito[]
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

/** Precio con IVA guardado, o derivado de la base si no se sobrescribió. */
function precioConIva(item: WarehouseItem): number | null {
  return item.precio_pvp_con_iva ?? conIva(item.precio_pvp, item.iva_pct ?? IVA_DEFAULT)
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>
      {msg}
    </div>
  )
}

/** Botón discreto que abre la web del producto. */
function BotonWeb({ url, compacto }: { url: string; compacto?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title="Abrir la web del producto"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: compacto ? '3px 6px' : '4px 10px',
        fontSize: compacto ? 10 : 11, fontWeight: 500,
        border: '1px solid #E8E6E0', borderRadius: 4,
        background: '#fff', color: '#555', textDecoration: 'none', flexShrink: 0,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {!compacto && 'Web'}
    </a>
  )
}

// ── Favorito FP: estrella + selector de niveles ───────────────────────────────

function FavoritoControl({
  item, favoritos, items, compacto,
}: {
  item: WarehouseItem
  favoritos: Favorito[]
  items: WarehouseItem[]
  compacto?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const mios = favoritos.filter(f => f.item_id === item.id).map(f => f.nivel_calidad)
  const indice = useMemo(() => indexarFavoritos(favoritos), [favoritos])

  const cambiar = async (nivel: NivelCalidad, marcar: boolean) => {
    const siguientes = marcar ? [...mios, nivel] : mios.filter(n => n !== nivel)
    setGuardando(true)
    const res = await setFavoritos(item.id, siguientes)
    setGuardando(false)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const todos = async () => {
    setGuardando(true)
    const res = await setFavoritos(item.id, mios.length === item.niveles_calidad.length ? [] : [...item.niveles_calidad])
    setGuardando(false)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setAbierto(a => !a) }}
        title={mios.length > 0 ? `Favorito FP en: ${nivelesLabel(mios)}` : 'Marcar como Favorito FP'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          fontSize: compacto ? 13 : 15, lineHeight: 1,
          color: mios.length > 0 ? '#D8A22F' : '#D5D3CE',
        }}
      >
        {mios.length > 0 ? '★' : '☆'}
      </button>

      {abierto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={e => { e.stopPropagation(); setAbierto(false) }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 24, right: 0, zIndex: 31, width: 234,
              background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
              boxShadow: '0 14px 34px rgba(0,0,0,0.14)', padding: 10,
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#AAA' }}>
              Favorito FP en
            </p>
            {NIVELES.map(n => {
              const cubierto = item.niveles_calidad.includes(n.value)
              const marcado = mios.includes(n.value)
              const dueñoId = indice.get(`${item.subcapitulo_id}|${n.value}`)
              const dueño = dueñoId && dueñoId !== item.id ? items.find(i => i.id === dueñoId) : null
              return (
                <label
                  key={n.value}
                  title={cubierto ? undefined : 'El producto no cubre este nivel'}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 2px',
                    fontSize: 11.5, color: cubierto ? '#444' : '#CCC',
                    cursor: cubierto && !guardando ? 'pointer' : 'not-allowed',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!cubierto || guardando}
                    onChange={e => cambiar(n.value, e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <span style={{ color: cubierto ? n.color : '#CCC', fontWeight: 600 }}>{n.label}</span>
                    {dueño && (
                      <span style={{ display: 'block', fontSize: 10, color: '#BBB', lineHeight: 1.35 }}>
                        ahora: {dueño.nombre.length > 28 ? dueño.nombre.slice(0, 28) + '…' : dueño.nombre}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
            {item.niveles_calidad.length > 1 && (
              <button type="button" onClick={todos} disabled={guardando} style={{ ...S.btnSm(), width: '100%', marginTop: 6 }}>
                {mios.length === item.niveles_calidad.length ? 'Quitar de todos' : 'Todos sus niveles'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
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
  niveles_calidad: NivelCalidad[]
  subcapitulo_id: string | null
  precio_pvp: number | null
  precio_pvp_con_iva: number | null
  iva_pct: number | null
  precio_coste: number | null
  moneda: string
  url_producto: string
  imagen_producto_url: string | null
  imagen_ambiente_url: string | null
  notas_ia: string | null
}

function AnalizadorUrl({ onFicha }: { onFicha: (ficha: FichaIA, candidatas: string[]) => void }) {
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
  initial, capitulos, subcapitulos, proveedores, favoritos, modoCliente, onClose, onSaved,
}: {
  initial: WarehouseItem | null
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  proveedores: Proveedor[]
  favoritos: Favorito[]
  modoCliente: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [subcapituloId,   setSubcapituloId]   = useState(initial?.subcapitulo_id ?? '')
  const [nombre,          setNombre]          = useState(initial?.nombre ?? '')
  const [niveles,         setNiveles]         = useState<NivelCalidad[]>(initial?.niveles_calidad ?? ['select'])
  const [favNiveles,      setFavNiveles]      = useState<NivelCalidad[]>(
    initial ? favoritos.filter(f => f.item_id === initial.id).map(f => f.nivel_calidad) : []
  )
  const [marca,           setMarca]           = useState(initial?.marca ?? '')
  const [modelo,          setModelo]          = useState(initial?.modelo ?? '')
  const [referencia,      setReferencia]      = useState(initial?.referencia ?? '')
  const [descripcion,     setDescripcion]     = useState(initial?.descripcion ?? '')
  const [imagenProducto,  setImagenProducto]  = useState<string | null>(initial?.imagen_principal_url ?? null)
  const [imagenAmbiente,  setImagenAmbiente]  = useState<string | null>(initial?.imagen_lifestyle_url ?? null)
  const [fichaTecnica,    setFichaTecnica]    = useState<string | null>(initial?.ficha_tecnica_url ?? null)
  const [urlProducto,     setUrlProducto]     = useState(initial?.url_producto ?? '')
  const [ivaPct,          setIvaPct]          = useState(String(initial?.iva_pct ?? IVA_DEFAULT))
  const [pvpBase,         setPvpBase]         = useState(initial?.precio_pvp != null ? String(initial.precio_pvp) : '')
  const [pvpIva,          setPvpIva]          = useState(initial ? (precioConIva(initial) != null ? String(precioConIva(initial)) : '') : '')
  const [coste,           setCoste]           = useState(initial?.precio_coste != null ? String(initial.precio_coste) : '')
  const [moneda,          setMoneda]          = useState(initial?.moneda ?? 'EUR')
  const [proveedorId,     setProveedorId]     = useState(initial?.proveedor_preferente_id ?? '')
  const [acabadosTxt,     setAcabadosTxt]     = useState((initial?.acabados ?? []).join(', '))
  const [tagsTxt,         setTagsTxt]         = useState((initial?.tags ?? []).join(', '))

  const [candidatas, setCandidatas] = useState<string[]>([])
  const [importando, setImportando] = useState<string | null>(null)
  const [sugeridos, setSugeridos] = useState<Set<string>>(new Set())
  const [nuevoSub, setNuevoSub] = useState<{ capitulo_id: string; nombre: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estructura = useMemo(() => agruparEstructura(capitulos, subcapitulos), [capitulos, subcapitulos])
  const marcaSugerido = (campo: string) => sugeridos.has(campo) ? { borderColor: '#C7A2F0', background: '#FCFAFF' } : null
  const ivaNum = parseNumero(ivaPct) ?? IVA_DEFAULT

  const toggleNivel = (nivel: NivelCalidad) => {
    setNiveles(prev => {
      const siguiente = prev.includes(nivel) ? prev.filter(n => n !== nivel) : [...prev, nivel]
      if (siguiente.length === 0) return prev  // siempre al menos uno
      setFavNiveles(f => f.filter(n => siguiente.includes(n)))
      return siguiente
    })
  }

  const toggleFavorito = (nivel: NivelCalidad) => {
    setFavNiveles(prev => prev.includes(nivel) ? prev.filter(n => n !== nivel) : [...prev, nivel])
  }

  // El precio con IVA se recalcula al tocar la base y viceversa
  const cambiarBase = (valor: string) => {
    setPvpBase(valor)
    const base = parseNumero(valor)
    setPvpIva(base != null ? String(conIva(base, ivaNum)) : '')
  }
  const cambiarConIva = (valor: string) => {
    setPvpIva(valor)
    const total = parseNumero(valor)
    setPvpBase(total != null ? String(sinIva(total, ivaNum)) : '')
  }
  const cambiarIva = (valor: string) => {
    setIvaPct(valor)
    const base = parseNumero(pvpBase)
    const pct = parseNumero(valor) ?? IVA_DEFAULT
    if (base != null) setPvpIva(String(conIva(base, pct)))
  }

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
    set('coste', ficha.precio_coste != null ? String(ficha.precio_coste) : '', setCoste, ficha.precio_coste == null)
    set('moneda', ficha.moneda ?? 'EUR', setMoneda, !ficha.moneda)
    set('url', ficha.url_producto ?? '', setUrlProducto, !ficha.url_producto)
    if (ficha.niveles_calidad?.length) { setNiveles(ficha.niveles_calidad); tocados.add('niveles') }
    if (ficha.subcapitulo_id) { setSubcapituloId(ficha.subcapitulo_id); tocados.add('subcapitulo') }

    // La web suele dar el precio con IVA: si la IA lo distingue, respetamos su lectura
    const pct = ficha.iva_pct ?? IVA_DEFAULT
    if (ficha.iva_pct != null) { setIvaPct(String(ficha.iva_pct)); tocados.add('iva') }
    if (ficha.precio_pvp_con_iva != null) {
      setPvpIva(String(ficha.precio_pvp_con_iva))
      setPvpBase(String(sinIva(ficha.precio_pvp_con_iva, pct)))
      tocados.add('pvp')
    } else if (ficha.precio_pvp != null) {
      setPvpBase(String(ficha.precio_pvp))
      setPvpIva(String(conIva(ficha.precio_pvp, pct)))
      tocados.add('pvp')
    }

    setSugeridos(tocados)
    setCandidatas(nuevasCandidatas)

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
  const baseNum = parseNumero(pvpBase)
  const margen = baseNum != null && costeNum != null ? ceilCent(baseNum - costeNum) : null
  const margenPct = margen != null && baseNum ? (margen / baseNum) * 100 : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!subcapituloId) { setError('Selecciona el subcapítulo de presupuesto.'); return }
    if (niveles.length === 0) { setError('Marca al menos un nivel de calidad.'); return }
    setSaving(true); setError(null)

    const payload: WarehouseItemInput = {
      subcapitulo_id: subcapituloId,
      nombre: nombre.trim(),
      niveles_calidad: niveles,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      referencia: referencia.trim() || null,
      descripcion: descripcion.trim() || null,
      imagen_principal_url: imagenProducto,
      imagen_lifestyle_url: imagenAmbiente,
      ficha_tecnica_url: fichaTecnica,
      url_producto: urlProducto.trim() || null,
      precio_pvp: baseNum,
      precio_pvp_con_iva: parseNumero(pvpIva),
      iva_pct: ivaNum,
      precio_coste: costeNum,
      moneda: moneda.trim().toUpperCase() || 'EUR',
      proveedor_preferente_id: proveedorId || null,
      acabados: acabadosTxt.split(',').map(s => s.trim()).filter(Boolean),
      tags: tagsTxt.split(',').map(s => s.trim()).filter(Boolean),
    }

    const res = initial
      ? await updateWarehouseItem(initial.id, payload)
      : await createWarehouseItem(payload)

    if ('error' in res) { setSaving(false); setError(res.error); return }

    // Favoritos: se guardan aparte porque viven en su propia tabla
    const itemId = initial ? initial.id : (res as { id: string }).id
    const previos = initial ? favoritos.filter(f => f.item_id === initial.id).map(f => f.nivel_calidad) : []
    const cambiaron =
      favNiveles.length !== previos.length || favNiveles.some(n => !previos.includes(n))
    if (cambiaron) {
      const favRes = await setFavoritos(itemId, favNiveles)
      if ('error' in favRes) { setSaving(false); setError(favRes.error); return }
    }

    setSaving(false)
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

            {/* Subcapítulo */}
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

            {/* Niveles de calidad (multi) + favorito por nivel */}
            <div style={{ background: '#FAFAF8', border: `1px solid ${marcaSugerido('niveles') ? '#C7A2F0' : '#EAE8E3'}`, borderRadius: 8, padding: 12 }}>
              <label style={S.label}>Niveles de calidad en los que encaja *</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {NIVELES.map(n => {
                  const activo = niveles.includes(n.value)
                  return (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => toggleNivel(n.value)}
                      style={{
                        padding: '6px 13px', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.03em',
                        border: `1px solid ${activo ? n.color : '#E0DED8'}`, borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                        background: activo ? n.color : '#fff', color: activo ? '#fff' : '#999',
                      }}
                    >
                      {activo ? '✓ ' : ''}{n.label}
                    </button>
                  )
                })}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#AAA', lineHeight: 1.5 }}>
                El mismo producto puede servir para varios niveles. Aparecerá en el catálogo de cada uno de ellos.
              </p>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #EAE8E3' }}>
                <label style={S.label}>Favorito FP de este subcapítulo en…</label>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {niveles.length === 0 ? (
                    <span style={{ fontSize: 11, color: '#CCC' }}>Marca antes un nivel de calidad</span>
                  ) : (
                    NIVELES.filter(n => niveles.includes(n.value)).map(n => (
                      <label key={n.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#555', cursor: 'pointer' }}>
                        <input type="checkbox" checked={favNiveles.includes(n.value)} onChange={() => toggleFavorito(n.value)} />
                        <span style={{ color: n.color, fontWeight: 600 }}>{n.label}</span>
                      </label>
                    ))
                  )}
                  {niveles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFavNiveles(favNiveles.length === niveles.length ? [] : [...niveles])}
                      style={S.btnSm()}
                    >
                      {favNiveles.length === niveles.length ? 'Ninguno' : 'Todos'}
                    </button>
                  )}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#AAA', lineHeight: 1.5 }}>
                  El favorito es lo que sale en la memoria de anteproyecto. Solo puede haber uno por nivel:
                  si ese nivel ya tenía otro producto, se sustituye.
                </p>
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
            <div style={{ background: '#FAFAF8', border: '1px solid #EAE8E3', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 74px 74px', gap: 12 }}>
                <div>
                  <label style={S.label}>{etiquetaPrecio(modoCliente)} sin IVA</label>
                  <input value={pvpBase} onChange={e => cambiarBase(e.target.value)} placeholder="480,00" style={{ ...S.input, ...(marcaSugerido('pvp') ?? {}) }} />
                </div>
                <div>
                  <label style={S.label}>{etiquetaPrecio(modoCliente)} con IVA</label>
                  <input value={pvpIva} onChange={e => cambiarConIva(e.target.value)} placeholder="580,80" style={{ ...S.input, ...(marcaSugerido('pvp') ?? {}) }} />
                </div>
                <div>
                  <label style={S.label}>IVA %</label>
                  <input value={ivaPct} onChange={e => cambiarIva(e.target.value)} style={{ ...S.input, ...(marcaSugerido('iva') ?? {}) }} />
                </div>
                <div>
                  <label style={S.label}>Moneda</label>
                  <input value={moneda} onChange={e => setMoneda(e.target.value)} maxLength={3} style={S.input} />
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#AAA', lineHeight: 1.5 }}>
                Los dos precios están enlazados: al escribir uno se recalcula el otro con el IVA indicado.
                Si la web da un precio redondo con IVA, escríbelo ahí y la base se ajusta sola.
              </p>

              {!modoCliente && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #EAE8E3', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={S.label}>Coste nuestro, sin IVA</label>
                    <input
                      value={coste}
                      onChange={e => setCoste(e.target.value)}
                      onBlur={() => {
                        const c = parseNumero(coste)
                        if (c != null && !pvpBase.trim()) cambiarBase(String(autoPvp(c)))
                      }}
                      placeholder="413,79"
                      style={{ ...S.input, ...(marcaSugerido('coste') ?? {}) }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: margen == null ? '#BBB' : margen >= 0 ? '#1D9E75' : '#DC2626', lineHeight: 1.5 }}>
                    {margen == null
                      ? 'Al rellenar el coste se calcula el margen. Con el PVP vacío se deriva con el 16%.'
                      : `Margen unitario ${formatEur(margen)}${margenPct != null ? ` · ${margenPct.toFixed(1)}%` : ''}`}
                  </p>
                </div>
              )}
            </div>

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
  item, items, favoritos, modoCliente, onEdit, onDelete,
}: {
  item: WarehouseItem
  items: WarehouseItem[]
  favoritos: Favorito[]
  modoCliente: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const subtitulo = [item.marca, item.modelo].filter(Boolean).join(' · ')
  const esFavorito = favoritos.some(f => f.item_id === item.id)
  const conIvaVal = precioConIva(item)

  return (
    <div style={{ background: '#fff', border: `1px solid ${esFavorito ? '#F0D89B' : '#E8E6E0'}`, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#F8F7F4' }}>
        {item.imagen_principal_url ? (
          <img src={item.imagen_principal_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CCC', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Sin imagen
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: '75%' }}>
          {NIVELES.filter(n => item.niveles_calidad.includes(n.value)).map(n => (
            <span key={n.value} style={{ padding: '3px 7px', fontSize: 8.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', background: n.color, color: '#fff', borderRadius: 3 }}>
              {n.label}
            </span>
          ))}
        </div>
        <div style={{ position: 'absolute', top: 4, right: 6 }}>
          <FavoritoControl item={item} favoritos={favoritos} items={items} />
        </div>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{item.nombre}</div>
        {subtitulo && <div style={{ fontSize: 11, color: '#888' }}>{subtitulo}</div>}
        <div style={{ marginTop: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
            {formatEur(item.precio_pvp, 0)} <span style={{ fontSize: 9.5, fontWeight: 400, color: '#AAA' }}>sin IVA</span>
          </div>
          {conIvaVal != null && (
            <div style={{ fontSize: 11, color: '#777' }}>
              {formatEur(conIvaVal, 0)} <span style={{ fontSize: 9.5, color: '#BBB' }}>con IVA</span>
            </div>
          )}
          {!modoCliente && item.precio_coste != null && (
            <div style={{ fontSize: 10.5, color: '#AAA', marginTop: 1 }}>coste {formatEur(item.precio_coste, 0)}</div>
          )}
        </div>
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EEE8', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {item.url_producto && <BotonWeb url={item.url_producto} />}
        <button onClick={onEdit} style={S.btnSm()}>Editar</button>
        {!modoCliente && <button onClick={onDelete} style={S.btnSm('#DC2626')}>Eliminar</button>}
      </div>
    </div>
  )
}

// ── Vista listado desplegable ─────────────────────────────────────────────────

function ItemRow({
  item, items, favoritos, proveedores, modoCliente, onEdit, onDelete,
}: {
  item: WarehouseItem
  items: WarehouseItem[]
  favoritos: Favorito[]
  proveedores: Proveedor[]
  modoCliente: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const proveedor = proveedores.find(p => p.id === item.proveedor_preferente_id)
  const margen = item.precio_pvp != null && item.precio_coste != null ? ceilCent(item.precio_pvp - item.precio_coste) : null
  const esFavorito = favoritos.some(f => f.item_id === item.id)
  const conIvaVal = precioConIva(item)

  return (
    <div style={{ borderBottom: '1px solid #F0EEE8', background: esFavorito ? '#FFFDF6' : '#fff' }}>
      <div
        onClick={() => setAbierto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 10, color: '#CCC', width: 10, flexShrink: 0 }}>{abierto ? '▾' : '▸'}</span>

        <div style={{ width: 34, height: 26, borderRadius: 3, background: '#F8F7F4', overflow: 'hidden', flexShrink: 0 }}>
          {item.imagen_principal_url && <img src={item.imagen_principal_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>

        <FavoritoControl item={item} favoritos={favoritos} items={items} compacto />

        <div style={{ flex: 2, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
          {(item.marca || item.modelo) && (
            <div style={{ fontSize: 10.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[item.marca, item.modelo].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 3, flexShrink: 0, width: 108, flexWrap: 'wrap' }}>
          {NIVELES.filter(n => item.niveles_calidad.includes(n.value)).map(n => (
            <span key={n.value} title={n.label} style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 5px', borderRadius: 3, background: n.bg, color: n.color }}>
              {n.label.slice(0, 4)}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: '#AAA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
          {proveedor?.nombre ?? ''}
        </div>

        <div style={{ width: 82, textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1A1A1A' }}>{formatEur(item.precio_pvp, 0)}</div>
          <div style={{ fontSize: 9.5, color: '#BBB' }}>sin IVA</div>
        </div>
        <div style={{ width: 82, textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, color: '#666' }}>{formatEur(conIvaVal, 0)}</div>
          <div style={{ fontSize: 9.5, color: '#BBB' }}>con IVA</div>
        </div>

        {!modoCliente && (
          <>
            <div style={{ width: 74, textAlign: 'right', flexShrink: 0, fontSize: 11, color: '#AAA' }}>
              {item.precio_coste != null ? formatEur(item.precio_coste, 0) : '—'}
            </div>
            <div style={{ width: 68, textAlign: 'right', flexShrink: 0, fontSize: 11, color: margen == null ? '#DDD' : margen >= 0 ? '#1D9E75' : '#DC2626' }}>
              {margen != null ? formatEur(margen, 0) : '—'}
            </div>
          </>
        )}

        <div style={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          {item.url_producto && <BotonWeb url={item.url_producto} compacto />}
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
              <span>{nivelesLabel(item.niveles_calidad)}</span>
              {item.acabados.length > 0 && <span>Acabados: {item.acabados.join(', ')}</span>}
              {item.tags.length > 0 && <span>Tags: {item.tags.join(', ')}</span>}
              {item.ficha_tecnica_url && <a href={item.ficha_tecnica_url} target="_blank" rel="noreferrer" style={{ color: '#378ADD' }}>Ficha técnica</a>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {item.url_producto && <BotonWeb url={item.url_producto} />}
              <button onClick={onEdit} style={S.btnSm()}>Editar</button>
              {!modoCliente && <button onClick={onDelete} style={S.btnSm('#DC2626')}>Eliminar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function WarehousePage({ capitulos, subcapitulos, items, favoritos, proveedores, migracionPendiente }: Props) {
  const router = useRouter()
  const [vista, setVista] = useVistaModo('cards')
  const [modoCliente, setModoCliente] = useModoCliente()
  const [filterNivel, setFilterNivel] = useState<NivelCalidad | 'all'>('all')
  const [filterCapitulo, setFilterCapitulo] = useState<string>('all')
  const [soloFavoritos, setSoloFavoritos] = useState(false)
  const [mostrarVacios, setMostrarVacios] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [editing, setEditing] = useState<WarehouseItem | null>(null)
  const [creating, setCreating] = useState(false)

  const estructura = useMemo(() => agruparEstructura(capitulos, subcapitulos), [capitulos, subcapitulos])
  const idsFavoritos = useMemo(() => new Set(favoritos.map(f => f.item_id)), [favoritos])

  const filtrados = useMemo(() => {
    const texto = filterText.trim().toLowerCase()
    return items.filter(it => {
      if (filterNivel !== 'all' && !it.niveles_calidad.includes(filterNivel)) return false
      if (soloFavoritos && !idsFavoritos.has(it.id)) return false
      if (!texto) return true
      const heno = [it.nombre, it.marca, it.modelo, it.referencia, it.descripcion, ...(it.tags ?? [])]
        .filter(Boolean).join(' ').toLowerCase()
      return heno.includes(texto)
    })
  }, [items, filterNivel, filterText, soloFavoritos, idsFavoritos])

  const porSubcapitulo = useMemo(() => {
    const map = new Map<string, WarehouseItem[]>()
    for (const it of filtrados) {
      if (!map.has(it.subcapitulo_id)) map.set(it.subcapitulo_id, [])
      map.get(it.subcapitulo_id)!.push(it)
    }
    map.forEach(lista => {
      lista.sort((a, b) =>
        Number(idsFavoritos.has(b.id)) - Number(idsFavoritos.has(a.id)) ||
        (a.marca ?? '').localeCompare(b.marca ?? '') ||
        a.nombre.localeCompare(b.nombre)
      )
    })
    return map
  }, [filtrados, idsFavoritos])

  // Huecos de favoritos por subcapítulo × nivel
  const favoritosPorSub = useMemo(() => {
    const map = new Map<string, Set<NivelCalidad>>()
    for (const f of favoritos) {
      if (!map.has(f.subcapitulo_id)) map.set(f.subcapitulo_id, new Set())
      map.get(f.subcapitulo_id)!.add(f.nivel_calidad)
    }
    return map
  }, [favoritos])

  const handleSaved = () => { setEditing(null); setCreating(false); router.refresh() }

  const handleDelete = async (item: WarehouseItem) => {
    if (!confirm(`¿Eliminar "${item.nombre}" del warehouse?`)) return
    const res = await deleteWarehouseItem(item.id)
    if ('error' in res) { alert(res.error); return }
    router.refresh()
  }

  const huecos = subcapitulos.length * NIVELES.length - favoritos.length
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
            Un producto puede valer para varios niveles, y la estrella marca en cuáles es el <strong>Favorito FP</strong>
            {' '}que sale en la memoria de anteproyecto.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ModoClienteToggle modoCliente={modoCliente} onChange={setModoCliente} />
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
          style={{ ...S.input, maxWidth: 300 }}
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
          {filtrados.length} de {items.length} productos · {favoritos.length} favoritos ({huecos} huecos)
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
              const favs = favoritosPorSub.get(sub.id) ?? new Set<NivelCalidad>()

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
                            items={items}
                            favoritos={favoritos}
                            modoCliente={modoCliente}
                            onEdit={() => setEditing(it)}
                            onDelete={() => handleDelete(it)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', background: '#FAFAF8', borderBottom: '1px solid #E8E6E0', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#BBB' }}>
                          <span style={{ width: 10, flexShrink: 0 }} />
                          <span style={{ width: 34, flexShrink: 0 }} />
                          <span style={{ width: 19, flexShrink: 0 }} />
                          <span style={{ flex: 2 }}>Producto</span>
                          <span style={{ width: 108, flexShrink: 0 }}>Niveles</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>Proveedor</span>
                          <span style={{ width: 82, textAlign: 'right', flexShrink: 0 }}>{etiquetaPrecio(modoCliente)}</span>
                          <span style={{ width: 82, textAlign: 'right', flexShrink: 0 }}>Con IVA</span>
                          {!modoCliente && <span style={{ width: 74, textAlign: 'right', flexShrink: 0 }}>Coste</span>}
                          {!modoCliente && <span style={{ width: 68, textAlign: 'right', flexShrink: 0 }}>Margen</span>}
                          <span style={{ width: 34, flexShrink: 0 }} />
                        </div>
                        {subItems.map(it => (
                          <ItemRow
                            key={it.id}
                            item={it}
                            items={items}
                            favoritos={favoritos}
                            proveedores={proveedores}
                            modoCliente={modoCliente}
                            onEdit={() => setEditing(it)}
                            onDelete={() => handleDelete(it)}
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
          favoritos={favoritos}
          modoCliente={modoCliente}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

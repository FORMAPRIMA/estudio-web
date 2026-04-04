'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createProyecto, getProyectoImageUploadToken } from '@/app/actions/proyectos'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { CatalogoFase, UserProfile } from '@/lib/types'

interface Props {
  catalogoFases: CatalogoFase[]
  clientes: { id: string; nombre: string; apellidos: string | null; empresa: string | null }[]
  teamMembers: UserProfile[]
  currentUserId: string
  onCreated: () => void
  onClose: () => void
}

interface FormState {
  nombre: string
  codigo: string
  direccion: string
  superficie_diseno: string
  superficie_catastral: string
  superficie_util: string
  cliente_ids: string[]
  es_diseno: boolean
}

// ── ClientesMultiSelect ───────────────────────────────────────────────────────

type ClienteOpt = { id: string; nombre: string; apellidos: string | null; empresa: string | null }

function clienteLabel(c: ClienteOpt) {
  const name = [c.nombre, c.apellidos].filter(Boolean).join(' ')
  return c.empresa ? `${name} — ${c.empresa}` : name
}

function ClientesMultiSelect({
  clientes,
  selected,
  onChange,
}: {
  clientes: ClienteOpt[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const containerRef      = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  const selectedClientes = selected
    .map(id => clientes.find(c => c.id === id))
    .filter(Boolean) as ClienteOpt[]

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return clientes.filter(c => {
      if (selected.includes(c.id)) return false
      if (!q) return true
      return [c.nombre, c.apellidos, c.empresa].some(v => v?.toLowerCase().includes(q))
    })
  }, [query, clientes, selected])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAdd = (id: string) => {
    onChange([...selected, id])
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleRemove = (id: string) => {
    onChange(selected.filter(s => s !== id))
  }

  return (
    <div ref={containerRef}>
      {/* Selected clients as tags */}
      {selectedClientes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedClientes.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5 bg-ink text-white pl-2 pr-1 py-1" style={{ borderRadius: 3 }}>
              {i === 0 && (
                <span className="text-[8px] tracking-widest uppercase font-semibold" style={{ color: '#D85A30' }}>
                  Titular
                </span>
              )}
              <span className="text-[11px] font-light">{clienteLabel(c)}</span>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                className="text-white/40 hover:text-white/90 transition-colors ml-0.5 text-sm leading-none"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add client trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
          className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-left flex items-center justify-between gap-2 bg-white hover:border-ink/40 focus:outline-none focus:border-ink/40 transition-colors"
        >
          <span className="text-ink/30">
            {selected.length === 0 ? 'Añadir después' : '+ Añadir otro cliente'}
          </span>
          <span className="text-meta/50 shrink-0 text-xs">▾</span>
        </button>

        {open && (
          <div
            className="absolute left-0 right-0 top-full mt-0.5 z-50 bg-white border border-ink/20 shadow-xl"
            style={{ maxHeight: 240, display: 'flex', flexDirection: 'column' }}
          >
            <div className="px-3 py-2.5 border-b border-ink/8 shrink-0">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && (setOpen(false), setQuery(''))}
                placeholder="Buscar por nombre o empresa…"
                className="w-full text-sm font-light text-ink bg-transparent outline-none placeholder:text-ink/25"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-ink/25 font-light italic">
                  {clientes.length === selected.length ? 'No hay más clientes disponibles' : 'Sin resultados'}
                </p>
              ) : (
                filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleAdd(c.id)}
                    className="w-full text-left px-3 py-2.5 transition-colors flex items-baseline gap-2 hover:bg-ink/4 text-ink/80 hover:text-ink"
                  >
                    <span className="text-[12px] font-light">
                      {[c.nombre, c.apellidos].filter(Boolean).join(' ')}
                    </span>
                    {c.empresa && (
                      <span className="text-[10px] text-meta/70 font-light truncate">{c.empresa}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ResponsablesDropdown ──────────────────────────────────────────────────────

function ResponsablesDropdown({
  teamMembers,
  selected,
  onChange,
}: {
  teamMembers: UserProfile[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const label =
    selected.length === 0
      ? 'Sin asignar'
      : teamMembers
          .filter(m => selected.includes(m.id))
          .map(m => m.nombre.split(' ')[0])
          .join(', ')

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[11px] font-light text-ink/70 border border-ink/15 px-3 py-1.5 hover:border-ink/40 transition-colors min-w-[160px] text-left flex items-center justify-between gap-2"
      >
        <span className="truncate">{label}</span>
        <span className="text-meta shrink-0">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-ink/15 shadow-lg min-w-[200px] max-h-48 overflow-y-auto">
            {teamMembers.map(m => (
              <label
                key={m.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-cream cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={e => {
                    if (e.target.checked) onChange([...selected, m.id])
                    else onChange(selected.filter(id => id !== m.id))
                  }}
                  className="shrink-0"
                />
                <div>
                  <p className="text-[11px] font-light text-ink">{m.nombre}</p>
                  <p className="text-[9px] text-meta uppercase tracking-widest">{m.rol.replace('fp_', '')}</p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function ProyectoModal({
  catalogoFases,
  clientes,
  teamMembers,
  currentUserId,
  onCreated,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    nombre: '',
    codigo: '',
    direccion: '',
    superficie_diseno: '',
    superficie_catastral: '',
    superficie_util: '',
    cliente_ids: [],
    es_diseno: true,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFases, setSelectedFases] = useState<string[]>([])
  const [fasesResponsables, setFasesResponsables] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const toggleFase = (faseId: string) => {
    setSelectedFases(prev => {
      if (prev.includes(faseId)) {
        const next = prev.filter(id => id !== faseId)
        setFasesResponsables(r => {
          const copy = { ...r }
          delete copy[faseId]
          return copy
        })
        return next
      }
      return [...prev, faseId]
    })
  }

  const setResponsables = (faseId: string, ids: string[]) => {
    setFasesResponsables(prev => ({ ...prev, [faseId]: ids }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre del proyecto es obligatorio.'); return }
    if (!form.codigo.trim()) { setError('El código del proyecto es obligatorio.'); return }
    if (selectedFases.length === 0) { setError('Selecciona al menos una fase.'); return }

    setLoading(true)
    setError(null)

    try {
      // 1. Upload image: server generates a signed token, client uploads directly
      //    via supabase.storage.uploadToSignedUrl — handles CORS correctly.
      let imagen_url: string | null = null
      if (imageFile) {
        const tokenResult = await getProyectoImageUploadToken(imageFile.name)
        if ('error' in tokenResult) throw new Error(tokenResult.error)
        const supabaseBrowser = createBrowserClient()
        const { error: uploadError } = await supabaseBrowser.storage
          .from('proyecto-imagenes')
          .uploadToSignedUrl(tokenResult.path, tokenResult.token, imageFile, { upsert: true })
        if (uploadError) throw new Error(uploadError.message)
        imagen_url = tokenResult.publicUrl
      }

      // 2. All DB operations via Server Action (uses server session — bypasses client auth issues)
      const fasesOrdenadas = catalogoFases.filter(f => selectedFases.includes(f.id))
      const result = await createProyecto({
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim().toUpperCase(),
        direccion: form.direccion.trim(),
        imagen_url,
        superficie_diseno: form.es_diseno && form.superficie_diseno ? Number(form.superficie_diseno) : null,
        superficie_catastral: form.es_diseno && form.superficie_catastral ? Number(form.superficie_catastral) : null,
        superficie_util: form.es_diseno && form.superficie_util ? Number(form.superficie_util) : null,
        cliente_ids: form.cliente_ids,
        selectedFases: fasesOrdenadas.map(f => ({ id: f.id, numero: f.numero })),
        fasesResponsables,
      })

      if (result.error) throw new Error(result.error)

      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el proyecto.')
    } finally {
      setLoading(false)
    }
  }

  const selectedFasesData = catalogoFases.filter(f => selectedFases.includes(f.id))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 px-4 pb-10">
      <div className="bg-cream w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-ink/15 shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-ink/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-1">Nuevo</p>
            <h2 className="text-xl font-light text-ink tracking-tight">Agregar proyecto</h2>
          </div>
          <button
            onClick={onClose}
            className="text-meta hover:text-ink transition-colors text-xl font-light w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-7">
          {/* Image upload */}
          <div>
            <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-3">
              Imagen de referencia
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-ink/20 hover:border-ink/40 transition-colors cursor-pointer flex items-center justify-center"
              style={{ height: imagePreview ? 'auto' : 120 }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-full max-h-48 object-cover" />
              ) : (
                <p className="text-[11px] text-meta font-light">Haz clic para subir imagen</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Basic fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
                  Nombre del proyecto *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors"
                  placeholder="Casa Reforma"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
                  Código *
                </label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) }))}
                  className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors font-mono tracking-widest"
                  placeholder="CASA1"
                  maxLength={5}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
                Dirección
              </label>
              <input
                type="text"
                value={form.direccion}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors"
                placeholder="Av. Reforma 123, CDMX"
              />
            </div>

            {/* Tipo de proyecto */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!form.es_diseno}
                onChange={e => setForm(f => ({ ...f, es_diseno: !e.target.checked }))}
                className="shrink-0"
              />
              <span className="text-[11px] font-light text-ink">No es un proyecto de diseño</span>
              <span className="text-[10px] text-meta/50">(marketing, networking, etc.)</span>
            </label>

            {form.es_diseno && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'superficie_diseno' as const, label: 'Diseño (m²)' },
                  { key: 'superficie_catastral' as const, label: 'Catastral (m²)' },
                  { key: 'superficie_util' as const, label: 'Útil (m²)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
                      {label}
                    </label>
                    <input
                      type="number"
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-ink/15 px-3 py-2 text-sm font-light text-ink bg-white focus:outline-none focus:border-ink/40 transition-colors"
                      placeholder="0"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-[10px] tracking-widest uppercase font-light text-meta mb-1.5">
                Clientes
              </label>
              <ClientesMultiSelect
                clientes={clientes}
                selected={form.cliente_ids}
                onChange={ids => setForm(f => ({ ...f, cliente_ids: ids }))}
              />
            </div>
          </div>

          {/* Fases selection — grouped by section */}
          <div>
            <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-3">
              Fases contratadas *
            </p>
            {(() => {
              const SECTION_ORDER = ['Anteproyecto', 'Proyecto de ejecución', 'Obra', 'Interiorismo', 'Post venta']
              const grouped = SECTION_ORDER.map(sec => ({
                seccion: sec,
                fases: catalogoFases.filter(f => f.seccion === sec).sort((a, b) => a.orden - b.orden),
              })).filter(g => g.fases.length > 0)

              return (
                <div className="space-y-3">
                  {grouped.map(group => (
                    <div key={group.seccion}>
                      <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 px-1 mb-1">
                        {group.seccion}
                      </p>
                      <div className="grid grid-cols-2 gap-0.5">
                        {group.fases.map(fase => (
                          <label
                            key={fase.id}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-ink/5 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFases.includes(fase.id)}
                              onChange={() => toggleFase(fase.id)}
                              className="shrink-0"
                            />
                            <span className="text-[11px] font-light text-ink">
                              <span className="text-meta/60 mr-1 text-[10px]">F{fase.numero}</span>
                              {fase.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Responsables per fase */}
          {selectedFasesData.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-3">
                Responsables por fase
              </p>
              <div className="border border-ink/10">
                {selectedFasesData.map((fase, i) => (
                  <div
                    key={fase.id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i < selectedFasesData.length - 1 ? 'border-b border-ink/8' : ''
                    }`}
                  >
                    <div>
                      <span className="text-[10px] text-meta font-light tracking-widest uppercase mr-2">
                        F{fase.numero}
                      </span>
                      <span className="text-[11px] font-light text-ink">{fase.label}</span>
                    </div>
                    <ResponsablesDropdown
                      teamMembers={teamMembers}
                      selected={fasesResponsables[fase.id] ?? []}
                      onChange={ids => setResponsables(fase.id, ids)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-600 font-light">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-2 border-t border-ink/10">
            <button
              type="button"
              onClick={onClose}
              className="text-[10px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-[10px] tracking-widest uppercase font-light px-5 py-2.5 bg-ink text-cream hover:bg-ink/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Guardar proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

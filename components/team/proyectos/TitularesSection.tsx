'use client'

import { useState } from 'react'
import {
  addProyectoCliente,
  removeProyectoCliente,
  updateProyectoClienteRol,
} from '@/app/actions/proyectos'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Titular {
  cliente_id: string
  rol: string
  clientes: {
    nombre:    string
    apellidos: string | null
    empresa:   string | null
  }
}

export interface ClienteOption {
  id:        string
  nombre:    string
  apellidos: string | null
  empresa:   string | null
}

interface Props {
  proyectoId: string
  titulares:  Titular[]
  clientes:   ClienteOption[]
  canEdit:    boolean
}

// ── Config ────────────────────────────────────────────────────────────────────

const ROLES = [
  { key: 'titular',       label: 'Titular'       },
  { key: 'cotitular',     label: 'Cotitular'      },
  { key: 'socio',         label: 'Socio/a'        },
  { key: 'representante', label: 'Representante'  },
]

const ROL_COLOR: Record<string, string> = {
  titular:       '#D85A30',
  cotitular:     '#378ADD',
  socio:         '#1D9E75',
  representante: '#888888',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(c: { nombre: string; apellidos: string | null; empresa: string | null }) {
  const full = [c.nombre, c.apellidos].filter(Boolean).join(' ')
  return c.empresa ? `${full} — ${c.empresa}` : full
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TitularesSection({ proyectoId, titulares: initial, clientes, canEdit }: Props) {
  const [titulares,         setTitulares]         = useState<Titular[]>(initial)
  const [showAdd,           setShowAdd]           = useState(false)
  const [search,            setSearch]            = useState('')
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [selectedRol,       setSelectedRol]       = useState('titular')
  const [adding,            setAdding]            = useState(false)

  const existingIds = new Set(titulares.map(t => t.cliente_id))

  const matchingClientes = clientes.filter(c => {
    if (existingIds.has(c.id)) return false
    const q = search.toLowerCase().trim()
    if (!q) return false
    return [c.nombre, c.apellidos, c.empresa].some(v => v?.toLowerCase().includes(q))
  })

  const handleAdd = async () => {
    if (!selectedClienteId || adding) return
    setAdding(true)
    const result = await addProyectoCliente(proyectoId, selectedClienteId, selectedRol)
    setAdding(false)
    if ('error' in result) return
    const client = clientes.find(c => c.id === selectedClienteId)!
    setTitulares(prev => [
      ...prev,
      { cliente_id: selectedClienteId, rol: selectedRol, clientes: { nombre: client.nombre, apellidos: client.apellidos, empresa: client.empresa } },
    ])
    setShowAdd(false)
    setSearch('')
    setSelectedClienteId('')
    setSelectedRol('titular')
  }

  const handleRemove = async (clienteId: string) => {
    setTitulares(prev => prev.filter(t => t.cliente_id !== clienteId))
    await removeProyectoCliente(proyectoId, clienteId)
  }

  const handleRolChange = async (clienteId: string, rol: string) => {
    setTitulares(prev => prev.map(t => t.cliente_id === clienteId ? { ...t, rol } : t))
    await updateProyectoClienteRol(proyectoId, clienteId, rol)
  }

  return (
    <div>
      <p className="text-[9px] tracking-widest uppercase font-light text-meta mb-2.5">
        Titulares
      </p>

      {/* Titular list */}
      <div className="space-y-2 mb-3">
        {titulares.length === 0 && (
          <p className="text-xs font-light text-ink/30 italic">Sin titulares asignados</p>
        )}

        {titulares.map(t => {
          const color = ROL_COLOR[t.rol] ?? '#888'
          return (
            <div key={t.cliente_id} className="flex items-center gap-2 group">
              {/* Color dot */}
              <span
                className="shrink-0 w-[6px] h-[6px] rounded-full mt-px"
                style={{ background: color }}
              />

              {/* Name */}
              <span className="flex-1 min-w-0 text-sm font-light text-ink truncate">
                {displayName(t.clientes)}
              </span>

              {/* Role */}
              {canEdit ? (
                <select
                  value={t.rol}
                  onChange={e => handleRolChange(t.cliente_id, e.target.value)}
                  className="shrink-0 text-[9px] tracking-widest uppercase font-medium bg-transparent border-0 cursor-pointer focus:outline-none appearance-none"
                  style={{ color }}
                >
                  {ROLES.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <span
                  className="shrink-0 text-[9px] tracking-widest uppercase font-medium"
                  style={{ color }}
                >
                  {ROLES.find(r => r.key === t.rol)?.label ?? t.rol}
                </span>
              )}

              {/* Remove */}
              {canEdit && (
                <button
                  onClick={() => handleRemove(t.cliente_id)}
                  title="Quitar"
                  className="shrink-0 text-base leading-none text-ink/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add button */}
      {canEdit && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-[9px] tracking-widest uppercase font-medium text-ink/35 hover:text-ink/65 transition-colors"
        >
          <span className="text-[13px] leading-none">+</span>
          Añadir titular
        </button>
      )}

      {/* Add panel */}
      {canEdit && showAdd && (
        <div className="mt-1 p-3 border border-ink/10 bg-cream/50 space-y-2">
          {/* Search input */}
          <input
            autoFocus
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedClienteId('') }}
            placeholder="Buscar cliente por nombre, empresa…"
            className="w-full text-xs font-light text-ink border border-ink/15 px-2.5 py-1.5 bg-white focus:outline-none focus:border-ink/40 transition-colors"
          />

          {/* Results dropdown */}
          {search.trim() && matchingClientes.length > 0 && (
            <div className="border border-ink/10 bg-white max-h-36 overflow-y-auto">
              {matchingClientes.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedClienteId(c.id); setSearch(displayName(c)) }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-light transition-colors ${
                    selectedClienteId === c.id
                      ? 'bg-ink/8 text-ink'
                      : 'text-ink/80 hover:bg-ink/5'
                  }`}
                >
                  {displayName(c)}
                </button>
              ))}
            </div>
          )}
          {search.trim() && matchingClientes.length === 0 && !selectedClienteId && (
            <p className="text-[10px] text-ink/30 italic">Sin resultados</p>
          )}

          {/* Role selector — only shown once a client is picked */}
          {selectedClienteId && (
            <div className="flex items-center gap-3">
              <span className="text-[9px] tracking-widest uppercase text-meta shrink-0">Rol</span>
              <div className="flex gap-1.5 flex-wrap">
                {ROLES.map(r => {
                  const active = selectedRol === r.key
                  const color  = ROL_COLOR[r.key]
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setSelectedRol(r.key)}
                      className="text-[8px] tracking-widest uppercase font-medium px-2 py-1 border transition-all"
                      style={{
                        borderColor: active ? color : 'rgba(0,0,0,0.1)',
                        color:       active ? color : 'rgba(0,0,0,0.35)',
                        background:  active ? `${color}10` : 'transparent',
                      }}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setSearch(''); setSelectedClienteId(''); setSelectedRol('titular') }}
              className="text-[9px] tracking-widest uppercase font-light text-ink/40 hover:text-ink/70 transition-colors px-2 py-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedClienteId || adding}
              className="text-[9px] tracking-widest uppercase font-medium text-white bg-ink px-3 py-1.5 hover:bg-ink/80 transition-colors disabled:opacity-30"
            >
              {adding ? 'Añadiendo…' : 'Añadir'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  ESTADOS,
  VISIBILIDADES,
  aplicaFiltros,
  estadoColor,
  estadoLabel,
  fmtFecha,
  hayFiltrosActivos,
  oficioColor,
  oficioLabel,
  visibilidadIcon,
} from '@/lib/repasos/domain'
import type { Repaso, RepasoEstado, RepasoFiltros, RepasoVisibilidad } from '@/lib/repasos/domain'

// ─── Barra de filtros ─────────────────────────────────────────────────────────

interface FiltrosProps {
  repasos: Repaso[]
  filtros: RepasoFiltros
  setFiltros: (f: RepasoFiltros) => void
  modo: 'interno' | 'presentacion'
}

export function RepasosFiltros({ repasos, filtros, setFiltros, modo }: FiltrosProps) {
  // Solo ofrecemos los oficios que existen de verdad en este proyecto.
  const oficiosPresentes = useMemo(() => {
    const counts = new Map<string, number>()
    repasos.forEach((r) => counts.set(r.oficio, (counts.get(r.oficio) ?? 0) + 1))
    return Array.from(counts.entries())
      .map(([id, n]) => ({ id, n, label: oficioLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [repasos])

  const countEstado = (e: RepasoEstado) => repasos.filter((r) => r.estado === e).length
  const countVis = (v: RepasoVisibilidad) => repasos.filter((r) => r.visibilidad === v).length

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EEE8', background: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
        <input
          className="rp-input"
          placeholder="Buscar repaso, oficio, responsable…"
          value={filtros.texto}
          onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
          style={{ padding: '8px 10px', fontSize: 12.5 }}
        />
        {hayFiltrosActivos(filtros) && (
          <button
            className="rp-btn rp-btn-ghost"
            onClick={() => setFiltros({ estados: [], oficios: [], visibilidades: [], texto: '' })}
            style={{ padding: '8px 11px', fontSize: 11, flexShrink: 0 }}
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="rp-chips" style={{ marginBottom: 8 }}>
        {ESTADOS.map((e) => {
          const active = filtros.estados.includes(e.id)
          return (
            <button
              key={e.id}
              className={`rp-chip${active ? ' rp-chip-active' : ''}`}
              onClick={() => setFiltros({ ...filtros, estados: toggle(filtros.estados, e.id) })}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: e.color, flexShrink: 0,
                }}
              />
              {e.label}
              <span style={{ opacity: 0.55 }}>{countEstado(e.id)}</span>
            </button>
          )
        })}
      </div>

      {modo === 'interno' && (
        <div className="rp-chips" style={{ marginBottom: 8 }}>
          {VISIBILIDADES.map((v) => {
            const active = filtros.visibilidades.includes(v.id)
            return (
              <button
                key={v.id}
                className={`rp-chip${active ? ' rp-chip-active' : ''}`}
                onClick={() =>
                  setFiltros({ ...filtros, visibilidades: toggle(filtros.visibilidades, v.id) })
                }
                title={v.descripcion}
              >
                <span>{v.icon}</span>
                {v.label}
                <span style={{ opacity: 0.55 }}>{countVis(v.id)}</span>
              </button>
            )
          })}
        </div>
      )}

      <select
        className="rp-select"
        value=""
        onChange={(e) => {
          if (!e.target.value) return
          setFiltros({ ...filtros, oficios: toggle(filtros.oficios, e.target.value) })
        }}
        style={{ padding: '8px 10px', fontSize: 12.5 }}
      >
        <option value="">Filtrar por oficio…</option>
        {oficiosPresentes.map((o) => (
          <option key={o.id} value={o.id}>
            {filtros.oficios.includes(o.id) ? '✓ ' : ''}
            {o.label} ({o.n})
          </option>
        ))}
      </select>

      {filtros.oficios.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {filtros.oficios.map((id) => (
            <button
              key={id}
              className="rp-chip rp-chip-active"
              onClick={() =>
                setFiltros({ ...filtros, oficios: filtros.oficios.filter((o) => o !== id) })
              }
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: oficioColor(id), flexShrink: 0,
                }}
              />
              {oficioLabel(id)} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Lista ────────────────────────────────────────────────────────────────────

interface ListProps {
  repasos: Repaso[]
  filtros: RepasoFiltros
  numeroDe: (id: string) => number
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  modo: 'interno' | 'presentacion'
}

export default function RepasosList({
  repasos,
  filtros,
  numeroDe,
  selectedId,
  onSelect,
  onOpen,
  modo,
}: ListProps) {
  const visibles = repasos.filter((r) => aplicaFiltros(r, filtros))
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())

  // Selección desde el plano → la fila entra en pantalla.
  useEffect(() => {
    if (!selectedId) return
    const el = rowRefs.current.get(selectedId)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  if (!repasos.length) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#1A1A1A70', fontWeight: 300, margin: 0 }}>
          {modo === 'interno'
            ? 'Todavía no hay repasos. Pulsa «Agregar repaso» y marca el punto en el plano.'
            : 'No hay repasos registrados en este plano.'}
        </p>
      </div>
    )
  }

  if (!visibles.length) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#1A1A1A70', fontWeight: 300, margin: 0 }}>
          Ningún repaso coincide con los filtros.
        </p>
      </div>
    )
  }

  // ── Fila del portal externo: la foto primero y el estado en un chip legible ──
  if (modo === 'presentacion') {
    return (
      <div>
        {visibles.map((r) => {
          const selected = r.id === selectedId
          const foto = r.fotos.find((f) => f.tipo === 'antes') ?? r.fotos[0]
          return (
            <button
              key={r.id}
              ref={(el) => {
                if (el) rowRefs.current.set(r.id, el)
                else rowRefs.current.delete(r.id)
              }}
              className={`rp-row rp-row-publico${selected ? ' rp-row-selected' : ''}`}
              onClick={() => onSelect(r.id)}
            >
              <span className="rp-row-thumb">
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto.url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span
                    style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, color: '#1A1A1A35',
                    }}
                  >
                    ◻
                  </span>
                )}
                <span
                  style={{
                    position: 'absolute', top: 4, left: 4,
                    width: 19, height: 19, borderRadius: '50%',
                    background: estadoColor(r.estado), color: '#fff',
                    fontSize: 9, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}
                >
                  {numeroDe(r.id)}
                </span>
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.09em',
                    textTransform: 'uppercase', color: '#fff',
                    background: estadoColor(r.estado),
                    padding: '3px 8px', borderRadius: 999, marginBottom: 6,
                  }}
                >
                  {estadoLabel(r.estado)}
                </span>
                <span
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: r.descripcion ? '#1A1A1A' : '#1A1A1A55',
                    fontWeight: 300,
                  }}
                >
                  {r.descripcion || 'Sin descripción'}
                </span>
                <span
                  style={{
                    display: 'block', marginTop: 5,
                    fontSize: 10.5, color: '#1A1A1A70',
                  }}
                >
                  {oficioLabel(r.oficio)}
                  {r.fotos.length > 1 ? ` · ${r.fotos.length} fotos` : ''}
                </span>
              </span>

              <span style={{ flexShrink: 0, fontSize: 15, color: '#1A1A1A40' }}>›</span>
            </button>
          )
        })}
        <div style={{ height: 24 }} />
      </div>
    )
  }

  return (
    <div>
      {visibles.map((r) => {
        const selected = r.id === selectedId
        const foto = r.fotos[0]
        return (
          <button
            key={r.id}
            ref={(el) => {
              if (el) rowRefs.current.set(r.id, el)
              else rowRefs.current.delete(r.id)
            }}
            className={`rp-row${selected ? ' rp-row-selected' : ''}`}
            onClick={() => (selected ? onOpen(r.id) : onSelect(r.id))}
            onDoubleClick={() => onOpen(r.id)}
          >
            {/* Número + estado */}
            <span
              style={{
                flexShrink: 0,
                width: 26, height: 26, borderRadius: '50%',
                background: estadoColor(r.estado),
                color: '#fff', fontSize: 10.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
              }}
            >
              {numeroDe(r.id)}
            </span>

            {/* Cuerpo */}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  marginBottom: 3, flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.02em' }}>
                  {r.codigo}
                </span>
                <span
                  style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 3,
                    background: `${oficioColor(r.oficio)}18`,
                    color: oficioColor(r.oficio), fontWeight: 500,
                  }}
                >
                  {oficioLabel(r.oficio)}
                </span>
                {modo === 'interno' && (
                  <span style={{ fontSize: 10, opacity: 0.7 }} title={r.visibilidad}>
                    {visibilidadIcon(r.visibilidad)}
                  </span>
                )}
              </span>

              <span
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: r.descripcion ? '#1A1A1A' : '#1A1A1A55',
                  fontWeight: 300,
                }}
              >
                {r.descripcion || 'Sin descripción'}
              </span>

              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginTop: 5, fontSize: 10, color: '#1A1A1A60',
                }}
              >
                <span style={{ color: estadoColor(r.estado), fontWeight: 500 }}>
                  {estadoLabel(r.estado)}
                </span>
                <span>·</span>
                <span>{fmtFecha(r.created_at)}</span>
                {r.fotos.length > 1 && (
                  <>
                    <span>·</span>
                    <span>{r.fotos.length} fotos</span>
                  </>
                )}
              </span>
            </span>

            {/* Miniatura */}
            {foto && (
              <span
                style={{
                  flexShrink: 0,
                  width: 52, height: 52, borderRadius: 4,
                  overflow: 'hidden', background: '#F0EEE8',
                  display: 'block',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </span>
            )}
          </button>
        )
      })}
      <div style={{ height: 24 }} />
    </div>
  )
}

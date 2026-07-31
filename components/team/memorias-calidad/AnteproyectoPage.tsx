'use client'

import React, { useMemo, useState } from 'react'
import {
  NIVELES,
  agruparEstructura,
  formatEur,
  nivelMeta,
  type Capitulo,
  type NivelCalidad,
  type Subcapitulo,
  type WarehouseItem,
} from '@/lib/memorias/domain'
import VistaToggle, { useVistaModo } from './VistaToggle'

interface ProyectoOpcion {
  id: string
  nombre: string
  codigo: string | null
  direccion: string | null
  nivel_calidad: NivelCalidad | null
}

interface Props {
  proyectos: ProyectoOpcion[]
  capitulos: Capitulo[]
  subcapitulos: Subcapitulo[]
  favoritos: WarehouseItem[]
}

const S = {
  label: { fontSize: 9, fontWeight: 700 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 5 },
  input: { width: '100%', padding: '8px 10px', fontSize: 12.5, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const, outline: 'none' },
}

export default function AnteproyectoPage({ proyectos, capitulos, subcapitulos, favoritos }: Props) {
  const [vista, setVista] = useVistaModo('cards')
  const [proyectoId, setProyectoId] = useState<string>(proyectos[0]?.id ?? '')
  const proyecto = proyectos.find(p => p.id === proyectoId) ?? null
  const [nivelManual, setNivelManual] = useState<NivelCalidad | null>(null)
  const [incluirPrecios, setIncluirPrecios] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  const nivel: NivelCalidad = nivelManual ?? proyecto?.nivel_calidad ?? 'select'
  const estructura = useMemo(() => agruparEstructura(capitulos, subcapitulos), [capitulos, subcapitulos])

  const delNivel = useMemo(() => favoritos.filter(f => f.nivel_calidad === nivel), [favoritos, nivel])
  const porSub = useMemo(() => new Map(delNivel.map(f => [f.subcapitulo_id, f])), [delNivel])

  const bloques = useMemo(() =>
    estructura
      .map(c => ({
        capitulo: c,
        items: c.subcapitulos
          .map(s => ({ sub: s, item: porSub.get(s.id) }))
          .filter((x): x is { sub: Subcapitulo; item: WarehouseItem } => !!x.item),
        huecos: c.subcapitulos.filter(s => !porSub.has(s.id)),
      }))
      .filter(b => b.items.length > 0 || b.huecos.length > 0),
    [estructura, porSub]
  )

  const totalItems = delNivel.length
  const totalHuecos = subcapitulos.length - totalItems
  const totalPvp = delNivel.reduce((acc, f) => acc + (f.precio_pvp ?? 0), 0)
  const meta = nivelMeta(nivel)

  const urlPdf = proyectoId
    ? `/api/memorias/anteproyecto/pdf?proyecto_id=${proyectoId}&nivel=${nivel}${incluirPrecios ? '&precios=1' : ''}`
    : null

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888' }}>
            Memorias de calidades
          </p>
          <h1 style={{ margin: '4px 0 6px', fontSize: 26, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            Anteproyecto
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#888', maxWidth: 660, lineHeight: 1.5 }}>
            Elige proyecto y nivel: coge los Favoritos FP de cada subcapítulo y arma el documento.
            Pensado para clientes que aún no están cerrados, así que sale sin cantidades y sin precios salvo que los pidas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <VistaToggle vista={vista} onChange={setVista} />
          {urlPdf && totalItems > 0 && (
            <a
              href={urlPdf}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 5, background: '#1A1A1A', color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Descargar PDF
            </a>
          )}
        </div>
      </div>

      {/* Configurador */}
      <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: 18, marginBottom: 22, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label style={S.label}>Proyecto</label>
          <select value={proyectoId} onChange={e => { setProyectoId(e.target.value); setNivelManual(null) }} style={S.input}>
            {proyectos.length === 0 && <option value="">— No hay proyectos activos —</option>}
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}{p.codigo ? ` · ${p.codigo}` : ''}
              </option>
            ))}
          </select>
          {proyecto?.direccion && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#AAA' }}>{proyecto.direccion}</p>
          )}
        </div>

        <div>
          <label style={S.label}>Nivel de calidad</label>
          <div style={{ display: 'flex', gap: 3, background: '#F8F7F4', padding: 3, borderRadius: 6, border: '1px solid #E8E6E0' }}>
            {NIVELES.map(n => (
              <button
                key={n.value}
                onClick={() => setNivelManual(n.value)}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: nivel === n.value ? n.color : 'transparent',
                  color: nivel === n.value ? '#fff' : '#777',
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {n.label}
              </button>
            ))}
          </div>
          {proyecto?.nivel_calidad && (
            <p style={{ margin: '6px 0 0', fontSize: 10.5, color: nivelManual && nivelManual !== proyecto.nivel_calidad ? '#D97706' : '#AAA' }}>
              {nivelManual && nivelManual !== proyecto.nivel_calidad
                ? `El proyecto tiene asignado ${nivelMeta(proyecto.nivel_calidad).label}`
                : 'Nivel asignado al proyecto'}
            </p>
          )}
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#555', cursor: 'pointer', paddingBottom: 8 }}>
          <input type="checkbox" checked={incluirPrecios} onChange={e => setIncluirPrecios(e.target.checked)} />
          Incluir PVP de referencia
        </label>
      </div>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: 26, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{totalItems}</p>
          <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>
            Favoritos en {meta.label}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: totalHuecos > 0 ? '#D97706' : '#1D9E75', lineHeight: 1 }}>{totalHuecos}</p>
          <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>
            Subcapítulos sin favorito
          </p>
        </div>
        {incluirPrecios && (
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{formatEur(totalPvp, 0)}</p>
            <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>
              Suma de PVP unitarios
            </p>
          </div>
        )}
      </div>

      {totalItems === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #D5D3CE', borderRadius: 8, padding: 36, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
            No hay ningún Favorito FP en nivel {meta.label}.
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: '#999', lineHeight: 1.6 }}>
            Ve al warehouse y marca con la estrella el producto de referencia de cada subcapítulo para este nivel.
          </p>
        </div>
      )}

      {/* Previsualización */}
      {bloques.map(({ capitulo, items, huecos }) => (
        <section key={capitulo.id} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #E8E6E0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.1em' }}>
              {String(capitulo.numero).padStart(2, '0')}
            </span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 400, color: '#1A1A1A' }}>{capitulo.nombre}</h2>
            <span style={{ fontSize: 11, color: '#AAA' }}>· {items.length} de {capitulo.subcapitulos.length}</span>
          </div>

          {items.length > 0 && (vista === 'cards' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))', gap: 14 }}>
              {items.map(({ sub, item }) => (
                <div key={sub.id} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '4 / 3', background: '#F8F7F4' }}>
                    {(item.imagen_lifestyle_url ?? item.imagen_principal_url) ? (
                      <img
                        src={item.imagen_lifestyle_url ?? item.imagen_principal_url ?? ''}
                        alt={item.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#CCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Sin imagen
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#BBB' }}>{sub.nombre}</p>
                    {item.marca && <p style={{ margin: '4px 0 0', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#D85A30' }}>{item.marca}</p>}
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.3 }}>{item.nombre}</p>
                    {item.modelo && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{item.modelo}</p>}
                    {incluirPrecios && item.precio_pvp != null && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{formatEur(item.precio_pvp, 0)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
              {items.map(({ sub, item }) => {
                const open = abierto === item.id
                return (
                  <div key={sub.id} style={{ borderBottom: '1px solid #F0EEE8' }}>
                    <div
                      onClick={() => setAbierto(open ? null : item.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 10, color: '#CCC', width: 10 }}>{open ? '▾' : '▸'}</span>
                      <div style={{ width: 34, height: 26, borderRadius: 3, background: '#F8F7F4', overflow: 'hidden', flexShrink: 0 }}>
                        {(item.imagen_principal_url ?? item.imagen_lifestyle_url) && (
                          <img src={item.imagen_principal_url ?? item.imagen_lifestyle_url ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.nombre}</span>
                      <span style={{ flex: 2, minWidth: 0, fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[item.marca, item.nombre].filter(Boolean).join(' · ')}
                      </span>
                      {incluirPrecios && (
                        <span style={{ width: 90, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: '#1A1A1A' }}>
                          {item.precio_pvp != null ? formatEur(item.precio_pvp, 0) : '—'}
                        </span>
                      )}
                    </div>
                    {open && (
                      <div style={{ padding: '2px 12px 14px 66px', fontSize: 11.5, color: '#555', lineHeight: 1.55 }}>
                        {item.descripcion || <span style={{ color: '#CCC' }}>Sin descripción — se verá vacío en el PDF.</span>}
                        {item.acabados.length > 0 && (
                          <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#999' }}>Acabados: {item.acabados.join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {huecos.length > 0 && (
            <p style={{ margin: '10px 0 0', fontSize: 10.5, color: '#C08A3E', lineHeight: 1.5 }}>
              Sin favorito en este nivel: {huecos.map(h => h.nombre).join(' · ')}
            </p>
          )}
        </section>
      ))}
    </div>
  )
}

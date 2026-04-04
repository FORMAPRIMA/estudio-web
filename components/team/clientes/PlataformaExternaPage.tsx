'use client'

import { useState } from 'react'

interface ProyectoItem {
  id: string
  nombre: string
  codigo: string | null
  imagen_url: string | null
  status: string
  clientes: { nombre: string } | { nombre: string }[] | null
}

function getClienteNombre(clientes: ProyectoItem['clientes']): string {
  if (!clientes) return '—'
  if (Array.isArray(clientes)) return clientes[0]?.nombre ?? '—'
  return clientes.nombre
}

export default function PlataformaExternaPage({
  proyectos,
}: {
  proyectos: ProyectoItem[]
  actualizaciones: unknown[] // kept for compat, unused
}) {
  const [selected, setSelected] = useState<string | null>(proyectos[0]?.id ?? null)
  const [iframeKey, setIframeKey] = useState(0)

  const selectedProyecto = proyectos.find(p => p.id === selected) ?? null

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '24px 40px 20px', borderBottom: '1px solid #E8E6E0', background: '#fff', flexShrink: 0 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4, fontWeight: 600 }}>
          Clientes · Plataforma de obras
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 200, color: '#1A1A1A', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              Vista del cliente
            </h1>
            <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>
              Portal real — exactamente como lo ve el cliente
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {selectedProyecto && (
              <>
                <button
                  onClick={() => setIframeKey(k => k + 1)}
                  style={{ padding: '6px 12px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', fontSize: 10, color: '#888' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A1A1A'; (e.currentTarget as HTMLElement).style.color = '#1A1A1A' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLElement).style.color = '#888' }}
                  title="Recargar portal"
                >
                  ↺ Recargar
                </button>
                <a
                  href={`/portal/${selectedProyecto.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '6px 12px', background: '#1A1A1A', border: '1px solid #1A1A1A', borderRadius: 5, cursor: 'pointer', fontSize: 10, color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  Abrir en pestaña →
                </a>
              </>
            )}
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#1D9E75', background: '#EEF8F4', padding: '5px 10px', borderRadius: 4,
              border: '1px solid #1D9E7533', whiteSpace: 'nowrap',
            }}>
              Vista previa interna
            </div>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: project picker */}
        <div style={{
          width: 260, flexShrink: 0, borderRight: '1px solid #E8E6E0',
          background: '#fff', overflow: 'auto', padding: '12px 10px',
        }}>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', padding: '4px 8px', marginBottom: 6 }}>
            Proyectos activos
          </p>
          {proyectos.length === 0 && (
            <p style={{ fontSize: 11, color: '#CCC', textAlign: 'center', padding: '20px 8px' }}>Sin proyectos activos</p>
          )}
          {proyectos.map(p => {
            const isSelected = selected === p.id
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p.id); setIframeKey(k => k + 1) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: isSelected ? '#1A1A1A' : 'transparent', marginBottom: 3,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.imagen_url ? (
                    <div style={{ width: 30, height: 30, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={p.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: 4, background: isSelected ? 'rgba(255,255,255,0.1)' : '#F0EEE8', flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: isSelected ? '#fff' : '#1A1A1A', margin: 0, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.nombre}
                    </p>
                    <p style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.45)' : '#AAA', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getClienteNombre(p.clientes)}
                      {p.codigo && <span> · {p.codigo}</span>}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: actual portal embedded */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#F0EEE8' }}>
          {selectedProyecto ? (
            <iframe
              key={iframeKey}
              src={`/portal/${selectedProyecto.id}`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title={`Portal · ${selectedProyecto.nombre}`}
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CCC', fontSize: 13 }}>
              Selecciona un proyecto para previsualizar el portal del cliente
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

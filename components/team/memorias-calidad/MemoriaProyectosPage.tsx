'use client'

import Link from 'next/link'
import { formatEur, nivelMeta, type NivelCalidad } from '@/lib/memorias/domain'

interface ProyectoRow {
  id: string
  nombre: string
  codigo: string | null
  nivel_calidad: NivelCalidad | null
  status: string
  estancias_count: number
  items_count: number
  total_pvp: number
}

export default function MemoriaProyectosPage({ proyectos }: { proyectos: ProyectoRow[] }) {
  const conMemoria = proyectos.filter(p => p.items_count > 0).length

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#F8F7F4' }}>
      <div style={{ marginBottom: 26 }}>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888' }}>
          Memorias de calidades
        </p>
        <h1 style={{ margin: '4px 0 6px', fontSize: 26, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
          Ejecución
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: '#888', maxWidth: 640, lineHeight: 1.5 }}>
          Selección cerrada por estancia, con cantidades, proveedor asignado y control económico.
          {proyectos.length > 0 && ` ${conMemoria} de ${proyectos.length} proyectos tienen memoria empezada.`}
        </p>
      </div>

      {proyectos.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #D5D3CE', borderRadius: 8, padding: 36, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>No hay proyectos activos.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proyectos.map(p => {
            const nivel = p.nivel_calidad ? nivelMeta(p.nivel_calidad) : null
            const empezada = p.items_count > 0

            return (
              <Link key={p.id} href={`/team/memorias-calidad/proyectos/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderRadius: 8, border: '1px solid #E8E6E0', background: '#fff', cursor: 'pointer' }}>
                  <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: nivel?.color ?? '#DDD' }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nombre}
                      </span>
                      {p.codigo && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#AAA', flexShrink: 0 }}>{p.codigo}</span>}
                    </div>
                    {empezada && (
                      <span style={{ fontSize: 11, color: '#999' }}>
                        {p.estancias_count} estancia{p.estancias_count !== 1 ? 's' : ''} · {p.items_count} item{p.items_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {nivel && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: nivel.bg, color: nivel.color, flexShrink: 0 }}>
                      {nivel.label}
                    </span>
                  )}

                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 110 }}>
                    {empezada ? (
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{formatEur(p.total_pvp, 0)}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>Sin empezar</span>
                    )}
                  </div>

                  <span style={{ fontSize: 16, color: '#CCC', flexShrink: 0 }}>›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

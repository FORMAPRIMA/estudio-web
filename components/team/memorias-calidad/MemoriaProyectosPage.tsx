'use client'

import Link from 'next/link'

type NivelCalidad = 'functional' | 'select' | 'master_piece'

interface ProyectoRow {
  id: string
  nombre: string
  codigo: string | null
  nivel_calidad: NivelCalidad
  status: string
  item_count: number
}

const NIVEL_META: Record<NivelCalidad, { label: string; color: string; bg: string }> = {
  functional:   { label: 'Functional',   color: '#1D9E75', bg: '#E8F7F2' },
  select:       { label: 'Select',       color: '#378ADD', bg: '#EBF5FF' },
  master_piece: { label: 'Masterpiece',  color: '#D85A30', bg: '#FFF3EF' },
}

export default function MemoriaProyectosPage({ proyectos }: { proyectos: ProyectoRow[] }) {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>Memorias de Calidad</p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Proyectos</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} con nivel de calidad asignado
          </p>
        </div>
        <a
          href="/api/memoria/manual"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: '#1A1A1A',
            padding: '8px 16px', borderRadius: 6,
            border: '1px solid #E8E6E0', background: '#fff',
            textDecoration: 'none', flexShrink: 0, marginTop: 4,
          }}
        >
          <span style={{ fontSize: 14 }}>📖</span> Manual
        </a>
      </div>

      {proyectos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#BBB' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>Sin proyectos con nivel de calidad</p>
          <p style={{ fontSize: 13 }}>Asigna un nivel de calidad (Functional / Select / Masterpiece) a un proyecto para empezar a gestionar su memoria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proyectos.map(p => {
            const nivel = NIVEL_META[p.nivel_calidad]
            const hasItems = p.item_count > 0
            return (
              <Link
                key={p.id}
                href={`/team/memorias-calidad/proyectos/${p.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderRadius: 8, border: '1px solid #E8E6E0', background: '#fff', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  {/* Nivel badge */}
                  <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: nivel.color }} />

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nombre}
                      </span>
                      {p.codigo && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#AAA', flexShrink: 0 }}>{p.codigo}</span>
                      )}
                    </div>
                  </div>

                  {/* Nivel */}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: nivel.bg, color: nivel.color, flexShrink: 0 }}>
                    {nivel.label}
                  </span>

                  {/* Items count */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {hasItems ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{p.item_count} items</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>Sin inicializar</span>
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

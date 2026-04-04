'use client'

import { useRouter } from 'next/navigation'

interface ActMin {
  id: string
  visible_cliente: boolean
  fecha: string
}

interface ProyectoItem {
  id: string
  nombre: string
  codigo: string | null
  imagen_url: string | null
  status: string
  clientes: { nombre: string } | null
  proyecto_actualizaciones: ActMin[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  activo:  { label: 'Activo',   color: '#D85A30' },
  on_hold: { label: 'On Hold',  color: '#378ADD' },
}

function relativeDate(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'ayer'
  if (diff < 7)  return `hace ${diff} días`
  if (diff < 30) return `hace ${Math.floor(diff / 7)} semana${Math.floor(diff / 7) > 1 ? 's' : ''}`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function PlataformaInternaPage({ proyectos }: { proyectos: ProyectoItem[] }) {
  const router = useRouter()

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Clientes · Plataforma de obras
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Gestión interna
          </h1>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} activos
          </span>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '32px 40px' }}>
        {proyectos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#CCC', fontSize: 13 }}>
            No hay proyectos activos o en espera
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {proyectos.map(p => {
              const meta   = STATUS_META[p.status] ?? { label: p.status, color: '#999' }
              const acts   = p.proyecto_actualizaciones ?? []
              const visibles = acts.filter(a => a.visible_cliente).length
              const lastAct = acts[0]
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/team/clientes/plataforma/interna/${p.id}`)}
                  style={{
                    background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0',
                    overflow: 'hidden', cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'
                    el.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                    el.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Banner */}
                  <div style={{
                    position: 'relative', height: 110, overflow: 'hidden',
                    background: p.imagen_url ? 'transparent' : `linear-gradient(135deg, ${meta.color}99 0%, ${meta.color}33 100%)`,
                  }}>
                    {p.imagen_url && (
                      <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: meta.color, background: 'rgba(255,255,255,0.92)', padding: '2px 7px', borderRadius: 3,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3 }}>{p.nombre}</p>
                      {p.clientes && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>{p.clientes.nombre}</p>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 2px' }}>
                          Actualizaciones
                        </p>
                        <p style={{ fontSize: 15, fontWeight: 500, color: acts.length > 0 ? '#1A1A1A' : '#CCC', margin: 0 }}>
                          {acts.length}
                          {visibles > 0 && (
                            <span style={{ fontSize: 9, color: '#1D9E75', marginLeft: 5, fontWeight: 700 }}>
                              {visibles} visible{visibles !== 1 ? 's' : ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {lastAct && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 2px' }}>
                          Última
                        </p>
                        <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{relativeDate(lastAct.fecha)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

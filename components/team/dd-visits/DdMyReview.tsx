'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { DdCard, DdAsset, DdVisit, DdRole } from '@/lib/dd-visits/domain'
import {
  DD_CARD_ESTADO_LABELS, DD_CARD_ESTADO_COLORS,
  DD_CARD_RIESGO_LABELS, DD_CARD_RIESGO_COLORS,
  DD_CARD_PRIORIDAD_LABELS, DD_CARD_PRIORIDAD_COLORS,
} from '@/lib/dd-visits/domain'

interface Props {
  asset: Pick<DdAsset, 'id' | 'nombre'>
  visit: Pick<DdVisit, 'id' | 'asset_id' | 'fecha' | 'status'>
  cards: (DdCard & { media?: { id: string; tipo: string }[] })[]
  roles: DdRole[]
}

export default function DdMyReview({ asset, visit, cards, roles }: Props) {
  const router = useRouter()
  const [selectedRolId, setSelectedRolId] = useState<string | 'all'>('all')
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterRiesgo, setFilterRiesgo] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const activeCards = useMemo(() => cards.filter(c => c.activo), [cards])

  const filteredCards = useMemo(() => {
    return activeCards
      .filter(c => selectedRolId === 'all' || c.rol_id === selectedRolId)
      .filter(c => filterEstado === 'all' || c.estado === filterEstado)
      .filter(c => filterRiesgo === 'all' || c.riesgo === filterRiesgo)
      .sort((a, b) => {
        const order: Record<string, number> = { incidencia: 0, requiere_aclaracion: 1, no_accesible: 2, pendiente: 3, revisado_ok: 4, no_aplica: 5 }
        return (order[a.estado] ?? 3) - (order[b.estado] ?? 3)
      })
  }, [activeCards, selectedRolId, filterEstado, filterRiesgo])

  const roleStats = useMemo(() => {
    return roles.map(rol => {
      const rc = activeCards.filter(c => c.rol_id === rol.id)
      return { rol, total: rc.length, done: rc.filter(c => c.estado !== 'pendiente').length }
    })
  }, [roles, activeCards])

  const totalCards = activeCards.length
  const doneCards = activeCards.filter(c => c.estado !== 'pendiente').length
  const progress = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0

  const basePath = `/team/apps/dd-visits/${asset.id}/visita/${visit.id}/mi-revision`
  const fechaStr = visit.fecha
    ? new Date(visit.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : ''

  return (
    <div style={{ background: '#F8F7F4', minHeight: '100vh', maxWidth: 640, margin: '0 auto' }}>

      {/* Header fijo */}
      <div style={{ background: '#1A1A1A', padding: '14px 20px 14px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/visita/${visit.id}`)}
            style={{ background: 'none', border: 'none', color: '#ffffff60', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1, flexShrink: 0 }}
          >←</button>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#ffffff50', marginBottom: 2 }}>
              {asset.nombre}{fechaStr ? ` · ${fechaStr}` : ''}
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: '#fff', letterSpacing: '-0.01em' }}>
              Mi Revisión
            </h1>
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ background: '#ffffff20', borderRadius: 20, height: 4, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            background: progress === 100 ? '#2D7D5A' : '#D85A30',
            height: '100%', width: `${progress}%`, borderRadius: 20, transition: 'width 0.4s',
          }} />
        </div>
        <p style={{ fontSize: 10, color: '#ffffff50' }}>
          {doneCards} de {totalCards} cards completadas · {progress}%
        </p>
      </div>

      {/* Selector de rol */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0', padding: '10px 20px 8px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 7, minWidth: 'max-content' }}>
          <button
            onClick={() => setSelectedRolId('all')}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: selectedRolId === 'all' ? 600 : 400,
              background: selectedRolId === 'all' ? '#1A1A1A' : '#F0EEE8',
              color: selectedRolId === 'all' ? '#fff' : '#1A1A1A70',
              transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
          >
            Todas ({activeCards.length})
          </button>
          {roleStats.filter(({ total }) => total > 0).map(({ rol, total, done }) => (
            <button
              key={rol.id}
              onClick={() => setSelectedRolId(selectedRolId === rol.id ? 'all' : rol.id)}
              style={{
                padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: selectedRolId === rol.id ? 600 : 400,
                background: selectedRolId === rol.id ? rol.color : '#F0EEE8',
                color: selectedRolId === rol.id ? '#fff' : '#1A1A1A70',
                transition: 'all 0.12s', whiteSpace: 'nowrap',
              }}
            >
              {rol.nombre.split('/')[0].trim()} ({done}/{total})
            </button>
          ))}
        </div>
      </div>

      {/* Filtros adicionales */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0', padding: '0 20px' }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A50', padding: '8px 0', display: 'block' }}
        >
          {showFilters ? '▴ Ocultar filtros' : '▾ Filtros adicionales'}
        </button>
        {showFilters && (
          <div style={{ paddingBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              {
                value: filterEstado, setter: setFilterEstado,
                options: [
                  { v: 'all', l: 'Todos los estados' },
                  { v: 'pendiente', l: 'Pendiente' },
                  { v: 'revisado_ok', l: 'Revisado OK' },
                  { v: 'incidencia', l: 'Incidencia' },
                  { v: 'no_accesible', l: 'No accesible' },
                  { v: 'requiere_aclaracion', l: 'Requiere aclaración' },
                  { v: 'no_aplica', l: 'No aplica' },
                ],
              },
              {
                value: filterRiesgo, setter: setFilterRiesgo,
                options: [
                  { v: 'all', l: 'Todo riesgo' },
                  { v: 'alto', l: 'Alto' },
                  { v: 'medio', l: 'Medio' },
                  { v: 'bajo', l: 'Bajo' },
                  { v: 'sin_riesgo', l: 'Sin riesgo' },
                ],
              },
            ].map((f, i) => (
              <select
                key={i}
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                style={{ border: '1px solid #E0DDD8', borderRadius: 3, padding: '6px 8px', fontSize: 12, color: '#1A1A1A', background: '#FAFAF8' }}
              >
                {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>
        )}
      </div>

      {/* Lista de cards */}
      <div style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredCards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 13, color: '#1A1A1A40' }}>Sin cards para los filtros seleccionados</p>
          </div>
        )}

        {filteredCards.map(card => {
          const rol = roles.find(r => r.id === card.rol_id)
          const estadoColor = DD_CARD_ESTADO_COLORS[card.estado]
          const riesgoColor = card.riesgo ? DD_CARD_RIESGO_COLORS[card.riesgo] : null
          const prioridadColor = DD_CARD_PRIORIDAD_COLORS[card.prioridad]
          const mediaCount = card.media?.length ?? 0
          const hasComment = !!card.comentario_tecnico

          return (
            <button
              key={card.id}
              onClick={() => router.push(`${basePath}/${card.id}`)}
              style={{
                background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
                padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                display: 'block', width: '100%',
                borderLeft: `4px solid ${estadoColor}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 5, lineHeight: 1.3 }}>
                    {card.titulo}
                  </p>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {card.zona_edificio && (
                      <span style={{ fontSize: 10, color: '#1A1A1A50', background: '#F0EEE8', padding: '2px 7px', borderRadius: 20 }}>
                        {card.zona_edificio}
                      </span>
                    )}
                    {rol && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: rol.color + '18', color: rol.color }}>
                        {rol.nombre.split('/')[0].trim()}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: estadoColor + '18', color: estadoColor,
                  }}>
                    {DD_CARD_ESTADO_LABELS[card.estado]}
                  </span>
                  <span style={{
                    fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: prioridadColor + '18', color: prioridadColor,
                  }}>
                    {DD_CARD_PRIORIDAD_LABELS[card.prioridad]}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {riesgoColor && card.riesgo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: riesgoColor, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: riesgoColor, fontWeight: 500 }}>
                      Riesgo {DD_CARD_RIESGO_LABELS[card.riesgo]}
                    </span>
                  </div>
                )}
                {mediaCount > 0 && (
                  <span style={{ fontSize: 10, color: '#1A1A1A50' }}>📷 {mediaCount} foto{mediaCount !== 1 ? 's' : ''}</span>
                )}
                {card.requiere_seguimiento && (
                  <span style={{ fontSize: 10, color: '#E67E22', fontWeight: 500 }}>↻ Seguimiento</span>
                )}
                {hasComment && (
                  <span style={{ fontSize: 10, color: '#1A1A1A40' }}>✎ Nota</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

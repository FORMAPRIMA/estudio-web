'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createDdAsset } from '@/app/actions/dd-visits'
import type { DdAsset, DdVisit, DdCard } from '@/lib/dd-visits/domain'
import {
  DD_ASSET_STATUS_LABELS, DD_ASSET_STATUS_COLORS,
  DD_VISIT_STATUS_LABELS, DD_VISIT_STATUS_COLORS,
} from '@/lib/dd-visits/domain'

interface Props {
  assets: DdAsset[]
  visits: Pick<DdVisit, 'id' | 'asset_id' | 'fecha' | 'status'>[]
  cards: Pick<DdCard, 'id' | 'asset_id' | 'estado' | 'riesgo' | 'activo'>[]
  isAdmin: boolean
}

export default function DdDashboard({ assets, visits, cards, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', direccion: '', cliente: '' })
  const [error, setError] = useState<string | null>(null)

  const assetStats = useMemo(() => {
    return assets.map(asset => {
      const assetCards = cards.filter(c => c.asset_id === asset.id)
      const total = assetCards.length
      const pendiente = assetCards.filter(c => c.estado === 'pendiente').length
      const incidencia = assetCards.filter(c => c.estado === 'incidencia').length
      const no_accesible = assetCards.filter(c => c.estado === 'no_accesible').length
      const requiere_aclaracion = assetCards.filter(c => c.estado === 'requiere_aclaracion').length
      const alto = assetCards.filter(c => c.riesgo === 'alto').length
      const progress = total > 0 ? Math.round(((total - pendiente) / total) * 100) : 0

      const assetVisits = visits.filter(v => v.asset_id === asset.id)
      const nextVisit = assetVisits.sort((a, b) =>
        (a.fecha ?? '') > (b.fecha ?? '') ? 1 : -1
      )[0] ?? null

      return { asset, total, pendiente, incidencia, no_accesible, requiere_aclaracion, alto, progress, nextVisit }
    })
  }, [assets, visits, cards])

  function handleCreate() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const result = await createDdAsset({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || undefined,
        cliente: form.cliente.trim() || undefined,
      })
      if ('error' in result) { setError(result.error); return }
      setShowModal(false)
      setForm({ nombre: '', direccion: '', cliente: '' })
      router.push(`/team/apps/dd-visits/${result.id}`)
    })
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 6 }}>
            Apps · Forma Prima
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Due Diligence Visits
          </h1>
          <p style={{ fontSize: 13, color: '#1A1A1A50', fontWeight: 300 }}>
            Gestión de visitas técnicas de DD de activos residenciales
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4,
              padding: '10px 20px', fontSize: 12, cursor: 'pointer', letterSpacing: '0.05em',
            }}
          >
            + Nuevo activo
          </button>
        )}
      </div>

      {/* Stats summary */}
      {assets.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Activos', value: assets.length },
            { label: 'Visitas', value: visits.length },
            { label: 'Cards totales', value: cards.length },
            { label: 'Incidencias', value: cards.filter(c => c.estado === 'incidencia').length },
            { label: 'Riesgo alto', value: cards.filter(c => c.riesgo === 'alto').length },
          ].map(stat => (
            <div key={stat.label} style={{
              background: '#fff', border: '1px solid #E8E6E0', borderRadius: 4,
              padding: '14px 20px', minWidth: 80,
            }}>
              <p style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 2 }}>{stat.value}</p>
              <p style={{ fontSize: 10, color: '#1A1A1A50', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Asset grid */}
      {assets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed #E0DDD8', borderRadius: 8 }}>
          <p style={{ fontSize: 15, color: '#1A1A1A40', fontWeight: 300 }}>Sin activos todavía</p>
          {isAdmin && (
            <p style={{ fontSize: 12, color: '#1A1A1A30', marginTop: 8 }}>
              Crea el primer activo para comenzar
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {assetStats.map(({ asset, total, pendiente, incidencia, no_accesible, requiere_aclaracion, alto, progress, nextVisit }) => {
            const statusColor = DD_ASSET_STATUS_COLORS[asset.status]
            return (
              <div
                key={asset.id}
                onClick={() => router.push(`/team/apps/dd-visits/${asset.id}`)}
                className="dd-asset-card"
                style={{
                  background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6,
                  padding: '20px 22px', cursor: 'pointer',
                  borderTop: `3px solid ${statusColor}`,
                  transition: 'box-shadow 0.12s',
                }}
              >
                {/* Asset header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 3 }}>
                      {asset.nombre}
                    </h3>
                    {asset.direccion && (
                      <p style={{ fontSize: 11, color: '#1A1A1A50' }}>{asset.direccion}</p>
                    )}
                  </div>
                  <span style={{
                    fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 20,
                    background: statusColor + '18', color: statusColor, whiteSpace: 'nowrap',
                  }}>
                    {DD_ASSET_STATUS_LABELS[asset.status]}
                  </span>
                </div>

                {asset.cliente && (
                  <p style={{ fontSize: 11, color: '#1A1A1A40', marginBottom: 12 }}>
                    Cliente: {asset.cliente}
                  </p>
                )}

                {/* Próxima visita */}
                {nextVisit && (
                  <div style={{ marginBottom: 12, padding: '8px 10px', background: '#F8F7F4', borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#1A1A1A60' }}>
                        {nextVisit.fecha
                          ? new Date(nextVisit.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Fecha pendiente'}
                      </span>
                      <span style={{
                        fontSize: 9, color: DD_VISIT_STATUS_COLORS[nextVisit.status],
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        {DD_VISIT_STATUS_LABELS[nextVisit.status]}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress */}
                {total > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: '#1A1A1A50' }}>Progreso cards</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#1A1A1A' }}>{progress}%</span>
                    </div>
                    <div style={{ background: '#F0EEE8', borderRadius: 20, height: 4, marginBottom: 14, overflow: 'hidden' }}>
                      <div style={{ background: '#1A1A1A', height: '100%', width: `${progress}%`, borderRadius: 20 }} />
                    </div>

                    {/* Stats chips */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {pendiente > 0 && (
                        <span style={{ fontSize: 10, color: '#888', background: '#F0EEE8', padding: '2px 8px', borderRadius: 20 }}>
                          {pendiente} pendientes
                        </span>
                      )}
                      {incidencia > 0 && (
                        <span style={{ fontSize: 10, color: '#C0392B', background: '#FDF2F2', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                          {incidencia} incidencias
                        </span>
                      )}
                      {no_accesible > 0 && (
                        <span style={{ fontSize: 10, color: '#E67E22', background: '#FFF8F0', padding: '2px 8px', borderRadius: 20 }}>
                          {no_accesible} no accesible
                        </span>
                      )}
                      {requiere_aclaracion > 0 && (
                        <span style={{ fontSize: 10, color: '#5B7FA6', background: '#F0F4FA', padding: '2px 8px', borderRadius: 20 }}>
                          {requiere_aclaracion} aclaración
                        </span>
                      )}
                      {alto > 0 && (
                        <span style={{ fontSize: 10, color: '#C0392B', background: '#FDF2F2', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                          {alto} riesgo alto
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo activo */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 4, width: '100%', maxWidth: 460, padding: '28px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 20, letterSpacing: '-0.01em' }}>
              Nuevo activo
            </h2>

            {[
              { key: 'nombre', label: 'Nombre *', placeholder: 'Ej: Bardala 20' },
              { key: 'direccion', label: 'Dirección', placeholder: 'Calle..., Madrid' },
              { key: 'cliente', label: 'Cliente', placeholder: 'Nombre del cliente o fondo' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 5, display: 'block' }}>
                  {label}
                </label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', border: '1px solid #E0DDD8', borderRadius: 3, padding: '8px 10px', fontSize: 13, color: '#1A1A1A', outline: 'none', background: '#FAFAF8', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            {error && (
              <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 12, padding: '7px 10px', background: '#FDF2F2', borderRadius: 3 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: '#1A1A1A80' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={isPending} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '8px 18px', fontSize: 12, cursor: 'pointer', opacity: isPending ? 0.6 : 1 }}>
                {isPending ? 'Creando...' : 'Crear activo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

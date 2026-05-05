'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateDdAsset, createDdVisit, addDdAssetDoc, deleteDdAssetDoc } from '@/app/actions/dd-visits'
import type { DdAsset, DdVisit, DdRole, DdAssetDoc, DdCard } from '@/lib/dd-visits/domain'
import {
  DD_ASSET_STATUS_LABELS, DD_ASSET_STATUS_COLORS,
  DD_VISIT_STATUS_LABELS, DD_VISIT_STATUS_COLORS,
} from '@/lib/dd-visits/domain'

interface Props {
  asset: DdAsset
  visits: DdVisit[]
  roles: DdRole[]
  docs: DdAssetDoc[]
  cards: Pick<DdCard, 'id' | 'visit_id' | 'estado' | 'activo'>[]
  isAdmin: boolean
}

export default function DdAssetPage({ asset: initialAsset, visits, roles, docs: initialDocs, cards, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [asset, setAsset] = useState(initialAsset)
  const [docs, setDocs] = useState(initialDocs)
  const [activeTab, setActiveTab] = useState<'visitas' | 'datos' | 'documentacion'>('visitas')
  const [error, setError] = useState<string | null>(null)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [visitForm, setVisitForm] = useState({ fecha: '' })
  const [showDocModal, setShowDocModal] = useState(false)
  const [docForm, setDocForm] = useState({ nombre: '', tipo: 'recibida' as 'recibida' | 'pendiente', notas: '' })
  const [editingAsset, setEditingAsset] = useState(false)
  const [assetForm, setAssetForm] = useState({
    nombre: asset.nombre,
    direccion: asset.direccion ?? '',
    cliente: asset.cliente ?? '',
    superficie_m2: asset.superficie_m2?.toString() ?? '',
    uso_previsto: asset.uso_previsto ?? '',
    alcance_dd: asset.alcance_dd ?? '',
    limitaciones_generales: asset.limitaciones_generales ?? '',
  })

  const statusColor = DD_ASSET_STATUS_COLORS[asset.status]

  function handleSaveAsset() {
    setError(null)
    startTransition(async () => {
      const result = await updateDdAsset(asset.id, {
        nombre: assetForm.nombre.trim(),
        direccion: assetForm.direccion.trim() || null,
        cliente: assetForm.cliente.trim() || null,
        superficie_m2: assetForm.superficie_m2 ? parseFloat(assetForm.superficie_m2) : null,
        uso_previsto: assetForm.uso_previsto.trim() || null,
        alcance_dd: assetForm.alcance_dd.trim() || null,
        limitaciones_generales: assetForm.limitaciones_generales.trim() || null,
      })
      if ('error' in result) { setError(result.error); return }
      setAsset(prev => ({ ...prev, ...assetForm, superficie_m2: assetForm.superficie_m2 ? parseFloat(assetForm.superficie_m2) : null }))
      setEditingAsset(false)
    })
  }

  function handleCreateVisit() {
    startTransition(async () => {
      const result = await createDdVisit({
        asset_id: asset.id,
        fecha: visitForm.fecha || undefined,
      })
      if ('error' in result) { setError(result.error); return }
      setShowNewVisitModal(false)
      setVisitForm({ fecha: '' })
      router.push(`/team/apps/dd-visits/${asset.id}/visita/${result.id}`)
    })
  }

  function handleAddDoc() {
    if (!docForm.nombre.trim()) { setError('El nombre del documento es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const result = await addDdAssetDoc(asset.id, docForm.nombre.trim(), docForm.tipo, docForm.notas.trim() || undefined)
      if ('error' in result) { setError(result.error); return }
      setDocs(prev => [...prev, {
        id: result.id, asset_id: asset.id,
        nombre: docForm.nombre.trim(), tipo: docForm.tipo,
        url: null, notas: docForm.notas.trim() || null, orden: prev.length,
        created_at: new Date().toISOString(),
      }])
      setShowDocModal(false)
      setDocForm({ nombre: '', tipo: 'recibida', notas: '' })
    })
  }

  function handleDeleteDoc(docId: string) {
    startTransition(async () => {
      const result = await deleteDdAssetDoc(docId, asset.id)
      if ('error' in result) { setError(result.error); return }
      setDocs(prev => prev.filter(d => d.id !== docId))
    })
  }

  function handleStatusChange(status: DdAsset['status']) {
    startTransition(async () => {
      const result = await updateDdAsset(asset.id, { status })
      if ('error' in result) { setError(result.error); return }
      setAsset(prev => ({ ...prev, status }))
    })
  }

  const getVisitStats = (visitId: string) => {
    const vc = cards.filter(c => c.visit_id === visitId)
    const total = vc.length
    const done = vc.filter(c => c.estado !== 'pendiente').length
    const incidencias = vc.filter(c => c.estado === 'incidencia').length
    return { total, done, incidencias, progress: total > 0 ? Math.round((done / total) * 100) : 0 }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0DDD8', borderRadius: 3,
    padding: '8px 10px', fontSize: 13, color: '#1A1A1A',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#1A1A1A60', marginBottom: 5, display: 'block',
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/team/apps/dd-visits')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1A1A1A50', padding: 0, marginBottom: 12 }}
        >
          ← DD Técnica
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A40', marginBottom: 5 }}>
              Activo
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {asset.nombre}
            </h1>
            {asset.direccion && (
              <p style={{ fontSize: 12, color: '#1A1A1A50' }}>{asset.direccion}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, padding: '4px 10px', borderRadius: 20,
              background: statusColor + '18', color: statusColor,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {DD_ASSET_STATUS_LABELS[asset.status]}
            </span>
            {isAdmin && (
              <button
                onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/revision-interna`)}
                style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '7px 14px', fontSize: 11, cursor: 'pointer', color: '#1A1A1A70' }}
              >
                Revisión interna
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/report`)}
                style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}
              >
                Report Builder
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E8E6E0', marginBottom: 28 }}>
        {(['visitas', 'datos', 'documentacion'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontSize: 12, fontWeight: 400,
              color: activeTab === tab ? '#1A1A1A' : '#1A1A1A50',
              borderBottom: activeTab === tab ? '2px solid #1A1A1A' : '2px solid transparent',
              marginBottom: -1, letterSpacing: '0.05em', textTransform: 'capitalize',
            }}
          >
            {tab === 'documentacion' ? 'Documentación' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 16, padding: '8px 12px', background: '#FDF2F2', borderRadius: 3 }}>
          {error}
        </p>
      )}

      {/* ── Tab: Visitas ── */}
      {activeTab === 'visitas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#1A1A1A60' }}>
              {visits.length} visita{visits.length !== 1 ? 's' : ''} registrada{visits.length !== 1 ? 's' : ''}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowNewVisitModal(true)}
                style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}
              >
                + Nueva visita
              </button>
            )}
          </div>

          {visits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed #E0DDD8', borderRadius: 6 }}>
              <p style={{ fontSize: 13, color: '#1A1A1A40' }}>Sin visitas registradas</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visits.map(visit => {
                const stats = getVisitStats(visit.id)
                const vColor = DD_VISIT_STATUS_COLORS[visit.status]
                return (
                  <div
                    key={visit.id}
                    style={{
                      background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, padding: '18px 20px',
                      borderLeft: `4px solid ${vColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', marginBottom: 3 }}>
                          Visita {visit.fecha
                            ? new Date(visit.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                            : '(fecha pendiente)'}
                        </p>
                        <span style={{ fontSize: 9, color: vColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {DD_VISIT_STATUS_LABELS[visit.status]}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/visita/${visit.id}/mi-revision`)}
                          style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '6px 12px', fontSize: 11, cursor: 'pointer', color: '#1A1A1A80' }}
                        >
                          Mi revisión
                        </button>
                        <button
                          onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/visita/${visit.id}`)}
                          style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Ver visita →
                        </button>
                      </div>
                    </div>
                    {stats.total > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 10, color: '#1A1A1A40' }}>Progreso</span>
                          <span style={{ fontSize: 10, color: '#1A1A1A70' }}>{stats.done}/{stats.total} cards · {stats.progress}%</span>
                        </div>
                        <div style={{ background: '#F0EEE8', borderRadius: 20, height: 3, overflow: 'hidden' }}>
                          <div style={{ background: '#1A1A1A', height: '100%', width: `${stats.progress}%`, borderRadius: 20 }} />
                        </div>
                        {stats.incidencias > 0 && (
                          <p style={{ fontSize: 10, color: '#C0392B', marginTop: 6 }}>
                            {stats.incidencias} incidencia{stats.incidencias !== 1 ? 's' : ''} detectada{stats.incidencias !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Datos ── */}
      {activeTab === 'datos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: '#1A1A1A60' }}>Datos generales del activo</p>
            {isAdmin && !editingAsset && (
              <button onClick={() => setEditingAsset(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A60' }}>
                Editar
              </button>
            )}
          </div>

          {editingAsset ? (
            <div>
              {[
                { key: 'nombre', label: 'Nombre', type: 'input' },
                { key: 'direccion', label: 'Dirección', type: 'input' },
                { key: 'cliente', label: 'Cliente', type: 'input' },
                { key: 'superficie_m2', label: 'Superficie (m²)', type: 'input' },
                { key: 'uso_previsto', label: 'Uso previsto', type: 'input' },
                { key: 'alcance_dd', label: 'Alcance de la DD', type: 'textarea' },
                { key: 'limitaciones_generales', label: 'Limitaciones generales', type: 'textarea' },
              ].map(({ key, label, type }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{label}</label>
                  {type === 'textarea' ? (
                    <textarea
                      value={assetForm[key as keyof typeof assetForm]}
                      onChange={e => setAssetForm(prev => ({ ...prev, [key]: e.target.value }))}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      value={assetForm[key as keyof typeof assetForm]}
                      onChange={e => setAssetForm(prev => ({ ...prev, [key]: e.target.value }))}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}

              {/* Estado */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Estado</label>
                <select
                  value={asset.status}
                  onChange={e => handleStatusChange(e.target.value as DdAsset['status'])}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  {Object.entries(DD_ASSET_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditingAsset(false)} style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: '#1A1A1A80' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveAsset} disabled={isPending} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
                  {isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Dirección', value: asset.direccion },
                { label: 'Cliente', value: asset.cliente },
                { label: 'Superficie', value: asset.superficie_m2 ? `${asset.superficie_m2} m²` : null },
                { label: 'Uso previsto', value: asset.uso_previsto },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={labelStyle}>{label}</p>
                  <p style={{ fontSize: 13, color: value ? '#1A1A1A' : '#1A1A1A30' }}>{value ?? '—'}</p>
                </div>
              ))}
              {asset.alcance_dd && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={labelStyle}>Alcance de la DD</p>
                  <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.6 }}>{asset.alcance_dd}</p>
                </div>
              )}
              {asset.limitaciones_generales && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={labelStyle}>Limitaciones generales</p>
                  <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.6 }}>{asset.limitaciones_generales}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Documentación ── */}
      {activeTab === 'documentacion' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#1A1A1A60' }}>{docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
            {isAdmin && (
              <button onClick={() => setShowDocModal(true)} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}>
                + Añadir
              </button>
            )}
          </div>

          {docs.length === 0 ? (
            <p style={{ fontSize: 13, color: '#1A1A1A30' }}>Sin documentos registrados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['recibida', 'pendiente'].map(tipo => {
                const group = docs.filter(d => d.tipo === tipo)
                if (!group.length) return null
                return (
                  <div key={tipo} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: tipo === 'recibida' ? '#2D7D5A' : '#E67E22', marginBottom: 8 }}>
                      {tipo === 'recibida' ? 'Documentación recibida' : 'Documentación pendiente'}
                    </p>
                    {group.map(doc => (
                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0EEE8' }}>
                        <div>
                          <p style={{ fontSize: 13, color: '#1A1A1A' }}>{doc.nombre}</p>
                          {doc.notas && <p style={{ fontSize: 11, color: '#1A1A1A50' }}>{doc.notas}</p>}
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteDoc(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#1A1A1A30', padding: '0 4px' }}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal nueva visita */}
      {showNewVisitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewVisitModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 4, width: '100%', maxWidth: 380, padding: '24px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Nueva visita</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={visitForm.fecha} onChange={e => setVisitForm({ fecha: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewVisitModal(false)} style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreateVisit} disabled={isPending} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
                {isPending ? 'Creando...' : 'Crear visita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo doc */}
      {showDocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowDocModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 4, width: '100%', maxWidth: 400, padding: '24px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Añadir documento</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nombre</label>
              <input value={docForm.nombre} onChange={e => setDocForm(prev => ({ ...prev, nombre: e.target.value }))} style={inputStyle} placeholder="Ej: Nota Simple Registral" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Estado</label>
              <select value={docForm.tipo} onChange={e => setDocForm(prev => ({ ...prev, tipo: e.target.value as 'recibida' | 'pendiente' }))} style={{ ...inputStyle, width: 'auto' }}>
                <option value="recibida">Recibido</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Notas</label>
              <input value={docForm.notas} onChange={e => setDocForm(prev => ({ ...prev, notas: e.target.value }))} style={inputStyle} placeholder="Observación opcional" />
            </div>
            {error && <p style={{ fontSize: 11, color: '#C0392B', marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDocModal(false)} style={{ background: '#F8F7F4', border: '1px solid #E0DDD8', borderRadius: 3, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleAddDoc} disabled={isPending} style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

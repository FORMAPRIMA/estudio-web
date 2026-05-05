'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { updateDdCardBackoffice } from '@/app/actions/dd-visits'
import type { DdAsset, DdVisit, DdCard, DdRole, DdCardMedia, DdCardRiesgo } from '@/lib/dd-visits/domain'
import {
  DD_CARD_ESTADO_LABELS, DD_CARD_ESTADO_COLORS,
  DD_CARD_RIESGO_LABELS, DD_CARD_RIESGO_COLORS,
  DD_CARD_PRIORIDAD_COLORS,
} from '@/lib/dd-visits/domain'

interface Props {
  asset: DdAsset
  visits: DdVisit[]
  cards: DdCard[]
  roles: DdRole[]
  media: DdCardMedia[]
}

export default function DdRevisionInterna({ asset, visits, cards, roles, media }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedCard, setSelectedCard] = useState<DdCard | null>(null)
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterRiesgo, setFilterRiesgo] = useState('all')
  const [filterRol, setFilterRol] = useState('all')
  const [filterVisit, setFilterVisit] = useState('all')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [localCard, setLocalCard] = useState<DdCard | null>(null)

  const relevantCards = useMemo(() => {
    return cards.filter(c => {
      if (filterEstado !== 'all' && c.estado !== filterEstado) return false
      if (filterRiesgo !== 'all' && c.riesgo !== filterRiesgo) return false
      if (filterRol !== 'all' && c.rol_id !== filterRol) return false
      if (filterVisit !== 'all' && c.visit_id !== filterVisit) return false
      return true
    }).sort((a, b) => {
      const riskOrder: Record<string, number> = { alto: 0, medio: 1, bajo: 2, sin_riesgo: 3 }
      return (riskOrder[a.riesgo ?? 'sin_riesgo'] ?? 3) - (riskOrder[b.riesgo ?? 'sin_riesgo'] ?? 3)
    })
  }, [cards, filterEstado, filterRiesgo, filterRol, filterVisit])

  function openCard(card: DdCard) {
    setSelectedCard(card)
    setLocalCard({ ...card })
    setSaveError(null)
    setGenError(null)
  }

  function handleSaveBackoffice() {
    if (!localCard) return
    setSaveError(null)
    setSaving(true)
    startTransition(async () => {
      const result = await updateDdCardBackoffice(localCard.id, asset.id, {
        diagnostico_interno:          localCard.diagnostico_interno,
        impacto_potencial:            localCard.impacto_potencial,
        recomendacion_preliminar:     localCard.recomendacion_preliminar,
        capex_orientativo:            localCard.capex_orientativo,
        texto_propuesto_informe:      localCard.texto_propuesto_informe,
        texto_aprobado_informe:       localCard.texto_aprobado_informe,
        texto_aprobado:               localCard.texto_aprobado,
        nivel_criticidad_final:       localCard.nivel_criticidad_final,
        requiere_aclaracion_propiedad: localCard.requiere_aclaracion_propiedad,
        incluir_reporte_final:        localCard.incluir_reporte_final,
      })
      setSaving(false)
      if ('error' in result) { setSaveError(result.error); return }
      setSelectedCard(localCard)
    })
  }

  async function handleGenerateText() {
    if (!localCard) return
    if (!localCard.comentario_tecnico?.trim()) {
      setGenError('El técnico no dejó comentario en esta card.'); return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/dd-visits/profesionalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comentario_tecnico:  localCard.comentario_tecnico,
          titulo:              localCard.titulo,
          especialidad:        localCard.especialidad,
          zona_edificio:       localCard.zona_edificio,
          estado:              localCard.estado,
          riesgo:              localCard.riesgo,
          objetivo_revision:   localCard.objetivo_revision,
          senales_alerta:      localCard.senales_alerta,
        }),
      })
      const { texto, error } = await res.json()
      if (error) { setGenError(error); return }
      setLocalCard(prev => prev ? { ...prev, texto_propuesto_informe: texto } : prev)
    } catch {
      setGenError('Error de red al generar texto.')
    } finally {
      setGenerating(false)
    }
  }

  const cardMedia = selectedCard ? media.filter(m => m.card_id === selectedCard.id) : []
  const roleById = Object.fromEntries(roles.map(r => [r.id, r]))
  const visitById = Object.fromEntries(visits.map(v => [v.id, v]))

  const stats = {
    incidencia:          cards.filter(c => c.estado === 'incidencia').length,
    no_accesible:        cards.filter(c => c.estado === 'no_accesible').length,
    requiere_aclaracion: cards.filter(c => c.estado === 'requiere_aclaracion').length,
    seguimiento:         cards.filter(c => c.requiere_seguimiento).length,
    alto:                cards.filter(c => c.riesgo === 'alto').length,
    aprobados:           cards.filter(c => c.texto_aprobado).length,
    reporte:             cards.filter(c => c.incluir_reporte_final).length,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0DDD8', borderRadius: 3,
    padding: '8px 10px', fontSize: 12, color: '#1A1A1A',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#1A1A1A50', marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid #E8E6E0', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button onClick={() => router.push(`/team/apps/dd-visits/${asset.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A40', padding: 0 }}>
            {asset.nombre}
          </button>
          <span style={{ color: '#1A1A1A30', fontSize: 11 }}>/</span>
          <span style={{ fontSize: 11, color: '#1A1A1A70' }}>Revisión interna</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            Revisión interna — {asset.nombre}
          </h1>
          <button
            onClick={() => router.push(`/team/apps/dd-visits/${asset.id}/report`)}
            style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 3, padding: '8px 16px', fontSize: 11, cursor: 'pointer' }}
          >
            Report Builder →
          </button>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Incidencias', value: stats.incidencia, color: '#C0392B' },
            { label: 'No accesible', value: stats.no_accesible, color: '#E67E22' },
            { label: 'Requiere aclaración', value: stats.requiere_aclaracion, color: '#5B7FA6' },
            { label: 'Seguimiento', value: stats.seguimiento, color: '#7A6B8A' },
            { label: 'Riesgo alto', value: stats.alto, color: '#C0392B' },
            { label: 'Textos aprobados', value: stats.aprobados, color: '#2D7D5A' },
            { label: 'En reporte', value: stats.reporte, color: '#2D7D5A' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 10, color: '#1A1A1A50' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Lista de cards */}
        <div style={{ flex: selectedCard ? '0 0 42%' : '1 1 100%', overflowY: 'auto', borderRight: '1px solid #E8E6E0', background: '#F8F7F4' }}>
          {/* Filtros */}
          <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E8E6E0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              {
                value: filterEstado, setter: setFilterEstado,
                options: [
                  { v: 'all', l: 'Todo estado' },
                  { v: 'incidencia', l: 'Incidencia' },
                  { v: 'no_accesible', l: 'No accesible' },
                  { v: 'requiere_aclaracion', l: 'Requiere aclaración' },
                  { v: 'revisado_ok', l: 'Revisado OK' },
                  { v: 'pendiente', l: 'Pendiente' },
                  { v: 'no_aplica', l: 'No aplica' },
                ],
              },
              {
                value: filterRiesgo, setter: setFilterRiesgo,
                options: [{ v: 'all', l: 'Todo riesgo' }, { v: 'alto', l: 'Alto' }, { v: 'medio', l: 'Medio' }, { v: 'bajo', l: 'Bajo' }, { v: 'sin_riesgo', l: 'Sin riesgo' }],
              },
              {
                value: filterRol, setter: setFilterRol,
                options: [{ v: 'all', l: 'Todas las especialidades' }, ...roles.map(r => ({ v: r.id, l: r.nombre.split('/')[0].trim() }))],
              },
              {
                value: filterVisit, setter: setFilterVisit,
                options: [{ v: 'all', l: 'Todas las visitas' }, ...visits.map(v => ({ v: v.id, l: `Visita ${v.fecha ? new Date(v.fecha + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'sin fecha'}` }))],
              },
            ].map((f, i) => (
              <select
                key={i}
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                style={{ border: '1px solid #E0DDD8', borderRadius: 3, padding: '5px 8px', fontSize: 11, color: '#1A1A1A', background: '#FAFAF8' }}
              >
                {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>

          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 10, color: '#1A1A1A40', padding: '4px 0' }}>{relevantCards.length} cards</p>
            {relevantCards.map(card => {
              const rol = roleById[card.rol_id]
              const estadoColor = DD_CARD_ESTADO_COLORS[card.estado]
              const riesgoColor = card.riesgo ? DD_CARD_RIESGO_COLORS[card.riesgo] : null
              const isSelected = selectedCard?.id === card.id
              const mediaCount = media.filter(m => m.card_id === card.id).length
              return (
                <button
                  key={card.id}
                  onClick={() => openCard(card)}
                  style={{
                    background: isSelected ? '#1A1A1A' : '#fff', border: `1px solid ${isSelected ? '#1A1A1A' : '#E8E6E0'}`,
                    borderRadius: 6, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', width: '100%',
                    borderLeft: `4px solid ${estadoColor}`,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 500, color: isSelected ? '#fff' : '#1A1A1A', marginBottom: 5, lineHeight: 1.3 }}>
                    {card.titulo}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                    {rol && <span style={{ fontSize: 9, color: isSelected ? rol.color : rol.color, background: rol.color + '18', padding: '1px 6px', borderRadius: 10 }}>{rol.nombre.split('/')[0].trim()}</span>}
                    <span style={{ fontSize: 9, color: isSelected ? '#ffffff80' : estadoColor, background: isSelected ? '#ffffff15' : estadoColor + '18', padding: '1px 6px', borderRadius: 10 }}>
                      {DD_CARD_ESTADO_LABELS[card.estado]}
                    </span>
                    {card.riesgo && riesgoColor && (
                      <span style={{ fontSize: 9, color: riesgoColor, background: riesgoColor + '18', padding: '1px 6px', borderRadius: 10 }}>
                        {DD_CARD_RIESGO_LABELS[card.riesgo]}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {mediaCount > 0 && <span style={{ fontSize: 9, color: isSelected ? '#ffffff50' : '#1A1A1A40' }}>📷 {mediaCount}</span>}
                    {card.requiere_seguimiento && <span style={{ fontSize: 9, color: '#E67E22' }}>↻</span>}
                    {card.texto_aprobado && <span style={{ fontSize: 9, color: '#2D7D5A', fontWeight: 600 }}>✓ Aprobado</span>}
                    {card.incluir_reporte_final && <span style={{ fontSize: 9, color: '#5B7FA6' }}>📄 Reporte</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel de detalle */}
        {selectedCard && localCard && (
          <div style={{ flex: '1 1 0', overflowY: 'auto', background: '#fff' }}>
            <div style={{ padding: '20px 24px' }}>

              {/* Header de card */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 9, color: roleById[selectedCard.rol_id]?.color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {roleById[selectedCard.rol_id]?.nombre}
                  </p>
                  <button onClick={() => setSelectedCard(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#1A1A1A30', padding: 0 }}>×</button>
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 8, lineHeight: 1.3 }}>{selectedCard.titulo}</h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: DD_CARD_ESTADO_COLORS[selectedCard.estado] + '18', color: DD_CARD_ESTADO_COLORS[selectedCard.estado] }}>
                    {DD_CARD_ESTADO_LABELS[selectedCard.estado]}
                  </span>
                  {selectedCard.riesgo && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: DD_CARD_RIESGO_COLORS[selectedCard.riesgo] + '18', color: DD_CARD_RIESGO_COLORS[selectedCard.riesgo] }}>
                      Riesgo {DD_CARD_RIESGO_LABELS[selectedCard.riesgo]}
                    </span>
                  )}
                  {selectedCard.zona_edificio && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#F0EEE8', color: '#1A1A1A60' }}>
                      {selectedCard.zona_edificio}
                    </span>
                  )}
                </div>
              </div>

              {/* Comentario original del técnico */}
              <div style={{ marginBottom: 20, padding: '12px 14px', background: '#F8F7F4', borderRadius: 6, borderLeft: '3px solid #1A1A1A30' }}>
                <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A50', marginBottom: 6 }}>
                  Comentario original del técnico
                </p>
                {selectedCard.comentario_tecnico ? (
                  <p style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.7, fontFamily: 'inherit' }}>
                    {selectedCard.comentario_tecnico}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: '#1A1A1A30', fontStyle: 'italic' }}>Sin comentario del técnico</p>
                )}
                {selectedCard.planta && (
                  <p style={{ fontSize: 10, color: '#1A1A1A50', marginTop: 6 }}>
                    Planta: {selectedCard.planta}{selectedCard.zona ? ` · Zona: ${selectedCard.zona}` : ''}{selectedCard.estancia ? ` · ${selectedCard.estancia}` : ''}
                  </p>
                )}
              </div>

              {/* Fotos */}
              {cardMedia.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={labelStyle}>Fotos y vídeos ({cardMedia.length})</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {cardMedia.map(m => (
                      <div key={m.id} style={{ width: 72, height: 72, borderRadius: 4, overflow: 'hidden', background: '#F0EEE8', flexShrink: 0 }}>
                        {m.tipo === 'video'
                          ? <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          : <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: '#E8E6E0', marginBottom: 20 }} />

              {/* Texto propuesto para informe */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={labelStyle}>Texto propuesto para informe</label>
                  <button
                    onClick={handleGenerateText}
                    disabled={generating || !localCard.comentario_tecnico}
                    style={{
                      background: generating ? '#F0EEE8' : '#1A1A1A', color: generating ? '#888' : '#fff',
                      border: 'none', borderRadius: 3, padding: '5px 10px', fontSize: 10, cursor: generating ? 'wait' : 'pointer',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {generating ? 'Generando...' : '✦ Generar con IA'}
                  </button>
                </div>

                {genError && <p style={{ fontSize: 11, color: '#C0392B', marginBottom: 8 }}>{genError}</p>}

                <textarea
                  value={localCard.texto_propuesto_informe ?? ''}
                  onChange={e => setLocalCard(prev => prev ? { ...prev, texto_propuesto_informe: e.target.value || null } : prev)}
                  placeholder="Texto borrador para el informe. Generado por IA a partir del comentario del técnico o redactado manualmente."
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: 10, color: '#1A1A1A40', marginTop: 4 }}>
                  El comentario original del técnico nunca se modifica. Este es un borrador editable.
                </p>
              </div>

              {/* Texto aprobado final */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Texto aprobado para informe final</label>
                <textarea
                  value={localCard.texto_aprobado_informe ?? ''}
                  onChange={e => setLocalCard(prev => prev ? { ...prev, texto_aprobado_informe: e.target.value || null } : prev)}
                  placeholder="Versión final aprobada. Si se deja vacía, se usará el texto propuesto si está aprobado."
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
                />
              </div>

              {/* Campos de análisis */}
              {[
                { key: 'diagnostico_interno',      label: 'Diagnóstico interno',             rows: 2 },
                { key: 'impacto_potencial',         label: 'Impacto potencial',               rows: 2 },
                { key: 'recomendacion_preliminar',  label: 'Recomendación preliminar',        rows: 2 },
                { key: 'capex_orientativo',         label: 'CAPEX orientativo',               rows: 1 },
              ].map(({ key, label, rows }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{label}</label>
                  <textarea
                    value={(localCard as any)[key] ?? ''}
                    onChange={e => setLocalCard(prev => prev ? { ...prev, [key]: e.target.value || null } : prev)}
                    rows={rows}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
                  />
                </div>
              ))}

              {/* Nivel de criticidad final */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nivel de criticidad final</label>
                <select
                  value={localCard.nivel_criticidad_final ?? ''}
                  onChange={e => setLocalCard(prev => prev ? { ...prev, nivel_criticidad_final: (e.target.value || null) as DdCardRiesgo | null } : prev)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="">Sin asignar</option>
                  <option value="sin_riesgo">Sin riesgo</option>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>

              {/* Checkboxes de revisión */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { field: 'texto_aprobado' as const,               label: 'Texto aprobado para informe' },
                  { field: 'incluir_reporte_final' as const,         label: 'Incluir en reporte final' },
                  { field: 'requiere_aclaracion_propiedad' as const, label: 'Requiere aclaración a propiedad' },
                ].map(({ field, label }) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={localCard[field] as boolean}
                      onChange={e => setLocalCard(prev => prev ? { ...prev, [field]: e.target.checked } : prev)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 12, color: '#1A1A1A' }}>{label}</span>
                  </label>
                ))}
              </div>

              {saveError && (
                <p style={{ fontSize: 11, color: '#C0392B', marginBottom: 10, padding: '6px 10px', background: '#FDF2F2', borderRadius: 3 }}>
                  {saveError}
                </p>
              )}

              <button
                onClick={handleSaveBackoffice}
                disabled={saving || isPending}
                style={{
                  width: '100%', background: '#1A1A1A', color: '#fff', border: 'none',
                  borderRadius: 4, padding: '12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {saving ? 'Guardando...' : 'Guardar análisis'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

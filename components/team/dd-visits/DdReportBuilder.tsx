'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { DdAsset, DdCard, DdCardMedia, DdRole, DdVisit } from '@/lib/dd-visits/domain'
import {
  DD_CARD_ESTADO_LABELS, DD_CARD_ESTADO_COLORS,
  DD_CARD_RIESGO_LABELS, DD_CARD_RIESGO_COLORS,
  DD_DEFAULT_DISCLAIMER,
} from '@/lib/dd-visits/domain'
import { updateDdCardBackoffice } from '@/app/actions/dd-visits'

interface Props {
  asset: DdAsset
  visits: DdVisit[]
  cards: DdCard[]
  roles: DdRole[]
  media: DdCardMedia[]
}

export default function DdReportBuilder({ asset, visits, cards, roles, media }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [resumenEjecutivo, setResumenEjecutivo] = useState(
    visits.find(v => v.resumen_ejecutivo)?.resumen_ejecutivo ?? ''
  )
  const [disclaimerText, setDisclaimerText] = useState(
    asset.disclaimer_texto ?? DD_DEFAULT_DISCLAIMER
  )
  const [filterRolId, setFilterRolId] = useState<string | 'all'>('all')
  const [isGenerating, setIsGenerating] = useState(false)
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(cards.map(c => [c.id, c.incluir_reporte_final]))
  )

  const activeCards = useMemo(() => cards.filter(c => c.activo), [cards])
  const reviewCards = useMemo(() => activeCards.filter(c => c.incluir_revision_interna), [activeCards])
  const approvedCards = useMemo(() => reviewCards.filter(c => c.texto_aprobado && !!c.texto_aprobado_informe), [reviewCards])
  const includedCards = useMemo(() => approvedCards.filter(c => includeMap[c.id]), [approvedCards, includeMap])
  const highRiskCards = useMemo(() => activeCards.filter(c => (c.nivel_criticidad_final ?? c.riesgo) === 'alto'), [activeCards])
  const pendingApproval = useMemo(() => reviewCards.filter(c => !c.texto_aprobado), [reviewCards])

  const mediaMap = useMemo(() => {
    const m: Record<string, DdCardMedia[]> = {}
    for (const item of media) {
      if (!m[item.card_id]) m[item.card_id] = []
      m[item.card_id].push(item)
    }
    return m
  }, [media])

  const includedMediaCount = useMemo(
    () => includedCards.reduce((sum, c) => sum + (mediaMap[c.id]?.length ?? 0), 0),
    [includedCards, mediaMap]
  )

  const filteredCards = useMemo(() => {
    const base = filterRolId === 'all' ? reviewCards : reviewCards.filter(c => c.rol_id === filterRolId)
    return base.sort((a, b) => {
      const order: Record<string, number> = { incidencia: 0, requiere_aclaracion: 1, no_accesible: 2, pendiente: 3, revisado_ok: 4, no_aplica: 5 }
      return (order[a.estado] ?? 3) - (order[b.estado] ?? 3)
    })
  }, [reviewCards, filterRolId])

  async function toggleInclude(cardId: string) {
    const next = !includeMap[cardId]
    setIncludeMap(prev => ({ ...prev, [cardId]: next }))
    startTransition(async () => {
      await updateDdCardBackoffice(cardId, asset.id, { incluir_reporte_final: next })
      router.refresh()
    })
  }

  async function generatePdf() {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/dd-visits/report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          resumenEjecutivo: resumenEjecutivo || undefined,
          disclaimerOverride: disclaimerText !== DD_DEFAULT_DISCLAIMER ? disclaimerText : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Error generando el PDF')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch {
      alert('Error generando el PDF')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ background: '#F8F7F4', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#1A1A1A', padding: '16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1200, margin: '0 auto' }}>
          <button
            onClick={() => router.push(`/team/apps/dd-visits/${asset.id}`)}
            style={{ background: 'none', border: 'none', color: '#ffffff60', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1, flexShrink: 0 }}
          >←</button>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#ffffff50', marginBottom: 2 }}>
              {asset.nombre} · Due Diligence
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: '#fff', letterSpacing: '-0.01em' }}>
              Report Builder
            </h1>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0', padding: '12px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Textos aprobados', value: approvedCards.length, color: '#2D7D5A' },
            { label: 'Incluidos en reporte', value: includedCards.length, color: '#1A1A1A' },
            { label: 'Riesgo alto', value: highRiskCards.length, color: '#C0392B' },
            { label: 'Pendientes de aprobar', value: pendingApproval.length, color: pendingApproval.length > 0 ? '#E67E22' : '#AAAAAA' },
            { label: 'Cards revisadas', value: reviewCards.length, color: '#888' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</span>
              <span style={{ fontSize: 10, color: '#1A1A1A50' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Left: card list */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Cards para el informe
            </h2>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilterRolId('all')}
                style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: filterRolId === 'all' ? 600 : 400,
                  background: filterRolId === 'all' ? '#1A1A1A' : '#F0EEE8',
                  color: filterRolId === 'all' ? '#fff' : '#1A1A1A60',
                }}
              >
                Todas
              </button>
              {roles.filter(r => r.activo && reviewCards.some(c => c.rol_id === r.id)).map(rol => (
                <button
                  key={rol.id}
                  onClick={() => setFilterRolId(filterRolId === rol.id ? 'all' : rol.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 10, fontWeight: filterRolId === rol.id ? 600 : 400,
                    background: filterRolId === rol.id ? rol.color : '#F0EEE8',
                    color: filterRolId === rol.id ? '#fff' : '#1A1A1A60',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rol.nombre.split('/')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {filteredCards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#1A1A1A40', fontSize: 13 }}>
              No hay cards marcadas para revisión interna
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCards.map(card => {
              const rol = roles.find(r => r.id === card.rol_id)
              const isApproved = card.texto_aprobado && !!card.texto_aprobado_informe
              const isIncluded = isApproved && includeMap[card.id]
              const cardMedia = mediaMap[card.id] ?? []
              const estadoColor = DD_CARD_ESTADO_COLORS[card.estado]
              const riesgoFinal = card.nivel_criticidad_final ?? card.riesgo
              const riesgoColor = riesgoFinal ? DD_CARD_RIESGO_COLORS[riesgoFinal] : null

              return (
                <div
                  key={card.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #E8E6E0',
                    borderLeft: `4px solid ${isIncluded ? '#2D7D5A' : isApproved ? '#5B7FA6' : '#E0DDD8'}`,
                    borderRadius: 6,
                    padding: '12px 14px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    opacity: isApproved ? 1 : 0.55,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {/* Toggle checkbox */}
                  <button
                    onClick={() => isApproved && !isPending && toggleInclude(card.id)}
                    disabled={!isApproved || isPending}
                    title={!isApproved ? 'Texto pendiente de aprobar' : isIncluded ? 'Excluir del reporte' : 'Incluir en reporte'}
                    style={{
                      width: 22, height: 22, borderRadius: 4, border: `2px solid ${isIncluded ? '#2D7D5A' : '#D0CDC8'}`,
                      cursor: isApproved ? 'pointer' : 'default',
                      background: isIncluded ? '#2D7D5A' : 'transparent',
                      color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {isIncluded ? '✓' : ''}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', flex: 1, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                        {card.titulo}
                      </p>
                      {isApproved ? (
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                          background: '#2D7D5A18', color: '#2D7D5A',
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>
                          Aprobado
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                          background: '#E67E2218', color: '#E67E22',
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>
                          Sin texto
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: isApproved && card.texto_aprobado_informe ? 6 : 0 }}>
                      {rol && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: rol.color + '18', color: rol.color }}>
                          {rol.nombre.split('/')[0].trim()}
                        </span>
                      )}
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: estadoColor + '18', color: estadoColor }}>
                        {DD_CARD_ESTADO_LABELS[card.estado]}
                      </span>
                      {riesgoFinal && riesgoColor && (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: riesgoColor, display: 'inline-block' }} />
                          <span style={{ fontSize: 10, color: riesgoColor, fontWeight: 500 }}>
                            {DD_CARD_RIESGO_LABELS[riesgoFinal]}
                          </span>
                        </div>
                      )}
                      {cardMedia.length > 0 && (
                        <span style={{ fontSize: 10, color: '#1A1A1A50' }}>
                          📷 {cardMedia.length}
                        </span>
                      )}
                      {card.capex_orientativo && (
                        <span style={{ fontSize: 10, color: '#7A6B8A', fontWeight: 500 }}>
                          CAPEX {card.capex_orientativo}
                        </span>
                      )}
                      {card.zona_edificio && (
                        <span style={{ fontSize: 10, color: '#1A1A1A50', background: '#F0EEE8', padding: '1px 6px', borderRadius: 20 }}>
                          {card.zona_edificio}
                        </span>
                      )}
                    </div>

                    {isApproved && card.texto_aprobado_informe && (
                      <p style={{ fontSize: 11, color: '#1A1A1A50', lineHeight: 1.5, fontStyle: 'italic', marginTop: 4 }}>
                        &ldquo;{card.texto_aprobado_informe.length > 140
                          ? card.texto_aprobado_informe.slice(0, 140) + '…'
                          : card.texto_aprobado_informe}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Warning */}
          {pendingApproval.length > 0 && (
            <div style={{ background: '#E67E2210', border: '1px solid #E67E2240', borderRadius: 6, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#E67E22', fontWeight: 600 }}>
                ⚠ {pendingApproval.length} card{pendingApproval.length !== 1 ? 's' : ''} sin texto aprobado
              </p>
              <p style={{ fontSize: 10, color: '#E67E22', marginTop: 3, lineHeight: 1.5 }}>
                Solo se incluirán en el PDF las cards con texto aprobado e incluidas en reporte.
              </p>
            </div>
          )}

          {/* Resumen ejecutivo */}
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, padding: '16px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Resumen ejecutivo
            </p>
            <textarea
              value={resumenEjecutivo}
              onChange={e => setResumenEjecutivo(e.target.value)}
              rows={8}
              placeholder="Texto del resumen ejecutivo que aparecerá en la portada del informe…"
              style={{
                width: '100%', border: '1px solid #E0DDD8', borderRadius: 4,
                padding: '10px 12px', fontSize: 12, lineHeight: 1.6, color: '#1A1A1A',
                resize: 'vertical', minHeight: 110, fontFamily: 'inherit', background: '#FAFAF8',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 9, color: '#1A1A1A35', marginTop: 5 }}>
              Solo se usa para generar el PDF — no se guarda en BD.
            </p>
          </div>

          {/* Disclaimer */}
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Disclaimer
              </p>
              <button
                onClick={() => setDisclaimerText(DD_DEFAULT_DISCLAIMER)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#1A1A1A40', padding: 0 }}
              >
                Restaurar
              </button>
            </div>
            <textarea
              value={disclaimerText}
              onChange={e => setDisclaimerText(e.target.value)}
              rows={5}
              style={{
                width: '100%', border: '1px solid #E0DDD8', borderRadius: 4,
                padding: '10px 12px', fontSize: 11, lineHeight: 1.6, color: '#1A1A1A70',
                resize: 'vertical', minHeight: 80, fontFamily: 'inherit', background: '#FAFAF8',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Generate PDF */}
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, padding: '16px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Generar informe
            </p>

            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', letterSpacing: '-0.02em' }}>{includedCards.length}</p>
                <p style={{ fontSize: 10, color: '#1A1A1A50' }}>cards incluidas</p>
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', letterSpacing: '-0.02em' }}>{includedMediaCount}</p>
                <p style={{ fontSize: 10, color: '#1A1A1A50' }}>fotos</p>
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 500, color: '#C0392B', letterSpacing: '-0.02em' }}>
                  {includedCards.filter(c => (c.nivel_criticidad_final ?? c.riesgo) === 'alto').length}
                </p>
                <p style={{ fontSize: 10, color: '#1A1A1A50' }}>riesgo alto</p>
              </div>
            </div>

            <button
              onClick={generatePdf}
              disabled={isGenerating || includedCards.length === 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 6, border: 'none',
                cursor: isGenerating || includedCards.length === 0 ? 'not-allowed' : 'pointer',
                background: isGenerating
                  ? '#888'
                  : includedCards.length === 0
                    ? '#E0DDD8'
                    : '#1A1A1A',
                color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em',
                transition: 'background 0.15s',
              }}
            >
              {isGenerating ? 'Generando…' : 'Generar PDF →'}
            </button>

            {includedCards.length === 0 && !isGenerating && (
              <p style={{ fontSize: 10, color: '#E67E22', marginTop: 8, textAlign: 'center' }}>
                Activa al menos una card para generar el reporte.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

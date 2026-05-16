'use client'

import React, { useState } from 'react'
import type { ObraActaRow } from '@/lib/fp-execution/obra-presupuesto'

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const STATUS_LABEL: Record<ObraActaRow['status'], string> = {
  generada:     'Generada',
  sent_to_sign: 'Enviada a firma',
  signed:       'Firmada',
  received:     'Recibida',
  anulada:      'Anulada',
}
const STATUS_COLOR: Record<ObraActaRow['status'], string> = {
  generada:     '#888',
  sent_to_sign: '#D85A30',
  signed:       '#059669',
  received:     '#059669',
  anulada:      '#DC2626',
}

export default function ActasList({
  actas,
  onSendToDocuSign,
  highlightedActaIds,
}: {
  actas:               ObraActaRow[]
  onSendToDocuSign:    (actaId: string) => Promise<void>
  highlightedActaIds:  string[]
}) {
  const [sending, setSending] = useState<string | null>(null)

  if (actas.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px dashed #E8E6E0', borderRadius: 8,
        padding: '24px 20px', textAlign: 'center', color: '#888', fontSize: 12,
      }}>
        Aún no se han generado actas en este proyecto. Las actas se generan al cerrar una sesión de cambios.
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 16px', background: '#FAFAF8', borderBottom: '1px solid #E8E6E0',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888',
      }}>
        Actas de modificación · {actas.length}
      </div>
      {actas.map(a => {
        const isHL = highlightedActaIds.includes(a.id)
        return (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
            borderTop: '1px solid #F0EEE8',
            background: isHL ? '#FFF7ED' : '#fff',
          }}>
            <span style={{
              padding: '3px 8px', fontSize: 10, fontWeight: 700,
              borderRadius: 4, background: a.kind === 'cliente' ? '#378ADD' : '#7C3AED', color: '#fff',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {a.kind}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
              {a.codigo}
            </span>
            <span style={{ fontSize: 11, color: '#888' }}>
              {new Date(a.generated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: a.total_delta_monto > 0 ? '#D85A30' : a.total_delta_monto < 0 ? '#059669' : '#888' }}>
              {a.total_delta_monto >= 0 ? '+' : ''}{euros(a.total_delta_monto)}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{
              padding: '2px 8px', fontSize: 9, fontWeight: 700,
              borderRadius: 3, background: STATUS_COLOR[a.status], color: '#fff',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {STATUS_LABEL[a.status]}
            </span>
            <a
              href={`/api/obra/actas/${a.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent', border: '1px solid #E8E6E0', borderRadius: 5,
                padding: '5px 10px', fontSize: 11, fontWeight: 600,
                color: '#1A1A1A', cursor: 'pointer', fontFamily: 'inherit',
                textDecoration: 'none',
              }}
            >Ver PDF</a>
            {a.kind === 'cliente' && a.status === 'generada' && (
              <button
                type="button"
                onClick={async () => {
                  setSending(a.id)
                  await onSendToDocuSign(a.id)
                  setSending(null)
                }}
                disabled={sending === a.id}
                style={{
                  background: '#D85A30', border: 'none', borderRadius: 5,
                  padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  color: '#fff', cursor: sending === a.id ? 'wait' : 'pointer', fontFamily: 'inherit',
                  opacity: sending === a.id ? 0.7 : 1,
                }}
              >{sending === a.id ? 'Enviando…' : 'Enviar a firma'}</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

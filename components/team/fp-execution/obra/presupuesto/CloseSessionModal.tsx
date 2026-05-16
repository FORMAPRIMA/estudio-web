'use client'

import React, { useMemo, useState } from 'react'
import { ModalShell } from './EditPartidaModal'
import { closeObraChangeSession } from '@/app/actions/fpe-obra-presupuesto'
import type { ObraChangeLogRow } from '@/lib/fp-execution/obra-presupuesto'

export default function CloseSessionModal({
  sessionId,
  log,
  onClose,
  onClosed,
}: {
  sessionId: string
  log:       ObraChangeLogRow[]
  onClose:   () => void
  onClosed:  (actaIds: string[]) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const summary = useMemo(() => {
    const cliente = log.filter(l => l.destino_acta === 'cliente')
    const interna = log.filter(l => l.destino_acta === 'interna')
    return {
      cliente: { count: cliente.length, total: cliente.reduce((a, l) => a + Number(l.delta_monto), 0) },
      interna: { count: interna.length, total: interna.reduce((a, l) => a + Number(l.delta_monto), 0) },
    }
  }, [log])

  const handleConfirm = async () => {
    setConfirming(true); setErr(null)
    const res = await closeObraChangeSession(sessionId)
    setConfirming(false)
    if ('error' in res) { setErr(res.error); return }
    onClosed(res.acta_ids)
  }

  const willGenerate: string[] = []
  if (summary.cliente.count > 0) willGenerate.push('cliente')
  if (summary.interna.count > 0) willGenerate.push('interna')

  return (
    <ModalShell title="Cerrar sesión de cambios" subtitle={`${log.length} cambio${log.length !== 1 ? 's' : ''} registrado${log.length !== 1 ? 's' : ''}`} onClose={onClose}>
      {log.length === 0 ? (
        <div style={{ fontSize: 12, color: '#888', padding: '12px 0' }}>
          No hay cambios en esta sesión. Cancela la sesión en su lugar.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: 14 }}>
            Al confirmar se aplican <strong>{log.length}</strong> cambio{log.length !== 1 ? 's' : ''} al presupuesto vivo
            y se genera{willGenerate.length === 1 ? '' : 'n'} <strong>{willGenerate.length} acta{willGenerate.length !== 1 ? 's' : ''}</strong>.
          </div>

          {summary.cliente.count > 0 && (
            <SummaryCard
              kind="cliente"
              count={summary.cliente.count}
              total={summary.cliente.total}
            />
          )}
          {summary.interna.count > 0 && (
            <SummaryCard
              kind="interna"
              count={summary.interna.count}
              total={summary.interna.total}
            />
          )}

          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.55, marginTop: 12 }}>
            La acta cliente se podrá enviar a DocuSign desde la lista de actas para que la propiedad la firme.
            La acta interna queda como documento descargable.
          </div>
        </>
      )}

      {err && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          padding: '8px 12px', marginTop: 14, fontSize: 12, color: '#DC2626',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button
          type="button" onClick={onClose} disabled={confirming}
          style={{
            background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#666',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Volver</button>
        <button
          type="button" onClick={handleConfirm}
          disabled={log.length === 0 || confirming}
          style={{
            background: log.length === 0 ? '#CCC' : '#D85A30',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 18px', fontSize: 12, fontWeight: 700,
            cursor: log.length === 0 ? 'not-allowed' : (confirming ? 'wait' : 'pointer'),
            fontFamily: 'inherit',
          }}
        >{confirming ? 'Aplicando…' : 'Confirmar y generar acta(s)'}</button>
      </div>
    </ModalShell>
  )
}

function SummaryCard({ kind, count, total }: { kind: 'cliente' | 'interna'; count: number; total: number }) {
  const isPositive = total > 0
  const color   = isPositive ? '#D85A30' : total < 0 ? '#059669' : '#888'
  return (
    <div style={{
      border: '1px solid #E8E6E0', borderLeftWidth: 3, borderLeftColor: kind === 'cliente' ? '#378ADD' : '#7C3AED',
      borderRadius: 6, padding: '10px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>
          Acta {kind}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginTop: 2 }}>
          {count} cambio{count !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {total >= 0 ? '+' : ''}{total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
      </div>
    </div>
  )
}

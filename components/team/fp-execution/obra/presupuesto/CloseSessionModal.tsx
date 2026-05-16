'use client'

import React, { useMemo, useState } from 'react'
import { ModalShell } from './EditPartidaModal'
import { closeObraChangeSession } from '@/app/actions/fpe-obra-presupuesto'
import type { ObraChangeLogRow } from '@/lib/fp-execution/obra-presupuesto'

export default function CloseSessionModal({
  sessionId,
  log,
  projectClient,
  onClose,
  onClosed,
}: {
  sessionId:     string
  log:           ObraChangeLogRow[]
  projectClient: { nombre: string; nif: string | null; email: string | null } | null
  onClose:       () => void
  onClosed:      (actaIds: string[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [stage, setStage] = useState<'preview' | 'sending'>('preview')

  const summary = useMemo(() => {
    const cliente = log.filter(l => l.destino_acta === 'cliente')
    const interna = log.filter(l => l.destino_acta === 'interna')
    return {
      cliente: { count: cliente.length, total: cliente.reduce((a, l) => a + Number(l.delta_monto), 0) },
      interna: { count: interna.length, total: interna.reduce((a, l) => a + Number(l.delta_monto), 0) },
    }
  }, [log])

  const hasCliente = summary.cliente.count > 0
  const hasInterna = summary.interna.count > 0
  const canSendCliente = hasCliente && !!projectClient?.email
  const blockingClienteIssue = hasCliente && !projectClient?.email

  const handleConfirm = async () => {
    if (blockingClienteIssue) {
      setErr('No hay email del cliente para enviar el acta. Configura el cliente del proyecto vinculado antes de cerrar.')
      return
    }
    setBusy(true); setErr(null); setStage('sending')

    // 1. Cerrar sesión: aplica interna + genera actas (cliente queda 'generada').
    const closeRes = await closeObraChangeSession(sessionId)
    if ('error' in closeRes) {
      setBusy(false); setStage('preview')
      setErr(closeRes.error); return
    }

    // 2. Si hay acta cliente, enviarla a DocuSign de inmediato.
    if (closeRes.acta_cliente_id && canSendCliente) {
      try {
        const res = await fetch(`/api/obra/actas/${closeRes.acta_cliente_id}/docusign`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({}),
        })
        const data = await res.json()
        if (!res.ok) {
          setBusy(false); setStage('preview')
          setErr(`Sesión cerrada y actas generadas, pero falló el envío a DocuSign: ${data.error ?? 'desconocido'}. Reintenta desde la lista de actas.`)
          // Aún así, propagamos onClosed para refrescar (la sesión sí se cerró)
          setTimeout(() => onClosed(closeRes.acta_ids), 2000)
          return
        }
      } catch (e) {
        setBusy(false); setStage('preview')
        setErr(`Sesión cerrada pero DocuSign falló: ${e instanceof Error ? e.message : 'desconocido'}`)
        setTimeout(() => onClosed(closeRes.acta_ids), 2000)
        return
      }
    }

    onClosed(closeRes.acta_ids)
  }

  return (
    <ModalShell
      title="Cerrar sesión de cambios"
      subtitle={`${log.length} cambio${log.length !== 1 ? 's' : ''} registrado${log.length !== 1 ? 's' : ''}`}
      onClose={onClose}
    >
      {log.length === 0 ? (
        <div style={{ fontSize: 12, color: '#888', padding: '12px 0' }}>
          No hay cambios en esta sesión. Cancela la sesión en su lugar.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: 14 }}>
            {hasCliente && hasInterna && 'Se aplicarán los cambios internos al presupuesto vivo de inmediato y se enviará la acta cliente a la propiedad para firma. Hasta que el cliente firme, los cambios cliente aparecerán como “pendiente aprobación” en la tabla.'}
            {hasCliente && !hasInterna && 'Se generará el acta cliente y se enviará a la propiedad para firma. Hasta que el cliente firme, los cambios cliente aparecerán como “pendiente aprobación” en la tabla.'}
            {!hasCliente && hasInterna && 'Se generará un acta interna y los cambios se aplicarán al presupuesto vivo de inmediato.'}
          </div>

          {hasInterna && (
            <SummaryCard kind="interna" count={summary.interna.count} total={summary.interna.total} />
          )}
          {hasCliente && (
            <SummaryCard kind="cliente" count={summary.cliente.count} total={summary.cliente.total} />
          )}

          {/* Disclaimer del envío al cliente */}
          {hasCliente && (
            <div style={{
              marginTop: 14,
              background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
              padding: '14px 16px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#1E40AF', marginBottom: 8,
              }}>
                Acta cliente — datos de envío
              </div>
              {projectClient?.email ? (
                <>
                  <div style={{ fontSize: 12, color: '#1A1A1A', marginBottom: 6 }}>
                    <strong>{projectClient.nombre}</strong>
                    {projectClient.nif && (
                      <span style={{ color: '#666', marginLeft: 8 }}>· NIF {projectClient.nif}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#1A1A1A', fontFamily: 'monospace' }}>
                    📧 {projectClient.email}
                  </div>
                  <div style={{ fontSize: 11, color: '#1E40AF', marginTop: 10, lineHeight: 1.5 }}>
                    Al confirmar, se enviará el acta vía DocuSign a este email. El cliente recibirá
                    un correo con enlace a la firma electrónica. Los cambios marcados como
                    “a petición de cliente” o “trasladable al cliente” quedarán pendientes hasta
                    que firme.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#9A3412', lineHeight: 1.5 }}>
                  ⚠ No se encontró el email del cliente. Configura el cliente del proyecto vinculado
                  antes de cerrar, o cancela la sesión para no enviar el acta automáticamente.
                </div>
              )}
            </div>
          )}
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
          type="button" onClick={onClose} disabled={busy}
          style={{
            background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#666',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Volver</button>
        <button
          type="button" onClick={handleConfirm}
          disabled={log.length === 0 || busy || blockingClienteIssue}
          style={{
            background: (log.length === 0 || blockingClienteIssue) ? '#CCC' : '#D85A30',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 18px', fontSize: 12, fontWeight: 700,
            cursor: (log.length === 0 || blockingClienteIssue) ? 'not-allowed' : (busy ? 'wait' : 'pointer'),
            fontFamily: 'inherit',
          }}
        >
          {busy
            ? (stage === 'sending' ? 'Aplicando y enviando…' : 'Aplicando…')
            : hasCliente
              ? 'Confirmar, generar y enviar a firma'
              : 'Confirmar y generar acta'}
        </button>
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

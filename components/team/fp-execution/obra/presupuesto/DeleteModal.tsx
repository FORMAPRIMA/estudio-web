'use client'

import React, { useState } from 'react'
import { ModalShell, Label, inputStyle, Actions } from './EditPartidaModal'
import { logDeletePartida, logDeleteUnit } from '@/app/actions/fpe-obra-presupuesto'

export default function DeleteModal({
  sessionId,
  kind,
  targetId,
  targetLabel,
  totalMonto,
  onClose,
  onSaved,
}: {
  sessionId:   string
  kind:        'partida' | 'unit'
  targetId:    string
  targetLabel: string
  totalMonto:  number
  onClose:     () => void
  onSaved:     () => void
}) {
  const [razon, setRazon] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const canConfirm = razon.trim().length >= 40 && !saving

  const handleConfirm = async () => {
    setSaving(true); setErr(null)
    const res = kind === 'partida'
      ? await logDeletePartida({ session_id: sessionId, partida_id: targetId, razon: razon.trim() })
      : await logDeleteUnit({    session_id: sessionId, unit_id:    targetId, razon: razon.trim() })
    setSaving(false)
    if ('error' in res) { setErr(res.error); return }
    onSaved()
  }

  return (
    <ModalShell
      title={kind === 'partida' ? 'Eliminar partida' : 'Eliminar unidad de ejecución'}
      subtitle={targetLabel}
      onClose={onClose}
    >
      <div style={{
        background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 7,
        padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#9A3412', lineHeight: 1.5,
      }}>
        Esta {kind === 'partida' ? 'partida' : 'unidad de ejecución'} se eliminará al cerrar la sesión.
        El delta económico será de <strong>-{totalMonto.toFixed(2)} €</strong> y se documentará en el acta interna.
        En el cierre de obra podrá reflejarse al cliente como ahorro.
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Razón ({razon.length} / 40 mín.)</Label>
        <textarea
          value={razon} onChange={e => setRazon(e.target.value)}
          rows={3}
          placeholder="Explica por qué se elimina esta entrada."
          style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
        />
      </div>

      <Actions
        err={err}
        onClose={onClose}
        onConfirm={handleConfirm}
        confirmEnabled={canConfirm}
        saving={saving}
        confirmLabel={`Eliminar (${kind === 'partida' ? 'partida' : 'UE'})`}
      />
    </ModalShell>
  )
}

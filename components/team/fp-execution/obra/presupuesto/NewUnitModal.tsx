'use client'

import React, { useState } from 'react'
import CategorizationFields, { emptyCategorization, categorizationReady, type CategorizationValue } from './CategorizationFields'
import { logNewUnit } from '@/app/actions/fpe-obra-presupuesto'
import { ModalShell, Label, inputStyle, Actions } from './EditPartidaModal'

export default function NewUnitModal({
  sessionId,
  chapterId,
  chapterNombre,
  partners,
  onClose,
  onSaved,
}: {
  sessionId:     string
  chapterId:     string
  chapterNombre: string
  partners:      Array<{ id: string; nombre: string }>
  onClose:       () => void
  onSaved:       () => void
}) {
  const [nombre, setNombre]           = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [partnerId, setPartnerId]     = useState<string>('')
  const [cat, setCat] = useState<CategorizationValue>(emptyCategorization)
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState<string | null>(null)

  const validBasics = nombre.trim().length >= 3 && partnerId !== ''
  const canConfirm  = validBasics && categorizationReady(cat) && !saving

  const ctx = `Nueva unidad de ejecución "${nombre.trim()}" en capítulo "${chapterNombre}", asignada al partner ${partners.find(p => p.id === partnerId)?.nombre ?? '—'}.`

  const handleConfirm = async () => {
    setSaving(true); setErr(null)
    const res = await logNewUnit({
      session_id:    sessionId,
      chapter_id:    chapterId,
      nombre:        nombre.trim(),
      descripcion:   descripcion.trim() || null,
      partner_id:    partnerId,
      categoria:     cat.categoria!,
      sub_categoria: cat.sub_categoria,
      razon:         cat.razon.trim(),
    })
    setSaving(false)
    if ('error' in res) { setErr(res.error); return }
    onSaved()
  }

  return (
    <ModalShell title="Nueva unidad de ejecución" subtitle={`Capítulo: ${chapterNombre}`} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Nombre de la UE</Label>
        <input
          type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Solado y rodapié en zona de cocina ampliada"
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Descripción (opcional)</Label>
        <textarea
          value={descripcion} onChange={e => setDescripcion(e.target.value)}
          rows={2}
          placeholder="Detalle del alcance de la UE."
          style={{ ...inputStyle, resize: 'vertical', minHeight: 50 }}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Partner adjudicado</Label>
        <select
          value={partnerId} onChange={e => setPartnerId(e.target.value)}
          style={{ ...inputStyle, background: '#fff' }}
        >
          <option value="">— Selecciona partner —</option>
          {partners.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <CategorizationFields value={cat} onChange={setCat} contextForAI={ctx} />

      <Actions
        err={err}
        onClose={onClose}
        onConfirm={handleConfirm}
        confirmEnabled={canConfirm}
        saving={saving}
        confirmLabel="Añadir UE"
      />
    </ModalShell>
  )
}

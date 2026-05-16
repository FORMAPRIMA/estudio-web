'use client'

import React, { useState } from 'react'
import CategorizationFields, { emptyCategorization, categorizationReady, type CategorizationValue } from './CategorizationFields'
import { logNewPartida } from '@/app/actions/fpe-obra-presupuesto'
import { ModalShell, Label, Small, Stat, inputStyle, Actions } from './EditPartidaModal'

export default function NewPartidaModal({
  sessionId,
  obraUnitId,
  unidadNombre,
  capituloNombre,
  onClose,
  onSaved,
}: {
  sessionId:      string
  obraUnitId:     string
  unidadNombre:   string
  capituloNombre: string
  onClose:        () => void
  onSaved:        () => void
}) {
  const [nombre,        setNombre]        = useState('')
  const [unidadMedida,  setUnidadMedida]  = useState('')
  const [cantidad,      setCantidad]      = useState('')
  const [precio,        setPrecio]        = useState('')
  const [cat, setCat] = useState<CategorizationValue>(emptyCategorization)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const cantidadN = Number(cantidad)
  const precioN   = Number(precio)
  const total     = (Number.isFinite(cantidadN) ? cantidadN : 0) * (Number.isFinite(precioN) ? precioN : 0)

  const validBasics =
    nombre.trim().length >= 3 &&
    unidadMedida.trim().length >= 1 &&
    Number.isFinite(cantidadN) && cantidadN >= 0 &&
    Number.isFinite(precioN)   && precioN   >= 0

  const canConfirm = validBasics && categorizationReady(cat) && !saving

  const ctx = `Nueva partida "${nombre.trim()}" en UE "${unidadNombre}" del capítulo "${capituloNombre}". ${cantidadN} ${unidadMedida.trim()} × ${precioN} € = ${total.toFixed(2)} €.`

  const handleConfirm = async () => {
    setSaving(true); setErr(null)
    const res = await logNewPartida({
      session_id:     sessionId,
      obra_unit_id:   obraUnitId,
      nombre:         nombre.trim(),
      unidad_medida:  unidadMedida.trim(),
      cantidad:       cantidadN,
      precio:         precioN,
      categoria:      cat.categoria!,
      sub_categoria:  cat.sub_categoria,
      razon:          cat.razon.trim(),
    })
    setSaving(false)
    if ('error' in res) { setErr(res.error); return }
    onSaved()
  }

  return (
    <ModalShell title="Nueva partida" subtitle={`${capituloNombre} · ${unidadNombre}`} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Nombre de la partida</Label>
        <input
          type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Suministro y colocación de tarima de roble"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <Label>Unidad medida</Label>
          <input type="text" value={unidadMedida} onChange={e => setUnidadMedida(e.target.value)}
            placeholder="m², ud, ml…" style={inputStyle} />
        </div>
        <div>
          <Label>Cantidad</Label>
          <input type="number" min={0} step="0.001" value={cantidad}
            onChange={e => setCantidad(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <Label>Precio unitario (€)</Label>
          <input type="number" min={0} step="0.01" value={precio}
            onChange={e => setPrecio(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{
        background: '#F8F7F4', borderRadius: 7, padding: '10px 14px', marginBottom: 16,
      }}>
        <Stat label="Total nuevo" value={`${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`} color="#D85A30" bold />
        <Small>El delta económico del cambio será +{total.toFixed(2)} €.</Small>
      </div>

      <CategorizationFields value={cat} onChange={setCat} contextForAI={ctx} />

      <Actions
        err={err}
        onClose={onClose}
        onConfirm={handleConfirm}
        confirmEnabled={canConfirm}
        saving={saving}
        confirmLabel="Añadir partida"
      />
    </ModalShell>
  )
}

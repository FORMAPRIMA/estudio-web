'use client'

import React, { useState } from 'react'
import CategorizationFields, { emptyCategorization, categorizationReady, type CategorizationValue } from './CategorizationFields'
import ChangeExtras, { emptyExtras, type ExtrasValue } from './ChangeExtras'
import { logNewPartida } from '@/app/actions/fpe-obra-presupuesto'
import { ModalShell, Label, Small, Stat, inputStyle, Actions } from './EditPartidaModal'

export default function NewPartidaModal({
  sessionId,
  obraUnitId,
  unidadNombre,
  capituloNombre,
  partnerNombre,
  disciplines,
  defaultDisciplineId,
  parentIsTemplate,
  onClose,
  onSaved,
}: {
  sessionId:           string
  obraUnitId:          string
  unidadNombre:        string
  capituloNombre:      string
  partnerNombre:       string | null
  disciplines:         Array<{ id: string; nombre: string }>
  defaultDisciplineId: string | null
  parentIsTemplate:    boolean
  onClose:             () => void
  onSaved:             () => void
}) {
  const [nombre,        setNombre]        = useState('')
  const [descripcion,   setDescripcion]   = useState('')
  const [unidadMedida,  setUnidadMedida]  = useState('')
  const [cantidad,      setCantidad]      = useState('')
  const [precio,        setPrecio]        = useState('')
  const [disciplineId,  setDisciplineId]  = useState<string>(defaultDisciplineId ?? '')
  const [cat, setCat]       = useState<CategorizationValue>(emptyCategorization)
  const [extras, setExtras] = useState<ExtrasValue>(emptyExtras)
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
      session_id:         sessionId,
      obra_unit_id:       obraUnitId,
      nombre:             nombre.trim(),
      unidad_medida:      unidadMedida.trim(),
      cantidad:           cantidadN,
      precio:             precioN,
      categoria:          cat.categoria!,
      sub_categoria:      cat.sub_categoria,
      razon:              cat.razon.trim(),
      reflect_to_partner: extras.reflectToPartner,
      add_to_template:    extras.addToTemplate,
      descripcion:        descripcion.trim() || null,
      discipline_id:      disciplineId || null,
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
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <Label>Descripción (opcional)</Label>
          <textarea
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Detalle del alcance de la partida."
            style={{ ...inputStyle, resize: 'vertical', minHeight: 50 }}
          />
        </div>
        <div>
          <Label>Disciplina</Label>
          <select
            value={disciplineId} onChange={e => setDisciplineId(e.target.value)}
            style={{ ...inputStyle, background: '#fff' }}
          >
            <option value="">— Selecciona —</option>
            {disciplines.map(d => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{
        background: '#F8F7F4', borderRadius: 7, padding: '10px 14px', marginBottom: 16,
      }}>
        <Stat label="Total nuevo" value={`${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`} color="#D85A30" bold />
        <Small>El delta económico del cambio será +{total.toFixed(2)} €.</Small>
      </div>

      <CategorizationFields value={cat} onChange={setCat} contextForAI={ctx} />

      <ChangeExtras
        value={extras}
        onChange={setExtras}
        partnerNombre={partnerNombre}
        showAddToTemplate
        templateBlocked={!parentIsTemplate}
        templateBlockedReason="La UE parent es custom y no está en el template. Promueve antes la UE al template para poder añadir esta partida también."
        templateLabel="También añadir esta partida al template de proyectos"
      />

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

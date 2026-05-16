'use client'

import React, { useState } from 'react'
import CategorizationFields, { emptyCategorization, categorizationReady, type CategorizationValue } from './CategorizationFields'
import { logEditPartida } from '@/app/actions/fpe-obra-presupuesto'
import type { UIPartida } from '@/lib/fp-execution/obra-presupuesto'

export default function EditPartidaModal({
  sessionId,
  partida,
  unidadNombre,
  capituloNombre,
  onClose,
  onSaved,
}: {
  sessionId:      string
  partida:        UIPartida
  unidadNombre:   string
  capituloNombre: string
  onClose:        () => void
  onSaved:        () => void
}) {
  // Si hay edit pending, partida ya muestra valores nuevos; si no, current = current.
  const initialCantidad = partida.original?.cantidad ?? partida.cantidad
  const initialPrecio   = partida.original?.precio_unitario ?? partida.precio_unitario

  const [cantidad, setCantidad] = useState<string>(String(partida.cantidad))
  const [precio,   setPrecio]   = useState<string>(String(partida.precio_unitario))
  const [cat, setCat] = useState<CategorizationValue>(emptyCategorization)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const newCantidad = Number(cantidad)
  const newPrecio   = Number(precio)
  const oldTotal    = initialCantidad * initialPrecio
  const newTotal    = newCantidad * newPrecio
  const delta       = newTotal - oldTotal

  const hasChange = Number.isFinite(newCantidad) && Number.isFinite(newPrecio) &&
                    newCantidad >= 0 && newPrecio >= 0 &&
                    (newCantidad !== initialCantidad || newPrecio !== initialPrecio)

  const canConfirm = hasChange && categorizationReady(cat) && !saving

  const ctx = `Edición de partida "${partida.nombre}" en UE "${unidadNombre}" del capítulo "${capituloNombre}". Cantidad ${initialCantidad} → ${newCantidad}. Precio ${initialPrecio} € → ${newPrecio} €.`

  const handleConfirm = async () => {
    setSaving(true); setErr(null)
    const res = await logEditPartida({
      session_id:    sessionId,
      partida_id:    partida.id,
      new_cantidad:  newCantidad,
      new_precio:    newPrecio,
      categoria:     cat.categoria!,
      sub_categoria: cat.sub_categoria,
      razon:         cat.razon.trim(),
    })
    setSaving(false)
    if ('error' in res) { setErr(res.error); return }
    onSaved()
  }

  return (
    <ModalShell title="Modificar partida" subtitle={`${capituloNombre} · ${unidadNombre} · ${partida.nombre}`} onClose={onClose}>
      {/* Cantidad / precio */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <Label>Cantidad ({partida.unidad_medida})</Label>
          <input type="number" min={0} step="0.001"
            value={cantidad} onChange={e => setCantidad(e.target.value)}
            style={inputStyle} />
          <Small>Anterior: {initialCantidad}</Small>
        </div>
        <div>
          <Label>Precio unitario (€)</Label>
          <input type="number" min={0} step="0.01"
            value={precio} onChange={e => setPrecio(e.target.value)}
            style={inputStyle} />
          <Small>Anterior: {initialPrecio.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</Small>
        </div>
      </div>

      {/* Deltas */}
      <div style={{
        background: '#F8F7F4', borderRadius: 7, padding: '12px 14px',
        marginBottom: 16,
        display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline',
      }}>
        <Stat label="Total anterior" value={`${oldTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`} />
        <Stat label="Total nuevo"    value={`${newTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`} bold />
        <Stat
          label="Δ"
          value={`${delta >= 0 ? '+' : ''}${delta.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
          color={delta > 0 ? '#D85A30' : delta < 0 ? '#059669' : '#888'}
          bold
        />
      </div>

      <CategorizationFields value={cat} onChange={setCat} contextForAI={ctx} />

      <Actions
        err={err}
        onClose={onClose}
        onConfirm={handleConfirm}
        confirmEnabled={canConfirm}
        saving={saving}
      />
    </ModalShell>
  )
}

// ── Helpers compartidos por todos los modales ────────────────────────────────

export function ModalShell({
  title, subtitle, children, onClose,
}: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 580, maxWidth: '100%',
        maxHeight: '90vh', overflow: 'auto',
        padding: '22px 26px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: '#888', marginBottom: 6,
    }}>{children}</label>
  )
}

export function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: '#AAA', marginTop: 4 }}>{children}</div>
}

export function Stat({ label, value, color = '#1A1A1A', bold = false }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>{label}</div>
      <div style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 500, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 12,
  border: '1px solid #E8E6E0', borderRadius: 6,
  fontFamily: 'inherit', color: '#1A1A1A',
  fontVariantNumeric: 'tabular-nums',
}

export function Actions({
  err, onClose, onConfirm, confirmEnabled, saving, confirmLabel = 'Registrar cambio',
}: { err: string | null; onClose: () => void; onConfirm: () => void; confirmEnabled: boolean; saving: boolean; confirmLabel?: string }) {
  return (
    <>
      {err && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          padding: '8px 12px', marginTop: 4, fontSize: 12, color: '#DC2626',
        }}>{err}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#666',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Cancelar</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!confirmEnabled}
          style={{
            background: confirmEnabled ? '#1A1A1A' : '#CCC',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 18px', fontSize: 12, fontWeight: 700,
            cursor: confirmEnabled ? (saving ? 'wait' : 'pointer') : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >{saving ? 'Guardando…' : confirmLabel}</button>
      </div>
    </>
  )
}

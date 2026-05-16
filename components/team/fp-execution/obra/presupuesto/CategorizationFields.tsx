'use client'

import React, { useState } from 'react'
import type { ChangeCategoria, ChangeSubCategoria } from '@/lib/fp-execution/obra-presupuesto'

// ══════════════════════════════════════════════════════════════════════════════
// CategorizationFields
//
// Bloque reusable usado por los modales de edición / añadir partida / añadir UE.
// Combina categoría + sub-categoría + razón (con validación por IA opcional).
//
// Devuelve { categoria, sub_categoria, razon, valid } al padre vía onChange.
// El padre decide cuándo habilitar el botón de "Confirmar".
// ══════════════════════════════════════════════════════════════════════════════

export interface CategorizationValue {
  categoria:     ChangeCategoria | null
  sub_categoria: ChangeSubCategoria
  razon:         string
  aiValidated:   boolean | null      // null = no validado aún, true = ok, false = AI bloqueó
  aiSuggestion:  string | null
}

export const emptyCategorization: CategorizationValue = {
  categoria: null, sub_categoria: null, razon: '', aiValidated: null, aiSuggestion: null,
}

export function categorizationReady(v: CategorizationValue): boolean {
  if (!v.categoria) return false
  if (v.razon.trim().length < 40) return false
  if (v.categoria !== 'a_peticion_cliente' && !v.sub_categoria) return false
  if (v.aiValidated === false) return false
  return true
}

export default function CategorizationFields({
  value,
  onChange,
  contextForAI,
}: {
  value:        CategorizationValue
  onChange:     (v: CategorizationValue) => void
  contextForAI: string                          // resumen del cambio para que la IA valide la razón
}) {
  const [validating, setValidating] = useState(false)

  const update = (patch: Partial<CategorizationValue>) =>
    onChange({ ...value, ...patch })

  const handleCategoria = (cat: ChangeCategoria) => {
    if (cat === 'a_peticion_cliente') {
      update({ categoria: cat, sub_categoria: null })
    } else {
      update({ categoria: cat })
    }
  }

  const handleSub = (sub: 'trasladable_cliente' | 'costo_empresa') => {
    update({ sub_categoria: sub })
  }

  const handleRazonChange = (txt: string) => {
    // Si la razón cambia, invalida el estado de la IA — hay que revalidar
    update({ razon: txt, aiValidated: null, aiSuggestion: null })
  }

  const handleValidate = async () => {
    if (value.razon.trim().length < 40) return
    setValidating(true)
    try {
      const res = await fetch('/api/obra/validar-razon', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: value.razon, context: contextForAI }),
      })
      const data = await res.json() as { valid: boolean; suggestion?: string }
      if (data.valid) {
        update({ aiValidated: true, aiSuggestion: null })
      } else {
        update({ aiValidated: false, aiSuggestion: data.suggestion ?? 'Razón insuficiente.' })
      }
    } catch {
      // Fallback graceful: si falla, permitimos
      update({ aiValidated: true, aiSuggestion: null })
    } finally {
      setValidating(false)
    }
  }

  const needsSub = value.categoria === 'imprevisto' || value.categoria === 'ajuste'

  return (
    <div>
      {/* Categoría */}
      <Field label="Categoría del cambio">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <RadioBtn
            label="A petición de cliente"
            active={value.categoria === 'a_peticion_cliente'}
            color="#378ADD"
            onClick={() => handleCategoria('a_peticion_cliente')}
          />
          <RadioBtn
            label="Imprevisto"
            active={value.categoria === 'imprevisto'}
            color="#D85A30"
            onClick={() => handleCategoria('imprevisto')}
          />
          <RadioBtn
            label="Ajuste"
            active={value.categoria === 'ajuste'}
            color="#7C3AED"
            onClick={() => handleCategoria('ajuste')}
          />
        </div>
      </Field>

      {/* Sub-categoría */}
      {needsSub && (
        <Field label="¿Quién asume el coste?">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <RadioBtn
              label="Trasladable al cliente"
              active={value.sub_categoria === 'trasladable_cliente'}
              color="#378ADD"
              onClick={() => handleSub('trasladable_cliente')}
            />
            <RadioBtn
              label="A costo de empresa"
              active={value.sub_categoria === 'costo_empresa'}
              color="#059669"
              onClick={() => handleSub('costo_empresa')}
            />
          </div>
        </Field>
      )}

      {/* Razón */}
      <Field label={`Razón del cambio (mín. 40 caracteres) — ${value.razon.length}`}>
        <textarea
          value={value.razon}
          onChange={e => handleRazonChange(e.target.value)}
          rows={3}
          placeholder="Explica con claridad por qué se hace este cambio. Será incluido textualmente en el acta."
          style={{
            width: '100%', padding: '9px 11px', fontSize: 12,
            border: '1px solid #E8E6E0', borderRadius: 6, resize: 'vertical',
            fontFamily: 'inherit', minHeight: 70,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={handleValidate}
            disabled={validating || value.razon.trim().length < 40}
            style={{
              background: 'transparent', border: '1px solid #E8E6E0', borderRadius: 5,
              padding: '5px 10px', fontSize: 10, fontWeight: 600,
              color: '#666', cursor: validating ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: value.razon.trim().length < 40 ? 0.4 : 1,
            }}
          >
            {validating ? 'Validando…' : '✨ Validar razón con IA'}
          </button>
          {value.aiValidated === true && (
            <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>
              ✓ Razón aceptada
            </span>
          )}
          {value.aiValidated === false && value.aiSuggestion && (
            <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>
              ✗ {value.aiSuggestion}
            </span>
          )}
          {value.aiValidated === null && value.razon.trim().length >= 40 && (
            <span style={{ fontSize: 10, color: '#888' }}>
              (Opcional: si no validas, se aceptará automáticamente.)
            </span>
          )}
        </div>
      </Field>
    </div>
  )
}

function RadioBtn({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 12px', fontSize: 11, fontWeight: 600,
        borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        background: active ? color : '#F8F7F4',
        color:      active ? '#fff' : '#666',
        border:     `1px solid ${active ? color : '#E8E6E0'}`,
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: '#888', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

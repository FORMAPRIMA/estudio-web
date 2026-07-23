'use client'

// Campo numérico reutilizable (fuera del render para conservar el foco).
// Compartido por el Modelo financiero, el Dossier y la Propuesta.

import { useState } from 'react'
import { C } from './theme'

// Barra desplazable con etiqueta y valor formateado. Soporta paneles oscuros.
export function RangeField({ label, value, min, max, step, onChange, fmt, dark = false, accent = C.accent }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  fmt: (n: number) => string
  dark?: boolean
  accent?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 10.5, color: dark ? '#FFFFFF75' : C.soft }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: dark ? '#fff' : C.ink }}>{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: accent, display: 'block' }}
      />
    </div>
  )
}

export function NumField({ label, unit, value, onChange, step = 1, pctInput = false, dark = false }: {
  label: string
  unit?: string
  value: number
  onChange: (n: number) => void
  step?: number
  pctInput?: boolean
  dark?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const displayed = pctInput ? Math.round(value * 10000) / 100 : value
  const shown = draft !== null ? draft : String(displayed)
  const commit = (s: string) => {
    const n = s === '' ? 0 : Number(s)
    if (Number.isFinite(n)) onChange(pctInput ? n / 100 : n)
  }
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{
        display: 'flex', justifyContent: 'space-between', gap: 8,
        fontSize: 10.5, color: dark ? '#FFFFFF75' : C.soft, marginBottom: 4,
      }}>
        <span>{label}</span>
        {unit && <span style={{ whiteSpace: 'nowrap' }}>{unit}</span>}
      </span>
      <input
        type="number"
        step={step}
        value={shown}
        onChange={(e) => { setDraft(e.target.value); commit(e.target.value) }}
        onFocus={() => setDraft(String(displayed))}
        onBlur={() => setDraft(null)}
        style={{
          width: '100%', padding: '7px 9px', borderRadius: 4, boxSizing: 'border-box',
          border: `1px solid ${dark ? '#FFFFFF28' : C.line}`,
          background: dark ? '#FFFFFF12' : C.bg,
          color: dark ? '#fff' : C.ink,
          fontSize: 13, fontWeight: 500, outline: 'none',
        }}
      />
    </label>
  )
}

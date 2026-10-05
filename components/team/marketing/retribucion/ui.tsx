'use client'

// Piezas de UI compartidas por la página de Retribución y su formulario.
// Estética del área interna: Inter, crema #F8F7F4, tarjetas blancas, naranja FP.

import { useState, type CSSProperties, type ReactNode } from 'react'

export { T, eyebrow, card, inputStyle } from './theme'
import { T, inputStyle } from './theme'

export function Btn({ children, onClick, kind = 'primary', disabled, type = 'button', style }: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger' | 'link'
  disabled?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
}) {
  const base: CSSProperties = {
    fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
    padding: '10px 16px', borderRadius: 4, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    border: '1px solid transparent', whiteSpace: 'nowrap',
  }
  const kinds: Record<string, CSSProperties> = {
    primary: { background: T.ink, color: '#fff' },
    ghost: { background: 'transparent', color: T.ink, borderColor: T.line },
    danger: { background: 'transparent', color: T.red, borderColor: '#B03A2E40' },
    link: { background: 'transparent', color: T.accent, padding: '4px 0', letterSpacing: '0.08em' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...kinds[kind], ...style }}>
      {children}
    </button>
  )
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: T.soft, marginBottom: 5 }}>
      <span>{children}</span>
      {hint && <span style={{ color: T.faint }}>{hint}</span>}
    </span>
  )
}

/** Campo numérico que conserva lo tecleado mientras tiene el foco (permite vaciarlo). */
export function NumInput({ value, onChange, step = 1, min = 0, suffix, ariaLabel, style }: {
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  suffix?: string
  ariaLabel?: string
  style?: CSSProperties
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        min={min}
        step={step}
        value={draft ?? String(value)}
        onFocus={(e) => { setDraft(String(value)); e.target.select() }}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = e.target.value === '' ? 0 : Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        style={{ ...inputStyle, paddingRight: suffix ? 34 : 11, fontVariantNumeric: 'tabular-nums', ...style }}
      />
      {suffix && (
        <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.faint, pointerEvents: 'none' }}>
          {suffix}
        </span>
      )}
    </span>
  )
}

export function Kv({ k, v, strong, color }: { k: ReactNode; v: ReactNode; strong?: boolean; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0',
      borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12, color: color ?? T.ink,
      fontWeight: strong ? 600 : 400, fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ color: color ?? (strong ? T.ink : T.soft) }}>{k}</span>
      <span style={{ textAlign: 'right' }}>{v}</span>
    </div>
  )
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'green' | 'muted' | 'amber' }) {
  const tones: Record<string, CSSProperties> = {
    neutral: { background: T.lineSoft, color: T.ink },
    accent: { background: T.accentSoft, color: T.accent },
    green: { background: T.greenSoft, color: T.green },
    muted: { background: 'transparent', color: T.faint, border: `1px solid ${T.line}` },
    amber: { background: T.amberSoft, color: T.amber },
  }
  return (
    <span style={{
      display: 'inline-block', fontSize: 10.5, padding: '2px 8px', borderRadius: 3, whiteSpace: 'nowrap',
      fontWeight: 500, ...tones[tone],
    }}>
      {children}
    </span>
  )
}

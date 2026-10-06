// Salas — paleta y estilos. Misma familia visual que Forma Prima (Inter, crema,
// tinta, naranja FP), pero es un producto aparte: sin nada de internal.

import type { CSSProperties } from 'react'

export const S = {
  ink: '#1A1A1A',
  soft: '#1A1A1A99',
  faint: '#1A1A1A66',
  line: '#E6E2DA',
  lineSoft: '#F0EDE7',
  bg: '#F6F5F1',
  panel: '#FFFFFF',
  accent: '#D85A30',
  accentSoft: '#D85A3014',
  green: '#2F7D55',
  greenSoft: '#2F7D5514',
  red: '#B03A2E',
  redSoft: '#B03A2E10',
}

export const card: CSSProperties = { background: S.panel, border: `1px solid ${S.line}`, borderRadius: 8 }
export const eyebrow: CSSProperties = { fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: S.soft, fontWeight: 500, margin: 0 }
export const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 6, border: `1px solid ${S.line}`,
  background: S.bg, color: S.ink, fontSize: 14, fontFamily: 'inherit', outline: 'none',
}
export const btn = (kind: 'primary' | 'ghost' | 'danger' = 'primary'): CSSProperties => ({
  fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', padding: '10px 16px', borderRadius: 6,
  cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid transparent',
  ...(kind === 'primary' ? { background: S.ink, color: '#fff' }
    : kind === 'danger' ? { background: 'transparent', color: S.red, borderColor: '#B03A2E40' }
    : { background: S.panel, color: S.ink, borderColor: S.line }),
})

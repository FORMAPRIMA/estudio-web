// Paleta y estilos de Retribución. Sin 'use client' para poder usarlos también
// desde la página explicativa (Server Component).

import type { CSSProperties } from 'react'

export const T = {
  ink: '#1A1A1A',
  soft: '#1A1A1A99',
  faint: '#1A1A1A60',
  line: '#E8E4DC',
  lineSoft: '#F0EEE8',
  bg: '#F8F7F4',
  panel: '#FFFFFF',
  accent: '#D85A30',
  accentSoft: '#D85A3014',
  green: '#3D8B5F',
  greenSoft: '#3D8B5F14',
  red: '#B03A2E',
  redSoft: '#B03A2E10',
  amber: '#8A6220',
  amberSoft: '#E9C46A2A',
}

export const eyebrow: CSSProperties = {
  fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.soft, fontWeight: 500, margin: 0,
}

export const card: CSSProperties = {
  background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: '20px 22px',
}

export const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 4,
  border: `1px solid ${T.line}`, background: T.bg, color: T.ink, fontSize: 13,
  fontFamily: 'inherit', outline: 'none',
}

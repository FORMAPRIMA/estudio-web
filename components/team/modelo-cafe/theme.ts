// Modelo Café Goya — paleta y estilos compartidos entre la página principal
// y las tabs (Modelo financiero, Dossier, Mercado, Propuesta).

import type { CSSProperties } from 'react'

export const C = {
  ink: '#1A1A1A',
  soft: '#1A1A1A99',
  faint: '#1A1A1A60',
  line: '#E8E4DC',
  bg: '#F8F7F4',
  panel: '#FFFFFF',
  accent: '#D85A30',
  coffee: '#8A6220',
  gold: '#E9C46A',
  green: '#3D8B5F',
  red: '#B03A2E',
  blue: '#5B7FA6',
}

export const panelStyle: CSSProperties = {
  background: C.panel,
  borderRadius: 6,
  border: `1px solid ${C.line}`,
  padding: '20px 22px',
}

export const h2Style: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  margin: '0 0 14px',
  color: C.ink,
  letterSpacing: '-0.01em',
}

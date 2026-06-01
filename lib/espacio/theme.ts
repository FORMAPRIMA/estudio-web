// ─────────────────────────────────────────────────────────────────────────────
// Sistema de diseño compartido del Espacio del cliente.
//
// Toda la estética nace de la landing de Bienvenida (components/public/Bienvenida
// Page.tsx). Aquí la centralizamos para que todas las etapas del Espacio compartan
// paleta, tipografía y animaciones de forma integral.
// ─────────────────────────────────────────────────────────────────────────────

export const FP = {
  orange:      '#D85A30',
  orangeHover: '#C24E26',
  ink:         '#1A1A1A',  // negro base / textos principales
  cream:       '#F8F6F1',  // fondo general claro
  white:       '#FFFFFF',
  border:      '#E5E2DA',  // borde suave
  // grises auxiliares
  gray:        '#888888',
  grayMute:    '#AAAAAA',
  grayText:    '#666666',
  grayBody:    '#444444',
  grayFaint:   '#BBBBBB',
  fontStack:   "'Inter', system-ui, -apple-system, sans-serif",
} as const

// ── Etapas: una sola superficie, distintas caras según el momento ────────────
export type Etapa =
  | 'bienvenida'
  | 'propuesta'
  | 'formalizacion'
  | 'contrato'
  | 'proyecto'

export const ETAPAS: Etapa[] = [
  'bienvenida',
  'propuesta',
  'formalizacion',
  'contrato',
  'proyecto',
]

export const ETAPA_LABEL: Record<Etapa, string> = {
  bienvenida:    'Bienvenida',
  propuesta:     'Propuesta',
  formalizacion: 'Formalización',
  contrato:      'Contrato',
  proyecto:      'Proyecto',
}

/** Orden de la etapa (para comparar avance). */
export function etapaIndex(etapa: Etapa): number {
  return ETAPAS.indexOf(etapa)
}

/** ¿El contenido privado (propuesta en adelante) exige PIN? */
export function requierePin(etapa: Etapa): boolean {
  return etapaIndex(etapa) >= etapaIndex('propuesta')
}

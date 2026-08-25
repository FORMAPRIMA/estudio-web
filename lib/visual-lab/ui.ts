/**
 * FP Visual Lab — base compartida por los tres showrooms y el portafolio.
 *
 * Paleta y formateadores. Los artboards de Claude Design usaban Jost sobre
 * crema con dorado; aquí manda la plataforma interna: Inter, naranja FP y las
 * tarjetas blancas con borde `#E8E6E0` de Control de obra y DD Visits.
 */

export const C = {
  ink: '#1A1A1A',
  cream: '#F8F7F4',
  card: '#FFFFFF',
  accent: '#D85A30',
  accentDark: '#B8471F',
  border: '#E8E6E0',
  borderSoft: '#F0EEE8',
  muted: '#1A1A1A70',
  faint: '#1A1A1A50',
  green: '#3D8B5F',
  blue: '#5B7FA6',
  gold: '#8A6220',
  plum: '#8A5A72',
  grey: '#9C9C96',
} as const

/** FNV-1a → [0,1). Determinista: los tres modelos se generan igual en cada carga. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

export const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export const mm = (n: number, d = 1) => (n / 1e6).toFixed(d).replace('.', ',') + ' M€'

/**
 * es-ES no agrupa los números de cuatro dígitos por defecto: "7546 €/m²" al
 * lado de "38.560 m²" queda desalineado. `useGrouping: 'always'` los uniforma.
 */
export const num = (n: number) =>
  new Intl.NumberFormat('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions).format(Math.round(n))

export const dec = (n: number, d = 1) => n.toFixed(d).replace('.', ',')

export const pct = (n: number) => Math.round(n * 100) + '%'

/** 0..1000 → hora del día entre las 06:00 y las 20:00, en tramos de media hora. */
export function horaSolar(v: number): string {
  const h = 6 + (v / 1000) * 14
  return `${String(Math.floor(h)).padStart(2, '0')}:${(h % 1) < 0.5 ? '00' : '30'}`
}

/** Trimestre natural de una fecha — el formato en que se habla de entregas. */
export const quarter = (d: Date) => 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear()

export function masMeses(desde: Date, m: number): Date {
  const d = new Date(desde.getTime())
  d.setMonth(d.getMonth() + Math.round(m))
  return d
}

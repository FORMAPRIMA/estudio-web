// ── Tema arcade de La Porra del Mundial ─────────────────────────────────────────
// SOLO presentación: paleta, fuentes, keyframes y helpers visuales. Sin lógica de juego.
import type React from 'react'

export const Q = {
  // Fondos
  bg: 'radial-gradient(130% 90% at 50% -10%, #1a2754 0%, #0c1226 52%, #070a16 100%)',
  panel: '#0a0e1c',
  card: '#101733',
  cardAlt: '#0e1530',
  cardHi: '#141b36',
  // Bordes
  border: 'rgba(255,255,255,.07)',
  borderHi: 'rgba(255,255,255,.12)',
  // Neón
  green: '#36f59a',
  cyan: '#34e3ff',
  gold: '#ffd23f',
  pink: '#ff7d92',
  red: '#ff5b76',
  purple: '#9d7bff',
  orange: '#ff9b5b',
  // Texto
  text: '#eef2ff',
  textSoft: '#cfd8ff',
  textMid: '#8b97bd',
  textDim: '#56618a',
  textDimmer: '#6b78a3',
} as const

// Fuentes (CSS variables definidas por next/font en el contenedor; con fallback)
export const FONT = {
  pixel: "var(--q-pixel), 'Press Start 2P', monospace",
  label: "var(--q-label), 'Silkscreen', monospace",
  body: "var(--q-body), 'Space Grotesk', system-ui, sans-serif",
} as const

// Paleta de avatares (estable por índice de jugador)
const AVATAR_COLORS = [
  '#ffd23f', '#36f59a', '#34e3ff', '#9d7bff', '#ff9b5b',
  '#ff5b76', '#ff4d9d', '#5fa8ff', '#62e0b0', '#d98bff',
]

export function avatarColor(index: number): string {
  return AVATAR_COLORS[((index % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length]
}

/** Iniciales para los avatares (1–2 letras). */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

/** Color de medalla/posición para el podio y la tabla. */
export function posColor(i: number): string {
  return i === 0 ? Q.gold : i === 1 ? Q.textSoft : i === 2 ? Q.orange : Q.textDimmer
}

export const MEDALLAS = ['🥇', '🥈', '🥉'] as const

// Keyframes del mockup, inyectados una sola vez por el shell de la quiniela.
export const QUINIELA_KEYFRAMES = `
@keyframes q-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes q-slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes q-fadeUp{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes q-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes q-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes q-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-7px) rotate(2deg)}}
@keyframes q-pulseRed{0%,100%{box-shadow:0 0 0 0 rgba(255,91,118,.55)}70%{box-shadow:0 0 0 7px rgba(255,91,118,0)}}
@keyframes q-shine{0%{background-position:-180% 0}100%{background-position:180% 0}}
@keyframes q-spin{to{transform:rotate(360deg)}}
.q-scroll::-webkit-scrollbar{width:0;height:0}
.q-scroll{scrollbar-width:none}
`

// Estilos reutilizables
export const labelStyle: React.CSSProperties = {
  fontFamily: FONT.label, fontSize: 9, letterSpacing: '1px',
  textTransform: 'uppercase', color: Q.textMid,
}

export const pixelStyle: React.CSSProperties = {
  fontFamily: FONT.pixel, letterSpacing: '.5px',
}

export const cardStyle: React.CSSProperties = {
  background: Q.card, border: `1px solid ${Q.border}`, borderRadius: 14,
}

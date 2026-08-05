// Web pública — tokens de diseño del sitio real de formaprima.es.
// Extraídos de la estética del teaser (components/public/WipLanding.tsx) para
// reusarlos en todas las páginas. El área pública usa estilos inline (como el WIP
// y el resto del proyecto), no Tailwind: este objeto es la fuente única de verdad.

export const site = {
  font: 'var(--font-helixa), "Helixa", system-ui, sans-serif',
  color: {
    ink:      '#141414',   // texto sobre claro
    cream:    '#F4F3F0',   // fondo claro
    stage:    '#0D0D0D',   // fondo oscuro (hero/vídeo)
    white:    '#FFFFFF',
    accent:   '#6F6F6A',   // gris medio (antes naranja FP; decisión de Jose, jul 2026)
    muted:    'rgba(255,255,255,0.62)',
    mutedInk: 'rgba(20,20,20,0.55)',
    hairline: 'rgba(255,255,255,0.16)',
  },
  // Micro-tipografía en versales con tracking ancho (patrón del teaser).
  track: {
    tight:  '0.08em',
    normal: '0.18em',
    wide:   '0.26em',
    ultra:  '0.34em',
  },
  ease: 'cubic-bezier(.4,0,.2,1)',
  // Anchura máxima de contenido y gutters responsivos.
  maxWidth: 1440,
  gutter: 'clamp(20px, 5vw, 80px)',
} as const

// Media query estándar para "móvil" (coincide con el breakpoint del teaser).
export const MOBILE_QUERY = '(max-width: 640px)'

// Escala tipográfica display, responsiva con clamp().
export const display = {
  // Titulares de hero sobre imagen widescreen. Escala deliberadamente contenida:
  // el protagonista es la foto y el texto acompaña (antes clamp(2.6rem,7vw,6rem),
  // 96 px en escritorio, demasiado para el tono editorial que busca Jose).
  hero:  'clamp(1.55rem, 2.9vw, 2.7rem)',
  h1:    'clamp(2rem, 5vw, 4rem)',
  h2:    'clamp(1.5rem, 3.5vw, 2.6rem)',
  eyebrow: 'clamp(0.62rem, 0.9vw, 0.72rem)',
} as const

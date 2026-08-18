// Modo Diseño — protocolo del puente Studio ↔ canvas.
//
// El Studio vive en internal (/team/marketing/web-publica/studio) y carga el sitio
// real dentro de un <iframe>. Así conseguimos tres cosas: simular anchos de
// dispositivo de verdad, que la UI de edición no se solape con el layout que
// estamos juzgando, y que el código del Modo Diseño NUNCA se sirva al visitante
// (el canvas solo lo monta si el servidor dice que quien mira es socio o biz dev).
//
// Los dos lados hablan por postMessage. Mismo origen siempre: cualquier mensaje
// con otro `origin` o sin nuestro `channel` se ignora.

import type { BlockEstilo, Gesto, Locale, Viewport } from '@/lib/web-publica'
import { SITE_BASE } from '@/components/public/site/SiteProvider'

export const STUDIO_CHANNEL = 'fp-studio'

/**
 * Páginas que el Studio puede cargar en el canvas. Las rutas salen de SITE_BASE
 * (hoy '/preview' en staging, '' en el go-live) para no tener que acordarse de
 * cambiarlas aquí también.
 *
 * `listo` = la página ya tiene bloques cableados al Modo Diseño. Las demás se
 * pueden ver pero se editan en el CMS clásico: mejor decirlo que dejar que
 * alguien haga clic en un titular y no pase nada.
 */
export const STUDIO_PAGINAS = [
  { pagina: 'home',        label: 'Home',        ruta: SITE_BASE || '/',              listo: true  },
  { pagina: 'estudio',     label: 'Estudio',     ruta: `${SITE_BASE}/estudio`,        listo: false },
  { pagina: 'proyectos',   label: 'Proyectos',   ruta: `${SITE_BASE}/proyectos`,      listo: false },
  { pagina: 'fp_tools',    label: 'FP Tools',    ruta: `${SITE_BASE}/fp-tools`,       listo: false },
  { pagina: 'real_estate', label: 'Real Estate', ruta: `${SITE_BASE}/real-estate`,    listo: false },
  { pagina: 'contacto',    label: 'Contacto',    ruta: `${SITE_BASE}/contacto`,       listo: false },
] as const

/** Anchos de simulación. Tablet comparte los valores de escritorio a propósito:
 *  el modelo de datos solo tiene dos niveles (desktop y móvil), y fingir un tercer
 *  juego de ajustes que no se guarda sería mentirle al que edita. */
export const STUDIO_VIEWPORTS = [
  { id: 'desktop', label: 'Escritorio', ancho: 1440, datos: 'desktop' },
  { id: 'tablet',  label: 'Tablet',     ancho: 834,  datos: 'desktop' },
  { id: 'mobile',  label: 'Móvil',      ancho: 390,  datos: 'mobile'  },
] as const

export type ViewportId = typeof STUDIO_VIEWPORTS[number]['id']

export function datosDeViewport(id: ViewportId): Viewport {
  return STUDIO_VIEWPORTS.find((v) => v.id === id)?.datos === 'mobile' ? 'mobile' : 'desktop'
}

/** Bloque seleccionado en el canvas, tal como lo describe el propio canvas. */
export interface SeleccionBloque {
  key:      string          // `${seccion}.${clave}`
  pagina:   string
  seccion:  string
  clave:    string
  label:    string
  seccionLabel: string
  gestos:   Gesto[]
  /** Estilo que se está viendo (móvil hereda de escritorio). */
  estilo:   BlockEstilo
  /** Estilo propio del viewport activo: lo que de verdad hay guardado ahí. */
  propio:   BlockEstilo
  /** Idioma que está editando el canvas (lo manda el toggle del sitio). */
  locale:   Locale
  /** El bloque existe pero la web no lo muestra (interruptor apagado). */
  oculto:   boolean
  /** Interruptor que lo enciende, si lo hay: `${seccion}.${clave}`. */
  interruptor?: string
}

// ── Studio → canvas ──────────────────────────────────────────────────────────
export type MensajeAlCanvas =
  | { channel: typeof STUDIO_CHANNEL; type: 'estilo-preview'; key: string; estilo: BlockEstilo }
  | { channel: typeof STUDIO_CHANNEL; type: 'deseleccionar' }
  | { channel: typeof STUDIO_CHANNEL; type: 'modo-limpio'; limpio: boolean }
  | { channel: typeof STUDIO_CHANNEL; type: 'ping' }

// ── canvas → Studio ──────────────────────────────────────────────────────────
export type MensajeAlStudio =
  | { channel: typeof STUDIO_CHANNEL; type: 'listo'; ruta: string }
  | { channel: typeof STUDIO_CHANNEL; type: 'seleccion'; bloque: SeleccionBloque }
  | { channel: typeof STUDIO_CHANNEL; type: 'deseleccion' }
  | { channel: typeof STUDIO_CHANNEL; type: 'texto'; key: string; pagina: string; seccion: string
      clave: string; locale: Locale; valor: string }
  | { channel: typeof STUDIO_CHANNEL; type: 'editando'; editando: boolean }

export function esMensaje<T extends { channel: string }>(ev: MessageEvent): T | null {
  if (typeof window !== 'undefined' && ev.origin !== window.location.origin) return null
  const d = ev.data
  if (!d || typeof d !== 'object' || (d as any).channel !== STUDIO_CHANNEL) return null
  return d as T
}

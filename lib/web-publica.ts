// Web pública — proyectos del teaser "Work in Progress" de formaprima.es.
// Tabla web_proyectos; se gestionan desde /team/marketing/web-publica.

// Categorías reales del material del estudio (carpetas 02_FOTOS, 06_RENDERS,
// 05_PLANOS ESQUEMAS, 04_MAQUETAS, 03_VIDEOS). Foto y render son excluyentes por
// tipo de proyecto (construido vs concepto); la página muestra solo lo que hay.
export type ProyectoMediaTipo = 'foto' | 'render' | 'plano' | 'maqueta' | 'video'

export interface ProyectoMedia {
  url:         string
  tipo:        ProyectoMediaTipo
  caption_es?: string
  caption_en?: string
}

/** ¿La URL apunta a un vídeo? (los GIF se tratan como imagen para que animen en <img>). */
export function esVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
}

export interface WebProyecto {
  id:         string
  nombre:     string
  ubicacion:  string | null
  anio:       string | null
  nota:       string | null
  hero_url:   string | null
  /** Foto principal vertical: sustituye a hero_url en móvil. */
  hero_mobile_url: string | null
  galeria:    string[]
  orden:      number
  activo:     boolean
  created_at: string
  // ── Página de proyecto del sitio real (fase 4) ──
  slug:           string | null
  descripcion_es: string | null
  descripcion_en: string | null
  tipologia_es:   string | null
  tipologia_en:   string | null
  superficie:     string | null
  glb_url:        string | null
  media:          ProyectoMedia[]
}

export function slugifyProyecto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'proyecto'
}

// ── Motor de contenido (CMS genérico) ───────────────────────────────────────
// Tabla web_content: bloques de texto/media editables por (pagina, seccion, clave).

export type Locale = 'es' | 'en'
export type ContentTipo = 'texto' | 'rich' | 'imagen' | 'video'

export interface WebContent {
  id:              string
  pagina:          string
  seccion:         string
  clave:           string
  tipo:            ContentTipo
  valor_es:        string | null
  valor_en:        string | null
  /** Si false, móvil espeja el valor desktop. */
  mobile_override: boolean
  valor_mobile_es: string | null
  valor_mobile_en: string | null
  updated_at:      string
}

/** Mapa de contenido de una página, indexado por `${seccion}.${clave}`. */
export type ContentMap = Record<string, WebContent>

export const contentKey = (seccion: string, clave: string) => `${seccion}.${clave}`

/**
 * Resuelve el valor final de un bloque según idioma y viewport.
 * - Idioma: usa el del locale; si el EN está vacío, cae al ES (nunca deja hueco).
 * - Móvil: solo si el bloque tiene mobile_override; si el valor móvil está vacío,
 *   cae al valor desktop del mismo idioma (el toggle activo pero sin rellenar
 *   no debe romper la página).
 */
export function resolveContent(
  row: WebContent | undefined,
  opts: { locale: Locale; mobile?: boolean },
): string {
  if (!row) return ''
  const { locale, mobile } = opts
  const desktop = (locale === 'en' ? row.valor_en : row.valor_es) || row.valor_es || ''
  if (mobile && row.mobile_override) {
    const m = locale === 'en' ? row.valor_mobile_en : row.valor_mobile_es
    return (m || desktop || '').trim() ? (m || desktop) : desktop
  }
  return desktop
}

/** Atajo: resuelve directo desde un ContentMap. */
export function pick(
  map: ContentMap,
  seccion: string,
  clave: string,
  opts: { locale: Locale; mobile?: boolean },
): string {
  return resolveContent(map[contentKey(seccion, clave)], opts)
}

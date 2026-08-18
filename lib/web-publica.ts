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
  /** Autoría de la imagen: fotógrafo, estudio de render, delineación. Va aparte
   *  del pie porque es otro registro tipográfico y otra información — hasta ahora
   *  no había dónde ponerlo y el pie hacía los dos trabajos. Nombre propio, no se
   *  traduce, así que es un solo campo para los dos idiomas. */
  credito?:    string
}

/** ¿La URL apunta a un vídeo? (los GIF se tratan como imagen para que animen en <img>). */
export function esVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
}

// ── Créditos de un proyecto ─────────────────────────────────────────────────
// Tres grupos que se pintan como tres bloques y se ocultan por separado cuando no
// tienen a nadie. Una sola forma para los tres: es la misma lista —nombre + papel—
// y lo único que cambia es el encabezado, así que `grupo` es una propiedad, no un
// tipo distinto.
export type CreditoGrupo = 'equipo' | 'partner' | 'proveedor'

export interface ProyectoCredito {
  grupo: CreditoGrupo
  /**
   * Solo para `grupo: 'equipo'`: id de la fila de `web_equipo`. Se guarda el ID y
   * NO el nombre a propósito — el nombre, el rol y el enlace a la ficha se
   * resuelven al pintar, así que si alguien cambia de puesto se edita en un sitio
   * y no hay que repasar proyecto por proyecto. Un id que ya no resuelve
   * (miembro borrado) simplemente no se pinta.
   */
  equipo_id?: string
  /** Solo para partners y proveedores: son externos y no tienen ficha en el sitio. */
  nombre?: string
  rol_es?: string
  rol_en?: string
  url?: string
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
  creditos:       ProyectoCredito[]
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
  /** Modo Diseño: cómo se ve el bloque (pasos sobre los tokens, no píxeles). */
  estilo:          EstiloJson
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

// ── Interruptores del CMS ────────────────────────────────────────────────────
// Los toggles se guardan como texto libre porque el editor solo tiene campos de
// texto. Aceptamos las formas que alguien escribiría de verdad, no solo "si".

export const esSi = (v: string) => ['si', 'sí', 'yes', 'true', '1'].includes(v.trim().toLowerCase())
export const esNo = (v: string) => ['no', 'false', '0'].includes(v.trim().toLowerCase())

// ── Modo Diseño — estilo por bloque ─────────────────────────────────────────
// El sitio NO guarda posiciones ni tamaños absolutos. Guarda PASOS sobre los
// tokens de `components/public/site/theme.ts`: así un ajuste hecho en un portátil
// sigue siendo correcto en un móvil y en un 27", y nadie puede escribirse un
// tamaño de letra que rompa la escala tipográfica del estudio.

export type Viewport = 'desktop' | 'mobile'
export type TrackKey = 'tight' | 'normal' | 'wide' | 'ultra'
export type PesoKey = 300 | 400 | 700
export type AlignKey = 'left' | 'center' | 'right'

/** Gestos que el Modo Diseño ofrece sobre un bloque (los declara el esquema). */
export type Gesto = 'texto' | 'tamano' | 'tracking' | 'peso' | 'align'

export interface BlockEstilo {
  /** Pasos de escala sobre el tamaño del token (0 = tal cual lo diseñamos). */
  escala?:   number
  tracking?: TrackKey
  peso?:     PesoKey
  align?:    AlignKey
}

/**
 * Patch de estilo: `null` BORRA el valor y devuelve el bloque al token del
 * sistema. Se usa null y no undefined porque el patch viaja por postMessage y
 * por una Server Action, y un `undefined` puede perderse en el camino.
 */
export type BlockEstiloPatch = { [K in keyof BlockEstilo]?: BlockEstilo[K] | null }

/** Móvil espeja escritorio y solo sobrescribe lo que trae. */
export interface EstiloJson {
  desktop?: BlockEstilo
  mobile?:  BlockEstilo
}

// Rango deliberadamente corto y paso pequeño: el ajuste es un afinado editorial,
// no una barra libre. De -4 a +6 pasos = del 76% al 154% del token.
export const ESCALA_MIN = -4
export const ESCALA_MAX = 6
const ESCALA_PASO = 1.075

export function escalaFactor(pasos = 0): number {
  const n = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, Math.round(pasos || 0)))
  return Number(Math.pow(ESCALA_PASO, n).toFixed(4))
}

/**
 * fontSize del token con la escala del bloque aplicada. Multiplica DENTRO de un
 * calc() para no perder el clamp() responsivo del token (calc(clamp(…) * 1.15)
 * es CSS válido y sigue escalando con el viewport).
 */
export function fontSizeEscalado(base: string, pasos = 0): string {
  const f = escalaFactor(pasos)
  return f === 1 ? base : `calc(${base} * ${f})`
}

export function resolveEstilo(row: WebContent | undefined, opts: { mobile?: boolean }): BlockEstilo {
  const e = row?.estilo
  if (!e) return {}
  const desktop = e.desktop ?? {}
  return opts.mobile ? { ...desktop, ...(e.mobile ?? {}) } : desktop
}

/** Atajo: resuelve el estilo de un bloque directo desde un ContentMap. */
export function pickEstilo(
  map: ContentMap,
  seccion: string,
  clave: string,
  opts: { mobile?: boolean },
): BlockEstilo {
  return resolveEstilo(map[contentKey(seccion, clave)], opts)
}

/** Estilo propio de un viewport (sin heredar), para saber qué está sobrescrito. */
export function estiloPropio(row: WebContent | undefined, viewport: Viewport): BlockEstilo {
  return (viewport === 'mobile' ? row?.estilo?.mobile : row?.estilo?.desktop) ?? {}
}

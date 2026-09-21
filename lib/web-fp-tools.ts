// Web pública — FP Tools (tabla web_fp_tools). Escaparate de capacidades.
//
// Cada capacidad tiene DOS caras: la fila de la portada de /fp-tools (imagen,
// tagline, descripción corta) y su propia subpágina, que abre con el vídeo
// explicativo y sigue con los bloques que se le hayan añadido.

export interface WebFpTool {
  id:             string
  /** URL de su subpágina: /fp-tools/<slug>. Se deriva del nombre al crearla. */
  slug:           string
  nombre:         string
  tagline_es:     string | null
  tagline_en:     string | null
  descripcion_es: string | null
  descripcion_en: string | null
  imagen_url:     string | null
  /** MP4 en el bucket público. Sin él, la subpágina abre con el póster solo. */
  video_url:      string | null
  /** Fotograma de portada del vídeo. Es lo primero que se ve, así que pesa: sin
   *  él la primera pantalla es un rectángulo oscuro con el título encima. */
  video_poster_url: string | null
  cta_label_es:   string | null
  cta_label_en:   string | null
  cta_url:        string | null
  orden:          number
  activo:         boolean
  created_at:     string
}

/**
 * Las cuatro formas que puede tomar un bloque de la subpágina.
 *
 * Es una lista CERRADA, y a propósito corta. Un constructor de bloques libre
 * acaba siempre en páginas que no se parecen entre sí; aquí lo que se busca es
 * que cualquier tool que alguien escriba salga con la misma voz que el resto del
 * sitio. Si algún día falta una forma, se añade aquí y se maqueta una vez.
 */
export const BLOQUE_TIPOS = [
  { codigo: 'texto',  es: 'Texto',           en: 'Text' },
  { codigo: 'dueto',  es: 'Imagen y texto',  en: 'Image and text' },
  { codigo: 'imagen', es: 'Imagen sola',     en: 'Image' },
  { codigo: 'cita',   es: 'Cita',            en: 'Quote' },
] as const

export type BloqueTipo = (typeof BLOQUE_TIPOS)[number]['codigo']

export interface WebFpToolBloque {
  id:         string
  tool_id:    string
  tipo:       BloqueTipo
  titulo_es:  string | null
  titulo_en:  string | null
  cuerpo_es:  string | null
  cuerpo_en:  string | null
  imagen_url: string | null
  pie_es:     string | null
  pie_en:     string | null
  /** Solo en 'dueto': la imagen a la derecha en vez de a la izquierda. */
  invertido:  boolean
  orden:      number
  created_at: string
}

/** La tool con todo lo que hace falta para pintar su subpágina. */
export interface WebFpToolDetalle extends WebFpTool {
  bloques: WebFpToolBloque[]
}

/**
 * Slug a partir del nombre. Mismo criterio que el de proyectos: sin acentos, sin
 * signos y sin extremos sueltos, para que la URL se pueda leer en voz alta.
 */
export function slugifyTool(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tool'
}

/** Un bloque vacío no se pinta: lo que decide si tiene algo que enseñar depende
 *  de su tipo, así que la regla vive aquí y no repartida por la maqueta. */
export function bloqueTieneContenido(b: WebFpToolBloque): boolean {
  const texto = !!(b.titulo_es || b.titulo_en || b.cuerpo_es || b.cuerpo_en)
  if (b.tipo === 'imagen') return !!b.imagen_url
  if (b.tipo === 'dueto') return !!b.imagen_url || texto
  return texto
}

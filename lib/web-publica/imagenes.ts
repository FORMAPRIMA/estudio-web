// Escalera de variantes de imagen de la web pública.
//
// Contexto (auditoría, ago 2026): el bucket tenía 775 MB de originales de cámara
// y de render (16–28 MP) que el navegador descargaba enteros para pintarlos a
// 300 px. La página de L16 pesaba 142 MB. Este módulo define el contrato de las
// variantes; es isomorfo a propósito (sin sharp) para que lo usen igual el
// servidor que genera y el cliente que pinta.
//
// Las variantes viven en `web-publica/v2/` con nombre direccionado por contenido:
// `<md5-12>-<ancho>.<formato>`. Dos consecuencias que importan:
//   · deduplicar es gratis — el mismo fichero da el mismo nombre;
//   · regenerar es idempotente — relanzar el proceso no crea basura.

/** Peldaños de la escalera. Nunca se amplía: se recorta al ancho del original. */
export const ESCALERA = [480, 768, 1080, 1440, 1920, 2560, 3840] as const

/**
 * Peldaños en los que además se genera WebP, como reserva para Safari < 16.4.
 * No se genera en todos porque WebP necesita q90+ para igualar la fidelidad de
 * AVIF y sale caro; a cambio cubre a menos del 5% del tráfico.
 */
export const ESCALERA_WEBP = [480, 1080, 1920] as const

/**
 * Calidad AVIF por peldaño, calibrada midiendo SSIM sobre las 62 imágenes del
 * catálogo real: es la mediana de la q que la búsqueda adaptativa eligió en cada
 * ancho para cruzar SSIM 0,98. La usa el camino rápido (subida desde el CMS),
 * donde no hay tiempo de hacer la búsqueda completa. El proceso por lotes sí la
 * hace y puede quedar por debajo de estos valores.
 */
export const CALIDAD_AVIF: Record<number, number> = {
  480: 72, 768: 72, 1080: 72, 1440: 72, 1920: 72, 2560: 78, 3840: 84,
}

/** Ídem para WebP. Necesita más q que AVIF para la misma fidelidad. */
export const CALIDAD_WEBP: Record<number, number> = {
  480: 90, 1080: 90, 1920: 90,
}

/** Umbral de fidelidad. Por encima, el ojo no distingue el recorte del original. */
export const SSIM_OBJETIVO = 0.98

/** Ancho máximo que se conserva al subir desde el CMS. */
export const ANCHO_MAXIMO = 3840

export const BUCKET = 'web-publica'
export const PREFIJO = 'v2'

/**
 * Juego de variantes de un asset. Se guarda en `web_assets.variantes` y viaja al
 * cliente en el manifiesto, así que es deliberadamente compacto: con el stem y
 * las listas de anchos se reconstruyen todas las URL sin almacenar ninguna.
 */
export interface Variantes {
  /** Primeros 12 hex del md5 del original. Prefijo de todos los ficheros. */
  stem: string
  /** Anchos con AVIF disponible, ascendente. */
  avif: number[]
  /** Anchos con WebP disponible, ascendente. */
  webp: number[]
  /** Dimensiones del original, para reservar el hueco y evitar saltos de layout. */
  w: number
  h: number
  /**
   * Para vídeos: existe `v2/<stem>.webm` con la versión AV1. Los vídeos no tienen
   * escalera —`avif` y `webp` van vacíos—, pero se registran en la misma tabla para
   * no montar una segunda indirección por dos ficheros. El MP4 original sigue
   * siendo la reserva: recodificarlo lo empeoraba (el de móvil salía más grande
   * que la fuente), así que se conserva tal cual.
   */
  webm?: boolean
}

/** URL del WebM/AV1 de un vídeo registrado. */
export function urlWebm(origen: string, v: Variantes): string | null {
  if (!v.webm) return null
  const corte = origen.indexOf('/object/public/')
  if (corte === -1) return null
  const base = origen.slice(0, corte + '/object/public/'.length)
  return `${base}${BUCKET}/${PREFIJO}/${v.stem}.webm`
}

/** Manifiesto completo: URL original → variantes. */
export type Manifiesto = Record<string, Variantes>

/** Ruta de una variante dentro del bucket. */
export function rutaVariante(stem: string, ancho: number, formato: 'avif' | 'webp'): string {
  return `${PREFIJO}/${stem}-${ancho}.${formato}`
}

/**
 * URL pública de una variante. Toma la base del propio bucket a partir de la URL
 * original en lugar de leer NEXT_PUBLIC_SUPABASE_URL: así funciona también si el
 * proyecto cambia de host o si la URL almacenada apunta a un dominio propio.
 */
export function urlVariante(origen: string, stem: string, ancho: number, formato: 'avif' | 'webp'): string {
  const corte = origen.indexOf('/object/public/')
  if (corte === -1) return origen
  const base = origen.slice(0, corte + '/object/public/'.length)
  return `${base}${BUCKET}/${rutaVariante(stem, ancho, formato)}`
}

/** srcset de un formato, listo para `<source>`. Vacío si no hay variantes. */
export function srcset(origen: string, v: Variantes, formato: 'avif' | 'webp'): string {
  const anchos = formato === 'avif' ? v.avif : v.webp
  return anchos.map((a) => `${urlVariante(origen, v.stem, a, formato)} ${a}w`).join(', ')
}

/**
 * Anchos de la escalera aplicables a un original: los peldaños que caben, más el
 * ancho exacto del original si se queda corto y la diferencia con el último
 * peldaño es apreciable (evita servir un 2560 recortado cuando el original mide
 * 2600 y podríamos darlo tal cual).
 */
export function anchosPara(anchoOriginal: number, escalera: readonly number[] = ESCALERA): number[] {
  const dentro = escalera.filter((a) => a <= anchoOriginal)
  if (dentro.length === 0) return [anchoOriginal]
  const ultimo = dentro[dentro.length - 1]
  if (anchoOriginal < escalera[escalera.length - 1] && anchoOriginal - ultimo > 120) {
    return [...dentro, anchoOriginal]
  }
  return dentro
}

/**
 * Atributo `sizes` por contexto de uso. Sin esto el navegador asume 100vw y se
 * baja la variante más grande incluso para una tarjeta de 340 px — que es
 * exactamente el bug que estamos arreglando.
 *
 * 🔴 Estos valores NO son estimaciones: salen de medir en el navegador el ancho
 * real al que se pinta cada imagen. Declarar de más cuesta un peldaño entero de
 * la escalera (con DPR 2 un retrato de 404 px se llevaba el de 1440 en vez del de
 * 1080, un 40% de más), y declarar de menos deja la foto borrosa. Si cambia el
 * layout de un componente, hay que volver a medir aquí.
 *
 * Geometría común: el contenido va en un contenedor de `maxWidth: 1440` con
 * `padding: 0 clamp(20px, 5vw, 80px)`. Es decir, ancho útil
 * C = min(1440px, 100vw) − 2·gutter, que a 1728 px de viewport da 1280 px.
 */
export const SIZES = {
  /**
   * Tarjeta de obra del mapa: 264 px fijos en escritorio, a todo el ancho cuando
   * sube desde el pie en móvil. Sin esta entrada el navegador se bajaría el
   * original para pintarlo a 264 px, que es justo lo que la escalera de variantes
   * vino a evitar.
   */
  fichaMapa: '(min-width: 901px) 264px, 100vw',

  /** Fondo a sangre: el único que de verdad ocupa el viewport entero. */
  hero: '100vw',

  /**
   * Rejilla de proyectos: `repeat(auto-fill, minmax(340px, 1fr))`, gap
   * clamp(20px, 3vw, 44px). Cabe la tercera columna desde ~1214 px de viewport.
   * Medido: 397 px de columna a 1728 px.
   */
  rejillaProyectos:
    '(min-width: 1600px) 400px, (min-width: 1440px) calc((1440px - 10vw - 88px) / 3), ' +
    '(min-width: 1214px) 28vw, (min-width: 782px) 43.5vw, (min-width: 400px) 90vw, calc(100vw - 40px)',

  /**
   * Rejilla de equipo: 1 / 2 / 3 columnas a 640 y 980, gap clamp(18px, 2.4vw, 34px).
   * Medido: 404 px de columna a 1728 px.
   */
  rejillaEquipo:
    '(min-width: 1600px) 410px, (min-width: 1440px) calc((1440px - 10vw - 68px) / 3), ' +
    '(min-width: 980px) 28.4vw, (min-width: 640px) 43.8vw, (min-width: 400px) 90vw, calc(100vw - 40px)',

  /** Bloque de galería: el ancho útil del contenedor. Medido: 1280 px a 1728 px. */
  galeria:
    '(min-width: 1600px) 1280px, (min-width: 1440px) calc(1440px - 10vw), ' +
    '(min-width: 400px) 90vw, calc(100vw - 40px)',

  /**
   * Retrato de la ficha de miembro: grid 1fr / 1.2fr con gap clamp(30px, 5vw, 72px),
   * a una columna por debajo de 760 px. Medido: 549 px a 1728 px.
   */
  retrato:
    '(min-width: 1600px) 560px, (min-width: 1440px) calc((1440px - 10vw - 72px) / 2.2), ' +
    '(min-width: 761px) calc(85vw / 2.2), (min-width: 400px) 90vw, calc(100vw - 40px)',

  /**
   * Tarjeta de FP Tools: filas de `1fr 1fr` con gap clamp(28px, 5vw, 80px), a una
   * columna por debajo de 820 px. Medido: 600 px a 1728 px.
   */
  tarjeta:
    '(min-width: 1600px) 600px, (min-width: 1440px) calc((1440px - 10vw - 80px) / 2), ' +
    '(min-width: 821px) calc(85vw / 2), (min-width: 400px) 90vw, calc(100vw - 40px)',
} as const

export type SizesKey = keyof typeof SIZES

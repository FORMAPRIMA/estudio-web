'use client'

// Imagen de la web pública.
//
// Sustituye a los <img src={url}> crudos que había repartidos por el sitio y que
// servían el original de 18 MB para pintarlo a 300 px. Emite un <picture> con
// AVIF, WebP de reserva y el original como último recurso, más el `sizes` del
// contexto real de uso — sin `sizes` el navegador asume 100vw y vuelve a bajarse
// la variante más grande, que es el bug de partida.
//
// Se comporta como un <img> a todos los efectos: los selectores CSS del sitio son
// descendentes (`.member-photo img`, `.proj-photo img`) y siguen aplicando dentro
// del <picture>, así que las transiciones de hover no se tocan.
//
// Si la URL no está en el manifiesto —foto recién subida, o una externa de
// picsum— cae a un <img> normal con el original. Nunca deja un hueco.

import { srcset, urlVariante, SIZES, type SizesKey } from '@/lib/web-publica/imagenes'
import { useVariantes } from './AssetsProvider'

interface Props {
  src: string | null | undefined
  alt: string
  /** Contexto de uso: determina el `sizes`. Ver SIZES en lib/web-publica/imagenes. */
  contexto: SizesKey
  /**
   * Imagen visible sin hacer scroll (hero, primera tarjeta). Desactiva el lazy y
   * sube la prioridad de red. Por defecto todo va en lazy, que es lo correcto para
   * la inmensa mayoría de las imágenes del sitio.
   */
  prioridad?: boolean
  style?: React.CSSProperties
  className?: string
  draggable?: boolean
  /** Aviso de que el bitmap ya pintó. Lo usan los esqueletos de carga para
   *  retirarse; una imagen servida desde caché lo dispara igual. */
  onLoad?: () => void
}

export function Img({ src, alt, contexto, prioridad = false, style, className, draggable, onLoad }: Props) {
  const v = useVariantes(src)
  if (!src) return null

  const comunes = {
    alt,
    className,
    style,
    draggable,
    loading: prioridad ? ('eager' as const) : ('lazy' as const),
    decoding: prioridad ? ('sync' as const) : ('async' as const),
    fetchPriority: prioridad ? ('high' as const) : ('auto' as const),
    onLoad,
  }

  // Sin variantes registradas —foto recién subida, URL externa de picsum, o una
  // fila de vídeo, que no tiene escalera— se sirve el original, igual que antes.
  if (!v || (v.avif.length === 0 && v.webp.length === 0)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} {...comunes} />
  }

  const sizes = SIZES[contexto]
  const avif = srcset(src, v, 'avif')
  const webp = srcset(src, v, 'webp')
  // Reserva del <img>: el WebP más grande, no el original. Caer al original sería
  // volver a servir los 18 MB que justamente estamos evitando.
  const reserva = v.webp.length
    ? urlVariante(src, v.stem, Math.max(...v.webp), 'webp')
    : urlVariante(src, v.stem, Math.max(...v.avif), 'avif')

  return (
    <picture>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={reserva} width={v.w} height={v.h} {...comunes} />
    </picture>
  )
}

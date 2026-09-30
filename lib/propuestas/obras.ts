import { getProyectosSite } from '@/app/actions/web-publica'
import { getManifiesto } from '@/app/actions/web-assets'
import { urlVariante } from '@/lib/web-publica/imagenes'
import type { ProyectoEnlace } from '@/components/propuesta/SlideSiguiente'

/** Obras publicadas en la web, con una variante de ~1080 px en vez del original. */
export async function obrasDestacadas(): Promise<ProyectoEnlace[]> {
  const [proyectos, manifiesto] = await Promise.all([getProyectosSite(), getManifiesto().catch(() => ({}))])
  return proyectos
    .filter((p) => p.slug && p.hero_url)
    .slice(0, 4)
    .map((p) => {
      const v = (manifiesto as Record<string, { stem: string; webp: number[] }>)[p.hero_url!]
      const ancho = v?.webp.find((a) => a >= 1080) ?? v?.webp[v.webp.length - 1]
      return {
        slug: p.slug!,
        nombre: p.nombre,
        ubicacion: p.ubicacion,
        imagen: v && ancho ? urlVariante(p.hero_url!, v.stem, ancho, 'webp') : p.hero_url!,
      }
    })
}


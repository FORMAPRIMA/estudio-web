import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/web-publica/base'
import { getWebProyectosPublic } from '@/app/actions/web-publica'
import { getPropiedadesPublic } from '@/app/actions/web-propiedades'
import { getEquipoPublic } from '@/app/actions/web-equipo'
import { getFpToolsIndice } from '@/app/actions/web-fp-tools'

/**
 * El sitemap, generado de lo que hay PUBLICADO y no de una lista escrita a mano.
 *
 * Las fichas del sitio —proyectos, propiedades, personas del equipo, capacidades—
 * las da de alta el equipo desde el CMS, así que una lista fija nacería
 * desactualizada: cada obra nueva habría que acordarse de añadirla aquí. Se
 * pregunta a las mismas funciones que pintan las páginas, que además ya filtran lo
 * que no está activo: si algo no se ve en la web, tampoco se le ofrece a Google.
 *
 * Si una consulta falla, esa rama se queda fuera y el resto del sitemap sale
 * igual: media lista es infinitamente mejor que un 500 en /sitemap.xml, que es lo
 * que un buscador interpreta como «este sitio está roto».
 */
export const dynamic = 'force-dynamic'

/** Las páginas que existen siempre, estén o no llenas. */
const FIJAS: { ruta: string; prioridad: number; frecuencia: 'weekly' | 'monthly' }[] = [
  { ruta: '',             prioridad: 1.0,  frecuencia: 'weekly'  },
  { ruta: '/estudio',     prioridad: 0.8,  frecuencia: 'monthly' },
  { ruta: '/proyectos',   prioridad: 0.9,  frecuencia: 'weekly'  },
  { ruta: '/mapa',        prioridad: 0.7,  frecuencia: 'monthly' },
  { ruta: '/fp-tools',    prioridad: 0.8,  frecuencia: 'monthly' },
  { ruta: '/real-estate', prioridad: 0.8,  frecuencia: 'weekly'  },
  { ruta: '/contacto',    prioridad: 0.6,  frecuencia: 'monthly' },
]

async function seguro<T>(p: Promise<T>, quien: string, vacio: T): Promise<T> {
  try { return await p } catch (e) {
    console.error('[sitemap]', quien, e instanceof Error ? e.message : e)
    return vacio
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date()

  const [proyectos, propiedades, equipo, tools] = await Promise.all([
    seguro(getWebProyectosPublic(), 'proyectos', []),
    seguro(getPropiedadesPublic(), 'propiedades', []),
    seguro(getEquipoPublic(), 'equipo', []),
    seguro(getFpToolsIndice(), 'fp-tools', []),
  ])

  const fichas = [
    ...proyectos.filter((p) => p.slug).map((p) => ({ ruta: `/proyectos/${p.slug}`, prioridad: 0.7 })),
    ...propiedades.filter((p) => p.slug).map((p) => ({ ruta: `/real-estate/${p.slug}`, prioridad: 0.7 })),
    ...tools.map((t) => ({ ruta: `/fp-tools/${t.slug}`, prioridad: 0.7 })),
    ...equipo.filter((m) => m.slug).map((m) => ({ ruta: `/estudio/${m.slug}`, prioridad: 0.5 })),
  ]

  return [
    ...FIJAS.map((f) => ({
      url: `${SITE_URL}${f.ruta}`,
      lastModified: ahora,
      changeFrequency: f.frecuencia,
      priority: f.prioridad,
    })),
    ...fichas.map((f) => ({
      url: `${SITE_URL}${f.ruta}`,
      lastModified: ahora,
      changeFrequency: 'monthly' as const,
      priority: f.prioridad,
    })),
  ]
}

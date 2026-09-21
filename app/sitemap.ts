import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/web-publica/base'
import { TABS, TABS_VISIBLES } from '@/lib/web-publica/navegacion'
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

/** Cada sección con el peso que se le da. La lista de secciones NO se repite
 *  aquí: sale de la navegación, así que una sección oculta desaparece del sitemap
 *  sola, sin que nadie tenga que acordarse. */
const PESO: Record<string, { prioridad: number; frecuencia: 'weekly' | 'monthly' }> = {
  '/estudio':     { prioridad: 0.8, frecuencia: 'monthly' },
  '/proyectos':   { prioridad: 0.9, frecuencia: 'weekly'  },
  '/mapa':        { prioridad: 0.7, frecuencia: 'monthly' },
  '/fp-tools':    { prioridad: 0.8, frecuencia: 'monthly' },
  '/real-estate': { prioridad: 0.8, frecuencia: 'weekly'  },
  '/contacto':    { prioridad: 0.6, frecuencia: 'monthly' },
}

const FIJAS: { ruta: string; prioridad: number; frecuencia: 'weekly' | 'monthly' }[] = [
  { ruta: '', prioridad: 1.0, frecuencia: 'weekly' },   // la Home
  ...TABS_VISIBLES.map((t) => ({
    ruta: t.path,
    prioridad: PESO[t.path]?.prioridad ?? 0.6,
    frecuencia: PESO[t.path]?.frecuencia ?? ('monthly' as const),
  })),
]

/** Las fichas de una sección oculta tampoco se ofrecen: de nada sirve esconder
 *  /real-estate si el sitemap sigue listando cada propiedad. */
const OCULTA = (ruta: string) => TABS.some((t) => t.oculta && ruta.startsWith(`${t.path}/`))

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
    ...fichas.filter((f) => !OCULTA(f.ruta)).map((f) => ({
      url: `${SITE_URL}${f.ruta}`,
      lastModified: ahora,
      changeFrequency: 'monthly' as const,
      priority: f.prioridad,
    })),
  ]
}

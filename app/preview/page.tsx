import { getContent } from '@/app/actions/web-content'
import { getWebProyectosPublic } from '@/app/actions/web-publica'
import { HomeLanding, type HomeBackground } from '@/components/public/site/home/HomeLanding'

export const dynamic = 'force-dynamic'

export default async function PreviewHome() {
  const [content, proyectos] = await Promise.all([
    getContent('home'),
    getWebProyectosPublic(),
  ])

  // Los fondos de la Home reusan las fotos de los proyectos activos (misma fuente
  // que edita el equipo en la tab Proyectos). Solo los que tienen foto principal.
  const backgrounds: HomeBackground[] = proyectos
    .filter((p) => p.hero_url)
    .map((p) => ({
      src: p.hero_url as string,
      srcMobile: p.hero_mobile_url,
      nombre: p.nombre,
      ubicacion: p.ubicacion,
      anio: p.anio,
    }))

  return <HomeLanding content={content} backgrounds={backgrounds} />
}

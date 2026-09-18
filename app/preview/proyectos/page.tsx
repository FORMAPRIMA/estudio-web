import { getContent } from '@/app/actions/web-content'
import { getProyectosSite } from '@/app/actions/web-publica'
import { ProyectosGrid } from '@/components/public/site/proyectos/ProyectosGrid'
import { ProyectosClient } from '@/components/public/site/proyectos/ProyectosClient'
import type { MaquetaItem } from '@/components/public/site/proyectos/ProyectosShowroom'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const proyectos = await getProyectosSite()

  // La parrilla de Proyectos es el grid de maquetas 3D: proyectos con GLB subido.
  const maquetas: MaquetaItem[] = proyectos
    .filter((p) => p.glb_url && p.slug)
    .map((p) => ({
      slug: p.slug as string,
      nombre: p.nombre,
      eyebrow: p.tipologia_es || p.nota,
      eyebrow_en: p.tipologia_en || p.nota,
      // El showroom enseña el arranque de la ficha y su render principal: la
      // misma descripción y la misma foto, no un segundo texto que mantener.
      descripcion: p.descripcion_es,
      descripcion_en: p.descripcion_en,
      hero_url: p.hero_url,
      glb_url: p.glb_url as string,
    }))

  // Sin maquetas todavía → parrilla editorial de respaldo (para no dejarlo vacío).
  if (maquetas.length === 0) {
    const content = await getContent('proyectos')
    return <ProyectosGrid content={content} proyectos={proyectos} />
  }

  return (
    <>
      {/* Enlaces accesibles a cada proyecto (el grid 3D no es rastreable por buscadores). */}
      <nav aria-label="Proyectos" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
        {maquetas.map((m) => (
          <a key={m.slug} href={`/preview/proyectos/${m.slug}`}>{m.nombre}</a>
        ))}
      </nav>
      <ProyectosClient modelos={maquetas} />
    </>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProyectoBySlug } from '@/app/actions/web-publica'
import { ProyectoDetalle } from '@/components/public/site/proyectos/ProyectoDetalle'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getProyectoBySlug(params.slug)
  if (!p) return { title: 'Proyecto' }
  const desc = (p.descripcion_es || '').replace(/\s+/g, ' ').slice(0, 160)
  return {
    title: p.nombre,
    description: desc || `${p.nombre}${p.ubicacion ? ` · ${p.ubicacion}` : ''}`,
    openGraph: {
      title: `${p.nombre} — Forma Prima`,
      description: desc || undefined,
      images: p.hero_url ? [{ url: p.hero_url }] : undefined,
      type: 'article',
    },
  }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const proyecto = await getProyectoBySlug(params.slug)
  if (!proyecto) notFound()

  // JSON-LD para SEO (obra creativa / proyecto de arquitectura).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: proyecto.nombre,
    ...(proyecto.descripcion_es ? { description: proyecto.descripcion_es.replace(/\s+/g, ' ').slice(0, 300) } : {}),
    ...(proyecto.hero_url ? { image: proyecto.hero_url } : {}),
    ...(proyecto.ubicacion ? { locationCreated: proyecto.ubicacion } : {}),
    ...(proyecto.anio ? { dateCreated: proyecto.anio } : {}),
    creator: { '@type': 'Organization', name: 'Forma Prima' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProyectoDetalle proyecto={proyecto} />
    </>
  )
}

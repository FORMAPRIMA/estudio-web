import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFpToolBySlug, getFpToolsIndice } from '@/app/actions/web-fp-tools'
import { FpToolDetalle } from '@/components/public/site/fp-tools/FpToolDetalle'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tool = await getFpToolBySlug(params.slug)
  if (!tool) return { title: 'FP Tools' }
  const desc = (tool.tagline_es || tool.descripcion_es || '').replace(/\s+/g, ' ').slice(0, 160)
  const imagen = tool.video_poster_url || tool.imagen_url
  return {
    title: tool.nombre,
    description: desc || undefined,
    openGraph: {
      title: `${tool.nombre} — Forma Prima`,
      description: desc || undefined,
      images: imagen ? [{ url: imagen }] : undefined,
      // `video.other` y no `article`: lo que esta página enseña es una pieza.
      type: 'website',
    },
  }
}

export default async function Page({ params }: { params: { slug: string } }) {
  // Las dos consultas van en paralelo: el índice no depende de la capacidad, solo
  // sirve para numerarla y saber cuál viene después.
  const [tool, indice] = await Promise.all([
    getFpToolBySlug(params.slug),
    getFpToolsIndice(),
  ])
  if (!tool) notFound()

  const pos = indice.findIndex((x) => x.slug === params.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: tool.nombre,
    provider: { '@type': 'Organization', name: 'Forma Prima' },
    ...(tool.tagline_es ? { description: tool.tagline_es } : {}),
    ...(tool.video_url ? {
      subjectOf: {
        '@type': 'VideoObject',
        name: tool.nombre,
        ...(tool.video_poster_url ? { thumbnailUrl: tool.video_poster_url } : {}),
        contentUrl: tool.video_url,
      },
    } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FpToolDetalle tool={tool} tools={indice} indice={pos >= 0 ? pos + 1 : 1} total={indice.length || 1} />
    </>
  )
}

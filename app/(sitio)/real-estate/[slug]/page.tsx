import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPropiedadBySlug } from '@/app/actions/web-propiedades'
import { PropiedadDetalle } from '@/components/public/site/real-estate/PropiedadDetalle'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPropiedadBySlug(params.slug)
  if (!p) return { title: 'Propiedad' }
  const desc = (p.descripcion_es || '').replace(/\s+/g, ' ').slice(0, 160)
  return {
    title: p.nombre,
    description: desc || `${p.nombre}${p.ubicacion ? ` · ${p.ubicacion}` : ''}`,
    openGraph: { title: `${p.nombre} — Forma Prima`, description: desc || undefined, images: p.hero_url ? [{ url: p.hero_url }] : undefined },
  }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const propiedad = await getPropiedadBySlug(params.slug)
  if (!propiedad) notFound()
  return <PropiedadDetalle propiedad={propiedad} />
}

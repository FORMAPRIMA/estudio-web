import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMiembroBySlug } from '@/app/actions/web-equipo'
import { MiembroDetalle } from '@/components/public/site/estudio/MiembroDetalle'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const m = await getMiembroBySlug(params.slug)
  if (!m) return { title: 'Estudio' }
  const rol = m.rol_es || ''
  return {
    title: m.nombre,
    description: rol ? `${m.nombre}, ${rol} en Forma Prima.` : `${m.nombre}, equipo de Forma Prima.`,
    openGraph: {
      title: `${m.nombre} — Forma Prima`,
      images: m.foto_detalle_url || m.foto_url ? [{ url: (m.foto_detalle_url || m.foto_url)! }] : undefined,
      type: 'profile',
    },
  }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const miembro = await getMiembroBySlug(params.slug)
  if (!miembro) notFound()
  return <MiembroDetalle miembro={miembro} />
}

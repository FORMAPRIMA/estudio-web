import { notFound } from 'next/navigation'
import { getMiembroBySlug } from '@/app/actions/web-equipo'
import { MiembroDetalle } from '@/components/public/site/estudio/MiembroDetalle'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { slug: string } }) {
  const miembro = await getMiembroBySlug(params.slug)
  if (!miembro) notFound()
  return <MiembroDetalle miembro={miembro} />
}

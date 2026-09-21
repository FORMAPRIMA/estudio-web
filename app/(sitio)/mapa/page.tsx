import type { Metadata } from 'next'
import { getContent } from '@/app/actions/web-content'
import { getMapaPuntosPublic } from '@/app/actions/web-mapa'
import { MapaPage } from '@/components/public/site/mapa/MapaPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mapa',
  description: 'Las obras de Forma Prima en Madrid, sobre el plano de la ciudad.',
}

export default async function Page() {
  const [content, puntos] = await Promise.all([
    getContent('mapa'),
    getMapaPuntosPublic(),
  ])
  return <MapaPage content={content} puntos={puntos} />
}

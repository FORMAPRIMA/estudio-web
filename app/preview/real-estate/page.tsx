import { getContent } from '@/app/actions/web-content'
import { getPropiedadesPublic } from '@/app/actions/web-propiedades'
import { PropiedadesGrid } from '@/components/public/site/real-estate/PropiedadesGrid'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [content, propiedades] = await Promise.all([getContent('real_estate'), getPropiedadesPublic()])
  return <PropiedadesGrid content={content} propiedades={propiedades} />
}

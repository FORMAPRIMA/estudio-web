import { getContent } from '@/app/actions/web-content'
import { getProyectosSite } from '@/app/actions/web-publica'
import { ProyectosGrid } from '@/components/public/site/proyectos/ProyectosGrid'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [content, proyectos] = await Promise.all([getContent('proyectos'), getProyectosSite()])
  return <ProyectosGrid content={content} proyectos={proyectos} />
}

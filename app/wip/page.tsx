import { getWebProyectosPublic } from '@/app/actions/web-publica'
import { WipLanding } from '@/components/public/WipLanding'

// Siempre fresco desde la BD (los recursos se editan desde Marketing).
export const dynamic = 'force-dynamic'

export default async function WipPage() {
  const proyectos = await getWebProyectosPublic()
  return <WipLanding proyectos={proyectos} />
}

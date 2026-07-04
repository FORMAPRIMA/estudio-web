import { getWebProyectosAdmin } from '@/app/actions/web-publica'
import { WebPublicaPage } from '@/components/team/WebPublicaPage'

export const metadata = { title: 'Web pública' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const proyectos = await getWebProyectosAdmin()
  return <WebPublicaPage proyectos={proyectos} />
}

import { getContent } from '@/app/actions/web-content'
import { getEquipoPublic } from '@/app/actions/web-equipo'
import { EstudioPage } from '@/components/public/site/estudio/EstudioPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [content, equipo] = await Promise.all([getContent('estudio'), getEquipoPublic()])
  return <EstudioPage content={content} equipo={equipo} />
}

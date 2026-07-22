import { getWebProyectosAdmin } from '@/app/actions/web-publica'
import { getContentAdmin } from '@/app/actions/web-content'
import { getEquipoAdmin } from '@/app/actions/web-equipo'
import { getFpToolsAdmin } from '@/app/actions/web-fp-tools'
import { getPropiedadesAdmin } from '@/app/actions/web-propiedades'
import { WebPublicaPage } from '@/components/team/web-publica/WebPublicaPage'
import { CONTENT_SCHEMA } from '@/lib/web-publica-schema'
import type { ContentMap } from '@/lib/web-publica'

export const metadata = { title: 'Web pública' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const [proyectos, equipo, tools, propiedades, contentPairs] = await Promise.all([
    getWebProyectosAdmin(),
    getEquipoAdmin(),
    getFpToolsAdmin(),
    getPropiedadesAdmin(),
    Promise.all(CONTENT_SCHEMA.map(async (p) => [p.pagina, await getContentAdmin(p.pagina)] as const)),
  ])
  const content: Record<string, ContentMap> = Object.fromEntries(contentPairs)
  return <WebPublicaPage proyectos={proyectos} content={content} equipo={equipo} tools={tools} propiedades={propiedades} />
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWebProyectosAdmin } from '@/app/actions/web-publica'
import { getContentAdmin } from '@/app/actions/web-content'
import { getEquipoAdmin } from '@/app/actions/web-equipo'
import { getFpToolsAdmin } from '@/app/actions/web-fp-tools'
import { getPropiedadesAdmin } from '@/app/actions/web-propiedades'
import { getMapaPuntosAdmin } from '@/app/actions/web-mapa'
import { WebPublicaPage } from '@/components/team/web-publica/WebPublicaPage'
import { CONTENT_SCHEMA } from '@/lib/web-publica-schema'
import type { ContentMap } from '@/lib/web-publica'

export const metadata = { title: 'Web pública' }
export const dynamic = 'force-dynamic'

// Solo socios y biz dev editan la web pública (lo mismo que exige cada Server
// Action). Sin este guard, un fp_manager/fp_team que llegase por enlace directo
// veía un error de servidor: las acciones lanzan al cargar la página.
const ROLES_CMS = ['fp_partner', 'fp_biz_dev']

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/team/marketing/web-publica')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !ROLES_CMS.includes(profile.rol)) {
    return (
      <div style={{ padding: 48, maxWidth: 620, fontFamily: 'inherit' }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Web pública</h1>
        <p style={{ fontSize: 13, color: '#1A1A1A80', lineHeight: 1.6, marginTop: 14 }}>
          Esta zona solo la pueden editar los socios y el equipo de business development.
          Si necesitas cambiar algo de la web (proyectos, equipo, textos), pídelo a Jose o a Ana Cristina
          y te dan acceso o lo suben ellos.
        </p>
        <p style={{ fontSize: 12, color: '#1A1A1A55', marginTop: 18 }}>
          Tu rol actual: <code style={{ background: '#F0EEE8', padding: '2px 6px', borderRadius: 3 }}>{profile?.rol ?? 'sin rol'}</code>
        </p>
      </div>
    )
  }

  const [proyectos, equipo, tools, propiedades, mapaPuntos, contentPairs] = await Promise.all([
    getWebProyectosAdmin(),
    getEquipoAdmin(),
    getFpToolsAdmin(),
    getPropiedadesAdmin(),
    getMapaPuntosAdmin(),
    Promise.all(CONTENT_SCHEMA.map(async (p) => [p.pagina, await getContentAdmin(p.pagina)] as const)),
  ])
  const content: Record<string, ContentMap> = Object.fromEntries(contentPairs)
  return <WebPublicaPage proyectos={proyectos} content={content} equipo={equipo} tools={tools} propiedades={propiedades} mapaPuntos={mapaPuntos} />
}

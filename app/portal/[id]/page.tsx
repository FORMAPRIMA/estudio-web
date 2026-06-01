import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import ClientPortalGate from '@/components/portal/ClientPortalGate'
import ClientPortal from '@/components/portal/ClientPortal'
import { loadPortalData } from '@/lib/portal/load'

const SECRET = process.env.PORTAL_SECRET ?? 'fp-portal-secret-2024'
const TEAM_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

function verifyToken(proyectoId: string, token: string): boolean {
  const expected = createHmac('sha256', SECRET).update(proyectoId).digest('hex')
  return token === expected
}

export default async function PortalPage({ params }: { params: { id: string } }) {
  const { id } = params
  const admin = createAdminClient()

  // Team members (logged-in staff) bypass the client gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isTeamMember = false
  let viewerRol: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    viewerRol = profile?.rol ?? null
    isTeamMember = TEAM_ROLES.includes(viewerRol ?? '')
  }

  // Check access cookie (for actual clients)
  const cookieName = `fp_portal_${id.replace(/-/g, '').slice(0, 12)}`
  const cookieStore = await cookies()
  const token = cookieStore.get(cookieName)?.value
  const isVerified = isTeamMember || (token ? verifyToken(id, token) : false)

  // Always fetch proyecto basics (for gate display)
  const { data: proyectoBasic } = await admin
    .from('proyectos')
    .select('id, nombre, imagen_url')
    .eq('id', id)
    .single()

  if (!proyectoBasic) notFound()

  if (!isVerified) {
    return (
      <ClientPortalGate
        proyectoId={id}
        proyectoNombre={proyectoBasic.nombre}
        imagenUrl={proyectoBasic.imagen_url ?? null}
      />
    )
  }

  const props = await loadPortalData(id, viewerRol)
  if (!props) notFound()

  return <ClientPortal {...props} />
}

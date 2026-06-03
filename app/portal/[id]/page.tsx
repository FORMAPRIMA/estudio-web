import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import ClientPortalGate from '@/components/portal/ClientPortalGate'
import ClientPortal from '@/components/portal/ClientPortal'
import { loadPortalData } from '@/lib/portal/load'

const SECRET = process.env.PORTAL_SECRET ?? 'fp-portal-secret-2024'

function verifyToken(proyectoId: string, token: string): boolean {
  const expected = createHmac('sha256', SECRET).update(proyectoId).digest('hex')
  return token === expected
}

export default async function PortalPage({ params }: { params: { id: string } }) {
  const { id } = params
  const admin = createAdminClient()

  // Resolve the viewer's role only to tailor what the portal shows (e.g. hide
  // "Documentos" for fp_team). Staff do NOT bypass the PIN: everyone — including
  // logged-in employees — must enter the access PIN to view the client portal.
  // For an internal preview without the PIN, use /team/clientes/plataforma/externa.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let viewerRol: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    viewerRol = profile?.rol ?? null
  }

  // Access is gated solely by the per-project PIN (stored as a verified cookie)
  const cookieName = `fp_portal_${id.replace(/-/g, '').slice(0, 12)}`
  const cookieStore = await cookies()
  const token = cookieStore.get(cookieName)?.value
  const isVerified = token ? verifyToken(id, token) : false

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

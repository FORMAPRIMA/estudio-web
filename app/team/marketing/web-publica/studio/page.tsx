import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StudioShell } from '@/components/team/web-publica/studio/StudioShell'
import { STUDIO_PAGINAS } from '@/lib/web-publica-studio'

export const metadata = { title: 'Modo Diseño · Web pública' }
export const dynamic = 'force-dynamic'

// Mismo criterio que el CMS y que cada Server Action del módulo: la web pública
// la diseñan socios y business development.
const ROLES_CMS = ['fp_partner', 'fp_biz_dev']

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/team/marketing/web-publica/studio')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !ROLES_CMS.includes(profile.rol)) {
    return (
      <div style={{ padding: 48, maxWidth: 620 }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Modo Diseño</h1>
        <p style={{ fontSize: 13, color: '#1A1A1A80', lineHeight: 1.6, marginTop: 14 }}>
          El diseño de la web pública lo ajustan los socios y el equipo de business development.
          Si necesitas cambiar algo, pídeselo a Jose o a Ana Cristina.
        </p>
      </div>
    )
  }

  return <StudioShell paginas={STUDIO_PAGINAS.map((p) => ({ ...p }))} />
}

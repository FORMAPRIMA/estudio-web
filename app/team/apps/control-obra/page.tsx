import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getObraData } from '@/app/actions/control-obra'
import { canAccessControlObra } from '@/lib/control-obra/domain'
import ControlObraPage from '@/components/team/control-obra/ControlObraPage'

export const metadata = { title: 'Control de obra' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !canAccessControlObra(profile.rol, user.email)) redirect('/team/apps')

  const data = await getObraData()
  if (!data) {
    return (
      <div style={{ padding: '48px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, color: '#1A1A1A' }}>Control de obra</h1>
        <p style={{ fontSize: 13, color: '#1A1A1A80', marginTop: 12 }}>
          La obra aún no está inicializada. Ejecuta la migración{' '}
          <code style={{ background: '#F0EEE8', padding: '2px 6px', borderRadius: 3 }}>
            supabase/migrations/control_obra.sql
          </code>{' '}
          en Supabase.
        </p>
      </div>
    )
  }

  return <ControlObraPage data={data} />
}

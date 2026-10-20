import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPanelData } from '@/app/actions/presupuestos-parametricos'
import { canAccessPresupuestosParametricos } from '@/lib/presupuestos-parametricos/domain'
import PresupuestosParametricosPage from '@/components/team/presupuestos-parametricos/PresupuestosParametricosPage'

export const metadata = { title: 'Presupuestos paramétricos' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !canAccessPresupuestosParametricos(profile.rol)) redirect('/team/apps')

  const data = await getPanelData()
  if (!data.isMigrado) {
    return (
      <div style={{ padding: '48px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, color: '#1A1A1A' }}>Presupuestos paramétricos</h1>
        <p style={{ fontSize: 13, color: '#1A1A1A80', marginTop: 12 }}>
          La base aún no está creada. Ejecuta la migración{' '}
          <code style={{ background: '#F0EEE8', padding: '2px 6px', borderRadius: 3 }}>
            supabase/migrations/presupuestos_parametricos.sql
          </code>{' '}
          en Supabase.
        </p>
      </div>
    )
  }

  return <PresupuestosParametricosPage data={data} />
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEscenarios, getCapex } from '@/app/actions/modelo-cafe'
import ModeloCafePage from '@/components/team/modelo-cafe/ModeloCafePage'

export const metadata = { title: 'Modelo Café Goya' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/apps')

  const escenarios = await getEscenarios()
  if (escenarios.length === 0) {
    return (
      <div style={{ padding: '48px', maxWidth: 640 }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, color: '#1A1A1A' }}>Modelo Café Goya</h1>
        <p style={{ fontSize: 13, color: '#1A1A1A80', marginTop: 12 }}>
          Aún no hay escenarios. Ejecuta la migración{' '}
          <code style={{ background: '#F0EEE8', padding: '2px 6px', borderRadius: 3 }}>
            supabase/migrations/modelo_cafe.sql
          </code>{' '}
          en Supabase.
        </p>
      </div>
    )
  }

  const capexInicial = await getCapex()
  return <ModeloCafePage escenariosIniciales={escenarios} capexInicial={capexInicial} />
}

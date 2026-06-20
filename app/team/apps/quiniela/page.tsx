import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { getQuinielaData } from '@/app/actions/quiniela'
import QuinielaPage from '@/components/team/quiniela/QuinielaPage'
import { quinielaFontVars } from '@/components/team/quiniela/fonts'

export const metadata = { title: 'La Porra del Mundial' }
export const dynamic = 'force-dynamic'

export default async function QuinielaRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('id, rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const data = await getQuinielaData()
  if ('error' in data) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <p style={{ fontSize: 13, color: '#1A1A1A99' }}>
          La porra aún no está lista: {data.error}
        </p>
        <p style={{ fontSize: 12, color: '#1A1A1A60', marginTop: 8 }}>
          (¿Falta ejecutar las migraciones de quiniela en Supabase?)
        </p>
      </div>
    )
  }

  return (
    <div className={quinielaFontVars}>
      <QuinielaPage
        data={data}
        isPartner={profile.rol === 'fp_partner'}
        esExterno={false}
      />
    </div>
  )
}

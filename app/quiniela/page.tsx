import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { getQuinielaData } from '@/app/actions/quiniela'
import QuinielaGate from '@/components/quiniela/QuinielaGate'
import QuinielaPage from '@/components/team/quiniela/QuinielaPage'
import { quinielaFontVars } from '@/components/team/quiniela/fonts'

export const metadata = { title: 'La Porra del Mundial · Forma Prima' }
export const dynamic = 'force-dynamic'

export default async function QuinielaPublicRoute() {
  // El staff FP entra por su versión interna (con botón "Apuntarme" y admin),
  // aunque le hayan compartido el enlace público.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (profile && FP_ROLES.includes(profile.rol as FpRole)) {
      redirect('/team/apps/quiniela')
    }
  }

  const data = await getQuinielaData()

  if ('error' in data) {
    if (data.error === 'SIN_SESION') {
      // Sin sesión: solo exponemos el monto de entrada y cuántos juegan (para el gate)
      const admin = createAdminClient()
      const [{ data: configRow }, { count }] = await Promise.all([
        admin.from('quiniela_config').select('value').eq('key', 'monto_entrada').maybeSingle(),
        admin.from('quiniela_jugadores').select('id', { count: 'exact', head: true }),
      ])
      const monto = parseFloat(configRow?.value || '20') || 20
      return (
        <div className={quinielaFontVars}>
          <QuinielaGate monto={monto} numJugadores={count ?? 0} />
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', background: '#070a16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: '#8b97bd' }}>La porra no está disponible ahora mismo. Vuelve a intentarlo en un rato.</p>
      </div>
    )
  }

  return (
    <div className={quinielaFontVars}>
      <QuinielaPage data={data} isPartner={false} esExterno />
    </div>
  )
}

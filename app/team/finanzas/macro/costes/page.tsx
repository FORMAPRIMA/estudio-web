import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CostesGeneralesPage from '@/components/team/finanzas/CostesGeneralesPage'

export const metadata = { title: 'Costes · Finanzas generales' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()
  const año = new Date().getFullYear()

  const [
    { data: members },
    { data: costosFijos },
    { data: configRows },
    { data: costosVariables },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, nombre, apellido, avatar_url, rol, blocked, seniority, salario_mensual, horas_mensuales')
      .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])
      .order('nombre'),
    admin
      .from('costos_fijos')
      .select('id, concepto, monto, orden')
      .order('orden'),
    admin
      .from('finanzas_config')
      .select('key, value')
      .eq('key', 'minoracion_no_facturable'),
    admin
      .from('costos_variables')
      .select('id, año, mes, categoria, concepto, monto, notas, proyecto_id, proyecto_nombre')
      .eq('año', año)
      .order('mes')
      .order('created_at'),
  ])

  const minoracion = configRows?.[0]?.value ?? 0

  return (
    <CostesGeneralesPage
      members={members ?? []}
      costosFijos={costosFijos ?? []}
      minoracion={minoracion}
      costosVariables={((costosVariables ?? []) as any[]).map((v: any) => ({
        id:        v.id,
        año:       v.año,
        mes:       v.mes,
        categoria: v.categoria,
        concepto:  v.concepto,
        monto:     v.monto,
        notas:     v.notas ?? null,
      }))}
      año={año}
    />
  )
}

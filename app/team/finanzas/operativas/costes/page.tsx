import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CostesOperativasPage from '@/components/team/finanzas/CostesOperativasPage'

export const metadata = { title: 'Costes · Finanzas operativas' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()

  const [
    { data: members, error: membersError },
    { data: costosFijos },
    { data: configRows },
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
  ])

  if (membersError) {
    console.error('[costes] Supabase error:', membersError.message)
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '40px', background: '#F8F7F4', minHeight: '100vh' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Finanzas operativas
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: '0 0 32px', letterSpacing: '-0.01em' }}>
          Costes fijos/variables
        </h1>
        <div style={{ background: '#fff', border: '1px solid #ECEAE4', borderRadius: 8, padding: '28px 32px', maxWidth: 560 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#D85A30', marginBottom: 8 }}>Migración pendiente</p>
          <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>
            Las columnas de costes aún no existen en la base de datos. Ejecuta esto en el SQL Editor de Supabase:
          </p>
          <pre style={{ background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 4, padding: '12px 16px', fontSize: 11, color: '#333', overflowX: 'auto' }}>{`ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS seniority       text,
  ADD COLUMN IF NOT EXISTS salario_mensual numeric,
  ADD COLUMN IF NOT EXISTS horas_mensuales numeric;

CREATE TABLE IF NOT EXISTS costos_fijos (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto text NOT NULL DEFAULT '',
  monto   numeric NOT NULL DEFAULT 0,
  orden   integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finanzas_config (
  key   text PRIMARY KEY,
  value numeric NOT NULL DEFAULT 0
);`}</pre>
          <p style={{ fontSize: 10, color: '#AAA', marginTop: 12 }}>Error: {membersError.message}</p>
        </div>
      </div>
    )
  }

  const minoracion = configRows?.[0]?.value ?? 0

  return (
    <CostesOperativasPage
      members={members ?? []}
      costosFijos={costosFijos ?? []}
      minoracion={minoracion}
    />
  )
}

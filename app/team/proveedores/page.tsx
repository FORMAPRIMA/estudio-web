import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProveedoresPage from '@/components/team/proveedores/ProveedoresPage'

export const metadata = { title: 'Base de datos proveedores' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    redirect('/team/dashboard')

  const admin = createAdminClient()

  const { data: proveedores } = await admin
    .from('proveedores')
    .select('id, nombre, tipo, contacto_nombre, email, email_cc, telefono, web, direccion, notas, nif_cif, razon_social, direccion_fiscal, iban, forma_pago, condiciones_pago, created_at')
    .order('nombre')

  return <ProveedoresPage proveedores={proveedores ?? []} />
}

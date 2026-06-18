import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ContratoDetalle from '@/components/team/captacion/ContratoDetalle'
import { getPlantillaClausulas } from '@/app/actions/plantillaContratos'

export const metadata = { title: 'Contrato · Captación' }

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()

  const [{ data: contrato }, { data: leads }, plantillaClausulas] = await Promise.all([
    admin.from('contratos').select('*').eq('id', params.id).single(),
    admin.from('leads').select('id, nombre, apellidos, empresa, nif_cif, email, email_cc, telefono, telefono_alt, direccion, ciudad, codigo_postal, pais').order('nombre'),
    getPlantillaClausulas(),
  ])

  if (!contrato) notFound()

  return (
    <ContratoDetalle
      contrato={contrato}
      leads={leads ?? []}
      plantillaClausulas={plantillaClausulas}
    />
  )
}

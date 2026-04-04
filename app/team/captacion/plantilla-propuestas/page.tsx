import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'
import PlantillaPropuestasPage from '@/components/team/captacion/PlantillaPropuestasPage'

export const metadata = { title: 'Plantilla de propuestas · Captación' }
export const dynamic  = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const servicios = await getPlantillaServicios()
  return <PlantillaPropuestasPage servicios={servicios} />
}

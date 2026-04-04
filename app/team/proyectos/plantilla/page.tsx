import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlantillaManager from '@/components/team/proyectos/PlantillaManager'
import type { CatalogoFase, PlantillaTask } from '@/lib/types'

export const metadata = { title: 'Plantilla de tasks' }
export const dynamic = 'force-dynamic'

export default async function PlantillaPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    redirect('/team/proyectos')
  }

  const { data: catalogoFases } = await supabase
    .from('catalogo_fases')
    .select('id, numero, label, seccion, orden')
    .order('orden')

  const { data: plantillaTasks } = await supabase
    .from('plantilla_tasks')
    .select('*')
    .order('orden')

  return (
    <PlantillaManager
      catalogoFases={(catalogoFases ?? []) as CatalogoFase[]}
      initialTasks={(plantillaTasks ?? []) as PlantillaTask[]}
    />
  )
}

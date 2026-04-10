import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlantillaManager from '@/components/team/proyectos/PlantillaManager'
import type { CatalogoFase, PlantillaTask } from '@/lib/types'
import type { ProyectoNegocio, SeccionNegocio, FaseNegocio, OfertaFP } from '@/components/team/proyectos/PlantillaManager'

export const metadata = { title: 'Plantilla de tasks' }
export const dynamic = 'force-dynamic'

export default async function PlantillaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile || !['fp_manager', 'fp_partner'].includes(profile.rol)) {
    redirect('/team/proyectos')
  }

  const [
    { data: catalogoFases },
    { data: plantillaTasks },
    { data: proyectosNegocio },
    { data: seccionesNegocio },
    { data: fasesNegocio },
    { data: ofertasFP },
  ] = await Promise.all([
    supabase.from('catalogo_fases').select('id, numero, label, seccion, orden').order('orden'),
    supabase.from('plantilla_tasks').select('*').order('orden'),
    supabase.from('proyectos_internos').select('id, nombre, activo, orden').order('orden'),
    supabase.from('proyectos_internos_secciones').select('id, proyecto_id, nombre, orden').order('orden'),
    supabase.from('proyectos_internos_fases').select('id, seccion_id, nombre, orden').order('orden'),
    supabase.from('ofertas_fp').select('id, nombre, cliente_potencial, activo, orden').order('orden'),
  ])

  return (
    <PlantillaManager
      catalogoFases={(catalogoFases ?? []) as CatalogoFase[]}
      initialTasks={(plantillaTasks ?? []) as PlantillaTask[]}
      proyectosNegocio={(proyectosNegocio ?? []) as ProyectoNegocio[]}
      seccionesNegocio={(seccionesNegocio ?? []) as SeccionNegocio[]}
      fasesNegocio={(fasesNegocio ?? []) as FaseNegocio[]}
      ofertasFP={(ofertasFP ?? []) as OfertaFP[]}
    />
  )
}

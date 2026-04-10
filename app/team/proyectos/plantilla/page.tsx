import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlantillaManager from '@/components/team/proyectos/PlantillaManager'
import type { CatalogoFase, PlantillaTask } from '@/lib/types'
import type { ProyectoNegocio, SeccionNegocio, FaseNegocio, OfertaFP, TeamMemberSimple } from '@/components/team/proyectos/PlantillaManager'

export const metadata = { title: 'Plantilla de tasks' }
export const dynamic = 'force-dynamic'

const PALETTE = [
  '#D85A30','#E8913A','#C9A227','#E6B820','#B8860B',
  '#D4622A','#F0A500','#C07020','#E57C2F','#A0720A',
]

function mkInitials(n: string) {
  return n.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

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
    { data: teamData },
  ] = await Promise.all([
    supabase.from('catalogo_fases').select('id, numero, label, seccion, orden').order('orden'),
    supabase.from('plantilla_tasks').select('*').order('orden'),
    supabase.from('proyectos_internos').select('id, nombre, activo, orden, visible_para').order('orden'),
    supabase.from('proyectos_internos_secciones').select('id, proyecto_id, nombre, orden').order('orden'),
    supabase.from('proyectos_internos_fases').select('id, seccion_id, nombre, orden').order('orden'),
    supabase.from('ofertas_fp').select('id, nombre, cliente_potencial, activo, orden, visible_para').order('orden'),
    supabase.from('profiles').select('id, nombre').in('rol', ['fp_team', 'fp_manager', 'fp_partner']).order('nombre'),
  ])

  const teamMembers: TeamMemberSimple[] = (teamData ?? []).map((m, i) => ({
    id:       m.id as string,
    nombre:   m.nombre as string,
    initials: mkInitials(m.nombre as string),
    color:    PALETTE[i % PALETTE.length],
  }))

  return (
    <PlantillaManager
      catalogoFases={(catalogoFases ?? []) as CatalogoFase[]}
      initialTasks={(plantillaTasks ?? []) as PlantillaTask[]}
      proyectosNegocio={(proyectosNegocio ?? []) as ProyectoNegocio[]}
      seccionesNegocio={(seccionesNegocio ?? []) as SeccionNegocio[]}
      fasesNegocio={(fasesNegocio ?? []) as FaseNegocio[]}
      ofertasFP={(ofertasFP ?? []) as OfertaFP[]}
      teamMembers={teamMembers}
    />
  )
}

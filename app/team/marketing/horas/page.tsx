import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketingHorasPage } from '@/components/team/marketing/MarketingHorasPage'
import type {
  ProyectoNegocio,
  SeccionNegocio,
  FaseNegocio,
  TeamMemberSimple,
} from '@/components/team/proyectos/PlantillaManager'

export const metadata = { title: 'Horas — Marketing' }
export const dynamic = 'force-dynamic'

const PALETTE = [
  '#D85A30','#E8913A','#C9A227','#E6B820','#B8860B',
  '#D4622A','#F0A500','#C07020','#E57C2F','#A0720A',
]

function mkInitials(n: string) {
  return n.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export default async function MarketingHorasRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, rol, nombre')
    .eq('id', user.id)
    .single()

  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) {
    redirect('/team/dashboard')
  }

  // Cargar proyectos internos de marketing + secciones + fases
  const [
    { data: proyectosData },
    { data: seccionesData },
    { data: fasesData },
    { data: teamData },
  ] = await Promise.all([
    supabase
      .from('proyectos_internos')
      .select('id, nombre, activo, orden, visible_para, equipo')
      .eq('equipo', 'marketing')
      .order('orden'),
    supabase
      .from('proyectos_internos_secciones')
      .select('id, proyecto_id, nombre, orden')
      .order('orden'),
    supabase
      .from('proyectos_internos_fases')
      .select('id, seccion_id, nombre, orden')
      .order('orden'),
    supabase
      .from('profiles')
      .select('id, nombre')
      .in('rol', ['fp_partner', 'fp_biz_dev'])
      .order('nombre'),
  ])

  // Filtrar secciones y fases a las que pertenecen a un proyecto de marketing
  const proyectoIds = new Set((proyectosData ?? []).map(p => p.id as string))
  const seccionesMkt = (seccionesData ?? []).filter(s => proyectoIds.has(s.proyecto_id as string))
  const seccionIds = new Set(seccionesMkt.map(s => s.id as string))
  const fasesMkt = (fasesData ?? []).filter(f => seccionIds.has(f.seccion_id as string))

  const teamMembers: TeamMemberSimple[] = (teamData ?? []).map((m, i) => ({
    id:       m.id as string,
    nombre:   m.nombre as string,
    initials: mkInitials(m.nombre as string),
    color:    PALETTE[i % PALETTE.length],
  }))

  return (
    <MarketingHorasPage
      currentUserId={user.id}
      currentUserRole={profile.rol as 'fp_partner' | 'fp_biz_dev'}
      proyectosNegocio={(proyectosData ?? []) as ProyectoNegocio[]}
      seccionesNegocio={seccionesMkt as SeccionNegocio[]}
      fasesNegocio={fasesMkt as FaseNegocio[]}
      teamMembers={teamMembers}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AreaInternaPage from '@/components/team/area-interna/AreaInternaPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Área Interna FP' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user: session } } = await supabase.auth.getUser()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, rol, fecha_contratacion, avatar_url')
    .eq('id', session.id)
    .single()

  if (!profile || !['fp_team', 'fp_manager', 'fp_partner'].includes(profile.rol)) {
    redirect('/team/dashboard')
  }

  const isPartner = profile.rol === 'fp_partner'
  const admin     = createAdminClient()

  // Fetch personal data + (for partners) all admin data in parallel
  const [
    nominasRes,
    periodosRes,
    participacionRes,
    allMembersRes,
    allPartesRes,
    allNominasRes,
    allProyectosRes,
  ] = await Promise.allSettled([
    supabase.from('nominas')
      .select('id, user_id, periodo, pdf_path, pdf_url, created_at')
      .eq('user_id', session.id)
      .order('periodo', { ascending: false }),

    supabase.from('fondo_fp_periodos')
      .select('id, periodo, valor_total, rendimiento_pct, notas, fecha_referencia')
      .order('fecha_referencia', { ascending: true }),

    supabase.from('fondo_fp_participaciones')
      .select('id, user_id, porcentaje_participacion, fecha_inicio_participacion, notas')
      .eq('user_id', session.id)
      .maybeSingle(),

    isPartner
      ? admin.from('profiles')
          .select('id, nombre, apellido, email, rol, avatar_url, fecha_contratacion, telefono, direccion, fecha_nacimiento, notas, blocked, salario_mensual, seniority')
          .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])
          .order('nombre')
      : Promise.resolve({ data: [] }),

    isPartner
      ? admin.from('fondo_fp_participaciones')
          .select('id, user_id, porcentaje_participacion, fecha_inicio_participacion, notas, profiles(nombre, apellido, email, rol)')
          .order('created_at')
      : Promise.resolve({ data: [] }),

    isPartner
      ? admin.from('nominas')
          .select('id, user_id, periodo, pdf_path, pdf_url, created_at')
          .order('periodo', { ascending: false })
      : Promise.resolve({ data: [] }),

    isPartner
      ? admin.from('fondo_proyectos')
          .select('*')
          .order('fecha_inversion')
      : Promise.resolve({ data: [] }),
  ])

  const nominas       = nominasRes.status       === 'fulfilled' ? (nominasRes.value.data        ?? []) : []
  const periodos      = periodosRes.status      === 'fulfilled' ? (periodosRes.value.data        ?? []) : []
  const participacion = participacionRes.status === 'fulfilled' ? (participacionRes.value.data   ?? null) : null
  const allMembers    = allMembersRes.status    === 'fulfilled' ? ((allMembersRes.value as any).data ?? []) : []
  const allPartes     = allPartesRes.status     === 'fulfilled' ? ((allPartesRes.value as any).data  ?? []) : []
  const allNominas    = allNominasRes.status    === 'fulfilled' ? ((allNominasRes.value as any).data ?? []) : []
  const allProyectos  = allProyectosRes.status  === 'fulfilled' ? ((allProyectosRes.value as any).data ?? []) : []

  return (
    <AreaInternaPage
      currentUser={{
        id:                 session.id,
        email:              session.email ?? '',
        nombre:             profile.nombre,
        apellido:           profile.apellido   ?? null,
        rol:                profile.rol as 'fp_team' | 'fp_manager' | 'fp_partner',
        fecha_contratacion: profile.fecha_contratacion ?? null,
        avatar_url:         profile.avatar_url ?? null,
      }}
      initialNominas={nominas}
      initialPeriodos={periodos}
      initialParticipacion={participacion}
      allMembers={allMembers}
      allParticipaciones={allPartes}
      allNominas={allNominas}
      allProyectos={allProyectos}
    />
  )
}

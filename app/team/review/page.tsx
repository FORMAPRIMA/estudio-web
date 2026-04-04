import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReviewPage from '@/components/team/review/ReviewPage'

export const metadata = { title: 'Review' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  // Active projects
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('id, nombre, codigo, imagen_url, status')
    .in('status', ['activo', 'on_hold'])
    .order('nombre')

  const proyectoIds = (proyectos ?? []).map((p: { id: string }) => p.id)

  // All tasks for those projects (pending, in_progress, blocked + last 5 completed)
  const { data: tasks } = proyectoIds.length > 0
    ? await supabase
        .from('tasks')
        .select('id, codigo, titulo, proyecto_id, fase_id, responsable_ids, status, orden_urgencia, prioridad, created_at, fecha_limite, catalogo_fases(numero, label, seccion)')
        .in('proyecto_id', proyectoIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Team members for responsable picker
  const { data: members } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, avatar_url, rol')
    .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])
    .order('nombre')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedTasks = (tasks ?? []).map((t: any) => ({
    ...t,
    catalogo_fases: Array.isArray(t.catalogo_fases) ? (t.catalogo_fases[0] ?? null) : t.catalogo_fases,
  }))

  return (
    <ReviewPage
      proyectos={proyectos ?? []}
      tasks={normalizedTasks}
      members={members ?? []}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import KanbanBoard from '@/components/team/proyectos/KanbanBoard'
import type { ProyectoInterno, CatalogoFase, UserProfile } from '@/lib/types'

export const metadata = { title: 'Proyectos' }
export const dynamic = 'force-dynamic'

export default async function ProyectosPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: proyectosRaw } = await supabase
    .from('proyectos')
    .select(`
      id, nombre, direccion, imagen_url, superficie_diseno,
      superficie_catastral, superficie_util, cliente_id, status,
      created_by, created_at,
      clientes!cliente_id(id, nombre),
      proyecto_fases(
        id, fase_id, responsables, status, fase_status,
        catalogo_fases(id, numero, label, seccion, orden)
      )
    `)
    .order('created_at', { ascending: false })

  const { data: catalogoFases } = await supabase
    .from('catalogo_fases')
    .select('id, numero, label, seccion, orden')
    .order('orden')

  const admin = createAdminClient()
  const { data: clientes } = await admin
    .from('clientes')
    .select('id, nombre, apellidos, empresa')
    .order('nombre')

  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, nombre, rol, email')
    .neq('rol', 'cliente')
    .order('nombre')

  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select('proyecto_id, fase_id, status')

  const { data: fasesRaw } = await supabase
    .from('proyecto_fases')
    .select('proyecto_id, horas_objetivo, fase_status')

  // Compute progress per project + completed fase keys
  const TASK_SCORE: Record<string, number> = { pendiente: 0, en_progreso: 0.5, bloqueado: 0.25, completado: 1 }
  const progressByProject: Record<string, number> = {}
  const completedFaseKeys = new Set<string>()
  if (tasksRaw) {
    const byProject: Record<string, { sum: number; count: number }> = {}
    const byFase:    Record<string, { total: number; done: number }> = {}
    for (const t of tasksRaw) {
      if (!byProject[t.proyecto_id]) byProject[t.proyecto_id] = { sum: 0, count: 0 }
      byProject[t.proyecto_id].sum += TASK_SCORE[t.status] ?? 0
      byProject[t.proyecto_id].count += 1
      if (t.fase_id) {
        const fk = `${t.proyecto_id}__${t.fase_id}`
        if (!byFase[fk]) byFase[fk] = { total: 0, done: 0 }
        byFase[fk].total += 1
        if (t.status === 'completado') byFase[fk].done += 1
      }
    }
    for (const [id, { sum, count }] of Object.entries(byProject)) {
      progressByProject[id] = Math.round((sum / count) * 100)
    }
    for (const [key, { total, done }] of Object.entries(byFase)) {
      if (total > 0 && done === total) completedFaseKeys.add(key)
    }
  }

  // Compute total and iniciadas horas_objetivo per project
  const horasByProject: Record<string, number> = {}
  const horasIniciadasByProject: Record<string, number> = {}
  for (const pf of fasesRaw ?? []) {
    if (!horasByProject[pf.proyecto_id]) horasByProject[pf.proyecto_id] = 0
    horasByProject[pf.proyecto_id] += pf.horas_objetivo ?? 0
    if (pf.fase_status === 'iniciada') {
      if (!horasIniciadasByProject[pf.proyecto_id]) horasIniciadasByProject[pf.proyecto_id] = 0
      horasIniciadasByProject[pf.proyecto_id] += pf.horas_objetivo ?? 0
    }
  }

  return (
    <KanbanBoard
      proyectos={(proyectosRaw ?? []) as unknown as ProyectoInterno[]}
      catalogoFases={(catalogoFases ?? []) as CatalogoFase[]}
      clientes={clientes ?? []}
      teamMembers={(teamMembers ?? []) as UserProfile[]}
      currentUserId={session.user.id}
      currentUserRole={profile.rol}
      progressByProject={progressByProject}
      horasByProject={horasByProject}
      horasIniciadasByProject={horasIniciadasByProject}
      completedFaseKeys={completedFaseKeys}
    />
  )
}

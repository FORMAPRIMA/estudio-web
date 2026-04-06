import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PropuestaDetalle from '@/components/team/captacion/PropuestaDetalle'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()
  const [
    { data: propuesta },
    { data: leads },
    { data: clientes },
    { data: ratiosFases },
    serviciosPlantilla,
    { data: activeProyectos },
    { count: teamCount },
  ] = await Promise.all([
    admin.from('propuestas').select('*').eq('id', params.id).single(),
    admin.from('leads').select('id, nombre, apellidos, empresa, email, telefono, direccion').order('nombre'),
    admin.from('clientes').select('id, nombre, apellidos, empresa, email, telefono, direccion').order('nombre'),
    admin.from('catalogo_fases').select('id, label, seccion, ratio').order('orden'),
    getPlantillaServicios(),
    admin.from('proyectos').select('id').in('status', ['activo', 'on_hold']),
    admin.from('profiles').select('id', { count: 'exact', head: true }).neq('rol', 'cliente'),
  ])

  if (!propuesta) notFound()

  // Fetch pipeline phases + tasks for active projects
  const activeIds = (activeProyectos ?? []).map(p => p.id)
  const [{ data: pipelineFases }, { data: pipelineTasks }] = activeIds.length > 0
    ? await Promise.all([
        admin
          .from('proyecto_fases')
          .select('proyecto_id, fase_id, horas_objetivo, proyectos(nombre), catalogo_fases(seccion, label)')
          .in('proyecto_id', activeIds)
          .eq('fase_status', 'iniciada'),          // solo fases en marcha
        admin
          .from('tasks')
          .select('proyecto_id, fase_id, status')
          .in('proyecto_id', activeIds)
          .neq('status', 'completado'),             // solo tasks pendientes
      ])
    : [{ data: [] }, { data: [] }]

  // Remaining task count per (proyecto_id, fase_id)
  const pendingMap: Record<string, number> = {}
  const totalMap:   Record<string, number> = {}
  for (const t of pipelineTasks ?? []) {
    const key = `${t.proyecto_id}__${t.fase_id}`
    pendingMap[key] = (pendingMap[key] ?? 0) + 1
  }
  // We also need total tasks (including completed) to compute the fraction remaining.
  // Fetch total count separately.
  const { data: allTasks } = activeIds.length > 0
    ? await admin
        .from('tasks')
        .select('proyecto_id, fase_id')
        .in('proyecto_id', activeIds)
    : { data: [] }
  for (const t of allTasks ?? []) {
    const key = `${t.proyecto_id}__${t.fase_id}`
    totalMap[key] = (totalMap[key] ?? 0) + 1
  }

  // Aggregate remaining hours by service section + build detalle
  const pipelineHoras: Record<string, number> = {
    anteproyecto: 0, proyecto_ejecucion: 0, direccion_obra: 0,
    interiorismo: 0, gestion_interiorismo: 0,
  }
  const pipelineDetalle: {
    proyectoNombre: string
    faseLabel: string
    seccionId: string
    horasTotal: number
    horasRestantes: number
    tasksPendientes: number
    tasksTotal: number
  }[] = []

  for (const pf of pipelineFases ?? []) {
    const h = pf.horas_objetivo ?? 0
    if (!h) continue
    const key      = `${pf.proyecto_id}__${pf.fase_id}`
    const total    = totalMap[key]   ?? 0
    const pending  = pendingMap[key] ?? 0
    const fraction = total > 0 ? pending / total : 1
    const remaining = h * fraction
    const cf  = pf.catalogo_fases as unknown as { seccion: string; label: string } | null
    const pro = pf.proyectos      as unknown as { nombre: string } | null
    const sec = (cf?.seccion ?? '').toLowerCase()
    const lbl = (cf?.label   ?? '').toLowerCase()

    let seccionId: string | null = null
    if (sec.includes('anteproyecto'))                               { pipelineHoras.anteproyecto         += remaining; seccionId = 'anteproyecto' }
    else if (sec.includes('ejecuci'))                               { pipelineHoras.proyecto_ejecucion   += remaining; seccionId = 'proyecto_ejecucion' }
    else if (sec.includes('interiorismo') && lbl.includes('gesti')) { pipelineHoras.gestion_interiorismo += remaining; seccionId = 'gestion_interiorismo' }
    else if (sec.includes('interiorismo'))                          { pipelineHoras.interiorismo          += remaining; seccionId = 'interiorismo' }
    else if (sec.includes('obra') && !sec.includes('interiorismo')) { pipelineHoras.direccion_obra       += remaining }

    // Only include design sections in detalle
    if (seccionId) {
      pipelineDetalle.push({
        proyectoNombre:  pro?.nombre ?? '—',
        faseLabel:       cf?.label   ?? '—',
        seccionId,
        horasTotal:      Math.round(h),
        horasRestantes:  Math.round(remaining),
        tasksPendientes: pending,
        tasksTotal:      total,
      })
    }
  }

  pipelineDetalle.sort((a, b) =>
    a.proyectoNombre.localeCompare(b.proyectoNombre) || a.faseLabel.localeCompare(b.faseLabel)
  )

  const contactos = [
    ...(leads ?? []).map(l => ({ ...l, source: 'lead' as const })),
    ...(clientes ?? []).map(c => ({ ...c, source: 'cliente' as const })),
  ]

  return (
    <PropuestaDetalle
      propuesta={propuesta}
      contactos={contactos as Parameters<typeof PropuestaDetalle>[0]['contactos']}
      ratiosFases={(ratiosFases ?? []) as Parameters<typeof PropuestaDetalle>[0]['ratiosFases']}
      serviciosPlantilla={serviciosPlantilla as Parameters<typeof PropuestaDetalle>[0]['serviciosPlantilla']}
      pipelineHoras={pipelineHoras}
      pipelineDetalle={pipelineDetalle}
      teamCount={teamCount ?? 1}
    />
  )
}

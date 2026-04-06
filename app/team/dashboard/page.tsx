import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ProjectBanner from '@/components/team/dashboard/ProjectBanner'
import TasksUrgencia from '@/components/team/dashboard/TasksUrgencia'
import ProyectosCarrusel from '@/components/team/dashboard/ProyectosCarrusel'
import AvisosStrip from '@/components/team/dashboard/AvisosStrip'
import FacturasCobrables from '@/components/team/dashboard/FacturasCobrables'
import type { DashboardTask } from '@/components/team/dashboard/TasksUrgencia'
import type { DashboardProyecto } from '@/components/team/dashboard/ProyectosCarrusel'
import type { Aviso } from '@/components/team/dashboard/AvisosStrip'
import type { FacturaCobrable } from '@/components/team/dashboard/FacturasCobrables'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  fp_team: 'FP Team',
  fp_manager: 'FP Manager',
  fp_partner: 'FP Partner',
}

const PRIORITY_BONUS: Record<number, number> = { 0: 0, 1: 15, 2: 30, 3: 2000 }
function computeUrgencyScore(createdAt: string, prioridad: number, ordenUrgencia: number): number {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  return days + (PRIORITY_BONUS[prioridad] ?? 0) - ordenUrgencia * 0.0001
}

function getInitials(nombre: string) {
  const parts = nombre.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : nombre.slice(0, 2).toUpperCase()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // ── Avisos ────────────────────────────────────────────────────────────────
  const [{ data: avisosRaw }, { data: archivadosRaw }] = await Promise.all([
    supabase
      .from('avisos')
      .select('id, tipo, nivel, titulo, contenido, fecha_activa, fecha_caducidad, autor:profiles!autor_id(nombre)')
      .lte('fecha_activa', today)
      .or(`fecha_caducidad.is.null,fecha_caducidad.gte.${today}`)
      .or(`destinatario_id.is.null,destinatario_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('avisos_archivados')
      .select('aviso_id')
      .eq('user_id', user.id),
  ])

  const archivedIds = new Set((archivadosRaw ?? []).map((r: any) => r.aviso_id))
  const avisos: Aviso[] = (avisosRaw ?? [])
    .filter((a: any) => !archivedIds.has(a.id))
    .map((a: any) => ({
      id:              a.id,
      tipo:            a.tipo  as Aviso['tipo'],
      nivel:           (a.nivel ?? 'informativo') as Aviso['nivel'],
      titulo:          a.titulo,
      contenido:       a.contenido ?? null,
      fecha_activa:    a.fecha_activa,
      fecha_caducidad: a.fecha_caducidad ?? null,
      autor_nombre:    a.autor?.nombre ?? null,
    }))

  // ── Facturas cobrables + pendientes de pago (solo partners) ─────────────
  let facturasCobrables: FacturaCobrable[] = []
  let facturasPendientes: import('@/components/team/dashboard/AvisosStrip').FacturaPendiente[] = []

  if (profile.rol === 'fp_partner') {
    const admin = createAdminClient()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffIso = cutoff.toISOString().split('T')[0]

    const [{ data: cobrables }, { data: pendientes }] = await Promise.all([
      admin
        .from('facturas')
        .select('id, concepto, monto, proyecto_id, proyectos(id, nombre, codigo)')
        .eq('status', 'cobrable')
        .is('factura_emitida_id', null)
        .order('created_at'),
      admin
        .from('facturas_emitidas')
        .select(`
          id, numero_completo, fecha_emision, cliente_nombre, cliente_contacto,
          cliente_id, proyecto_nombre, total,
          clientes(id, email, email_cc)
        `)
        .eq('estado', 'enviada')
        .lte('fecha_emision', cutoffIso)
        .order('fecha_emision', { ascending: true }),
    ])

    facturasCobrables = (cobrables ?? []).map((f: any) => ({
      id:              f.id,
      concepto:        f.concepto,
      monto:           f.monto,
      proyecto_id:     f.proyectos?.id    ?? f.proyecto_id,
      proyecto_nombre: f.proyectos?.nombre ?? '—',
      proyecto_codigo: f.proyectos?.codigo ?? null,
    }))

    const hoy = new Date()
    facturasPendientes = (pendientes ?? []).map((f: any) => {
      const emision = new Date(f.fecha_emision)
      const dias = Math.floor((hoy.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id:              f.id,
        numero_completo: f.numero_completo,
        cliente_nombre:  f.cliente_nombre ?? '—',
        cliente_contacto: f.cliente_contacto ?? null,
        cliente_email:   (f.clientes as any)?.email   ?? null,
        cliente_email_cc: (f.clientes as any)?.email_cc ?? null,
        proyecto_nombre: f.proyecto_nombre ?? null,
        total:           f.total,
        fecha_emision:   f.fecha_emision,
        dias_pendiente:  dias,
      }
    })
  }

  // Banner images — latest projects with imagen_url
  const { data: proyectosRaw } = await supabase
    .from('proyectos')
    .select('id, nombre, imagen_url')
    .not('imagen_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8)

  const bannerImages = (proyectosRaw ?? [])
    .filter(p => p.imagen_url)
    .map(p => ({ url: p.imagen_url as string, nombre: p.nombre }))

  // Team members for responsable lookup
  const { data: teamRaw } = await supabase
    .from('profiles')
    .select('id, nombre, avatar_url')
    .neq('rol', 'cliente')

  const teamMap: Record<string, { nombre: string; avatar_url: string | null }> = {}
  for (const m of teamRaw ?? []) teamMap[m.id] = { nombre: m.nombre, avatar_url: m.avatar_url ?? null }

  // Tasks where this user is responsable — fetch all statuses, filter client-side
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select(`
      id, codigo, titulo, status, prioridad, orden_urgencia, created_at, fecha_limite,
      proyecto_id, fase_id, responsable_ids,
      proyectos(nombre, codigo, status),
      catalogo_fases(numero, label)
    `)
    .contains('responsable_ids', [user.id])

  const tasks: DashboardTask[] = (tasksRaw ?? [])
    .map((t: any) => ({
      id: t.id,
      codigo: t.codigo,
      titulo: t.titulo,
      status: t.status,
      prioridad: t.prioridad ?? 0,
      orden_urgencia: t.orden_urgencia ?? 0,
      urgency_score: computeUrgencyScore(t.created_at, t.prioridad ?? 0, t.orden_urgencia ?? 0),
      proyecto_id: t.proyecto_id,
      proyecto_nombre: t.proyectos?.nombre ?? '—',
      proyecto_codigo: t.proyectos?.codigo ?? null,
      proyecto_status: t.proyectos?.status ?? 'activo',
      fase_label: t.catalogo_fases?.label ?? '—',
      fase_numero: t.catalogo_fases?.numero ?? 0,
      fecha_limite: t.fecha_limite ?? null,
      responsables: (t.responsable_ids ?? []).map((id: string) => ({
        id,
        nombre: teamMap[id]?.nombre ?? id,
        initials: getInitials(teamMap[id]?.nombre ?? id),
        avatar_url: teamMap[id]?.avatar_url ?? null,
      })),
    }))
    // Pre-sort by urgency descending
    .sort((a, b) => b.urgency_score - a.urgency_score)

  // ── Mis proyectos carrusel ────────────────────────────────────────────────
  // Derive unique non-archived project IDs from the user's tasks
  const myProjectIds = Array.from(new Set(
    (tasksRaw ?? [])
      .filter((t: any) => t.proyectos?.status !== 'archivado')
      .map((t: any) => t.proyecto_id as string)
  ))

  const [{ data: misProyectosRaw }, { data: allTasksForProgress }, { data: fasesForHoras }] =
    await Promise.all([
      myProjectIds.length > 0
        ? supabase
            .from('proyectos')
            .select(`
              id, nombre, codigo, direccion, imagen_url, superficie_diseno, status,
              proyecto_fases(id, fase_id, horas_objetivo, fase_status,
                catalogo_fases(numero))
            `)
            .in('id', myProjectIds)
            .neq('status', 'archivado')
        : Promise.resolve({ data: [] }),
      myProjectIds.length > 0
        ? supabase
            .from('tasks')
            .select('proyecto_id, status')
            .in('proyecto_id', myProjectIds)
        : Promise.resolve({ data: [] }),
      Promise.resolve({ data: null }), // placeholder to keep destructure arity
    ])

  // Progress per project (all tasks, not just user's)
  const TASK_SCORE: Record<string, number> = { pendiente: 0, en_progreso: 0.5, bloqueado: 0.25, completado: 1 }
  const progressMap: Record<string, number> = {}
  for (const t of allTasksForProgress ?? []) {
    if (!progressMap[t.proyecto_id]) progressMap[t.proyecto_id] = 0
  }
  const taskAccum: Record<string, { sum: number; count: number }> = {}
  for (const t of allTasksForProgress ?? []) {
    if (!taskAccum[t.proyecto_id]) taskAccum[t.proyecto_id] = { sum: 0, count: 0 }
    taskAccum[t.proyecto_id].sum += TASK_SCORE[t.status] ?? 0
    taskAccum[t.proyecto_id].count += 1
  }
  for (const [id, { sum, count }] of Object.entries(taskAccum)) {
    progressMap[id] = Math.round((sum / count) * 100)
  }

  const misProyectos: DashboardProyecto[] = (misProyectosRaw ?? []).map((p: any) => {
    const fases: any[] = p.proyecto_fases ?? []
    return {
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo ?? null,
      direccion: p.direccion ?? null,
      imagen_url: p.imagen_url ?? null,
      superficie_diseno: p.superficie_diseno ?? null,
      status: p.status,
      fases: fases
        .filter(f => f.catalogo_fases)
        .map(f => ({ id: f.id, numero: f.catalogo_fases.numero }))
        .sort((a, b) => a.numero - b.numero),
      progress: progressMap[p.id] ?? 0,
      horasObjetivo: fases.reduce((acc: number, f: any) => acc + (f.horas_objetivo ?? 0), 0),
      horasIniciadas: fases
        .filter((f: any) => f.fase_status === 'iniciada')
        .reduce((acc: number, f: any) => acc + (f.horas_objetivo ?? 0), 0),
    }
  })

  const roleLabel = ROLE_LABELS[profile.rol] ?? profile.rol
  const firstName = profile.nombre?.split(' ')[0] ?? profile.nombre

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Banner ────────────────────────────────────────────────────────── */}
      {bannerImages.length > 0 ? (
        <ProjectBanner images={bannerImages} nombre={firstName} roleLabel={roleLabel} />
      ) : (
        <div className="relative w-full h-[calc(31vh+20px)] min-h-[200px] bg-ink/5 flex items-end">
          <div className="px-8 pb-[15px] lg:px-14 lg:pb-[23px]">
            <p className="text-[10px] tracking-widest uppercase font-medium text-ink/50 mb-2">{roleLabel}</p>
            <h1 className="text-4xl lg:text-5xl font-light text-ink tracking-tight leading-none">
              Hola, {firstName}.
            </h1>
          </div>
        </div>
      )}

      {/* ── Facturas cobrables (partners) ─────────────────────────────────── */}
      <FacturasCobrables facturas={facturasCobrables} />

      {/* ── Avisos ────────────────────────────────────────────────────────── */}
      <AvisosStrip avisos={avisos} facturasPendientes={facturasPendientes} />

      {/* ── Gadgets — stacked full-width sections ─────────────────────────── */}
      <div className="flex flex-col divide-y divide-ink/[0.06]">

        {/* Tasks de urgencia */}
        <section className="px-8 py-8 lg:px-14 lg:py-10">
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-[11px] tracking-widest uppercase font-medium text-ink/60">
              Mis tasks
            </p>
            {tasks.length > 0 && (
              <span className="text-xs font-medium text-ink/40 tabular-nums">
                {tasks.length} pendiente{tasks.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="border border-ink/20">
            <TasksUrgencia tasks={tasks} />
          </div>
        </section>

        {/* Mis proyectos */}
        {misProyectos.length > 0 && (
          <section className="px-8 py-8 lg:px-14 lg:py-10">
            <ProyectosCarrusel proyectos={misProyectos} />
          </section>
        )}

      </div>
    </div>
  )
}

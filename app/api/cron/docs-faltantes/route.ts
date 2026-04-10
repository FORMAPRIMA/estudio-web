import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron — runs every Monday at 10:00 UTC (vercel.json)
// For each active project created > 20 days ago:
//   - If renders is empty OR planos_pdf_url is null → alert all unique task responsables
//   - Deduplicates: one aviso per (proyecto, recipient) per week (ISO week key)

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // ISO week key: YYYY-WNN
  function isoWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }
  const weekKey = isoWeekKey(today)

  // ── Load projects that are 20+ days old and active ────────────────────────
  const cutoff = new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: proyectos, error: pErr } = await admin
    .from('proyectos')
    .select('id, nombre, renders, planos_pdf_url')
    .in('status', ['activo', 'on_hold'])
    .lte('created_at', cutoffStr)

  if (pErr) {
    console.error('[cron/docs-faltantes] proyectos error:', pErr)
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  // Filter only projects missing documentation
  const needsDocs = (proyectos ?? []).filter(p => {
    const hasRenders = Array.isArray(p.renders) && p.renders.length > 0
    const hasPlanos  = !!p.planos_pdf_url
    return !hasRenders || !hasPlanos
  })

  if (needsDocs.length === 0) {
    return NextResponse.json({ message: 'Todos los proyectos tienen documentación completa.', notified: 0 })
  }

  // ── Load all tasks for those projects to get responsables ─────────────────
  const proyectoIds = needsDocs.map(p => p.id)

  const { data: tasks, error: tErr } = await admin
    .from('tasks')
    .select('proyecto_id, responsable_ids')
    .in('proyecto_id', proyectoIds)

  if (tErr) {
    console.error('[cron/docs-faltantes] tasks error:', tErr)
    return NextResponse.json({ error: tErr.message }, { status: 500 })
  }

  // Build map: proyectoId → Set of responsable user_ids
  const respByProyecto: Record<string, Set<string>> = {}
  for (const t of tasks ?? []) {
    if (!respByProyecto[t.proyecto_id]) respByProyecto[t.proyecto_id] = new Set()
    for (const uid of t.responsable_ids ?? []) {
      respByProyecto[t.proyecto_id].add(uid)
    }
  }

  // ── Check which (proyecto, recipient, week) combos were already sent ──────
  const dedupeTag = `[docs-faltantes:week:${weekKey}:`

  const { data: existingAvisos } = await admin
    .from('avisos')
    .select('contenido')
    .like('contenido', `%${dedupeTag}%`)
    .gte('fecha_activa', cutoffStr) // only look back reasonably

  const sentKeys = new Set<string>((existingAvisos ?? []).map(a => a.contenido ?? ''))

  function alreadySentThisWeek(proyectoId: string, recipientId: string): boolean {
    return sentKeys.has(dedupeKey(proyectoId, recipientId))
  }
  function dedupeKey(proyectoId: string, recipientId: string): string {
    return `${dedupeTag}${proyectoId}:${recipientId}]`
  }

  // ── Build aviso inserts ───────────────────────────────────────────────────
  const inserts: object[] = []

  for (const proyecto of needsDocs) {
    const responsables = Array.from(respByProyecto[proyecto.id] ?? [])
    if (responsables.length === 0) continue

    const hasRenders = Array.isArray(proyecto.renders) && proyecto.renders.length > 0
    const hasPlanos  = !!proyecto.planos_pdf_url

    const missingItems: string[] = []
    if (!hasRenders) missingItems.push('renders finales')
    if (!hasPlanos)  missingItems.push('planos actualizados (PDF)')

    const contenidoBase = `El proyecto «${proyecto.nombre}» no tiene ${missingItems.join(' ni ')} cargados en la sección de Documentación.`

    for (const recipientId of responsables) {
      if (alreadySentThisWeek(proyecto.id, recipientId)) continue

      inserts.push({
        tipo:            'personal',
        autor_id:        null,
        destinatario_id: recipientId,
        titulo:          `Documentación pendiente: ${proyecto.nombre}`,
        contenido:       `${contenidoBase} ${dedupeKey(proyecto.id, recipientId)}`,
        nivel:           'alerta',
        fecha_activa:    todayStr,
      })
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json({ message: 'Avisos ya enviados esta semana.', notified: 0 })
  }

  const { error: insertErr } = await admin.from('avisos').insert(inserts)
  if (insertErr) {
    console.error('[cron/docs-faltantes] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[cron/docs-faltantes] ${inserts.length} avisos creados para ${needsDocs.length} proyectos`)
  return NextResponse.json({
    notified:  inserts.length,
    proyectos: needsDocs.map(p => p.nombre),
  })
}

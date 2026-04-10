import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron — runs daily at 09:00 UTC (vercel.json)
// Checks each team member for working days (Mon–Fri) with no time entries
// in the window [today-14d, today-4d] (i.e., more than 3 days ago).
// Sends a personal aviso to the appropriate recipients based on role:
//   fp_team   missing → notify fp_manager + fp_partner
//   fp_manager missing → notify fp_manager + fp_partner
//   fp_partner missing → notify fp_partner only

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // ── Date range ──────────────────────────────────────────────────────────────
  const todayMs = Date.now()
  const windowStart = new Date(todayMs - 14 * 24 * 60 * 60 * 1000)
  const windowEnd   = new Date(todayMs -  4 * 24 * 60 * 60 * 1000) // > 3 days ago
  const today = new Date(todayMs).toISOString().split('T')[0]

  // Build list of working days (Mon–Fri) in the window
  function workingDaysInRange(from: Date, to: Date): string[] {
    const days: string[] = []
    const cur = new Date(from)
    cur.setUTCHours(0, 0, 0, 0)
    while (cur <= to) {
      const dow = cur.getUTCDay()
      if (dow !== 0 && dow !== 6) {
        days.push(cur.toISOString().split('T')[0])
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return days
  }

  const targetDays = workingDaysInRange(windowStart, windowEnd)
  if (targetDays.length === 0) {
    return NextResponse.json({ message: 'No working days in window.', notified: 0 })
  }

  const windowStartStr = targetDays[0]
  const windowEndStr   = targetDays[targetDays.length - 1]

  // ── Load team members ────────────────────────────────────────────────────────
  const { data: members, error: membersErr } = await admin
    .from('profiles')
    .select('id, nombre, rol')
    .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])

  if (membersErr || !members) {
    console.error('[cron/horas-faltantes] profiles error:', membersErr)
    return NextResponse.json({ error: membersErr?.message ?? 'No members' }, { status: 500 })
  }

  // ── Load existing time_entries in the window (all members) ───────────────────
  const memberIds = members.map(m => m.id)
  const { data: entries, error: entriesErr } = await admin
    .from('time_entries')
    .select('user_id, fecha')
    .in('user_id', memberIds)
    .gte('fecha', windowStartStr)
    .lte('fecha', windowEndStr)

  if (entriesErr) {
    console.error('[cron/horas-faltantes] entries error:', entriesErr)
    return NextResponse.json({ error: entriesErr.message }, { status: 500 })
  }

  // Build a Set of "user_id|fecha" for quick lookup
  const filledSet = new Set<string>((entries ?? []).map(e => `${e.user_id}|${e.fecha}`))

  // ── Identify members with missing days ──────────────────────────────────────
  type MemberRow = { id: string; nombre: string; rol: string }
  const membersWithGaps: MemberRow[] = members.filter(m =>
    targetDays.some(d => !filledSet.has(`${m.id}|${d}`))
  )

  if (membersWithGaps.length === 0) {
    return NextResponse.json({ message: 'Todos al día.', notified: 0 })
  }

  // ── Load recipient lists ────────────────────────────────────────────────────
  const managers  = members.filter(m => m.rol === 'fp_manager')
  const partners  = members.filter(m => m.rol === 'fp_partner')

  // ── Check which aviso keys were already sent today (dedup) ──────────────────
  const { data: todayAvisos } = await admin
    .from('avisos')
    .select('contenido')
    .eq('fecha_activa', today)
    .like('contenido', '%[horas-faltantes:%')

  const sentToday = new Set<string>((todayAvisos ?? []).map(a => a.contenido ?? ''))

  function alreadySent(userId: string, recipientId: string): boolean {
    return sentToday.has(avisoKey(userId, recipientId))
  }
  function avisoKey(userId: string, recipientId: string): string {
    return `[horas-faltantes:${userId}:${recipientId}]`
  }

  // ── Create avisos ────────────────────────────────────────────────────────────
  const inserts: object[] = []

  for (const member of membersWithGaps) {
    const missingDays = targetDays.filter(d => !filledSet.has(`${member.id}|${d}`))
    const missingList = missingDays
      .map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }))
      .join(', ')

    let recipients: MemberRow[]
    if (member.rol === 'fp_partner') {
      recipients = partners
    } else {
      // fp_team or fp_manager → managers + partners
      recipients = [...managers, ...partners]
    }

    // Deduplicate recipients
    const uniqueRecipients = recipients.filter(
      (r, i, arr) => arr.findIndex(x => x.id === r.id) === i
    )

    for (const recipient of uniqueRecipients) {
      if (alreadySent(member.id, recipient.id)) continue

      inserts.push({
        tipo:           'personal',
        autor_id:       null,
        destinatario_id: recipient.id,
        titulo:         `Horas sin registrar: ${member.nombre}`,
        contenido:      `${member.nombre} no ha registrado horas en los días: ${missingList}. ${avisoKey(member.id, recipient.id)}`,
        nivel:          'alerta',
        fecha_activa:   today,
      })
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json({ message: 'Avisos ya enviados hoy.', notified: 0 })
  }

  const { error: insertErr } = await admin.from('avisos').insert(inserts)
  if (insertErr) {
    console.error('[cron/horas-faltantes] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[cron/horas-faltantes] ${inserts.length} avisos creados para ${membersWithGaps.length} miembros`)
  return NextResponse.json({
    notified: inserts.length,
    members:  membersWithGaps.map(m => m.nombre),
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron — corre los lunes a las 09:00 UTC (vercel.json).
// Mira la semana siguiente (lun→dom) y avisa a cada socio de las
// vacaciones (con visto bueno) y teletrabajos del equipo.

const DIAS_CORTOS  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const iso = (d: Date) => d.toISOString().slice(0, 10)

function fmtFecha(s: string): string {
  const d = new Date(s + 'T00:00:00')
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

function fmtRango(inicio: string, fin: string): string {
  return inicio === fin ? fmtFecha(inicio) : `${fmtFecha(inicio)} – ${fmtFecha(fin)}`
}

// ISO week key (YYYY-WW) — sirve como marcador idempotente del aviso.
function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`
}

function diasHabiles(inicio: string, fin: string, festivos: Set<string>): number {
  let count = 0
  const cur = new Date(inicio + 'T00:00:00')
  const end = new Date(fin + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6 && !festivos.has(iso(cur))) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Semana siguiente: del próximo lunes al siguiente domingo.
  const now = new Date()
  const todayDow = (now.getDay() + 6) % 7 // 0=Lun, ..., 6=Dom
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + (7 - todayDow))
  nextMonday.setHours(0, 0, 0, 0)
  const nextSunday = new Date(nextMonday)
  nextSunday.setDate(nextMonday.getDate() + 6)

  const wkStart  = iso(nextMonday)
  const wkEnd    = iso(nextSunday)
  const today    = iso(now)
  const weekKey  = getIsoWeekKey(nextMonday)

  const [{ data: eventos }, { data: festivosRaw }, { data: partners }] = await Promise.all([
    admin
      .from('calendario_eventos')
      .select('id, user_id, tipo, fecha_inicio, fecha_fin, visto_bueno')
      .in('tipo', ['vacaciones', 'teletrabajo'])
      .lte('fecha_inicio', wkEnd)
      .gte('fecha_fin', wkStart),
    admin
      .from('calendario_festivos')
      .select('fecha')
      .gte('fecha', wkStart)
      .lte('fecha', wkEnd),
    admin
      .from('profiles')
      .select('id, nombre')
      .eq('rol', 'fp_partner'),
  ])

  const festivoSet = new Set((festivosRaw ?? []).map((f: any) => f.fecha))
  const relevantes = (eventos ?? []).filter((e: any) =>
    e.tipo === 'teletrabajo' || e.visto_bueno,
  )

  if (relevantes.length === 0 || !partners || partners.length === 0) {
    return NextResponse.json({ message: 'Sin eventos la semana siguiente.', notified: 0 })
  }

  // Cargar nombres
  const userIds = Array.from(new Set(relevantes.map((e: any) => e.user_id).filter(Boolean)))
  const { data: members } = await admin
    .from('profiles').select('id, nombre').in('id', userIds)
  const nombreDe: Record<string, string> = {}
  for (const m of (members ?? []) as any[]) nombreDe[m.id] = m.nombre ?? '—'

  // Líneas (recortando rangos al límite de la semana)
  const lineas: string[] = relevantes
    .sort((a: any, b: any) => a.fecha_inicio.localeCompare(b.fecha_inicio))
    .map((e: any) => {
      const inicio = e.fecha_inicio < wkStart ? wkStart : e.fecha_inicio
      const fin    = e.fecha_fin    > wkEnd   ? wkEnd   : e.fecha_fin
      const nombre = nombreDe[e.user_id] ?? '—'
      if (e.tipo === 'vacaciones') {
        const dias = diasHabiles(inicio, fin, festivoSet)
        return `· ${nombre} — vacaciones · ${fmtRango(inicio, fin)} (${dias} día${dias === 1 ? '' : 's'} háb.)`
      }
      return `· ${nombre} — teletrabajo · ${fmtRango(inicio, fin)}`
    })

  // Dedup: si ya se envió el aviso esta semana al partner, no repetir.
  const dedupMarker = `[calendario-semana:${weekKey}]`
  const { data: yaEnviados } = await admin
    .from('avisos')
    .select('destinatario_id')
    .like('contenido', `%${dedupMarker}%`)
  const yaEnviadosSet = new Set(
    (yaEnviados ?? []).map((a: any) => a.destinatario_id).filter(Boolean),
  )

  const sameMonth = nextMonday.getMonth() === nextSunday.getMonth()
  const wkLabel = sameMonth
    ? `${nextMonday.getDate()} – ${nextSunday.getDate()} ${MESES_CORTOS[nextSunday.getMonth()]}`
    : `${nextMonday.getDate()} ${MESES_CORTOS[nextMonday.getMonth()]} – ${nextSunday.getDate()} ${MESES_CORTOS[nextSunday.getMonth()]}`

  const titulo = `Semana del ${wkLabel}: ${relevantes.length} ausencia${relevantes.length === 1 ? '' : 's'} en el equipo`
  const contenido = `${lineas.join('\n')}\n\n${dedupMarker}`

  const inserts: object[] = []
  for (const p of partners as any[]) {
    if (yaEnviadosSet.has(p.id)) continue
    inserts.push({
      tipo:            'equipo',
      autor_id:        null,
      destinatario_id: p.id,
      titulo,
      contenido,
      nivel:           'informativo',
      fecha_activa:    today,
    })
  }

  if (inserts.length === 0) {
    return NextResponse.json({ message: 'Avisos ya enviados esta semana.', notified: 0 })
  }

  const { error: insertErr } = await admin.from('avisos').insert(inserts)
  if (insertErr) {
    console.error('[cron/calendario-semana] insert error:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[cron/calendario-semana] ${inserts.length} avisos creados (${relevantes.length} eventos)`)
  return NextResponse.json({ notified: inserts.length, eventos: relevantes.length })
}

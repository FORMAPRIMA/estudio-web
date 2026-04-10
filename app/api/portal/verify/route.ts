import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Portal secret — MUST be set in environment, no fallback
const SECRET = process.env.PORTAL_SECRET
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('PORTAL_SECRET environment variable is required')
}
const EFFECTIVE_SECRET = SECRET ?? 'dev-only-secret-not-for-production'

function generatePortalToken(proyectoId: string): string {
  return createHmac('sha256', EFFECTIVE_SECRET).update(proyectoId).digest('hex')
}

// ── Rate limiting (module-level, per Vercel instance) ────────────────────────
const attemptCache = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS    = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const FAILURE_DELAY_MS = 300

function checkRateLimit(ip: string, proyectoId: string): boolean {
  const key = `${ip}:${proyectoId}`
  const now = Date.now()
  const record = attemptCache.get(key)
  if (!record || now > record.resetAt) {
    attemptCache.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (record.count >= MAX_ATTEMPTS) return false
  record.count++
  return true
}

function resetRateLimit(ip: string, proyectoId: string): void {
  attemptCache.delete(`${ip}:${proyectoId}`)
}

setInterval(() => {
  const now = Date.now()
  attemptCache.forEach((record, key) => {
    if (now > record.resetAt) attemptCache.delete(key)
  })
}, WINDOW_MS)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  try {
    const { proyectoId, pin } = await req.json() as {
      proyectoId: string
      pin: string
    }

    if (!proyectoId || !pin) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
    }

    // PIN must be exactly 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 })
    }

    if (!checkRateLimit(ip, proyectoId)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
        { status: 429 }
      )
    }

    const admin = createAdminClient()

    // First verify the project exists
    const { data: proyectoBasic } = await admin
      .from('proyectos')
      .select('id')
      .eq('id', proyectoId)
      .single()

    if (!proyectoBasic) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
    }

    // Fetch portal_pin separately — graceful fallback if column doesn't exist yet
    let correctPin = '0000'
    try {
      const { data: pinRow } = await admin
        .from('proyectos')
        .select('portal_pin')
        .eq('id', proyectoId)
        .single()
      if ((pinRow as any)?.portal_pin) correctPin = (pinRow as any).portal_pin
    } catch { /* column may not exist yet — use default 0000 */ }

    if (pin !== correctPin) {
      await new Promise(resolve => setTimeout(resolve, FAILURE_DELAY_MS))
      return NextResponse.json({ error: 'PIN incorrecto. Inténtalo de nuevo.' }, { status: 401 })
    }

    // Success
    resetRateLimit(ip, proyectoId)

    const token = generatePortalToken(proyectoId)
    const cookieName = `fp_portal_${proyectoId.replace(/-/g, '').slice(0, 12)}`

    const res = NextResponse.json({ success: true })
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: `/portal/${proyectoId}`,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return res
  } catch (err) {
    console.error('[portal/verify]', err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

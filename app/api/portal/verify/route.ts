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
// Key: `${ip}:${proyectoId}` → { count, resetAt }
const attemptCache = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS    = 15 * 60 * 1000  // 15-minute window
const MAX_ATTEMPTS = 8               // max attempts per window per IP+project
const FAILURE_DELAY_MS = 400         // artificial delay on each failure

function checkRateLimit(ip: string, proyectoId: string): boolean {
  const key = `${ip}:${proyectoId}`
  const now = Date.now()
  const record = attemptCache.get(key)

  if (!record || now > record.resetAt) {
    attemptCache.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true // allow
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false // block
  }

  record.count++
  return true // allow
}

function resetRateLimit(ip: string, proyectoId: string): void {
  attemptCache.delete(`${ip}:${proyectoId}`)
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now()
  attemptCache.forEach((record, key) => {
    if (now > record.resetAt) attemptCache.delete(key)
  })
}, WINDOW_MS)

// ── Date validation ──────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return false
  const [y, m, day] = s.split('-').map(Number)
  if (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day) return false
  // Sanity range: 1900–today
  const today = new Date()
  return d.getFullYear() >= 1900 && d <= today
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  try {
    const { proyectoId, fecha_nacimiento } = await req.json() as {
      proyectoId: string
      fecha_nacimiento: string
    }

    if (!proyectoId || !fecha_nacimiento) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
    }

    // Validate date format before hitting the DB
    if (!isValidDate(fecha_nacimiento)) {
      return NextResponse.json({ error: 'Fecha incorrecta. Inténtalo de nuevo.' }, { status: 401 })
    }

    // Rate limit check
    if (!checkRateLimit(ip, proyectoId)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
        { status: 429 }
      )
    }

    const admin = createAdminClient()

    // Verify project exists
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('id')
      .eq('id', proyectoId)
      .single()

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
    }

    // Fetch all clients linked to this project (via junction table) + their DOB
    const { data: vinculados } = await admin
      .from('proyecto_clientes')
      .select('clientes(fecha_nacimiento)')
      .eq('proyecto_id', proyectoId)

    type Vinculado = { clientes: { fecha_nacimiento: string | null } | null }
    const fechas = ((vinculados ?? []) as unknown as Vinculado[])
      .map(v => v.clientes?.fecha_nacimiento?.split('T')[0])
      .filter(Boolean) as string[]

    if (fechas.length === 0) {
      return NextResponse.json(
        { error: 'El acceso a este portal aún no está configurado. Contacta con tu arquitecto.' },
        { status: 403 }
      )
    }

    // Accept if the provided date matches ANY linked client's DOB
    const provided = fecha_nacimiento.trim()
    if (!fechas.includes(provided)) {
      // Artificial delay — makes brute force attacks costly (~400ms × 36,500 dates = ~4 hours)
      await new Promise(resolve => setTimeout(resolve, FAILURE_DELAY_MS))
      return NextResponse.json({ error: 'Fecha incorrecta. Inténtalo de nuevo.' }, { status: 401 })
    }

    // Success — reset rate limit counter for this IP+project
    resetRateLimit(ip, proyectoId)

    // Issue cookie
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

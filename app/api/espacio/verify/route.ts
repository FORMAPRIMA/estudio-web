import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateEspacioCookieToken,
  espacioCookieName,
  generatePresentationCookieToken,
  presentationCookieName,
  isMasterPin,
  hashPin,
  verifyPinHash,
} from '@/lib/espacio/access'

// ── Rate limiting (module-level, per Vercel instance) ────────────────────────
const attemptCache = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS    = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const FAILURE_DELAY_MS = 300

function checkRateLimit(key: string): boolean {
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
    const { token, pin } = await req.json() as { token: string; pin: string }

    if (!token || !pin) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'El PIN debe tener 4 dígitos.' }, { status: 401 })
    }
    if (!checkRateLimit(`${ip}:${token}`)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
        { status: 429 },
      )
    }

    const admin = createAdminClient()
    const { data: espacio } = await admin
      .from('espacios')
      .select('id, pin_hash')
      .eq('token', token)
      .single()

    if (!espacio) {
      return NextResponse.json({ error: 'Espacio no encontrado.' }, { status: 404 })
    }

    // ── PIN maestro de administración (modo presentación) ────────────────────
    // Se comprueba ANTES de la lógica de PIN del cliente, para que tecleando el
    // maestro nunca quede fijado como PIN del cliente. Setea una cookie de
    // presentación atada a este Espacio: el portal se abre como lo ve el cliente
    // pero la visita NO se contabiliza. No toca pin_hash.
    if (isMasterPin(pin)) {
      const res = NextResponse.json({ success: true, presentation: true })
      res.cookies.set(presentationCookieName(token), generatePresentationCookieToken(token), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 días (contexto de reunión / preparación)
      })
      return res
    }

    const storedHash = (espacio as { pin_hash: string | null }).pin_hash

    if (!storedHash) {
      // Primera vez: el cliente fija su PIN.
      await admin
        .from('espacios')
        .update({ pin_hash: hashPin(pin), pin_set_at: new Date().toISOString() })
        .eq('id', (espacio as { id: string }).id)
    } else if (!verifyPinHash(pin, storedHash)) {
      await new Promise(resolve => setTimeout(resolve, FAILURE_DELAY_MS))
      return NextResponse.json({ error: 'PIN incorrecto. Inténtalo de nuevo.' }, { status: 401 })
    }

    // Éxito → cookie de sesión (30 días), scoped a este Espacio.
    const res = NextResponse.json({ success: true })
    res.cookies.set(espacioCookieName(token), generateEspacioCookieToken(token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // path '/' para que la cookie viaje también a /api/espacio/<token>/* (descargas).
      // El nombre y el valor (HMAC del token) la atan a este Espacio concreto.
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch (err) {
    console.error('[espacio/verify]', err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

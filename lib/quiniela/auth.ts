// ── Auth ligera para jugadores externos de la porra ──────────────────────────
// Identidad propia (nombre + PIN), totalmente separada de Supabase Auth.
// Solo servidor: nunca importar desde componentes cliente.

import { createHmac, scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'quiniela_jugador'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 días — cubre todo el Mundial

function getSecret(): string {
  const secret = process.env.PORTAL_SECRET
  if (!secret) throw new Error('PORTAL_SECRET no configurado.')
  return secret
}

// ── PIN ───────────────────────────────────────────────────────────────────────

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const calc = scryptSync(pin, salt, 32).toString('hex')
  const a = Buffer.from(calc)
  const b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

// ── Sesión por cookie firmada (HMAC sobre el id del jugador) ─────────────────

function sign(jugadorId: string): string {
  return createHmac('sha256', getSecret()).update(`quiniela:${jugadorId}`).digest('hex')
}

export function setJugadorCookie(jugadorId: string) {
  cookies().set(COOKIE_NAME, `${jugadorId}.${sign(jugadorId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export function clearJugadorCookie() {
  cookies().delete(COOKIE_NAME)
}

export function getJugadorIdFromCookie(): string | null {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  const [id, sig] = token.split('.')
  if (!id || !sig) return null
  const expected = sign(id)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return id
}

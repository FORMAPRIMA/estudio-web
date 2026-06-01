import { createHmac, scryptSync, randomBytes, timingSafeEqual } from 'crypto'

// Reutilizamos PORTAL_SECRET (mismo secreto del portal de cliente actual).
const SECRET = process.env.PORTAL_SECRET
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('PORTAL_SECRET environment variable is required')
}
const EFFECTIVE_SECRET = SECRET ?? 'dev-only-secret-not-for-production'

// ── Cookie de sesión del Espacio (HMAC sobre el token del Espacio) ───────────
export function generateEspacioCookieToken(espacioToken: string): string {
  return createHmac('sha256', EFFECTIVE_SECRET).update(`espacio:${espacioToken}`).digest('hex')
}

export function espacioCookieName(espacioToken: string): string {
  return `fp_espacio_${espacioToken.replace(/-/g, '').slice(0, 12)}`
}

// ── Hash del PIN (lo fija el propio cliente; nunca se guarda en claro) ────────
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const computed = scryptSync(pin, salt, 32)
  const expected = Buffer.from(hash, 'hex')
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

import { createHmac, timingSafeEqual } from 'crypto'

// Cookie que recuerda que el cliente ya tecleó el PIN de SU propuesta.
// Mismo secreto que el portal y los Espacios (PORTAL_SECRET).
const SECRET = process.env.PORTAL_SECRET
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('PORTAL_SECRET environment variable is required')
}
const EFFECTIVE_SECRET = SECRET ?? 'dev-only-secret-not-for-production'

export function propuestaCookieName(slug: string): string {
  return `fp_prop_${slug.replace(/[^a-z0-9]/g, '').slice(-16)}`
}

export function propuestaCookieValue(slug: string): string {
  return createHmac('sha256', EFFECTIVE_SECRET).update(`propuesta-web:${slug}`).digest('hex')
}

export function pinCorrecto(pin: string, esperado: string): boolean {
  const a = Buffer.from(pin)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

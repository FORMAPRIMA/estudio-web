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

// Segunda cookie, solo con el PIN del estudio (pinAdmin): quien la lleva no
// genera avisos ni correos de visita.
export function propuestaAdminCookieName(slug: string): string {
  return `${propuestaCookieName(slug)}_a`
}

export function propuestaAdminCookieValue(slug: string): string {
  return createHmac('sha256', EFFECTIVE_SECRET).update(`propuesta-web-admin:${slug}`).digest('hex')
}

/** Sin PIN (pin: null) la propuesta es pública —pero sigue fuera de Google—. */
export function accesoConcedido(p: { slug: string; pin: string | null }, cookie: string | undefined): boolean {
  return p.pin === null || cookie === propuestaCookieValue(p.slug)
}

export function pinCorrecto(pin: string, esperado: string): boolean {
  const a = Buffer.from(pin)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

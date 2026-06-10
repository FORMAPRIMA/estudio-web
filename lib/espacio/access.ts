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

// ── PIN maestro de presentación (equipo, sin necesidad de login) ─────────────
// Permite al equipo abrir un portal concreto en "modo presentación" desde un
// dispositivo no autenticado (sala de reuniones, iPad, screen-share). Una vista
// en este modo NUNCA cuenta como acceso del cliente. Configurable por env para
// poder rotarlo sin desplegar; por defecto 1330.
export function getMasterPin(): string {
  return process.env.ESPACIO_MASTER_PIN || '1330'
}

export function isMasterPin(pin: string): boolean {
  const master = getMasterPin()
  if (pin.length !== master.length) return false
  return timingSafeEqual(Buffer.from(pin), Buffer.from(master))
}

// ── Cookie de "modo presentación" — atada a UN solo Espacio ──────────────────
// (decisión: el PIN maestro desbloquea solo el portal donde se teclea.)
export function generatePresentationCookieToken(espacioToken: string): string {
  return createHmac('sha256', EFFECTIVE_SECRET).update(`espacio-pres:${espacioToken}`).digest('hex')
}

export function presentationCookieName(espacioToken: string): string {
  return `fp_espres_${espacioToken.replace(/-/g, '').slice(0, 12)}`
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

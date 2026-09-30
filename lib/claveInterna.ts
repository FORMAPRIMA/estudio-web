import { createHmac, timingSafeEqual } from 'crypto'

// Clave para llamadas servidor→servidor a acciones que viven en ficheros
// 'use server' (y que por tanto cualquiera puede invocar desde fuera): quien no
// conoce PORTAL_SECRET no puede calcularla. Solo servidor.

function secreto(): string {
  const s = process.env.PORTAL_SECRET
  if (!s && process.env.NODE_ENV === 'production') throw new Error('PORTAL_SECRET environment variable is required')
  return s ?? 'dev-only-secret-not-for-production'
}

export function claveInterna(): string {
  return createHmac('sha256', secreto()).update('accion-interna:v1').digest('hex')
}

export function claveInternaValida(clave: unknown): boolean {
  if (typeof clave !== 'string') return false
  const a = Buffer.from(clave)
  const b = Buffer.from(claveInterna())
  return a.length === b.length && timingSafeEqual(a, b)
}

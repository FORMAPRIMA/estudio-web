// Puente internal → Salas para la gente del estudio. Salas es una burbuja con su
// propio código de 8 cifras (para comerciales de fuera); quien ya tiene cuenta en
// internal.formaprima.es entra con ella en vez de con un código:
//
//   internal /team/salas  →  pase firmado de un solo uso (60 s)  →  salas.*/entrar
//
// Las sesiones de Supabase no se comparten entre subdominios y no hace falta: el
// pase lleva solo el id de la persona del panel, caduca en un minuto y deja de
// valer en cuanto se usa (se compara con su último acceso). Los permisos siguen
// siendo los de Salas: rol y salas de su fila en sala_miembros.
// Solo servidor.

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.PORTAL_SECRET ?? 'dev-only-secret-not-for-production'
const VIDA_MS = 60_000

const firma = (v: string) => createHmac('sha256', SECRET).update(`sala-puente:${v}`).digest('hex').slice(0, 40)

export function crearPase(miembroId: string): string {
  const emitido = Date.now()
  return `${miembroId}.${emitido}.${firma(`${miembroId}.${emitido}`)}`
}

/** Id de la persona y cuándo se emitió, si el pase es auténtico y no ha caducado. */
export function leerPase(pase: string | null): { miembroId: string; emitido: number } | null {
  if (!pase) return null
  const [id, t, f] = pase.split('.')
  const emitido = Number(t)
  if (!id || !f || !Number.isFinite(emitido) || Date.now() - emitido > VIDA_MS || emitido > Date.now() + 5_000) return null
  const esperada = firma(`${id}.${emitido}`)
  if (f.length !== esperada.length || !timingSafeEqual(Buffer.from(f), Buffer.from(esperada))) return null
  return { miembroId: id, emitido }
}

export { urlSalas, urlInternal } from './puente-url'

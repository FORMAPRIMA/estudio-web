// Salas de dossier — acceso por PIN de lead y sesiones de seguimiento.
// Solo servidor (service_role). NO es 'use server': no son acciones llamables.
//
// Un dossier de /propuesta/<slug> es "sala" si tiene fila en sala_salas. Cada
// lead tiene un PIN de 6 cifras; al teclearlo, una cookie firmada recuerda qué
// lead es ese navegador. Las sesiones (30 min sin actividad = sesión nueva)
// guardan dispositivo, ubicación aproximada y tiempo por diapositiva.

import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { propuestaCookieName, propuestaCookieValue } from '@/lib/propuestas/acceso'

const SECRET = process.env.PORTAL_SECRET ?? 'dev-only-secret-not-for-production'

export interface Sala {
  id: string
  slug: string
  nombre: string
  accesoAnonimo: boolean
}

export async function getSala(slug: string): Promise<Sala | null> {
  try {
    const { data } = await createAdminClient()
      .from('sala_salas').select('id, slug, nombre, acceso_anonimo, activa')
      .eq('slug', slug).maybeSingle()
    if (!data || !data.activa) return null
    return { id: data.id, slug: data.slug, nombre: data.nombre, accesoAnonimo: !!data.acceso_anonimo }
  } catch {
    return null   // migración sin aplicar: el dossier funciona como siempre
  }
}

/** Lead activo y sin caducar con ese PIN en esa sala. */
export async function leadPorPin(salaId: string, pin: string): Promise<{ id: string; nombre: string } | null> {
  if (!/^\d{6}$/.test(pin)) return null
  const { data } = await createAdminClient()
    .from('sala_leads').select('id, nombre, pin, estado, caduca_en')
    .eq('sala_id', salaId).eq('pin', pin).maybeSingle()
  if (!data || data.estado !== 'activo') return null
  if (data.caduca_en && Date.parse(data.caduca_en) < Date.now()) return null
  // Comparación en tiempo constante (la consulta ya filtró; esto es defensa extra).
  const a = Buffer.from(String(data.pin)), b = Buffer.from(pin)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { id: data.id, nombre: data.nombre }
}

/** ¿Sigue activo el lead de la cookie? (revocado o caducado = vuelve a anónimo) */
export async function leadVigente(leadId: string): Promise<boolean> {
  const { data } = await createAdminClient().from('sala_leads').select('estado, caduca_en').eq('id', leadId).maybeSingle()
  return !!data && data.estado === 'activo' && !(data.caduca_en && Date.parse(data.caduca_en) < Date.now())
}

/** PIN de 6 cifras libre en la sala (sin 000000-style triviales). */
export async function pinNuevo(salaId: string): Promise<string> {
  const admin = createAdminClient()
  for (let k = 0; k < 20; k++) {
    const pin = String(randomInt(100000, 1000000))
    if (/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) continue
    const { count } = await admin.from('sala_leads').select('id', { count: 'exact', head: true }).eq('sala_id', salaId).eq('pin', pin)
    if (!count) return pin
  }
  throw new Error('No se pudo generar un PIN libre.')
}

// ── Cookies ─────────────────────────────────────────────────────────────────

const corto = (slug: string) => slug.replace(/[^a-z0-9]/g, '').slice(-16)
export const leadCookieName = (slug: string) => `fp_sl_${corto(slug)}`
export const sesionCookieName = (slug: string) => `fp_ss_${corto(slug)}`

const firma = (v: string) => createHmac('sha256', SECRET).update(`sala-lead:${v}`).digest('hex').slice(0, 32)
export const leadCookieValue = (slug: string, leadId: string) => `${leadId}.${firma(`${slug}:${leadId}`)}`
export function leadDeCookie(slug: string, valor: string | undefined): string | null {
  if (!valor) return null
  const [id, f] = valor.split('.')
  if (!id || !f) return null
  const esperada = firma(`${slug}:${id}`)
  return f.length === esperada.length && timingSafeEqual(Buffer.from(f), Buffer.from(esperada)) ? id : null
}

// ── Ubicación aproximada (cabeceras de Vercel, sin servicios externos) ──────

export function geo(h: Headers) {
  const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : null } catch { return v } }
  const num = (v: string | null) => { const n = Number(v); return v && Number.isFinite(n) ? Math.round(n * 10) / 10 : null }
  return {
    ciudad: dec(h.get('x-vercel-ip-city')),
    region: dec(h.get('x-vercel-ip-country-region')),
    pais: h.get('x-vercel-ip-country'),
    lat: num(h.get('x-vercel-ip-latitude')),
    lon: num(h.get('x-vercel-ip-longitude')),
  }
}

/** IPv4 → a.b.c.0 · IPv6 → primeros 3 grupos (/48). Nunca la IP completa. */
export function ipTruncada(h: Headers): string | null {
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || ''
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.0')
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::'
  return null
}

// ── Acceso al dossier ───────────────────────────────────────────────────────
// Sustituye a accesoConcedido() en los dossiers que son sala:
//   · sala abierta (acceso_anonimo) y sin PIN en el registro → entra cualquiera;
//   · si no, hace falta la cookie de acceso, y si esa cookie vino de un PIN de
//     lead, el lead tiene que seguir activo (revocar corta el acceso).


interface Jar { get(name: string): { value: string } | undefined }

export async function accesoDossier(p: { slug: string; pin: string | null }, jar: Jar): Promise<boolean> {
  const sala = await getSala(p.slug)
  const conCookie = jar.get(propuestaCookieName(p.slug))?.value === propuestaCookieValue(p.slug)
  if (!sala) return p.pin === null || conCookie
  if (p.pin === null && sala.accesoAnonimo) return true
  if (!conCookie) return false
  const lead = leadDeCookie(p.slug, jar.get(leadCookieName(p.slug))?.value)
  return lead ? leadVigente(lead) : true
}

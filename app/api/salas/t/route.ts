import { cookies, headers } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPropuestaWeb } from '@/lib/propuestas/registro'
import { propuestaAdminCookieName, propuestaAdminCookieValue } from '@/lib/propuestas/acceso'
import { dispositivo } from '@/lib/propuestas/visitas'
import { accesoDossier, geo, getSala, ipTruncada, leadCookieName, leadDeCookie, leadVigente, sesionCookieName } from '@/lib/salas/servidor'

// Baliza de medición de las Salas: tiempo por diapositiva e interacciones.
// La llama PropuestaDossier con fetch keepalive y, al cerrar, con sendBeacon
// (cuerpo text/plain con JSON). Pública por naturaleza, así que:
//   · solo acepta dossiers que son sala y a los que ese navegador tiene acceso;
//   · la sesión va en un token firmado (no se puede escribir en la de otro);
//   · límites por IP y topes por lote; todo lo raro se ignora sin error.
// Las visitas del equipo (sesión de /team o PIN del estudio) no se miden.

export const dynamic = 'force-dynamic'

const SECRET = process.env.PORTAL_SECRET ?? 'dev-only-secret-not-for-production'
const SESION_MIN = 30
const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']

const firmar = (id: string) => `${id}.${createHmac('sha256', SECRET).update(`sala-sesion:${id}`).digest('hex').slice(0, 32)}`
function verificar(tok: unknown): string | null {
  if (typeof tok !== 'string') return null
  const [id] = tok.split('.')
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null
  const esperado = firmar(id)
  return tok.length === esperado.length && timingSafeEqual(Buffer.from(tok), Buffer.from(esperado)) ? id : null
}

const intentos = new Map<string, { n: number; hasta: number }>()
function porIp(ip: string, max: number, ventanaMs: number): boolean {
  const ahora = Date.now(), r = intentos.get(ip)
  if (!r || ahora > r.hasta) { intentos.set(ip, { n: 1, hasta: ahora + ventanaMs }); return true }
  if (r.n >= max) return false
  r.n++
  return true
}

async function esEquipo(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    return !!data?.rol && FP_ROLES.includes(data.rol as string)
  } catch {
    return false
  }
}

const vacio = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
const json = (b: object) => Response.json(b, { headers: { 'Cache-Control': 'no-store' } })
const ent = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
const TIPOS = new Set(['video', 'idioma', 'interes', 'final', '3d', 'enlace'])

interface Lote {
  slug?: string
  t?: 'ini' | 'lote'
  tok?: string
  vistas?: { s?: number; l?: string; ms?: number; e?: number }[]
  activo?: number
  max?: number
  total?: number
  eventos?: { k?: string; s?: number; d?: string }[]
}

export async function POST(req: Request) {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida'
  if (!porIp(ip, 240, 10 * 60_000)) return vacio()

  let b: Lote
  try {
    const raw = await req.text()
    if (raw.length > 20_000) return vacio()
    b = JSON.parse(raw)
  } catch {
    return vacio()
  }
  const p = typeof b.slug === 'string' ? getPropuestaWeb(b.slug) : null
  if (!p) return vacio()
  const sala = await getSala(p.slug)
  if (!sala || !(await accesoDossier(p, cookies()))) return vacio()

  const admin = createAdminClient()

  // ── Inicio: reutiliza la sesión viva de este navegador o abre otra ──────
  if (b.t === 'ini') {
    if (cookies().get(propuestaAdminCookieName(p.slug))?.value === propuestaAdminCookieValue(p.slug) || await esEquipo()) {
      return json({ tok: null })
    }
    const leadCookie = leadDeCookie(p.slug, cookies().get(leadCookieName(p.slug))?.value)
    const lead = leadCookie && await leadVigente(leadCookie) ? leadCookie : null

    const previa = verificar(cookies().get(sesionCookieName(p.slug))?.value)
    let id: string | null = null
    if (previa) {
      const { data } = await admin.from('sala_sesiones').select('id, lead_id, ultima, sala_id').eq('id', previa).maybeSingle()
      if (data && data.sala_id === sala.id && data.lead_id === lead && Date.parse(data.ultima) > Date.now() - SESION_MIN * 60_000) id = data.id
    }
    if (!id) {
      const g = geo(h)
      const { data, error } = await admin.from('sala_sesiones').insert({
        sala_id: sala.id,
        lead_id: lead,
        dispositivo: dispositivo(h.get('user-agent') || ''),
        ciudad: g.ciudad, region: g.region, pais: g.pais, lat: g.lat, lon: g.lon,
        ip_trunc: ipTruncada(h),
      }).select('id').single()
      if (error || !data) { console.error('[salas] sesion', error?.message); return json({ tok: null }) }
      id = data.id as string
    }
    const tok = firmar(id)
    cookies().set(sesionCookieName(p.slug), tok, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESION_MIN * 60,
    })
    return json({ tok })
  }

  // ── Lote: tiempo por diapositiva, progreso y eventos ────────────────────
  const id = verificar(b.tok)
  if (!id) return vacio()
  const { data: ses } = await admin.from('sala_sesiones').select('sala_id, max_slide, total_slides, final').eq('id', id).maybeSingle()
  if (!ses || ses.sala_id !== sala.id) return vacio()

  const vistas = (Array.isArray(b.vistas) ? b.vistas : []).slice(0, 60)
    .map((v) => ({ s: ent(v.s, 500), l: txt(v.l, 80), ms: ent(v.ms, 600_000), e: ent(v.e, 50) }))
    .filter((v) => v.ms > 0 || v.e > 0)
  const { error } = await admin.rpc('sala_sumar_vistas', { p_sesion: id, p_vistas: vistas, p_activo_ms: ent(b.activo, 600_000) })
  if (error) console.error('[salas] vistas', error.message)

  const max = ent(b.max, 500), total = ent(b.total, 500)
  const eventos = (Array.isArray(b.eventos) ? b.eventos : []).slice(0, 20)
    .filter((e) => typeof e.k === 'string' && TIPOS.has(e.k))
    .map((e) => ({ sesion_id: id, tipo: e.k as string, slide: e.s == null ? null : ent(e.s, 500), detalle: txt(e.d, 120) }))
  const final = ses.final || eventos.some((e) => e.tipo === 'final') || (total > 0 && max >= total - 1)
  if (max > ses.max_slide || (total && total !== ses.total_slides) || final !== ses.final) {
    await admin.from('sala_sesiones').update({
      max_slide: Math.max(max, ses.max_slide), total_slides: total || ses.total_slides, final,
    }).eq('id', id)
  }
  if (eventos.length) {
    const { error: e2 } = await admin.from('sala_eventos').insert(eventos)
    if (e2) console.error('[salas] eventos', e2.message)
  }
  // Mantiene viva la sesión mientras siga leyendo.
  cookies().set(sesionCookieName(p.slug), b.tok as string, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESION_MIN * 60,
  })
  return vacio()
}

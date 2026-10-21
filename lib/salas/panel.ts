// Panel de Salas (salas.formaprima.es) — sesión de las personas del panel y
// lecturas. Solo servidor; NO es 'use server' (no son acciones llamables).
//
// Burbuja aparte de internal: no usa Supabase Auth ni profiles. Cada persona
// tiene un código personal de 8 cifras; se guarda solo su HMAC (búsqueda
// directa sin guardar el código). La sesión es una cookie firmada que se
// vuelve a validar contra la base de datos en cada petición: desactivar a
// alguien le corta el acceso al momento.

import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { cargarDossier } from '@/lib/propuestas/registro'
import { firmaEquipo } from '@/lib/salas/prospeccion'

const SECRET = process.env.PORTAL_SECRET ?? 'dev-only-secret-not-for-production'
export const COOKIE_PANEL = 'fp_salas'
const DIAS_SESION = 30

export interface Miembro {
  id: string
  nombre: string
  email: string | null
  empresa: string | null
  rol: 'propietario' | 'comercial'
}

export const codigoHmac = (codigo: string) => createHmac('sha256', SECRET).update(`sala-miembro:${codigo}`).digest('hex')

/** 8 cifras, sin repeticiones ni escaleras triviales. */
export function codigoNuevo(): string {
  for (;;) {
    const c = String(randomInt(10_000_000, 100_000_000))
    if (/(\d)\1{3}/.test(c) || '0123456789012'.includes(c.slice(0, 5)) || '9876543210987'.includes(c.slice(0, 5))) continue
    return c
  }
}

const firma = (v: string) => createHmac('sha256', SECRET).update(`sala-panel:${v}`).digest('hex').slice(0, 40)
export function valorSesion(miembroId: string): string {
  const exp = Date.now() + DIAS_SESION * 864e5
  return `${miembroId}.${exp}.${firma(`${miembroId}.${exp}`)}`
}
export const maxAgeSesion = DIAS_SESION * 24 * 3600

function leerSesion(v: string | undefined): string | null {
  if (!v) return null
  const [id, exp, f] = v.split('.')
  if (!id || !exp || !f || Number(exp) < Date.now()) return null
  const esperada = firma(`${id}.${exp}`)
  return f.length === esperada.length && timingSafeEqual(Buffer.from(f), Buffer.from(esperada)) ? id : null
}

export async function miembroActual(): Promise<Miembro | null> {
  const id = leerSesion(cookies().get(COOKIE_PANEL)?.value)
  if (!id) return null
  const { data } = await createAdminClient().from('sala_miembros').select('id, nombre, email, empresa, rol, activo').eq('id', id).maybeSingle()
  if (!data || !data.activo) return null
  return { id: data.id, nombre: data.nombre, email: data.email, empresa: data.empresa, rol: data.rol }
}

/** El panel solo existe en el subdominio salas.* (y salas.localhost en local). */
export function esHostSalas(): boolean {
  const host = (headers().get('host') || '').toLowerCase()
  return host.startsWith('salas.')
}

export interface SalaResumen {
  id: string; slug: string; nombre: string; accesoAnonimo: boolean
  /** No se puede asignar a comerciales (propuestas de honorarios). */
  confidencial: boolean
  creadoPor: string | null
  /** 'propuesta' = un dossier de /propuesta/<slug>; 'prospeccion' = el dossier del estudio en /para/<token>. */
  tipo: 'propuesta' | 'prospeccion'
  perfil: 'developer' | 'constructora' | null
}

/** Una sala se puede asignar a un comercial si no es confidencial. */
export const asignable = (s: { confidencial: boolean }) => !s.confidencial

// Es el único filtro de visibilidad del panel: páginas, CSV, acciones, avisos y el
// resumen diario pasan por aquí. Un comercial ve las salas que le han asignado y
// no son confidenciales, más las que ha creado él (esas siempre).
export async function salasDe(m: Miembro): Promise<SalaResumen[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('sala_salas')
    .select('id, slug, nombre, acceso_anonimo, confidencial, creado_por, tipo, perfil').eq('activa', true).order('created_at')
  // Sin la migración salas_fase3_permisos.sql un comercial no ve nada: mejor
  // cerrado que enseñar una propuesta de honorarios por error.
  if (error) {
    if (m.rol !== 'propietario') return []
    const { data: viejas } = await admin.from('sala_salas').select('id, slug, nombre, acceso_anonimo').eq('activa', true).order('created_at')
    return (viejas ?? []).map((s) => ({ id: s.id, slug: s.slug, nombre: s.nombre, accesoAnonimo: !!s.acceso_anonimo, confidencial: true, creadoPor: null, tipo: 'propuesta' as const, perfil: null }))
  }
  const todas: SalaResumen[] = (data ?? []).map((s) => ({
    id: s.id, slug: s.slug, nombre: s.nombre, accesoAnonimo: !!s.acceso_anonimo, confidencial: s.confidencial !== false, creadoPor: s.creado_por ?? null,
    tipo: s.tipo === 'prospeccion' ? 'prospeccion' : 'propuesta', perfil: s.perfil === 'constructora' ? 'constructora' : s.perfil === 'developer' ? 'developer' : null,
  }))
  if (m.rol === 'propietario') return todas
  const { data: asig } = await admin.from('sala_miembro_salas').select('sala_id').eq('miembro_id', m.id)
  const ids = new Set((asig ?? []).map((a) => a.sala_id))
  return todas.filter((s) => s.creadoPor === m.id || (ids.has(s.id) && asignable(s)))
}

export async function salaDe(m: Miembro, slug: string): Promise<SalaResumen | null> {
  return (await salasDe(m)).find((s) => s.slug === slug) ?? null
}

export async function auditar(miembroId: string | null, accion: string, salaId: string | null, detalle?: string) {
  try {
    await createAdminClient().from('sala_auditoria').insert({ miembro_id: miembroId, accion, sala_id: salaId, detalle: detalle?.slice(0, 500) ?? null })
  } catch { /* la auditoría no tumba la acción */ }
}

/** Nombres de las diapositivas del dossier, en orden (también las que nadie ha visto). */
export async function etiquetasDossier(slug: string): Promise<string[]> {
  const html = await cargarDossier(slug)
  if (!html) return []
  const ls = Array.from(html.matchAll(/<section\b[^>]*\bdata-label="([^"]*)"/g)).map((m) => m[1])
  if (html.includes('<!--FP:SIGUIENTE-->')) ls.push('Siguiente paso')   // la final que añade la web
  return ls
}

// ── Lecturas para el panel ──────────────────────────────────────────────────

export interface LeadRow {
  id: string
  pin: string
  nombre: string
  empresa: string | null
  email: string | null
  telefono: string | null
  canal: string | null
  notas: string | null
  estado: 'activo' | 'revocado'
  caducaEn: string | null
  creadoPor: string | null
  leadCaptacionId: string | null
  createdAt: string
  // prospección (/para/<token>)
  token: string | null
  cargo: string | null
  pais: string | null
  idioma: 'es' | 'en'
  tratamiento: 'tu' | 'usted'
  mensaje: string | null
  logoPath: string | null
  logoModo: 'blanco' | 'original'
  enviadoEn: string | null
  descartadoEn: string | null
  /** Para «Ver su dossier» desde el panel sin que cuente como visita. */
  firmaEquipo: string | null
}

export interface SesionRow {
  id: string
  leadId: string | null
  inicio: string
  ultima: string
  activoMs: number
  dispositivo: string | null
  ciudad: string | null
  region: string | null
  pais: string | null
  maxSlide: number
  totalSlides: number
  final: boolean
  ipTrunc: string | null
}

export interface VistaRow { sesionId: string; slide: number; etiqueta: string | null; ms: number; entradas: number }
export interface EventoRow { sesionId: string; tipo: string; slide: number | null; detalle: string | null; at: string }

export interface ReunionRow {
  id: string; leadId: string; miembroId: string | null; inicio: string | null; minutos: number
  estado: 'pedida' | 'propuesta' | 'confirmada' | 'cancelada'; email: string | null; nota: string | null; zonaLead: string | null; createdAt: string
}

export interface DatosSala {
  reuniones: ReunionRow[]
  leads: LeadRow[]
  sesiones: SesionRow[]
  vistas: VistaRow[]
  eventos: EventoRow[]
  miembros: Record<string, string>   // id → nombre (para «creado por»)
}

export async function datosSala(salaId: string, opts: { leadId?: string } = {}): Promise<DatosSala> {
  const admin = createAdminClient()
  let qs = admin.from('sala_sesiones').select('*').eq('sala_id', salaId).order('inicio', { ascending: false }).limit(2000)
  if (opts.leadId) qs = qs.eq('lead_id', opts.leadId)
  let ql = admin.from('sala_leads').select('*').eq('sala_id', salaId).order('created_at', { ascending: false })
  if (opts.leadId) ql = ql.eq('id', opts.leadId)
  let qr = admin.from('sala_reuniones').select('*').eq('sala_id', salaId).order('created_at', { ascending: false })
  if (opts.leadId) qr = qr.eq('lead_id', opts.leadId)
  const [{ data: leads }, { data: ses }, { data: miembros }, { data: reus }] = await Promise.all([
    ql, qs, admin.from('sala_miembros').select('id, nombre'), qr,
  ])
  const ids = (ses ?? []).map((s) => s.id)
  const trozos = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
  const vistas: VistaRow[] = []
  const eventos: EventoRow[] = []
  for (const t of trozos(ids, 200)) {
    const [{ data: v }, { data: e }] = await Promise.all([
      admin.from('sala_vistas').select('sesion_id, slide, etiqueta, ms, entradas').in('sesion_id', t),
      admin.from('sala_eventos').select('sesion_id, tipo, slide, detalle, at').in('sesion_id', t).order('at'),
    ])
    for (const x of v ?? []) vistas.push({ sesionId: x.sesion_id, slide: x.slide, etiqueta: x.etiqueta, ms: x.ms, entradas: x.entradas })
    for (const x of e ?? []) eventos.push({ sesionId: x.sesion_id, tipo: x.tipo, slide: x.slide, detalle: x.detalle, at: x.at })
  }
  return {
    reuniones: (reus ?? []).map((r) => ({
      id: r.id, leadId: r.lead_id, miembroId: r.miembro_id, inicio: r.inicio, minutos: r.minutos, estado: r.estado,
      email: r.email, nota: r.nota, zonaLead: r.zona_lead, createdAt: r.created_at,
    })),
    leads: (leads ?? []).map((l) => ({
      id: l.id, pin: l.pin, nombre: l.nombre, empresa: l.empresa, email: l.email, telefono: l.telefono, canal: l.canal,
      notas: l.notas, estado: l.estado, caducaEn: l.caduca_en, creadoPor: l.creado_por, leadCaptacionId: l.lead_captacion_id, createdAt: l.created_at,
      token: l.token ?? null, cargo: l.cargo ?? null, pais: l.pais ?? null, idioma: l.idioma === 'en' ? 'en' : 'es',
      tratamiento: l.tratamiento === 'usted' ? 'usted' : 'tu', mensaje: l.mensaje ?? null, logoPath: l.logo_path ?? null,
      logoModo: l.logo_modo === 'original' ? 'original' : 'blanco', enviadoEn: l.enviado_en ?? null, descartadoEn: l.descartado_en ?? null,
      firmaEquipo: l.token ? firmaEquipo(l.token) : null,
    })),
    sesiones: (ses ?? []).map((s) => ({
      id: s.id, leadId: s.lead_id, inicio: s.inicio, ultima: s.ultima, activoMs: s.activo_ms, dispositivo: s.dispositivo,
      ciudad: s.ciudad, region: s.region, pais: s.pais, maxSlide: s.max_slide, totalSlides: s.total_slides, final: s.final, ipTrunc: s.ip_trunc,
    })),
    vistas,
    eventos,
    miembros: Object.fromEntries((miembros ?? []).map((m) => [m.id, m.nombre])),
  }
}

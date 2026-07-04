'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { crearEspacioCore, enviarCorreoBienvenida } from '@/lib/espacio/create'
import { revalidatePath } from 'next/cache'
import type { WebProyecto } from '@/lib/web-publica'

const PATH = '/team/marketing/web-publica'

// Marketing: solo socios y biz dev gestionan la web pública.
async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, nombre, ubicacion, anio, nota, hero_url, hero_mobile_url, galeria, orden, activo, created_at'

function mapRow(r: any): WebProyecto {
  return {
    id:              r.id,
    nombre:          r.nombre,
    ubicacion:       r.ubicacion,
    anio:            r.anio,
    nota:            r.nota,
    hero_url:        r.hero_url,
    hero_mobile_url: r.hero_mobile_url ?? null,
    galeria:         r.galeria ?? [],
    orden:      r.orden ?? 0,
    activo:     r.activo ?? true,
    created_at: r.created_at,
  }
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Lectura pública para el teaser /wip. Solo proyectos activos. */
export async function getWebProyectosPublic(): Promise<WebProyecto[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('web_proyectos')
    .select(SELECT)
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[web-publica] getPublic:', error.message)
    return []
  }
  return (data ?? []).map(mapRow)
}

/** Lectura para la zona de control. Todos (activos e inactivos). */
export async function getWebProyectosAdmin(): Promise<WebProyecto[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('web_proyectos')
    .select(SELECT)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[web-publica] getAdmin:', error.message)
    return []
  }
  return (data ?? []).map(mapRow)
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export async function createWebProyecto(data: {
  nombre: string
  ubicacion?: string
  anio?: string
  nota?: string
  hero_url?: string
  hero_mobile_url?: string
  galeria?: string[]
}): Promise<{ success: true; id: string } | { error: string }> {
  try {
    await requireMarketing()
    if (!data.nombre?.trim()) return { error: 'El nombre es obligatorio.' }
    const admin = createAdminClient()

    // Colocar al final del orden actual.
    const { data: last } = await admin
      .from('web_proyectos').select('orden').order('orden', { ascending: false }).limit(1).single()
    const orden = (last?.orden ?? -1) + 1

    const { data: row, error } = await admin
      .from('web_proyectos')
      .insert({
        nombre:    data.nombre.trim(),
        ubicacion: data.ubicacion?.trim() || null,
        anio:      data.anio?.trim() || null,
        nota:      data.nota?.trim() || null,
        hero_url:  data.hero_url?.trim() || null,
        hero_mobile_url: data.hero_mobile_url?.trim() || null,
        galeria:   data.galeria ?? [],
        orden,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath('/wip')
    return { success: true, id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateWebProyecto(
  id: string,
  data: {
    nombre?: string
    ubicacion?: string | null
    anio?: string | null
    nota?: string | null
    hero_url?: string | null
    hero_mobile_url?: string | null
    galeria?: string[]
    activo?: boolean
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (data.nombre !== undefined)    patch.nombre = data.nombre?.trim() || null
    if (data.ubicacion !== undefined) patch.ubicacion = data.ubicacion?.trim() || null
    if (data.anio !== undefined)      patch.anio = data.anio?.trim() || null
    if (data.nota !== undefined)      patch.nota = data.nota?.trim() || null
    if (data.hero_url !== undefined)  patch.hero_url = data.hero_url
    if (data.hero_mobile_url !== undefined) patch.hero_mobile_url = data.hero_mobile_url
    if (data.galeria !== undefined)   patch.galeria = data.galeria
    if (data.activo !== undefined)    patch.activo = data.activo

    const { error } = await admin.from('web_proyectos').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath('/wip')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteWebProyecto(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { error } = await admin.from('web_proyectos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath('/wip')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Reordena según el array de ids recibido (orden = índice). */
export async function reorderWebProyectos(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(
      ids.map((id, i) => admin.from('web_proyectos').update({ orden: i }).eq('id', id))
    )
    revalidatePath(PATH)
    revalidatePath('/wip')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Contacto público (formulario del teaser) ────────────────────────────────────

const CONTACT_TO = 'contacto@formaprima.es'

// Rate-limit por IP (module-level, por instancia de Vercel). Mismo patrón que
// /api/espacio/verify: suficiente para frenar abuso básico del endpoint público.
const contactAttempts = new Map<string, { count: number; resetAt: number }>()
const CONTACT_WINDOW_MS = 15 * 60 * 1000
const CONTACT_MAX = 5

function contactRateLimit(key: string): boolean {
  const now = Date.now()
  const r = contactAttempts.get(key)
  if (!r || now > r.resetAt) {
    contactAttempts.set(key, { count: 1, resetAt: now + CONTACT_WINDOW_MS })
    return true
  }
  if (r.count >= CONTACT_MAX) return false
  r.count++
  return true
}

// Aviso por email al equipo de captación (no bloquea la respuesta al visitante).
async function avisarEquipoContacto(d: {
  nombre: string; email: string; telefono?: string; empresa?: string; mensaje?: string
  comercial: boolean; repetido: boolean
}): Promise<void> {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#1A1A1A;">${d.repetido ? 'Contacto recurrente desde la web (ya tenía espacio; se le ha reenviado el enlace).' : 'Nuevo contacto desde la web. Se ha creado su espacio de cliente y se le ha enviado el enlace de acceso.'}</p>
    <table style="font-size:14px;color:#1A1A1A;border-collapse:collapse;">
      <tr><td style="padding:4px 16px 4px 0;color:#1A1A1A80;">Nombre</td><td style="padding:4px 0;">${escapeHtml(d.nombre)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#1A1A1A80;">Email</td><td style="padding:4px 0;">${escapeHtml(d.email)}</td></tr>
      ${d.telefono ? `<tr><td style="padding:4px 16px 4px 0;color:#1A1A1A80;">Teléfono</td><td style="padding:4px 0;">${escapeHtml(d.telefono)}</td></tr>` : ''}
      ${d.empresa ? `<tr><td style="padding:4px 16px 4px 0;color:#1A1A1A80;">Empresa</td><td style="padding:4px 0;">${escapeHtml(d.empresa)}</td></tr>` : ''}
      <tr><td style="padding:4px 16px 4px 0;color:#1A1A1A80;">Comerciales</td><td style="padding:4px 0;">${d.comercial ? 'Sí acepta' : 'No'}</td></tr>
    </table>
    ${d.mensaje ? `<p style="margin:16px 0 0;font-size:14px;color:#1A1A1A;white-space:pre-wrap;">${escapeHtml(d.mensaje)}</p>` : ''}
    <p style="margin:20px 0 0;font-size:12px;color:#1A1A1A60;">Disponible en Captación → Leads.</p>
  `
  await sendEmail({
    to: CONTACT_TO,
    replyTo: d.email,
    subject: `Nuevo contacto web — ${d.nombre}`,
    html: wrapEmail(body),
  })
}

/**
 * Envío del formulario de contacto del teaser. Público (sin sesión):
 * dispara el "proceso de cliente" — crea el Espacio del cliente (lead + espacio
 * en etapa 'bienvenida') y le envía por email su enlace de acceso único.
 * Salvaguardas: consentimiento RGPD obligatorio, honeypot anti-bot, rate-limit
 * por IP y dedup por email (no duplica espacios). No revela errores internos.
 */
export async function submitContactoWeb(data: {
  nombre: string
  email: string
  telefono?: string
  empresa?: string
  mensaje?: string
  idioma?: 'es' | 'en'
  /** Aceptación de la Política de Privacidad (obligatoria, RGPD art. 7). */
  consent?: boolean
  /** Aceptación de comunicaciones comerciales (opcional, LSSI art. 21). */
  comercial?: boolean
  /** Honeypot anti-bot: debe llegar vacío. */
  website?: string
}): Promise<{ success: true } | { error: string }> {
  // Honeypot: si un bot rellena el campo oculto, fingimos éxito sin hacer nada.
  if (data.website && data.website.trim()) return { success: true }

  const nombre = data.nombre?.trim()
  const email = data.email?.trim()
  if (!nombre) return { error: 'Indícanos tu nombre.' }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Indícanos un email válido.' }
  // Consentimiento RGPD: revalidado en servidor (no solo en el cliente).
  if (!data.consent) return { error: 'Debes aceptar la Política de Privacidad para continuar.' }

  // Rate-limit por IP.
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers().get('x-real-ip')
    || 'unknown'
  if (!contactRateLimit(ip)) {
    return { error: 'Has enviado demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' }
  }

  const idioma: 'es' | 'en' = data.idioma === 'en' ? 'en' : 'es'
  const telefono = data.telefono?.trim() || undefined
  const empresa = data.empresa?.trim() || undefined
  const mensaje = data.mensaje?.trim() || undefined
  // Registro del consentimiento (responsabilidad proactiva, RGPD art. 5.2/7.1).
  const consentLine = `Consentimiento Política de Privacidad: ACEPTADO ${new Date().toISOString()} (formulario web). Comunicaciones comerciales: ${data.comercial ? 'SÍ' : 'NO'}.`

  try {
    const admin = createAdminClient()

    // Dedup por email: si ya existe un espacio, no creamos otro. Reenviamos el
    // enlace y registramos el mensaje nuevo en su lead.
    const { data: existing } = await admin
      .from('espacios')
      .select('id, token, nombre, idioma, lead_id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (existing) {
      await enviarCorreoBienvenida(
        email,
        existing.nombre || nombre,
        existing.token as string,
        existing.idioma === 'en' ? 'en' : 'es',
      )
      if (existing.lead_id) {
        const { data: lead } = await admin.from('leads').select('notas').eq('id', existing.lead_id).single()
        const linea = `[${new Date().toISOString()}] ${mensaje ?? '(sin mensaje)'} — ${consentLine}`
        await admin.from('leads')
          .update({ notas: [lead?.notas, linea].filter(Boolean).join('\n') })
          .eq('id', existing.lead_id)
      }
      await avisarEquipoContacto({ nombre, email, telefono, empresa, mensaje, comercial: !!data.comercial, repetido: true })
      return { success: true }
    }

    // Nuevo: dispara el proceso de cliente completo.
    await crearEspacioCore({
      nombre,
      email,
      idioma,
      createdBy: null,
      notaInterna: 'Espacio creado automáticamente desde el formulario web (teaser).',
      lead: {
        origen: 'Web (teaser)',
        mensaje: mensaje ?? null,
        telefono: telefono ?? null,
        empresa: empresa ?? null,
        notas: consentLine,
      },
    })

    await avisarEquipoContacto({ nombre, email, telefono, empresa, mensaje, comercial: !!data.comercial, repetido: false })
    return { success: true }
  } catch (err) {
    console.error('[web-publica] submitContacto:', err)
    return { error: 'No hemos podido procesar tu solicitud. Inténtalo de nuevo.' }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

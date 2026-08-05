'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { LEADS_TO } from '@/lib/notificaciones'
import {
  CAMPOS_PARCIAL, EMAIL_RE, telefonoUtil, resumenCualificacion,
  type CampoParcial, type ContactoParcial,
} from '@/lib/contacto'

// Captura progresiva del formulario de contacto. Endpoint PÚBLICO (sin sesión):
// cada guarda es un upsert de la fila de esa sesión de formulario.
//
// Salvaguardas, porque cualquiera puede llamarlo:
//   · id validado como uuid v4 (no vale un id inventado y corto)
//   · solo se persiste si hay email válido o teléfono con ≥7 dígitos
//   · solo los campos declarados en CAMPOS_PARCIAL, con longitud recortada
//   · rate-limit por IP (más generoso que el envío: son muchas guardas por sesión)
//   · la IP se guarda hasheada, nunca en claro

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_LEN: Record<string, number> = { mensaje: 4000, nombre: 200, email: 320, telefono: 40, empresa: 200, ubicacion: 200 }

const parcialAttempts = new Map<string, { count: number; resetAt: number }>()
const PARCIAL_WINDOW_MS = 15 * 60 * 1000
const PARCIAL_MAX = 60

function parcialRateLimit(key: string): boolean {
  const now = Date.now()
  const r = parcialAttempts.get(key)
  if (!r || now > r.resetAt) {
    parcialAttempts.set(key, { count: 1, resetAt: now + PARCIAL_WINDOW_MS })
    return true
  }
  if (r.count >= PARCIAL_MAX) return false
  r.count++
  return true
}

function clientIp(): string {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

const hashIp = (ip: string) => createHash('sha256').update(`fp-contacto:${ip}`).digest('hex').slice(0, 32)

/**
 * Guarda lo que haya en el formulario sin haberlo enviado. Devuelve siempre
 * `{ ok: true }` de cara al visitante: esto pasa de fondo y no debe interrumpir
 * a nadie ni revelar nada del servidor.
 */
export async function guardarContactoParcial(input: {
  id: string
  campos: Partial<Record<CampoParcial, string>>
  paso?: number
  idioma?: string
}): Promise<{ ok: true }> {
  try {
    if (!UUID_RE.test(input.id ?? '')) return { ok: true }
    if (!parcialRateLimit(clientIp())) return { ok: true }

    const limpio: Record<string, string | null> = {}
    for (const campo of CAMPOS_PARCIAL) {
      const v = input.campos?.[campo]
      if (typeof v !== 'string') continue
      const t = v.trim().slice(0, MAX_LEN[campo] ?? 120)
      limpio[campo] = t || null
    }

    // Sin dato de contacto útil no guardamos nada: un parcial que no se puede
    // contestar no es un lead, es basura en el CRM.
    const email = (limpio.email ?? '').trim()
    const util = (email && EMAIL_RE.test(email)) || telefonoUtil(limpio.telefono)
    if (!util) return { ok: true }

    const admin = createAdminClient()
    await admin.from('web_contacto_parcial').upsert({
      id: input.id,
      ...limpio,
      idioma: input.idioma === 'en' ? 'en' : 'es',
      paso_alcanzado: Math.max(1, Math.min(9, Number(input.paso) || 1)),
      user_agent: headers().get('user-agent')?.slice(0, 300) ?? null,
      ip_hash: hashIp(clientIp()),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  } catch (err) {
    // Nunca romper el formulario por un fallo del autoguardado.
    console.error('[contacto] guardarContactoParcial:', err)
  }
  return { ok: true }
}

/**
 * Cualificación enviada DESPUÉS del envío principal (paso opcional de la
 * pantalla de gracias). Enriquece el lead ya creado; si no llega, no pasa nada.
 */
export async function ampliarContactoWeb(input: {
  id: string
  servicio?: string
  ubicacion?: string
  superficie?: string
  plazo?: string
  presupuesto?: string
  idioma?: string
}): Promise<{ ok: true }> {
  try {
    if (!UUID_RE.test(input.id ?? '')) return { ok: true }
    if (!parcialRateLimit(clientIp())) return { ok: true }
    const admin = createAdminClient()

    const campos = {
      servicio: input.servicio?.trim() || null,
      ubicacion: input.ubicacion?.trim().slice(0, 200) || null,
      superficie: input.superficie?.trim() || null,
      plazo: input.plazo?.trim() || null,
      presupuesto: input.presupuesto?.trim() || null,
    }
    const { data: fila } = await admin.from('web_contacto_parcial')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', input.id).select('lead_id, nombre, email').maybeSingle()

    const resumen = resumenCualificacion(campos)
    if (fila?.lead_id && resumen) {
      const { data: lead } = await admin.from('leads').select('notas, interes').eq('id', fila.lead_id).single()
      await admin.from('leads').update({
        interes: resumen,
        notas: [lead?.notas, `[${new Date().toISOString()}] Cualificación desde la web: ${resumen}`].filter(Boolean).join('\n'),
      }).eq('id', fila.lead_id)

      await avisarCualificacion({ nombre: fila.nombre, email: fila.email, resumen })
    }
  } catch (err) {
    console.error('[contacto] ampliarContactoWeb:', err)
  }
  return { ok: true }
}

// ── Correos internos (Resend) ───────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://internal.formaprima.es'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fila(k: string, v?: string | null): string {
  if (!v) return ''
  return `<tr><td style="padding:4px 16px 4px 0;color:#1A1A1A80;">${escapeHtml(k)}</td><td style="padding:4px 0;">${escapeHtml(v)}</td></tr>`
}

async function avisarCualificacion(d: { nombre: string | null; email: string | null; resumen: string }) {
  await sendEmail({
    to: LEADS_TO,
    subject: `Lead web cualificado — ${d.nombre ?? d.email ?? 'sin nombre'}`,
    html: wrapEmail(`
      <p style="margin:0 0 16px;font-size:15px;color:#1A1A1A;">Un lead que ya había contactado ha añadido detalles de su proyecto:</p>
      <table style="font-size:14px;color:#1A1A1A;border-collapse:collapse;">
        ${fila('Nombre', d.nombre)}${fila('Email', d.email)}${fila('Proyecto', d.resumen)}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#1A1A1A60;"><a href="${BASE}/team/captacion/leads" style="color:#D85A30;">Abrir en Captación → Leads</a></p>
    `),
  })
}

/** Aviso de contacto a medias: el lead recuperable con una llamada. */
export async function avisarParcialIncompleto(p: ContactoParcial): Promise<void> {
  const resumen = resumenCualificacion(p)
  await sendEmail({
    to: LEADS_TO,
    replyTo: p.email ?? undefined,
    subject: `Contacto web a medias — ${p.nombre ?? p.email ?? p.telefono ?? 'sin nombre'}`,
    html: wrapEmail(`
      <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;">Alguien empezó el formulario de contacto de la web y no lo terminó.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#1A1A1A80;">Esto es lo que dejó escrito. No ha recibido ningún correo nuestro y no tiene Espacio de cliente: si merece la pena, el siguiente paso es una llamada o un email a mano.</p>
      <table style="font-size:14px;color:#1A1A1A;border-collapse:collapse;">
        ${fila('Nombre', p.nombre)}${fila('Email', p.email)}${fila('Teléfono', p.telefono)}${fila('Empresa', p.empresa)}
        ${fila('Proyecto', resumen)}${fila('Idioma', p.idioma === 'en' ? 'Inglés' : 'Español')}
      </table>
      ${p.mensaje ? `<p style="margin:16px 0 0;font-size:14px;color:#1A1A1A;white-space:pre-wrap;">${escapeHtml(p.mensaje)}</p>` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#1A1A1A60;"><a href="${BASE}/team/captacion/leads" style="color:#D85A30;">Ver en Captación → Leads (contactos a medias)</a></p>
    `),
  })
}

// ── Zona interna (CRM) ──────────────────────────────────────────────────────

async function requireCaptacion() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

/** Contactos que quedaron a medias, para el panel de Leads. */
export async function getContactosIncompletos(): Promise<ContactoParcial[]> {
  await requireCaptacion()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('web_contacto_parcial')
    .select('*')
    .eq('completado', false)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) {
    // Migración sin aplicar: el panel se queda vacío en lugar de tumbar Leads.
    console.error('[contacto] getContactosIncompletos:', error.message)
    return []
  }
  return (data ?? []) as ContactoParcial[]
}

/** Pasa un contacto a medias al CRM como lead de verdad (sin correos al visitante). */
export async function convertirParcialEnLead(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireCaptacion()
    const admin = createAdminClient()
    const { data: p } = await admin.from('web_contacto_parcial').select('*').eq('id', id).maybeSingle()
    if (!p) return { error: 'Ese contacto ya no existe.' }
    if (p.lead_id) return { error: 'Ya está en el CRM.' }

    const resumen = resumenCualificacion(p)
    const { data: lead, error } = await admin.from('leads').insert({
      nombre: p.nombre || p.email || 'Contacto web sin nombre',
      email: p.email,
      telefono: p.telefono,
      empresa: p.empresa,
      mensaje: p.mensaje,
      origen: 'Web (formulario incompleto)',
      estado_lead: 'nuevo',
      interes: resumen || null,
      notas: `Creado a mano desde un formulario de contacto sin terminar (${new Date().toISOString()}). Sin consentimiento de comunicaciones comerciales: solo contacto sobre su solicitud.`,
    }).select('id').single()
    if (error) return { error: error.message }

    await admin.from('web_contacto_parcial').update({ lead_id: lead.id, completado: true }).eq('id', id)
    revalidatePath('/team/captacion/leads')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function descartarParcial(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireCaptacion()
    const admin = createAdminClient()
    const { error } = await admin.from('web_contacto_parcial').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/team/captacion/leads')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

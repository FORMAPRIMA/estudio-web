// Núcleo de creación de Espacios de cliente. Server-only (NO 'use server'): se
// importa desde las server actions (espacios.ts, web-publica.ts) pero no se
// expone como acción invocable desde el navegador.
//
// Un Espacio = la superficie única y permanente del cliente (/espacio/{token}).
// Crear un Espacio implica: registrar un lead en el CRM + el espacio en etapa
// 'bienvenida' + enviar el correo de bienvenida con el enlace único.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'

// Correo de bienvenida con el link único del Espacio (ES/EN). Mismo formato
// (wrapEmail) que el resto de correos de la plataforma.
export async function enviarCorreoBienvenida(
  email: string,
  nombre: string,
  token: string,
  idioma: 'es' | 'en',
): Promise<boolean> {
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'}/espacio/${token}`
  const C = idioma === 'en'
    ? {
        subject: 'Your space at Forma Prima',
        hello: `Hello, ${nombre}`,
        intro: 'Thank you for your interest in Forma Prima. We have created your personal space: a single place to get to know us and to accompany you through every step of the process.',
        cta: 'Open my space',
        note: 'This link is yours and will remain the same throughout our entire relationship. Keep it safe.',
        sign: 'Kind regards,<br/><strong>The Forma Prima team</strong>',
      }
    : {
        subject: 'Tu espacio en Forma Prima',
        hello: `Hola, ${nombre}`,
        intro: 'Gracias por tu interés en Forma Prima. Hemos creado tu espacio personal: un único lugar donde conocernos y acompañarte en cada paso del proceso.',
        cta: 'Abrir mi espacio',
        note: 'Este enlace es tuyo y será siempre el mismo a lo largo de toda nuestra relación. Guárdalo.',
        sign: 'Un saludo,<br/><strong>El equipo de Forma Prima</strong>',
      }

  const body = `
    <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">${C.hello}</h2>
    <p style="font-size:13px;color:#555;margin:0 0 24px;line-height:1.6;">${C.intro}</p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:500;">${C.cta}</a>
    </p>
    <p style="font-size:12px;color:#888;margin:0 0 20px;line-height:1.6;">${C.note}</p>
    <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">${C.sign}</p>
  `
  const res = await sendEmail({ to: email, subject: C.subject, html: wrapEmail(body) })
  if (res.error) { console.error('[espacio] correo bienvenida:', res.error); return false }
  return true
}

export interface CrearEspacioInput {
  nombre: string
  email: string
  idioma?: 'es' | 'en'
  /** Usuario del equipo que lo crea; null en el flujo público. */
  createdBy?: string | null
  /** Nota interna del espacio (espacios.nota_interna). */
  notaInterna?: string | null
  /** Campos extra para el registro de lead asociado. */
  lead?: {
    origen?: string
    mensaje?: string | null
    telefono?: string | null
    empresa?: string | null
    notas?: string | null
  }
}

export interface CrearEspacioResult {
  token: string
  emailSent: boolean
  leadId: string | null
  espacioId: string
}

/**
 * Crea lead + espacio (etapa 'bienvenida') y envía el correo de bienvenida.
 * No verifica permisos ni revalida rutas: eso es responsabilidad del caller.
 */
export async function crearEspacioCore(input: CrearEspacioInput): Promise<CrearEspacioResult> {
  const admin = createAdminClient()
  const nombre = input.nombre.trim()
  const email = input.email.trim()
  const idioma = input.idioma === 'en' ? 'en' : 'es'

  // Creamos el lead ya, para que aparezca en el CRM desde el primer contacto y
  // el Espacio quede vinculado desde el inicio.
  const { data: lead } = await admin
    .from('leads')
    .insert({
      nombre,
      email: email || null,
      origen: input.lead?.origen ?? 'Espacio',
      estado_lead: 'nuevo',
      mensaje: input.lead?.mensaje ?? null,
      telefono: input.lead?.telefono ?? null,
      empresa: input.lead?.empresa ?? null,
      notas: input.lead?.notas ?? input.notaInterna?.trim() ?? null,
    })
    .select('id')
    .single()

  const { data, error } = await admin
    .from('espacios')
    .insert({
      nombre,
      email: email || null,
      lead_id: lead?.id ?? null,
      nota_interna: input.notaInterna?.trim() || null,
      etapa: 'bienvenida',
      idioma,
      created_by: input.createdBy ?? null,
    })
    .select('id, token')
    .single()
  if (error) throw new Error(error.message)

  const emailSent = email
    ? await enviarCorreoBienvenida(email, nombre, data.token as string, idioma)
    : false

  return { token: data.token as string, emailSent, leadId: lead?.id ?? null, espacioId: data.id as string }
}

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, wrapEmail } from '@/lib/email'
import Anthropic from '@anthropic-ai/sdk'
import type { ActaLabels } from '@/components/pdfs/ActaVisitaObraPDF'

const LABELS_EN: ActaLabels = {
  actaLabel:    'Site Visit Report',
  numPrefix:    'No.',
  proyecto:     'Project',
  asistentes:   'Attendees',
  tipoEquipo:   'Team',
  tipoCliente:  'Clients',
  tipoProveedor: 'Suppliers',
  tipoExterno:  'Guests',
  estado_obras: 'Works Status',
  instrucciones: 'Instructions',
  fotografias:  'Construction Photographs',
  recorrido:    'Updated virtual tour of the site visit',
}

const PATH_INTERNA = '/team/clientes/plataforma/interna'

// ── Auth ──────────────────────────────────────────────────────────────────────

async function requireAnyFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, id')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_team'].includes(profile.rol))
    throw new Error('Sin permisos.')
  return profile
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EquipoMember {
  id: string
  nombre: string
  apellido: string | null
  rol: string
  email: string
}

export interface ClienteContacto {
  id: string
  nombre: string
  apellidos: string | null
  email: string | null
  email_cc: string | null
}

export interface ProveedorContactoPersona {
  id: string
  nombre: string
  cargo: string | null
  email: string | null
}

export interface ProveedorContacto {
  id: string
  nombre: string
  tipo: string | null
  email: string | null
  proveedor_contactos: ProveedorContactoPersona[]
}

export interface ContactosParaVisita {
  equipo: EquipoMember[]
  clientes: ClienteContacto[]
  proveedores: ProveedorContacto[]
  proximoNumeroVisita: number
}

export interface AsistenteInput {
  nombre: string
  tipo: 'equipo' | 'cliente' | 'proveedor' | 'externo'
}

export interface CrearActaInput {
  proyecto_id: string
  fecha: string
  titulo: string
  asistentes: AsistenteInput[]
  estado_obras: string
  instrucciones: string
  instruccionesConstructor: string
  floorfy_url: string | null
  visible_cliente: boolean
  proyecto_nombre: string
  proyecto_codigo: string | null
  proyecto_direccion: string | null
  numero_visita?: number
  fotos_constructor?: string[]
  fotos_cliente?: string[]
  generarConstructor?: boolean
  generarCliente?: boolean
  idioma?: 'es' | 'en'
  /** If set, promote this existing draft row into the real acta instead of inserting a new one. */
  borrador_id?: string | null
}

// ── Borrador (autosave) ─────────────────────────────────────────────────────────

/** Full snapshot of the modal form, stored as JSON so the draft can repopulate it. */
export interface BorradorVisitaData {
  fecha: string
  titulo: string
  estado_obras: string
  instrucciones: string
  instruccionesConstructor: string
  floorfy_url: string
  idioma: 'es' | 'en'
  numero_visita: number
  generarCliente: boolean
  generarConstructor: boolean
  asistentes: { id: string; nombre: string; tipo: AsistenteInput['tipo'] }[]
}

export interface SaveBorradorInput {
  borrador_id?: string | null
  proyecto_id: string
  fecha: string
  titulo: string
  /** Comma-separated attendee names, for the list preview. */
  asistentes: string | null
  /** Concatenated estado + instrucciones, for the list preview. */
  notas: string | null
  floorfy_url: string | null
  data: BorradorVisitaData
}

// ── Translation helper (client PDF only, constructor always stays in Spanish) ──

interface ContenidoTraducible {
  titulo: string
  estado_obras: string
  instrucciones: string
}

async function traducirActaCliente(contenido: ContenidoTraducible): Promise<ContenidoTraducible> {
  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a professional translator for Forma Prima, an architecture studio.
Translate construction site visit report content from Spanish to English.
Maintain a professional, formal, technical tone.
Preserve proper nouns (project names, company names, people's names) exactly as they are.
Return ONLY a valid JSON object with the exact same keys as input — no markdown, no explanation.`,
      messages: [{
        role: 'user',
        content: `Translate to English, return ONLY the JSON:\n\n${JSON.stringify(contenido)}`,
      }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned) as ContenidoTraducible
  } catch (err) {
    console.error('[traducirActaCliente] Error — using Spanish fallback:', err)
    return contenido
  }
}

// ── getContactosParaVisita ────────────────────────────────────────────────────

export async function getContactosParaVisita(
  proyectoId: string
): Promise<ContactosParaVisita | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    const [
      { data: equipoData },
      { data: clientesData },
      { data: proveedoresData },
      { data: provContactosData },
      { count: visitasCount },
    ] = await Promise.all([
      admin
        .from('profiles')
        .select('id, nombre, apellido, rol, email')
        .in('rol', ['fp_partner', 'fp_manager', 'fp_team'])
        .order('nombre'),
      admin
        .from('proyecto_clientes')
        .select('clientes(id, nombre, apellidos, email, email_cc)')
        .eq('proyecto_id', proyectoId),
      admin
        .from('proveedores')
        .select('id, nombre, tipo, email')
        .order('nombre'),
      // Separate query — resilient if proveedor_contactos table doesn't exist yet
      admin
        .from('proveedor_contactos')
        .select('id, proveedor_id, nombre, cargo, email'),
      admin
        .from('visitas_obra')
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_id', proyectoId)
        .eq('es_borrador', false),
    ])

    const equipo: EquipoMember[] = (equipoData ?? []).map(e => ({
      id: e.id as string,
      nombre: e.nombre as string,
      apellido: e.apellido as string | null,
      rol: e.rol as string,
      email: e.email as string,
    }))

    type ClienteRow = { id: string; nombre: string; apellidos: string | null; email: string | null; email_cc: string | null }
    const clientes: ClienteContacto[] = (clientesData ?? [])
      .flatMap(row => {
        const c = (row as unknown as { clientes: ClienteRow | ClienteRow[] | null }).clientes
        if (!c) return []
        if (Array.isArray(c)) return c.map(x => ({ id: x.id, nombre: x.nombre, apellidos: x.apellidos ?? null, email: x.email ?? null, email_cc: x.email_cc ?? null }))
        return [{ id: c.id, nombre: c.nombre, apellidos: c.apellidos ?? null, email: c.email ?? null, email_cc: c.email_cc ?? null }]
      })

    // Group proveedor_contactos by proveedor_id (query returns null if table doesn't exist)
    const contactosByProv = new Map<string, ProveedorContactoPersona[]>()
    for (const c of (provContactosData ?? [])) {
      const pid = (c as any).proveedor_id as string
      const arr = contactosByProv.get(pid) ?? []
      arr.push({
        id: (c as any).id as string,
        nombre: (c as any).nombre as string,
        cargo: ((c as any).cargo ?? null) as string | null,
        email: ((c as any).email ?? null) as string | null,
      })
      contactosByProv.set(pid, arr)
    }

    const proveedores: ProveedorContacto[] = (proveedoresData ?? []).map(p => ({
      id: p.id as string,
      nombre: p.nombre as string,
      tipo: (p.tipo ?? null) as string | null,
      email: (p.email ?? null) as string | null,
      proveedor_contactos: contactosByProv.get(p.id as string) ?? [],
    }))

    return { equipo, clientes, proveedores, proximoNumeroVisita: (visitasCount ?? 0) + 1 }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── uploadFotoVisita ──────────────────────────────────────────────────────────

export async function uploadFotoVisita(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    const file = formData.get('foto') as File
    const proyectoId = formData.get('proyecto_id') as string
    if (!file || file.size === 0) return { error: 'No se recibió ninguna foto.' }
    if (file.size > 20 * 1024 * 1024) return { error: 'La foto no puede superar 20 MB.' }

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const ts   = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${proyectoId}/fotos-visita/${ts}-${rand}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage
      .from('portal')
      .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: false })
    if (upErr) return { error: upErr.message }

    const url = admin.storage.from('portal').getPublicUrl(path).data.publicUrl
    return { url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── createActaVisita ──────────────────────────────────────────────────────────

export async function createActaVisita(
  data: CrearActaInput
): Promise<{ id: string; acta_url: string; acta_constructor_url: string; floorfy_url: string | null; traducciones?: ContenidoTraducible } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    // 1 — Dynamic import of renderer (the PDF builder receives the modules directly
    //     so @react-pdf/renderer is never statically bundled into this action)
    const reactPdf = await import('@react-pdf/renderer')
    const { buildActaVisitaObraElement } = await import('@/components/pdfs/ActaVisitaObraPDF')

    const idioma = data.idioma ?? 'es'

    // 1b — If English, translate client content (constructor always stays in Spanish)
    let traducciones: ContenidoTraducible | undefined
    if (idioma === 'en') {
      traducciones = await traducirActaCliente({
        titulo:        data.titulo,
        estado_obras:  data.estado_obras,
        instrucciones: data.instrucciones,
      })
    }

    // 2 — Build PDF data (always Spanish base — used for constructor PDF)
    const baseActaData = {
      proyecto_nombre:    data.proyecto_nombre,
      proyecto_codigo:    data.proyecto_codigo,
      proyecto_direccion: data.proyecto_direccion,
      fecha:              data.fecha,
      asistentes:         data.asistentes,
      estado_obras:       data.estado_obras,
      floorfy_url:        data.floorfy_url,
      numero_visita:      data.numero_visita,
    }

    const doConstructor = data.generarConstructor !== false
    const doCliente     = data.generarCliente     !== false

    const ts = Date.now()
    let acta_constructor_url = ''
    let acta_url = ''

    // 2a — Constructor PDF (always Spanish, never translated)
    if (doConstructor) {
      const constructorPdfElement = buildActaVisitaObraElement(reactPdf, {
        ...baseActaData,
        instrucciones: data.instruccionesConstructor || data.instrucciones,
        fotos:         data.fotos_constructor ?? [],
      })
      const constructorPdfBuffer = await reactPdf.renderToBuffer(
        constructorPdfElement as unknown as Parameters<typeof reactPdf.renderToBuffer>[0]
      )
      const constructorPath = `${data.proyecto_id}/actas/${data.fecha}-acta-constructor-${ts}.pdf`
      const { error: upErr1 } = await admin.storage
        .from('portal')
        .upload(constructorPath, constructorPdfBuffer, { contentType: 'application/pdf', upsert: true })
      if (upErr1) return { error: `Error al subir PDF constructor: ${upErr1.message}` }
      acta_constructor_url = admin.storage.from('portal').getPublicUrl(constructorPath).data.publicUrl
    }

    // 2b — Client PDF (translated if idioma === 'en')
    if (doCliente) {
      const clienteInstrucciones = idioma === 'en' && traducciones ? traducciones.instrucciones : data.instrucciones
      const clienteEstadoObras   = idioma === 'en' && traducciones ? traducciones.estado_obras  : data.estado_obras
      const clienteLabels        = idioma === 'en' ? LABELS_EN : undefined

      const clientPdfElement = buildActaVisitaObraElement(reactPdf, {
        ...baseActaData,
        estado_obras:  clienteEstadoObras,
        instrucciones: clienteInstrucciones,
        fotos:         data.fotos_cliente ?? [],
        labels:        clienteLabels,
      })
      const clientePdfBuffer = await reactPdf.renderToBuffer(
        clientPdfElement as unknown as Parameters<typeof reactPdf.renderToBuffer>[0]
      )
      const langSuffix = idioma.toUpperCase()
      const clientePath = `${data.proyecto_id}/actas/${data.fecha}-acta-cliente-${langSuffix}-${ts}.pdf`
      const { error: upErr2 } = await admin.storage
        .from('portal')
        .upload(clientePath, clientePdfBuffer, { contentType: 'application/pdf', upsert: true })
      if (upErr2) return { error: `Error al subir PDF cliente: ${upErr2.message}` }
      acta_url = admin.storage.from('portal').getPublicUrl(clientePath).data.publicUrl
    }

    // If only constructor was generated, use that as the main acta_url
    if (!doCliente && doConstructor) acta_url = acta_constructor_url

    // 5 — Format asistentes as comma-separated string
    const asistenteStr = data.asistentes.map(a => a.nombre).join(', ')

    // 6 — Format notas
    const notas = [
      'ESTADO DE OBRAS',
      data.estado_obras,
      '',
      'INSTRUCCIONES',
      data.instrucciones,
    ].join('\n')

    // 7 — Persist into visitas_obra. If this acta came from a draft, promote that
    //     same row (clear the draft flag/payload) instead of inserting a new one.
    const actaFields = {
      proyecto_id:          data.proyecto_id,
      fecha:                data.fecha,
      titulo:               data.titulo,
      asistentes:           asistenteStr || null,
      notas:                notas || null,
      acta_url,
      acta_constructor_url: acta_constructor_url || null,
      floorfy_url:          data.floorfy_url || null,
      visible_cliente:      data.visible_cliente,
    }

    let row: { id: string } | null = null

    if (data.borrador_id) {
      const { data: updated, error: updateError } = await admin
        .from('visitas_obra')
        .update({ ...actaFields, es_borrador: false, borrador_data: null } as Record<string, unknown>)
        .eq('id', data.borrador_id)
        .select('id')
        .single()
      if (!updateError && updated) row = updated as { id: string }
      // If the draft row vanished or the update failed, fall through to a fresh insert.
    }

    if (!row) {
      const { data: inserted, error: insertError } = await admin
        .from('visitas_obra')
        .insert(actaFields)
        .select('id')
        .single()
      if (insertError) return { error: insertError.message }
      row = inserted as { id: string }
    }

    // 7b — Store idioma_acta (best-effort: column may not exist yet in production)
    if (idioma !== 'es') {
      await admin
        .from('visitas_obra')
        .update({ idioma_acta: idioma } as Record<string, unknown>)
        .eq('id', row.id)
      // error intentionally ignored — missing column shouldn't block acta creation
    }

    // 8 — Revalidate
    revalidatePath(PATH_INTERNA)

    return {
      id:                  row.id as string,
      acta_url,
      acta_constructor_url,
      floorfy_url:         data.floorfy_url || null,
      traducciones,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── saveBorradorVisita ──────────────────────────────────────────────────────────
//
// Autosave for the acta modal. Upserts a draft row in visitas_obra so an in-progress
// acta survives an accidental modal close. Drafts are never visible to the client
// (visible_cliente is forced false) and are excluded from the visit numbering count.

export async function saveBorradorVisita(
  input: SaveBorradorInput
): Promise<{ id: string } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    const fields = {
      proyecto_id:     input.proyecto_id,
      fecha:           input.fecha,
      titulo:          input.titulo,
      asistentes:      input.asistentes,
      notas:           input.notas,
      floorfy_url:     input.floorfy_url,
      visible_cliente: false,
      es_borrador:     true,
      borrador_data:   input.data as unknown as Record<string, unknown>,
    } as Record<string, unknown>

    if (input.borrador_id) {
      const { data: updated, error } = await admin
        .from('visitas_obra')
        .update(fields)
        .eq('id', input.borrador_id)
        .eq('es_borrador', true) // never overwrite an already-sent acta
        .select('id')
        .single()
      if (!error && updated) {
        revalidatePath(PATH_INTERNA)
        return { id: (updated as { id: string }).id }
      }
      // Row gone or already promoted — fall through to a fresh insert.
    }

    const { data: inserted, error: insertError } = await admin
      .from('visitas_obra')
      .insert(fields)
      .select('id')
      .single()
    if (insertError) return { error: insertError.message }

    revalidatePath(PATH_INTERNA)
    return { id: (inserted as { id: string }).id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── sendActaByEmail ───────────────────────────────────────────────────────────

export interface CompartirActaInput {
  /** Destinatarios del acta del cliente (clientes del proyecto + asistentes) */
  clienteEmails: string[]
  /** Destinatarios del acta del constructor */
  constructorEmails: string[]
  clienteNombres: string[]
  constructorNombre: string | null
  proyecto_id: string
  proyecto_nombre: string
  proyecto_codigo: string | null
  fecha: string
  titulo: string
  acta_url: string
  acta_constructor_url: string
  asistentes: string | null
  estado_obras: string
  instrucciones: string              // instrucciones para el cliente
  instruccionesConstructor: string   // instrucciones para el constructor
  floorfy_url: string | null
  /** When 'en', client email is sent in English; constructor always stays in Spanish */
  idioma?: 'es' | 'en'
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fmtDateEs(d: string): string {
  const [y, m, day] = d.split('-')
  const mes = MESES_ES[parseInt(m, 10) - 1] ?? m
  return `${parseInt(day, 10)} de ${mes} de ${y}`
}

function buildActaEmailBody(opts: {
  saludoNombre: string | null
  proyecto_nombre: string
  proyecto_codigo: string | null
  fechaFmt: string
  asistentes: string | null
  estado_obras: string
  instrucciones: string
  floorfy_url: string | null
  portalUrl: string
  showPortalLink: boolean
  lang?: 'es' | 'en'
}): string {
  const { saludoNombre, proyecto_nombre, proyecto_codigo, fechaFmt, asistentes, estado_obras, instrucciones, floorfy_url, portalUrl, showPortalLink, lang } = opts
  const en = lang === 'en'

  const t = {
    saludo:       en ? 'Dear'                         : 'Estimado/a',
    subtitle:     en ? 'New site visit report'        : 'Nueva acta de visita de obra',
    fechaLabel:   en ? 'Visit date'                   : 'Fecha de visita',
    asistentes:   en ? 'Attendees'                    : 'Asistentes',
    estadoLabel:  en ? 'Works status'                 : 'Estado de obras',
    instrLabel:   en ? 'Instructions'                 : 'Instrucciones',
    tourLabel:    en ? 'Virtual tour'                 : 'Tour virtual',
    adjunto:      en
      ? `Please find attached the complete site visit report in PDF.${showPortalLink ? ' You can also check the progress of your project in your private client area.' : ''}`
      : `Adjuntamos el acta completa en PDF.${showPortalLink ? ' También puede consultar el avance de su proyecto en el área privada de cliente.' : ''}`,
    cta:          en ? 'View my project →'            : 'Ver mi proyecto →',
    footer:       en
      ? 'If you have any questions about this visit, please do not hesitate to reply to this email.'
      : 'Si tiene alguna pregunta sobre esta visita, no dude en responder a este correo.',
  }

  return `
    ${saludoNombre ? `<p style="margin:0 0 20px;font-size:20px;font-weight:300;color:#1A1A1A;line-height:1.3;">${t.saludo} ${saludoNombre},</p>` : ''}
    <p style="margin:0 0 6px;font-size:11px;color:#888;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">
      ${t.subtitle}
    </p>
    <h2 style="margin:0 0 20px;font-size:20px;font-weight:300;color:#1A1A1A;letter-spacing:-0.01em;">
      ${proyecto_nombre}${proyecto_codigo ? ` <span style="font-size:13px;color:#AAA;font-weight:400;">${proyecto_codigo}</span>` : ''}
    </h2>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;border:1px solid #E8E6E0;">
      <tr>
        <td style="padding:12px 16px;background:#F8F7F4;border-bottom:1px solid #E8E6E0;">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">${t.fechaLabel}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#1A1A1A;font-weight:400;">${fechaFmt}</p>
        </td>
      </tr>
      ${asistentes ? `<tr>
        <td style="padding:12px 16px;border-bottom:1px solid #E8E6E0;">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">${t.asistentes}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;">${asistentes}</p>
        </td>
      </tr>` : ''}
      ${estado_obras ? `<tr>
        <td style="padding:12px 16px;${instrucciones || floorfy_url ? 'border-bottom:1px solid #E8E6E0;' : ''}">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">${t.estadoLabel}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${estado_obras}</p>
        </td>
      </tr>` : ''}
      ${instrucciones ? `<tr>
        <td style="padding:12px 16px;${floorfy_url ? 'border-bottom:1px solid #E8E6E0;' : ''}">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">${t.instrLabel}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${instrucciones}</p>
        </td>
      </tr>` : ''}
      ${floorfy_url ? `<tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">${t.tourLabel}</p>
          <p style="margin:4px 0 0;font-size:12px;"><a href="${floorfy_url}" style="color:#D85A30;text-decoration:none;">${floorfy_url}</a></p>
        </td>
      </tr>` : ''}
    </table>

    <p style="margin:0 0 24px;font-size:12px;color:#3A3A3A;line-height:1.7;">
      ${t.adjunto}
    </p>

    ${showPortalLink ? `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:#1A1A1A;border-radius:4px;">
          <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#F0EDE8;text-decoration:none;">
            ${t.cta}
          </a>
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin:0;font-size:11px;color:#AAAAAA;line-height:1.6;">
      ${t.footer}
    </p>
  `
}

export async function sendActaByEmail(
  data: CompartirActaInput
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()

    const hasCliente     = data.clienteEmails.length > 0
    const hasConstructor = data.constructorEmails.length > 0
    if (!hasCliente && !hasConstructor) return { success: true }

    // Fetch fp_partner emails — always CC'd on every email
    const admin = createAdminClient()
    const { data: partners } = await admin
      .from('profiles')
      .select('email')
      .eq('rol', 'fp_partner')
    const partnerEmails: string[] = (partners ?? []).map((p: any) => p.email as string).filter(Boolean)

    // Download only the PDFs that are actually needed
    let clientPdfBuffer: Buffer | null = null
    let constructorPdfBuffer: Buffer | null = null

    if (hasCliente && data.acta_url) {
      const r = await fetch(data.acta_url)
      if (!r.ok) return { error: `No se pudo descargar el PDF del cliente: ${r.status}` }
      clientPdfBuffer = Buffer.from(await r.arrayBuffer())
    }
    if (hasConstructor && data.acta_constructor_url) {
      const r = await fetch(data.acta_constructor_url)
      if (!r.ok) return { error: `No se pudo descargar el PDF del constructor: ${r.status}` }
      constructorPdfBuffer = Buffer.from(await r.arrayBuffer())
    }
    // Fallback: if only one PDF was generated, reuse it for both
    if (!clientPdfBuffer && constructorPdfBuffer) clientPdfBuffer = constructorPdfBuffer
    if (!constructorPdfBuffer && clientPdfBuffer) constructorPdfBuffer = clientPdfBuffer

    const idioma    = data.idioma ?? 'es'
    const en        = idioma === 'en'
    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.formaprima.es'}/portal/${data.proyecto_id}`
    const fechaFmtEs = fmtDateEs(data.fecha)
    const MESES_EN_EMAIL = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const [fy, fm, fday] = data.fecha.split('-')
    const fechaFmtEn = `${MESES_EN_EMAIL[parseInt(fm, 10) - 1] ?? fm} ${parseInt(fday, 10)}, ${fy}`
    const fechaFmt   = en ? fechaFmtEn : fechaFmtEs

    const subjectEs  = `FORMA PRIMA · Nueva visita de obra · ${data.proyecto_nombre}`
    const subjectEn  = `FORMA PRIMA · New site visit report · ${data.proyecto_nombre}`
    const proyNorm   = data.proyecto_nombre.replace(/[^a-zA-Z0-9]/g, '_')

    // ── 1. Email al cliente ───────────────────────────────────────────────────
    if (hasCliente) {
      const nombres = data.clienteNombres.filter(Boolean)
      const saludoNombre = nombres.length > 1
        ? nombres.slice(0, -1).join(', ') + (en ? ' and ' : ' y ') + nombres[nombres.length - 1]
        : nombres[0] ?? null

      const bodyHtml = buildActaEmailBody({
        saludoNombre,
        proyecto_nombre:  data.proyecto_nombre,
        proyecto_codigo:  data.proyecto_codigo,
        fechaFmt,
        asistentes:       data.asistentes,
        estado_obras:     data.estado_obras,
        instrucciones:    data.instrucciones,
        floorfy_url:      data.floorfy_url,
        portalUrl,
        showPortalLink:   true,
        lang:             idioma,
      })

      const pdfFilenameCliente = `Acta_visita_${idioma.toUpperCase()}_${data.fecha}_${proyNorm}.pdf`
      const ccPartners = partnerEmails.filter(e => !data.clienteEmails.includes(e))
      const r = await sendEmail({
        to:          data.clienteEmails,
        cc:          ccPartners.length ? ccPartners : undefined,
        subject:     en ? subjectEn : subjectEs,
        html:        wrapEmail(bodyHtml),
        attachments: clientPdfBuffer ? [{ filename: pdfFilenameCliente, content: clientPdfBuffer }] : undefined,
      })
      if (r.error) return { error: r.error }
    }

    // ── 2. Email al constructor (always Spanish) ──────────────────────────────
    if (hasConstructor) {
      const instrCons = data.instruccionesConstructor.trim() || data.instrucciones

      const bodyHtml = buildActaEmailBody({
        saludoNombre:    data.constructorNombre,
        proyecto_nombre: data.proyecto_nombre,
        proyecto_codigo: data.proyecto_codigo,
        fechaFmt:        fechaFmtEs,
        asistentes:      data.asistentes,
        estado_obras:    data.estado_obras,
        instrucciones:   instrCons,
        floorfy_url:     data.floorfy_url,
        portalUrl,
        showPortalLink:  false,
        lang:            'es',
      })

      const pdfFilenameConstructor = `Acta_visita_ES_${data.fecha}_${proyNorm}.pdf`
      const ccPartners = partnerEmails.filter(e => !data.constructorEmails.includes(e))
      const r = await sendEmail({
        to:          data.constructorEmails,
        cc:          ccPartners.length ? ccPartners : undefined,
        subject:     subjectEs,
        html:        wrapEmail(bodyHtml),
        attachments: constructorPdfBuffer ? [{ filename: pdfFilenameConstructor, content: constructorPdfBuffer }] : undefined,
      })
      if (r.error) return { error: r.error }
    }

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

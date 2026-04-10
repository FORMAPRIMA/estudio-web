'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, wrapEmail } from '@/lib/email'

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

export interface ProveedorContacto {
  id: string
  nombre: string
  tipo: string | null
  email: string | null
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
      admin
        .from('visitas_obra')
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_id', proyectoId),
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

    const proveedores: ProveedorContacto[] = (proveedoresData ?? []).map(p => ({
      id: p.id as string,
      nombre: p.nombre as string,
      tipo: (p.tipo ?? null) as string | null,
      email: (p.email ?? null) as string | null,
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

// ── crearActaVisita ───────────────────────────────────────────────────────────

export async function crearActaVisita(
  data: CrearActaInput
): Promise<{ id: string; acta_url: string; acta_constructor_url: string; floorfy_url: string | null } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    // 1 — Dynamic import of renderer (the PDF builder receives the modules directly
    //     so @react-pdf/renderer is never statically bundled into this action)
    const reactPdf = await import('@react-pdf/renderer')
    const { buildActaVisitaObraElement } = await import('@/components/pdfs/ActaVisitaObraPDF')

    // 2 — Build PDF data
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

    // 2a — Constructor PDF (only if requested)
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

    // 2b — Client PDF (only if requested)
    if (doCliente) {
      const clientPdfElement = buildActaVisitaObraElement(reactPdf, {
        ...baseActaData,
        instrucciones: data.instrucciones,
        fotos:         data.fotos_cliente ?? [],
      })
      const clientePdfBuffer = await reactPdf.renderToBuffer(
        clientPdfElement as unknown as Parameters<typeof reactPdf.renderToBuffer>[0]
      )
      const clientePath = `${data.proyecto_id}/actas/${data.fecha}-acta-cliente-${ts}.pdf`
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

    // 7 — Insert into visitas_obra
    const { data: row, error: insertError } = await admin
      .from('visitas_obra')
      .insert({
        proyecto_id:          data.proyecto_id,
        fecha:                data.fecha,
        titulo:               data.titulo,
        asistentes:           asistenteStr || null,
        notas:                notas || null,
        acta_url,
        acta_constructor_url: acta_constructor_url || null,
        floorfy_url:          data.floorfy_url || null,
        visible_cliente:      data.visible_cliente,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }

    // 8 — Revalidate
    revalidatePath(PATH_INTERNA)

    return { id: row.id as string, acta_url, acta_constructor_url, floorfy_url: data.floorfy_url || null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── compartirActaPorEmail ─────────────────────────────────────────────────────

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
}): string {
  const { saludoNombre, proyecto_nombre, proyecto_codigo, fechaFmt, asistentes, estado_obras, instrucciones, floorfy_url, portalUrl, showPortalLink } = opts
  return `
    ${saludoNombre ? `<p style="margin:0 0 20px;font-size:20px;font-weight:300;color:#1A1A1A;line-height:1.3;">Estimado/a ${saludoNombre},</p>` : ''}
    <p style="margin:0 0 6px;font-size:11px;color:#888;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">
      Nueva acta de visita de obra
    </p>
    <h2 style="margin:0 0 20px;font-size:20px;font-weight:300;color:#1A1A1A;letter-spacing:-0.01em;">
      ${proyecto_nombre}${proyecto_codigo ? ` <span style="font-size:13px;color:#AAA;font-weight:400;">${proyecto_codigo}</span>` : ''}
    </h2>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;border:1px solid #E8E6E0;">
      <tr>
        <td style="padding:12px 16px;background:#F8F7F4;border-bottom:1px solid #E8E6E0;">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Fecha de visita</p>
          <p style="margin:4px 0 0;font-size:13px;color:#1A1A1A;font-weight:400;">${fechaFmt}</p>
        </td>
      </tr>
      ${asistentes ? `<tr>
        <td style="padding:12px 16px;border-bottom:1px solid #E8E6E0;">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Asistentes</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;">${asistentes}</p>
        </td>
      </tr>` : ''}
      ${estado_obras ? `<tr>
        <td style="padding:12px 16px;${instrucciones || floorfy_url ? 'border-bottom:1px solid #E8E6E0;' : ''}">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Estado de obras</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${estado_obras}</p>
        </td>
      </tr>` : ''}
      ${instrucciones ? `<tr>
        <td style="padding:12px 16px;${floorfy_url ? 'border-bottom:1px solid #E8E6E0;' : ''}">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Instrucciones</p>
          <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${instrucciones}</p>
        </td>
      </tr>` : ''}
      ${floorfy_url ? `<tr>
        <td style="padding:12px 16px;">
          <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Tour virtual</p>
          <p style="margin:4px 0 0;font-size:12px;"><a href="${floorfy_url}" style="color:#D85A30;text-decoration:none;">${floorfy_url}</a></p>
        </td>
      </tr>` : ''}
    </table>

    <p style="margin:0 0 24px;font-size:12px;color:#3A3A3A;line-height:1.7;">
      Adjuntamos el acta completa en PDF.${showPortalLink ? ' También puede consultar el avance de su proyecto en el área privada de cliente.' : ''}
    </p>

    ${showPortalLink ? `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:#1A1A1A;border-radius:4px;">
          <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#F0EDE8;text-decoration:none;">
            Ver mi proyecto →
          </a>
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin:0;font-size:11px;color:#AAAAAA;line-height:1.6;">
      Si tiene alguna pregunta sobre esta visita, no dude en responder a este correo.
    </p>
  `
}

export async function compartirActaPorEmail(
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

    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.formaprima.es'}/portal/${data.proyecto_id}`
    const fechaFmt  = fmtDateEs(data.fecha)
    const subject   = `FORMA PRIMA · Nueva visita de obra · ${data.proyecto_nombre}`
    const pdfFilename = `Acta_visita_${data.fecha}_${data.proyecto_nombre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    // ── 1. Email al cliente ───────────────────────────────────────────────────
    if (hasCliente) {
      const nombres = data.clienteNombres.filter(Boolean)
      const saludoNombre = nombres.length > 1
        ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]
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
      })

      const ccPartners = partnerEmails.filter(e => !data.clienteEmails.includes(e))
      const r = await sendEmail({
        to:          data.clienteEmails,
        cc:          ccPartners.length ? ccPartners : undefined,
        subject,
        html:        wrapEmail(bodyHtml),
        attachments: clientPdfBuffer ? [{ filename: pdfFilename, content: clientPdfBuffer }] : undefined,
      })
      if (r.error) return { error: r.error }
    }

    // ── 2. Email al constructor ───────────────────────────────────────────────
    if (hasConstructor) {
      const instrCons = data.instruccionesConstructor.trim() || data.instrucciones

      const bodyHtml = buildActaEmailBody({
        saludoNombre:    data.constructorNombre,
        proyecto_nombre: data.proyecto_nombre,
        proyecto_codigo: data.proyecto_codigo,
        fechaFmt,
        asistentes:      data.asistentes,
        estado_obras:    data.estado_obras,
        instrucciones:   instrCons,
        floorfy_url:     data.floorfy_url,
        portalUrl,
        showPortalLink:  false,
      })

      const ccPartners = partnerEmails.filter(e => !data.constructorEmails.includes(e))
      const r = await sendEmail({
        to:          data.constructorEmails,
        cc:          ccPartners.length ? ccPartners : undefined,
        subject,
        html:        wrapEmail(bodyHtml),
        attachments: constructorPdfBuffer ? [{ filename: pdfFilename, content: constructorPdfBuffer }] : undefined,
      })
      if (r.error) return { error: r.error }
    }

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

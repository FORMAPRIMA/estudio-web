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
  floorfy_url: string | null
  visible_cliente: boolean
  proyecto_nombre: string
  proyecto_codigo: string | null
  proyecto_direccion: string | null
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

    return { equipo, clientes, proveedores }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── crearActaVisita ───────────────────────────────────────────────────────────

export async function crearActaVisita(
  data: CrearActaInput
): Promise<{ id: string; acta_url: string; floorfy_url: string | null } | { error: string }> {
  try {
    await requireAnyFP()
    const admin = createAdminClient()

    // 1 — Dynamic import of renderer (the PDF builder receives the modules directly
    //     so @react-pdf/renderer is never statically bundled into this action)
    const reactPdf = await import('@react-pdf/renderer')
    const { buildActaVisitaObraElement } = await import('@/components/pdfs/ActaVisitaObraPDF')

    // 2 — Generate PDF
    const actaData = {
      proyecto_nombre:    data.proyecto_nombre,
      proyecto_codigo:    data.proyecto_codigo,
      proyecto_direccion: data.proyecto_direccion,
      fecha:              data.fecha,
      asistentes:         data.asistentes,
      estado_obras:       data.estado_obras,
      instrucciones:      data.instrucciones,
      floorfy_url:        data.floorfy_url,
    }

    const pdfElement = buildActaVisitaObraElement(reactPdf, actaData)
    const pdfBuffer = await reactPdf.renderToBuffer(
      pdfElement as unknown as Parameters<typeof reactPdf.renderToBuffer>[0]
    )

    // 3 — Upload PDF to storage
    const storagePath = `${data.proyecto_id}/actas/${data.fecha}-acta-${Date.now()}.pdf`
    const { error: uploadError } = await admin.storage
      .from('portal')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) return { error: `Error al subir el PDF: ${uploadError.message}` }

    // 4 — Get public URL
    const acta_url = admin.storage.from('portal').getPublicUrl(storagePath).data.publicUrl

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
        proyecto_id:     data.proyecto_id,
        fecha:           data.fecha,
        titulo:          data.titulo,
        asistentes:      asistenteStr || null,
        notas:           notas || null,
        acta_url,
        floorfy_url:     data.floorfy_url || null,
        visible_cliente: data.visible_cliente,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }

    // 8 — Revalidate
    revalidatePath(PATH_INTERNA)

    return { id: row.id as string, acta_url, floorfy_url: data.floorfy_url || null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── compartirActaPorEmail ─────────────────────────────────────────────────────

export interface CompartirActaInput {
  emails: string[]
  clienteNombres: string[]
  proyecto_id: string
  proyecto_nombre: string
  proyecto_codigo: string | null
  fecha: string
  titulo: string
  acta_url: string
  asistentes: string | null
  estado_obras: string
  instrucciones: string
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

export async function compartirActaPorEmail(
  data: CompartirActaInput
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAnyFP()

    if (!data.emails.length) return { success: true } // nothing to send

    // 1 — Download PDF from storage
    const pdfRes = await fetch(data.acta_url)
    if (!pdfRes.ok) return { error: `No se pudo descargar el PDF: ${pdfRes.status}` }
    const pdfArrayBuffer = await pdfRes.arrayBuffer()
    const pdfBuffer = Buffer.from(pdfArrayBuffer)

    // 2 — Build email HTML
    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.formaprima.es'}/portal/${data.proyecto_id}`
    const fechaFmt = fmtDateEs(data.fecha)

    const nombres = data.clienteNombres.filter(Boolean)
    const saludoNombre = nombres.length > 1
      ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]
      : nombres[0] ?? null

    const bodyHtml = `
      ${saludoNombre ? `<p style="margin:0 0 20px;font-size:20px;font-weight:300;color:#1A1A1A;line-height:1.3;">Estimado/a ${saludoNombre},</p>` : ''}
      <p style="margin:0 0 6px;font-size:11px;color:#888;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">
        Nueva acta de visita de obra
      </p>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:300;color:#1A1A1A;letter-spacing:-0.01em;">
        ${data.proyecto_nombre}${data.proyecto_codigo ? ` <span style="font-size:13px;color:#AAA;font-weight:400;">${data.proyecto_codigo}</span>` : ''}
      </h2>

      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;border:1px solid #E8E6E0;">
        <tr>
          <td style="padding:12px 16px;background:#F8F7F4;border-bottom:1px solid #E8E6E0;">
            <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Fecha de visita</p>
            <p style="margin:4px 0 0;font-size:13px;color:#1A1A1A;font-weight:400;">${fechaFmt}</p>
          </td>
        </tr>
        ${data.asistentes ? `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E8E6E0;">
            <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Asistentes</p>
            <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;">${data.asistentes}</p>
          </td>
        </tr>` : ''}
        ${data.estado_obras ? `<tr>
          <td style="padding:12px 16px;${data.instrucciones || data.floorfy_url ? 'border-bottom:1px solid #E8E6E0;' : ''}">
            <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Estado de obras</p>
            <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${data.estado_obras}</p>
          </td>
        </tr>` : ''}
        ${data.instrucciones ? `<tr>
          <td style="padding:12px 16px;${data.floorfy_url ? 'border-bottom:1px solid #E8E6E0;' : ''}">
            <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Instrucciones</p>
            <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${data.instrucciones}</p>
          </td>
        </tr>` : ''}
        ${data.floorfy_url ? `<tr>
          <td style="padding:12px 16px;">
            <p style="margin:0;font-size:9px;color:#AAA;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Tour virtual</p>
            <p style="margin:4px 0 0;font-size:12px;"><a href="${data.floorfy_url}" style="color:#D85A30;text-decoration:none;">${data.floorfy_url}</a></p>
          </td>
        </tr>` : ''}
      </table>

      <p style="margin:0 0 24px;font-size:12px;color:#3A3A3A;line-height:1.7;">
        Adjuntamos el acta completa en PDF. También puede consultar el avance de su proyecto en el área privada de cliente.
      </p>

      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#1A1A1A;border-radius:4px;">
            <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#F0EDE8;text-decoration:none;">
              Ver mi proyecto →
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:11px;color:#AAAAAA;line-height:1.6;">
        Si tiene alguna pregunta sobre esta visita, no dude en responder a este correo.
      </p>
    `

    // 3 — Send email
    const result = await sendEmail({
      to:          data.emails,
      subject:     `FORMA PRIMA · Nueva visita de obra · ${data.proyecto_nombre}`,
      html:        wrapEmail(bodyHtml),
      attachments: [{
        filename: `Acta_visita_${data.fecha}_${data.proyecto_nombre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content:  pdfBuffer,
      }],
    })

    if (result.error) return { error: result.error }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

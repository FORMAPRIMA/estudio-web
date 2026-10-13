import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { resolverReceptorFactura } from '@/lib/finanzas/proveedorDestino'
import { getPartnersCC, repartirDestinatarios } from '@/lib/email/destinatarios'
import { assertSinClientesEnDestinatarios, ClienteEnDestinatariosError } from '@/lib/finanzas/guardCliente'

type Preparado =
  | { ok: false; res: NextResponse }
  | {
      ok: true
      factura: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      recipientName: string
      esPrivada: boolean
      to: string[]; cc: string[]; bcc: string[]
    }

/**
 * Todo lo que decide a quién va el recordatorio, en un solo sitio. Lo usan el GET
 * (el modal enseña la lista antes de enviar) y el POST (envía exactamente esa
 * lista), así que lo que se revisa es lo que llega a Resend.
 */
async function prepararRecordatorio(id: string): Promise<Preparado> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Sin sesión' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return { ok: false, res: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  const admin = createAdminClient()

  const { data: factura, error: facturaErr } = await admin
    .from('facturas_emitidas')
    .select(`
      id, numero_completo, fecha_emision, cliente_nombre, cliente_contacto,
      cliente_id, receptor_tipo, proveedor_id,
      proyecto_id, proyecto_nombre, seccion, factura_origen_id, total, base_imponible, tipo_iva, cuota_iva,
      condiciones_pago, iban, forma_pago,
      clientes(id, email, email_cc)
    `)
    .eq('id', id)
    .single()

  if (facturaErr || !factura) {
    return { ok: false, res: NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 }) }
  }

  // ── Guard CRÍTICO: una factura a proveedor JAMÁS recuerda el pago al cliente ─
  // Lo decide el destinatario, no solo la sección: un rappel de mobiliario vive
  // en una sección pública y aun así nunca puede salir hacia el cliente.
  const { esPrivada, proveedor: proveedorDestino } = await resolverReceptorFactura(admin, {
    seccion:         (factura.seccion as string | null) ?? null,
    proveedorId:     (factura.proveedor_id as string | null) ?? null,
    receptorTipo:    (factura.receptor_tipo as string | null) ?? null,
    facturaOrigenId: factura.factura_origen_id ?? null,
    proyectoId:      factura.proyecto_id ?? null,
  })
  if (esPrivada && !proveedorDestino?.email) {
    return { ok: false, res: NextResponse.json({ error: 'El proveedor de esta factura no tiene email registrado.' }, { status: 422 }) }
  }

  const cliente = (factura.clientes as unknown as { email: string | null; email_cc: string | null } | null)
  const toEmail = esPrivada ? proveedorDestino!.email : (cliente?.email ?? null)
  if (!toEmail) {
    return { ok: false, res: NextResponse.json({ error: 'El cliente no tiene email registrado.' }, { status: 400 }) }
  }
  const ccEmail = esPrivada ? proveedorDestino!.emailCc : (cliente?.email_cc ?? null)

  // Socios siempre en copia, como en el resto de correos de factura.
  const { to, cc, bcc } = repartirDestinatarios({
    to: [toEmail],
    cc: [ccEmail, ...(await getPartnersCC())],
  })

  // Red de seguridad (ver lib/finanzas/guardCliente.ts). Corre también en la vista
  // previa: si el envío se va a bloquear, el modal lo dice antes de pulsar.
  if (esPrivada) {
    try {
      await assertSinClientesEnDestinatarios(admin, { proyectoId: factura.proyecto_id ?? null, to, cc, bcc })
    } catch (guardErr) {
      if (guardErr instanceof ClienteEnDestinatariosError) {
        return { ok: false, res: NextResponse.json({ error: guardErr.message }, { status: 409 }) }
      }
      throw guardErr
    }
  }

  const recipientName = esPrivada
    ? proveedorDestino!.nombre
    : (factura.cliente_contacto || factura.cliente_nombre || 'Cliente')

  return { ok: true, factura, recipientName, esPrivada, to, cc, bcc }
}

/** Vista previa: a quién iría el recordatorio, sin enviar nada. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const p = await prepararRecordatorio(params.id)
    if (!p.ok) return p.res
    return NextResponse.json({ nombre: p.recipientName, esProveedor: p.esPrivada, to: p.to, cc: p.cc, bcc: p.bcc })
  } catch (err) {
    console.error('[facturas-emitidas/recordatorio GET]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado' }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const p = await prepararRecordatorio(params.id)
    if (!p.ok) return p.res
    const { factura, recipientName, to, cc, bcc } = p

    const projectLabel  = factura.proyecto_nombre
      ? ` para el proyecto <strong>${factura.proyecto_nombre}</strong>`
      : ''

    const fmtEuros = (n: number) =>
      new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

    const fmtDate = (iso: string) => {
      const [y, m, d] = iso.split('-')
      const meses = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre']
      return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`
    }

    const diasPendiente = Math.floor(
      (Date.now() - new Date(factura.fecha_emision).getTime()) / (1000 * 60 * 60 * 24)
    )

    const emailBody = `
      <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">
        Recordatorio de pago
      </h2>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Estimado/a ${recipientName},
      </p>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Nos ponemos en contacto para recordarle amablemente que tenemos
        pendiente el pago de la factura <strong>${factura.numero_completo}</strong>${projectLabel},
        emitida el ${fmtDate(factura.fecha_emision)} por un importe de
        <strong>${fmtEuros(factura.total)}</strong>.
      </p>
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Entendemos que pueden existir demoras administrativas y esperamos que
        todo esté en orden por su parte. Si ya ha realizado el pago, por favor
        ignore este mensaje.
      </p>
      ${factura.iban ? `
      <div style="background:#F8F7F4;border-left:3px solid #D85A30;padding:12px 16px;margin:0 0 20px;">
        <p style="font-size:11px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">
          Datos de pago
        </p>
        <p style="font-size:13px;color:#1A1A1A;margin:0;">
          ${factura.forma_pago ?? 'Transferencia bancaria'}<br/>
          <strong>IBAN:</strong> ${factura.iban}
        </p>
      </div>
      ` : ''}
      <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.6;">
        Si tiene cualquier duda o necesita que le reenvíemos la factura, no dude
        en contactarnos. Quedamos a su disposición.
      </p>
      <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">
        Atentamente,<br/>
        <strong>El equipo de Forma Prima</strong>
      </p>
    `

    const subject = `Recordatorio · Factura ${factura.numero_completo}${factura.proyecto_nombre ? ` · ${factura.proyecto_nombre}` : ''}`

    const result = await sendEmail({
      to,
      cc,
      ...(bcc.length && { bcc }),
      subject,
      html:    wrapEmail(emailBody),
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, diasPendiente })
  } catch (err) {
    console.error('[facturas-emitidas/recordatorio]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

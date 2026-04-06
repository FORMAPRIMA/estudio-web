import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Fetch factura + client email
    const { data: factura, error: facturaErr } = await admin
      .from('facturas_emitidas')
      .select(`
        id, numero_completo, fecha_emision, cliente_nombre, cliente_contacto,
        cliente_id, proyecto_nombre, total, base_imponible, tipo_iva, cuota_iva,
        condiciones_pago, iban, forma_pago,
        clientes(id, email, email_cc)
      `)
      .eq('id', params.id)
      .single()

    if (facturaErr || !factura) {
      return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 })
    }

    const cliente = (factura.clientes as unknown as { email: string | null; email_cc: string | null } | null)
    const toEmail = cliente?.email ?? null

    if (!toEmail) {
      return NextResponse.json({ error: 'El cliente no tiene email registrado.' }, { status: 400 })
    }

    const recipientName = factura.cliente_contacto || factura.cliente_nombre || 'Cliente'
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
      to:      toEmail,
      cc:      cliente?.email_cc ?? undefined,
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

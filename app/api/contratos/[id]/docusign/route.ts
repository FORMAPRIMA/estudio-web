import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { ContratoPDF } from '@/components/pdfs/ContratoPDF'
import type { ContratoPDFData, ServicioContrato, ContratoHonorario } from '@/components/pdfs/ContratoPDF'
import { createAndSendEnvelope } from '@/lib/docusign/client'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol, nombre').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()

    // ── Load contract ─────────────────────────────────────────────────────────
    const { data: contrato, error: contratoErr } = await admin
      .from('contratos')
      .select('*')
      .eq('id', params.id)
      .single()

    if (contratoErr || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
    }

    if (contrato.status === 'firmado') {
      return NextResponse.json({ error: 'El contrato ya está firmado.' }, { status: 400 })
    }

    if (!contrato.cliente_email) {
      return NextResponse.json(
        { error: 'El contrato no tiene email de cliente.' },
        { status: 400 }
      )
    }

    // ── Fetch EN translations ─────────────────────────────────────────────────
    const { data: plantillaRows } = await admin
      .from('propuestas_servicios_plantilla')
      .select('id, label_en, texto_en, entregables_en, semanas_default_en, pago_en, notas_en')

    const plantilla_en: NonNullable<ContratoPDFData['plantilla_en']> = {}
    for (const row of (plantillaRows ?? [])) {
      plantilla_en[row.id] = {
        label_en:           row.label_en,
        texto_en:           row.texto_en,
        entregables_en:     row.entregables_en,
        semanas_default_en: row.semanas_default_en,
        pago_en:            row.pago_en,
        notas_en:           row.notas_en,
      }
    }

    const serviciosContrato: ServicioContrato[] = (contrato.contenido?.servicios ?? []) as ServicioContrato[]
    const honorarios: ContratoHonorario[]       = (contrato.honorarios ?? []) as ContratoHonorario[]

    const pdfData: ContratoPDFData = {
      numero:             contrato.numero ?? '—',
      fecha_contrato:     contrato.fecha_contrato ?? null,
      tipo_cliente:       (contrato.contenido?.tipo_cliente ?? (contrato.cliente_empresa ? 'juridica' : 'fisica')) as 'fisica' | 'juridica',
      cliente_nombre:     contrato.cliente_nombre    ?? null,
      cliente_apellidos:  contrato.cliente_apellidos ?? null,
      cliente_empresa:    contrato.cliente_empresa   ?? null,
      cliente_nif:        contrato.cliente_nif       ?? null,
      cliente_direccion:  contrato.cliente_direccion ?? null,
      cliente_ciudad:     contrato.cliente_ciudad    ?? null,
      proyecto_nombre:    contrato.proyecto_nombre   ?? null,
      proyecto_direccion: contrato.proyecto_direccion ?? null,
      proyecto_tipo:      contrato.proyecto_tipo     ?? null,
      servicios_contrato: serviciosContrato,
      honorarios,
      notas:              contrato.notas ?? null,
      lang:               'es',
      plantilla_en,
      forDocuSign:        true,
    }

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const pdfBuffer = Buffer.from(
      await renderToBuffer(createElement(ContratoPDF, { data: pdfData }) as any)
    )

    // ── Build webhook URL ─────────────────────────────────────────────────────
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://internal.formaprima.es'
    const webhookUrl = `${appUrl}/api/webhooks/docusign`

    // ── Studio signer email comes from the logged-in partner user ─────────────
    const estudioEmail = user.email ?? 'contacto@formaprima.es'
    const estudioNombre = profile.nombre ?? 'Forma Prima'

    const clienteNombre = [contrato.cliente_nombre, contrato.cliente_apellidos]
      .filter(Boolean).join(' ') || 'Cliente'

    // ── Send to DocuSign ──────────────────────────────────────────────────────
    const { envelopeId } = await createAndSendEnvelope({
      contratoId: params.id,
      numero:     contrato.numero ?? params.id,
      pdfBuffer,
      signers: {
        cliente: { email: contrato.cliente_email, name: clienteNombre },
        estudio: { email: estudioEmail,           name: estudioNombre  },
      },
      webhookUrl,
    })

    // ── Persist envelope info ─────────────────────────────────────────────────
    await admin.from('contratos').update({
      docusign_envelope_id: envelopeId,
      docusign_status:      'sent',
      docusign_sent_at:     new Date().toISOString(),
      status:               contrato.status === 'borrador' ? 'enviado' : contrato.status,
    }).eq('id', params.id)

    return NextResponse.json({ ok: true, envelopeId })
  } catch (err) {
    console.error('[docusign/send]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

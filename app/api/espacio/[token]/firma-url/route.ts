/**
 * Embedded DocuSign signing URL for the client, served inside their Espacio.
 *
 * Flow:
 *   1. Authorise via the Espacio session cookie (same PIN-gated cookie as the rest
 *      of /api/espacio/[token]/*) or a logged-in team member (presentation/testing).
 *   2. Resolve the contract for this Espacio.
 *   3. If there is no envelope yet, render the contract PDF (with Gabriela's signature
 *      pre-printed) and create a SINGLE-signer embedded envelope for the client.
 *   4. Return a short-lived recipient-view URL to render in an iframe.
 *
 * The studio never signs digitally — its signature is pre-printed in the PDF.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEspacioCookieToken, espacioCookieName } from '@/lib/espacio/access'
import { createAndSendEnvelope, createRecipientView } from '@/lib/docusign/client'
import { ContratoPDF } from '@/components/pdfs/ContratoPDF'
import type { ContratoPDFData, ServicioContrato, ContratoHonorario } from '@/components/pdfs/ContratoPDF'
import { CLAUSULAS_DEFAULT, type ContratoClausula } from '@/lib/contratos/clausulas'

export const dynamic = 'force-dynamic'

async function isTeamMember(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    return ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'].includes(profile?.rol as string)
  } catch { return false }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { token } = params

    // ── Authorise ─────────────────────────────────────────────────────────────
    const cookie   = req.cookies.get(espacioCookieName(token))?.value
    const cookieOk = cookie === generateEspacioCookieToken(token)
    if (!cookieOk && !(await isTeamMember())) {
      return NextResponse.json({ error: 'Sin acceso.' }, { status: 401 })
    }

    const admin = createAdminClient()

    // ── Resolve Espacio → contrato ─────────────────────────────────────────────
    const { data: espacio } = await admin
      .from('espacios').select('lead_id, cliente_id').eq('token', token).single()
    if (!espacio) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })

    let contrato: Record<string, any> | null = null
    if (espacio.lead_id) {
      const { data } = await admin.from('contratos').select('*').eq('lead_id', espacio.lead_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      contrato = data
    }
    if (!contrato && espacio.cliente_id) {
      const { data } = await admin.from('contratos').select('*').eq('cliente_id', espacio.cliente_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      contrato = data
    }
    if (!contrato) return NextResponse.json({ error: 'No hay contrato.' }, { status: 404 })

    if (contrato.status === 'firmado' || contrato.docusign_status === 'completed') {
      return NextResponse.json({ error: 'El contrato ya está firmado.' }, { status: 400 })
    }

    const clienteNombre = [contrato.cliente_nombre, contrato.cliente_apellidos]
      .filter(Boolean).join(' ') || 'Cliente'
    const clienteEmail  = contrato.cliente_email || `cliente-${contrato.id}@formaprima.es`
    const clientUserId  = contrato.id as string

    const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'
    const returnUrl = `${siteUrl}/espacio/${token}?firma=ok`

    // ── Create the envelope on first use ───────────────────────────────────────
    let envelopeId: string | null = (contrato.docusign_envelope_id as string) ?? null

    if (!envelopeId) {
      // EN translations for the PDF
      const { data: plantillaRows } = await admin
        .from('propuestas_servicios_plantilla')
        .select('id, label_en, texto_en, entregables_en, semanas_default_en, pago_en, notas_en')
      const plantilla_en: NonNullable<ContratoPDFData['plantilla_en']> = {}
      for (const row of (plantillaRows ?? [])) {
        plantilla_en[row.id] = {
          label_en: row.label_en, texto_en: row.texto_en, entregables_en: row.entregables_en,
          semanas_default_en: row.semanas_default_en, pago_en: row.pago_en, notas_en: row.notas_en,
        }
      }

      const serviciosContrato: ServicioContrato[] = (contrato.contenido?.servicios ?? []) as ServicioContrato[]
      const honorarios: ContratoHonorario[]       = (contrato.honorarios ?? []) as ContratoHonorario[]

      // Congela el snapshot de cláusulas al crear el envelope (si aún no estaba persistido).
      const clausulasSnapshot = (contrato.contenido?.clausulas as ContratoClausula[] | undefined) ?? CLAUSULAS_DEFAULT
      if (!contrato.contenido?.clausulas) {
        await admin.from('contratos')
          .update({ contenido: { ...(contrato.contenido ?? {}), clausulas: clausulasSnapshot } })
          .eq('id', contrato.id)
      }

      const pdfData: ContratoPDFData = {
        numero:             contrato.numero ?? '—',
        fecha_contrato:     contrato.fecha_contrato ?? contrato.fecha_firma ?? null, // viva hasta la firma
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
        clausulas:          clausulasSnapshot,
        lang:               'es',
        plantilla_en,
        forDocuSign:        true,
      }

      const { renderToBuffer } = await import('@react-pdf/renderer')
      const pdfBuffer = Buffer.from(
        await renderToBuffer(createElement(ContratoPDF, { data: pdfData }) as any)
      )

      const result = await createAndSendEnvelope({
        contratoId:   contrato.id,
        numero:       contrato.numero ?? contrato.id,
        pdfBuffer,
        cliente:      { email: clienteEmail, name: clienteNombre },
        clientUserId,                                       // → embedded signing
        // El anchor de ContratoPDF está pegado a la línea de firma: la rúbrica se
        // estampa apoyada en la línea y la fecha pequeña a su derecha, encima.
        clienteTabOffsets: { signX: 14, signY: -38, dateX: 110, dateY: -12 },
        webhookUrl:   `${siteUrl}/api/webhooks/docusign`,
      })
      envelopeId = result.envelopeId

      await admin.from('contratos').update({
        docusign_envelope_id: envelopeId,
        docusign_status:      'sent',
        docusign_sent_at:     new Date().toISOString(),
        status:               contrato.status === 'borrador' ? 'enviado' : contrato.status,
      }).eq('id', contrato.id)
    }

    // ── Recipient view URL (short-lived, for the iframe) ───────────────────────
    const { url } = await createRecipientView({
      envelopeId:   envelopeId!,
      email:        clienteEmail,
      name:         clienteNombre,
      clientUserId,
      returnUrl,
    })

    return NextResponse.json({ ok: true, url })
  } catch (err) {
    console.error('[espacio/firma-url]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

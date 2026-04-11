/**
 * DocuSign Connect webhook handler
 *
 * Called by DocuSign when an envelope status changes (completed / declined / voided).
 * On "completed": downloads the signed PDF, uploads to Supabase Storage, calls firmarContratoAdmin.
 *
 * Optional security:
 *   DOCUSIGN_HMAC_KEY — set in DocuSign Connect config to verify webhook signatures
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { downloadCompletedDocument } from '@/lib/docusign/client'
import { firmarContratoAdmin } from '@/app/actions/contratos'
import crypto from 'node:crypto'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // ── Optional HMAC signature verification ─────────────────────────────────
    const hmacKey = process.env.DOCUSIGN_HMAC_KEY
    if (hmacKey) {
      const dsSignature = req.headers.get('x-docusign-signature-1')
      if (dsSignature) {
        const expected = crypto
          .createHmac('sha256', hmacKey)
          .update(rawBody)
          .digest('base64')
        if (expected !== dsSignature) {
          console.warn('[docusign/webhook] HMAC mismatch — ignoring request')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      }
    }

    // ── Parse event ───────────────────────────────────────────────────────────
    let event: any
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const envelopeId     = event?.data?.envelopeId    ?? event?.envelopeId
    const envelopeStatus = event?.data?.envelopeSummary?.status ?? event?.status

    if (!envelopeId) {
      return NextResponse.json({ ok: true })  // ignore unrecognised shapes
    }

    console.log(`[docusign/webhook] envelopeId=${envelopeId} status=${envelopeStatus}`)

    const admin = createAdminClient()

    // ── Look up contrato or fpe_contract by envelope ID ───────────────────────
    const [{ data: contrato }, { data: fpeContract }] = await Promise.all([
      admin.from('contratos').select('id, status, docusign_status').eq('docusign_envelope_id', envelopeId).maybeSingle(),
      admin.from('fpe_contracts').select('id, status').eq('docusign_envelope_id', envelopeId).maybeSingle(),
    ])

    if (!contrato && !fpeContract) {
      // Envelope not in our system — acknowledge anyway
      return NextResponse.json({ ok: true })
    }

    // ── Handle FPE contract ───────────────────────────────────────────────────
    if (fpeContract) {
      if (envelopeStatus === 'completed' && fpeContract.status !== 'signed') {
        try {
          const signedPdf   = await downloadCompletedDocument(envelopeId)
          const storagePath = `contracts/${fpeContract.id}/${envelopeId}-signed.pdf`
          await admin.storage
            .from('fpe-documents')
            .upload(storagePath, signedPdf, { contentType: 'application/pdf', upsert: true })

          // Fetch existing contenido_json so we can merge the signed path
          const { data: existing } = await admin
            .from('fpe_contracts')
            .select('contenido_json')
            .eq('id', fpeContract.id)
            .single()

          await admin.from('fpe_contracts').update({
            status:        'signed',
            signed_at:     new Date().toISOString(),
            contenido_json: { ...(existing?.contenido_json as object ?? {}), pdf_signed_path: storagePath },
          }).eq('id', fpeContract.id)
        } catch (err) {
          console.error('[docusign/webhook] fpe_contract complete error:', err)
        }
      } else if (envelopeStatus === 'declined' || envelopeStatus === 'voided') {
        await admin.from('fpe_contracts').update({ status: 'cancelled' }).eq('id', fpeContract.id)
      }
    }

    if (!contrato) {
      return NextResponse.json({ ok: true })
    }

    if (envelopeStatus === 'completed') {
      // Guard against duplicate webhook deliveries
      if (contrato.docusign_status === 'completed') {
        return NextResponse.json({ ok: true })
      }

      // ── Download signed PDF ───────────────────────────────────────────────
      let pdfFirmadoUrl: string | null = null
      try {
        const signedPdf = await downloadCompletedDocument(envelopeId)

        // Upload to Supabase Storage bucket "contratos-firmados"
        const fileName = `${contrato.id}/${envelopeId}-firmado.pdf`
        const { data: uploadData, error: uploadErr } = await admin.storage
          .from('contratos-firmados')
          .upload(fileName, signedPdf, {
            contentType: 'application/pdf',
            upsert:      true,
          })

        if (!uploadErr && uploadData) {
          const { data: urlData } = admin.storage
            .from('contratos-firmados')
            .getPublicUrl(fileName)
          pdfFirmadoUrl = urlData.publicUrl
        } else {
          console.error('[docusign/webhook] storage upload error:', uploadErr?.message)
        }
      } catch (dlErr) {
        console.error('[docusign/webhook] download error:', dlErr)
      }

      // ── Update docusign fields ────────────────────────────────────────────
      await admin.from('contratos').update({
        docusign_status:       'completed',
        docusign_completed_at: new Date().toISOString(),
        ...(pdfFirmadoUrl ? { pdf_firmado_url: pdfFirmadoUrl } : {}),
      }).eq('id', contrato.id)

      // ── Fire firmarContratoAdmin (creates project, client, billing) ────────
      if (contrato.status !== 'firmado') {
        const result = await firmarContratoAdmin(contrato.id)
        if ('error' in result) {
          console.error('[docusign/webhook] firmarContratoAdmin error:', result.error)
        }
      }

    } else if (envelopeStatus === 'declined' || envelopeStatus === 'voided') {
      await admin.from('contratos').update({
        docusign_status: envelopeStatus,
      }).eq('id', contrato.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[docusign/webhook]', err)
    // Return 200 so DocuSign doesn't keep retrying on our server errors
    return NextResponse.json({ ok: true })
  }
}

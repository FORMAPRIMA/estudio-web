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
import { finalizeContratoFirmado } from '@/lib/docusign/finalizeContrato'
import { applyClienteChangesForActa, cancelClienteChangesForActa } from '@/lib/fp-execution/obra-apply'
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

    // ── Look up contrato / fpe_contract / fpe_obra_acta by envelope ID ───────
    const [{ data: contrato }, { data: fpeContract }, { data: obraActa }] = await Promise.all([
      admin.from('contratos').select('id, status, docusign_status').eq('docusign_envelope_id', envelopeId).maybeSingle(),
      admin.from('fpe_contracts').select('id, status').eq('docusign_envelope_id', envelopeId).maybeSingle(),
      admin.from('fpe_obra_actas').select('id, status, project_id').eq('docusign_envelope_id', envelopeId).maybeSingle(),
    ])

    if (!contrato && !fpeContract && !obraActa) {
      // Envelope not in our system — acknowledge anyway
      return NextResponse.json({ ok: true })
    }

    // ── Handle obra acta cliente ──────────────────────────────────────────────
    if (obraActa) {
      if (envelopeStatus === 'completed' && obraActa.status !== 'signed' && obraActa.status !== 'received') {
        await admin.from('fpe_obra_actas').update({
          status:    'signed',
          signed_at: new Date().toISOString(),
        }).eq('id', obraActa.id)

        // Aplicar al presupuesto vivo los cambios cliente pendientes de esta acta.
        const applyRes = await applyClienteChangesForActa(obraActa.id)
        if ('error' in applyRes) {
          console.error('[docusign/webhook] obra acta apply changes error:', applyRes.error)
        } else {
          console.log(`[docusign/webhook] applied ${applyRes.applied} cliente changes for acta ${obraActa.id}`)
        }

        try {
          const signedPdf   = await downloadCompletedDocument(envelopeId)
          const storagePath = `obra-actas/${obraActa.project_id}/${obraActa.id}-${envelopeId}-signed.pdf`
          const { error: upErr } = await admin.storage
            .from('fpe-documents')
            .upload(storagePath, signedPdf, { contentType: 'application/pdf', upsert: true })

          if (upErr) {
            console.error('[docusign/webhook] obra acta storage upload error:', upErr.message)
          } else {
            await admin.from('fpe_obra_actas').update({
              status:          'received',
              pdf_signed_path: storagePath,
            }).eq('id', obraActa.id)
          }
        } catch (err) {
          console.error('[docusign/webhook] obra acta pdf download error:', err)
        }
      } else if (envelopeStatus === 'declined' || envelopeStatus === 'voided') {
        await admin.from('fpe_obra_actas').update({
          status:        'anulada',
          anulada_at:    new Date().toISOString(),
          anulada_razon: `DocuSign ${envelopeStatus}`,
        }).eq('id', obraActa.id)

        // Cancelar (no aplicar nunca) los cambios cliente pendientes asociados.
        const cancelRes = await cancelClienteChangesForActa(obraActa.id)
        if ('error' in cancelRes) {
          console.error('[docusign/webhook] obra acta cancel changes error:', cancelRes.error)
        } else {
          console.log(`[docusign/webhook] cancelled ${cancelRes.cancelled} cliente changes for acta ${obraActa.id}`)
        }
      }
    }

    // ── Handle FPE contract ───────────────────────────────────────────────────
    if (fpeContract) {
      if (envelopeStatus === 'completed' && fpeContract.status !== 'signed' && fpeContract.status !== 'received') {
        // Paso 1: marcar como 'signed' inmediatamente. Si la descarga del PDF
        // falla podemos reintentar más tarde sin perder el hecho de que DocuSign
        // ya cerró el envelope.
        await admin.from('fpe_contracts').update({
          status:    'signed',
          signed_at: new Date().toISOString(),
        }).eq('id', fpeContract.id)

        // Paso 2: descargar PDF firmado y subirlo a Storage. Si esto termina
        // bien, avanzar el estado a 'received'.
        try {
          const signedPdf   = await downloadCompletedDocument(envelopeId)
          const storagePath = `contracts/${fpeContract.id}/${envelopeId}-signed.pdf`
          const { error: upErr } = await admin.storage
            .from('fpe-documents')
            .upload(storagePath, signedPdf, { contentType: 'application/pdf', upsert: true })

          if (upErr) {
            console.error('[docusign/webhook] fpe storage upload error:', upErr.message)
          } else {
            const { data: existing } = await admin
              .from('fpe_contracts')
              .select('contenido_json')
              .eq('id', fpeContract.id)
              .single()

            await admin.from('fpe_contracts').update({
              status:         'received',
              contenido_json: { ...(existing?.contenido_json as object ?? {}), pdf_signed_path: storagePath },
            }).eq('id', fpeContract.id)
          }
        } catch (err) {
          console.error('[docusign/webhook] fpe_contract pdf download error:', err)
        }
      } else if (envelopeStatus === 'declined' || envelopeStatus === 'voided') {
        await admin.from('fpe_contracts').update({ status: 'cancelled' }).eq('id', fpeContract.id)
      }
    }

    if (!contrato) {
      return NextResponse.json({ ok: true })
    }

    if (envelopeStatus === 'completed') {
      const result = await finalizeContratoFirmado(
        contrato as { id: string; status: string | null; docusign_status: string | null },
        envelopeId,
      )
      if ('error' in result) {
        console.error('[docusign/webhook] finalize error:', result.error)
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

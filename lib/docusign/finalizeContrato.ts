// Cierre de un contrato cuyo envelope DocuSign está "completed": descarga el PDF
// firmado, lo archiva en Storage y dispara firmarContratoAdmin (proyecto, cliente,
// facturación, lead ganado, Espacio). Lo usan DOS caminos que pueden llegar en
// cualquier orden: el webhook de DocuSign y la confirmación inmediata al volver de
// la firma embebida — por eso es idempotente (guard por docusign_status/status).
import { createAdminClient } from '@/lib/supabase/admin'
import { downloadCompletedDocument } from '@/lib/docusign/client'
import { firmarContratoAdmin } from '@/app/actions/contratos'

export async function finalizeContratoFirmado(
  contrato: { id: string; status: string | null; docusign_status: string | null },
  envelopeId: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient()

  // Guard contra entregas duplicadas (webhook + confirmación embebida)
  if (contrato.docusign_status === 'completed' && contrato.status === 'firmado') {
    return { ok: true }
  }

  // ── Descargar y archivar el PDF firmado ─────────────────────────────────────
  let pdfFirmadoUrl: string | null = null
  try {
    const signedPdf = await downloadCompletedDocument(envelopeId)

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
      console.error('[docusign/finalize] storage upload error:', uploadErr?.message)
    }
  } catch (dlErr) {
    console.error('[docusign/finalize] download error:', dlErr)
  }

  // ── Actualizar campos DocuSign ──────────────────────────────────────────────
  await admin.from('contratos').update({
    docusign_status:       'completed',
    docusign_completed_at: new Date().toISOString(),
    ...(pdfFirmadoUrl ? { pdf_firmado_url: pdfFirmadoUrl } : {}),
  }).eq('id', contrato.id)

  // ── firmarContratoAdmin (crea proyecto, cliente, facturación) ───────────────
  if (contrato.status !== 'firmado') {
    const result = await firmarContratoAdmin(contrato.id)
    if ('error' in result) {
      console.error('[docusign/finalize] firmarContratoAdmin error:', result.error)
      return { error: result.error }
    }
  }

  return { ok: true }
}

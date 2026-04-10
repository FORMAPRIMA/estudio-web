/**
 * DocuSign eSignature API — envelope creation and document retrieval
 *
 * Required env vars:
 *   DOCUSIGN_ACCOUNT_ID  — numeric or GUID account ID (DocuSign Admin › Account › API & Keys)
 *   DOCUSIGN_BASE_URL    — e.g. https://demo.docusign.net (demo) / https://na4.docusign.net (prod EU)
 */
import { getDocuSignToken } from './auth'

const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID!
const BASE_URL   = process.env.DOCUSIGN_BASE_URL ?? 'https://demo.docusign.net'

export interface DocuSignSigner {
  email: string
  name:  string
}

export interface CreateEnvelopeOptions {
  contratoId:  string
  numero:      string
  pdfBuffer:   Buffer
  signers: {
    cliente: DocuSignSigner
    estudio: DocuSignSigner
  }
  webhookUrl:  string
}

/**
 * Creates and immediately sends a DocuSign envelope with two signers.
 * Signature positions are located via invisible anchor strings embedded in the PDF:
 *   «FP_FIRMA_CLIENTE» — client signature area
 *   «FP_FIRMA_ESTUDIO» — studio signature area
 */
export async function createAndSendEnvelope(
  opts: CreateEnvelopeOptions
): Promise<{ envelopeId: string }> {
  if (!ACCOUNT_ID) throw new Error('DOCUSIGN_ACCOUNT_ID env var not set')

  const token = await getDocuSignToken()

  const body = {
    emailSubject: `Contrato de servicios ${opts.numero} — Forma Prima`,
    documents: [{
      documentBase64: opts.pdfBuffer.toString('base64'),
      name:           `Contrato-${opts.numero}.pdf`,
      fileExtension:  'pdf',
      documentId:     '1',
    }],
    recipients: {
      signers: [
        {
          email:        opts.signers.cliente.email,
          name:         opts.signers.cliente.name,
          recipientId:  '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [{
              anchorString:             '«FP_FIRMA_CLIENTE»',
              anchorXOffset:            '0',
              anchorYOffset:            '-32',
              anchorUnits:              'pixels',
              anchorIgnoreIfNotPresent: 'false',
            }],
            dateSignedTabs: [{
              anchorString:  '«FP_FIRMA_CLIENTE»',
              anchorXOffset: '130',
              anchorYOffset: '-16',
              anchorUnits:   'pixels',
            }],
          },
        },
        {
          email:        opts.signers.estudio.email,
          name:         opts.signers.estudio.name,
          recipientId:  '2',
          routingOrder: '1',   // parallel signing — both sign simultaneously
          tabs: {
            signHereTabs: [{
              anchorString:             '«FP_FIRMA_ESTUDIO»',
              anchorXOffset:            '0',
              anchorYOffset:            '-32',
              anchorUnits:              'pixels',
              anchorIgnoreIfNotPresent: 'false',
            }],
            dateSignedTabs: [{
              anchorString:  '«FP_FIRMA_ESTUDIO»',
              anchorXOffset: '130',
              anchorYOffset: '-16',
              anchorUnits:   'pixels',
            }],
          },
        },
      ],
    },
    // Per-envelope webhook — no DocuSign admin config needed
    eventNotification: {
      url:                              opts.webhookUrl,
      loggingEnabled:                   'true',
      requireAcknowledgment:            'true',
      useSoapInterface:                 'false',
      includeCertificateWithSoap:       'false',
      signMessageWithX509Cert:          'false',
      includeDocuments:                 'true',
      includeEnvelopeVoidReason:        'true',
      includeTimeZone:                  'true',
      includeSenderAccountAsCustomField:'true',
      includeDocumentFields:            'true',
      includeCertificateOfCompletion:   'true',
      envelopeEvents: [
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined'  },
        { envelopeEventStatusCode: 'voided'    },
      ],
    },
    status: 'sent',
  }

  const res = await fetch(`${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSign envelope error (${res.status}): ${text}`)
  }

  const data = await res.json() as { envelopeId: string }
  return { envelopeId: data.envelopeId }
}

/** Downloads the combined signed PDF once an envelope is completed */
export async function downloadCompletedDocument(envelopeId: string): Promise<Buffer> {
  const token = await getDocuSignToken()

  const res = await fetch(
    `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes/${envelopeId}/documents/combined`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSign download error (${res.status}): ${text}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

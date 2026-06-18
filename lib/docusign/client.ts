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
  /** Primary signer. For Forma Prima service contracts the studio signs by pre-printed
   *  image, so the client is the ONLY digital signer. */
  cliente: DocuSignSigner
  /**
   * Optional second signer at the «FP_FIRMA_ESTUDIO» anchor. Used by flows that DO
   * need a second digital signature (e.g. FP Execution work orders). Omit it for the
   * service contract flow where the studio signature is pre-printed.
   */
  estudio?: DocuSignSigner
  /**
   * If set, the client signs EMBEDDED (no email): we then request a recipient view
   * URL with this same clientUserId. If omitted, the client signs REMOTELY via email.
   */
  clientUserId?: string
  /**
   * Offsets (px) of the client tabs relative to the «FP_FIRMA_CLIENTE» anchor.
   * Defaults match the legacy PDFs (FPE / actas) whose anchor sits ABOVE the block.
   * ContratoPDF anchors AT the signature line, so its routes pass their own values.
   */
  clienteTabOffsets?: { signX: number; signY: number; dateX: number; dateY: number }
  webhookUrl:  string
  /** Optional override for the envelope email subject and document filename. */
  emailSubject?: string
  documentName?: string
}

/**
 * Creates and immediately sends a DocuSign envelope with a SINGLE signer (the client).
 * The studio's signature is already pre-printed in the PDF (Gabriela's image), so the
 * studio is not a digital recipient.
 *
 * The client signature position is located via an invisible anchor string in the PDF:
 *   «FP_FIRMA_CLIENTE» — client signature area
 *
 * When `clientUserId` is provided the recipient is set up for embedded signing
 * (captive recipient) and no email is sent to them.
 */
export async function createAndSendEnvelope(
  opts: CreateEnvelopeOptions
): Promise<{ envelopeId: string }> {
  if (!ACCOUNT_ID) throw new Error('DOCUSIGN_ACCOUNT_ID env var not set')

  const token = await getDocuSignToken()

  const tabOff = opts.clienteTabOffsets ?? { signX: 0, signY: -32, dateX: 130, dateY: -16 }

  const body = {
    emailSubject: opts.emailSubject ?? `Contrato de servicios ${opts.numero} — Forma Prima`,
    documents: [{
      documentBase64: opts.pdfBuffer.toString('base64'),
      name:           `${opts.documentName ?? `Contrato-${opts.numero}`}.pdf`,
      fileExtension:  'pdf',
      documentId:     '1',
    }],
    recipients: {
      signers: [
        {
          email:        opts.cliente.email,
          name:         opts.cliente.name,
          recipientId:  '1',
          routingOrder: '1',
          // clientUserId presente → firmante embebido (captive); ausente → firma por email
          ...(opts.clientUserId ? { clientUserId: opts.clientUserId } : {}),
          tabs: {
            signHereTabs: [{
              anchorString:             '«FP_FIRMA_CLIENTE»',
              anchorXOffset:            String(tabOff.signX),
              anchorYOffset:            String(tabOff.signY),
              anchorUnits:              'pixels',
              anchorIgnoreIfNotPresent: 'false',
            }],
            dateSignedTabs: [{
              anchorString:  '«FP_FIRMA_CLIENTE»',
              anchorXOffset: String(tabOff.dateX),
              anchorYOffset: String(tabOff.dateY),
              anchorUnits:   'pixels',
            }],
          },
        },
        // Optional second signer (e.g. FP Execution work orders). Omitted for the
        // service-contract flow where the studio signature is pre-printed.
        ...(opts.estudio ? [{
          email:        opts.estudio.email,
          name:         opts.estudio.name,
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
        }] : []),
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

export interface RecipientViewOptions {
  envelopeId:   string
  /** Must match exactly the email/name/clientUserId used when creating the envelope. */
  email:        string
  name:         string
  clientUserId: string
  /** URL DocuSign redirects to after signing (with ?event=signing_complete appended). */
  returnUrl:    string
}

/**
 * Returns a short-lived URL (valid a few minutes) that renders the DocuSign signing
 * ceremony for an embedded (captive) recipient. Load it inside an iframe so the client
 * signs without leaving our app.
 */
export async function createRecipientView(
  opts: RecipientViewOptions
): Promise<{ url: string }> {
  if (!ACCOUNT_ID) throw new Error('DOCUSIGN_ACCOUNT_ID env var not set')

  const token = await getDocuSignToken()

  const res = await fetch(
    `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes/${opts.envelopeId}/views/recipient`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        returnUrl:            opts.returnUrl,
        authenticationMethod: 'none',
        email:                opts.email,
        userName:             opts.name,
        clientUserId:         opts.clientUserId,
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSign recipient view error (${res.status}): ${text}`)
  }

  const data = await res.json() as { url: string }
  return { url: data.url }
}

/** Estado actual de un envelope ("sent", "completed", "declined", "voided"…). */
export async function getEnvelopeStatus(envelopeId: string): Promise<string> {
  const token = await getDocuSignToken()

  const res = await fetch(
    `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes/${envelopeId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSign envelope status error (${res.status}): ${text}`)
  }

  const data = await res.json() as { status: string }
  return data.status
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

/**
 * DocuSign JWT Grant authentication using node:crypto (no extra packages)
 *
 * Required env vars:
 *   DOCUSIGN_INTEGRATION_KEY  — OAuth app client ID (from DocuSign Admin › Apps & Keys)
 *   DOCUSIGN_USER_ID          — Impersonated user GUID (from DocuSign Admin › Users)
 *   DOCUSIGN_RSA_PRIVATE_KEY  — base64-encoded RSA private key  ← PENDING: obtain from DocuSign Admin
 *
 * Optional:
 *   DOCUSIGN_OAUTH_BASE_URL   — default: account-d.docusign.com (demo)
 *                               prod:    account.docusign.com
 */
import crypto from 'node:crypto'

const OAUTH_BASE = process.env.DOCUSIGN_OAUTH_BASE_URL ?? 'account-d.docusign.com'

let cachedToken: { access_token: string; expires_at: number } | null = null

function buildJwt(): string {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY
  const userId         = process.env.DOCUSIGN_USER_ID
  const privateKeyB64  = process.env.DOCUSIGN_RSA_PRIVATE_KEY

  if (!integrationKey || !userId || !privateKeyB64) {
    throw new Error(
      'DocuSign env vars not set: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_RSA_PRIVATE_KEY'
    )
  }

  // Key may be stored as base64 or as raw PEM — handle both
  const privateKey = privateKeyB64.includes('-----BEGIN')
    ? privateKeyB64
    : Buffer.from(privateKeyB64, 'base64').toString('utf8')

  const now = Math.floor(Date.now() / 1000)

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss:   integrationKey,
    sub:   userId,
    aud:   OAUTH_BASE,
    iat:   now,
    exp:   now + 3600,
    scope: 'signature impersonation',
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(privateKey, 'base64url')

  return `${signingInput}.${signature}`
}

export async function getDocuSignToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Math.floor(Date.now() / 1000) + 60) {
    return cachedToken.access_token
  }

  const jwt = buildJwt()

  const res = await fetch(`https://${OAUTH_BASE}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSign token error (${res.status}): ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    access_token: data.access_token,
    expires_at:   Math.floor(Date.now() / 1000) + data.expires_in,
  }
  return cachedToken.access_token
}

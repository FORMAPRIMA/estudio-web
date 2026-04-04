import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'

const LOGO_BASE64 = (() => {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})()

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'FORMA PRIMA Assistant <contacto@formaprima.es>'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to:       string | string[]
  subject:  string
  html:     string
  /** CC opcional */
  cc?:      string | string[]
  /** BCC opcional */
  bcc?:     string | string[]
  /** Adjuntos opcionales */
  attachments?: {
    filename: string
    content:  Buffer | string  // Buffer para binarios (PDF), string base64 también válido
  }[]
  /** Reply-to opcional (ej: email del partner que envía la factura) */
  replyTo?: string
}

export interface SendEmailResult {
  id:    string
  error: null
}

export interface SendEmailError {
  id:    null
  error: string
}

// ── Core send ─────────────────────────────────────────────────────────────────

export async function sendEmail(
  opts: SendEmailOptions
): Promise<SendEmailResult | SendEmailError> {
  try {
    const { data, error } = await resend.emails.send({
      from:        FROM,
      to:          Array.isArray(opts.to) ? opts.to : [opts.to],
      subject:     opts.subject,
      html:        opts.html,
      ...(opts.cc        && { cc:        Array.isArray(opts.cc)  ? opts.cc  : [opts.cc]  }),
      ...(opts.bcc       && { bcc:       Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc] }),
      ...(opts.replyTo   && { reply_to:  opts.replyTo }),
      ...(opts.attachments && {
        attachments: opts.attachments.map(a => ({
          filename: a.filename,
          content:  a.content,
        })),
      }),
    })

    if (error) return { id: null, error: error.message }
    return { id: data!.id, error: null }
  } catch (err) {
    return { id: null, error: err instanceof Error ? err.message : 'Error al enviar email.' }
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
// Plantilla base minimalista con la identidad de Forma Prima.
// Los usos concretos (factura, notificación, etc.) construyen el <body> y lo
// pasan a wrapEmail para tener siempre el mismo header/footer.

export function wrapEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Forma Prima</title>
</head>
<body style="margin:0;padding:0;background:#F8F7F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1A1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7F4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E8E6E0;">

          <!-- Header -->
          <tr>
            <td style="background:#1A1A1A;padding:28px 40px 0;">
              ${LOGO_BASE64
                ? `<img src="${LOGO_BASE64}" alt="Forma Prima" width="140" style="display:block;margin:0 0 10px;border:0;outline:none;" />`
                : `<p style="margin:0 0 10px;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F0EDE8;">Forma Prima</p>`
              }
              <p style="margin:0 0 0;font-size:11px;color:#888580;font-style:italic;">
                Taller de arquitectura y diseño
              </p>
              <div style="margin-top:18px;height:2px;background:#D85A30;opacity:0.6;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #F0EEE8;">
              <p style="margin:0;font-size:11px;color:#AAAAAA;line-height:1.6;">
                GEINEX GROUP, S.L. &nbsp;·&nbsp; NIF B44873552<br/>
                CL/ Ppe de Vergara 56 6ª 2ª &nbsp;·&nbsp; 28006 Madrid<br/>
                <a href="mailto:contacto@formaprima.es" style="color:#D85A30;text-decoration:none;">contacto@formaprima.es</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

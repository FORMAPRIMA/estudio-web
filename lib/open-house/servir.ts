// Sirve una plantilla del Open House (invitación o postal) con su runtime y,
// en <head>, el estado que antes vivía en localStorage (window.__OH).

const PUBLICO = '/open-house/cc38/'

export function documento(plantilla: string, oh: { modo: 'invitado' | 'admin'; token: string; datos: unknown; endpoint: string }): string {
  // JSON dentro de <script>: sin "<" literal, que podría cerrar la etiqueta.
  const json = JSON.stringify(oh).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return plantilla.replace(/<head>/i, `<head>
<base href="${PUBLICO}">
<meta name="robots" content="noindex, nofollow">
<script>window.__OH = ${json};</script>`)
}

export function respuestaHtml(html: string): Response {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

/** El runtime vuelve a pedir la página con fetch() para leer la plantilla en crudo: no necesita datos. */
export const esRelecturaDelRuntime = (req: Request) => req.headers.get('sec-fetch-dest') === 'empty'

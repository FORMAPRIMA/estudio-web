// Utilidades de servidor para leer una ficha de producto desde su URL.
// Solo se importa desde API routes (usa dns/promises).

import { lookup } from 'dns/promises'

export const MAX_HTML_BYTES = 1_500_000
export const MAX_IMAGE_BYTES = 8_000_000
export const FETCH_TIMEOUT_MS = 20_000

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/125.0 Safari/537.36'

// ── Guardas anti-SSRF ─────────────────────────────────────────────────────────

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => Number.isNaN(n))) return true
  const [a, b] = p
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true            // link-local (metadata cloud)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true  // CGNAT
  if (a >= 224) return true                          // multicast / reservado
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const low = ip.toLowerCase()
  if (low === '::1' || low === '::') return true
  if (low.startsWith('fc') || low.startsWith('fd')) return true  // ULA
  if (low.startsWith('fe80')) return true                        // link-local
  if (low.startsWith('::ffff:')) return isPrivateIpv4(low.replace('::ffff:', ''))
  return false
}

/**
 * Valida que la URL sea pública y navegable. Sin esto, pegar
 * `http://169.254.169.254/...` convertiría el endpoint en un proxy hacia la
 * red interna del servidor.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('La URL no es válida.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Solo se admiten URLs http o https.')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('Esa dirección no es pública.')
  }

  let direcciones: { address: string; family: number }[]
  try {
    direcciones = await lookup(host, { all: true })
  } catch {
    throw new Error('No se pudo resolver el dominio.')
  }
  for (const { address, family } of direcciones) {
    const privada = family === 6 ? isPrivateIpv6(address) : isPrivateIpv4(address)
    if (privada) throw new Error('Esa dirección no es pública.')
  }
  return url
}

// ── Descarga ──────────────────────────────────────────────────────────────────

export async function fetchHtml(url: URL): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`La web respondió ${res.status}.`)
  const tipo = res.headers.get('content-type') ?? ''
  if (!tipo.includes('html') && !tipo.includes('xml') && tipo !== '') {
    throw new Error(`La URL no devuelve HTML (${tipo}).`)
  }
  const texto = await res.text()
  return { html: texto.slice(0, MAX_HTML_BYTES), finalUrl: res.url || url.toString() }
}

export async function fetchImagen(url: URL): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`La imagen respondió ${res.status}.`)
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!contentType.startsWith('image/')) throw new Error(`Ese archivo no es una imagen (${contentType || 'sin tipo'}).`)
  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error('La imagen pesa más de 8 MB.')
  return { bytes: new Uint8Array(buf), contentType }
}

// ── Parseo del HTML ───────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&(?:euro|#8364);/gi, '€')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function metaContent(html: string, patrones: RegExp[]): string | null {
  for (const re of patrones) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1]).trim() || null
  }
  return null
}

function metaPor(html: string, clave: string): string | null {
  const esc = clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return metaContent(html, [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'),
  ])
}

/** Objetos schema.org relevantes (Product y su Offer) del JSON-LD. */
function extraerJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const cola = Array.isArray(parsed) ? [...parsed] : [parsed]
      while (cola.length > 0) {
        const nodo = cola.shift()
        if (!nodo || typeof nodo !== 'object') continue
        const obj = nodo as Record<string, unknown>
        if (Array.isArray(obj['@graph'])) cola.push(...(obj['@graph'] as unknown[]))
        const tipo = String(obj['@type'] ?? '').toLowerCase()
        if (tipo.includes('product') || tipo.includes('offer')) out.push(obj)
        if (out.length >= 6) break
      }
    } catch {
      // JSON-LD roto: seguimos con el resto de señales
    }
  }
  return out
}

function absolutizar(src: string, base: string): string | null {
  try {
    const u = new URL(src, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function recogerImagenes(html: string, base: string): string[] {
  const urls: string[] = []
  const push = (raw?: string | null) => {
    if (!raw) return
    const limpio = raw.trim().split(/\s+/)[0]
    if (!limpio || limpio.startsWith('data:')) return
    const abs = absolutizar(limpio, base)
    if (!abs) return
    if (/\.svg(\?|$)/i.test(abs)) return
    if (/sprite|placeholder|1x1|pixel|logo|icon|favicon/i.test(abs)) return
    if (!urls.includes(abs)) urls.push(abs)
  }

  push(metaPor(html, 'og:image'))
  push(metaPor(html, 'og:image:secure_url'))
  push(metaPor(html, 'twitter:image'))

  for (const nodo of extraerJsonLd(html)) {
    const img = nodo.image
    if (typeof img === 'string') push(img)
    else if (Array.isArray(img)) img.forEach(i => push(typeof i === 'string' ? i : (i as Record<string, string>)?.url))
    else if (img && typeof img === 'object') push((img as Record<string, string>).url)
  }

  // srcset: nos quedamos con el candidato de mayor anchura declarada
  const srcsetRe = /<(?:img|source)[^>]+srcset=["']([^"']+)["']/gi
  let ss: RegExpExecArray | null
  while ((ss = srcsetRe.exec(html)) !== null && urls.length < 20) {
    const mayor = ss[1]
      .split(',')
      .map(p => p.trim().split(/\s+/))
      .map(([u, d]) => ({ u, w: parseInt(d ?? '0', 10) || 0 }))
      .sort((a, b) => b.w - a.w)[0]
    push(mayor?.u)
  }

  const imgRe = /<img[^>]+(?:data-src|data-original|data-lazy-src|src)=["']([^"']+)["']/gi
  let im: RegExpExecArray | null
  while ((im = imgRe.exec(html)) !== null && urls.length < 20) push(im[1])

  return urls.slice(0, 12)
}

export interface SenalesProducto {
  finalUrl: string
  titulo: string | null
  descripcionMeta: string | null
  sitio: string | null
  jsonLd: Record<string, unknown>[]
  imagenes: string[]
  texto: string
}

export function extraerSenales(html: string, finalUrl: string, maxTexto = 24_000): SenalesProducto {
  const titulo =
    metaPor(html, 'og:title') ??
    metaContent(html, [/<title[^>]*>([\s\S]*?)<\/title>/i])
  return {
    finalUrl,
    titulo,
    descripcionMeta: metaPor(html, 'og:description') ?? metaPor(html, 'description'),
    sitio: metaPor(html, 'og:site_name'),
    jsonLd: extraerJsonLd(html),
    imagenes: recogerImagenes(html, finalUrl),
    texto: stripHtml(html).slice(0, maxTexto),
  }
}

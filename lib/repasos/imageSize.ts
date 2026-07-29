// Lectura de las dimensiones reales de una imagen desde sus bytes (PNG y JPEG).
//
// Hace falta para el PDF: los pins se sitúan con coordenadas normalizadas sobre
// el plano, así que si la proporción con la que se dibuja el plano en el PDF no
// es la real, los pins caen desplazados. Las dimensiones guardadas en BD son
// solo una estimación (pueden faltar o no corresponder al archivo actual), y en
// servidor no hay un <img> que medir.

export interface ImageSize {
  width: number
  height: number
}

export function readImageSize(buf: Buffer): ImageSize | null {
  return readPng(buf) ?? readJpeg(buf)
}

function readPng(buf: Buffer): ImageSize | null {
  // Firma PNG + cabecera IHDR: ancho en el byte 16, alto en el 20 (big endian).
  if (buf.length < 24) return null
  const firma = buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a
  if (!firma) return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  return width && height ? { width, height } : null
}

function readJpeg(buf: Buffer): ImageSize | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null

  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marker = buf[i + 1]

    // Marcadores sin payload
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    // Fin de imagen o inicio de datos: ya no hay cabeceras que leer
    if (marker === 0xd9 || marker === 0xda) return null

    const length = buf.readUInt16BE(i + 2)

    // SOF0..SOF15 (excepto DHT 0xC4, JPG 0xC8 y DAC 0xCC) llevan las dimensiones
    const esSOF =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

    if (esSOF) {
      const height = buf.readUInt16BE(i + 5)
      const width = buf.readUInt16BE(i + 7)
      return width && height ? { width, height } : null
    }

    i += 2 + length
  }
  return null
}

/**
 * Descarga una imagen y devuelve su data URI y sus dimensiones reales.
 * Devuelve null si falla: en el PDF una foto que no carga se omite, nunca
 * tumba la generación del informe entero.
 */
export async function fetchImage(
  url: string,
  timeoutMs = 12000
): Promise<{ dataUri: string; size: ImageSize | null } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) return null

    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length) return null

    const tipo = res.headers.get('content-type') || (readPng(buf) ? 'image/png' : 'image/jpeg')
    return {
      dataUri: `data:${tipo};base64,${buf.toString('base64')}`,
      size: readImageSize(buf),
    }
  } catch {
    return null
  }
}

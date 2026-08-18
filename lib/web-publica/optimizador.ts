// Generador de variantes. SOLO SERVIDOR: importa sharp.
//
// Dos modos, mismo resultado esperado:
//   · `generar()` con calidad calibrada — un encode por peldaño. Rápido (unos
//     segundos), es el que corre al subir una foto desde el CMS.
//   · `generar({ adaptativo: true })` — sube la q peldaño a peldaño hasta cruzar
//     SSIM_OBJETIVO y para ahí. Óptimo real por imagen, pero cuesta ~40 s por
//     foto de 24 MP: es para el proceso por lotes, no para una petición web.
//
// La calidad calibrada de `imagenes.ts` es la mediana de lo que eligió el modo
// adaptativo sobre las 62 imágenes del catálogo, así que el camino rápido aterriza
// donde aterrizaría el lento.

import sharp from 'sharp'
import crypto from 'crypto'
import {
  ESCALERA, ESCALERA_WEBP, CALIDAD_AVIF, CALIDAD_WEBP, SSIM_OBJETIVO,
  anchosPara, type Variantes,
} from './imagenes'

/** Escalones de q que prueba el modo adaptativo, de más barato a más fiel. */
const Q_AVIF = [66, 72, 78, 84, 90, 94, 97]
const Q_WEBP = [78, 84, 90, 94, 97]

export interface VarianteGenerada {
  ancho: number
  formato: 'avif' | 'webp'
  q: number
  ssim: number | null
  bytes: number
  buffer: Buffer
}

export interface ResultadoOptimizacion {
  stem: string
  ancho: number
  alto: number
  variantes: VarianteGenerada[]
  /** Compacto, listo para guardar en `web_assets.variantes`. */
  manifiesto: Variantes
}

/**
 * SSIM global sobre luma, ventanas 8×8 con paso 4. Implementado aquí en vez de
 * llamar a ffmpeg porque hay que evaluarlo decenas de veces por imagen y el coste
 * de escribir PNG y arrancar un proceso dominaría el tiempo total.
 */
function ssim(a: Buffer, b: Buffer, w: number, h: number): number {
  const C1 = 6.5025, C2 = 58.5225
  let acc = 0, n = 0
  for (let y = 0; y + 8 <= h; y += 4) {
    for (let x = 0; x + 8 <= w; x += 4) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0
      for (let j = 0; j < 8; j++) {
        const fila = (y + j) * w + x
        for (let i = 0; i < 8; i++) {
          const va = a[fila + i], vb = b[fila + i]
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb
        }
      }
      const ma = sa / 64, mb = sb / 64
      const va = saa / 64 - ma * ma, vb = sbb / 64 - mb * mb, cov = sab / 64 - ma * mb
      acc += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
      n++
    }
  }
  return n ? acc / n : 1
}

function opciones(formato: 'avif' | 'webp', q: number) {
  // 4:4:4 a partir de q78: por debajo el submuestreo de croma no se nota y ahorra
  // bastante; por encima es lo que impide que los bordes de color se ensucien.
  return formato === 'avif'
    ? { quality: q, effort: 4, chromaSubsampling: q >= 78 ? '4:4:4' : '4:2:0' }
    : { quality: q, effort: 5, smartSubsample: true }
}

/**
 * Referencia de un peldaño: el original reducido a ese ancho, en PNG sin pérdida.
 * Es contra esto y no contra el original completo como hay que medir el SSIM —
 * la reducción de tamaño no es un defecto que corregir, es lo que queremos.
 */
async function referencia(entrada: Buffer, ancho: number) {
  const png = await sharp(entrada, { limitInputPixels: false })
    .rotate()                                    // aplica la orientación EXIF
    .resize({ width: ancho, withoutEnlargement: true, kernel: 'lanczos3' })
    .toColorspace('srgb')
    .png({ compressionLevel: 0 })
    .toBuffer()
  const gris = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true })
  return { png, gris: gris.data, gw: gris.info.width, gh: gris.info.height }
}

async function codificar(
  ref: Awaited<ReturnType<typeof referencia>>,
  formato: 'avif' | 'webp',
  adaptativo: boolean,
  qFija: number,
): Promise<{ q: number; ssim: number | null; buffer: Buffer }> {
  if (!adaptativo) {
    const buffer = await sharp(ref.png)[formato](opciones(formato, qFija) as never).toBuffer()
    return { q: qFija, ssim: null, buffer }
  }
  const escalones = formato === 'avif' ? Q_AVIF : Q_WEBP
  let ultimo: { q: number; ssim: number; buffer: Buffer } | null = null
  for (const q of escalones) {
    const buffer = await sharp(ref.png)[formato](opciones(formato, q) as never).toBuffer()
    const gris = await sharp(buffer).greyscale().raw().toBuffer()
    const s = ssim(ref.gris, gris, ref.gw, ref.gh)
    ultimo = { q, ssim: s, buffer }
    if (s >= SSIM_OBJETIVO) break
  }
  return ultimo!
}

export async function generar(
  entrada: Buffer,
  opts: { adaptativo?: boolean } = {},
): Promise<ResultadoOptimizacion> {
  const adaptativo = opts.adaptativo ?? false
  const stem = crypto.createHash('md5').update(entrada).digest('hex').slice(0, 12)

  const meta = await sharp(entrada, { limitInputPixels: false }).metadata()
  // Con orientación EXIF 5–8 la imagen va girada 90°: el ancho real es el alto.
  const girada = (meta.orientation ?? 1) >= 5
  const ancho = (girada ? meta.height : meta.width) ?? 0
  const alto = (girada ? meta.width : meta.height) ?? 0
  if (!ancho || !alto) throw new Error('No se pudieron leer las dimensiones de la imagen.')

  const anchos = anchosPara(ancho)
  const variantes: VarianteGenerada[] = []

  for (const a of anchos) {
    const ref = await referencia(entrada, a)
    const avif = await codificar(ref, 'avif', adaptativo, CALIDAD_AVIF[a] ?? 78)
    variantes.push({ ancho: a, formato: 'avif', q: avif.q, ssim: avif.ssim, bytes: avif.buffer.length, buffer: avif.buffer })

    if ((ESCALERA_WEBP as readonly number[]).includes(a)) {
      const webp = await codificar(ref, 'webp', adaptativo, CALIDAD_WEBP[a] ?? 90)
      variantes.push({ ancho: a, formato: 'webp', q: webp.q, ssim: webp.ssim, bytes: webp.buffer.length, buffer: webp.buffer })
    }
  }

  return {
    stem, ancho, alto, variantes,
    manifiesto: {
      stem, w: ancho, h: alto,
      avif: variantes.filter((v) => v.formato === 'avif').map((v) => v.ancho),
      webp: variantes.filter((v) => v.formato === 'webp').map((v) => v.ancho),
    },
  }
}

export { ESCALERA, ESCALERA_WEBP }

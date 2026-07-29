// Subida de archivos de la app de repasos (se ejecuta en el navegador).
//
// Dos piezas:
//  · Fotos de obra → se comprimen ANTES de subir. En obra la cobertura es mala y
//    una foto de móvil son 4-6 MB; a 1800 px de lado mayor baja a ~300 KB sin
//    perder detalle útil para ver un desperfecto.
//  · Planos → si es PDF se rasteriza la página 1 en el navegador (mismo patrón
//    que ClientPortal.tsx) y se sube el PNG/JPEG que pinta el visor, además del
//    PDF original. Pintar pins sobre una imagen es instantáneo en móvil; sobre
//    un PDF vivo no lo es.

import { createClient } from '@/lib/supabase/client'

const BUCKET = 'repasos'

const FOTO_MAX_SIDE = 1800
const FOTO_QUALITY = 0.82
const PLANO_TARGET_WIDTH = 2400
const PLANO_QUALITY = 0.92

export interface PlanoPreparado {
  imgBlob: Blob
  width: number
  height: number
  pdfFile: File | null
  previewUrl: string
}

// ─── Subida ───────────────────────────────────────────────────────────────────

export async function uploadRepasoFile(
  blob: Blob,
  ext: string
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '31536000',
    upsert: false,
    contentType: blob.type || undefined,
  })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { url: publicUrl }
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

/** Redimensiona y recomprime una foto a JPEG. Si algo falla, devuelve el original. */
export async function compressFoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = Math.max(bitmap.width, bitmap.height)
    const scale = maxSide > FOTO_MAX_SIDE ? FOTO_MAX_SIDE / maxSide : 1
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await canvasToBlob(canvas, 'image/jpeg', FOTO_QUALITY)
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadFoto(file: File): Promise<{ url: string } | { error: string }> {
  const blob = await compressFoto(file)
  return uploadRepasoFile(blob, 'jpg')
}

// ─── Planos ───────────────────────────────────────────────────────────────────

/**
 * Prepara un plano para el visor: rasteriza si es PDF, recomprime si es imagen.
 * Devuelve el blob a subir, sus dimensiones (para el aspect ratio del visor) y
 * una URL local de preview.
 */
export async function preparePlano(file: File): Promise<PlanoPreparado | { error: string }> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  try {
    const canvas = isPdf ? await rasterizePdf(file) : await rasterizeImage(file)
    const blob = await canvasToBlob(canvas, 'image/jpeg', PLANO_QUALITY)
    if (!blob) return { error: 'No se pudo procesar el plano.' }
    return {
      imgBlob: blob,
      width: canvas.width,
      height: canvas.height,
      pdfFile: isPdf ? file : null,
      previewUrl: URL.createObjectURL(blob),
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `No se pudo leer el plano: ${err.message}`
          : 'No se pudo leer el plano.',
    }
  }
}

/** Sube el plano preparado (imagen + PDF original si lo hay). */
export async function uploadPlano(
  prep: PlanoPreparado
): Promise<{ img_url: string; pdf_url: string | null } | { error: string }> {
  const img = await uploadRepasoFile(prep.imgBlob, 'jpg')
  if ('error' in img) return { error: img.error }

  let pdf_url: string | null = null
  if (prep.pdfFile) {
    const res = await uploadRepasoFile(prep.pdfFile, 'pdf')
    // Que falle el PDF original no debe tumbar el alta: el visor solo necesita la imagen.
    if (!('error' in res)) pdf_url = res.url
  }

  return { img_url: img.url, pdf_url }
}

async function rasterizePdf(file: File): Promise<HTMLCanvasElement> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await pdf.getPage(1)

  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(4, Math.max(1, PLANO_TARGET_WIDTH / base.width))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')!
  // Los PDF vienen con fondo transparente: sin este relleno el JPEG saldría negro.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  return canvas
}

async function rasterizeImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = bitmap.width > PLANO_TARGET_WIDTH ? PLANO_TARGET_WIDTH / bitmap.width : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

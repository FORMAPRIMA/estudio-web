// Subida de tickets y facturas desde el navegador directamente a Storage (bucket
// expense-scans), sin pasar los bytes por Vercel. Ver app/api/expense-scans/upload-url.
import { createClient } from '@/lib/supabase/client'

const LADO_MAX = 2000
const CALIDAD = 0.85

/** Reduce fotos grandes a JPEG de 2000 px de lado mayor. PDFs y lo que el navegador
 *  no sepa decodificar (HEIC fuera de Safari) se suben tal cual. */
async function reducirImagen(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
    if (escala === 1 && file.size < 1.5 * 1024 * 1024) { bmp.close(); return file }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * escala)
    canvas.height = Math.round(bmp.height * escala)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', CALIDAD))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Sube el archivo y devuelve su URL pública, o un mensaje de error legible. */
export async function subirArchivoGasto(original: File): Promise<{ url: string } | { error: string }> {
  try {
    const file = await reducirImagen(original)
    const res = await fetch('/api/expense-scans/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, size: file.size }),
    })
    const prep = await res.json().catch(() => ({ error: `Error ${res.status} al preparar la subida.` }))
    if (!res.ok || prep.error) return { error: prep.error ?? `Error ${res.status} al preparar la subida.` }

    const { error } = await createClient().storage
      .from('expense-scans')
      .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type || 'application/octet-stream' })
    if (error) return { error: `No se pudo subir el archivo: ${error.message}` }
    return { url: prep.publicUrl }
  } catch {
    return { error: 'Error de conexión al subir el archivo.' }
  }
}

// Subidas del recorrido (navegador). Las fotos se ven a pantalla completa en una
// tablet, así que se guardan más grandes que las de Repasos (2400 px de lado).

import { createClient } from '@/lib/supabase/client'
import { preparePlano } from '@/lib/repasos/upload'

const BUCKET = 'recorrido'
const FOTO_MAX_SIDE = 2400
const FOTO_QUALITY = 0.86

async function subir(blob: Blob, ext: string): Promise<string> {
  const supabase = createClient()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '31536000',
    upsert: false,
    contentType: blob.type || undefined,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl
}

export interface FotoSubida { url: string; w: number; h: number }

export async function subirFoto(file: File): Promise<FotoSubida> {
  // createImageBitmap respeta la orientación EXIF en Safari y Chrome actuales.
  const bitmap = await createImageBitmap(file)
  const max = Math.max(bitmap.width, bitmap.height)
  const k = max > FOTO_MAX_SIDE ? FOTO_MAX_SIDE / max : 1
  const w = Math.round(bitmap.width * k)
  const h = Math.round(bitmap.height * k)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', FOTO_QUALITY))
  const url = await subir(blob ?? file, 'jpg')
  return { url, w, h }
}

export async function subirPlano(file: File): Promise<FotoSubida> {
  const prep = await preparePlano(file)
  if ('error' in prep) throw new Error(prep.error)
  const url = await subir(prep.imgBlob, 'jpg')
  return { url, w: prep.width, h: prep.height }
}

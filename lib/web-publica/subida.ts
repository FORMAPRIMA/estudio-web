'use client'

// Subida de archivos del CMS de la web pública. Único punto de entrada.
//
// Antes había cinco copias de `uploadImage` —una por editor— y todas hacían
// `storage.upload(path, file)` con el File tal cual. Resultado: 775 MB de
// originales de cámara en el bucket y páginas de 142 MB. Ahora los cinco pasan
// por aquí y la optimización va DENTRO del flujo, no como paso aparte que alguien
// tenga que acordarse de lanzar.
//
// El original se sube INTACTO: no se recodifica ni se reduce. Lo que cambia es que
// justo después se generan sus variantes y se registran en `web_assets`, y el
// sitio sirve esas. Así no se pierde nada de lo que sube el equipo y el visitante
// nunca recibe un fichero de 18 MB.
//
// Los vídeos y los .glb pasan sin tocar: los mismos editores los suben por esta
// vía y no hay pipeline de variantes para ellos.

import { createClient } from '@/lib/supabase/client'
import { optimizarAsset } from '@/app/actions/web-assets'
import { BUCKET } from './imagenes'

export interface ResultadoSubida {
  url: string
  /** Fracción ahorrada en la variante que se servirá en escritorio. 0 si no se optimizó. */
  ahorro: number
  /** Presente si la subida fue bien pero la optimización falló. */
  aviso?: string
}

/** Extensiones para las que sí se genera escalera de variantes. */
const RASTER = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'tif', 'tiff']

function esRaster(file: File): boolean {
  if (file.type.startsWith('image/') && !file.type.includes('svg')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return RASTER.includes(ext)
}

/**
 * Sube un archivo al bucket de la web pública y, si es una imagen de mapa de bits,
 * deja sus variantes generadas y registradas.
 *
 * @param carpeta subcarpeta dentro del bucket ('equipo', 'content', 'fp-tools',
 *   'propiedades'…). Cadena vacía para la raíz, donde viven los proyectos.
 * @param onFase para que el editor pueda decir «Optimizando…» en vez de quedarse
 *   mudo los segundos que tarda la escalera.
 */
export async function subirArchivo(
  file: File,
  carpeta: string,
  onFase?: (fase: 'subiendo' | 'optimizando') => void,
): Promise<ResultadoSubida | { error: string }> {
  onFase?.('subiendo')

  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const ruta = carpeta ? `${carpeta}/${nombre}` : nombre

  const { data, error } = await supabase.storage.from(BUCKET)
    .upload(ruta, file, { cacheControl: '31536000', upsert: false })
  if (error) return { error: error.message }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)

  if (!esRaster(file)) return { url: publicUrl, ahorro: 0 }

  // La optimización no puede tumbar la subida: si falla, la foto ya está guardada
  // y el sitio la sirve como original —peor, pero visible— hasta que se reintente.
  onFase?.('optimizando')
  try {
    const res = await optimizarAsset(publicUrl)
    if ('error' in res) return { url: publicUrl, ahorro: 0, aviso: res.error }
    return { url: publicUrl, ahorro: res.ahorro }
  } catch (e) {
    return { url: publicUrl, ahorro: 0, aviso: (e as Error).message }
  }
}

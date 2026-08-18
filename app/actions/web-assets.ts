'use server'

// Registro de variantes optimizadas de la web pública.
//
// `optimizarAsset()` es el gancho que hace que cualquier imagen subida desde el
// CMS quede optimizada sin que nadie tenga que acordarse: los cinco editores lo
// llaman al terminar de subir. `getManifiesto()` es la cara de lectura, y la
// consume el sitio a través de <AssetsProvider>.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generar } from '@/lib/web-publica/optimizador'
import { BUCKET, rutaVariante, type Manifiesto, type Variantes } from '@/lib/web-publica/imagenes'

const ROLES_ESCRITURA = ['fp_partner', 'fp_biz_dev']

async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !ROLES_ESCRITURA.includes(profile.rol)) throw new Error('Sin permisos.')
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Manifiesto completo. Son decenas de filas, no miles, y cada una ocupa ~120 B
 * serializada, así que traerlo entero sale más barato que resolver por página:
 * una consulta en el layout y las nueve rutas quedan servidas.
 *
 * Si falla, devuelve {} — sin manifiesto el sitio pinta los originales, que es
 * exactamente el comportamiento de antes. Nunca debe tumbar una página.
 */
export async function getManifiesto(): Promise<Manifiesto> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('web_assets').select('origen_url, variantes')
    if (error) { console.error('[web-assets] getManifiesto:', error.message); return {} }
    const m: Manifiesto = {}
    for (const fila of data ?? []) m[fila.origen_url as string] = fila.variantes as Variantes
    return m
  } catch (e) {
    console.error('[web-assets] getManifiesto:', (e as Error).message)
    return {}
  }
}

// ── Escritura ────────────────────────────────────────────────────────────────

/**
 * Genera y sube las variantes de una imagen ya almacenada, y la registra.
 *
 * Idempotente por dos vías: si la URL ya está registrada no hace nada, y los
 * ficheros van con nombre direccionado por contenido, así que dos originales
 * idénticos comparten derivados en lugar de duplicarlos.
 *
 * @param adaptativo búsqueda de calidad guiada por SSIM. Tarda ~40 s en una foto
 *   de 24 MP, así que solo para el proceso por lotes; desde el CMS se usa la
 *   calidad calibrada, que aterriza en el mismo sitio en unos segundos.
 */
export async function optimizarAsset(
  origenUrl: string,
  opts: { adaptativo?: boolean; forzar?: boolean } = {},
): Promise<{ ok: true; variantes: Variantes; ahorro: number } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()

    if (!opts.forzar) {
      const { data: ya } = await admin.from('web_assets')
        .select('variantes').eq('origen_url', origenUrl).maybeSingle()
      if (ya) return { ok: true, variantes: ya.variantes as Variantes, ahorro: 0 }
    }

    const corte = origenUrl.indexOf('/object/public/')
    if (corte === -1) return { error: 'La URL no apunta a un objeto público de Storage.' }
    const resto = origenUrl.slice(corte + '/object/public/'.length)
    const barra = resto.indexOf('/')
    const bucket = resto.slice(0, barra)
    const ruta = resto.slice(barra + 1)

    const { data: blob, error: errDescarga } = await admin.storage.from(bucket).download(ruta)
    if (errDescarga || !blob) return { error: `No se pudo descargar el original: ${errDescarga?.message}` }
    const original = Buffer.from(await blob.arrayBuffer())

    const res = await generar(original, { adaptativo: opts.adaptativo })

    // Subida en paralelo. upsert:true porque un mismo stem puede venir de dos
    // originales idénticos: reescribir el mismo contenido es inofensivo y evita
    // tener que distinguir «ya existe» de «error real».
    const subidas = await Promise.all(res.variantes.map((v) =>
      admin.storage.from(BUCKET).upload(rutaVariante(res.stem, v.ancho, v.formato), v.buffer, {
        contentType: `image/${v.formato}`,
        cacheControl: '31536000, immutable',
        upsert: true,
      })
    ))
    const fallo = subidas.find((s) => s.error)
    if (fallo?.error) return { error: `Fallo al subir variantes: ${fallo.error.message}` }

    const bytesVariantes = res.variantes.reduce((s, v) => s + v.bytes, 0)
    const { error: errFila } = await admin.from('web_assets').upsert({
      origen_url: origenUrl,
      stem: res.stem,
      ancho: res.ancho,
      alto: res.alto,
      variantes: res.manifiesto,
      bytes_origen: original.length,
      bytes_variantes: bytesVariantes,
      metodo: opts.adaptativo ? 'lotes' : 'subida',
    }, { onConflict: 'origen_url' })
    if (errFila) return { error: errFila.message }

    // Ahorro sobre la variante que de verdad se serviría en escritorio (1920),
    // no sobre la suma del ladder: es la cifra que le importa al usuario.
    const servida = res.variantes
      .filter((v) => v.formato === 'avif' && v.ancho <= 1920)
      .sort((a, b) => b.ancho - a.ancho)[0]
    const ahorro = servida ? 1 - servida.bytes / original.length : 0

    return { ok: true, variantes: res.manifiesto, ahorro }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

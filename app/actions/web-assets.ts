'use server'

// Registro de variantes optimizadas de la web pública.
//
// `optimizarAsset()` es el gancho que hace que cualquier imagen subida desde el
// CMS quede optimizada sin que nadie tenga que acordarse: los cinco editores lo
// llaman al terminar de subir. `getManifiesto()` es la cara de lectura, y la
// consume el sitio a través de <AssetsProvider>.

import { revalidateTag, unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generar } from '@/lib/web-publica/optimizador'
import { BUCKET, rutaVariante, type Manifiesto, type Variantes } from '@/lib/web-publica/imagenes'
import { TAG, VIDA, conEspera } from '@/lib/web-publica/cache'

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
/**
 * El manifiesto de variantes, cacheado con la vida más larga de todo el sitio.
 *
 * Era, con diferencia, la consulta más cara de la web: la tabla `web_assets`
 * ENTERA —con su jsonb de variantes— en CADA petición de CADA página, porque la
 * pide el layout del sitio. Y su contenido solo cambia cuando alguien sube un
 * archivo desde el CMS, cosa que pasa unas pocas veces por semana.
 */
const leerManifiesto = unstable_cache(
  async (): Promise<Manifiesto> => {
    const admin = createAdminClient()
    const { data, error } = await conEspera(
      admin.from('web_assets').select('origen_url, variantes'),
      'manifiesto',
    )
    // Un error de Supabase se LANZA, no se traga: así no se guarda un manifiesto
    // vacío en la caché, que dejaría el sitio sirviendo los originales sin
    // optimizar durante una hora.
    if (error) throw new Error(error.message)
    const m: Manifiesto = {}
    for (const fila of data ?? []) m[fila.origen_url as string] = fila.variantes as Variantes
    return m
  },
  ['web-assets-manifiesto'],
  { tags: [TAG.assets], revalidate: VIDA.largo },
)

export async function getManifiesto(): Promise<Manifiesto> {
  try {
    return await leerManifiesto()
  } catch (e) {
    // Sin manifiesto el sitio sigue en pie: `Img` cae al original. Es peor de
    // rendimiento, pero se ve. Esto solo ocurre en la primera carga tras un
    // despliegue si justo entonces Supabase no responde.
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

    // El manifiesto está cacheado una hora; sin esto, la imagen recién subida se
    // serviría sin optimizar hasta que esa hora venciera.
    revalidateTag(TAG.assets)

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

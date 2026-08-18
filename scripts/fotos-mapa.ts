/**
 * Carga por lotes de las fotos del mapa de Madrid.
 *
 *   npx tsx scripts/fotos-mapa.ts            → solo imprime el plan
 *   npx tsx scripts/fotos-mapa.ts --aplicar  → lo ejecuta
 *
 * Hace lo mismo que el CMS foto a foto —subir el original, generar la escalera de
 * variantes y registrarla en `web_assets`— pero para las 22 de golpe, reutilizando
 * el MISMO optimizador que usa la web (`lib/web-publica/optimizador`) para que el
 * resultado sea idéntico y no haya dos caminos que mantener.
 *
 * Además: crea los puntos que faltan, los geocodifica y reordena el mapa según los
 * números que Jose puso delante del nombre de archivo.
 *
 * Es idempotente: una foto ya cargada se salta salvo que se pase --forzar.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { homedir } from 'os'
import { generar } from '../lib/web-publica/optimizador'
import { BUCKET, rutaVariante } from '../lib/web-publica/imagenes'

const CARPETA = join(homedir(), 'Desktop', 'FOTOS MAPA')
const APLICAR = process.argv.includes('--aplicar')
const FORZAR = process.argv.includes('--forzar')

// ── Entorno ─────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Nombres ─────────────────────────────────────────────────────────────────
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Similitud por bigramas (Sørensen–Dice). Con umbral alto tolera la errata de un
 *  nombre de archivo («ODONNEL» por «O'Donnell») sin emparejar cosas distintas. */
function similitud(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bg = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1) } return m }
  const A = bg(a), B = bg(b)
  let comunes = 0
  Array.from(A).forEach(([g, n]) => { comunes += Math.min(n, B.get(g) ?? 0) })
  return (2 * comunes) / (a.length - 1 + b.length - 1)
}

const numeroDe = (f: string) => {
  const m = f.match(/^(\d+(?:\.\d+)?)[.\s]/)
  return m ? parseFloat(m[1]) : null
}
const nombreDe = (f: string) =>
  basename(f, extname(f)).replace(/^\d+(\.\d+)?[.\s]+/, '').trim()

/** «ALBERTO BOSCH 14» → «Calle de Alberto Bosch 14, Madrid, España». Solo sirve
 *  si el nombre acaba en número de portal; si no, el punto nace sin dirección. */
function direccionDe(nombre: string): string | null {
  if (!/\d+\s*$/.test(nombre)) return null
  const bonito = nombre.toLowerCase().replace(/\b[a-záéíóúñ]/g, (c) => c.toUpperCase())
  return `Calle de ${bonito}, Madrid, España`
}

// ── Plan ────────────────────────────────────────────────────────────────────
async function main() {
  const ficheros = readdirSync(CARPETA).filter((f) => !f.startsWith('.'))
  const { data: puntos } = await admin.from('web_mapa_puntos').select('id, nombre, orden, imagen_url')
  if (!puntos) throw new Error('No pude leer web_mapa_puntos')

  type Trabajo = { fichero: string; nombre: string; numero: number | null; punto: any | null; nuevo: boolean }
  const trabajos: Trabajo[] = ficheros.map((f) => {
    const nombre = nombreDe(f)
    const clave = norm(nombre)
    let mejor: any = null, mejorSim = 0
    for (const p of puntos) {
      const s = similitud(clave, norm(p.nombre))
      if (s > mejorSim) { mejorSim = s; mejor = p }
    }
    // 0,85 deja pasar «odonnel35» ↔ «odonnell35» y rechaza «columela3» ↔ «columela6»,
    // que comparten casi todo menos lo único que importa: el número de portal.
    const mismoPortal = mejor && (nombre.match(/\d+\s*$/)?.[0]?.trim() === String(mejor.nombre).match(/\d+\s*$/)?.[0]?.trim())
    const punto = mejorSim >= 0.85 && mismoPortal ? mejor : null
    return { fichero: f, nombre, numero: numeroDe(f), punto, nuevo: !punto }
  })

  // Orden final: primero los numerados por su número, después el resto de los que
  // tienen foto (respetando el orden actual del mapa), y al final los que no.
  const conFoto = [...trabajos].sort((a, b) => {
    if (a.numero != null && b.numero != null) return a.numero - b.numero
    if (a.numero != null) return -1
    if (b.numero != null) return 1
    return (a.punto?.orden ?? 9e9) - (b.punto?.orden ?? 9e9)
  })

  console.log(`\n${ficheros.length} fotos · ${trabajos.filter(t => t.nuevo).length} obras nuevas\n`)
  console.log('ORDEN  FOTO                        DESTINO')
  console.log('─'.repeat(78))
  conFoto.forEach((t, i) => {
    const destino = t.punto ? t.punto.nombre : `NUEVO — ${direccionDe(t.nombre) ?? 'sin dirección deducible'}`
    const ya = t.punto?.imagen_url ? ' (ya tenía foto)' : ''
    console.log(`${String(i + 1).padStart(4)}   ${t.nombre.padEnd(26)} ${destino}${ya}`)
  })
  const sinFoto = puntos.filter((p) => !conFoto.some((t) => t.punto?.id === p.id))
  console.log(`\nDetrás, sin foto (${sinFoto.length}): ${sinFoto.map((p) => p.nombre).join(', ')}`)

  if (!APLICAR) { console.log('\n— plan, nada escrito. Añade --aplicar —\n'); return }

  // ── Ejecución ─────────────────────────────────────────────────────────────
  console.log('\nAplicando…\n')
  let orden = 0
  for (const t of conFoto) {
    orden++
    let punto = t.punto

    if (!punto) {
      const dir = direccionDe(t.nombre)
      const { data, error } = await admin.from('web_mapa_puntos')
        .insert({ nombre: t.nombre, direccion: dir, orden }).select('id, nombre, imagen_url').single()
      if (error) { console.log(`  ✗ ${t.nombre}: ${error.message}`); continue }
      punto = data
      if (dir) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dir)}.json`
          + `?limit=1&language=es&country=es&proximity=-3.6883,40.4189&types=address&access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}`
        try {
          const j: any = await (await fetch(url)).json()
          const c = j?.features?.[0]?.center
          if (c) await admin.from('web_mapa_puntos').update({ lng: c[0], lat: c[1] }).eq('id', punto.id)
        } catch {}
      }
    }

    if (punto.imagen_url && !FORZAR) {
      await admin.from('web_mapa_puntos').update({ orden }).eq('id', punto.id)
      console.log(`  · ${t.nombre} — ya tenía foto, solo reordeno`)
      continue
    }

    // 1 · original al bucket
    const bytes = readFileSync(join(CARPETA, t.fichero))
    const ext = extname(t.fichero).toLowerCase().replace('.', '') || 'jpg'
    const ruta = `mapa/${Date.now()}-${norm(t.nombre)}.${ext}`
    const { error: errSubida } = await admin.storage.from(BUCKET)
      .upload(ruta, bytes, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, cacheControl: '31536000', upsert: true })
    if (errSubida) { console.log(`  ✗ ${t.nombre}: ${errSubida.message}`); continue }
    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(ruta)

    // 2 · escalera de variantes, con el mismo optimizador que el CMS
    const res = await generar(bytes)
    const subidas = await Promise.all(res.variantes.map((v) =>
      admin.storage.from(BUCKET).upload(rutaVariante(res.stem, v.ancho, v.formato), v.buffer, {
        contentType: `image/${v.formato}`, cacheControl: '31536000, immutable', upsert: true,
      })))
    const fallo = subidas.find((s) => s.error)
    if (fallo?.error) { console.log(`  ✗ ${t.nombre}: variantes — ${fallo.error.message}`); continue }

    const bytesVar = res.variantes.reduce((s, v) => s + v.bytes, 0)
    await admin.from('web_assets').upsert({
      origen_url: publicUrl, stem: res.stem, ancho: res.ancho, alto: res.alto,
      variantes: res.manifiesto, bytes_origen: bytes.length, bytes_variantes: bytesVar, metodo: 'lotes',
    }, { onConflict: 'origen_url' })

    // 3 · la foto y el orden, al punto
    await admin.from('web_mapa_puntos').update({ imagen_url: publicUrl, orden }).eq('id', punto.id)

    const servida = res.variantes.filter((v) => v.formato === 'avif' && v.ancho <= 1920).sort((a, b) => b.ancho - a.ancho)[0]
    const ahorro = servida ? Math.round((1 - servida.bytes / bytes.length) * 100) : 0
    console.log(`  ✓ ${t.nombre.padEnd(24)} ${(bytes.length / 1048576).toFixed(1)} MB → −${ahorro}%  (${res.variantes.length} variantes)`)
  }

  // Los que no tienen foto van detrás, conservando su orden relativo.
  const { data: resto } = await admin.from('web_mapa_puntos')
    .select('id, orden').order('orden')
  for (const p of (resto ?? [])) {
    if (conFoto.some((t) => t.punto?.id === p.id)) continue
    orden++
    await admin.from('web_mapa_puntos').update({ orden }).eq('id', p.id)
  }
  console.log('\nListo.\n')
}

main().catch((e) => { console.error(e); process.exit(1) })

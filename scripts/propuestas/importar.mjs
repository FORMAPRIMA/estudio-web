#!/usr/bin/env node
// Importa una propuesta de honorarios hecha en Claude Design a la web.
//
//   node scripts/propuestas/importar.mjs <slug> <carpeta-origen>
//
// La carpeta de origen tiene lo que se baja del proyecto de Claude Design:
//   desktop.html   ← el .dc.html horizontal (1920×1080)
//   mobile.html    ← el .dc.html vertical (1080×1920)
//   assets/        ← las imágenes que usan los dos
//
// Genera:
//   lib/propuestas/decks/<slug>.ts      ← las diapositivas de las dos versiones
//   public/propuestas/<slug>/*          ← las imágenes, optimizadas para web (+ og.jpg)
//
// Después, la propuesta se da de alta en lib/propuestas/registro.ts (cliente,
// PIN, portada). Sin esa entrada la URL responde "no disponible".
//
// Lo que se toca del diseño, y por qué:
//   · Se quitan las notas del orador: son internas y viajarían en el HTML.
//   · "Borrador de trabajo" desaparece de la portada: lo que se envía es final.
//   · La bienvenida de escritorio no dice "haz scroll": ahí se avanza con clic
//     o flechas.
//   · El email de contacto pasa a ser un enlace.
//   · Las imágenes se sirven en JPG (o PNG si tienen transparencia) al tamaño
//     que de verdad se ven, y con carga diferida salvo en las dos primeras.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [slug, origen] = process.argv.slice(2)
if (!slug || !origen || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Uso: node scripts/propuestas/importar.mjs <slug-en-minúsculas> <carpeta-origen>')
  process.exit(1)
}

const RAIZ = path.resolve(new URL('../..', import.meta.url).pathname)
const DIR_IMG = path.join(RAIZ, 'public', 'propuestas', slug)
const DIR_DECK = path.join(RAIZ, 'lib', 'propuestas', 'decks')
const URL_IMG = `/propuestas/${slug}`

// Lado largo máximo por tipo de imagen. Una foto a sangre en 1920 px de diseño
// no necesita más de ~2000; los retratos del equipo se ven a menos de 500.
const MAX_FOTO = 2000
const MAX_RETRATO = 900

const leer = (f) => fs.readFileSync(path.join(origen, f), 'utf8')

/** Lo que hay dentro de <x-import …>…</x-import>: las <section> del deck. */
function diapositivas(html) {
  const m = html.match(/<x-import[^>]*deck-stage[^>]*>([\s\S]*?)<\/x-import>/)
  if (!m) throw new Error('No encuentro el <x-import> del deck-stage.')
  return m[1]
}

function limpiar(html, variante, nombres) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+data-speaker-notes="[^"]*"/g, '')
    .replace(/Confidencial · Borrador de trabajo/g, 'Confidencial')
    .replace(/>(\s*)(contacto@formaprima\.es)(\s*)</g,
      '>$1<a href="mailto:$2" style="color:inherit;text-decoration:none;">$2</a>$3<')

  if (variante === 'desktop') {
    h = h
      .replace(/Haz scroll para verla\./g, 'Avanza con las flechas del teclado o con un clic.')
      .replace(/(<div data-hint[\s\S]*?)>Scroll<\/span>/, '$1>Clic · →</span>')
  }

  // src="assets/x.png" → /propuestas/<slug>/x.jpg
  h = h.replace(/src="assets\/([^"]+)"/g, (_, f) => {
    const salida = nombres.get(f)
    if (!salida) throw new Error(`Imagen sin procesar: ${f}`)
    return `src="${URL_IMG}/${salida}"`
  })

  // Carga diferida a partir de la tercera diapositiva.
  let n = 0
  h = h.replace(/<section\b[\s\S]*?<\/section>/g, (sec) => {
    n++
    return n <= 2 ? sec : sec.replace(/<img\b/g, '<img loading="lazy" decoding="async"')
  })
  return h.replace(/\n{3,}/g, '\n\n').trim()
}

async function procesarImagen(nombre) {
  const entrada = path.join(origen, 'assets', nombre)
  if (!fs.existsSync(entrada)) throw new Error(`Falta la imagen assets/${nombre}`)
  const base = nombre.replace(/\.[^.]+$/, '')
  const img = sharp(entrada, { failOn: 'none' }).rotate()
  const meta = await img.metadata()
  const opaca = !meta.hasAlpha || (await sharp(entrada).stats()).isOpaque
  const max = /^team-/.test(base) ? MAX_RETRATO : MAX_FOTO
  const redim = img.resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })

  const salida = opaca ? `${base}.jpg` : `${base}.png`
  const destino = path.join(DIR_IMG, salida)
  if (opaca) await redim.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(destino)
  else await redim.png({ compressionLevel: 9, palette: true }).toFile(destino)
  return salida
}

async function main() {
  const desktop = diapositivas(leer('desktop.html'))
  const mobile = diapositivas(leer('mobile.html'))

  const usadas = [...new Set([...(desktop + mobile).matchAll(/src="assets\/([^"]+)"/g)].map((m) => m[1]))]
  fs.rmSync(DIR_IMG, { recursive: true, force: true })
  fs.mkdirSync(DIR_IMG, { recursive: true })
  fs.mkdirSync(DIR_DECK, { recursive: true })

  const nombres = new Map()
  let total = 0
  for (const f of usadas) {
    const salida = await procesarImagen(f)
    nombres.set(f, salida)
    total += fs.statSync(path.join(DIR_IMG, salida)).size
  }

  // Vista previa al compartir el enlace (WhatsApp, correo): 1200×630 a partir de
  // la primera imagen del deck, que es la portada de la bienvenida.
  const primera = desktop.match(/src="assets\/([^"]+)"/)?.[1]
  if (primera) {
    await sharp(path.join(origen, 'assets', primera)).rotate()
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(DIR_IMG, 'og.jpg'))
  }

  const d = limpiar(desktop, 'desktop', nombres)
  const m = limpiar(mobile, 'mobile', nombres)
  const cuenta = (h) => (h.match(/<section\b/g) || []).length

  const ts = `// Generado por scripts/propuestas/importar.mjs — no editar a mano.
// Origen: ${path.basename(path.resolve(origen))} · ${new Date().toISOString().slice(0, 10)}

export const desktop: string = ${JSON.stringify(d)}

export const mobile: string = ${JSON.stringify(m)}
`
  fs.writeFileSync(path.join(DIR_DECK, `${slug}.ts`), ts)

  console.log(`✓ ${slug}: ${cuenta(d)} diapositivas desktop, ${cuenta(m)} mobile`)
  console.log(`✓ ${usadas.length} imágenes · ${(total / 1024 / 1024).toFixed(1)} MB en public/propuestas/${slug}/`)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })

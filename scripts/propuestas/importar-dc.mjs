#!/usr/bin/env node
// Importa un dossier INTERACTIVO de Claude Design (un .dc.html con lógica propia:
// botones, selectores, vídeo, maquetas 3D…) para publicarlo tal cual en la web.
//
//   node scripts/propuestas/importar-dc.mjs <slug> <carpeta-origen> "<archivo>.dc.html" [--quitar "Etiqueta"]
//
// A diferencia de importar.mjs (que extrae las diapositivas y las reproduce con
// nuestro visor), aquí el diseño se sirve con SU PROPIO runtime (support.js +
// deck-stage.js + los componentes que use): así funciona exactamente como en el
// editor. La carpeta de origen tiene lo que se baja del proyecto:
//   <archivo>.dc.html, support.js, deck-stage.js, *.js que use, assets/
//   web/<video>.av1.mp4 + web/<video>.hevc.mp4  ← versiones optimizadas de cada
//                                                   vídeo de assets/ (opcional)
//
// Genera:
//   lib/propuestas/decks/<slug>.ts     ← el documento (se sirve solo con PIN)
//   public/propuestas/<slug>/          ← runtime, imágenes y vídeos
//
// Lo que se toca: fuera notas del orador; imágenes a JPG/PNG del tamaño en que
// se ven; cada <video> con su AV1 + HEVC si existen; y un hueco
// <!--FP:SIGUIENTE--> al final del deck donde el servidor pone la diapositiva
// "Siguiente paso" (interés + obras de la web), que no viene del diseño.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { arreglarDossier, arreglarMaqueta, arreglarDeckStage } from './arreglos-dc.mjs'

const args = process.argv.slice(2)
// --quitar "Etiqueta" (repetible): diapositivas del diseño que no se publican.
const quitar = []
for (let i = args.indexOf('--quitar'); i !== -1; i = args.indexOf('--quitar')) { quitar.push(args[i + 1]); args.splice(i, 2) }
const [slug, origen, archivo] = args
if (!slug || !origen || !archivo || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Uso: node scripts/propuestas/importar-dc.mjs <slug> <carpeta-origen> "<archivo>.dc.html"')
  process.exit(1)
}

const RAIZ = path.resolve(new URL('../..', import.meta.url).pathname)
const PUB = path.join(RAIZ, 'public', 'propuestas', slug)
const DIR_DECK = path.join(RAIZ, 'lib', 'propuestas', 'decks')
const MAX_FOTO = 2000
const MAX_RETRATO = 900

const src = (f) => path.join(origen, f)

async function imagen(nombre) {
  const entrada = src(path.join('assets', nombre))
  if (!fs.existsSync(entrada)) throw new Error(`Falta assets/${nombre}`)
  const base = nombre.replace(/\.[^.]+$/, '')
  const img = sharp(entrada, { failOn: 'none' }).rotate()
  const meta = await img.metadata()
  const opaca = !meta.hasAlpha || (await sharp(entrada).stats()).isOpaque
  const max = /^team-/.test(base) ? MAX_RETRATO : MAX_FOTO
  const redim = img.resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
  const salida = opaca ? `${base}.jpg` : `${base}.png`
  const destino = path.join(PUB, 'assets', salida)
  if (opaca) await redim.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(destino)
  else await redim.png({ compressionLevel: 9, palette: true }).toFile(destino)
  return salida
}

async function main() {
  let html = fs.readFileSync(src(archivo), 'utf8')
  // og.jpg (vista previa al compartir) se hace aparte: que sobreviva a la reimportación.
  const og = path.join(PUB, 'og.jpg')
  const ogPrevio = fs.existsSync(og) ? fs.readFileSync(og) : null
  fs.rmSync(PUB, { recursive: true, force: true })
  fs.mkdirSync(path.join(PUB, 'assets'), { recursive: true })
  fs.mkdirSync(DIR_DECK, { recursive: true })
  if (ogPrevio) fs.writeFileSync(og, ogPrevio)

  // Runtime: todo .js de la raíz del origen (support, deck-stage, componentes y
  // los módulos que estos importan por URL relativa, p. ej. zurbano6-maquetas.js).
  const js = fs.readdirSync(origen).filter((f) => f.endsWith('.js'))
  js.forEach((f) => {
    const texto = fs.readFileSync(src(f), 'utf8')
    fs.writeFileSync(path.join(PUB, f), f === 'cz-maqueta.js' ? arreglarMaqueta(texto) : f === 'deck-stage.js' ? arreglarDeckStage(texto) : texto)
  })

  // Vídeos: <video … src="assets/x.mp4[#t=…]"> → <source> AV1 + HEVC.
  const videos = []
  html = html.replace(/<video\b([^>]*?)\ssrc="assets\/([^"#]+)\.mp4(#[^"]*)?"([^>]*)>/g, (m, a, base, frag = '', b) => {
    const av1 = src(`web/${base}.av1.mp4`)
    const hevc = src(`web/${base}.hevc.mp4`)
    if (!fs.existsSync(av1) || !fs.existsSync(hevc)) {
      fs.copyFileSync(src(`assets/${base}.mp4`), path.join(PUB, 'assets', `${base}.mp4`))
      videos.push(`${base}.mp4 (sin optimizar)`)
      return m
    }
    fs.copyFileSync(av1, path.join(PUB, 'assets', `${base}.av1.mp4`))
    fs.copyFileSync(hevc, path.join(PUB, 'assets', `${base}.hevc.mp4`))
    videos.push(`${base}: AV1 ${(fs.statSync(av1).size / 1e6).toFixed(1)} MB + HEVC ${(fs.statSync(hevc).size / 1e6).toFixed(1)} MB`)
    return `<video${a}${b}>` +
      `<source src="assets/${base}.av1.mp4${frag}" type='video/mp4; codecs="av01.0.08M.10"'>` +
      `<source src="assets/${base}.hevc.mp4${frag}" type='video/mp4; codecs="hvc1.2.4.L120.B0"'>`
  })

  // Imágenes.
  const usadas = [...new Set([...html.matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:png|jpe?g|webp))/gi)].map((m) => m[1]))]
  const nombres = new Map()
  let peso = 0
  for (const f of usadas) {
    const salida = await imagen(f)
    nombres.set(f, salida)
    peso += fs.statSync(path.join(PUB, 'assets', salida)).size
  }
  html = html.replace(/assets\/([A-Za-z0-9_.-]+\.(?:png|jpe?g|webp))/gi, (m, f) => `assets/${nombres.get(f) ?? f}`)

  // Arreglos para móvil (memoria, animaciones, controles): ver arreglos-dc.mjs.
  html = arreglarDossier(html, { quitar })

  // Limpieza y hueco para la diapositiva final.
  html = html
    .replace(/\s+data-speaker-notes="[^"]*"/g, '')
    .replace(/<\/x-import>/, '<!--FP:SIGUIENTE-->\n</x-import>')
  if (!html.includes('<!--FP:SIGUIENTE-->')) throw new Error('No encuentro el </x-import> del deck.')

  const ts = `// Generado por scripts/propuestas/importar-dc.mjs — no editar a mano.
// Origen: ${archivo} · ${new Date().toISOString().slice(0, 10)}

export const html: string = ${JSON.stringify(html)}
`
  fs.writeFileSync(path.join(DIR_DECK, `${slug}.ts`), ts)

  const n = (html.match(/<section\b/g) || []).length
  console.log(`✓ ${slug}: ${n} diapositivas · runtime: ${js.join(', ')}`)
  console.log(`✓ ${usadas.length} imágenes · ${(peso / 1e6).toFixed(1)} MB`)
  videos.forEach((v) => console.log(`✓ vídeo ${v}`))
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })

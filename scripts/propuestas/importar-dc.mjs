#!/usr/bin/env node
// Importa un dossier INTERACTIVO de Claude Design (un .dc.html con lógica propia:
// botones, selectores, vídeo, maquetas 3D…) para publicarlo tal cual en la web.
//
//   node scripts/propuestas/importar-dc.mjs <slug> <carpeta-origen> "<archivo>.dc.html" [--quitar "Etiqueta"] [--perfil zurbano] [--animar]
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
import { arreglarDossier, arreglarMaqueta, arreglarDeckStage, arreglarSupport } from './arreglos-dc.mjs'

const args = process.argv.slice(2)
// --quitar "Etiqueta" (repetible): diapositivas del diseño que no se publican.
const quitar = []
for (let i = args.indexOf('--quitar'); i !== -1; i = args.indexOf('--quitar')) { quitar.push(args[i + 1]); args.splice(i, 2) }
// --perfil zurbano: arreglos propios de Casa Zurbano (ver arreglos-dc.mjs).
let perfil = ''
if (args.includes('--perfil')) { const i = args.indexOf('--perfil'); perfil = args[i + 1]; args.splice(i, 2) }
// --animar: el diseño no trae script propio; se le añade la animación de entrada
// de Torre del Mangle (animacion-dc.js: bloques, telón en imágenes, cifras que suben).
const animar = args.includes('--animar')
if (animar) args.splice(args.indexOf('--animar'), 1)
// --movil <slug-escritorio>: versión móvil (página de scroll, no presentación) de
// una propuesta horizontal. Se publica como <slug-escritorio>-movil; sus secciones
// toman las etiquetas de las diapositivas de escritorio (Salas mide igual) y
// llevan movil-dc.js (medición por scroll y animación al aparecer).
let movil = ''
if (args.includes('--movil')) { const i = args.indexOf('--movil'); movil = args[i + 1]; args.splice(i, 2) }
const [slug, origen, archivo] = args
if (!slug || !origen || !archivo || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Uso: node scripts/propuestas/importar-dc.mjs <slug> <carpeta-origen> "<archivo>.dc.html"')
  process.exit(1)
}

const RAIZ = path.resolve(new URL('../..', import.meta.url).pathname)
const PUB = path.join(RAIZ, 'public', 'propuestas', slug)
const DIR_DECK = path.join(RAIZ, 'lib', 'propuestas', 'decks')
const MAX_FOTO = movil ? 1300 : 2000
const MAX_RETRATO = movil ? 700 : 900

const src = (f) => path.join(origen, f)

// medidas.json (opcional, en la carpeta de origen): a qué tamaño se pinta cada
// imagen, en px del lienzo de diseño (1080 de ancho), medido recorriendo el
// dossier en un iPhone emulado. Con él cada imagen se sirve a la resolución que
// de verdad necesita: ×1,25 sobre el diseño cubre la pantalla retina de un
// iPhone (×1,08) y un monitor grande con el marco vertical (≈×1,2).
const MEDIDAS = fs.existsSync(path.join(origen, 'medidas.json')) ? JSON.parse(fs.readFileSync(path.join(origen, 'medidas.json'), 'utf8')) : {}
const FACTOR = 1.25

async function imagen(nombre) {
  const entrada = src(path.join('assets', nombre))
  if (!fs.existsSync(entrada)) throw new Error(`Falta assets/${nombre}`)
  const base = nombre.replace(/\.[^.]+$/, '')
  const img = sharp(entrada, { failOn: 'none' }).rotate()
  const meta = await img.metadata()
  const logo = LOGO_RE.test(base)
  const medida = MEDIDAS[`${base}.jpg`] || MEDIDAS[`${base}.png`] || MEDIDAS[`${base}.webp`]
  let ancho
  if (medida?.w) ancho = Math.min(meta.width, Math.ceil(medida.w * FACTOR))
  else ancho = Math.min(meta.width, /^team-/.test(base) ? MAX_RETRATO : MAX_FOTO)
  const redim = img.resize({ width: ancho, withoutEnlargement: true })
  // Logos: PNG (nítidos y diminutos). Todo lo demás: WebP, con o sin transparencia.
  const salida = logo ? `${base}.png` : `${base}.webp`
  const destino = path.join(PUB, 'assets', salida)
  if (logo) await redim.png({ compressionLevel: 9, palette: true }).toFile(destino)
  else await redim.webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(destino)
  return salida
}
const LOGO_RE = /logo|sophiq|isotipo/i

function cambiaUna(texto, buscar, poner) {
  if (!texto.includes(buscar)) throw new Error(`No encuentro ${buscar}`)
  return texto.replace(buscar, poner)
}

async function main() {
  let html = fs.readFileSync(src(archivo), 'utf8')
  if (animar) {
    const js = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'animacion-dc.js'), 'utf8')
    const propio = html.match(/(<script type="text\/x-dc" data-dc-script[^>]*>)([\s\S]*?)<\/script>/)
    if (propio) {
      // El diseño trae su propio script (p. ej. arrancar vídeos, botón de sonido):
      // queda como clase base y la animación la extiende, llamando a los dos.
      if (!/class Component extends DCLogic/.test(propio[2])) throw new Error('--animar: no reconozco el script propio del diseño')
      const base = propio[2]
        .replace('class Component extends DCLogic', 'class ComponenteDiseno extends DCLogic')
        .replace(/this\._onSlide\b/g, 'this._onSlideDiseno')
      const anim = js
        .replace('class Component extends DCLogic', 'class Component extends ComponenteDiseno')
        .replace(/componentDidMount\(\) \{/, 'componentDidMount() {\n    if (super.componentDidMount) super.componentDidMount();')
        .replace(/componentWillUnmount\(\) \{/, 'componentWillUnmount() {\n    if (super.componentWillUnmount) super.componentWillUnmount();')
      html = html.replace(propio[0], () => propio[1] + base + '\n' + anim + '</script>')
    } else {
      html = cambiaUna(html, '</x-dc>', '</x-dc>\n<script type="text/x-dc" data-dc-script data-props="{}">\n' + js + '</script>')
    }
  }
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
    const ARREGLOS = { 'cz-maqueta.js': arreglarMaqueta, 'deck-stage.js': arreglarDeckStage, 'support.js': arreglarSupport }
    fs.writeFileSync(path.join(PUB, f), ARREGLOS[f] ? ARREGLOS[f](texto) : texto)
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
    return `<video data-fp-video="${base}"${a}${b}>` +
      `<source src="assets/${base}.av1.mp4${frag}" type='video/mp4; codecs="av01.0.08M.10"'>` +
      `<source src="assets/${base}.hevc.mp4${frag}" type='video/mp4; codecs="hvc1.2.4.L120.B0"'>`
  })

  // El <video> ya no tiene src (lo llevan sus <source>): los selectores del
  // dossier que lo buscaban por src pasan a data-fp-video.
  html = html.replace(/\[src\*="([^"\]]+)"\]/g, (m, base) => (html.includes(`data-fp-video="${base}"`) ? `[data-fp-video="${base}"]` : m))

  // Vídeos que el propio dossier asigna por código (v.src = 'uploads/x.mp4'),
  // p. ej. los de fondo con capas sincronizadas de Torre del Mangle: la cadena
  // pasa a elegir AV1 o HEVC según lo que sepa reproducir el navegador.
  html = html.replace(/'(?:uploads|assets)\/([^'\/]+)\.mp4'/g, (m, base) => {
    const av1 = src(`web/${base}.av1.mp4`)
    const hevc = src(`web/${base}.hevc.mp4`)
    const uno = src(`web/${base}.mp4`)
    // Un solo web/<vídeo>.mp4 (H.264 que ya pesa poco): vale para todos.
    if (fs.existsSync(uno) && !fs.existsSync(av1)) {
      fs.copyFileSync(uno, path.join(PUB, 'assets', `${base}.mp4`))
      videos.push(`${base}: H.264 ${(fs.statSync(uno).size / 1e6).toFixed(1)} MB`)
      return `'assets/${base}.mp4'`
    }
    if (!fs.existsSync(av1) || !fs.existsSync(hevc)) throw new Error(`Falta web/${base}.av1.mp4 + .hevc.mp4 (o un web/${base}.mp4)`)
    fs.copyFileSync(av1, path.join(PUB, 'assets', `${base}.av1.mp4`))
    fs.copyFileSync(hevc, path.join(PUB, 'assets', `${base}.hevc.mp4`))
    videos.push(`${base}: AV1 ${(fs.statSync(av1).size / 1e6).toFixed(1)} MB + HEVC ${(fs.statSync(hevc).size / 1e6).toFixed(1)} MB`)
    return `(window.__fpAV1 ? 'assets/${base}.av1.mp4' : 'assets/${base}.hevc.mp4')`
  })
  if (html.includes('window.__fpAV1')) {
    html = cambiaUna(html, '<script src="./support.js"></script>',
      `<script>window.__fpAV1 = !!document.createElement('video').canPlayType('video/mp4; codecs="av01.0.08M.10"');</script>\n<script src="./support.js"></script>`)
  }
  // Vídeos con fuente por código: el dossier daba `src` a todos al montar (y dos
  // veces: la plantilla estática y la copia interactiva), ~20 MB al abrir. Ahora
  // solo a los de la copia interactiva (#dc-root) que estén en la diapositiva
  // actual o en sus vecinas, y se vuelve a mirar en cada cambio de diapositiva.
  html = html.replace(/(<video data-video="[^"]+"[^>]*?)preload="auto"/g, '$1preload="metadata"')
  if (html.includes('applyVideoSrcs() {')) {
    html = cambiaUna(html,
      `    document.querySelectorAll('video[data-video]').forEach(v => {
      v.muted = true;`,
      `    const raiz = document.getElementById('dc-root');
    if (!raiz) return;
    raiz.querySelectorAll('video[data-video]').forEach(v => {
      const sec = v.closest('section');
      const cerca = (n) => n && n.hasAttribute && n.hasAttribute('data-deck-active');
      if (!sec || !(cerca(sec) || cerca(sec.previousElementSibling) || cerca(sec.nextElementSibling))) return;
      v.muted = true;`)
    html = cambiaUna(html,
      `    this.syncVideo(slide);
    const idx = this.slideIndex(slide);`,
      `    this.applyVideoSrcs();
    this.syncVideo(slide);
    const idx = this.slideIndex(slide);`)
  }

  // Navegación con rueda, deslizando el dedo y con ↑ ↓, si el dossier no la trae
  // (Casa Zurbano sí la trae; Torre del Mangle no). deck-stage solo pasa con
  // ← →, espacio y tocando los lados de la pantalla.
  if (!movil && !/addEventListener\('(wheel|touchstart)'/.test(html)) {
    html = cambiaUna(html, '</body>', `<script>
(function () {
  var deck = function () { return document.querySelector('#dc-root deck-stage') || document.querySelector('deck-stage'); };
  var libre = 0;
  function pasar(d) { var k = deck(); if (!k || Date.now() < libre) return; libre = Date.now() + 850; d > 0 ? k.next() : k.prev(); }
  function propio(t) { return t && t.closest && t.closest('textarea,input,select,[data-fp-scroll]'); }
  // Un gesto = una diapositiva. La inercia del trackpad sigue mandando eventos
  // más de un segundo: tras pasar, se ignora la rueda hasta que el gesto
  // termina (200 ms sin eventos). Antes, a los 850 ms pasaba otra (se saltaba).
  var acum = 0, tAcum = 0, enGesto = false;
  window.addEventListener('wheel', function (e) {
    if (propio(e.target) || e.ctrlKey) return;
    var v = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX, ahora = Date.now();
    if (ahora - tAcum > 200) { acum = 0; enGesto = false; }
    tAcum = ahora;
    if (enGesto) return;
    acum += v;
    if (Math.abs(acum) > 40) { libre = 0; pasar(acum); acum = 0; enGesto = true; }
  }, { passive: true });
  window.addEventListener('keydown', function (e) {
    if (propio(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); var k = deck(); if (k) k.next(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); var k2 = deck(); if (k2) k2.prev(); }
  });
  var x0 = 0, y0 = 0, t0 = 0;
  window.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!t0 || propio(e.target)) return;
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; t0 = 0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 45) return;
    pasar(Math.abs(dx) > Math.abs(dy) ? -dx : -dy);
  }, { passive: true });
})();
</script>
</body>`)
  }

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
  html = arreglarDossier(html, { quitar, perfil, scroll: !!movil })

  // Limpieza y hueco para la diapositiva final.
  html = html.replace(/\s+data-speaker-notes="[^"]*"/g, '')
  if (movil) {
    // Etiquetas de escritorio, en el mismo orden (si no cuadran, para).
    const esc = fs.readFileSync(path.join(DIR_DECK, `${movil}.ts`), 'utf8')
    const etiquetas = [...esc.matchAll(/<section data-label=\\"([^"\\]+)\\"/g)].map((m) => m[1])
    let k = 0
    html = html.replace(/<section\b/g, () => `<section data-label="${etiquetas[k++] ?? ''}"`)
    if (k !== etiquetas.length) throw new Error(`--movil: ${k} secciones en móvil y ${etiquetas.length} diapositivas en ${movil}`)
    const js = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'movil-dc.js'), 'utf8')
    html = cambiaUna(html, '</main>', '<!--FP:SIGUIENTE-->\n</main>')
    html = cambiaUna(html, '</body>', `<script>\n${js}</script>\n</body>`)
  } else {
    html = html.replace(/<\/x-import>/, '<!--FP:SIGUIENTE-->\n</x-import>')
  }
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

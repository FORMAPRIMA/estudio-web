#!/usr/bin/env node
// Vista previa para WhatsApp/correo (1200×630) de un dossier: un render con los
// logos arriba a la izquierda, como en la cabecera del propio dossier
// (Forma Prima | partner, separados por un filete).
//
//   node scripts/propuestas/og-con-logos.mjs <slug> <render.jpg> <logo-fp.png> [<logo-partner.png>]
//
// Escribe public/propuestas/<slug>/og.jpg. Si se cambia, sube la ?v= de `og`
// en el registro: WhatsApp guarda la vista previa por URL.

import path from 'node:path'
import sharp from 'sharp'

const [slug, render, logoFp, logoSocio] = process.argv.slice(2)
if (!slug || !render || !logoFp) {
  console.error('Uso: node scripts/propuestas/og-con-logos.mjs <slug> <render> <logo-fp> [<logo-partner>]')
  process.exit(1)
}
const RAIZ = path.resolve(new URL('../..', import.meta.url).pathname)
const X = 52, Y = 48, GAP = 24, LINEA = 42, MEDIO = Y + 23

const fp = await sharp(logoFp).resize({ height: 26 }).toBuffer({ resolveWithObject: true })
const socio = logoSocio ? await sharp(logoSocio).resize({ height: 46 }).toBuffer({ resolveWithObject: true }) : null
const lineaX = X + fp.info.width + GAP
const socioX = lineaX + 1 + GAP
const ancho = socio ? socioX + socio.info.width : X + fp.info.width

// Velo claro detrás de los logos, para que se lean sobre cualquier render.
const svg = `<svg width="1200" height="630"><defs><radialGradient id="g" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(${ancho + 260} 230)"><stop offset="0" stop-color="#f6f1ea" stop-opacity=".78"/><stop offset=".6" stop-color="#f6f1ea" stop-opacity=".35"/><stop offset="1" stop-color="#f6f1ea" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/>${socio ? `<rect x="${lineaX}" y="${MEDIO - LINEA / 2}" width="1.5" height="${LINEA}" fill="#2b2622" fill-opacity=".35"/>` : ''}</svg>`

const capas = [{ input: Buffer.from(svg), top: 0, left: 0 }, { input: fp.data, top: MEDIO - Math.round(fp.info.height / 2), left: X }]
if (socio) capas.push({ input: socio.data, top: MEDIO - Math.round(socio.info.height / 2), left: socioX })

const destino = path.join(RAIZ, 'public', 'propuestas', slug, 'og.jpg')
await sharp(render).resize(1200, 630, { fit: 'cover', position: 'centre' }).composite(capas).jpeg({ quality: 84, mozjpeg: true }).toFile(destino)
console.log('✓', path.relative(RAIZ, destino))

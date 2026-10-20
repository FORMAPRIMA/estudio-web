// Dibujo 2D del modelo encima del plano, como SVG en coordenadas del plano.
// Lo usan el servidor (imagen que ve la IA al corregir) y la UI (vista 2D).

import { COLOR_DUDA, COLORES_HUECO, COLORES_MURO, COLORES_USO, anclaDuda, centroide, dist, type ModeloEstadoActual } from './modelo'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Indicadores de las dudas pendientes: halo ámbar sobre sus elementos y un «?» clicable (data-duda). */
export function svgDudas(m: ModeloEstadoActual, activa: string | null = null): string {
  const f = Math.max(1, m.imagen.ancho / 1600)
  const partes: string[] = []
  for (const d of m.dudas ?? []) {
    if (d.estado !== 'pendiente') continue
    for (const id of d.elementos) {
      const w = m.muros.find(x => x.id === id) ?? m.huecos.find(x => x.id === id)
      if (w) partes.push(`<line x1="${w.a.x}" y1="${w.a.y}" x2="${w.b.x}" y2="${w.b.y}" stroke="${COLOR_DUDA}" stroke-opacity="0.55" stroke-width="${22 * f}" stroke-linecap="round" pointer-events="none"/>`)
      const e = m.estancias.find(x => x.id === id)
      if (e) partes.push(`<polygon points="${e.poligono.map(p => `${p.x},${p.y}`).join(' ')}" fill="${COLOR_DUDA}" fill-opacity="0.18" stroke="${COLOR_DUDA}" stroke-width="${3 * f}" stroke-dasharray="${8 * f} ${6 * f}" pointer-events="none"/>`)
    }
    const p = anclaDuda(m, d)
    if (!p) continue
    const r = (d.id === activa ? 17 : 14) * f
    partes.push(`<g data-duda="${d.id}" style="cursor:pointer"><circle cx="${p.x}" cy="${p.y}" r="${r + 5 * f}" fill="${COLOR_DUDA}" fill-opacity="0.25"/><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${COLOR_DUDA}" stroke="#fff" stroke-width="${2 * f}"/><text x="${p.x}" y="${p.y + 5.5 * f}" font-family="Arial, Helvetica, sans-serif" font-size="${16 * f}" font-weight="700" fill="#fff" text-anchor="middle">?</text></g>`)
  }
  return partes.join('')
}

export function svgModelo(m: ModeloEstadoActual, opciones: { etiquetas?: boolean; seleccion?: string | null } = {}): string {
  const { ancho, alto } = m.imagen
  const etiquetas = opciones.etiquetas ?? true
  const sel = opciones.seleccion ?? null
  const ppm = m.escala.pxPorMetro
  const f = Math.max(1, ancho / 1600)            // tamaño de letra relativo a la imagen
  const partes: string[] = []

  for (const e of m.estancias) {
    const pts = e.poligono.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const activo = sel === e.id
    partes.push(`<polygon points="${pts}" fill="${COLORES_USO[e.uso]}" fill-opacity="${activo ? 0.75 : 0.45}" stroke="${activo ? '#1A1A1A' : COLORES_USO[e.uso]}" stroke-width="${activo ? 3 : 1}"/>`)
  }

  const c = m.contorno.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  partes.push(`<polygon points="${c}" fill="none" stroke="#1E6FD9" stroke-width="${3 * f}" stroke-dasharray="${12 * f} ${8 * f}"/>`)

  for (const w of m.muros) {
    const color = COLORES_MURO[w.tipo]
    const activo = sel === w.id
    const g = Math.max(4, Math.min(w.grosorPx, 24))
    partes.push(`<line x1="${w.a.x}" y1="${w.a.y}" x2="${w.b.x}" y2="${w.b.y}" stroke="${activo ? '#1A1A1A' : color}" stroke-opacity="${activo ? 1 : 0.85}" stroke-width="${g}" stroke-linecap="square"/>`)
  }

  for (const h of m.huecos) {
    const color = COLORES_HUECO[h.tipo]
    const activo = sel === h.id
    partes.push(`<line x1="${h.a.x}" y1="${h.a.y}" x2="${h.b.x}" y2="${h.b.y}" stroke="${activo ? '#1A1A1A' : color}" stroke-width="${12 * f}" stroke-linecap="butt"/>`)
  }

  if (etiquetas) {
    const chip = (x: number, y: number, texto: string, color: string) => {
      const w = (texto.length * 7.2 + 8) * f, h = 16 * f
      partes.push(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${3 * f}" fill="#fff" fill-opacity="0.92" stroke="${color}" stroke-width="${1.2 * f}"/>`)
      partes.push(`<text x="${x}" y="${y + 4.5 * f}" font-family="Arial, Helvetica, sans-serif" font-size="${12 * f}" font-weight="700" fill="${color}" text-anchor="middle">${esc(texto)}</text>`)
    }
    for (const e of m.estancias) {
      const p = centroide(e.poligono)
      partes.push(`<text x="${p.x}" y="${p.y}" font-family="Arial, Helvetica, sans-serif" font-size="${13 * f}" font-weight="700" fill="#1A1A1A" text-anchor="middle">${esc(`${e.id} · ${e.nombre}`)}</text>`)
    }
    for (const w of m.muros) {
      if (dist(w.a, w.b) < 20) continue
      const mx = (w.a.x + w.b.x) / 2, my = (w.a.y + w.b.y) / 2
      const L = dist(w.a, w.b) / ppm
      chip(mx, my, w.tipo === 'exterior' ? w.id : `${w.id} ${L.toFixed(2).replace('.', ',')}`, COLORES_MURO[w.tipo])
    }
    for (const h of m.huecos) {
      const color = COLORES_HUECO[h.tipo]
      chip((h.a.x + h.b.x) / 2, (h.a.y + h.b.y) / 2 - 14 * f, h.tipo === 'balconera' ? `${h.id} balc.` : h.id, color)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">${partes.join('')}</svg>`
}

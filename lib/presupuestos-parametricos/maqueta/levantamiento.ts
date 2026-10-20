// Levantamiento de la maqueta desde un plano (solo servidor).
//
// Sistema mixto:
// 1. La IA lee el plano sobre una cuadrícula de coordenadas y propone el modelo:
//    qué es cada cosa (muro exterior, tabique, probable estructural, ventana,
//    balconera, puerta, baño, cocina…) y dónde está, en píxeles.
// 2. El código ajusta cada muro a los píxeles oscuros reales del plano (eje y
//    grosor), cierra las uniones en T y lleva el contorno a la cara exterior.
// 3. La escala sale de los m² construidos o, si el plano trae cotas legibles y
//    coherentes, de las cotas (mandan sobre el Catastro).

import sharp from 'sharp'
import Anthropic from '@anthropic-ai/sdk'
import {
  areaPoligono, dist, proyeccion,
  type ModeloEstadoActual, type Muro, type Hueco, type Estancia, type Punto, type Operacion,
  type TipoHueco, type UsoEstancia, type TipoMuro, type Duda,
  dudasDelSistema, dudaEstadoActual,
} from './modelo'
import { svgModelo } from './svg'

export const MODELO_IA = 'claude-opus-5-5'
const LADO_MAX = 2000

// ── Imagen ───────────────────────────────────────────────────────────────────

export type ImagenPlano = { png: Buffer; ancho: number; alto: number; gris: Uint8Array }

export async function prepararImagen(entrada: Buffer): Promise<ImagenPlano> {
  const base = sharp(entrada, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' })
  const meta = await base.metadata()
  const escala = Math.min(1, LADO_MAX / Math.max(meta.width ?? LADO_MAX, meta.height ?? LADO_MAX))
  const redim = base.resize({
    width: Math.round((meta.width ?? LADO_MAX) * escala),
    height: Math.round((meta.height ?? LADO_MAX) * escala),
  })
  const png = await redim.clone().png().toBuffer()
  const { data, info } = await redim.clone().grayscale().raw().toBuffer({ resolveWithObject: true })
  return { png, ancho: info.width, alto: info.height, gris: new Uint8Array(data) }
}

/** El plano con una cuadrícula de coordenadas encima: así la IA lee posiciones en píxeles del original. */
export async function conCuadricula(img: ImagenPlano): Promise<Buffer> {
  const { ancho, alto } = img
  const l: string[] = []
  for (let x = 50; x < ancho; x += 50) {
    const fuerte = x % 100 === 0
    l.push(`<line x1="${x}" y1="0" x2="${x}" y2="${alto}" stroke="${fuerte ? '#ff3b30' : '#ffb3ae'}" stroke-width="${fuerte ? 1 : 0.6}" stroke-opacity="0.55"/>`)
    if (fuerte) for (let y = 14; y < alto; y += 200) l.push(`<text x="${x + 2}" y="${y}" font-family="Arial" font-size="11" fill="#d70015">${x}</text>`)
  }
  for (let y = 50; y < alto; y += 50) {
    const fuerte = y % 100 === 0
    l.push(`<line x1="0" y1="${y}" x2="${ancho}" y2="${y}" stroke="${fuerte ? '#0a64ff' : '#a9c8ff'}" stroke-width="${fuerte ? 1 : 0.6}" stroke-opacity="0.55"/>`)
    if (fuerte) for (let x = 4; x < ancho; x += 200) l.push(`<text x="${x}" y="${y - 2}" font-family="Arial" font-size="11" fill="#0040c0">${y}</text>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">${l.join('')}</svg>`
  return sharp(img.png).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
}

export async function conModelo(img: ImagenPlano, m: ModeloEstadoActual): Promise<Buffer> {
  const svg = svgModelo(m, { etiquetas: true })
  return sharp(img.png).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
}

// ── Máscara de muros y ajuste ────────────────────────────────────────────────

/** Píxeles de muro: oscuros, con un cierre morfológico para rellenar los muros rayados. */
export function mascaraMuros(img: ImagenPlano, umbral = 150, radio = 2): Uint8Array {
  const { ancho: w, alto: h, gris } = img
  const m = new Uint8Array(w * h)
  for (let i = 0; i < m.length; i++) m[i] = gris[i] < umbral ? 1 : 0
  return erosion(dilatacion(m, w, h, radio), w, h, radio)
}

function filtroCaja(m: Uint8Array, w: number, h: number, r: number, todos: boolean): Uint8Array {
  // Separable: primero filas, luego columnas. «todos» = erosión, si no = dilatación.
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h)
  const vent = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let s = 0
    for (let x = -r; x <= r; x++) if (x >= 0 && x < w) s += m[y * w + x]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = todos ? (s === vent ? 1 : 0) : (s > 0 ? 1 : 0)
      const sale = x - r, entra = x + r + 1
      if (sale >= 0) s -= m[y * w + sale]
      if (entra < w) s += m[y * w + entra]
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0
    for (let y = -r; y <= r; y++) if (y >= 0 && y < h) s += tmp[y * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = todos ? (s === vent ? 1 : 0) : (s > 0 ? 1 : 0)
      const sale = y - r, entra = y + r + 1
      if (sale >= 0) s -= tmp[sale * w + x]
      if (entra < h) s += tmp[entra * w + x]
    }
  }
  return out
}
const dilatacion = (m: Uint8Array, w: number, h: number, r: number) => filtroCaja(m, w, h, r, false)
const erosion = (m: Uint8Array, w: number, h: number, r: number) => filtroCaja(m, w, h, r, true)

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

type Corte = { centro: number; ancho: number; min: number; max: number }

/** Corte perpendicular al eje en un punto: el tramo de muro más cercano a 0 (en px a lo largo de la normal). */
function corte(mask: Uint8Array, w: number, h: number, p: Punto, n: Punto, R: number): Corte | null {
  const val = (s: number) => {
    const x = Math.round(p.x + n.x * s), y = Math.round(p.y + n.y * s)
    return x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0
  }
  let mejor: Corte | null = null
  let s = -R
  while (s <= R) {
    if (val(s)) {
      const ini = s
      while (s <= R + 30 && val(s)) s++
      const fin = s - 1
      const c = { centro: (ini + fin) / 2, ancho: fin - ini + 1, min: ini, max: fin }
      if (!mejor || Math.abs(c.centro) < Math.abs(mejor.centro)) mejor = c
    }
    s++
  }
  return mejor
}

/** Ajusta el eje y el grosor de un muro a la máscara. Si no encuentra muro claro, lo deja como estaba. */
export function ajustarMuro(mask: Uint8Array, w: number, h: number, muro: Muro): { muro: Muro; ajustado: boolean } {
  const L = dist(muro.a, muro.b)
  if (L < 8) return { muro, ajustado: false }
  const d = { x: (muro.b.x - muro.a.x) / L, y: (muro.b.y - muro.a.y) / L }
  const n = { x: -d.y, y: d.x }
  const R = Math.max(10, Math.min(28, muro.grosorPx * 1.5))
  const cortes: Corte[] = []
  const N = Math.min(60, Math.max(6, Math.floor(L / 4)))
  for (let i = 0; i < N; i++) {
    const t = 0.12 + 0.76 * (i / (N - 1))
    const c = corte(mask, w, h, { x: muro.a.x + d.x * L * t, y: muro.a.y + d.y * L * t }, n, R)
    if (c && c.ancho <= 40) cortes.push(c)
  }
  // Huecos (ventanas, puertas) dejan tramos sin muro: basta con un 35 % de cortes.
  if (cortes.length < N * 0.35) return { muro, ajustado: false }
  const off = mediana(cortes.map(c => c.centro))
  const grosor = mediana(cortes.map(c => c.ancho))
  return {
    muro: {
      ...muro,
      a: { x: muro.a.x + n.x * off, y: muro.a.y + n.y * off },
      b: { x: muro.b.x + n.x * off, y: muro.b.y + n.y * off },
      grosorPx: grosor,
    },
    ajustado: true,
  }
}

/** Lleva los extremos sueltos de cada muro al eje del muro con el que se encuentran (uniones en T y en L). */
export function cerrarUniones(muros: Muro[], tolerancia = 16): Muro[] {
  const out = muros.map(m => ({ ...m, a: { ...m.a }, b: { ...m.b } }))
  for (const m of out) {
    for (const extremo of ['a', 'b'] as const) {
      const p = m[extremo]
      let mejor: { q: Punto; d: number } | null = null
      for (const o of out) {
        if (o === m) continue
        const L = dist(o.a, o.b)
        if (L < 8) continue
        const t = proyeccion(p, o.a, o.b)
        const q = { x: o.a.x + (o.b.x - o.a.x) * t, y: o.a.y + (o.b.y - o.a.y) * t }
        const dd = dist(p, q)
        // Solo con muros no paralelos: unir dos colineales los alargaría.
        const cos = Math.abs(((m.b.x - m.a.x) * (o.b.x - o.a.x) + (m.b.y - m.a.y) * (o.b.y - o.a.y)) / (dist(m.a, m.b) * L || 1))
        if (cos > 0.5) continue
        if (dd <= tolerancia && (!mejor || dd < mejor.d)) mejor = { q, d: dd }
      }
      if (mejor) m[extremo] = mejor.q
    }
  }
  return out
}

/** Desplaza cada lado del contorno hasta la cara exterior del muro y recalcula los vértices. */
export function ajustarContorno(mask: Uint8Array, w: number, h: number, contorno: Punto[]): Punto[] {
  const k = contorno.length
  if (k < 3) return contorno
  let s = 0
  for (let i = 0; i < k; i++) { const a = contorno[i], b = contorno[(i + 1) % k]; s += a.x * b.y - b.x * a.y }
  const sentido = s > 0 ? 1 : -1                     // >0: horario en pantalla (y hacia abajo)
  const lineas: { p: Punto; d: Punto }[] = []
  for (let i = 0; i < k; i++) {
    const a = contorno[i], b = contorno[(i + 1) % k]
    const L = dist(a, b)
    const d = { x: (b.x - a.x) / (L || 1), y: (b.y - a.y) / (L || 1) }
    const nExt = { x: d.y * sentido, y: -d.x * sentido } // normal hacia fuera
    const desps: number[] = []
    const N = Math.min(40, Math.max(4, Math.floor(L / 6)))
    for (let j = 0; j < N; j++) {
      const t = 0.15 + 0.7 * (j / Math.max(1, N - 1))
      const c = corte(mask, w, h, { x: a.x + d.x * L * t, y: a.y + d.y * L * t }, nExt, 22)
      if (c && c.ancho <= 45) desps.push(c.max)        // cara exterior = extremo más hacia fuera
    }
    const off = desps.length >= N * 0.35 ? mediana(desps) : 0
    lineas.push({ p: { x: a.x + nExt.x * off, y: a.y + nExt.y * off }, d })
  }
  const out: Punto[] = []
  for (let i = 0; i < k; i++) {
    const l1 = lineas[(i - 1 + k) % k], l2 = lineas[i]
    const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x
    if (Math.abs(den) < 1e-3) { out.push(l2.p); continue }
    const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den
    const q = { x: l1.p.x + l1.d.x * t, y: l1.p.y + l1.d.y * t }
    // Si el desplazamiento se dispara (lados casi paralelos), quedarse con el vértice original.
    out.push(dist(q, contorno[i]) > 40 ? contorno[i] : q)
  }
  return out
}

// ── IA: levantamiento ────────────────────────────────────────────────────────

const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: 'null' }] })
const PUNTO = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } }

const OPERACION_IA = {
  type: 'object', additionalProperties: false,
  required: ['op', 'id', 'tipo_muro', 'tipo_hueco', 'muro', 'a', 'b', 'nombre', 'uso', 'falso_techo', 'poligono', 'valor'],
  properties: {
    op: { type: 'string', enum: ['actualizar_muro', 'eliminar_muro', 'crear_muro', 'actualizar_hueco', 'eliminar_hueco', 'crear_hueco', 'actualizar_estancia', 'eliminar_estancia', 'crear_estancia', 'altura'] },
    id: nullable({ type: 'string' }),
    tipo_muro: nullable({ type: 'string', enum: ['exterior', 'tabique', 'estructural'] }),
    tipo_hueco: nullable({ type: 'string', enum: ['ventana', 'balconera', 'puerta', 'entrada'] }),
    muro: nullable({ type: 'string' }),
    a: nullable(PUNTO), b: nullable(PUNTO),
    nombre: nullable({ type: 'string' }),
    uso: nullable({ type: 'string', enum: ['bano', 'aseo', 'cocina', 'estancia', 'paso', 'exterior'] }),
    falso_techo: nullable({ type: 'boolean' }),
    poligono: nullable({ type: 'array', items: PUNTO }),
    valor: nullable({ type: 'number', description: 'Solo para op=altura: altura libre en metros.' }),
  }
}

// Acciones de un clic para resolver dudas. Mucho más pequeñas que OPERACION_IA a
// propósito: con la operación completa anidada, la gramática del esquema supera el
// límite de la API («compiled grammar is too large»).
const ACCION_DUDA = {
  type: 'object', additionalProperties: false, required: ['accion', 'elemento', 'valor'],
  properties: {
    accion: { type: 'string', enum: ['tipo_muro', 'tipo_hueco', 'uso_estancia', 'falso_techo', 'eliminar'] },
    elemento: { type: 'string', description: 'id del muro, hueco o estancia' },
    valor: nullable({ type: 'string', description: 'tipo_muro: exterior|tabique|estructural · tipo_hueco: ventana|balconera|puerta|entrada · uso_estancia: bano|aseo|cocina|estancia|paso|exterior · falso_techo: si|no · eliminar: null' }),
  },
}

const ESQUEMA_LEVANTAMIENTO = {
  type: 'object',
  additionalProperties: false,
  required: ['estado_actual_probable', 'avisos', 'dudas', 'cotas', 'contorno', 'muros', 'huecos', 'estancias'],
  properties: {
    estado_actual_probable: { type: 'boolean', description: 'false si el plano parece una propuesta o un estado reformado (mobiliario de diseño, cotas de proyecto…) en vez del estado actual.' },
    avisos: { type: 'array', items: { type: 'string' }, description: 'Notas generales que NO son una pregunta sobre un elemento concreto (p. ej. «sin cotas legibles»). Cortas, en español.' },
    dudas: {
      type: 'array',
      description: 'Cada cosa que no tienes clara sobre elementos concretos, como pregunta con 2 o 3 respuestas de un clic. No incluyas aquí los muros estructural_probable: de esos ya pregunta el sistema.',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'elementos', 'pregunta', 'opciones'],
        properties: {
          id: { type: 'string', description: 'D1, D2…' },
          elementos: { type: 'array', items: { type: 'string' }, description: 'ids de los muros, huecos o estancias afectados' },
          pregunta: { type: 'string', description: 'Pregunta corta y concreta, en español, nombrando los ids.' },
          opciones: {
            type: 'array',
            description: '2 o 3 respuestas. La primera, la más probable. Cada una con las acciones que aplica (lista vacía si la respuesta es dejarlo como está).',
            items: {
              type: 'object', additionalProperties: false, required: ['etiqueta', 'acciones'],
              properties: { etiqueta: { type: 'string' }, acciones: { type: 'array', items: ACCION_DUDA } },
            },
          },
        },
      },
    },
    cotas: {
      type: 'array',
      description: 'Cotas legibles del plano (máx. 4, las más largas), con los extremos de su línea de cota.',
      items: { type: 'object', additionalProperties: false, required: ['valor_m', 'a', 'b'], properties: { valor_m: { type: 'number' }, a: PUNTO, b: PUNTO } },
    },
    contorno: { type: 'array', items: PUNTO, description: 'Polígono de la CARA EXTERIOR de fachadas y medianeras de la vivienda, sin balcones ni terrazas descubiertas. Vértices en orden.' },
    muros: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'a', 'b', 'tipo', 'grosor_px', 'nota'],
        properties: {
          id: { type: 'string', description: 'M1, M2…' },
          a: PUNTO, b: PUNTO,
          tipo: { type: 'string', enum: ['exterior', 'tabique', 'estructural_probable'] },
          grosor_px: { type: 'number' },
          nota: nullable({ type: 'string', description: 'Solo si es estructural_probable o hay duda: por qué.' }),
        },
      },
    },
    huecos: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'tipo', 'muro', 'a', 'b'],
        properties: {
          id: { type: 'string', description: 'V1… ventanas y balconeras, P1… puertas interiores, E1 entrada' },
          tipo: { type: 'string', enum: ['ventana', 'balconera', 'puerta', 'entrada'] },
          muro: { type: 'string', description: 'id del muro en el que está' },
          a: PUNTO, b: PUNTO,
        },
      },
    },
    estancias: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'nombre', 'uso', 'poligono', 'armarios'],
        properties: {
          id: { type: 'string', description: 'S1, S2…' },
          nombre: { type: 'string' },
          uso: { type: 'string', enum: ['bano', 'aseo', 'cocina', 'estancia', 'paso', 'exterior'] },
          poligono: { type: 'array', items: PUNTO },
          armarios: { type: 'integer', description: 'Armarios empotrados completos dibujados en la estancia (por armario, no por módulo ni por hoja).' },
        },
      },
    },
  },
}

const SISTEMA_LEVANTAMIENTO = `Eres un arquitecto técnico que levanta el estado actual de una vivienda a partir del plano de un anuncio o de un croquis, para presupuestar su DEMOLICIÓN.

La imagen lleva superpuesta una cuadrícula: líneas cada 50 px y números cada 100 px (rojos = x, azules = y). Todas las coordenadas que devuelvas son píxeles de esa imagen, con el origen arriba a la izquierda y la y hacia abajo. Lee las posiciones contra la cuadrícula con cuidado: la precisión importa.

Qué modelar (y nada más):
- CONTORNO: polígono por la cara EXTERIOR de fachadas y medianeras. No incluyas balcones, terrazas descubiertas ni patios.
- MUROS como segmentos por su EJE (centro del grosor), de esquina a esquina:
  · exterior: fachadas y medianeras (el borde de la vivienda).
  · tabique: particiones interiores finas que se pueden demoler.
  · estructural_probable: muros interiores igual de gruesos que las fachadas o más, muros que continúan una línea de fachada o de patio, o junto a pilares. En caso de duda, márcalo estructural_probable y explica por qué en "nota": demoler uno por error es grave.
  · Un muro termina donde se encuentra con otro: en las uniones en T, el extremo va al eje del muro con el que choca.
  · No partas un muro por sus puertas o ventanas: es un solo segmento y los huecos van aparte.
  · Los frentes de armario (puertas de armario) NO son muros. Los laterales de armario sí, si están dibujados como muro.
  · No dibujes muebles, sanitarios, encimeras ni electrodomésticos.
- HUECOS: cada ventana, balconera (ventana que llega al suelo o da a un balcón o terraza), puerta interior y la puerta de entrada, con sus dos extremos sobre el eje del muro en el que están y el id de ese muro. Las puertas de armario no son huecos.
- ESTANCIAS: polígono interior de cada recinto (dormitorio, salón, cocina, baño, aseo, pasillo, vestidor…) con su uso. Baño = tiene ducha o bañera; aseo = solo lavabo e inodoro. Pasillos y distribuidores = paso. Cuenta los ARMARIOS EMPOTRADOS de cada estancia (por armario completo, no por hojas ni módulos); no los modeles. Balcones y terrazas = exterior. Si la cocina está abierta a otra estancia, crea IGUALMENTE una estancia de uso cocina con el polígono de su zona (muebles y el paso delante) y quítala de la otra: los cálculos necesitan saber dónde está la cocina.
- COTAS: si el plano trae cotas legibles, devuelve hasta 4 (las más largas) con los extremos de su línea de cota. Sirven para la escala.

Si algo es ambiguo, modélalo con la opción más probable y añade una DUDA con 2 o 3 respuestas de un clic que lo resuelvan, cada una con sus acciones sobre los ids que acabas de crear. Ejemplo: elementos ["V4"], pregunta "¿V4 es una ventana o una balconera que llega al suelo?", opciones "Ventana" (sin acciones, porque ya está así) y "Balconera" (acción tipo_hueco, elemento V4, valor balconera). Pregunta solo lo que afecte a la demolición. Si el plano parece un estado reformado o una propuesta (mobiliario de diseño, cotas de proyecto), pon estado_actual_probable = false.`

export type DatosLevantamiento = {
  /** m² construidos conocidos (Catastro o anuncio). */
  m2Construidos: number | null
  /** true si esos m² incluyen zonas comunes (Catastro, anuncios): se descuenta un 6 %. */
  incluyeComunes: boolean
  alturaLibre: number | null
}

export const DESCUENTO_COMUNES = 0.06

function textoDe(msg: Anthropic.Message): string {
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('')
}

type LevantamientoIA = {
  estado_actual_probable: boolean
  avisos: string[]
  dudas: { id: string; elementos: string[]; pregunta: string; opciones: { etiqueta: string; acciones: { accion: string; elemento: string; valor: string | null }[] }[] }[]
  cotas: { valor_m: number; a: Punto; b: Punto }[]
  contorno: Punto[]
  muros: { id: string; a: Punto; b: Punto; tipo: 'exterior' | 'tabique' | 'estructural_probable'; grosor_px: number; nota: string | null }[]
  huecos: { id: string; tipo: TipoHueco; muro: string; a: Punto; b: Punto }[]
  estancias: { id: string; nombre: string; uso: UsoEstancia; poligono: Punto[]; armarios: number }[]
}

export async function levantarModelo(img: ImagenPlano, datos: DatosLevantamiento): Promise<{ modelo: ModeloEstadoActual; bruto: LevantamientoIA; uso: Anthropic.Usage }> {
  const cuadricula = await conCuadricula(img)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
  const msg = await client.messages.stream({
    model: MODELO_IA,
    max_tokens: 32000,
    system: SISTEMA_LEVANTAMIENTO,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: ESQUEMA_LEVANTAMIENTO } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: cuadricula.toString('base64') } },
        { type: 'text', text: `Imagen de ${img.ancho} × ${img.alto} px.${datos.m2Construidos ? ` Superficie construida aproximada: ${datos.m2Construidos} m².` : ''} Levanta el estado actual.` },
      ],
    }],
  } as Anthropic.MessageStreamParams).finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('La IA ha rechazado leer este plano.')
  const bruto = JSON.parse(textoDe(msg)) as LevantamientoIA

  // Ajuste a píxeles
  const mask = mascaraMuros(img)
  const muros0: Muro[] = bruto.muros.map(w => ({
    id: w.id, a: w.a, b: w.b,
    tipo: (w.tipo === 'estructural_probable' ? 'estructural' : w.tipo) as TipoMuro,
    estructuralProbable: w.tipo === 'estructural_probable',
    grosorPx: w.grosor_px > 0 ? w.grosor_px : 10,
    nota: w.nota,
  }))
  const ajustados = muros0.map(w => ajustarMuro(mask, img.ancho, img.alto, w))
  const muros = cerrarUniones(ajustados.map(r => r.muro))
  const contorno = ajustarContorno(mask, img.ancho, img.alto, bruto.contorno)

  // Huecos: extremos proyectados sobre el eje ajustado de su muro
  const porId = new Map(muros.map(w => [w.id, w]))
  const huecos: Hueco[] = bruto.huecos.filter(hu => porId.has(hu.muro)).map(hu => {
    const w = porId.get(hu.muro)!
    const pr = (p: Punto) => { const t = proyeccion(p, w.a, w.b); return { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t } }
    return { id: hu.id, tipo: hu.tipo, muro: hu.muro, a: pr(hu.a), b: pr(hu.b) }
  })
  const estancias: Estancia[] = bruto.estancias.map(e => ({ id: e.id, nombre: e.nombre, uso: e.uso, poligono: e.poligono, falsoTecho: false, armarios: Math.max(0, Math.round(e.armarios ?? 0)) }))

  // Escala
  const avisos = [...bruto.avisos]
  const areaPx = areaPoligono(contorno)
  const m2Privado = datos.m2Construidos ? datos.m2Construidos * (datos.incluyeComunes ? 1 - DESCUENTO_COMUNES : 1) : null
  const ppmSup = m2Privado ? Math.sqrt(areaPx / m2Privado) : null
  const ppmCotas = bruto.cotas.filter(c => c.valor_m > 1).map(c => dist(c.a, c.b) / c.valor_m)
  let escala: ModeloEstadoActual['escala']
  const coherentes = ppmCotas.length >= 2 && Math.max(...ppmCotas) / Math.min(...ppmCotas) < 1.06
  if (coherentes) {
    const ppm = mediana(ppmCotas)
    escala = { pxPorMetro: ppm, metodo: 'cota', detalle: `${ppmCotas.length} cotas del plano (mediana ${ppm.toFixed(1)} px/m)` }
    if (ppmSup) {
      const m2Cotas = areaPx / (ppm * ppm)
      const dif = (m2Cotas - m2Privado!) / m2Privado! * 100
      if (Math.abs(dif) > 8) avisos.push(`Con las cotas salen ${m2Cotas.toFixed(0)} m² construidos frente a ${m2Privado!.toFixed(0)} m² declarados (${dif > 0 ? '+' : ''}${dif.toFixed(0)} %). Manda la cota.`)
    }
  } else if (ppmSup) {
    escala = { pxPorMetro: ppmSup, metodo: 'superficie', detalle: `${m2Privado!.toFixed(1)} m² construidos${datos.incluyeComunes ? ` (${datos.m2Construidos} − ${DESCUENTO_COMUNES * 100} % de comunes)` : ''} ÷ área del contorno` }
  } else {
    throw new Error('Sin escala: indica los m² construidos o sube un plano con cotas.')
  }
  const sinAjustar = ajustados.filter(r => !r.ajustado).map(r => r.muro.id)

  // Dudas: las de la IA (solo con elementos que existen) + las del sistema
  const idsValidos = new Set([...muros.map(w => w.id), ...huecos.map(h => h.id), ...estancias.map(e => e.id)])
  const dudas: Duda[] = (bruto.dudas ?? [])
    .map(d => ({
      id: d.id, elementos: d.elementos.filter(e => idsValidos.has(e)), pregunta: d.pregunta, origen: 'ia' as const, estado: 'pendiente' as const,
      opciones: d.opciones.slice(0, 3).map(o => ({ etiqueta: o.etiqueta, operaciones: o.acciones.map(a => deAccion(a, muros, huecos, estancias)).filter((x): x is Operacion => x !== null) })),
    }))
    .filter(d => d.opciones.length >= 2)

  const modelo: ModeloEstadoActual = {
      version: 1,
      imagen: { ancho: img.ancho, alto: img.alto },
      escala,
      contorno,
      alturaLibre: datos.alturaLibre ?? 2.6,
      muros,
      huecos,
      estancias,
      avisos,
      dudas,
      dudaEstadoActual: !bruto.estado_actual_probable,
  }
  modelo.dudas.push(...dudasDelSistema(modelo, sinAjustar))
  if (modelo.dudaEstadoActual) modelo.dudas.unshift(dudaEstadoActual(modelo.dudas.map(d => d.id)))
  return { modelo, bruto, uso: msg.usage }
}

// ── IA: correcciones por chat ────────────────────────────────────────────────

const ESQUEMA_CORRECCION = {
  type: 'object',
  additionalProperties: false,
  required: ['respuesta', 'operaciones'],
  properties: {
    respuesta: { type: 'string', description: 'Qué has cambiado, en una o dos frases, en español y con los ids. Si no hace falta cambiar nada o no lo ves claro, dilo.' },
    operaciones: {
      type: 'array',
      items: {
        ...OPERACION_IA,
      },
    },
  },
}

const SISTEMA_CORRECCION = `Eres el mismo arquitecto que levantó la maqueta del estado actual de una vivienda desde su plano. La persona la está revisando y te señala algo que no cuadra.

Recibes dos imágenes: el plano original con cuadrícula de coordenadas (líneas cada 50 px, números cada 100 px) y el mismo plano con tu modelo dibujado encima (muros con su id: gris = exterior, naranja = tabique, morado = estructural; huecos en cian = ventana/balconera, verde = puerta, amarillo = entrada; estancias coloreadas con su id). También el modelo en JSON. Las coordenadas son píxeles del plano.

Mira con atención la zona que te indican en el plano original, compara con tu modelo y devuelve SOLO las operaciones necesarias para corregirlo, sin tocar lo demás. Reglas:
- Muros por su eje; los huecos van sobre el eje de su muro, con el id del muro.
- Un muro estructural no se convierte en tabique salvo que la persona lo diga expresamente.
- Si la persona se equivoca o no ves lo que dice, no cambies nada y explícalo en la respuesta.`

export type MensajeChat = { rol: 'usuario' | 'ia'; texto: string }

export async function corregirModelo(img: ImagenPlano, modelo: ModeloEstadoActual, mensaje: string, historial: MensajeChat[]): Promise<{ respuesta: string; operaciones: Operacion[] }> {
  const [cuadricula, encima] = await Promise.all([conCuadricula(img), conModelo(img, modelo)])
  const r = (p: Punto) => ({ x: Math.round(p.x), y: Math.round(p.y) })
  const compacto = {
    alturaLibre: modelo.alturaLibre,
    pxPorMetro: Math.round(modelo.escala.pxPorMetro * 10) / 10,
    muros: modelo.muros.map(w => ({ id: w.id, tipo: w.tipo, a: r(w.a), b: r(w.b), largo_m: Math.round(dist(w.a, w.b) / modelo.escala.pxPorMetro * 100) / 100 })),
    huecos: modelo.huecos.map(h => ({ id: h.id, tipo: h.tipo, muro: h.muro, a: r(h.a), b: r(h.b), ancho_m: Math.round(dist(h.a, h.b) / modelo.escala.pxPorMetro * 100) / 100 })),
    estancias: modelo.estancias.map(e => ({ id: e.id, nombre: e.nombre, uso: e.uso, falsoTecho: e.falsoTecho, poligono: e.poligono.map(r) })),
  }
  const previo = historial.slice(-6).map(m => `${m.rol === 'usuario' ? 'Persona' : 'Tú'}: ${m.texto}`).join('\n')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
  const msg = await client.messages.stream({
    model: MODELO_IA,
    max_tokens: 16000,
    system: SISTEMA_CORRECCION,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: ESQUEMA_CORRECCION } },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Plano original con cuadrícula:' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: cuadricula.toString('base64') } },
        { type: 'text', text: 'Tu modelo dibujado encima:' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encima.toString('base64') } },
        { type: 'text', text: `Modelo actual (JSON):\n${JSON.stringify(compacto)}\n\n${previo ? `Conversación previa:\n${previo}\n\n` : ''}La persona dice: «${mensaje}»` },
      ],
    }],
  } as Anthropic.MessageStreamParams).finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('La IA ha rechazado esta corrección.')
  const out = JSON.parse(textoDe(msg)) as { respuesta: string; operaciones: Record<string, unknown>[] }
  return { respuesta: out.respuesta, operaciones: out.operaciones.map(aOperacion).filter((o): o is Operacion => o !== null) }
}

/** Acción de una duda → operación del modelo, validando que el elemento y el valor existen. */
function deAccion(a: { accion: string; elemento: string; valor: string | null }, muros: Muro[], huecos: Hueco[], estancias: Estancia[]): Operacion | null {
  const esMuro = muros.some(w => w.id === a.elemento), esHueco = huecos.some(h => h.id === a.elemento), esEstancia = estancias.some(e => e.id === a.elemento)
  switch (a.accion) {
    case 'tipo_muro':
      if (!esMuro || !['exterior', 'tabique', 'estructural'].includes(a.valor ?? '')) return null
      return a.valor === 'estructural' ? { op: 'confirmar_estructural', id: a.elemento } : { op: 'actualizar_muro', id: a.elemento, tipo: a.valor as TipoMuro }
    case 'tipo_hueco':
      if (!esHueco || !['ventana', 'balconera', 'puerta', 'entrada'].includes(a.valor ?? '')) return null
      return { op: 'actualizar_hueco', id: a.elemento, tipo: a.valor as TipoHueco }
    case 'uso_estancia':
      if (!esEstancia || !['bano', 'aseo', 'cocina', 'estancia', 'paso', 'exterior'].includes(a.valor ?? '')) return null
      return { op: 'actualizar_estancia', id: a.elemento, uso: a.valor as UsoEstancia }
    case 'falso_techo':
      if (!esEstancia) return null
      return { op: 'actualizar_estancia', id: a.elemento, falsoTecho: a.valor === 'si' }
    case 'eliminar':
      if (esMuro) return { op: 'eliminar_muro', id: a.elemento }
      if (esHueco) return { op: 'eliminar_hueco', id: a.elemento }
      if (esEstancia) return { op: 'eliminar_estancia', id: a.elemento }
      return null
    default:
      return null
  }
}

function aOperacion(o: Record<string, unknown>): Operacion | null {
  const P = (k: string) => (o[k] as Punto | null) ?? undefined
  const S = (k: string) => (o[k] as string | null) ?? undefined
  switch (o.op) {
    case 'actualizar_muro': return o.id ? { op: 'actualizar_muro', id: S('id')!, tipo: S('tipo_muro') as TipoMuro | undefined, a: P('a'), b: P('b') } : null
    case 'eliminar_muro': return o.id ? { op: 'eliminar_muro', id: S('id')! } : null
    case 'crear_muro': return o.a && o.b ? { op: 'crear_muro', tipo: (S('tipo_muro') as TipoMuro) ?? 'tabique', a: P('a')!, b: P('b')! } : null
    case 'actualizar_hueco': return o.id ? { op: 'actualizar_hueco', id: S('id')!, tipo: S('tipo_hueco') as TipoHueco | undefined, a: P('a'), b: P('b') } : null
    case 'eliminar_hueco': return o.id ? { op: 'eliminar_hueco', id: S('id')! } : null
    case 'crear_hueco': return o.muro && o.a && o.b ? { op: 'crear_hueco', tipo: (S('tipo_hueco') as TipoHueco) ?? 'ventana', muro: S('muro')!, a: P('a')!, b: P('b')! } : null
    case 'actualizar_estancia': return o.id ? { op: 'actualizar_estancia', id: S('id')!, nombre: S('nombre'), uso: S('uso') as UsoEstancia | undefined, falsoTecho: (o.falso_techo as boolean | null) ?? undefined, poligono: (o.poligono as Punto[] | null) ?? undefined } : null
    case 'eliminar_estancia': return o.id ? { op: 'eliminar_estancia', id: S('id')! } : null
    case 'crear_estancia': return o.poligono ? { op: 'crear_estancia', nombre: S('nombre') ?? 'Estancia', uso: (S('uso') as UsoEstancia) ?? 'estancia', poligono: o.poligono as Punto[], falsoTecho: (o.falso_techo as boolean | null) ?? false } : null
    case 'altura': return typeof o.valor === 'number' ? { op: 'altura', valor: o.valor } : null
    default: return null
  }
}

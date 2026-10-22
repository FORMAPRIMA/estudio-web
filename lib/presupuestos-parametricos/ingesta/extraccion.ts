// Ingesta · paso 1: extraer las partidas del PDF de un constructor (solo servidor).
//
// Dos pasadas:
// 1. Cabecera y resumen (PDF entero, salida pequeña): constructor, fecha, totales
//    por capítulo, total sin IVA y márgenes, comisiones o descuentos declarados.
// 2. Partidas por bloques de páginas, en paralelo: solo las partidas con importe
//    (las líneas de capítulo y subcapítulo no), con su capítulo y subcapítulo.
// Después, control de sumas: cada capítulo extraído tiene que dar lo que dice el
// resumen. Si no cuadra, se avisa antes de seguir (señal de partidas perdidas).

import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'

export const MODELO_INGESTA = 'claude-opus-5-5'
const PAGINAS_POR_BLOQUE = 5
const EN_PARALELO = 4

const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: 'null' }] })

const ESQUEMA_CABECERA = {
  type: 'object', additionalProperties: false,
  required: ['constructor', 'fecha', 'obra', 'total_sin_iva', 'capitulos', 'margenes', 'avisos'],
  properties: {
    constructor: nullable({ type: 'string' }),
    fecha: nullable({ type: 'string', description: 'Fecha del presupuesto en formato AAAA-MM-DD.' }),
    obra: nullable({ type: 'string', description: 'Nombre o dirección de la obra.' }),
    total_sin_iva: nullable({ type: 'number' }),
    capitulos: {
      type: 'array', description: 'Capítulos del resumen, en orden, con su importe sin IVA.',
      items: { type: 'object', additionalProperties: false, required: ['codigo', 'nombre', 'importe'], properties: { codigo: { type: 'string' }, nombre: { type: 'string' }, importe: { type: 'number' } } },
    },
    margenes: {
      type: 'array', description: 'Márgenes, comisiones, honorarios, gastos generales o beneficio industrial en %, o descuentos, si aparecen declarados.',
      items: { type: 'object', additionalProperties: false, required: ['concepto', 'pct', 'importe'], properties: { concepto: { type: 'string' }, pct: nullable({ type: 'number' }), importe: nullable({ type: 'number' }) } },
    },
    avisos: { type: 'array', items: { type: 'string' } },
  },
}

const ESQUEMA_PARTIDAS = {
  type: 'object', additionalProperties: false, required: ['partidas'],
  properties: {
    partidas: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['codigo', 'capitulo_codigo', 'capitulo', 'subcapitulo', 'descripcion', 'unidad', 'medicion', 'precio', 'importe', 'pagina', 'es_margen'],
        properties: {
          codigo: nullable({ type: 'string' }),
          capitulo_codigo: nullable({ type: 'string', description: 'Código del capítulo al que pertenece, p. ej. C02.' }),
          capitulo: { type: 'string' },
          subcapitulo: nullable({ type: 'string' }),
          descripcion: { type: 'string', description: 'Título de la partida y lo esencial de su descripción (material, sistema, marca o modelo), máximo 300 caracteres.' },
          unidad: nullable({ type: 'string' }),
          medicion: nullable({ type: 'number' }),
          precio: nullable({ type: 'number' }),
          importe: { type: 'number' },
          pagina: { type: 'integer' },
          es_margen: { type: 'boolean', description: 'true si la línea es un margen, comisión, beneficio industrial, gastos generales en % o descuento, no una unidad de obra.' },
        },
      },
    },
  },
}

const SISTEMA = `Eres un técnico de mediciones y presupuestos de reformas de vivienda en Madrid. Lees presupuestos de constructores (PDF) y los conviertes en datos estructurados con exactitud contable.

Reglas:
- Los números van en formato español en el PDF (1.234,56 €): devuélvelos como número (1234.56).
- Solo cuentan las PARTIDAS: líneas con unidad, cantidad, precio e importe. Las líneas de capítulo y subcapítulo que solo suman no son partidas.
- Partidas a importe cero: no las incluyas.
- Si una partida aparece partida entre dos páginas, inclúyela una sola vez, en la página donde empieza.
- No inventes nada: si un dato no aparece, null.`

export type Cabecera = {
  constructor: string | null; fecha: string | null; obra: string | null; total_sin_iva: number | null
  capitulos: { codigo: string; nombre: string; importe: number }[]
  margenes: { concepto: string; pct: number | null; importe: number | null }[]
  avisos: string[]
}

export type PartidaExtraida = {
  codigo: string | null; capitulo_codigo: string | null; capitulo: string; subcapitulo: string | null
  descripcion: string; unidad: string | null; medicion: number | null; precio: number | null; importe: number
  pagina: number; es_margen: boolean
}

export type ControlCapitulo = { codigo: string; nombre: string; resumen: number; extraido: number; diferencia: number; cuadra: boolean }

export type Extraccion = {
  cabecera: Cabecera
  partidas: PartidaExtraida[]
  control: ControlCapitulo[]
  sumaPartidas: number
  cuadraTotal: boolean
  avisos: string[]
  paginas: number
}

function texto(msg: Anthropic.Message): string {
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('')
}

async function llamar<T>(client: Anthropic, pdf: Buffer, instruccion: string, esquema: Record<string, unknown>, maxTokens: number): Promise<T> {
  const msg = await client.messages.stream({
    model: MODELO_INGESTA,
    max_tokens: maxTokens,
    system: SISTEMA,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema } },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
        { type: 'text', text: instruccion },
      ],
    }],
  } as Anthropic.MessageStreamParams).finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('La IA ha rechazado leer el presupuesto.')
  if (msg.stop_reason === 'max_tokens') throw new Error('El bloque de páginas es demasiado largo para extraerlo de una vez.')
  return JSON.parse(texto(msg)) as T
}

async function bloques(pdf: Buffer): Promise<{ desde: number; hasta: number; pdf: Buffer }[]> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })
  const n = doc.getPageCount()
  const out: { desde: number; hasta: number; pdf: Buffer }[] = []
  for (let i = 0; i < n; i += PAGINAS_POR_BLOQUE) {
    const sub = await PDFDocument.create()
    const idx = Array.from({ length: Math.min(PAGINAS_POR_BLOQUE, n - i) }, (_, k) => i + k)
    const pags = await sub.copyPages(doc, idx)
    pags.forEach(p => sub.addPage(p))
    out.push({ desde: i + 1, hasta: i + idx.length, pdf: Buffer.from(await sub.save()) })
  }
  return out
}

async function enParalelo<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await f(items[k]) }
  }))
  return res
}

const normal = (c: string | null | undefined) => (c ?? '').toUpperCase().replace(/\s+/g, '').replace(/\.$/, '')

export async function extraerPresupuesto(pdf: Buffer): Promise<Extraccion> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
  const partes = await bloques(pdf)

  // La cabecera (PDF entero, salida pequeña) y los bloques de partidas, a la vez.
  const [cabecera, listas] = await Promise.all([
    llamar<Cabecera>(client, pdf, 'Extrae la cabecera y el resumen por capítulos de este presupuesto.', ESQUEMA_CABECERA, 4000),
    enParalelo(partes, EN_PARALELO, b =>
      llamar<{ partidas: PartidaExtraida[] }>(client, b.pdf,
        `Este fragmento son las páginas ${b.desde} a ${b.hasta} del presupuesto. Extrae todas sus partidas. En "pagina" pon el número de página del documento completo (de ${b.desde} a ${b.hasta}).`,
        ESQUEMA_PARTIDAS, 32000).then(r => r.partidas)),
  ])

  // Unir y quitar duplicados de partidas cortadas entre bloques (mismo código e importe).
  const vistas = new Set<string>()
  const partidas: PartidaExtraida[] = []
  for (const p of listas.flat()) {
    const clave = `${normal(p.codigo)}|${p.importe.toFixed(2)}|${p.descripcion.slice(0, 40)}`
    if (p.codigo && vistas.has(clave)) continue
    vistas.add(clave)
    if (Math.abs(p.importe) > 0.004) partidas.push(p)
  }

  // Control de sumas por capítulo
  const control: ControlCapitulo[] = cabecera.capitulos.map(c => {
    const cod = normal(c.codigo)
    const extraido = partidas
      .filter(p => !p.es_margen && (normal(p.capitulo_codigo) === cod || normal(p.codigo).startsWith(cod + '.')))
      .reduce((s, p) => s + p.importe, 0)
    const dif = extraido - c.importe
    return { codigo: c.codigo, nombre: c.nombre, resumen: c.importe, extraido: Math.round(extraido * 100) / 100, diferencia: Math.round(dif * 100) / 100, cuadra: Math.abs(dif) <= Math.max(1, Math.abs(c.importe) * 0.005) }
  })
  const sumaPartidas = Math.round(partidas.filter(p => !p.es_margen).reduce((s, p) => s + p.importe, 0) * 100) / 100
  const total = cabecera.total_sin_iva
  const cuadraTotal = total != null && Math.abs(sumaPartidas - total) <= Math.max(1, total * 0.005)

  const avisos = [...cabecera.avisos]
  for (const c of control) if (!c.cuadra) avisos.push(`${c.codigo} ${c.nombre}: las partidas suman ${c.extraido.toFixed(2)} € y el resumen dice ${c.resumen.toFixed(2)} € (${c.diferencia > 0 ? '+' : ''}${c.diferencia.toFixed(2)} €).`)
  if (total != null && !cuadraTotal) avisos.push(`Las partidas suman ${sumaPartidas.toFixed(2)} € y el total sin IVA es ${total.toFixed(2)} €.`)

  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })
  return { cabecera, partidas, control, sumaPartidas, cuadraTotal, avisos, paginas: doc.getPageCount() }
}

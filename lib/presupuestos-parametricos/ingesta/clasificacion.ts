// Ingesta · paso 2: repartir cada partida entre las partes de las fichas y proponer
// el nivel de calidad de cada capítulo (solo servidor).
//
// La IA ve la lista CERRADA de partes con el criterio escrito de cada una (el
// `criterio` de las fichas está escrito para esto) y devuelve, por partida, uno o
// varios códigos con su %. Lo que no encaja va a 'sin_desglosar:<capítulo>' (el
// constructor no separa) o a 'fuera_ficha' (amianto, refuerzos grandes, tasas…).
// El esquema no lleva enum de partes a propósito (la gramática crecería demasiado):
// los códigos se validan aquí y uno desconocido pasa a 'sin_desglosar'.

import Anthropic from '@anthropic-ai/sdk'
import { FICHAS } from '../fichas'
import type { NivelCalidad } from '../domain'
import { rubricaTexto } from './niveles'
import type { PartidaExtraida } from './extraccion'

export const MODELO_CLASIFICACION = 'claude-opus-5-5'

export const FUERA_FICHA = 'fuera_ficha'
export const sinDesglosar = (capitulo: number) => `sin_desglosar:${capitulo}`

export type Reparto = { parte: string; pct: number }
export type Asignacion = { i: number; reparto: Reparto[]; confianza: number; motivo: string | null }
export type NivelPropuesto = { capitulo: number; nivel: NivelCalidad | null; justificacion: string }
export type Clasificacion = { asignaciones: Asignacion[]; niveles: NivelPropuesto[]; avisos: string[] }

const ESQUEMA = {
  type: 'object', additionalProperties: false, required: ['asignaciones', 'niveles'],
  properties: {
    asignaciones: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['i', 'reparto', 'confianza', 'motivo'],
        properties: {
          i: { type: 'integer', description: 'Índice de la partida en la lista.' },
          reparto: {
            type: 'array', description: 'Una o varias partes con su %; los % suman 100.',
            items: { type: 'object', additionalProperties: false, required: ['parte', 'pct'], properties: { parte: { type: 'string' }, pct: { type: 'number' } } },
          },
          confianza: { type: 'number', description: '0 a 1.' },
          motivo: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Solo si la confianza es baja, se reparte o va fuera de ficha: por qué, en una frase.' },
        },
      },
    },
    niveles: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['capitulo', 'nivel', 'justificacion'],
        properties: {
          capitulo: { type: 'integer' },
          nivel: { anyOf: [{ type: 'string', enum: ['functional', 'select', 'master_piece'] }, { type: 'null' }] },
          justificacion: { type: 'string', description: 'Qué partidas, marcas o sistemas lo justifican, en una o dos frases.' },
        },
      },
    },
  },
}

function catalogo(): string {
  return FICHAS.map(f =>
    `CAPÍTULO ${f.capitulo} · ${f.nombre}${f.dependeDelNivel ? '' : ' (no depende del nivel)'}\n` +
    f.partes.map(p => `  ${p.codigo} [${p.unidad}] ${p.nombre}: ${p.criterio}`).join('\n'),
  ).join('\n\n')
}

const SISTEMA = `Eres un técnico de presupuestos de reformas integrales de vivienda en Madrid. Clasificas las partidas de un presupuesto real de constructor en las partes de nuestro modelo de cálculo, para sacar ratios € por unidad.

Reglas:
- Usa SOLO los códigos de parte de la lista, o estos dos especiales:
  · "sin_desglosar:N" (N = número de capítulo) si la partida pertenece claramente al capítulo N pero mezcla varias partes y no se puede repartir con criterio.
  · "${FUERA_FICHA}" si no corresponde a ninguna parte: amianto, refuerzos estructurales grandes, terraza o exteriores, tasas e impuestos, y partidas que paga directamente la propiedad.
- Clasifica por lo que ES la partida, no por el capítulo donde la puso el constructor (p. ej. «desmontaje de A/C» en demoliciones va a demolición de instalaciones generales; una puerta plegable de vidrio en carpintería metálica va a divisorias de vidrio).
- Reparte con % solo cuando la partida incluya de verdad trabajos de varias partes (p. ej. «demolición de baño con retirada de escombros»). Si no, 100 % a una parte.
- Sé honesto con la confianza: 0,9 o más solo si no hay duda.
- Nivel por capítulo: propón Functional, Select o Masterpiece según las marcas, materiales y sistemas que se describen, con esta rúbrica orientativa. Null si el capítulo no tiene partidas o no hay pistas.

Rúbrica de niveles:
${rubricaTexto()}

Partes del modelo:
${catalogo()}`

const CODIGOS = new Set(FICHAS.flatMap(f => f.partes.map(p => p.codigo)))
const CAPITULO_DE = new Map(FICHAS.flatMap(f => f.partes.map(p => [p.codigo, f.capitulo] as const)))
export const capituloDeParte = (parte: string): number | null => {
  if (parte.startsWith('sin_desglosar:')) return Number(parte.split(':')[1]) || null
  return CAPITULO_DE.get(parte) ?? null
}

/** Capítulo de nuestro modelo que corresponde al capítulo del constructor (por nombre), para los «sin desglosar» inválidos. */
function capituloPorNombre(nombre: string): number {
  const n = nombre.toUpperCase()
  const tabla: [RegExp, number][] = [[/DEMOLI/, 1], [/REFUERZ|ESTRUCT/, 2], [/ALBA/, 3], [/METÁLICA|METALICA|EXTERIOR|VIDRI/, 4], [/MADERA/, 5], [/INSTALA/, 6], [/PINTURA|PAVIMENTO|REVESTIM/, 7], [/EQUIPAM/, 8], [/COCINA/, 9], [/VARIOS/, 10], [/GASTOS/, 11]]
  return tabla.find(([r]) => r.test(n))?.[1] ?? 10
}

export async function clasificarPartidas(partidas: PartidaExtraida[]): Promise<Clasificacion> {
  const lista = partidas.map((p, i) =>
    `${i} | ${p.capitulo_codigo ?? ''} ${p.capitulo} › ${p.subcapitulo ?? ''} | ${p.codigo ?? ''} | ${p.unidad ?? ''} ${p.medicion ?? ''} | ${p.importe.toFixed(2)} € | ${p.descripcion}${p.es_margen ? ' | (MARGEN)' : ''}`,
  ).join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 4 })
  const msg = await client.messages.stream({
    model: MODELO_CLASIFICACION,
    max_tokens: 32000,
    system: SISTEMA,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{ role: 'user', content: `Clasifica estas ${partidas.length} partidas (índice | capítulo › subcapítulo del constructor | código | unidad y medición | importe | descripción) y propón el nivel de los capítulos 1 a 11.\n\n${lista}` }],
  } as Anthropic.MessageStreamParams).finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error('La IA ha rechazado clasificar el presupuesto.')
  const out = JSON.parse(msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('')) as { asignaciones: Asignacion[]; niveles: NivelPropuesto[] }

  // Validación: códigos conocidos, % que suman 100, una asignación por partida.
  const avisos: string[] = []
  const porIndice = new Map<number, Asignacion>()
  for (const a of out.asignaciones) {
    if (a.i < 0 || a.i >= partidas.length || porIndice.has(a.i)) continue
    const capOrigen = capituloPorNombre(partidas[a.i].capitulo)
    let reparto = a.reparto.filter(r => r.pct > 0).map(r => {
      const valido = CODIGOS.has(r.parte) || r.parte === FUERA_FICHA || /^sin_desglosar:(\d|1[01])$/.test(r.parte)
      if (!valido) avisos.push(`Partida ${a.i}: la IA propuso «${r.parte}», que no existe; va a «sin desglosar».`)
      return valido ? r : { parte: sinDesglosar(capOrigen), pct: r.pct }
    })
    if (!reparto.length) reparto = [{ parte: sinDesglosar(capOrigen), pct: 100 }]
    const suma = reparto.reduce((s, r) => s + r.pct, 0)
    reparto = reparto.map(r => ({ ...r, pct: Math.round(r.pct / suma * 10000) / 100 }))
    porIndice.set(a.i, { ...a, reparto, confianza: Math.max(0, Math.min(1, a.confianza)) })
  }
  const asignaciones = partidas.map((p, i) => porIndice.get(i) ?? (avisos.push(`Partida ${i} sin clasificar: va a «sin desglosar».`), { i, reparto: [{ parte: sinDesglosar(capituloPorNombre(p.capitulo)), pct: 100 }], confianza: 0, motivo: 'La IA no la clasificó.' }))
  return { asignaciones, niveles: out.niveles.filter(n => n.capitulo >= 1 && n.capitulo <= 11), avisos }
}

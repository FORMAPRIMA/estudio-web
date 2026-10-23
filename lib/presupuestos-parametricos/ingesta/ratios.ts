// Ingesta · paso 3: ratios € por unidad de una obra de referencia.
//
// Una obra puede traer varios documentos (presupuesto de obra, demolición aparte…),
// cada uno con su fecha y su factor INE. Por cada parte de las fichas:
//   cantidad = la de la ficha, con la maqueta del estado actual y el programa
//              reformado de la obra (las mismas fórmulas que usará la estimación,
//              así el ratio calibra también la fórmula);
//   importe  = Σ partidas × % de reparto, sin margen y en euros de hoy;
//   ratio    = importe ÷ multiplicador de la ficha ÷ cantidad.
// Reglas:
// - Parte sin importe → no da ratio (no es 0 €: puede que lo pagara otro).
// - Parte con importe y cantidad 0 → no da ratio y se avisa (la fórmula no la ve).
// - «sin_desglosar:N» se reparte entre las partes del capítulo N que sí tienen
//   importe, en proporción a él, y esas partes quedan como no desglosadas. Si el
//   capítulo no tiene ninguna parte directa, queda como resto del capítulo.
// - Los costes de la propiedad y lo que va fuera de ficha no dan ratio: se suman aparte.

import { FICHAS, cantidadesFicha, type Valores } from '../fichas'
import { importeCoste } from '../domain'
import type { PartidaExtraida } from './extraccion'
import { COSTES_PROPIEDAD, FUERA_FICHA, capituloDeParte, type Asignacion, type CodigoPropiedad } from './clasificacion'

export type DocumentoObra = {
  etiqueta: string                 // 'Proarcom · obra', 'Armico · demolición'
  fecha: string                    // AAAA-MM-DD
  factorINE: number                // 1 si está en vigencia
  descuentoMargenPct?: number      // margen prorrateado dentro del documento (0,08 = 8 %)
  provisional?: boolean            // presupuesto no definitivo
  partidas: PartidaExtraida[]
  asignaciones: Asignacion[]
}

export type RatioParte = {
  parte: string
  capitulo: number
  nombre: string
  unidad: string
  cantidad: number
  formula: string
  fuente: 'tecnico' | 'express' | 'sin_dato'
  factor: number                   // multiplicador de la ficha (logística…)
  importeDirecto: number           // partidas clasificadas en la parte
  importeReparto: number           // lo que le toca de «sin desglosar»
  importe: number                  // coste en euros de hoy
  medicionConstructor: number | null
  ratio: number | null
  desglosada: boolean
  documentos: string[]
  aviso: string | null
}

export type ResultadoRatios = {
  partes: RatioParte[]
  restoCapitulo: { capitulo: number; importe: number }[]   // «sin desglosar» que no se pudo repartir
  propiedad: { codigo: CodigoPropiedad; nombre: string; importe: number }[]
  fueraFicha: { descripcion: string; importe: number; documento: string }[]
  totales: { obra: number; propiedad: number; fueraFicha: number; documentos: number }
  avisos: string[]
}

const UNIDADES: Record<string, string> = { m2: 'm²', 'm²': 'm²', m3: 'm³', 'm³': 'm³', ml: 'ml', m: 'ml', ud: 'ud', u: 'ud', uds: 'ud', pa: 'pa' }
const unidad = (u: string | null) => (u ? UNIDADES[u.trim().toLowerCase().replace(/\.$/, '')] ?? null : null)

export function calcularRatios(valores: Valores, documentos: DocumentoObra[]): ResultadoRatios {
  const avisos: string[] = []
  const directo = new Map<string, { importe: number; docs: Set<string>; medicion: number; unidadOk: boolean }>()
  const sinDesglosar = new Map<number, number>()
  const propiedad = new Map<CodigoPropiedad, number>()
  const fueraFicha: ResultadoRatios['fueraFicha'] = []
  let totalDocumentos = 0

  const unidadDe = new Map(FICHAS.flatMap(f => f.partes.map(p => [p.codigo, p.unidad] as const)))

  for (const d of documentos) {
    const porIndice = new Map(d.asignaciones.map(a => [a.i, a]))
    d.partidas.forEach((p, i) => {
      if (p.es_margen) return
      const coste = importeCoste(p.importe, d.descuentoMargenPct ?? 0) * d.factorINE
      totalDocumentos += coste
      const a = porIndice.get(i)
      if (!a) { avisos.push(`${d.etiqueta}: partida ${i} sin clasificar.`); return }
      for (const r of a.reparto) {
        const imp = coste * r.pct / 100
        if (r.parte === FUERA_FICHA) { fueraFicha.push({ descripcion: p.descripcion, importe: imp, documento: d.etiqueta }); continue }
        if (r.parte in COSTES_PROPIEDAD) { const c = r.parte as CodigoPropiedad; propiedad.set(c, (propiedad.get(c) ?? 0) + imp); continue }
        if (r.parte.startsWith('sin_desglosar:')) { const c = capituloDeParte(r.parte)!; sinDesglosar.set(c, (sinDesglosar.get(c) ?? 0) + imp); continue }
        const e = directo.get(r.parte) ?? { importe: 0, docs: new Set<string>(), medicion: 0, unidadOk: true }
        e.importe += imp
        e.docs.add(d.etiqueta)
        // La medición del constructor solo cuenta si la partida va entera a la parte y en la misma unidad.
        if (r.pct === 100 && p.medicion != null && unidad(p.unidad) === unidadDe.get(r.parte)) e.medicion += p.medicion
        else e.unidadOk = false
        directo.set(r.parte, e)
      }
    })
  }

  const partes: RatioParte[] = []
  const restoCapitulo: ResultadoRatios['restoCapitulo'] = []
  for (const f of FICHAS) {
    const cantidades = cantidadesFicha(f, valores)
    const baseCapitulo = cantidades.reduce((s, c) => s + (directo.get(c.parte)?.importe ?? 0), 0)
    const resto = sinDesglosar.get(f.capitulo) ?? 0
    if (resto > 0 && baseCapitulo === 0) restoCapitulo.push({ capitulo: f.capitulo, importe: resto })
    for (const c of cantidades) {
      const d = directo.get(c.parte)
      const importeDirecto = d?.importe ?? 0
      const importeReparto = resto > 0 && baseCapitulo > 0 ? resto * importeDirecto / baseCapitulo : 0
      const importe = importeDirecto + importeReparto
      const base = c.cantidad * c.factor
      let ratio: number | null = null
      let aviso: string | null = null
      if (importe <= 0) aviso = null
      else if (c.fuente === 'sin_dato') aviso = `Tiene ${Math.round(importe)} € pero falta un dato para medirla (${c.formula}).`
      else if (base <= 0) aviso = `Tiene ${Math.round(importe)} € pero la fórmula da cantidad 0: revisar programa o reparto.`
      else ratio = importe / base
      if (aviso) avisos.push(`${c.nombre}: ${aviso}`)
      partes.push({
        parte: c.parte, capitulo: f.capitulo, nombre: c.nombre, unidad: c.unidad,
        cantidad: c.cantidad, formula: c.formula, fuente: c.fuente, factor: c.factor,
        importeDirecto, importeReparto, importe,
        medicionConstructor: d && d.unidadOk && d.medicion > 0 ? d.medicion : null,
        ratio, desglosada: importeReparto === 0,
        documentos: d ? Array.from(d.docs) : [],
        aviso,
      })
    }
  }

  const obra = partes.reduce((s, p) => s + p.importe, 0) + restoCapitulo.reduce((s, r) => s + r.importe, 0)
  const totalPropiedad = Array.from(propiedad.values()).reduce((s, x) => s + x, 0)
  const totalFuera = fueraFicha.reduce((s, x) => s + x.importe, 0)
  if (Math.abs(obra + totalPropiedad + totalFuera - totalDocumentos) > 1) avisos.push('Las sumas no cuadran con los documentos: hay importes sin asignar.')

  return {
    partes, restoCapitulo, fueraFicha,
    propiedad: Array.from(propiedad.entries()).map(([codigo, importe]) => ({ codigo, nombre: COSTES_PROPIEDAD[codigo] as string, importe })),
    totales: { obra, propiedad: totalPropiedad, fueraFicha: totalFuera, documentos: totalDocumentos },
    avisos,
  }
}

import type { Ficha, Valores, Cantidad } from './tipos'
import { FICHA_DEMOLICIONES } from './demoliciones'
import { FICHA_ALBANILERIA } from './albanileria'
import { FICHA_CARPINTERIA_EXTERIOR } from './carpinteria_exterior'
import { FICHA_CARPINTERIA_MADERA } from './carpinteria_madera'
import { FICHA_INSTALACIONES } from './instalaciones'
import { FICHA_PINTURAS } from './pinturas'
import { FICHA_COCINA } from './cocina'
import { FICHA_EQUIPAMIENTO } from './equipamiento'
import { FICHA_REFUERZOS, FICHA_VARIOS, FICHA_GASTOS_GENERALES } from './cierre'

export * from './tipos'
export { VARIABLES, variable } from './variables'

/** Se sube cada vez que cambia una fórmula: los ratios guardados llevan la versión con la que se calcularon. */
export const VERSION_FICHAS = '2026-10-23'

/** Las 11 fichas, en orden de capítulo (presupuesto_capitulos.numero). */
export const FICHAS: Ficha[] = [
  FICHA_DEMOLICIONES, FICHA_REFUERZOS, FICHA_ALBANILERIA, FICHA_CARPINTERIA_EXTERIOR, FICHA_CARPINTERIA_MADERA,
  FICHA_INSTALACIONES, FICHA_PINTURAS, FICHA_EQUIPAMIENTO, FICHA_COCINA, FICHA_VARIOS, FICHA_GASTOS_GENERALES,
]

export function fichaDeCapitulo(numero: number): Ficha | undefined {
  return FICHAS.find(f => f.capitulo === numero)
}

export type CantidadParte = Cantidad & {
  parte: string
  nombre: string
  unidad: string
  factor: number
  formulaFactor: string | null
}

/** Cantidades de todas las partes de una ficha para unos valores dados. */
export function cantidadesFicha(ficha: Ficha, v: Valores): CantidadParte[] {
  return ficha.partes.map(p => {
    const c = p.cantidad(v)
    const m = p.multiplicador?.(v)
    return {
      ...c,
      parte: p.codigo,
      nombre: p.nombre,
      unidad: p.unidad,
      factor: m?.factor ?? 1,
      formulaFactor: m?.formula ?? null,
    }
  })
}

/** Variables que pide una ficha, sin repetir, en el orden en que aparecen. */
export function variablesDeFicha(ficha: Ficha): string[] {
  return Array.from(new Set(ficha.partes.flatMap(p => p.variables)))
}

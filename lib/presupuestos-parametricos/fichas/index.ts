import type { Ficha, Valores, Cantidad } from './tipos'
import { FICHA_DEMOLICIONES } from './demoliciones'
import { FICHA_ALBANILERIA } from './albanileria'
import { FICHA_CARPINTERIA_EXTERIOR } from './carpinteria_exterior'
import { FICHA_INSTALACIONES } from './instalaciones'
import { FICHA_PINTURAS } from './pinturas'
import { FICHA_COCINA } from './cocina'
import { FICHA_EQUIPAMIENTO } from './equipamiento'

export * from './tipos'
export { VARIABLES, variable } from './variables'

/** Fichas cerradas, en orden de capítulo. Se irán añadiendo una a una (Fase 1). */
export const FICHAS: Ficha[] = [FICHA_DEMOLICIONES, FICHA_ALBANILERIA, FICHA_CARPINTERIA_EXTERIOR, FICHA_INSTALACIONES, FICHA_PINTURAS, FICHA_EQUIPAMIENTO, FICHA_COCINA]

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

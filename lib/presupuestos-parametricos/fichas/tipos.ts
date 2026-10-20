// Fichas de cálculo — una por capítulo.
//
// Una ficha traduce cualquier presupuesto a una lista FIJA de partes. Cada parte
// tiene una cantidad (m², ud, m³…) que se mide igual en una obra real (para
// sacar el ratio €/unidad) y en una vivienda que aún no tiene proyecto (para
// aplicarlo). Así el sistema aguanta que cada constructor desglose a su manera:
// - si una obra desglosa la parte, aporta ratio directo de esa parte;
// - si no, su total de capítulo sigue siendo una ecuación
//   Σ ratio_parte × cantidad_parte = total, y entra igual en la calibración.
//
// Cada cantidad se calcula con la medición técnica si existe y, si no, con la
// aproximación express (datos que cualquier cliente sabe). Los coeficientes de
// esas aproximaciones son provisionales hasta que las obras los calibren.

export type NivelPregunta = 'express' | 'tecnico'

export type Variable = {
  codigo: string
  nombre: string
  unidad: string                         // 'm²', 'ml', 'ud', 'm', 'nº', '' para opciones
  tipo: 'numero' | 'si_no' | 'opcion'
  nivel: NivelPregunta
  pregunta: string                       // tal cual se le pregunta a quien rellena
  ayuda?: string                         // cómo medirlo
  opciones?: { value: string; label: string }[]
  defecto?: number | string
}

export type Valores = Record<string, number | string | boolean | null | undefined>

/** Coeficiente de una aproximación. `provisional` hasta que lo calibren las obras. */
export type Coeficiente = { valor: number; nota: string; provisional: boolean }

export type Cantidad = {
  cantidad: number
  /** De dónde sale: medición técnica, aproximación express o falta el dato. */
  fuente: 'tecnico' | 'express' | 'sin_dato'
  /** Explicación legible, p. ej. «18,3 ml × 2,65 m». Se enseña en la UI y en el dashboard. */
  formula: string
}

export type Parte = {
  codigo: string                         // 'dem_tabiqueria'
  nombre: string
  unidad: string                         // unidad del ratio: €/m², €/ud…
  /** Qué partidas del constructor caen aquí. Lo lee la IA de la ingesta. */
  criterio: string
  /** Subcapítulos de la taxonomía (presupuesto_subcapitulos.codigo) donde suele caer. */
  subcapitulos: string[]
  /** Variables que usa, para pedirlas en el cuestionario y en la ingesta. */
  variables: string[]
  cantidad: (v: Valores) => Cantidad
  /** Multiplicador sobre el importe (logística, dificultad). 1 si no aplica. */
  multiplicador?: (v: Valores) => { factor: number; formula: string }
}

export type Ficha = {
  capitulo: number                       // presupuesto_capitulos.numero
  nombre: string
  /** false = el coste no depende de la calidad: todas las obras alimentan un solo ratio. */
  dependeDelNivel: boolean
  descripcion: string
  partes: Parte[]
  coeficientes: Record<string, Coeficiente>
  /** Lo que NO entra en la ficha y se mete a mano si aparece. */
  fueraDeFicha?: string[]
}

// ── Lectura segura de valores ────────────────────────────────────────────────

export function num(v: Valores, codigo: string): number | null {
  const x = v[codigo]
  if (x == null || x === '') return null
  const n = typeof x === 'number' ? x : Number(String(x).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function siNo(v: Valores, codigo: string): boolean | null {
  const x = v[codigo]
  if (x == null || x === '') return null
  if (typeof x === 'boolean') return x
  return ['si', 'sí', 'true', '1'].includes(String(x).toLowerCase())
}

export function texto(v: Valores, codigo: string): string | null {
  const x = v[codigo]
  return x == null || x === '' ? null : String(x)
}

const f2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })
export const n2 = (n: number) => f2.format(n)

export const SIN_DATO = (falta: string): Cantidad => ({ cantidad: 0, fuente: 'sin_dato', formula: `Falta: ${falta}` })

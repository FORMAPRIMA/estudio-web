/**
 * Shared finanzas constants and helpers.
 */

export const SECCION_ORDER = [
  'Anteproyecto',
  'Proyecto de ejecución',
  'Obra',
  'Margen prorrateado de obra',
  'Interiorismo',
  'Compra de mobiliario',
  'Post venta',
] as const

export type Seccion = (typeof SECCION_ORDER)[number]

/** Secciones que NUNCA deben ser visibles para el cliente */
export const SECCIONES_PRIVADAS: string[] = [
  'Margen prorrateado de obra',
]

/** Margen de obra → se factura a la constructora del proyecto (proyectos.constructor_id) */
export const SECCION_CONSTRUCTORA = 'Margen prorrateado de obra'
/**
 * Compra de mobiliario → depósito pass-through por proyecto: entran suplidos
 * cobrados al cliente (facturables con normalidad) y salen las compras de
 * mobiliario (costos_variables con categoría CATEGORIA_MOBILIARIO). El margen se
 * calcula (suplidos − compras); el % estimado es interno y jamás sale al cliente.
 */
export const SECCION_MOBILIARIO = 'Compra de mobiliario'

/** Categoría de costo variable que cuenta como compra de mobiliario del depósito */
export const CATEGORIA_MOBILIARIO = 'Compra de mobiliario'

/**
 * Secciones cuya factura JAMÁS debe enviarse al cliente por el hecho de serlo.
 * Es una condición de SECCIÓN, no de destinatario: sirve para filtrar por sección
 * en consultas (portal del cliente, plataforma interna) donde no hay más contexto.
 *
 * ⚠️ NO la uses como guard de envío: una factura puede ir a un proveedor aunque su
 * sección sea pública (rappel de mobiliario). Para eso está `esFacturaNoCliente()`.
 */
export function esSeccionNoCliente(seccion: string | null | undefined): boolean {
  return !!seccion && SECCIONES_PRIVADAS.includes(seccion)
}

/**
 * GUARD MAESTRO de envío. Responde a "¿esta factura tiene prohibido el canal cliente?".
 *
 * Es verdad en dos casos:
 *  1. La sección es privada por naturaleza (margen de obra → constructora).
 *  2. La factura tiene un PROVEEDOR como destinatario, sea cual sea su sección.
 *     Caso típico: rappel/descuento de un proveedor de mobiliario dentro de
 *     "Compra de mobiliario", una sección donde los suplidos SÍ van al cliente.
 *
 * El caso 2 es el importante: el cliente normalmente no sabe que recibimos un
 * margen por su compra de mobiliario, y enterarse por un email automático sería
 * un incidente serio. Ante la duda, esta función devuelve true.
 */
export function esFacturaNoCliente(f: {
  seccion?:     string | null
  proveedorId?: string | null
  receptorTipo?: string | null
}): boolean {
  if (f.receptorTipo === 'proveedor') return true
  if (f.proveedorId) return true
  return esSeccionNoCliente(f.seccion)
}

const IVA = 0.21

/**
 * Computes the current repercusión de costos fijos por hora facturable.
 * Used as a fallback when no historical fixed-cost record covers a given date.
 */
export function calcRepercusion(
  costosFijos: { monto: number }[],
  members:     { horas_mensuales: number | null }[],
  minoracion:  number   // percentage, e.g. 15 for 15 %
): number {
  const totalFijos = costosFijos.reduce((s, c) => s + c.monto * (1 + IVA), 0)
  const hrsFact    = members.reduce((s, m) => s + (m.horas_mensuales ?? 0), 0)
  const hrsEfect   = hrsFact * (1 - minoracion / 100)
  return hrsEfect > 0 ? totalFijos / hrsEfect : 0
}

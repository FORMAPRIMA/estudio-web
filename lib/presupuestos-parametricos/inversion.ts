// Inversión total del propietario: la herramienta es para analizar la viabilidad,
// así que no basta con el presupuesto de obra. Tres capas:
//   1. Obra (PEM): lo que sale de las fichas, sin IVA.
//   2. Costes de la propiedad: lo que paga el dueño aunque no sea obra
//      (ICIO y tasas, honorarios técnicos, coordinación de SyS, otros pagos directos).
//   3. IVA: 21 % por defecto; 10 % solo si la reforma cumple los requisitos de
//      rehabilitación de vivienda (lo decide quien estima, no la herramienta).
// Los impuestos municipales no llevan IVA; los honorarios y la SyS sí.

export type ParametrosInversion = {
  ivaObraPct: number              // 21 por defecto, 10 opcional
  icioPct: number                 // ICIO de Madrid: 4 % sobre el PEM
  tasaLicencia: number            // € fijos (declaración responsable / licencia)
  honorariosPct: number           // arquitectura sobre obra sin IVA: 10 %
  seguridadSalud: number          // € coordinación SyS si la paga la propiedad
  otros: { concepto: string; importe: number; conIva: boolean }[]
}

export const PARAMETROS_INVERSION: ParametrosInversion = {
  ivaObraPct: 21,
  icioPct: 4,
  tasaLicencia: 0,
  honorariosPct: 10,
  seguridadSalud: 0,
  otros: [],
}

const IVA_SERVICIOS = 21

export type LineaInversion = { concepto: string; base: number; iva: number; total: number }

export type Inversion = {
  obra: LineaInversion
  propiedad: LineaInversion[]
  totalSinIva: number
  totalIva: number
  total: number
}

const linea = (concepto: string, base: number, ivaPct: number): LineaInversion => {
  const iva = base * ivaPct / 100
  return { concepto, base, iva, total: base + iva }
}

export function calcularInversion(obraSinIva: number, p: ParametrosInversion = PARAMETROS_INVERSION): Inversion {
  const obra = linea('Obra', obraSinIva, p.ivaObraPct)
  const propiedad = [
    linea('ICIO', obraSinIva * p.icioPct / 100, 0),
    ...(p.tasaLicencia ? [linea('Tasa de licencia', p.tasaLicencia, 0)] : []),
    linea('Honorarios de arquitectura', obraSinIva * p.honorariosPct / 100, IVA_SERVICIOS),
    ...(p.seguridadSalud ? [linea('Coordinación de seguridad y salud', p.seguridadSalud, IVA_SERVICIOS)] : []),
    ...p.otros.map(o => linea(o.concepto, o.importe, o.conIva ? IVA_SERVICIOS : 0)),
  ]
  const todas = [obra, ...propiedad]
  const totalSinIva = todas.reduce((s, l) => s + l.base, 0)
  const totalIva = todas.reduce((s, l) => s + l.iva, 0)
  return { obra, propiedad, totalSinIva, totalIva, total: totalSinIva + totalIva }
}

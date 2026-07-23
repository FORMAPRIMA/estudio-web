// Producto optimizado — Fase 4.
//
// Convierte el análisis urbanístico en análisis de producto: cruza el volumen
// capaz con la renta de la zona (INE por sección censal) y el €/m² de venta
// para responder "¿qué producto residencial absorbe mejor esta bolsa de m²?".
//
// Motor 100 % determinista (amortización francesa, esfuerzo sobre renta neta).
// La IA solo redacta la narrativa sobre estos números, nunca los calcula.

export interface MercadoInputs {
  precioVentaM2: number          // €/m² vendible en la zona (input del analista)
  rentaNetaHogarAnual: number    // € netos/año (INE por defecto, editable)
  tipoInteresPct: number         // interés nominal anual, p. ej. 3,1
  plazoAnios: number             // p. ej. 30
  ltvPct: number                 // p. ej. 80
  esfuerzoMaxPct: number         // cuota/renta neta, p. ej. 35
  coefVendible: number           // m²c → m² vendibles (comercial), p. ej. 0,85
}

export const MERCADO_DEFAULTS: Omit<MercadoInputs, 'precioVentaM2' | 'rentaNetaHogarAnual'> = {
  tipoInteresPct: 3.1,
  plazoAnios: 30,
  ltvPct: 80,
  esfuerzoMaxPct: 35,
  coefVendible: 0.85,
}

export interface TipologiaDef {
  key: string
  label: string
  m2Vendibles: number
  dormitorios: number
  publico: string                 // descripción del comprador tipo
}

export const TIPOLOGIAS_COLECTIVA: TipologiaDef[] = [
  { key: 'estudio', label: 'Estudio',        m2Vendibles: 40,  dormitorios: 0, publico: 'solteros/parejas jóvenes, primer acceso' },
  { key: '1d',      label: '1 dormitorio',   m2Vendibles: 55,  dormitorios: 1, publico: 'parejas jóvenes, inversores en alquiler' },
  { key: '2d',      label: '2 dormitorios',  m2Vendibles: 75,  dormitorios: 2, publico: 'parejas con primer hijo, teletrabajo' },
  { key: '3d',      label: '3 dormitorios',  m2Vendibles: 100, dormitorios: 3, publico: 'familias consolidadas' },
  { key: '4d',      label: '4 dormitorios',  m2Vendibles: 140, dormitorios: 4, publico: 'familias grandes, reposición premium' },
]

export interface ProductoTipologia {
  key: string
  label: string
  m2_vendibles: number
  dormitorios: number
  publico: string
  unidades: number
  precio_venta_ud: number         // €
  cuota_mensual: number           // € (LTV aplicado)
  renta_necesaria_anual: number   // € para no superar el esfuerzo máximo
  esfuerzo_zona_pct: number       // cuota anual / renta neta hogar de la zona
  accesible_zona: boolean         // esfuerzo_zona ≤ esfuerzo máximo
  gdv: number                     // € — unidades × precio
}

export interface ProductoResult {
  disponible: boolean
  inputs: MercadoInputs
  volumen_fuente: string          // de dónde sale el volumen usado
  m2c_disponibles: number
  m2_vendibles: number
  tipologias: ProductoTipologia[]
  optimo: ProductoTipologia | null      // mayor GDV entre las accesibles
  optimo_criterio: string
  regimen: 'colectiva' | 'unifamiliar'
  unifamiliar?: {
    parcelas_posibles: number
    m2_por_vivienda: number
    precio_por_vivienda: number
    renta_necesaria_anual: number
    esfuerzo_zona_pct: number
    accesible_zona: boolean
  }
  advertencias: string[]
}

/** Cuota mensual de amortización francesa. */
export function cuotaMensual(principal: number, tipoAnualPct: number, plazoAnios: number): number {
  const i = tipoAnualPct / 100 / 12
  const n = plazoAnios * 12
  if (i === 0) return principal / n
  return (principal * i) / (1 - Math.pow(1 + i, -n))
}

export function computeProducto(params: {
  m2cDisponibles: number
  volumenFuente: string
  inputs: MercadoInputs
  regimen?: 'colectiva' | 'unifamiliar'
  parcelasPosibles?: number | null    // para unifamiliar (divisibilidad de parcela)
}): ProductoResult {
  const { m2cDisponibles, volumenFuente, inputs, regimen = 'colectiva', parcelasPosibles = null } = params
  const advertencias: string[] = []

  const m2Vendibles = Math.round(m2cDisponibles * inputs.coefVendible)
  const evalua = (m2: number) => {
    const precio = Math.round(m2 * inputs.precioVentaM2)
    const principal = precio * (inputs.ltvPct / 100)
    const cuota = Math.round(cuotaMensual(principal, inputs.tipoInteresPct, inputs.plazoAnios))
    const rentaNecesaria = Math.round((cuota * 12) / (inputs.esfuerzoMaxPct / 100))
    const esfuerzoZona = inputs.rentaNetaHogarAnual > 0
      ? Math.round(((cuota * 12) / inputs.rentaNetaHogarAnual) * 1000) / 10
      : Infinity
    return { precio, cuota, rentaNecesaria, esfuerzoZona, accesible: esfuerzoZona <= inputs.esfuerzoMaxPct }
  }

  const base: ProductoResult = {
    disponible: m2Vendibles > 0 && inputs.precioVentaM2 > 0,
    inputs,
    volumen_fuente: volumenFuente,
    m2c_disponibles: Math.round(m2cDisponibles),
    m2_vendibles: m2Vendibles,
    tipologias: [],
    optimo: null,
    optimo_criterio: '',
    regimen,
    advertencias,
  }
  if (!base.disponible) {
    advertencias.push('Faltan m² disponibles o €/m² de venta: no se puede calcular el producto.')
    return base
  }

  if (regimen === 'unifamiliar') {
    const nParcelas = Math.max(1, parcelasPosibles ?? 1)
    const m2Viv = Math.round(m2Vendibles / nParcelas)
    const e = evalua(m2Viv)
    base.unifamiliar = {
      parcelas_posibles: nParcelas,
      m2_por_vivienda: m2Viv,
      precio_por_vivienda: e.precio,
      renta_necesaria_anual: e.rentaNecesaria,
      esfuerzo_zona_pct: e.esfuerzoZona,
      accesible_zona: e.accesible,
    }
    base.optimo_criterio = nParcelas > 1
      ? `Uso cualificado unifamiliar: ${nParcelas} viviendas por división de parcela (verificar parcela mínima, frente y régimen de la NZ).`
      : 'Uso cualificado unifamiliar: una vivienda (parcela no divisible).'
    advertencias.push('En norma de vivienda unifamiliar el mix por tipologías colectivas no aplica: el producto es la propia vivienda unifamiliar.')
    return base
  }

  for (const t of TIPOLOGIAS_COLECTIVA) {
    const unidades = Math.floor(m2Vendibles / t.m2Vendibles)
    if (unidades < 1) continue
    const e = evalua(t.m2Vendibles)
    base.tipologias.push({
      key: t.key,
      label: t.label,
      m2_vendibles: t.m2Vendibles,
      dormitorios: t.dormitorios,
      publico: t.publico,
      unidades,
      precio_venta_ud: e.precio,
      cuota_mensual: e.cuota,
      renta_necesaria_anual: e.rentaNecesaria,
      esfuerzo_zona_pct: e.esfuerzoZona,
      accesible_zona: e.accesible,
      gdv: unidades * e.precio,
    })
  }

  const accesibles = base.tipologias.filter((t) => t.accesible_zona)
  if (accesibles.length > 0) {
    base.optimo = accesibles.reduce((max, t) => (t.gdv > max.gdv ? t : max))
    base.optimo_criterio = 'Mayor GDV entre las tipologías cuyo esfuerzo hipotecario queda dentro del máximo para la renta media de la zona.'
  } else if (base.tipologias.length > 0) {
    base.optimo = base.tipologias.reduce((min, t) => (t.esfuerzo_zona_pct < min.esfuerzo_zona_pct ? t : min))
    base.optimo_criterio = 'NINGUNA tipología es accesible con la renta media de la zona al esfuerzo máximo: se muestra la de menor esfuerzo. Producto orientado a compradores por encima de la renta media, reposición o inversores.'
    advertencias.push('El comprador de renta media de la zona no absorbe el producto al esfuerzo máximo definido: revisar €/m², producto premium o alquiler.')
  }

  advertencias.push(
    'Cálculo orientativo: GDV bruto sin costes (construcción, honorarios, financieros, comercialización, impuestos), sin descuento de zonas comunes específico del proyecto y con renta media INE como proxy del comprador. No es un estudio de mercado.'
  )
  return base
}

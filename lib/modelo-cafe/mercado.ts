// Modelo Café Goya — datos de mercado (referencia estática).
// Precios de carta de cafeterías del entorno de Goya 63 (barrio de Salamanca),
// tomados en visita de campo (julio 2026), datos de ventas de los baristas,
// traspasos comparables publicados y referencias de renta comercial (CBRE/Colliers).
//
// Alimenta la tab "Análisis de mercado" y las páginas de mercado del dossier
// bancario. No hay tabla en BD: es material de referencia versionado en el repo.

// ── Bebidas comparables (columnas de la tabla de precios) ───────────

export type BebidaKey =
  | 'espresso' | 'cortado' | 'flat_white' | 'latte'
  | 'cold_brew' | 'batch' | 'matcha' | 'chai'

export const BEBIDAS: { key: BebidaKey; label: string; corta: string }[] = [
  { key: 'espresso',   label: 'Espresso',            corta: 'Espresso' },
  { key: 'cortado',    label: 'Cortado',             corta: 'Cortado' },
  { key: 'flat_white', label: 'Flat white',          corta: 'Flat white' },
  { key: 'latte',      label: 'Latte / cappuccino',  corta: 'Latte' },
  { key: 'cold_brew',  label: 'Cold brew',           corta: 'Cold brew' },
  { key: 'batch',      label: 'Batch / filtro',      corta: 'Batch' },
  { key: 'matcha',     label: 'Matcha latte',        corta: 'Matcha' },
  { key: 'chai',       label: 'Chai latte',          corta: 'Chai' },
]

// Bebidas "core" para el ticket medio de café por local (excluye matcha/chai/té,
// que no todas ofrecen y suben artificialmente la media).
const CORE: BebidaKey[] = ['espresso', 'cortado', 'flat_white', 'latte', 'cold_brew', 'batch']

// ── Cafeterías del entorno ──────────────────────────────────────────

export type Cafeteria = {
  nombre: string
  zona: string
  distancia: string          // a pie desde Goya 63
  destacada?: boolean        // competidor directo / formato análogo
  nota?: string
  precios: Partial<Record<BebidaKey, number>>
  // Ventas de café/día que reportaron los baristas (null = no disponible)
  ventasNormal: number | null
  ventasAlto: number | null
  ventasNota?: string
}

export const CAFETERIAS: Cafeteria[] = [
  {
    nombre: 'Good News',
    zona: 'Calle Goya',
    distancia: 'mismo tramo de Goya',
    destacada: true,
    nota: 'Café de especialidad to-go en la misma calle: el comparable más directo.',
    precios: { espresso: 1.60, cortado: 1.80, flat_white: 3.10, latte: 3.10, cold_brew: 3.10, chai: 3.50 },
    ventasNormal: 300,
    ventasAlto: 300,
    ventasNota: 'Barista: ~300 cafés un día normal; ~150 un día flojo.',
  },
  {
    nombre: 'Pink Bourbon',
    zona: 'Diego de León',
    distancia: '~10 min',
    destacada: true,
    nota: 'Quiosco reconvertido en café de especialidad: mismo formato que el proyecto.',
    precios: { espresso: 2.70, cortado: 2.90, flat_white: 3.70, latte: 3.30, cold_brew: 4.00, batch: 3.50, chai: 4.30 },
    ventasNormal: 140,
    ventasAlto: 200,
    ventasNota: 'Barista: media 140 cafés/día; días buenos ~200.',
  },
  {
    nombre: 'Utópico',
    zona: 'Salamanca',
    distancia: '~8 min',
    precios: { espresso: 2.30, cortado: 3.00, flat_white: 3.00, latte: 3.60, cold_brew: 4.00, batch: 3.00, matcha: 4.50 },
    ventasNormal: 150,
    ventasAlto: 200,
    ventasNota: 'Barista: ~150 cafés un día normal; ~200 un día bueno.',
  },
  {
    nombre: 'East Crema',
    zona: 'Salamanca',
    distancia: '~9 min',
    precios: { cortado: 2.70, flat_white: 2.90, latte: 3.40, cold_brew: 3.00, batch: 3.00, matcha: 4.20, chai: 4.00 },
    ventasNormal: 200,
    ventasAlto: 200,
    ventasNota: 'Barista: ~100 cafés/día en temporada baja; ~200 un día normal.',
  },
  {
    nombre: 'Hola Coffee',
    zona: 'Lagasca',
    distancia: '~12 min',
    precios: { espresso: 2.70, cortado: 2.90, flat_white: 3.80, latte: 3.00, cold_brew: 4.50, batch: 3.50, matcha: 4.50, chai: 4.00 },
    ventasNormal: null,
    ventasAlto: null,
  },
  {
    nombre: "Bell's",
    zona: 'Salamanca',
    distancia: '~10 min',
    precios: { espresso: 2.00, cortado: 2.20, flat_white: 3.00, latte: 3.50, matcha: 3.80, chai: 3.80 },
    ventasNormal: null,
    ventasAlto: null,
  },
  {
    nombre: 'Ágora Coffee',
    zona: 'Salamanca',
    distancia: '~11 min',
    precios: { espresso: 1.80, cortado: 2.20, flat_white: 3.10, latte: 3.40, matcha: 3.40, chai: 3.40 },
    ventasNormal: null,
    ventasAlto: null,
  },
]

// ── Traspasos comparables (anuncios activos julio 2026) ─────────────

export type Traspaso = { quiosco: string; zona: string; precio: number | null; precioTexto: string; goya?: boolean }

export const TRASPASOS: Traspaso[] = [
  { quiosco: 'Retiro, C/ Estrella Polar', zona: 'Retiro', precio: 10000, precioTexto: '10.000 €' },
  { quiosco: 'Santa Eugenia, Av. Mediterráneo', zona: 'Villa de Vallecas', precio: 15000, precioTexto: '15.000 €' },
  { quiosco: 'Puerta de Toledo', zona: 'Centro / Arganzuela', precio: 22500, precioTexto: '22.500 €' },
  { quiosco: 'Calle Trafalgar 2', zona: 'Chamberí', precio: 25000, precioTexto: '25.000 €' },
  { quiosco: 'Diego de León (prensa + flores + café)', zona: 'Salamanca', precio: 29500, precioTexto: '29.500 €' },
  { quiosco: 'Lucero, C/ Cebreros (boca de metro)', zona: 'Latina', precio: 30000, precioTexto: '30.000 €' },
  { quiosco: 'Gta. Marqués de Vadillo (8 m²)', zona: 'Carabanchel', precio: 40000, precioTexto: '30.000–50.000 €' },
  { quiosco: 'Cuatro Caminos, Edgar Neville 1 (lic. café)', zona: 'Tetuán', precio: 35000, precioTexto: '35.000 €' },
  { quiosco: 'Canal / Bravo Murillo', zona: 'Chamberí', precio: 40000, precioTexto: '40.000 €' },
  { quiosco: 'Genérico, licencia hasta 2029', zona: 'Madrid', precio: 55000, precioTexto: '55.000 €' },
  { quiosco: 'La Vaguada, frente al C.C. (con tabaco)', zona: 'Fuencarral', precio: 65000, precioTexto: '65.000 €' },
  { quiosco: 'Quiosco Goya 63 (traspaso propuesto)', zona: 'Salamanca prime', precio: 70000, precioTexto: '70.000 €', goya: true },
]

// ── Referencias de mercado / ubicación ──────────────────────────────

export const UBICACION = {
  rentaGoya: 130,          // €/m²/mes (CBRE High Street)
  vacancy: 0.23,           // % de disponibilidad en la calle
  posicionCalle: '6ª-7ª calle comercial de Madrid',
  alquilerLocal: '2.500–5.000 €/mes',
  fuente: 'CBRE Retail High Street y Colliers Retail Snapshot Q1 2026',
}

// ── Helpers de cálculo ──────────────────────────────────────────────

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Media de precio de mercado por bebida (solo locales que la ofrecen). */
export function mediaPorBebida(): Record<BebidaKey, { media: number; n: number; min: number; max: number }> {
  const out = {} as Record<BebidaKey, { media: number; n: number; min: number; max: number }>
  for (const { key } of BEBIDAS) {
    const vals = CAFETERIAS.map((c) => c.precios[key]).filter((x): x is number => typeof x === 'number')
    out[key] = vals.length
      ? { media: media(vals), n: vals.length, min: Math.min(...vals), max: Math.max(...vals) }
      : { media: 0, n: 0, min: 0, max: 0 }
  }
  return out
}

/** Ticket medio de café por local (media de las bebidas core que ofrece). */
export function ticketMedioPorLocal(): { nombre: string; ticket: number; n: number; destacada?: boolean }[] {
  return CAFETERIAS.map((c) => {
    const vals = CORE.map((k) => c.precios[k]).filter((x): x is number => typeof x === 'number')
    return { nombre: c.nombre, ticket: media(vals), n: vals.length, destacada: c.destacada }
  })
}

/** Media global del ticket de café del mercado (media de los tickets por local). */
export function ticketMedioMercado(): number {
  const tickets = ticketMedioPorLocal().map((t) => t.ticket).filter((x) => x > 0)
  return media(tickets)
}

/** Media de ventas de café/día entre los locales con dato reportado. */
export function ventasMedia(): { normal: number; alto: number; locales: number } {
  const conNormal = CAFETERIAS.map((c) => c.ventasNormal).filter((x): x is number => typeof x === 'number')
  const conAlto = CAFETERIAS.map((c) => c.ventasAlto).filter((x): x is number => typeof x === 'number')
  return { normal: media(conNormal), alto: media(conAlto), locales: conNormal.length }
}

/** Media y mediana de precios de traspaso comparables (excluye Goya). */
export function mercadoTraspasos(): { media: number; min: number; max: number; goya: number } {
  const vals = TRASPASOS.filter((t) => !t.goya && t.precio != null).map((t) => t.precio as number)
  const goya = TRASPASOS.find((t) => t.goya)?.precio ?? 70000
  return { media: media(vals), min: Math.min(...vals), max: Math.max(...vals), goya }
}

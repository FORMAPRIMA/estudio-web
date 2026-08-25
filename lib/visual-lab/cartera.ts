/**
 * FP Visual Lab — cartera de desarrollo.
 *
 * Los tres activos que el estudio tiene en comercialización y la aritmética del
 * pipeline: ritmo por escenario, sell-out estimado, curva de absorción y mix por
 * clase de activo. Port de `FP Portafolio.dc.html`.
 *
 * Es el hub: lo primero que ve un promotor. Cada tarjeta abre su showroom 3D.
 */

import { hash, mm, pct, dec, quarter, masMeses, C } from './ui'

export type ActivoId = 'MA32' | 'LD' | 'VS'
export type Escenario = 'CONSERVADOR' | 'BASE' | 'AGRESIVO'
export type Periodo = '6M' | '12M' | '24M'

export interface Activo {
  id: ActivoId
  nombre: string
  ciudad: string
  /** Clase de activo, en largo y en corto para la tabla */
  clase: string
  claseCorta: string
  /** Color con el que el activo aparece en la curva y en el mix */
  color: string
  /** Ruta del showroom dentro de la plataforma */
  href: string
  /** Render de firma, sin sufijo de tamaño */
  render: string
  hint: string
  /** Cómo se llama la unidad vendible de este activo */
  noun: string
  nounC: string
  n: number
  col: number
  gdv: number
  /** % del GDV ya colocado (puede diferir de col/n: no todas las unidades valen igual) */
  pctVal: number
  ritmo: number
  /** Meses desde el lanzamiento comercial */
  lanz: number
  fase: string
  fcolor: string
  metricas: { k: string; v: string }[]
  datos: [string, string][]
  tesis: string
}

/** Fecha de referencia del portafolio. Fija a propósito: los números son un caso. */
export const HOY = new Date(2026, 7, 23)

export const ACTIVOS: Activo[] = [
  {
    id: 'MA32',
    nombre: 'Méndez Álvaro 32',
    ciudad: 'Madrid · distrito Arganzuela',
    clase: 'Residencial vertical',
    claseCorta: 'Residencial',
    color: C.ink,
    href: '/team/apps/visual-lab/mendez-alvaro-32',
    render: '/visual-lab/firma-mendez',
    hint: 'Torre MA32 desde el sureste, hora dorada',
    noun: 'viviendas', nounC: 'uds',
    n: 118, col: 44, gdv: 83.9e6, pctVal: 0.358, ritmo: 5.2, lanz: 17,
    fase: 'En comercialización', fcolor: C.green,
    metricas: [
      { k: 'Precio medio', v: '5.940 €/m²' },
      { k: 'Desde', v: '348.000 €' },
      { k: 'Entrega', v: 'Q4 2027' },
    ],
    datos: [
      ['Superficie', '14.860 m²c'], ['Unidades', '118 viviendas'],
      ['Tipologías', '1–5 dorm · TH y áticos'], ['Plantas', '24 + plinto comercial'],
      ['GDV', '83,9 M€'], ['Precio medio', '5.940 €/m²'],
      ['Licencia', 'Concedida 03/2025'], ['Obra', 'Estructura pl. 9'],
      ['Entrega', 'Q4 2027'], ['Gestor', 'M. Segura'],
    ],
    tesis: 'Producto urbano compacto sobre plinto de uso mixto. La absorción se concentra en tipologías de 2 dormitorios; el margen se defiende en las plantas altas y los dos áticos dúplex, que sostienen el precio medio del edificio.',
  },
  {
    id: 'LD',
    nombre: 'Parque Comercial La Dehesa',
    ciudad: 'Alcalá de Henares · Madrid',
    clase: 'Retail · renta',
    claseCorta: 'Retail',
    color: C.accent,
    href: '/team/apps/visual-lab/la-dehesa',
    render: '/visual-lab/firma-dehesa',
    hint: 'Parque comercial: acceso, plaza y galería',
    noun: 'locales', nounC: 'loc',
    n: 35, col: 13, gdv: 47.9e6, pctVal: 0.43, ritmo: 1.8, lanz: 8,
    fase: 'Precomercialización', fcolor: C.blue,
    metricas: [
      { k: 'Renta media', v: '19,90 €/m²/mes' },
      { k: 'Ocupación', v: '52% GLA' },
      { k: 'Apertura', v: 'Q1 2028' },
    ],
    datos: [
      ['GLA', '14.240 m²'], ['Locales', '35 unidades'],
      ['Anclas', 'Supermercado + gimnasio'], ['Aparcamiento', '640 plazas'],
      ['Renta potencial', '3,40 M€/año'], ['Renta contratada', '1,46 M€/año'],
      ['NOI estabilizado', '2,99 M€'], ['Yield de salida', '6,25%'],
      ['Apertura', 'Q1 2028'], ['Gestor', 'A. Ferrán'],
    ],
    tesis: 'Activo de renta en corona metropolitana con dos anclas firmadas que garantizan flujo. La prioridad comercial es cerrar la subancla de deporte y el eje gastronómico antes de la apertura: son los que fijan la renta de la línea de locales.',
  },
  {
    id: 'VS',
    nombre: 'Valdeserra',
    ciudad: 'Colmenar Viejo · Madrid',
    clase: 'Suelo residencial de lujo',
    claseCorta: 'Suelo',
    color: C.grey,
    href: '/team/apps/visual-lab/valdeserra',
    render: '/visual-lab/firma-valdeserra',
    hint: 'Aéreo: cornisas, casa club y avenida',
    noun: 'parcelas', nounC: 'parc',
    n: 35, col: 8, gdv: 39.2e6, pctVal: 0.222, ritmo: 1.4, lanz: 12,
    fase: 'Fase II en obra', fcolor: C.gold,
    metricas: [
      { k: 'Precio suelo', v: '1.016 €/m²' },
      { k: 'Parcela media', v: '1.102 m²' },
      { k: 'Ritmo', v: '1,4 parcelas/mes' },
    ],
    datos: [
      ['Suelo vendible', '38.560 m²'], ['Parcelas', '35 en 3 fases'],
      ['Superficie', '709 – 2.088 m²'], ['Desnivel', '47 m en 3 cornisas'],
      ['Equipamiento', 'Casa club, spa y pádel'], ['Paisaje', 'Vaguada del encinar preservada'],
      ['Precio medio', '1.016 €/m² suelo'], ['GDV', '39,2 M€'],
      ['Urbanización', 'Fase I recibida'], ['Gestor', 'C. Villalba'],
    ],
    tesis: 'Tres cornisas escalonadas 13 m sobre la ladera: cada parcela domina la banda inferior y ninguna tiene vecino al frente. La vaguada del encinar rompe las cornisas en grupos de dos y tres, y eso es lo que sostiene el precio. La Fase III, en la cota alta, concentra el mirador y absorbe una prima del 26%.',
  },
]

export const ESCENARIOS: Record<Escenario, number> = { CONSERVADOR: 0.75, BASE: 1, AGRESIVO: 1.35 }
export const PERIODOS: Record<Periodo, number> = { '6M': 6, '12M': 12, '24M': 24 }

/**
 * Curva de colocación mensual de un activo, hacia atrás desde HOY.
 *
 * No es una recta: hay una rampa de cuatro meses tras el lanzamiento y un
 * desgaste lento después, que es como se comporta de verdad una promoción. El
 * último mes absorbe el redondeo para que la suma cuadre con `col` exactamente.
 */
export function serieDe(a: Activo): number[] {
  const raw: number[] = []
  for (let i = 0; i < 24; i++) {
    const edad = i - (24 - a.lanz)
    if (edad < 0) { raw.push(0); continue }
    const ramp = Math.min(1, (edad + 1) / 4)
    const fade = 1 - Math.min(0.42, edad * 0.016)
    raw.push(Math.max(0.15, ramp * fade * (0.62 + hash(a.id + 'm' + i) * 0.85)))
  }
  const suma = raw.reduce((x, y) => x + y, 0) || 1
  let acc = 0
  return raw.map((v, i) => {
    const val = i === 23 ? Math.max(0, a.col - acc) : Math.round((v / suma) * a.col)
    acc += val
    return val
  })
}

export const SERIES: Record<ActivoId, number[]> = {
  MA32: serieDe(ACTIVOS[0]),
  LD: serieDe(ACTIVOS[1]),
  VS: serieDe(ACTIVOS[2]),
}

/** Etiqueta del mes `i` de la serie (0 = hace 23 meses, 23 = mes en curso). */
export function mesDe(i: number): { l: string; mes: number; ano: number } {
  const d = new Date(HOY.getFullYear(), HOY.getMonth() - (23 - i), 1)
  const M = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  return { l: M[d.getMonth()], mes: d.getMonth(), ano: d.getFullYear() }
}

export interface ResumenCartera {
  gdv: number
  valCol: number
  dispTot: number
  ritmo: number
  mesesTot: number
  kpis: { k: string; v: string; u: string; nota: string }[]
}

export function resumen(esc: Escenario): ResumenCartera {
  const k = ESCENARIOS[esc]
  const gdv = ACTIVOS.reduce((a, p) => a + p.gdv, 0)
  const valCol = ACTIVOS.reduce((a, p) => a + p.gdv * p.pctVal, 0)
  const dispTot = ACTIVOS.reduce((a, p) => a + (p.n - p.col), 0)
  const ritmo = ACTIVOS.reduce((a, p) => a + p.ritmo, 0) * k
  const mesesTot = dispTot / Math.max(0.1, ritmo)

  return {
    gdv, valCol, dispTot, ritmo, mesesTot,
    kpis: [
      { k: 'Valor en comercialización', v: mm(gdv).replace(' M€', ''), u: 'M€ GDV', nota: '3 clases de activo · Madrid y corona' },
      { k: 'Valor colocado', v: mm(valCol).replace(' M€', ''), u: 'M€', nota: `${pct(valCol / gdv)} de la cartera · ${mm(gdv - valCol)} por colocar` },
      { k: 'Inventario disponible', v: String(dispTot), u: 'unidades', nota: '74 viviendas · 22 locales · 27 parcelas' },
      { k: 'Ritmo consolidado', v: dec(ritmo), u: '/ mes', nota: `Escenario ${esc.toLowerCase()} · media móvil 6 meses` },
      { k: 'Sell-out estimado', v: quarter(masMeses(HOY, mesesTot)), u: '', nota: `${Math.round(mesesTot)} meses de inventario` },
    ],
  }
}

export interface Hito { fecha: string; proy: string; txt: string; urgente: boolean }

export const HITOS: Hito[] = [
  { fecha: '28 ago', proy: 'MA32', txt: 'Vencen 6 reservas sin contrato firmado — plantas 4 a 9', urgente: true },
  { fecha: '02 sep', proy: 'La Dehesa', txt: 'Comité de la cadena de gimnasios sobre el local ancla B', urgente: true },
  { fecha: '08 sep', proy: 'Valdeserra', txt: 'Recepción municipal del viario de la Cornisa Media', urgente: false },
  { fecha: '15 sep', proy: 'Valdeserra', txt: 'Liberación de la Fase III y la Rinconada del Mirador', urgente: false },
  { fecha: '24 sep', proy: 'MA32', txt: 'Revisión de lista de precios plantas 14–20 (+3,2%)', urgente: false },
  { fecha: '06 oct', proy: 'La Dehesa', txt: 'Cierre del eje gastronómico — 6 locales con terraza', urgente: false },
  { fecha: '10 oct', proy: 'MA32', txt: 'Apertura del piso piloto 10B a visitas comerciales', urgente: false },
]

/** Lectura del mix — se redacta con los pesos reales, no está escrita a mano. */
export function lecturaMix(): string {
  const gdv = ACTIVOS.reduce((a, p) => a + p.gdv, 0)
  return `La cartera pesa ${pct(ACTIVOS[0].gdv / gdv)} en residencial de venta, que genera caja rápida, y `
    + `${pct(ACTIVOS[1].gdv / gdv)} en renta, que la estabiliza. El suelo de Valdeserra es la reserva de margen: `
    + 'entra en precio bajo y escala con cada etapa urbanizada.'
}

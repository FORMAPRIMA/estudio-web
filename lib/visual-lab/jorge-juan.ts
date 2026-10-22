/**
 * FP Visual Lab — Jorge Juan 40 (Madrid, Salamanca)
 *
 * Maqueta digital de EJEMPLO de un edificio real de Madrid: cómo se le aplica a
 * un inmueble existente la herramienta de producto (tocar una vivienda, abrir su
 * planta, ver su distribución). No hay precios ni estados comerciales.
 *
 * La maqueta (`jj40.glb`) sale de Blender (~/JORGE_JUAN_40_MAQUETA, ver su LEEME):
 * dos viviendas por planta en espejo, fachada y cubiertas con detalle, interior en
 * clay con la distribución de la propuesta de reforma del 5º izq. repetida en todas
 * las plantas. Los nodos traen `extras` que la escena lee:
 *   P{n}_{IZ|DR} / PB_*   exterior de una media planta  · capa 'exterior'
 *   INT_P{n}_{IZ|DR}      interior clay                  · capa 'interior'
 *   CUB_{IZ|DR}           azotea                         · capa 'cubierta'
 *   VOL_{unitId}          volumen de selección           · capa 'volumen'
 *   CTX_* / CALLE_* / ARBOL_*  entorno, calle y arbolado
 *
 * Coordenadas: el GLB está en el marco local del edificio (origen en el eje, sobre
 * la fachada de Jorge Juan, a cota de acera; en three: X a lo largo de la calle,
 * Y arriba, Z hacia el fondo de la parcela). Sin React ni three.js.
 */

import { C } from './ui'
export { C }

export const ASSETS = '/protegido/visual-lab/jorge-juan-40'
export const GLB_URL = `${ASSETS}/jj40.glb`
export const REVISION = 'v1'
export const FECHA_REVISION = '22/10/2026'

export type Mano = 'IZ' | 'DR'
export type ModoId = 'edificio' | 'planta'
export type VistaId = 'calle' | 'aerea' | 'cenital'
export type CapaId = 'entorno' | 'calle' | 'volumenes'
export type FichaTab = 'distribucion' | 'renders' | 'recorrido'

/* ── Alturas (mismas cifras que scripts/jj40_datos.py) ─────────────────── */
export const H_BAJA = 5.75
export const H_TIPO = 3.35
export const H_ATICO = 3.2
export const PLANTAS = 6

/** Cota de arranque de la planta n (0 = baja, 6 = ático, 7 = cubierta). */
export function zPlanta(n: number): number {
  if (n <= 0) return 0
  if (n <= PLANTAS) return H_BAJA + (n - 1) * H_TIPO
  return H_BAJA + (PLANTAS - 1) * H_TIPO + H_ATICO
}

export function alturaPlanta(n: number): number {
  return n === 0 ? H_BAJA : n === PLANTAS ? H_ATICO : H_TIPO
}

/** Media planta: 11,6 m a cada lado del eje y 31,8 m de fondo. */
export const ANCHO_MEDIO = 11.6
export const FONDO = 31.8

/* ── Inventario ──────────────────────────────────────────────────────── */

export interface Vivienda {
  /** '5-IZ', 'BJ-DR'… igual que `extras.unitId` en el GLB */
  id: string
  planta: number
  mano: Mano
  /** Superficie del Catastro: construida con parte de elementos comunes */
  supCatastro: number
  refCatastral: string
  tipo: 'baja' | 'tipo' | 'atico'
}

const REF = '2251203VK4725A'
// sufijos de cargo de la sede electrónica del Catastro, por planta y mano
const CARGOS: Record<string, string> = {
  'BJ-DR': '0001LY', 'BJ-IZ': '0002BU', '1-DR': '0003ZI', '1-IZ': '0004XO',
  '2-DR': '0005MP', '2-IZ': '0006QA', '3-DR': '0007WS', '3-IZ': '0008ED',
  '4-DR': '0009RF', '4-IZ': '0010WS', '5-DR': '0011ED', '5-IZ': '0012RF',
  '6-DR': '0013TG', '6-IZ': '0014YH',
}
const SUP: Record<number, number> = { 0: 337, 1: 365, 2: 368, 3: 368, 4: 368, 5: 368, 6: 300 }

export const VIVIENDAS: Vivienda[] = (() => {
  const l: Vivienda[] = []
  for (let p = PLANTAS; p >= 0; p--) {
    for (const mano of ['IZ', 'DR'] as Mano[]) {
      const id = `${p === 0 ? 'BJ' : p}-${mano}`
      l.push({
        id, planta: p, mano,
        supCatastro: SUP[p],
        refCatastral: REF + CARGOS[id],
        tipo: p === 0 ? 'baja' : p === PLANTAS ? 'atico' : 'tipo',
      })
    }
  }
  return l
})()

export const BY_ID: Record<string, Vivienda> = Object.fromEntries(VIVIENDAS.map((v) => [v.id, v]))

export const SUP_TOTAL = VIVIENDAS.reduce((a, v) => a + v.supCatastro, 0)

/* ── Textos ──────────────────────────────────────────────────────────── */

export function plantaLabel(p: number): string {
  return p === 0 ? 'Bajo' : p === PLANTAS ? '6º · ático' : `${p}º`
}

export function nombreVivienda(v: Vivienda): string {
  return `${v.planta === 0 ? 'Bajo' : `${v.planta}º`} ${v.mano === 'IZ' ? 'izquierda' : 'derecha'}`
}

/** Programa de la propuesta de reforma (5º izq.), que la maqueta repite en todas las plantas. */
export const PROGRAMA = [
  { k: 'Dormitorios', v: '5 · uno es estudio' },
  { k: 'Baños', v: '4 + aseo de cortesía y de servicio' },
  { k: 'Salón y comedor', v: 'Con mirador a Jorge Juan' },
  { k: 'Cocina', v: 'Con isla y desayunador' },
  { k: 'Family room', v: 'Junto a la cocina' },
  { k: 'Servicio', v: 'Lavandería y escalera propia' },
]

export function datosVivienda(v: Vivienda): { k: string; v: string }[] {
  return [
    { k: 'Planta', v: plantaLabel(v.planta) },
    { k: 'Mano', v: v.mano === 'IZ' ? 'Izquierda · este' : 'Derecha · oeste' },
    { k: 'Superficie Catastro', v: `${v.supCatastro} m²` },
    { k: 'Fachadas', v: 'Jorge Juan y patio de manzana' },
    { k: 'Patios', v: 'Central y lateral de medianera' },
    { k: 'Ref. catastral', v: v.refCatastral },
  ]
}

/** Renders interiores del proyecto (los mismos para todas las viviendas: misma distribución). */
export const RENDERS: { n: string; t: string }[] = [
  { n: '02', t: 'Recibidor · puerta de entrada' },
  { n: '03', t: 'Recibidor hacia el salón' },
  { n: '01', t: 'Recibidor hacia la cocina' },
  { n: '04', t: 'Cocina · isla y desayunador' },
  { n: '05', t: 'Cocina · office y café' },
  { n: '06', t: 'Salón y comedor' },
  { n: '07', t: 'Salón · ventanas a Jorge Juan' },
  { n: '09', t: 'Salón · chimenea y mirador' },
  { n: '08', t: 'Salón hacia el recibidor' },
  { n: '10', t: 'Dorm. principal' },
]
export const renderUrl = (n: string, min = false) => `${ASSETS}/renders/jj40-${n}${min ? '-min' : ''}.jpg`

/* ── Estancias (numeración de la propuesta de reforma) ───────────────── */

/**
 * Centro de cada estancia en coordenadas del PLANO de la propuesta (dibujo izquierdo de
 * `FP_JJ40_3D_Aux CAD.dwg`, m). Paso al marco local: X = y − 5,45 · Y = x − 34,8; y en
 * three (GLB Y-up): x = X, z = −Y. La numeración es la de la leyenda del plano.
 */
const ESTANCIAS_PLANO: { n: number; nombre: string; x: number; y: number }[] = [
  { n: 1, nombre: 'Recibidor', x: 28.4, y: 10.0 },
  { n: 2, nombre: 'Salón', x: 32.2, y: 9.3 },
  { n: 3, nombre: 'Comedor', x: 32.3, y: 14.5 },
  { n: 4, nombre: 'Cocina', x: 27.4, y: 15.4 },
  { n: 5, nombre: 'Lavandería', x: 23.9, y: 12.8 },
  { n: 6, nombre: 'Aseo servicio', x: 22.1, y: 12.9 },
  { n: 7, nombre: 'Family room', x: 23.0, y: 10.9 },
  { n: 8, nombre: 'Distribuidor', x: 17.4, y: 8.7 },
  { n: 9, nombre: 'Gabanero', x: 20.9, y: 9.9 },
  { n: 10, nombre: 'Aseo cortesía', x: 14.9, y: 7.5 },
  { n: 11, nombre: 'Estudio', x: 21.3, y: 6.3 },
  { n: 12, nombre: 'Dormitorio 02', x: 17.0, y: 11.9 },
  { n: 13, nombre: 'Baño dorm. 02', x: 12.8, y: 10.3 },
  { n: 14, nombre: 'Despacho', x: 16.2, y: 14.4 },
  { n: 15, nombre: 'Dormitorio 03', x: 12.0, y: 15.5 },
  { n: 16, nombre: 'Vestidor dorm. 03', x: 10.7, y: 11.8 },
  { n: 17, nombre: 'Baño dorm. 03', x: 12.7, y: 12.4 },
  { n: 18, nombre: 'Dormitorio 04', x: 8.1, y: 6.6 },
  { n: 19, nombre: 'Vestidor dorm. 04', x: 11.1, y: 7.1 },
  { n: 20, nombre: 'Baño dorm. 04', x: 12.9, y: 6.6 },
  { n: 21, nombre: 'Terraza dorm. 04', x: 4.4, y: 7.0 },
  { n: 22, nombre: 'Dorm. principal', x: 8.4, y: 12.9 },
  { n: 23, nombre: 'Vestidor ppal.', x: 7.9, y: 15.6 },
  { n: 24, nombre: 'Baño ppal.', x: 4.2, y: 14.3 },
  { n: 25, nombre: 'Terraza ppal.', x: 4.4, y: 10.2 },
]

export interface Estancia { n: number; nombre: string; pos: [number, number, number] }

/** Estancias de una vivienda, en coordenadas del GLB y a 0,9 m sobre su suelo. */
export function estanciasDe(v: Vivienda): Estancia[] {
  const sx = v.mano === 'IZ' ? 1 : -1
  const y = zPlanta(v.planta) + 0.3 + 0.9
  return ESTANCIAS_PLANO.flatMap((e) => {
    const X = e.y - 5.45, Y = e.x - 34.8
    // el ático pierde lo que cae en las terrazas delanteras; el bajo, la galería trasera
    if (v.tipo === 'atico' && Y > -5 && X > 3.6) return []
    if (v.tipo === 'baja' && Y < -29.1) return []
    return [{ n: e.n, nombre: e.nombre, pos: [sx * X, y, -Y] as [number, number, number] }]
  })
}

export const FICHA_TABS: { id: FichaTab; label: string }[] = [
  { id: 'distribucion', label: 'Distribución' },
  { id: 'renders', label: 'Renders' },
  { id: 'recorrido', label: 'Recorrido' },
]

export const MODOS: { id: ModoId; label: string; nota: string }[] = [
  { id: 'edificio', label: 'Edificio', nota: 'La maqueta completa con su calle' },
  { id: 'planta', label: 'Despiece por planta', nota: 'Las plantas de encima suben y se ve la distribución en clay' },
]

export const VISTAS: { id: VistaId; label: string }[] = [
  { id: 'calle', label: 'Fachada' },
  { id: 'aerea', label: 'Patio de manzana' },
  { id: 'cenital', label: 'Cenital' },
]

export const CAPAS: { id: CapaId; label: string; nota: string }[] = [
  { id: 'entorno', label: 'Entorno', nota: 'Edificios vecinos del Catastro como volúmenes' },
  { id: 'calle', label: 'Calle y arbolado', nota: 'Aceras, bolardos, cruces y la fila de acacias' },
  { id: 'volumenes', label: 'Viviendas', nota: 'Las 14 viviendas como volúmenes de color' },
]

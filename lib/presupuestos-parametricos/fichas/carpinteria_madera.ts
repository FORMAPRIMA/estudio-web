// Ficha 5 — Carpintería de madera.
//
// Puertas por unidad (una por recinto cerrado; correderas las que se indiquen),
// armarios, vestidor y muebles por ml de frente. Validado por José (21 oct 2026).
// Los armarios crecen con la vivienda por geometría: f = √(útil / 75), mínimo 0,85
// (la pared de un dormitorio crece con la raíz de su superficie). El vestidor crece
// más deprisa (5 ml por cada 100 m², mínimo 4): en los pisos grandes es un recinto
// en U. El arquitecto puede escribir los ml reales de armarios o de vestidor.

import { type Ficha, type Valores, type Cantidad, num, siNo, n2, SIN_DATO } from './tipos'
import { piezas } from './equipamiento'
import { zonasHumedas } from './pinturas'

const K = {
  util_referencia:   { valor: 75,   provisional: false, nota: 'superficie útil de referencia para el factor de escala' },
  factor_min:        { valor: 0.85, provisional: false, nota: 'factor mínimo en pisos pequeños' },
  armario_principal: { valor: 3.0,  provisional: false, nota: 'ml de armario del dormitorio principal (a 75 m²)' },
  armario_dormitorio:{ valor: 2.2,  provisional: false, nota: 'ml de armario por dormitorio secundario (a 75 m²)' },
  armario_entrada:   { valor: 1.2,  provisional: false, nota: 'ml de armario de entrada (a 75 m²)' },
  vestidor_por_100:  { valor: 5,    provisional: false, nota: 'ml de vestidor por cada 100 m² útiles' },
  vestidor_min:      { valor: 4,    provisional: false, nota: 'vestidor mínimo, ml' },
  mueble_lavabo:     { valor: 0.8,  provisional: false, nota: 'ml de mueble por lavabo' },
  mueble_doble_m2:   { valor: 0.12, provisional: false, nota: 'mueble de doble lavabo: ml por m² de baño principal' },
  mueble_doble_min:  { valor: 1.4,  provisional: false, nota: 'mueble de doble lavabo mínimo, ml' },
}
const k = (c: keyof typeof K) => K[c].valor

function factor(v: Valores): number | null {
  const u = num(v, 'sup_util')
  return u == null ? null : Math.max(k('factor_min'), Math.sqrt(u / k('util_referencia')))
}

function puertaEntrada(v: Valores): Cantidad {
  const si = siNo(v, 'cambiar_puerta_entrada') ?? true
  return { cantidad: si ? 1 : 0, fuente: 'express', formula: si ? 'puerta de entrada nueva' : 'se mantiene la puerta de entrada' }
}

function puertasPaso(v: Valores): { total: number; formula: string } | null {
  const dorm = num(v, 'n_dormitorios_proy'), banos = num(v, 'n_banos_proy')
  if (dorm == null || banos == null) return null
  const aseos = num(v, 'n_aseos_proy') ?? 0
  const cocina = siNo(v, 'cocina_cerrada_proy') ? 1 : 0
  const lav = siNo(v, 'lavadero_proy') ? 1 : 0
  return {
    total: dorm + banos + aseos + cocina + lav + 1,
    formula: `${dorm} dorm. + ${banos} baños + ${aseos} aseos${cocina ? ' + cocina' : ''}${lav ? ' + lavadero' : ''} + 1 día`,
  }
}

function abatibles(v: Valores): Cantidad {
  const p = puertasPaso(v)
  if (!p) return SIN_DATO('programa reformado')
  const corr = Math.min(p.total, num(v, 'n_puertas_correderas') ?? 0)
  return { cantidad: p.total - corr, fuente: 'express', formula: `${p.total} puertas (${p.formula})${corr ? ` − ${corr} correderas` : ''}` }
}

function correderas(v: Valores): Cantidad {
  const p = puertasPaso(v)
  if (!p) return SIN_DATO('programa reformado')
  const corr = Math.min(p.total, num(v, 'n_puertas_correderas') ?? 0)
  return { cantidad: corr, fuente: 'express', formula: corr ? `${corr} correderas indicadas` : 'ninguna corredera' }
}

function armarios(v: Valores): Cantidad {
  const real = num(v, 'ml_armarios_proy')
  if (real != null) return { cantidad: real, fuente: 'tecnico', formula: `${n2(real)} ml indicados por el arquitecto` }
  const f = factor(v)
  const dorm = num(v, 'n_dormitorios_proy')
  if (f == null || dorm == null) return SIN_DATO('superficie útil y programa')
  const vestidor = !!siNo(v, 'vestidor_proy')
  const ppal = dorm > 0 && !vestidor ? k('armario_principal') : 0
  const resto = Math.max(0, dorm - 1) * k('armario_dormitorio')
  const total = (ppal + resto + k('armario_entrada')) * f
  return {
    cantidad: total, fuente: 'express',
    formula: `(${ppal ? `${k('armario_principal')} principal + ` : vestidor ? 'principal con vestidor + ' : ''}${Math.max(0, dorm - 1)} × ${k('armario_dormitorio')} + ${k('armario_entrada')} entrada) × f ${n2(f)}`,
  }
}

function vestidor(v: Valores): Cantidad {
  if (!siNo(v, 'vestidor_proy')) return { cantidad: 0, fuente: 'tecnico', formula: 'sin vestidor' }
  const real = num(v, 'ml_vestidor_proy')
  if (real != null) return { cantidad: real, fuente: 'tecnico', formula: `${n2(real)} ml indicados por el arquitecto` }
  const u = num(v, 'sup_util')
  if (u == null) return SIN_DATO('superficie útil')
  const ml = Math.max(k('vestidor_min'), u / 100 * k('vestidor_por_100'))
  return { cantidad: ml, fuente: 'express', formula: `${n2(u)} m² útiles × ${k('vestidor_por_100')} ml / 100 m² (mínimo ${k('vestidor_min')})` }
}

function mueblesBano(v: Valores): Cantidad {
  const p = piezas(v)
  const z = zonasHumedas(v)
  if (!p || !z) return SIN_DATO('programa reformado')
  const banos = num(v, 'n_banos_proy') ?? 0
  const doble = banos > 0 && p.lavabos > banos + (num(v, 'n_aseos_proy') ?? 0)
  const simples = p.lavabos - (doble ? 2 : 0)
  const mlDoble = doble ? Math.max(k('mueble_doble_min'), z.banoPpal * k('mueble_doble_m2')) : 0
  return {
    cantidad: simples * k('mueble_lavabo') + mlDoble, fuente: 'express',
    formula: `${simples} lavabos × ${k('mueble_lavabo')}${doble ? ` + doble lavabo ${n2(mlDoble)} ml (baño principal de ${n2(z.banoPpal)} m²)` : ''}`,
  }
}

function porDato(codigo: string, unidad: string, que: string) {
  return (v: Valores): Cantidad => {
    const n = num(v, codigo) ?? 0
    return n > 0 ? { cantidad: n, fuente: 'express', formula: `${n2(n)} ${unidad} de ${que}` } : { cantidad: 0, fuente: 'tecnico', formula: `sin ${que}` }
  }
}

const PROG = ['n_dormitorios_proy', 'n_banos_proy', 'n_aseos_proy', 'cocina_cerrada_proy', 'lavadero_proy']

export const FICHA_CARPINTERIA_MADERA: Ficha = {
  capitulo: 5,
  nombre: 'Carpintería de madera',
  dependeDelNivel: true,
  descripcion: 'Puerta de entrada, puertas de paso, armarios empotrados, vestidor, muebles de baño, muebles a medida y panelados.',
  coeficientes: K,
  partes: [
    { codigo: 'cm_entrada', nombre: 'Puerta de entrada', unidad: 'ud', criterio: 'Puerta de acceso blindada o acorazada con su cerco y herrajes.', subcapitulos: ['5_CM_01'], variables: ['cambiar_puerta_entrada'], cantidad: puertaEntrada },
    { codigo: 'cm_abatibles', nombre: 'Puertas de paso abatibles', unidad: 'ud', criterio: 'Puertas de paso abatibles con premarco, tapajuntas y herrajes.', subcapitulos: ['5_CM_02'], variables: [...PROG, 'n_puertas_correderas'], cantidad: abatibles },
    { codigo: 'cm_correderas', nombre: 'Puertas de paso correderas', unidad: 'ud', criterio: 'Puertas correderas con casoneto o vistas, con herrajes.', subcapitulos: ['5_CM_03'], variables: [...PROG, 'n_puertas_correderas'], cantidad: correderas },
    { codigo: 'cm_armarios', nombre: 'Armarios empotrados', unidad: 'ml', criterio: 'Frentes e interiores de armario empotrado, por ml de frente.', subcapitulos: ['5_CM_04'], variables: ['sup_util', 'n_dormitorios_proy', 'vestidor_proy', 'ml_armarios_proy'], cantidad: armarios },
    { codigo: 'cm_vestidor', nombre: 'Vestidor', unidad: 'ml', criterio: 'Módulos de vestidor abierto o con frentes, por ml.', subcapitulos: ['5_CM_06'], variables: ['sup_util', 'vestidor_proy', 'ml_vestidor_proy'], cantidad: vestidor },
    { codigo: 'cm_muebles_bano', nombre: 'Muebles de baño', unidad: 'ml', criterio: 'Muebles bajo lavabo, por ml.', subcapitulos: ['5_CM_07'], variables: ['n_banos_proy', 'n_aseos_proy', 'sup_util', 'm2_bano_principal_proy'], cantidad: mueblesBano },
    { codigo: 'cm_muebles_medida', nombre: 'Muebles a medida', unidad: 'ml', criterio: 'Librerías, muebles de salón, bancos y similares.', subcapitulos: ['5_CM_05'], variables: ['ml_muebles_medida'], cantidad: porDato('ml_muebles_medida', 'ml', 'muebles a medida') },
    { codigo: 'cm_panelados', nombre: 'Panelados y frisos', unidad: 'm²', criterio: 'Panelados y frisos de madera.', subcapitulos: ['5_CM_08'], variables: ['m2_panelados'], cantidad: porDato('m2_panelados', 'm²', 'panelados') },
  ],
}

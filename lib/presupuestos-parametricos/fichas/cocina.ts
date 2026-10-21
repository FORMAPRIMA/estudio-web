// Ficha 9 — Cocina.
//
// La cantidad la marca el tamaño de la cocina (9,5 % de la útil o el dato del
// arquitecto, como en Pinturas). Cada oficio en su unidad (validado por José,
// 21 oct 2026): mobiliario por ml de frente (altos y columnas van en el ratio),
// encimera + aplacado + fregadero por m² de piedra, electrodomésticos por unidad.
// El frente aplacado se presupuesta aquí, no en los alicatados de Pinturas.

import { type Ficha, type Valores, type Cantidad, num, siNo, n2, SIN_DATO } from './tipos'
import { zonasHumedas, mlCocina } from './pinturas'

const K = {
  isla_largo:      { valor: 2.4,  provisional: false, nota: 'isla tipo: largo, m' },
  isla_fondo:      { valor: 1.0,  provisional: false, nota: 'isla tipo: fondo, m' },
  encimera_fondo:  { valor: 0.62, provisional: false, nota: 'fondo de encimera, m' },
  frente_alto:     { valor: 0.6,  provisional: false, nota: 'altura del frente aplacado, m' },
  electro_base:    { valor: 7,    provisional: false, nota: '6 básicos (frigorífico, horno, placa, campana, lavavajillas, microondas) + lavadora' },
  lavanderia_ml:   { valor: 1.8,  provisional: false, nota: 'mueble de lavandería, ml' },
}
const k = (c: keyof typeof K) => K[c].valor

function cocinaM2(v: Valores): number | null {
  return zonasHumedas(v)?.cocina ?? null
}

function mobiliario(v: Valores): Cantidad {
  const a = cocinaM2(v)
  if (a == null) return SIN_DATO('superficie útil y programa')
  const isla = siNo(v, 'isla_cocina') ? k('isla_largo') : 0
  return {
    cantidad: mlCocina(a) + isla, fuente: num(v, 'm2_cocina_proy') != null ? 'tecnico' : 'express',
    formula: `cocina de ${n2(a)} m²: perímetro 4,4·√${n2(a)} × 0,5 = ${n2(mlCocina(a))} ml${isla ? ` + isla ${isla} ml` : ''}`,
  }
}

function encimera(v: Valores): Cantidad {
  const a = cocinaM2(v)
  if (a == null) return SIN_DATO('superficie útil y programa')
  const ml = mlCocina(a)
  const isla = siNo(v, 'isla_cocina') ? k('isla_largo') * k('isla_fondo') : 0
  return {
    cantidad: ml * (k('encimera_fondo') + k('frente_alto')) + isla, fuente: 'express',
    formula: `${n2(ml)} ml × (${k('encimera_fondo')} encimera + ${k('frente_alto')} frente)${isla ? ` + isla ${n2(isla)} m²` : ''}`,
  }
}

function electrodomesticos(v: Valores): Cantidad {
  const extra = num(v, 'n_electro_extra') ?? 0
  return { cantidad: k('electro_base') + extra, fuente: 'express', formula: `${k('electro_base')} básicos + ${extra} extra` }
}

function lavanderia(v: Valores): Cantidad {
  return siNo(v, 'lavadero_proy')
    ? { cantidad: k('lavanderia_ml'), fuente: 'express', formula: `${k('lavanderia_ml')} ml de mueble de lavandería` }
    : { cantidad: 0, fuente: 'tecnico', formula: 'sin lavadero' }
}

const BASE = ['sup_util', 'm2_cocina_proy', 'n_banos_proy']

export const FICHA_COCINA: Ficha = {
  capitulo: 9,
  nombre: 'Cocina',
  dependeDelNivel: true,
  descripcion: 'Mobiliario de cocina, encimera con aplacado y fregadero, electrodomésticos y mueble de lavandería.',
  coeficientes: K,
  partes: [
    { codigo: 'coc_mobiliario', nombre: 'Mobiliario de cocina', unidad: 'ml', criterio: 'Muebles bajos, altos y columnas, con herrajes, montaje y accesorios. Se mide por ml de frente.', subcapitulos: ['9_COC_01'], variables: [...BASE, 'isla_cocina'], cantidad: mobiliario },
    { codigo: 'coc_encimera', nombre: 'Encimera, aplacado y fregadero', unidad: 'm²', criterio: 'Encimera, frente aplacado del mismo material, faldones y fregadero.', subcapitulos: ['9_COC_02'], variables: [...BASE, 'isla_cocina'], cantidad: encimera },
    { codigo: 'coc_electro', nombre: 'Electrodomésticos', unidad: 'ud', criterio: 'Electrodomésticos integrables, con su instalación.', subcapitulos: ['9_COC_03'], variables: ['n_electro_extra'], cantidad: electrodomesticos },
    { codigo: 'coc_lavanderia', nombre: 'Mobiliario de lavandería', unidad: 'ml', criterio: 'Muebles de lavandería con hueco para lavadora y secadora.', subcapitulos: ['9_COC_05'], variables: ['lavadero_proy'], cantidad: lavanderia },
  ],
}

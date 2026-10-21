// Ficha 8 — Equipamiento: sanitarios, griferías y accesorios de baño.
//
// Del programa, sin preguntas nuevas. El baño principal escala con su tamaño (el
// mismo de Pinturas: 5,5 % de la útil o el dato del arquitecto), como la cocina.
// Validado por José (21 oct 2026). Mamparas y espejos van en Carpintería exterior y
// vidriería, muebles de baño en Carpintería de madera y mecanismos en Instalaciones.

import { type Ficha, type Valores, type Cantidad, num, siNo, n2, SIN_DATO } from './tipos'
import { zonasHumedas } from './pinturas'

const K = {
  piezas_bano:        { valor: 3, provisional: false, nota: 'baño: inodoro, lavabo y plato de ducha' },
  piezas_aseo:        { valor: 2, provisional: false, nota: 'aseo: inodoro y lavabo' },
  ppal_umbral_doble:  { valor: 6, provisional: false, nota: 'baño principal desde 6 m²: doble lavabo (4 piezas)' },
  ppal_umbral_banera: { valor: 8, provisional: false, nota: 'baño principal desde 8 m²: doble lavabo, ducha y bañera (5 piezas)' },
}
const k = (c: keyof typeof K) => K[c].valor

type Piezas = { inodoros: number; lavabos: number; duchas: number; banera: number; total: number; formula: string }

export function piezas(v: Valores): Piezas | null {
  const banos = num(v, 'n_banos_proy')
  const z = zonasHumedas(v)
  if (banos == null || !z) return null
  const aseos = num(v, 'n_aseos_proy') ?? 0
  const ppal = z.banoPpal
  const ppalDoble = banos > 0 && ppal >= k('ppal_umbral_doble')
  const ppalBanera = banos > 0 && ppal >= k('ppal_umbral_banera')
  const inodoros = banos + aseos
  const lavabos = banos + aseos + (ppalDoble ? 1 : 0)
  const duchas = banos
  const banera = ppalBanera ? 1 : 0
  const tipoPpal = banos === 0 ? '' : ppalBanera ? `baño principal de ${n2(ppal)} m²: doble lavabo + ducha + bañera` : ppalDoble ? `baño principal de ${n2(ppal)} m²: doble lavabo` : `baño principal de ${n2(ppal)} m²: 3 piezas`
  return {
    inodoros, lavabos, duchas, banera, total: inodoros + lavabos + duchas + banera,
    formula: `${banos} baños × ${k('piezas_bano')} + ${aseos} aseos × ${k('piezas_aseo')}${tipoPpal ? ` · ${tipoPpal}` : ''}`,
  }
}

function sanitarios(v: Valores): Cantidad {
  const p = piezas(v)
  if (!p) return SIN_DATO('programa reformado')
  return { cantidad: p.total, fuente: 'express', formula: `${p.formula} → ${p.inodoros} inodoros, ${p.lavabos} lavabos, ${p.duchas} platos${p.banera ? ', 1 bañera' : ''}` }
}

function griferias(v: Valores): Cantidad {
  const p = piezas(v)
  if (!p) return SIN_DATO('programa reformado')
  const lav = siNo(v, 'lavadero_proy') ? 1 : 0
  return {
    cantidad: p.lavabos + p.duchas + p.banera + 1 + lav, fuente: 'express',
    formula: `${p.lavabos} lavabos + ${p.duchas} duchas${p.banera ? ' + 1 bañera' : ''} + 1 fregadero${lav ? ' + 1 pila de lavadero' : ''}`,
  }
}

function accesorios(v: Valores): Cantidad {
  const banos = num(v, 'n_banos_proy')
  if (banos == null) return SIN_DATO('programa reformado')
  const aseos = num(v, 'n_aseos_proy') ?? 0
  return { cantidad: banos + aseos, fuente: 'express', formula: `${banos} baños + ${aseos} aseos (un juego cada uno)` }
}

const BASE = ['n_banos_proy', 'n_aseos_proy', 'sup_util', 'm2_bano_principal_proy']

export const FICHA_EQUIPAMIENTO: Ficha = {
  capitulo: 8,
  nombre: 'Equipamiento',
  dependeDelNivel: true,
  descripcion: 'Sanitarios, griferías y accesorios de baño. Mamparas, espejos, muebles de baño y mecanismos van en sus capítulos.',
  coeficientes: K,
  partes: [
    { codigo: 'eq_sanitarios', nombre: 'Sanitarios', unidad: 'ud', criterio: 'Inodoros, lavabos, platos de ducha y bañeras, con su montaje.', subcapitulos: ['8_EQ_01'], variables: BASE, cantidad: sanitarios },
    { codigo: 'eq_griferias', nombre: 'Griferías', unidad: 'ud', criterio: 'Grifos de lavabo, conjuntos de ducha y bañera, grifo de fregadero y de pila.', subcapitulos: ['8_EQ_02'], variables: [...BASE, 'lavadero_proy'], cantidad: griferias },
    { codigo: 'eq_accesorios', nombre: 'Accesorios de baño', unidad: 'ud', criterio: 'Juego de accesorios por baño o aseo: toallero, portarrollos y perchas.', subcapitulos: ['8_EQ_02'], variables: ['n_banos_proy', 'n_aseos_proy'], cantidad: accesorios },
  ],
}

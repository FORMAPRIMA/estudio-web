// Ficha 4 — Carpintería exterior y vidriería.
//
// Ventanas, vidrio y persianas salen de los alzados (ventana a ventana: se cambia
// o no, con persiana o sin ella; ancho medido en la maqueta, alto y antepecho por
// defecto o corregidos). Mamparas y espejos, de las duchas y lavabos de
// Equipamiento. Validado por José (21 oct 2026).

import { type Ficha, type Valores, type Cantidad, num, n2, SIN_DATO } from './tipos'
import { piezas } from './equipamiento'
import { zonasHumedas } from './pinturas'

const K = {
  mampara_ducha:      { valor: 3.0, provisional: false, nota: 'mampara de ducha: frente de 1,5 m × 2,0 m' },
  mampara_ducha_ppal: { valor: 4.0, provisional: false, nota: 'mampara del baño principal de 8 m² o más' },
  mampara_banera:     { valor: 1.5, provisional: false, nota: 'pantalla de bañera: 1,0 × 1,5 m' },
  ppal_grande:        { valor: 8,   provisional: false, nota: 'baño principal grande desde 8 m²' },
  espejo_lavabo:      { valor: 1.0, provisional: false, nota: 'espejo por lavabo, m²' },
}
const k = (c: keyof typeof K) => K[c].valor

function ventanas(v: Valores): Cantidad {
  const m2 = num(v, 'm2_ventanas_cambiar')
  if (m2 == null) return SIN_DATO('ventanas que se cambian (alzados)')
  return { cantidad: m2, fuente: 'tecnico', formula: `${n2(m2)} m² de huecos que se cambian (alzados)` }
}

function persianas(v: Valores): Cantidad {
  const n = num(v, 'n_persianas')
  if (n == null) return SIN_DATO('persianas (alzados)')
  return { cantidad: n, fuente: 'tecnico', formula: `${n} persianas (alzados)` }
}

function mamparas(v: Valores): Cantidad {
  const p = piezas(v)
  const z = zonasHumedas(v)
  if (!p || !z) return SIN_DATO('programa reformado')
  const grande = p.duchas > 0 && z.banoPpal >= k('ppal_grande')
  const m2 = (p.duchas - (grande ? 1 : 0)) * k('mampara_ducha') + (grande ? k('mampara_ducha_ppal') : 0) + p.banera * k('mampara_banera')
  return {
    cantidad: m2, fuente: 'express',
    formula: `${p.duchas - (grande ? 1 : 0)} duchas × ${k('mampara_ducha')}${grande ? ` + ducha principal ${k('mampara_ducha_ppal')}` : ''}${p.banera ? ` + bañera ${k('mampara_banera')}` : ''} m²`,
  }
}

function espejos(v: Valores): Cantidad {
  const p = piezas(v)
  if (!p) return SIN_DATO('programa reformado')
  return { cantidad: p.lavabos * k('espejo_lavabo'), fuente: 'express', formula: `${p.lavabos} lavabos × ${k('espejo_lavabo')} m²` }
}

export const FICHA_CARPINTERIA_EXTERIOR: Ficha = {
  capitulo: 4,
  nombre: 'Carpintería exterior y vidriería',
  dependeDelNivel: true,
  descripcion: 'Ventanas y balconeras, vidrio, persianas, mamparas y espejos.',
  coeficientes: K,
  partes: [
    { codigo: 'cyv_carpinteria', nombre: 'Ventanas y balconeras', unidad: 'm²', criterio: 'Carpintería de madera, aluminio o PVC con herrajes, sin vidrio ni persiana.', subcapitulos: ['4_CYV_01', '4_CYV_02'], variables: ['m2_ventanas_cambiar'], cantidad: ventanas },
    { codigo: 'cyv_vidrio', nombre: 'Vidrio', unidad: 'm²', criterio: 'Doble acristalamiento de las ventanas que se cambian.', subcapitulos: ['4_CYV_01', '4_CYV_02'], variables: ['m2_ventanas_cambiar'], cantidad: ventanas },
    { codigo: 'cyv_persianas', nombre: 'Persianas', unidad: 'ud', criterio: 'Persiana con cajón, guías y accionamiento.', subcapitulos: ['4_CYV_03'], variables: ['n_persianas'], cantidad: persianas },
    { codigo: 'cyv_mamparas', nombre: 'Mamparas', unidad: 'm²', criterio: 'Mamparas de ducha y pantallas de bañera.', subcapitulos: ['4_CYV_04'], variables: ['n_banos_proy', 'n_aseos_proy', 'sup_util', 'm2_bano_principal_proy'], cantidad: mamparas },
    { codigo: 'cyv_espejos', nombre: 'Espejos', unidad: 'm²', criterio: 'Espejos de baño y aseo, uno por lavabo.', subcapitulos: ['4_CYV_05'], variables: ['n_banos_proy', 'n_aseos_proy', 'sup_util', 'm2_bano_principal_proy'], cantidad: espejos },
  ],
}

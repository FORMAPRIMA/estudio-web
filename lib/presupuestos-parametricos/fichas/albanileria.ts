// Ficha 3 — Albañilería. En construcción: de momento solo la tabiquería nueva.
//
// La herramienta es para reformas INTEGRALES con redistribución total y sin proyecto:
// el estado reformado se describe con un programa cerrado (dormitorios, baños,
// aseos, cocina cerrada, salón y comedor separados), nunca con preguntas abiertas.
// Sí depende del nivel de calidad: el ratio €/m² de tabique sale por nivel.
//
// Tabiquería nueva (acordada con José, 20 oct 2026):
//   m² = tabique demolido (maqueta del estado actual, ml) × N reformado / N actual × H
// N cuenta dormitorios + baños + aseos + cocina si es cerrada + salón-comedor (2 si
// van separados). No cuentan vestidores, lavanderías, almacenes ni pasillos.
// Probada en 4 distribuciones reales (un piso de 76 m² y Lope de Rueda 4 con tres
// propuestas): el error fue de +2 % a +15 %, siempre al alza, así que no lleva
// coeficiente de corrección (se probó un +7 % y José lo descartó: ya va del lado seguro).

import { type Ficha, type Valores, type Cantidad, num, siNo, n2, SIN_DATO } from './tipos'

const K = {
  altura_defecto:     { valor: 2.6,  provisional: true,  nota: 'altura libre si no se ha medido' },
}
const k = (c: keyof typeof K) => K[c].valor

/** Estancias del programa reformado con la regla acordada. */
export function estanciasProyectadas(v: Valores): number | null {
  const dorm = num(v, 'n_dormitorios_proy')
  const banos = num(v, 'n_banos_proy')
  if (dorm == null || banos == null) return null
  const aseos = num(v, 'n_aseos_proy') ?? 0
  const cocina = siNo(v, 'cocina_cerrada_proy') ? 1 : 0
  const dia = siNo(v, 'salon_comedor_separados_proy') ? 2 : 1
  return dorm + banos + aseos + cocina + dia
}

function tabiqueriaNueva(v: Valores): Cantidad {
  const demolido = num(v, 'ml_tabique_demoler')
  if (demolido == null) return SIN_DATO('tabique demolido (maqueta del estado actual)')
  const n0 = num(v, 'n_estancias_actual')
  if (!n0) return SIN_DATO('estancias del estado actual')
  const n1 = estanciasProyectadas(v)
  if (n1 == null) return SIN_DATO('programa reformado (dormitorios y baños)')
  const h = num(v, 'altura_libre') ?? k('altura_defecto')
  return {
    cantidad: demolido * (n1 / n0) * h,
    fuente: num(v, 'altura_libre') != null ? 'tecnico' : 'express',
    formula: `${n2(demolido)} ml demolidos × ${n1}/${n0} estancias × ${n2(h)} m`,
  }
}

export const FICHA_ALBANILERIA: Ficha = {
  capitulo: 3,
  nombre: 'Albañilería',
  dependeDelNivel: true,
  descripcion: 'Tabiquería nueva, trasdosados, guarnecidos, falsos techos, foseados, recrecidos y ayudas. En construcción: de momento solo la tabiquería.',
  coeficientes: K,
  partes: [
    {
      codigo: 'alb_tabiqueria', nombre: 'Tabiquería nueva', unidad: 'm²',
      criterio: 'Tabiques interiores de nueva ejecución (placa de yeso o fábrica), con su aislamiento, refuerzos y precercos. No incluye trasdosados de fachada ni frentes de armario; las correderas y plegables que separan espacios son carpintería.',
      subcapitulos: ['3_ALB_02'],
      variables: ['ml_tabique_demoler', 'n_estancias_actual', 'n_dormitorios_proy', 'n_banos_proy', 'n_aseos_proy', 'cocina_cerrada_proy', 'salon_comedor_separados_proy', 'altura_libre'],
      cantidad: tabiqueriaNueva,
    },
  ],
}

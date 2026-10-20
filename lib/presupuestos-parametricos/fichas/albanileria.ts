// Ficha 3 — Albañilería.
//
// La herramienta es para reformas INTEGRALES con redistribución total y sin proyecto:
// el estado reformado se describe con un programa cerrado (dormitorios, baños,
// aseos, cocina cerrada, salón y comedor separados), nunca con preguntas abiertas.
// Las cantidades NO dependen del nivel de calidad: el nivel entra solo en el precio
// (ratio € por unidad de cada parte, ajustado por nivel con las obras reales).
//
// Tabiquería nueva (acordada con José, 20 oct 2026):
//   m² = tabique demolido (maqueta del estado actual, ml) × N reformado / N actual × H
// N cuenta dormitorios + baños + aseos + cocina si es cerrada + salón-comedor (2 si
// van separados). No cuentan vestidores, lavanderías, almacenes ni pasillos.
// Probada en 4 distribuciones reales (un piso de 76 m² y Lope de Rueda 4 con tres
// propuestas): el error fue de +2 % a +15 %, siempre al alza, así que no lleva
// coeficiente de corrección (se probó un +7 % y José lo descartó: ya va del lado seguro).
//
// Trasdosados y guarnecidos son las dos caras de un mismo porcentaje: los paramentos
// que se quedan (fachadas, medianeras y estructurales) o se trasdosan o se guarnecen.

import { type Ficha, type Valores, type Cantidad, num, siNo, n2, SIN_DATO } from './tipos'

function altura(v: Valores): number {
  return num(v, 'altura_libre') ?? K.altura_defecto.valor
}

const K = {
  altura_defecto:     { valor: 2.6,  provisional: true,  nota: 'altura libre si no se ha medido' },
  pct_trasdosado:     { valor: 100,  provisional: true,  nota: '% trasdosado si no se responde' },
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

/** Paramentos que se quedan y hay que revestir: fachadas y medianeras (una cara, sin huecos) + estructurales (dos caras). */
function paramentosFijos(v: Valores): { m2: number; formula: string } | null {
  const ext = num(v, 'ml_muro_exterior')
  if (ext == null) return null
  const est = num(v, 'ml_muro_estructural') ?? 0
  const huecos = num(v, 'm2_huecos_exteriores') ?? 0
  const h = altura(v)
  return {
    m2: Math.max(0, ext * h - huecos) + 2 * est * h,
    formula: `(${n2(ext)} ml fachada × ${n2(h)} m − ${n2(huecos)} m² huecos) + 2 × ${n2(est)} ml estructural × ${n2(h)} m`,
  }
}

function pct(v: Valores): number {
  const p = num(v, 'pct_trasdosado') ?? K.pct_trasdosado.valor
  return Math.min(100, Math.max(0, p))
}

function trasdosados(v: Valores): Cantidad {
  const f = paramentosFijos(v)
  if (!f) return SIN_DATO('fachadas y medianeras (maqueta)')
  const p = pct(v)
  return { cantidad: f.m2 * p / 100, fuente: num(v, 'pct_trasdosado') != null ? 'tecnico' : 'express', formula: `[${f.formula}] × ${n2(p)} %` }
}

function guarnecidos(v: Valores): Cantidad {
  const f = paramentosFijos(v)
  if (!f) return SIN_DATO('fachadas y medianeras (maqueta)')
  const p = 100 - pct(v)
  return { cantidad: f.m2 * p / 100, fuente: num(v, 'pct_trasdosado') != null ? 'tecnico' : 'express', formula: `[${f.formula}] × ${n2(p)} % sin trasdosar` }
}

function porUtil(v: Valores): Cantidad {
  const u = num(v, 'sup_util')
  if (u == null) return SIN_DATO('superficie útil')
  return { cantidad: u, fuente: 'tecnico', formula: `${n2(u)} m² útiles` }
}

function porConstruida(v: Valores): Cantidad {
  const c = num(v, 'sup_construida')
  if (c == null) return SIN_DATO('superficie construida')
  return { cantidad: c, fuente: 'tecnico', formula: `${n2(c)} m² construidos` }
}

export const FICHA_ALBANILERIA: Ficha = {
  capitulo: 3,
  nombre: 'Albañilería',
  dependeDelNivel: true,
  descripcion: 'Tabiquería nueva, trasdosados, guarnecidos y enlucidos, falsos techos y foseados, soleras y recrecidos, y ayudas de albañilería.',
  coeficientes: K,
  partes: [
    {
      codigo: 'alb_tabiqueria', nombre: 'Tabiquería nueva', unidad: 'm²',
      criterio: 'Tabiques interiores de nueva ejecución (placa de yeso o fábrica), con su aislamiento, refuerzos y precercos. No incluye trasdosados de fachada ni frentes de armario; las correderas y plegables que separan espacios son carpintería.',
      subcapitulos: ['3_ALB_02'],
      variables: ['ml_tabique_demoler', 'n_estancias_actual', 'n_dormitorios_proy', 'n_banos_proy', 'n_aseos_proy', 'cocina_cerrada_proy', 'salon_comedor_separados_proy', 'altura_libre'],
      cantidad: tabiqueriaNueva,
    },
    {
      codigo: 'alb_trasdosados', nombre: 'Trasdosados', unidad: 'm²',
      criterio: 'Trasdosados autoportantes o directos (placa de yeso con o sin aislamiento) sobre fachadas, medianeras y muros estructurales.',
      subcapitulos: ['3_ALB_01'],
      variables: ['ml_muro_exterior', 'ml_muro_estructural', 'm2_huecos_exteriores', 'altura_libre', 'pct_trasdosado'],
      cantidad: trasdosados,
    },
    {
      codigo: 'alb_guarnecidos', nombre: 'Guarnecidos y enlucidos', unidad: 'm²',
      criterio: 'Guarnecido y enlucido de yeso sobre los paramentos que se quedan y no se trasdosan.',
      subcapitulos: [],
      variables: ['ml_muro_exterior', 'ml_muro_estructural', 'm2_huecos_exteriores', 'altura_libre', 'pct_trasdosado'],
      cantidad: guarnecidos,
    },
    {
      codigo: 'alb_falsos_techos', nombre: 'Falsos techos y foseados', unidad: 'm²',
      criterio: 'Falsos techos de placa de yeso, registrables, foseados, tabicas y cortineros. El nivel de calidad decide cuánto se hace: eso lo recoge el ratio por nivel.',
      subcapitulos: ['3_ALB_03', '3_ALB_04'],
      variables: ['sup_util'],
      cantidad: porUtil,
    },
    {
      codigo: 'alb_soleras', nombre: 'Soleras y recrecidos', unidad: 'm²',
      criterio: 'Recrecidos de mortero, soleras, autonivelantes y rellenos bajo pavimento.',
      subcapitulos: ['3_ALB_05'],
      variables: ['sup_util'],
      cantidad: porUtil,
    },
    {
      codigo: 'alb_ayudas', nombre: 'Ayudas de albañilería', unidad: 'm²',
      criterio: 'Ayudas a instalaciones (rozas, pasos, recibidos) y pequeñas obras de albañilería, repercutidas por superficie.',
      subcapitulos: ['3_ALB_06'],
      variables: ['sup_construida', 'sup_util'],
      cantidad: porConstruida,
    },
  ],
}

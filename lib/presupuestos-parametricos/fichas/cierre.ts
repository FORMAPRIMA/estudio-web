// Fichas 2, 10 y 11 — Refuerzos estructurales, Varios y Gastos generales.
//
// Validadas por José (21 oct 2026):
// - Refuerzos: solo huecos puntuales en muros estructurales (cargaderos), por unidad.
//   Las intervenciones grandes se presupuestan aparte.
// - Varios: repercutido por m² construido.
// - Gastos generales: la gestión de residuos de aquí es la documental (gestor
//   autorizado, certificado, fianza) y se mide con el volumen de escombro de
//   Demoliciones; contenedores y transporte siguen en Demoliciones. Tasas e ICIO van
//   como % del presupuesto en la estimación, no aquí.

import { type Ficha, type Valores, type Cantidad, num, n2, SIN_DATO } from './tipos'
import { FICHA_DEMOLICIONES } from './demoliciones'

function porConstruida(v: Valores): Cantidad {
  const c = num(v, 'sup_construida')
  if (c == null) return SIN_DATO('superficie construida')
  return { cantidad: c, fuente: 'tecnico', formula: `${n2(c)} m² construidos` }
}

function huecosEstructurales(v: Valores): Cantidad {
  const n = num(v, 'n_huecos_estructurales') ?? 0
  return { cantidad: n, fuente: 'express', formula: n ? `${n} huecos con cargadero` : 'sin huecos en muros estructurales' }
}

function residuosDocumental(v: Valores): Cantidad {
  const parte = FICHA_DEMOLICIONES.partes.find(p => p.codigo === 'dem_residuos')!
  const c = parte.cantidad(v)
  return c.fuente === 'sin_dato' ? c : { ...c, formula: `escombro de Demoliciones: ${c.formula}` }
}

const una = (que: string) => (): Cantidad => ({ cantidad: 1, fuente: 'tecnico', formula: `${que}: 1 por obra` })

export const FICHA_REFUERZOS: Ficha = {
  capitulo: 2,
  nombre: 'Refuerzos estructurales',
  dependeDelNivel: false,
  descripcion: 'Huecos puntuales en muros estructurales con su cargadero. Las intervenciones grandes se presupuestan aparte.',
  coeficientes: {},
  fueraDeFicha: ['Refuerzos de forjado, apeos generales y cambios de estructura (presupuesto aparte)'],
  partes: [
    { codigo: 're_huecos', nombre: 'Huecos en muros estructurales', unidad: 'ud', criterio: 'Apertura de hueco en muro de carga: apeo, cargadero metálico, demolición y remates.', subcapitulos: ['2_RE_01', '2_RE_02', '2_RE_03'], variables: ['n_huecos_estructurales'], cantidad: huecosEstructurales },
  ],
}

export const FICHA_VARIOS: Ficha = {
  capitulo: 10,
  nombre: 'Varios',
  dependeDelNivel: true,
  descripcion: 'Partidas varias repercutidas por superficie construida.',
  coeficientes: {},
  partes: [
    { codigo: 'var_varios', nombre: 'Varios', unidad: 'm²', criterio: 'Pequeñas partidas no recogidas en otros capítulos, repercutidas por m² construido.', subcapitulos: ['10_VAR_01'], variables: ['sup_construida'], cantidad: porConstruida },
  ],
}

export const FICHA_GASTOS_GENERALES: Ficha = {
  capitulo: 11,
  nombre: 'Gastos generales',
  dependeDelNivel: false,
  descripcion: 'Documentación y trámites, gestión documental de residuos, seguridad y salud, y limpieza final.',
  coeficientes: {},
  fueraDeFicha: ['Tasas e ICIO: % del presupuesto en la estimación'],
  partes: [
    { codigo: 'gg_documentacion', nombre: 'Documentación y trámites', unidad: 'ud', criterio: 'Licencia o declaración responsable, documentación de obra y legalizaciones.', subcapitulos: ['11_GG_01'], variables: [], cantidad: una('documentación y trámites') },
    { codigo: 'gg_residuos', nombre: 'Gestión de residuos', unidad: 'm³', criterio: 'Gestor autorizado, certificado de gestión y fianza. Contenedores y transporte van en Demoliciones.', subcapitulos: ['11_GG_02'], variables: ['sup_construida', 'sup_util'], cantidad: residuosDocumental },
    { codigo: 'gg_seguridad', nombre: 'Seguridad y salud', unidad: 'm²', criterio: 'Estudio o plan de seguridad, protecciones colectivas y señalización.', subcapitulos: ['11_GG_03'], variables: ['sup_construida'], cantidad: porConstruida },
    { codigo: 'gg_limpieza', nombre: 'Limpieza de obra', unidad: 'm²', criterio: 'Limpieza final de obra.', subcapitulos: ['11_GG_04'], variables: ['sup_construida'], cantidad: porConstruida },
  ],
}

// Ficha 1 — Demoliciones y trabajos previos.
//
// Acordado con José (20 oct 2026):
// - NO depende del nivel de calidad: demoler cuesta lo mismo haga lo que se haga
//   después. Todas las obras alimentan un único ratio por parte.
// - Cada constructor desglosa distinto (unos separan contenedores y transporte,
//   otros los meten en cada partida): por eso la ficha trabaja con partes fijas
//   y la calibración usa también el total del capítulo.
// - Amianto/fibrocemento: poco frecuente, fuera de ficha (partida manual).

import { type Ficha, type Valores, type Cantidad, num, siNo, texto, n2, SIN_DATO } from './tipos'

const K = {
  util_sobre_construida: { valor: 0.85, provisional: true, nota: 'm² útiles por m² construido si solo se conoce la construida' },
  tabique_por_m2_util:   { valor: 0.75, provisional: true, nota: 'm² de tabique (a una cara) por m² útil en una integral. MVP: 19 ml × 2,65 / 66,55 = 0,76' },
  altura_defecto:        { valor: 2.6,  provisional: true, nota: 'altura libre si no se ha medido' },
  alicatado_por_bano:    { valor: 22,   provisional: true, nota: 'm² de alicatado por baño completo' },
  alicatado_por_aseo:    { valor: 10,   provisional: true, nota: 'm² de alicatado por aseo' },
  alicatado_por_cocina:  { valor: 12,   provisional: true, nota: 'm² de alicatado por cocina' },
  ft_todos:              { valor: 0.9,  provisional: true, nota: 'fracción de la útil con falso techo si «en toda la vivienda»' },
  ft_algunos:            { valor: 0.35, provisional: true, nota: 'fracción de la útil con falso techo si «en algunas estancias»' },
  ventana_grande:        { valor: 1.5,  provisional: true, nota: 'una balconera equivale a 1,5 ventanas normales' },
  aseo_eq:               { valor: 0.5,  provisional: true, nota: 'un aseo equivale a medio baño' },
  cocina_eq:             { valor: 1.2,  provisional: true, nota: 'una cocina equivale a 1,2 baños' },
  // Volumen de escombro esponjado (m³) por unidad de cada parte.
  m3_tabique:            { valor: 0.10, provisional: true, nota: 'm³ por m² de tabique' },
  m3_suelo:              { valor: 0.06, provisional: true, nota: 'm³ por m² de pavimento o alicatado' },
  m3_falso_techo:        { valor: 0.03, provisional: true, nota: 'm³ por m² de falso techo' },
  m3_carp_exterior:      { valor: 0.3,  provisional: true, nota: 'm³ por ventana (marco, vidrio, persiana y cajón)' },
  m3_carp_interior:      { valor: 0.15, provisional: true, nota: 'm³ por puerta' },
  m3_armario:            { valor: 0.4,  provisional: true, nota: 'm³ por armario empotrado' },
  m3_zona_humeda:        { valor: 1.5,  provisional: true, nota: 'm³ por baño equivalente (sanitarios, muebles, instalaciones)' },
  m3_general:            { valor: 0.02, provisional: true, nota: 'm³ por m² construido (rodapiés, molduras, instalaciones generales)' },
  // Logística.
  recargo_planta:        { valor: 0.04, provisional: true, nota: 'recargo por planta en la gestión de residuos si NO hay ascensor utilizable' },
  recargo_acceso:        { valor: 0.15, provisional: true, nota: 'recargo si la carga y descarga desde la calle es difícil' },
}

const k = (c: keyof typeof K) => K[c].valor

// ── Cantidades base (compartidas con el cálculo de escombro) ─────────────────

function supUtil(v: Valores): { valor: number | null; formula: string } {
  const util = num(v, 'sup_util')
  if (util != null) return { valor: util, formula: `${n2(util)} m² útiles` }
  const cons = num(v, 'sup_construida')
  if (cons != null) return { valor: cons * k('util_sobre_construida'), formula: `${n2(cons)} m² const. × ${k('util_sobre_construida')}` }
  return { valor: null, formula: '' }
}

function supConstruida(v: Valores): { valor: number | null; formula: string } {
  const cons = num(v, 'sup_construida')
  if (cons != null) return { valor: cons, formula: `${n2(cons)} m² construidos` }
  const util = num(v, 'sup_util')
  if (util != null) return { valor: util / k('util_sobre_construida'), formula: `${n2(util)} m² útiles ÷ ${k('util_sobre_construida')}` }
  return { valor: null, formula: '' }
}

function tabiqueria(v: Valores): Cantidad {
  const ml = num(v, 'ml_tabique_demoler')
  if (ml != null) {
    const h = num(v, 'altura_libre') ?? k('altura_defecto')
    return { cantidad: ml * h, fuente: 'tecnico', formula: `${n2(ml)} ml × ${n2(h)} m` }
  }
  const u = supUtil(v)
  if (u.valor == null) return SIN_DATO('superficie')
  return { cantidad: u.valor * k('tabique_por_m2_util'), fuente: 'express', formula: `${u.formula} × ${k('tabique_por_m2_util')}` }
}

function suelosAlicatados(v: Valores): Cantidad {
  const suelo = num(v, 'm2_suelo_levantar')
  const alic = num(v, 'm2_alicatado_levantar')
  if (suelo != null || alic != null) {
    return { cantidad: (suelo ?? 0) + (alic ?? 0), fuente: 'tecnico', formula: `${n2(suelo ?? 0)} m² suelo + ${n2(alic ?? 0)} m² alicatado` }
  }
  const u = supUtil(v)
  if (u.valor == null) return SIN_DATO('superficie')
  const banos = num(v, 'n_banos') ?? 0
  const aseos = num(v, 'n_aseos') ?? 0
  const cocinas = num(v, 'n_cocinas') ?? 1
  const alicatado = banos * k('alicatado_por_bano') + aseos * k('alicatado_por_aseo') + cocinas * k('alicatado_por_cocina')
  return {
    cantidad: u.valor + alicatado,
    fuente: 'express',
    formula: `${u.formula} + alicatado (${banos} baños × ${k('alicatado_por_bano')} + ${aseos} aseos × ${k('alicatado_por_aseo')} + ${cocinas} cocina × ${k('alicatado_por_cocina')})`,
  }
}

function falsosTechos(v: Valores): Cantidad {
  const m2 = num(v, 'm2_falso_techo_demoler')
  if (m2 != null) return { cantidad: m2, fuente: 'tecnico', formula: `${n2(m2)} m²` }
  const op = texto(v, 'falsos_techos')
  if (op == null) return SIN_DATO('si tiene falsos techos')
  if (op === 'ninguno') return { cantidad: 0, fuente: 'express', formula: 'sin falsos techos' }
  const u = supUtil(v)
  if (u.valor == null) return SIN_DATO('superficie')
  const frac = op === 'todos' ? k('ft_todos') : k('ft_algunos')
  return { cantidad: u.valor * frac, fuente: 'express', formula: `${u.formula} × ${frac}` }
}

function carpinteriaExterior(v: Valores): Cantidad {
  const ventanas = num(v, 'n_ventanas')
  if (ventanas == null) return SIN_DATO('nº de ventanas')
  const grandes = num(v, 'n_ventanas_grandes')
  const normales = ventanas - (grandes ?? 0)
  return {
    cantidad: normales + (grandes ?? 0) * k('ventana_grande'),
    fuente: grandes != null ? 'tecnico' : 'express',
    formula: grandes ? `${normales} ventanas + ${grandes} balconeras × ${k('ventana_grande')}` : `${ventanas} ventanas`,
  }
}

function carpinteriaInterior(v: Valores): Cantidad {
  const puertas = num(v, 'n_puertas')
  if (puertas != null) return { cantidad: puertas, fuente: 'tecnico', formula: `${puertas} puertas (paso + entrada)` }
  const est = (num(v, 'n_estancias') ?? 0) + (num(v, 'n_banos') ?? 0) + (num(v, 'n_aseos') ?? 0) + (num(v, 'n_cocinas') ?? 1) + 1
  return { cantidad: est, fuente: 'express', formula: `~${est} puertas (una por estancia + entrada)` }
}

function armarios(v: Valores): Cantidad {
  const n = num(v, 'n_armarios_demoler')
  if (n == null) return SIN_DATO('nº de armarios empotrados')
  return { cantidad: n, fuente: 'tecnico', formula: `${n} armarios empotrados` }
}

function zonasHumedas(v: Valores): Cantidad {
  const banos = num(v, 'n_banos')
  const aseos = num(v, 'n_aseos') ?? 0
  const cocinas = num(v, 'n_cocinas') ?? 1
  if (banos == null) return SIN_DATO('nº de baños')
  return {
    cantidad: banos + aseos * k('aseo_eq') + cocinas * k('cocina_eq'),
    fuente: 'express',
    formula: `${banos} baños + ${aseos} aseos × ${k('aseo_eq')} + ${cocinas} cocina × ${k('cocina_eq')}`,
  }
}

function generales(v: Valores): Cantidad {
  const c = supConstruida(v)
  if (c.valor == null) return SIN_DATO('superficie')
  return { cantidad: c.valor, fuente: num(v, 'sup_construida') != null ? 'tecnico' : 'express', formula: c.formula }
}

function escombro(v: Valores): Cantidad {
  const piezas: [Cantidad, keyof typeof K, string][] = [
    [tabiqueria(v), 'm3_tabique', 'tabique'],
    [suelosAlicatados(v), 'm3_suelo', 'suelos'],
    [falsosTechos(v), 'm3_falso_techo', 'techos'],
    [carpinteriaExterior(v), 'm3_carp_exterior', 'ventanas'],
    [carpinteriaInterior(v), 'm3_carp_interior', 'puertas'],
    [armarios(v), 'm3_armario', 'armarios'],
    [zonasHumedas(v), 'm3_zona_humeda', 'baños y cocina'],
    [generales(v), 'm3_general', 'generales'],
  ]
  if (piezas.every(([c]) => c.fuente === 'sin_dato')) return SIN_DATO('superficie')
  const total = piezas.reduce((s, [c, coef]) => s + c.cantidad * k(coef), 0)
  const fuente = piezas.some(([c]) => c.fuente === 'express') ? 'express' : 'tecnico'
  return {
    cantidad: total,
    fuente,
    formula: piezas.map(([c, coef, nombre]) => `${nombre} ${n2(c.cantidad * k(coef))}`).join(' + ') + ' m³',
  }
}

function logistica(v: Valores): { factor: number; formula: string } {
  const ascensor = siNo(v, 'ascensor_obra')
  const planta = num(v, 'planta') ?? 0
  const acceso = siNo(v, 'acceso_facil')
  let factor = 1
  const partes: string[] = []
  if (ascensor === false && planta > 0) {
    factor *= 1 + k('recargo_planta') * planta
    partes.push(`sin ascensor, planta ${planta}: +${n2(k('recargo_planta') * planta * 100)} %`)
  }
  if (acceso === false) {
    factor *= 1 + k('recargo_acceso')
    partes.push(`acceso difícil: +${n2(k('recargo_acceso') * 100)} %`)
  }
  return { factor, formula: partes.length ? partes.join(' · ') : 'sin recargos' }
}

// ── Ficha ────────────────────────────────────────────────────────────────────

export const FICHA_DEMOLICIONES: Ficha = {
  capitulo: 1,
  nombre: 'Demoliciones y trabajos previos',
  dependeDelNivel: false,
  descripcion:
    'Desmontaje y demolición de lo existente, protecciones y gestión de residuos. El coste no depende del nivel de calidad de la reforma.',
  coeficientes: K,
  fueraDeFicha: ['Retirada de amianto o fibrocemento (partida manual)', 'Demoliciones estructurales (capítulo de refuerzos)'],
  partes: [
    {
      codigo: 'dem_tabiqueria', nombre: 'Tabiquería', unidad: 'm²',
      criterio: 'Demolición de tabiques y particiones interiores, incluido el alicatado que vaya pegado a ellos si no se mide aparte.',
      subcapitulos: ['1_DYT_01'],
      variables: ['ml_tabique_demoler', 'altura_libre', 'sup_util', 'sup_construida'],
      cantidad: tabiqueria,
    },
    {
      codigo: 'dem_suelos_alicatados', nombre: 'Pavimentos y alicatados', unidad: 'm²',
      criterio: 'Levantado de pavimentos, rodapiés de baldosa, recrecidos y picado de alicatados.',
      subcapitulos: ['1_DYT_01'],
      variables: ['m2_suelo_levantar', 'm2_alicatado_levantar', 'sup_util', 'n_banos', 'n_aseos', 'n_cocinas'],
      cantidad: suelosAlicatados,
    },
    {
      codigo: 'dem_falsos_techos', nombre: 'Falsos techos', unidad: 'm²',
      criterio: 'Demolición de falsos techos descolgados (escayola, pladur), foseados y tabicas. No el yeso directo a forjado.',
      subcapitulos: ['1_DYT_01'],
      variables: ['m2_falso_techo_demoler', 'falsos_techos', 'sup_util'],
      cantidad: falsosTechos,
    },
    {
      codigo: 'dem_carpinteria_exterior', nombre: 'Carpintería exterior', unidad: 'ud',
      criterio: 'Desmontaje de ventanas y balconeras con su vidrio, persiana, cajón y remates de fachada.',
      subcapitulos: ['1_DYT_02'],
      variables: ['n_ventanas', 'n_ventanas_grandes'],
      cantidad: carpinteriaExterior,
    },
    {
      codigo: 'dem_carpinteria_interior', nombre: 'Carpintería interior', unidad: 'ud',
      criterio: 'Desmontaje de puertas de paso (abatibles y correderas, con su premarco) y de la puerta de entrada.',
      subcapitulos: ['1_DYT_01'],
      variables: ['n_puertas', 'n_estancias', 'n_banos', 'n_aseos', 'n_cocinas'],
      cantidad: carpinteriaInterior,
    },
    {
      codigo: 'dem_armarios', nombre: 'Armarios empotrados', unidad: 'ud',
      criterio: 'Desmontaje de armarios empotrados completos (frentes, interiores y laterales). Por armario, no por módulo.',
      subcapitulos: ['1_DYT_01'],
      variables: ['n_armarios_demoler'],
      cantidad: armarios,
    },
    {
      codigo: 'dem_zonas_humedas', nombre: 'Baños y cocina', unidad: 'ud',
      criterio: 'Desmontaje de sanitarios, griferías, mamparas, muebles de cocina y electrodomésticos, y arranque de sus instalaciones.',
      subcapitulos: ['1_DYT_01'],
      variables: ['n_banos', 'n_aseos', 'n_cocinas'],
      cantidad: zonasHumedas,
    },
    {
      codigo: 'dem_generales', nombre: 'Instalaciones y trabajos generales', unidad: 'm²',
      criterio: 'Partidas repercutidas por m²: arranque de instalaciones generales (electricidad, calefacción, gas), rodapiés, molduras, varios y partidas alzadas de demolición general.',
      subcapitulos: ['1_DYT_01'],
      variables: ['sup_construida', 'sup_util'],
      cantidad: generales,
    },
    {
      codigo: 'dem_residuos', nombre: 'Protecciones, contenedores y transporte', unidad: 'm³',
      criterio: 'Protecciones de zonas comunes, bajada de escombros, contenedores, cargas y transporte a vertedero. Si el constructor lo reparte dentro de cada partida, no se separa: queda en esas partidas.',
      subcapitulos: ['1_DYT_03', '1_DYT_01'],
      variables: ['planta', 'ascensor_obra', 'acceso_facil'],
      cantidad: escombro,
      multiplicador: logistica,
    },
  ],
}

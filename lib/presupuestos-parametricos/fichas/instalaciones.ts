// Ficha 6 — Instalaciones (reforma integral: todo se renueva).
//
// Criterio acordado con José (21 oct 2026): cada parte se mide en la unidad que de
// verdad presupuesta el instalador (puntos eléctricos, puntos de agua, emisores,
// bocas, tomas), deducida del programa con tablas fijas basadas en la normativa
// (REBT ITC-BT-25, CTE HS, ICT). Las cantidades no dependen del nivel de calidad:
// el nivel entra en el precio (€ por unidad, por nivel, ajustado con obras reales).
// Los equipos (caldera, aerotermia) van aparte del reparto: cuestan casi lo mismo
// en 70 que en 120 m². Los sistemas alternativos (radiadores / suelo radiante,
// splits / conductos, extracción / VMC) son partes distintas: cada una tiene su
// unidad y su ratio; la que no se elige queda a cero.

import { type Ficha, type Valores, type Cantidad, num, siNo, texto, n2, SIN_DATO } from './tipos'

/** Tablas por tipo de estancia (valores de partida validados por José, 21 oct 2026). */
const T = {
  puntos: { base: 6, dormitorioPrincipal: 10, dormitorio: 8, salonComedor: 16, salonComedorSeparados: 18, cocina: 14, bano: 5, aseo: 3, lavadero: 3 },
  agua: { bano: 4, aseo: 2, cocina: 3, lavadero: 2 },
  emisores: { dormitorio: 1, salonComedor: 2, salonComedorSeparados: 3, cocina: 1, toalleroPorBano: 1, pasillo: 1 },
}
const K = {
  suelo_radiante_util: { valor: 0.92, provisional: true, nota: 'fracción de la superficie útil con suelo radiante (fuera armarios y cocina bajo muebles)' },
}

type Programa = { dorm: number; banos: number; aseos: number; separados: boolean; lavadero: boolean }

function programa(v: Valores): Programa | null {
  const dorm = num(v, 'n_dormitorios_proy')
  const banos = num(v, 'n_banos_proy')
  if (dorm == null || banos == null) return null
  return { dorm, banos, aseos: num(v, 'n_aseos_proy') ?? 0, separados: !!siNo(v, 'salon_comedor_separados_proy'), lavadero: !!siNo(v, 'lavadero_proy') }
}
const sinPrograma = () => SIN_DATO('programa reformado (dormitorios y baños)')

const cero = (motivo: string): Cantidad => ({ cantidad: 0, fuente: 'tecnico', formula: motivo })

// ── Electricidad e iluminación ──────────────────────────────────────────────

function puntosElectricos(v: Valores): Cantidad {
  const p = programa(v)
  if (!p) return sinPrograma()
  const t = T.puntos
  const dia = p.separados ? t.salonComedorSeparados : t.salonComedor
  const dorm = p.dorm > 0 ? t.dormitorioPrincipal + (p.dorm - 1) * t.dormitorio : 0
  const total = t.base + dorm + dia + t.cocina + p.banos * t.bano + p.aseos * t.aseo + (p.lavadero ? t.lavadero : 0)
  return {
    cantidad: total, fuente: 'express',
    formula: `${t.base} entrada/pasillos + ${p.dorm ? `${t.dormitorioPrincipal} principal + ${p.dorm - 1}×${t.dormitorio} dorm.` : '0 dorm.'} + ${dia} día + ${t.cocina} cocina + ${p.banos}×${t.bano} baños + ${p.aseos}×${t.aseo} aseos${p.lavadero ? ` + ${t.lavadero} lavadero` : ''}`,
  }
}

function cuadro(): Cantidad {
  return { cantidad: 1, fuente: 'tecnico', formula: 'cuadro, derivación individual y tierra: 1 por vivienda' }
}

function porUtil(v: Valores, factor = 1, nota = ''): Cantidad {
  const u = num(v, 'sup_util')
  if (u == null) return SIN_DATO('superficie útil')
  return { cantidad: u * factor, fuente: 'tecnico', formula: `${n2(u)} m² útiles${factor !== 1 ? ` × ${factor}` : ''}${nota}` }
}

// ── Agua ─────────────────────────────────────────────────────────────────────

function puntosAgua(v: Valores): Cantidad {
  const p = programa(v)
  if (!p) return sinPrograma()
  const t = T.agua
  return {
    cantidad: p.banos * t.bano + p.aseos * t.aseo + t.cocina + (p.lavadero ? t.lavadero : 0), fuente: 'express',
    formula: `${p.banos}×${t.bano} baños + ${p.aseos}×${t.aseo} aseos + ${t.cocina} cocina${p.lavadero ? ` + ${t.lavadero} lavadero` : ''}`,
  }
}

// ── Calefacción ──────────────────────────────────────────────────────────────

function emisores(v: Valores): Cantidad {
  const s = texto(v, 'sistema_calefaccion')
  if (s == null) return SIN_DATO('sistema de calefacción')
  if (s !== 'radiadores') return cero('no lleva radiadores')
  const p = programa(v)
  if (!p) return sinPrograma()
  const t = T.emisores
  const dia = p.separados ? t.salonComedorSeparados : t.salonComedor
  return {
    cantidad: p.dorm * t.dormitorio + dia + t.cocina + p.banos * t.toalleroPorBano + t.pasillo, fuente: 'express',
    formula: `${p.dorm} dorm. + ${dia} día + ${t.cocina} cocina + ${p.banos} toalleros + ${t.pasillo} pasillo`,
  }
}

function sueloRadiante(v: Valores): Cantidad {
  const s = texto(v, 'sistema_calefaccion')
  if (s == null) return SIN_DATO('sistema de calefacción')
  if (s !== 'suelo_radiante') return cero('no lleva suelo radiante')
  return porUtil(v, K.suelo_radiante_util.valor, ' (fuera armarios)')
}

// ── Producción ───────────────────────────────────────────────────────────────

function equipo(tipo: 'gas' | 'aerotermia') {
  return (v: Valores): Cantidad => {
    const pr = texto(v, 'produccion')
    if (pr == null) return SIN_DATO('producción de calor y ACS')
    return pr === tipo ? { cantidad: 1, fuente: 'tecnico', formula: tipo === 'gas' ? 'caldera de gas de condensación' : 'equipo de aerotermia con depósito de ACS' } : cero(`producción: ${pr}`)
  }
}

function gas(v: Valores): Cantidad {
  const pr = texto(v, 'produccion')
  if (pr == null) return SIN_DATO('producción de calor y ACS')
  return pr === 'gas' ? { cantidad: 1, fuente: 'tecnico', formula: 'instalación interior de gas' } : cero('sin gas')
}

// ── Climatización ────────────────────────────────────────────────────────────

function splits(v: Valores): Cantidad {
  const c = texto(v, 'climatizacion')
  if (c == null) return SIN_DATO('aire acondicionado')
  if (c !== 'splits') return cero('sin splits')
  const p = programa(v)
  if (!p) return sinPrograma()
  return { cantidad: p.dorm + 1, fuente: 'express', formula: `${p.dorm} dormitorios + 1 salón (unidades interiores)` }
}

function conductos(v: Valores): Cantidad {
  const c = texto(v, 'climatizacion')
  if (c == null) return SIN_DATO('aire acondicionado')
  return c === 'conductos' ? porUtil(v, 1, ' climatizados') : cero('sin conductos')
}

// ── Ventilación ──────────────────────────────────────────────────────────────

function bocasExtraccion(v: Valores): Cantidad {
  if (siNo(v, 'vmc')) return cero('con VMC: va por superficie')
  const p = programa(v)
  if (!p) return sinPrograma()
  const n = p.banos + p.aseos + 1 + (p.lavadero ? 1 : 0)
  return { cantidad: n, fuente: 'express', formula: `${p.banos} baños + ${p.aseos} aseos + 1 cocina${p.lavadero ? ' + 1 lavadero' : ''} (CTE HS3)` }
}

function vmc(v: Valores): Cantidad {
  return siNo(v, 'vmc') ? porUtil(v, 1, ' con VMC de doble flujo') : cero('sin VMC')
}

// ── Telecomunicaciones, domótica y sonido ────────────────────────────────────

function estanciasServidas(v: Valores): Cantidad {
  const p = programa(v)
  if (!p) return sinPrograma()
  const dia = p.separados ? 2 : 1
  return { cantidad: p.dorm + dia + 1, fuente: 'express', formula: `${p.dorm} dorm. + ${dia} día + 1 cocina (ICT: datos y TV por estancia seca)` }
}

function domotica(v: Valores): Cantidad {
  if (!siNo(v, 'domotica')) return cero('sin domótica')
  const p = programa(v)
  if (!p) return sinPrograma()
  const n = p.dorm + (p.separados ? 2 : 1) + 1 + p.banos + p.aseos
  return { cantidad: n, fuente: 'express', formula: `${n} estancias controladas` }
}

function sonido(v: Valores): Cantidad {
  const z = num(v, 'n_zonas_sonido') ?? 0
  return z > 0 ? { cantidad: z, fuente: 'express', formula: `${z} zonas de sonido` } : cero('sin sonido integrado')
}

const parte = (codigo: string, nombre: string, unidad: string, criterio: string, subcapitulos: string[], variables: string[], cantidad: (v: Valores) => Cantidad) =>
  ({ codigo, nombre, unidad, criterio, subcapitulos, variables, cantidad })

const PROG = ['n_dormitorios_proy', 'n_banos_proy', 'n_aseos_proy', 'salon_comedor_separados_proy', 'lavadero_proy']

export const FICHA_INSTALACIONES: Ficha = {
  capitulo: 6,
  nombre: 'Instalaciones',
  dependeDelNivel: true,
  descripcion: 'Electricidad, iluminación, fontanería y saneamiento, calefacción, producción de calor y ACS, gas, climatización, ventilación, telecomunicaciones, domótica y sonido.',
  coeficientes: K,
  partes: [
    parte('inst_electricidad', 'Electricidad · puntos', 'ud', 'Circuitos, cableado, cajas y mecanismos: puntos de luz, enchufes y mandos.', ['6_INST_05', '8_EQ_03'], PROG, puntosElectricos),
    parte('inst_cuadro', 'Cuadro y derivación individual', 'ud', 'Cuadro general, protecciones, derivación individual y toma de tierra.', ['6_INST_05'], [], cuadro),
    parte('inst_iluminacion', 'Iluminación', 'm²', 'Luminarias, empotrables, perfiles y tiras LED.', ['6_INST_06'], ['sup_util'], v => porUtil(v)),
    parte('inst_fontaneria', 'Fontanería y saneamiento', 'ud', 'Red de agua fría y caliente y desagües hasta cada punto de consumo, con su parte de distribución y conexión a bajante.', ['6_INST_01'], PROG, puntosAgua),
    parte('inst_radiadores', 'Calefacción · radiadores', 'ud', 'Radiadores y toalleros con su red de tubería, válvulas y detentores.', ['6_INST_03'], [...PROG, 'sistema_calefaccion'], emisores),
    parte('inst_suelo_radiante', 'Calefacción · suelo radiante', 'm²', 'Suelo radiante con aislamiento, tubo, colectores y termostatos.', ['6_INST_03'], ['sup_util', 'sistema_calefaccion'], sueloRadiante),
    parte('inst_caldera', 'Equipo · caldera de gas', 'ud', 'Caldera de condensación, salida de humos y conexiones.', ['6_INST_03'], ['produccion'], equipo('gas')),
    parte('inst_aerotermia', 'Equipo · aerotermia', 'ud', 'Unidad exterior, interior o hidrokit, depósito de ACS y conexiones.', ['6_INST_03'], ['produccion'], equipo('aerotermia')),
    parte('inst_gas', 'Gas', 'ud', 'Instalación interior de gas, contador y certificado.', [], ['produccion'], gas),
    parte('inst_splits', 'Climatización · splits', 'ud', 'Unidades interiores y exteriores con líneas frigoríficas y desagües.', ['6_INST_04'], [...PROG, 'climatizacion'], splits),
    parte('inst_conductos', 'Climatización · conductos', 'm²', 'Máquina de conductos, conductos, rejillas y control por zonas.', ['6_INST_04'], ['sup_util', 'climatizacion'], conductos),
    parte('inst_extraccion', 'Ventilación · extracción', 'ud', 'Extractores y conductos de cuartos húmedos según CTE HS3.', ['6_INST_02'], [...PROG, 'vmc'], bocasExtraccion),
    parte('inst_vmc', 'Ventilación · VMC', 'm²', 'Recuperador de doble flujo, conductos y bocas de impulsión y extracción.', ['6_INST_02'], ['sup_util', 'vmc'], vmc),
    parte('inst_telecom', 'Telecomunicaciones', 'ud', 'Tomas de datos y TV por estancia, registro y cableado según ICT.', ['6_INST_07'], PROG, estanciasServidas),
    parte('inst_domotica', 'Domótica', 'ud', 'Control de iluminación, clima y persianas por estancia.', ['6_INST_08'], [...PROG, 'domotica'], domotica),
    parte('inst_sonido', 'Sonido integrado', 'ud', 'Altavoces empotrados y amplificación por zona.', ['6_INST_09'], ['n_zonas_sonido'], sonido),
  ],
}

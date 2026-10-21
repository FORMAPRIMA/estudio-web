// Ficha 7 — Pinturas y revestimientos.
//
// Sin distribución futura: se encadena con lo ya calculado. Las paredes que se
// pintan son los paramentos fijos y el tabique nuevo de Albañilería (2 caras); el
// suelo total es la superficie útil y solo se estima su reparto entre zonas secas y
// húmedas. Las zonas húmedas ESCALAN con la vivienda (acordado con José, 21 oct 2026):
// la cocina y el baño principal crecen con la útil; baños secundarios, aseos y
// lavadero no. Porcentajes sacados de los planos medidos (cocina 6,5–11,8 % de la
// útil, media 9,7 %; baño principal 3,1–6,7 %, media 5,2 %). El arquitecto puede
// escribir la superficie real de la cocina o del baño principal.
// El microcemento se supone continuo (también en baños y cocina), con alicatado solo
// en zonas húmedas.

import { type Ficha, type Valores, type Cantidad, num, siNo, texto, n2, SIN_DATO } from './tipos'
import { tabiqueriaNueva, paramentosFijos, altura } from './albanileria'

const K = {
  cocina_pct_util:       { valor: 0.095, provisional: true, nota: 'cocina = 9,5 % de la útil (planos medidos: 6,5–11,8 %)' },
  cocina_min:            { valor: 6,     provisional: true, nota: 'cocina mínima, m²' },
  bano_ppal_pct_util:    { valor: 0.055, provisional: true, nota: 'baño principal = 5,5 % de la útil (planos medidos: 3,1–6,7 %)' },
  bano_ppal_min:         { valor: 4,     provisional: true, nota: 'baño principal mínimo, m²' },
  bano_m2:               { valor: 4,     provisional: true, nota: 'baño secundario, m² (planos medidos: media 4,1)' },
  aseo_m2:               { valor: 2.5,   provisional: true, nota: 'aseo, m²' },
  lavadero_m2:           { valor: 3,     provisional: true, nota: 'lavadero, m²' },
  perimetro_por_raiz:    { valor: 4.4,   provisional: true, nota: 'perímetro ≈ 4,4 × √superficie (recinto algo alargado)' },
  falso_techo_bano:      { valor: 0.25,  provisional: true, nota: 'el alicatado completo llega al falso techo: altura libre − 0,25 m' },
  alicatado_humedas:     { valor: 0.45,  provisional: true, nota: 'solo ducha y lavabo ≈ 45 % del alicatado completo' },
  puerta_m2:             { valor: 1.6,   provisional: true, nota: 'puerta de baño que se descuenta del alicatado completo' },
  rodapie_coef:          { valor: 0.85,  provisional: true, nota: 'descuenta cuartos húmedos (sin rodapié) y puertas' },
  mueble_frac:           { valor: 0.5,   provisional: false, nota: 'fracción del perímetro de la cocina con mueble (validado por José)' },
  frente_alto:           { valor: 0.6,   provisional: false, nota: 'altura del frente aplacado entre encimera y muebles altos (validado por José)' },
}
const k = (c: keyof typeof K) => K[c].valor

type Humedas = { cocina: number; banoPpal: number; banosResto: number; aseos: number; lavadero: number; total: number; nBanosResto: number; nAseos: number; formula: string }

export function zonasHumedas(v: Valores): Humedas | null {
  const u = num(v, 'sup_util')
  const banos = num(v, 'n_banos_proy')
  if (u == null || banos == null) return null
  const aseos = num(v, 'n_aseos_proy') ?? 0
  const cocina = num(v, 'm2_cocina_proy') ?? Math.max(k('cocina_min'), u * k('cocina_pct_util'))
  const banoPpal = banos > 0 ? (num(v, 'm2_bano_principal_proy') ?? Math.max(k('bano_ppal_min'), u * k('bano_ppal_pct_util'))) : 0
  const nResto = Math.max(0, banos - 1)
  const lav = siNo(v, 'lavadero_proy') ? k('lavadero_m2') : 0
  const total = cocina + banoPpal + nResto * k('bano_m2') + aseos * k('aseo_m2') + lav
  return {
    cocina, banoPpal, banosResto: nResto * k('bano_m2'), aseos: aseos * k('aseo_m2'), lavadero: lav, total, nBanosResto: nResto, nAseos: aseos,
    formula: `cocina ${n2(cocina)} + baño principal ${n2(banoPpal)} + ${nResto}×${k('bano_m2')} baños + ${aseos}×${k('aseo_m2')} aseos${lav ? ` + ${lav} lavadero` : ''}`,
  }
}

/** ml de mueble a lo largo de las paredes de una cocina de superficie a (sin isla). */
export function mlCocina(a: number): number {
  return k('perimetro_por_raiz') * Math.sqrt(a) * k('mueble_frac')
}

function esMicrocemento(v: Valores) { return texto(v, 'pavimento_secas') === 'microcemento' }

/** m² de alicatado de un recinto húmedo de superficie a. */
function alicatadoRecinto(a: number, H: number, completo: boolean): number {
  const perim = k('perimetro_por_raiz') * Math.sqrt(a)
  const total = perim * Math.max(0, H - k('falso_techo_bano')) - k('puerta_m2')
  return Math.max(0, completo ? total : total * k('alicatado_humedas'))
}

function alicatado(v: Valores): Cantidad {
  const z = zonasHumedas(v)
  if (!z) return SIN_DATO('superficie útil y programa')
  const modo = esMicrocemento(v) ? 'humedas' : texto(v, 'alicatado_banos')
  if (modo == null) return SIN_DATO('alicatado de baños')
  const H = altura(v)
  const completo = modo === 'techo'
  // El frente de la cocina no va aquí: es aplacado y se presupuesta con la encimera (ficha de Cocina).
  const banos = alicatadoRecinto(z.banoPpal, H, completo) + z.nBanosResto * alicatadoRecinto(k('bano_m2'), H, completo) + z.nAseos * alicatadoRecinto(k('aseo_m2'), H, completo)
  return {
    cantidad: banos, fuente: 'express',
    formula: `baños ${n2(banos)} m² (${completo ? 'hasta el techo' : 'solo zonas húmedas'}, perímetro 4,4·√sup)`,
  }
}

function pintura(v: Valores): Cantidad {
  const f = paramentosFijos(v)
  const t = tabiqueriaNueva(v)
  const u = num(v, 'sup_util')
  if (!f || t.fuente === 'sin_dato' || u == null) return SIN_DATO('paramentos, tabique nuevo y superficie útil')
  const al = alicatado(v)
  const z = zonasHumedas(v)
  const aplacado = z ? mlCocina(z.cocina) * k('frente_alto') : 0
  const alic = (al.fuente === 'sin_dato' ? 0 : al.cantidad) + aplacado
  const paredes = Math.max(0, f.m2 + 2 * t.cantidad - alic)
  return {
    cantidad: paredes + u, fuente: 'express',
    formula: `paredes (${n2(f.m2)} fijos + 2 × ${n2(t.cantidad)} tabique − ${n2(alic)} alicatado) + techos ${n2(u)} m²`,
  }
}

function pavimentoSecas(material: string) {
  return (v: Valores): Cantidad => {
    const m = texto(v, 'pavimento_secas')
    if (m == null) return SIN_DATO('pavimento de zonas secas')
    if (m !== material) return { cantidad: 0, fuente: 'tecnico', formula: `pavimento elegido: ${m}` }
    const u = num(v, 'sup_util')
    if (u == null) return SIN_DATO('superficie útil')
    if (m === 'microcemento') return { cantidad: u, fuente: 'tecnico', formula: `${n2(u)} m² útiles (continuo, también en baños y cocina)` }
    const z = zonasHumedas(v)
    if (!z) return SIN_DATO('programa reformado')
    return { cantidad: u - z.total, fuente: 'express', formula: `${n2(u)} m² útiles − ${n2(z.total)} m² húmedos` }
  }
}

function pavimentoHumedas(v: Valores): Cantidad {
  if (esMicrocemento(v)) return { cantidad: 0, fuente: 'tecnico', formula: 'microcemento continuo: va con las zonas secas' }
  const z = zonasHumedas(v)
  if (!z) return SIN_DATO('superficie útil y programa')
  return { cantidad: z.total, fuente: 'express', formula: z.formula }
}

function rodapieMl(v: Valores): Cantidad {
  const ext = num(v, 'ml_muro_exterior')
  const t = tabiqueriaNueva(v)
  if (ext == null || t.fuente === 'sin_dato') return SIN_DATO('fachadas y tabique nuevo')
  const est = num(v, 'ml_muro_estructural') ?? 0
  const tabMl = t.cantidad / altura(v)
  return {
    cantidad: (ext + 2 * est + 2 * tabMl) * k('rodapie_coef'), fuente: 'express',
    formula: `(${n2(ext)} fachada + 2 × ${n2(est)} estructural + 2 × ${n2(tabMl)} tabique) × ${k('rodapie_coef')}`,
  }
}

function molduras(v: Valores): Cantidad {
  if (!siNo(v, 'molduras')) return { cantidad: 0, fuente: 'tecnico', formula: 'sin molduras' }
  const r = rodapieMl(v)
  return r.fuente === 'sin_dato' ? r : { ...r, formula: `igual que el rodapié: ${r.formula}` }
}

const BASE = ['sup_util', 'n_banos_proy', 'n_aseos_proy', 'lavadero_proy', 'm2_cocina_proy', 'm2_bano_principal_proy']

export const FICHA_PINTURAS: Ficha = {
  capitulo: 7,
  nombre: 'Pinturas y revestimientos',
  dependeDelNivel: true,
  descripcion: 'Pintura de paredes y techos, pavimentos de zonas secas y húmedas, alicatados, rodapiés y molduras.',
  coeficientes: K,
  partes: [
    { codigo: 'pyr_pintura', nombre: 'Pintura', unidad: 'm²', criterio: 'Pintura plástica de paredes y techos, con su preparación.', subcapitulos: ['7_PYV_01'],
      variables: [...BASE, 'ml_muro_exterior', 'ml_muro_estructural', 'm2_huecos_exteriores', 'altura_libre', 'ml_tabique_demoler', 'n_estancias_actual', 'alicatado_banos'], cantidad: pintura },
    { codigo: 'pyr_tarima', nombre: 'Pavimento · tarima', unidad: 'm²', criterio: 'Tarima de madera en zonas secas, con base y colocación.', subcapitulos: ['7_PYV_03'], variables: [...BASE, 'pavimento_secas'], cantidad: pavimentoSecas('tarima') },
    { codigo: 'pyr_porcelanico', nombre: 'Pavimento · porcelánico', unidad: 'm²', criterio: 'Porcelánico en zonas secas.', subcapitulos: ['7_PYV_02'], variables: [...BASE, 'pavimento_secas'], cantidad: pavimentoSecas('porcelanico') },
    { codigo: 'pyr_microcemento', nombre: 'Pavimento · microcemento', unidad: 'm²', criterio: 'Microcemento continuo en toda la vivienda.', subcapitulos: ['7_PYV_02'], variables: [...BASE, 'pavimento_secas'], cantidad: pavimentoSecas('microcemento') },
    { codigo: 'pyr_piedra', nombre: 'Pavimento · piedra o terrazo', unidad: 'm²', criterio: 'Piedra natural o terrazo en zonas secas.', subcapitulos: ['7_PYV_06'], variables: [...BASE, 'pavimento_secas'], cantidad: pavimentoSecas('piedra') },
    { codigo: 'pyr_pav_humedas', nombre: 'Pavimento de baños y cocina', unidad: 'm²', criterio: 'Solado de baños, aseos, cocina y lavadero.', subcapitulos: ['7_PYV_02'], variables: [...BASE, 'pavimento_secas'], cantidad: pavimentoHumedas },
    { codigo: 'pyr_alicatado', nombre: 'Alicatados', unidad: 'm²', criterio: 'Alicatado de baños y aseos. El frente de cocina es aplacado y va en Cocina.', subcapitulos: ['7_PYV_02'], variables: [...BASE, 'alicatado_banos', 'altura_libre', 'pavimento_secas'], cantidad: alicatado },
    { codigo: 'pyr_rodapie', nombre: 'Rodapié', unidad: 'ml', criterio: 'Rodapié de madera, metálico o enrasado en zonas secas.', subcapitulos: ['7_PYV_04'], variables: ['ml_muro_exterior', 'ml_muro_estructural', 'ml_tabique_demoler', 'n_estancias_actual', 'altura_libre'], cantidad: rodapieMl },
    { codigo: 'pyr_molduras', nombre: 'Molduras y cornisas', unidad: 'ml', criterio: 'Molduras de techo y cornisas.', subcapitulos: ['7_PYV_05'], variables: ['molduras', 'ml_muro_exterior', 'ml_muro_estructural'], cantidad: molduras },
  ],
}

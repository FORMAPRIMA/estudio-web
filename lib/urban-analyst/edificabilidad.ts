// Motor determinista de edificabilidad.
//
// Tres métodos según la norma zonal:
//  · Coeficiente (NZ 5/6/7/8/9/10...): parcela × coeficiente verificado.
//  · Fórmula volumétrica (NZ 1 con bandas del plano CE): E = S × Z × C,
//    con S×Z sumado banda a banda (área de banda ∩ parcela × plantas COEF_Z)
//    y C fijo por grado (art. 8.1.3): la app calcula la cifra completa.
//  · Volumétrico (NZ 2/3/4/11, y NZ 1 si el plano CE no cubre la parcela):
//    la edificabilidad no se determina por coeficiente sino por la envolvente
//    — huella edificable × plantas permitidas — con la superficie construida
//    existente como suelo de la horquilla.
//
// Principio: el cálculo nunca "opina". Cada dato sale etiquetado como
// oficial / inferido / hipótesis; si faltan inputs, el resultado lista
// exactamente qué falta y cómo verificarlo. Nunca se inventa un coeficiente.

import type { ConstruidaDesglose, EdificabilidadResult, NormaZonal, UrbanAsset } from './types'

// Normas zonales cuya edificabilidad NO se determina por coeficiente genérico
const NZ_VOLUMETRICA = ['1', '2', '3', '4', '11']

export interface EdificabilidadExtra {
  huellaM2?: number | null            // huella del edificio (WFS BU)
  plantasExistentes?: number | null   // numberOfFloorsAboveGround (Catastro)
  plantasCondiciones?: number | null  // máx. plantas del COEF_Z (plano CE)
  fondoInfo?: string | null           // texto de fondo edificable si se detectó en capas
  /** Bandas COEF_Z ∩ parcela (S y Z por banda) para la fórmula E = S × Z × C. */
  bandasCE?: { coefZRaw: string; plantas: number | null; areaM2: number }[]
  /** Superficie construida que computa a edificabilidad (bruto − garaje/trastero). */
  construidaComputable?: number | null
  /** Desglose por uso que soporta el descuento (para etiquetas y avisos). */
  desgloseConstruida?: ConstruidaDesglose | null
}

/** Texto legible de lo descontado, p. ej. "garaje (3.100 m²) y trastero (420 m²)". */
function resumenDescuento(d: ConstruidaDesglose): string {
  const partes: string[] = []
  if (d.aparcamiento_m2 > 0) partes.push(`garaje (${fmt(d.aparcamiento_m2)} m²)`)
  if (d.trastero_m2 > 0) partes.push(`trastero (${fmt(d.trastero_m2)} m²)`)
  if (d.almacen_m2 > 0 && !d.almacen_computa) partes.push(`almacén anejo (${fmt(d.almacen_m2)} m²)`)
  return partes.join(' y ') || 'usos no computables'
}

export function computeEdificabilidad(
  asset: Pick<UrbanAsset, 'parcel_area' | 'built_area' | 'norma_zonal' | 'norma_zonal_denominacion'>,
  nzRow: NormaZonal | null,
  extra: EdificabilidadExtra = {}
): EdificabilidadResult {
  const etiquetas: EdificabilidadResult['etiquetas'] = []
  const advertencias: string[] = []
  const recomendaciones: string[] = []
  const inputsFaltantes: string[] = []

  const parcela = asset.parcel_area ?? null
  const construida = asset.built_area ?? null
  // Superficie que computa a edificabilidad: descuenta garaje/trastero del bruto
  // catastral. Si no hay desglose, computable = bruto (sin descuento).
  const desg = extra.desgloseConstruida ?? null
  const construidaComp = extra.construidaComputable ?? construida
  const nzBase = asset.norma_zonal ? asset.norma_zonal.split('.')[0] : null
  const huella = extra.huellaM2 ?? null
  const plantasExistentes = extra.plantasExistentes ?? null
  const plantasPermitidas = extra.plantasCondiciones ?? nzRow?.altura_max_plantas ?? null

  const base: EdificabilidadResult = {
    calculable: false,
    metodo: 'no_calculable',
    coef_utilizado: null,
    coef_verificado: false,
    superficie_parcela: parcela,
    edificabilidad_teorica: null,
    superficie_construida_existente: construida,
    superficie_construida_computable: construidaComp,
    construida_desglose: desg,
    edificabilidad_remanente: null,
    ratio_agotamiento: null,
    envolvente_min: null,
    envolvente_max: null,
    huella_m2: huella,
    plantas_existentes: plantasExistentes,
    plantas_permitidas: plantasPermitidas,
    inputs_faltantes: inputsFaltantes,
    etiquetas,
    advertencias,
    recomendaciones,
  }

  if (parcela != null) {
    etiquetas.push({ campo: 'Superficie de parcela', valor: `${fmt(parcela)} m²`, tipo: 'oficial' })
  }
  if (construida != null) {
    etiquetas.push({ campo: 'Superficie construida existente', valor: `${fmt(construida)} m²`, tipo: 'inferido' })
  }
  // Descuento de superficie no computable (garaje/trastero) del bruto catastral
  const descontado = construida != null && construidaComp != null ? Math.round(construida - construidaComp) : 0
  if (desg && construida != null && construidaComp != null && descontado > 0) {
    etiquetas.push({
      campo: 'Superficie construida computable',
      valor: `${fmt(construidaComp)} m²c (${fmt(construida)} m² − ${fmt(descontado)} m² de ${resumenDescuento(desg)})`,
      tipo: 'inferido',
    })
    advertencias.push(
      `De los ${fmt(construida)} m² construidos según Catastro se descuentan ~${fmt(descontado)} m² de ${resumenDescuento(desg)} por no computar a edificabilidad${desg.incompleto ? ` (descuento proporcional: muestreo de ${desg.inmuebles_muestreados}/${desg.inmuebles_totales ?? '?'} inmuebles)` : ''}. Estimación [INFERIDO] a partir de los usos declarados en Catastro; la regla exacta (art. 6.5.3 PGOUM: bajocubierta, porches, instalaciones) puede diferir.`
    )
    if (desg.almacen_m2 > 0 && desg.almacen_computa) {
      advertencias.push(
        `El activo declara ${fmt(desg.almacen_m2)} m² de uso "almacén" tratados como superficie productiva (uso dominante), por lo que SÍ computan: verificar si en realidad son trasteros anejos que deberían descontarse.`
      )
    }
  }

  // ═══ MÉTODO FÓRMULA VOLUMÉTRICA (NZ 1: E = S × Z × C) ══════════════════════
  // Solo si la NZ tiene C estructurado y el plano CE aporta bandas con Z
  // sobre la parcela. Las bandas con Z = 0 (patios/espacio libre) computan 0.
  const bandasCE = extra.bandasCE || []
  const bandasConZ = bandasCE.filter((b) => b.plantas != null)
  if (nzRow?.formula_c != null && bandasConZ.length > 0 && parcela != null) {
    const C = nzRow.formula_c
    const sz = bandasConZ.reduce((s, b) => s + b.areaM2 * (b.plantas || 0), 0)
    const teorica = Math.round(sz * C)
    const tipoCalculo = nzRow.verificado ? 'inferido' as const : 'hipotesis' as const

    base.formula_desglose = bandasCE.map((b) => ({
      coef_z: b.coefZRaw,
      area_m2: b.areaM2,
      plantas: b.plantas,
      m2c: b.plantas != null ? Math.round(b.areaM2 * b.plantas * C) : null,
    }))
    for (const b of bandasConZ) {
      etiquetas.push({
        campo: `Banda COEF_Z «${b.coefZRaw || 's/d'}»`,
        valor: `${fmt(b.areaM2)} m² × ${b.plantas} plantas × ${C} = ${fmt(Math.round(b.areaM2 * (b.plantas || 0) * C))} m²c`,
        tipo: 'inferido',
      })
    }
    etiquetas.push({
      campo: `C de la fórmula (NZ ${nzRow.codigo}, art. 8.1.3)`,
      valor: String(C),
      tipo: tipoCalculo,
    })
    etiquetas.push({
      campo: 'Edificabilidad E = S × Z × C',
      valor: `${fmt(teorica)} m²c`,
      tipo: tipoCalculo,
    })

    const bandasSinZ = bandasCE.length - bandasConZ.length
    if (bandasSinZ > 0) {
      advertencias.push(`${bandasSinZ} banda(s) del plano CE sin COEF_Z legible sobre la parcela: E puede estar infravalorada. Revisar el plano de Condiciones de la Edificación.`)
    }
    const areaBandas = bandasCE.reduce((s, b) => s + b.areaM2, 0)
    if (areaBandas < parcela * 0.85) {
      advertencias.push(`Las bandas del plano CE cubren ~${Math.round((areaBandas / parcela) * 100)}% de la parcela: el resto puede ser patio/espacio libre (computa 0) o zona sin dato.`)
    }
    advertencias.push(
      'E = S × Z × C con S y Z leídos del plano de Condiciones de la Edificación (Geoportal, sin valor jurídico) y S como banda ∩ parcela catastral: la "parcela edificable" del art. 6.2.9 puede diferir. En NZ 1 las alturas se fijan caso a caso por la CIPHAN y la ficha de catálogo manda sobre cualquier remanente.'
    )
    if (!nzRow.verificado) {
      advertencias.push('El coeficiente C no está marcado como verificado: el resultado es hipótesis de trabajo.')
      recomendaciones.push('Verificar C en el art. 8.1.3 de las NNUU y marcar la NZ como verificada en «Normas zonales».')
    }
    recomendaciones.push('Para el valor con efectos jurídicos: consulta urbanística especial (la CIPHAN puede modular alturas y la ficha de catálogo restringir la materialización).')

    let remanente: number | null = null
    if (construidaComp != null) {
      remanente = Math.round(teorica - construidaComp)
      etiquetas.push({ campo: 'Remanente vs computable', valor: `${fmt(remanente)} m²c`, tipo: 'hipotesis' })
      if (remanente < 0) {
        advertencias.push('La superficie construida computable supera la E de la fórmula: frecuente en casco histórico (volumetría consolidada anterior al PGOUM). El régimen aplicable es probablemente el de lo existente.')
      }
    }

    base.calculable = true
    base.metodo = 'formula_volumetrica'
    base.formula_c = C
    base.edificabilidad_teorica = teorica
    base.edificabilidad_remanente = remanente
    base.ratio_agotamiento = construidaComp != null && teorica > 0 ? Number((construidaComp / teorica).toFixed(3)) : null
    return base
  }

  // ═══ MÉTODO VOLUMÉTRICO (NZ 1/2/3/4/11) ═════════════════════════════════════
  if (nzBase && NZ_VOLUMETRICA.includes(nzBase)) {
    advertencias.push(
      `La Norma Zonal ${asset.norma_zonal} (${nzRow?.nombre ?? ''}) no determina la edificabilidad por coeficiente: se estima por envolvente (huella edificable × plantas permitidas), con lo edificado como referencia mínima.`
    )
    if (nzRow?.formula_c != null) {
      advertencias.push(
        `Esta NZ calcula E = S × Z × C (C = ${nzRow.formula_c}) pero el plano de Condiciones de la Edificación no devuelve bandas con Z sobre la parcela: se muestra la horquilla genérica. Revisar el plano CE en el Geoportal.`
      )
      inputsFaltantes.push('Z por banda (el plano de Condiciones de la Edificación no cubre la parcela o el servicio no respondió)')
    }

    if (huella != null) {
      etiquetas.push({ campo: 'Huella del edificio', valor: `${fmt(huella)} m²`, tipo: 'inferido' })
    } else {
      inputsFaltantes.push('Huella del edificio (no devuelta por el WFS de Catastro)')
    }
    if (plantasExistentes != null) {
      etiquetas.push({ campo: 'Plantas existentes (sobre rasante)', valor: String(plantasExistentes), tipo: 'oficial' })
    }
    if (extra.plantasCondiciones != null) {
      etiquetas.push({ campo: 'Plantas permitidas (COEF_Z, plano CE)', valor: String(extra.plantasCondiciones), tipo: 'inferido' })
    } else if (plantasPermitidas != null) {
      etiquetas.push({ campo: 'Plantas permitidas (tabla interna NZ)', valor: String(plantasPermitidas), tipo: 'hipotesis' })
    } else {
      inputsFaltantes.push('Plantas permitidas (COEF_Z del plano de Condiciones de Edificación no detectado en la parcela)')
    }
    if (construida == null) {
      inputsFaltantes.push('Superficie construida existente (Catastro)')
    }
    if (extra.fondoInfo) {
      etiquetas.push({ campo: 'Fondo edificable detectado en capas', valor: extra.fondoInfo, tipo: 'inferido' })
    }

    const envolventeMax = huella != null && plantasPermitidas != null
      ? Math.round(huella * plantasPermitidas)
      : null
    const envolventeMin = construidaComp

    if (envolventeMax == null && envolventeMin == null) {
      recomendaciones.push(
        'Sin superficie construida ni huella+plantas no puede estimarse la envolvente. Relanzar el análisis (Catastro puede responder de forma intermitente) o introducir los datos manualmente.'
      )
      recomendaciones.push(
        'Para el valor con efectos jurídicos: consulta urbanística especial sobre edificabilidad materializable.'
      )
      return base
    }

    // Plantas existentes: si Catastro no las publica (frecuente), se estiman
    // a partir de construida/huella — puede incluir plantas bajo rasante.
    let plantasExistEfectivas = plantasExistentes
    if (plantasExistEfectivas == null && construida != null && huella != null && huella > 0) {
      plantasExistEfectivas = Math.round(construida / huella)
      etiquetas.push({
        campo: 'Plantas existentes estimadas',
        valor: `≈ ${plantasExistEfectivas} (construida ÷ huella; puede incluir bajo rasante)`,
        tipo: 'hipotesis',
      })
    }

    if (envolventeMax != null) {
      etiquetas.push({
        campo: 'Envolvente máxima estimada',
        valor: `${fmt(envolventeMax)} m²c (${fmt(huella!)} m² × ${plantasPermitidas} plantas)`,
        tipo: 'hipotesis',
      })
    }
    if (envolventeMin != null && envolventeMax != null) {
      const remanenteEstimado = Math.round(envolventeMax - envolventeMin)
      if (remanenteEstimado >= 0) {
        etiquetas.push({
          campo: 'Horquilla de edificabilidad',
          valor: `${fmt(envolventeMin)} – ${fmt(envolventeMax)} m²c`,
          tipo: 'hipotesis',
        })
        etiquetas.push({
          campo: 'Remanente potencial estimado',
          valor: `${fmt(remanenteEstimado)} m²c`,
          tipo: 'hipotesis',
        })
        base.edificabilidad_remanente = remanenteEstimado
      } else {
        etiquetas.push({
          campo: 'Exceso sobre envolvente estimada',
          valor: `${fmt(Math.abs(remanenteEstimado))} m²c (construida ${fmt(envolventeMin)} > envolvente ${fmt(envolventeMax)})`,
          tipo: 'hipotesis',
        })
        advertencias.push(
          'La superficie construida supera la envolvente estimada: puede deberse a plantas bajo rasante o áticos que computan en Catastro pero no en la envolvente, a más altura real que la del COEF_Z detectado, o a volumetría consolidada superior a la actual. En estos casos el potencial de ampliación por remanente es probablemente NULO y lo relevante es el régimen de lo existente.'
        )
      }
      if (plantasExistEfectivas != null && plantasPermitidas != null) {
        etiquetas.push({
          campo: 'Plantas: existentes vs permitidas',
          valor: `${plantasExistEfectivas} / ${plantasPermitidas}${plantasExistEfectivas < plantasPermitidas ? ' → posible remonte teórico' : ' → altura agotada o superada'}`,
          tipo: plantasExistentes != null ? 'inferido' : 'hipotesis',
        })
      }
      base.ratio_agotamiento = envolventeMax > 0 ? Number((envolventeMin / envolventeMax).toFixed(3)) : null
    }

    advertencias.push(
      'La envolvente es una HORQUILLA orientativa: no computa exactamente bajocubierta, patios, fondos máximos por tramo ni retranqueos, y el COEF_Z puede variar dentro de la propia parcela (formato "0 / 6 / 7" = plantas por banda de fondo).'
    )
    if (nzBase === '1' || nzBase === '2') {
      advertencias.push(
        'En zonas de protección (NZ1/NZ2), el grado de catalogación puede impedir materializar cualquier remanente aunque exista teóricamente: la ficha del catálogo manda sobre la envolvente.'
      )
    }
    if (nzBase === '4') {
      advertencias.push(
        'En NZ4 (manzana cerrada) la envolvente real depende del fondo máximo edificable por planta según el ancho de calle: la horquilla asume la huella completa y puede ser optimista.'
      )
    }
    if (nzBase === '3' || nzBase === '11') {
      advertencias.push(
        'En NZ3/NZ11 la volumetría vinculante es la del planeamiento que la originó: revisar el expediente de origen.'
      )
    }
    recomendaciones.push(
      'Confirmar la horquilla con el plano de Condiciones de Edificación (fondos y alturas por tramo) y, para efectos jurídicos, con consulta urbanística especial.'
    )
    recomendaciones.push(
      'Cualquier remonte exige además verificación jurídico-registral (título, división horizontal, vuelo, estatutos) y de protección (ficha de catálogo).'
    )

    base.calculable = envolventeMax != null || envolventeMin != null
    base.metodo = base.calculable ? 'volumetrico' : 'no_calculable'
    base.envolvente_min = envolventeMin
    base.envolvente_max = envolventeMax
    return base
  }

  // ═══ MÉTODO POR COEFICIENTE (resto de normas) ═══════════════════════════════
  if (construida != null) {
    advertencias.push(
      'La superficie construida de Catastro incluye elementos que pueden no computar edificabilidad (bajo rasante, comunes) y puede diferir de la realidad física.'
    )
  }

  const coef = nzRow?.coef_edificabilidad ?? null
  const coefVerificado = Boolean(nzRow?.verificado && coef != null)

  if (coef == null || parcela == null) {
    if (coef == null) {
      advertencias.push(
        asset.norma_zonal
          ? `No hay coeficiente de edificabilidad verificado para la Norma Zonal ${asset.norma_zonal} en la tabla interna.`
          : 'No se ha identificado la norma zonal aplicable.'
      )
      inputsFaltantes.push(`Coeficiente de edificabilidad de la NZ ${asset.norma_zonal ?? '?'} (editar en «Normas zonales»)`)
      recomendaciones.push(
        'Verificar el coeficiente en el Compendio de NNUU del PGOUM y registrarlo (marcado como verificado) en la tabla de normas zonales de la app.'
      )
    }
    if (parcela == null) inputsFaltantes.push('Superficie de parcela (Catastro)')
    return base
  }

  const teorica = Math.round(parcela * coef)
  etiquetas.push({
    campo: 'Edificabilidad teórica',
    valor: `${fmt(teorica)} m²c (${fmt(parcela)} m² × ${coef})`,
    tipo: coefVerificado ? 'inferido' : 'hipotesis',
  })

  let remanente: number | null = null
  let ratio: number | null = null
  if (construidaComp != null) {
    remanente = Math.round(teorica - construidaComp)
    ratio = teorica > 0 ? Number((construidaComp / teorica).toFixed(3)) : null
    etiquetas.push({ campo: 'Edificabilidad remanente', valor: `${fmt(remanente)} m²c`, tipo: 'hipotesis' })
    if (ratio != null) {
      etiquetas.push({ campo: 'Ratio de agotamiento', valor: `${Math.round(ratio * 100)} %`, tipo: 'hipotesis' })
    }
    if (remanente < 0) {
      advertencias.push(
        'La superficie construida supera la edificabilidad teórica: posible exceso histórico (fuera de ordenación relativa) o coeficiente/superficie no representativos.'
      )
    } else if (remanente > 0) {
      advertencias.push(
        'Que exista edificabilidad remanente NO implica que sea materializable: alturas, fondos, patios y protección pueden impedir consumirla.'
      )
    }
  }

  if (!coefVerificado) {
    advertencias.push('El coeficiente utilizado no está marcado como verificado: el resultado es una hipótesis de trabajo.')
    recomendaciones.push('Verificar el coeficiente en las NNUU y marcarlo como verificado en la tabla de normas zonales.')
  }
  recomendaciones.push(
    'Para materializar cualquier remanente: consulta urbanística especial y comprobación registral (título, división horizontal, vuelo).'
  )

  base.calculable = true
  base.metodo = 'coeficiente'
  base.coef_utilizado = coef
  base.coef_verificado = coefVerificado
  base.edificabilidad_teorica = teorica
  base.edificabilidad_remanente = remanente
  base.ratio_agotamiento = ratio
  return base
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)
}

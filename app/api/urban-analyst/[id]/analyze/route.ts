import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import {
  geocodeDireccion, refcatFromCoords, coordsFromRefcat,
  getParcelData, getBuildingData, getBuildingParts, getInmueblesCount, getConstruidaDesglose, combineDesgloses, getParcelasVecinas, translateCurrentUse,
} from '@/lib/urban-analyst/catastro'
import { computeAreaMovimiento, type LinderoInfo, type LinderoOverride, type TipoPersonalizado } from '@/lib/urban-analyst/areaMovimiento'
import { queryAllServices, queryCondicionesBandas, extractNormaZonal, queryAlturaEdificioEnParcela } from '@/lib/urban-analyst/geoportal'
import { computeEdificabilidad } from '@/lib/urban-analyst/edificabilidad'
import { computeCuadroUrbanistico, nzCandidatos } from '@/lib/urban-analyst/cuadroUrbanistico'
import { combineGeometries, bbox } from '@/lib/urban-analyst/geometry'
import { computeVolumenCapaz, volumenCapazResumen, bandasSobreParcela } from '@/lib/urban-analyst/volumenCapaz'
import { computeRedFlags } from '@/lib/urban-analyst/redFlags'
import { computeChecklist } from '@/lib/urban-analyst/checklist'
import { buildContextoActivo, parseJsonRespuesta, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import type { PipelineStep, UrbanAsset, NormaZonal, EdificabilidadResult } from '@/lib/urban-analyst/types'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STEPS: { key: string; label: string }[] = [
  { key: 'localizar',      label: 'Localización del activo' },
  { key: 'catastro',       label: 'Datos catastrales y geometría' },
  { key: 'planeamiento',   label: 'Cruce con capas del PGOUM' },
  { key: 'edificabilidad', label: 'Cálculo de edificabilidad' },
  { key: 'cuadro',         label: 'Cuadro urbanístico (normativa · actual · potencial)' },
  { key: 'volumen',        label: 'Volumen capaz 3D (bandas × plantas)' },
  { key: 'red_flags',      label: 'Detección de red flags' },
  { key: 'interprete',     label: 'Síntesis del analista (IA)' },
]

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth: solo fp_partner
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner','fp_manager'].indexOf(profile.rol) === -1) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: assetRow, error: assetErr } = await admin
    .from('urban_assets').select('*').eq('id', params.id).single()
  if (assetErr || !assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
  const asset = assetRow as UrbanAsset

  // Pipeline visible en la UI: se actualiza en BD paso a paso (la UI hace polling)
  let pipeline: PipelineStep[] = STEPS.map((s) => ({ ...s, status: 'pendiente' as const }))
  const setStep = async (key: string, status: PipelineStep['status'], detail?: string) => {
    pipeline = pipeline.map((p) => (p.key === key ? { ...p, status, detail } : p))
    await admin.from('urban_assets').update({ pipeline }).eq('id', params.id)
  }

  await admin.from('urban_assets').update({
    status: 'analizando', pipeline, error_msg: null,
  }).eq('id', params.id)

  try {
    // ── 1. Localización ───────────────────────────────────────────────────────
    await setStep('localizar', 'en_curso')
    let refcat = asset.refcat
    let lat = asset.lat
    let lng = asset.lng
    let direccion = asset.direccion
    let esMadridCapital = true
    let municipio: string | null = null

    if (!refcat && direccion) {
      // Geocodificar la entrada TAL CUAL (puede incluir su municipio);
      // solo si no hay resultado se reintenta asumiendo Madrid.
      let geo = await geocodeDireccion(direccion)
      if (!geo || geo.lat == null) geo = await geocodeDireccion(`${direccion}, Madrid`)
      if (!geo) throw new Error(`No se pudo geocodificar la dirección "${direccion}". Prueba con la referencia catastral.`)
      lat = geo.lat; lng = geo.lng
      municipio = geo.municipio
      esMadridCapital = geo.muniCode === '28079'
      refcat = geo.refcat
      direccion = geo.direccion || direccion
      if (!refcat) {
        const rc = await refcatFromCoords(lat, lng)
        refcat = rc?.refcat ?? null
      }
      if (!refcat) throw new Error('No se encontró referencia catastral para esa dirección.')
    } else if (refcat) {
      const coords = await coordsFromRefcat(refcat)
      if (!coords) throw new Error(`La referencia catastral ${refcat} no devuelve localización en Catastro.`)
      lat = coords.lat; lng = coords.lng
      if (!direccion) direccion = coords.direccion
      esMadridCapital = /MADRID\s*\(MADRID\)/i.test(coords.direccion)
    } else {
      throw new Error('El activo no tiene dirección ni referencia catastral.')
    }

    await admin.from('urban_assets').update({ refcat, lat, lng, direccion }).eq('id', params.id)
    await setStep('localizar', esMadridCapital ? 'ok' : 'aviso',
      `${refcat} · ${direccion || ''}${esMadridCapital ? '' : ` · ⚠ ${municipio || 'municipio'} está fuera de Madrid capital: el análisis PGOUM no aplica`}`)

    // ── 2. Catastro (todas las referencias del activo: multi-parcela) ────────
    await setStep('catastro', 'en_curso')
    const refcatsExtra = ((asset.refcats || []) as string[])
      .map((r) => r.trim().toUpperCase().slice(0, 14))
      .filter((r) => r.length === 14 && r !== refcat)
    const allRefcats = [refcat!, ...Array.from(new Set(refcatsExtra))]

    const parcels = await Promise.all(allRefcats.map((rc) => getParcelData(rc)))
    if (!parcels[0]) throw new Error(`Catastro no devuelve geometría para la parcela ${refcat}.`)
    const parcelasFallidas = allRefcats.filter((_, i) => !parcels[i])
    const parcelasOk = parcels.filter((p): p is NonNullable<typeof p> => Boolean(p))

    const parcelGeom = combineGeometries(parcelasOk.map((p) => p.geometry))!
    const areasOk = parcelasOk.map((p) => p.areaValue).filter((a): a is number => a != null)
    const parcelArea = areasOk.length > 0 ? areasOk.reduce((s, a) => s + a, 0) : null

    const [buildings, inmueblesCounts] = await Promise.all([
      Promise.all(allRefcats.map((rc) => getBuildingData(rc))),
      Promise.all(allRefcats.map((rc) => getInmueblesCount(rc))),
    ])
    const buildingsOk = buildings.filter((b): b is NonNullable<typeof b> => Boolean(b))
    const building = buildingsOk[0] ?? null // principal (uso de referencia)

    const sum = (vals: (number | null)[]) => {
      const nn = vals.filter((v): v is number => v != null)
      return nn.length > 0 ? nn.reduce((s, v) => s + v, 0) : null
    }
    let builtArea = sum(buildingsOk.map((b) => b.builtAreaM2))
    let yearBuilt = buildingsOk.reduce<number | null>((min, b) => {
      if (b.yearBuilt == null) return min
      return min == null || b.yearBuilt < min ? b.yearBuilt : min
    }, null)
    const numViviendas = sum(buildingsOk.map((b) => b.numberOfDwellings))
    const numInmuebles = sum(inmueblesCounts)
    const footprintTotal = sum(buildingsOk.map((b) => b.footprintM2))
    const floorsMax = buildingsOk.reduce<number | null>((max, b) => {
      if (b.floorsAboveGround == null) return max
      return max == null || b.floorsAboveGround > max ? b.floorsAboveGround : max
    }, null)

    // Desglose de superficie construida por uso (DNPRC inmueble a inmueble):
    // separa lo que computa a edificabilidad de garaje y trastero/almacén anejo.
    // De paso, sirve de fallback de superficie/año si el WFS BU no los devolvió.
    const scans = await Promise.all(allRefcats.map((rc) => getConstruidaDesglose(rc)))
    const construidaScan = combineDesgloses(scans)
    const desglose = construidaScan?.desglose ?? null

    let usedFallback = false
    if (builtArea == null && desglose?.total_m2 != null) { builtArea = desglose.total_m2; usedFallback = true }
    if (yearBuilt == null && construidaScan?.anioMasAntiguo != null) yearBuilt = construidaScan.anioMasAntiguo

    // Superficie computable = bruto × fracción computable del desglose (robusto
    // frente a diferencias de escala entre el WFS y la suma por inmueble).
    let builtAreaComputable: number | null = builtArea
    if (desglose && desglose.total_m2 && desglose.total_m2 > 0 && desglose.computable_m2 != null) {
      const frac = desglose.computable_m2 / desglose.total_m2
      builtAreaComputable = builtArea != null ? Math.round(builtArea * frac) : desglose.computable_m2
    }

    const catastroPatch = {
      parcel_geometry: parcelGeom,
      parcel_area: parcelArea,
      built_area: builtArea,
      cadastral_use: translateCurrentUse(building?.currentUse ?? null),
      year_built: yearBuilt,
      num_inmuebles: numInmuebles,
      num_viviendas: numViviendas,
    }
    await admin.from('urban_assets').update(catastroPatch).eq('id', params.id)
    // Superficie computable + desglose (best-effort: si la migración con las
    // columnas nuevas no está aplicada, no debe tumbar el análisis; el desglose
    // viaja igualmente dentro del cálculo de edificabilidad, que es jsonb).
    const { error: computableErr } = await admin.from('urban_assets')
      .update({ built_area_computable: builtAreaComputable, built_area_desglose: desglose })
      .eq('id', params.id)
    if (computableErr) console.warn('[urban-analyst] columnas built_area_computable/desglose no disponibles:', computableErr.message)
    const descuentoM2 = catastroPatch.built_area != null && builtAreaComputable != null
      ? catastroPatch.built_area - builtAreaComputable : 0
    await setStep('catastro', parcelasFallidas.length > 0 ? 'aviso' : 'ok',
      `${allRefcats.length > 1 ? `${parcelasOk.length}/${allRefcats.length} parcelas · ` : ''}${parcelArea ?? '?'} m² suelo · ${catastroPatch.built_area ?? '?'} m² construidos${usedFallback ? ' (suma por inmueble)' : ''}${descuentoM2 > 0 ? ` · ${builtAreaComputable} m²c computables (−${Math.round(descuentoM2)} garaje/trastero)` : ''} · ${catastroPatch.cadastral_use ?? 'uso s/d'}${catastroPatch.year_built ? ` · ${catastroPatch.year_built}` : ''}${parcelasFallidas.length ? ` · ⚠ sin geometría: ${parcelasFallidas.join(', ')}` : ''}`)

    // ── 3. Capas de planeamiento (solo Madrid capital: son capas del PGOUM) ──
    await setStep('planeamiento', 'en_curso')
    const { hits, serviciosError } = esMadridCapital
      ? await queryAllServices(parcelGeom)
      : { hits: [], serviciosError: [] as string[] }

    await admin.from('urban_layer_hits').delete().eq('asset_id', params.id)
    if (hits.length > 0) {
      await admin.from('urban_layer_hits').insert(
        hits.map((h) => ({ ...h, asset_id: params.id, legal_value: false }))
      )
    }
    const nz = extractNormaZonal(hits)
    await admin.from('urban_assets').update({
      norma_zonal: nz?.etiqueta ?? null,
      norma_zonal_denominacion: nz?.denominacion ?? null,
    }).eq('id', params.id)
    await setStep('planeamiento', !esMadridCapital || serviciosError.length > 0 ? 'aviso' : 'ok',
      esMadridCapital
        ? `${hits.length} afecciones en ${new Set(hits.map((h) => h.service)).size} capas${nz ? ` · NZ ${nz.etiqueta}` : ''}${serviciosError.length ? ` · ${serviciosError.length} servicios sin respuesta` : ''}`
        : `Omitido: ${municipio || 'el municipio'} se rige por su propio planeamiento, no por el PGOUM de Madrid`)

    // ── 4. Edificabilidad (determinista) ─────────────────────────────────────
    await setStep('edificabilidad', 'en_curso')
    // Búsqueda de más específico a más genérico: '8.1.a' → '8.1' → '8'
    let nzRow: NormaZonal | null = null
    if (nz?.etiqueta) {
      const candidatos = nzCandidatos(nz.etiqueta)
      const { data: filas } = await admin.from('urban_normas_zonales').select('*').in('codigo', candidatos)
      for (const c of candidatos) {
        const hit = (filas || []).find((f) => f.codigo === c)
        if (hit) { nzRow = hit as NormaZonal; break }
      }
    }
    // Parámetros volumétricos extraídos de las capas del PGOUM:
    // COEF_Z del plano de Condiciones de Edificación = nº de plantas por banda
    // de fondo (formato "0 / 6 / 7") → usamos el máximo del tramo.
    let plantasCondiciones: number | null = null
    let fondoInfo: string | null = null
    for (const h of hits) {
      if (h.service.endsWith('PG_CONDICIONES_EDIFICACION') || h.service.endsWith('PG_ANALISIS_EDIFICACION')) {
        for (const [k, v] of Object.entries(h.attributes)) {
          if (/COEF_Z|PLANTA/i.test(k) && (typeof v === 'string' || typeof v === 'number')) {
            const nums = String(v).match(/\d+/g)?.map(Number).filter((n) => n > 0 && n < 30) || []
            const max = nums.length ? Math.max(...nums) : null
            if (max != null && (plantasCondiciones == null || max > plantasCondiciones)) plantasCondiciones = max
          }
          if (/FONDO/i.test(k) && (typeof v === 'string' || typeof v === 'number') && String(v).trim()) {
            fondoInfo = fondoInfo ? `${fondoInfo} · ${k}: ${v}` : `${k}: ${v}`
          }
        }
        if (/FONDO/i.test(h.layer_name || '')) {
          fondoInfo = fondoInfo ? `${fondoInfo} · capa "${h.layer_name}"` : `afectada por capa "${h.layer_name}"`
        }
      }
    }

    // Bandas del plano de Condiciones de Edificación (COEF_Z = Z por banda):
    // alimentan la fórmula E = S × Z × C de NZ 1 y, después, el volumen capaz 3D
    const bandas = esMadridCapital
      ? await queryCondicionesBandas(parcelGeom).catch(() => [] as Awaited<ReturnType<typeof queryCondicionesBandas>>)
      : []

    const edificabilidad: EdificabilidadResult = computeEdificabilidad(
      {
        parcel_area: parcelArea,
        built_area: catastroPatch.built_area,
        norma_zonal: nz?.etiqueta ?? null,
        norma_zonal_denominacion: nz?.denominacion ?? null,
      },
      nzRow,
      {
        huellaM2: footprintTotal,
        plantasExistentes: floorsMax,
        plantasCondiciones,
        fondoInfo,
        bandasCE: bandasSobreParcela(parcelGeom, bandas),
        construidaComputable: builtAreaComputable,
        desgloseConstruida: desglose,
      }
    )
    if (!esMadridCapital) {
      edificabilidad.advertencias.unshift(
        `El activo está en ${municipio || 'un municipio'} (fuera de Madrid capital): la edificabilidad no puede derivarse del PGOUM. Consultar el planeamiento municipal correspondiente (Visor SIT de la Comunidad de Madrid).`
      )
      edificabilidad.recomendaciones.unshift(
        'Analizar con las normas urbanísticas del municipio; los datos catastrales (parcela, construido, edificio 3D) sí son válidos.'
      )
    }
    await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'edificabilidad')
    await admin.from('urban_analysis').insert({
      asset_id: params.id, kind: 'edificabilidad', content: edificabilidad, model: null,
    })
    await setStep('edificabilidad', edificabilidad.calculable ? 'ok' : 'aviso',
      edificabilidad.metodo === 'formula_volumetrica'
        ? `Fórmula E = S × Z × C (C = ${edificabilidad.formula_c}) · teórica ${edificabilidad.edificabilidad_teorica} m²c · remanente ${edificabilidad.edificabilidad_remanente ?? 's/d'} m²c`
        : edificabilidad.metodo === 'volumetrico'
          ? `Método volumétrico · horquilla ${edificabilidad.envolvente_min ?? '?'} – ${edificabilidad.envolvente_max ?? '?'} m²c`
          : edificabilidad.calculable
            ? `Coeficiente · teórica ${edificabilidad.edificabilidad_teorica} m²c · remanente ${edificabilidad.edificabilidad_remanente ?? 's/d'} m²c`
            : `No calculable — falta: ${edificabilidad.inputs_faltantes.join('; ') || 'parámetros verificados'}`)

    // ── 4b. Cuadro urbanístico formato licencia (determinista) ───────────────
    await setStep('cuadro', 'en_curso')
    let cuadroResumen: Record<string, unknown> | null = null
    try {
      // Altura real del edificio (cartografía municipal) para "estado actual"
      let alturaExistenteM: number | null = null
      if (esMadridCapital) {
        const bb = bbox(parcelGeom)
        if (bb) {
          alturaExistenteM = await queryAlturaEdificioEnParcela(parcelGeom, bb).catch(() => null)
        }
      }
      const cuadro = computeCuadroUrbanistico({
        parcelArea,
        builtArea: catastroPatch.built_area,
        huellaM2: footprintTotal,
        plantasExistentes: floorsMax,
        alturaExistenteM,
        usoCatastral: catastroPatch.cadastral_use,
        normaZonal: nz?.etiqueta ?? null,
        normaZonalDenominacion: nz?.denominacion ?? null,
        nzRow,
        plantasCondiciones,
        hits,
      })

      // Área de movimiento (parcela − retranqueos por lindero) cuando la NZ
      // los regula: clasifica linderos con el parcelario vecino de Catastro
      let areaMovimiento: ReturnType<typeof computeAreaMovimiento> | null = null
      const tieneRetranqueos = nzRow && (
        nzRow.retranqueo_frente_m != null || nzRow.retranqueo_lateral_m != null || nzRow.retranqueo_testero_m != null
      )
      if (tieneRetranqueos) {
        try {
          const bb = bbox(parcelGeom)
          if (bb) {
            // Reclasificaciones manuales de linderos del análisis anterior:
            // se conservan entre re-análisis (las keys son estables si la
            // geometría de la parcela no cambia)
            const { data: prevCuadro } = await admin
              .from('urban_analysis').select('content')
              .eq('asset_id', params.id).eq('kind', 'cuadro_urbanistico').maybeSingle()
            const prevAm = (prevCuadro?.content as { area_movimiento?: { linderos?: LinderoInfo[]; tipos_personalizados?: TipoPersonalizado[] } } | null)?.area_movimiento
            const prevLinderos = prevAm?.linderos || []
            const overrides: Record<string, LinderoOverride> = {}
            for (const l of prevLinderos) {
              if (!l.override) continue
              overrides[l.key] = {
                tipo: l.tipo,
                nombre: l.nombre ?? null,
                retranqueo_m: l.retranqueo_override ? (l.retranqueo_m ?? null) : null,
                regla_altura: l.regla_altura ?? null,
              }
            }
            const tiposPersonalizados = prevAm?.tipos_personalizados || []

            // bbox ampliado ~25 m para capturar las vecinas completas
            const margen = 25 / 111320
            const vecinas = await getParcelasVecinas(
              [bb[0] - margen, bb[1] - margen, bb[2] + margen, bb[3] + margen],
              allRefcats
            )
            areaMovimiento = computeAreaMovimiento({
              overrides,
              parcelGeometry: parcelGeom,
              parcelArea,
              vecinos: vecinas.map((v) => v.geometry),
              retranqueoFrente: nzRow!.retranqueo_frente_m,
              retranqueoLateral: nzRow!.retranqueo_lateral_m,
              retranqueoTestero: nzRow!.retranqueo_testero_m,
              factorAlturaFrente: nzRow!.retranqueo_frente_factor_h ?? null,
              factorAlturaLateral: nzRow!.retranqueo_lateral_factor_h ?? null,
              factorAlturaTestero: nzRow!.retranqueo_testero_factor_h ?? null,
              alturaPisoM: nzRow!.altura_piso_m,
              ocupacionPct: nzRow!.ocupacion_pct,
              coefEdificabilidad: nzRow!.coef_edificabilidad,
              plantasMax: cuadro.sintesis.plantas_max ?? nzRow!.altura_max_plantas,
              construidaComputable: builtAreaComputable,
              tiposPersonalizados,
            })
          }
        } catch (movErr) {
          console.error('[urban-analyst/area-movimiento]', movErr)
        }
      }
      const cuadroConMovimiento = { ...cuadro, area_movimiento: areaMovimiento }

      await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'cuadro_urbanistico')
      if (cuadro.disponible) {
        await admin.from('urban_analysis').insert({
          asset_id: params.id, kind: 'cuadro_urbanistico', content: cuadroConMovimiento, model: null,
        })
        // Para la IA: sin la geometría ni las aristas del área de movimiento (pesan y no aportan)
        cuadroResumen = {
          ...cuadroConMovimiento,
          area_movimiento: areaMovimiento ? { ...areaMovimiento, geometry: undefined, linderos: undefined } : null,
        } as unknown as Record<string, unknown>
      }
      const contradicciones = cuadro.filas.filter((f) => f.contradiccion).length
      await setStep('cuadro',
        cuadro.disponible ? (contradicciones > 0 || cuadro.ambitos_prevalentes.length > 0 ? 'aviso' : 'ok') : 'aviso',
        cuadro.disponible
          ? `${cuadro.filas.length} parámetros · ${cuadro.figuras.length} figuras${contradicciones ? ` · ${contradicciones} contradicción(es)` : ''}${areaMovimiento?.disponible ? ` · área movimiento ${areaMovimiento.area_movimiento_m2} m²${areaMovimiento.volumen_max_m2c != null ? ` · capaz ${areaMovimiento.volumen_max_m2c} m²c (${areaMovimiento.restriccion_vinculante})` : ''}` : ''}${cuadro.ambitos_prevalentes.length ? ` · ⚠ ámbito prevalente: ${cuadro.ambitos_prevalentes.join(', ')}` : ''}`
          : 'Sin parámetros normativos: verificar la NZ en la tabla de normas zonales')
    } catch (cuadroErr) {
      console.error('[urban-analyst/cuadro]', cuadroErr)
      await setStep('cuadro', 'aviso', 'No se pudo montar el cuadro urbanístico')
    }

    // ── 4c. Volumen capaz 3D (determinista, geométrico) ──────────────────────
    await setStep('volumen', 'en_curso')
    let volumenResumen: Record<string, unknown> | null = null
    try {
      // Las partes del edificio (Catastro) existen en toda España; las bandas
      // COEF_Z (solo Madrid capital) ya se consultaron para la edificabilidad
      const partesPorRefcat = await Promise.all(allRefcats.map((rc) => getBuildingParts(rc)))
      const partes = partesPorRefcat.flat()
      const volumen = computeVolumenCapaz({
        parcelGeometry: parcelGeom,
        parcelAreaM2: parcelArea,
        partes,
        bandas,
      })
      await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'volumen_capaz')
      if (volumen.disponible) {
        await admin.from('urban_analysis').insert({
          asset_id: params.id, kind: 'volumen_capaz', content: volumen, model: null,
        })
        volumenResumen = volumenCapazResumen(volumen)
        await setStep('volumen',
          volumen.bandas.length > 0 ? 'ok' : 'aviso',
          volumen.bandas.length > 0
            ? `Capaz ${volumen.capaz_total_m2c ?? '?'} m²c · existente ${volumen.existente_total_m2c ?? '?'} m²c · remanente materializable ${volumen.remanente_materializable_m2c ?? '?'} m²c`
            : !esMadridCapital
              ? `Edificio 3D con ${volumen.partes.length} partes (sin volumen capaz: PGOUM no aplica en ${municipio || 'este municipio'})`
              : `${volumen.partes.length} partes de edificio (sin bandas COEF_Z: norma por coeficiente)`)
      } else {
        await setStep('volumen', 'aviso', 'Sin partes de edificio ni bandas COEF_Z para esta parcela')
      }
    } catch (volErr) {
      console.error('[urban-analyst/volumen]', volErr)
      await setStep('volumen', 'aviso', 'No se pudo calcular (servicios geométricos sin respuesta)')
    }

    // ── 5. Red flags (determinista) ──────────────────────────────────────────
    await setStep('red_flags', 'en_curso')
    const flags = computeRedFlags({
      esMadridCapital,
      hits,
      normaZonal: nz?.etiqueta ?? null,
      usoActual: asset.uso_actual,
      usoObjetivo: asset.uso_objetivo,
      usoCatastral: catastroPatch.cadastral_use,
      yearBuilt: catastroPatch.year_built,
      superficieComercial: asset.superficie_comercial,
      builtArea: catastroPatch.built_area,
      edificabilidad,
      serviciosError,
    })
    await admin.from('urban_red_flags').delete().eq('asset_id', params.id)
    if (flags.length > 0) {
      await admin.from('urban_red_flags').insert(flags.map((f) => ({ ...f, asset_id: params.id })))
    }
    const criticas = flags.filter((f) => f.severidad === 'critica' || f.severidad === 'alta').length
    await setStep('red_flags', criticas > 0 ? 'aviso' : 'ok',
      `${flags.length} red flags (${criticas} altas/críticas)`)

    // ── 6. Intérprete IA ──────────────────────────────────────────────────────
    await setStep('interprete', 'en_curso')
    const { data: freshAsset } = await admin.from('urban_assets').select('*').eq('id', params.id).single()
    const { data: docs } = await admin.from('urban_documents').select('*').eq('asset_id', params.id)

    // Checklist determinista (mismas reglas que la pestaña Checklist): entra al
    // contexto para que el modelo tenga los umbrales normativos resueltos por
    // código (IEE a 50 años, consulta recomendada, etc.) en vez de dudas abiertas.
    // Se excluye el ítem del memo (autorreferente: se está generando ahora).
    const checklistItems = computeChecklist({
      asset: freshAsset as UrbanAsset,
      hits: hits as never[],
      redFlags: flags as never[],
      analysis: [
        { kind: 'edificabilidad', content: edificabilidad },
        volumenResumen ? { kind: 'volumen_capaz', content: volumenResumen } : null,
        cuadroResumen ? { kind: 'cuadro_urbanistico', content: cuadroResumen } : null,
      ].filter(Boolean) as never[],
      documents: (docs || []) as never[],
    }).filter((c) => c.id !== 'memo')

    const contexto = buildContextoActivo({
      asset: freshAsset as UrbanAsset,
      nzRow,
      hits,
      flags,
      edificabilidad,
      cuadroUrbanistico: cuadroResumen,
      volumenCapaz: volumenResumen,
      documentos: (docs || []) as never[],
      checklist: checklistItems,
    })

    const message = await anthropic.messages.create({
      model: IA_MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: REGLAS_ANALISTA,
      messages: [{
        role: 'user',
        content: `Con los datos oficiales siguientes, redacta la ficha de análisis urbanístico preliminar del activo para el comité de inversión.

${contexto}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (todos los textos en español, sin markdown):
{
  "resumen_directivo": "6-10 frases EN LENGUAJE LLANO para un directivo de un fondo de inversión SIN conocimientos urbanísticos ni jurídicos: qué es el activo y dónde está; cuánto suelo tiene y cuánto hay construido hoy; cuánto se podría construir o ampliar como máximo según las reglas municipales y qué lo limita o condiciona; los 2-3 riesgos que de verdad afectan al dinero o a los plazos; y qué recomendamos. PROHIBIDO usar jerga sin traducirla (nada de 'norma zonal', 'COEF_Z', 'PGOUM', 'fuera de ordenación', 'catálogo', siglas o artículos a secas — si un concepto técnico es imprescindible, explícalo en palabras corrientes, p. ej. 'las reglas municipales de esta zona limitan la altura a 3 plantas'). Cifras clave con sus unidades.",
  "resumen_ejecutivo": "3-6 frases: qué es el activo, qué permite el planeamiento, cuál es el condicionante dominante",
  "situacion_urbanistica": "norma zonal / ámbito aplicable y qué implica, con etiquetas [OFICIAL]/[INFERIDO]/[HIPÓTESIS]",
  "patrimonio": "situación de protección y su impacto en las obras posibles",
  "usos": "uso actual vs objetivo: compatibilidad probable, procedimiento y sectorial a verificar",
  "potencial": "lectura del cálculo de edificabilidad: qué es teórico, qué es materializable y qué falta por confirmar",
  "riesgos_clave": ["riesgo redactado como afirmación (qué puede pasar y qué implica), nunca como pregunta"],
  "recomendacion": { "veredicto": "avanzar|condicionar_oferta|renegociar|descartar", "justificacion": "..." },
  "proximos_pasos": ["acción concreta en imperativo con su instrumento (p. ej. 'Solicitar el último IEE/ITE del edificio', 'Presentar consulta urbanística especial sobre la edificabilidad materializable'). Si algo no se sabe, el paso es la acción que lo resuelve — nunca escribas la duda como pregunta: este documento va al comité de inversión"],
  "nivel_confianza": { "nivel": "alto|medio|bajo", "motivo": "..." }
}`,
      }],
    })

    const texto = message.content.find((b) => b.type === 'text')
    const memo = texto && texto.type === 'text' ? parseJsonRespuesta(texto.text) : null
    if (!memo) throw new Error('El intérprete IA no devolvió una ficha válida.')

    await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'memo')
    await admin.from('urban_analysis').insert({
      asset_id: params.id, kind: 'memo', content: memo, model: IA_MODEL,
    })
    await setStep('interprete', 'ok', `Veredicto: ${(memo.recomendacion as { veredicto?: string })?.veredicto ?? 's/d'}`)

    await admin.from('urban_assets').update({
      status: 'completado',
      analyzed_at: new Date().toISOString(),
    }).eq('id', params.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido durante el análisis'
    console.error('[urban-analyst/analyze]', err)
    const current = pipeline.find((p) => p.status === 'en_curso')
    if (current) await setStep(current.key, 'error', msg)
    await admin.from('urban_assets').update({ status: 'error', error_msg: msg }).eq('id', params.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

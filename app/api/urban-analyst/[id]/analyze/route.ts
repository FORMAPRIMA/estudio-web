import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import {
  geocodeDireccion, refcatFromCoords, coordsFromRefcat,
  getParcelData, getBuildingData, getBuildingParts, getInmueblesCount, getInmueblesDetalle, translateCurrentUse,
} from '@/lib/urban-analyst/catastro'
import { queryAllServices, queryCondicionesBandas, extractNormaZonal } from '@/lib/urban-analyst/geoportal'
import { computeEdificabilidad } from '@/lib/urban-analyst/edificabilidad'
import { combineGeometries } from '@/lib/urban-analyst/geometry'
import { computeVolumenCapaz, volumenCapazResumen } from '@/lib/urban-analyst/volumenCapaz'
import { computeRedFlags } from '@/lib/urban-analyst/redFlags'
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
  if (!profile || profile.rol !== 'fp_partner') {
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

    // Fallback: si falta superficie o año, agregamos el detalle DNPRC por
    // inmueble de las referencias sin dato
    let usedFallback = false
    if (builtArea == null || yearBuilt == null) {
      const detalles = await Promise.all(allRefcats.map((rc) => getInmueblesDetalle(rc)))
      const sfcTotal = sum(detalles.map((d) => d?.totalSuperficieM2 ?? null))
      const anioMin = detalles.reduce<number | null>((min, d) => {
        if (d?.anioMasAntiguo == null) return min
        return min == null || d.anioMasAntiguo < min ? d.anioMasAntiguo : min
      }, null)
      if (builtArea == null && sfcTotal != null) { builtArea = sfcTotal; usedFallback = true }
      if (yearBuilt == null && anioMin != null) yearBuilt = anioMin
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
    await setStep('catastro', parcelasFallidas.length > 0 ? 'aviso' : 'ok',
      `${allRefcats.length > 1 ? `${parcelasOk.length}/${allRefcats.length} parcelas · ` : ''}${parcelArea ?? '?'} m² suelo · ${catastroPatch.built_area ?? '?'} m² construidos${usedFallback ? ' (suma por inmueble)' : ''} · ${catastroPatch.cadastral_use ?? 'uso s/d'}${catastroPatch.year_built ? ` · ${catastroPatch.year_built}` : ''}${parcelasFallidas.length ? ` · ⚠ sin geometría: ${parcelasFallidas.join(', ')}` : ''}`)

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
    let nzRow: NormaZonal | null = null
    if (nz?.etiqueta) {
      const { data: exact } = await admin.from('urban_normas_zonales').select('*').eq('codigo', nz.etiqueta).maybeSingle()
      if (exact) nzRow = exact as NormaZonal
      else {
        const { data: base } = await admin.from('urban_normas_zonales').select('*').eq('codigo', nz.etiqueta.split('.')[0]).maybeSingle()
        nzRow = (base as NormaZonal) || null
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
      edificabilidad.metodo === 'volumetrico'
        ? `Método volumétrico · horquilla ${edificabilidad.envolvente_min ?? '?'} – ${edificabilidad.envolvente_max ?? '?'} m²c`
        : edificabilidad.calculable
          ? `Coeficiente · teórica ${edificabilidad.edificabilidad_teorica} m²c · remanente ${edificabilidad.edificabilidad_remanente ?? 's/d'} m²c`
          : `No calculable — falta: ${edificabilidad.inputs_faltantes.join('; ') || 'parámetros verificados'}`)

    // ── 4b. Volumen capaz 3D (determinista, geométrico) ──────────────────────
    await setStep('volumen', 'en_curso')
    let volumenResumen: Record<string, unknown> | null = null
    try {
      // Las partes del edificio (Catastro) existen en toda España; las bandas
      // COEF_Z solo en Madrid capital
      const [partesPorRefcat, bandas] = await Promise.all([
        Promise.all(allRefcats.map((rc) => getBuildingParts(rc))),
        esMadridCapital ? queryCondicionesBandas(parcelGeom) : Promise.resolve([]),
      ])
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

    const contexto = buildContextoActivo({
      asset: freshAsset as UrbanAsset,
      nzRow,
      hits,
      flags,
      edificabilidad,
      volumenCapaz: volumenResumen,
      documentos: (docs || []) as never[],
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
  "resumen_ejecutivo": "3-6 frases: qué es el activo, qué permite el planeamiento, cuál es el condicionante dominante",
  "situacion_urbanistica": "norma zonal / ámbito aplicable y qué implica, con etiquetas [OFICIAL]/[INFERIDO]/[HIPÓTESIS]",
  "patrimonio": "situación de protección y su impacto en las obras posibles",
  "usos": "uso actual vs objetivo: compatibilidad probable, procedimiento y sectorial a verificar",
  "potencial": "lectura del cálculo de edificabilidad: qué es teórico, qué es materializable y qué falta por confirmar",
  "riesgos_clave": ["riesgo 1", "riesgo 2", "..."],
  "recomendacion": { "veredicto": "avanzar|condicionar_oferta|renegociar|descartar", "justificacion": "..." },
  "proximos_pasos": ["paso concreto 1", "..."],
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

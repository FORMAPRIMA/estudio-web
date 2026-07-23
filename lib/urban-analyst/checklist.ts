// Checklist de due diligence urbanística — replica el flujo manual que haría
// un analista antes de recomendar oferta (el equivalente a preparar una ECU o
// una consulta urbanística). Determinista: cada ítem sale de los datos ya
// recopilados, con enlace oficial cuando la verificación es manual.

import { esAmbitoEspecifico } from './cuadroUrbanistico'
import type { UrbanAsset, UrbanLayerHit, UrbanRedFlag, UrbanAnalysisRow, UrbanDocument } from './types'

export type ChecklistEstado = 'ok' | 'atencion' | 'pendiente' | 'manual'

export interface ChecklistItem {
  id: string
  titulo: string
  estado: ChecklistEstado
  detalle: string
  enlace?: { label: string; url: string }
}

const VISOR_URBANISTICO = 'https://geoportal.madrid.es/IDEAM_WBGEOPORTAL/visor_urbanistico/index.iam'
const SEDE_CONSULTAS = 'https://sede.madrid.es/portal/sede/site/venta/menuitem.ac61933d6ee3c31cae77ae7784f1a5a0/?vgnextoid=59bfaa118a3a4310VgnVCM1000000b205a0aRCRD'
const SEDE_TRAMITES = 'https://sede.madrid.es'

export function computeChecklist(params: {
  asset: UrbanAsset
  hits: UrbanLayerHit[]
  redFlags: UrbanRedFlag[]
  analysis: UrbanAnalysisRow[]
  documents: UrbanDocument[]
}): ChecklistItem[] {
  const { asset, hits, redFlags, analysis, documents } = params
  const items: ChecklistItem[] = []

  const proteccionHits = hits.filter((h) => h.categoria === 'proteccion' || h.categoria === 'bic')
  const ambitoHits = hits.filter((h) => h.categoria === 'ambito' && esAmbitoEspecifico(h.attributes))
  const edificabilidad = analysis.find((a) => a.kind === 'edificabilidad')?.content as { calculable?: boolean; inputs_faltantes?: string[] } | undefined
  const volumen = analysis.find((a) => a.kind === 'volumen_capaz')?.content as { bandas?: unknown[] } | undefined
  const lectura = analysis.find((a) => a.kind === 'documentos_oficiales')
  const memo = analysis.find((a) => a.kind === 'memo')
  const notaSimple = documents.find((d) => d.tipo === 'nota_simple')
  const flagsAltas = redFlags.filter((f) => f.severidad === 'alta' || f.severidad === 'critica')

  // 1. Identificación catastral
  items.push({
    id: 'identificacion',
    titulo: '1 · Identificación catastral y geometría',
    estado: asset.refcat && asset.parcel_geometry ? 'ok' : 'pendiente',
    detalle: asset.refcat && asset.parcel_geometry
      ? `RC ${asset.refcat} · parcela ${asset.parcel_area ?? '?'} m² · geometría INSPIRE cargada`
      : 'Falta resolver la referencia catastral o la geometría: lanza el análisis.',
  })

  // 2. Planeamiento aplicable
  items.push({
    id: 'planeamiento',
    titulo: '2 · Planeamiento y norma zonal',
    estado: asset.norma_zonal ? (ambitoHits.length > 0 ? 'atencion' : 'ok') : 'pendiente',
    detalle: asset.norma_zonal
      ? `NZ ${asset.norma_zonal}${asset.norma_zonal_denominacion ? ` (${asset.norma_zonal_denominacion})` : ''}${ambitoHits.length > 0 ? ` · ⚠ dentro de ámbito específico: la ficha del ámbito prevalece` : ''}`
      : 'Norma zonal sin identificar.',
    enlace: { label: 'Visor Urbanístico', url: VISOR_URBANISTICO },
  })

  // 3. Protección patrimonial
  items.push({
    id: 'proteccion',
    titulo: '3 · Catálogo y protección',
    estado: proteccionHits.length === 0 ? 'ok' : 'atencion',
    detalle: proteccionHits.length === 0
      ? 'Sin afecciones de catálogo/BIC detectadas en capas vigentes (verificación con valor jurídico: consulta urbanística).'
      : `${proteccionHits.length} afección(es) de protección. Obtener y revisar la ficha del catálogo antes de asumir obras.`,
    enlace: proteccionHits.length > 0 ? { label: 'Visor Urbanístico (catálogo)', url: VISOR_URBANISTICO } : undefined,
  })

  // 4. Edificabilidad / volumen capaz
  const volOk = Boolean(volumen?.bandas && (volumen.bandas as unknown[]).length > 0)
  const ediOk = Boolean(edificabilidad?.calculable)
  items.push({
    id: 'edificabilidad',
    titulo: '4 · Edificabilidad y volumen capaz',
    estado: ediOk || volOk ? ((edificabilidad?.inputs_faltantes?.length ?? 0) > 0 ? 'atencion' : 'ok') : 'atencion',
    detalle: volOk
      ? 'Volumen capaz por bandas COEF_Z calculado (envolvente teórica, ver pestaña Edificabilidad y 3D).'
      : ediOk
        ? 'Edificabilidad calculada por coeficiente.'
        : `No calculable aún${edificabilidad?.inputs_faltantes?.length ? `: falta ${edificabilidad.inputs_faltantes.join('; ')}` : ''}.`,
  })

  // 5. Lectura de documentos oficiales (plano CE / ficha)
  items.push({
    id: 'documentos_oficiales',
    titulo: '5 · Plano CE / ficha de catálogo leídos',
    estado: lectura ? 'ok' : 'pendiente',
    detalle: lectura
      ? 'Documentos oficiales leídos con IA y contrastados con el análisis (ver pestaña Docs).'
      : 'Pendiente: usa «Leer documentos oficiales» en la pestaña Docs para extraer fondos/alturas del plano y condiciones de la ficha.',
  })

  // 6. Régimen de usos
  const cambioUso = asset.uso_objetivo && (asset.uso_actual || asset.cadastral_use) &&
    asset.uso_objetivo.toLowerCase() !== (asset.uso_actual || asset.cadastral_use || '').toLowerCase()
  items.push({
    id: 'usos',
    titulo: '6 · Régimen de usos (actual → objetivo)',
    estado: asset.uso_objetivo ? (cambioUso ? 'manual' : 'ok') : 'pendiente',
    detalle: !asset.uso_objetivo
      ? 'Define el uso objetivo del activo para evaluar compatibilidad.'
      : cambioUso
        ? `Cambio de uso ${asset.uso_actual || asset.cadastral_use} → ${asset.uso_objetivo}: verificar régimen de compatibilidad de la NZ, condiciones por planta/acceso y sectorial (Ordenanza 6/2022). Recomendable consulta urbanística común.`
        : 'Sin cambio de uso previsto.',
    enlace: cambioUso ? { label: 'Consultas urbanísticas (Sede)', url: SEDE_CONSULTAS } : undefined,
  })

  // 7. Expedientes y licencias (CONEX) — sin API pública: manual
  items.push({
    id: 'expedientes',
    titulo: '7 · Expedientes, licencias y disciplina (CONEX)',
    estado: 'manual',
    detalle: 'Sin API pública: consultar manualmente expedientes de licencias, declaraciones responsables, órdenes de ejecución y disciplina sobre la finca. Anota el resultado en Notas o sube el justificante a Docs.',
    enlace: { label: 'Sede electrónica (CONEX)', url: SEDE_TRAMITES },
  })

  // 8. Situación registral
  items.push({
    id: 'registro',
    titulo: '8 · Nota simple y situación registral',
    estado: notaSimple ? 'ok' : 'pendiente',
    detalle: notaSimple
      ? `Nota simple aportada (${notaSimple.nombre}). Usa «Leer documentos» para contrastarla con Catastro.`
      : 'Sube la nota simple a Docs: titularidad, cargas, división horizontal y vuelo son críticos para remonte/segregación.',
  })

  // 9. IEE / antigüedad
  const antiguedad = asset.year_built != null ? new Date().getFullYear() - asset.year_built : null
  items.push({
    id: 'iee',
    titulo: '9 · IEE / estado del edificio',
    estado: antiguedad != null && antiguedad >= 50 ? 'manual' : 'ok',
    detalle: antiguedad != null && antiguedad >= 50
      ? `Edificio de ${asset.year_built} (${antiguedad} años): solicitar último IEE/ITE y su resultado.`
      : antiguedad != null
        ? `Edificio de ${asset.year_built}: IEE no exigible aún por antigüedad.`
        : 'Año de construcción sin dato.',
  })

  // 10. Consulta urbanística especial
  const necesitaConsulta = flagsAltas.length > 0 || volOk || Boolean(cambioUso)
  items.push({
    id: 'consulta',
    titulo: '10 · Consulta urbanística especial',
    estado: necesitaConsulta ? 'manual' : 'ok',
    detalle: necesitaConsulta
      ? `Recomendada antes de comprometer la oferta (${[flagsAltas.length > 0 ? `${flagsAltas.length} red flags altas` : null, volOk ? 'edificabilidad por volumetría' : null, cambioUso ? 'cambio de uso' : null].filter(Boolean).join(', ')}). Genera el borrador desde esta pestaña.`
      : 'No imprescindible con los datos actuales; valorar consulta común si surge duda material.',
  })

  // Memo final
  items.push({
    id: 'memo',
    titulo: '11 · Ficha del analista y decisión',
    estado: memo ? 'ok' : 'pendiente',
    detalle: memo ? 'Ficha generada con veredicto (ver pestaña Ficha).' : 'Lanza el análisis para generar la ficha.',
  })

  return items
}

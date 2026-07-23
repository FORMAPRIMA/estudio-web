// Motor de reglas determinista para red flags urbanísticas.
// Cada regla es auditable: condición explícita → flag con severidad, fuente y
// recomendación. La IA no interviene aquí.

import type { LayerHitRaw } from './geoportal'
import { esAmbitoEspecifico } from './cuadroUrbanistico'
import type { EdificabilidadResult, Severidad } from './types'

export interface RedFlagInput {
  esMadridCapital: boolean
  hits: LayerHitRaw[]
  normaZonal: string | null            // ej. '1.3'
  usoActual: string | null
  usoObjetivo: string | null
  usoCatastral: string | null          // traducido, ej. 'Residencial'
  yearBuilt: number | null
  superficieComercial: number | null   // declarada en dossier
  builtArea: number | null             // catastro
  edificabilidad: EdificabilidadResult | null
  serviciosError: string[]
}

export interface RedFlagRaw {
  categoria: string
  severidad: Severidad
  titulo: string
  descripcion: string
  recomendacion: string
  fuente: string
}

const GEOPORTAL_DISCLAIMER = 'Geoportal Ayto. Madrid (sin valor jurídico)'

export function computeRedFlags(input: RedFlagInput): RedFlagRaw[] {
  const flags: RedFlagRaw[] = []
  const {
    esMadridCapital, hits, normaZonal, usoActual, usoObjetivo, usoCatastral,
    yearBuilt, superficieComercial, builtArea, edificabilidad, serviciosError,
  } = input

  const byService = (suffix: string) => hits.filter((h) => h.service.endsWith(suffix))
  const nzBase = normaZonal ? normaZonal.split('.')[0] : null

  // 0 — Fuera de Madrid capital
  if (!esMadridCapital) {
    flags.push({
      categoria: 'datos',
      severidad: 'critica',
      titulo: 'Activo fuera de Madrid capital',
      descripcion: 'Las capas urbanísticas de esta herramienta corresponden al PGOUM de Madrid capital. El análisis de planeamiento no es aplicable a este activo.',
      recomendacion: 'Analizar con el planeamiento del municipio correspondiente (Visor SIT de la Comunidad de Madrid).',
      fuente: 'Catastro / CartoCiudad',
    })
    return flags
  }

  // 1 — Protección patrimonial (catálogo vigente)
  const proteccion = byService('EDIFICIOS_PROTEGIDOS_VIGENTE')
  const edifProtegido = proteccion.filter((h) => (h.layer_name || '').startsWith('Edificios Protegidos'))
  const conjuntos = proteccion.filter((h) => (h.layer_name || '').startsWith('Conjuntos Homogéneos'))
  const descatalogados = proteccion.filter((h) => (h.layer_name || '').includes('Descatalogados'))
  const demolicion = proteccion.filter((h) => (h.layer_name || '').includes('Demolición'))

  if (edifProtegido.length > 0) {
    const attrs = edifProtegido.map((h) => resumenAttrs(h.attributes)).filter(Boolean).join(' · ')
    flags.push({
      categoria: 'patrimonio',
      severidad: 'alta',
      titulo: 'Edificio incluido en el Catálogo de Edificios Protegidos',
      descripcion: `La parcela intersecta con el catálogo de protección vigente.${attrs ? ` Datos de capa: ${attrs}` : ''} El nivel y grado condicionan las obras admisibles (remonte, redistribución, fachada, cubierta, patios).`,
      recomendacion: 'Consultar la ficha del catálogo (nivel, grado, elementos protegidos) y prever dictamen/informe de la CPPHAN antes de asumir cualquier ampliación o alteración.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }
  if (conjuntos.length > 0) {
    flags.push({
      categoria: 'patrimonio',
      severidad: 'media',
      titulo: 'Parcela en Conjunto Homogéneo protegido',
      descripcion: 'El entorno está catalogado como conjunto homogéneo: las intervenciones en fachada, altura y composición pueden estar condicionadas para preservar la coherencia del conjunto.',
      recomendacion: 'Revisar condiciones del conjunto en el catálogo y su impacto en remontes y fachadas.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }
  if (demolicion.length > 0) {
    flags.push({
      categoria: 'patrimonio',
      severidad: 'media',
      titulo: 'Capa de edificios con demolición total',
      descripcion: 'La parcela intersecta la capa de edificios con expediente de demolición total del catálogo.',
      recomendacion: 'Verificar el estado real del expediente en CONEX / consulta urbanística.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }
  if (descatalogados.length > 0) {
    flags.push({
      categoria: 'patrimonio',
      severidad: 'baja',
      titulo: 'Edificio descatalogado',
      descripcion: 'Consta en la capa de edificios descatalogados: existió protección que fue retirada.',
      recomendacion: 'Confirmar la descatalogación efectiva y su alcance.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }

  // 2 — BIC (verificado geométricamente contra la parcela: directo vs entorno)
  const bicHits = byService('/BIC')
  const bicNombres = (hs: typeof bicHits) =>
    Array.from(new Set(hs.map((h) => h.attributes._bic_nombre).filter((n): n is string => typeof n === 'string'))).slice(0, 3).join(' · ')
  const bicDirectas = bicHits.filter((h) => h.attributes._afeccion === 'directa')
  const bicEntornos = bicHits.filter((h) => h.attributes._afeccion === 'entorno')
  const bicNoVerif = bicHits.filter((h) => h.attributes._afeccion === 'no_verificable')

  if (bicDirectas.length > 0) {
    const nombres = bicNombres(bicDirectas)
    flags.push({
      categoria: 'patrimonio',
      severidad: 'critica',
      titulo: 'Afección DIRECTA por Bien de Interés Cultural',
      descripcion: `La parcela solapa geométricamente con la delimitación de un BIC${nombres ? ` (${nombres})` : ''}. El régimen de la Ley 3/2013 de Patrimonio Histórico de la CM prevalece sobre el planeamiento: cualquier intervención exige autorización previa de la DG de Patrimonio Cultural.`,
      recomendacion: 'Verificar la declaración del BIC (BOCM) y su plan/normas de protección antes de cualquier tesis de inversión. Este condicionante domina el análisis.',
      fuente: `${GEOPORTAL_DISCLAIMER} — verificado por intersección geométrica`,
    })
  }
  if (bicEntornos.length > 0) {
    const nombres = bicNombres(bicEntornos)
    flags.push({
      categoria: 'patrimonio',
      severidad: 'media',
      titulo: 'Parcela dentro de ENTORNO de protección de BIC',
      descripcion: `La parcela está dentro del entorno de protección de un BIC${nombres ? ` (${nombres})` : ''}, sin afección directa. Las intervenciones con incidencia exterior (volumen, fachada, cubierta, demolición) pueden requerir informe/autorización de Patrimonio (CM).`,
      recomendacion: 'Confirmar el alcance del entorno en la declaración del BIC y qué obras exigen autorización sectorial.',
      fuente: `${GEOPORTAL_DISCLAIMER} — verificado por intersección geométrica`,
    })
  }
  if (bicNoVerif.length > 0 && bicDirectas.length === 0 && bicEntornos.length === 0) {
    flags.push({
      categoria: 'patrimonio',
      severidad: 'baja',
      titulo: 'Posible afección BIC no verificable geométricamente',
      descripcion: 'El servicio de BIC devolvió registros sin geometría utilizable: no se pudo confirmar si la parcela está realmente dentro de la delimitación o su entorno.',
      recomendacion: 'Comprobar manualmente el plano de BIC y entornos en el Geoportal / DG de Patrimonio Cultural CM.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }

  // 3 — Arqueología
  if (byService('AREAS_PROTECCION_ARQUEOLOGICA_PALEONTOLOGICA').length > 0) {
    flags.push({
      categoria: 'patrimonio',
      severidad: 'media',
      titulo: 'Área de protección arqueológica/paleontológica',
      descripcion: 'Las obras con movimiento de tierras pueden exigir intervención arqueológica previa (informe/excavación), con impacto en plazo y coste.',
      recomendacion: 'Prever informe arqueológico si el proyecto afecta al subsuelo.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }

  // 4 — Ámbitos de planeamiento (APE/APR/API/UE...) — solo ámbitos REALES:
  // la capa devuelve también el polígono de la propia norma zonal
  const ambitos = byService('AMBITOS_PLANEAMIENTO_URBANISTICO').filter((h) => esAmbitoEspecifico(h.attributes))
  if (ambitos.length > 0) {
    const nombres = ambitos.map((h) => resumenAttrs(h.attributes)).filter(Boolean).slice(0, 3).join(' · ')
    flags.push({
      categoria: 'ambito',
      severidad: 'alta',
      titulo: 'Parcela dentro de un ámbito de planeamiento específico',
      descripcion: `La parcela está incluida en un ámbito (APE/APR/API/UE...) con ordenación propia que puede desplazar las condiciones generales de la norma zonal.${nombres ? ` Ámbito(s): ${nombres}` : ''}`,
      recomendacion: 'Obtener y revisar la ficha del ámbito: es la que manda sobre edificabilidad, usos y condiciones.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }

  // 5 — Modificaciones / desarrollos del PGOUM (filtrando el eco de la NZ)
  const planeamiento = byService('PLANEAMIENTO_URBANISTICO').filter((h) => esAmbitoEspecifico(h.attributes))
  if (planeamiento.length > 0) {
    flags.push({
      categoria: 'administrativo',
      severidad: 'media',
      titulo: 'Modificaciones o desarrollos del PGOUM sobre la parcela',
      descripcion: `Existen ${planeamiento.length} registro(s) de planeamiento posterior al PGOUM 97 que afectan a la zona (modificaciones puntuales, planes de desarrollo, expedientes).`,
      recomendacion: 'Revisar los expedientes concretos: pueden haber alterado la calificación o condiciones originales.',
      fuente: GEOPORTAL_DISCLAIMER,
    })
  }

  // 6 — Norma Zonal 1 (patrimonio histórico)
  if (nzBase === '1') {
    flags.push({
      categoria: 'patrimonio',
      severidad: 'media',
      titulo: 'Norma Zonal 1 — Protección del Patrimonio Histórico',
      descripcion: 'El ámbito NZ1 (centro histórico) tiene el régimen de obras más restrictivo del PGOUM: obras admisibles según catálogo, fondos y patios específicos, y edificabilidad no determinada por coeficiente.',
      recomendacion: 'Cualquier tesis de ampliación/remonte en NZ1 debe validarse con consulta urbanística especial.',
      fuente: 'PGOUM 1997 — NNUU (Compendio, carácter informativo)',
    })
  }

  // 7 — Cambio de uso pretendido
  const usoRef = usoActual || usoCatastral
  if (usoObjetivo && usoRef && normalize(usoObjetivo) !== normalize(usoRef)) {
    flags.push({
      categoria: 'uso',
      severidad: 'media',
      titulo: `Cambio de uso: ${usoRef} → ${usoObjetivo}`,
      descripcion: 'El uso objetivo difiere del actual. La viabilidad depende del régimen de usos compatibles/autorizables de la norma zonal, de condiciones por planta y acceso, y de normativa sectorial (hospedaje, VUT, actividad).',
      recomendacion: 'Verificar el régimen de usos de la norma zonal aplicable y el procedimiento (licencia/declaración responsable, Ordenanza 6/2022). Considerar consulta urbanística común.',
      fuente: 'PGOUM 1997 + Ordenanza 6/2022',
    })
  }

  // 8 — Discrepancia de superficies dossier vs Catastro
  if (superficieComercial != null && builtArea != null && builtArea > 0) {
    const diff = Math.abs(superficieComercial - builtArea) / builtArea
    if (diff > 0.10) {
      flags.push({
        categoria: 'datos',
        severidad: 'media',
        titulo: 'Discrepancia de superficies (dossier vs Catastro)',
        descripcion: `La superficie comercial declarada (${Math.round(superficieComercial)} m²) difiere un ${Math.round(diff * 100)} % de la construida catastral (${Math.round(builtArea)} m²).`,
        recomendacion: 'Contrastar con nota simple registral y medición real. Las discrepancias Catastro/Registro/realidad son fuente típica de sobrecoste y litigio.',
        fuente: 'Catastro + dossier aportado',
      })
    }
  }

  // 9 — Antigüedad (IEE/ITE)
  if (yearBuilt != null && new Date().getFullYear() - yearBuilt >= 50) {
    flags.push({
      categoria: 'administrativo',
      severidad: 'baja',
      titulo: `Edificio de ${yearBuilt}: IEE exigible`,
      descripcion: 'Con más de 50 años, el edificio está sujeto al Informe de Evaluación de Edificios; su estado puede condicionar CAPEX y plazos.',
      recomendacion: 'Solicitar el último IEE/ITE y su resultado antes de cerrar la operación.',
      fuente: 'Catastro (año de construcción)',
    })
  }

  // 10 — Edificabilidad no verificable
  if (edificabilidad && !edificabilidad.calculable) {
    flags.push({
      categoria: 'edificabilidad',
      severidad: 'media',
      titulo: 'Edificabilidad no calculable con datos verificados',
      descripcion: edificabilidad.advertencias[0] || 'Faltan parámetros verificados para calcular la edificabilidad.',
      recomendacion: edificabilidad.recomendaciones[0] || 'Verificar parámetros de la norma zonal.',
      fuente: 'Motor de cálculo interno',
    })
  }
  if (edificabilidad?.edificabilidad_remanente != null && edificabilidad.edificabilidad_remanente < 0) {
    flags.push({
      categoria: 'edificabilidad',
      severidad: 'media',
      titulo: 'Posible exceso de edificabilidad existente',
      descripcion: 'La superficie construida supera la edificabilidad teórica: el edificio podría estar en situación de fuera de ordenación relativa, limitando obras de gran alcance.',
      recomendacion: 'Confirmar régimen aplicable a edificios en situación de fuera de ordenación (obras admisibles).',
      fuente: 'Motor de cálculo interno',
    })
  }

  // 11 — Servicios no consultados
  if (serviciosError.length > 0) {
    flags.push({
      categoria: 'datos',
      severidad: 'baja',
      titulo: `${serviciosError.length} capa(s) oficiales no respondieron`,
      descripcion: `No se pudo consultar: ${serviciosError.join(', ')}. El análisis puede estar incompleto en esas dimensiones.`,
      recomendacion: 'Relanzar el análisis más tarde o comprobar manualmente esas capas en el Visor Urbanístico.',
      fuente: 'Pipeline de análisis',
    })
  }

  return flags
}

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Resume atributos de un feature a un texto corto legible. */
function resumenAttrs(attrs: Record<string, unknown>): string {
  const entries = Object.entries(attrs)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .slice(0, 3)
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
}

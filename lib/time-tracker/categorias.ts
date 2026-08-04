/**
 * Categorías internas del Time Tracker.
 *
 * Son las opciones del bloque "Interno" del desplegable de la rejilla: lo que no
 * es una fase de proyecto ni un proyecto interno de negocio ni una oferta. Se
 * guardan en `time_entries.categoria_interna` como el `codigo` en texto plano
 * (`'VACACIONES'`), así que **el código es la clave del histórico**: renombrar la
 * etiqueta es gratis, cambiar el código rompería los registros ya guardados.
 *
 * El `tipo` es lo que permite discriminar en los análisis:
 *   · `trabajo_interno` → horas trabajadas que no van a un proyecto (Gestión FP…)
 *   · `ausencia`        → horas marcadas pero NO trabajadas (vacaciones, baja…)
 */

export type TipoCategoriaInterna = 'trabajo_interno' | 'ausencia'

export interface CategoriaInterna {
  id:           string
  codigo:       string
  label:        string
  tipo:         TipoCategoriaInterna
  activo:       boolean
  orden:        number
  visible_para: string[] | null
}

export const TIPOS_CATEGORIA: Array<{
  id: TipoCategoriaInterna
  label: string
  descripcion: string
}> = [
  {
    id: 'trabajo_interno',
    label: 'Trabajo interno',
    descripcion: 'Horas trabajadas que no cuelgan de un proyecto. Suman a horas trabajadas.',
  },
  {
    id: 'ausencia',
    label: 'Ausencia',
    descripcion: 'Horas marcadas pero no trabajadas. Se descuentan de las horas trabajadas.',
  },
]

/** Colores de la categoría en la rejilla y en las barras de análisis. */
export const COLOR_TRABAJO_INTERNO = { bg: '#F1EFE8', tc: '#666666' }
export const COLOR_AUSENCIA        = { bg: '#E4E7EE', tc: '#5C6473' }

export const colorDeTipo = (tipo: TipoCategoriaInterna) =>
  tipo === 'ausencia' ? COLOR_AUSENCIA : COLOR_TRABAJO_INTERNO

/**
 * `categoria_interna` también almacena proyectos internos de negocio
 * (`iproj_<faseId>`) y ofertas (`oferta_<id>`). Esos dos prefijos están
 * reservados: una categoría no puede llamarse así o se confundiría con ellos.
 */
export const PREFIJOS_RESERVADOS = ['IPROJ_', 'OFERTA_']

/** ¿Este valor de `categoria_interna` es una categoría interna y no un iproj_/oferta_? */
export const esCategoriaInterna = (categoriaInterna: string) =>
  !categoriaInterna.startsWith('iproj_') && !categoriaInterna.startsWith('oferta_')

/** "Baja médica" → "BAJA_MEDICA". El código se deriva de la etiqueta al crearla. */
export const codigoDesdeLabel = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // sin acentos: el código viaja en CSV y en la BD
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)

/** Etiqueta legible de un código suelto (categoría borrada, CSV importado…). */
export const labelDeCodigo = (codigo: string) => codigo.replace(/_/g, ' ')

/**
 * Las 9 categorías que vivían hardcodeadas en `TimeTracker.tsx`. Se usan como
 * fallback mientras `timetracker_categorias.sql` no esté ejecutada, para que la
 * rejilla no se quede sin opciones internas.
 */
export const CATEGORIAS_FALLBACK: CategoriaInterna[] = ([
  { codigo: 'GESTION_FORMA_PRIMA',      label: 'Gestión FP',        tipo: 'trabajo_interno' },
  { codigo: 'LEADS_OFERTAS',            label: 'Leads / Ofertas',   tipo: 'trabajo_interno' },
  { codigo: 'REUNION_CLIENTE_POTENCIAL',label: 'Reunión Cliente',   tipo: 'trabajo_interno' },
  { codigo: 'VISITA_PROVEEDOR',         label: 'Visita Proveedor',  tipo: 'trabajo_interno' },
  { codigo: 'SOPHIQ_GENERAL',           label: 'Sophiq General',    tipo: 'trabajo_interno' },
  { codigo: 'FORMACION',                label: 'Formación',         tipo: 'trabajo_interno' },
  { codigo: 'VACACIONES',               label: 'Vacaciones',        tipo: 'ausencia' },
  { codigo: 'BAJA_MEDICA',              label: 'Baja Médica',       tipo: 'ausencia' },
  { codigo: 'AUSENTE',                  label: 'Ausente',           tipo: 'ausencia' },
] as Array<{ codigo: string; label: string; tipo: TipoCategoriaInterna }>)
  .map((c, i) => ({ ...c, id: c.codigo, activo: true, orden: i, visible_para: null }))

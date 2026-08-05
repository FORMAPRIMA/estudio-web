// Formulario de contacto de la web pública: opciones de cualificación y tipos.
//
// Todo lo que no sea nombre + email + consentimiento es OPCIONAL (decisión de
// Jose): la cualificación se pide DESPUÉS de enviar, cuando el lead ya está
// asegurado, para que abandonar ahí no cueste un contacto.

export type Locale = 'es' | 'en'

export interface OpcionChip {
  valor: string
  es: string
  en: string
}

/** Paso 1: un toque, sin teclado. También clasifica el lead antes de saber quién es. */
export const SERVICIOS: OpcionChip[] = [
  { valor: 'obra_nueva',   es: 'Obra nueva',              en: 'New build' },
  { valor: 'reforma',      es: 'Reforma integral',        en: 'Full renovation' },
  { valor: 'interiorismo', es: 'Interiorismo',            en: 'Interior design' },
  { valor: 'real_estate',  es: 'Real Estate',             en: 'Real Estate' },
  { valor: 'partner',      es: 'Soy constructora/partner', en: 'I am a contractor/partner' },
  { valor: 'otro',         es: 'Otra cosa',               en: 'Something else' },
]

export const SUPERFICIES: OpcionChip[] = [
  { valor: '<100',    es: 'Menos de 100 m²', en: 'Under 100 m²' },
  { valor: '100-200', es: '100 – 200 m²',    en: '100 – 200 m²' },
  { valor: '200-400', es: '200 – 400 m²',    en: '200 – 400 m²' },
  { valor: '>400',    es: 'Más de 400 m²',   en: 'Over 400 m²' },
]

export const PLAZOS: OpcionChip[] = [
  { valor: 'ya',        es: 'Cuanto antes',      en: 'As soon as possible' },
  { valor: '3m',        es: 'En unos 3 meses',   en: 'In about 3 months' },
  { valor: '6m',        es: 'En 6 meses o más',  en: 'In 6 months or more' },
  { valor: 'explorando', es: 'Solo explorando',  en: 'Just exploring' },
]

export const PRESUPUESTOS: OpcionChip[] = [
  { valor: '<150k',  es: 'Menos de 150.000 €', en: 'Under €150,000' },
  { valor: '150-300k', es: '150.000 – 300.000 €', en: '€150,000 – 300,000' },
  { valor: '300-600k', es: '300.000 – 600.000 €', en: '€300,000 – 600,000' },
  { valor: '>600k',  es: 'Más de 600.000 €',   en: 'Over €600,000' },
  { valor: 'no_se',  es: 'Aún no lo sé',       en: 'Not sure yet' },
]

export const label = (ops: OpcionChip[], valor: string | null | undefined, locale: Locale): string => {
  if (!valor) return ''
  const o = ops.find((x) => x.valor === valor)
  return o ? (locale === 'en' ? o.en : o.es) : valor
}

/** Resumen legible de la cualificación, para el CRM y los correos internos. */
export function resumenCualificacion(d: {
  servicio?: string | null
  ubicacion?: string | null
  superficie?: string | null
  plazo?: string | null
  presupuesto?: string | null
}, locale: Locale = 'es'): string {
  return [
    label(SERVICIOS, d.servicio, locale),
    d.ubicacion?.trim() || '',
    label(SUPERFICIES, d.superficie, locale),
    label(PLAZOS, d.plazo, locale),
    label(PRESUPUESTOS, d.presupuesto, locale),
  ].filter(Boolean).join(' · ')
}

export interface ContactoParcial {
  id: string
  nombre: string | null
  email: string | null
  telefono: string | null
  empresa: string | null
  mensaje: string | null
  servicio: string | null
  ubicacion: string | null
  superficie: string | null
  plazo: string | null
  presupuesto: string | null
  idioma: string
  paso_alcanzado: number
  completado: boolean
  lead_id: string | null
  created_at: string
  updated_at: string
}

/** Campos que el formulario puede autoguardar. El servidor ignora cualquier otro. */
export const CAMPOS_PARCIAL = [
  'nombre', 'email', 'telefono', 'empresa', 'mensaje',
  'servicio', 'ubicacion', 'superficie', 'plazo', 'presupuesto',
] as const
export type CampoParcial = (typeof CAMPOS_PARCIAL)[number]

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Un teléfono "útil" para llamar: al menos 7 dígitos. */
export const telefonoUtil = (t?: string | null) => !!t && (t.match(/\d/g)?.length ?? 0) >= 7

// Shared config for propuestas — safe to import from both client and server

export const SERVICIOS_CONFIG = {
  anteproyecto: {
    label:           'Anteproyecto',
    tipo:            'pem' as const,
    pem_split:       0.25,
    semanas_default: '3–4 semanas',
    texto: 'El servicio de Anteproyecto comprende el desarrollo de las propuestas de diseño y distribución del espacio, incluyendo la documentación gráfica y la conceptualización tridimensional necesarias para su comprensión y aprobación por parte del cliente.',
    entregables: [
      { grupo: 'Planos de propuesta',    items: ['Planos de estado actual', 'Plano de distribución propuesta', 'Plano de cotas y superficies'] },
      { grupo: 'Diseño 3D',             items: ['Modelado 3D de espacios principales', 'Renders'] },
      { grupo: 'Documentación escrita', items: ['Memoria de calidades preliminar'] },
    ],
    pago: [
      { label: 'A la firma del contrato', pct: 50 },
      { label: 'A la entrega del anteproyecto', pct: 50 },
    ],
  },
  proyecto_ejecucion: {
    label:           'Proyecto de Ejecución',
    tipo:            'pem' as const,
    pem_split:       0.45,
    semanas_default: '6–8 semanas',
    texto: 'El Proyecto de Ejecución comprende el desarrollo técnico completo necesario para la licitación y ejecución de la obra, con la documentación constructiva detallada que permite la correcta realización de los trabajos y la selección del constructor mediante licitación.',
    entregables: [
      { grupo: 'Proyecto ejecutivo', items: ['Planos constructivos detallados', 'Detalles técnicos y constructivos', 'Especificaciones técnicas', 'Documentación gráfica para ejecución', 'Documentación para licitación'] },
      { grupo: 'Diseño 3D ejecutivo', items: ['Actualización de modelo 3D', 'Renders'] },
      { grupo: 'Documentación económica', items: ['Proceso de licitación de obra', 'Comparativa de presupuestos', 'Asesoría en revisión de presupuestos de obra'] },
    ],
    pago: [
      { label: 'A la firma del contrato de esta fase', pct: 40 },
      { label: 'A la entrega del proyecto ejecutivo', pct: 60 },
    ],
  },
  direccion_obra: {
    label:           'Dirección Estética de Obra',
    tipo:            'pem' as const,
    pem_split:       0.30,
    semanas_default: 'Duración de la obra',
    texto: 'La Dirección Estética de Obra comprende el seguimiento y control del proceso constructivo desde el punto de vista del diseño, garantizando que la ejecución se ajusta a los criterios estéticos y técnicos definidos en el proyecto, con coordinación continua con el constructor y el cliente.',
    entregables: [
      { grupo: 'Seguimiento de obra', items: ['Actas de obra', 'Registro fotográfico / video', 'Seguimiento de cronograma', 'Validación de acabados y muestras', 'Coordinación con constructor', 'Asesoramiento continuo al cliente'] },
      { grupo: 'Control de entrega', items: ['Lista de remates (Checklist)', 'Acta de final de obra', 'Validación final de ejecución', 'Acompañamiento en recepción'] },
    ],
    pago: [
      { label: 'Mensualmente durante la ejecución de la obra', pct: 100 },
    ],
  },
  interiorismo: {
    label:           'Proyecto de Interiorismo',
    tipo:            'ratio' as const,
    pem_split:       0,
    semanas_default: '4–6 semanas',
    texto: 'El Proyecto de Interiorismo comprende el diseño integral del mobiliario y la decoración de los espacios, desde la conceptualización hasta la selección y presupuestación de todos los elementos, con el desarrollo del concepto visual y la documentación necesaria para la toma de decisiones.',
    entregables: [
      { grupo: 'Proyecto de interiorismo', items: ['Concepto de diseño (Moodboards y Collages por espacio)', 'Propuesta de selección de mobiliario y decoración', 'Presupuesto de piezas seleccionadas', 'Visitas a showrooms'] },
      { grupo: 'Diseño 3D', items: ['Modelado 3D con mobiliario', 'Renders fotorrealistas'] },
    ],
    pago: [
      { label: 'A la firma del contrato de esta fase', pct: 50 },
      { label: 'A la entrega del proyecto de interiorismo', pct: 50 },
    ],
  },
  gestion_interiorismo: {
    label:           'Gestión de Interiorismo',
    tipo:            'ratio' as const,
    pem_split:       0,
    semanas_default: 'Según programa de obra',
    texto: 'El servicio de Gestión de Interiorismo abarca la coordinación integral de la compra, seguimiento, recepción y montaje de todos los elementos de mobiliario y decoración seleccionados, garantizando que la puesta en escena final del espacio responde a los criterios definidos en el proyecto.',
    entregables: [
      { grupo: 'Gestión de compras', items: ['Coordinación de pedidos', 'Seguimiento de entregas', 'Recepción de entregas'] },
      { grupo: 'Montaje', items: ['Coordinación de montaje', 'Supervisión de instalación', 'Validación final de mobiliario', 'Gestión de limpieza final de obra'] },
    ],
    pago: [
      { label: 'Al inicio de las gestiones de compra', pct: 30 },
      { label: 'A la finalización del montaje', pct: 70 },
    ],
  },
} as const

export type ServicioId = keyof typeof SERVICIOS_CONFIG
export const SERVICIO_IDS = Object.keys(SERVICIOS_CONFIG) as ServicioId[]

// ── English service content ───────────────────────────────────────────────────
// Used when generating PDFs with lang='en'. Overrides label/texto/entregables/pago/semanas.
// The payment milestone translation map covers the stored honorarios strings in contratos.

type ServicioContent = {
  label:           string
  texto:           string
  entregables:     { grupo: string; items: string[] }[]
  semanas_default: string
  pago:            { label: string; pct: number }[]
}

export const SERVICIOS_CONFIG_EN: Record<ServicioId, ServicioContent> = {
  anteproyecto: {
    label:           'Preliminary Design',
    semanas_default: '3–4 weeks',
    texto: 'The Preliminary Design service covers the development of design and space layout proposals, including the graphic documentation and three-dimensional conceptualisation required for their understanding and approval by the client.',
    entregables: [
      { grupo: 'Proposal drawings',     items: ['Existing conditions drawings', 'Proposed layout drawing', 'Dimensions and areas drawing'] },
      { grupo: '3D Design',             items: ['3D modelling of main spaces', 'Renders'] },
      { grupo: 'Written documentation', items: ['Preliminary materials specification'] },
    ],
    pago: [
      { label: 'On signature of the agreement',              pct: 50 },
      { label: 'On delivery of the preliminary design',      pct: 50 },
    ],
  },
  proyecto_ejecucion: {
    label:           'Execution Project',
    semanas_default: '6–8 weeks',
    texto: 'The Execution Project covers the full technical development required for tendering and carrying out the works, with detailed construction documentation enabling the correct performance of the works and the selection of the contractor through a competitive tender process.',
    entregables: [
      { grupo: 'Execution project',        items: ['Detailed construction drawings', 'Technical and construction details', 'Technical specifications', 'Graphic documentation for execution', 'Tender documentation'] },
      { grupo: 'Executive 3D design',      items: ['3D model update', 'Renders'] },
      { grupo: 'Economic documentation',   items: ['Tender process management', 'Budget comparison', 'Advisory on construction budget review'] },
    ],
    pago: [
      { label: 'On signature of the agreement for this phase', pct: 40 },
      { label: 'On delivery of the execution project',         pct: 60 },
    ],
  },
  direccion_obra: {
    label:           'Aesthetic Construction Management',
    semanas_default: 'Duration of works',
    texto: 'Aesthetic Construction Management covers the monitoring and control of the construction process from a design standpoint, ensuring that the execution adheres to the aesthetic and technical criteria defined in the project, with ongoing coordination with the contractor and the client.',
    entregables: [
      { grupo: 'Site monitoring',   items: ['Site visit reports', 'Photographic / video log', 'Programme monitoring', 'Finish and sample validation', 'Contractor coordination', 'Ongoing client advisory'] },
      { grupo: 'Handover control',  items: ['Snagging list (Checklist)', 'Practical completion report', 'Final execution validation', 'Attendance at handover'] },
    ],
    pago: [
      { label: 'Monthly during construction', pct: 100 },
    ],
  },
  interiorismo: {
    label:           'Interior Design Project',
    semanas_default: '4–6 weeks',
    texto: 'The Interior Design Project covers the comprehensive design of furniture and decoration for the spaces, from conceptualisation through to the selection and budgeting of all elements, including the development of the visual concept and the documentation required for decision-making.',
    entregables: [
      { grupo: 'Interior design project', items: ['Design concept (Moodboards and Collages per space)', 'Furniture and decoration selection proposal', 'Budget for selected items', 'Showroom visits'] },
      { grupo: '3D Design',               items: ['3D model with furniture', 'Photorealistic renders'] },
    ],
    pago: [
      { label: 'On signature of the agreement for this phase',    pct: 50 },
      { label: 'On delivery of the interior design project',      pct: 50 },
    ],
  },
  gestion_interiorismo: {
    label:           'Interior Design Management',
    semanas_default: 'According to works programme',
    texto: 'The Interior Design Management service covers the comprehensive coordination of the purchase, tracking, reception and installation of all selected furniture and decoration elements, ensuring that the final presentation of the space meets the criteria defined in the project.',
    entregables: [
      { grupo: 'Purchase management', items: ['Order coordination', 'Delivery tracking', 'Delivery reception'] },
      { grupo: 'Installation',        items: ['Installation coordination', 'Installation supervision', 'Final furniture validation', 'Final cleaning coordination'] },
    ],
    pago: [
      { label: 'On commencement of purchase management', pct: 30 },
      { label: 'On completion of installation',          pct: 70 },
    ],
  },
}

/**
 * Maps Spanish payment-milestone labels (as stored in contratos.honorarios)
 * to their English equivalents.
 */
export const PAGO_LABEL_EN: Record<string, string> = {
  'A la firma del contrato':                       'On signature of the agreement',
  'A la entrega del anteproyecto':                 'On delivery of the preliminary design',
  'A la firma del contrato de esta fase':          'On signature of the agreement for this phase',
  'A la entrega del proyecto ejecutivo':           'On delivery of the execution project',
  'Mensualmente durante la ejecución de la obra': 'Monthly during construction',
  'A la entrega del proyecto de interiorismo':     'On delivery of the interior design project',
  'Al inicio de las gestiones de compra':         'On commencement of purchase management',
  'A la finalización del montaje':                'On completion of installation',
}

/** Commercial hourly rates by seniority */
export const PRECIO_HORA: Record<string, number> = {
  junior: 60,
  semi:   100,
  senior: 100,
  lead:   150,
  socio:  150,
}

/**
 * Given raw inputs, compute all derived values for a propuesta.
 */
export function calcPropuesta(opts: {
  m2:            number
  costoM2:       number
  porcentajePem: number
  servicios:     ServicioId[]
  pctJunior:     number
  pctSenior:     number
  pctPartner:    number
  ratios: { label: string; servicio: ServicioId | null; ratio: number }[]
}) {
  const { m2, costoM2, porcentajePem, servicios, pctJunior, pctSenior, pctPartner, ratios } = opts

  const pem                = m2 * costoM2
  const honorariosPemBase  = pem * (porcentajePem / 100)
  const rateWeighted       = (pctJunior * PRECIO_HORA.junior + pctSenior * PRECIO_HORA.senior + pctPartner * PRECIO_HORA.socio) / 100

  const breakdown: Partial<Record<ServicioId, number>> = {}

  for (const sid of servicios) {
    const cfg = SERVICIOS_CONFIG[sid]
    if (cfg.tipo === 'pem') {
      breakdown[sid] = honorariosPemBase * cfg.pem_split
    } else {
      const relevantRatios = ratios.filter(r => r.servicio === sid)
      const horas = relevantRatios.reduce((sum, r) => sum + m2 * r.ratio, 0)
      breakdown[sid] = horas * rateWeighted
    }
  }

  const total = (Object.values(breakdown) as number[]).reduce((s, v) => s + v, 0)

  return { pem, honorariosPemBase, breakdown, total }
}

export function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

// ── Plantilla de propuestas ────────────────────────────────────────────────────
// Presentation data per service — editable in the UI, stored in DB.
// Calculation params (tipo, pem_split) stay in SERVICIOS_CONFIG.

export interface ServicioPlantillaData {
  label:           string
  texto:           string
  entregables:     { grupo: string; items: string[] }[]
  semanas_default: string
  pago:            { label: string; pct: number }[]
  notas?:          string
}

/**
 * Full service entry — base (from SERVICIOS_CONFIG + DB overrides)
 * or custom (DB-only, tipo='manual').
 */
export interface ServicioEntry extends ServicioPlantillaData {
  id:        string
  isCustom:  boolean
  tipo:      'pem' | 'ratio' | 'manual'
  pem_split: number
  // DB-stored EN translations (may be null if not yet translated)
  label_en?:           string | null
  texto_en?:           string | null
  entregables_en?:     { grupo: string; items: string[] }[] | null
  semanas_default_en?: string | null
  pago_en?:            { label: string; pct: number }[] | null
}

/**
 * Merge DB overrides over SERVICIOS_CONFIG defaults for a given base service.
 * Falls back to config values for any missing fields.
 */
export function getServicioPlantilla(
  sid: ServicioId,
  dbData: Partial<Record<string, ServicioPlantillaData>>
): ServicioPlantillaData {
  const db  = dbData[sid]
  const cfg = SERVICIOS_CONFIG[sid]
  return {
    label:           db?.label           ?? cfg.label,
    texto:           db?.texto           ?? cfg.texto,
    entregables:     db?.entregables     ?? (cfg.entregables as unknown as { grupo: string; items: string[] }[]),
    semanas_default: db?.semanas_default ?? cfg.semanas_default,
    pago:            db?.pago            ?? (cfg.pago as unknown as { label: string; pct: number }[]),
  }
}

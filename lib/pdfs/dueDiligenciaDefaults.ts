function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── PDF data ──────────────────────────────────────────────────────────────────

export interface DueDiligenciaPDFData {
  nombre_proyecto:        string
  superficie:             number
  tarifa_m2:              number
  fee_base:               number
  fecha:                  string
  ciudad:                 string
  cuestiones_especificas: string | null
  modo_honorarios:        'por_m2' | 'importe_fijo'
  importe_fijo:           number | null   // used when modo_honorarios = 'importe_fijo'
}

// ── Text sections interface ───────────────────────────────────────────────────

export interface DueDiligenciaTextSections {
  // 1. Objeto
  objeto_p1:              string
  objeto_p2:              string
  // 2. Alcance
  alcance_intro:          string
  alcance_21_bullets:     string   // newline-separated bullet lines
  alcance_22_intro:       string
  alcance_22_bullets:     string
  alcance_22_footer:      string
  alcance_23_bullets:     string
  alcance_24_bullets:     string
  // 3. Metodología
  metodologia_intro:      string
  metodologia_fase1:      string
  metodologia_fase2:      string
  metodologia_fase3:      string
  metodologia_fase4:      string
  // 4. Entregables
  entregables_intro:   string
  entregables_bullets: string   // newline-separated bullet lines
  entregables_nota:    string   // closing note paragraph (leave empty to omit)
  // 5. Documentación requerida
  documentacion_intro:    string
  documentacion_bullets:  string
  // 6. Exclusiones
  exclusiones_intro:      string
  exclusiones_bullets:    string
  // 7. Condiciones de acceso
  acceso_intro:           string
  acceso_bullets:         string
  // 8. Plazo
  plazo:                  string
  // 9. Honorarios — nota al pie de la tabla
  honorarios_nota:        string
  // 10. Ajuste de superficie (vacío = no aparece en el PDF)
  ajuste_p1:              string
  // 11. Condiciones de pago
  pago_intro:             string
  // 12. Validez
  validez:                string
  // 13. Aceptación
  aceptacion:             string
}

// ── Default sections computed from form data ──────────────────────────────────

export function getDefaultTextSections(data: DueDiligenciaPDFData): DueDiligenciaTextSections {
  const esFijo = data.modo_honorarios === 'importe_fijo'

  return {
    objeto_p1:
      `Por medio del presente documento, FORMA PRIMA presenta su propuesta de servicios profesionales para la realización de una Due Diligence Técnica No Invasiva sobre el activo residencial ubicado en ${data.nombre_proyecto}, ${data.ciudad}, con una superficie estimada de análisis de ${data.superficie} m².`,

    objeto_p2:
      `El objetivo del encargo es proporcionar al Cliente una evaluación técnica profesional del estado general aparente del inmueble, orientada a apoyar su proceso de adquisición y posterior estrategia de explotación, mediante la identificación de incidencias visibles, riesgos técnicos aparentes, necesidades de mantenimiento y previsión de CAPEX correctivo/preventivo.`,

    alcance_intro:
      `FORMA PRIMA desarrollará una inspección técnica no invasiva del activo, basada en observación visual y revisión técnica especializada de los elementos accesibles en la fecha de visita. El alcance comprenderá, de manera enunciativa y no limitativa:`,

    alcance_21_bullets:
      `· Evaluación visual del estado general de conservación del inmueble.\n· Identificación de patologías aparentes y defectos constructivos visibles.\n· Revisión del desgaste general de acabados y materiales.\n· Valoración del estado de elementos constructivos accesibles.`,

    alcance_22_intro: `Inspección visual de instalaciones MEP accesibles:`,

    alcance_22_bullets:
      `· Electricidad\n· Fontanería / saneamiento\n· Climatización / ventilación\n· ACS / producción térmica\n· Sistemas de protección contra incendios visibles (si aplican)`,

    alcance_22_footer:
      `Evaluación del estado aparente de cuartos técnicos e instalaciones accesibles.`,

    alcance_23_bullets:
      `· Evaluación del estado de mantenimiento general del activo.\n· Identificación de necesidades de mantenimiento correctivo y preventivo.\n· Identificación de incidencias que puedan afectar a la futura operación del activo.`,

    alcance_24_bullets:
      `· Estimación preliminar de CAPEX correctivo inmediato.\n· Estimación preliminar de CAPEX preventivo / de reposición a corto-medio plazo.\n· Priorización de intervenciones recomendadas.`,

    metodologia_intro:
      `La prestación de servicios se desarrollará conforme a la siguiente metodología:`,

    metodologia_fase1:
      `Análisis de la documentación técnica y legal facilitada por la propiedad / vendedor.`,

    metodologia_fase2:
      `Visita técnica al activo por parte del equipo multidisciplinar de FORMA PRIMA y técnicos especialistas colaboradores.`,

    metodologia_fase3:
      `Evaluación técnica interna de hallazgos y consolidación de conclusiones.`,

    metodologia_fase4:
      `Redacción y entrega de informe final ejecutivo.`,

    entregables_intro:
      `FORMA PRIMA entregará un Informe Ejecutivo Simplificado, que incluirá:`,

    entregables_bullets:
      `· Resumen ejecutivo con principales conclusiones y riesgos detectados.\n· Listado de incidencias relevantes (no exhaustivo) con apoyo fotográfico.\n· Valoración general del estado del activo (nivel alto, no por sistemas detallados).\n· Estimación orientativa de CAPEX correctivo (orden de magnitud, sin desglose detallado).\n· Relación de limitaciones de la inspección (zonas no visitadas, etc.).`,

    entregables_nota:
      `El presente informe tiene carácter ejecutivo y no exhaustivo, orientado a la identificación de riesgos técnicos aparentes y estimaciones preliminares de inversión.`,

    documentacion_intro:
      `Para el correcto desarrollo del encargo, el Cliente deberá gestionar la puesta a disposición de la siguiente documentación, en la medida en que exista:`,

    documentacion_bullets:
      `· Proyecto de ejecución / as-built.\n· Licencia de obras / licencia de primera ocupación / DR aplicables.\n· Libro del edificio.\n· Certificados de instalaciones / legalizaciones.\n· ITE / IEE / inspecciones reglamentarias (si aplican).`,

    exclusiones_intro:
      `La presente Due Diligence Técnica No Invasiva se limita estrictamente a una inspección visual, no destructiva y no intrusiva de los elementos accesibles del activo en la fecha de visita. En consecuencia, quedan expresamente excluidos:`,

    exclusiones_bullets:
      `· Catas, aperturas, desmontajes o inspecciones destructivas.\n· Ensayos estructurales o de laboratorio.\n· Pruebas de carga y de estanqueidad.\n· Inspecciones con medios especiales no previstos.\n· Mediciones instrumentales exhaustivas.\n· Levantamiento arquitectónico completo.\n· Auditorías de cumplimiento normativo exhaustivas.\n· Certificaciones de legalidad urbanística / registral.\n· Garantía de inexistencia de vicios ocultos.`,

    acceso_intro:
      `La presente propuesta se formula bajo el supuesto de acceso completo al activo y a todas sus áreas relevantes. En caso de no poder acceder a determinadas zonas, instalaciones o dependencias:`,

    acceso_bullets:
      `· Dichas limitaciones serán expresamente reflejadas en el informe final.\n· FORMA PRIMA no asumirá responsabilidad sobre elementos no inspeccionados.\n· No podrá garantizarse evaluación técnica sobre áreas inaccesibles.`,

    plazo:
      `FORMA PRIMA entregará el informe final en un plazo de 15 días naturales desde la fecha de visita técnica, siempre que se haya recibido previamente la documentación requerida y se haya completado la inspección sin incidencias.`,

    honorarios_nota:
      `* Honorarios netos. IVA no incluido. En caso de ser de aplicación, se añadirá el tipo impositivo vigente (21%).`,

    // Section 10 only appears when not empty; omitted in importe_fijo mode by default
    ajuste_p1: esFijo
      ? ``
      : `Los honorarios anteriores han sido calculados sobre la superficie estimada de ${data.superficie} m² facilitada a la fecha de emisión de esta propuesta. En caso de que la superficie finalmente accesible e inspeccionable difiera de la inicialmente informada, FORMA PRIMA podrá ajustar proporcionalmente el fee variable de inspección conforme a la tarifa unitaria pactada de ${fmtEur(data.tarifa_m2)}/m². El fee base de movilización, coordinación técnica y estructuración de informe permanecerá fijo en ${fmtEur(data.fee_base)} con independencia de la variación de superficie.`,

    pago_intro:
      `Los honorarios serán abonados conforme al siguiente esquema:`,

    validez:
      `La presente propuesta tendrá una validez de 15 días naturales desde su fecha de emisión.`,

    aceptacion:
      `La aceptación de la presente propuesta implicará la conformidad del Cliente con el alcance, limitaciones, honorarios y condiciones aquí descritas.`,
  }
}

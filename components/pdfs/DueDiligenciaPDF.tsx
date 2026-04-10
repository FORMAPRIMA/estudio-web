// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  headerBg: '#1A1A1A',
  brand:    '#D85A30',
  ink:      '#1A1A1A',
  soft:     '#3A3A3A',
  mid:      '#7A7A7A',
  meta:     '#AAAAAA',
  rule:     '#E6E4DF',
  light:    '#F8F7F4',
  white:    '#FFFFFF',
  hInk:     '#F0EDE8',
  hMid:     '#888580',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingTop: 0,          // header is flush to top edge on page 1
    paddingBottom: 64,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.ink,
    backgroundColor: C.white,
  },

  // Header
  headerBlock: {
    backgroundColor: C.headerBg,
    paddingTop: 22,
    paddingBottom: 0,
    paddingHorizontal: 56,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  logo: { width: 130, height: 'auto' },
  headerTitle: {
    color: C.hInk,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  headerSub: {
    color: C.hMid,
    fontSize: 7.5,
    marginTop: 3,
    textAlign: 'right',
  },
  headerAccent: {
    height: 2,
    backgroundColor: C.brand,
    marginTop: 14,
    opacity: 0.7,
  },

  // Meta bar
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  metaLabel:      { fontSize: 7, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  metaValue:      { fontSize: 9, color: C.ink,  fontFamily: 'Helvetica-Bold' },
  metaValueLight: { fontSize: 9, color: C.soft },

  // Body
  body: { paddingHorizontal: 56 },

  // Summary box
  summaryBox: {
    backgroundColor: C.light,
    padding: 10,
    marginTop: 14,
    marginBottom: 4,
    flexDirection: 'row',
  },
  summaryItemFirst: { flex: 1, paddingHorizontal: 12 },
  summaryItem:      { flex: 1, paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: C.rule },
  summaryLabel:     { fontSize: 7, color: C.meta, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  summaryValue:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.ink },
  summaryValueBrand:{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.brand },
  summarySubValue:  { fontSize: 7.5, color: C.mid, marginTop: 2 },

  // Section title
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.brand,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    marginBottom: 10,
  },

  // Subsection title
  subsectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginTop: 10,
    marginBottom: 4,
  },

  // Body text
  bodyText: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.6,
    marginBottom: 6,
  },

  // Bullet
  bullet: {
    fontSize: 8,
    color: C.soft,
    lineHeight: 1.55,
    paddingLeft: 12,
    marginBottom: 2,
  },

  // Honorarios table
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  tableLabel: { fontSize: 8.5, color: C.soft },
  tableValue: { fontSize: 8.5, color: C.soft },
  tableLabelBold: { fontSize: 8.5, color: C.soft, fontFamily: 'Helvetica-Bold' },
  tableValueBold: { fontSize: 8.5, color: C.ink,  fontFamily: 'Helvetica-Bold' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.headerBg,
    marginTop: 4,
  },
  totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.hInk },
  totalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.brand },

  // Special notes box
  alertBox: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
    backgroundColor: C.light,
    marginTop: 6,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  alertText: { fontSize: 8, color: C.soft, lineHeight: 1.55 },

  // Note (italic)
  noteText: {
    fontSize: 7.5,
    color: C.mid,
    lineHeight: 1.5,
    fontFamily: 'Helvetica-Oblique',
    marginTop: 6,
    marginBottom: 6,
  },

  // Signature line
  signatureRow: { flexDirection: 'row', marginTop: 32 },
  signatureCol:  { flex: 1 },
  signatureLine: { borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 8 },
  signatureLabel:{ fontSize: 7.5, color: C.mid },

  // Footer
  footer: {
    position: 'absolute', bottom: 24, left: 56, right: 56,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule,
    paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: C.meta },
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DueDiligenciaPDFData {
  nombre_proyecto:        string
  superficie:             number
  tarifa_m2:              number
  fee_base:               number   // fee fijo de movilización + coord técnica + estructuración
  fecha:                  string   // ISO date yyyy-mm-dd
  ciudad:                 string
  cuestiones_especificas: string | null
}

// ── PDF Component ─────────────────────────────────────────────────────────────

export function DueDiligenciaPDF({ data }: { data: DueDiligenciaPDFData }) {
  const honorariosVariable = data.superficie * data.tarifa_m2
  const honorarios         = honorariosVariable + data.fee_base
  const hito1              = honorarios / 2
  const hito2              = honorarios / 2

  return (
    <Document
      title={`Due Diligence Técnica — ${data.nombre_proyecto} · Forma Prima`}
      author="Forma Prima"
    >
      <Page size="A4" style={s.page}>

        {/* Spacer: página 2+ recibe margen superior; página 1 queda en 0 */}
        <View
          fixed
          render={({ pageNumber }) => (
            <View style={{ height: pageNumber > 1 ? 40 : 0 }} />
          )}
        />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.headerBlock}>
          <View style={s.headerInner}>
            <Image style={s.logo} src={LOGO_BLANCO} />
            <View>
              <Text style={s.headerTitle}>Due Diligence Técnica</Text>
              <Text style={s.headerSub}>Propuesta de servicios profesionales</Text>
              <Text style={s.headerSub}>Inspección no invasiva · Activo residencial</Text>
            </View>
          </View>
          <View style={s.headerAccent} />
        </View>

        {/* ── Meta bar ────────────────────────────────────────────────────── */}
        <View style={s.metaBar}>
          <View>
            <Text style={s.metaLabel}>Activo / Proyecto</Text>
            <Text style={s.metaValue}>{data.nombre_proyecto}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Superficie estimada</Text>
            <Text style={s.metaValue}>{data.superficie} m²</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Fecha de propuesta</Text>
            <Text style={s.metaValueLight}>{fmtDate(data.fecha)}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Lugar</Text>
            <Text style={s.metaValueLight}>{data.ciudad}</Text>
          </View>
        </View>

        {/* ── Summary box ─────────────────────────────────────────────────── */}
        <View style={s.body}>
          <View style={s.summaryBox}>
            <View style={s.summaryItemFirst}>
              <Text style={s.summaryLabel}>Tipo de encargo</Text>
              <Text style={[s.summaryValue, { fontSize: 9 }]}>Due Diligence Técnica</Text>
              <Text style={s.summarySubValue}>Inspección no invasiva</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Superficie análisis</Text>
              <Text style={s.summaryValue}>{data.superficie} m²</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Tarifa variable</Text>
              <Text style={s.summaryValue}>{fmtEur(data.tarifa_m2)}/m²</Text>
              <Text style={s.summarySubValue}>{fmtEur(honorariosVariable)}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Fee base moviliz.</Text>
              <Text style={s.summaryValue}>{fmtEur(data.fee_base)}</Text>
              <Text style={s.summarySubValue}>fijo</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Honorarios totales</Text>
              <Text style={s.summaryValueBrand}>{fmtEur(honorarios)}</Text>
              <Text style={s.summarySubValue}>+ IVA si aplica</Text>
            </View>
          </View>
        </View>

        {/* ── Body sections ───────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* 1. Objeto */}
          <Text style={s.sectionTitle}>1. Objeto de la propuesta</Text>
          <Text style={s.bodyText}>
            {`Por medio del presente documento, FORMA PRIMA presenta su propuesta de servicios profesionales para la realización de una Due Diligence Técnica No Invasiva sobre el activo residencial ubicado en ${data.nombre_proyecto}, ${data.ciudad}, con una superficie estimada de análisis de ${data.superficie} m².`}
          </Text>
          <Text style={s.bodyText}>
            El objetivo del encargo es proporcionar al Cliente una evaluación técnica profesional del estado general aparente del inmueble, orientada a apoyar su proceso de adquisición y posterior estrategia de explotación, mediante la identificación de incidencias visibles, riesgos técnicos aparentes, necesidades de mantenimiento y previsión de CAPEX correctivo/preventivo.
          </Text>
          {data.cuestiones_especificas ? (
            <View style={s.alertBox}>
              <Text style={s.alertTitle}>Cuestiones específicas del proyecto</Text>
              <Text style={s.alertText}>{data.cuestiones_especificas}</Text>
            </View>
          ) : null}

          {/* 2. Alcance */}
          <Text style={s.sectionTitle}>2. Alcance de los servicios</Text>
          <Text style={s.bodyText}>
            FORMA PRIMA desarrollará una inspección técnica no invasiva del activo, basada en observación visual y revisión técnica especializada de los elementos accesibles en la fecha de visita. El alcance comprenderá, de manera enunciativa y no limitativa:
          </Text>

          <Text style={s.subsectionTitle}>2.1 Revisión Técnica del Estado General del Activo</Text>
          <Text style={s.bullet}>· Evaluación visual del estado general de conservación del inmueble.</Text>
          <Text style={s.bullet}>· Identificación de patologías aparentes y defectos constructivos visibles.</Text>
          <Text style={s.bullet}>· Revisión del desgaste general de acabados y materiales.</Text>
          <Text style={s.bullet}>· Valoración del estado de elementos constructivos accesibles.</Text>

          <Text style={s.subsectionTitle}>2.2 Revisión Técnica de Instalaciones Visibles</Text>
          <Text style={s.bodyText}>Inspección visual de instalaciones MEP accesibles:</Text>
          <Text style={s.bullet}>· Electricidad</Text>
          <Text style={s.bullet}>· Fontanería / saneamiento</Text>
          <Text style={s.bullet}>· Climatización / ventilación</Text>
          <Text style={s.bullet}>· ACS / producción térmica</Text>
          <Text style={s.bullet}>· Sistemas de protección contra incendios visibles (si aplican)</Text>
          <Text style={[s.bodyText, { marginTop: 5 }]}>
            Evaluación del estado aparente de cuartos técnicos e instalaciones accesibles.
          </Text>

          <Text style={s.subsectionTitle}>2.3 Revisión de Mantenimiento / Operabilidad</Text>
          <Text style={s.bullet}>· Evaluación del estado de mantenimiento general del activo.</Text>
          <Text style={s.bullet}>· Identificación de necesidades de mantenimiento correctivo y preventivo.</Text>
          <Text style={s.bullet}>· Identificación de incidencias que puedan afectar a la futura operación del activo.</Text>

          <Text style={s.subsectionTitle}>2.4 Forecast de Inversión Técnica</Text>
          <Text style={s.bullet}>· Estimación preliminar de CAPEX correctivo inmediato.</Text>
          <Text style={s.bullet}>· Estimación preliminar de CAPEX preventivo / de reposición a corto-medio plazo.</Text>
          <Text style={s.bullet}>· Priorización de intervenciones recomendadas.</Text>

          {/* 3. Metodología */}
          <Text style={s.sectionTitle}>3. Metodología de trabajo</Text>
          <Text style={s.bodyText}>La prestación de servicios se desarrollará conforme a la siguiente metodología:</Text>
          <Text style={s.subsectionTitle}>Fase 1 – Revisión Documental Previa</Text>
          <Text style={s.bodyText}>Análisis de la documentación técnica y legal facilitada por la propiedad / vendedor.</Text>
          <Text style={s.subsectionTitle}>Fase 2 – Inspección Técnica Presencial</Text>
          <Text style={s.bodyText}>Visita técnica al activo por parte del equipo multidisciplinar de FORMA PRIMA y técnicos especialistas colaboradores.</Text>
          <Text style={s.subsectionTitle}>Fase 3 – Análisis y Consolidación Técnica</Text>
          <Text style={s.bodyText}>Evaluación técnica interna de hallazgos y consolidación de conclusiones.</Text>
          <Text style={s.subsectionTitle}>Fase 4 – Emisión de Informe Ejecutivo</Text>
          <Text style={s.bodyText}>Redacción y entrega de informe final ejecutivo.</Text>

          {/* 4. Entregables */}
          <Text style={s.sectionTitle}>4. Entregables</Text>
          <Text style={s.bodyText}>FORMA PRIMA entregará al Cliente un Informe Ejecutivo de Due Diligence Técnica No Invasiva, que incluirá como mínimo:</Text>

          <Text style={s.subsectionTitle}>4.1 Resumen Ejecutivo</Text>
          <Text style={s.bullet}>· Conclusiones generales del análisis.</Text>
          <Text style={s.bullet}>· Principales riesgos técnicos detectados.</Text>
          <Text style={s.bullet}>· Valoración global del estado del activo.</Text>

          <Text style={s.subsectionTitle}>4.2 Hallazgos Técnicos</Text>
          <Text style={s.bullet}>· Descripción de incidencias detectadas por disciplina.</Text>
          <Text style={s.bullet}>· Reportaje fotográfico comentado.</Text>
          <Text style={s.bullet}>· Clasificación de criticidad / prioridad.</Text>

          <Text style={s.subsectionTitle}>4.3 Evaluación de Estado de Conservación</Text>
          <Text style={s.bodyText}>Valoración cualitativa del estado de:</Text>
          <Text style={s.bullet}>· Envolvente / fachada / cubierta (si accesibles)</Text>
          <Text style={s.bullet}>· Elementos comunes</Text>
          <Text style={s.bullet}>· Unidades privativas inspeccionadas</Text>
          <Text style={s.bullet}>· Instalaciones visibles</Text>

          <Text style={s.subsectionTitle}>4.4 CAPEX Forecast</Text>
          <Text style={s.bullet}>· Estimación preliminar de inversiones correctivas inmediatas.</Text>
          <Text style={s.bullet}>· Estimación preliminar de inversiones preventivas / reposiciones futuras.</Text>

          <Text style={s.subsectionTitle}>4.5 Limitaciones de Inspección</Text>
          <Text style={s.bullet}>· Relación expresa de zonas no accesibles / no inspeccionadas.</Text>
          <Text style={s.bullet}>· Limitaciones metodológicas aplicables al análisis.</Text>

          {/* 5. Documentación */}
          <Text style={s.sectionTitle}>5. Documentación requerida</Text>
          <Text style={s.bodyText}>Para el correcto desarrollo del encargo, el Cliente deberá gestionar la puesta a disposición de la siguiente documentación, en la medida en que exista:</Text>
          <Text style={s.bullet}>· Proyecto de ejecución / as-built.</Text>
          <Text style={s.bullet}>· Licencia de obras / licencia de primera ocupación / DR aplicables.</Text>
          <Text style={s.bullet}>· Libro del edificio.</Text>
          <Text style={s.bullet}>· Certificados de instalaciones / legalizaciones.</Text>
          <Text style={s.bullet}>· ITE / IEE / inspecciones reglamentarias (si aplican).</Text>

          {/* 6. Exclusiones */}
          <Text style={s.sectionTitle}>6. Exclusiones y limitaciones del servicio</Text>
          <Text style={s.bodyText}>
            La presente Due Diligence Técnica No Invasiva se limita estrictamente a una inspección visual, no destructiva y no intrusiva de los elementos accesibles del activo en la fecha de visita. En consecuencia, quedan expresamente excluidos:
          </Text>
          <Text style={s.bullet}>· Catas, aperturas, desmontajes o inspecciones destructivas.</Text>
          <Text style={s.bullet}>· Ensayos estructurales o de laboratorio.</Text>
          <Text style={s.bullet}>· Pruebas de carga y de estanqueidad.</Text>
          <Text style={s.bullet}>· Inspecciones con medios especiales no previstos.</Text>
          <Text style={s.bullet}>· Mediciones instrumentales exhaustivas.</Text>
          <Text style={s.bullet}>· Levantamiento arquitectónico completo.</Text>
          <Text style={s.bullet}>· Auditorías de cumplimiento normativo exhaustivas.</Text>
          <Text style={s.bullet}>· Certificaciones de legalidad urbanística / registral.</Text>
          <Text style={s.bullet}>· Garantía de inexistencia de vicios ocultos.</Text>

          {/* 7. Condiciones de acceso */}
          <Text style={s.sectionTitle}>7. Condiciones de acceso</Text>
          <Text style={s.bodyText}>
            La presente propuesta se formula bajo el supuesto de acceso completo al activo y a todas sus áreas relevantes. En caso de no poder acceder a determinadas zonas, instalaciones o dependencias:
          </Text>
          <Text style={s.bullet}>· Dichas limitaciones serán expresamente reflejadas en el informe final.</Text>
          <Text style={s.bullet}>· FORMA PRIMA no asumirá responsabilidad sobre elementos no inspeccionados.</Text>
          <Text style={s.bullet}>· No podrá garantizarse evaluación técnica sobre áreas inaccesibles.</Text>

          {/* 8. Plazo */}
          <Text style={s.sectionTitle}>8. Plazo de entrega</Text>
          <Text style={s.bodyText}>
            FORMA PRIMA entregará el informe final en un plazo de 15 días naturales desde la fecha de visita técnica, siempre que se haya recibido previamente la documentación requerida y se haya completado la inspección sin incidencias.
          </Text>

          {/* 9. Honorarios */}
          <Text style={s.sectionTitle}>9. Honorarios profesionales</Text>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Superficie de inspección</Text>
            <Text style={s.tableValue}>{data.superficie} m²</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Fee variable — Inspección técnica ({fmtEur(data.tarifa_m2)}/m²)</Text>
            <Text style={s.tableValue}>{fmtEur(honorariosVariable)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Fee base — Movilización, Coordinación Técnica y Estructuración de Informe</Text>
            <Text style={s.tableValue}>{fmtEur(data.fee_base)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>HONORARIOS TOTALES</Text>
            <Text style={s.totalValue}>{fmtEur(honorarios)}</Text>
          </View>
          <Text style={s.noteText}>
            * Honorarios netos. IVA no incluido. En caso de ser de aplicación, se añadirá el tipo impositivo vigente (21%).
          </Text>

          {/* 10. Ajuste de superficie */}
          <Text style={s.sectionTitle}>10. Ajuste de superficie</Text>
          <Text style={s.bodyText}>
            {`Los honorarios anteriores han sido calculados sobre la superficie estimada de ${data.superficie} m² facilitada a la fecha de emisión de esta propuesta. En caso de que la superficie finalmente accesible e inspeccionable difiera de la inicialmente informada, FORMA PRIMA podrá ajustar proporcionalmente el fee variable de inspección conforme a la tarifa unitaria pactada de ${fmtEur(data.tarifa_m2)}/m². El fee base de movilización, coordinación técnica y estructuración de informe permanecerá fijo en ${fmtEur(data.fee_base)} con independencia de la variación de superficie.`}
          </Text>

          {/* 11. Condiciones de pago */}
          <Text style={s.sectionTitle}>11. Condiciones de pago</Text>
          <Text style={s.bodyText}>Los honorarios serán abonados conforme al siguiente esquema:</Text>
          <View style={[s.tableRow, { marginTop: 4 }]}>
            <Text style={s.tableLabelBold}>Hito 1 — Aceptación y firma de la propuesta</Text>
            <Text style={s.tableValueBold}>{`50%  ·  ${fmtEur(hito1)}`}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabelBold}>Hito 2 — Entrega del informe final</Text>
            <Text style={s.tableValueBold}>{`50%  ·  ${fmtEur(hito2)}`}</Text>
          </View>

          {/* 12. Validez */}
          <Text style={s.sectionTitle}>12. Validez de la propuesta</Text>
          <Text style={s.bodyText}>
            La presente propuesta tendrá una validez de 15 días naturales desde su fecha de emisión.
          </Text>

          {/* 13. Aceptación */}
          <Text style={s.sectionTitle}>13. Aceptación</Text>
          <Text style={s.bodyText}>
            La aceptación de la presente propuesta implicará la conformidad del Cliente con el alcance, limitaciones, honorarios y condiciones aquí descritas.
          </Text>

          {/* Firma */}
          <View style={s.signatureRow}>
            <View style={[s.signatureCol, { paddingRight: 24 }]}>
              <View style={s.signatureLine}>
                <Text style={s.signatureLabel}>Firma y fecha del Cliente</Text>
              </View>
            </View>
            <View style={[s.signatureCol, { paddingLeft: 24 }]}>
              <View style={s.signatureLine}>
                <Text style={s.signatureLabel}>Por FORMA PRIMA</Text>
              </View>
            </View>
          </View>

        </View>

        {/* ── Footer (fixed) ───────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {`GEINEX GROUP, S.L. · NIF B44873552 · contacto@formaprima.es · Due Diligence — ${data.nombre_proyecto}`}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  )
}

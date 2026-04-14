// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import type { DueDiligenciaPDFData, DueDiligenciaTextSections } from '@/lib/pdfs/dueDiligenciaDefaults'

// Re-export for API routes that import DueDiligenciaPDFData from this file
export type { DueDiligenciaPDFData }

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
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.ink,
    backgroundColor: C.white,
  },

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

  body: { paddingHorizontal: 56 },

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

  subsectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginTop: 10,
    marginBottom: 4,
  },

  bodyText: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.6,
    marginBottom: 6,
  },

  bullet: {
    fontSize: 8,
    color: C.soft,
    lineHeight: 1.55,
    paddingLeft: 12,
    marginBottom: 2,
  },

  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  tableLabel:     { fontSize: 8.5, color: C.soft },
  tableValue:     { fontSize: 8.5, color: C.soft },
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

  noteText: {
    fontSize: 7.5,
    color: C.mid,
    lineHeight: 1.5,
    fontFamily: 'Helvetica-Oblique',
    marginTop: 6,
    marginBottom: 6,
  },

  signatureRow: { flexDirection: 'row', marginTop: 32 },
  signatureCol:  { flex: 1 },
  signatureLine: { borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 8 },
  signatureLabel:{ fontSize: 7.5, color: C.mid },

  footer: {
    position: 'absolute', bottom: 24, left: 56, right: 56,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule,
    paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: C.meta },
})

// ── Bullet list helper ────────────────────────────────────────────────────────

function BulletList({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <View>
      {lines.map((line, i) => (
        <Text key={i} style={s.bullet}>{line.trim()}</Text>
      ))}
    </View>
  )
}

// ── PDF Component ─────────────────────────────────────────────────────────────

export function DueDiligenciaPDF({
  data,
  textSections: t,
}: {
  data:         DueDiligenciaPDFData
  textSections: DueDiligenciaTextSections
}) {
  const esFijo            = data.modo_honorarios === 'importe_fijo'
  const honorariosVariable = data.superficie * data.tarifa_m2
  const honorarios         = esFijo && data.importe_fijo != null
    ? data.importe_fijo
    : honorariosVariable + data.fee_base
  const hito1 = honorarios / 2
  const hito2 = honorarios / 2

  return (
    <Document
      title={`Due Diligence Técnica — ${data.nombre_proyecto} · Forma Prima`}
      author="Forma Prima"
    >
      <Page size="A4" style={s.page}>

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
          {esFijo ? (
            <View style={s.summaryBox}>
              <View style={s.summaryItemFirst}>
                <Text style={s.summaryLabel}>Superficie</Text>
                <Text style={s.summaryValue}>{data.superficie} m²</Text>
              </View>
              <View style={[s.summaryItem, { flex: 2 }]}>
                <Text style={s.summaryLabel}>Honorarios profesionales</Text>
                <Text style={s.summaryValueBrand}>{fmtEur(honorarios)}</Text>
                <Text style={s.summarySubValue}>+ IVA si aplica</Text>
              </View>
            </View>
          ) : (
            <View style={s.summaryBox}>
              <View style={s.summaryItemFirst}>
                <Text style={s.summaryLabel}>Superficie</Text>
                <Text style={s.summaryValue}>{data.superficie} m²</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Tarifa</Text>
                <Text style={s.summaryValue}>{fmtEur(data.tarifa_m2)}/m²</Text>
                <Text style={s.summarySubValue}>{fmtEur(honorariosVariable)}</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Fee base</Text>
                <Text style={s.summaryValue}>{fmtEur(data.fee_base)}</Text>
                <Text style={s.summarySubValue}>movilización</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Total</Text>
                <Text style={s.summaryValueBrand}>{fmtEur(honorarios)}</Text>
                <Text style={s.summarySubValue}>+ IVA si aplica</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Body sections ───────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* 1. Objeto */}
          <Text style={s.sectionTitle}>1. Objeto de la propuesta</Text>
          <Text style={s.bodyText}>{t.objeto_p1}</Text>
          <Text style={s.bodyText}>{t.objeto_p2}</Text>
          {data.cuestiones_especificas ? (
            <View style={s.alertBox}>
              <Text style={s.alertTitle}>Cuestiones específicas del proyecto</Text>
              <Text style={s.alertText}>{data.cuestiones_especificas}</Text>
            </View>
          ) : null}

          {/* 2. Alcance */}
          <Text style={s.sectionTitle}>2. Alcance de los servicios</Text>
          <Text style={s.bodyText}>{t.alcance_intro}</Text>

          <Text style={s.subsectionTitle}>2.1 Revisión Técnica del Estado General del Activo</Text>
          <BulletList text={t.alcance_21_bullets} />

          <Text style={s.subsectionTitle}>2.2 Revisión Técnica de Instalaciones Visibles</Text>
          <Text style={s.bodyText}>{t.alcance_22_intro}</Text>
          <BulletList text={t.alcance_22_bullets} />
          <Text style={[s.bodyText, { marginTop: 5 }]}>{t.alcance_22_footer}</Text>

          <Text style={s.subsectionTitle}>2.3 Revisión de Mantenimiento / Operabilidad</Text>
          <BulletList text={t.alcance_23_bullets} />

          <Text style={s.subsectionTitle}>2.4 Forecast de Inversión Técnica</Text>
          <BulletList text={t.alcance_24_bullets} />

          {/* 3. Metodología */}
          <Text style={s.sectionTitle}>3. Metodología de trabajo</Text>
          <Text style={s.bodyText}>{t.metodologia_intro}</Text>
          <Text style={s.subsectionTitle}>Fase 1 – Revisión Documental Previa</Text>
          <Text style={s.bodyText}>{t.metodologia_fase1}</Text>
          <Text style={s.subsectionTitle}>Fase 2 – Inspección Técnica Presencial</Text>
          <Text style={s.bodyText}>{t.metodologia_fase2}</Text>
          <Text style={s.subsectionTitle}>Fase 3 – Análisis y Consolidación Técnica</Text>
          <Text style={s.bodyText}>{t.metodologia_fase3}</Text>
          <Text style={s.subsectionTitle}>Fase 4 – Emisión de Informe Ejecutivo</Text>
          <Text style={s.bodyText}>{t.metodologia_fase4}</Text>

          {/* 4. Entregables */}
          <Text style={s.sectionTitle}>4. Entregables</Text>
          <Text style={s.bodyText}>{t.entregables_intro}</Text>
          <BulletList text={t.entregables_bullets} />
          {t.entregables_nota ? (
            <Text style={[s.bodyText, { marginTop: 8, fontFamily: 'Helvetica-Oblique' }]}>
              {t.entregables_nota}
            </Text>
          ) : null}

          {/* 5. Documentación */}
          <Text style={s.sectionTitle}>5. Documentación requerida</Text>
          <Text style={s.bodyText}>{t.documentacion_intro}</Text>
          <BulletList text={t.documentacion_bullets} />

          {/* 6. Exclusiones */}
          <Text style={s.sectionTitle}>6. Exclusiones y limitaciones del servicio</Text>
          <Text style={s.bodyText}>{t.exclusiones_intro}</Text>
          <BulletList text={t.exclusiones_bullets} />

          {/* 7. Condiciones de acceso */}
          <Text style={s.sectionTitle}>7. Condiciones de acceso</Text>
          <Text style={s.bodyText}>{t.acceso_intro}</Text>
          <BulletList text={t.acceso_bullets} />

          {/* 8. Plazo */}
          <Text style={s.sectionTitle}>8. Plazo de entrega</Text>
          <Text style={s.bodyText}>{t.plazo}</Text>

          {/* 9. Honorarios */}
          <Text style={s.sectionTitle}>9. Honorarios profesionales</Text>
          {esFijo ? (
            <>
              <View style={s.tableRow}>
                <Text style={s.tableLabel}>Honorarios profesionales (importe fijo)</Text>
                <Text style={s.tableValue}>{fmtEur(honorarios)}</Text>
              </View>
            </>
          ) : (
            <>
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
            </>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>HONORARIOS TOTALES</Text>
            <Text style={s.totalValue}>{fmtEur(honorarios)}</Text>
          </View>
          {t.honorarios_nota ? (
            <Text style={s.noteText}>{t.honorarios_nota}</Text>
          ) : null}

          {/* 10. Ajuste de superficie — only when text is provided */}
          {t.ajuste_p1 ? (
            <>
              <Text style={s.sectionTitle}>10. Ajuste de superficie</Text>
              <Text style={s.bodyText}>{t.ajuste_p1}</Text>
            </>
          ) : null}

          {/* 11. Condiciones de pago */}
          <Text style={s.sectionTitle}>11. Condiciones de pago</Text>
          <Text style={s.bodyText}>{t.pago_intro}</Text>
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
          <Text style={s.bodyText}>{t.validez}</Text>

          {/* 13. Aceptación */}
          <Text style={s.sectionTitle}>13. Aceptación</Text>
          <Text style={s.bodyText}>{t.aceptacion}</Text>

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

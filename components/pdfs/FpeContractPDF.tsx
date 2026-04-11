// Server-only — used inside API routes / server actions with @react-pdf/renderer
import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'

// ── Fixed studio data ─────────────────────────────────────────────────────────
const STUDIO = {
  razon_social:     'GEINEX GROUP, S.L.',
  nombre_comercial: 'FORMA PRIMA',
  nif:              'B44873552',
  domicilio:        'Calle Príncipe de Vergara 56, Piso 6 Pta 2, 28006 Madrid',
  email:            'contacto@formaprima.es',
  rep_nombre:       'Gabriela Estefanía Hidalgo Abad',
  rep_titulo:       'Directora de obra',
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:    '#1A1A1A',
  brand: '#D85A30',
  ink:   '#1A1A1A',
  soft:  '#3A3A3A',
  mid:   '#666666',
  meta:  '#AAAAAA',
  rule:  '#E6E4DF',
  light: '#F8F7F4',
  white: '#FFFFFF',
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: 56, paddingBottom: 72, paddingHorizontal: 0,
    fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white,
  },
  header: {
    backgroundColor: C.bg,
    paddingTop: 28, paddingBottom: 20, paddingHorizontal: 56,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: '#E0DDD7', fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'right' },
  headerSub:   { color: '#888580', fontSize: 7.5, marginTop: 3, textAlign: 'right' },
  headerBrand: { color: C.brand, fontSize: 10, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
  headerNote:  { color: '#888580', fontSize: 7, marginTop: 4 },
  body: { paddingHorizontal: 56, paddingTop: 28 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', color: C.meta,
    borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingBottom: 5, marginBottom: 10,
  },
  twoCol: { flexDirection: 'row', gap: 20 },
  card: { flex: 1, padding: 12, backgroundColor: C.light, borderRadius: 3 },
  cardLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  cardValue: { fontSize: 8.5, color: C.ink, lineHeight: 1.5 },
  cardValueBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  clauseTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 4 },
  clauseText:  { fontSize: 7.5, color: C.soft, lineHeight: 1.6, marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: C.bg, paddingVertical: 7, paddingHorizontal: 10,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: C.rule },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: C.rule, backgroundColor: C.light },
  thText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#AAAAAA', letterSpacing: 1, textTransform: 'uppercase' },
  tdText: { fontSize: 8, color: C.ink },
  tdRight: { fontSize: 8, color: C.ink, textAlign: 'right' },
  tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right' },
  unitHeader: { paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#F0EEE8', borderBottomWidth: 0.5, borderBottomColor: C.rule },
  unitHeaderText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, backgroundColor: C.bg, marginTop: 2 },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#E0DDD7', textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white, textAlign: 'right' },
  signaturePage: { paddingHorizontal: 56, paddingTop: 48 },
  signatureBox: { flex: 1, padding: 20, border: '0.5pt solid #E6E4DF', borderRadius: 3 },
  signatureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  signatureName:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 4 },
  signatureNote:  { fontSize: 7, color: C.meta, lineHeight: 1.5 },
  signatureAnchor: { fontSize: 5, color: '#FFFFFF' },
  signatureSpace: { height: 60, borderBottomWidth: 0.5, borderBottomColor: C.rule, marginBottom: 8 },
  pageNum: { position: 'absolute', bottom: 24, right: 56, fontSize: 7, color: C.meta },
  brand:   { color: C.brand },
})

const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FpeContractData {
  project:  { id: string; nombre: string; ciudad: string; direccion: string }
  partner:  { id: string; nombre: string; email: string }
  awarded_at: string
  line_items: {
    nombre: string; unidad: string; cantidad: number
    precio_unitario: number; total: number; unit_nombre: string
  }[]
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FpeContractPDF({ data }: { data: FpeContractData }) {
  // Group line items by unit
  const unitGroups: Map<string, typeof data.line_items> = new Map()
  for (const li of data.line_items) {
    if (!unitGroups.has(li.unit_nombre)) unitGroups.set(li.unit_nombre, [])
    unitGroups.get(li.unit_nombre)!.push(li)
  }

  const grandTotal = data.line_items.reduce((s, li) => s + li.total, 0)
  const date = fmtDate(data.awarded_at)

  return (
    <Document>
      {/* ── Page 1: Cover + parties + clauses ── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerBrand}>{STUDIO.nombre_comercial}</Text>
              <Text style={s.headerNote}>{STUDIO.razon_social} · NIF {STUDIO.nif}</Text>
            </View>
            <View>
              <Text style={s.headerTitle}>Contrato de Ejecución</Text>
              <Text style={s.headerSub}>FPE · {date}</Text>
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* Project */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Proyecto</Text>
            <View style={{ padding: 14, backgroundColor: C.light, borderRadius: 3, borderLeftWidth: 2.5, borderLeftColor: C.brand }}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 4 }}>{data.project.nombre}</Text>
              {!!data.project.ciudad && <Text style={{ fontSize: 8, color: C.mid }}>{data.project.ciudad}</Text>}
              {!!data.project.direccion && <Text style={{ fontSize: 8, color: C.mid }}>{data.project.direccion}</Text>}
            </View>
          </View>

          {/* Parties */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Partes contratantes</Text>
            <View style={s.twoCol}>
              <View style={s.card}>
                <Text style={s.cardLabel}>Contratante</Text>
                <Text style={s.cardValueBold}>{STUDIO.razon_social}</Text>
                <Text style={s.cardValue}>{STUDIO.nombre_comercial}</Text>
                <Text style={s.cardValue}>NIF: {STUDIO.nif}</Text>
                <Text style={s.cardValue}>{STUDIO.domicilio}</Text>
                <Text style={s.cardValue}>{STUDIO.email}</Text>
                <Text style={{ ...s.cardValue, marginTop: 6, fontSize: 7.5, color: C.mid }}>
                  Representada por: {STUDIO.rep_nombre}{'\n'}{STUDIO.rep_titulo}
                </Text>
              </View>
              <View style={s.card}>
                <Text style={s.cardLabel}>Contratista (Execution Partner)</Text>
                <Text style={s.cardValueBold}>{data.partner.nombre}</Text>
                <Text style={s.cardValue}>{data.partner.email}</Text>
              </View>
            </View>
          </View>

          {/* Legal clauses */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Condiciones generales</Text>

            <Text style={s.clauseTitle}>1. Objeto del contrato</Text>
            <Text style={s.clauseText}>
              El presente contrato tiene por objeto la ejecución de las unidades de obra especificadas en el Anexo de Alcance y Precios,
              correspondientes al proyecto indicado, según los documentos técnicos y planos facilitados por FORMA PRIMA.
            </Text>

            <Text style={s.clauseTitle}>2. Precio y forma de pago</Text>
            <Text style={s.clauseText}>
              El precio total de los trabajos asciende a {fmtEur(grandTotal)} (IVA no incluido), desglosado por unidades en el Anexo de Alcance.
              Las certificaciones se realizarán mensualmente sobre obra ejecutada y medida, siendo el plazo de pago de 30 días desde la certificación aceptada.
            </Text>

            <Text style={s.clauseTitle}>3. Plazo de ejecución</Text>
            <Text style={s.clauseText}>
              El Execution Partner se compromete a ejecutar los trabajos dentro de los plazos propuestos en su oferta técnica.
              Cualquier modificación del plazo deberá ser comunicada y aprobada por escrito por FORMA PRIMA con un mínimo de 72 horas de antelación.
            </Text>

            <Text style={s.clauseTitle}>4. Calidad y control</Text>
            <Text style={s.clauseText}>
              El Execution Partner garantiza la ejecución de los trabajos conforme a la normativa vigente, las especificaciones técnicas del proyecto
              y los estándares de calidad de FORMA PRIMA. FORMA PRIMA se reserva el derecho de inspección y aprobación en cualquier fase de los trabajos.
            </Text>

            <Text style={s.clauseTitle}>5. Responsabilidades</Text>
            <Text style={s.clauseText}>
              El Execution Partner es responsable de la seguridad laboral de su personal, de los daños a terceros derivados de su actividad,
              y del cumplimiento de todas las obligaciones fiscales y laborales que le correspondan. Deberá acreditar alta en el RETA o en la Seguridad Social
              antes del inicio de los trabajos.
            </Text>

            <Text style={s.clauseTitle}>6. Resolución de conflictos</Text>
            <Text style={s.clauseText}>
              Las partes se someten a los Juzgados y Tribunales de Madrid para cualquier controversia derivada del presente contrato,
              con renuncia expresa a cualquier otro fuero que pudiera corresponderles.
            </Text>
          </View>
        </View>

        <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ── Page 2: Scope + prices ── */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerBrand}>{STUDIO.nombre_comercial}</Text>
              <Text style={s.headerNote}>Contrato de Ejecución · {data.project.nombre}</Text>
            </View>
            <View>
              <Text style={s.headerTitle}>Anexo de Alcance y Precios</Text>
              <Text style={s.headerSub}>{date}</Text>
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={{ ...s.thText, flex: 3 }}>Partida</Text>
            <Text style={{ ...s.thText, width: 40, textAlign: 'right' }}>Ud.</Text>
            <Text style={{ ...s.thText, width: 50, textAlign: 'right' }}>Cant.</Text>
            <Text style={{ ...s.thText, width: 70, textAlign: 'right' }}>P/Ud (€)</Text>
            <Text style={{ ...s.thText, width: 70, textAlign: 'right' }}>Total (€)</Text>
          </View>

          {Array.from(unitGroups.entries()).map(([unitNombre, items], ui) => {
            const unitTotal = items.reduce((s, li) => s + li.total, 0)
            return (
              <View key={ui}>
                {/* Unit sub-header */}
                <View style={s.unitHeader}>
                  <Text style={s.unitHeaderText}>{unitNombre}</Text>
                </View>
                {/* Line items */}
                {items.map((li, idx) => (
                  <View key={idx} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={{ ...s.tdText, flex: 3, paddingLeft: 8 }}>{li.nombre}</Text>
                    <Text style={{ ...s.tdRight, width: 40, color: C.mid }}>{li.unidad}</Text>
                    <Text style={{ ...s.tdRight, width: 50 }}>{li.cantidad.toLocaleString('es-ES')}</Text>
                    <Text style={{ ...s.tdRight, width: 70 }}>{li.precio_unitario.toFixed(2)}</Text>
                    <Text style={{ ...s.tdBold, width: 70 }}>{li.total.toFixed(2)}</Text>
                  </View>
                ))}
                {/* Unit subtotal */}
                <View style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#F0EEE8' }}>
                  <Text style={{ flex: 3, paddingLeft: 8, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.mid }}>
                    Subtotal {unitNombre}
                  </Text>
                  <Text style={{ width: 40 }} />
                  <Text style={{ width: 50 }} />
                  <Text style={{ width: 70 }} />
                  <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', width: 70, textAlign: 'right', color: C.ink }}>
                    {fmtEur(unitTotal)}
                  </Text>
                </View>
              </View>
            )
          })}

          {/* Grand total */}
          <View style={s.totalRow}>
            <Text style={{ ...s.totalLabel, flex: 1 }}>Total general (sin IVA)</Text>
            <Text style={s.totalValue}>{fmtEur(grandTotal)}</Text>
          </View>
        </View>

        <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ── Page 3: Signatures ── */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <Text style={s.headerBrand}>{STUDIO.nombre_comercial}</Text>
            <Text style={s.headerTitle}>Firmas</Text>
          </View>
        </View>

        <View style={s.signaturePage}>
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 9, color: C.mid, lineHeight: 1.7 }}>
              En Madrid, a {date}, las partes firmantes manifiestan su conformidad con todas las cláusulas y condiciones
              recogidas en el presente contrato y en su Anexo de Alcance y Precios.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 24 }}>
            {/* Partner signature */}
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Execution Partner</Text>
              <Text style={s.signatureName}>{data.partner.nombre}</Text>
              <Text style={{ fontSize: 7.5, color: C.mid, marginBottom: 20 }}>{data.partner.email}</Text>
              <View style={s.signatureSpace} />
              <Text style={s.signatureNote}>Firma y fecha</Text>
              {/* DocuSign anchor — invisible white text */}
              <Text style={s.signatureAnchor}>«FP_FIRMA_CLIENTE»</Text>
            </View>

            {/* Studio signature */}
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Forma Prima</Text>
              <Text style={s.signatureName}>{STUDIO.rep_nombre}</Text>
              <Text style={{ fontSize: 7.5, color: C.mid, marginBottom: 20 }}>{STUDIO.rep_titulo}</Text>
              <View style={s.signatureSpace} />
              <Text style={s.signatureNote}>Firma y fecha</Text>
              {/* DocuSign anchor — invisible white text */}
              <Text style={s.signatureAnchor}>«FP_FIRMA_ESTUDIO»</Text>
            </View>
          </View>
        </View>

        <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

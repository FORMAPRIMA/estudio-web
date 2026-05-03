// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'

const LOGO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')
const LOGO_DARK = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  ink:    '#1A1A1A',
  soft:   '#444444',
  mid:    '#777777',
  meta:   '#AAAAAA',
  rule:   '#E6E4DF',
  light:  '#F8F7F4',
  cream:  '#F0EDE8',
  white:  '#FFFFFF',
  brand:  '#D85A30',
  green:  '#1D9E75',
  blue:   '#378ADD',
  dark2:  '#2A2A2A',
  dark3:  '#3A3A3A',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Page bases
  page: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white, paddingBottom: 50 },
  coverPage: { fontFamily: 'Helvetica', backgroundColor: C.ink },

  // Fixed page header
  pageHeader: {
    backgroundColor: C.ink, paddingHorizontal: 40, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pageHeaderLogo: { width: 52, height: 13 },
  pageHeaderTitle: { fontSize: 6.5, color: '#555' },

  // Fixed footer
  footer: {
    position: 'absolute', bottom: 16, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 5,
  },
  footerText: { fontSize: 6, color: C.meta },

  // Content area
  content: { paddingHorizontal: 40, paddingTop: 22 },

  // ── Cover ──────────────────────────────────────────────────────────────────
  coverInner: {
    paddingHorizontal: 52, paddingTop: 52, paddingBottom: 52,
    flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100%',
  },
  coverLogo: { width: 100, height: 24, marginBottom: 100 },
  coverEyebrow: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 },
  coverTitle: { fontSize: 34, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 10, letterSpacing: -0.5 },
  coverSubtitle: { fontSize: 14, color: '#666', marginBottom: 52 },
  coverRule: { borderTopWidth: 1, borderTopColor: '#2A2A2A', paddingTop: 16 },
  coverMetaRow: { flexDirection: 'row' },
  coverMetaItem: { marginRight: 36 },
  coverMetaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#444', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  coverMetaValue: { fontSize: 8, color: '#777' },

  // ── Section headers ────────────────────────────────────────────────────────
  sectionEyebrow: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 4 },
  sectionDesc: { fontSize: 8.5, color: C.mid, marginBottom: 18, lineHeight: 1.5 },
  rule: { borderTopWidth: 1, borderTopColor: C.rule, marginTop: 20, marginBottom: 20 },
  rule2: { borderTopWidth: 1.5, borderTopColor: C.ink, marginTop: 6, marginBottom: 18 },

  // ── Body text ──────────────────────────────────────────────────────────────
  body: { fontSize: 8.5, color: C.soft, lineHeight: 1.6, marginBottom: 10 },
  bodyBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink },
  lead: { fontSize: 10, color: C.soft, lineHeight: 1.6, marginBottom: 14 },

  // ── Step ──────────────────────────────────────────────────────────────────
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 1, flexShrink: 0,
  },
  stepBadgeNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  stepBody: { fontSize: 8, color: C.soft, lineHeight: 1.55 },

  // ── Info boxes ────────────────────────────────────────────────────────────
  infoBox: {
    backgroundColor: C.light, borderRadius: 4,
    borderLeftWidth: 3, borderLeftColor: C.brand,
    padding: 10, marginBottom: 12, marginTop: 4,
  },
  infoBoxTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  infoBoxBody: { fontSize: 8, color: C.soft, lineHeight: 1.5 },

  tipBox: {
    backgroundColor: '#ECFDF5', borderRadius: 4,
    borderLeftWidth: 3, borderLeftColor: C.green,
    padding: 10, marginBottom: 12, marginTop: 4,
  },
  tipBoxTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.green, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  tipBoxBody: { fontSize: 8, color: '#3A7A5A', lineHeight: 1.5 },

  // ── UI label (button/path names) ──────────────────────────────────────────
  uiLabel: {
    backgroundColor: C.dark2, borderRadius: 3,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  uiLabelText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white },

  // ── Flow diagram ──────────────────────────────────────────────────────────
  flowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  flowBox: {
    borderWidth: 1, borderColor: C.rule, borderRadius: 5,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.light,
    alignItems: 'center', minWidth: 72,
  },
  flowBoxActive: {
    borderWidth: 1, borderColor: C.brand, borderRadius: 5,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFF3EF',
    alignItems: 'center', minWidth: 72,
  },
  flowBoxDark: {
    borderWidth: 1, borderColor: C.dark2, borderRadius: 5,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.dark2,
    alignItems: 'center', minWidth: 72,
  },
  flowLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink },
  flowLabelDark: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white },
  flowLabelBrand: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.brand },
  flowSub: { fontSize: 6, color: C.meta, marginTop: 2 },
  flowSubBrand: { fontSize: 6, color: '#D8886A', marginTop: 2 },
  flowArrow: { fontSize: 12, color: C.meta, marginHorizontal: 6 },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row', backgroundColor: C.ink,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3,
    marginBottom: 0,
  },
  tableHeaderCell: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.white },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.rule,
  },
  tableRowAlt: {
    flexDirection: 'row', backgroundColor: C.light,
    paddingHorizontal: 10, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.rule,
  },
  tableCell: { fontSize: 7.5, color: C.soft },
  tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink },

  // ── Status pills ──────────────────────────────────────────────────────────
  pillRow: { flexDirection: 'row', marginBottom: 12 },
  pill: { borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  pillText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },

  // ── Two columns ───────────────────────────────────────────────────────────
  twoCol: { flexDirection: 'row', marginBottom: 14 },
  col: { flex: 1, paddingRight: 14 },
  colLast: { flex: 1 },

  // ── TOC ───────────────────────────────────────────────────────────────────
  tocItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.rule },
  tocNum: { width: 24, fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand },
  tocTitle: { flex: 1, fontSize: 8, color: C.ink },
  tocPage: { fontSize: 7, color: C.meta },
  tocSub: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingLeft: 24, borderBottomWidth: 1, borderBottomColor: '#F5F3EF' },
  tocSubTitle: { flex: 1, fontSize: 7.5, color: C.mid },
})

// ── Helper components ─────────────────────────────────────────────────────────

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepBadge}><Text style={s.stepBadgeNum}>{n}</Text></View>
      <View style={s.stepContent}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepBody}>{body}</Text>
      </View>
    </View>
  )
}

function InfoBox({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.infoBox}>
      <Text style={s.infoBoxTitle}>{title}</Text>
      <Text style={s.infoBoxBody}>{body}</Text>
    </View>
  )
}

function TipBox({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.tipBox}>
      <Text style={s.tipBoxTitle}>{title}</Text>
      <Text style={s.tipBoxBody}>{body}</Text>
    </View>
  )
}

function PageHeader({ chapter }: { chapter: string }) {
  return (
    <View style={s.pageHeader} fixed>
      <Image src={LOGO_DARK} style={s.pageHeaderLogo} />
      <Text style={s.pageHeaderTitle}>Manual · Memorias de Calidad · {chapter}</Text>
    </View>
  )
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>GEINEX GROUP, S.L. · Forma Prima · Uso interno — Confidencial</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────

export function MemoriaManualPDF() {
  return (
    <Document title="Manual de Usuario — Memorias de Calidad — Forma Prima">

      {/* ════════════════════════════════════════════════════════════
          PORTADA
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <Image src={LOGO} style={s.coverLogo} />
          <Text style={s.coverEyebrow}>Manual de Usuario</Text>
          <Text style={s.coverTitle}>Memorias de{'\n'}Calidad</Text>
          <Text style={s.coverSubtitle}>Plataforma interna · Forma Prima</Text>
          <View style={s.coverRule}>
            <View style={s.coverMetaRow}>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Versión</Text>
                <Text style={s.coverMetaValue}>1.0</Text>
              </View>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Destinatarios</Text>
                <Text style={s.coverMetaValue}>Equipo interno Forma Prima</Text>
              </View>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Clasificación</Text>
                <Text style={s.coverMetaValue}>Uso interno — Confidencial</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ════════════════════════════════════════════════════════════
          ÍNDICE + INTRODUCCIÓN
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Índice" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Contenido</Text>
          <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Índice</Text>

          {[
            { n: '01', title: 'Introducción y visión general', sub: null },
            { n: '02', title: 'El Warehouse — Base de productos', sub: 'Estructura · Campos · Gestión' },
            { n: '03', title: 'Inicializar una Memoria de Calidad', sub: 'Init desde Warehouse · Sincronizar' },
            { n: '04', title: 'Tab Anteproyecto — Selección de producto', sub: 'Estados · Confirmar · Descartar · Notas' },
            { n: '05', title: 'Tab Ejecutivo — Confirmación y medición', sub: 'Cantidad · Ubicaciones · Acabado · URL' },
            { n: '06', title: 'Tab Shopping List — Logística de compras', sub: 'Estados de compra · Vista por estancia' },
            { n: '07', title: 'Exportar a FP Execution', sub: 'Creación automática de proyecto FPE' },
            { n: '08', title: 'Documentos PDF', sub: 'Lookbook de Anteproyecto · Ficha Ejecutiva' },
            { n: '09', title: 'Roles y permisos', sub: null },
            { n: '10', title: 'Glosario de términos', sub: null },
          ].map((item, i) => (
            <View key={i}>
              <View style={s.tocItem}>
                <Text style={s.tocNum}>{item.n}</Text>
                <Text style={s.tocTitle}>{item.title}</Text>
              </View>
              {item.sub && (
                <View style={s.tocSub}>
                  <Text style={s.tocSubTitle}>{item.sub}</Text>
                </View>
              )}
            </View>
          ))}

          <View style={[s.rule, { marginTop: 24 }]} />

          <Text style={s.sectionEyebrow}>Introducción</Text>
          <Text style={[s.sectionTitle, { marginBottom: 8 }]}>¿Qué son las Memorias de Calidad?</Text>

          <Text style={s.lead}>
            Las Memorias de Calidad son el sistema centralizado de Forma Prima para definir, documentar y gestionar todas las decisiones de producto a lo largo del ciclo de vida de un proyecto de diseño de interiores.
          </Text>

          <Text style={s.body}>
            Desde la selección orientativa de materiales en Anteproyecto —"¿qué grifo queremos en este proyecto?"— hasta el seguimiento logístico de cada compra —"¿ha llegado ya a obra?"—, todo queda registrado en una sola plataforma, vinculada al proyecto y exportable a FP Execution para la fase de ejecución.
          </Text>

          <Text style={s.body}>
            El sistema elimina los archivos Excel dispersos, los emails con listados de materiales y la pérdida de información entre fases. Cada decisión queda trazada, con imagen, referencia, precio orientativo y estado actualizado.
          </Text>

          <InfoBox
            title="Principio fundamental"
            body="Una Memoria de Calidad no es un catálogo. Es un documento vivo que acompaña al proyecto desde la primera reunión de diseño hasta la última instalación en obra."
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          02 · VISIÓN GENERAL DEL FLUJO
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Visión general" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Visión general</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Flujo completo del sistema</Text>
          <Text style={[s.body, { marginBottom: 18 }]}>
            El sistema sigue una progresión natural de lo general a lo específico. Cada fase tiene una función concreta y solo avanza cuando el equipo lo decide explícitamente.
          </Text>

          {/* Flow diagram */}
          <View style={[s.flowRow, { marginBottom: 6, justifyContent: 'center' }]}>
            <View style={s.flowBoxDark}>
              <Text style={s.flowLabelDark}>Warehouse</Text>
              <Text style={[s.flowSub, { color: '#555' }]}>Catálogo base</Text>
            </View>
            <Text style={s.flowArrow}>→</Text>
            <View style={s.flowBox}>
              <Text style={s.flowLabel}>Init / Sync</Text>
              <Text style={s.flowSub}>Inicializar</Text>
            </View>
            <Text style={s.flowArrow}>→</Text>
            <View style={s.flowBoxActive}>
              <Text style={s.flowLabelBrand}>Anteproyecto</Text>
              <Text style={s.flowSubBrand}>Selección</Text>
            </View>
            <Text style={s.flowArrow}>→</Text>
            <View style={s.flowBox}>
              <Text style={s.flowLabel}>Ejecutivo</Text>
              <Text style={s.flowSub}>Medición</Text>
            </View>
            <Text style={s.flowArrow}>→</Text>
            <View style={s.flowBox}>
              <Text style={s.flowLabel}>Shopping</Text>
              <Text style={s.flowSub}>Compras</Text>
            </View>
          </View>
          <View style={[s.flowRow, { justifyContent: 'center', marginBottom: 20 }]}>
            <View style={{ width: 260 }} />
            <View style={{ alignItems: 'center', width: 80 }}>
              <Text style={{ fontSize: 8, color: C.meta }}>↓</Text>
              <View style={[s.flowBox, { borderColor: C.blue }]}>
                <Text style={[s.flowLabel, { color: C.blue }]}>FP Execution</Text>
                <Text style={[s.flowSub, { color: '#7AB8EE' }]}>Scope FPE</Text>
              </View>
            </View>
          </View>

          {/* Phase descriptions */}
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={[s.bodyBold, { marginBottom: 4 }]}>Warehouse</Text>
              <Text style={[s.body, { marginBottom: 12 }]}>
                Catálogo maestro de productos por nivel de calidad. Solo el equipo de gestión (Partner / Manager) lo edita. Es la fuente de verdad de todos los proyectos.
              </Text>
              <Text style={[s.bodyBold, { marginBottom: 4 }]}>Anteproyecto</Text>
              <Text style={[s.body, { marginBottom: 12 }]}>
                Fase de selección orientativa. El equipo revisa los productos propuestos para el nivel de calidad del proyecto y confirma, descarta o anota cada uno. Se genera el PDF Lookbook para presentación al cliente.
              </Text>
              <Text style={[s.bodyBold, { marginBottom: 4 }]}>Ejecutivo</Text>
              <Text style={s.body}>
                Fase de definición precisa. Se asignan cantidades, ubicaciones específicas en el proyecto (Salón, Hab. 1…), el acabado seleccionado y la URL de compra directa. Se genera la Ficha Ejecutiva en PDF.
              </Text>
            </View>
            <View style={s.colLast}>
              <Text style={[s.bodyBold, { marginBottom: 4 }]}>Shopping List</Text>
              <Text style={[s.body, { marginBottom: 12 }]}>
                Panel logístico de seguimiento de compras. Cada producto confirmado tiene un estado: Pendiente → Pedido → En tránsito → Recibido → Instalado. Vista por estancia o por estado.
              </Text>
              <Text style={[s.bodyBold, { marginBottom: 4 }]}>FP Execution</Text>
              <Text style={[s.body, { marginBottom: 12 }]}>
                Con un solo clic, los productos confirmados con sus cantidades se exportan como partidas del scope del proyecto en FP Execution. El sistema crea o vincula automáticamente el proyecto FPE.
              </Text>
              <TipBox
                title="Progresión natural"
                body="No es obligatorio completar todas las fases. Un proyecto puede quedarse en Anteproyecto indefinidamente y solo avanzar a Ejecutivo cuando el cliente confirme."
              />
            </View>
          </View>
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          03 · EL WAREHOUSE
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Warehouse" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 02</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>El Warehouse — Base de productos</Text>
          <Text style={[s.body, { marginBottom: 16 }]}>
            El Warehouse es la biblioteca centralizada de productos de Forma Prima. Contiene el catálogo de referencia para cada nivel de calidad. Cuando se inicializa la Memoria de un proyecto, el sistema copia los productos del Warehouse al proyecto, creando una instantánea independiente que puede personalizarse sin afectar al catálogo base.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 8 }]}>Acceso al Warehouse</Text>
          <Text style={[s.body, { marginBottom: 14 }]}>
            Menú lateral → Memorias de Calidad → Warehouse. Accesible para roles fp_partner, fp_manager y fp_team (solo lectura para fp_team).
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 8 }]}>Estructura: Capítulo → Unidad → Partida</Text>
          <Text style={[s.body, { marginBottom: 14 }]}>
            Los productos se organizan siguiendo la misma jerarquía que el Template de FP Execution. Cada producto pertenece a una Partida (ej. "Grifo monomando"), dentro de una Unidad (ej. "Baños"), dentro de un Capítulo (ej. "Sanitarios y fontanería").
          </Text>

          {/* Field table */}
          <Text style={[s.bodyBold, { marginBottom: 6 }]}>Campos principales de un producto en el Warehouse</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { flex: 1.2 }]}>Campo</Text>
            <Text style={[s.tableHeaderCell, { flex: 2 }]}>Descripción</Text>
            <Text style={[s.tableHeaderCell, { width: 60 }]}>Requerido</Text>
          </View>
          {[
            ['Nombre', 'Nombre técnico del producto (ej. "Grifo monomando empotrado")', 'Sí'],
            ['Nivel de calidad', 'Functional, Select o Masterpiece. Determina a qué proyectos aplica este producto.', 'Sí'],
            ['Marca / Modelo', 'Fabricante y referencia de modelo concreto', 'No'],
            ['Referencia', 'Código de referencia del fabricante o proveedor', 'No'],
            ['Descripción', 'Descripción técnica o notas de especificación', 'No'],
            ['Imagen principal', 'Foto del producto sobre fondo neutro (uso en ficha ejecutiva)', 'No'],
            ['Imagen lifestyle', 'Foto ambiental (uso en lookbook de anteproyecto)', 'No'],
            ['Precio de referencia', 'Precio orientativo (PVP o precio de tarifa)', 'No'],
            ['Proveedor preferente', 'Proveedor recomendado de la base de datos de Forma Prima', 'No'],
            ['Acabados', 'Lista de acabados disponibles (ej. Cromo, Negro mate, Oro…)', 'No'],
            ['Incluir en plantilla', 'Solo los productos marcados se añaden al inicializar una Memoria', 'Sí'],
          ].map((row, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCellBold, { flex: 1.2 }]}>{row[0]}</Text>
              <Text style={[s.tableCell, { flex: 2 }]}>{row[1]}</Text>
              <Text style={[s.tableCell, { width: 60 }]}>{row[2]}</Text>
            </View>
          ))}

          <InfoBox
            title="Presentación en FPE (campos adicionales)"
            body="Cada capítulo y unidad del Warehouse tiene campos de presentación: Etiqueta cliente, Descripción cliente e Imagen de portada. Estos campos son los que aparecen en el PDF Lookbook para el cliente. Si no se rellenan, se usa el nombre técnico."
          />

          <TipBox
            title="Buena práctica"
            body="Mantén el Warehouse actualizado con al menos una imagen lifestyle por producto. Es la diferencia entre un PDF de anteproyecto básico y uno que el cliente quiera guardar."
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          04 · INICIALIZAR LA MEMORIA
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Inicializar" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 03</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Inicializar una Memoria de Calidad</Text>
          <Text style={[s.body, { marginBottom: 16 }]}>
            Antes de inicializar una Memoria, el proyecto interno debe tener asignado un Nivel de Calidad. Sin este dato, el sistema no sabe qué productos del Warehouse corresponden al proyecto.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 10 }]}>Paso previo: asignar el nivel de calidad al proyecto</Text>
          <Step n={1} title="Ir a la ficha del proyecto interno"
            body="Menú lateral → Proyectos → [nombre del proyecto]. En el panel de información general, busca el campo Nivel de Calidad." />
          <Step n={2} title="Seleccionar Functional, Select o Masterpiece"
            body="Este valor determina qué productos del Warehouse se cargarán en la Memoria. Una vez asignado, el proyecto aparece automáticamente en la lista de Memorias de Calidad." />

          <View style={s.rule} />

          <Text style={[s.bodyBold, { marginBottom: 10 }]}>Inicializar la Memoria</Text>
          <Step n={3} title="Acceder a la Memoria del proyecto"
            body='Menú lateral → Memorias de Calidad → Proyectos → [nombre del proyecto]. Si la Memoria no está inicializada, verás el botón "Inicializar desde Warehouse".' />
          <Step n={4} title="Hacer clic en «Inicializar desde Warehouse»"
            body='El sistema copia todos los productos del Warehouse marcados como "Incluir en plantilla" para el nivel de calidad del proyecto. Esta operación solo puede realizarse una vez.' />
          <Step n={5} title="Confirmar el resultado"
            body="El sistema indica cuántos productos se han importado. A partir de este momento, la Memoria es independiente del Warehouse: los cambios en el catálogo no afectan al proyecto." />

          <InfoBox
            title="La Memoria es una instantánea"
            body="Al inicializar, se crea una copia local del catálogo. Si el Warehouse se actualiza después (nuevos productos, cambios de precio), los proyectos ya inicializados no se ven afectados. Usa «Sincronizar» para traer novedades de forma controlada."
          />

          <View style={s.rule} />

          <Text style={[s.bodyBold, { marginBottom: 10 }]}>Sincronizar con el Warehouse (añadir novedades)</Text>
          <Step n={6} title="Usar «Sincronizar con Warehouse»"
            body='En la parte superior del tab Anteproyecto, junto al contador de productos. Esta operación añade los productos nuevos del Warehouse que aún no estén en la Memoria. No modifica los ya existentes.' />

          <TipBox
            title="Cuándo sincronizar"
            body="Sincroniza cuando el equipo añada nuevos productos al Warehouse que sean relevantes para un proyecto ya iniciado. Por ejemplo, si se incorpora una nueva gama de pavimentos al catálogo Select y hay proyectos Select en curso."
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          05 · TAB ANTEPROYECTO
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Anteproyecto" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 04</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Tab Anteproyecto — Selección de producto</Text>
          <Text style={[s.body, { marginBottom: 16 }]}>
            El tab Anteproyecto es la fase de definición orientativa. Aquí el equipo revisa el catálogo de productos propuesto para el nivel de calidad del proyecto, valora cada opción y va consolidando las decisiones de diseño antes de la confirmación final.
          </Text>

          {/* Estado pills */}
          <Text style={[s.bodyBold, { marginBottom: 8 }]}>Los tres estados de un producto</Text>
          <View style={s.pillRow}>
            <View style={[s.pill, { backgroundColor: '#F5F4F0' }]}>
              <Text style={[s.pillText, { color: '#888' }]}>Orientativo</Text>
            </View>
            <View style={[s.pill, { backgroundColor: '#E8F7F2' }]}>
              <Text style={[s.pillText, { color: '#1D9E75' }]}>Confirmado</Text>
            </View>
            <View style={[s.pill, { backgroundColor: '#F5F4F0' }]}>
              <Text style={[s.pillText, { color: '#CCC' }]}>Descartado</Text>
            </View>
          </View>
          <View style={{ marginBottom: 14 }}>
            <Text style={[s.body, { marginBottom: 4 }]}>
              <Text style={s.bodyBold}>Orientativo</Text>{' '}es el estado inicial. El producto está en el catálogo del proyecto pero aún no se ha tomado ninguna decisión sobre él.
            </Text>
            <Text style={[s.body, { marginBottom: 4 }]}>
              <Text style={s.bodyBold}>Confirmado</Text>{' '}significa que el equipo ha decidido que este producto formará parte del proyecto. Pasa a estar disponible en el tab Ejecutivo.
            </Text>
            <Text style={s.body}>
              <Text style={s.bodyBold}>Descartado</Text>{' '}significa que este producto no aplica al proyecto. Se oculta de la vista por defecto pero puede recuperarse en cualquier momento.
            </Text>
          </View>

          <Text style={[s.bodyBold, { marginBottom: 8 }]}>Cómo trabajar en el Anteproyecto</Text>
          <Step n={1} title="Revisar productos por capítulo y unidad"
            body="Los productos aparecen organizados en la misma jerarquía que el Template de FP Execution: Capítulo → Unidad → Partida. Cada partida puede tener uno o varios productos propuestos." />
          <Step n={2} title="Confirmar un producto"
            body='Haz clic en "Confirmar" (botón verde) en la tarjeta del producto. El producto pasa a estado Confirmado y queda disponible para la fase Ejecutivo. Puedes desconfirmarlo después si cambias de opinión.' />
          <Step n={3} title="Descartar un producto"
            body='Haz clic en "× Descartar" si el producto definitivamente no aplica. El producto se oculta de la vista principal pero puede recuperarse usando el filtro "Descartados".' />
          <Step n={4} title="Añadir notas"
            body='Usa el botón "+ Nota" para añadir observaciones específicas del proyecto sobre ese producto: condicionantes técnicos, preferencias del cliente, alternativas a estudiar.' />

          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={[s.bodyBold, { marginBottom: 6 }]}>Filtrar por estado</Text>
              <Text style={s.body}>
                Usa las pestañas bajo la barra de contadores para filtrar: Todos / Orientativos / Confirmados / Descartados. Útil para revisar rápidamente el estado del proyecto.
              </Text>
            </View>
            <View style={s.colLast}>
              <Text style={[s.bodyBold, { marginBottom: 6 }]}>PDF Lookbook</Text>
              <Text style={s.body}>
                El botón "↓ PDF Lookbook" genera un documento editorial con todos los productos orientativos y confirmados (excepto descartados), con imágenes, agrupados por capítulo. Ideal para presentación al cliente.
              </Text>
            </View>
          </View>

          <TipBox
            title="Estrategia recomendada"
            body='En la primera reunión de diseño con el cliente, abre la Memoria en modo "Todos" y ve confirmando o descartando en tiempo real. El cliente ve las imágenes y opina sobre cada elección. Al terminar la reunión, el lookbook PDF ya está listo para enviar.'
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          06 · TAB EJECUTIVO
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Ejecutivo" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 05</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Tab Ejecutivo — Confirmación y medición</Text>
          <Text style={[s.body, { marginBottom: 16 }]}>
            El tab Ejecutivo muestra únicamente los productos en estado Confirmado. Aquí se añade toda la información de dimensionamiento necesaria para la ejecución: cuántas unidades, en qué estancias y con qué acabado concreto. Es el paso previo a la compra y a la integración con FP Execution.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 8 }]}>Campos de la fase Ejecutivo</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { flex: 1 }]}>Campo</Text>
            <Text style={[s.tableHeaderCell, { flex: 2 }]}>Qué hay que rellenar</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }]}>Ejemplo</Text>
          </View>
          {[
            ['Cantidad', 'Número de unidades necesarias en el proyecto. Acepta decimales para m², m.l., etc.', '3 / 12.5 m²'],
            ['Ubicaciones', 'Estancias donde se instala. Escribe separado por comas. Genera la vista de Shopping List.', 'Salón, Hab. 1, Terraza'],
            ['Acabado', 'Si el producto tiene acabados definidos, elige de la lista. Si no, escribe libremente.', 'Negro mate'],
            ['URL de compra', 'Enlace directo al producto en la web del proveedor o tienda. Opcional pero muy útil.', 'https://...'],
          ].map((row, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCellBold, { flex: 1 }]}>{row[0]}</Text>
              <Text style={[s.tableCell, { flex: 2 }]}>{row[1]}</Text>
              <Text style={[s.tableCell, { flex: 1 }]}>{row[2]}</Text>
            </View>
          ))}

          <InfoBox
            title="Auto-guardado"
            body='Todos los campos del Ejecutivo se guardan automáticamente cuando haces clic fuera del campo (evento "onBlur"). No hay botón de guardar explícito. El indicador "↑" aparece brevemente mientras se procesa el guardado.'
          />

          <Text style={[s.bodyBold, { marginBottom: 8, marginTop: 14 }]}>Barra de resumen y total de referencia</Text>
          <Text style={[s.body, { marginBottom: 14 }]}>
            En la parte superior del tab Ejecutivo hay una barra con el número de productos confirmados y el total de referencia acumulado (suma de precio × cantidad para todos los productos que tienen ambos datos). Este importe es orientativo — refleja los precios del Warehouse, no los precios de compra reales.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 6 }]}>Desconfirmar un producto</Text>
          <Text style={[s.body, { marginBottom: 14 }]}>
            El botón "Desconfirmar" al final de cada fila devuelve el producto al estado Orientativo en el tab Anteproyecto. Los datos de cantidad, ubicaciones y acabado que hayas rellenado no se pierden — si lo vuelves a confirmar, los recuperas.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 6 }]}>PDF Ficha Ejecutiva</Text>
          <Text style={s.body}>
            El botón "↓ PDF Ejecutivo" en la barra de resumen genera la ficha técnica completa: todos los productos confirmados organizados por capítulo y unidad, con thumbnail, referencia, cantidad, acabado, ubicaciones, precio unitario y total. Al final incluye el subtotal por capítulo y el total global de referencia.
          </Text>

          <TipBox
            title="Orden de trabajo recomendado"
            body="Completa primero las ubicaciones de todos los productos, luego las cantidades. Tener las ubicaciones al día te permite usar la vista de Shopping List por estancia para coordinar las entregas en obra."
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          07 · SHOPPING LIST
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="Shopping List" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 06</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Tab Shopping List — Logística de compras</Text>
          <Text style={[s.body, { marginBottom: 16 }]}>
            El tab Shopping List es el panel de control de la fase de compras. Muestra todos los productos confirmados con su estado de compra actual, permitiendo al equipo hacer seguimiento desde que se hace el pedido hasta que el producto está instalado en obra.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 8 }]}>Los cinco estados de compra</Text>

          {[
            { estado: 'Pendiente', color: '#888', bg: '#F5F4F0', desc: 'Estado inicial. El producto está confirmado pero aún no se ha iniciado el proceso de compra.' },
            { estado: 'Pedido', color: '#378ADD', bg: '#EBF5FF', desc: 'Se ha enviado el pedido al proveedor o tienda. En espera de confirmación de envío.' },
            { estado: 'En tránsito', color: '#D97706', bg: '#FFF8EB', desc: 'El pedido ha salido del almacén del proveedor y está en camino. Hay un plazo de entrega activo.' },
            { estado: 'Recibido', color: '#059669', bg: '#ECFDF5', desc: 'El producto ha llegado a obra o al almacén de Forma Prima. Pendiente de instalación.' },
            { estado: 'Instalado', color: '#1D9E75', bg: '#E8F7F2', desc: 'El producto está instalado y finalizado en obra. Estado terminal.' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={[s.pill, { backgroundColor: item.bg, marginRight: 10, marginTop: 1, minWidth: 65, alignItems: 'center' }]}>
                <Text style={[s.pillText, { color: item.color }]}>{item.estado}</Text>
              </View>
              <Text style={[s.body, { flex: 1, marginBottom: 0 }]}>{item.desc}</Text>
            </View>
          ))}

          <InfoBox
            title="Actualización del estado"
            body="El selector de estado en cada fila se actualiza instantáneamente. No hay pasos intermedios: selecciona el nuevo estado y el cambio se guarda en el momento. Cualquier miembro del equipo con acceso puede actualizar el estado."
          />

          <View style={[s.rule, { marginTop: 14 }]} />

          <Text style={[s.bodyBold, { marginBottom: 10 }]}>Dos vistas disponibles</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={[s.bodyBold, { marginBottom: 4, color: C.brand }]}>Vista: Por estancia</Text>
              <Text style={s.body}>
                Agrupa los productos por sus ubicaciones. Cada sección corresponde a una estancia del proyecto (Salón, Cocina, Baño 1…). Los productos sin ubicación asignada aparecen en "Sin ubicación".
              </Text>
              <Text style={[s.body, { marginTop: 4 }]}>
                Ideal para coordinar entregas: antes de la visita a obra del Lunes, puedes revisar qué debe estar listo para cada estancia.
              </Text>
            </View>
            <View style={s.colLast}>
              <Text style={[s.bodyBold, { marginBottom: 4, color: C.brand }]}>Vista: Por estado</Text>
              <Text style={s.body}>
                Agrupa los productos por su estado de compra. Cada sección muestra todos los productos en ese estado, independientemente de su ubicación.
              </Text>
              <Text style={[s.body, { marginTop: 4 }]}>
                Ideal para gestión de compras: ver de un vistazo cuántos productos están pendientes de pedir, cuántos en tránsito y cuántos ya instalados.
              </Text>
            </View>
          </View>

          <TipBox
            title="Flujo de trabajo con proveedores"
            body='Cuando hagas un pedido a un proveedor, filtra por "Por estancia" o "Por estado: Pendiente" y actualiza todos los productos de ese pedido a "Pedido" de una vez. La barra de contadores en la parte superior te muestra el progreso global al instante.'
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          08 · FP EXECUTION BRIDGE
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="FP Execution" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 07</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Exportar a FP Execution</Text>
          <Text style={[s.body, { marginBottom: 16 }]}>
            La integración con FP Execution permite trasladar automáticamente los productos confirmados de la Memoria al scope de licitación del proyecto FPE. De esta forma, las cantidades definidas por el equipo de diseño están disponibles de inmediato para el proceso de licitación con partners de ejecución.
          </Text>

          <Text style={[s.bodyBold, { marginBottom: 10 }]}>Cómo funciona la exportación</Text>
          <Step n={1} title="Desde el tab Ejecutivo, localizar el bloque «FP Execution»"
            body='Al pie del tab Ejecutivo hay un bloque con el botón "→ Exportar a FPE". Muestra el número de productos confirmados que se exportarán.' />
          <Step n={2} title="Hacer clic en «→ Exportar a FPE»"
            body='El sistema busca si ya existe un proyecto FPE vinculado a este proyecto interno. Si no existe, lo crea automáticamente con el mismo nombre. Si ya existe, actualiza las cantidades existentes.' />
          <Step n={3} title="Revisar el resultado"
            body='El sistema confirma cuántas partidas se han sincronizado y cuántas unidades de ejecución nuevas se han creado en FPE. Aparece el enlace directo al proyecto FPE.' />
          <Step n={4} title="Verificar en FP Execution"
            body='En el tab Scope del proyecto FPE, las unidades que contienen partidas provenientes de una Memoria aparecen marcadas con el badge "MEM" en naranja.' />

          <InfoBox
            title="Qué se exporta exactamente"
            body="Se exportan todos los productos con estado Confirmado y cantidad asignada. Para cada producto, el sistema: (1) identifica su Unidad de Ejecución en el Template FPE, (2) crea la Unidad en el proyecto FPE si no existe, y (3) registra la partida con la cantidad definida en el Ejecutivo, marcándola como origen Memoria."
          />

          <Text style={[s.bodyBold, { marginBottom: 6, marginTop: 14 }]}>Re-sincronizar</Text>
          <Text style={[s.body, { marginBottom: 14 }]}>
            Si después de la primera exportación confirmas nuevos productos o cambias cantidades, puedes pulsar "Re-sincronizar" para actualizar el proyecto FPE. Las partidas ya existentes se sobreescriben con las nuevas cantidades. Las partidas que hayas añadido manualmente en FPE y no provengan de la Memoria no se ven afectadas.
          </Text>

          <TipBox
            title="Integración en el flujo de licitación"
            body="La exportación ideal ocurre cuando el Ejecutivo está completo: todos los productos tienen cantidad y ubicación. En ese momento, el Project Scope de FPE tiene toda la información necesaria para lanzar el proceso de licitación con partners."
          />
        </View>
        <PageFooter />
      </Page>

      {/* ════════════════════════════════════════════════════════════
          09 · PDFs + ROLES + GLOSARIO
      ════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <PageHeader chapter="PDFs · Roles · Glosario" />
        <View style={s.content}>
          <Text style={s.sectionEyebrow}>Módulo 08</Text>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Documentos PDF generados</Text>

          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={[s.bodyBold, { marginBottom: 4, color: C.brand }]}>PDF Lookbook (Anteproyecto)</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>
                Documento editorial con diseño visual pensado para la presentación al cliente. Incluye portada, una sección por capítulo con su imagen de portada (si está configurada), y los productos en formato de tarjeta doble columna con imagen, marca, modelo y precio orientativo.
              </Text>
              <Text style={s.body}>
                Incluye: orientativos y confirmados. Excluye: descartados.
              </Text>
            </View>
            <View style={s.colLast}>
              <Text style={[s.bodyBold, { marginBottom: 4, color: C.brand }]}>PDF Ficha Ejecutiva</Text>
              <Text style={[s.body, { marginBottom: 6 }]}>
                Documento técnico de especificaciones con todos los productos confirmados en formato tabla. Muestra thumbnail, referencia, cantidad, acabado, ubicaciones, precio unitario y total. Subtotales por capítulo y total global.
              </Text>
              <Text style={s.body}>
                Incluye: solo confirmados con datos de Ejecutivo completos.
              </Text>
            </View>
          </View>

          <View style={s.rule} />

          <Text style={s.sectionEyebrow}>Módulo 09</Text>
          <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Roles y permisos</Text>

          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { flex: 1 }]}>Rol</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }]}>Warehouse</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }]}>Memorias</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }]}>FPE Bridge</Text>
          </View>
          {[
            ['fp_partner', 'Edición completa', 'Acceso completo', 'Completo'],
            ['fp_manager', 'Edición completa', 'Acceso completo', 'Completo'],
            ['fp_team', 'Solo lectura', 'Acceso completo', 'Completo'],
            ['fp_biz_dev', 'Sin acceso', 'Sin acceso', 'Sin acceso'],
          ].map((row, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCellBold, { flex: 1 }]}>{row[0]}</Text>
              <Text style={[s.tableCell, { flex: 1 }]}>{row[1]}</Text>
              <Text style={[s.tableCell, { flex: 1 }]}>{row[2]}</Text>
              <Text style={[s.tableCell, { flex: 1 }]}>{row[3]}</Text>
            </View>
          ))}

          <View style={s.rule} />

          <Text style={s.sectionEyebrow}>Módulo 10</Text>
          <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Glosario de términos</Text>

          {[
            ['Warehouse', 'Biblioteca central de productos de Forma Prima, organizada por nivel de calidad.'],
            ['Nivel de calidad', 'Clasificación del proyecto: Functional (estándar), Select (premium) o Masterpiece (alta gama).'],
            ['Memoria de Calidad', 'Copia del catálogo del Warehouse personalizada para un proyecto concreto.'],
            ['Instantánea', 'La Memoria es independiente del Warehouse una vez inicializada.'],
            ['Partida', 'Categoría de producto dentro de una Unidad (ej. "Grifo monomando empotrado").'],
            ['Unidad (FPE)', 'Agrupación de partidas dentro de un Capítulo (ej. "Baños").'],
            ['Capítulo (FPE)', 'Agrupación de alto nivel del scope de un proyecto (ej. "Sanitarios y fontanería").'],
            ['Estado de definición', 'Estado del producto en la fase Anteproyecto: Orientativo, Confirmado o Descartado.'],
            ['Estado de compra', 'Estado logístico de un producto: Pendiente, Pedido, En tránsito, Recibido, Instalado.'],
            ['FP Execution (FPE)', 'Módulo de licitación y gestión de partners de ejecución de Forma Prima.'],
            ['Badge MEM', 'Indicador naranja en el scope de FPE que señala partidas originadas en una Memoria de Calidad.'],
            ['Lookbook', 'PDF editorial del Anteproyecto para presentación al cliente con imágenes de producto.'],
          ].map((item, i) => (
            <View key={i} style={[s.tableRow, { borderBottomColor: i % 2 === 0 ? C.rule : '#F5F3EF', backgroundColor: i % 2 !== 0 ? C.light : C.white }]}>
              <Text style={[s.tableCellBold, { width: 110 }]}>{item[0]}</Text>
              <Text style={[s.tableCell, { flex: 1 }]}>{item[1]}</Text>
            </View>
          ))}
        </View>
        <PageFooter />
      </Page>

    </Document>
  )
}

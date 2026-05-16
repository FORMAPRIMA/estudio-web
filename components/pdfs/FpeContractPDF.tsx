// ══════════════════════════════════════════════════════════════════════════════
// FP Execution — Orden de Ejecución de Obra para Execution Partner
// Server-only: only imported from API routes / server actions.
// Replaces the previous placeholder FPE contract.
//
// Signature anchors preserved from the previous implementation for DocuSign
// backwards compatibility (see lib/docusign/client.ts):
//   «FP_FIRMA_ESTUDIO»  → bloque "POR FP EXECUTION"
//   «FP_FIRMA_CLIENTE»  → bloque "POR EL EXECUTION PARTNER"
// ══════════════════════════════════════════════════════════════════════════════

import path from 'path'
import { createElement } from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

// ── Logo ──────────────────────────────────────────────────────────────────────
const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Forma Prima legal entity ──────────────────────────────────────────────────
const STUDIO = {
  razon_social:     'GEINEX GROUP, S.L.',
  nombre_comercial: 'FP execution',
  brand_top:        'FORMA PRIMA',
  brand_sub:        'FP EXECUTION',
  nif:              'B44873552',
  domicilio:        'Calle Príncipe de Vergara 56, 6º 2ª, 28006 Madrid',
  email:            'contacto@formaprima.es',
  rep_nombre:       'Gabriela Estefanía Hidalgo Abad',
  rep_titulo:       'Directora de obra',
}

const DEFAULT_VAT_RATE     = 21    // %
const DEFAULT_PAYMENT_DAYS = 10    // días hábiles (regla universal FPE)
const DEFAULT_WARRANTY_M   = 12    // meses

// ── Trigger mapping (hitos de facturación) ────────────────────────────────────
const TRIGGER_LABEL: Record<string, string> = {
  contract_signed:    'A la firma',
  pre_project_start:  'Antes del inicio del proyecto',
  pre_start:          'Antes del inicio de los trabajos',
  milestone_achieved: 'Al alcanzar un hito de obra',
  delivery:           'A la entrega',
}

const TRIGGER_EVIDENCE: Record<string, string> = {
  contract_signed:    'Registro de firma electrónica de la presente Orden de Ejecución.',
  pre_project_start:  'Comunicación formal de arranque del proyecto por FP execution.',
  pre_start:          'Acta de replanteo, autorización de inicio o equivalente.',
  milestone_achieved: 'Acta de cumplimiento del hito, certificación de avance o validación de fase.',
  delivery:           'Acta de recepción parcial o total, sin reservas o con reservas subsanadas.',
}

const STATUS_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  facturado:  'Facturado',
  cobrado:    'Cobrado',
}

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface FpeContractLineItem {
  nombre:          string
  unidad:          string
  cantidad:        number
  precio_unitario: number
  total:           number
  unit_nombre:     string
}

export interface FpeContractChapter {
  chapter_nombre: string
  units: {
    unit_nombre: string
    total:       number
    days?:       number | null
    line_items: {
      nombre:          string
      unidad_medida:   string
      cantidad:        number
      precio_unitario: number
      total:           number
    }[]
  }[]
}

export interface FpeContractPaymentMilestoneInput {
  nombre:           string
  pct:              number
  monto:            number
  trigger_type:     string
  status?:          string | null
  required_evidence?: string | null
}

export interface FpeContractPhaseInput {
  fase:             string
  duracion_dias:    number
  fecha_inicio?:    string | null
  fecha_fin?:       string | null
  dependencias?:    string | null
  responsable?:     string | null
  estado?:          string | null
}

export interface FpeContractTechnicalDoc {
  nombre:        string
  tipo?:         string | null
  fecha?:        string | null
  version?:      string | null
  referencia?:   string | null
  observaciones?: string | null
}

export interface FpeContractFrameworkAgreement {
  reference?: string | null
  signed_at?: string | null
}

export interface FpeContractData {
  // Required (preserved from the previous shape so consumers do not break)
  project: {
    id:        string
    nombre:    string
    ciudad:    string
    direccion: string
    reference?: string | null
  }
  partner: {
    id:              string
    nombre:          string
    email:           string
    legal_name?:     string | null
    tax_id?:         string | null
    address?:        string | null
    contact_name?:   string | null
    contact_role?:   string | null
    phone?:          string | null
  }
  awarded_at: string
  line_items: FpeContractLineItem[]

  // Optional — preferred when available
  reference?:           string | null
  chapters?:            FpeContractChapter[]
  payment_milestones?:  FpeContractPaymentMilestoneInput[]
  schedule_phases?:     FpeContractPhaseInput[]
  technical_docs?:      FpeContractTechnicalDoc[]
  framework_agreement?: FpeContractFrameworkAgreement | null
  governing_discipline?: string | null
  total?:               number
  vat_rate?:            number
  warranty_months?:     number
  payment_days?:        number
  condiciones_particulares?: string | null
  status_label?:        string | null
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

const fmtEur = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)

const fmtDateLong = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

const fmtDateShort = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmtPct = (n: number): string => `${(Number.isFinite(n) ? n : 0).toFixed(2).replace(/\.?0+$/, '')}%`

function deriveReference(data: FpeContractData): string {
  if (data.reference) return data.reference
  const year = new Date(data.awarded_at || new Date().toISOString()).getFullYear()
  const partnerShort = (data.partner.id || '').replace(/-/g, '').slice(0, 6).toUpperCase() || 'EP'
  const projectShort = (data.project.id || '').replace(/-/g, '').slice(0, 6).toUpperCase() || 'PROY'
  return `FPE-OE-${year}-${projectShort}-${partnerShort}`
}

function deriveTotals(data: FpeContractData) {
  const subtotal = typeof data.total === 'number'
    ? data.total
    : data.line_items.reduce((s, li) => s + (li.total || 0), 0)
  const vatRate = typeof data.vat_rate === 'number' ? data.vat_rate : DEFAULT_VAT_RATE
  const vat     = Math.round(subtotal * vatRate) / 100
  const gross   = subtotal + vat
  return { subtotal, vatRate, vat, gross }
}

function deriveScheduleSummary(phases: FpeContractPhaseInput[] | undefined) {
  if (!phases || phases.length === 0) return { totalDays: 0, start: null as string | null, end: null as string | null }
  const totalDays = phases.reduce((s, p) => s + (p.duracion_dias || 0), 0)
  const starts = phases.map(p => p.fecha_inicio).filter(Boolean) as string[]
  const ends   = phases.map(p => p.fecha_fin).filter(Boolean) as string[]
  const start = starts.length > 0 ? starts.sort()[0] : null
  const end   = ends.length   > 0 ? ends.sort().reverse()[0] : null
  return { totalDays, start, end }
}

// ══════════════════════════════════════════════════════════════════════════════
// Palette + Styles
// ══════════════════════════════════════════════════════════════════════════════

const C = {
  headerBg: '#1A1A1A',
  brand:    '#D85A30',
  ink:      '#1A1A1A',
  soft:     '#3A3A3A',
  mid:      '#7A7A7A',
  meta:     '#AAAAAA',
  rule:     '#E6E4DF',
  light:    '#F8F7F4',
  lighter:  '#FBFAF7',
  white:    '#FFFFFF',
  hInk:     '#F0EDE8',
  hMid:     '#888580',
  warn:     '#B45309',
}

const s = StyleSheet.create({
  // ── Page ────────────────────────────────────────────────────────────────────
  page: {
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.ink,
    backgroundColor: C.white,
  },

  // ── Cover header (large) ────────────────────────────────────────────────────
  coverHeader: {
    backgroundColor: C.headerBg,
    paddingTop: 36,
    paddingBottom: 0,
    paddingHorizontal: 56,
  },
  coverHeaderInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  coverLogo: { width: 130, height: 'auto' },
  coverTitle: {
    color: C.hInk,
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  coverSubtitle: {
    color: C.brand,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'right',
    marginTop: 6,
  },
  coverRef: {
    color: C.hMid,
    fontSize: 8,
    marginTop: 8,
    textAlign: 'right',
  },
  coverAccent: { height: 2, backgroundColor: C.brand, opacity: 0.85 },

  // ── Compact header (subsequent pages) ───────────────────────────────────────
  compactHeader: {
    backgroundColor: C.headerBg,
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLogo: { width: 88, height: 'auto' },
  compactRight: { flexDirection: 'column', alignItems: 'flex-end' },
  compactTitle: {
    color: C.hInk, fontSize: 8.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  compactSub: { color: C.hMid, fontSize: 7, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  compactAccent: { height: 1.5, backgroundColor: C.brand, opacity: 0.85 },

  // ── Meta strip ──────────────────────────────────────────────────────────────
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  metaCol: { flexDirection: 'column' },
  metaLabel: { fontSize: 6.5, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  metaValue: { fontSize: 9, color: C.ink, fontFamily: 'Helvetica-Bold' },
  metaValueLight: { fontSize: 8.5, color: C.soft, marginTop: 1 },

  // ── Body ────────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 56, paddingTop: 18 },

  // ── Section titles ──────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.brand,
    paddingTop: 18,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    marginBottom: 12,
  },

  // ── Cards (partes) ──────────────────────────────────────────────────────────
  partiesRow: { flexDirection: 'row', gap: 12 },
  partyCard: {
    flex: 1,
    padding: 12,
    backgroundColor: C.light,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
  },
  partyLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  partyName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 4 },
  partyText: { fontSize: 8, color: C.soft, lineHeight: 1.5 },
  partyMuted: { fontSize: 7.5, color: C.mid, marginTop: 4, lineHeight: 1.5 },

  // ── Executive summary grid ─────────────────────────────────────────────────
  summaryGrid: {
    backgroundColor: C.light,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  summaryRow: { flexDirection: 'row' },
  summaryCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: C.rule,
  },
  summaryCellFirst: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 6.5, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  summaryValue: { fontSize: 9, color: C.ink, fontFamily: 'Helvetica-Bold' },
  summaryValueSm: { fontSize: 8, color: C.soft },

  // Big total band in cover
  totalBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.headerBg,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  totalBandLabel: { color: C.hInk, fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
  totalBandValue: { color: C.brand, fontSize: 14, fontFamily: 'Helvetica-Bold' },

  // ── Clauses ─────────────────────────────────────────────────────────────────
  clauseBlock: { marginBottom: 11 },
  clauseNumber: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  clauseTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginBottom: 4,
  },
  clauseText: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.55,
    marginBottom: 4,
  },
  clauseListItem: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.55,
    marginLeft: 14,
    marginBottom: 2,
  },

  // ── Anexo intro / closing paragraphs ────────────────────────────────────────
  anexoIntro: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.55,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
    backgroundColor: C.light,
    marginBottom: 12,
  },
  anexoClose: {
    fontSize: 7.5,
    color: C.mid,
    lineHeight: 1.55,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.rule,
    fontFamily: 'Helvetica-Oblique',
  },

  // ── Tables ─────────────────────────────────────────────────────────────────
  tHead: {
    flexDirection: 'row',
    backgroundColor: C.headerBg,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#C8C5BF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  tRowAlt: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
    backgroundColor: C.lighter,
  },
  td: { fontSize: 8, color: C.ink },
  tdMid: { fontSize: 8, color: C.soft },
  tdRight: { fontSize: 8, color: C.ink, textAlign: 'right' },
  tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right' },

  chapterRow: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: '#EDEAE3',
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  chapterRowText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unitRow: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: C.light,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  unitRowText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.soft,
  },
  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#F0EEE8',
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  subtotalLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.mid, flex: 1 },
  subtotalValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right' },

  // Final totals block (Anexo I)
  totalsBlock: { marginTop: 12 },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  totalLineLabel: { fontSize: 8.5, color: C.soft },
  totalLineValue: { fontSize: 8.5, color: C.ink, fontFamily: 'Helvetica-Bold' },
  totalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.headerBg,
    marginTop: 6,
  },
  totalFinalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.hInk, letterSpacing: 1, textTransform: 'uppercase' },
  totalFinalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.brand },

  // ── Signatures ─────────────────────────────────────────────────────────────
  signatureIntro: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.6,
    marginBottom: 22,
  },
  signaturesRow: { flexDirection: 'row', gap: 18 },
  signatureBox: {
    flex: 1,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.rule,
  },
  signatureLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  signatureName:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 2 },
  signatureRole:  { fontSize: 8, color: C.mid, marginBottom: 18 },
  signatureSpace: { height: 56, borderBottomWidth: 0.5, borderBottomColor: C.rule, marginBottom: 6 },
  signatureNote:  { fontSize: 7, color: C.meta },
  signatureAnchor:{ fontSize: 1, color: C.white },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24, left: 56, right: 56,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderTopWidth: 0.5, borderTopColor: C.rule,
    paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: C.meta, letterSpacing: 0.4 },
  footerRight: { fontSize: 6.5, color: C.meta },
})

// ══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════════

function CompactHeader({ reference, projectName }: { reference: string; projectName: string }) {
  return createElement(View, { fixed: true },
    createElement(View, { style: s.compactHeader },
      createElement(Image, { src: LOGO_BLANCO, style: s.compactLogo }),
      createElement(View, { style: s.compactRight },
        createElement(Text, { style: s.compactTitle }, 'Orden de Ejecución de Obra'),
        createElement(Text, { style: s.compactSub }, `${reference} · ${projectName}`),
      ),
    ),
    createElement(View, { style: s.compactAccent }),
  )
}

function Footer({ reference }: { reference: string }) {
  return createElement(View, { style: s.footer, fixed: true },
    createElement(Text, { style: s.footerText },
      `${STUDIO.razon_social} · NIF ${STUDIO.nif} · ${STUDIO.email}`
    ),
    createElement(Text, {
      style: s.footerRight,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `${reference} · ${pageNumber} / ${totalPages}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
  )
}

function SectionTitle({ children }: { children?: string }) {
  return createElement(Text, { style: s.sectionTitle }, children)
}

function Clause({ number, title, children }: {
  number: string; title: string; children?: React.ReactNode
}) {
  return createElement(View, { style: s.clauseBlock, wrap: false },
    createElement(Text, { style: s.clauseNumber }, number),
    createElement(Text, { style: s.clauseTitle }, title),
    children,
  )
}

function P({ children }: { children?: string }) {
  return createElement(Text, { style: s.clauseText }, children)
}

function LI({ children }: { children?: string }) {
  return createElement(Text, { style: s.clauseListItem }, `•  ${children ?? ''}`)
}

// ══════════════════════════════════════════════════════════════════════════════
// Sections
// ══════════════════════════════════════════════════════════════════════════════

function CoverPage(props: { data: FpeContractData; reference: string }) {
  const { data, reference } = props
  const totals       = deriveTotals(data)
  const sched        = deriveScheduleSummary(data.schedule_phases)
  const chaptersList = (data.chapters?.map(c => c.chapter_nombre) ?? [])
    .filter((v, i, arr) => arr.indexOf(v) === i)
  const chaptersText = chaptersList.length > 0 ? chaptersList.join(' · ') : '—'

  const partnerLegalName = data.partner.legal_name || data.partner.nombre
  const partnerHasFiscal = Boolean(data.partner.tax_id || data.partner.address)

  return createElement(Page, { size: 'A4', style: s.page },

    // ── Cover header ──────────────────────────────────────────────────────────
    createElement(View, { style: s.coverHeader },
      createElement(View, { style: s.coverHeaderInner },
        createElement(Image, { src: LOGO_BLANCO, style: s.coverLogo }),
        createElement(View, null,
          createElement(Text, { style: s.coverTitle }, 'Orden de Ejecución de Obra'),
          createElement(Text, { style: s.coverSubtitle }, 'Execution Partner'),
          createElement(Text, { style: s.coverRef }, reference),
          createElement(Text, { style: s.coverRef }, fmtDateLong(data.awarded_at)),
        ),
      ),
    ),
    createElement(View, { style: s.coverAccent }),

    // ── Meta strip ────────────────────────────────────────────────────────────
    createElement(View, { style: s.metaBar },
      createElement(View, { style: s.metaCol },
        createElement(Text, { style: s.metaLabel }, 'Proyecto'),
        createElement(Text, { style: s.metaValue }, data.project.nombre || '—'),
        data.project.direccion ? createElement(Text, { style: s.metaValueLight }, data.project.direccion) : null,
        data.project.ciudad    ? createElement(Text, { style: s.metaValueLight }, data.project.ciudad)    : null,
      ),
      createElement(View, { style: { ...s.metaCol, alignItems: 'flex-end' } },
        createElement(Text, { style: s.metaLabel }, 'Execution Partner'),
        createElement(Text, { style: s.metaValue }, partnerLegalName),
        data.partner.email   ? createElement(Text, { style: s.metaValueLight }, data.partner.email) : null,
        data.status_label    ? createElement(Text, { style: { ...s.metaValueLight, color: C.warn } }, data.status_label) : null,
      ),
    ),

    // ── Body ──────────────────────────────────────────────────────────────────
    createElement(View, { style: s.body },

      // Partes
      createElement(SectionTitle, null, 'Partes'),
      createElement(View, { style: s.partiesRow },
        // FP execution
        createElement(View, { style: s.partyCard },
          createElement(Text, { style: s.partyLabel }, 'Por FP execution'),
          createElement(Text, { style: s.partyName }, `${STUDIO.razon_social}`),
          createElement(Text, { style: s.partyText }, `Marca comercial: ${STUDIO.nombre_comercial}`),
          createElement(Text, { style: s.partyText }, `NIF: ${STUDIO.nif}`),
          createElement(Text, { style: s.partyText }, STUDIO.domicilio),
          createElement(Text, { style: s.partyText }, STUDIO.email),
          createElement(Text, { style: s.partyMuted },
            `Representada por: ${STUDIO.rep_nombre}\n${STUDIO.rep_titulo}`),
        ),
        // Execution Partner
        createElement(View, { style: s.partyCard },
          createElement(Text, { style: s.partyLabel }, 'Por el Execution Partner'),
          createElement(Text, { style: s.partyName }, partnerLegalName),
          data.partner.tax_id   ? createElement(Text, { style: s.partyText }, `NIF/CIF: ${data.partner.tax_id}`) : null,
          data.partner.address  ? createElement(Text, { style: s.partyText }, data.partner.address) : null,
          data.partner.email    ? createElement(Text, { style: s.partyText }, data.partner.email)   : null,
          data.partner.phone    ? createElement(Text, { style: s.partyText }, `Tel. ${data.partner.phone}`) : null,
          data.partner.contact_name
            ? createElement(Text, { style: s.partyMuted },
                `Representado por: ${data.partner.contact_name}${data.partner.contact_role ? `\n${data.partner.contact_role}` : ''}`)
            : null,
          !partnerHasFiscal
            ? createElement(Text, { style: { ...s.partyMuted, color: C.warn } },
                'Datos fiscales del Execution Partner por completar antes de la firma.')
            : null,
        ),
      ),

      // Resumen Ejecutivo
      createElement(SectionTitle, null, 'Resumen Ejecutivo'),
      createElement(View, { style: s.summaryGrid },
        createElement(View, { style: s.summaryRow },
          createElement(View, { style: s.summaryCellFirst },
            createElement(Text, { style: s.summaryLabel }, 'Capítulos adjudicados'),
            createElement(Text, { style: { ...s.summaryValueSm, fontFamily: 'Helvetica-Bold', color: C.ink } }, chaptersText),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, 'Disciplina rectora'),
            createElement(Text, { style: s.summaryValueSm }, data.governing_discipline || '—'),
          ),
        ),
        createElement(View, { style: { ...s.summaryRow, marginTop: 4 } },
          createElement(View, { style: s.summaryCellFirst },
            createElement(Text, { style: s.summaryLabel }, 'Importe sin IVA'),
            createElement(Text, { style: s.summaryValue }, fmtEur(totals.subtotal)),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, `IVA (${totals.vatRate}%)`),
            createElement(Text, { style: s.summaryValue }, fmtEur(totals.vat)),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, 'Total con IVA'),
            createElement(Text, { style: { ...s.summaryValue, color: C.brand } }, fmtEur(totals.gross)),
          ),
        ),
        createElement(View, { style: { ...s.summaryRow, marginTop: 4 } },
          createElement(View, { style: s.summaryCellFirst },
            createElement(Text, { style: s.summaryLabel }, 'Inicio previsto'),
            createElement(Text, { style: s.summaryValueSm }, sched.start ? fmtDateShort(sched.start) : 'Por determinar'),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, 'Fin previsto'),
            createElement(Text, { style: s.summaryValueSm }, sched.end ? fmtDateShort(sched.end) : 'Por determinar'),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, 'Duración estimada'),
            createElement(Text, { style: s.summaryValueSm }, sched.totalDays > 0 ? `${sched.totalDays} días hábiles` : 'Por determinar'),
          ),
        ),
        createElement(View, { style: { ...s.summaryRow, marginTop: 4 } },
          createElement(View, { style: s.summaryCellFirst },
            createElement(Text, { style: s.summaryLabel }, 'Forma de pago'),
            createElement(Text, { style: s.summaryValueSm },
              (data.payment_milestones && data.payment_milestones.length > 0)
                ? `Conforme a hitos del Anexo II (${data.payment_milestones.length} hito${data.payment_milestones.length !== 1 ? 's' : ''})`
                : 'Conforme a hitos del Anexo II'),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, 'Plazo de pago'),
            createElement(Text, { style: s.summaryValueSm },
              `${data.payment_days ?? DEFAULT_PAYMENT_DAYS} días hábiles desde validación del hito + certificación de ejecución correcta`),
          ),
          createElement(View, { style: s.summaryCell },
            createElement(Text, { style: s.summaryLabel }, 'Contrato Marco'),
            createElement(Text, { style: s.summaryValueSm },
              data.framework_agreement?.signed_at
                ? `Vigente — firmado ${fmtDateShort(data.framework_agreement.signed_at)}`
                : 'No aplica'),
          ),
        ),
      ),

      // Big total band
      createElement(View, { style: s.totalBand },
        createElement(Text, { style: s.totalBandLabel }, 'Total de la Orden de Ejecución'),
        createElement(Text, { style: s.totalBandValue }, `${fmtEur(totals.subtotal)} + IVA`),
      ),
    ),

    createElement(Footer, { reference }),
  )
}

// ── Clauses page ───────────────────────────────────────────────────────────────

function ClausesPage(props: { data: FpeContractData; reference: string; projectName: string }) {
  const { data, reference, projectName } = props
  const sched = deriveScheduleSummary(data.schedule_phases)
  const warrantyMonths = data.warranty_months ?? DEFAULT_WARRANTY_M
  const paymentDays    = data.payment_days    ?? DEFAULT_PAYMENT_DAYS
  const fwa = data.framework_agreement

  // Cláusula 1 — condicional
  const clausula1Body = fwa && (fwa.reference || fwa.signed_at)
    ? `La presente Orden de Ejecución de Obra se emite al amparo del Contrato Marco de Homologación y Colaboración con Execution Partners firmado entre FP execution y el EP${fwa.signed_at ? ` en fecha ${fmtDateLong(fwa.signed_at)}` : ''}${fwa.reference ? ` (ref. ${fwa.reference})` : ''}. El EP declara conocer, aceptar y mantener vigente dicho Contrato Marco, que será aplicable a la presente Orden de Ejecución en todo lo no previsto expresamente en este documento.`
    : 'La presente Orden de Ejecución se emite dentro del sistema FP Execution de FORMA PRIMA y se regirá por las condiciones generales aceptadas por el Execution Partner en su alta, homologación o contratación específica, así como por los anexos incorporados al presente documento. En caso de existir Contrato Marco de Homologación y Colaboración suscrito entre las Partes, dicho Contrato Marco será aplicable a la presente Orden de Ejecución en todo aquello que no contradiga expresamente este documento.'

  const totals = deriveTotals(data)
  const condicionesParticulares = data.condiciones_particulares?.trim()

  return createElement(Page, { size: 'A4', style: s.page },
    createElement(CompactHeader, { reference, projectName }),
    createElement(View, { style: s.body },

      createElement(SectionTitle, null, 'Condiciones Generales'),

      createElement(Clause, { number: 'Cláusula 1', title: 'Relación con el Contrato Marco' },
        createElement(P, null, clausula1Body),
      ),

      createElement(Clause, { number: 'Cláusula 2', title: 'Objeto de la Orden de Ejecución' },
        createElement(P, null,
          'FP execution adjudica al EP, y el EP acepta, la ejecución de los trabajos descritos en el Anexo I, Alcance y Precios, correspondientes al proyecto identificado en el encabezado.'),
        createElement(P, null,
          'El alcance adjudicado podrá incluir unidades de obra, partidas, capítulos, suministros, instalaciones, trabajos auxiliares, servicios técnicos o prestaciones complementarias, conforme al detalle recogido en los anexos.'),
      ),

      createElement(Clause, { number: 'Cláusula 3', title: 'Documentación contractual' },
        createElement(P, null, 'Forman parte de la presente Orden de Ejecución:'),
        createElement(LI, null, 'a) La presente Orden de Ejecución.'),
        createElement(LI, null, 'b) Anexo I, Alcance y Precios.'),
        createElement(LI, null, 'c) Anexo II, Hitos de Facturación y Pago.'),
        createElement(LI, null, 'd) Anexo III, Cronograma y Plazos.'),
        createElement(LI, null, 'e) Anexo IV, Documentación técnica aplicable, si procede.'),
        createElement(LI, null, 'f) Contrato Marco vigente entre las Partes.'),
        createElement(LI, null, 'g) Documentación técnica del proyecto que sea aplicable al alcance adjudicado.'),
        createElement(P, null,
          'En caso de contradicción, prevalecerá el orden anterior, salvo que una instrucción posterior validada por ambas Partes modifique expresamente alguno de dichos documentos.'),
      ),

      createElement(Clause, { number: 'Cláusula 4', title: 'Precio' },
        createElement(P, null,
          `El precio total de la presente Orden de Ejecución asciende a ${fmtEur(totals.subtotal)} + IVA. El desglose por capítulos, unidades, partidas, mediciones, precios unitarios e importes parciales se recoge en el Anexo I.`),
        createElement(P, null,
          'El precio incluye todos los medios necesarios para ejecutar correctamente los trabajos adjudicados, salvo exclusiones expresamente indicadas en el Anexo I.'),
      ),

      createElement(Clause, { number: 'Cláusula 5', title: 'Hitos de facturación y pago' },
        createElement(P, null,
          'La facturación se realizará conforme a los hitos indicados en el Anexo II.'),
        createElement(P, null,
          `El plazo de pago será de ${paymentDays} días hábiles y comenzará a computarse únicamente cuando concurran de forma acumulativa las dos condiciones siguientes:`),
        createElement(LI, null,
          '(a) Que se haya cumplido el hito de obra que, conforme al Anexo II, activa el pago correspondiente; y'),
        createElement(LI, null,
          '(b) Que FP execution, en su condición de responsable del control técnico y de obra, haya certificado expresamente que los trabajos del EP se encuentran correctamente ejecutados hasta el momento de la facturación.'),
        createElement(P, null,
          'La concurrencia de ambas condiciones se documentará mediante acta, validación en plataforma, certificación de avance o documento equivalente. La sola formalización del hito de organización de obra, sin certificación de ejecución correcta del EP, no será suficiente para activar el plazo de pago.'),
        createElement(P, null,
          'FP execution no podrá denegar o retrasar injustificadamente la certificación de hitos correctamente cumplidos por el EP.'),
      ),

      createElement(Clause, { number: 'Cláusula 6', title: 'Plazo, cronograma y disponibilidad operativa' },
        createElement(P, null,
          '6.1. La duración de cada fase de ejecución a cargo del EP es la propuesta por el propio EP durante el proceso de licitación y se recoge, expresada en días hábiles, en el Anexo III.'),
        createElement(P, null,
          '6.2. Las fechas previstas de inicio y fin de cada fase recogidas en el Anexo III son referenciales y se derivan del cronograma general del proyecto vigente a la fecha de emisión de la presente Orden. Dichas fechas podrán variar en función del desarrollo real de la obra, de la ejecución de otros industriales, de cambios solicitados por la propiedad o por la Dirección Facultativa, y de cualquier otra circunstancia no imputable al EP.'),
        createElement(P, null,
          '6.3. El EP se compromete a mantener disponibilidad operativa para iniciar la ejecución de cada una de sus fases. A efectos de coordinación, FP execution procurará comunicar al EP con cinco (5) días naturales de antelación la activación inminente del trigger de inicio de fase.'),
        createElement(P, null,
          '6.4. Cuando la fecha real de activación del trigger coincida con la fecha prevista en el Anexo III, el EP se compromete a iniciar los trabajos en la fecha prevista. Cuando la fecha real difiera de la prevista, el EP dispondrá de un margen máximo de dos (2) días hábiles desde la activación efectiva del trigger para iniciar los trabajos en obra.'),
        createElement(P, null,
          '6.5. La falta de inicio en los plazos anteriores, salvo causa justificada y acreditada, facultará a FP execution para requerir un plan de recuperación inmediato y, en caso de persistir el incumplimiento, aplicar las consecuencias previstas en el Contrato Marco o resolver la presente Orden de Ejecución.'),
        createElement(P, null,
          '6.6. Las desviaciones de plazo no imputables al EP no constituirán incumplimiento, sin perjuicio de la actualización del Anexo III. Los ajustes de cronograma deberán quedar reflejados en plataforma, acta, correo electrónico o documento equivalente.'),
      ),

      createElement(Clause, { number: 'Cláusula 7', title: 'Documentación previa al inicio' },
        createElement(P, null,
          'Antes de iniciar trabajos, el EP deberá tener validada la documentación aplicable a la obra, incluyendo, cuando proceda:'),
        createElement(LI, null, 'a) Documentación PRL de empresa.'),
        createElement(LI, null, 'b) Documentación PRL de trabajadores.'),
        createElement(LI, null, 'c) Seguro vigente.'),
        createElement(LI, null, 'd) Certificados fiscales o de Seguridad Social actualizados si hubieran caducado conforme al sistema de homologación.'),
        createElement(LI, null, 'e) REA, cuando proceda.'),
        createElement(LI, null, 'f) Documentación de maquinaria, equipos, medios auxiliares o productos.'),
        createElement(LI, null, 'g) Identificación de terceros que vayan a intervenir bajo su cadena.'),
        createElement(P, null,
          'El EP no podrá iniciar trabajos en obra hasta completar los requisitos documentales mínimos exigibles.'),
      ),

      createElement(Clause, { number: 'Cláusula 8', title: 'Subcontratación en esta Orden de Ejecución' },
        createElement(P, null,
          'El EP podrá apoyarse en terceros para la ejecución parcial de trabajos auxiliares, complementarios o especializados, conforme al Contrato Marco y a la normativa aplicable.'),
        createElement(P, null, 'En esta Orden de Ejecución, el EP declara que:'),
        createElement(LI, null, 'a) Ejecutará directamente una parte sustancial de los trabajos adjudicados.'),
        createElement(LI, null, 'b) No actuará como mero intermediario.'),
        createElement(LI, null, 'c) Comunicará a FP execution cualquier tercero que intervenga antes de su entrada en obra.'),
        createElement(LI, null, 'd) No superará los niveles de subcontratación legalmente permitidos.'),
        createElement(LI, null, 'e) Mantendrá la dirección efectiva, control técnico y responsabilidad sobre el alcance adjudicado.'),
        createElement(P, null,
          'En caso de que durante la ejecución se detecte que el EP ha cedido la práctica totalidad de los trabajos o ha perdido capacidad real de ejecución, FP execution podrá suspender la intervención afectada y, si procede, resolver la presente Orden de Ejecución.'),
      ),

      createElement(Clause, { number: 'Cláusula 9', title: 'Modificaciones de alcance' },
        createElement(P, null,
          'Cualquier trabajo adicional, modificación de medición, cambio de material, variación de solución técnica o precio contradictorio deberá ser aprobado previamente por FP execution.'),
        createElement(P, null,
          'La aprobación podrá realizarse mediante orden de cambio, aceptación digital, correo electrónico, acta de obra o documento equivalente.'),
        createElement(P, null,
          'El EP no deberá ejecutar trabajos adicionales sin aprobación previa, salvo urgencia justificada por seguridad, protección de obra o prevención de daños.'),
      ),

      createElement(Clause, { number: 'Cláusula 10', title: 'Recepción de los trabajos' },
        createElement(P, null, 'Finalizados los trabajos, FP execution realizará una revisión de recepción.'),
        createElement(P, null, 'La recepción podrá formalizarse como:'),
        createElement(LI, null, 'a) Recepción sin reservas.'),
        createElement(LI, null, 'b) Recepción con reservas menores.'),
        createElement(LI, null, 'c) No recepción por defectos sustanciales.'),
        createElement(P, null,
          'El EP deberá subsanar los defectos imputables a su ejecución en el plazo razonable que se establezca en el acta de revisión o comunicación equivalente.'),
      ),

      createElement(Clause, { number: 'Cláusula 11', title: 'Garantía específica' },
        createElement(P, null, 'Los trabajos ejecutados por el EP tendrán el periodo de garantía indicado a continuación:'),
        createElement(P, null,
          `Periodo de garantía específico: ${warrantyMonths} meses desde recepción sin reservas o desde subsanación de reservas.`),
        createElement(P, null,
          'Lo anterior se entiende sin perjuicio de los plazos y responsabilidades legales que resulten aplicables por normativa civil, LOE, normativa sectorial de instalaciones, garantías de fabricante u otras disposiciones aplicables.'),
      ),

      createElement(Clause, { number: 'Cláusula 12', title: 'Condiciones particulares' },
        condicionesParticulares
          ? createElement(P, null, condicionesParticulares)
          : createElement(P, null,
              'No se han establecido condiciones particulares específicas para la presente Orden de Ejecución. En caso de incorporarse durante la ejecución (horarios de comunidad, accesos, restricciones de ruido, marcas específicas, documentación final, boletines, legalizaciones u otras), se incorporarán al presente documento mediante adenda o instrucción validada por ambas Partes.'),
      ),

      createElement(Clause, { number: 'Cláusula 13', title: 'Firma' },
        createElement(P, null,
          'Leída la presente Orden de Ejecución, ambas Partes la aceptan y firman en la fecha indicada en el registro de firma. La firma se realizará electrónicamente mediante DocuSign u otra plataforma de firma admitida por FP execution; ambas Partes reconocen la validez de la firma electrónica y de los registros asociados al proceso de firma, incluyendo fecha, hora, identidad del firmante y trazabilidad del documento.'),
      ),
    ),
    createElement(Footer, { reference }),
  )
}

// ── Anexo I — Alcance y Precios ───────────────────────────────────────────────

function AnexoIPage(props: { data: FpeContractData; reference: string; projectName: string }) {
  const { data, reference, projectName } = props
  const totals = deriveTotals(data)

  // Build chapter view, falling back to a synthetic "Sin capítulo" group from line_items
  // if data.chapters is not provided.
  type RenderUnit = {
    unit_nombre: string
    line_items: { nombre: string; unidad_medida: string; cantidad: number; precio_unitario: number; total: number }[]
    unit_total: number
  }
  type RenderChapter = { chapter_nombre: string; units: RenderUnit[]; chapter_total: number }

  let renderChapters: RenderChapter[] = []
  if (data.chapters && data.chapters.length > 0) {
    renderChapters = data.chapters.map(ch => {
      const units = ch.units.map(u => ({
        unit_nombre: u.unit_nombre,
        line_items:  u.line_items,
        unit_total:  u.total ?? u.line_items.reduce((s, li) => s + (li.total || 0), 0),
      }))
      return {
        chapter_nombre: ch.chapter_nombre,
        units,
        chapter_total: units.reduce((s, u) => s + u.unit_total, 0),
      }
    })
  } else {
    // Fallback: group by unit_nombre from flat line_items
    const grouped = new Map<string, FpeContractLineItem[]>()
    for (const li of data.line_items) {
      const key = li.unit_nombre || 'Alcance adjudicado'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(li)
    }
    const units: RenderUnit[] = Array.from(grouped.entries()).map(([unit_nombre, items]) => ({
      unit_nombre,
      line_items: items.map(li => ({
        nombre: li.nombre, unidad_medida: li.unidad, cantidad: li.cantidad,
        precio_unitario: li.precio_unitario, total: li.total,
      })),
      unit_total: items.reduce((s, li) => s + (li.total || 0), 0),
    }))
    renderChapters = [{ chapter_nombre: 'Alcance adjudicado', units, chapter_total: units.reduce((s, u) => s + u.unit_total, 0) }]
  }

  return createElement(Page, { size: 'A4', style: s.page },
    createElement(CompactHeader, { reference, projectName }),
    createElement(View, { style: s.body },
      createElement(SectionTitle, null, 'Anexo I — Alcance y Precios'),
      createElement(Text, { style: s.anexoIntro },
        'El presente Anexo I recoge el alcance económico y técnico adjudicado al EP para la presente Orden de Ejecución. Los precios unitarios, cantidades, mediciones, subtotales e importes totales aquí indicados forman parte integrante de la Orden de Ejecución y han sido aceptados por el EP.'),

      // Table header
      createElement(View, { style: s.tHead, fixed: true },
        createElement(Text, { style: { ...s.th, flex: 4 } }, 'Partida'),
        createElement(Text, { style: { ...s.th, width: 36, textAlign: 'right' } }, 'Ud.'),
        createElement(Text, { style: { ...s.th, width: 50, textAlign: 'right' } }, 'Cant.'),
        createElement(Text, { style: { ...s.th, width: 64, textAlign: 'right' } }, 'P/Ud (€)'),
        createElement(Text, { style: { ...s.th, width: 70, textAlign: 'right' } }, 'Importe (€)'),
      ),

      // Chapters
      ...renderChapters.map((ch, ci) =>
        createElement(View, { key: `ch-${ci}` },
          createElement(View, { style: s.chapterRow, wrap: false },
            createElement(Text, { style: s.chapterRowText }, `Capítulo · ${ch.chapter_nombre}`),
          ),
          ...ch.units.flatMap((u, ui) => [
            createElement(View, { key: `u-${ci}-${ui}`, style: s.unitRow, wrap: false },
              createElement(Text, { style: s.unitRowText }, u.unit_nombre),
            ),
            ...u.line_items.map((li, li_i) =>
              createElement(View, {
                key: `li-${ci}-${ui}-${li_i}`,
                style: li_i % 2 === 0 ? s.tRow : s.tRowAlt,
                wrap: false,
              },
                createElement(Text, { style: { ...s.td, flex: 4, paddingLeft: 8 } }, li.nombre),
                createElement(Text, { style: { ...s.tdMid, width: 36, textAlign: 'right' } }, li.unidad_medida || ''),
                createElement(Text, { style: { ...s.tdRight, width: 50 } }, li.cantidad.toLocaleString('es-ES')),
                createElement(Text, { style: { ...s.tdRight, width: 64 } }, li.precio_unitario.toFixed(2)),
                createElement(Text, { style: { ...s.tdBold, width: 70 } }, li.total.toFixed(2)),
              )
            ),
            createElement(View, { key: `usub-${ci}-${ui}`, style: s.subtotalRow, wrap: false },
              createElement(Text, { style: s.subtotalLabel }, `Subtotal — ${u.unit_nombre}`),
              createElement(Text, { style: { ...s.subtotalValue, width: 90 } }, fmtEur(u.unit_total)),
            ),
          ]),
          createElement(View, {
            style: { ...s.subtotalRow, backgroundColor: '#E6E3DC' },
            wrap: false,
          },
            createElement(Text, { style: { ...s.subtotalLabel, color: C.ink } }, `Subtotal Capítulo — ${ch.chapter_nombre}`),
            createElement(Text, { style: { ...s.subtotalValue, width: 90 } }, fmtEur(ch.chapter_total)),
          ),
        )
      ),

      // Final totals
      createElement(View, { style: s.totalsBlock, wrap: false },
        createElement(View, { style: s.totalLine },
          createElement(Text, { style: s.totalLineLabel }, 'Total general (sin IVA)'),
          createElement(Text, { style: s.totalLineValue }, fmtEur(totals.subtotal)),
        ),
        createElement(View, { style: s.totalLine },
          createElement(Text, { style: s.totalLineLabel }, `IVA (${totals.vatRate}%)`),
          createElement(Text, { style: s.totalLineValue }, fmtEur(totals.vat)),
        ),
        createElement(View, { style: s.totalFinal },
          createElement(Text, { style: s.totalFinalLabel }, 'Total con IVA'),
          createElement(Text, { style: s.totalFinalValue }, fmtEur(totals.gross)),
        ),
      ),

      createElement(Text, { style: s.anexoClose },
        'El importe total indicado en este Anexo I no incluye IVA, salvo indicación expresa en contrario. Cualquier variación de alcance o medición deberá tramitarse conforme al procedimiento de modificaciones previsto en la Orden de Ejecución y en el Contrato Marco.'),
    ),
    createElement(Footer, { reference }),
  )
}

// ── Anexo II — Hitos de Facturación y Pago ────────────────────────────────────

function AnexoIIPage(props: { data: FpeContractData; reference: string; projectName: string }) {
  const { data, reference, projectName } = props
  const totals = deriveTotals(data)
  const milestones = data.payment_milestones ?? []
  const vatRate = totals.vatRate

  return createElement(Page, { size: 'A4', style: s.page },
    createElement(CompactHeader, { reference, projectName }),
    createElement(View, { style: s.body },
      createElement(SectionTitle, null, 'Anexo II — Hitos de Facturación y Pago'),
      createElement(Text, { style: s.anexoIntro },
        'El presente Anexo II regula los hitos de facturación aplicables a la Orden de Ejecución. Cada hito requerirá validación previa de FP execution conforme al avance, entrega, recepción parcial o cumplimiento objetivo indicado.'),

      milestones.length === 0
        ? createElement(View, {
            style: {
              padding: 14, backgroundColor: C.light, borderLeftWidth: 2, borderLeftColor: C.warn,
            },
          },
            createElement(Text, { style: { fontSize: 8, color: C.warn, lineHeight: 1.6 } },
              'No se han configurado hitos de facturación para esta Orden de Ejecución al momento de su emisión. Antes de iniciar trabajos o de emitir la primera factura, ambas Partes acordarán los hitos aplicables conforme al Contrato Marco y a la disciplina rectora del Execution Partner.'),
          )
        : createElement(View, null,
            // Header
            createElement(View, { style: s.tHead, fixed: true },
              createElement(Text, { style: { ...s.th, flex: 3 } }, 'Hito'),
              createElement(Text, { style: { ...s.th, flex: 2 } }, 'Disparador'),
              createElement(Text, { style: { ...s.th, width: 36, textAlign: 'right' } }, '%'),
              createElement(Text, { style: { ...s.th, width: 62, textAlign: 'right' } }, 'Sin IVA'),
              createElement(Text, { style: { ...s.th, width: 56, textAlign: 'right' } }, 'IVA'),
              createElement(Text, { style: { ...s.th, width: 64, textAlign: 'right' } }, 'Con IVA'),
              createElement(Text, { style: { ...s.th, width: 60, textAlign: 'right' } }, 'Estado'),
            ),
            // Rows
            ...milestones.map((m, i) => {
              const sinIva = m.monto
              const ivaAmt = Math.round(sinIva * vatRate) / 100
              const conIva = sinIva + ivaAmt
              const triggerLabel = TRIGGER_LABEL[m.trigger_type] ?? m.trigger_type
              const estadoLabel  = STATUS_LABEL[m.status ?? 'pendiente'] ?? (m.status ?? 'Pendiente')
              return createElement(View, {
                key: `m-${i}`,
                style: i % 2 === 0 ? s.tRow : s.tRowAlt,
                wrap: false,
              },
                createElement(Text, { style: { ...s.td, flex: 3 } }, m.nombre),
                createElement(Text, { style: { ...s.tdMid, flex: 2 } }, triggerLabel),
                createElement(Text, { style: { ...s.tdRight, width: 36 } }, fmtPct(m.pct)),
                createElement(Text, { style: { ...s.tdRight, width: 62 } }, sinIva.toFixed(2)),
                createElement(Text, { style: { ...s.tdRight, width: 56 } }, ivaAmt.toFixed(2)),
                createElement(Text, { style: { ...s.tdBold, width: 64 } }, conIva.toFixed(2)),
                createElement(Text, { style: { ...s.tdMid, width: 60, textAlign: 'right' } }, estadoLabel),
              )
            }),
            // Total row
            createElement(View, {
              style: { ...s.subtotalRow, backgroundColor: '#E6E3DC' },
              wrap: false,
            },
              createElement(Text, { style: { ...s.subtotalLabel, color: C.ink } }, 'Total'),
              createElement(Text, { style: { ...s.subtotalValue, width: 62 } }, totals.subtotal.toFixed(2)),
              createElement(Text, { style: { ...s.subtotalValue, width: 56 } }, totals.vat.toFixed(2)),
              createElement(Text, { style: { ...s.subtotalValue, width: 64 } }, totals.gross.toFixed(2)),
              createElement(Text, { style: { width: 60 } }),
            ),

            // Evidence sub-block
            createElement(View, { style: { marginTop: 14 }, wrap: false },
              createElement(Text, { style: { ...s.summaryLabel, marginBottom: 6 } }, 'Evidencia requerida por tipo de disparador'),
              ...Object.entries(TRIGGER_EVIDENCE)
                .filter(([k]) => milestones.some(m => m.trigger_type === k))
                .map(([k, v]) =>
                  createElement(View, {
                    key: `ev-${k}`,
                    style: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.rule },
                  },
                    createElement(Text, { style: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.soft, width: 150 } }, TRIGGER_LABEL[k] ?? k),
                    createElement(Text, { style: { fontSize: 7.5, color: C.mid, flex: 1, lineHeight: 1.5 } }, v),
                  )
                ),
            ),
          ),

      createElement(Text, { style: s.anexoClose },
        'La validación de un hito no supone recepción definitiva de la totalidad de los trabajos, salvo que así se indique expresamente. FP execution no podrá denegar o retrasar injustificadamente la validación de hitos correctamente cumplidos.'),
    ),
    createElement(Footer, { reference }),
  )
}

// ── Anexo III — Cronograma y Plazos ───────────────────────────────────────────

function AnexoIIIPage(props: { data: FpeContractData; reference: string; projectName: string }) {
  const { data, reference, projectName } = props
  const phases = data.schedule_phases ?? []
  const totalDays = phases.reduce((s, p) => s + (p.duracion_dias || 0), 0)

  return createElement(Page, { size: 'A4', style: s.page },
    createElement(CompactHeader, { reference, projectName }),
    createElement(View, { style: s.body },
      createElement(SectionTitle, null, 'Anexo III — Cronograma y Plazos'),
      createElement(Text, { style: s.anexoIntro },
        'El presente Anexo III recoge la planificación temporal estimada para los trabajos adjudicados al EP. El cronograma se integra en la Orden de Ejecución como referencia vinculante de coordinación, sin perjuicio de los ajustes derivados de incidencias, interferencias o modificaciones no imputables al EP.'),

      phases.length === 0
        ? createElement(View, {
            style: { padding: 14, backgroundColor: C.light, borderLeftWidth: 2, borderLeftColor: C.warn },
          },
            createElement(Text, { style: { fontSize: 8, color: C.warn, lineHeight: 1.6 } },
              'El cronograma operativo para los trabajos adjudicados al EP se concretará entre las Partes con anterioridad a la entrada en obra. La presente Orden de Ejecución se firma sin perjuicio de esa concreción posterior, que pasará a integrarse como Anexo III actualizado.'),
          )
        : createElement(View, null,
            createElement(View, { style: s.tHead, fixed: true },
              createElement(Text, { style: { ...s.th, flex: 3 } }, 'Fase'),
              createElement(Text, { style: { ...s.th, width: 62, textAlign: 'right' } }, 'Inicio'),
              createElement(Text, { style: { ...s.th, width: 62, textAlign: 'right' } }, 'Fin'),
              createElement(Text, { style: { ...s.th, width: 56, textAlign: 'right' } }, 'Días háb.'),
              createElement(Text, { style: { ...s.th, flex: 2 } }, 'Dependencias'),
              createElement(Text, { style: { ...s.th, flex: 2 } }, 'Responsable'),
            ),
            ...phases.map((p, i) =>
              createElement(View, {
                key: `ph-${i}`,
                style: i % 2 === 0 ? s.tRow : s.tRowAlt,
                wrap: false,
              },
                createElement(Text, { style: { ...s.td, flex: 3 } }, p.fase),
                createElement(Text, { style: { ...s.tdMid, width: 62, textAlign: 'right' } }, p.fecha_inicio ? fmtDateShort(p.fecha_inicio) : '—'),
                createElement(Text, { style: { ...s.tdMid, width: 62, textAlign: 'right' } }, p.fecha_fin    ? fmtDateShort(p.fecha_fin)    : '—'),
                createElement(Text, { style: { ...s.tdRight, width: 56 } }, p.duracion_dias > 0 ? `${p.duracion_dias}` : '—'),
                createElement(Text, { style: { ...s.tdMid, flex: 2 } }, p.dependencias || '—'),
                createElement(Text, { style: { ...s.tdMid, flex: 2 } }, p.responsable  || 'Execution Partner'),
              )
            ),
            createElement(View, { style: { ...s.subtotalRow, backgroundColor: '#E6E3DC' }, wrap: false },
              createElement(Text, { style: { ...s.subtotalLabel, color: C.ink } }, 'Duración estimada total'),
              createElement(Text, { style: { ...s.subtotalValue, width: 56 } }, `${totalDays} días háb.`),
              createElement(Text, { style: { flex: 2 } }),
              createElement(Text, { style: { flex: 2 } }),
            ),
          ),

      createElement(Text, { style: s.anexoClose },
        'Las desviaciones de plazo deberán comunicarse tan pronto como sean conocidas por cualquiera de las Partes. Los ajustes de cronograma deberán quedar reflejados en plataforma, acta, correo o documento equivalente.'),
    ),
    createElement(Footer, { reference }),
  )
}

// ── Anexo IV — Documentación técnica (conditional) ────────────────────────────

function AnexoIVPage(props: { data: FpeContractData; reference: string; projectName: string }) {
  const { data, reference, projectName } = props
  const docs = data.technical_docs ?? []

  return createElement(Page, { size: 'A4', style: s.page },
    createElement(CompactHeader, { reference, projectName }),
    createElement(View, { style: s.body },
      createElement(SectionTitle, null, 'Anexo IV — Documentación Técnica Aplicable'),

      docs.length === 0
        ? createElement(Text, { style: { ...s.anexoIntro, color: C.mid, borderLeftColor: C.rule } },
            'No se han asociado documentos técnicos adicionales a la presente Orden de Ejecución al momento de su emisión. La documentación técnica del proyecto aplicable al alcance adjudicado se considerará incorporada por remisión, conforme a lo previsto en la cláusula 3 de la Orden de Ejecución.')
        : createElement(View, null,
            createElement(Text, { style: s.anexoIntro },
              'Se incorporan los siguientes documentos técnicos como parte integrante de la presente Orden de Ejecución:'),
            createElement(View, { style: s.tHead, fixed: true },
              createElement(Text, { style: { ...s.th, flex: 3 } }, 'Documento'),
              createElement(Text, { style: { ...s.th, flex: 1 } }, 'Tipo'),
              createElement(Text, { style: { ...s.th, width: 70 } }, 'Fecha'),
              createElement(Text, { style: { ...s.th, width: 50 } }, 'Versión'),
              createElement(Text, { style: { ...s.th, flex: 2 } }, 'Observaciones'),
            ),
            ...docs.map((d, i) =>
              createElement(View, {
                key: `d-${i}`,
                style: i % 2 === 0 ? s.tRow : s.tRowAlt,
                wrap: false,
              },
                createElement(Text, { style: { ...s.td, flex: 3 } }, d.nombre),
                createElement(Text, { style: { ...s.tdMid, flex: 1 } }, d.tipo || '—'),
                createElement(Text, { style: { ...s.tdMid, width: 70 } }, d.fecha ? fmtDateShort(d.fecha) : '—'),
                createElement(Text, { style: { ...s.tdMid, width: 50 } }, d.version || '—'),
                createElement(Text, { style: { ...s.tdMid, flex: 2 } }, d.observaciones || ''),
              )
            ),
          ),
    ),
    createElement(Footer, { reference }),
  )
}

// ── Signatures page ───────────────────────────────────────────────────────────

function SignaturesPage(props: { data: FpeContractData; reference: string; projectName: string }) {
  const { data, reference, projectName } = props
  const partnerLegalName = data.partner.legal_name || data.partner.nombre
  return createElement(Page, { size: 'A4', style: s.page },
    createElement(CompactHeader, { reference, projectName }),
    createElement(View, { style: s.body },
      createElement(SectionTitle, null, 'Firma'),
      createElement(Text, { style: s.signatureIntro },
        `En Madrid, a ${fmtDateLong(data.awarded_at)}, leída la presente Orden de Ejecución de Obra, ambas Partes la aceptan y firman en la fecha indicada en el registro de firma electrónica. Ambas Partes reconocen la validez de la firma electrónica y de los registros asociados al proceso de firma, incluyendo fecha, hora, identidad del firmante y trazabilidad del documento.`),

      createElement(View, { style: s.signaturesRow },
        // POR FP EXECUTION → anchor «FP_FIRMA_ESTUDIO»
        createElement(View, { style: s.signatureBox, wrap: false },
          createElement(Text, { style: s.signatureLabel }, 'POR FP EXECUTION'),
          createElement(Text, { style: s.signatureName }, STUDIO.rep_nombre),
          createElement(Text, { style: s.signatureRole }, `${STUDIO.rep_titulo} — ${STUDIO.razon_social}`),
          createElement(View, { style: s.signatureSpace }),
          createElement(Text, { style: s.signatureNote }, 'Firma y fecha'),
          // DocuSign anchor (DO NOT rename — bound to lib/docusign/client.ts)
          createElement(Text, { style: s.signatureAnchor }, '«FP_FIRMA_ESTUDIO»'),
        ),
        // POR EL EXECUTION PARTNER → anchor «FP_FIRMA_CLIENTE»
        createElement(View, { style: s.signatureBox, wrap: false },
          createElement(Text, { style: s.signatureLabel }, 'POR EL EXECUTION PARTNER'),
          createElement(Text, { style: s.signatureName },
            data.partner.contact_name || partnerLegalName),
          createElement(Text, { style: s.signatureRole },
            `${data.partner.contact_role || 'Representante'} — ${partnerLegalName}`),
          createElement(View, { style: s.signatureSpace }),
          createElement(Text, { style: s.signatureNote }, 'Firma y fecha'),
          // DocuSign anchor (DO NOT rename — bound to lib/docusign/client.ts)
          createElement(Text, { style: s.signatureAnchor }, '«FP_FIRMA_CLIENTE»'),
        ),
      ),
    ),
    createElement(Footer, { reference }),
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main component + wrapper
// ══════════════════════════════════════════════════════════════════════════════

export function FpeContractPDF({ data }: { data: FpeContractData }) {
  const reference   = deriveReference(data)
  const projectName = data.project.nombre || 'Proyecto'
  const hasAnexoIV  = (data.technical_docs?.length ?? 0) > 0

  return createElement(Document, null,
    createElement(CoverPage,         { data, reference }),
    createElement(ClausesPage,       { data, reference, projectName }),
    createElement(AnexoIPage,        { data, reference, projectName }),
    createElement(AnexoIIPage,       { data, reference, projectName }),
    createElement(AnexoIIIPage,      { data, reference, projectName }),
    hasAnexoIV ? createElement(AnexoIVPage, { data, reference, projectName }) : null,
    createElement(SignaturesPage,    { data, reference, projectName }),
  )
}

/**
 * Generates the "Orden de Ejecución de Obra para Execution Partner" PDF as a Buffer.
 * Preserves the exported signature used by:
 *   - app/actions/fpe-tenders.ts (generateContractsFromAwards)
 *   - app/api/fpe-contracts/preview-pdf/route.ts
 *
 * Backwards compatible: extra fields on FpeContractData are optional; callers
 * that don't provide them will get neutral fallbacks in the rendered document.
 */
export async function generateFpeContractPDF(data: FpeContractData): Promise<Buffer> {
  const element = createElement(FpeContractPDF, { data })
  // renderToBuffer accepts a Document element
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]) as Promise<Buffer>
}

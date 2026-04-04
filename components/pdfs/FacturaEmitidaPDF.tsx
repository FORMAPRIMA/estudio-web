// Server-only component — only used inside the API route with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'

const LOGO_BLANCO   = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')
const ISOTIPO_NEGRO = path.join(process.cwd(), 'public', 'ISOTIPO NEGRO cropped.png')
import type { FacturaItem } from '@/app/actions/facturasEmitidas'

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
  // header tones
  hInk:     '#F0EDE8',
  hMid:     '#888580',
  hMuted:   '#555250',
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

  // ── Header block (full bleed, dark) ─────────────────────────────────────────
  headerBlock: {
    backgroundColor: C.headerBg,
    paddingTop: 40,
    paddingBottom: 0,
    paddingHorizontal: 56,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  logo: {
    width: 110,
    objectFit: 'contain',
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 7.5,
    color: C.hMid,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 4,
  },
  razonSocial: {
    fontSize: 6.5,
    color: C.hMuted,
  },
  headerRight: {
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  rectBadge: {
    backgroundColor: '#7F1D1D',
    color: '#FCA5A5',
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginBottom: 10,
    letterSpacing: 1,
  },
  invoiceWord: {
    fontSize: 7,
    color: C.hMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'right',
    marginBottom: 5,
  },
  invoiceNum: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: C.hInk,
    textAlign: 'right',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 7.5,
    color: C.hMid,
    textAlign: 'right',
    lineHeight: 1.7,
  },
  // orange accent line at the bottom of the header
  headerAccent: {
    height: 2,
    backgroundColor: C.brand,
  },

  // ── Body (padded) ────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 56,
    paddingTop: 28,
  },

  // ── Dividers ─────────────────────────────────────────────────────────────────
  rule: {
    height: 1,
    backgroundColor: C.rule,
  },

  // ── Parties ──────────────────────────────────────────────────────────────────
  parties: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 36,
  },
  party: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  partyName: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginBottom: 3,
    lineHeight: 1.35,
  },
  partyContacto: {
    fontSize: 8,
    color: C.mid,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  partyNif: {
    fontSize: 7,
    color: C.meta,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  partyLine: {
    fontSize: 7.5,
    color: C.mid,
    lineHeight: 1.6,
  },

  // ── Proyecto ─────────────────────────────────────────────────────────────────
  proyectoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  proyectoLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  proyectoDot: {
    fontSize: 7,
    color: C.rule,
  },
  proyectoValue: {
    fontSize: 8,
    color: C.soft,
  },

  // ── Rectificativa ────────────────────────────────────────────────────────────
  rectNote: {
    borderLeftWidth: 1.5,
    borderLeftColor: '#DC2626',
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginBottom: 18,
    marginTop: 4,
  },
  rectNoteText: {
    fontSize: 7.5,
    color: '#B91C1C',
    lineHeight: 1.5,
  },

  // ── Tabla ────────────────────────────────────────────────────────────────────
  tableWrap: {
    marginTop: 20,
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 7,
  },
  tableHeadText: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  cellDesc:  { flex: 5 },
  cellQty:   { flex: 1, textAlign: 'right' },
  cellPrice: { flex: 2, textAlign: 'right' },
  cellAmt:   { flex: 2, textAlign: 'right' },
  cellText:  { fontSize: 8.5, color: C.soft, lineHeight: 1.45 },

  // ── Totales ──────────────────────────────────────────────────────────────────
  totalsWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    marginBottom: 28,
  },
  totalsBox: {
    width: 240,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 7.5,
    color: C.meta,
  },
  totalValue: {
    fontSize: 7.5,
    color: C.mid,
  },
  totalSep: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 6,
  },
  totalFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: C.brand,
  },
  totalFinalLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.mid,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalFinalValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    letterSpacing: -0.3,
  },

  // ── Tax note ─────────────────────────────────────────────────────────────────
  taxNote: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  taxNoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
  },
  taxNoteText: {
    fontSize: 6.5,
    color: C.meta,
  },

  // ── Info ─────────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    gap: 36,
    marginTop: 16,
    marginBottom: 20,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.meta,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  infoText: {
    fontSize: 8,
    color: C.soft,
    lineHeight: 1.6,
  },
  infoMeta: {
    fontSize: 7.5,
    color: C.mid,
    lineHeight: 1.6,
  },

  // ── Legal ─────────────────────────────────────────────────────────────────────
  legal: {
    borderLeftWidth: 1,
    borderLeftColor: C.rule,
    paddingVertical: 6,
    paddingHorizontal: 11,
    marginBottom: 16,
  },
  legalText: {
    fontSize: 7,
    color: C.meta,
    lineHeight: 1.6,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  footerText: {
    fontSize: 6.5,
    color: C.meta,
  },
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FacturaPDFData {
  numero_completo:  string
  serie:            string
  fecha_emision:    string
  fecha_operacion?: string | null
  emisor_nombre:    string
  emisor_nif:       string
  emisor_direccion: string
  emisor_ciudad?:   string | null
  emisor_cp?:       string | null
  emisor_email?:    string | null
  emisor_telefono?: string | null
  cliente_nombre:   string
  cliente_contacto?: string | null
  cliente_nif?:     string | null
  cliente_direccion?: string | null
  proyecto_nombre?: string | null
  items:            FacturaItem[]
  tipo_iva:         number
  base_imponible:   number
  cuota_iva:        number
  tipo_irpf?:       number | null
  cuota_irpf?:      number | null
  total:            number
  notas?:           string | null
  mencion_legal?:   string | null
  iban?:            string | null
  banco_nombre?:    string | null
  banco_swift?:     string | null
  forma_pago?:      string | null
  condiciones_pago?: string | null
  es_rectificativa?: boolean
  factura_original_numero?: string | null
  motivo_rectificacion?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FacturaEmitidaPDF({ data }: { data: FacturaPDFData }) {
  const showIrpf    = !!data.tipo_irpf && !!data.cuota_irpf
  const hasPayment  = !!(data.iban || data.condiciones_pago)
  const hasNotes    = !!data.notas
  const showInfoRow = hasPayment || hasNotes

  return (
    <Document
      title={`Factura ${data.numero_completo}`}
      author="Forma Prima"
      creator="Forma Prima"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header negro ────────────────────────────────────────────── */}
        <View style={s.headerBlock}>
          <View style={s.headerInner}>
            <View style={s.headerLeft}>
              <Image src={LOGO_BLANCO} style={s.logo} />
              <Text style={s.brandTagline}>Taller de arquitectura y diseño</Text>
              <Text style={s.razonSocial}>{data.emisor_nombre}  ·  {data.emisor_nif}</Text>
            </View>

            <View style={s.headerRight}>
              {data.es_rectificativa && (
                <Text style={s.rectBadge}>FACTURA RECTIFICATIVA</Text>
              )}
              <Text style={s.invoiceWord}>Factura</Text>
              <Text style={s.invoiceNum}>{data.numero_completo}</Text>
              <Text style={s.invoiceDate}>{fmtDate(data.fecha_emision)}</Text>
              {data.fecha_operacion && data.fecha_operacion !== data.fecha_emision && (
                <Text style={s.invoiceDate}>Operación: {fmtDate(data.fecha_operacion)}</Text>
              )}
            </View>
          </View>

          {/* línea naranja de separación */}
          <View style={s.headerAccent} />
        </View>

        {/* ── Body blanco ─────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* Parties */}
          <View style={s.parties}>
            <View style={s.party}>
              <Text style={s.partyLabel}>Prestador del servicio</Text>
              <Text style={s.partyName}>{data.emisor_nombre}</Text>
              <Text style={s.partyNif}>NIF {data.emisor_nif}</Text>
              <Text style={s.partyLine}>{data.emisor_direccion}</Text>
              {(data.emisor_cp || data.emisor_ciudad) && (
                <Text style={s.partyLine}>
                  {[data.emisor_cp, data.emisor_ciudad].filter(Boolean).join('  ')}
                </Text>
              )}
              {data.emisor_email && <Text style={s.partyLine}>{data.emisor_email}</Text>}
              {data.emisor_telefono && <Text style={s.partyLine}>{data.emisor_telefono}</Text>}
            </View>

            <View style={s.party}>
              <Text style={s.partyLabel}>Destinatario</Text>
              <Text style={s.partyName}>{data.cliente_nombre}</Text>
              {data.cliente_contacto && (
                <Text style={s.partyContacto}>Att. {data.cliente_contacto}</Text>
              )}
              {data.cliente_nif && (
                <Text style={s.partyNif}>NIF/CIF {data.cliente_nif}</Text>
              )}
              {data.cliente_direccion && (
                <Text style={s.partyLine}>{data.cliente_direccion}</Text>
              )}
            </View>
          </View>

          <View style={s.rule} />

          {/* Proyecto */}
          {data.proyecto_nombre && (
            <View style={s.proyectoRow}>
              <Text style={s.proyectoLabel}>Proyecto</Text>
              <Text style={s.proyectoDot}>·</Text>
              <Text style={s.proyectoValue}>{data.proyecto_nombre}</Text>
            </View>
          )}

          {/* Rectificativa nota */}
          {data.es_rectificativa && data.factura_original_numero && (
            <View style={s.rectNote}>
              <Text style={s.rectNoteText}>
                Factura rectificativa de la n.º {data.factura_original_numero}.
                {data.motivo_rectificacion ? `  Motivo: ${data.motivo_rectificacion}` : ''}
              </Text>
            </View>
          )}

          {/* Items */}
          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <View style={s.cellDesc}><Text style={s.tableHeadText}>Descripción</Text></View>
              <View style={s.cellQty}><Text style={s.tableHeadText}>Cant.</Text></View>
              <View style={s.cellPrice}><Text style={s.tableHeadText}>P. Unit.</Text></View>
              <View style={s.cellAmt}><Text style={s.tableHeadText}>Importe</Text></View>
            </View>

            {data.items.map((item, i) => (
              <View key={i} style={s.tableRow}>
                <View style={s.cellDesc}>
                  <Text style={s.cellText}>{item.descripcion}</Text>
                </View>
                <View style={s.cellQty}>
                  <Text style={s.cellText}>{item.cantidad}</Text>
                </View>
                <View style={s.cellPrice}>
                  <Text style={s.cellText}>{eur(item.precio_unitario)}</Text>
                </View>
                <View style={s.cellAmt}>
                  <Text style={s.cellText}>{eur(item.subtotal)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Totales */}
          <View style={s.totalsWrapper}>
            <View style={s.totalsBox}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Base imponible</Text>
                <Text style={s.totalValue}>{eur(data.base_imponible)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>IVA {data.tipo_iva}%</Text>
                <Text style={s.totalValue}>{eur(data.cuota_iva)}</Text>
              </View>
              {showIrpf && (
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Retención IRPF {data.tipo_irpf}%</Text>
                  <Text style={s.totalValue}>−{eur(data.cuota_irpf!)}</Text>
                </View>
              )}
              <View style={s.totalSep} />
              <View style={s.totalFinalRow}>
                <Text style={s.totalFinalLabel}>Total a pagar</Text>
                <Text style={s.totalFinalValue}>{eur(data.total)}</Text>
              </View>

              <View style={s.taxNote}>
                <View style={s.taxNoteRow}>
                  <Text style={s.taxNoteText}>Base {data.tipo_iva}% IVA</Text>
                  <Text style={s.taxNoteText}>{eur(data.base_imponible)}</Text>
                </View>
                <View style={s.taxNoteRow}>
                  <Text style={s.taxNoteText}>Cuota IVA</Text>
                  <Text style={s.taxNoteText}>{eur(data.cuota_iva)}</Text>
                </View>
                {showIrpf && (
                  <View style={s.taxNoteRow}>
                    <Text style={s.taxNoteText}>Retención IRPF {data.tipo_irpf}%</Text>
                    <Text style={s.taxNoteText}>−{eur(data.cuota_irpf!)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Pago + Notas */}
          {showInfoRow && (
            <>
              <View style={s.rule} />
              <View style={s.infoRow}>
                {hasPayment && (
                  <View style={s.infoBlock}>
                    <Text style={s.infoLabel}>Forma de pago</Text>
                    <Text style={s.infoText}>{data.forma_pago ?? 'Transferencia bancaria'}</Text>
                    {data.banco_nombre && <Text style={s.infoMeta}>{data.banco_nombre}</Text>}
                    {data.iban && <Text style={s.infoMeta}>IBAN: {data.iban}</Text>}
                    {data.banco_swift && <Text style={s.infoMeta}>SWIFT/BIC: {data.banco_swift}</Text>}
                    {data.condiciones_pago && (
                      <Text style={s.infoMeta}>{data.condiciones_pago}</Text>
                    )}
                  </View>
                )}
                {hasNotes && (
                  <View style={s.infoBlock}>
                    <Text style={s.infoLabel}>Observaciones</Text>
                    <Text style={s.infoMeta}>{data.notas}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Condiciones de pago — siempre presentes */}
          <View style={{ ...s.legal, marginTop: showInfoRow ? 0 : 12 }}>
            <Text style={s.legalText}>
              {'Esta factura deberá ser abonada en el plazo de quince (15) días naturales a contar desde su emisión, mediante transferencia bancaria a la cuenta indicada por el Estudio. Cualquier retraso en el pago constituirá al deudor en mora de forma automática, sin necesidad de intimación o requerimiento previo. Dicho retraso devengará, desde el día siguiente al del vencimiento y hasta la fecha de su íntegro pago, un interés de demora pactado del 3% mensual sobre el importe total de la factura impagada.'}
            </Text>
          </View>

          {/* Mención legal */}
          {data.mencion_legal && (
            <View style={s.legal}>
              <Text style={s.legalText}>{data.mencion_legal}</Text>
            </View>
          )}

        </View>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{data.numero_completo}  ·  {fmtDate(data.fecha_emision)}</Text>
          <Text style={s.footerText}>{data.emisor_nombre}  ·  {data.emisor_nif}</Text>
        </View>

      </Page>
    </Document>
  )
}

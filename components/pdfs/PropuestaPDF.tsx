// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import { SERVICIOS_CONFIG, SERVICIO_IDS, fmtEur, calcPropuesta } from '@/lib/propuestas/config'
import type { ServicioId, ServicioEntry } from '@/lib/propuestas/config'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

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
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.ink,
    backgroundColor: C.white,
  },

  // Header
  headerBlock: {
    backgroundColor: C.headerBg,
    paddingTop: 32,
    paddingBottom: 0,
    paddingHorizontal: 56,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
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
    marginTop: 4,
    textAlign: 'right',
  },
  headerAccent: {
    height: 2,
    backgroundColor: C.brand,
    marginTop: 20,
    opacity: 0.7,
  },

  // Meta bar (client + propuesta info)
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  metaLabel: { fontSize: 7, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  metaValue: { fontSize: 9, color: C.ink, fontFamily: 'Helvetica-Bold' },
  metaValueLight: { fontSize: 9, color: C.soft },

  // Body
  body: { paddingHorizontal: 56 },

  // Intro letter
  introBlock: {
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  introText: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.65,
  },

  // Intro summary box
  summaryBox: {
    backgroundColor: C.light,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 0,
  },
  summaryItem: { flex: 1, paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: C.rule },
  summaryItemFirst: { flex: 1, paddingHorizontal: 12, borderLeftWidth: 0 },

  // Section dividers
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.brand,
    paddingTop: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    marginBottom: 14,
  },

  // Service block
  servicioBlock: { marginBottom: 28 },
  servicioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  servicioName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink },
  servicioPrecio: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.brand },
  servicioTexto: { fontSize: 8, color: C.soft, lineHeight: 1.6, marginBottom: 10 },

  // Entregables
  entregablesRow: { flexDirection: 'row', gap: 0, marginBottom: 10 },
  entregablesGroup: { flex: 1, paddingRight: 12 },
  entregablesGroupLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.mid, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  entregablesItem: { fontSize: 7.5, color: C.soft, marginBottom: 2, paddingLeft: 8 },

  // Timeline & payment
  detailRow: { flexDirection: 'row', marginTop: 8 },
  detailLabel: { fontSize: 7, color: C.meta, textTransform: 'uppercase', letterSpacing: 0.8, width: 72 },
  detailValue: { fontSize: 7.5, color: C.soft, flex: 1 },

  // Pago hitos
  pagoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.rule, gap: 8 },
  pagoLabel: { fontSize: 7.5, color: C.soft, flex: 1 },
  pagoPct: { fontSize: 7.5, color: C.soft, flexShrink: 0, textAlign: 'right', minWidth: 24 },
  pagoEur: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink, flexShrink: 0, textAlign: 'right', minWidth: 60 },

  // Totals table
  totalsBlock: { marginTop: 32 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.rule },
  totalRowFinal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: C.headerBg, marginTop: 4,
  },
  totalLabel: { fontSize: 8.5, color: C.soft },
  totalValue: { fontSize: 8.5, color: C.soft },
  totalFinalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.hInk },
  totalFinalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.brand },

  // Metodología de honorarios
  metodologiaBlock: {
    marginTop: 12,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
    backgroundColor: C.light,
  },
  metodologiaTitle: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metodologiaText: {
    fontSize: 7.5,
    color: C.soft,
    lineHeight: 1.65,
    marginBottom: 4,
  },
  metodologiaBullet: {
    fontSize: 7.5,
    color: C.soft,
    lineHeight: 1.6,
    marginLeft: 10,
    marginBottom: 2,
  },
  metodologiaAlert: {
    fontSize: 7.5,
    color: C.ink,
    lineHeight: 1.65,
    marginTop: 6,
    fontFamily: 'Helvetica-Oblique',
  },

  // Notas
  notasBlock: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.rule },
  notasTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.mid, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  notasText: { fontSize: 8, color: C.soft, lineHeight: 1.6 },

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
export interface PropuestaPDFData {
  numero:               string
  titulo:               string | null
  fecha_propuesta:      string | null
  direccion:            string | null
  notas:                string | null
  servicios:            ServicioId[]
  m2:                   number
  costo_m2:             number
  porcentaje_pem:       number
  pct_junior:           number
  pct_senior:           number
  pct_partner:          number
  semanas:              Record<string, string>
  ratios:               { label: string; servicio: ServicioId | null; ratio: number }[]
  honorarios_override:  Record<string, number>
  serviciosPlantilla:   ServicioEntry[]
  lead: {
    nombre:    string
    apellidos: string
    empresa:   string | null
    email:     string | null
    telefono:  string | null
    direccion: string | null
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Document ──────────────────────────────────────────────────────────────────
function sortServicios(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ia = SERVICIO_IDS.indexOf(a as ServicioId)
    const ib = SERVICIO_IDS.indexOf(b as ServicioId)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

export function PropuestaPDF({ data }: { data: PropuestaPDFData }) {
  const sortedServicios = sortServicios(data.servicios)
  const baseServicios = sortedServicios.filter(sid => sid in SERVICIOS_CONFIG) as ServicioId[]
  const { pem, honorariosPemBase, breakdown: autoBreakdown } = calcPropuesta({
    m2:            data.m2,
    costoM2:       data.costo_m2,
    porcentajePem: data.porcentaje_pem,
    servicios:     baseServicios,
    pctJunior:     data.pct_junior,
    pctSenior:     data.pct_senior,
    pctPartner:    data.pct_partner,
    ratios:        data.ratios,
  })

  // Apply manual overrides (for both base and custom services)
  const breakdown: Record<string, number> = { ...autoBreakdown }
  for (const [sid, amount] of Object.entries(data.honorarios_override)) {
    breakdown[sid] = amount
  }
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0)

  const clientName = data.lead
    ? [data.lead.nombre, data.lead.apellidos].filter(Boolean).join(' ') + (data.lead.empresa ? ` · ${data.lead.empresa}` : '')
    : 'Sin cliente'

  const clientAddress = data.direccion
    ?? data.lead?.direccion
    ?? '—'

  // Use provided date or today's date as emission date
  const fechaEmision = data.fecha_propuesta ?? new Date().toISOString().slice(0, 10)

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>GEINEX GROUP, S.L. · NIF B44873552 · contacto@formaprima.es</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  return (
    <Document title={`Propuesta ${data.numero} · Forma Prima`} author="Forma Prima">

      {/* ── PAGE 1: Portada + carta de presentación (sin margen superior para que el header llegue al borde) ── */}
      <Page size="A4" style={{ ...s.page, paddingTop: 0 }}>
        {/* Header */}
        <View style={s.headerBlock}>
          <View style={s.headerInner}>
            <Image src={LOGO_BLANCO} style={s.logo} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.headerTitle}>Propuesta de Honorarios</Text>
              <Text style={s.headerSub}>Taller de arquitectura y diseño</Text>
              {data.titulo && (
                <Text style={{ color: C.white, fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 10, textAlign: 'right', opacity: 0.95 }}>
                  {data.titulo}
                </Text>
              )}
            </View>
          </View>
          <View style={s.headerAccent} />
        </View>

        {/* Meta bar */}
        <View style={s.metaBar}>
          <View>
            <Text style={s.metaLabel}>Cliente</Text>
            <Text style={s.metaValue}>{clientName}</Text>
            {data.lead?.email && <Text style={{ ...s.metaValueLight, marginTop: 2 }}>{data.lead.email}</Text>}
            <Text style={{ ...s.metaValueLight, marginTop: 2 }}>{clientAddress}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.metaLabel}>Número</Text>
            <Text style={s.metaValue}>{data.numero}</Text>
            <Text style={{ ...s.metaLabel, marginTop: 10 }}>Fecha de emisión</Text>
            <Text style={s.metaValueLight}>{formatDate(fechaEmision)}</Text>
            {data.titulo && (
              <>
                <Text style={{ ...s.metaLabel, marginTop: 10 }}>Proyecto</Text>
                <Text style={s.metaValueLight}>{data.titulo}</Text>
              </>
            )}
          </View>
        </View>

        {/* Carta de presentación */}
        <View style={s.introBlock}>
          <Text style={s.introText}>
            {data.lead
              ? `Estimado/a ${[data.lead.nombre, data.lead.apellidos].filter(Boolean).join(' ')},`
              : 'Estimado/a cliente,'}
          </Text>
          <Text style={{ ...s.introText, marginTop: 8 }}>
            {`Nos complace presentarle la siguiente propuesta de honorarios${data.titulo ? ` para el proyecto "${data.titulo}"` : ''}. En Forma Prima entendemos cada espacio como una oportunidad única de transformar la vida de las personas, y es un placer poder acompañarle en este proceso.`}
          </Text>
          <Text style={{ ...s.introText, marginTop: 8 }}>
            A continuación encontrará el detalle de los servicios que conforman nuestra propuesta, junto con los entregables, plazos y condiciones de pago de cada fase. Quedamos a su entera disposición para resolver cualquier duda o adaptar la propuesta a sus necesidades.
          </Text>
          <Text style={{ ...s.introText, marginTop: 8 }}>
            Atentamente,{'\n'}El equipo de Forma Prima
          </Text>
        </View>

        {/* Resumen ejecutivo */}
        <View style={s.body}>
          <View style={s.summaryBox}>
            <View style={s.summaryItemFirst}>
              <Text style={s.metaLabel}>Superficie</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 2 }}>
                {data.m2.toLocaleString('es-ES')} m²
              </Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.metaLabel}>Precio objetivo €/m²</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 2 }}>
                {fmtEur(data.costo_m2)}
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: C.mid }}> + IVA</Text>
              </Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.metaLabel}>Objetivo de costo de obra</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 2 }}>
                {fmtEur(pem)}
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: C.mid }}> + IVA</Text>
              </Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.metaLabel}>Honorarios totales</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.brand, marginTop: 2 }}>
                {fmtEur(total)}
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: C.mid }}> + IVA</Text>
              </Text>
            </View>
          </View>

          {/* Metodología de honorarios */}
          {(() => {
            const pemServices = baseServicios.filter(sid => SERVICIOS_CONFIG[sid].tipo === 'pem')
            const includesDO  = pemServices.includes('direccion_obra' as ServicioId)
            if (pemServices.length === 0) return null

            const pctBase = data.porcentaje_pem

            return (
              <View style={s.metodologiaBlock}>
                <Text style={s.metodologiaTitle}>Metodología de cálculo de honorarios</Text>
                <Text style={s.metodologiaText}>
                  {`Los honorarios profesionales del presente encargo se calculan aplicando un porcentaje del ${pctBase}% sobre el Presupuesto de Ejecución Material (PEM) objetivo, determinado en ${fmtEur(pem)} en función de la superficie del proyecto (${data.m2.toLocaleString('es-ES')} m² × ${fmtEur(data.costo_m2)}/m²). Este criterio vincula directamente la retribución del Estudio al alcance y valor real de la obra, garantizando transparencia y proporcionalidad.`}
                </Text>
                <Text style={{ ...s.metodologiaText, marginTop: 4 }}>
                  El total de honorarios se distribuye entre las fases contratadas de la siguiente forma:
                </Text>
                {pemServices.map(sid => {
                  const cfg    = SERVICIOS_CONFIG[sid]
                  const importe = breakdown[sid] ?? 0
                  const pctFase = Math.round(cfg.pem_split * 100)
                  return (
                    <Text key={sid} style={s.metodologiaBullet}>
                      {`· ${cfg.label}  —  ${pctFase}% de los honorarios PEM  (${fmtEur(importe)} + IVA)`}
                    </Text>
                  )
                })}
                {includesDO && (
                  <Text style={s.metodologiaAlert}>
                    {'Revisión de PEM a la liquidación de obra: Con carácter previo al último pago de la Dirección Estética de Obra, las partes realizarán una revisión del coste real de ejecución material. En caso de que el PEM definitivo supere el objetivo de cálculo, el importe del último pago de dirección de obra se ajustará proporcionalmente al alza. No procederá reducción de honorarios por variación a la baja del PEM.'}
                  </Text>
                )}
              </View>
            )
          })()}
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 2+: Detalle de servicios (con margen superior en páginas de continuación) ── */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          {/* Servicios */}
          <Text style={s.sectionTitle}>Alcance de servicios</Text>

          {sortedServicios.map(sid => {
            const entry        = data.serviciosPlantilla.find(s => s.id === sid)
            const cfgBase      = SERVICIOS_CONFIG[sid as ServicioId]
            const label_       = entry?.label ?? cfgBase?.label ?? sid
            const texto_       = entry?.texto ?? cfgBase?.texto ?? ''
            const entregables_ = entry?.entregables ?? (cfgBase?.entregables as unknown as { grupo: string; items: string[] }[] ?? [])
            const pago_        = entry?.pago ?? (cfgBase?.pago as unknown as { label: string; pct: number }[] ?? [])
            const precio       = breakdown[sid] ?? 0
            const semanas      = data.semanas[sid] ?? entry?.semanas_default ?? cfgBase?.semanas_default ?? ''

            const col1 = entregables_.filter((_, i) => i % 2 === 0)
            const col2 = entregables_.filter((_, i) => i % 2 === 1)

            return (
              <View key={sid} style={s.servicioBlock} wrap={false}>
                <View style={s.servicioHeader}>
                  <Text style={s.servicioName}>{label_}</Text>
                  <Text style={s.servicioPrecio}>
                    {fmtEur(precio)}
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica', color: C.mid }}> + IVA</Text>
                  </Text>
                </View>

                {!!texto_ && <Text style={s.servicioTexto}>{texto_}</Text>}

                {entregables_.length > 0 && (
                  <View style={s.entregablesRow}>
                    <View style={s.entregablesGroup}>
                      {col1.map(g => (
                        <View key={g.grupo} style={{ marginBottom: 6 }}>
                          <Text style={s.entregablesGroupLabel}>{g.grupo}</Text>
                          {g.items.map(item => (
                            <Text key={item} style={s.entregablesItem}>· {item}</Text>
                          ))}
                        </View>
                      ))}
                    </View>
                    <View style={s.entregablesGroup}>
                      {col2.map(g => (
                        <View key={g.grupo} style={{ marginBottom: 6 }}>
                          <Text style={s.entregablesGroupLabel}>{g.grupo}</Text>
                          {g.items.map(item => (
                            <Text key={item} style={s.entregablesItem}>· {item}</Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Plazo</Text>
                  <Text style={s.detailValue}>{semanas}</Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={{ ...s.metaLabel, marginBottom: 4 }}>Hitos de pago</Text>
                  {pago_.map(p => (
                    <View key={p.label} style={s.pagoRow}>
                      <Text style={s.pagoLabel}>{p.label}</Text>
                      <Text style={s.pagoPct}>{p.pct}%</Text>
                      <Text style={s.pagoEur}>
                        {fmtEur(precio * p.pct / 100)}
                        <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: C.mid }}> + IVA</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}

          {/* Totals */}
          <View style={s.totalsBlock} wrap={false}>
            <Text style={s.sectionTitle}>Resumen económico</Text>
            {sortedServicios.map(sid => {
              const e   = data.serviciosPlantilla.find(s => s.id === sid)
              const lbl = e?.label ?? SERVICIOS_CONFIG[sid as ServicioId]?.label ?? sid
              const base = breakdown[sid] ?? 0
              return (
                <View key={sid} style={s.totalRow}>
                  <Text style={s.totalLabel}>{lbl}</Text>
                  <Text style={s.totalValue}>
                    {fmtEur(base)}
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: C.meta }}> + IVA</Text>
                  </Text>
                </View>
              )
            })}
            <View style={s.totalRowFinal}>
              <Text style={s.totalFinalLabel}>Total honorarios</Text>
              <Text style={s.totalFinalValue}>
                {fmtEur(total)}
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: C.hMid }}> + IVA</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.brand, marginTop: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white }}>Total IVA incluido</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white }}>{fmtEur(total * 1.21)}</Text>
            </View>
            <Text style={{ fontSize: 7, color: C.meta, marginTop: 8, lineHeight: 1.5 }}>
              Todos los importes indicados no incluyen IVA (21%). Se facturarán según los hitos de pago descritos en cada servicio.
              {data.m2 > 0 && ` Objetivo de costo de obra base de cálculo: ${fmtEur(pem)} (${data.m2} m² × ${fmtEur(data.costo_m2)}/m²).`}
            </Text>
          </View>

          {/* Notas */}
          {data.notas && (
            <View style={s.notasBlock} wrap={false}>
              <Text style={s.notasTitle}>Notas</Text>
              <Text style={s.notasText}>{data.notas}</Text>
            </View>
          )}
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

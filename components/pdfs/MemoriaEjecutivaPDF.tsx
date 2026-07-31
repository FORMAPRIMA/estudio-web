// Server-only — se renderiza dentro de API routes con @react-pdf/renderer.
//
// Tres salidas con el mismo componente:
//   · cliente   → memoria por estancias con PVP
//   · interno   → añade coste unitario, importe de coste y margen
//   · proveedor → orden de pedido de un solo proveedor, a coste, nunca con PVP

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import path from 'path'
import type { EjecutivoData } from '@/lib/memorias/pdfData'
import { pdfSafe } from './MemoriaAnteproyectoPDF'

const LOGO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

const C = {
  ink: '#1A1A1A',
  soft: '#444444',
  mid: '#777777',
  meta: '#AAAAAA',
  rule: '#E6E4DF',
  ruleSoft: '#F2F0EC',
  light: '#F8F7F4',
  white: '#FFFFFF',
  brand: '#D85A30',
  green: '#1D9E75',
}

const HEADER_H = 26
const FOOTER_H = 34

const s = StyleSheet.create({
  cover: { fontFamily: 'Helvetica', backgroundColor: C.ink, paddingHorizontal: 54, paddingVertical: 54 },
  coverInner: { flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%' },
  coverLogo: { width: 104, height: 25 },
  coverEyebrow: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 3.4, textTransform: 'uppercase', marginBottom: 14 },
  coverTitle: { fontSize: 34, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: -0.7, lineHeight: 1.1 },
  coverSub: { fontSize: 13, color: '#8A8A8A', marginTop: 14 },
  coverRule: { borderTopWidth: 1, borderTopColor: '#2E2E2E', paddingTop: 16, marginTop: 28 },
  coverMetaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  coverMetaItem: { marginRight: 32, marginBottom: 10, maxWidth: 190 },
  coverMetaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#4A4A4A', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  coverMetaValue: { fontSize: 9, color: '#9A9A9A' },

  page: {
    fontFamily: 'Helvetica', fontSize: 8, color: C.ink, backgroundColor: C.white,
    paddingTop: HEADER_H + 20, paddingBottom: FOOTER_H, paddingHorizontal: 36,
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
    backgroundColor: C.ink, paddingHorizontal: 36,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLogo: { width: 50, height: 12 },
  headerText: { fontSize: 6.5, color: '#6A6A6A', letterSpacing: 0.8 },
  footer: {
    position: 'absolute', bottom: 14, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 6,
  },
  footerText: { fontSize: 6, color: C.meta },

  estanciaHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 6, marginTop: 12,
  },
  estanciaNombre: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 0.3 },
  estanciaMeta: { fontSize: 7.5, color: '#8A8A8A' },

  thead: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.ink,
    paddingVertical: 4, paddingHorizontal: 6, backgroundColor: C.light,
  },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#999', letterSpacing: 0.9, textTransform: 'uppercase' },

  tr: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.ruleSoft,
    paddingVertical: 5, paddingHorizontal: 6,
  },
  thumb: { width: 34, height: 26, objectFit: 'cover', backgroundColor: C.light },
  thumbVacio: { width: 34, height: 26, backgroundColor: C.light },

  itemMarca: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 0.9, textTransform: 'uppercase' },
  itemNombre: { fontSize: 8.5, color: C.ink },
  itemDetalle: { fontSize: 7, color: C.mid, marginTop: 1 },
  itemRef: { fontSize: 6.5, color: C.meta, marginTop: 1 },

  celdaNum: { fontSize: 8, color: C.soft, textAlign: 'right' },
  celdaNumFuerte: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right' },
  celdaTexto: { fontSize: 7.5, color: C.mid },

  subtotal: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 6, backgroundColor: C.light,
  },
  subtotalLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.mid, letterSpacing: 0.9, textTransform: 'uppercase', marginRight: 10 },
  subtotalValor: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.ink },

  totalBox: { marginTop: 18, borderTopWidth: 1.4, borderTopColor: C.ink, paddingTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  totalLabel: { fontSize: 8, color: C.soft },
  totalLabelFuerte: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 0.9, textTransform: 'uppercase' },
  totalValor: { fontSize: 9, color: C.soft },
  totalValorFuerte: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.ink },

  nota: { marginTop: 16, backgroundColor: C.light, borderLeftWidth: 3, borderLeftColor: C.brand, padding: 12 },
  notaTitulo: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 },
  notaTexto: { fontSize: 7.8, color: C.soft, lineHeight: 1.6 },
})

function euros(n: number | null, decimales = 0): string {
  if (n == null) return '—'
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: 'always' })}`
}

function cantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function MemoriaEjecutivaPDF({ data }: { data: EjecutivoData }) {
  const { proyecto, fecha, modo, proveedorNombre, incluirCostes, estancias } = data
  const esProveedor = modo === 'proveedor'
  const titulo = esProveedor ? 'Orden de pedido' : 'Memoria de calidades'
  const subtitulo = esProveedor
    ? `Proyecto de ejecución · ${proveedorNombre ?? 'Proveedor'}`
    : `Proyecto de ejecución${incluirCostes ? ' · Documento interno' : ''}`

  return (
    <Document
      title={`${titulo} — ${proyecto.nombre}`}
      author="Forma Prima"
      subject={subtitulo}
    >
      {/* ── Portada ── */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverInner}>
          <Image src={LOGO} style={s.coverLogo} />
          <View>
            <Text style={s.coverEyebrow}>{titulo}</Text>
            <Text style={s.coverTitle}>{pdfSafe(proyecto.nombre)}</Text>
            <Text style={s.coverSub}>{pdfSafe(subtitulo)}</Text>
            <View style={s.coverRule}>
              <View style={s.coverMetaRow}>
                {proyecto.codigo && (
                  <View style={s.coverMetaItem}>
                    <Text style={s.coverMetaLabel}>Proyecto</Text>
                    <Text style={s.coverMetaValue}>{pdfSafe(proyecto.codigo)}</Text>
                  </View>
                )}
                {proyecto.direccion && (
                  <View style={s.coverMetaItem}>
                    <Text style={s.coverMetaLabel}>Emplazamiento</Text>
                    <Text style={s.coverMetaValue}>{pdfSafe(proyecto.direccion)}</Text>
                  </View>
                )}
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Fecha</Text>
                  <Text style={s.coverMetaValue}>{fechaLarga(fecha)}</Text>
                </View>
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Estancias</Text>
                  <Text style={s.coverMetaValue}>{estancias.length}</Text>
                </View>
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Unidades</Text>
                  <Text style={s.coverMetaValue}>{cantidad(data.totalUnidades)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ── Contenido ── */}
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Image src={LOGO} style={s.headerLogo} />
          <Text style={s.headerText}>
            {pdfSafe(proyecto.nombre).toUpperCase()} · {titulo.toUpperCase()}
            {esProveedor && proveedorNombre ? ` · ${pdfSafe(proveedorNombre).toUpperCase()}` : ''}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            GEINEX GROUP, S.L. · Forma Prima · {fechaLarga(fecha)}
            {incluirCostes ? ' · USO INTERNO' : ''}
          </Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

        {estancias.map(estancia => (
          <View key={estancia.nombre}>
            <View style={s.estanciaHeader} wrap={false}>
              <Text style={s.estanciaNombre}>{pdfSafe(estancia.nombre)}</Text>
              <Text style={s.estanciaMeta}>
                {estancia.items.length} elemento{estancia.items.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={s.thead} wrap={false}>
              <Text style={[s.th, { width: 40 }]} />
              <Text style={[s.th, { flex: 1 }]}>Elemento</Text>
              {esProveedor && <Text style={[s.th, { width: 74 }]}>Estancia</Text>}
              <Text style={[s.th, { width: 30, textAlign: 'right' }]}>Ud.</Text>
              {incluirCostes && <Text style={[s.th, { width: 52, textAlign: 'right' }]}>Coste</Text>}
              {!esProveedor && <Text style={[s.th, { width: 54, textAlign: 'right' }]}>PVP</Text>}
              <Text style={[s.th, { width: 62, textAlign: 'right' }]}>Importe</Text>
              {incluirCostes && !esProveedor && <Text style={[s.th, { width: 54, textAlign: 'right' }]}>Margen</Text>}
            </View>

            {estancia.items.map((item, i) => {
              const margen = item.importe_pvp - item.importe_coste
              return (
                <View key={`${estancia.nombre}-${i}`} style={s.tr} wrap={false}>
                  <View style={{ width: 40 }}>
                    {item.imagen ? <Image src={item.imagen} style={s.thumb} /> : <View style={s.thumbVacio} />}
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    {item.marca && <Text style={s.itemMarca}>{pdfSafe(item.marca)}</Text>}
                    <Text style={s.itemNombre}>{pdfSafe(item.nombre)}</Text>
                    {(item.modelo || item.acabado) && (
                      <Text style={s.itemDetalle}>
                        {[item.modelo, item.acabado].filter(Boolean).map(t => pdfSafe(t as string)).join(' · ')}
                      </Text>
                    )}
                    <Text style={s.itemRef}>
                      {[
                        item.referencia ? `Ref. ${pdfSafe(item.referencia)}` : null,
                        pdfSafe(item.subcapitulo),
                        !esProveedor && item.proveedor ? pdfSafe(item.proveedor) : null,
                      ].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>

                  {esProveedor && (
                    <Text style={[s.celdaTexto, { width: 74 }]}>{pdfSafe(item.estancia)}</Text>
                  )}

                  <Text style={[s.celdaNum, { width: 30 }]}>{cantidad(item.cantidad)}</Text>

                  {incluirCostes && (
                    <Text style={[s.celdaNum, { width: 52 }]}>{euros(item.precio_coste, 2)}</Text>
                  )}
                  {!esProveedor && (
                    <Text style={[s.celdaNum, { width: 54 }]}>{euros(item.precio_pvp, 2)}</Text>
                  )}
                  <Text style={[s.celdaNumFuerte, { width: 62 }]}>
                    {euros(esProveedor ? item.importe_coste : item.importe_pvp, 2)}
                  </Text>
                  {incluirCostes && !esProveedor && (
                    <Text style={[s.celdaNum, { width: 54, color: margen >= 0 ? C.green : '#DC2626' }]}>
                      {euros(margen, 2)}
                    </Text>
                  )}
                </View>
              )
            })}

            <View style={s.subtotal} wrap={false}>
              <Text style={s.subtotalLabel}>Subtotal {pdfSafe(estancia.nombre)}</Text>
              <Text style={s.subtotalValor}>
                {euros(esProveedor ? estancia.totalCoste : estancia.totalPvp, 2)} EUR
              </Text>
            </View>
          </View>
        ))}

        {/* ── Totales ── */}
        <View style={s.totalBox} wrap={false}>
          {esProveedor ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabelFuerte}>Total pedido (sin IVA)</Text>
              <Text style={s.totalValorFuerte}>{euros(data.totalCoste, 2)} EUR</Text>
            </View>
          ) : (
            <>
              {incluirCostes && (
                <>
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Coste total</Text>
                    <Text style={s.totalValor}>{euros(data.totalCoste, 2)} EUR</Text>
                  </View>
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Margen</Text>
                    <Text style={[s.totalValor, { color: data.totalMargen >= 0 ? C.green : '#DC2626' }]}>
                      {euros(data.totalMargen, 2)} EUR
                      {data.totalPvp > 0 ? `  (${((data.totalMargen / data.totalPvp) * 100).toFixed(1)}%)` : ''}
                    </Text>
                  </View>
                </>
              )}
              <View style={[s.totalRow, { marginTop: 6 }]}>
                <Text style={s.totalLabelFuerte}>Total (sin IVA)</Text>
                <Text style={s.totalValorFuerte}>{euros(data.totalPvp, 2)} EUR</Text>
              </View>
            </>
          )}
        </View>

        <View style={s.nota} wrap={false}>
          <Text style={s.notaTitulo}>{esProveedor ? 'Condiciones del pedido' : 'Alcance de este documento'}</Text>
          <Text style={s.notaTexto}>
            {esProveedor
              ? 'Relación de material solicitado para el proyecto indicado, con la asignación por estancia para facilitar la entrega y el montaje. Los importes recogen el precio acordado con Forma Prima, sin IVA. Cualquier sustitución de referencia o acabado debe validarse por escrito antes del suministro.'
              : 'Relación cerrada de los elementos previstos por estancia, con las cantidades y los acabados seleccionados. Los importes se expresan sin IVA. Las sustituciones por producto equivalente, si fueran necesarias por plazo de suministro o descatalogación, se comunicarán antes de su ejecución.'}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export default MemoriaEjecutivaPDF

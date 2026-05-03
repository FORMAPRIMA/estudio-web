// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'

const LOGO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoriaEjecutivaItem {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  imagen_principal_url: string | null
  imagen_lifestyle_url: string | null
  cantidad: number | null
  acabado_seleccionado: string | null
  ubicaciones: string[]
  precio_referencia: number | null
  moneda: string
  proveedor_nombre: string | null
  url_producto: string | null
  template_line_item_id: string
}

export interface MemoriaEjecutivaChapter {
  id: string
  nombre: string
  label_cliente: string | null
  units: {
    id: string
    nombre: string
    label_cliente: string | null
    line_items: { id: string; nombre: string }[]
  }[]
}

export interface MemoriaEjecutivaPDFData {
  proyecto: { nombre: string; codigo: string | null; nivel_calidad: string | null }
  items: MemoriaEjecutivaItem[]
  chapters: MemoriaEjecutivaChapter[]
  fecha: string
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  ink:   '#1A1A1A',
  soft:  '#555555',
  mid:   '#888888',
  meta:  '#AAAAAA',
  rule:  '#E6E4DF',
  light: '#F8F7F4',
  white: '#FFFFFF',
  brand: '#D85A30',
}

const NIVEL_LABEL: Record<string, string> = {
  functional: 'Functional', select: 'Select', master_piece: 'Masterpiece',
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(n) + ' €'
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 8, color: C.ink,
    backgroundColor: C.white, paddingBottom: 44,
  },

  // Cover
  cover: {
    backgroundColor: C.ink, paddingHorizontal: 48, paddingTop: 48, paddingBottom: 48,
    minHeight: '100%', flexDirection: 'column', justifyContent: 'flex-end',
  },
  coverLogo: { width: 90, height: 22, marginBottom: 72 },
  coverEyebrow: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand,
    letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10,
  },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 6 },
  coverCodigo: { fontSize: 9, color: '#666', marginBottom: 40 },
  coverRule: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 14 },
  coverMetaRow: { flexDirection: 'row' },
  coverMetaItem: { marginRight: 32 },
  coverMetaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  coverMetaValue: { fontSize: 8, color: '#888' },

  // Running header (fixed)
  pageHeader: {
    backgroundColor: C.ink, paddingHorizontal: 32, paddingVertical: 9,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pageHeaderLogo: { width: 52, height: 13 },
  pageHeaderTitle: { fontSize: 6.5, color: '#666' },

  // Column label bar
  colBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 32, paddingVertical: 5,
    borderBottomWidth: 1.5, borderBottomColor: C.ink,
    marginBottom: 0,
  },
  colLabel: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.meta, textTransform: 'uppercase', letterSpacing: 1 },

  // Chapter
  chapterBar: { backgroundColor: '#2A2A2A', paddingHorizontal: 32, paddingVertical: 7 },
  chapterName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white },
  chapterOriginal: { fontSize: 6, color: '#555', marginTop: 1 },

  // Unit
  unitBar: { backgroundColor: C.light, paddingHorizontal: 32, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.rule },
  unitName: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.soft },

  // Partida
  partidaBar: { paddingHorizontal: 32, paddingVertical: 3, backgroundColor: '#FAFAFA' },
  partidaName: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.meta, textTransform: 'uppercase', letterSpacing: 1 },

  // Item row
  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 32, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: C.rule,
  },
  thumb: { width: 42, height: 30, marginRight: 10, backgroundColor: C.light },
  thumbImg: { width: 42, height: 30, objectFit: 'cover' },
  identity: { flex: 2.2, paddingRight: 8 },
  iMarca: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 1 },
  iNombre: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 1 },
  iModelo: { fontSize: 7, color: C.soft, marginBottom: 1 },
  iRef: { fontSize: 6.5, color: C.meta, fontFamily: 'Helvetica-Oblique' },
  iProveedor: { fontSize: 6, color: '#BBB', marginTop: 2 },
  colCantidad: { width: 38, paddingRight: 8, alignItems: 'flex-end' },
  cantidadVal: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink },
  colAcabado: { flex: 1, paddingRight: 8 },
  acabadoVal: { fontSize: 7, color: C.soft },
  colUbicaciones: { flex: 1.5, paddingRight: 8 },
  ubVal: { fontSize: 6.5, color: C.soft },
  colPrice: { width: 62 },
  priceUnit: { fontSize: 6.5, color: C.mid, textAlign: 'right' },
  priceTotal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right', marginTop: 1 },

  // Subtotal row
  subtotalRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 32, paddingVertical: 5,
    backgroundColor: '#F5F4F0',
    borderBottomWidth: 1, borderBottomColor: C.rule,
  },
  subtotalLabel: { fontSize: 6.5, color: C.mid, marginRight: 10 },
  subtotalValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink },

  // Grand total
  grandTotal: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 32, paddingVertical: 10,
    borderTopWidth: 2, borderTopColor: C.ink, marginTop: 6,
  },
  grandTotalLabel: { fontSize: 8, color: C.mid, marginRight: 12 },
  grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink },

  // Footer (fixed)
  footer: {
    position: 'absolute', bottom: 16, left: 32, right: 32,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 5,
  },
  footerText: { fontSize: 6, color: C.meta },
})

// ── Component ─────────────────────────────────────────────────────────────────

export function MemoriaEjecutivaPDF({ data }: { data: MemoriaEjecutivaPDFData }) {
  const { proyecto, items, chapters, fecha } = data

  const total = items.reduce((acc, i) =>
    acc + (i.precio_referencia != null && i.cantidad != null ? i.precio_referencia * i.cantidad : 0), 0)

  const chaptersWithItems = chapters.filter(ch =>
    ch.units.some(u => u.line_items.some(li => items.some(i => i.template_line_item_id === li.id)))
  )

  return (
    <Document title={`Memoria Ejecutiva — ${proyecto.nombre}`}>

      {/* ── Cover ── */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <Image src={LOGO} style={s.coverLogo} />
          <Text style={s.coverEyebrow}>Memoria Ejecutiva de Calidad</Text>
          <Text style={s.coverTitle}>{proyecto.nombre}</Text>
          {proyecto.codigo && <Text style={s.coverCodigo}>{proyecto.codigo}</Text>}
          <View style={s.coverRule}>
            <View style={s.coverMetaRow}>
              {proyecto.nivel_calidad && (
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Nivel</Text>
                  <Text style={s.coverMetaValue}>{NIVEL_LABEL[proyecto.nivel_calidad] ?? proyecto.nivel_calidad}</Text>
                </View>
              )}
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Confirmados</Text>
                <Text style={s.coverMetaValue}>{items.length} productos</Text>
              </View>
              {total > 0 && (
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Total de referencia</Text>
                  <Text style={s.coverMetaValue}>{fmtEur(total)}</Text>
                </View>
              )}
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Fecha</Text>
                <Text style={s.coverMetaValue}>{fmtDate(fecha)}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ── Content ── */}
      <Page size="A4" style={s.page} wrap>
        <View style={s.pageHeader} fixed>
          <Image src={LOGO} style={s.pageHeaderLogo} />
          <Text style={s.pageHeaderTitle}>Memoria Ejecutiva · {proyecto.nombre}</Text>
        </View>

        <View style={s.colBar}>
          <View style={{ width: 52, marginRight: 0 }} />
          <View style={{ flex: 2.2, paddingRight: 8 }}><Text style={s.colLabel}>Producto</Text></View>
          <View style={{ width: 38, paddingRight: 8 }}><Text style={[s.colLabel, { textAlign: 'right' }]}>Ud.</Text></View>
          <View style={{ flex: 1, paddingRight: 8 }}><Text style={s.colLabel}>Acabado</Text></View>
          <View style={{ flex: 1.5, paddingRight: 8 }}><Text style={s.colLabel}>Ubicaciones</Text></View>
          <View style={{ width: 62 }}><Text style={[s.colLabel, { textAlign: 'right' }]}>Total ref.</Text></View>
        </View>

        {chaptersWithItems.map(chapter => {
          const chapterItems = items.filter(i =>
            chapter.units.some(u => u.line_items.some(li => li.id === i.template_line_item_id))
          )
          const chapterTotal = chapterItems.reduce((acc, i) =>
            acc + (i.precio_referencia != null && i.cantidad != null ? i.precio_referencia * i.cantidad : 0), 0)

          return (
            <View key={chapter.id}>
              <View style={s.chapterBar}>
                <Text style={s.chapterName}>{chapter.label_cliente ?? chapter.nombre}</Text>
                {chapter.label_cliente && <Text style={s.chapterOriginal}>{chapter.nombre}</Text>}
              </View>

              {chapter.units.map(unit => {
                const unitItems = items.filter(i => unit.line_items.some(li => li.id === i.template_line_item_id))
                if (unitItems.length === 0) return null

                return (
                  <View key={unit.id}>
                    <View style={s.unitBar}>
                      <Text style={s.unitName}>{unit.label_cliente ?? unit.nombre}</Text>
                    </View>

                    {unit.line_items.map(li => {
                      const liItems = items.filter(i => i.template_line_item_id === li.id)
                      if (liItems.length === 0) return null

                      return (
                        <View key={li.id}>
                          <View style={s.partidaBar}>
                            <Text style={s.partidaName}>{li.nombre}</Text>
                          </View>

                          {liItems.map(item => {
                            const img = item.imagen_principal_url ?? item.imagen_lifestyle_url
                            const itemTotal = item.precio_referencia != null && item.cantidad != null
                              ? item.precio_referencia * item.cantidad : null

                            return (
                              <View key={item.id} style={s.itemRow} wrap={false}>
                                <View style={s.thumb}>
                                  {img && <Image src={img} style={s.thumbImg} />}
                                </View>
                                <View style={s.identity}>
                                  {item.marca && <Text style={s.iMarca}>{item.marca}</Text>}
                                  <Text style={s.iNombre}>{item.nombre}</Text>
                                  {item.modelo && <Text style={s.iModelo}>{item.modelo}</Text>}
                                  {item.referencia && <Text style={s.iRef}>Ref. {item.referencia}</Text>}
                                  {item.proveedor_nombre && <Text style={s.iProveedor}>{item.proveedor_nombre}</Text>}
                                </View>
                                <View style={s.colCantidad}>
                                  {item.cantidad != null && <Text style={s.cantidadVal}>{item.cantidad}</Text>}
                                </View>
                                <View style={s.colAcabado}>
                                  {item.acabado_seleccionado && <Text style={s.acabadoVal}>{item.acabado_seleccionado}</Text>}
                                </View>
                                <View style={s.colUbicaciones}>
                                  {item.ubicaciones.length > 0 && <Text style={s.ubVal}>{item.ubicaciones.join(' · ')}</Text>}
                                </View>
                                <View style={s.colPrice}>
                                  {item.precio_referencia != null && <Text style={s.priceUnit}>{fmtEur(item.precio_referencia)}/ud</Text>}
                                  {itemTotal != null && <Text style={s.priceTotal}>{fmtEur(itemTotal)}</Text>}
                                </View>
                              </View>
                            )
                          })}
                        </View>
                      )
                    })}

                    {chapterTotal > 0 && (
                      <View style={s.subtotalRow}>
                        <Text style={s.subtotalLabel}>Subtotal {chapter.label_cliente ?? chapter.nombre}</Text>
                        <Text style={s.subtotalValue}>{fmtEur(chapterTotal)}</Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}

        {total > 0 && (
          <View style={s.grandTotal}>
            <Text style={s.grandTotalLabel}>Total de referencia</Text>
            <Text style={s.grandTotalValue}>{fmtEur(total)}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>GEINEX GROUP, S.L. · Forma Prima</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

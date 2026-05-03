// Server-only — only used inside API routes with @react-pdf/renderer
// Do NOT import this from client components

import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'

const LOGO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoriaAnteproyectoItem {
  id: string
  nombre: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  imagen_principal_url: string | null
  imagen_lifestyle_url: string | null
  precio_referencia: number | null
  moneda: string
  estado_definicion: string
  template_line_item_id: string
}

export interface MemoriaAnteproyectoChapter {
  id: string
  nombre: string
  label_cliente: string | null
  descripcion_cliente: string | null
  imagen_portada_url: string | null
  units: {
    id: string
    nombre: string
    label_cliente: string | null
    descripcion_cliente: string | null
    imagen_portada_url: string | null
    line_items: { id: string; nombre: string }[]
  }[]
}

export interface MemoriaAnteproyectoPDFData {
  proyecto: { nombre: string; codigo: string | null; nivel_calidad: string | null }
  items: MemoriaAnteproyectoItem[]
  chapters: MemoriaAnteproyectoChapter[]
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
  cream: '#F0EDE8',
}

const NIVEL_LABEL: Record<string, string> = {
  functional: 'Functional', select: 'Select', master_piece: 'Masterpiece',
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(n) + ' €'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', color: C.ink, backgroundColor: C.white, paddingBottom: 40,
  },

  // Cover page
  coverPage: { backgroundColor: C.ink },
  coverInner: {
    paddingHorizontal: 48, paddingTop: 48, paddingBottom: 48,
    flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100%',
  },
  coverLogo: { width: 90, height: 22, marginBottom: 80 },
  coverEyebrow: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 6 },
  coverCodigo: { fontSize: 9, color: '#666', marginBottom: 40 },
  coverRule: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 14 },
  coverMetaRow: { flexDirection: 'row' },
  coverMetaItem: { marginRight: 32 },
  coverMetaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  coverMetaValue: { fontSize: 8, color: '#888' },

  // Chapter intro page
  chapterPage: { backgroundColor: C.ink },
  chapterCoverImg: { width: '100%', height: 260, objectFit: 'cover', opacity: 0.45 },
  chapterCoverOverlay: { paddingHorizontal: 48, paddingTop: 32, paddingBottom: 48, flex: 1, justifyContent: 'flex-end' },
  chapterEyebrow: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  chapterTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 8 },
  chapterDesc: { fontSize: 9, color: '#888', maxWidth: 360 },

  // Content page
  contentPage: { backgroundColor: C.white, paddingBottom: 40 },
  pageHeader: {
    backgroundColor: C.ink, paddingHorizontal: 32, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 0,
  },
  pageHeaderLogo: { width: 52, height: 13 },
  pageHeaderTitle: { fontSize: 6.5, color: '#666' },

  // Unit header
  unitHeader: { paddingHorizontal: 32, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.rule },
  unitEyebrow: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  unitTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  unitDesc: { fontSize: 8, color: C.mid },

  // Items grid: 2 columns
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 28, paddingTop: 16 },

  // Single item card (half width)
  itemCard: { width: '48%', marginHorizontal: '1%', marginBottom: 20 },
  itemImage: { width: '100%', height: 130, objectFit: 'cover', backgroundColor: C.light, marginBottom: 8 },
  itemImagePlaceholder: { width: '100%', height: 130, backgroundColor: C.light, marginBottom: 8 },
  itemMarca: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  itemNombre: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 2 },
  itemModelo: { fontSize: 7.5, color: C.soft, marginBottom: 2 },
  itemRef: { fontSize: 7, color: C.meta, fontFamily: 'Helvetica-Oblique', marginBottom: 3 },
  itemDesc: { fontSize: 7, color: C.mid },
  itemPrice: { fontSize: 7, color: C.soft, marginTop: 4 },
  itemConfirmado: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#1D9E75', letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 },

  // Footer
  footer: {
    position: 'absolute', bottom: 14, left: 32, right: 32,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 5,
  },
  footerText: { fontSize: 6, color: C.meta },
})

// ── Component ─────────────────────────────────────────────────────────────────

export function MemoriaAnteproyectoPDF({ data }: { data: MemoriaAnteproyectoPDFData }) {
  const { proyecto, items, chapters, fecha } = data

  // Only non-descartado items
  const visibleItems = items.filter(i => i.estado_definicion !== 'descartado')

  const chaptersWithItems = chapters.filter(ch =>
    ch.units.some(u => u.line_items.some(li => visibleItems.some(i => i.template_line_item_id === li.id)))
  )

  const confirmados = visibleItems.filter(i => i.estado_definicion === 'confirmado').length

  return (
    <Document title={`Memoria de Calidad — ${proyecto.nombre}`}>

      {/* ── Cover ── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <Image src={LOGO} style={s.coverLogo} />
          <Text style={s.coverEyebrow}>Memoria de Calidad · Anteproyecto</Text>
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
                <Text style={s.coverMetaLabel}>Productos orientativos</Text>
                <Text style={s.coverMetaValue}>{visibleItems.length}</Text>
              </View>
              {confirmados > 0 && (
                <View style={s.coverMetaItem}>
                  <Text style={s.coverMetaLabel}>Confirmados</Text>
                  <Text style={s.coverMetaValue}>{confirmados}</Text>
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

      {/* ── Chapter pages ── */}
      {chaptersWithItems.map(chapter => {
        const chapterVisibleItems = visibleItems.filter(i =>
          chapter.units.some(u => u.line_items.some(li => li.id === i.template_line_item_id))
        )

        const chapterTitle = chapter.label_cliente ?? chapter.nombre

        // Collect all units with items for this chapter
        const unitsWithItems = chapter.units.filter(u =>
          u.line_items.some(li => visibleItems.some(i => i.template_line_item_id === li.id))
        )

        return [
          // Chapter intro page
          <Page key={`ch-${chapter.id}`} size="A4" style={s.chapterPage}>
            {chapter.imagen_portada_url && (
              <Image src={chapter.imagen_portada_url} style={s.chapterCoverImg} />
            )}
            <View style={chapter.imagen_portada_url ? s.chapterCoverOverlay : [s.chapterCoverOverlay, { paddingTop: 120 }]}>
              <Text style={s.chapterEyebrow}>{chapter.nombre}</Text>
              <Text style={s.chapterTitle}>{chapterTitle}</Text>
              {chapter.descripcion_cliente && (
                <Text style={s.chapterDesc}>{chapter.descripcion_cliente}</Text>
              )}
              <Text style={[s.coverMetaValue, { marginTop: 20 }]}>
                {chapterVisibleItems.length} producto{chapterVisibleItems.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </Page>,

          // Chapter content page(s)
          <Page key={`ch-content-${chapter.id}`} size="A4" style={s.contentPage} wrap>
            <View style={s.pageHeader} fixed>
              <Image src={LOGO} style={s.pageHeaderLogo} />
              <Text style={s.pageHeaderTitle}>{proyecto.nombre} · {chapterTitle}</Text>
            </View>

            {unitsWithItems.map(unit => {
              const unitItems = visibleItems.filter(i =>
                unit.line_items.some(li => li.id === i.template_line_item_id)
              )
              const unitTitle = unit.label_cliente ?? unit.nombre

              return (
                <View key={unit.id}>
                  {/* Unit header */}
                  <View style={s.unitHeader}>
                    {unit.label_cliente && (
                      <Text style={s.unitEyebrow}>{unit.nombre}</Text>
                    )}
                    <Text style={s.unitTitle}>{unitTitle}</Text>
                    {unit.descripcion_cliente && (
                      <Text style={s.unitDesc}>{unit.descripcion_cliente}</Text>
                    )}
                  </View>

                  {/* Items grid */}
                  <View style={s.itemsGrid}>
                    {unitItems.map(item => {
                      const img = item.imagen_lifestyle_url ?? item.imagen_principal_url

                      return (
                        <View key={item.id} style={s.itemCard} wrap={false}>
                          {img
                            ? <Image src={img} style={s.itemImage} />
                            : <View style={s.itemImagePlaceholder} />
                          }
                          {item.marca && <Text style={s.itemMarca}>{item.marca}</Text>}
                          <Text style={s.itemNombre}>{item.nombre}</Text>
                          {item.modelo && <Text style={s.itemModelo}>{item.modelo}</Text>}
                          {item.referencia && <Text style={s.itemRef}>Ref. {item.referencia}</Text>}
                          {item.descripcion && <Text style={s.itemDesc}>{item.descripcion}</Text>}
                          {item.precio_referencia != null && (
                            <Text style={s.itemPrice}>{fmtEur(item.precio_referencia)}</Text>
                          )}
                          {item.estado_definicion === 'confirmado' && (
                            <Text style={s.itemConfirmado}>Confirmado</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            })}

            <View style={s.footer} fixed>
              <Text style={s.footerText}>GEINEX GROUP, S.L. · Forma Prima · Memoria de Calidad</Text>
              <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </View>
          </Page>,
        ]
      })}
    </Document>
  )
}

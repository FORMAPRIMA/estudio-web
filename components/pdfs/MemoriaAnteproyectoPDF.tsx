// Server-only — se renderiza dentro de API routes con @react-pdf/renderer.
// No importar desde componentes cliente.

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import path from 'path'
import type { AnteproyectoData } from '@/lib/memorias/pdfData'

const LOGO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

const C = {
  ink: '#1A1A1A',
  soft: '#444444',
  mid: '#777777',
  meta: '#AAAAAA',
  rule: '#E6E4DF',
  light: '#F8F7F4',
  white: '#FFFFFF',
  brand: '#D85A30',
}

// Helvetica no tiene flechas ni símbolos matemáticos: se cambian por equivalentes
export function pdfSafe(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .replace(/[→⇒]/g, '>')
    .replace(/[←]/g, '<')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[≈~]/g, 'aprox. ')
    .replace(/[★☆✓✗⚠•·–—]/g, m => ({ '★': '*', '☆': '*', '✓': 'OK', '✗': 'X', '⚠': '!', '•': '-', '·': '-', '–': '-', '—': '-' }[m] ?? '-'))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
}

const HEADER_H = 26
const FOOTER_H = 34

const s = StyleSheet.create({
  // Portada: página propia, sin banda fija
  cover: { fontFamily: 'Helvetica', backgroundColor: C.ink, paddingHorizontal: 54, paddingVertical: 54 },
  coverInner: { flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%' },
  coverLogo: { width: 104, height: 25 },
  coverEyebrow: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 3.4, textTransform: 'uppercase', marginBottom: 14 },
  coverTitle: { fontSize: 38, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: -0.8, lineHeight: 1.08 },
  coverNivel: { fontSize: 13, color: '#8A8A8A', marginTop: 14 },
  coverRule: { borderTopWidth: 1, borderTopColor: '#2E2E2E', paddingTop: 16, marginTop: 30 },
  coverMetaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  coverMetaItem: { marginRight: 34, marginBottom: 10, maxWidth: 200 },
  coverMetaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#4A4A4A', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  coverMetaValue: { fontSize: 9, color: '#9A9A9A' },

  // Páginas de contenido: el padding reserva las bandas fijas
  page: {
    fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white,
    paddingTop: HEADER_H + 22, paddingBottom: FOOTER_H, paddingHorizontal: 44,
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
    backgroundColor: C.ink, paddingHorizontal: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLogo: { width: 50, height: 12 },
  headerText: { fontSize: 6.5, color: '#6A6A6A', letterSpacing: 0.8 },
  footer: {
    position: 'absolute', bottom: 14, left: 44, right: 44,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 6,
  },
  footerText: { fontSize: 6, color: C.meta },

  capituloBloque: { marginTop: 6, marginBottom: 14 },
  capituloNum: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 2.4 },
  capituloNombre: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 3, letterSpacing: -0.3 },
  capituloRule: { borderBottomWidth: 1.4, borderBottomColor: C.ink, marginTop: 8 },

  item: { marginBottom: 26 },
  itemImagen: { width: '100%', height: 208, objectFit: 'cover', backgroundColor: C.light },
  itemSinImagen: {
    width: '100%', height: 96, backgroundColor: C.light,
    alignItems: 'center', justifyContent: 'center',
  },
  itemSinImagenTexto: { fontSize: 7, color: '#C8C8C8', letterSpacing: 1.6, textTransform: 'uppercase' },
  itemCuerpo: { flexDirection: 'row', marginTop: 10 },
  itemTextos: { flex: 1, paddingRight: 16 },
  itemEyebrow: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  itemMarca: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
  itemNombre: { fontSize: 13.5, color: C.ink, lineHeight: 1.25 },
  itemModelo: { fontSize: 9, color: C.mid, marginTop: 2 },
  itemDescripcion: { fontSize: 8.8, color: C.soft, lineHeight: 1.6, marginTop: 7 },
  itemDatos: { fontSize: 7.5, color: C.meta, marginTop: 6 },
  itemPrecio: { width: 92, alignItems: 'flex-end' },
  itemPrecioValor: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.ink },
  itemPrecioLabel: { fontSize: 6, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 },

  cierre: { marginTop: 12, backgroundColor: C.light, borderLeftWidth: 3, borderLeftColor: C.brand, padding: 14 },
  cierreTitulo: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 },
  cierreTexto: { fontSize: 8.2, color: C.soft, lineHeight: 1.6 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1.4, borderTopColor: C.ink, paddingTop: 10, marginTop: 6,
  },
  totalLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 1.4, textTransform: 'uppercase' },
  totalValor: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.ink },
})

function euros(n: number | null): string {
  if (n == null) return '—'
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: 'always' })} EUR`
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function MemoriaAnteproyectoPDF({ data }: { data: AnteproyectoData }) {
  const { proyecto, nivelLabel, fecha, capitulos, incluirPrecios, totalPvp } = data
  const totalItems = capitulos.reduce((n, c) => n + c.items.length, 0)

  return (
    <Document
      title={`Memoria de calidades — ${proyecto.nombre}`}
      author="Forma Prima"
      subject={`Anteproyecto · nivel ${nivelLabel}`}
    >
      {/* ── Portada ── */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverInner}>
          <Image src={LOGO} style={s.coverLogo} />
          <View>
            <Text style={s.coverEyebrow}>Memoria de calidades</Text>
            <Text style={s.coverTitle}>{pdfSafe(proyecto.nombre)}</Text>
            <Text style={s.coverNivel}>Anteproyecto · Nivel {nivelLabel}</Text>
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
                  <Text style={s.coverMetaLabel}>Elementos</Text>
                  <Text style={s.coverMetaValue}>{totalItems}</Text>
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
            {pdfSafe(proyecto.nombre).toUpperCase()} · ANTEPROYECTO · {nivelLabel.toUpperCase()}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>GEINEX GROUP, S.L. · Forma Prima · {fechaLarga(fecha)}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

        {capitulos.map(capitulo => (
          <View key={`${capitulo.numero}-${capitulo.nombre}`}>
            <View style={s.capituloBloque} wrap={false}>
              <Text style={s.capituloNum}>
                CAPÍTULO {String(capitulo.numero).padStart(2, '0')}
              </Text>
              <Text style={s.capituloNombre}>{pdfSafe(capitulo.nombre)}</Text>
              <View style={s.capituloRule} />
            </View>

            {capitulo.items.map((item, i) => (
              <View key={`${capitulo.numero}-${i}`} style={s.item} wrap={false}>
                {item.imagen ? (
                  <Image src={item.imagen} style={s.itemImagen} />
                ) : (
                  <View style={s.itemSinImagen}>
                    <Text style={s.itemSinImagenTexto}>Imagen pendiente</Text>
                  </View>
                )}
                <View style={s.itemCuerpo}>
                  <View style={s.itemTextos}>
                    <Text style={s.itemEyebrow}>{pdfSafe(item.subcapitulo)}</Text>
                    {item.marca && <Text style={s.itemMarca}>{pdfSafe(item.marca)}</Text>}
                    <Text style={s.itemNombre}>{pdfSafe(item.nombre)}</Text>
                    {item.modelo && <Text style={s.itemModelo}>{pdfSafe(item.modelo)}</Text>}
                    {item.descripcion && <Text style={s.itemDescripcion}>{pdfSafe(item.descripcion)}</Text>}
                    {item.acabados.length > 0 && (
                      <Text style={s.itemDatos}>Acabados: {pdfSafe(item.acabados.join(' / '))}</Text>
                    )}
                  </View>
                  {incluirPrecios && item.precio_pvp != null && (
                    <View style={s.itemPrecio}>
                      <Text style={s.itemPrecioValor}>{euros(item.precio_pvp)}</Text>
                      <Text style={s.itemPrecioLabel}>Unidad</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}

        {incluirPrecios && totalPvp != null && (
          <View style={s.totalRow} wrap={false}>
            <Text style={s.totalLabel}>Total orientativo por unidad de cada elemento</Text>
            <Text style={s.totalValor}>{euros(totalPvp)}</Text>
          </View>
        )}

        <View style={s.cierre} wrap={false}>
          <Text style={s.cierreTitulo}>Alcance de este documento</Text>
          <Text style={s.cierreTexto}>
            Las marcas y modelos recogidos definen el nivel de calidad {nivelLabel} previsto para el proyecto y
            tienen carácter orientativo. Podrán sustituirse por productos equivalentes en calidad, prestaciones y
            acabado, y quedarán definidos de forma cerrada en la memoria de calidades de proyecto de ejecución,
            junto con las cantidades y la asignación por estancia.
            {incluirPrecios ? ' Los importes indicados son de referencia y no constituyen oferta económica.' : ''}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export default MemoriaAnteproyectoPDF

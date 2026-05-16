// ══════════════════════════════════════════════════════════════════════════════
// Obra — Acta de Modificación (cliente o interna)
//
// Server-only. Genera el PDF inmutable que documenta los cambios de una sesión
// de cambios de presupuesto, agrupados por destino (cliente / interna).
// Patrón idéntico al resto de PDFs FPE: import dinámico de @react-pdf/renderer
// para evitar top-level await en el bundle.
// ══════════════════════════════════════════════════════════════════════════════

import path from 'path'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// Palette (compartida con resto de PDFs FPE)
const C = {
  headerBg: '#1A1A1A',
  brand:    '#D85A30',
  ink:      '#1A1A1A',
  soft:     '#3A3A3A',
  mid:      '#7A7A7A',
  meta:     '#AAAAAA',
  rule:     '#E6E4DF',
  light:    '#F8F7F4',
  lighter:  '#FCFBF8',
  white:    '#FFFFFF',
  hInk:     '#F0EDE8',
  hMid:     '#888580',
  hMuted:   '#555250',
  positive: '#059669',
  negative: '#DC2626',
}

// ── Tipos de entrada ────────────────────────────────────────────────────────

export interface ObraActaChange {
  id:              string
  change_type:     'edit_partida' | 'new_partida' | 'new_unit' | 'delete_partida' | 'delete_unit'
  categoria:       'a_peticion_cliente' | 'imprevisto' | 'ajuste'
  sub_categoria:   'trasladable_cliente' | 'costo_empresa' | null
  razon:           string
  delta_monto:     number
  capitulo_nombre: string
  unidad_nombre:   string
  partida_nombre:  string | null
  unidad_medida:   string | null
  old_value:       Record<string, unknown> | null
  new_value:       Record<string, unknown> | null
}

export interface ObraActaPDFData {
  kind:                'cliente' | 'interna'
  codigo:              string
  generated_at:        string                  // ISO timestamp
  total_delta_monto:   number
  project: {
    nombre:    string
    direccion: string | null
    ciudad:    string | null
  }
  client?: {                                   // sólo si kind = 'cliente'
    nombre:    string
    nif:       string | null
    direccion: string | null
  }
  changes: ObraActaChange[]
}

const euros = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const formatNumber = (n: number, max = 3) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: max })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const categoriaLabel = (c: ObraActaChange['categoria']): string => ({
  a_peticion_cliente: 'A petición de cliente',
  imprevisto:         'Imprevisto',
  ajuste:             'Ajuste',
}[c])

const subLabel = (s: ObraActaChange['sub_categoria']): string | null => {
  if (!s) return null
  return s === 'trasladable_cliente' ? 'Trasladable al cliente' : 'A costo de empresa'
}

const typeLabel = (t: ObraActaChange['change_type']): string => ({
  edit_partida:   'Modificación de partida',
  new_partida:    'Nueva partida',
  new_unit:       'Nueva unidad de ejecución',
  delete_partida: 'Eliminación de partida',
  delete_unit:    'Eliminación de unidad de ejecución',
}[t])

// ══════════════════════════════════════════════════════════════════════════════
// Generación del PDF
// ══════════════════════════════════════════════════════════════════════════════

export async function generateObraActaPDF(data: ObraActaPDFData): Promise<Buffer> {
  const rpdf = await import('@react-pdf/renderer')
  const { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } = rpdf

  const s = StyleSheet.create({
    page: {
      paddingTop: 0, paddingBottom: 64, paddingHorizontal: 0,
      fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white,
    },
    // Header
    header: { backgroundColor: C.headerBg, paddingTop: 32, paddingBottom: 22, paddingHorizontal: 48 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 110, height: 'auto', marginBottom: 10 },
    docKind: { color: C.hMuted, fontSize: 7, letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'right' },
    docTitle: { color: C.hInk, fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3, textAlign: 'right', marginTop: 4 },
    docNum: { color: C.brand, fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginTop: 4 },
    docMeta: { color: C.hMid, fontSize: 8, textAlign: 'right', marginTop: 6 },
    headerAccent: { height: 2, backgroundColor: C.brand },
    // Meta band
    metaBand: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 48, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.rule },
    metaCol: { flexDirection: 'column' },
    metaLabel: { fontSize: 6.5, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
    metaValue: { fontSize: 9, color: C.ink, fontFamily: 'Helvetica-Bold' },
    metaValueLight: { fontSize: 8.5, color: C.soft, marginTop: 1 },
    // Body
    body: { paddingHorizontal: 48, paddingTop: 18 },
    sectionTitle: {
      fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.8,
      textTransform: 'uppercase', color: C.brand,
      paddingTop: 14, paddingBottom: 7,
      borderBottomWidth: 1, borderBottomColor: C.rule, marginBottom: 12,
    },
    intro: {
      fontSize: 9, color: C.soft, lineHeight: 1.55, marginBottom: 14,
    },
    // Total band
    totalBand: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: C.headerBg, paddingVertical: 14, paddingHorizontal: 20, marginTop: 4, marginBottom: 20,
    },
    totalBandLabel: { color: C.hInk, fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
    totalBandValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
    // Change card
    changeCard: {
      borderLeftWidth: 2, borderLeftColor: C.brand,
      paddingLeft: 12, paddingRight: 4,
      paddingVertical: 10, marginBottom: 12,
      backgroundColor: C.lighter,
    },
    changeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    changeType: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.2, textTransform: 'uppercase' },
    changeDelta: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    changePath: { fontSize: 8.5, color: C.soft, marginBottom: 4 },
    changeName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 6 },
    changeRow: { flexDirection: 'row', marginBottom: 3 },
    changeLabel: { fontSize: 7, color: C.meta, letterSpacing: 1, textTransform: 'uppercase', width: 90 },
    changeValue: { fontSize: 8.5, color: C.soft, flex: 1 },
    changeReason: { fontSize: 8.5, color: C.ink, marginTop: 4, lineHeight: 1.5, fontFamily: 'Helvetica-Oblique' },
    badge: {
      fontSize: 7, color: '#fff', backgroundColor: C.soft,
      paddingVertical: 2, paddingHorizontal: 6,
      borderRadius: 2,
      marginRight: 4,
    },
    badgeRow: { flexDirection: 'row', marginTop: 4, flexWrap: 'wrap', gap: 4 },
    // Signature
    sigArea: { marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.rule },
    sigGrid: { flexDirection: 'row', gap: 24, marginTop: 14 },
    sigBox: { flex: 1, borderTopWidth: 0.5, borderTopColor: C.mid, paddingTop: 6 },
    sigLabel: { fontSize: 7, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase' },
    sigName: { fontSize: 9, color: C.ink, marginTop: 3, fontFamily: 'Helvetica-Bold' },
    sigAnchor: { fontSize: 4, color: '#FFFFFF', marginTop: 28 },     // invisible anchor for DocuSign
    // Footer
    footer: {
      position: 'absolute', bottom: 28, left: 48, right: 48,
      flexDirection: 'row', justifyContent: 'space-between',
      fontSize: 7, color: C.meta,
    },
  })

  const isCliente = data.kind === 'cliente'
  const totalColor = data.total_delta_monto >= 0 ? C.brand : '#86EFAC'
  const titleText  = isCliente ? 'Acta de modificación' : 'Acta interna de modificación'
  const introText  = isCliente
    ? `La presente acta documenta los cambios acordados en el alcance de obra del proyecto referenciado, ya sea solicitados directamente por la propiedad o aceptados por ésta como trasladables. La firma de este documento por las partes confirma la aceptación del nuevo alcance económico para los conceptos detallados a continuación.`
    : `Acta interna de control de cambios. Recoge modificaciones del alcance de obra cuyo coste asume Forma Prima o que se computan como ajustes operativos. Documento de gestión interna; no requiere firma del cliente. El detalle puede ser referido al cliente en la fase de cierre de obra a efectos de liquidación final.`

  const Element = (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <Image style={s.logo} src={LOGO_BLANCO} />
            <View>
              <Text style={s.docKind}>{isCliente ? 'Cliente' : 'Interna'}</Text>
              <Text style={s.docTitle}>{titleText}</Text>
              <Text style={s.docNum}>{data.codigo}</Text>
              <Text style={s.docMeta}>Generada el {fmtDate(data.generated_at)}</Text>
            </View>
          </View>
        </View>
        <View style={s.headerAccent} />

        {/* Meta band */}
        <View style={s.metaBand}>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Proyecto</Text>
            <Text style={s.metaValue}>{data.project.nombre}</Text>
            {(data.project.direccion || data.project.ciudad) && (
              <Text style={s.metaValueLight}>
                {[data.project.direccion, data.project.ciudad].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          {isCliente && data.client && (
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>Cliente</Text>
              <Text style={s.metaValue}>{data.client.nombre}</Text>
              {data.client.nif && <Text style={s.metaValueLight}>NIF: {data.client.nif}</Text>}
            </View>
          )}
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text style={s.sectionTitle}>Objeto del acta</Text>
          <Text style={s.intro}>{introText}</Text>

          {/* Total band */}
          <View style={s.totalBand}>
            <Text style={s.totalBandLabel}>Modificación total</Text>
            <Text style={[s.totalBandValue, { color: totalColor }]}>
              {data.total_delta_monto >= 0 ? '+' : ''}{euros(data.total_delta_monto)}
            </Text>
          </View>

          {/* Section: cambios */}
          <Text style={s.sectionTitle}>Detalle de cambios · {data.changes.length}</Text>
          {data.changes.map(ch => {
            const deltaColor = ch.delta_monto > 0 ? C.brand : ch.delta_monto < 0 ? C.positive : C.mid
            const ov = ch.old_value as { cantidad?: number; precio_unitario?: number } | null
            const nv = ch.new_value as { cantidad?: number; precio_unitario?: number; nombre?: string; unidad_medida?: string; descripcion?: string | null } | null
            const partidaTitle = ch.partida_nombre
              ?? (nv?.nombre as string | undefined)
              ?? '—'
            return (
              <View key={ch.id} style={s.changeCard} wrap={false}>
                <View style={s.changeHeader}>
                  <Text style={s.changeType}>{typeLabel(ch.change_type)}</Text>
                  <Text style={[s.changeDelta, { color: deltaColor }]}>
                    {ch.delta_monto > 0 ? '+' : ''}{euros(ch.delta_monto)}
                  </Text>
                </View>
                <Text style={s.changePath}>
                  {ch.capitulo_nombre} · {ch.unidad_nombre}
                </Text>
                <Text style={s.changeName}>{partidaTitle}</Text>

                {/* Antes/después para edits */}
                {ch.change_type === 'edit_partida' && ov && nv && (
                  <>
                    <View style={s.changeRow}>
                      <Text style={s.changeLabel}>Cantidad</Text>
                      <Text style={s.changeValue}>
                        {formatNumber(Number(ov.cantidad ?? 0))} {ch.unidad_medida ?? ''} → {formatNumber(Number(nv.cantidad ?? 0))} {ch.unidad_medida ?? ''}
                      </Text>
                    </View>
                    <View style={s.changeRow}>
                      <Text style={s.changeLabel}>Precio ud.</Text>
                      <Text style={s.changeValue}>
                        {euros(Number(ov.precio_unitario ?? 0))} → {euros(Number(nv.precio_unitario ?? 0))}
                      </Text>
                    </View>
                  </>
                )}

                {/* Detalle para new_partida */}
                {ch.change_type === 'new_partida' && nv && (
                  <>
                    <View style={s.changeRow}>
                      <Text style={s.changeLabel}>Cantidad</Text>
                      <Text style={s.changeValue}>
                        {formatNumber(Number(nv.cantidad ?? 0))} {(nv.unidad_medida as string | undefined) ?? ''}
                      </Text>
                    </View>
                    <View style={s.changeRow}>
                      <Text style={s.changeLabel}>Precio ud.</Text>
                      <Text style={s.changeValue}>{euros(Number(nv.precio_unitario ?? 0))}</Text>
                    </View>
                  </>
                )}

                {/* Detalle para new_unit */}
                {ch.change_type === 'new_unit' && nv && (
                  <View style={s.changeRow}>
                    <Text style={s.changeLabel}>Descripción</Text>
                    <Text style={s.changeValue}>{(nv.descripcion as string | undefined) ?? '—'}</Text>
                  </View>
                )}

                {/* Categorías */}
                <View style={s.badgeRow}>
                  <Text style={[s.badge, { backgroundColor: C.brand }]}>{categoriaLabel(ch.categoria)}</Text>
                  {subLabel(ch.sub_categoria) && (
                    <Text style={s.badge}>{subLabel(ch.sub_categoria)}</Text>
                  )}
                </View>

                <Text style={s.changeReason}>“{ch.razon}”</Text>
              </View>
            )
          })}

          {/* Firma (sólo cliente) */}
          {isCliente && (
            <View style={s.sigArea} wrap={false}>
              <Text style={s.sectionTitle}>Conformidad de las partes</Text>
              <View style={s.sigGrid}>
                <View style={s.sigBox}>
                  <Text style={s.sigLabel}>Por la propiedad</Text>
                  <Text style={s.sigName}>{data.client?.nombre ?? '—'}</Text>
                  <Text style={s.sigAnchor}>«FP_FIRMA_CLIENTE»</Text>
                </View>
                <View style={s.sigBox}>
                  <Text style={s.sigLabel}>Por Forma Prima</Text>
                  <Text style={s.sigName}>GEINEX GROUP, S.L.</Text>
                  <Text style={s.sigAnchor}>«FP_FIRMA_ESTUDIO»</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>GEINEX GROUP, S.L. · NIF B44873552 · CL/ Ppe de Vergara 56, 28006 Madrid</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )

  return await renderToBuffer(Element)
}

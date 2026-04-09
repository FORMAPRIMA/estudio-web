// Server-only PDF definition.
// This file has NO imports from @react-pdf/renderer.
// The caller (actas.ts) passes the already-dynamically-imported pdf modules in,
// so @react-pdf/renderer is only ever loaded via the dynamic import in the server action.

import path from 'path'
import type * as ReactPDF from '@react-pdf/renderer'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

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
}

export interface ActaData {
  proyecto_nombre: string
  proyecto_codigo: string | null
  proyecto_direccion: string | null
  fecha: string
  asistentes: { nombre: string; tipo: 'equipo' | 'cliente' | 'proveedor' | 'externo' }[]
  estado_obras: string
  instrucciones: string
  floorfy_url?: string | null
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fmtDateEs(d: string): string {
  const [y, m, day] = d.split('-')
  const mes = MESES_ES[parseInt(m, 10) - 1] ?? m
  return `${parseInt(day, 10)} de ${mes} de ${y}`
}

const TIPO_ORDER: Array<'equipo' | 'cliente' | 'proveedor' | 'externo'> = ['equipo', 'cliente', 'proveedor', 'externo']
const TIPO_LABELS: Record<string, string> = { equipo: 'Equipo', cliente: 'Clientes', proveedor: 'Proveedores', externo: 'Externos' }

// ── Factory: called AFTER @react-pdf/renderer has been dynamically imported ───

export function buildActaVisitaObraElement(
  pdf: typeof ReactPDF,
  data: ActaData
): ReactPDF.DocumentProps & React.ReactElement {
  const { Document, Page, View, Text, Image, StyleSheet, Link } = pdf

  const s = StyleSheet.create({
    page:           { paddingTop: 40, paddingBottom: 64, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white },
    headerBlock:    { backgroundColor: C.headerBg, paddingTop: 40, paddingBottom: 0, paddingHorizontal: 56 },
    headerInner:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    headerLeft:     { flexDirection: 'column' },
    logo:           { width: 110, objectFit: 'contain', marginBottom: 10 },
    actaLabel:      { fontSize: 6.5, color: C.brand, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase' },
    headerRight:    { alignItems: 'flex-end', paddingTop: 2 },
    headerDate:     { fontSize: 9, color: C.hInk, textAlign: 'right', lineHeight: 1.5 },
    headerAccent:   { height: 2, backgroundColor: C.brand },
    body:           { paddingHorizontal: 56, paddingTop: 28 },
    projectBlock:   { backgroundColor: C.light, paddingHorizontal: 56, paddingVertical: 20 },
    projectLabel:   { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8 },
    projectNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 5 },
    projectName:    { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.ink },
    projectCode:    { fontSize: 8.5, color: C.mid, fontFamily: 'Helvetica' },
    projectDir:     { fontSize: 8, color: C.mid, lineHeight: 1.5 },
    rule:           { height: 1, backgroundColor: C.rule, marginVertical: 16 },
    sectionLabel:   { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 10 },
    tipoLabel:      { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.meta, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
    tipoRow:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 4 },
    chip:           { fontSize: 8, color: C.soft, lineHeight: 1.5 },
    bodyText:       { fontSize: 9, color: C.soft, lineHeight: 1.7 },
    floorfyRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    floorfyLink:    { fontSize: 9, color: C.brand },
    footer:         { position: 'absolute', bottom: 28, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 7, borderTopWidth: 1, borderTopColor: C.brand },
    footerText:     { fontSize: 6.5, color: C.meta },
    footerCenter:   { fontSize: 6.5, color: C.meta, textAlign: 'center' },
  })

  const byTipo = TIPO_ORDER.reduce<Record<string, string[]>>((acc, tipo) => {
    const names = data.asistentes.filter(a => a.tipo === tipo).map(a => a.nombre)
    if (names.length) acc[tipo] = names
    return acc
  }, {})

  return (
    <Document title={`Acta de visita de obra — ${data.proyecto_nombre}`} author="Forma Prima" creator="Forma Prima">
      <Page size="A4" style={s.page}>

        <View style={s.headerBlock}>
          <View style={s.headerInner}>
            <View style={s.headerLeft}>
              <Image src={LOGO_BLANCO} style={s.logo} />
              <Text style={s.actaLabel}>Acta de visita de obra</Text>
            </View>
            <View style={s.headerRight}>
              <Text style={s.headerDate}>{fmtDateEs(data.fecha)}</Text>
            </View>
          </View>
          <View style={s.headerAccent} />
        </View>

        <View style={s.projectBlock}>
          <Text style={s.projectLabel}>Proyecto</Text>
          <View style={s.projectNameRow}>
            <Text style={s.projectName}>{data.proyecto_nombre}</Text>
            {data.proyecto_codigo && <Text style={s.projectCode}>{data.proyecto_codigo}</Text>}
          </View>
          {data.proyecto_direccion && <Text style={s.projectDir}>{data.proyecto_direccion}</Text>}
        </View>

        <View style={s.body}>
          {Object.keys(byTipo).length > 0 && (
            <>
              <View style={s.rule} />
              <Text style={s.sectionLabel}>Asistentes</Text>
              {TIPO_ORDER.filter(t => byTipo[t]).map(tipo => (
                <View key={tipo} style={{ marginBottom: 10 }}>
                  <Text style={s.tipoLabel}>{TIPO_LABELS[tipo]}</Text>
                  <View style={s.tipoRow}>
                    <Text style={s.chip}>{byTipo[tipo].join('  ·  ')}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {data.estado_obras && (
            <>
              <View style={s.rule} />
              <Text style={s.sectionLabel}>Estado de obras</Text>
              <Text style={s.bodyText}>{data.estado_obras}</Text>
            </>
          )}

          {data.instrucciones.trim().length > 0 && (
            <>
              <View style={s.rule} />
              <Text style={s.sectionLabel}>Instrucciones</Text>
              <Text style={s.bodyText}>{data.instrucciones}</Text>
            </>
          )}

          {data.floorfy_url && (
            <>
              <View style={s.rule} />
              <Text style={s.sectionLabel}>Recorrido virtual actualizado de visita de obra</Text>
              <View style={s.floorfyRow}>
                <Link src={data.floorfy_url} style={s.floorfyLink}>{data.floorfy_url}</Link>
              </View>
            </>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Forma Prima Arquitectura</Text>
          <Text style={s.footerCenter} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          <Text style={s.footerText}>formaprima.es</Text>
        </View>

        <View
          fixed
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 40,
            backgroundColor: C.headerBg,
            paddingHorizontal: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          render={({ pageNumber }) => pageNumber <= 1 ? null : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Image src={LOGO_BLANCO} style={{ width: 72, objectFit: 'contain' as const }} />
              <Text style={{ fontSize: 7, color: C.hInk, fontFamily: 'Helvetica' }}>{data.proyecto_nombre}</Text>
            </View>
          )}
        />

      </Page>
    </Document>
  ) as unknown as ReactPDF.DocumentProps & React.ReactElement
}

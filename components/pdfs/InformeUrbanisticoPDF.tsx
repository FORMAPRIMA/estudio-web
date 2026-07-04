// Server-only PDF definition — Informe de análisis urbanístico preliminar.
// Sin imports de @react-pdf/renderer: el caller pasa el módulo ya importado
// dinámicamente (mismo patrón que ActaVisitaObraPDF).

import fs from 'fs'
import path from 'path'
import type * as ReactPDF from '@react-pdf/renderer'

let _logoCache: string | null = null
function getLogo(): string {
  if (_logoCache) return _logoCache
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png'))
    _logoCache = `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    _logoCache = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')
  }
  return _logoCache
}

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
  ok:       '#3D8B5F',
  warn:     '#B8860B',
  bad:      '#B0413E',
}

export interface InformeUrbanisticoData {
  nombre: string
  direccion: string | null
  refcat: string | null
  fecha: string                       // ISO date
  datos: { label: string; valor: string; tipo?: 'oficial' | 'inferido' | 'hipotesis' }[]
  normaZonal: string | null
  normaZonalDenominacion: string | null
  memo: {
    resumen_ejecutivo?: string
    situacion_urbanistica?: string
    patrimonio?: string
    usos?: string
    potencial?: string
    riesgos_clave?: string[]
    recomendacion?: { veredicto?: string; justificacion?: string }
    proximos_pasos?: string[]
    nivel_confianza?: { nivel?: string; motivo?: string }
  } | null
  edificabilidad: {
    etiquetas?: { campo: string; valor: string; tipo: string }[]
    advertencias?: string[]
    recomendaciones?: string[]
  } | null
  redFlags: { severidad: string; titulo: string; descripcion: string | null; recomendacion: string | null; fuente: string | null }[]
  fuentes: string[]
}

const SEV_COLOR: Record<string, string> = {
  baja: C.mid, media: C.warn, alta: C.bad, critica: C.bad,
}

const VEREDICTO_LABEL: Record<string, string> = {
  avanzar: 'Avanzar',
  condicionar_oferta: 'Condicionar oferta',
  renegociar: 'Renegociar',
  descartar: 'Descartar',
}

function fmtFecha(iso: string): string {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const d = new Date(iso)
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

export function buildInformeUrbanisticoElement(
  pdf: typeof ReactPDF,
  data: InformeUrbanisticoData
): ReactPDF.DocumentProps & React.ReactElement {
  const { Document, Page, View, Text, Image, StyleSheet } = pdf

  const s = StyleSheet.create({
    page:        { paddingTop: 0, paddingBottom: 56, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white },
    header:      { backgroundColor: C.headerBg, paddingTop: 36, paddingBottom: 24, paddingHorizontal: 56 },
    headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo:        { width: 105, objectFit: 'contain', marginBottom: 10 },
    kicker:      { fontSize: 6.5, color: C.brand, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase' },
    hTitle:      { fontSize: 15, color: C.white, marginTop: 6, fontFamily: 'Helvetica-Bold' },
    hSub:        { fontSize: 8.5, color: C.hInk, marginTop: 4 },
    hDate:       { fontSize: 8.5, color: C.hInk, textAlign: 'right' },
    accent:      { height: 2, backgroundColor: C.brand },
    body:        { paddingHorizontal: 56, paddingTop: 22 },
    section:     { marginBottom: 16 },
    secLabel:    { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 6 },
    p:           { fontSize: 8.5, color: C.soft, lineHeight: 1.55 },
    row:         { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingVertical: 4 },
    cellLabel:   { width: '38%', fontSize: 8, color: C.mid },
    cellValue:   { width: '46%', fontSize: 8.5, color: C.ink },
    cellTag:     { width: '16%', fontSize: 6, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
    flag:        { marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2 },
    flagTitle:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
    flagText:    { fontSize: 8, color: C.soft, lineHeight: 1.5, marginTop: 2 },
    flagMeta:    { fontSize: 6.5, color: C.meta, marginTop: 2 },
    verdictBox:  { backgroundColor: C.light, padding: 14, marginTop: 4 },
    verdict:     { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.brand, textTransform: 'uppercase', letterSpacing: 1 },
    listItem:    { fontSize: 8.5, color: C.soft, lineHeight: 1.55, marginBottom: 3 },
    disclaimer:  { fontSize: 6.5, color: C.meta, lineHeight: 1.5, marginTop: 4 },
    footer:      { position: 'absolute', bottom: 24, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 8 },
    footerText:  { fontSize: 6.5, color: C.meta },
  })

  const tagColor = (tipo?: string) =>
    tipo === 'oficial' ? C.ok : tipo === 'hipotesis' ? C.warn : C.mid

  const memo = data.memo
  const secciones: { label: string; texto?: string }[] = memo ? [
    { label: 'Situación urbanística', texto: memo.situacion_urbanistica },
    { label: 'Protección patrimonial', texto: memo.patrimonio },
    { label: 'Usos', texto: memo.usos },
    { label: 'Potencial', texto: memo.potencial },
  ] : []

  return (
    <Document title={`Informe urbanístico — ${data.nombre}`} author="Forma Prima">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed={false}>
          <View style={s.headerRow}>
            <View>
              <Image src={getLogo()} style={s.logo} />
              <Text style={s.kicker}>Análisis urbanístico preliminar</Text>
              <Text style={s.hTitle}>{data.nombre}</Text>
              <Text style={s.hSub}>
                {[data.direccion, data.refcat ? `RC ${data.refcat}` : null].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
            <Text style={s.hDate}>{fmtFecha(data.fecha)}</Text>
          </View>
        </View>
        <View style={s.accent} />

        <View style={s.body}>
          {/* Resumen ejecutivo */}
          {memo?.resumen_ejecutivo ? (
            <View style={s.section}>
              <Text style={s.secLabel}>Resumen ejecutivo</Text>
              <Text style={s.p}>{memo.resumen_ejecutivo}</Text>
            </View>
          ) : null}

          {/* Recomendación */}
          {memo?.recomendacion?.veredicto ? (
            <View style={s.section}>
              <View style={s.verdictBox}>
                <Text style={s.verdict}>
                  {VEREDICTO_LABEL[memo.recomendacion.veredicto] || memo.recomendacion.veredicto}
                </Text>
                {memo.recomendacion.justificacion ? (
                  <Text style={{ ...s.p, marginTop: 6 }}>{memo.recomendacion.justificacion}</Text>
                ) : null}
                {memo.nivel_confianza?.nivel ? (
                  <Text style={{ ...s.disclaimer, marginTop: 8 }}>
                    Nivel de confianza del análisis: {memo.nivel_confianza.nivel}
                    {memo.nivel_confianza.motivo ? ` — ${memo.nivel_confianza.motivo}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Identificación / datos */}
          <View style={s.section}>
            <Text style={s.secLabel}>Identificación del activo</Text>
            {data.normaZonal ? (
              <View style={s.row}>
                <Text style={s.cellLabel}>Norma zonal</Text>
                <Text style={s.cellValue}>{data.normaZonal}{data.normaZonalDenominacion ? ` — ${data.normaZonalDenominacion}` : ''}</Text>
                <Text style={{ ...s.cellTag, color: C.mid }}>visor</Text>
              </View>
            ) : null}
            {data.datos.map((d, i) => (
              <View key={i} style={s.row}>
                <Text style={s.cellLabel}>{d.label}</Text>
                <Text style={s.cellValue}>{d.valor}</Text>
                <Text style={{ ...s.cellTag, color: tagColor(d.tipo) }}>{d.tipo || ''}</Text>
              </View>
            ))}
          </View>

          {/* Secciones del memo */}
          {secciones.filter((sec) => sec.texto).map((sec, i) => (
            <View key={i} style={s.section} wrap={false}>
              <Text style={s.secLabel}>{sec.label}</Text>
              <Text style={s.p}>{sec.texto}</Text>
            </View>
          ))}

          {/* Edificabilidad */}
          {data.edificabilidad?.etiquetas && data.edificabilidad.etiquetas.length > 0 ? (
            <View style={s.section}>
              <Text style={s.secLabel}>Edificabilidad</Text>
              {data.edificabilidad.etiquetas.map((e, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.cellLabel}>{e.campo}</Text>
                  <Text style={s.cellValue}>{e.valor}</Text>
                  <Text style={{ ...s.cellTag, color: tagColor(e.tipo) }}>{e.tipo}</Text>
                </View>
              ))}
              {(data.edificabilidad.advertencias || []).map((a, i) => (
                <Text key={i} style={{ ...s.disclaimer, marginTop: 4 }}>⚠ {a}</Text>
              ))}
            </View>
          ) : null}

          {/* Red flags */}
          {data.redFlags.length > 0 ? (
            <View style={s.section}>
              <Text style={s.secLabel}>Red flags ({data.redFlags.length})</Text>
              {data.redFlags.map((f, i) => (
                <View key={i} style={{ ...s.flag, borderLeftColor: SEV_COLOR[f.severidad] || C.mid }} wrap={false}>
                  <Text style={{ ...s.flagTitle, color: SEV_COLOR[f.severidad] || C.ink }}>
                    [{f.severidad.toUpperCase()}] {f.titulo}
                  </Text>
                  {f.descripcion ? <Text style={s.flagText}>{f.descripcion}</Text> : null}
                  {f.recomendacion ? <Text style={s.flagText}>Recomendación: {f.recomendacion}</Text> : null}
                  {f.fuente ? <Text style={s.flagMeta}>Fuente: {f.fuente}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* Riesgos clave + próximos pasos */}
          {memo?.riesgos_clave && memo.riesgos_clave.length > 0 ? (
            <View style={s.section} wrap={false}>
              <Text style={s.secLabel}>Riesgos clave</Text>
              {memo.riesgos_clave.map((r, i) => (
                <Text key={i} style={s.listItem}>—  {r}</Text>
              ))}
            </View>
          ) : null}
          {memo?.proximos_pasos && memo.proximos_pasos.length > 0 ? (
            <View style={s.section} wrap={false}>
              <Text style={s.secLabel}>Próximos pasos</Text>
              {memo.proximos_pasos.map((p, i) => (
                <Text key={i} style={s.listItem}>{i + 1}.  {p}</Text>
              ))}
            </View>
          ) : null}

          {/* Fuentes y aviso legal */}
          <View style={s.section}>
            <Text style={s.secLabel}>Fuentes consultadas</Text>
            {data.fuentes.map((f, i) => (
              <Text key={i} style={{ ...s.listItem, fontSize: 7.5, color: C.mid }}>—  {f}</Text>
            ))}
            <Text style={s.disclaimer}>
              Este informe es un análisis urbanístico PRELIMINAR generado con datos de visores y servicios oficiales que
              carecen de valor jurídico. No sustituye una consulta urbanística, un informe técnico ni una resolución
              administrativa. Las conclusiones etiquetadas como HIPÓTESIS requieren verificación antes de cualquier
              decisión de inversión.
            </Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Forma Prima — GEINEX GROUP, S.L.</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

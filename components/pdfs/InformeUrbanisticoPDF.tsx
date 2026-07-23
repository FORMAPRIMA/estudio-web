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
  /** Resumen en lenguaje llano para dirección (sin jerga urbanística). */
  resumenDirectivo: string | null
  /** Cifras clave del activo para la banda de KPIs de la primera página. */
  kpis: { label: string; valor: string; sub?: string }[]
  /** Captura PNG (dataURL) de la maqueta 3D en vista casi cenital. */
  maqueta?: string | null
  memo: {
    resumen_directivo?: string
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
  // Cuadro urbanístico formato licencia: normativa · estado actual · potencial
  cuadro: {
    filas: {
      label: string
      normativa: { texto: string; figura: string; masRestrictivo: boolean }[]
      actual: string | null
      potencial: string | null
      contradiccion: boolean
    }[]
    ambitos: string[]
    advertencias: string[]
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

  // REGLA DE ORO de @react-pdf para que header/footer fijos no se solapen con
  // el contenido: los elementos `fixed` se pintan por encima del flujo en TODAS
  // las páginas, así que el padding de la Page debe RESERVAR sus bandas
  // (paddingTop ≥ alto del header fijo, paddingBottom ≥ alto del footer fijo).
  // Aquí: portada como Page propia (héroe en flujo, sin header fijo) y páginas
  // técnicas con cabecera fija fina (58) + footer fijo (44) reservados.
  const FOOTER_H = 44
  const TEC_HEADER_H = 58

  const s = StyleSheet.create({
    // La portada lleva paddingTop normal (40) y el héroe lo anula con margen
    // negativo para ir a sangre: así, si el contenido de portada desborda a una
    // segunda página, esa continuación arranca con margen superior correcto en
    // lugar de nacer pegada al borde.
    pageCover:   { paddingTop: 40, paddingBottom: FOOTER_H + 16, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white },
    pageTec:     { paddingTop: TEC_HEADER_H + 24, paddingBottom: FOOTER_H + 16, paddingHorizontal: 56, fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white },
    header:      { backgroundColor: C.headerBg, marginTop: -40, paddingTop: 36, paddingBottom: 24, paddingHorizontal: 56 },
    headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo:        { width: 105, objectFit: 'contain', marginBottom: 10 },
    kicker:      { fontSize: 6.5, color: C.brand, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase' },
    hTitle:      { fontSize: 15, color: C.white, marginTop: 6, fontFamily: 'Helvetica-Bold' },
    hSub:        { fontSize: 8.5, color: C.hInk, marginTop: 4 },
    hDate:       { fontSize: 8.5, color: C.hInk, textAlign: 'right' },
    accent:      { height: 2, backgroundColor: C.brand },
    body:        { paddingHorizontal: 56, paddingTop: 22 },
    tecHeader:   {
      position: 'absolute', top: 0, left: 0, right: 0, height: TEC_HEADER_H - 2,
      backgroundColor: C.headerBg, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingHorizontal: 56,
      borderBottomWidth: 2, borderBottomColor: C.brand,
    },
    tecHeaderTitle: { fontSize: 9, color: C.white, fontFamily: 'Helvetica-Bold' },
    tecHeaderSub:   { fontSize: 6.5, color: C.hInk, marginTop: 2 },
    tecHeaderRight: { fontSize: 6.5, color: C.hInk, textAlign: 'right' },
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
    kpiBand:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    kpiBox:      { flexGrow: 1, flexBasis: '30%', backgroundColor: C.light, padding: 10, borderLeftWidth: 2, borderLeftColor: C.brand },
    kpiLabel:    { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.mid, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
    kpiValue:    { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink },
    kpiSub:      { fontSize: 6.5, color: C.meta, marginTop: 2 },
    execP:       { fontSize: 9.5, color: C.ink, lineHeight: 1.65 },
    maqueta:     { width: '100%', height: 205, objectFit: 'cover', backgroundColor: C.light },
    maquetaBox:  { borderWidth: 0.5, borderColor: C.rule },
    maquetaCaption: { fontSize: 6.5, color: C.meta, marginTop: 4 },
    listItem:    { fontSize: 8.5, color: C.soft, lineHeight: 1.55, marginBottom: 3 },
    disclaimer:  { fontSize: 6.5, color: C.meta, lineHeight: 1.5, marginTop: 4 },
    footer:      { position: 'absolute', bottom: 0, left: 56, right: 56, height: FOOTER_H, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 8 },
    footerText:  { fontSize: 6.5, color: C.meta },
  })

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Forma Prima — GEINEX GROUP, S.L.</Text>
      <Text style={s.footerText}>Urban Analyst · en desarrollo — documento orientativo sin valor jurídico</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

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
      {/* ══ PORTADA — Resumen para dirección (Page propia: el héroe va en
          flujo y no puede pisar al contenido de las páginas siguientes) ══ */}
      <Page size="A4" style={s.pageCover}>
        <View style={s.header}>
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
          {/* Resumen para dirección (lenguaje llano) */}
          {data.resumenDirectivo || memo?.resumen_ejecutivo ? (
            <View style={s.section}>
              <Text style={s.secLabel}>Resumen para dirección</Text>
              <Text style={s.execP}>{data.resumenDirectivo || memo?.resumen_ejecutivo}</Text>
              {data.resumenDirectivo && memo?.resumen_ejecutivo ? (
                <Text style={{ ...s.p, marginTop: 8, color: C.mid }}>{memo.resumen_ejecutivo}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Cifras clave */}
          {data.kpis.length > 0 ? (
            <View style={s.section}>
              <Text style={s.secLabel}>Cifras clave del activo</Text>
              <View style={s.kpiBand}>
                {data.kpis.map((k, i) => (
                  <View key={i} style={s.kpiBox} wrap={false}>
                    <Text style={s.kpiLabel}>{k.label}</Text>
                    <Text style={s.kpiValue}>{k.valor}</Text>
                    {k.sub ? <Text style={s.kpiSub}>{k.sub}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Maqueta 3D del activo (vista casi cenital) — wrap=false: la
              imagen salta entera de página si no cabe */}
          {data.maqueta ? (
            <View style={s.section} wrap={false}>
              <Text style={s.secLabel}>Maqueta 3D del activo</Text>
              <View style={s.maquetaBox}>
                <Image src={data.maqueta} style={s.maqueta} />
              </View>
              <Text style={s.maquetaCaption}>
                Vista cenital de la maqueta digital: edificación existente (gris), envolvente capaz teórica (naranja)
                y contexto de manzana con alturas municipales, sobre plano catastral. Representación orientativa sin valor jurídico.
              </Text>
            </View>
          ) : null}

          {/* Recomendación — wrap=false: si no cabe entera, salta completa de
              página (nunca partir la caja del veredicto por la mitad) */}
          {memo?.recomendacion?.veredicto ? (
            <View style={s.section} wrap={false}>
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

          <Text style={{ ...s.disclaimer, marginTop: 2 }}>
            El detalle técnico completo del análisis (planeamiento, cuadro urbanístico, edificabilidad y alertas)
            comienza en la página siguiente.
          </Text>

          <View style={{ borderTopWidth: 0.5, borderTopColor: C.rule, marginTop: 14, paddingTop: 8 }} wrap={false}>
            <Text style={s.disclaimer}>
              Este documento ha sido generado automáticamente por Urban Analyst, la herramienta de análisis
              urbanístico de Forma Prima, actualmente en fase de desarrollo. La información procede de fuentes
              oficiales de consulta que carecen de valor jurídico y las conclusiones tienen carácter preliminar y
              orientativo: no sustituyen un informe técnico suscrito por técnico competente, una consulta
              urbanística formal ni resolución administrativa alguna. Contraste los resultados antes de fundamentar
              en ellos cualquier decisión de inversión.
            </Text>
          </View>
        </View>
        <Footer />
      </Page>

      {/* ══ PÁGINAS TÉCNICAS — cabecera fija fina + footer fijo; el padding de
          la Page reserva ambas bandas para que el flujo nunca las pise ══ */}
      <Page size="A4" style={s.pageTec}>
        <View style={s.tecHeader} fixed>
          <View>
            <Text style={s.tecHeaderTitle}>{data.nombre}</Text>
            <Text style={s.tecHeaderSub}>
              {[data.refcat ? `RC ${data.refcat}` : null, data.normaZonal ? `NZ ${data.normaZonal}` : null].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <View>
            <Text style={s.tecHeaderRight}>Detalle técnico del análisis</Text>
            <Text style={{ ...s.tecHeaderRight, marginTop: 2 }}>{fmtFecha(data.fecha)}</Text>
          </View>
        </View>

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

          {/* Cuadro urbanístico formato licencia */}
          {data.cuadro && data.cuadro.filas.length > 0 ? (
            <View style={s.section}>
              <Text style={s.secLabel}>Cuadro urbanístico — normativa · estado actual · potencial</Text>
              {data.cuadro.ambitos.length > 0 ? (
                <Text style={{ ...s.p, color: C.bad, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
                  Ámbito de planeamiento prevalente: {data.cuadro.ambitos.join(' · ')} — su ficha desplaza las condiciones generales.
                </Text>
              ) : null}
              <View style={{ ...s.row, borderBottomColor: C.ink }}>
                <Text style={{ width: '18%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 }}>Parámetro</Text>
                <Text style={{ width: '42%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 }}>Normativa</Text>
                <Text style={{ width: '20%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado actual</Text>
                <Text style={{ width: '20%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5 }}>Potencial</Text>
              </View>
              {data.cuadro.filas.map((f, i) => (
                <View key={i} style={s.row} wrap={false}>
                  <Text style={{ width: '18%', fontSize: 7.5, color: C.mid }}>
                    {f.label}{f.contradiccion ? '  (contradicción)' : ''}
                  </Text>
                  <View style={{ width: '42%', paddingRight: 6 }}>
                    {f.normativa.length === 0 ? <Text style={{ fontSize: 7.5, color: C.meta }}>—</Text> : null}
                    {f.normativa.map((n, j) => (
                      <View key={j} style={{ marginBottom: j < f.normativa.length - 1 ? 3 : 0 }}>
                        <Text style={{
                          fontSize: 7.5,
                          color: n.masRestrictivo && f.normativa.length > 1 ? C.bad : C.ink,
                          fontFamily: n.masRestrictivo && f.normativa.length > 1 ? 'Helvetica-Bold' : 'Helvetica',
                        }}>
                          {n.texto}{n.masRestrictivo && f.normativa.length > 1 ? '  (más restrictiva)' : ''}
                        </Text>
                        <Text style={{ fontSize: 5.5, color: C.meta }}>{n.figura}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ width: '20%', fontSize: 7.5, color: f.actual ? C.ink : C.meta, paddingRight: 6 }}>{f.actual || '—'}</Text>
                  <Text style={{ width: '20%', fontSize: 7.5, color: f.potencial ? C.ok : C.meta }}>{f.potencial || '—'}</Text>
                </View>
              ))}
              {data.cuadro.advertencias.slice(0, 3).map((a, i) => (
                <Text key={i} style={{ ...s.disclaimer, marginTop: 4 }}>Aviso: {a}</Text>
              ))}
            </View>
          ) : null}

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
                <Text key={i} style={{ ...s.disclaimer, marginTop: 4 }}>Aviso: {a}</Text>
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

        <Footer />
      </Page>
    </Document>
  )
}

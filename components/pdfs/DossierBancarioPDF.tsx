// Server-only PDF — Dossier de financiación para entidad bancaria.
// Café de especialidad en Calle Goya 63. Mismo patrón que InformeUrbanisticoPDF:
// sin imports de @react-pdf/renderer (el caller pasa el módulo), portada como
// Page propia y página técnica con cabecera/footer fijos y padding reservado.

import fs from 'fs'
import path from 'path'
import type * as ReactPDF from '@react-pdf/renderer'
import type { ModeloInputs, ModeloResults } from '@/lib/modelo-cafe/domain'

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
  gold:     '#D8B466',
  ink:      '#1A1A1A',
  soft:     '#3A3A3A',
  mid:      '#7A7A7A',
  meta:     '#AAAAAA',
  rule:     '#E6E4DF',
  light:    '#F8F7F4',
  white:    '#FFFFFF',
  hInk:     '#F0EDE8',
  ok:       '#3D8B5F',
  bad:      '#B0413E',
}

export interface DossierEscenario {
  clave: 'pesimista' | 'conservador' | 'optimista'
  nombre: string
  cafesDia: number
  facturacionAnual: number
  margenBrutoPct: number
  ebitdaAnual: number
  netoAnual: number
  margenNeto: number
  cajaArranque: number
  cajaEstable: number
  dscrArranque: number
  dscrEstable: number
  paybackMeses: number
}

export interface DossierData {
  fecha: string
  escenarioNombre: string
  inputs: ModeloInputs
  conservador: ModeloResults
  escenarios: DossierEscenario[]
  estructura: {
    usos: { label: string; importe: number }[]
    usosTotal: number
    fuentes: { label: string; importe: number; pct: number }[]
    fuentesTotal: number
  }
  mercado: {
    ubicacion: { rentaGoya: number; vacancy: number; posicionCalle: string; alquilerLocal: string }
    traspasos: { quiosco: string; zona: string; precioTexto: string; goya?: boolean }[]
    traspasoMedia: number
    ticketMercado: number
    bebidas: { label: string; media: number; n: number }[]
    ticketPorLocal: { nombre: string; ticket: number; destacada?: boolean }[]
  }
  /** Detalle del equipamiento (CAPEX) por categoría; si viene, se muestra bajo usos/fuentes. */
  capex?: { categoria: string; importe: number }[]
}

function fmtFecha(iso: string): string {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const d = new Date(iso)
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

// Formateadores ASCII-safe (Helvetica no tiene el signo menos U+2212).
// useGrouping:'always' fuerza el separador de miles también en cifras de 4
// dígitos (es-ES no lo hace por defecto): un dossier bancario luce uniforme.
const eur = (n: number) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('es-ES', { useGrouping: 'always' })} €`
const eur1 = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} €`
const pc = (n: number) => `${(n * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
const dscr = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
const meses = (m: number) => (m > 0 ? `${Math.round(m)} meses` : '—')

export function buildDossierBancarioElement(
  pdf: typeof ReactPDF,
  data: DossierData
): ReactPDF.DocumentProps & React.ReactElement {
  const { Document, Page, View, Text, Image, StyleSheet } = pdf

  const FOOTER_H = 44
  const TEC_HEADER_H = 52

  const s = StyleSheet.create({
    pageCover: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 8.5, color: C.white, backgroundColor: C.headerBg },
    pageTec:   { paddingTop: TEC_HEADER_H + 22, paddingBottom: FOOTER_H + 14, paddingHorizontal: 52, fontFamily: 'Helvetica', fontSize: 8.5, color: C.ink, backgroundColor: C.white },

    // ── Portada ──
    coverWrap:  { flex: 1, paddingHorizontal: 52, paddingTop: 46, paddingBottom: 40, justifyContent: 'space-between' },
    coverTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo:       { width: 120, objectFit: 'contain' },
    confid:     { fontSize: 7, color: C.meta, fontFamily: 'Helvetica-Bold', letterSpacing: 3, textTransform: 'uppercase' },
    coverKicker:{ fontSize: 8, color: C.brand, fontFamily: 'Helvetica-Bold', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 },
    coverTitle: { fontSize: 34, color: C.white, fontFamily: 'Helvetica-Bold', lineHeight: 1.1 },
    coverSub:   { fontSize: 10, color: C.hInk, marginTop: 16, lineHeight: 1.6, maxWidth: 400 },
    coverKpis:  { flexDirection: 'row', gap: 10, borderTopWidth: 0.5, borderTopColor: '#FFFFFF33', paddingTop: 18 },
    coverKpi:   { flex: 1, borderTopWidth: 2, borderTopColor: C.brand, paddingTop: 8 },
    coverKpiL:  { fontSize: 6.5, color: C.meta, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, textTransform: 'uppercase' },
    coverKpiV:  { fontSize: 16, color: C.white, fontFamily: 'Helvetica-Bold', marginTop: 4 },
    coverFoot:  { fontSize: 7.5, color: C.meta, marginTop: 20 },

    // ── Página técnica ──
    tecHeader:  { position: 'absolute', top: 0, left: 0, right: 0, height: TEC_HEADER_H - 2, backgroundColor: C.headerBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 52, borderBottomWidth: 2, borderBottomColor: C.brand },
    tecHTitle:  { fontSize: 7.5, color: C.white, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
    tecHRight:  { fontSize: 6.5, color: C.hInk, textAlign: 'right' },
    footer:     { position: 'absolute', bottom: 0, left: 52, right: 52, height: FOOTER_H, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 8 },
    footerText: { fontSize: 6.5, color: C.meta },

    section:    { marginBottom: 15 },
    secNum:     { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 5 },
    subLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5, marginTop: 6 },
    p:          { fontSize: 8.5, color: C.soft, lineHeight: 1.55, marginBottom: 5 },
    li:         { fontSize: 8.5, color: C.soft, lineHeight: 1.5, marginBottom: 4, paddingLeft: 8 },
    liBold:     { fontFamily: 'Helvetica-Bold', color: C.ink },

    // KPI band
    kpiBand:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    kpiBox:     { flexGrow: 1, flexBasis: '22%', backgroundColor: C.light, padding: 9, borderLeftWidth: 2, borderLeftColor: C.brand },
    kpiL:       { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.mid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
    kpiV:       { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink },
    kpiS:       { fontSize: 6.5, color: C.meta, marginTop: 2 },

    // Tablas de usos/fuentes (dos columnas)
    twoCol:     { flexDirection: 'row', gap: 14 },
    col:        { flex: 1 },
    tHead:      { flexDirection: 'row', backgroundColor: C.headerBg, paddingVertical: 5, paddingHorizontal: 7 },
    tHeadTxt:   { fontSize: 6.5, color: C.white, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
    tRow:       { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 7, borderBottomWidth: 0.5, borderBottomColor: C.rule },
    tRowTot:    { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 7, backgroundColor: C.light, borderTopWidth: 1, borderTopColor: C.ink },
    cellL:      { flex: 1, fontSize: 8, color: C.soft, paddingRight: 4 },
    cellR:      { fontSize: 8, color: C.ink, textAlign: 'right' },
    cellRbold:  { fontSize: 8.5, color: C.ink, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

    // P&L
    plRow:      { flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.rule },
    plLabel:    { flex: 1, fontSize: 8.5, color: C.soft },
    plMes:      { width: 78, fontSize: 8.5, textAlign: 'right', color: C.ink },
    plAno:      { width: 78, fontSize: 8.5, textAlign: 'right', color: C.mid },
    plGroup:    { flexDirection: 'row', paddingVertical: 4, backgroundColor: C.light, paddingHorizontal: 4, marginTop: 2 },
    plGroupTxt: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mid, letterSpacing: 1, textTransform: 'uppercase' },

    // Escenarios
    escHead:    { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 5, paddingTop: 2 },
    escRow:     { flexDirection: 'row', paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: C.rule, alignItems: 'center' },
    escC0:      { flex: 1.5, fontSize: 8 },
    escC:       { flex: 1, fontSize: 8, textAlign: 'right' },
    escHtxt:    { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.4 },

    box:        { backgroundColor: C.light, padding: 12, marginTop: 4 },
    boxDark:    { backgroundColor: C.headerBg, padding: 14, marginTop: 6 },
    boxDarkL:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
    boxDarkT:   { fontSize: 9, color: C.hInk, lineHeight: 1.6 },
    disclaimer: { fontSize: 6.5, color: C.meta, lineHeight: 1.5, marginTop: 8 },
  })

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>GEINEX GROUP, S.L. · CIF B44873552 · Ppe. de Vergara 56, 28006 Madrid</Text>
      <Text style={s.footerText}>Dossier de financiación · confidencial</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  const v = data.inputs
  const r = data.conservador
  const cons = data.escenarios.find((e) => e.clave === 'conservador') ?? data.escenarios[0]

  // Componentes del coste variable del caso conservador (mismas fórmulas que domain)
  const cafeCoste = v.cafe_c * v.cafe_ud * v.dias
  const bebCoste = r.bebIng * v.beb_c
  const bolCoste = r.bolIng * v.bol_c
  const prensaCoste = r.prensaIng * (1 - v.prensa_m)
  const comis = (r.cafeIng + r.bebIng + r.bolIng + r.prensaIng) * v.tar_pct * v.tar_com
  const gestAgrup = v.gest + v.seg + v.mant + v.soft
  const otrosAgrup = v.mkt + v.otros
  const otrasLineasMes = r.bebIng + r.bolIng + r.prensaIng + r.pubIng

  const PL = ({ label, m, group, tone }: { label: string; m: number; group?: boolean; tone?: 'r' | 'g' }) => (
    <View style={s.plRow} wrap={false}>
      <Text style={[s.plLabel, group ? { fontFamily: 'Helvetica-Bold', color: C.ink } : {}]}>{label}</Text>
      <Text style={[s.plMes, tone === 'r' ? { color: C.bad } : tone === 'g' ? { color: C.ok, fontFamily: 'Helvetica-Bold' } : group ? { fontFamily: 'Helvetica-Bold' } : {}]}>{eur(m)}</Text>
      <Text style={s.plAno}>{eur(m * 12)}</Text>
    </View>
  )

  return (
    <Document title="Dossier de financiación — Café Goya 63" author="Forma Prima">
      {/* ══ PORTADA ══ */}
      <Page size="A4" style={s.pageCover}>
        <View style={s.coverWrap}>
          <View style={s.coverTop}>
            <Image src={getLogo()} style={s.logo} />
            <Text style={s.confid}>Confidencial</Text>
          </View>
          <View>
            <Text style={s.coverKicker}>Dossier de financiación</Text>
            <Text style={s.coverTitle}>Café de especialidad</Text>
            <Text style={s.coverTitle}>en Calle Goya 63</Text>
            <Text style={s.coverSub}>
              Reconversión de un quiosco histórico del barrio de Salamanca en un café de especialidad
              para llevar. Plan de negocio con modelo financiero completo, tres escenarios y solicitud de préstamo.
            </Text>
          </View>
          <View>
            <View style={s.coverKpis}>
              <View style={s.coverKpi}>
                <Text style={s.coverKpiL}>Inversión total</Text>
                <Text style={s.coverKpiV}>{eur(data.estructura.usosTotal)}</Text>
              </View>
              <View style={s.coverKpi}>
                <Text style={s.coverKpiL}>Capital propio</Text>
                <Text style={s.coverKpiV}>{eur(r.capitalPropio)}</Text>
              </View>
              <View style={s.coverKpi}>
                <Text style={s.coverKpiL}>Préstamo solicitado</Text>
                <Text style={s.coverKpiV}>{eur(r.prestamo)}</Text>
              </View>
              <View style={s.coverKpi}>
                <Text style={s.coverKpiL}>Cobertura de deuda</Text>
                <Text style={s.coverKpiV}>{dscr(cons.dscrArranque)}</Text>
              </View>
            </View>
            <Text style={s.coverFoot}>GEINEX GROUP, S.L. (Forma Prima) · Madrid, {fmtFecha(data.fecha)}</Text>
          </View>
        </View>
      </Page>

      {/* ══ PÁGINAS TÉCNICAS ══ */}
      <Page size="A4" style={s.pageTec}>
        <View style={s.tecHeader} fixed>
          <Text style={s.tecHTitle}>FORMA PRIMA · CAFÉ DE ESPECIALIDAD · GOYA 63</Text>
          <Text style={s.tecHRight}>Dossier de financiación</Text>
        </View>

        {/* 1 · El negocio en una página */}
        <View style={s.section}>
          <Text style={s.secNum}>1 · El negocio en una página</Text>
          <Text style={s.p}>
            Adquirimos por traspaso la concesión municipal de un quiosco en la Calle Goya 63 (barrio de Salamanca,
            Madrid) y lo reconvertimos en un café de especialidad para llevar. El formato es sencillo y probado:
            café de alta calidad, bollería seleccionada y bebidas, servidos en un punto de paso con enorme tráfico
            peatonal, sin sala interior, con un equipo mínimo y costes fijos muy bajos.
          </Text>
          <Text style={s.p}>
            El modelo opera ya en España con éxito: News &amp; Coffee gestiona quioscos reconvertidos en Barcelona,
            Valencia y Madrid, y Pink Bourbon opera un quiosco de café de especialidad en Diego de León, a diez
            minutos a pie de nuestra ubicación y en el mismo distrito.
          </Text>
          <Text style={s.subLabel}>Por qué esta esquina</Text>
          <Text style={s.li}>
            <Text style={s.liBold}>Calle prime: </Text>
            Goya es la {data.mercado.ubicacion.posicionCalle}, con una renta de local de {data.mercado.ubicacion.rentaGoya} €/m²/mes
            (CBRE) y una disponibilidad prácticamente nula ({pc(data.mercado.ubicacion.vacancy / 100)} de vacancy).
          </Text>
          <Text style={s.li}>
            <Text style={s.liBold}>Estructura de costes única: </Text>
            el quiosco opera sobre concesión municipal con un canon anual reducido. Un local equivalente en la misma
            calle costaría {data.mercado.ubicacion.alquilerLocal} de alquiler: capturamos el tráfico de una calle prime
            con los costes fijos de un barrio periférico.
          </Text>
          <Text style={s.li}>
            <Text style={s.liBold}>Cliente objetivo: </Text>
            residentes de alto poder adquisitivo, oficinas y comercio de la zona, con hábito de café diario y ticket
            medio de {eur1(v.cafe_p)}.
          </Text>
        </View>

        {/* 2 · Estructura de la inversión */}
        <View style={s.section}>
          <Text style={s.secNum}>2 · Estructura de la inversión: usos y fuentes</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <View style={s.tHead}>
                <Text style={[s.tHeadTxt, { flex: 1 }]}>Usos</Text>
                <Text style={s.tHeadTxt}>Importe</Text>
              </View>
              {data.estructura.usos.map((u, i) => (
                <View key={i} style={s.tRow} wrap={false}>
                  <Text style={s.cellL}>{u.label}</Text>
                  <Text style={s.cellR}>{eur(u.importe)}</Text>
                </View>
              ))}
              <View style={s.tRowTot}>
                <Text style={[s.cellL, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>Total inversión</Text>
                <Text style={s.cellRbold}>{eur(data.estructura.usosTotal)}</Text>
              </View>
            </View>
            <View style={s.col}>
              <View style={s.tHead}>
                <Text style={[s.tHeadTxt, { flex: 1 }]}>Fuentes</Text>
                <Text style={s.tHeadTxt}>Importe · %</Text>
              </View>
              {data.estructura.fuentes.map((f, i) => (
                <View key={i} style={s.tRow} wrap={false}>
                  <Text style={s.cellL}>{f.label}</Text>
                  <Text style={s.cellR}>{eur(f.importe)} · {pc(f.pct)}</Text>
                </View>
              ))}
              <View style={s.tRowTot}>
                <Text style={[s.cellL, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>Total fuentes</Text>
                <Text style={s.cellRbold}>{eur(data.estructura.fuentesTotal)}</Text>
              </View>
            </View>
          </View>
          {data.capex && data.capex.length > 0 ? (
            <View wrap={false}>
              <Text style={s.subLabel}>Detalle del equipamiento (CAPEX)</Text>
              <View style={s.tHead}>
                <Text style={[s.tHeadTxt, { flex: 1 }]}>Categoría</Text>
                <Text style={[s.tHeadTxt, { width: 90, textAlign: 'right' }]}>Importe</Text>
              </View>
              {data.capex.map((c, i) => (
                <View key={i} style={s.tRow} wrap={false}>
                  <Text style={s.cellL}>{c.categoria}</Text>
                  <Text style={[s.cellR, { width: 90 }]}>{eur(c.importe)}</Text>
                </View>
              ))}
              <View style={s.tRowTot} wrap={false}>
                <Text style={[s.cellL, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>Total equipamiento</Text>
                <Text style={[s.cellRbold, { width: 90 }]}>{eur(data.capex.reduce((a, c) => a + c.importe, 0))}</Text>
              </View>
              <Text style={{ fontSize: 6.5, color: C.meta, marginTop: 3 }}>
                Presupuesto de equipamiento (máquina de espresso 2ª mano, molinos, brewer, frío, agua y barra); precios de mercado orientativos.
              </Text>
            </View>
          ) : null}

          <View style={s.box} wrap={false}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 }}>Compromiso de los socios</Text>
            <Text style={{ fontSize: 8, color: C.soft, lineHeight: 1.55 }}>
              Los socios aportan {eur(r.capitalPropio)} en efectivo el día 1. El préstamo solicitado financia parte del
              desembolso inicial y la financiación del vendedor difiere {eur(r.aplazado)} del traspaso a los primeros
              {' '}{r.plazoT} meses de operación, sin interés.
            </Text>
          </View>
        </View>

        {/* 3 · Modelo financiero conservador */}
        <View style={s.section}>
          <Text style={s.secNum}>3 · Modelo financiero en detalle — caso conservador ({cons.cafesDia} cafés/día)</Text>
          <View style={s.plRow} wrap={false}>
            <Text style={[s.plLabel, { fontFamily: 'Helvetica-Bold' }]}> </Text>
            <Text style={[s.plMes, { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.mid, textTransform: 'uppercase' }]}>Mes tipo</Text>
            <Text style={[s.plAno, { fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.mid, textTransform: 'uppercase' }]}>Año</Text>
          </View>
          <View style={s.plGroup}><Text style={s.plGroupTxt}>Ingresos</Text></View>
          <PL label={`Café · ${v.cafe_ud} uds/día × ${eur1(v.cafe_p)} × ${v.dias} días`} m={r.cafeIng} />
          <PL label={`Bollería · ${v.bol_ud} uds/día × ${eur1(v.bol_p)}`} m={r.bolIng} />
          <PL label={`Otras bebidas · ${v.beb_ud} uds/día × ${eur1(v.beb_p)}`} m={r.bebIng} />
          <PL label="Prensa" m={r.prensaIng} />
          <PL label="Publicidad (soporte del quiosco)" m={r.pubIng} />
          <PL label="Total ingresos" m={r.fact} group />
          <View style={s.plGroup}><Text style={s.plGroupTxt}>Costes variables</Text></View>
          <PL label={`Coste del café · ${eur1(v.cafe_c)}/ud`} m={-cafeCoste} tone="r" />
          <PL label={`Coste de bollería · ${pc(v.bol_c)} del PVP`} m={-bolCoste} tone="r" />
          <PL label={`Coste de bebidas · ${pc(v.beb_c)} del PVP`} m={-bebCoste} tone="r" />
          <PL label={`Coste de prensa · ${pc(1 - v.prensa_m)} del PVP`} m={-prensaCoste} tone="r" />
          <PL label={`Comisiones de tarjeta · ${pc(v.tar_pct)} de pagos al ${pc(v.tar_com)}`} m={-comis} tone="r" />
          <PL label={`Margen bruto (${pc(cons.margenBrutoPct)} de las ventas)`} m={r.mb} tone="g" />
          <View style={s.plGroup}><Text style={s.plGroupTxt}>Costes fijos</Text></View>
          <PL label="Personal (con Seguridad Social)" m={-v.personal} tone="r" />
          <PL label="Cuota de autónomo" m={-v.autonomo} tone="r" />
          <PL label="Electricidad y agua" m={-v.luz} tone="r" />
          <PL label="Canon municipal de la concesión" m={-v.canon} tone="r" />
          <PL label="Gestoría, seguro, mantenimiento y software" m={-gestAgrup} tone="r" />
          <PL label="Marketing y otros" m={-otrosAgrup} tone="r" />
          <PL label={`EBITDA (${pc(r.fact ? r.ebitda / r.fact : 0)} de las ventas)`} m={r.ebitda} group tone={r.ebitda >= 0 ? 'g' : 'r'} />
          <View style={s.plGroup}><Text style={s.plGroupTxt}>Resultado</Text></View>
          <PL label="Amortizaciones" m={-r.amortMes} tone="r" />
          <PL label="Gastos financieros (banco + aplazamiento)" m={-r.gastoFin} tone="r" />
          <PL label="Beneficio antes de impuestos" m={r.bai} group />
          <PL label={`Impuestos (${pc(v.tax)})`} m={-r.impuesto} tone="r" />
          <PL label={`Beneficio neto (${pc(r.margenNeto)} de las ventas)`} m={r.neto} group tone={r.neto >= 0 ? 'g' : 'r'} />
        </View>

        {/* 4 · Tres escenarios */}
        <View style={s.section}>
          <Text style={s.secNum}>4 · Tres escenarios: pesimista, conservador y optimista</Text>
          <Text style={s.p}>
            Los tres comparten precios, costes y estructura de financiación; la única variable que cambia es el número
            de cafés vendidos al día, el factor crítico del negocio. El escenario conservador ({cons.cafesDia} cafés/día)
            es el caso base de planificación. Punto de equilibrio operativo: {Math.round(r.cafesBE)} cafés/día.
          </Text>
          <View style={s.escHead}>
            <Text style={[s.escC0, s.escHtxt]}> </Text>
            {data.escenarios.map((e) => (
              <Text key={e.clave} style={[s.escC, s.escHtxt, e.clave === 'conservador' ? { color: C.brand } : {}]}>{e.nombre}</Text>
            ))}
          </View>
          {([
            ['Cafés vendidos al día', (e: DossierEscenario) => String(e.cafesDia)],
            ['Facturación anual', (e: DossierEscenario) => eur(e.facturacionAnual)],
            ['Margen bruto', (e: DossierEscenario) => pc(e.margenBrutoPct)],
            ['EBITDA anual', (e: DossierEscenario) => eur(e.ebitdaAnual)],
            ['Beneficio neto anual', (e: DossierEscenario) => eur(e.netoAnual)],
            ['Margen neto', (e: DossierEscenario) => pc(e.margenNeto)],
            ['Caja/mes tras todas las cuotas (años 1-2)', (e: DossierEscenario) => eur(e.cajaArranque)],
            ['Caja/mes tras cuotas (fase estable)', (e: DossierEscenario) => eur(e.cajaEstable)],
            ['Cobertura de deuda (DSCR) arranque', (e: DossierEscenario) => dscr(e.dscrArranque)],
            ['Cobertura de deuda (DSCR) estable', (e: DossierEscenario) => dscr(e.dscrEstable)],
            ['Recuperación del capital propio', (e: DossierEscenario) => meses(e.paybackMeses)],
          ] as [string, (e: DossierEscenario) => string][]).map(([label, fn], i) => (
            <View key={i} style={s.escRow} wrap={false}>
              <Text style={[s.escC0, { color: C.soft }]}>{label}</Text>
              {data.escenarios.map((e) => (
                <Text key={e.clave} style={[s.escC, e.clave === 'conservador' ? { fontFamily: 'Helvetica-Bold', color: C.ink } : { color: C.soft }]}>{fn(e)}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* 5 · Servicio de la deuda + mitigantes */}
        <View style={s.section}>
          <Text style={s.secNum}>5 · Servicio de la deuda y mitigantes de riesgo</Text>
          <View style={s.tHead}>
            <Text style={[s.tHeadTxt, { flex: 1 }]}>Obligación</Text>
            <Text style={[s.tHeadTxt, { width: 90, textAlign: 'right' }]}>Cuota mensual</Text>
            <Text style={[s.tHeadTxt, { width: 60, textAlign: 'right' }]}>Plazo</Text>
          </View>
          <View style={s.tRow} wrap={false}>
            <Text style={s.cellL}>Préstamo bancario ({eur(r.prestamo)}, TIN {pc(v.banco_tin)})</Text>
            <Text style={[s.cellR, { width: 90 }]}>{eur(r.cuotaB)}</Text>
            <Text style={[s.cellR, { width: 60 }]}>{r.plazoB} meses</Text>
          </View>
          <View style={s.tRow} wrap={false}>
            <Text style={s.cellL}>Aplazamiento al vendedor ({eur(r.aplazado)}, {v.interes > 0 ? pc(v.interes) : 'sin interés'})</Text>
            <Text style={[s.cellR, { width: 90 }]}>{eur(r.cuotaT)}</Text>
            <Text style={[s.cellR, { width: 60 }]}>{r.plazoT} meses</Text>
          </View>
          <View style={s.tRowTot} wrap={false}>
            <Text style={[s.cellL, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>Servicio total arranque / fase estable</Text>
            <Text style={[s.cellRbold, { width: 90 }]}>{eur(r.cuotaB + r.cuotaT)} / {eur(r.cuotaB)}</Text>
            <Text style={[s.cellR, { width: 60 }]}>—</Text>
          </View>
          <Text style={s.subLabel}>Mitigantes de riesgo</Text>
          <Text style={s.li}><Text style={s.liBold}>Costes fijos mínimos: </Text>sin alquiler de local; el punto de equilibrio queda en {Math.round(r.cafesBE)} cafés/día.</Text>
          <Text style={s.li}><Text style={s.liBold}>Ingresos diversificados: </Text>café, bollería, bebidas, prensa y publicidad aportan {eur(otrasLineasMes)}/mes al margen del café.</Text>
          <Text style={s.li}><Text style={s.liBold}>Compromiso real de los socios: </Text>{eur(r.capitalPropio)} de capital propio aportados antes del primer euro de deuda.</Text>
          <Text style={s.li}><Text style={s.liBold}>Vendedor alineado: </Text>acepta cobrar {eur(r.aplazado)} del traspaso aplazado, reduciendo la financiación externa.</Text>
          <Text style={s.li}><Text style={s.liBold}>Operación condicionada: </Text>la compra se cierra solo tras verificar con el Ayuntamiento vigencia, transmisibilidad y autorización de la actividad de café (reserva de 60 días).</Text>
          <Text style={s.li}><Text style={s.liBold}>Respaldo del grupo: </Text>GEINEX GROUP, S.L. (Forma Prima) es un estudio de arquitectura en activo con ingresos recurrentes, que ejecutará la reforma con medios propios.</Text>
          <View style={s.boxDark} wrap={false}>
            <Text style={s.boxDarkL}>Solicitud</Text>
            <Text style={s.boxDarkT}>
              Préstamo de {eur(r.prestamo)} a {r.plazoB} meses para completar la inversión de {eur(data.estructura.usosTotal)} en
              la puesta en marcha del café de especialidad de Calle Goya 63. Los socios aportan {eur(r.capitalPropio)} de
              capital propio y el vendedor financia {eur(r.aplazado)} adicionales. En el caso base conservador, la caja
              operativa cubre el servicio total de la deuda {dscr(cons.dscrArranque)} desde el primer año, y la deuda
              bancaria queda cubierta {dscr(cons.dscrEstable)} en la fase estable.
            </Text>
          </View>
        </View>

        {/* 6 · Análisis de mercado */}
        <View style={s.section}>
          <Text style={s.secNum}>6 · El mercado: ubicación, traspasos y precios del entorno</Text>
          <View style={s.kpiBand}>
            <View style={s.kpiBox}><Text style={s.kpiL}>Renta calle Goya</Text><Text style={s.kpiV}>{data.mercado.ubicacion.rentaGoya} €/m²</Text><Text style={s.kpiS}>al mes (CBRE)</Text></View>
            <View style={s.kpiBox}><Text style={s.kpiL}>Disponibilidad</Text><Text style={s.kpiV}>{data.mercado.ubicacion.vacancy} %</Text><Text style={s.kpiS}>vacancy en la calle</Text></View>
            <View style={s.kpiBox}><Text style={s.kpiL}>Ticket café mercado</Text><Text style={s.kpiV}>{eur1(data.mercado.ticketMercado)}</Text><Text style={s.kpiS}>media del entorno</Text></View>
            <View style={s.kpiBox}><Text style={s.kpiL}>Nuestro ticket</Text><Text style={s.kpiV}>{eur1(v.cafe_p)}</Text><Text style={s.kpiS}>café de especialidad</Text></View>
          </View>

          <Text style={s.subLabel}>Precio medio de mercado por bebida</Text>
          <View style={s.tHead}>
            <Text style={[s.tHeadTxt, { flex: 1 }]}>Bebida</Text>
            <Text style={[s.tHeadTxt, { width: 90, textAlign: 'right' }]}>Media entorno</Text>
            <Text style={[s.tHeadTxt, { width: 60, textAlign: 'right' }]}>Locales</Text>
          </View>
          {data.mercado.bebidas.filter((b) => b.n > 0).map((b, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={s.cellL}>{b.label}</Text>
              <Text style={[s.cellR, { width: 90 }]}>{eur1(b.media)}</Text>
              <Text style={[s.cellR, { width: 60 }]}>{b.n}</Text>
            </View>
          ))}

          <Text style={s.subLabel}>Traspasos de quioscos comparables (anuncios activos, julio 2026)</Text>
          <View style={s.tHead}>
            <Text style={[s.tHeadTxt, { flex: 1 }]}>Quiosco</Text>
            <Text style={[s.tHeadTxt, { width: 128 }]}>Zona</Text>
            <Text style={[s.tHeadTxt, { width: 78, textAlign: 'right' }]}>Precio pedido</Text>
          </View>
          {data.mercado.traspasos.map((t, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={[s.cellL, t.goya ? { fontFamily: 'Helvetica-Bold', color: C.brand } : {}]}>{t.quiosco}</Text>
              <Text style={[s.cellL, { flex: 0, width: 128 }, t.goya ? { fontFamily: 'Helvetica-Bold', color: C.brand } : {}]}>{t.zona}</Text>
              <Text style={[s.cellR, { width: 78 }, t.goya ? { fontFamily: 'Helvetica-Bold', color: C.brand } : {}]}>{t.precioTexto}</Text>
            </View>
          ))}
          <Text style={s.disclaimer}>
            El traspaso de Goya 63 es el precio más alto del mercado publicado (media de comparables ~{eur(data.mercado.traspasoMedia)}),
            justificado por ser la única ubicación en calle prime: el sobreprecio equivale a menos de un año del ahorro de renta
            frente a un local en la misma calle.
          </Text>

          <Text style={s.disclaimer}>
            Cifras del modelo financiero interno (escenario conservador «{data.escenarioNombre}», {fmtFecha(data.fecha)}).
            Datos de mercado: {'CBRE Retail High Street y Colliers Q1 2026'}; precios de carta tomados en visita de campo.
            Documento confidencial preparado para entidades financieras; las proyecciones son estimaciones y no constituyen
            garantía de resultados.
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

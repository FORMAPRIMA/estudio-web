// Server-only — used only inside API routes with @react-pdf/renderer
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import { fmtEur, PRECIO_HORA, SERVICIO_IDS } from '@/lib/propuestas/config'
import type { ServicioId } from '@/lib/propuestas/config'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

// ── Fixed studio data ─────────────────────────────────────────────────────────
const STUDIO = {
  razon_social: 'GEINEX GROUP, S.L.',
  nombre_comercial: 'FORMA PRIMA',
  nif: 'B44873552',
  domicilio: 'calle Príncipe de Vergara 56, Piso 6 Pta 2, Madrid',
  rep_nombre: 'Gabriela Estefanía Hidalgo Abad',
  rep_dni: '43919540M',
  rep_titulo: 'arquitecta colegiada COAM 25284',
  email: 'contacto@formaprima.es',
}

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
    paddingBottom: 64,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.ink,
    backgroundColor: C.white,
  },
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
    marginBottom: 24,
  },
  logo: { width: 120, height: 'auto' },
  headerTitle: {
    color: C.hInk,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  headerSub: {
    color: C.hMid,
    fontSize: 7.5,
    marginTop: 4,
    textAlign: 'right',
  },
  headerNumero: {
    color: C.brand,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    marginTop: 8,
  },
  headerAccent: {
    height: 2,
    backgroundColor: C.brand,
    marginTop: 16,
    opacity: 0.7,
  },
  body: { paddingHorizontal: 56 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  metaLabel: { fontSize: 7, color: C.meta, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  metaValue: { fontSize: 9, color: C.ink, fontFamily: 'Helvetica-Bold' },
  // Legal sections
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.brand,
    paddingTop: 18,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    marginBottom: 10,
  },
  clauseTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: C.ink,
    marginTop: 18,
    marginBottom: 6,
  },
  subClauseTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.soft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.65,
    marginBottom: 6,
  },
  indented: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.65,
    marginLeft: 14,
    marginBottom: 3,
  },
  bullet: {
    fontSize: 8,
    color: C.soft,
    lineHeight: 1.6,
    marginLeft: 20,
    marginBottom: 2,
  },
  groupLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.mid,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 2,
    marginLeft: 14,
  },
  // Payment hitos table
  pagoTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 4,
  },
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  pagoLeft: {
    flex: 1,
    paddingRight: 12,
  },
  pagoSeccion: {
    fontSize: 6.5,
    color: C.meta,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  pagoLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    lineHeight: 1.5,
  },
  pagoImporte: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    flexShrink: 0,
    textAlign: 'right',
    width: 90,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: C.headerBg,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  // Firma block
  firmaBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  firmaCol: { flex: 1, paddingHorizontal: 16, alignItems: 'center' },
  firmaLinea: { width: '80%', borderBottomWidth: 1, borderBottomColor: C.ink, marginBottom: 6, height: 36 },
  firmaLabel: { fontSize: 7.5, color: C.mid, textAlign: 'center' },
  firmaNombre: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'center', marginTop: 3 },
  // Footer
  footer: {
    position: 'absolute', bottom: 24, left: 56, right: 56,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 8,
  },
  footerText: { fontSize: 6.5, color: C.meta },
})

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ServicioContrato {
  id:          string
  label:       string
  texto:       string
  entregables: { grupo: string; items: string[] }[]
  importe:     number
  semanas:     string
  pago:        { label: string; pct: number }[]
}

export interface ContratoHonorario {
  seccion:             string
  descripcion:         string
  importe:             number
  fecha_pago_acordada: string | null
}

export interface ContratoPDFData {
  numero:             string
  fecha_contrato:     string | null
  tipo_cliente:       'fisica' | 'juridica'
  // Client
  cliente_nombre:    string | null
  cliente_apellidos: string | null
  cliente_empresa:   string | null
  cliente_nif:       string | null
  cliente_direccion: string | null
  cliente_ciudad:    string | null
  // Project
  proyecto_nombre:    string | null
  proyecto_direccion: string | null
  proyecto_tipo:      string | null
  // Content
  servicios_contrato: ServicioContrato[]
  honorarios:         ContratoHonorario[]
  notas:              string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

function numToWords(n: number): string {
  n = Math.round(n)
  if (n === 0) return 'CERO'
  const units  = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
                  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const tens   = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const hunds  = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  let r = ''
  if (n >= 1000) {
    const t = Math.floor(n / 1000)
    r += t === 1 ? 'MIL' : numToWords(t) + ' MIL'
    n %= 1000
    if (n > 0) r += ' '
  }
  if (n >= 100) {
    if (n === 100) { r += 'CIEN'; n = 0 }
    else { r += hunds[Math.floor(n / 100)]; n %= 100; if (n > 0) r += ' ' }
  }
  if (n >= 20) {
    r += tens[Math.floor(n / 10)]
    const rem = n % 10
    if (rem > 0) r += ' Y ' + units[rem]
  } else if (n > 0) {
    r += units[n]
  }
  return r
}

function eurToWords(amount: number): string {
  return `${numToWords(amount)} EUROS (${fmtEur(amount)})`
}

// ── Document ──────────────────────────────────────────────────────────────────
function sortServicios<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ia = SERVICIO_IDS.indexOf(a.id as ServicioId)
    const ib = SERVICIO_IDS.indexOf(b.id as ServicioId)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

export function ContratoPDF({ data }: { data: ContratoPDFData }) {
  const sortedServicios = sortServicios(data.servicios_contrato)
  const totalHonorarios = data.honorarios.reduce((s, h) => s + (h.importe ?? 0), 0)

  const nombreCompleto = [data.cliente_nombre, data.cliente_apellidos].filter(Boolean).join(' ')
  const domicilio = [data.cliente_direccion, data.cliente_ciudad].filter(Boolean).join(', ') || '—'
  const clienteParty = data.tipo_cliente === 'juridica'
    ? `la sociedad ${data.cliente_empresa ?? nombreCompleto}, con NIF ${data.cliente_nif ?? '—'}, con domicilio en ${domicilio}, representada por ${nombreCompleto}`
    : `${nombreCompleto}${data.cliente_nif ? `, con DNI ${data.cliente_nif}` : ''}${data.cliente_direccion ? `, con domicilio en ${domicilio}` : ''}`

  const propiedadAddr = data.proyecto_direccion ?? '—'
  const proyectoDesc  = data.proyecto_tipo ?? 'reforma'
  const serviceNames  = data.servicios_contrato.map(s => s.label).join(', ')

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{STUDIO.razon_social} (nombre comercial {STUDIO.nombre_comercial}) · NIF {STUDIO.nif}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  return (
    <Document title={`Contrato ${data.numero} · Forma Prima`} author="Forma Prima">

      {/* ── PAGE 1: Header + REUNIDOS + MANIFIESTAN ── */}
      <Page size="A4" style={{ ...s.page, paddingTop: 0 }}>
        {/* Header */}
        <View style={s.headerBlock}>
          <View style={s.headerInner}>
            <Image src={LOGO_BLANCO} style={s.logo} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.headerTitle}>Contrato de Servicios Profesionales</Text>
              <Text style={s.headerSub}>Taller de arquitectura y diseño</Text>
              {data.proyecto_nombre && (
                <Text style={{ color: C.white, fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 8, textAlign: 'right' }}>
                  {data.proyecto_nombre}
                </Text>
              )}
              <Text style={s.headerNumero}>{data.numero}</Text>
            </View>
          </View>
          <View style={s.headerAccent} />
        </View>

        {/* Meta row */}
        <View style={s.metaRow}>
          <View>
            <Text style={s.metaLabel}>Fecha del contrato</Text>
            <Text style={s.metaValue}>{formatDate(data.fecha_contrato)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.metaLabel}>Ciudad</Text>
            <Text style={s.metaValue}>Madrid</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* REUNIDOS */}
          <Text style={s.sectionTitle}>Reunidos</Text>

          <Text style={s.bodyText}>
            {'En Madrid, a ' + formatDate(data.fecha_contrato) + '.'}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>De una parte</Text>
            {', '}
            {clienteParty}
            {', como '}
            {data.tipo_cliente === 'juridica' ? 'cliente' : 'propietario/s de la vivienda/local'}
            {propiedadAddr !== '—' ? ` situada en ${propiedadAddr}` : ''}
            {' (en adelante, el «CLIENTE»).'}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 6 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Y, de otra parte</Text>
            {`, la sociedad ${STUDIO.razon_social} (nombre comercial ${STUDIO.nombre_comercial}), con NIF ${STUDIO.nif}, con domicilio en ${STUDIO.domicilio}, representada por Doña ${STUDIO.rep_nombre}, mayor de edad, con DNI ${STUDIO.rep_dni}, ${STUDIO.rep_titulo} (en adelante, el «ESTUDIO»).`}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 6 }}>
            Ambas partes con la capacidad legal necesaria para otorgar y suscribir el presente contrato (en adelante, el «Contrato»).
          </Text>

          {/* MANIFIESTAN */}
          <Text style={{ ...s.sectionTitle, marginTop: 4 }}>Manifiestan</Text>

          <Text style={s.bodyText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>I.- </Text>
            {`Que el Estudio ofrece sus servicios profesionales de ${serviceNames} (en adelante, los «Servicios»), cuyos entregables quedan definidos en la cláusula primera del contrato.`}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>II.- </Text>
            {`Que el Cliente va a realizar la ${proyectoDesc.toUpperCase()}${propiedadAddr !== '—' ? ` en el inmueble situado en ${propiedadAddr}` : ''}.`}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>III.- </Text>
            {`Que el Cliente desea contratar los servicios profesionales del Estudio para la realización de los siguientes servicios: ${serviceNames}.`}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>IV.- </Text>
            Que a tales efectos y de mutuo acuerdo, el Cliente contrata la prestación de los servicios consignados en el punto anterior al Estudio, quien acepta el trabajo encomendado, acordando las PARTES las siguientes cláusulas:
          </Text>
        </View>

        <Footer />
      </Page>

      {/* ── PAGES 2+: CLÁUSULAS ── */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <Text style={s.sectionTitle}>Cláusulas</Text>

          {/* PRIMERA */}
          <Text style={s.clauseTitle}>Primera. Contenido de los trabajos</Text>
          <Text style={s.bodyText}>Los servicios que se incluyen son los siguientes:</Text>

          {sortedServicios.map((srv, i) => (
            <View key={srv.id} wrap={false}>
              <Text style={{ ...s.subClauseTitle, marginTop: i === 0 ? 6 : 14 }}>
                {srv.label}
              </Text>
              {!!srv.texto && (
                <Text style={s.bodyText}>{srv.texto}</Text>
              )}
              {srv.entregables.map(grupo => (
                <View key={grupo.grupo}>
                  <Text style={s.groupLabel}>{grupo.grupo}</Text>
                  {grupo.items.map((item, j) => (
                    <Text key={j} style={s.bullet}>
                      {'· ' + item}
                    </Text>
                  ))}
                </View>
              ))}
              {!!srv.semanas && (
                <Text style={{ ...s.indented, marginTop: 4, color: C.mid }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>Plazo estimado: </Text>
                  {srv.semanas}
                </Text>
              )}
            </View>
          ))}

          <Text style={{ ...s.bodyText, marginTop: 14 }}>
            Se excluye de lo anterior cualquier trabajo no citado con anterioridad. Se citan con carácter enunciativo y no limitativo los siguientes: limpieza, montaje, etc. Queda igualmente excluido, de forma expresa, el coste del mobiliario, decoración y cualquier otro elemento de compra o suministro, independientemente de que el Estudio pueda asesorar en su selección.
          </Text>

          {/* SEGUNDA */}
          <Text style={s.clauseTitle}>Segunda. Honorarios</Text>

          <Text style={s.bodyText}>
            {`Las Partes acuerdan que los honorarios de los servicios contratados ascienden a un total de `}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{eurToWords(totalHonorarios)}</Text>
            {`. A esta cantidad se le deberá incrementar el IVA correspondiente.`}
          </Text>

          {/* Criterio de cálculo */}
          <Text style={{ ...s.subClauseTitle, marginTop: 12 }}>Criterio de cálculo de honorarios</Text>
          <Text style={s.bodyText}>
            Los honorarios acordados han sido determinados mediante la aplicación de un porcentaje profesional sobre el Presupuesto de Ejecución Material (en adelante, «PEM») objetivo de la obra, entendido éste como el coste estimado de los trabajos de construcción, sin incluir gastos generales del promotor, honorarios técnicos ni tributos. Dicho criterio vincula la retribución del Estudio al alcance real del encargo y al valor de la obra proyectada, distribuyendo el total de honorarios entre las distintas fases del encargo en proporción al peso relativo de cada servicio sobre el conjunto de la prestación profesional.
          </Text>
          {(() => {
            const includesDO = data.servicios_contrato.some(s => s.id === 'direccion_obra')
            if (!includesDO) return null
            return (
              <>
                <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>Revisión del PEM y liquidación definitiva de honorarios de dirección de obra</Text>
                <Text style={s.bodyText}>
                  Dado que los honorarios correspondientes a la fase de Dirección Estética de Obra se calculan sobre el PEM objetivo establecido al inicio del encargo, y habida cuenta de que el coste real de ejecución puede variar a lo largo del proceso constructivo, las Partes acuerdan expresamente el siguiente mecanismo de liquidación:
                </Text>
                <Text style={{ ...s.indented, marginTop: 2 }}>
                  a. Con carácter previo al devengo y facturación del último hito de pago de la fase de Dirección Estética de Obra, el Estudio llevará a cabo una verificación del coste real de ejecución material de la obra, en coordinación con el Constructor y sobre la base de la certificación final o del presupuesto de obra liquidado.
                </Text>
                <Text style={{ ...s.indented, marginTop: 3 }}>
                  b. En el supuesto de que el PEM definitivo resultase superior al objetivo de partida empleado como base de cálculo, el importe del último hito de honorarios de la Dirección Estética de Obra será revisado al alza de forma proporcional a dicha variación, de modo que los honorarios reflejen fielmente el alcance real de la prestación realizada.
                </Text>
                <Text style={{ ...s.indented, marginTop: 3 }}>
                  c. Queda expresamente excluida cualquier revisión a la baja de los honorarios pactados en el presente Contrato. En ningún caso la reducción del PEM definitivo respecto al objetivo inicial dará lugar a una minoración de los honorarios ya devengados ni de los pendientes de facturación.
                </Text>
                <Text style={{ ...s.bodyText, marginTop: 6 }}>
                  Esta cláusula constituye un acuerdo expreso entre las Partes orientado a garantizar la equidad retributiva del Estudio ante variaciones de alcance durante la ejecución, sin que ello suponga en ningún caso un menoscabo para el Cliente en términos de calidad o dedicación del servicio prestado.
                </Text>
              </>
            )
          })()}

          <Text style={{ ...s.bodyText, marginTop: 8 }}>A continuación se fijan los siguientes hitos de pago:</Text>

          {/* Payment table */}
          <View style={s.pagoTable}>
            {data.honorarios.map((h, i) => (
              <View key={i} wrap={false} style={{ ...s.pagoRow, backgroundColor: i % 2 === 0 ? C.white : C.light }}>
                <View style={s.pagoLeft}>
                  {h.seccion && h.seccion !== h.descripcion && (
                    <Text style={s.pagoSeccion}>{h.seccion}</Text>
                  )}
                  <Text style={s.pagoLabel}>{h.descripcion}</Text>
                </View>
                <Text style={s.pagoImporte}>{fmtEur(h.importe)} + IVA</Text>
              </View>
            ))}
            <View wrap={false} style={s.totalRow}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.hInk }}>Total honorarios</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.brand }}>{fmtEur(totalHonorarios)} + IVA</Text>
            </View>
          </View>

          <Text style={{ fontSize: 7.5, color: C.mid, marginTop: 8, lineHeight: 1.55 }}>
            * Los gastos de desplazamiento para visitas de obra (kilometraje, parking, transporte público o dietas según el caso) no están incluidos en los honorarios anteriores y podrán ser incorporados a las facturas correspondientes, previa comunicación al Cliente.
          </Text>

          {/* MODIFICACIONES */}
          <Text style={{ ...s.subClauseTitle, marginTop: 14 }}>Modificaciones</Text>
          <Text style={s.bodyText}>
            El Cliente podrá proponer cambios a los trabajos en el plazo de una (1) semana desde su presentación, período tras el cual se considerarán aprobados. Todo cambio solicitado por el Cliente una vez entregado cada servicio se considerará parte del siguiente.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            {`Las alteraciones sustanciales que sean peticiones expresas del Cliente, una vez aprobado el trabajo correspondiente, serán objeto de honorarios adicionales pactados previamente con base al precio horario del Estudio (Arquitecto Junior ${PRECIO_HORA.junior}€/h + IVA / Arquitecto Senior ${PRECIO_HORA.senior}€/h + IVA / Arquitecto Socio ${PRECIO_HORA.socio}€/h + IVA), las cuales se facturarán una vez realizadas las alteraciones. Se considerarán alteraciones sustanciales las que impliquen un cambio de concepto, modificaciones por parte de otros técnicos en estructuras o instalaciones que supongan una alteración sustancial, una carga de trabajo imprevista, la realización de dibujos para atender solicitaciones del constructor a soluciones constructivas distintas a las fijadas en la memoria de calidades, la incorporación de aportaciones de terceros y la realización de visitas de obra fuera del plazo marcado por el cronograma.`}
          </Text>

          {/* FORMA DE PAGO */}
          <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>Forma de pago</Text>
          <Text style={s.bodyText}>
            El Estudio elaborará, con carácter previo a cada período de vencimiento, una factura que deberá ser abonada en el plazo de quince (15) días a contar desde su emisión mediante transferencia bancaria a la cuenta que señale el Estudio.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            Cualquier retraso en el pago de la factura constituirá al deudor en mora de forma automática, sin necesidad de intimación o requerimiento previo. Dicho retraso devengará, desde el día siguiente al del vencimiento y hasta la fecha de su íntegro pago, un interés de demora pactado del 3% mensual sobre el importe total de la factura impagada.
          </Text>

          {/* EXCLUSIONES */}
          <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>Exclusiones</Text>
          <Text style={s.bodyText}>
            Quedan expresamente excluidos del contrato todos los servicios no recogidos en el índice anteriormente expuesto. Con carácter enunciativo y no limitativo, se citan los siguientes: redacción de separatas al proyecto no citadas, servicios de Seguridad y Salud en cualquier fase, tramitaciones urbanísticas, tramitación de legalizaciones y boletines de instalaciones, etc.
          </Text>

          {/* TERCERA */}
          <Text style={s.clauseTitle}>Tercera. Obligaciones del Estudio</Text>
          {[
            'El Estudio se obliga a realizar los servicios contratados con la máxima diligencia, colaborando con contratistas externos para que los trabajos se lleven a cabo de conformidad con lo que las partes acuerden.',
            'El Estudio se obliga a informar al Cliente de los avances en sus trabajos.',
            'El Estudio será responsable de los daños directos probados con un máximo de los honorarios previstos para la fase en la que se haya producido el incumplimiento, quedando su responsabilidad limitada a dicha cantidad y exenta de cualquier otra. El Estudio no será responsable por daños indirectos, incidentales, especiales, punitivos o consecuentes o de terceros, ni de trabajos que no formen parte de este encargo.',
            'En caso en que el Estudio se retrase en la entrega del servicio contratado al Cliente por causas únicamente imputables al Estudio, éste tendrá derecho a aplicar una penalización del 1% de los Honorarios correspondientes a dicha entrega por cada día natural de retraso.',
          ].map((txt, i) => (
            <Text key={i} style={{ ...s.indented, marginBottom: 5 }}>
              {String.fromCharCode(97 + i) + '. ' + txt}
            </Text>
          ))}

          {/* CUARTA */}
          <Text style={s.clauseTitle}>Cuarta. Obligaciones del Cliente</Text>
          {[
            'Condición de Promotor y Titularidad. El Cliente ostenta la condición legal de Promotor a los efectos de la Ley 38/1999, de 5 de noviembre, de Ordenación de la Edificación (LOE) y de la normativa urbanística aplicable. Como tal, es el único titular y responsable de todas las gestiones, obligaciones y cargas inherentes a dicha condición.',
            'Es obligación exclusiva e indelegable del Cliente-Promotor solicitar, gestionar y obtener a su costa, con carácter previo al inicio de cualquier actuación material, el título habilitante urbanístico que resulte preceptivo ante cualquier Administración para la ejecución de la obra objeto del presente Contrato.',
            'El Estudio queda plenamente exonerado de cualquier responsabilidad por las decisiones finales sobre las soluciones a adoptar en el proyecto y su ejecución, correspondientes al Cliente en su condición de promotor. En ejercicio de dicha potestad, el Cliente asume como propia y exclusiva la responsabilidad final frente a la Administración y a terceros por las características de la obra efectivamente ejecutada.',
            'El Cliente se obliga a abonar las cantidades pactadas en el presente contrato y de la forma acordada.',
            'El Cliente se obliga a colaborar en todo lo necesario con el Estudio para el buen desarrollo de los servicios contratados.',
          ].map((txt, i) => (
            <Text key={i} style={{ ...s.indented, marginBottom: 5 }}>
              {String.fromCharCode(97 + i) + '. ' + txt}
            </Text>
          ))}

          {/* QUINTA */}
          <Text style={s.clauseTitle}>Quinta. Duración</Text>
          <Text style={s.bodyText}>
            Los servicios acordados en el contrato comenzarán a la firma del mismo y tendrán terminación con fecha el cronograma de obra fijado en el contrato privado entre Constructor y Propiedad.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            El Estudio, en caso de ser necesario, realizará tareas de seguimiento de posibles repasos y desperfectos de obra por parte del constructor durante dos (2) semanas tras la recepción de la obra por parte del Cliente.
          </Text>

          {/* SEXTA */}
          <Text style={s.clauseTitle}>Sexta. Resolución del contrato</Text>
          <Text style={{ ...s.bodyText, marginBottom: 4 }}>El presente Contrato se terminará:</Text>
          {[
            'Por transcurso de su plazo de duración.',
            'Por mutuo acuerdo por escrito de las partes, que podrán decidir su resolución total o parcial.',
            'Por cualquiera de las partes, en el supuesto de que la otra parte incumpla cualquiera de sus obligaciones derivadas del Contrato. En caso de que la obligación fuera subsanable, la Parte no incumplidora deberá notificar previamente por escrito a la otra Parte dicho incumplimiento, requiriéndole para que sea subsanado en un plazo de 10 días desde la recepción de la notificación.',
            'Por incumplimiento de órdenes del Estudio al Constructor en la Dirección Estética de Obra, debidamente notificados al Cliente. Se entenderá como incumplimiento de las órdenes cuando no se hayan seguido las instrucciones en tres (3) ocasiones, notificadas en las actas de visita.',
            'El Estudio podrá renunciar a la obra de forma unilateral en caso en que la obra se haya paralizado durante más de tres (3) meses por causas ajenas a él.',
            'La falta de pago por el Cliente del precio del Contrato en la forma y plazos pactados.',
            'El Cliente podrá rescindir el contrato en caso de un retraso superior a cuatro (4) semanas en cualquiera de los servicios objeto del contrato, por causas directa y exclusivamente imputables al Arquitecto. Quedan excluidas las causas de fuerza mayor.',
          ].map((txt, i) => (
            <Text key={i} style={{ ...s.indented, marginBottom: 5 }}>
              {String.fromCharCode(97 + i) + '. ' + txt}
            </Text>
          ))}
          <Text style={{ ...s.bodyText, marginTop: 6 }}>
            En caso de resolución del Contrato y una vez satisfechas las cantidades pactadas, el Estudio quedará obligado a dejar firmada la correspondiente Venia y facilitar toda la documentación al Arquitecto/Interiorista entrante en el acto del abono de la liquidación.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            En caso de producirse la rescisión del contrato por parte del Cliente, éste se verá obligado a abonar el 100% de los honorarios hasta la fase en la que se haya producido la rescisión, así como el 30% de los honorarios restantes correspondientes a las fases dejadas de realizar por parte del Estudio en concepto de indemnización.
          </Text>

          {/* SÉPTIMA */}
          <Text style={s.clauseTitle}>Séptima. Propiedad intelectual</Text>
          <Text style={s.bodyText}>
            El ESTUDIO se reserva todos los derechos de propiedad intelectual sobre el proyecto, incluyendo, pero sin limitarse a, los planos, diseños, imágenes, modelados en 3D, documentación técnica y cualquier otro material generado en el desarrollo del mismo, conforme a lo dispuesto en la Ley de Propiedad Intelectual de España.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            El trabajo realizado por el Estudio, una vez abonados los honorarios correspondientes, podrá ser utilizado por el Cliente una sola vez, única y exclusivamente para la ubicación consignada en este encargo, correspondiendo al Estudio los derechos inherentes a la propiedad intelectual. El Estudio podrá realizar reportaje fotográfico del Proyecto terminado y publicarlo con fines corporativos, docentes y de comunicación junto a la planimetría, manteniendo en cualquier caso la confidencialidad del Cliente y la ubicación exacta.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            Queda expresamente prohibida la reproducción, modificación, cesión o utilización de la documentación para cualquier otro fin o en otra ubicación sin el consentimiento expreso y por escrito del Estudio.
          </Text>

          {/* OCTAVA */}
          <Text style={s.clauseTitle}>Octava. Seguros</Text>
          <Text style={s.bodyText}>
            El Estudio se obliga a mantener en vigor por su cuenta y a su cargo una póliza de seguro de responsabilidad civil que cubra las posibles contingencias que se pudieran derivar de la prestación de los servicios. Las partes acuerdan que la responsabilidad del Estudio queda limitada a los honorarios previstos para la fase en la que se haya producido el incumplimiento.
          </Text>

          {/* NOVENA */}
          <Text style={s.clauseTitle}>Novena. Confidencialidad y protección de datos</Text>
          <Text style={s.bodyText}>
            Las Partes se comprometen a gestionar el presente encargo con ética, profesionalidad, reserva y legalidad, actuando con total lealtad y diligencia. También se obligan a velar por la confidencialidad de la información recibida, así como las que marca la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            Cualquier tipo de información, oral o escrita, que pueda facilitar el Cliente se entenderá confidencial y no podrá ser divulgada a terceras partes, limitándose su acceso a los empleados autorizados que precisen disponer de ella. Esta cláusula se mantendrá en vigor de forma indefinida, aún después de extinguido el presente Contrato.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            El Cliente autoriza y exime de cualquier responsabilidad al Estudio en la comunicación de datos personales con fin único y exclusivo del correcto desarrollo de los servicios contratados con terceros (proveedores, montadores, ingenieros o cualquier otro agente directamente relacionado al proceso).
          </Text>

          {/* DÉCIMA */}
          <Text style={s.clauseTitle}>Décima. Disposiciones generales</Text>
          <Text style={s.bodyText}>
            Este Contrato constituye una unidad resultado del acuerdo completo entre las Partes en relación con su objeto. Todos los acuerdos suscritos por las partes de forma oral o escrita con anterioridad a su firma quedan derogados por el presente Contrato.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            En el caso de que se declarase nula o inexigible cualquiera de las cláusulas del presente Contrato, su validez en conjunto no quedará afectada, permaneciendo en vigor los restantes términos y condiciones.
          </Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            Para cuantas cuestiones, divergencias, interpretación o cumplimiento del presente Contrato puedan surgir entre las partes, éstas, con renuncia del fuero que pudiera corresponderles, se someten a los Juzgados y Tribunales de la ciudad de Madrid.
          </Text>

          {/* Notas adicionales */}
          {data.notas && (
            <View wrap={false}>
              <Text style={{ ...s.clauseTitle, color: C.mid }}>Notas adicionales</Text>
              <Text style={s.bodyText}>{data.notas}</Text>
            </View>
          )}

          {/* FIRMAS */}
          <View style={s.firmaBlock} wrap={false}>
            <View style={s.firmaCol}>
              <View style={s.firmaLinea} />
              <Text style={s.firmaLabel}>Por el Cliente</Text>
              <Text style={s.firmaNombre}>
                {[data.cliente_nombre, data.cliente_apellidos].filter(Boolean).join(' ')}
              </Text>
              {data.tipo_cliente === 'juridica' && data.cliente_empresa && (
                <Text style={{ ...s.firmaLabel, marginTop: 2 }}>{data.cliente_empresa}</Text>
              )}
            </View>
            <View style={s.firmaCol}>
              <View style={s.firmaLinea} />
              <Text style={s.firmaLabel}>Por el Estudio</Text>
              <Text style={s.firmaNombre}>{STUDIO.rep_nombre}</Text>
              <Text style={{ ...s.firmaLabel, marginTop: 2 }}>{STUDIO.nombre_comercial}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 7, color: C.meta, textAlign: 'center', marginTop: 12 }}>
            En prueba de conformidad, firman en el lugar y fecha expresados en el encabezamiento.
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

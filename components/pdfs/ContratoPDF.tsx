// Server-only — used only inside API routes with @react-pdf/renderer
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import { fmtEur, PRECIO_HORA, SERVICIO_IDS, SERVICIOS_CONFIG_EN, PAGO_LABEL_EN } from '@/lib/propuestas/config'
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
    textAlign: 'justify',
  },
  indented: {
    fontSize: 8.5,
    color: C.soft,
    lineHeight: 1.65,
    marginLeft: 14,
    marginBottom: 3,
    textAlign: 'justify',
  },
  bullet: {
    fontSize: 8,
    color: C.soft,
    lineHeight: 1.6,
    marginLeft: 20,
    marginBottom: 2,
    textAlign: 'justify',
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
  notas?:      string
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
  lang?:              'es' | 'en'
  // DB-stored EN translations keyed by service id
  plantilla_en?: Record<string, {
    label_en?:           string | null
    texto_en?:           string | null
    entregables_en?:     { grupo: string; items: string[] }[] | null
    semanas_default_en?: string | null
    pago_en?:            { label: string; pct: number }[] | null
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null, lang: 'es' | 'en' = 'es') {
  const locale = lang === 'en' ? 'en-GB' : 'es-ES'
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
}

function numToWordsES(n: number): string {
  n = Math.round(n)
  if (n === 0) return 'CERO'
  const units  = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
                  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const tens   = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const hunds  = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  let r = ''
  if (n >= 1000) {
    const t = Math.floor(n / 1000)
    r += t === 1 ? 'MIL' : numToWordsES(t) + ' MIL'
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

function numToWordsEN(n: number): string {
  n = Math.round(n)
  if (n === 0) return 'ZERO'
  const units = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
                 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
                 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens  = ['', 'TEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
  let r = ''
  if (n >= 1000) {
    const t = Math.floor(n / 1000)
    r += numToWordsEN(t) + ' THOUSAND'
    n %= 1000
    if (n > 0) r += ' '
  }
  if (n >= 100) {
    r += units[Math.floor(n / 100)] + ' HUNDRED'
    n %= 100
    if (n > 0) r += ' '
  }
  if (n >= 20) {
    r += tens[Math.floor(n / 10)]
    const rem = n % 10
    if (rem > 0) r += '-' + units[rem]
  } else if (n > 0) {
    r += units[n]
  }
  return r
}

function eurToWords(amount: number, lang: 'es' | 'en' = 'es'): string {
  const words = lang === 'en' ? numToWordsEN(amount) : numToWordsES(amount)
  return `${words} EUROS (${fmtEur(amount)})`
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
  const lang = data.lang ?? 'es'
  const sortedServicios = sortServicios(data.servicios_contrato)
  const totalHonorarios = data.honorarios.reduce((s, h) => s + (h.importe ?? 0), 0)

  const nombreCompleto = [data.cliente_nombre, data.cliente_apellidos].filter(Boolean).join(' ')
  const domicilio = [data.cliente_direccion, data.cliente_ciudad].filter(Boolean).join(', ') || '—'

  // Build client party string per language
  const clienteParty = lang === 'en'
    ? (data.tipo_cliente === 'juridica'
        ? `the company ${data.cliente_empresa ?? nombreCompleto}, with Tax ID ${data.cliente_nif ?? '—'}, domiciled at ${domicilio}, represented by ${nombreCompleto}`
        : `${nombreCompleto}${data.cliente_nif ? `, with ID ${data.cliente_nif}` : ''}${data.cliente_direccion ? `, domiciled at ${domicilio}` : ''}`)
    : (data.tipo_cliente === 'juridica'
        ? `la sociedad ${data.cliente_empresa ?? nombreCompleto}, con NIF ${data.cliente_nif ?? '—'}, con domicilio en ${domicilio}, representada por ${nombreCompleto}`
        : `${nombreCompleto}${data.cliente_nif ? `, con DNI ${data.cliente_nif}` : ''}${data.cliente_direccion ? `, con domicilio en ${domicilio}` : ''}`)

  const propiedadAddr = data.proyecto_direccion ?? '—'
  const proyectoDesc  = data.proyecto_tipo ?? (lang === 'en' ? 'refurbishment' : 'reforma')
  const serviceNames  = data.servicios_contrato
    .map(s => {
      const dbEN_ = lang === 'en' ? data.plantilla_en?.[s.id] : null
      return dbEN_?.label_en || (lang === 'en' ? SERVICIOS_CONFIG_EN[s.id as ServicioId]?.label : null) || s.label
    })
    .join(', ')

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        {lang === 'en'
          ? `${STUDIO.razon_social} (trading as ${STUDIO.nombre_comercial}) · Tax ID ${STUDIO.nif}`
          : `${STUDIO.razon_social} (nombre comercial ${STUDIO.nombre_comercial}) · NIF ${STUDIO.nif}`}
      </Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )

  // ── Spanish legal texts ───────────────────────────────────────────────────
  const es = {
    docTitle: 'Contrato de Servicios Profesionales',
    studioSub: 'Taller de arquitectura y diseño',
    contractDate: 'Fecha del contrato',
    city: 'Ciudad',
    cityValue: 'Madrid',
    reunidos: 'Reunidos',
    openingLine: `En Madrid, a ${formatDate(data.fecha_contrato, 'es')}.`,
    partyOneLabel: 'De una parte',
    clientRole: data.tipo_cliente === 'juridica' ? 'cliente' : 'propietario/s de la vivienda/local',
    locationPrep: `situada en ${propiedadAddr}`,
    clientSuffix: '(en adelante, el «CLIENTE»).',
    partyTwoLabel: 'Y, de otra parte',
    studioParty: `la sociedad ${STUDIO.razon_social} (nombre comercial ${STUDIO.nombre_comercial}), con NIF ${STUDIO.nif}, con domicilio en ${STUDIO.domicilio}, representada por Doña ${STUDIO.rep_nombre}, mayor de edad, con DNI ${STUDIO.rep_dni}, ${STUDIO.rep_titulo} (en adelante, el «ESTUDIO»).`,
    bothParties: 'Ambas partes con la capacidad legal necesaria para otorgar y suscribir el presente contrato (en adelante, el «Contrato»).',
    manifiestan: 'Manifiestan',
    m1: `Que el Estudio ofrece sus servicios profesionales de ${serviceNames} (en adelante, los «Servicios»), cuyos entregables quedan definidos en la cláusula primera del contrato.`,
    m2: `Que el Cliente va a realizar la ${proyectoDesc.toUpperCase()}${propiedadAddr !== '—' ? ` en el inmueble situado en ${propiedadAddr}` : ''}.`,
    m3: `Que el Cliente desea contratar los servicios profesionales del Estudio para la realización de los siguientes servicios: ${serviceNames}.`,
    m4: 'Que a tales efectos y de mutuo acuerdo, el Cliente contrata la prestación de los servicios consignados en el punto anterior al Estudio, quien acepta el trabajo encomendado, acordando las PARTES las siguientes cláusulas:',
    clausulas: 'Cláusulas',
    clause1Title: 'Primera. Contenido de los trabajos',
    clause1Intro: 'Los servicios que se incluyen son los siguientes:',
    plazoLabel: 'Plazo estimado: ',
    clause1Exclusions: 'Se excluye de lo anterior cualquier trabajo no citado con anterioridad. Se citan con carácter enunciativo y no limitativo los siguientes: limpieza, montaje, etc. Queda igualmente excluido, de forma expresa, el coste del mobiliario, decoración y cualquier otro elemento de compra o suministro, independientemente de que el Estudio pueda asesorar en su selección.',
    clause2Title: 'Segunda. Honorarios',
    clause2Intro: (amountWords: string) =>
      `Las Partes acuerdan que los honorarios de los servicios contratados ascienden a un total de ${amountWords}. A esta cantidad se le deberá incrementar el IVA correspondiente.`,
    criterioTitle: 'Criterio de cálculo de honorarios',
    criterioPemBoth: 'Los honorarios correspondientes a las fases de proyecto y dirección de obra han sido determinados mediante la aplicación de un porcentaje profesional sobre el Presupuesto de Ejecución Material (en adelante, «PEM») objetivo de la obra, entendido éste como el coste estimado de los trabajos de construcción, sin incluir gastos generales del promotor, honorarios técnicos ni tributos. Dicho criterio vincula la retribución del Estudio al alcance real del encargo y al valor de la obra proyectada, distribuyendo el total de honorarios entre dichas fases en proporción al peso relativo de cada servicio.',
    criterioPemOnly: 'Los honorarios acordados han sido determinados mediante la aplicación de un porcentaje profesional sobre el Presupuesto de Ejecución Material (en adelante, «PEM») objetivo de la obra, entendido éste como el coste estimado de los trabajos de construcción, sin incluir gastos generales del promotor, honorarios técnicos ni tributos. Dicho criterio vincula la retribución del Estudio al alcance real del encargo y al valor de la obra proyectada, distribuyendo el total de honorarios entre las distintas fases del encargo en proporción al peso relativo de cada servicio sobre el conjunto de la prestación profesional.',
    interiorismoTitle: (names: string) => `Honorarios de ${names}`,
    interiorismoCriteria: (names: string) =>
      `Con carácter expreso, los honorarios correspondientes a los servicios de ${names} quedan excluidos del sistema de cálculo basado en porcentaje sobre el PEM. Su determinación responde a una metodología independiente, consistente en la estimación de horas de dedicación del equipo técnico del Estudio en función del tamaño, complejidad y alcance del encargo, a las que se aplica la tarifa horaria profesional vigente según el perfil de los profesionales asignados. Los importes acordados para estas fases quedan fijados en la tabla de hitos de pago del presente Contrato y no están sujetos a revisión por variación del Presupuesto de Ejecución Material de la obra.`,
    doRevisionTitle: 'Revisión del PEM y liquidación definitiva de honorarios de dirección de obra',
    doRevisionIntro: 'Dado que los honorarios correspondientes a la fase de Dirección Estética de Obra se calculan sobre el PEM objetivo establecido al inicio del encargo, y habida cuenta de que el coste real de ejecución puede variar a lo largo del proceso constructivo, las Partes acuerdan expresamente el siguiente mecanismo de liquidación:',
    doRevisionA: 'a. Con carácter previo al devengo y facturación del último hito de pago de la fase de Dirección Estética de Obra, el Estudio llevará a cabo una verificación del coste real de ejecución material de la obra, en coordinación con el Constructor y sobre la base de la certificación final o del presupuesto de obra liquidado.',
    doRevisionB: 'b. En el supuesto de que el PEM definitivo resultase superior al objetivo de partida empleado como base de cálculo, el importe del último hito de honorarios de la Dirección Estética de Obra será revisado al alza de forma proporcional a dicha variación, de modo que los honorarios reflejen fielmente el alcance real de la prestación realizada.',
    doRevisionC: 'c. Queda expresamente excluida cualquier revisión a la baja de los honorarios pactados en el presente Contrato. En ningún caso la reducción del PEM definitivo respecto al objetivo inicial dará lugar a una minoración de los honorarios ya devengados ni de los pendientes de facturación.',
    doRevisionClose: 'Esta cláusula constituye un acuerdo expreso entre las Partes orientado a garantizar la equidad retributiva del Estudio ante variaciones de alcance durante la ejecución, sin que ello suponga en ningún caso un menoscabo para el Cliente en términos de calidad o dedicación del servicio prestado.',
    hitosPreamble: 'A continuación se fijan los siguientes hitos de pago:',
    totalHonorarios: 'Total honorarios',
    travelNote: '* Los gastos de desplazamiento para visitas de obra (kilometraje, parking, transporte público o dietas según el caso) no están incluidos en los honorarios anteriores y podrán ser incorporados a las facturas correspondientes, previa comunicación al Cliente.',
    modificacionesTitle: 'Modificaciones',
    modificaciones1: 'El Cliente podrá proponer cambios a los trabajos en el plazo de una (1) semana desde su presentación, período tras el cual se considerarán aprobados. Todo cambio solicitado por el Cliente una vez entregado cada servicio se considerará parte del siguiente.',
    modificaciones2: `Las alteraciones sustanciales que sean peticiones expresas del Cliente, una vez aprobado el trabajo correspondiente, serán objeto de honorarios adicionales pactados previamente con base al precio horario del Estudio (Arquitecto Junior ${PRECIO_HORA.junior}€/h + IVA / Arquitecto Senior ${PRECIO_HORA.senior}€/h + IVA / Arquitecto Socio ${PRECIO_HORA.socio}€/h + IVA), las cuales se facturarán una vez realizadas las alteraciones. Se considerarán alteraciones sustanciales las que impliquen un cambio de concepto, modificaciones por parte de otros técnicos en estructuras o instalaciones que supongan una alteración sustancial, una carga de trabajo imprevista, la realización de dibujos para atender solicitaciones del constructor a soluciones constructivas distintas a las fijadas en la memoria de calidades, la incorporación de aportaciones de terceros y la realización de visitas de obra fuera del plazo marcado por el cronograma.`,
    formaPagoTitle: 'Forma de pago',
    formaPago1: 'El Estudio elaborará, con carácter previo a cada período de vencimiento, una factura que deberá ser abonada en el plazo de quince (15) días a contar desde su emisión mediante transferencia bancaria a la cuenta que señale el Estudio.',
    formaPago2: 'Cualquier retraso en el pago de la factura constituirá al deudor en mora de forma automática, sin necesidad de intimación o requerimiento previo. Dicho retraso devengará, desde el día siguiente al del vencimiento y hasta la fecha de su íntegro pago, un interés de demora pactado del 3% mensual sobre el importe total de la factura impagada.',
    exclusionesTitle: 'Exclusiones',
    exclusiones: 'Quedan expresamente excluidos del contrato todos los servicios no recogidos en el índice anteriormente expuesto. Con carácter enunciativo y no limitativo, se citan los siguientes: redacción de separatas al proyecto no citadas, servicios de Seguridad y Salud en cualquier fase, tramitaciones urbanísticas, tramitación de legalizaciones y boletines de instalaciones, etc.',
    clause3Title: 'Tercera. Obligaciones del Estudio',
    clause3Items: [
      'El Estudio se obliga a realizar los servicios contratados con la máxima diligencia, colaborando con contratistas externos para que los trabajos se lleven a cabo de conformidad con lo que las partes acuerden.',
      'El Estudio se obliga a informar al Cliente de los avances en sus trabajos.',
      'El Estudio será responsable de los daños directos probados con un máximo de los honorarios previstos para la fase en la que se haya producido el incumplimiento, quedando su responsabilidad limitada a dicha cantidad y exenta de cualquier otra. El Estudio no será responsable por daños indirectos, incidentales, especiales, punitivos o consecuentes o de terceros, ni de trabajos que no formen parte de este encargo.',
      'En caso en que el Estudio se retrase en la entrega del servicio contratado al Cliente por causas únicamente imputables al Estudio, éste tendrá derecho a aplicar una penalización del 1% de los Honorarios correspondientes a dicha entrega por cada día natural de retraso.',
    ],
    clause4Title: 'Cuarta. Obligaciones del Cliente',
    clause4Items: [
      'Condición de Promotor y Titularidad. El Cliente ostenta la condición legal de Promotor a los efectos de la Ley 38/1999, de 5 de noviembre, de Ordenación de la Edificación (LOE) y de la normativa urbanística aplicable. Como tal, es el único titular y responsable de todas las gestiones, obligaciones y cargas inherentes a dicha condición.',
      'Es obligación exclusiva e indelegable del Cliente-Promotor solicitar, gestionar y obtener a su costa, con carácter previo al inicio de cualquier actuación material, el título habilitante urbanístico que resulte preceptivo ante cualquier Administración para la ejecución de la obra objeto del presente Contrato.',
      'El Estudio queda plenamente exonerado de cualquier responsabilidad por las decisiones finales sobre las soluciones a adoptar en el proyecto y su ejecución, correspondientes al Cliente en su condición de promotor. En ejercicio de dicha potestad, el Cliente asume como propia y exclusiva la responsabilidad final frente a la Administración y a terceros por las características de la obra efectivamente ejecutada.',
      'El Cliente se obliga a abonar las cantidades pactadas en el presente contrato y de la forma acordada.',
      'El Cliente se obliga a colaborar en todo lo necesario con el Estudio para el buen desarrollo de los servicios contratados.',
    ],
    clause5Title: 'Quinta. Duración',
    clause5_1: 'Los servicios acordados en el contrato comenzarán a la firma del mismo y tendrán terminación con fecha el cronograma de obra fijado en el contrato privado entre Constructor y Propiedad.',
    clause5_2: 'El Estudio, en caso de ser necesario, realizará tareas de seguimiento de posibles repasos y desperfectos de obra por parte del constructor durante dos (2) semanas tras la recepción de la obra por parte del Cliente.',
    clause6Title: 'Sexta. Resolución del contrato',
    clause6Intro: 'El presente Contrato se terminará:',
    clause6Items: [
      'Por transcurso de su plazo de duración.',
      'Por mutuo acuerdo por escrito de las partes, que podrán decidir su resolución total o parcial.',
      'Por cualquiera de las partes, en el supuesto de que la otra parte incumpla cualquiera de sus obligaciones derivadas del Contrato. En caso de que la obligación fuera subsanable, la Parte no incumplidora deberá notificar previamente por escrito a la otra Parte dicho incumplimiento, requiriéndole para que sea subsanado en un plazo de 10 días desde la recepción de la notificación.',
      'Por incumplimiento de órdenes del Estudio al Constructor en la Dirección Estética de Obra, debidamente notificados al Cliente. Se entenderá como incumplimiento de las órdenes cuando no se hayan seguido las instrucciones en tres (3) ocasiones, notificadas en las actas de visita.',
      'El Estudio podrá renunciar a la obra de forma unilateral en caso en que la obra se haya paralizado durante más de tres (3) meses por causas ajenas a él.',
      'La falta de pago por el Cliente del precio del Contrato en la forma y plazos pactados.',
      'El Cliente podrá rescindir el contrato en caso de un retraso superior a cuatro (4) semanas en cualquiera de los servicios objeto del contrato, por causas directa y exclusivamente imputables al Arquitecto. Quedan excluidas las causas de fuerza mayor.',
    ],
    clause6Close1: 'En caso de resolución del Contrato y una vez satisfechas las cantidades pactadas, el Estudio quedará obligado a dejar firmada la correspondiente Venia y facilitar toda la documentación al Arquitecto/Interiorista entrante en el acto del abono de la liquidación.',
    clause6Close2: 'En caso de producirse la rescisión del contrato por parte del Cliente, éste se verá obligado a abonar el 100% de los honorarios hasta la fase en la que se haya producido la rescisión, así como el 30% de los honorarios restantes correspondientes a las fases dejadas de realizar por parte del Estudio en concepto de indemnización.',
    clause7Title: 'Séptima. Propiedad intelectual',
    clause7_1: 'El ESTUDIO se reserva todos los derechos de propiedad intelectual sobre el proyecto, incluyendo, pero sin limitarse a, los planos, diseños, imágenes, modelados en 3D, documentación técnica y cualquier otro material generado en el desarrollo del mismo, conforme a lo dispuesto en la Ley de Propiedad Intelectual de España.',
    clause7_2: 'El trabajo realizado por el Estudio, una vez abonados los honorarios correspondientes, podrá ser utilizado por el Cliente una sola vez, única y exclusivamente para la ubicación consignada en este encargo, correspondiendo al Estudio los derechos inherentes a la propiedad intelectual. El Estudio podrá realizar reportaje fotográfico del Proyecto terminado y publicarlo con fines corporativos, docentes y de comunicación junto a la planimetría, manteniendo en cualquier caso la confidencialidad del Cliente y la ubicación exacta.',
    clause7_3: 'Queda expresamente prohibida la reproducción, modificación, cesión o utilización de la documentación para cualquier otro fin o en otra ubicación sin el consentimiento expreso y por escrito del Estudio.',
    clause8Title: 'Octava. Seguros',
    clause8: 'El Estudio se obliga a mantener en vigor por su cuenta y a su cargo una póliza de seguro de responsabilidad civil que cubra las posibles contingencias que se pudieran derivar de la prestación de los servicios. Las partes acuerdan que la responsabilidad del Estudio queda limitada a los honorarios previstos para la fase en la que se haya producido el incumplimiento.',
    clause9Title: 'Novena. Confidencialidad y protección de datos',
    clause9_1: 'Las Partes se comprometen a gestionar el presente encargo con ética, profesionalidad, reserva y legalidad, actuando con total lealtad y diligencia. También se obligan a velar por la confidencialidad de la información recibida, así como las que marca la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales.',
    clause9_2: 'Cualquier tipo de información, oral o escrita, que pueda facilitar el Cliente se entenderá confidencial y no podrá ser divulgada a terceras partes, limitándose su acceso a los empleados autorizados que precisen disponer de ella. Esta cláusula se mantendrá en vigor de forma indefinida, aún después de extinguido el presente Contrato.',
    clause9_3: 'El Cliente autoriza y exime de cualquier responsabilidad al Estudio en la comunicación de datos personales con fin único y exclusivo del correcto desarrollo de los servicios contratados con terceros (proveedores, montadores, ingenieros o cualquier otro agente directamente relacionado al proceso).',
    clause10Title: 'Décima. Disposiciones generales',
    clause10_1: 'Este Contrato constituye una unidad resultado del acuerdo completo entre las Partes en relación con su objeto. Todos los acuerdos suscritos por las partes de forma oral o escrita con anterioridad a su firma quedan derogados por el presente Contrato.',
    clause10_2: 'En el caso de que se declarase nula o inexigible cualquiera de las cláusulas del presente Contrato, su validez en conjunto no quedará afectada, permaneciendo en vigor los restantes términos y condiciones.',
    clause10_3: 'Para cuantas cuestiones, divergencias, interpretación o cumplimiento del presente Contrato puedan surgir entre las partes, éstas, con renuncia del fuero que pudiera corresponderles, se someten a los Juzgados y Tribunales de la ciudad de Madrid.',
    notasTitle: 'Notas adicionales',
    firmaCliente: 'Por el Cliente',
    firmaEstudio: 'Por el Estudio',
    conformidad: 'En prueba de conformidad, firman en el lugar y fecha expresados en el encabezamiento.',
  }

  // ── English legal texts ───────────────────────────────────────────────────
  const en: typeof es = {
    docTitle: 'Professional Services Agreement',
    studioSub: 'Architecture and design studio',
    contractDate: 'Contract date',
    city: 'City',
    cityValue: 'Madrid',
    reunidos: 'Parties',
    openingLine: `In Madrid, on ${formatDate(data.fecha_contrato, 'en')}.`,
    partyOneLabel: 'On the one part',
    clientRole: data.tipo_cliente === 'juridica' ? 'client' : 'owner(s) of the property',
    locationPrep: `located at ${propiedadAddr}`,
    clientSuffix: '(hereinafter, the «CLIENT»).',
    partyTwoLabel: 'And, on the other part',
    studioParty: `the company ${STUDIO.razon_social} (trading as ${STUDIO.nombre_comercial}), Tax ID ${STUDIO.nif}, domiciled at ${STUDIO.domicilio}, represented by Ms. ${STUDIO.rep_nombre}, of legal age, with ID ${STUDIO.rep_dni}, registered architect COAM 25284 (hereinafter, the «STUDIO»).`,
    bothParties: 'Both parties having the legal capacity required to grant and execute this agreement (hereinafter, the «Agreement»).',
    manifiestan: 'Recitals',
    m1: `That the Studio offers its professional services of ${serviceNames} (hereinafter, the «Services»), whose deliverables are defined in clause one of this Agreement.`,
    m2: `That the Client intends to carry out the ${proyectoDesc.toUpperCase()}${propiedadAddr !== '—' ? ` at the property located at ${propiedadAddr}` : ''}.`,
    m3: `That the Client wishes to engage the professional services of the Studio for the performance of the following services: ${serviceNames}.`,
    m4: 'That to such effect and by mutual agreement, the Client engages the Studio to provide the services referred to above, and the Studio accepts the commission, the PARTIES having agreed the following clauses:',
    clausulas: 'Clauses',
    clause1Title: 'First. Scope of work',
    clause1Intro: 'The services included are the following:',
    plazoLabel: 'Estimated timeline: ',
    clause1Exclusions: 'Any work not expressly listed above is excluded. By way of example and without limitation: cleaning, assembly, etc. The cost of furniture, décor and any other purchased or supplied items is likewise expressly excluded, regardless of whether the Studio may advise on their selection.',
    clause2Title: 'Second. Fees',
    clause2Intro: (amountWords: string) =>
      `The Parties agree that the fees for the contracted services amount to a total of ${amountWords}, to which the applicable VAT shall be added.`,
    criterioTitle: 'Fee calculation basis',
    criterioPemBoth: 'The fees corresponding to the project and construction management phases have been determined by applying a professional percentage to the target Material Execution Budget (hereinafter, «MEB») of the works, understood as the estimated cost of construction works, excluding the developer\'s general expenses, technical fees and taxes. This criterion links the Studio\'s remuneration to the actual scope of the commission and the value of the projected works, distributing the total fees between those phases in proportion to the relative weight of each service.',
    criterioPemOnly: 'The agreed fees have been determined by applying a professional percentage to the target Material Execution Budget (hereinafter, «MEB») of the works, understood as the estimated cost of construction works, excluding the developer\'s general expenses, technical fees and taxes. This criterion links the Studio\'s remuneration to the actual scope of the commission and the value of the projected works, distributing the total fees among the different phases of the commission in proportion to the relative weight of each service in the overall professional engagement.',
    interiorismoTitle: (names: string) => `Fees for ${names}`,
    interiorismoCriteria: (names: string) =>
      `Expressly, the fees corresponding to the services of ${names} are excluded from the MEB-based percentage calculation system. Their determination follows an independent methodology consisting of an estimate of the Studio's technical team hours of dedication based on the size, complexity and scope of the commission, to which the current professional hourly rate is applied according to the profile of the professionals assigned. The amounts agreed for these phases are fixed in the payment schedule of this Agreement and are not subject to revision on account of any variation in the Material Execution Budget of the works.`,
    doRevisionTitle: 'MEB revision and final settlement of construction management fees',
    doRevisionIntro: 'Given that the fees corresponding to the Aesthetic Construction Management phase are calculated on the target MEB established at the outset of the commission, and taking into account that the actual execution cost may vary throughout the construction process, the Parties expressly agree to the following settlement mechanism:',
    doRevisionA: 'a. Prior to the accrual and invoicing of the last payment milestone of the Aesthetic Construction Management phase, the Studio shall carry out a verification of the actual material execution cost of the works, in coordination with the Contractor and on the basis of the final certification or the settled construction budget.',
    doRevisionB: 'b. In the event that the final MEB is higher than the initial target used as the calculation basis, the amount of the last construction management fee instalment shall be revised upward proportionally to such variation, so that the fees faithfully reflect the actual scope of the services performed.',
    doRevisionC: 'c. Any downward revision of the fees agreed in this Agreement is expressly excluded. Under no circumstances shall a reduction in the final MEB compared to the initial target give rise to a decrease in fees already accrued or pending invoicing.',
    doRevisionClose: 'This clause constitutes an express agreement between the Parties aimed at ensuring equitable remuneration for the Studio in the event of scope variations during execution, without this entailing any detriment to the Client in terms of quality or dedication of the services provided.',
    hitosPreamble: 'The following payment milestones are hereby established:',
    totalHonorarios: 'Total professional fees',
    travelNote: '* Travel expenses for site visits (mileage, parking, public transport or per diems as applicable) are not included in the above fees and may be added to the corresponding invoices, subject to prior notice to the Client.',
    modificacionesTitle: 'Modifications',
    modificaciones1: 'The Client may propose changes to the works within one (1) week of their presentation, after which period they shall be deemed approved. Any change requested by the Client once each service has been delivered shall be considered part of the next phase.',
    modificaciones2: `Substantial alterations that are express requests of the Client, once the corresponding work has been approved, shall be subject to additional fees previously agreed on the basis of the Studio's hourly rate (Junior Architect ${PRECIO_HORA.junior}€/h + VAT / Senior Architect ${PRECIO_HORA.senior}€/h + VAT / Partner Architect ${PRECIO_HORA.socio}€/h + VAT), which shall be invoiced once the alterations have been carried out. Substantial alterations shall be understood as those involving a change of concept, modifications by other technicians in structures or installations that entail a substantial alteration, an unforeseen workload, the production of drawings to address requests from the contractor for constructive solutions other than those established in the specifications, the incorporation of third-party contributions and the performance of site visits outside the timetable set by the programme.`,
    formaPagoTitle: 'Payment terms',
    formaPago1: 'The Studio shall issue an invoice prior to each due date, which shall be paid within fifteen (15) days of its issuance by bank transfer to the account specified by the Studio.',
    formaPago2: 'Any delay in payment of the invoice shall automatically place the debtor in default, without the need for prior notice or demand. Such delay shall accrue, from the day following the due date until the date of full payment, a contractually agreed default interest of 3% per month on the total amount of the unpaid invoice.',
    exclusionesTitle: 'Exclusions',
    exclusiones: 'All services not included in the scope listed above are expressly excluded from this Agreement. By way of example and without limitation: preparation of addenda to the project not mentioned herein, Health and Safety services at any stage, urban planning procedures, legalisation procedures and utility connection certificates, etc.',
    clause3Title: 'Third. Obligations of the Studio',
    clause3Items: [
      'The Studio undertakes to perform the contracted services with the utmost diligence, collaborating with external contractors so that the works are carried out in accordance with what the parties agree.',
      'The Studio undertakes to keep the Client informed of progress in its work.',
      'The Studio shall be liable for proven direct damages up to a maximum of the fees corresponding to the phase in which the breach occurred, its liability being limited to that amount and exempt from any other. The Studio shall not be liable for indirect, incidental, special, punitive or consequential damages, or for damages suffered by third parties, nor for works that do not form part of this commission.',
      'In the event that the Studio delays delivery of the contracted service to the Client for reasons solely attributable to the Studio, the Client shall be entitled to apply a penalty of 1% of the Fees corresponding to such delivery for each calendar day of delay.',
    ],
    clause4Title: 'Fourth. Obligations of the Client',
    clause4Items: [
      'Developer status and ownership. The Client holds the legal status of Developer for the purposes of Law 38/1999 of 5 November on Building Regulation (LOE) and the applicable urban planning regulations. As such, the Client is the sole holder and responsible party for all management, obligations and burdens inherent to that status.',
      'It is the exclusive and non-delegable obligation of the Client-Developer to apply for, manage and obtain at its own cost, prior to the commencement of any physical works, the urban planning authorisation required by any competent Authority for the execution of the works that are the subject of this Agreement.',
      'The Studio is fully exempt from any liability for the final decisions regarding the solutions to be adopted in the project and its execution, which correspond to the Client in its capacity as developer. In exercising this power, the Client assumes sole and exclusive final responsibility before the Administration and third parties for the characteristics of the works actually carried out.',
      'The Client undertakes to pay the amounts agreed in this Agreement in the manner agreed.',
      'The Client undertakes to cooperate in all matters necessary with the Studio for the proper performance of the contracted services.',
    ],
    clause5Title: 'Fifth. Duration',
    clause5_1: 'The services agreed in this Agreement shall commence upon its signing and shall terminate on the date set by the construction programme established in the private contract between the Contractor and the Owner.',
    clause5_2: 'The Studio shall, if necessary, carry out monitoring of any snagging and construction defects by the contractor during two (2) weeks following handover of the works by the Client.',
    clause6Title: 'Sixth. Termination',
    clause6Intro: 'This Agreement shall be terminated:',
    clause6Items: [
      'Upon expiry of its term.',
      'By mutual written agreement of the parties, who may decide its total or partial termination.',
      'By either party, in the event that the other party breaches any of its obligations under this Agreement. If the breach is remediable, the non-breaching Party shall first give written notice to the other Party of such breach, requiring it to remedy the same within 10 days of receipt of the notification.',
      'Due to non-compliance with the Studio\'s instructions to the Contractor in the Aesthetic Construction Management, duly notified to the Client. Non-compliance with instructions shall be deemed to occur when the instructions have not been followed on three (3) occasions, as recorded in the site visit reports.',
      'The Studio may unilaterally withdraw from the works in the event that the works have been suspended for more than three (3) months for reasons beyond its control.',
      'Failure by the Client to pay the price under this Agreement in the manner and within the periods agreed.',
      'The Client may terminate this Agreement in the event of a delay of more than four (4) weeks in any of the services that are the subject of this Agreement, for reasons directly and exclusively attributable to the Architect. Force majeure events are excluded.',
    ],
    clause6Close1: 'In the event of termination of this Agreement and once the agreed amounts have been settled, the Studio shall be obliged to sign the corresponding professional transfer document and provide all documentation to the incoming Architect/Interior Designer at the time of payment of the settlement.',
    clause6Close2: 'In the event of termination of this Agreement by the Client, the Client shall be obliged to pay 100% of the fees up to the phase in which the termination occurred, as well as 30% of the remaining fees corresponding to the phases not performed by the Studio, as compensation.',
    clause7Title: 'Seventh. Intellectual property',
    clause7_1: 'The STUDIO reserves all intellectual property rights over the project, including but not limited to plans, designs, images, 3D models, technical documentation and any other material generated in the course of its development, in accordance with Spanish Intellectual Property Law.',
    clause7_2: 'The work performed by the Studio, once the corresponding fees have been paid, may be used by the Client on one single occasion, solely and exclusively for the location specified in this commission, with the intellectual property rights remaining with the Studio. The Studio may carry out photographic documentation of the completed Project and publish it for corporate, educational and communication purposes together with the drawings, while in any case maintaining the confidentiality of the Client and the exact location.',
    clause7_3: 'The reproduction, modification, assignment or use of the documentation for any other purpose or at any other location is expressly prohibited without the express written consent of the Studio.',
    clause8Title: 'Eighth. Insurance',
    clause8: 'The Studio undertakes to maintain in force at its own cost a professional liability insurance policy covering any contingencies that may arise from the provision of the services. The parties agree that the Studio\'s liability is limited to the fees corresponding to the phase in which the breach occurred.',
    clause9Title: 'Ninth. Confidentiality and data protection',
    clause9_1: 'The Parties undertake to conduct this commission with ethics, professionalism, discretion and compliance with the law, acting with full loyalty and diligence. They also undertake to safeguard the confidentiality of the information received, as well as to comply with Organic Law 3/2018 of 5 December on the Protection of Personal Data and the Guarantee of Digital Rights.',
    clause9_2: 'Any information, whether oral or written, provided by the Client shall be treated as confidential and shall not be disclosed to third parties, access being limited to authorised employees who need it for the purposes of the commission. This clause shall remain in force indefinitely, even after this Agreement has been terminated.',
    clause9_3: 'The Client authorises and exempts the Studio from any liability for the communication of personal data for the sole and exclusive purpose of the proper performance of the services contracted with third parties (suppliers, fitters, engineers or any other party directly involved in the process).',
    clause10Title: 'Tenth. General provisions',
    clause10_1: 'This Agreement constitutes the entire agreement between the Parties in relation to its subject matter. All agreements entered into by the parties, whether oral or written, prior to its signing are superseded by this Agreement.',
    clause10_2: 'If any clause of this Agreement is declared null and void or unenforceable, the validity of the Agreement as a whole shall not be affected, and the remaining terms and conditions shall remain in force.',
    clause10_3: 'For all matters, disputes, interpretation or performance of this Agreement that may arise between the parties, both parties, waiving any other jurisdiction that may apply, submit to the Courts of the city of Madrid.',
    notasTitle: 'Additional notes',
    firmaCliente: 'On behalf of the Client',
    firmaEstudio: 'On behalf of the Studio',
    conformidad: 'In witness whereof, the parties sign at the place and on the date stated in the heading.',
  }

  const T = lang === 'en' ? en : es

  return (
    <Document title={`Contrato ${data.numero} · Forma Prima`} author="Forma Prima">

      {/* ── PAGE 1: Header + PARTIES + RECITALS ── */}
      <Page size="A4" style={{ ...s.page, paddingTop: 0 }}>
        {/* Header */}
        <View style={s.headerBlock}>
          <View style={s.headerInner}>
            <Image src={LOGO_BLANCO} style={s.logo} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.headerTitle}>{T.docTitle}</Text>
              <Text style={s.headerSub}>{T.studioSub}</Text>
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
            <Text style={s.metaLabel}>{T.contractDate}</Text>
            <Text style={s.metaValue}>{formatDate(data.fecha_contrato, lang)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.metaLabel}>{T.city}</Text>
            <Text style={s.metaValue}>{T.cityValue}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* PARTIES / REUNIDOS */}
          <Text style={s.sectionTitle}>{T.reunidos}</Text>

          <Text style={s.bodyText}>
            {T.openingLine}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{T.partyOneLabel}</Text>
            {', '}
            {clienteParty}
            {', '}
            {lang === 'en' ? 'as ' : 'como '}
            {T.clientRole}
            {propiedadAddr !== '—' ? ` ${T.locationPrep}` : ''}
            {' '}
            {T.clientSuffix}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 6 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{T.partyTwoLabel}</Text>
            {', '}
            {T.studioParty}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 6 }}>
            {T.bothParties}
          </Text>

          {/* RECITALS / MANIFIESTAN */}
          <Text style={{ ...s.sectionTitle, marginTop: 4 }}>{T.manifiestan}</Text>

          <Text style={s.bodyText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>I.- </Text>
            {T.m1}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>II.- </Text>
            {T.m2}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>III.- </Text>
            {T.m3}
          </Text>

          <Text style={{ ...s.bodyText, marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>IV.- </Text>
            {T.m4}
          </Text>
        </View>

        <Footer />
      </Page>

      {/* ── PAGES 2+: CLAUSES ── */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <Text style={s.sectionTitle}>{T.clausulas}</Text>

          {/* CLAUSE 1 */}
          <Text style={s.clauseTitle}>{T.clause1Title}</Text>
          <Text style={s.bodyText}>{T.clause1Intro}</Text>

          {sortedServicios.map((srv, i) => {
            const dbEN         = lang === 'en' ? data.plantilla_en?.[srv.id] : null
            const cfgEN        = lang === 'en' ? SERVICIOS_CONFIG_EN[srv.id as ServicioId] : null
            const srvLabel     = dbEN?.label_en   || cfgEN?.label        || srv.label
            const srvTexto     = dbEN?.texto_en   || cfgEN?.texto         || srv.texto
            const srvEntregs   = (dbEN?.entregables_en && dbEN.entregables_en.length > 0) ? dbEN.entregables_en : (cfgEN?.entregables ?? srv.entregables)
            const srvSemanas   = dbEN?.semanas_default_en || cfgEN?.semanas_default || srv.semanas
            const srvNotas = srv.notas
            return (
              <View key={srv.id} wrap={false}>
                {/* Title + duration inline */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: i === 0 ? 6 : 14, marginBottom: 2 }}>
                  <Text style={{ ...s.subClauseTitle, marginTop: 0, flex: 1 }}>
                    {srvLabel}
                  </Text>
                  {!!srvSemanas && (
                    <Text style={{ fontSize: 7.5, color: C.mid, marginLeft: 8, fontStyle: 'italic' }}>
                      {T.plazoLabel}{srvSemanas}
                    </Text>
                  )}
                </View>
                {!!srvTexto && (
                  <Text style={s.bodyText}>{srvTexto}</Text>
                )}
                {srvEntregs.map(grupo => (
                  <View key={grupo.grupo}>
                    <Text style={s.groupLabel}>{grupo.grupo}</Text>
                    {grupo.items.map((item, j) => (
                      <Text key={j} style={s.bullet}>
                        {'· ' + item}
                      </Text>
                    ))}
                  </View>
                ))}
                {!!srvNotas && (
                  <Text style={{ ...s.bodyText, marginTop: 5, fontStyle: 'italic', color: C.mid }}>
                    {srvNotas}
                  </Text>
                )}
              </View>
            )
          })}

          <Text style={{ ...s.bodyText, marginTop: 14 }}>
            {T.clause1Exclusions}
          </Text>

          {/* CLAUSE 2 */}
          <Text style={s.clauseTitle}>{T.clause2Title}</Text>

          <Text style={s.bodyText}>
            {lang === 'en'
              ? <>{'The Parties agree that the fees for the contracted services amount to a total of '}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{eurToWords(totalHonorarios, 'en')}</Text>{', to which the applicable VAT shall be added.'}</>
              : <>{'Las Partes acuerdan que los honorarios de los servicios contratados ascienden a un total de '}<Text style={{ fontFamily: 'Helvetica-Bold' }}>{eurToWords(totalHonorarios, 'es')}</Text>{'. A esta cantidad se le deberá incrementar el IVA correspondiente.'}</>
            }
          </Text>

          {/* Criterio de cálculo */}
          {(() => {
            const hasPem          = data.servicios_contrato.some(s => ['anteproyecto', 'proyecto_ejecucion', 'direccion_obra'].includes(s.id))
            const hasInteriorismo = data.servicios_contrato.some(s => ['interiorismo', 'gestion_interiorismo'].includes(s.id))
            const interiorismoNames = data.servicios_contrato
              .filter(s => ['interiorismo', 'gestion_interiorismo'].includes(s.id))
              .map(s => {
                const dbEN_ = lang === 'en' ? data.plantilla_en?.[s.id] : null
                return dbEN_?.label_en || (lang === 'en' ? SERVICIOS_CONFIG_EN[s.id as ServicioId]?.label : null) || s.label
              })
            if (!hasPem && !hasInteriorismo) return null
            return (
              <>
                <Text style={{ ...s.subClauseTitle, marginTop: 12 }}>{T.criterioTitle}</Text>
                {hasPem && (
                  <Text style={s.bodyText}>
                    {hasInteriorismo ? T.criterioPemBoth : T.criterioPemOnly}
                  </Text>
                )}
                {hasInteriorismo && (
                  <>
                    <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>
                      {T.interiorismoTitle(interiorismoNames.join(lang === 'en' ? ' and ' : ' y '))}
                    </Text>
                    <Text style={s.bodyText}>
                      {T.interiorismoCriteria(interiorismoNames.join(lang === 'en' ? ' and ' : ' y '))}
                    </Text>
                  </>
                )}
              </>
            )
          })()}
          {(() => {
            const includesDO = data.servicios_contrato.some(s => s.id === 'direccion_obra')
            if (!includesDO) return null
            return (
              <>
                <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>{T.doRevisionTitle}</Text>
                <Text style={s.bodyText}>{T.doRevisionIntro}</Text>
                <Text style={{ ...s.indented, marginTop: 2 }}>{T.doRevisionA}</Text>
                <Text style={{ ...s.indented, marginTop: 3 }}>{T.doRevisionB}</Text>
                <Text style={{ ...s.indented, marginTop: 3 }}>{T.doRevisionC}</Text>
                <Text style={{ ...s.bodyText, marginTop: 6 }}>{T.doRevisionClose}</Text>
              </>
            )
          })()}

          <Text style={{ ...s.bodyText, marginTop: 8 }}>{T.hitosPreamble}</Text>

          {/* Payment table */}
          <View style={s.pagoTable}>
            {data.honorarios.map((h, i) => {
              // Translate seccion (service label) and descripcion (milestone label) when lang=en
              const seccionStr = lang === 'en'
                ? (() => {
                    // Match by label to get the service id, then look up EN translation
                    const srv = data.servicios_contrato.find(s => s.label === h.seccion)
                    if (srv) {
                      const dbEN = data.plantilla_en?.[srv.id]
                      return dbEN?.label_en || SERVICIOS_CONFIG_EN[srv.id as ServicioId]?.label || h.seccion
                    }
                    return PAGO_LABEL_EN[h.seccion] ?? h.seccion
                  })()
                : h.seccion
              const descripcionStr = lang === 'en'
                ? (PAGO_LABEL_EN[h.descripcion] ?? h.descripcion)
                : h.descripcion
              return (
                <View key={i} wrap={false} style={{ ...s.pagoRow, backgroundColor: i % 2 === 0 ? C.white : C.light }}>
                  <View style={s.pagoLeft}>
                    {h.seccion && h.seccion !== h.descripcion && (
                      <Text style={s.pagoSeccion}>{seccionStr}</Text>
                    )}
                    <Text style={s.pagoLabel}>{descripcionStr}</Text>
                  </View>
                  <Text style={s.pagoImporte}>{fmtEur(h.importe)} + {lang === 'en' ? 'VAT' : 'IVA'}</Text>
                </View>
              )
            })}
            <View wrap={false} style={s.totalRow}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.hInk }}>{T.totalHonorarios}</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.brand }}>{fmtEur(totalHonorarios)} + {lang === 'en' ? 'VAT' : 'IVA'}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 7.5, color: C.mid, marginTop: 8, lineHeight: 1.55 }}>
            {T.travelNote}
          </Text>

          {/* Modifications */}
          <Text style={{ ...s.subClauseTitle, marginTop: 14 }}>{T.modificacionesTitle}</Text>
          <Text style={s.bodyText}>{T.modificaciones1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.modificaciones2}</Text>

          {/* Payment terms */}
          <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>{T.formaPagoTitle}</Text>
          <Text style={s.bodyText}>{T.formaPago1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.formaPago2}</Text>

          {/* Exclusions */}
          <Text style={{ ...s.subClauseTitle, marginTop: 10 }}>{T.exclusionesTitle}</Text>
          <Text style={s.bodyText}>{T.exclusiones}</Text>

          {/* CLAUSE 3 */}
          <Text style={s.clauseTitle}>{T.clause3Title}</Text>
          {T.clause3Items.map((txt, i) => (
            <Text key={i} style={{ ...s.indented, marginBottom: 5 }}>
              {String.fromCharCode(97 + i) + '. ' + txt}
            </Text>
          ))}

          {/* CLAUSE 4 */}
          <Text style={s.clauseTitle}>{T.clause4Title}</Text>
          {T.clause4Items.map((txt, i) => (
            <Text key={i} style={{ ...s.indented, marginBottom: 5 }}>
              {String.fromCharCode(97 + i) + '. ' + txt}
            </Text>
          ))}

          {/* CLAUSE 5 */}
          <Text style={s.clauseTitle}>{T.clause5Title}</Text>
          <Text style={s.bodyText}>{T.clause5_1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause5_2}</Text>

          {/* CLAUSE 6 */}
          <Text style={s.clauseTitle}>{T.clause6Title}</Text>
          <Text style={{ ...s.bodyText, marginBottom: 4 }}>{T.clause6Intro}</Text>
          {T.clause6Items.map((txt, i) => (
            <Text key={i} style={{ ...s.indented, marginBottom: 5 }}>
              {String.fromCharCode(97 + i) + '. ' + txt}
            </Text>
          ))}
          <Text style={{ ...s.bodyText, marginTop: 6 }}>{T.clause6Close1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause6Close2}</Text>

          {/* CLAUSE 7 */}
          <Text style={s.clauseTitle}>{T.clause7Title}</Text>
          <Text style={s.bodyText}>{T.clause7_1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause7_2}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause7_3}</Text>

          {/* CLAUSE 8 */}
          <Text style={s.clauseTitle}>{T.clause8Title}</Text>
          <Text style={s.bodyText}>{T.clause8}</Text>

          {/* CLAUSE 9 */}
          <Text style={s.clauseTitle}>{T.clause9Title}</Text>
          <Text style={s.bodyText}>{T.clause9_1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause9_2}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause9_3}</Text>

          {/* CLAUSE 10 */}
          <Text style={s.clauseTitle}>{T.clause10Title}</Text>
          <Text style={s.bodyText}>{T.clause10_1}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause10_2}</Text>
          <Text style={{ ...s.bodyText, marginTop: 4 }}>{T.clause10_3}</Text>

          {/* Additional notes */}
          {data.notas && (
            <View wrap={false}>
              <Text style={{ ...s.clauseTitle, color: C.mid }}>{T.notasTitle}</Text>
              <Text style={s.bodyText}>{data.notas}</Text>
            </View>
          )}

          {/* Signatures */}
          <View style={s.firmaBlock} wrap={false}>
            <View style={s.firmaCol}>
              <View style={s.firmaLinea} />
              <Text style={s.firmaLabel}>{T.firmaCliente}</Text>
              <Text style={s.firmaNombre}>
                {[data.cliente_nombre, data.cliente_apellidos].filter(Boolean).join(' ')}
              </Text>
              {data.tipo_cliente === 'juridica' && data.cliente_empresa && (
                <Text style={{ ...s.firmaLabel, marginTop: 2 }}>{data.cliente_empresa}</Text>
              )}
            </View>
            <View style={s.firmaCol}>
              <View style={s.firmaLinea} />
              <Text style={s.firmaLabel}>{T.firmaEstudio}</Text>
              <Text style={s.firmaNombre}>{STUDIO.rep_nombre}</Text>
              <Text style={{ ...s.firmaLabel, marginTop: 2 }}>{STUDIO.nombre_comercial}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 7, color: C.meta, textAlign: 'center', marginTop: 12 }}>
            {T.conformidad}
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

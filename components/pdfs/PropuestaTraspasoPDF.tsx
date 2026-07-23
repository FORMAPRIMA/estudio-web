// Server-only PDF — Propuesta de traspaso del quiosco a los vendedores.
// Carta cálida y personal (no formato corporativo) con dos opciones de pago,
// página de impuestos explicados en lenguaje llano y acuerdo de reserva.
// Los importes son editables desde la tab "Propuesta final".

import type * as ReactPDF from '@react-pdf/renderer'

const C = {
  ink:   '#2A2622',
  soft:  '#5A534C',
  mid:   '#8A8078',
  brand: '#9A5B34',
  rule:  '#D8D0C6',
  light: '#F7F3EC',
  white: '#FFFFFF',
}

export interface PropuestaData {
  fecha: string
  destinatarios: string      // "Ángel y Mari"
  firmantes: string          // "José y Gaby"
  direccion: string          // "Calle Goya, 63 · Madrid"
  opcion1Monto: number
  opcion1Irpf: number
  opcion1Neto: number
  opcion2Total: number
  opcion2Entrada: number
  opcion2Mensualidad: number
  opcion2Meses: number
  opcion2IrpfPrimer: number
  opcion2IrpfResto: number
  opcion2Neto: number
  senal: number
  compensacion: number
  reservaDias: number
}

const eur = (n: number) => `${Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' })} €`

function fmtMesAno(iso: string): string {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const d = new Date(iso)
  return `${meses[d.getMonth()]} de ${d.getFullYear()}`
}

export function buildPropuestaTraspasoElement(
  pdf: typeof ReactPDF,
  data: PropuestaData
): ReactPDF.DocumentProps & React.ReactElement {
  const { Document, Page, View, Text, StyleSheet } = pdf

  const s = StyleSheet.create({
    page:     { paddingTop: 44, paddingBottom: 40, paddingHorizontal: 62, fontFamily: 'Helvetica', fontSize: 10, color: C.ink, backgroundColor: C.white },
    fecha:    { fontSize: 9, color: C.mid, textAlign: 'right', marginBottom: 16 },
    title:    { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: C.ink },
    sub:      { fontSize: 10, color: C.mid, textAlign: 'center', marginTop: 4, marginBottom: 18 },
    p:        { fontSize: 10, color: C.soft, lineHeight: 1.6, marginBottom: 10, textAlign: 'justify' },
    optBox:   { borderWidth: 1, borderColor: C.rule, borderRadius: 6, padding: 14, marginBottom: 12 },
    optHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 },
    optTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.ink },
    optPrice: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.brand },
    optTag:   { fontSize: 9, fontStyle: 'italic', color: C.mid, marginBottom: 8 },
    bullet:   { flexDirection: 'row', marginBottom: 5 },
    bulletDot:{ width: 12, fontSize: 10, color: C.brand },
    bulletTx: { flex: 1, fontSize: 9.5, color: C.soft, lineHeight: 1.55 },
    firma:    { marginTop: 14 },
    firmaIt:  { fontSize: 10, fontStyle: 'italic', color: C.soft },
    firmaNm:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 3 },

    // Página impuestos
    h2:       { fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: C.ink },
    h2sub:    { fontSize: 9.5, color: C.mid, textAlign: 'center', marginTop: 3, marginBottom: 20 },
    card:     { borderWidth: 1, borderColor: C.rule, borderRadius: 6, padding: 14, marginBottom: 12 },
    cardTitle:{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 8 },
    lineRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.rule },
    lineL:    { fontSize: 9.5, color: C.soft, flex: 1, paddingRight: 8 },
    lineR:    { fontSize: 9.5, color: C.ink, textAlign: 'right' },
    lineRb:   { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right' },
    cmpBox:   { backgroundColor: C.light, borderRadius: 6, padding: 14, marginBottom: 12 },

    // Reserva
    resItem:  { flexDirection: 'row', marginBottom: 9 },
    resNum:   { width: 16, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.brand },
    resTx:    { flex: 1, fontSize: 9.5, color: C.soft, lineHeight: 1.55, textAlign: 'justify' },
    firmaLine:{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
    firmaCol: { width: '42%', borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 5 },
    firmaLbl: { fontSize: 9, color: C.mid },
  })

  const Bullet = ({ children }: { children: React.ReactNode }) => (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletTx}>{children}</Text>
    </View>
  )

  const diferencia = data.opcion2Neto - data.opcion1Neto
  const extra = data.opcion2Total - data.opcion1Monto
  const pct1 = Math.round((1 - data.opcion1Irpf / data.opcion1Monto) * 100)

  return (
    <Document title="Propuesta de traspaso — Quiosco Goya 63" author="Forma Prima">
      {/* ── PÁGINA 1 · Carta ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.fecha}>Madrid, {fmtMesAno(data.fecha)}</Text>
        <Text style={s.title}>Propuesta para el traspaso del quiosco</Text>
        <Text style={s.sub}>{data.direccion}</Text>

        <Text style={s.p}>Estimados {data.destinatarios}:</Text>
        <Text style={s.p}>
          Antes de hablar de números, queremos agradecerles que nos hayan recibido y la confianza que nos han
          mostrado. Sabemos que este quiosco lleva tres generaciones en su familia y que no es solamente un negocio:
          es una vida entera de trabajo. Nuestra intención es cuidar esa esquina, darle una nueva etapa y que ustedes
          puedan comenzar su jubilación con la tranquilidad de haberla dejado en buenas manos.
        </Text>
        <Text style={s.p}>
          Les proponemos dos formas de pago, las dos serias y sin letras chiquitas. Elijan la que mejor se acomode a
          sus planes; en la siguiente página les explicamos, con ejemplos sencillos, los impuestos de cada una.
        </Text>

        <View style={s.optBox}>
          <View style={s.optHead}>
            <Text style={s.optTitle}>Opción 1 — Cobrar todo de una vez</Text>
            <Text style={s.optPrice}>{eur(data.opcion1Monto)}</Text>
          </View>
          <Text style={s.optTag}>La opción rápida: un solo acto y operación cerrada.</Text>
          <Bullet>Reciben {eur(data.opcion1Monto)} el mismo día de la firma, disponibles desde el primer momento.</Bullet>
          <Bullet>
            A cambio de esa inmediatez, el monto total es menor y todo paga impuestos el mismo año: de cada 100 €
            cobrados, unos {(100 - pct1)} € se van en IRPF.
          </Bullet>
        </View>

        <View style={s.optBox}>
          <View style={s.optHead}>
            <Text style={s.optTitle}>Opción 2 — Una mensualidad durante {Math.round(data.opcion2Meses / 12)} años</Text>
            <Text style={s.optPrice}>{eur(data.opcion2Total)} en total</Text>
          </View>
          <Text style={s.optTag}>La opción que más dinero les deja: cobran {eur(extra)} más y pagan menos impuestos.</Text>
          <Bullet>
            Reciben {eur(data.opcion2Entrada)} el día de la firma y, desde el mes siguiente, {eur(data.opcion2Mensualidad)} puntuales
            cada mes durante {Math.round(data.opcion2Meses / 12)} años. En total, {eur(data.opcion2Total)}.
          </Bullet>
          <Bullet>
            Funciona como una segunda pensión que llega cada mes, justamente en los primeros años de su jubilación:
            los de los viajes, los nietos y los planes pendientes.
          </Bullet>
          <Bullet>
            Hacienda también los trata mejor: en lugar de pagar unos {eur(data.opcion1Irpf)} de IRPF de un jalón, pagarían
            mucho menos, repartido y más llevadero. Al final les quedan en el bolsillo unos {eur(diferencia)} más que
            con la otra opción.
          </Bullet>
          <Bullet>
            Y queda todo por escrito y con garantías: si a cualquiera de los dos llegara a pasarle algo, la mensualidad
            la seguirían recibiendo sus hijos.
          </Bullet>
        </View>

        <Text style={s.p}>
          La decisión es completamente suya y las dos opciones van totalmente en serio. Pero si nos preguntaran cuál
          elegiríamos estando en su lugar, se lo decimos con franqueza: la segunda. No porque a nosotros nos convenga
          más, sino porque los números los tratan mejor a ustedes: más dinero en total, menos impuestos y un ingreso
          fijo cada mes. Y si prefieren un camino intermedio, con todo gusto lo platicamos con calma.
        </Text>
        <View style={s.firma} wrap={false}>
          <Text style={s.firmaIt}>Con cariño y agradecimiento,</Text>
          <Text style={s.firmaNm}>{data.firmantes}</Text>
        </View>
      </Page>

      {/* ── PÁGINA 2 · Impuestos ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Los impuestos, explicados de forma sencilla</Text>
        <Text style={s.h2sub}>Qué parte se lleva Hacienda en cada opción, y qué les queda a ustedes</Text>

        <Text style={s.p}>
          Cuando se vende un negocio, Hacienda considera que hay una ganancia y se paga IRPF sobre ella. Se paga por
          tramos, como una escalera: los primeros 6.000 € pagan el 19 %, lo que va de 6.000 € a 50.000 € paga el 21 %,
          y de 50.000 € en adelante, el 23 %. La clave es sencilla: mientras más se cobra en un mismo año, más alto se
          sube en la escalera ese año. Por eso cobrar poco a poco conviene: cada año la escalera vuelve a empezar
          desde abajo.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Opción 1 · Cobrar {eur(data.opcion1Monto)} de un jalón: todo paga impuestos el mismo año</Text>
          <View style={s.lineRow}><Text style={s.lineL}>El año de la venta, Hacienda cobra de una sola vez</Text><Text style={s.lineR}>unos {eur(data.opcion1Irpf)}</Text></View>
          <View style={s.lineRow}><Text style={s.lineL}>De cada 100 € que reciben, se quedan ustedes con</Text><Text style={s.lineR}>{pct1} €</Text></View>
          <View style={[s.lineRow, { borderBottomWidth: 0 }]}><Text style={s.lineL}>Lo que les queda al final, ya libre de impuestos</Text><Text style={s.lineRb}>unos {eur(data.opcion1Neto)}</Text></View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Opción 2 · Cobrar {eur(data.opcion2Total)} en mensualidades: impuestos chiquitos, año por año</Text>
          <Text style={{ fontSize: 9, color: C.soft, lineHeight: 1.55, marginBottom: 8 }}>
            Al cobrar en mensualidades, la ley permite pagar el IRPF también poco a poco: cada año se paga únicamente
            por lo cobrado ese año, arrancando la escalera desde el tramo más bajo. Nunca hay un golpe grande.
          </Text>
          <View style={s.lineRow}><Text style={s.lineL}>El año más caro (el primero), Hacienda cobra solo</Text><Text style={s.lineR}>unos {eur(data.opcion2IrpfPrimer)}</Text></View>
          <View style={s.lineRow}><Text style={s.lineL}>Cada uno de los años siguientes</Text><Text style={s.lineR}>unos {eur(data.opcion2IrpfResto)}</Text></View>
          <View style={[s.lineRow, { borderBottomWidth: 0 }]}><Text style={s.lineL}>Lo que les queda al final, ya libre de impuestos</Text><Text style={s.lineRb}>unos {eur(data.opcion2Neto)}</Text></View>
        </View>

        <View style={s.cmpBox}>
          <Text style={s.cardTitle}>La comparación que de verdad importa</Text>
          <View style={s.lineRow}><Text style={s.lineL}>Opción 1: les queda, después de impuestos</Text><Text style={s.lineR}>unos {eur(data.opcion1Neto)}</Text></View>
          <View style={s.lineRow}><Text style={s.lineL}>Opción 2: les queda, después de impuestos</Text><Text style={s.lineR}>unos {eur(data.opcion2Neto)}</Text></View>
          <View style={[s.lineRow, { borderBottomWidth: 0 }]}><Text style={s.lineL}>Diferencia a favor de ustedes con la opción 2</Text><Text style={s.lineRb}>unos {eur(diferencia)}</Text></View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Un beneficio adicional muy importante por ser mayores de 65 años</Text>
          <Text style={{ fontSize: 9, color: C.soft, lineHeight: 1.6 }}>
            La ley tiene una ventaja pensada justamente para su caso: si el dinero de la venta se destina, dentro de
            los 6 meses siguientes, a contratar una renta vitalicia con una aseguradora (una mensualidad de por vida),
            no se paga nada de IRPF por la ganancia, hasta 240.000 €. Es decir, en lugar de entregarle a Hacienda cerca
            del 20 % de lo cobrado, se quedarían ustedes con el 100 %. Su gestor se los puede confirmar con una llamada,
            y nosotros les ayudamos con mucho gusto en los trámites.
          </Text>
        </View>
        <Text style={{ fontSize: 8, fontStyle: 'italic', color: C.mid, lineHeight: 1.5, marginTop: 4 }}>
          Cifras orientativas con los tramos del ahorro vigentes, suponiendo que el valor de adquisición original del
          negocio es pequeño. Cada situación personal es distinta: su gestor puede afinar los números exactos.
        </Text>
      </Page>

      {/* ── PÁGINA 3 · Acuerdo de reserva ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Acuerdo de reserva</Text>
        <Text style={s.h2sub}>Un compromiso sencillo para avanzar con tranquilidad, por las dos partes</Text>

        <Text style={s.p}>
          En Madrid, a ____ de ____________ de {new Date(data.fecha).getFullYear()}, reunidos de una parte los titulares
          de la concesión del quiosco situado en la {data.direccion} (los «vendedores»), y de otra el «comprador»,
          acuerdan lo siguiente:
        </Text>

        {[
          `La reserva. El comprador entrega en este acto ${eur(data.senal)} como señal de reserva del traspaso del quiosco. Este dinero demuestra que su interés es serio y compensa a los vendedores por dejar de buscar otros interesados durante un tiempo.`,
          `Compromiso de los vendedores. Durante los próximos ${data.reservaDias} días, los vendedores se comprometen a no ofrecer el traspaso a ninguna otra persona ni seguir anunciándolo, y a facilitar al comprador los papeles del quiosco (el título de la concesión, los recibos del canon municipal y demás documentación) así como las visitas que hagan falta.`,
          `Compromiso del comprador. Durante esos mismos ${data.reservaDias} días, el comprador revisará todo lo necesario para confirmar que su proyecto puede salir adelante (la autorización del Ayuntamiento para el cambio de titular, el estado del quiosco y su documentación) y dará una respuesta definitiva antes de que termine el plazo.`,
          `Si todo va bien. Si el comprador confirma que sigue adelante, los ${eur(data.senal)} se descontarán del precio del traspaso que ambas partes acuerden.`,
          `Si aparece un impedimento real. Si el comprador no puede seguir adelante por una causa concreta que impida el proyecto — que el Ayuntamiento no autorice el cambio de titular o el uso previsto, o que aparezca un problema legal o técnico del quiosco que lo haga inviable —, los vendedores devolverán los ${eur(data.senal)} en un plazo máximo de 15 días, y ambas partes quedarán libres.`,
          `Si el comprador se retira sin motivo. Si el comprador decide no seguir sin que exista una de las causas anteriores, los vendedores conservarán los ${eur(data.senal)} como compensación por el tiempo de espera.`,
          `Si los vendedores se retiran. Si durante el plazo los vendedores traspasan el quiosco a otra persona o deciden no seguir, devolverán al comprador los ${eur(data.senal)} de la reserva más otros ${eur(data.compensacion)} en compensación.`,
          `El plazo. Los ${data.reservaDias} días cuentan desde la firma de este documento y pueden ampliarse si las dos partes lo acuerdan por escrito.`,
        ].map((t, i) => (
          <View key={i} style={s.resItem} wrap={false}>
            <Text style={s.resNum}>{i + 1}.</Text>
            <Text style={s.resTx}>{t}</Text>
          </View>
        ))}

        <View style={s.firmaLine}>
          <View style={s.firmaCol}><Text style={s.firmaLbl}>El comprador</Text></View>
          <View style={s.firmaCol}><Text style={s.firmaLbl}>Los vendedores</Text></View>
        </View>
      </Page>
    </Document>
  )
}

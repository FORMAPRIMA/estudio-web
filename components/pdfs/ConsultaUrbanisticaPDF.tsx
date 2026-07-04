// Server-only PDF — Borrador de consulta urbanística especial.
// Mismo patrón factory que el resto de PDFs (sin import de @react-pdf/renderer).
//
// ⚠ Es un BORRADOR de trabajo: la presentación formal se hace por sede
// electrónica con el modelo oficial y las tasas correspondientes.

import type * as ReactPDF from '@react-pdf/renderer'

const C = {
  ink: '#1A1A1A', soft: '#3A3A3A', mid: '#7A7A7A', meta: '#AAAAAA',
  rule: '#E6E4DF', light: '#F8F7F4', brand: '#D85A30',
}

export interface ConsultaUrbanisticaData {
  fecha: string
  solicitante: { nombre: string; nif: string; direccion: string; email: string }
  inmueble: {
    direccion: string | null
    refcat: string | null
    normaZonal: string | null
    superficieParcela: number | null
    superficieConstruida: number | null
  }
  antecedentes: string[]        // hechos con fuente
  cuestiones: string[]          // preguntas concretas a la administración
  documentacionAnexa: string[]
}

export function buildConsultaUrbanisticaElement(
  pdf: typeof ReactPDF,
  data: ConsultaUrbanisticaData
): ReactPDF.DocumentProps & React.ReactElement {
  const { Document, Page, View, Text, StyleSheet } = pdf

  const s = StyleSheet.create({
    page:      { paddingTop: 64, paddingBottom: 72, paddingHorizontal: 68, fontFamily: 'Helvetica', fontSize: 10, color: C.ink, lineHeight: 1.6 },
    draft:     { position: 'absolute', top: 28, right: 68, fontSize: 8, color: C.brand, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase' },
    dest:      { fontSize: 10, marginBottom: 24, color: C.soft },
    title:     { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 22, textTransform: 'uppercase', letterSpacing: 0.5 },
    p:         { fontSize: 10, color: C.soft, marginBottom: 10, textAlign: 'justify' },
    label:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
    li:        { fontSize: 10, color: C.soft, marginBottom: 7, textAlign: 'justify' },
    dataRow:   { flexDirection: 'row', paddingVertical: 3 },
    dataLabel: { width: '38%', fontSize: 9.5, color: C.mid },
    dataValue: { flex: 1, fontSize: 10, color: C.ink },
    firma:     { marginTop: 40 },
    disclaimer:{ position: 'absolute', bottom: 30, left: 68, right: 68, fontSize: 7, color: C.meta, lineHeight: 1.5, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 8 },
  })

  const fmt = (n: number | null) => (n == null ? 's/d' : `${new Intl.NumberFormat('es-ES').format(n)} m²`)

  return (
    <Document title="Borrador — Consulta urbanística especial" author="Forma Prima">
      <Page size="A4" style={s.page}>
        <Text style={s.draft} fixed>Borrador — pendiente de revisión</Text>

        <Text style={s.dest}>
          AL ÁREA DE GOBIERNO DE URBANISMO, MEDIO AMBIENTE Y MOVILIDAD{'\n'}
          AYUNTAMIENTO DE MADRID
        </Text>

        <Text style={s.title}>Consulta urbanística especial{'\n'}(Ordenanza 6/2022, de Licencias y Declaraciones Responsables Urbanísticas)</Text>

        <Text style={s.p}>
          D./Dña. ____________________, en nombre y representación de {data.solicitante.nombre}, con NIF {data.solicitante.nif},
          domicilio a efectos de notificaciones en {data.solicitante.direccion} y correo electrónico {data.solicitante.email},
          comparece y como mejor proceda EXPONE:
        </Text>

        <Text style={s.label}>Identificación del inmueble</Text>
        {[
          ['Emplazamiento', data.inmueble.direccion || 's/d'],
          ['Referencia catastral', data.inmueble.refcat || 's/d'],
          ['Norma zonal (PGOUM 1997)', data.inmueble.normaZonal || 's/d'],
          ['Superficie de parcela (Catastro)', fmt(data.inmueble.superficieParcela)],
          ['Superficie construida (Catastro)', fmt(data.inmueble.superficieConstruida)],
        ].map(([l, v]) => (
          <View key={l as string} style={s.dataRow}>
            <Text style={s.dataLabel}>{l}</Text>
            <Text style={s.dataValue}>{v}</Text>
          </View>
        ))}

        <Text style={s.label}>Antecedentes</Text>
        {data.antecedentes.map((a, i) => (
          <Text key={i} style={s.li}>{i + 1}.  {a}</Text>
        ))}

        <Text style={s.label}>Cuestiones que se plantean</Text>
        <Text style={s.p}>
          Al amparo de lo previsto para las consultas urbanísticas especiales, se solicita pronunciamiento expreso sobre
          las siguientes cuestiones referidas al inmueble identificado:
        </Text>
        {data.cuestiones.map((c, i) => (
          <Text key={i} style={s.li}>{String.fromCharCode(97 + i)})  {c}</Text>
        ))}

        {data.documentacionAnexa.length > 0 && (
          <>
            <Text style={s.label}>Documentación que se acompaña</Text>
            {data.documentacionAnexa.map((d, i) => (
              <Text key={i} style={s.li}>—  {d}</Text>
            ))}
          </>
        )}

        <Text style={{ ...s.p, marginTop: 16 }}>
          Por lo expuesto, SOLICITA que se tenga por presentada esta consulta urbanística especial y, previos los
          trámites oportunos, se emita el informe correspondiente.
        </Text>

        <View style={s.firma}>
          <Text style={s.p}>En Madrid, a {data.fecha}.</Text>
          <Text style={{ ...s.p, marginTop: 28 }}>Fdo.: ____________________</Text>
        </View>

        <Text style={s.disclaimer} fixed>
          Borrador generado por la plataforma interna de análisis urbanístico de Forma Prima a partir de datos de
          Catastro y del Geoportal del Ayuntamiento de Madrid (información sin valor jurídico). Debe ser revisado por el
          técnico responsable antes de su presentación por sede electrónica con el modelo oficial y el abono de las
          tasas que procedan.
        </Text>
      </Page>
    </Document>
  )
}

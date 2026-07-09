// Server-only — se usa solo dentro de la API route con @react-pdf/renderer.
// NO importar desde componentes cliente.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import path from 'path'
import { fmtEUR, fmtPct, tagCambio, type CapCliente } from '@/lib/control-obra/domain'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

export interface ControlObraClientePDFData {
  obra: string
  fecha: string
  totBase: number
  totAct: number
  capitulos: CapCliente[]
}

const C = {
  ink: '#1A1A1A', brand: '#D85A30', up: '#C0492B', down: '#3D8B5F',
  mid: '#6B6862', faint: '#9A968E', rule: '#E6E4DF', soft: '#F5F3EE',
  hInk: '#F0EDE8', hMid: '#8A867F', white: '#FFFFFF',
}

const s = StyleSheet.create({
  page: { paddingBottom: 56, fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white },

  header: { backgroundColor: C.ink, paddingTop: 40, paddingBottom: 30, paddingHorizontal: 44 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 104, objectFit: 'contain' },
  eyebrow: { fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: C.hMid, textAlign: 'right' },
  title: { fontSize: 20, color: C.white, marginTop: 22, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 8.5, color: C.hMid, marginTop: 5 },

  kpis: { flexDirection: 'row', marginHorizontal: 44, marginTop: -18 },
  kpi: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.rule, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 14, marginRight: 10 },
  kpiAccent: { flex: 1, backgroundColor: C.ink, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 14 },
  kpiLabel: { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint },
  kpiLabelAcc: { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.hMid },
  kpiValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  kpiHint: { fontSize: 7, color: C.faint, marginTop: 3 },

  body: { paddingHorizontal: 44, paddingTop: 26 },

  capHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 5, marginTop: 18 },
  capTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'capitalize' },
  capDif: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  colHead: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 2 },
  chConcepto: { flex: 1, fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint },
  chNum: { width: 68, textAlign: 'right', fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint },

  subLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'capitalize', marginTop: 8, marginBottom: 1 },

  row: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.rule, paddingVertical: 6, paddingHorizontal: 2, alignItems: 'flex-start' },
  concepto: { flex: 1, paddingRight: 10 },
  descLine: { flexDirection: 'row', alignItems: 'center' },
  desc: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  tag: { fontSize: 6, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginLeft: 6 },
  nota: { fontSize: 8, color: C.mid, marginTop: 2, lineHeight: 1.4 },
  notaVacia: { fontSize: 7.5, color: C.faint, marginTop: 2, fontFamily: 'Helvetica-Oblique' },
  num: { width: 68, textAlign: 'right', fontSize: 8.5 },
  numB: { width: 68, textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 8 },
  footText: { fontSize: 6.5, color: C.faint },
})

const tagColor = (e: string) => (e === 'nueva' ? '#3B7DD8' : e === 'eliminada' ? C.up : C.brand)
const difColor = (d: number) => (Math.abs(d) < 0.5 ? C.mid : d > 0 ? C.up : C.down)

export function ControlObraClientePDF({ data }: { data: ControlObraClientePDFData }) {
  const dif = data.totAct - data.totBase
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <View style={s.headerTop}>
            <Image src={LOGO_BLANCO} style={s.logo} />
            <View>
              <Text style={s.eyebrow}>Control económico de obra</Text>
              <Text style={[s.eyebrow, { marginTop: 3 }]}>{data.fecha}</Text>
            </View>
          </View>
          <Text style={s.title}>{data.obra}</Text>
          <Text style={s.subtitle}>Resumen de cambios sobre el presupuesto inicial</Text>
        </View>

        {/* KPIs */}
        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Presupuesto inicial</Text>
            <Text style={s.kpiValue}>{fmtEUR(data.totBase)}</Text>
            <Text style={s.kpiHint}>Firmado al inicio</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Presupuesto actual</Text>
            <Text style={s.kpiValue}>{fmtEUR(data.totAct)}</Text>
            <Text style={s.kpiHint}>Con los cambios acordados</Text>
          </View>
          <View style={s.kpiAccent}>
            <Text style={s.kpiLabelAcc}>Diferencia</Text>
            <Text style={[s.kpiValue, { color: C.white }]}>{`${dif > 0 ? '+' : ''}${fmtEUR(dif)}`}</Text>
            <Text style={[s.kpiHint, { color: C.hMid }]}>{data.totBase ? fmtPct(dif / data.totBase) : ''}</Text>
          </View>
        </View>

        {/* Cuerpo */}
        <View style={s.body}>
          {data.capitulos.length === 0 && (
            <Text style={{ fontSize: 10, color: C.mid, marginTop: 20 }}>No hay cambios respecto al presupuesto inicial.</Text>
          )}

          {data.capitulos.map((ch) => (
            <View key={ch.num} wrap={false}>
              <View style={s.capHead}>
                <Text style={s.capTitle}>{ch.num}. {ch.nombre.toLowerCase()}</Text>
                <Text style={[s.capDif, { color: difColor(ch.dif) }]}>
                  {Math.abs(ch.dif) < 0.5 ? '—' : `${ch.dif > 0 ? '+' : ''}${fmtEUR(ch.dif)}`}
                </Text>
              </View>
              <View style={s.colHead}>
                <Text style={s.chConcepto}>Concepto</Text>
                <Text style={s.chNum}>Anterior</Text>
                <Text style={s.chNum}>Nuevo</Text>
                <Text style={s.chNum}>Variación</Text>
              </View>

              {ch.subs.map((sub) => (
                <View key={sub.codigo}>
                  <Text style={s.subLabel}>{sub.nombre.toLowerCase()}</Text>
                  {sub.items.map((it, i) => (
                    <View key={i} style={s.row} wrap={false}>
                      <View style={s.concepto}>
                        <View style={s.descLine}>
                          <Text style={s.desc}>{it.descripcion}</Text>
                          <Text style={[s.tag, { color: tagColor(it.estado) }]}>{tagCambio(it.estado)}</Text>
                        </View>
                        {it.nota
                          ? <Text style={s.nota}>{it.nota}</Text>
                          : <Text style={s.notaVacia}>Sin comentario</Text>}
                      </View>
                      <Text style={[s.num, { color: C.faint, textDecoration: it.estado === 'eliminada' ? 'line-through' : 'none' }]}>
                        {it.estado === 'nueva' ? '—' : fmtEUR(it.ant)}
                      </Text>
                      <Text style={[s.numB, { color: difColor(it.dif) }]}>
                        {it.estado === 'eliminada' ? '—' : fmtEUR(it.nue)}
                      </Text>
                      <Text style={[s.num, { color: difColor(it.dif), fontFamily: 'Helvetica-Bold' }]}>
                        {it.estado === 'nueva' ? 'Nueva' : it.estado === 'eliminada' ? '−100%'
                          : it.pct != null ? `${it.dif > 0 ? '+' : ''}${fmtEUR(it.dif)}\n${fmtPct(it.pct)}` : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>GEINEX GROUP, S.L. · Forma Prima · contacto@formaprima.es</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

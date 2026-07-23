// Server-only — se usa solo dentro de la API route con @react-pdf/renderer.
// NO importar desde componentes cliente.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import path from 'path'
import { fmtEUR, fmtPct, tagCambio, fmtFecha, type CapCliente, type CapPres, type PagoResumen } from '@/lib/control-obra/domain'

const LOGO_BLANCO = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')

export interface ControlObraClientePDFData {
  obra: string
  fecha: string
  totBase: number
  totAct: number
  /** Presupuesto actual con IVA (21%) */
  totActIva: number
  capitulos: CapCliente[]
  presupuesto: CapPres[]
  pagos: PagoResumen[]
  pagadoBase: number
  pagadoTotal: number
  pendienteBase: number
  pendienteTotal: number
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
  desc: { fontSize: 9, fontFamily: 'Helvetica-Bold', flexShrink: 1 },
  tag: { fontSize: 6, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginLeft: 6, flexShrink: 0 },
  nota: { fontSize: 8, color: C.mid, marginTop: 2, lineHeight: 1.4 },
  notaVacia: { fontSize: 7.5, color: C.faint, marginTop: 2, fontFamily: 'Helvetica-Oblique' },
  num: { width: 68, textAlign: 'right', fontSize: 8.5 },
  numB: { width: 68, textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 8 },
  footText: { fontSize: 6.5, color: C.faint },

  // ── Sección "Presupuesto completo" (páginas propias, cabecera compacta) ──
  presPage: { paddingTop: 76, paddingBottom: 56, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white },
  presHeader: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.ink, paddingVertical: 13, paddingHorizontal: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presLogo: { width: 76, objectFit: 'contain' },
  presTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  presIntro: { fontSize: 8.5, color: C.mid, marginTop: 5, lineHeight: 1.5, maxWidth: 400 },

  presCapHead: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 4, marginTop: 16 },
  presCapTitle: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'capitalize', paddingRight: 10 },
  presSubRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.soft, paddingVertical: 3.5, paddingHorizontal: 2, marginTop: 6 },
  presSubName: { flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.mid, textTransform: 'capitalize', paddingRight: 10 },
  presRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.rule, paddingVertical: 3.5, paddingHorizontal: 2, alignItems: 'center' },
  presConcepto: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  presCodigo: { fontSize: 6.5, color: C.faint, width: 52 },
  presDesc: { flex: 1, fontSize: 8 },
  presNum: { width: 62, textAlign: 'right', fontSize: 7.5 },
  presNumB: { width: 62, textAlign: 'right', fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  presColHead: { width: 62, textAlign: 'right', fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint },

  presTotal: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink, borderRadius: 4, marginTop: 16, paddingVertical: 11, paddingHorizontal: 12 },
  presTotalLabel: { flex: 1, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: C.hInk, fontFamily: 'Helvetica-Bold' },
  presTotalNum: { width: 78, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white },

  // ── Portada / resumen ejecutivo ──
  ivaBand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.soft, borderWidth: 1, borderColor: C.rule, borderRadius: 4, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14 },
  ivaLabel: { fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', color: C.mid, fontFamily: 'Helvetica-Bold' },
  ivaValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  secTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 20, paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: C.ink },
  secHint: { fontSize: 7, color: C.faint, marginTop: 3 },
  capVarRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: C.rule, paddingVertical: 3, paddingHorizontal: 2 },
  capVarName: { flex: 1, fontSize: 7.5, textTransform: 'capitalize', paddingRight: 8 },
  capVarNum: { width: 66, textAlign: 'right', fontSize: 7.5 },
  capVarPct: { width: 44, textAlign: 'right', fontSize: 7 },
  pagoRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: C.rule, paddingVertical: 4.5, paddingHorizontal: 2 },
  pagoLabel: { flex: 1, fontSize: 7.5, paddingRight: 8 },
  pagoFecha: { width: 52, fontSize: 7, color: C.mid },
  pagoNum: { width: 64, textAlign: 'right', fontSize: 7.5 },
  pagoEstado: { width: 58, textAlign: 'right', fontSize: 6, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  pagoTotalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: C.ink },
})

const tagColor = (e: string) => (e === 'nueva' ? '#3B7DD8' : e === 'eliminada' ? C.up : C.brand)
const difColor = (d: number) => (Math.abs(d) < 0.5 ? C.mid : d > 0 ? C.up : C.down)

export function ControlObraClientePDF({ data }: { data: ControlObraClientePDFData }) {
  const dif = data.totAct - data.totBase
  return (
    <Document>
      {/* ── Portada: resumen ejecutivo ── */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <Image src={LOGO_BLANCO} style={s.logo} />
            <View>
              <Text style={s.eyebrow}>Control económico de obra</Text>
              <Text style={[s.eyebrow, { marginTop: 3 }]}>{data.fecha}</Text>
            </View>
          </View>
          <Text style={s.title}>{data.obra}</Text>
          <Text style={s.subtitle}>Resumen ejecutivo · presupuesto, variación y calendario de pagos</Text>
        </View>

        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Presupuesto inicial</Text>
            <Text style={s.kpiValue}>{fmtEUR(data.totBase)}</Text>
            <Text style={s.kpiHint}>Firmado al inicio · sin IVA</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Presupuesto actual</Text>
            <Text style={s.kpiValue}>{fmtEUR(data.totAct)}</Text>
            <Text style={s.kpiHint}>Con los cambios acordados · sin IVA</Text>
          </View>
          <View style={s.kpiAccent}>
            <Text style={s.kpiLabelAcc}>Variación</Text>
            <Text style={[s.kpiValue, { color: C.white }]}>{`${dif > 0 ? '+' : ''}${fmtEUR(dif)}`}</Text>
            <Text style={[s.kpiHint, { color: C.hMid }]}>{data.totBase ? `${fmtPct(dif / data.totBase)} sobre el presupuesto inicial` : ''}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* Precio final con IVA */}
          <View style={s.ivaBand}>
            <View>
              <Text style={s.ivaLabel}>Presupuesto actual con IVA (21%)</Text>
              <Text style={[s.secHint, { marginTop: 2 }]}>Importe final estimado a hoy, incluidos los cambios acordados</Text>
            </View>
            <Text style={s.ivaValue}>{fmtEUR(data.totActIva)}</Text>
          </View>

          {/* Variación por capítulo */}
          <Text style={s.secTitle}>Variación por capítulo</Text>
          <View style={[s.capVarRow, { borderTopWidth: 0, paddingBottom: 2 }]}>
            <Text style={[s.capVarName, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Capítulo</Text>
            <Text style={[s.capVarNum, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Inicial</Text>
            <Text style={[s.capVarNum, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Actual</Text>
            <Text style={[s.capVarNum, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Variación</Text>
            <Text style={[s.capVarPct, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>%</Text>
          </View>
          {data.presupuesto.map((ch) => {
            const d = ch.actual - ch.inicial
            return (
              <View key={ch.num} style={s.capVarRow}>
                <Text style={s.capVarName}>{ch.num}. {ch.nombre.toLowerCase()}</Text>
                <Text style={[s.capVarNum, { color: C.mid }]}>{fmtEUR(ch.inicial)}</Text>
                <Text style={[s.capVarNum, { fontFamily: 'Helvetica-Bold' }]}>{fmtEUR(ch.actual)}</Text>
                <Text style={[s.capVarNum, { color: difColor(d), fontFamily: Math.abs(d) < 0.5 ? 'Helvetica' : 'Helvetica-Bold' }]}>
                  {Math.abs(d) < 0.5 ? '—' : `${d > 0 ? '+' : ''}${fmtEUR(d)}`}
                </Text>
                <Text style={[s.capVarPct, { color: difColor(d) }]}>
                  {Math.abs(d) < 0.5 || ch.inicial <= 0 ? '—' : fmtPct(d / ch.inicial)}
                </Text>
              </View>
            )
          })}
          <View style={[s.capVarRow, { borderTopWidth: 1, borderTopColor: C.ink }]}>
            <Text style={[s.capVarName, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
            <Text style={[s.capVarNum, { color: C.mid, fontFamily: 'Helvetica-Bold' }]}>{fmtEUR(data.totBase)}</Text>
            <Text style={[s.capVarNum, { fontFamily: 'Helvetica-Bold' }]}>{fmtEUR(data.totAct)}</Text>
            <Text style={[s.capVarNum, { color: difColor(dif), fontFamily: 'Helvetica-Bold' }]}>{`${dif > 0 ? '+' : ''}${fmtEUR(dif)}`}</Text>
            <Text style={[s.capVarPct, { color: difColor(dif), fontFamily: 'Helvetica-Bold' }]}>{data.totBase ? fmtPct(dif / data.totBase) : '—'}</Text>
          </View>

          {/* Calendario de pagos */}
          <Text style={s.secTitle}>Calendario de pagos a la constructora</Text>
          <View style={[s.pagoRow, { borderTopWidth: 0, paddingBottom: 2 }]}>
            <Text style={[s.pagoLabel, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Concepto</Text>
            <Text style={[s.pagoFecha, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Fecha</Text>
            <Text style={[s.pagoNum, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Sin IVA</Text>
            <Text style={[s.pagoNum, { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint }]}>Con IVA</Text>
            <Text style={[s.pagoEstado, { color: C.faint }]}>Estado</Text>
          </View>
          {data.pagos.map((p, i) => (
            <View key={i} style={s.pagoRow}>
              <Text style={[s.pagoLabel, p.estado === 'programado' ? { color: C.mid } : {}]}>
                {p.label}
                {p.preliminar && <Text style={{ fontSize: 6, color: C.brand, fontFamily: 'Helvetica-Bold' }}>  PRELIMINAR · INCLUYE LA VARIACIÓN</Text>}
              </Text>
              <Text style={s.pagoFecha}>{fmtFecha(p.fecha, p.fechaTexto)}</Text>
              <Text style={[s.pagoNum, { fontFamily: 'Helvetica-Bold' }, p.estado === 'programado' && !p.preliminar ? { color: C.mid } : {}]}>{fmtEUR(p.base, true)}</Text>
              <Text style={[s.pagoNum, { color: C.mid }]}>{fmtEUR(p.total, true)}</Text>
              <Text style={[s.pagoEstado, { color: p.estado === 'pagado' ? C.down : C.faint }]}>{p.estado}</Text>
            </View>
          ))}
          <View style={s.pagoTotalRow}>
            <Text style={[s.pagoLabel, { fontFamily: 'Helvetica-Bold' }]}>Pagado hasta la fecha</Text>
            <Text style={s.pagoFecha} />
            <Text style={[s.pagoNum, { fontFamily: 'Helvetica-Bold' }]}>{fmtEUR(data.pagadoBase, true)}</Text>
            <Text style={[s.pagoNum, { fontFamily: 'Helvetica-Bold' }]}>{fmtEUR(data.pagadoTotal, true)}</Text>
            <Text style={s.pagoEstado} />
          </View>
          <View style={[s.pagoTotalRow, { borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 3 }]}>
            <Text style={[s.pagoLabel, { fontFamily: 'Helvetica-Bold', color: C.brand }]}>Pendiente</Text>
            <Text style={s.pagoFecha} />
            <Text style={[s.pagoNum, { fontFamily: 'Helvetica-Bold', color: C.brand }]}>{fmtEUR(data.pendienteBase, true)}</Text>
            <Text style={[s.pagoNum, { fontFamily: 'Helvetica-Bold', color: C.brand }]}>{fmtEUR(data.pendienteTotal, true)}</Text>
            <Text style={s.pagoEstado} />
          </View>
          <Text style={[s.secHint, { marginTop: 6 }]}>
            La variación del presupuesto se liquida en el último pago: su importe es preliminar e incluye la variación
            acordada a hoy ({`${dif > 0 ? '+' : ''}${fmtEUR(dif)}`} sin IVA). Importes de pago según calendario acordado con la constructora.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>GEINEX GROUP, S.L. · Forma Prima · contacto@formaprima.es</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── Detalle de cambios ── */}
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
            <View key={ch.num}>
              <View style={s.capHead} wrap={false} minPresenceAhead={70}>
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
                  <Text style={s.subLabel} minPresenceAhead={40}>{sub.nombre.toLowerCase()}</Text>
                  {sub.items.map((it, i) => (
                    <View key={i} style={s.row} wrap={false}>
                      <View style={s.concepto}>
                        <View style={s.descLine}>
                          <Text style={s.desc}>
                            {it.descripcion}
                            <Text style={[s.tag, { color: tagColor(it.estado) }]}>  {tagCambio(it.estado).toUpperCase()}</Text>
                          </Text>
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

      {/* ── Presupuesto completo ── */}
      <Page size="A4" style={s.presPage}>
        <View style={s.presHeader} fixed>
          <Image src={LOGO_BLANCO} style={s.presLogo} />
          <Text style={s.eyebrow}>Presupuesto completo · {data.fecha}</Text>
        </View>

        <Text style={s.presTitle}>Presupuesto completo</Text>
        <Text style={s.presIntro}>
          Todas las partidas de {data.obra} con su importe inicial (presupuesto firmado) y el importe actual con los
          cambios acordados. Las partidas sin variación mantienen su precio inicial.
        </Text>

        {data.presupuesto.map((ch) => (
          <View key={ch.num}>
            <View style={s.presCapHead} wrap={false} minPresenceAhead={40}>
              <Text style={s.presCapTitle}>{ch.num}. {ch.nombre.toLowerCase()}</Text>
              <Text style={[s.presColHead, { color: C.mid }]}>Inicial</Text>
              <Text style={[s.presColHead, { color: C.ink }]}>Actual</Text>
              <Text style={s.presColHead}>Variación</Text>
            </View>

            {ch.subs.map((sub) => {
              const sDif = sub.actual - sub.inicial
              return (
                <View key={sub.codigo}>
                  <View style={s.presSubRow} wrap={false} minPresenceAhead={30}>
                    <Text style={s.presSubName}>{sub.nombre.toLowerCase()}</Text>
                    <Text style={[s.presNum, { color: C.faint }]}>{fmtEUR(sub.inicial)}</Text>
                    <Text style={s.presNumB}>{fmtEUR(sub.actual)}</Text>
                    <Text style={[s.presNumB, { color: difColor(sDif) }]}>
                      {Math.abs(sDif) < 0.5 ? '—' : `${sDif > 0 ? '+' : ''}${fmtEUR(sDif)}`}
                    </Text>
                  </View>
                  {sub.items.map((it, i) => {
                    const dif = it.actual - it.inicial
                    const eliminada = it.estado === 'eliminada'
                    return (
                      <View key={i} style={s.presRow} wrap={false}>
                        <View style={s.presConcepto}>
                          <Text style={s.presCodigo}>{it.codigo}</Text>
                          <Text style={[s.presDesc, { textDecoration: eliminada ? 'line-through' : 'none', color: eliminada ? C.faint : C.ink }]}>
                            {it.descripcion}
                            {it.estado !== 'igual' && (
                              <Text style={[s.tag, { color: tagColor(it.estado) }]}>  {tagCambio(it.estado).toUpperCase()}</Text>
                            )}
                          </Text>
                        </View>
                        <Text style={[s.presNum, { color: C.faint }]}>{it.estado === 'nueva' ? '—' : fmtEUR(it.inicial)}</Text>
                        <Text style={[s.presNumB, { color: eliminada ? C.faint : C.ink }]}>{eliminada ? '—' : fmtEUR(it.actual)}</Text>
                        <Text style={[s.presNum, { color: difColor(dif), fontFamily: Math.abs(dif) < 0.5 ? 'Helvetica' : 'Helvetica-Bold' }]}>
                          {Math.abs(dif) < 0.5 ? '—' : `${dif > 0 ? '+' : ''}${fmtEUR(dif)}`}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              )
            })}

            {/* Cierre del capítulo */}
            <View style={[s.presRow, { borderTopWidth: 1, borderTopColor: C.ink, backgroundColor: '#FAF9F6' }]} wrap={false}>
              <View style={s.presConcepto}>
                <Text style={[s.presDesc, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>Total capítulo {ch.num}</Text>
              </View>
              <Text style={[s.presNum, { color: C.mid }]}>{fmtEUR(ch.inicial)}</Text>
              <Text style={s.presNumB}>{fmtEUR(ch.actual)}</Text>
              <Text style={[s.presNumB, { color: difColor(ch.actual - ch.inicial) }]}>
                {Math.abs(ch.actual - ch.inicial) < 0.5 ? '—' : `${ch.actual - ch.inicial > 0 ? '+' : ''}${fmtEUR(ch.actual - ch.inicial)}`}
              </Text>
            </View>
          </View>
        ))}

        {/* Total general */}
        <View style={s.presTotal} wrap={false}>
          <Text style={s.presTotalLabel}>Total presupuesto</Text>
          <Text style={[s.presTotalNum, { color: C.hMid, fontSize: 8.5 }]}>{fmtEUR(data.totBase)}</Text>
          <Text style={s.presTotalNum}>{fmtEUR(data.totAct)}</Text>
          <Text style={[s.presTotalNum, { fontSize: 8.5, color: dif > 0 ? '#F3A18C' : dif < 0 ? '#9BD9B4' : C.white }]}>
            {Math.abs(dif) < 0.5 ? '—' : `${dif > 0 ? '+' : ''}${fmtEUR(dif)}`}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>GEINEX GROUP, S.L. · Forma Prima · contacto@formaprima.es</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

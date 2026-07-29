// Server-only — se usa solo dentro de la API route con @react-pdf/renderer.
// NO importar desde componentes cliente.
//
// Informe de repasos de obra. El mismo componente sirve para las tres audiencias
// (interno / constructora / cliente): la route filtra los repasos ANTES de
// llegar aquí, así que este archivo nunca decide qué es visible.
//
// Estructura:
//   · Portada (A4 vertical) en su propia Page, con héroe a sangre.
//   · Una página por plano (A4 horizontal) con los pins numerados encima.
//   · Fichas de repasos (A4 vertical) con cabecera y pie fijos; el padding de la
//     Page reserva sus bandas para que nunca se solapen con el contenido.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'

let _logo: string | null = null
function logo(): string {
  if (_logo) return _logo
  const file = path.join(process.cwd(), 'public', 'FORMA_PRIMA_BLANCO.png')
  try {
    _logo = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  } catch {
    _logo = file
  }
  return _logo
}

export interface RepasoPDFPin {
  numero: number
  x: number
  y: number
  color: string
}

export interface RepasoPDFPlano {
  nombre: string
  imgSrc: string | null
  aspect: number
  pins: RepasoPDFPin[]
}

export interface RepasoPDFItem {
  codigo: string
  numero: number
  oficio: string
  oficioColor: string
  estado: string
  estadoColor: string
  visibilidad: string | null
  prioridad: string
  descripcion: string
  responsable: string | null
  fechaObjetivo: string | null
  creado: string
  resuelto: string | null
  plano: string
  fotos: { src: string; tipo: string }[]
  fotosOmitidas: number
}

export interface RepasosObraPDFData {
  proyecto: {
    nombre: string
    direccion: string | null
    cliente: string | null
    constructora: string | null
    referencia: string | null
  }
  audiencia: string
  nota: string
  fecha: string
  contadores: { label: string; n: number; color: string }[]
  porOficio: { label: string; n: number; resueltos: number; color: string }[]
  planos: RepasoPDFPlano[]
  repasos: RepasoPDFItem[]
}

const C = {
  ink: '#1A1A1A',
  brand: '#D85A30',
  mid: '#6B6862',
  faint: '#9A968E',
  rule: '#E6E4DF',
  soft: '#F7F5F1',
  hMid: '#8A867F',
  hInk: '#F0EDE8',
  white: '#FFFFFF',
}

// A4 horizontal = 841.89 × 595.28 pt. Con 34 pt de margen y la banda de la
// cabecera fija (54) más el pie (38), el hueco útil del plano es este:
const PLANO_BOX_W = 841.89 - 34 * 2
const PLANO_BOX_H = 595.28 - 54 - 38 - 26

const s = StyleSheet.create({
  // ── Portada ──
  cover: { paddingBottom: 46, fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white },
  hero: { backgroundColor: C.ink, paddingTop: 44, paddingBottom: 34, paddingHorizontal: 44 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 108, objectFit: 'contain' },
  eyebrow: { fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: C.hMid, textAlign: 'right' },
  title: { fontSize: 21, color: C.white, marginTop: 26, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 8.5, color: C.hMid, marginTop: 6, lineHeight: 1.5 },

  kpis: { flexDirection: 'row', marginHorizontal: 44, marginTop: -16 },
  kpi: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.rule, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 13, marginRight: 9 },
  kpiLabel: { fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', color: C.faint },
  kpiValue: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 5 },

  body: { paddingHorizontal: 44, paddingTop: 26 },
  secTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: C.ink, marginTop: 22 },
  secHint: { fontSize: 7.5, color: C.faint, marginTop: 4, lineHeight: 1.5 },

  metaRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.rule, paddingVertical: 5 },
  metaLabel: { width: 110, fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: C.faint },
  metaValue: { flex: 1, fontSize: 9 },

  ofRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: C.rule, paddingVertical: 4.5 },
  ofDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  ofName: { flex: 1, fontSize: 8.5 },
  ofNum: { width: 54, textAlign: 'right', fontSize: 8.5 },
  ofDone: { width: 74, textAlign: 'right', fontSize: 7.5, color: C.mid },

  aviso: { backgroundColor: C.soft, borderWidth: 1, borderColor: C.rule, borderRadius: 4, padding: 12, marginTop: 24 },
  avisoText: { fontSize: 7.5, color: C.mid, lineHeight: 1.55 },

  // ── Páginas de plano (horizontal) ──
  planoPage: { paddingTop: 54, paddingBottom: 38, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white },

  // ── Páginas de fichas (vertical) ──
  listPage: { paddingTop: 54, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 9, color: C.ink, backgroundColor: C.white },

  // Cabecera fija (su alto = 40, reservado por el paddingTop de la Page)
  runHead: { position: 'absolute', top: 0, left: 0, right: 0, height: 40, backgroundColor: C.ink, paddingHorizontal: 34, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  runLogo: { width: 74, objectFit: 'contain' },
  runTitle: { fontSize: 7, letterSpacing: 1.6, textTransform: 'uppercase', color: C.hMid },

  // Pie fijo (alto 24, reservado por el paddingBottom)
  foot: { position: 'absolute', bottom: 16, left: 34, right: 34, height: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 6 },
  footText: { fontSize: 6.5, color: C.faint },

  planoTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  planoHint: { fontSize: 7.5, color: C.faint, marginBottom: 8 },
  planoWrap: { position: 'relative', alignSelf: 'center' },
  planoImg: { objectFit: 'contain' },
  pin: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 1.2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  pinText: { fontSize: 6.5, color: C.white, fontFamily: 'Helvetica-Bold' },

  card: { borderWidth: 1, borderColor: C.rule, borderRadius: 4, marginBottom: 11, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  badgeText: { fontSize: 8, color: C.white, fontFamily: 'Helvetica-Bold' },
  cardCodigo: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  cardTags: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  tag: { fontSize: 6.5, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginRight: 10 },
  estadoPill: { fontSize: 6.5, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', color: C.white, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  desc: { fontSize: 9, lineHeight: 1.5, marginTop: 9 },
  descVacia: { fontSize: 8.5, color: C.faint, fontFamily: 'Helvetica-Oblique', marginTop: 9 },
  fotos: { flexDirection: 'row', marginTop: 10 },
  foto: { width: 148, height: 111, objectFit: 'cover', marginRight: 8, borderRadius: 2 },
  fotoTag: { fontSize: 6, color: C.faint, marginTop: 2 },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 7 },
  metaChip: { fontSize: 7, color: C.mid, marginRight: 14 },
  vacio: { fontSize: 9, color: C.mid, marginTop: 20, lineHeight: 1.5 },
})

function RunningHeader({ proyecto, audiencia }: { proyecto: string; audiencia: string }) {
  return (
    <View style={s.runHead} fixed>
      <Image src={logo()} style={s.runLogo} />
      <Text style={s.runTitle}>
        {proyecto} · repasos de obra · {audiencia}
      </Text>
    </View>
  )
}

function Footer({ fecha }: { fecha: string }) {
  return (
    <View style={s.foot} fixed>
      <Text style={s.footText}>GEINEX GROUP, S.L. · Forma Prima · {fecha}</Text>
      <Text
        style={s.footText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

export function RepasosObraPDF({ data }: { data: RepasosObraPDFData }) {
  const { proyecto, audiencia, fecha } = data
  const meta: { label: string; valor: string }[] = [
    { label: 'Proyecto', valor: proyecto.nombre },
    ...(proyecto.direccion ? [{ label: 'Dirección', valor: proyecto.direccion }] : []),
    ...(proyecto.cliente ? [{ label: 'Cliente', valor: proyecto.cliente }] : []),
    ...(proyecto.constructora ? [{ label: 'Constructora', valor: proyecto.constructora }] : []),
    ...(proyecto.referencia ? [{ label: 'Referencia', valor: proyecto.referencia }] : []),
    { label: 'Fecha del informe', valor: fecha },
    { label: 'Total de repasos', valor: String(data.repasos.length) },
  ]

  return (
    <Document
      title={`Repasos de obra · ${proyecto.nombre}`}
      author="Forma Prima"
      subject="Informe de repasos de obra"
    >
      {/* ── Portada ── */}
      <Page size="A4" style={s.cover}>
        <View style={s.hero}>
          <View style={s.heroTop}>
            <Image src={logo()} style={s.logo} />
            <Text style={s.eyebrow}>Repasos de obra{'\n'}{audiencia}</Text>
          </View>
          <Text style={s.title}>{proyecto.nombre}</Text>
          <Text style={s.subtitle}>
            {[proyecto.direccion, proyecto.cliente].filter(Boolean).join(' · ') || 'Informe de repasos'}
          </Text>
        </View>

        <View style={s.kpis}>
          {data.contadores.map((c) => (
            <View key={c.label} style={s.kpi}>
              <Text style={s.kpiLabel}>{c.label}</Text>
              <Text style={{ ...s.kpiValue, color: c.color }}>{c.n}</Text>
            </View>
          ))}
        </View>

        <View style={s.body}>
          <Text style={s.secTitle}>Datos del informe</Text>
          <View style={{ marginTop: 8 }}>
            {meta.map((m) => (
              <View key={m.label} style={s.metaRow}>
                <Text style={s.metaLabel}>{m.label}</Text>
                <Text style={s.metaValue}>{m.valor}</Text>
              </View>
            ))}
          </View>

          {data.porOficio.length > 0 && (
            <>
              <Text style={s.secTitle}>Repasos por oficio</Text>
              <View style={{ marginTop: 8 }}>
                {data.porOficio.map((o) => (
                  <View key={o.label} style={s.ofRow}>
                    <View style={{ ...s.ofDot, backgroundColor: o.color }} />
                    <Text style={s.ofName}>{o.label}</Text>
                    <Text style={s.ofNum}>{o.n}</Text>
                    <Text style={s.ofDone}>{o.resueltos} resueltos</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={s.aviso} wrap={false}>
            <Text style={s.avisoText}>{data.nota}</Text>
          </View>
        </View>
      </Page>

      {/* ── Un plano por página, en horizontal ── */}
      {data.planos.map((plano, i) => {
        // El plano se encaja dentro del hueco útil conservando su proporción; el
        // recuadro resultante es el sistema de referencia de los pins.
        const porAncho = plano.aspect >= PLANO_BOX_W / PLANO_BOX_H
        const w = porAncho ? PLANO_BOX_W : PLANO_BOX_H * plano.aspect
        const h = porAncho ? PLANO_BOX_W / plano.aspect : PLANO_BOX_H

        return (
          <Page key={`plano-${i}`} size="A4" orientation="landscape" style={s.planoPage}>
            <RunningHeader proyecto={proyecto.nombre} audiencia={audiencia} />
            <Footer fecha={fecha} />

            <Text style={s.planoTitle}>{plano.nombre}</Text>
            <Text style={s.planoHint}>
              {plano.pins.length}{' '}
              {plano.pins.length === 1 ? 'repaso situado' : 'repasos situados'} · el número del pin
              es el del repaso en la ficha
            </Text>

            {plano.imgSrc ? (
              <View style={{ ...s.planoWrap, width: w, height: h }}>
                <Image src={plano.imgSrc} style={{ ...s.planoImg, width: w, height: h }} />
                {plano.pins.map((p) => (
                  <View
                    key={p.numero}
                    style={{
                      ...s.pin,
                      backgroundColor: p.color,
                      left: p.x * w - 8,
                      top: p.y * h - 8,
                    }}
                  >
                    <Text style={s.pinText}>{p.numero}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.vacio}>No se pudo cargar la imagen de este plano.</Text>
            )}
          </Page>
        )
      })}

      {/* ── Fichas ── */}
      <Page size="A4" style={s.listPage}>
        <RunningHeader proyecto={proyecto.nombre} audiencia={audiencia} />
        <Footer fecha={fecha} />

        <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>Detalle de los repasos</Text>
        <Text style={{ ...s.secHint, marginBottom: 14 }}>
          Ordenados por código. Cada ficha corresponde al pin del mismo número en el plano.
        </Text>

        {data.repasos.length === 0 && (
          <Text style={s.vacio}>No hay repasos que mostrar en este informe.</Text>
        )}

        {data.repasos.map((r) => (
          <View key={r.codigo} style={s.card} wrap={false}>
            <View style={s.cardTop}>
              <View style={{ ...s.badge, backgroundColor: r.estadoColor }}>
                <Text style={s.badgeText}>{r.numero}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardCodigo}>{r.codigo}</Text>
                <View style={s.cardTags}>
                  <Text style={{ ...s.tag, color: r.oficioColor }}>{r.oficio}</Text>
                  <Text style={{ ...s.estadoPill, backgroundColor: r.estadoColor }}>{r.estado}</Text>
                </View>
              </View>
            </View>

            {r.descripcion ? (
              <Text style={s.desc}>{r.descripcion}</Text>
            ) : (
              <Text style={s.descVacia}>Sin descripción.</Text>
            )}

            {r.fotos.length > 0 && (
              <View style={s.fotos}>
                {r.fotos.map((f, fi) => (
                  <View key={fi}>
                    <Image src={f.src} style={s.foto} />
                    <Text style={s.fotoTag}>{f.tipo}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.metaLine}>
              <Text style={s.metaChip}>Plano: {r.plano}</Text>
              <Text style={s.metaChip}>Detectado: {r.creado}</Text>
              {r.responsable && <Text style={s.metaChip}>Responsable: {r.responsable}</Text>}
              {r.fechaObjetivo && <Text style={s.metaChip}>Fecha objetivo: {r.fechaObjetivo}</Text>}
              {r.resuelto && <Text style={s.metaChip}>Resuelto: {r.resuelto}</Text>}
              {r.visibilidad && <Text style={s.metaChip}>Visibilidad: {r.visibilidad}</Text>}
              {r.prioridad !== 'Media' && <Text style={s.metaChip}>Prioridad: {r.prioridad}</Text>}
              {r.fotosOmitidas > 0 && (
                <Text style={s.metaChip}>
                  ({r.fotosOmitidas} {r.fotosOmitidas === 1 ? 'foto más' : 'fotos más'} en la
                  plataforma)
                </Text>
              )}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  )
}
